# Care Guide Monitor

Intelligent API monitoring and alert system. It receives batches of API check
results, detects anomalies, writes a human-readable alert, and stores it in
MongoDB.

## Development

Requirements: Node.js 18+, npm, and a MongoDB connection (Atlas or local).

```bash
npm install
cp .env.example .env
npm run dev
```

### Scripts

- `npm start` starts the server.
- `npm run dev` starts the server with nodemon.
- `npm run lint` runs ESLint.
- `npm test` runs Jest.
- `npm run check` runs lint and then the test suite. This must pass before a
  commit.

Tests use `mongodb-memory-server`, so they do not touch the development
database.

## Status

The application is under construction. Features are tracked in
`feature_list.json` and progress is tracked in `PROGRESS.md`.
