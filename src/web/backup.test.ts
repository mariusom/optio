import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  backupFilename,
  backupProblem,
  decodeBackup,
  encodeBackup,
  planRestore,
  restoreSummary,
  type BackupFile,
} from "./backup";

const file: BackupFile = {
  format: "optio-backup",
  version: 1,
  exportedAt: new Date(2026, 9, 10, 9, 30),
  templates: [
    {
      id: "t",
      name: "Assembly line",
      fields: [
        {
          id: "f",
          name: "Station",
          kind: "radio",
          isRequired: true,
          defaultValue: "",
          sortOrder: 0,
          options: ["A", "B"],
          exclusiveOptions: [],
        },
      ],
    },
  ],
  sessions: [
    {
      id: "s",
      templateId: "t",
      templateName: "Assembly line",
      sessionName: "Morning",
      startedAt: new Date(1000),
      endedAt: new Date(5000),
      records: [
        {
          taskIdNumber: 1,
          taskType: "single",
          startedAt: new Date(1500),
          endedAt: new Date(3000),
          sections: [
            {
              sectionName: "Station",
              value: "A",
              sectionType: "radio",
              isRequired: true,
              startedAt: null,
            },
          ],
        },
      ],
    },
  ],
};

describe("backup file", () => {
  it("round-trips through JSON with dates as milliseconds", () => {
    const text = encodeBackup(file);
    expect(JSON.parse(text).sessions[0].startedAt).toBe(1000);
    expect(decodeBackup(text)).toEqual(Option.some(file));
  });

  it("rejects text that is not an Optio backup", () => {
    expect(Option.isNone(decodeBackup("not json"))).toBe(true);
    expect(Option.isNone(decodeBackup("{}"))).toBe(true);
    expect(
      Option.isNone(
        decodeBackup(JSON.stringify({ ...JSON.parse(encodeBackup(file)), version: 2 })),
      ),
    ).toBe(true);
    expect(Option.isNone(decodeBackup("Station,Task type\nA,Walking"))).toBe(true);
  });

  it("names the file by local date", () => {
    expect(backupFilename(new Date(2026, 0, 5, 23, 59))).toBe("optio-backup-2026-01-05.json");
  });

  it("summarises what a restore added and kept", () => {
    expect(restoreSummary({ templates: 2, sessions: 5, skipped: 0 })).toBe(
      "Restored 2 templates and 5 sessions.",
    );
    expect(restoreSummary({ templates: 1, sessions: 1, skipped: 1 })).toBe(
      "Restored 1 template and 1 session; skipped 1 item already here or repeated in the file.",
    );
    expect(restoreSummary({ templates: 0, sessions: 0, skipped: 3 })).toBe(
      "Nothing new to restore; skipped 3 items already here or repeated in the file.",
    );
  });
});

describe("planRestore", () => {
  const [template] = file.templates;
  const none = { templates: [], sessionIds: new Set<string>() };

  it("adds everything to an empty store", () => {
    const plan = planRestore(file, none);
    expect(plan).toEqual({ templates: file.templates, sessions: file.sessions, skipped: 0 });
  });

  it("keeps templates and sessions whose IDs exist", () => {
    const plan = planRestore(file, { templates: [template!], sessionIds: new Set(["s"]) });
    expect(plan).toEqual({ templates: [], sessions: [], skipped: 2 });
  });

  it("matches a same-named template with the same questions and repoints its sessions", () => {
    const local = {
      ...template!,
      id: "local",
      fields: template!.fields.map((f) => ({ ...f, id: "x" })),
    };
    const plan = planRestore(file, { templates: [local], sessionIds: new Set() });
    expect(plan.templates).toEqual([]);
    expect(plan.sessions.map((s) => s.templateId)).toEqual(["local"]);
    expect(plan.skipped).toBe(1);
  });

  it("adds a same-named template whose questions differ", () => {
    const edited = {
      ...template!,
      id: "local",
      fields: template!.fields.map((f) => ({ ...f, id: "local-f", options: ["A", "B", "C"] })),
    };
    const plan = planRestore(file, { templates: [edited], sessionIds: new Set() });
    expect(plan.templates.map((t) => t.id)).toEqual(["t"]);
    expect(plan.sessions.map((s) => s.templateId)).toEqual(["t"]);
  });

  it("skips a template whose question IDs are taken, as the store would", () => {
    const other = { id: "other", name: "Other", fields: template!.fields };
    const plan = planRestore(file, { templates: [other], sessionIds: new Set() });
    expect(plan.templates).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("keeps only the first of any ID repeated within the file", () => {
    const [session] = file.sessions;
    const repeated: BackupFile = {
      ...file,
      templates: [template!, template!],
      sessions: [
        { ...session!, records: [...session!.records, ...session!.records] },
        { ...session!, sessionName: "Copy" },
      ],
    };
    const plan = planRestore(repeated, none);
    expect(plan.templates).toHaveLength(1);
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]!.sessionName).toBe("Morning");
    expect(plan.sessions[0]!.records).toHaveLength(1);
    expect(plan.skipped).toBe(2);
  });
});

describe("backupProblem", () => {
  const now = file.exportedAt.getTime() + 60_000;
  const [template] = file.templates;
  const [session] = file.sessions;
  const [record] = session!.records;
  const withTemplate = (patch: object): BackupFile => ({
    ...file,
    templates: [{ ...template!, ...patch }],
  });
  const withField = (patch: object): BackupFile =>
    withTemplate({ fields: [{ ...template!.fields[0]!, ...patch }] });
  const withSession = (patch: object): BackupFile => ({
    ...file,
    sessions: [{ ...session!, ...patch }],
  });

  it("accepts a backup Optio wrote", () => {
    expect(backupProblem(file, now)).toBeNull();
  });

  it("rejects values the store cannot hold", () => {
    expect(backupProblem(withField({ sortOrder: 1.5 }), now)).not.toBeNull();
    expect(backupProblem(withField({ sortOrder: 1e308 }), now)).not.toBeNull();
    expect(backupProblem(withField({ sortOrder: -1 }), now)).not.toBeNull();
    expect(
      backupProblem(withSession({ records: [{ ...record!, taskIdNumber: -1 }] }), now),
    ).not.toBeNull();
    expect(
      backupProblem(withSession({ records: [{ ...record!, taskIdNumber: 1.5 }] }), now),
    ).not.toBeNull();
  });

  it("rejects unnamed templates and questions", () => {
    expect(backupProblem(withTemplate({ name: " " }), now)).not.toBeNull();
    expect(backupProblem(withField({ name: "" }), now)).not.toBeNull();
    expect(backupProblem(withSession({ templateName: "" }), now)).not.toBeNull();
  });

  it("rejects impossible times", () => {
    expect(
      backupProblem(withSession({ endedAt: new Date(session!.startedAt.getTime() - 1) }), now),
    ).not.toBeNull();
    // After the export, or (with a far-future export date) after now.
    expect(backupProblem(withSession({ endedAt: new Date(2413, 7, 23) }), now)).not.toBeNull();
    const future = {
      ...withSession({ endedAt: new Date(2413, 7, 23) }),
      exportedAt: new Date(2413, 8, 1),
    };
    expect(backupProblem(future, now)).not.toBeNull();
    expect(backupProblem(withSession({ startedAt: new Date(-1) }), now)).not.toBeNull();
  });
});
