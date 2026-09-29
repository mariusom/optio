import { afterEach, expect, it } from "vitest";
import { createStorePromise } from "@livestore/livestore";
import { makeInMemoryAdapter } from "@livestore/adapter-web";

import type { FieldDef } from "../domain/fields";
import { events, schema, tables } from "./schema";
import * as queries from "./queries";

const fields: FieldDef[] = ["Activity", "Notes"].map((name, sortOrder) => ({
  id: name,
  name,
  kind: "textInput",
  isRequired: false,
  defaultValue: "",
  sortOrder,
  options: [],
  exclusiveOptions: [],
}));

const stores: Array<{ shutdownPromise: () => Promise<unknown> }> = [];
const openStore = async () => {
  const store = await createStorePromise({
    schema,
    storeId: `queries-${crypto.randomUUID()}`,
    adapter: makeInMemoryAdapter(),
  });
  stores.push(store);
  return store;
};
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.shutdownPromise()));
});

const start = (id: string, now: number) => [
  events.sessionStarted({
    id,
    templateId: null,
    templateName: "Study",
    sessionName: "",
    now: new Date(now),
  }),
  events.taskSpawned({ sessionId: id, id: `${id}-1`, orderIndex: 1, fields }),
];

it("keeps one live session when two tabs start at once", async () => {
  const store = await openStore();
  store.commit(...start("first", 1000), ...start("second", 2000));
  expect(store.query(tables.sessions.select()).map((row) => row.id)).toEqual(["first"]);
  expect(store.query(tables.sessionTasks.select()).map((row) => row.sessionId)).toEqual(["first"]);
  expect(store.query(queries.activeSession)).toMatchObject({ id: "first", completedCount: 0 });
});

it("keeps the first finish time when a task is recorded twice", async () => {
  const store = await openStore();
  store.commit(
    ...start("s", 1000),
    events.taskFinished({ id: "s-1", endedAt: new Date(2000) }),
    events.taskFinished({ id: "s-1", endedAt: new Date(3000) }),
  );
  expect(store.query(tables.sessionTasks.select())[0]?.endDate?.getTime()).toBe(2000);
  expect(store.query(queries.activeSession)?.completedCount).toBe(1);
});

it("seeds sample templates once with one default when two tabs seed an empty store", async () => {
  const store = await openStore();
  const seed = (suffix: string) =>
    events.templatesSeeded({
      now: new Date(1000),
      templates: ["Assembly line", "Ward round"].map((name, index) => ({
        id: `${name}-${suffix}`,
        name,
        isDefault: index === 0,
        fields: fields.map((field) => ({ ...field, id: `${name}-${suffix}-${field.id}` })),
      })),
    });
  store.commit(seed("a"), seed("b"));
  const templates = store.query(queries.templateSummaries);
  expect(templates.map((row) => row.id).toSorted()).toEqual(["Assembly line-a", "Ward round-a"]);
  expect(templates.filter((row) => row.isDefault === 1)).toHaveLength(1);
  expect(templates.map((row) => row.fieldCount)).toEqual([2, 2]);
});

it("emits one consistent runner result when a task is recorded", async () => {
  const store = await openStore();
  store.commit(...start("s", 1000));
  const results: Array<{ tasks: number; fields: number }> = [];
  const unsubscribe = store.subscribe(queries.runnerRows("s"), (value) =>
    results.push({ tasks: value.tasks.length, fields: value.fields.length }),
  );
  try {
    results.length = 0;
    store.commit(
      events.taskFinished({ id: "s-1", endedAt: new Date(2000) }),
      events.taskSpawned({ sessionId: "s", id: "s-2", orderIndex: 2, fields }),
    );
    // Neither the new task without its answers nor the finish alone is ever emitted.
    expect(results).toEqual([{ tasks: 2, fields: 4 }]);
  } finally {
    unsubscribe();
  }
});

const archivedTask = (taskIdNumber: number) => ({
  taskIdNumber,
  taskType: "single",
  startedAt: null,
  endedAt: new Date(2000),
  sections: ["First", "Second", "Third"].map((sectionName) => ({
    sectionName,
    value: "",
    sectionType: "textInput",
    isRequired: false,
    startedAt: null,
  })),
});
it("reads one session's archive with answers in question order", async () => {
  const store = await openStore();
  for (const id of ["a", "b"]) {
    store.commit(
      ...start(id, id === "a" ? 1000 : 5000),
      events.taskFinished({ id: `${id}-1`, endedAt: new Date(2000) }),
      events.sessionEnded({
        id,
        endedAt: new Date(6000),
        records: [archivedTask(2), archivedTask(1)],
      }),
      events.sessionLiveGraphCleared({ sessionId: id }),
    );
  }
  const { session, records, sections } = store.query(queries.archiveRows("a"));
  expect(session?.id).toBe("a");
  expect(records.map((row) => row.taskId)).toEqual([1, 2]);
  expect(sections).toHaveLength(6);
  expect(sections.every((row) => row.taskRecordId.startsWith("a:"))).toBe(true);
  expect(sections.map((row) => row.sectionName)).toEqual([
    "First",
    "Second",
    "Third",
    "First",
    "Second",
    "Third",
  ]);
  expect(store.query(queries.archivedSessions)).toEqual([
    expect.objectContaining({ id: "b", taskCount: 2, startedAt: 5000, endedAt: 6000 }),
    expect.objectContaining({ id: "a", taskCount: 2, startedAt: 1000, endedAt: 6000 }),
  ]);
});

it("updates archived and active sessions as a session ends", async () => {
  const store = await openStore();
  store.commit(...start("s", 1000), events.taskFinished({ id: "s-1", endedAt: new Date(2000) }));
  const archived: Array<number> = [];
  const active: Array<string | null> = [];
  const unsubscribes = [
    store.subscribe(queries.archivedSessions, (rows) => archived.push(rows.length)),
    store.subscribe(queries.activeSession, (row) => active.push(row?.id ?? null)),
  ];
  try {
    store.commit(
      events.sessionEnded({ id: "s", endedAt: new Date(3000), records: [archivedTask(1)] }),
      events.sessionLiveGraphCleared({ sessionId: "s" }),
    );
    expect(archived).toEqual([0, 1]);
    expect(active).toEqual(["s", null]);
  } finally {
    for (const unsubscribe of unsubscribes) unsubscribe();
  }
});
