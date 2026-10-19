# Monline architecture

Monline uses a React frontend and its own Node.js 24 HTTP server. SQLite is embedded in the server; no separate database service or backend platform is required.

## Application

- `apps/web/src`: React, TanStack Router/Query, local PDF statement processing and translation resources.
- `apps/web/src/lib/client.ts`: Monline data client and browser session store.
- `apps/backend/src/server.cjs`: Express HTTP server, startup, static frontend and scheduling.
- `apps/backend/src/storage.cjs`: parameterized SQLite repository, records, ownership relationships and transactional writes.
- `apps/backend/src/schema.json`: application schema and legacy collection mapping.
- `apps/backend/src/domain`: subscription schedules, payment history, notifications, exports and external API.
- `apps/backend/src/auth.cjs`: password login, hashed sessions, trusted devices, reset/verification email and rate limits.
- `apps/backend/src/oidc.cjs`: SSO discovery, one-use state, PKCE and signed ID-token verification.
- `apps/backend/src/data-api.cjs`: account-scoped CRUD, relation expansion, protected files and administrator database backup/restore.

## Data

Local data lives in `apps/backend/monline_data`. Docker mounts one persistent volume at `/data`; the new database and assets live under `/data/monline`.

`monline.db` stores account data and hashed session tokens. `storage/<collection>/<record>/<filename>` stores avatars, logos and payment attachments. Account JSON backups contain user data and attachments but exclude passwords and authentication/provider secrets. Administrator SQLite backups contain database credentials and must be kept private; uploaded assets remain in the persistent storage directory.

SQLite uses WAL mode, owner indexes and transactions. Network operations run asynchronously outside database transactions. Scheduled jobs avoid overlapping their own previous invocation.

## Legacy migration

When the new database does not exist, `migrate.cjs` discovers the old `data.db`, creates a consistent read-only snapshot, copies application tables and assets, and publishes the new database only after the copy completes. Account IDs, bcrypt password hashes and relationships are preserved. Legacy superusers, sessions and platform tables are not imported. Existing browser sessions must sign in again.

The original data directory is preserved. Encrypted legacy application settings can be read once with `MONLINE_LEGACY_KEY`; new installations do not need that variable.

## Runtime

Development uses Vite on port 5173 with `/api` proxied to Node on port 8080. Production uses one Node process serving the built frontend and API on port 3000. Docker images target AMD64 and ARM64. GitHub release checks use the fixed official repository `caglaryalcin/Monline`.
