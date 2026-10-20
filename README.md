<img src="apps/web/public/og.png" width="512" alt="Coffer social preview" />

# Monline

![Status](https://img.shields.io/badge/status-stable-ca7373) [![Latest Release](https://img.shields.io/github/v/release/caglaryalcin/monline?include_prereleases&color=blue)](https://github.com/caglaryalcin/monline/releases)

**Monthly spending, clearly.**

A self-hosted home for your subscriptions, recurring payments, and budget. React frontend, Monline's own Node.js server and embedded SQLite storage.

![](https://raw.githubusercontent.com/caglaryalcin/Monline/refs/heads/main/screenshots/main.gif)

**Mobile Responsive**
![](https://raw.githubusercontent.com/caglaryalcin/Monline/refs/heads/main/screenshots/mobile-responsive.png)

## Features

- **Subscription tracking** — automatic service logos, flexible billing cycles, active/inactive controls, and optional automatic renewal.
- **Budget overview** — monthly charges, paid and outstanding amounts, and remaining budget.

![](https://raw.githubusercontent.com/caglaryalcin/Monline/refs/heads/main/screenshots/subscriptions.png)

- **Payment calendar** — see every payment on a day, mark payments as paid, and add historical payments individually or in a reviewed batch with editable amounts.

![](https://raw.githubusercontent.com/caglaryalcin/Monline/refs/heads/main/screenshots/calendar.png)

- **Payment-based insights** — selected-year paid totals and weekly/monthly averages calculated from recorded payment amounts. Upcoming recurring charges use the saved prices and schedules of subscriptions with automatic renewal enabled.
- **Yearly breakdowns** — January–December payment views and category breakdowns with paid/upcoming filters and independently expandable subscription details.
- **Statement import** — review online subscription charges from **Enpara**, **DenizBank**, and **Garanti BBVA** PDFs, including Amazon Prime and Google Workspace billing descriptors. Match or create subscriptions and import paid calendar entries without duplicates. Matching full-refund pairs within a statement are excluded together.
- **People, payment methods, and currencies** — choose defaults, recognize bank logos, convert currencies, and edit multiple payment methods or currencies together.
- **Complete backups** — account JSON import/export and administrator `.tar.gz` instance archives, including payment history, settings, logos, and attachments. Restore a full instance backup directly from first setup.

![](https://raw.githubusercontent.com/caglaryalcin/Monline/refs/heads/main/screenshots/import-export.png)

- **Your language, your theme** — Turkish, English, German, light/dark modes, and customizable accent colors.
- **Private accounts** — optional 30-day sign-in, two-factor authentication, trusted devices, OIDC sign-in, and scoped API keys.
- **Payment reminders** — email and configurable notification providers, with SMTP tests during setup and in settings, and email templates that follow the selected language.

## Docker environment

Copy `.env.example` to `.env`. All variables are optional:

| Variable      | Default           | Purpose                                                   |
| ------------- | ----------------- | --------------------------------------------------------- |
| `PORT`        | `3000`            | Host port; the container listens on `3000`.               |
| `PUID`        | `1000`            | User ID running the server.                               |
| `PGID`        | `1000`            | Group ID running the server.                              |
| `TZ`          | `Europe/Istanbul` | Time zone for scheduled jobs.                             |
| `TRUST_PROXY` | `0`               | Set to `1` when one trusted reverse proxy fronts Monline. |

Run `docker compose up -d --build`, then open `http://localhost:3000`. On first launch, restore a full `.tar.gz` instance backup or start guided setup for the first administrator account, currency, budget, appearance and optional SMTP reminders. Restoring skips setup and returns to sign-in with the restored accounts. Existing installations keep their accounts and settings. New accounts start with the **Monline** accent color.

Data persists in `monline-volume`, mounted at `/data`. The database and uploaded assets live in `/data/monline`. Account JSON backups include attachments. Import/Export provides the server administrator with single `.tar.gz` instance archives containing the SQLite database and all uploaded files for every user. Other users export their own accounts as JSON. Registration, SMTP, OIDC and maintenance controls live in Settings and remain restricted to the server administrator. Restoring an instance replaces its data and signs everyone out; a complete safety backup is retained on the server before restoration. Legacy `.db` restores replace only the database. Instance restores accept archives up to 500 MiB (2 GiB expanded).

## Docker images

HTTP requests are limited per client IP and running instance: 600 requests per minute, 10 combined instance backup/restore requests per 15 minutes, and 20 account import requests per 15 minutes. Sign-in and verification retain their stricter limits. `/api/health` remains available independently of these limits.

Monline checks its official GitHub releases automatically. Newer stable versions appear in the sidebar with a release-notes link. Checks are cached for one hour. Install updates by pulling the new Docker image and recreating the container.

GitHub Actions publishes **AMD64 and ARM64** images to `ghcr.io/caglaryalcin/monline`:

| Trigger                    | Image tags        |
| -------------------------- | ----------------- |
| Release tag, e.g. `v1.0.13` | `1.0.13`, `latest` |

Images are published only for version tags; pushes to `main` do not publish images. Release tags must match the root, frontend and server package versions. Prereleases publish only their full version and leave `latest` unchanged. Publishing uses GitHub's built-in `GITHUB_TOKEN`.

For prebuilt deployment, use `image: ghcr.io/caglaryalcin/monline:1.0.13`, omit `build`, and run `docker compose up -d`. Authenticate to GHCR before pulling private images. Keep the package private unless you intend to publish it publicly.

## License

Monline is licensed under the GNU General Public License v3.0 (`GPL-3.0-only`). See [LICENSE](LICENSE).
