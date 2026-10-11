import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Effect, Option } from "effect";
import { Runtime } from "foldkit";
import { fromString } from "foldkit/url";

import { init, Model, update, view as appView } from "../../../main";
import { initializeControlSize, initializeLook } from "../../browserTheme";
import "../../../index.css";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

let handle: Runtime.EmbedHandle | undefined;
let container: HTMLDivElement | undefined;
const root = document.documentElement;

const mountSettings = async (width: number) => {
  await page.viewport(width, 900);
  container = document.createElement("div");
  container.id = `settings-test-${crypto.randomUUID()}`;
  document.body.append(container);
  const model = init(Option.getOrThrow(fromString("https://example.com/#/settings"))).model;
  handle = Runtime.embed(
    Runtime.makeElement({
      Model,
      container,
      init: () => ({ model }),
      view: (current, h) => appView(current, h).body,
      update,
      slow: false,
    }),
  );
  await expect.element(page.getByRole("radiogroup", { name: "Look" })).toBeVisible();
};

afterEach(() => {
  handle?.dispose();
  container?.remove();
  for (const key of ["optio-look", "optio-control-size", "optio-theme"]) {
    localStorage.removeItem(key);
  }
  delete root.dataset.look;
  delete root.dataset.controlSize;
  root.classList.remove("dark");
});

const themeColor = () =>
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;

describe("settings appearance", () => {
  it("switches the look on the document, browser chrome and storage", async () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    try {
      await mountSettings(390);
      const looks = page.getByRole("radiogroup", { name: "Look" });
      await looks.getByRole("radio", { name: /Blueprint/ }).click();
      await expect.poll(() => root.dataset.look).toBe("blueprint");
      await expect.poll(() => localStorage.getItem("optio-look")).toBe("blueprint");
      expect(themeColor()).toBe("#ecf7ff");
      expect(getComputedStyle(root).getPropertyValue("--background")).toContain("0.97");
      await expect
        .element(looks.getByRole("radio", { name: /Blueprint/ }))
        .toHaveAttribute("aria-checked", "true");
      await looks.getByRole("radio", { name: /Studio/ }).click();
      await expect.poll(() => root.dataset.look).toBe("studio");
      expect(await Effect.runPromise(initializeLook)).toBe("studio");
      await page.getByRole("radio", { name: "Dark", exact: true }).click();
      await expect.poll(themeColor).toBe("#1a1510");
    } finally {
      meta.remove();
    }
  });

  it("turns larger controls on and off and scales the root text", async () => {
    await mountSettings(390);
    const toggle = page.getByRole("switch", { name: "Larger controls" });
    const base = parseFloat(getComputedStyle(root).fontSize);
    await toggle.click();
    await expect.poll(() => root.dataset.controlSize).toBe("large");
    await expect.poll(() => localStorage.getItem("optio-control-size")).toBe("large");
    expect(parseFloat(getComputedStyle(root).fontSize)).toBeCloseTo(base * 1.125);
    expect(await Effect.runPromise(initializeControlSize)).toBe("large");
    await toggle.click();
    await expect.poll(() => root.dataset.controlSize).toBe("standard");
    expect(parseFloat(getComputedStyle(root).fontSize)).toBeCloseTo(base);
  });

  it("renders appearance and icon style as keyboard-operable segmented controls", async () => {
    await mountSettings(390);
    const appearance = page.getByRole("radiogroup", { name: "Appearance" });
    const segments = [...appearance.element().querySelectorAll("label")];
    expect(segments.map((segment) => segment.textContent)).toEqual(["Light", "Dark", "Automatic"]);
    for (const segment of segments) {
      expect(segment.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    // All three fit on one row, even on a phone.
    expect(new Set(segments.map((segment) => segment.getBoundingClientRect().top)).size).toBe(1);
    await appearance.getByRole("radio", { name: "Light", exact: true }).click();
    await expect.poll(() => root.classList.contains("dark")).toBe(false);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => root.classList.contains("dark")).toBe(true);
    await expect.poll(() => localStorage.getItem("optio-theme")).toBe("dark");
    expect(document.activeElement).toBe(
      appearance.getByRole("radio", { name: "Dark", exact: true }).element(),
    );
    const icons = page.getByRole("radiogroup", { name: "Icon style" });
    await expect.element(icons.getByRole("radio", { name: "Hugeicons" })).toBeChecked();
  });

  it("stacks and enlarges answer choices on phones with larger controls", async () => {
    await page.viewport(390, 900);
    // The runner's choice grid (questionControls.ts), identified only by role.
    const shell = document.createElement("div");
    shell.className = "app-shell";
    shell.innerHTML = `<div role="radiogroup" aria-label="Station" class="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(100%,calc(12ch+3rem)),1fr))] gap-2">${[
      "One",
      "Two",
      "Three",
    ]
      .map((label) => `<label><input type="radio" name="station" class="sr-only">${label}</label>`)
      .join("")}</div>`;
    document.body.append(shell);
    try {
      const grid = shell.querySelector<HTMLElement>('[role="radiogroup"]')!;
      const tracks = () => getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      expect(tracks()).toBeGreaterThan(1);
      root.dataset.controlSize = "large";
      expect(tracks()).toBe(1);
      expect(grid.querySelector("label")!.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        56,
      );
      await page.viewport(1024, 900);
      expect(tracks()).toBeGreaterThan(1);
    } finally {
      shell.remove();
    }
  });

  it.each([
    [1440, 2],
    [1024, 1],
  ])("lays settings out in columns at %ipx", async (width, columns) => {
    await mountSettings(width);
    const look = page.getByRole("radiogroup", { name: "Look" }).element();
    const font = page.getByRole("radiogroup", { name: "Font", exact: true }).element();
    const [lookBox, fontBox] = [look, font].map((element) => element.getBoundingClientRect());
    if (columns === 2) {
      expect(fontBox!.left).toBeGreaterThan(lookBox!.right);
    } else {
      expect(fontBox!.top).toBeGreaterThan(lookBox!.bottom);
    }
    // Source order (and so tab order) finishes the first column first.
    expect(look.compareDocumentPosition(font) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
