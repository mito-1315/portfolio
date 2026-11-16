# Deploying

One command runs the whole site: the website (nginx), the API and PostgreSQL.
The website container serves the pages and forwards `/api` and `/uploads` to the API,
so everything is on one address and the admin cookie works.

## Deploy

1. Copy `.env.docker.example` to `.env` and fill it in (at least `POSTGRES_PASSWORD`,
   `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`, `IP_HASH_SALT`, `CLIENT_ORIGIN`).
2. Refresh the starting data from your local database (optional, needs it running):
   `cd server && npm run db:export`
3. On the server (or with the project files copied/cloned), run:

   ```bash
   docker compose up -d --build
   ```

4. Open `http://<server>/` (port `WEB_PORT`, default 80). `/api/health` should say `ok`.

## What is included on the first start

Songs (Tracks), Movies, Playlists, Recommendations (with their approved/pending status) and
site settings, with the audio and images they use. This is added **once**, to empty tables.
After that, everything you change in the admin is kept; a restart never undoes it.

## Before going live

- **HTTPS:** the admin cookie is `Secure`, so the admin signs in over HTTPS only. Put your
  host's TLS/proxy (Caddy, Cloudflare, a platform load balancer) in front of port 80.
- **Google sign-in:** set `GOOGLE_CLIENT_ID` and `ADMIN_GOOGLE_EMAILS`, and add your real
  address as an authorised JavaScript origin on the Google client. Once it works, leave
  `ALLOW_PASSWORD_LOGIN` empty so only your Google account can sign in.
- **Optional:** `SPOTIFY_CLIENT_ID/SECRET` for song lookup. Guess the Song is switched off.

## Commands

```bash
docker compose logs -f api     # watch the API
docker compose restart api     # restart it
docker compose down            # stop (data stays in the volumes)
docker compose down -v         # stop AND delete the database and uploads
```
