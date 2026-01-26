import { $ } from "bun";

console.log("Building for production...");

// Build frontend assets
const result = await Bun.build({
  entrypoints: ["./src/frontend.tsx"],
  outdir: "./dist",
  minify: true,
  sourcemap: "external",
  plugins: [
    // @ts-ignore - bun-plugin-tailwind types
    (await import("bun-plugin-tailwind")).default(),
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy HTML and update paths for production
const html = await Bun.file("./src/index.html").text();
const prodHtml = html
  .replace('./index.css', '/index.css')
  .replace('./frontend.tsx', '/frontend.js');
await Bun.write("./dist/index.html", prodHtml);

console.log("Build complete! Output in ./dist");
