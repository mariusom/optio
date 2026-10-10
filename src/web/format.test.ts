import { describe, expect, it } from "vitest";

import { formatClock, formatDurationHm, formatDurationHms, formatDurationShort } from "./format";

describe("formatDurationHms", () => {
  it("shows seconds for short durations and omits zero parts", () => {
    expect(formatDurationHms(0)).toBe("0s");
    expect(formatDurationHms(6_400)).toBe("6s");
    expect(formatDurationHms(90_000)).toBe("1m 30s");
    expect(formatDurationHms(3_600_000)).toBe("1h");
    expect(formatDurationHms(3_930_000)).toBe("1h 5m 30s");
  });

  it("never shows negative durations", () => {
    expect(formatDurationHms(-5_000)).toBe("0s");
  });
});

describe("formatDurationHm", () => {
  it("truncates to whole minutes", () => {
    expect(formatDurationHm(59_000)).toBe("0m");
    expect(formatDurationHm(90_000)).toBe("1m");
    expect(formatDurationHm(3_600_000)).toBe("1h");
    expect(formatDurationHm(4_320_000)).toBe("1h 12m");
  });
});

describe("formatDurationShort", () => {
  it("shows seconds under a minute, like session detail", () => {
    expect(formatDurationShort(6_400)).toBe("6s");
    expect(formatDurationShort(6_400)).toBe(formatDurationHms(6_400));
    expect(formatDurationShort(0)).toBe("0s");
    expect(formatDurationShort(-1)).toBe("0s");
    expect(formatDurationShort(59_999)).toBe("59s");
  });

  it("keeps compact hours and minutes from one minute up", () => {
    expect(formatDurationShort(60_000)).toBe("1m");
    expect(formatDurationShort(150_000)).toBe("2m");
    expect(formatDurationShort(4_320_000)).toBe("1h 12m");
    expect(formatDurationShort(7_200_000)).toBe("2h");
  });
});

describe("formatClock", () => {
  it("shows minutes and seconds, adding hours when needed", () => {
    expect(formatClock(342_000)).toBe("05:42");
    expect(formatClock(3_807_000)).toBe("1:03:27");
  });
});
