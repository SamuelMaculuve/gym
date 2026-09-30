// Execução manual/cron externo: `npm run reminders:run -w @gymflow/api`
import { prisma } from '../lib/prisma';
import { runReminders } from './reminders';

const result = await runReminders({ force: process.argv.includes('--force'), dryRun: process.argv.includes('--dry-run') });
console.info(JSON.stringify({ ...result, items: result.items.length }, null, 2));
await prisma.$disconnect();
