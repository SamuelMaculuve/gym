import { env } from './config/env';
import { createApp } from './app';
import { scheduleReminders } from './jobs/reminders';
import { prisma } from './lib/prisma';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`🏋️  GymFlow API em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

if (env.REMINDERS_CRON_ENABLED) scheduleReminders();

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
