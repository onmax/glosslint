#!/usr/bin/env node
import { cac } from "cac";
import pkg from "../package.json" with { type: "json" };

const cli = cac("glosslint");

function notImplemented(): never {
  console.error("not implemented");
  process.exit(2);
}

cli
  .command("[...files]", "Check Markdown and text files against the corpus")
  .alias("check")
  .option("--config <path>", "Config file (default: glosslint.config.{ts,mts,js,mjs})")
  .option("--format <format>", "Output format: text or json", { default: "text" })
  .action(notImplemented);

cli
  .command("test", "Check every term's good and bad examples")
  .option("--config <path>", "Config file")
  .action(notImplemented);

cli
  .command("print", "Print the corpus as a Markdown glossary or JSON")
  .option("--config <path>", "Config file")
  .option("--format <format>", "Output format: md or json", { default: "md" })
  .action(notImplemented);

cli
  .command("explain <query>", "Show what the corpus says about a word or phrase")
  .option("--config <path>", "Config file")
  .action(notImplemented);

cli.help();
cli.version(pkg.version);
cli.parse();
