import { describe, expect, it } from "vitest";

import { navigationTabs } from "./ui";

describe("navigation tabs", () => {
  it("keeps Settings available without history", () => {
    expect(navigationTabs(false).map((tab) => tab.label)).toEqual([
      "Templates",
      "Session",
      "Settings",
    ]);
  });

  it("adds History as the third tab once history exists", () => {
    expect(navigationTabs(true).map((tab) => tab.label)).toEqual([
      "Templates",
      "Session",
      "History",
      "Settings",
    ]);
  });
});
