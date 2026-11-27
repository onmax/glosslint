import glosslint from "glosslint/eslint";
import vueParser from "vue-eslint-parser";

export default [
  { files: ["**/*.vue"], languageOptions: { parser: vueParser } },
  ...glosslint({ files: ["src/**/*.{js,vue}"] }),
];
