import 'dotenv/config';
import { connectDb, closeDb } from '../server/db.js';
import { getMongoUri } from '../server/env.js';
import {
  listUnverifiedStoreDeals,
  markDealManuallyVerified,
  markStoreDealsManuallyVerified,
} from '../server/dealManualVerification.js';
import { WEEKLY_DEALS_COLLECTION } from '../server/weeklyDeals.js';
import { ObjectId } from 'mongodb';

function parseArgs(argv) {
  const args = { list: false, store: null, dealId: null, by: 'cli', source: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list' || arg === '-l') args.list = true;
    else if (arg === '--store' || arg === '-s') args.store = argv[++i];
    else if (arg === '--deal-id' || arg === '-d') args.dealId = argv[++i];
    else if (arg === '--by' || arg === '-b') args.by = argv[++i];
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Manual deal verification (check catalogues first, then run):

  npm run verify:deals -- --list
  npm run verify:deals -- --store coles
  npm run verify:deals -- --deal-id <mongoId> --by your-name

Requires MONGODB_URI in .env`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const resolved = getMongoUri();
  if (resolved.error) {
    console.error(resolved.error);
    process.exit(1);
  }

  try {
    await connectDb(resolved.uri);
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);

    if (args.list) {
      const deals = await listUnverifiedStoreDeals(collection, { store: args.store ?? undefined });
      console.log(JSON.stringify({ ok: true, count: deals.length, deals }, null, 2));
      return;
    }

    if (args.dealId) {
      if (!ObjectId.isValid(args.dealId)) {
        console.error('Invalid --deal-id');
        process.exit(1);
      }
      const verified = await markDealManuallyVerified(collection, new ObjectId(args.dealId), {
        verifiedBy: args.by,
        verificationSource: args.source ?? undefined,
      });
      console.log(JSON.stringify({ ok: true, verified: [verified] }, null, 2));
      return;
    }

    if (!args.store) {
      printHelp();
      process.exit(1);
    }

    const result = await markStoreDealsManuallyVerified(collection, {
      store: args.store,
      verifiedBy: args.by,
      verificationSource: args.source ?? undefined,
    });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err) {
    console.error('[verifyWeeklyDeals]', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
