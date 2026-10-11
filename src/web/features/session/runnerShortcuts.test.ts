import { describe, expect, it } from "vitest";

import { isPrimaryShortcut } from "./runnerShortcuts";

const press = (overrides: Partial<Parameters<typeof isPrimaryShortcut>[0]> = {}) => ({
  key: "Enter",
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...overrides,
});

describe("runner primary shortcut", () => {
  it("accepts Ctrl+Enter and ⌘+Enter", () => {
    expect(isPrimaryShortcut(press(), false)).toBe(true);
    expect(isPrimaryShortcut(press({ ctrlKey: false, metaKey: true }), false)).toBe(true);
  });

  it("ignores plain Enter, other keys and extra modifiers", () => {
    expect(isPrimaryShortcut(press({ ctrlKey: false }), false)).toBe(false);
    expect(isPrimaryShortcut(press({ key: "s" }), false)).toBe(false);
    expect(isPrimaryShortcut(press({ shiftKey: true }), false)).toBe(false);
    expect(isPrimaryShortcut(press({ altKey: true }), false)).toBe(false);
  });

  it("ignores held keys, IME composition and open sheets", () => {
    expect(isPrimaryShortcut(press({ repeat: true }), false)).toBe(false);
    expect(isPrimaryShortcut(press({ isComposing: true }), false)).toBe(false);
    expect(isPrimaryShortcut(press(), true)).toBe(false);
  });
});
