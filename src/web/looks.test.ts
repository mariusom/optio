import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { accents, looks, lookThemeColors, type Look } from "./theme";

// Contrast rules for every look and scheme (WCAG 2.2): text 4.5:1 (1.4.3),
// field outlines and focus indicators 3:1 (1.4.11). Colours come from the
// stylesheets themselves, so a palette edit cannot silently break them.

type Tokens = Record<string, string>;

// Read from disk: the unit project does not process CSS imports.
const stylesheet = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const indexCss = stylesheet("index.css");
const looksCss = stylesheet("looks.css");

const blocks = (css: string): Array<{ selectors: Array<string>; body: string }> =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]!.split(",").map((selector) => selector.trim()),
    body: match[2]!,
  }));

const declarations = (body: string): Tokens =>
  Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.replace(/\s+/g, " ").trim(),
    ]),
  );

const allBlocks = [...blocks(indexCss), ...blocks(looksCss)];
const tokensFor = (selector: string): Tokens =>
  Object.assign(
    {},
    ...allBlocks
      .filter((block) => block.selectors.includes(selector))
      .map((block) => declarations(block.body)),
  );

const palette = (look: Look, dark: boolean, accent = "default"): Tokens => ({
  ...tokensFor(":root"),
  ...(dark ? tokensFor(".dark") : {}),
  ...tokensFor(`html[data-look="${look}"]`),
  ...(dark ? tokensFor(`html.dark[data-look="${look}"]`) : {}),
  ...tokensFor(`html[data-accent="${accent}"]`),
  ...(dark ? tokensFor(`html.dark[data-accent="${accent}"]`) : {}),
});

const resolve = (tokens: Tokens, name: string): string => {
  const value = tokens[name];
  if (value === undefined) throw new Error(`Missing ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? resolve(tokens, reference[1]!) : value;
};

type Rgba = Readonly<{ rgb: ReadonlyArray<number>; alpha: number }>;

const oklch = (value: string): Rgba => {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(
    value,
  );
  if (!match) throw new Error(`Not an oklch() colour: ${value}`);
  const lightness = match[2] ? Number(match[1]) / 100 : Number(match[1]);
  const [chroma, hue] = [Number(match[3]), (Number(match[4]) * Math.PI) / 180];
  const [a, b] = [chroma * Math.cos(hue), chroma * Math.sin(hue)];
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
  const alpha = match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1);
  return { rgb: linear, alpha };
};

const luminance = (rgb: ReadonlyArray<number>) =>
  0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;

const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Contrast of `front` over an opaque `back`, compositing translucent fronts. */
const contrast = (tokens: Tokens, front: string, back: string): number => {
  const base = oklch(resolve(tokens, back));
  const top = oklch(resolve(tokens, front));
  const mixed = top.rgb.map((c, i) =>
    decode(encode(c) * top.alpha + encode(base.rgb[i]!) * (1 - top.alpha)),
  );
  const [high, low] = [luminance(mixed), luminance(base.rgb)].toSorted((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
};

const hexOf = (tokens: Tokens, name: string) =>
  oklch(resolve(tokens, name)).rgb.map((c) => Math.round(encode(c) * 255));

const text: ReadonlyArray<readonly [string, string]> = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-foreground", "--sidebar-accent"],
  ["--primary-foreground", "--primary"],
  ["--look-primary-foreground", "--look-primary"],
  ["--warning-foreground", "--warning"],
];
// Pages use these as text unless the look rescopes --primary (Shopfloor's ink).
const primaryText: ReadonlyArray<readonly [string, string]> = [
  ["--primary", "--background"],
  ["--primary", "--card"],
];
const nonText: ReadonlyArray<readonly [string, string]> = [
  ["--input", "--background"],
  ["--input", "--card"],
  ["--ring", "--background"],
  ["--ring", "--card"],
];
const optional: ReadonlyArray<readonly [string, string, number]> = [
  ["--look-ink", "--background", 4.5],
  ["--look-ink", "--card", 4.5],
  ["--look-ink-foreground", "--look-ink", 4.5],
  ["--look-nav-primary", "--sidebar", 4.5],
  ["--look-nav-muted", "--sidebar", 4.5],
  ["--look-nav-primary-foreground", "--look-nav-primary", 4.5],
  ["--look-nav-ring", "--sidebar", 3],
];

const failures = (tokens: Tokens, accent: string): Array<string> => {
  const checks: Array<readonly [string, string, number]> = [
    ...text.map(([front, back]) => [front, back, 4.5] as const),
    ...nonText.map(([front, back]) => [front, back, 3] as const),
    ...(tokens["--look-ink"] === undefined || accent !== "default"
      ? primaryText.map(([front, back]) => [front, back, 4.5] as const)
      : []),
    ...optional.filter(([front]) => tokens[front] !== undefined),
  ];
  return checks.flatMap(([front, back, minimum]) => {
    const ratio = contrast(tokens, front, back);
    return ratio >= minimum ? [] : [`${front} on ${back}: ${ratio.toFixed(2)} < ${minimum}`];
  });
};

// Classic keeps its earlier palette unchanged. These pairs fall just short and
// are not used together by text (muted text on muted fills) or are the
// rounding edge of the 3:1 outline on dark cards; new looks have none.
const classicExceptions: Readonly<Record<"light" | "dark", ReadonlyArray<string>>> = {
  light: ["--muted-foreground on --muted"],
  dark: ["--input on --card"],
};
const unexpected = (look: Look, dark: boolean, found: ReadonlyArray<string>) =>
  look === "classic"
    ? found.filter(
        (failure) =>
          !classicExceptions[dark ? "dark" : "light"].some((pair) => failure.includes(pair)),
      )
    : found;

describe("looks", () => {
  for (const look of looks) {
    for (const dark of [false, true]) {
      it(`${look} ${dark ? "dark" : "light"} keeps text, outline and focus contrast`, () => {
        expect(unexpected(look, dark, failures(palette(look, dark), "default"))).toEqual([]);
      });

      it(`${look} ${dark ? "dark" : "light"} keeps preset accents legible`, () => {
        const results = accents
          .filter((accent) => accent !== "default")
          .flatMap((accent) =>
            failures(palette(look, dark, accent), accent).map((failure) => `${accent}: ${failure}`),
          );
        expect(unexpected(look, dark, results)).toEqual([]);
      });

      it(`${look} ${dark ? "dark" : "light"} browser chrome matches its background`, () => {
        const expected = hexOf(palette(look, dark), "--background");
        const actual = lookThemeColors[look][dark ? "dark" : "light"];
        const channels = [1, 3, 5].map((offset) =>
          Number.parseInt(actual.slice(offset, offset + 2), 16),
        );
        channels.forEach((channel, index) =>
          expect(Math.abs(channel - expected[index]!)).toBeLessThanOrEqual(1),
        );
      });
    }
  }

  it("defines the same tokens for both schemes of every look", () => {
    for (const look of looks.filter((name) => name !== "classic")) {
      const light = Object.keys(tokensFor(`html[data-look="${look}"]`)).filter(
        (name) => name !== "--radius",
      );
      const dark = Object.keys(tokensFor(`html.dark[data-look="${look}"]`));
      expect(dark.toSorted(), look).toEqual(light.toSorted());
    }
  });
});
