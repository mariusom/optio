import tailwindcss from "@tailwindcss/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin, type UserConfig } from "vite-plus";
import { presets } from "@effect/tsgo/oxlint-presets";

// One test run schedules both projects concurrently; `--project` selects one.
const test: UserConfig["test"] = {
  projects: [
    {
      extends: true,
      // Agent worktrees and scratch checkouts can contain full repository copies.
      test: {
        name: "unit",
        exclude: ["**/node_modules/**", "**/.git/**", "**/.claude/**", "**/.amp/**"],
        typecheck: { enabled: true, checker: "tsrs", include: ["src/**/*.test-d.ts"] },
      },
    },
    {
      extends: true,
      test: {
        name: "browser",
        include: ["src/**/*.browser.ts"],
        browser: {
          enabled: true,
          headless: true,
          provider: playwright(),
          instances: [{ browser: "chromium" }],
        },
      },
    },
  ],
};

// Every Effect rule from every @effect/tsgo preset, as an error, except:
// - experimental-api-usage, and api-stability-leak (maintainers preset), which
//   flags exports that expose experimental or allowlisted unstable APIs. Effect
//   UI is a public preview, so both would flag every use of it.
// - missing-pipeable-signature: dual (pipeable) signatures are for library
//   APIs; Optio's exported helpers are application code.
const effectRules = {
  ...Object.fromEntries(
    Object.values(presets).flatMap((preset) =>
      Object.keys(preset.rules ?? {}).map((rule) => [rule, "error" as const]),
    ),
  ),
  "effecttsgo/experimental-api-usage": "off",
  "effecttsgo/api-stability-leak": "off",
  "effecttsgo/missing-pipeable-signature": "off",
} as const;

// The Effect rules cover the TypeScript project (src and this config), not
// the plain Node scripts.
const effectRulesOff = Object.fromEntries(
  Object.keys(effectRules).map((rule) => [rule, "off" as const]),
);

// Platform globals and native helpers are fine in tests, Node scripts and the
// Vite config; the compiler-level Effect rules still apply there.
const effectNativeExemptions = Object.fromEntries(
  [
    "async-function",
    "global-date",
    "global-date-in-effect",
    "crypto-random-uuid",
    "crypto-random-uuid-in-effect",
    "new-promise",
    "global-timers",
    "global-timers-in-effect",
    "global-console",
    "global-random",
    "process-env",
    "prefer-effect-array",
    "prefer-effect-string",
    "prefer-effect-record",
    "schema-sync",
    "global-json",
    "global-json-in-effect",
    "schema-number",
    "node-builtin-import",
    // A test is the entry point of the program it runs.
    "strict-effect-provide",
  ].map((rule) => [`effecttsgo/${rule}`, "off" as const]),
);

const lint: UserConfig["lint"] = {
  // tsrs runs the type-aware rules, the Effect ones included, and the type check.
  options: { typeAware: true, typeCheck: true },
  // effecttsgo is the Effect-patched binding's plugin (`effect-tsgo vp check`);
  // only `effect-tsgo patch` adds it to Oxlint's config types.
  plugins: ["typescript", "unicorn", "oxc", "import", "promise", "effecttsgo" as never],
  categories: { correctness: "error", suspicious: "error" },
  rules: {
    ...effectRules,
    "max-statements": ["error", 25],
    "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
    "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    "max-depth": ["error", 4],
    complexity: ["error", 15],
    "max-params": ["error", 3],
    "max-nested-callbacks": ["error", 3],
    "import/no-cycle": "error",
    "import/first": "error",
    "import/no-duplicates": "error",
    "import/no-unassigned-import": ["error", { allow: ["**/*.css", "**/*.woff", "**/*.woff2"] }],
    "typescript/no-require-imports": "error",
    // Keep the checker migration separate from auditing existing casts and
    // exhaustive switches (which the compiler already checks for returns).
    "typescript/no-unnecessary-type-assertion": "off",
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/consistent-return": "off",
    "no-unused-vars": ["error", { args: "all", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "promise/catch-or-return": "error",
    "unicorn/no-abusive-eslint-disable": "error",
    "import/no-default-export": "off",
    "no-console": "off",
    "no-underscore-dangle": ["error", { allow: ["_tag"] }],
  },
  overrides: [
    { files: ["scripts/**"], rules: effectRulesOff },
    {
      files: ["src/**/*.test.ts", "src/**/*.browser.ts", "vite.config.ts"],
      rules: effectNativeExemptions,
    },
    {
      // Its event schemas are persisted contracts.
      files: ["src/store/schema.ts"],
      rules: { "effecttsgo/schema-number": "off" },
    },
    {
      // `Command.make(name, { args }, run)` takes the run function as a call
      // argument, so a store read inside `withStore(... Effect.gen(...))`
      // counts one callback deeper than the same body would elsewhere.
      files: ["src/web/features/**/*Commands.ts", "src/web/features/**/commands.ts"],
      rules: { "max-nested-callbacks": ["error", 4] },
    },
    {
      // Generated registry data is not hand-maintained application logic.
      files: ["src/web/componentStyles.generated.ts"],
      rules: { "max-lines": "off" },
    },
    {
      files: [
        "**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}",
        "**/{test,tests,__tests__}/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}",
        "**/*.stories.{js,jsx,ts,tsx}",
        "**/*.story.{js,jsx,ts,tsx}",
        "**/*.browser.ts",
        "**/*.e2e.mjs",
      ],
      rules: {
        "max-statements": "off",
        "max-lines-per-function": "off",
        "max-lines": "off",
        "max-depth": "off",
        complexity: "off",
        "max-params": "off",
        "max-nested-callbacks": "off",
      },
    },
  ],
};

// Deployed to GitHub Pages project site: https://mariusom.github.io/optio/
export default defineConfig(({ command, mode }) => {
  const bundledDev = command === "serve" && mode !== "test";
  const tailwind = tailwindcss();
  if (bundledDev) {
    // Vite+ 0.3.1 forwards this Vite-only hook to Rolldown's incompatible
    // hotUpdate hook (which has no server/environments). Bundled dev already
    // watches the source dependencies registered by Tailwind's transform.
    for (const plugin of tailwind) delete plugin.hotUpdate;
  }
  const publicUrl = process.env.PUBLIC_URL ?? "";
  return defineConfig({
    lint,
    experimental: { bundledDev },
    base: "/optio/",
    resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
    server: {
      port: 60_001,
      allowedHosts: publicUrl === "" ? [] : [new URL(publicUrl).hostname],
    },
    plugins: [
      ...(bundledDev
        ? [
            {
              name: "bundled-dev-lazy-base",
              configureServer(server) {
                // Vite emits root-relative lazy URLs even with a project base:
                // https://github.com/vitejs/vite/issues/23216
                // Run before Vite's base middleware so it can strip the prefix.
                server.middlewares.use((req, _res, next) => {
                  if (req.url?.startsWith("/@vite/lazy?") === true) {
                    req.url = `${server.config.base.slice(0, -1)}${req.url}`;
                  }
                  next();
                });
              },
            } satisfies Plugin,
          ]
        : []),
      ...tailwind,
      VitePWA({
        registerType: "autoUpdate",
        // PNG raster icons (generated by scripts/gen-icons.ts) are required for
        // install/prompt on iOS/Android; the SVG stays in index.html as favicon.
        // icon.svg and THIRD_PARTY_NOTICES.txt are already matched by
        // globPatterns below; listing them here would duplicate precache entries.
        includeAssets: [
          "icon-180.png",
          "icon-192.png",
          "icon-512.png",
          "icon-maskable-512.png",
          "dependency-inventory.json",
        ],
        manifest: {
          name: "optio — offline time & motion studies",
          short_name: "optio",
          description:
            "Create time studies, record tasks, and export CSV. Works offline after initial loading. No account needed.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,wasm,md,txt}"],
          // Public documents are resources, not hash-routed app pages.
          navigateFallbackDenylist: [/\.(?:md|txt)(?:\?|$)/],
        },
      }),
    ],
    optimizeDeps: {
      // Vitest's browser runner imports this optional peer from the optimized graph.
      include: ["@opentelemetry/api"],
      // Avoid a waterfall of small shared dependency chunks over remote dev connections.
      // Also used by tests, which keep Vite's unbundled module/mocking pipeline.
      rolldownOptions: {
        output: {
          codeSplitting: {
            // OpenTelemetry stays out: Vitest externalizes its API, otherwise
            // that external entry imports this initializing chunk.
            groups: [{ name: "vendor", test: /node_modules\/(?!.*@opentelemetry\/)/ }],
          },
        },
      },
    },
    test,
  });
});
