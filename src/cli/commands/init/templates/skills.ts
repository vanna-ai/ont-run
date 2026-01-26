// ============================================================================
// Skills Template
// ============================================================================

export const skillTemplate = `---
name: init
description: Initialize a new full-stack Ontology project with Bun + React. Use when setting up a new project, explaining the init command, or helping users get started with ont-run.
---

# \`bunx ont-run init\` Command

Initialize a new full-stack Ontology project with Bun + React.

## Usage

\`\`\`bash
bunx ont-run init [dir] [--force]
\`\`\`

**Arguments:**
- \`[dir]\` - Directory to initialize (default: current directory)
- \`--force\` - Overwrite existing files

## What Gets Created

\`\`\`
project/
├── ontology.config.ts    # API configuration
├── build.ts              # Production build script
├── bunfig.toml           # Bun configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
├── src/
│   ├── index.ts          # Server entry point
│   ├── index.html        # HTML template
│   ├── index.css         # Vanna Design System (Tailwind)
│   ├── frontend.tsx      # React entry point
│   ├── App.tsx           # React app with routing
│   ├── components/
│   │   ├── Layout.tsx    # Glass-morphism nav
│   │   ├── VannaButton.tsx # Button variants
│   │   ├── VannaCard.tsx   # Card component
│   │   └── StatsCard.tsx   # Stats display
│   └── routes/
│       ├── home.tsx      # Home page with hero
│       ├── dashboard.tsx # Dashboard with charts
│       └── about.tsx     # About page
├── resolvers/
│   ├── healthCheck.ts    # Health check resolver
│   ├── getUser.ts        # Get user resolver (with userContext)
│   └── deleteUser.ts     # Delete user resolver
└── .claude/
    └── skills/
        └── init/
            └── SKILL.md  # This skill file
\`\`\`

## Vanna Design System

The generated project includes the Vanna Design System with:

### Colors
- **Navy** (#023d60) - Primary text and backgrounds
- **Cream** (#e7e1cf) - Page background
- **Teal** (#15a8a8) - Primary accent, buttons
- **Orange** (#fe5d26) - Secondary accent
- **Magenta** (#bf1363) - Alerts, negative trends

### Typography
- **Roboto Slab** - Headlines (serif)
- **Space Grotesk** - Body text (sans)
- **Space Mono** - Code blocks (mono)

### Components
- \`VannaButton\` - 4 variants (primary/secondary/outline/ghost), 3 sizes
- \`VannaCard\` - Cards with teal shadows
- \`StatsCard\` - Dashboard stat cards with trend indicators
- \`Layout\` - Glass-morphism navigation with lucide icons

## Comprehensive ontology.config.ts Example

This example demonstrates ALL configuration features:

\`\`\`typescript
import { defineOntology, userContext, fieldFrom } from 'ont-run';
import { z } from 'zod';

// Import resolver functions
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import editPost from './resolvers/editPost.js';
import getUserStatuses from './resolvers/options/userStatuses.js';
import searchTeams from './resolvers/options/searchTeams.js';
import createUser from './resolvers/createUser.js';

export default defineOntology({
  name: 'example-api',

  // Environment-specific configuration
  environments: {
    dev: { debug: true, apiUrl: 'http://localhost:3000' },
    prod: { debug: false, apiUrl: 'https://api.example.com' },
  },

  // Pluggable auth - returns AuthResult with groups + optional user
  auth: async (req) => {
    const token = req.headers.get('Authorization');

    if (!token) {
      return { groups: ['public'] };
    }

    // Verify token and get user (your auth logic here)
    const user = await verifyToken(token);

    return {
      groups: user.isAdmin ? ['admin', 'user', 'public'] : ['user', 'public'],
      user: { id: user.id, email: user.email }, // For userContext()
    };
  },

  // Define access groups with descriptions
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    admin: { description: 'Administrators' },
  },

  // Define entities for categorization
  entities: {
    User: { description: 'A user account' },
    Post: { description: 'A blog post' },
    Team: { description: 'A team/organization' },
  },

  functions: {
    // ═══════════════════════════════════════════════════════════════════════
    // Basic function (inputs only, no outputs schema)
    // ═══════════════════════════════════════════════════════════════════════
    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'user', 'admin'],
      entities: [],
      inputs: z.object({}),
      resolver: healthCheck,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function with outputs schema (recommended for documentation)
    // ═══════════════════════════════════════════════════════════════════════
    getUser: {
      description: 'Get user by ID',
      access: ['user', 'admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
      }),
      outputs: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string(),
      }),
      resolver: getUser,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function with userContext() for row-level access control
    // The currentUser field is injected from auth() and hidden from API
    // ═══════════════════════════════════════════════════════════════════════
    editPost: {
      description: 'Edit a post (users can only edit their own posts)',
      access: ['user', 'admin'],
      entities: ['Post'],
      inputs: z.object({
        postId: z.string(),
        title: z.string(),
        content: z.string(),
        // userContext() marks this field as:
        // - Injected from auth() result's user field
        // - Hidden from public API/MCP schemas
        // - Type-safe in resolver
        currentUser: userContext(z.object({
          id: z.string(),
          email: z.string(),
        })),
      }),
      resolver: editPost,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Bulk options source for fieldFrom()
    // Empty inputs = all options fetched at once (dropdown)
    // ═══════════════════════════════════════════════════════════════════════
    getUserStatuses: {
      description: 'Get available user statuses',
      access: ['admin'],
      entities: [],
      inputs: z.object({}),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: getUserStatuses,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Autocomplete options source for fieldFrom()
    // Has query input = options searched dynamically (autocomplete)
    // ═══════════════════════════════════════════════════════════════════════
    searchTeams: {
      description: 'Search teams by name',
      access: ['admin'],
      entities: ['Team'],
      inputs: z.object({
        query: z.string(),
      }),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: searchTeams,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function using fieldFrom() for dynamic options
    // ═══════════════════════════════════════════════════════════════════════
    createUser: {
      description: 'Create a new user',
      access: ['admin'],
      entities: ['User'],
      inputs: z.object({
        name: z.string(),
        email: z.string().email(),
        // fieldFrom() references another function for options:
        // - Bulk: getUserStatuses has empty inputs → dropdown
        // - Autocomplete: searchTeams has query input → search
        status: fieldFrom('getUserStatuses'),
        team: fieldFrom('searchTeams'),
      }),
      resolver: createUser,
    },
  },
});
\`\`\`

## ResolverContext

Every resolver receives a \`ResolverContext\` as its first argument:

\`\`\`typescript
import type { ResolverContext } from 'ont-run';

export default async function myResolver(ctx: ResolverContext, args: MyArgs) {
  // ctx.env - Current environment name ('dev', 'prod', etc.)
  ctx.logger.info(\`Running in \${ctx.env}\`);

  // ctx.envConfig - Environment-specific configuration
  if (ctx.envConfig.debug) {
    ctx.logger.debug('Debug mode enabled');
  }

  // ctx.logger - Structured logging
  ctx.logger.info('Processing request');
  ctx.logger.warn('Something might be wrong');
  ctx.logger.error('Something went wrong');
  ctx.logger.debug('Detailed info');

  // ctx.accessGroups - Groups from auth() for this request
  if (ctx.accessGroups.includes('admin')) {
    // Admin-only logic
  }

  return { /* result */ };
}
\`\`\`

## Next Steps After Init

1. **Install dependencies:**
   \`\`\`bash
   bun install
   \`\`\`

2. **Review and approve the ontology:**
   \`\`\`bash
   bun run review
   \`\`\`

3. **Start development server:**
   \`\`\`bash
   bun run dev
   \`\`\`

4. **Access your app:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api
   - Health: http://localhost:3000/health

5. **Build for production:**
   \`\`\`bash
   bun run build
   bun run start
   \`\`\`
`;
