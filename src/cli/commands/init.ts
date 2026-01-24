import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import consola from "consola";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates are bundled in the package
const TEMPLATES_DIR = join(__dirname, "..", "..", "..", "templates");

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new Ontology project",
  },
  args: {
    dir: {
      type: "positional",
      description: "Directory to initialize (default: current directory)",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files",
      default: false,
    },
  },
  async run({ args }) {
    const targetDir = args.dir === "." ? process.cwd() : join(process.cwd(), args.dir);

    consola.info(`Initializing Ontology project in ${targetDir}`);

    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check for existing config
    const configPath = join(targetDir, "ontology.config.ts");
    if (existsSync(configPath) && !args.force) {
      consola.error("ontology.config.ts already exists. Use --force to overwrite.");
      process.exit(1);
    }

    // Create resolvers directory
    const resolversDir = join(targetDir, "resolvers");
    if (!existsSync(resolversDir)) {
      mkdirSync(resolversDir, { recursive: true });
    }

    // Write ontology.config.ts
    const configTemplate = `import { defineOntology, userContext } from 'ont-run';
import { z } from 'zod';

// Import resolver functions - TypeScript enforces return types match outputs
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import deleteUser from './resolvers/deleteUser.js';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  // Pluggable auth - customize this for your use case
  // Return { groups, user } for row-level access control
  auth: async (req) => {
    const token = req.headers.get('Authorization');
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
      resolver: deleteUser,
    },
  },
});
`;

    writeFileSync(configPath, configTemplate);
    consola.success("Created ontology.config.ts");

    // Write example resolvers
    const healthCheckResolver = `import type { ResolverContext } from 'ont-run';

export default async function healthCheck(ctx: ResolverContext) {
  ctx.logger.info('Health check called');

  return {
    status: 'ok',
    env: ctx.env,
    timestamp: new Date().toISOString(),
  };
}
`;

    const getUserResolver = `import type { ResolverContext } from 'ont-run';

interface GetUserArgs {
  userId: string;
  currentUser: {
    id: string;
    email: string;
  };
}

export default async function getUser(ctx: ResolverContext, args: GetUserArgs) {
  ctx.logger.info(\`Getting user: \${args.userId}\`);
  ctx.logger.info(\`Requested by: \${args.currentUser.email}\`);

  // Example: Check if user can access this resource
  // Support can only view their own account
  if (!ctx.accessGroups.includes('admin') && args.userId !== args.currentUser.id) {
    throw new Error('You can only view your own account');
  }

  // This is where you'd query your database
  // Example response:
  return {
    id: args.userId,
    name: 'Example User',
    email: 'user@example.com',
    createdAt: '2025-01-01T00:00:00Z',
  };
}
`;

    const deleteUserResolver = `import type { ResolverContext } from 'ont-run';

interface DeleteUserArgs {
  userId: string;
  reason?: string;
}

export default async function deleteUser(ctx: ResolverContext, args: DeleteUserArgs) {
  ctx.logger.warn(\`Deleting user: \${args.userId}, reason: \${args.reason || 'none'}\`);

  // This is where you'd delete from your database
  // Example response:
  return {
    success: true,
    deletedUserId: args.userId,
    deletedAt: new Date().toISOString(),
  };
}
`;

    writeFileSync(join(resolversDir, "healthCheck.ts"), healthCheckResolver);
    writeFileSync(join(resolversDir, "getUser.ts"), getUserResolver);
    writeFileSync(join(resolversDir, "deleteUser.ts"), deleteUserResolver);
    consola.success("Created example resolvers in resolvers/");

    // Write server.ts
    const serverTemplate = `import { startOnt } from 'ont-run';

await startOnt();
`;

    writeFileSync(join(targetDir, "server.ts"), serverTemplate);
    consola.success("Created server.ts");

    // Write package.json
    const packageJsonPath = join(targetDir, "package.json");
    let packageJson: Record<string, unknown> = {};

    if (existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      } catch {
        // If parsing fails, start fresh
      }
    }

    // Merge in our scripts and dependencies
    packageJson.type = "module";
    packageJson.scripts = {
      ...(packageJson.scripts as Record<string, string> || {}),
      dev: "bun run server.ts",
      start: "NODE_ENV=production bun run server.ts",
      review: "bunx ont-run review",
    };
    packageJson.dependencies = {
      ...(packageJson.dependencies as Record<string, string> || {}),
      "ont-run": "latest",
      zod: "^4.0.0",
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    consola.success("Updated package.json with scripts and dependencies");

    // Instructions
    console.log("\n");
    consola.box(
      "Ontology project initialized!\n\n" +
        "Next steps:\n" +
        "  1. Run `bun install` to install dependencies\n" +
        "  2. Review ontology.config.ts and customize\n" +
        "  3. Run `bun run review` to approve the initial ontology\n" +
        "  4. Run `bun run dev` to start the servers\n\n" +
        "Your API will be available at http://localhost:3000"
    );
  },
});
