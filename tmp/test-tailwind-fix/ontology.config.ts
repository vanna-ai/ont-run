import { defineOntology, userContext } from 'ont-run';
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
