import { describe, expect, it } from "vitest";

import { navigationTabs } from "./navigation";

describe("navigation tabs", () => {
  it("keeps all four sections in a stable order", () => {
    expect(navigationTabs.map((tab) => tab.label)).toEqual([
      "Templates",
      "Session",
      "History",
      "Settings",
    ]);
  });
});
