// ============================================================================
// Skills Template
// ============================================================================

export const skillTemplate = `---
name: ont-run
description: Reference for ont-run API configuration and patterns. Use when modifying ontology.config.ts, creating resolvers, or working with the Vanna Design System.
---

# ont-run Reference

## ontology.config.ts Configuration

This example demonstrates ALL configuration features:

\`\`\`typescript
import { defineOntology, userContext, organizationContext, fieldFrom } from 'ont-run';
import { z } from 'zod';

// Import resolver functions
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import editPost from './resolvers/editPost.js';
import createProject from './resolvers/createProject.js';
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

  // Pluggable auth - returns AuthResult with groups + optional user/organization
  auth: async (req) => {
    const token = req.headers.get('Authorization');

    if (!token) {
      return { groups: ['public'] };
    }

    // Verify token and get user (your auth logic here)
    const user = await verifyToken(token);

    // For multi-tenant apps, extract organization context
    const orgId = new URL(req.url).searchParams.get('org_id');
    if (orgId) {
      // Verify user's membership in the organization
      const org = await db.organizations.findById(orgId);
      const isMember = await db.organizationMembers.exists({ userId: user.id, orgId });
      
      if (isMember) {
        return {
          groups: user.isAdmin ? ['admin', 'member'] : ['member'],
          user: { id: user.id, email: user.email }, // For userContext()
          organization: { id: org.id, name: org.name }, // For organizationContext()
        };
      }
    }

    return {
      groups: user.isAdmin ? ['admin', 'user', 'public'] : ['user', 'public'],
      user: { id: user.id, email: user.email }, // For userContext()
    };
  },

  // Define access groups with descriptions
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    member: { description: 'Organization members' },
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
    // Function with organizationContext() for multi-tenant access control
    // The currentOrg field is injected from auth() and hidden from API
    // ═══════════════════════════════════════════════════════════════════════
    createProject: {
      description: 'Create a project in the organization',
      access: ['member'],
      entities: ['Project'],
      inputs: z.object({
        name: z.string(),
        description: z.string().optional(),
        // organizationContext() marks this field as:
        // - Injected from auth() result's organization field
        // - Hidden from public API/MCP schemas
        // - Type-safe in resolver
        currentOrg: organizationContext(z.object({
          id: z.string(),
          name: z.string(),
        })),
      }),
      resolver: createProject,
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

## Vanna Design System

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

## Project Structure

\`\`\`
project/
├── ontology.config.ts    # API configuration
├── build.ts              # Production build script
├── src/
│   ├── index.ts          # Server entry point
│   ├── index.html        # HTML template
│   ├── index.css         # Vanna Design System (Tailwind)
│   ├── frontend.tsx      # React entry point
│   ├── App.tsx           # React app with routing
│   ├── components/       # Vanna UI components
│   └── routes/           # Page components
└── resolvers/            # API resolver functions
\`\`\`
`;
