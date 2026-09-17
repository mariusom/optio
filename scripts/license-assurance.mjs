#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const inventoryPath = resolve(root, "public/dependency-inventory.json");
const noticesPath = resolve(root, "public/THIRD_PARTY_NOTICES.txt");
const provenancePath = resolve(root, "licenses/copied-source-and-runtime-notices.txt");
const knownLicenses = new Set([
  "MIT",
  "MIT OR Apache-2.0",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MPL-2.0",
]);
const redisFallback = {
  file: "redis-6.2.1-LICENSE",
  source:
    "https://github.com/redis/node-redis/blob/90fd0652bc3f2a0a1b2f79fa9096b02a86b0ac58/LICENSE",
};
const reviewedFallbacks = new Map([
  [
    "@cloudflare/workers-types@4.20251118.0",
    {
      file: "cloudflare-workers-types-4.20251118.0-LICENSE",
      source:
        "https://github.com/cloudflare/workerd/blob/17143186b375231689b60a23e53933315fd9e24e/LICENSE",
    },
  ],
  [
    "@hugeicons/core-free-icons@4.3.2",
    {
      file: "hugeicons-4.3.2-LICENSE.md",
      source:
        "https://github.com/hugeicons/hugeicons/blob/3e93f5d38c3ffb38319b1b13b128ad4bd45291c1/LICENSE.md",
    },
  ],
  ["redis@6.2.1", redisFallback],
  ["@redis/bloom@6.2.1", redisFallback],
  ["@redis/client@6.2.1", redisFallback],
  ["@redis/json@6.2.1", redisFallback],
  ["@redis/search@6.2.1", redisFallback],
  ["@redis/time-series@6.2.1", redisFallback],
  [
    "qrcode-generator@2.0.4",
    {
      file: "qrcode-generator-2.0.4-LICENSE",
      source: "installed dist/qrcode.js copyright and MIT notice; canonical MIT terms",
    },
  ],
  [
    "stackback@0.0.2",
    {
      file: "stackback-0.0.2-LICENSE",
      source:
        "https://github.com/shtylman/node-stackback/blob/2963095372abf7b75ba55f01cef08ab1e62c2ff4/package.json (MIT); canonical MIT terms, no inferred copyright",
    },
  ],
]);

const licenseFilePattern = /^(?:licen[cs]es?|copying)(?:[._-].*)?$/i;
const noticeFilePattern = /^(?:notices?|third[-_]party[-_](?:notices?|licen[cs]es?))(?:[._-].*)?$/i;

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

// Preserve wording while making copied text stable across line-ending conventions.
function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+$/gm, "")
    .trimEnd();
}

function packagePath(entry, version) {
  const matches = (entry.paths ?? []).filter((path) => {
    try {
      const manifest = JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
      return manifest.name === entry.name && manifest.version === version;
    } catch {
      return false;
    }
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected one installed path for ${entry.name}@${version}, found ${matches.length}`,
    );
  }
  return matches[0];
}

export function collectLicenseTexts(entry, version, options = {}) {
  const read = options.readFile ?? readFileSync;
  const list = options.readdir ?? readdirSync;
  const isFile = options.isFile ?? ((path) => statSync(path).isFile());
  const installedPath = options.packagePath
    ? options.packagePath(entry, version)
    : packagePath(entry, version);
  const names = list(installedPath).filter(
    (name) =>
      (licenseFilePattern.test(name) || noticeFilePattern.test(name)) &&
      isFile(resolve(installedPath, name)),
  );
  const files = names
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      provenance: `installed package file ${name}`,
      text: normalizeText(read(resolve(installedPath, name), "utf8")),
    }));

  if (names.some((name) => licenseFilePattern.test(name))) return files;

  const key = `${entry.name}@${version}`;
  const fallback = (options.fallbacks ?? reviewedFallbacks).get(key);
  if (!fallback) throw new Error(`No license or NOTICE text found for ${key}`);
  const fallbackRoot = options.fallbackRoot ?? resolve(root, "licenses/reviewed-fallbacks");
  return [
    ...files,
    {
      provenance: `reviewed fallback: ${fallback.source}`,
      text: normalizeText(read(resolve(fallbackRoot, fallback.file), "utf8")),
    },
  ];
}

export function normalizeReport(report, role, options = {}) {
  const packages = [];
  for (const [group, entries] of Object.entries(report)) {
    for (const entry of entries) {
      if (!entry.name || !entry.versions?.length)
        throw new Error(`Missing license metadata in ${JSON.stringify(entry)}`);
      for (const version of entry.versions) {
        const license = entry.license;
        if (!license || !knownLicenses.has(license)) {
          throw new Error(
            `Unknown or unapproved license: ${entry.name}@${version} (${license ?? group})`,
          );
        }
        const texts = collectLicenseTexts(entry, version, options).map(({ provenance, text }) => ({
          provenance,
          sha256: sha256(text),
          text,
        }));
        packages.push({
          name: entry.name,
          version,
          license,
          role,
          ...(entry.homepage ? { homepage: entry.homepage } : {}),
          licenseTexts: texts.map(({ provenance, sha256: hash }) => ({ provenance, sha256: hash })),
          _texts: texts,
        });
      }
    }
  }
  return packages;
}

function report(prod) {
  const args = ["licenses", "list", "--json"];
  if (prod) args.push("--prod");
  return JSON.parse(execFileSync("pnpm", args, { cwd: root, encoding: "utf8" }));
}

export function buildInventory(prodReport, allReport, options = {}) {
  const runtime = normalizeReport(prodReport, "production dependency graph", options);
  const runtimeKeys = new Set(runtime.map(({ name, version }) => `${name}@${version}`));
  const generatedCodePattern =
    /^(vite-plugin-pwa|workbox-|@vite-pwa\/|rollup$|@trickfilm400\/rollup-plugin-off-main-thread)/;
  const contributorReport = Object.fromEntries(
    Object.entries(allReport)
      .map(([license, entries]) => [
        license,
        entries.filter(({ name }) => generatedCodePattern.test(name)),
      ])
      .filter(([, entries]) => entries.length),
  );
  const contributors = normalizeReport(
    contributorReport,
    "build-time distribution contributor",
    options,
  ).filter(({ name, version }) => !runtimeKeys.has(`${name}@${version}`));
  const packages = [...runtime, ...contributors].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.version.localeCompare(b.version) ||
      a.role.localeCompare(b.role),
  );
  return {
    schemaVersion: 2,
    scope: [
      "Installed production dependency closure reported by pnpm, including browser, worker and WASM packages.",
      "Installed PWA/Workbox and Rollup packages that can contribute generated code to the distribution; platform-specific Rollup native binaries are omitted.",
      "This is a conservative package inventory, not a byte-complete bill of materials or a claim of legal clearance.",
      "Every package has hashed installed license/NOTICE text or an explicitly version-scoped, reviewed fallback.",
      "License text hashes cover text with CRLF normalized to LF and trailing whitespace removed; wording is preserved.",
      "Copied/adapted source provenance is recorded in THIRD_PARTY_NOTICES.txt.",
    ],
    packages,
  };
}

export function renderArtifacts(prodReport, allReport, options = {}) {
  const built = buildInventory(prodReport, allReport, options);
  const copiedSourceProvenance = readFileSync(provenancePath, "utf8")
    .split("\nBundled MIT-licensed runtime libraries\n", 1)[0]
    .trimEnd();
  const notices = [
    `Optio\n=====\n\n${readFileSync(resolve(root, "LICENSE"), "utf8").trimEnd()}`,
    copiedSourceProvenance,
  ];
  for (const pkg of built.packages) {
    notices.push(
      `${pkg.name}@${pkg.version}\n${"-".repeat(pkg.name.length + pkg.version.length + 1)}\nDeclared license: ${pkg.license}\nRole: ${pkg.role}\n\n${pkg._texts.map(({ provenance, sha256: hash, text }) => `Source: ${provenance}\nSHA-256: ${hash}\n\n${text}`).join("\n\n")}`,
    );
    delete pkg._texts;
  }
  return {
    inventory: `${JSON.stringify(built, null, 2)}\n`,
    notices: `${notices.join("\n\n\n")}\n`,
  };
}

function main() {
  const check = process.argv.includes("--check");
  const output = renderArtifacts(report(true), report(false));
  const files = [
    [inventoryPath, output.inventory],
    [noticesPath, output.notices],
  ];
  if (check) {
    const drift = files.filter(([path, content]) => {
      try {
        return readFileSync(path, "utf8") !== content;
      } catch {
        return true;
      }
    });
    if (drift.length)
      throw new Error(
        `License artifacts are stale: ${drift.map(([p]) => p.slice(root.length + 1)).join(", ")}`,
      );
    console.log(
      `License assurance check passed (${JSON.parse(output.inventory).packages.length} packages).`,
    );
  } else {
    for (const [path, content] of files) writeFileSync(path, content);
    console.log("Updated public dependency inventory and third-party notices.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
