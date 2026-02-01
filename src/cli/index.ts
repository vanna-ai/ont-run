import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init/index.js";
import { reviewCommand } from "./commands/review.js";
import { loginCommand } from "./commands/login.js";
import { generateSdkCommand } from "./commands/generate-sdk.js";
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
    login: loginCommand,
    "generate-sdk": generateSdkCommand,
  },
});

export function run() {
  runMain(main);
}
