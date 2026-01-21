import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init.js";
import { reviewCommand } from "./commands/review.js";

const main = defineCommand({
  meta: {
    name: "ont",
    description: "Ontology - Ontology-first backends with human-approved AI access & edits",
    version: "0.1.0",
  },
  subCommands: {
    init: initCommand,
    review: reviewCommand,
  },
});

export function run() {
  runMain(main);
}
