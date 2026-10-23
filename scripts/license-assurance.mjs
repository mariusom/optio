#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
// License classes that appear only in dev-only packages, which the collector
// does not inventory. Naming them here keeps the fail-closed check but reports
// why the class is out of scope when a package using it reaches the production
// closure or a generated-code contributor path.
const devOnlyLicenses = new Map([
  ["BlueOak-1.0.0", "build tooling reached through workbox-build"],
  ["CC-BY-4.0", "caniuse-lite browser-support data read by browserslist at build time"],
  ["(MIT OR CC0-1.0)", "type-fest types reached through tempy and workbox-build"],
]);
const redisFallback = {
  file: "redis-6.3.0-LICENSE",
  source:
    "https://github.com/redis/node-redis/blob/c3e8b53b0d9c97d05ca674f92a24a9ee91a50a0e/LICENSE",
};
const yukuFallback = {
  file: "yuku-0.19.0-LICENSE",
  source:
    "https://github.com/yuku-toolchain/yuku/blob/f8496bd8dfd52ae528ade3bfe4c1ea57d1bde635/LICENSE",
};
const reviewedFallbacks = new Map([
  ...[
    "win32-x64",
    "darwin-x64",
    "freebsd-x64",
    "win32-arm64",
    "darwin-arm64",
    "android-arm64",
    "linux-arm-gnu",
    "linux-x64-gnu",
    "linux-arm-musl",
    "linux-x64-musl",
    "linux-arm64-gnu",
    "linux-arm64-musl",
  ].map((platform) => [`@yuku-core/binding-${platform}@0.19.0`, yukuFallback]),
  ["@yuku-toolchain/types@0.19.0", yukuFallback],
  ["yuku-core@0.19.0", yukuFallback],
  ["yuku-parser@0.19.0", yukuFallback],
  // Native packages omit LICENSE; each entry is scoped to the reviewed release.
  ...[
    "darwin-x64",
    "darwin-arm64",
    "linux-x64-gnu",
    "linux-x64-musl",
    "win32-x64-msvc",
    "linux-arm64-gnu",
    "linux-arm64-musl",
    "win32-arm64-msvc",
  ].map((platform) => [
    `@voidzero-dev/vite-plus-${platform}@1.3.0`,
    {
      file: "vite-plus-1.3.0-LICENSE",
      source:
        "https://github.com/voidzero-dev/vite-plus/blob/afbe4a285b4ac6ffac498eae71b10ff63069a029/LICENSE",
    },
  ]),
  [
    "sirv@3.0.2",
    {
      file: "sirv-3.0.2-LICENSE",
      source:
        "https://github.com/lukeed/sirv/blob/1135207e92c40354543cbd15c763c7a61d79d432/license",
    },
  ],
  [
    "@polka/url@1.0.0-next.29",
    {
      file: "polka-url-1.0.0-next.29-LICENSE",
      source:
        "https://github.com/lukeed/polka/blob/02cbdb529ddca0a9f3d225e2abb2931924219cc3/license",
    },
  ],
  [
    "@cloudflare/workers-types@4.20251118.0",
    {
      file: "cloudflare-workers-types-4.20251118.0-LICENSE",
      source:
        "https://github.com/cloudflare/workerd/blob/17143186b375231689b60a23e53933315fd9e24e/LICENSE",
    },
  ],
  ["redis@6.3.0", redisFallback],
  ["@redis/bloom@6.3.0", redisFallback],
  ["@redis/client@6.3.0", redisFallback],
  ["@redis/json@6.3.0", redisFallback],
  ["@redis/search@6.3.0", redisFallback],
  ["@redis/time-series@6.3.0", redisFallback],
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
    .toSorted((a, b) => a.localeCompare(b))
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
          const devOnly = license ? devOnlyLicenses.get(license) : undefined;
          throw new Error(
            devOnly
              ? `License ${license} is treated as dev-only (${devOnly}) but ${entry.name}@${version} is in the ${role}. Review it and extend knownLicenses if it is distributed.`
              : `Unknown or unapproved license: ${entry.name}@${version} (${license ?? group})`,
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
          texts,
        });
      }
    }
  }
  return packages;
}

function readLicenseReport(prod) {
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
  const packages = [...runtime, ...contributors].toSorted(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.version.localeCompare(b.version) ||
      a.role.localeCompare(b.role),
  );
  return {
    schemaVersion: 2,
    scope: [
      "Installed production dependency closure reported by pnpm, including browser, worker and WASM packages.",
      "Conservative superset: upstream manifests can declare build- or test-only packages as production dependencies, so some inventoried packages are absent from the distribution.",
      "Installed PWA/Workbox and Rollup packages that can contribute generated code to the distribution; platform-specific Rollup native binaries are omitted, and build-only compilers that emit no third-party source (for example TypeScript and the Tailwind CSS chain) are not added as contributors, though they remain included when the production closure already contains them.",
      "License classes seen only in dev-only packages are recorded in the collector and rejected if they reach this scope.",
      "This is a conservative package inventory, not a byte-complete bill of materials or a claim of legal clearance.",
      "Every package has hashed installed license/NOTICE text or an explicitly version-scoped, reviewed fallback.",
      "License text hashes cover text with CRLF normalized to LF and trailing whitespace removed; wording is preserved.",
      "Copied/adapted source provenance and patched dependencies are recorded in THIRD_PARTY_NOTICES.txt.",
    ],
    packages,
  };
}

export function renderArtifacts(prodReport, allReport, options = {}) {
  const built = buildInventory(prodReport, allReport, options);
  const copiedSourceProvenance = (
    options.provenanceText ?? readFileSync(provenancePath, "utf8")
  ).trimEnd();
  const notices = [
    `Optio\n=====\n\n${readFileSync(resolve(root, "LICENSE"), "utf8").trimEnd()}`,
    copiedSourceProvenance,
  ];
  for (const pkg of built.packages) {
    notices.push(
      `${pkg.name}@${pkg.version}\n${"-".repeat(pkg.name.length + pkg.version.length + 1)}\nDeclared license: ${pkg.license}\nRole: ${pkg.role}\n\n${pkg.texts.map(({ provenance, sha256: hash, text }) => `Source: ${provenance}\nSHA-256: ${hash}\n\n${text}`).join("\n\n")}`,
    );
    delete pkg.texts;
  }
  return {
    inventory: `${JSON.stringify(built, null, 2)}\n`,
    notices: `${notices.join("\n\n\n")}\n`,
  };
}

function groupByName(packages) {
  const grouped = new Map();
  for (const pkg of packages) {
    const entry = grouped.get(pkg.name) ?? {
      versions: new Set(),
      licenses: new Set(),
      hashes: new Set(),
    };
    entry.versions.add(pkg.version);
    entry.licenses.add(pkg.license);
    for (const { sha256: hash } of pkg.licenseTexts) entry.hashes.add(hash);
    grouped.set(pkg.name, entry);
  }
  return grouped;
}

const listed = (values) => [...values].toSorted((a, b) => a.localeCompare(b)).join(", ");

function describeChange(name, before, after) {
  if (!before)
    return { review: [`Added \`${name}\` ${listed(after.versions)} (${listed(after.licenses)})`] };
  if (!after) return { other: [`Removed \`${name}\` ${listed(before.versions)}`] };
  const review = [];
  if (listed(before.licenses) !== listed(after.licenses))
    review.push(`\`${name}\` license ${listed(before.licenses)} → ${listed(after.licenses)}`);
  else if (listed(before.hashes) !== listed(after.hashes))
    review.push(`\`${name}\` license or notice text changed`);
  const other =
    listed(before.versions) === listed(after.versions)
      ? []
      : [`\`${name}\` ${listed(before.versions)} → ${listed(after.versions)}`];
  return { review, other };
}

const summarySection = (title, lines) =>
  lines.length ? [`### ${title}`, "", ...lines.map((line) => `- ${line}`), ""] : [];

// Compares inventories by package name, so a version bump that keeps the same
// license and text is reported apart from changes a reviewer should read.
export function summarizeChanges(previous, current) {
  const before = groupByName(previous.packages);
  const after = groupByName(current.packages);
  const names = [...new Set([...before.keys(), ...after.keys()])].toSorted((a, b) =>
    a.localeCompare(b),
  );
  const review = [];
  const other = [];
  for (const name of names) {
    const change = describeChange(name, before.get(name), after.get(name));
    review.push(...(change.review ?? []));
    other.push(...(change.other ?? []));
  }
  const lines = [
    "## Dependency licenses",
    "",
    ...summarySection("Review", review),
    ...summarySection("Versions and removals", other),
  ];
  if (!review.length && !other.length) lines.push("No changes from the deployed inventory.", "");
  return lines.join("\n");
}

// Reports against the deployed inventory without failing: the validation in
// --check is the gate, this only makes license changes visible in the PR run.
async function reportChanges(baselineUrl, inventory) {
  let summary;
  try {
    const response = await fetch(baselineUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    summary = summarizeChanges(await response.json(), inventory);
  } catch (error) {
    summary = `## Dependency licenses\n\nCould not compare with ${baselineUrl}: ${error.message}\n`;
  }
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

async function main() {
  const args = process.argv.slice(2);
  const output = renderArtifacts(readLicenseReport(true), readLicenseReport(false));
  const inventory = JSON.parse(output.inventory);
  const compareAt = args.indexOf("--compare");
  if (compareAt !== -1) {
    await reportChanges(args[compareAt + 1], inventory);
  } else if (args.includes("--check")) {
    console.log(`License assurance check passed (${inventory.packages.length} packages).`);
  } else {
    writeFileSync(inventoryPath, output.inventory);
    writeFileSync(noticesPath, output.notices);
    console.log("Generated public dependency inventory and third-party notices.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await main();
