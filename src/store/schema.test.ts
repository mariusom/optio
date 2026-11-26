import { Effect, Layer, Scope } from "effect";
import { EventJournal } from "effect/eventlog";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { materialize } from "./materialize";
import { makeStore } from "./openStore";
import * as queries from "./queries";
import { events } from "./schema";
import { emptyState, tables } from "./tables";

afterEach(() => vi.useRealTimers());

const now = new Date("2026-03-04T09:12:34Z");

it.each([
  events.templateCreated({ id: "t", name: "Study", isDefault: false, now }),
  events.templateUpdated({ id: "t", name: "Edited", isDefault: true, fields: [], now }),
  events.templatesSeeded({
    templates: [{ id: "seed", name: "Sample", isDefault: true, fields: [] }],
    now,
  }),
  events.sessionStarted({
    id: "s",
    templateId: "t",
    templateName: "Study",
    sessionName: "Round",
    now,
  }),
])("keeps $name deterministic and uses the event's timestamp", (event) => {
  vi.useFakeTimers();
  const apply = () => {
    const state = emptyState();
    materialize(state, events.templateCreated({ id: "t", name: "Old", isDefault: false, now }));
    materialize(state, event);
    return state;
  };
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  const before = apply();
  vi.setSystemTime(new Date("2026-09-01T18:00:00Z"));
  expect(apply()).toEqual(before);
  const times = [...before.templates.values(), ...before.sessions.values()].flatMap((row) =>
    "startedAt" in row ? [row.startedAt] : [row.updatedAt],
  );
  expect(times.map((time) => time.getTime())).toContain(now.getTime());
});

const section = {
  sectionName: "Note",
  value: "A",
  sectionType: "textInput",
  isRequired: false,
  startedAt: null,
};

const endedSession = [
  events.sessionStarted({
    id: "s",
    templateId: null,
    templateName: "Study",
    sessionName: "",
    now: new Date(500),
  }),
  events.taskSpawned({ sessionId: "s", id: "t1", orderIndex: 1, fields: [] }),
  events.taskFinished({ id: "t1", endedAt: new Date(3000) }),
  events.sessionEnded({
    id: "s",
    endedAt: new Date(4000),
    records: [
      {
        taskIdNumber: 2,
        taskType: "single",
        startedAt: new Date(1000),
        endedAt: new Date(3000),
        sections: [section, { ...section, value: "B" }],
      },
    ],
  }),
];

it("gives archived answers stable identities, including duplicate section names", () => {
  const state = emptyState();
  for (const event of endedSession) materialize(state, event);
  expect([...state.taskSectionRecords.keys()]).toEqual(["s:2:0", "s:2:1"]);
  expect(tables.taskSectionRecords.select().orderBy("position", "asc").run(state)).toMatchObject([
    { value: "A" },
    { value: "B" },
  ]);
});

it("rebuilds the tables from the journal when the store opens again", async () => {
  const journal = await Effect.runPromise(EventJournal.makeMemory);
  const open = () =>
    Effect.runPromise(
      makeStore(Layer.succeed(EventJournal.EventJournal, journal), "in-memory").pipe(
        Scope.provide(Scope.makeUnsafe()),
      ),
    );
  const first = await open();
  await Effect.runPromise(first.commit(...endedSession));
  await Effect.runPromise(first.commit(events.sessionRenamed({ id: "s", sessionName: "Renamed" })));

  const reopened = await open();
  expect(reopened.query(queries.archivedSessions)).toEqual([
    {
      id: "s",
      templateName: "Study",
      sessionName: "Renamed",
      startedAt: 500,
      endedAt: 4000,
      taskCount: 1,
    },
  ]);
  expect(reopened.query(queries.archiveRows("s")).sections).toHaveLength(2);
});
