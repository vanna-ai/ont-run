import type { ResolverContext } from 'ont-run';

interface DeleteUserArgs {
  userId: string;
  reason?: string;
}

export default async function deleteUser(ctx: ResolverContext, args: DeleteUserArgs) {
  ctx.logger.warn(`Deleting user: ${args.userId}, reason: ${args.reason || 'none'}`);

  // This is where you'd delete from your database
  // Example response:
  return {
    success: true,
    deletedUserId: args.userId,
    deletedAt: new Date().toISOString(),
  };
}
