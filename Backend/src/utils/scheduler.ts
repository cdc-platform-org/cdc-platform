import cron from 'node-cron';

// Minimal in-process cron wrapper for server.ts's single-instance-fallback
// jobs — see each call site's own comment for why production should
// eventually prefer an external scheduler hitting a dedicated
// POST /api/cron/* route instead. Errors are caught here too (on top of
// whatever a task already catches internally) so a rejected task promise
// never becomes an unhandled rejection.
export function scheduleJob(name: string, cronExpression: string, task: () => void | Promise<void>): void {
  cron.schedule(cronExpression, () => {
    Promise.resolve(task()).catch((err) => {
      console.error(`[scheduler] job "${name}" failed:`, err);
    });
  });
}
