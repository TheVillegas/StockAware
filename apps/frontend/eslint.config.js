const tsParser = require("@typescript-eslint/parser");

const htmlNoopPlugin = {
  processors: {
    html: {
      meta: { name: "html-noop" },
      preprocess() {
        return [];
      },
      postprocess(messages) {
        return messages.flat();
      },
    },
  },
};

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    plugins: {
      "html-noop": htmlNoopPlugin,
    },
  },
  {
    files: ["**/*.html"],
    processor: "html-noop/html",
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
];
