// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended, // Dùng bộ luật mặc định ESLint
  {
    files: ["**/*.js"],    // Áp dụng cho mọi file .js
    ignores: ["node_modules/**", "dist/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,   // Cho phép các biến toàn cục của Node.js (process, __dirname, ...)
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "error",
    },
  },
];
