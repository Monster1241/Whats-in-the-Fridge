import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { closeDb, connectDb, getHouseholdState, updateHouseholdState } from './db.js';

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, connected: Boolean(process.env.MONGODB_URI) });
});

app.get('/api/state', async (_req, res) => {
  try {
    const state = await getHouseholdState();
    res.json(state);
  } catch (err) {
    console.error('GET /api/state', err);
    res.status(500).json({ error: 'Failed to load data from MongoDB.' });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const { items, settings, savedRecipeIds, onboarding } = req.body ?? {};
    const partial = {};

    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items must be an array' });
      }
      partial.items = items;
    }
    if (settings !== undefined) partial.settings = settings;
    if (savedRecipeIds !== undefined) {
      if (!Array.isArray(savedRecipeIds)) {
        return res.status(400).json({ error: 'savedRecipeIds must be an array' });
      }
      partial.savedRecipeIds = savedRecipeIds;
    }
    if (onboarding !== undefined) partial.onboarding = onboarding;

    const state = await updateHouseholdState(partial);
    res.json(state);
  } catch (err) {
    console.error('PUT /api/state', err);
    res.status(500).json({ error: 'Failed to save data to MongoDB.' });
  }
});

async function start() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    console.error(
      '\nMissing MONGODB_URI. Create a .env file in the project root:\n\n  MONGODB_URI=mongodb+srv://...\n',
    );
    process.exit(1);
  }

  try {
    await connectDb(uri);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

start();
