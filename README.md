# What's in the Fridge?

Mobile-first React prototype for a two-person household to track kitchen inventory and get quick recipe ideas.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Test live sync

1. Open the app in **two browser tabs** side by side.
2. Add or change items in one tab — the other updates instantly via `BroadcastChannel`.
3. Data persists in `localStorage` across refreshes.

## Features

- **Fridge** — Quick-add inventory, urgency sections, status cycle (Fresh → Expiring Soon → Out of Stock), ping partner to share shopping list.
- **Cook** — Recipe cards matched to Fresh / Expiring items; "Cooked It!" marks used ingredients as out of stock.
- **Testing** — Household join code demo and sync instructions.
