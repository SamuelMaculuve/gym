// Execução manual/cron externo: `npm run reminders:run -w @gymflow/api`
import { ensureDatabase, prisma } from '../lib/prisma';
import { runReminders } from './reminders';

await ensureDatabase();
const result = await runReminders({ force: process.argv.includes('--force'), dryRun: process.argv.includes('--dry-run') });
console.info(JSON.stringify({ ...result, items: result.items.length }, null, 2));
await prisma.$disconnect();
