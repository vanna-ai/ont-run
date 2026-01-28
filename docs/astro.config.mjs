import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://ont-run.com",
  base: "/docs",
  integrations: [
    starlight({
      title: "ont-run",
      description:
        "Ontology-first backends with human-approved AI access & edits",
      logo: {
        src: "./public/logo.svg",
        replacesTitle: false,
      },
      favicon: "/favicon.svg",
      social: {
        github: "https://github.com/vanna-ai/ont-run",
      },
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.googleapis.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: true,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600&family=Space+Mono&display=swap",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:site_name",
            content: "ont-run",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:type",
            content: "website",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://ont-run.com/assets/images/og-image.png",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://ont-run.com/assets/images/og-image.png",
          },
        },
      ],
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
            { label: "MCP App Visualization UI", link: "/guides/ui-visualization/" },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "defineOntology", link: "/api/define-ontology/" },
            { label: "fieldFrom", link: "/api/field-from/" },
            { label: "userContext", link: "/api/user-context/" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
