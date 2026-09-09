#!/usr/bin/env node
/**
 * Regenerates the runtime class table from foldcn's resolved registries.
 * Source: https://github.com/elianiva/foldcn (MIT), served from the URLs below.
 *
 * Matching is deliberately structural: a local `fooClass` string matches only
 * the same declaration (and, for records, the same property) in each registry.
 * Do not add similarity matching here: a missed entry is safer than a plausible
 * but incorrect class substitution.
 */
import { readFile, writeFile } from "node:fs/promises";

const styles = ["nova", "vega", "maia", "lyra", "mira", "luma", "sera", "rhea"];
const components = [
  "alert-dialog",
  "badge",
  "button",
  "card",
  "checkbox",
  "dialog",
  "empty",
  "input",
  "item",
  "label",
  "native-select",
  "progress",
  "radio-group",
  "separator",
  "sheet",
  "skeleton",
  "switch",
  "textarea",
];

// The runtime table is keyed by the complete local class string. These known
// duplicate strings need one explicit owner because component context is not
// available at lookup time.
const duplicateOwners = new Map([
  ["text-primary underline-offset-4 hover:underline", "buttonVariants.link"],
  ["gap-2.5 px-3 py-2.5", "itemSizes.sm"],
  ["text-muted-foreground text-sm", "sheetDescriptionClass"],
]);

// TypeScript 7's native-preview package does not expose a parser API. This
// lexer handles precisely the declaration forms consumed below while properly
// excluding comments (unlike the old raw quote scan).
const tokens = (source, file) => {
  const result = [];
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (source.startsWith("//", index)) {
      index = source.indexOf("\n", index);
      if (index < 0) break;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) throw new Error(`${file}: unterminated block comment`);
      index = end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      let raw = "";
      for (index++; index < source.length && source[index] !== quote; index++) {
        // foldcn's JSON source spells embedded quotes as \\' in class
        // selectors; consume that registry-specific representation atomically.
        if (source.startsWith(`\\\\${quote}`, index)) {
          raw += quote;
          index += 2;
        } else if (source[index] === "\\") raw += source[index++] + (source[index] ?? "");
        else raw += source[index];
      }
      if (index >= source.length) throw new Error(`${file}: unterminated string literal`);
      const hasTemplateExpression = quote === "`" && raw.includes("${");
      const value = raw
        .replaceAll(`\\${quote}`, quote)
        .replaceAll("\\n", "\n")
        .replaceAll("\\r", "\r")
        .replaceAll("\\t", "\t")
        .replaceAll("\\\\", "\\");
      result.push({ type: hasTemplateExpression ? "template" : "string", value });
      index++;
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = index++;
      while (/[\w$]/.test(source[index] ?? "")) index++;
      result.push({ type: "identifier", value: source.slice(start, index) });
      continue;
    }
    result.push({ type: "punctuation", value: char });
    index++;
  }
  return result;
};

const declarationStrings = (source, file) => {
  const input = tokens(source, file);
  const found = new Map();
  for (let index = 0; index < input.length; index++) {
    if (input[index].value !== "const" || input[index + 1]?.type !== "identifier") continue;
    const name = input[index + 1].value;
    if (!/(?:Class|Variants|Sizes|Base)$/.test(name)) continue;
    while (index < input.length && input[index].value !== "=") index++;
    if (index >= input.length) throw new Error(`${file}: ${name} has no initializer`);
    const start = ++index;
    let depth = 0;
    while (
      index < input.length &&
      !(depth === 0 && input[index].value === ";") &&
      !(
        depth === 0 &&
        index > start &&
        ["export", "type", "const", "function", "interface", "import"].includes(input[index].value)
      )
    ) {
      if (["{", "[", "("].includes(input[index].value)) depth++;
      if (["}", "]", ")"].includes(input[index].value)) depth--;
      index++;
    }
    const initializer = input.slice(start, index);
    if (initializer[0]?.type !== "string" && initializer[0]?.value !== "{") continue;
    const values = [];
    for (let item = 0; item < initializer.length; item++) {
      if (initializer[item].type !== "string") continue;
      // A string followed by ':' is an object key, not a class value.
      if (initializer[item + 1]?.value === ":") continue;
      let path = name;
      if (initializer[item - 1]?.value === ":") {
        const key = initializer[item - 2];
        if (!key || !["identifier", "string"].includes(key.type))
          throw new Error(`${file}: cannot identify property containing ${name}'s string`);
        path += `.${key.value}`;
      }
      values.push([path, initializer[item].value]);
    }
    if (values.length === 0) continue; // aliases such as nativeSelectLabelClass
    for (const [path, value] of values) {
      if (found.has(path)) throw new Error(`${file}: ambiguous style path ${path}`);
      found.set(path, value);
    }
  }
  return found;
};

const load = async (style, component) => {
  const url = `https://foldcn.elianiva.com/r/styles/${style}/${component}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  const json = await response.json();
  if (!json.files?.[0]?.content) throw new Error(`${url}: missing files[0].content`);
  return declarationStrings(json.files[0].content, url);
};

const table = Object.fromEntries(styles.map((style) => [style, {}]));
const tableOwners = Object.fromEntries(styles.map((style) => [style, {}]));
let matched = 0;
for (const component of components) {
  const sources = Object.fromEntries(
    await Promise.all(styles.map(async (style) => [style, await load(style, component)])),
  );
  const localFile = `src/components/ui/${component}.ts`;
  const local = declarationStrings(await readFile(localFile, "utf8"), localFile);
  for (const [path, value] of local) {
    const nova = sources.nova.get(path);
    if (nova === undefined)
      throw new Error(`${localFile}: ${path} is absent from the nova registry`);
    for (const style of styles) {
      const resolved = sources[style].get(path);
      if (resolved === undefined)
        throw new Error(`${component}: ${path} is absent from the ${style} registry`);
      // Preserve the app's explicit customizations relative to Nova (touch
      // sizing and disabled-state selectors), then let the chosen style supply
      // everything else. Nova itself retains the owned component source.
      if (style === "nova") continue;
      const novaTokens = new Set(nova.split(/\s+/));
      const customSizing = value
        .split(/\s+/)
        .filter((token) => !novaTokens.has(token) && !token.startsWith("rounded-"));
      const output = `${resolved} ${customSizing.join(" ")}`.trim();
      if (output === value) continue;
      if (table[style][value] !== undefined && table[style][value] !== output) {
        const owner = duplicateOwners.get(value);
        const previousPath = tableOwners[style][value];
        if (owner === previousPath) continue;
        if (owner !== path)
          throw new Error(
            `${component}: ${path} conflicts with ${previousPath} in ${style}: ${value}`,
          );
      }
      table[style][value] = output;
      tableOwners[style][value] = path;
    }
    matched++;
  }
}

const output =
  `// Generated by scripts/update-foldcn-styles.mjs; do not edit.\n` +
  `// ${matched} class-bearing constants/variant entries from ${components.length} foldcn registry modules; retrieved ${new Date().toISOString().slice(0, 10)}.\n` +
  `export const foldcnComponentStyles: Readonly<Record<string, Readonly<Record<string, string>>>> = ${JSON.stringify(table, null, 2)};\n`;
await writeFile("src/we/componentStyles.generated.ts", output);
console.log(
  `Matched ${matched} class-bearing entries across ${components.length} modules and ${styles.length} styles.`,
);
