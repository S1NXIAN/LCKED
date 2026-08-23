import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

// Same plugin instance eslint-config-next registers (bun dedupe made them
// identical), so redeclaring it in our own blocks is legal — and required,
// because ESLint resolves rule→plugin references per config object.
const tsPlugin = { "@typescript-eslint": tseslint.plugin };

export default defineConfig([
  ...nextCoreWebVitals,

  // Gold-standard TypeScript linting: type-aware rules via the project
  // service (ADR 0002). Rules are lifted out of tseslint's presets (rather
  // than spreading them) so next's preset and ours share one registration.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: tsPlugin,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: Object.assign(
      {},
      ...tseslint.configs.recommendedTypeChecked.map((c) => c.rules ?? {}),
    ),
  },

  // Mechanical import order — packages/absolute, then relative. Autofixable.
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": [
        "error",
        { groups: [["^\\u0000", "^node:", "^@?\\w"], ["^"], ["^\\."]] },
      ],
      "simple-import-sort/exports": "error",
    },
  },

  // Type-aware overrides — need the TS parser + project service, so this
  // block only targets TypeScript files.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: tsPlugin,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── Restored signal (previously off) ────────────────────────────
      // Unused vars and let-that-should-be-const are noise-free wins.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "error",
      // Stale closures over zustand selectors are real bugs; warn so
      // deliberate deps-array choices can be annotated, not silenced.
      "react-hooks/exhaustive-deps": "warn",
      // React's async event handlers are a standard pattern; only flag
      // promise-typed arguments/conditionals, not JSX attributes or
      // object-literal properties where the void return is cosmetic.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false, properties: false } },
      ],

      // ── Deliberate repo-wide choices ─────────────────────────────────
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
    },
  },

  {
    rules: {
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-useless-escape": "off",
      // Core rule stays off so only the TS flavour reports (no doubles).
      "no-unused-vars": "off",
    },
  },

  // Tests: mocks are intentionally loose (vi.fn(async () => {}), unbound
  // method references in expect(), deliberate casts) — typed strictness
  // there is noise, so it stays in src.
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  // Trust boundaries: these parsers ingest third-party JSON of unknown
  // shape (Bitwarden exports, LCKED backups) and validate structure at
  // runtime by design — the unsafe-any family stays off here.
  {
    files: ["src/lib/import/bitwarden.ts", "src/lib/import/lcked.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  // Last: turns off every ESLint rule that fights Prettier (ADR 0002).
  eslintConfigPrettier,

  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "examples/**",
    "skills",
  ]),
]);
