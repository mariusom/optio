import { describe, expect, it } from "vitest";

import {
  buildArchiveCsv,
  csvEscaped,
  dayGroupLabel,
  displayNameFor,
  filenameForArchive,
  filenameSafe,
  formatAnswer,
  formatFilenameDate,
  groupByDay,
  taskCountLabel,
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
    expect(lines[1]).toBe('1,x,"15-06-2026 12:30:45","15-06-2026 12:35:00"');
    expect(lines[2]).toBe("2,,,");
  });

  it("no trailing newline", () => {
    const csv = buildArchiveCsv([{ taskId: 1, startedAt: null, endedAt: null, sections: [] }]);
    expect(csv.endsWith("\n")).toBe(false);
    expect(csv).toBe("id,startTime,endTime\n1,,");
  });

  it("preserves duplicate values in occurrence columns shared across tasks", () => {
    const records = [
      {
        taskId: 2,
        startedAt: null,
        endedAt: null,
        sections: [
          { sectionName: "A", value: "first" },
          { sectionName: "A", value: "second" },
          { sectionName: "A", value: "third" },
        ],
      },
      {
        taskId: 1,
        startedAt: null,
        endedAt: null,
        sections: [{ sectionName: "A", value: "only" }],
      },
    ];
    expect(buildArchiveCsv(records)).toBe(
      'id,A,"A (2)","A (3)",startTime,endTime\n1,only,,,,\n2,first,second,third,,',
    );
    expect(buildArchiveCsv([...records].reverse())).toBe(buildArchiveCsv(records));
  });

  it("avoids collisions with literal suffixed names and reserved CSV headers", () => {
    const names = ["A", "A", "A (2)", "id", "startTime", "endTime"];
    const csv = buildArchiveCsv([
      {
        taskId: 1,
        startedAt: null,
        endedAt: null,
        sections: names.map((sectionName, i) => ({ sectionName, value: `value-${i}` })),
      },
    ]);
    expect(csv).toBe(
      'id,A,"A (3)","A (2)","endTime (1)","id (1)","startTime (1)",startTime,endTime\n1,value-0,value-1,value-2,value-5,value-3,value-4,,',
    );
  });

  it("taskCount derived elsewhere but header union respects duplicate names", () => {
    // union should deduplicate
    const records = [
      { taskId: 1, startedAt: null, endedAt: null, sections: [{ sectionName: "A", value: "1" }] },
      { taskId: 2, startedAt: null, endedAt: null, sections: [{ sectionName: "A", value: "2" }] },
    ];
    const csv = buildArchiveCsv(records);
    expect(csv).toBe("id,A,startTime,endTime\n1,1,,\n2,2,,");
  });
});

describe("dayGroupLabel", () => {
  const now = new Date(2026, 5, 15, 10, 0, 0).getTime();
  it("names today and yesterday", () => {
    expect(dayGroupLabel(new Date(2026, 5, 15, 1, 0, 0).getTime(), now)).toBe("Today");
    expect(dayGroupLabel(new Date(2026, 5, 14, 23, 59, 0).getTime(), now)).toBe("Yesterday");
  });
  it("falls back to a written date for older days", () => {
    const label = dayGroupLabel(new Date(2026, 5, 1, 9, 0, 0).getTime(), now);
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    expect(label).toContain("1");
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 5, 15, 10, 0, 0).getTime();
  it("keeps date order and merges consecutive same-day sessions", () => {
    const groups = groupByDay(
      [
        { startedAt: new Date(2026, 5, 15, 9, 0, 0).getTime() },
        { startedAt: new Date(2026, 5, 15, 8, 0, 0).getTime() },
        { startedAt: new Date(2026, 5, 14, 8, 0, 0).getTime() },
      ],
      now,
    );
    expect(groups.map((group) => [group.label, group.sessions.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
    ]);
  });
  it("returns nothing for no sessions", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("formatAnswer", () => {
  it("says Yes and No for toggles", () => {
    expect(formatAnswer("boolean", "true")).toBe("Yes");
    expect(formatAnswer("boolean", "")).toBe("No");
  });
  it("separates multiple choices with commas", () => {
    expect(formatAnswer("checkbox", "A,B")).toBe("A, B");
  });
  it("shows an em dash when nothing was answered", () => {
    expect(formatAnswer("textInput", "  ")).toBe("—");
    expect(formatAnswer("checkbox", "")).toBe("—");
  });
  it("passes text through unchanged", () => {
    expect(formatAnswer("textArea", "Line one")).toBe("Line one");
  });
});

describe("taskCountLabel", () => {
  it("uses the singular for one task", () => {
    expect(taskCountLabel(1)).toBe("1 task");
    expect(taskCountLabel(0)).toBe("0 tasks");
    expect(taskCountLabel(12)).toBe("12 tasks");
  });
});
