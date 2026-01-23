import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init.js";
import { reviewCommand } from "./commands/review.js";
import pkg from "../../package.json";

const main = defineCommand({
  meta: {
    name: "ont",
    description: "Ontology - Ontology-first backends with human-approved AI access & edits",
    version: pkg.version,
  },
  subCommands: {
    init: initCommand,
    review: reviewCommand,
  },
});

export function run() {
  runMain(main);
}
