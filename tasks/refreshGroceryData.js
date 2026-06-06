import 'dotenv/config';
import { connectDb, closeDb } from '../server/db.js';
import { getMongoUri } from '../server/env.js';
import {
  GROCERY_REFRESH_MODES,
  normalizeGroceryRefreshMode,
  refreshGroceryData,
} from '../server/groceryDataRefresh.js';

function parseMode(argv) {
  const flag = argv.find((arg) => arg.startsWith('--mode='));
  if (flag) return flag.split('=')[1];

  const modeIndex = argv.indexOf('--mode');
  if (modeIndex >= 0 && argv[modeIndex + 1]) {
    return argv[modeIndex + 1];
  }

  return process.env.GROCERY_REFRESH_MODE ?? 'officialReset';
}

async function main() {
  const mode = normalizeGroceryRefreshMode(parseMode(process.argv.slice(2)));
  if (!mode) {
    console.error(
      `Usage: node tasks/refreshGroceryData.js --mode <${GROCERY_REFRESH_MODES.join('|')}>`,
    );
    process.exit(1);
  }

  const resolved = getMongoUri();
  if (resolved.error) {
    console.error(resolved.error);
    process.exit(1);
  }

  try {
    await connectDb(resolved.uri);
    const result = await refreshGroceryData(mode);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('[refreshGroceryData]', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
