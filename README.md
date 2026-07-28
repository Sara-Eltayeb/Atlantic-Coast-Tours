# Atlantic Coast Tours assistant

Customer-facing React chatbot for guided tours across the west of Ireland.

## Run locally

```bash
npm install
npm run dev
```

The assistant fetches the supplied Google Sheet through its public GViz endpoint on every question. It does not ship tour data, cache rows, or use fallback tour values. Open-Meteo supplies geocoding and current-day weather for weather questions.

## AI responses

For a genuine LLM response, deploy a server-side `/api/chat` route that accepts `question`, `context`, and `instructions`, then calls Gemini or another provider without exposing credentials. The frontend also supports `VITE_GEMINI_API_KEY` for explicitly configured preview deployments, but a server-side route is safer for production. If neither is available, the app returns a grounded, live-data response and says what it could verify.

## GitHub Pages

Push this folder to GitHub. The included `.github/workflows/pages.yml` builds and deploys `dist` automatically using GitHub Pages. In repository settings, set Pages to **GitHub Actions**. Live Sheets and Open-Meteo access require the sheet to remain shared for public viewing.

The assistant cannot take payments, book flights, or order food. Customers are directed to a human team member for those requests and for confirmation of unusual live prices.
