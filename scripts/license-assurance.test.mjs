import assert from "node:assert/strict";
import { test } from "vitest";
import { buildInventory, collectLicenseTexts, renderArtifacts } from "./license-assurance.mjs";

const pkg = (name, version = "1.0.0", path = `/fixture/${name}`) => ({
  name,
  license: "MIT",
  versions: [version],
  paths: [path],
});
const fixtureOptions = (contents) => ({
  packagePath: (entry) => entry.paths[0],
  readdir: (path) => Object.keys(contents[path] ?? {}),
  isFile: () => true,
  readFile: (path) => {
    const directory = path.slice(0, path.lastIndexOf("/"));
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (!(name in (contents[directory] ?? {}))) throw new Error(`missing fixture ${path}`);
    return contents[directory][name];
  },
});

test("fails when an installed package has no license text", () => {
  assert.throws(
    () =>
      collectLicenseTexts(
        pkg("missing"),
        "1.0.0",
        fixtureOptions({ "/fixture/missing": { "package.json": "{}" } }),
      ),
    /No license or NOTICE text/,
  );
  assert.throws(
    () =>
      collectLicenseTexts(
        pkg("notice-only"),
        "1.0.0",
        fixtureOptions({
          "/fixture/notice-only": { NOTICE: "Attribution is not a license grant" },
        }),
      ),
    /No license/,
  );
});

test("refuses a reviewed fallback after its package version changes", () => {
  const options = {
    ...fixtureOptions({ "/fixture/scoped": { "package.json": "{}" } }),
    fallbacks: new Map([["scoped@1.0.0", { file: "LICENSE", source: "reviewed" }]]),
  };
  assert.throws(
    () => collectLicenseTexts(pkg("scoped", "2.0.0"), "2.0.0", options),
    /scoped@2\.0\.0/,
  );
});

test("inventory hashes and notices include each package's actual asymmetric text", () => {
  const options = fixtureOptions({
    "/fixture/alpha": {
      LICENSE: "alpha-only license\n",
      "THIRD-PARTY-LICENSE": "alpha embedded dependency terms\n",
    },
    "/fixture/beta": { LICENSE: "beta license", "THIRD-PARTY-NOTICES.md": "beta-only notice\n" },
  });
  const report = { MIT: [pkg("beta"), pkg("alpha")] };
  const built = buildInventory(report, report, options);
  assert.deepEqual(
    built.packages.map(({ name }) => name),
    ["alpha", "beta"],
  );
  assert.notEqual(
    built.packages[0].licenseTexts[0].sha256,
    built.packages[1].licenseTexts[0].sha256,
  );

  // renderArtifacts reads only the repository's preserved copied-source provenance.
  const rendered = renderArtifacts(report, report, options);
  assert.match(rendered.notices, /alpha-only license/);
  assert.match(rendered.notices, /alpha embedded dependency terms/);
  assert.match(rendered.inventory, /THIRD-PARTY-LICENSE/);
  assert.match(rendered.notices, /beta-only notice/);
  assert.match(rendered.notices, /Copyright \(c\) 2026 Marius Matei/);
  assert.match(rendered.inventory, /sha256/);

  const changed = renderArtifacts(
    report,
    report,
    fixtureOptions({
      "/fixture/alpha": {
        LICENSE: "alpha-only license\n",
        "THIRD-PARTY-LICENSE": "changed embedded dependency terms\n",
      },
      "/fixture/beta": { LICENSE: "beta license", "THIRD-PARTY-NOTICES.md": "beta-only notice\n" },
    }),
  );
  assert.notEqual(changed.inventory, rendered.inventory);
  assert.notEqual(changed.notices, rendered.notices);
  assert.match(changed.notices, /beta-only notice/);
});

test("omits platform-specific Rollup native packages from deterministic contributors", () => {
  const options = fixtureOptions({
    "/fixture/runtime": { LICENSE: "runtime" },
    "/fixture/rollup": { LICENSE: "rollup" },
  });
  const inventory = buildInventory(
    { MIT: [pkg("runtime")] },
    { MIT: [pkg("runtime"), pkg("rollup"), pkg("@rollup/rollup-linux-x64-gnu")] },
    options,
  );
  assert.deepEqual(
    inventory.packages.map(({ name }) => name),
    ["rollup", "runtime"],
  );
});
