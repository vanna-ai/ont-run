import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "ont",
      description:
        "Ontology-first backends with human-approved AI access & edits",
      social: {
        github: "https://github.com/anthropics/ont",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", link: "/" },
            { label: "Quick Start", link: "/getting-started/" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Entities", link: "/guides/entities/" },
            { label: "Field References", link: "/guides/field-references/" },
            { label: "Access Control", link: "/guides/access-control/" },
            { label: "Output Schemas", link: "/guides/output-schemas/" },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "defineOntology", link: "/api/define-ontology/" },
            { label: "fieldFrom", link: "/api/field-from/" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
