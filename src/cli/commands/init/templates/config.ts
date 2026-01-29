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
      isReadOnly: true,
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
      isReadOnly: true,
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
      isReadOnly: false,
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
      isReadOnly: true,
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
        leftYAxis: ['sales', 'orders'],  // Multiple fields on left axis
      },
      resolver: getSalesData,
    },
  },
});
`;

export const buildTemplate = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
`;

export const bunfigTemplate = `# No longer needed - using Vite instead
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
    "types": ["node"]
  }
}
`;
