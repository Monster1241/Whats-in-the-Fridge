# What's in the Fridge?

Mobile-first React app for tracking kitchen inventory and recipe ideas. Each household has its own secure data in **MongoDB**, accessed only after email/password login.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

3. Configure `.env`:

```
MONGODB_URI=mongodb+srv://your-user:your-password@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=use-a-long-random-string-here
```

4. Start the app (API + frontend):

```bash
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to the backend on port 3001.

## MongoDB collections

| Collection | Fields | Purpose |
|------------|--------|---------|
| `users` | `email`, `password_hash`, `household_id` | Login accounts |
| `households` | `invite_code`, `settings`, `savedRecipeIds`, `onboarding` | Shared household state |
| `inventory` | `household_id`, `name`, `category`, `status`, `expiryDate` | Food items (scoped per household) |

Invite codes look like **`XYZ-123`** (6 characters). Partners sign up, then choose **Join existing household** and enter that code.

Recipe definitions remain in the app code — only household data is stored in the database.

## Auth flow

1. **Sign up** or **Log in** with email + password.
2. **Create a new household** (get an invite code) or **Join** with your partner's code.
3. Session token is saved in `localStorage` so you stay logged in on your phone.

## API routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/auth/signup` | POST | — |
| `/api/auth/login` | POST | — |
| `/api/auth/me` | GET | Bearer token |
| `/api/household/create` | POST | Bearer token |
| `/api/household/join` | POST | Bearer token |
| `/api/state` | GET, PUT | Bearer token + household |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server + Vite dev app |
| `npm run dev:server` | API only |
| `npm run dev:client` | Frontend only |
| `npm run build` | Production frontend build |
| `npm start` | Run API server (needs `.env`) |

## Verification emails (Resend)

1. Create a free account at [resend.com](https://resend.com).
2. **API Keys** → Create API Key → copy `re_...`.
3. Add to `.env` (local) and **Vercel** (production):

```
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=What's in the Fridge <onboarding@resend.dev>
```

4. **Free tier note:** `onboarding@resend.dev` only delivers to the email address on your Resend account until you [verify your own domain](https://resend.com/docs/dashboard/domains/introduction). For real users, add a domain in Resend and set e.g. `RESEND_FROM_EMAIL=Fridge <noreply@yourdomain.com>`.

Without `RESEND_API_KEY`, the 6-digit code is printed in the server console only (dev fallback).

## Deploy on Vercel

1. Push this project to GitHub and import it in [Vercel](https://vercel.com).
2. **Environment variables** (Settings → Environment Variables):
   - **`MONGODB_URI`** — MongoDB Atlas connection string (required)
   - **`JWT_SECRET`** — long random secret for session tokens (required)
   - **`RESEND_API_KEY`** — for verification emails (required in production)
   - **`RESEND_FROM_EMAIL`** — sender address (optional; defaults to `onboarding@resend.dev`)
   - Optional: **`CORS_ORIGIN`** — your production URL if needed
   - Do **not** set `VITE_API_URL` to `localhost` on Vercel.
3. In **MongoDB Atlas** → **Network Access** → add `0.0.0.0/0` so serverless functions can connect.
4. **Redeploy** after adding env vars.

## Features

- **Fridge** — Ambient / Fresh / Freezer tabs, shopping list, expiry tracking
- **Recipes** — Matched meals from inventory, saved bookmarks
- **Settings** — Theme, profile, invite code, log out
- **Ping partner** — Share shopping list via native share
