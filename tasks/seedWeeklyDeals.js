import 'dotenv/config';
import { connectDb, closeDb } from '../server/db.js';
import { getMongoUri } from '../server/env.js';
import { reseedWeeklyDeals } from '../server/weeklyDeals.js';

async function main() {
  const resolved = getMongoUri();
  if (resolved.error) {
    console.error(resolved.error);
    process.exit(1);
  }

  try {
    await connectDb(resolved.uri);
    const result = await reseedWeeklyDeals();
    console.log(
      JSON.stringify(
        {
          ok: true,
          message: 'Weekly deals cleared and re-seeded from catalogue screenshots.',
          ...result,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error('[seedWeeklyDeals]', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
