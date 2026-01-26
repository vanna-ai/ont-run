import type { ResolverContext } from 'ont-run';

export default async function healthCheck(ctx: ResolverContext) {
  ctx.logger.info('Health check called');

  return {
    status: 'ok',
    env: ctx.env,
    timestamp: new Date().toISOString(),
  };
}
