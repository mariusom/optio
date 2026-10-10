import tailwindcss from "@tailwindcss/vite";
import { foldkit } from "@foldkit/vite-plugin";
import { playwright } from "vite-plus/test/browser-playwright";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin, type UserConfig } from "vite-plus";
import foldkitRecommendedJson from "@foldkit/oxlint-plugin/recommended.json" with { type: "json" };

type RuleLevel = "error" | "off";
type LintOverride = { files: string[]; excludeFiles?: string[]; rules: Record<string, RuleLevel> };
// JSON imports widen rule levels to `string`; the plugin ships only these two.
const foldkitRecommended = foldkitRecommendedJson as Omit<
  typeof foldkitRecommendedJson,
  "rules" | "overrides"
> & { rules: Record<string, RuleLevel>; overrides: LintOverride[] };

// FoldKit's recommended rules, minus those that assume conventions Optio does
// not use: it has no child Submodels, so `Got…` names store results rather than
// wrapping child Messages, and the Model keeps nullable fields.
const foldkitRules: Record<string, RuleLevel> = {
  ...foldkitRecommended.rules,
  "foldkit/got-prefix-requires-submodel-payload": "off",
  "foldkit/got-wrapper-carries-only-routing": "off",
  "foldkit/no-child-message-construction-in-root": "off",
  "foldkit/prefer-option-over-nullable-in-model": "off",
  // Module state is limited to deliberate handles: the memoized store open
  // (see livestore/client.ts) and the applied style table read by `cn`.
  "foldkit/no-module-level-mutable-state": "off",
};

// One test run schedules both projects concurrently; `--project` selects one.
const test: UserConfig["test"] = {
  projects: [
    {
      extends: true,
      // Agent worktrees under .claude are full repository copies.
      test: { name: "unit", exclude: ["**/node_modules/**", "**/.git/**", "**/.claude/**"] },
    },
    {
      extends: true,
      // Browser tests import these entries directly, outside dependency scanning.
      optimizeDeps: { include: ["foldkit/brand", "@livestore/adapter-web/worker"] },
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

const lint: UserConfig["lint"] = {
  plugins: ["typescript", "unicorn", "oxc", "import", "promise"],
  jsPlugins: foldkitRecommended.jsPlugins,
  categories: { correctness: "error", suspicious: "error" },
  rules: {
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
    "no-unused-vars": ["error", { args: "all", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "promise/catch-or-return": "error",
    "unicorn/no-abusive-eslint-disable": "error",
    "import/no-default-export": "off",
    "no-console": "off",
    "no-underscore-dangle": ["error", { allow: ["_tag"] }],
    ...foldkitRules,
  },
  overrides: [
    // Entry and test files may read the clock or generate IDs directly; Node
    // scripts and browser/e2e tests get the same exemptions as unit tests.
    ...foldkitRecommended.overrides.map((override) =>
      override.files.includes("**/*.test.ts")
        ? { ...override, files: [...override.files, "**/*.browser.ts", "scripts/**"] }
        : override,
    ),
    {
      // Generated registry data is not hand-maintained application logic.
      files: ["src/web/componentStyles.generated.ts"],
      rules: { "max-lines": "off" },
    },
    {
      // Vite supplies default constructors for worker query imports.
      files: ["src/livestore/openStore.ts"],
      rules: { "import/default": "off" },
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
  return defineConfig({
    lint,
    experimental: { bundledDev },
    base: "/optio/",
    resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
    server: {
      port: 60_001,
      allowedHosts: process.env.PUBLIC_URL ? [new URL(process.env.PUBLIC_URL).hostname] : [],
    },
    worker: { format: "es" },
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
                  if (req.url?.startsWith("/@vite/lazy?")) {
                    req.url = `${server.config.base.slice(0, -1)}${req.url}`;
                  }
                  next();
                });
              },
            } satisfies Plugin,
          ]
        : []),
      ...tailwind,
      foldkit(),
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
          theme_color: "#ecf7ff",
          background_color: "#ecf7ff",
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
      // Required by LiveStore's web adapter (see @livestore/adapter-web README)
      exclude: ["@livestore/wa-sqlite"],
      // The shared-worker entry bypasses dependency scanning. Keep its RPC/schema
      // runtime in the same optimized graph instead of mixing raw and bundled Effect.
      include: ["@livestore/adapter-web > @livestore/utils/effect"],
      // Avoid a waterfall of small shared dependency chunks over remote dev connections.
      // Also used by tests, which keep Vite's unbundled module/mocking pipeline.
      rolldownOptions: {
        output: {
          codeSplitting: {
            // FoldKit's plugin serves `foldkit` unbundled, and its pre-bundled
            // companions (UI, DevTools overlay) import it. Grouping them with
            // Effect would make the vendor chunk import raw FoldKit, which
            // imports Effect back from the still-initializing vendor chunk.
            groups: [{ name: "vendor", test: /node_modules\/(?!.*@foldkit\/)/ }],
          },
        },
      },
    },
    test,
  });
});
