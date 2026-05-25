# What's in the Fridge?

Mobile-first React app for tracking kitchen inventory and recipe ideas. All household data is stored in **MongoDB** — inventory, settings, saved recipes, and onboarding state.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

3. Paste your MongoDB connection URL into `.env`:

```
MONGODB_URI=mongodb+srv://your-user:your-password@cluster.mongodb.net/?retryWrites=true&w=majority
```

Get this from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → your cluster → **Connect** → **Drivers** → copy the connection string and replace `<password>` with your database user password.

4. Start the app (API + frontend):

```bash
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to the backend on port 3001.

## What is stored in MongoDB

| Data | Description |
|------|-------------|
| `items` | Fridge inventory (name, category, status, expiry) |
| `settings` | Theme, user name & email |
| `savedRecipeIds` | Bookmarked recipe IDs |
| `onboarding` | Dismissed tip banners |
| `householdCode` | Auto-generated invite code (e.g. `FRIDGE-4821`) |

Recipe definitions (titles, ingredients, instructions) remain in the app code as a catalog — only **your** data is in the database.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server + Vite dev app |
| `npm run dev:server` | API only |
| `npm run dev:client` | Frontend only |
| `npm run build` | Production frontend build |
| `npm start` | Run API server (needs `.env`) |

## Deploy on Vercel

1. Push this project to GitHub and import it in [Vercel](https://vercel.com).
2. **Environment variables** (Settings → Environment Variables):
   - **`MONGODB_URI`** — your MongoDB Atlas connection string (required)
   - Do **not** set `VITE_API_URL` to `localhost` — leave it empty so the app calls `/api` on the same Vercel domain.
   - `PORT` is **not** used on Vercel (only for local `npm run dev:server`).
3. In **MongoDB Atlas** → **Network Access** → add `0.0.0.0/0` (allow from anywhere) so Vercel serverless functions can reach your cluster.
4. Redeploy after adding env vars.

The `api/` folder runs as Vercel serverless functions (`/api/health`, `/api/state`). The Vite app is served from `dist/`.

## Features

- **Fridge** — Inventory by storage type, shopping list, expiry tracking
- **Cook** — Recipe matching, Asian & Nepali recipes, saved bookmarks
- **Settings** — Light/dark mode, profile, household invite code
