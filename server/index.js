import 'dotenv/config';
import { closeDb } from './db.js';
import { createApp } from './app.js';
import { ensureDb } from './ensureDb.js';
import { startGroceryCronScheduler } from './groceryCronScheduler.js';

const PORT = Number(process.env.PORT) || 3001;
// Rate limiting and trust proxy are configured in createApp() (server/app.js).
const app = createApp();

async function start() {
  try {
    await ensureDb();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    startGroceryCronScheduler();
  });
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

start();
