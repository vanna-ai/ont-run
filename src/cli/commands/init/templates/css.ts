// ============================================================================
// CSS Template - Vanna Design System
// ============================================================================

export const cssTemplate = `@import "tailwindcss";

/* Vanna Design System - Tailwind v4 Theme */
@theme {
  /* Colors */
  --color-navy: #023d60;
  --color-cream: #e7e1cf;
  --color-teal: #15a8a8;
  --color-orange: #fe5d26;
  --color-magenta: #bf1363;

  /* Typography */
  --font-serif: "Roboto Slab", serif;
  --font-sans: "Space Grotesk", sans-serif;
  --font-mono: "Space Mono", monospace;

  /* Custom Shadows */
  --shadow-vanna: 0 4px 14px 0 rgba(21, 168, 168, 0.15);
  --shadow-vanna-lg: 0 10px 40px 0 rgba(21, 168, 168, 0.2);
}

/* Base styles */
body {
  font-family: var(--font-sans);
  background-color: var(--color-cream);
  color: var(--color-navy);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-serif);
}

code, pre {
  font-family: var(--font-mono);
}

/* Glass morphism utility */
.glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
`;
