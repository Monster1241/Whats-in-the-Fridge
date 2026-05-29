import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { closeDb } from './db.js';
import { ensureDb } from './ensureDb.js';
import { isOriginAllowed } from './env.js';
import {
  handleCreateHousehold,
  handleGetState,
  handleHealth,
  handleJoinHousehold,
  handleLogin,
  handleMe,
  handlePutState,
  handleSignup,
} from './handlers.js';

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS origin denied'));
    },
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await handleHealth(req, res);
  } catch (err) {
    console.error('GET /api/health', err);
    res.status(500).json({ error: err.message || 'Health check failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    await handleSignup(req, res);
  } catch (err) {
    console.error('POST /api/auth/signup', err);
    res.status(err.status || 500).json({ error: err.message || 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await handleLogin(req, res);
  } catch (err) {
    console.error('POST /api/auth/login', err);
    res.status(err.status || 500).json({ error: err.message || 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    await handleMe(req, res);
  } catch (err) {
    console.error('GET /api/auth/me', err);
    res.status(err.status || 500).json({ error: err.message || 'Session check failed' });
  }
});

app.post('/api/household/create', async (req, res) => {
  try {
    await handleCreateHousehold(req, res);
  } catch (err) {
    console.error('POST /api/household/create', err);
    res.status(err.status || 500).json({ error: err.message || 'Could not create household' });
  }
});

app.post('/api/household/join', async (req, res) => {
  try {
    await handleJoinHousehold(req, res);
  } catch (err) {
    console.error('POST /api/household/join', err);
    res.status(err.status || 500).json({ error: err.message || 'Could not join household' });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    await handleGetState(req, res);
  } catch (err) {
    console.error('GET /api/state', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load data from MongoDB.' });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    await handlePutState(req, res);
  } catch (err) {
    console.error('PUT /api/state', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save data to MongoDB.' });
  }
});

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
  });
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

start();
