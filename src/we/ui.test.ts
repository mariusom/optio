import { describe, expect, it } from "vitest";

import { navigationTabs } from "./ui";

describe("navigation tabs", () => {
  it("shows Templates then Session for a user without history", () => {
    expect(navigationTabs(false).map((tab) => tab.label)).toEqual(["Templates", "Session"]);
  });

  it("adds History as the third tab once history exists", () => {
    expect(navigationTabs(true).map((tab) => tab.label)).toEqual([
      "Templates",
      "Session",
      "History",
    ]);
  });
});
