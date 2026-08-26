import { describe, expect, it } from "vitest";

import { formatCsvDate } from "../../format";
import {
  buildArchiveCsv,
  csvEscaped,
  displayNameFor,
  filenameForArchive,
  filenameSafe,
  formatFilenameDate,
} from "./helpers";

describe("displayNameFor", () => {
  it("returns sessionName when non-empty", () => {
    expect(displayNameFor("My Session", "Template")).toBe("My Session");
  });
  it("falls back to templateName when sessionName empty", () => {
    expect(displayNameFor("", "Template")).toBe("Template");
  });
  it("handles spaces and trimming? spec treats empty string only", () => {
    expect(displayNameFor("   ", "Template")).toBe("   ");
  });
});

describe("filenameSafe", () => {
  it("replaces spaces with underscores", () => {
    expect(filenameSafe("My Session 2024")).toBe("My_Session_2024");
    expect(filenameSafe("Optio Eye")).toBe("Optio_Eye");
  });
  it("leaves non-space characters intact", () => {
    expect(filenameSafe("NoSpaces")).toBe("NoSpaces");
    expect(filenameSafe("a  b")).toBe("a__b");
  });
});

describe("csvEscaped", () => {
  it("empty returns empty", () => {
    expect(csvEscaped("")).toBe("");
  });
  it("plain value not quoted", () => {
    expect(csvEscaped("hello")).toBe("hello");
    expect(csvEscaped("123")).toBe("123");
  });
  it("value with comma quoted", () => {
    expect(csvEscaped("a,b")).toBe('"a,b"');
  });
  it("value with space quoted", () => {
    expect(csvEscaped("a b")).toBe('"a b"');
    expect(csvEscaped("Hello World")).toBe('"Hello World"');
  });
  it("value with tab quoted", () => {
    expect(csvEscaped("a\tb")).toBe('"a\tb"');
  });
  it("value with CRLF quoted", () => {
    expect(csvEscaped("a\rb")).toBe('"a\rb"');
    expect(csvEscaped("a\nb")).toBe('"a\nb"');
    expect(csvEscaped("a\r\nb")).toBe('"a\r\nb"');
  });
  it("value with quote quoted and doubled", () => {
    expect(csvEscaped('a"b')).toBe('"a""b"');
    expect(csvEscaped('Say "hello"')).toBe('"Say ""hello"""');
  });
  it("inner quotes doubled correctly multiple", () => {
    expect(csvEscaped('""')).toBe('""""""');
  });
});

describe("formatFilenameDate", () => {
  it("formats as yyyy-MM-dd_HH-mm-ss", () => {
    const d = new Date(2026, 0, 2, 3, 4, 5); // Jan 02 2026 03:04:05 local
    expect(formatFilenameDate(d)).toBe("2026-01-02_03-04-05");
  });
  it("pads month/day/hour/min/sec", () => {
    const d = new Date(2026, 11, 9, 9, 8, 7); // Dec 09 09:08:07
    expect(formatFilenameDate(d)).toBe("2026-12-09_09-08-07");
  });
});

describe("filenameForArchive", () => {
  it("prefix optio and suffix .csv", () => {
    const d = new Date(2026, 5, 15, 12, 30, 45);
    const name = filenameForArchive("My Session", d);
    expect(name).toBe("optio_My_Session_2026-06-15_12-30-45.csv");
  });
  it("uses displayName spaces→underscores", () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(filenameForArchive("A B C", d)).toContain("A_B_C");
  });
});

describe("buildArchiveCsv", () => {
  it("empty records → header only id + times", () => {
    const csv = buildArchiveCsv([]);
    expect(csv).toBe("id,startTime,endTime");
  });

  it("header union alphabetical", () => {
    const records = [
      {
        taskId: 2,
        startedAt: null,
        endedAt: null,
        sections: [
          { sectionName: "Zebra", value: "z" },
          { sectionName: "Activity", value: "a" },
        ],
      },
      {
        taskId: 1,
        startedAt: null,
        endedAt: null,
        sections: [
          { sectionName: "Category", value: "c" },
          { sectionName: "Activity", value: "b" },
        ],
      },
    ];
    const csv = buildArchiveCsv(records);
    const lines = csv.split("\n");
    // header alphabetical: Activity, Category, Zebra + id/startTime/endTime
    expect(lines[0]).toBe("id,Activity,Category,Zebra,startTime,endTime");
  });

  it("rows sorted taskId ASC regardless of input order", () => {
    const records = [
      {
        taskId: 3,
        startedAt: new Date(2026, 0, 1, 10, 0, 0),
        endedAt: new Date(2026, 0, 1, 10, 5, 0),
        sections: [{ sectionName: "Activity", value: "C" }],
      },
      {
        taskId: 1,
        startedAt: new Date(2026, 0, 1, 9, 0, 0),
        endedAt: new Date(2026, 0, 1, 9, 5, 0),
        sections: [{ sectionName: "Activity", value: "A" }],
      },
      {
        taskId: 2,
        startedAt: null,
        endedAt: null,
        sections: [{ sectionName: "Activity", value: "B" }],
      },
    ];
    const csv = buildArchiveCsv(records);
    const rows = csv.split("\n");
    // row 1 should be task 1
    expect(rows[1]?.startsWith("1,")).toBe(true);
    expect(rows[2]?.startsWith("2,")).toBe(true);
    expect(rows[3]?.startsWith("3,")).toBe(true);
  });

  it("missing sections fill empty cell", () => {
    const records = [
      {
        taskId: 1,
        startedAt: null,
        endedAt: null,
        sections: [{ sectionName: "Activity", value: "x" }],
      },
      {
        taskId: 2,
        startedAt: null,
        endedAt: null,
        sections: [{ sectionName: "Notes", value: "y" }],
      },
    ];
    const csv = buildArchiveCsv(records);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("id,Activity,Notes,startTime,endTime");
    // row for task 1: Activity=x, Notes empty
    expect(lines[1]).toBe("1,x,,,");
    // row for task 2: Activity empty, Notes=y
    expect(lines[2]).toBe("2,,y,,");
  });

  it("escapes values and headers with space/comma/quote", () => {
    const records = [
      {
        taskId: 1,
        startedAt: null,
        endedAt: null,
        sections: [
          { sectionName: "My Field", value: "hello, world" },
          { sectionName: "Other", value: 'say "hi"' },
        ],
      },
    ];
    const csv = buildArchiveCsv(records);
    // header My Field contains space → quoted
    expect(csv.split("\n")[0]).toBe('id,"My Field",Other,startTime,endTime');
    // value hello, world contains comma + space → quoted
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"say ""hi"""');
  });

  it("times formatted dd-MM-yyyy HH:mm:ss and empty when absent", () => {
    const start = new Date(2026, 5, 15, 12, 30, 45);
    const end = new Date(2026, 5, 15, 12, 35, 0);
    const csv = buildArchiveCsv([
      {
        taskId: 1,
        startedAt: start,
        endedAt: end,
        sections: [{ sectionName: "Activity", value: "x" }],
      },
      { taskId: 2, startedAt: null, endedAt: null, sections: [] },
    ]);
    const lines = csv.split("\n");
    const expectedStart = formatCsvDate(start);
    const expectedEnd = formatCsvDate(end);
    // first data row should contain formatted dates (may be quoted if space triggers? dates contain space → quoted per spec)
    // Our csvEscaped will quote dates because they contain space
    expect(lines[1]).toContain(csvEscaped(expectedStart));
    expect(lines[1]).toContain(csvEscaped(expectedEnd));
    // second row has empty times → ,, at end (since startTime,endTime empty)
    expect(lines[2]).toBe("2,,,");
  });

  it("no trailing newline", () => {
    const csv = buildArchiveCsv([{ taskId: 1, startedAt: null, endedAt: null, sections: [] }]);
    expect(csv.endsWith("\n")).toBe(false);
    expect(csv).toBe("id,startTime,endTime\n1,,");
  });

  it("taskCount derived elsewhere but header union respects duplicate names", () => {
    // union should deduplicate
    const records = [
      { taskId: 1, startedAt: null, endedAt: null, sections: [{ sectionName: "A", value: "1" }] },
      { taskId: 2, startedAt: null, endedAt: null, sections: [{ sectionName: "A", value: "2" }] },
    ];
    const csv = buildArchiveCsv(records);
    expect(csv.split("\n")[0]).toBe("id,A,startTime,endTime");
  });
});

describe("history taskCount (pure)", () => {
  it("counts tasks per session", () => {
    const taskRecords = [
      { sessionId: "s1", id: "r1" },
      { sessionId: "s1", id: "r2" },
      { sessionId: "s2", id: "r3" },
    ] as const;
    const counts = new Map<string, number>();
    for (const r of taskRecords) counts.set(r.sessionId, (counts.get(r.sessionId) ?? 0) + 1);
    expect(counts.get("s1")).toBe(2);
    expect(counts.get("s2")).toBe(1);
    expect(counts.get("s3") ?? 0).toBe(0);
  });
});
