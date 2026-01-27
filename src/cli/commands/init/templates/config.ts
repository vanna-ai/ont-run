// ============================================================================
// Configuration Templates
// ============================================================================

export const configTemplate = `import { defineOntology, userContext } from 'ont-run';
import { z } from 'zod';

// Import resolver functions - TypeScript enforces return types match outputs
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import deleteUser from './resolvers/deleteUser.js';
import getSalesData from './resolvers/getSalesData.js';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  // Pluggable auth - customize this for your use case
  // Return { groups, user } for row-level access control
  auth: async (req) => {
    // Accept token from header or query param (useful for webhooks, MCP clients, etc.)
    const header = req.headers.get('Authorization');
    const url = new URL(req.url);
    const token = header || url.searchParams.get('token');

    // Return access groups and optional user data
    // This is where you'd verify JWTs, API keys, etc.
    if (!token) return { groups: ['public'] };
    if (token === 'admin-secret') {
      return {
        groups: ['admin', 'support', 'public'],
        user: { id: 'admin-1', email: 'admin@example.com' },
      };
    }
    return {
      groups: ['support', 'public'],
      user: { id: 'user-1', email: 'user@example.com' },
    };
  },

  accessGroups: {
    public: { description: 'Unauthenticated users' },
    support: { description: 'Support agents' },
    admin: { description: 'Administrators' },
  },

  entities: {
    User: { description: 'A user account' },
  },

  functions: {
    // Example: Public function
    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'support', 'admin'],
      entities: [],
      inputs: z.object({}),
      outputs: z.object({
        status: z.string(),
        env: z.string(),
        timestamp: z.string(),
      }),
      resolver: healthCheck,
    },

    // Example: Restricted function with row-level access
    getUser: {
      description: 'Get user details by ID',
      access: ['support', 'admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
        // currentUser is injected from auth - not visible to API callers
        currentUser: userContext(z.object({
          id: z.string(),
          email: z.string(),
        })),
      }),
      outputs: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string(),
      }),
      resolver: getUser,
    },

    // Example: Admin-only function
    deleteUser: {
      description: 'Delete a user account',
      access: ['admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
        reason: z.string().optional(),
      }),
      outputs: z.object({
        success: z.boolean(),
        deletedUserId: z.string(),
        deletedAt: z.string(),
      }),
      resolver: deleteUser,
    },

    // Example: Function with UI visualization (MCP Apps)
    // When called via MCP, results are displayed in an interactive chart/table
    getSalesData: {
      description: 'Get sales data for visualization',
      access: ['public', 'support', 'admin'],
      entities: [],
      inputs: z.object({
        region: z.string().optional(),
      }),
      outputs: z.array(z.object({
        month: z.string(),
        sales: z.number(),
        orders: z.number(),
      })),
      // Enable interactive visualization in MCP clients
      // Configure chart type and axes for optimal display
      ui: {
        type: 'chart',
        chartType: 'bar',
        xAxis: 'month',
      },
      resolver: getSalesData,
    },
  },
});
`;

export const buildTemplate = `import { $ } from "bun";

console.log("Building for production...");

// Build frontend assets
const result = await Bun.build({
  entrypoints: ["./src/frontend.tsx"],
  outdir: "./dist",
  minify: true,
  sourcemap: "external",
  plugins: [
    // @ts-ignore - bun-plugin-tailwind types
    (await import("bun-plugin-tailwind")).default,
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
`;

export const bunfigTemplate = `[serve.static]
plugins = ["bun-plugin-tailwind"]
`;

export const tsconfigTemplate = `{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false,
    "types": ["bun"]
  }
}
`;
