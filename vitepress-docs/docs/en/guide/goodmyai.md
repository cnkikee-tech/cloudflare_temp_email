# GoodMyAI private deployment

The fork is cnkikee-tech/cloudflare_temp_email. The same-origin UI and API run on a Cloudflare Worker with static assets at https://mail.goodmyai.com; the admin UI is `/admin`. The dedicated D1 database and Worker are named `goodmyai-mail`. The goodmyai.com Email Routing catch-all must target this Worker.

Public address creation, the user account system, user deletion and automatic replies are disabled. No cleanup cron or address expiration is enabled. Administrators can use the upstream batch creation and export feature (1–100 addresses per batch).

Secrets (JWT_SECRET, PASSWORDS and ADMIN_PASSWORDS) are stored only on the deployment machine in `~/.config/goodmyai-mail/secrets.json` with mode 600 and uploaded via `wrangler secret bulk`. Never commit secrets or credential exports. Preserve all three secrets, routing and the DB binding across deployments.

Install dependencies with the frozen pnpm lockfiles. Build frontend with `pnpm build:pages`, copy deploy/goodmyai/wrangler.toml to worker/wrangler.toml, then run `pnpm deploy` in worker. Do not reinitialize or clear the live database during upgrades.

Read mail using `GET /api/parsed_mails?limit=20&offset=0` with the mailbox bearer token and the site password in `x-custom-auth`. Preserve mailbox credentials for later access. API creation and real external delivery must be verified separately.
