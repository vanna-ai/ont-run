import type { ResolverContext } from 'ont-run';

interface GetUserArgs {
  userId: string;
  currentUser: {
    id: string;
    email: string;
  };
}

export default async function getUser(ctx: ResolverContext, args: GetUserArgs) {
  ctx.logger.info(`Getting user: ${args.userId}`);
  ctx.logger.info(`Requested by: ${args.currentUser.email}`);

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
