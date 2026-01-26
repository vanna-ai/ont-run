// ============================================================================
// Resolver Templates
// ============================================================================

export const healthCheckResolver = `import type { ResolverContext } from 'ont-run';

export default async function healthCheck(ctx: ResolverContext) {
  ctx.logger.info('Health check called');

  return {
    status: 'ok',
    env: ctx.env,
    timestamp: new Date().toISOString(),
  };
}
`;

export const getUserResolver = `import type { ResolverContext } from 'ont-run';

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

export const deleteUserResolver = `import type { ResolverContext } from 'ont-run';

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
