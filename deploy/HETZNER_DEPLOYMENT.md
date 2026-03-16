# Hetzner Deployment

This is the first production scaffold for PnPScribe. It targets one Hetzner Cloud server running:

- `caddy`
- `web`
- `ocr-worker`
- `entity-worker`
- `postgres`
- `redis`

## 1. Create the server

Recommended starting point:

- Ubuntu 24.04
- 2 vCPU / 4 GB RAM minimum
- public IPv4 enabled
- SSH key attached during creation
- backups enabled if budget allows

## 2. Point your domain

Create an `A` record for your app domain to the server IPv4.

Example:

- `app.yourdomain.com -> <server-ip>`

## 3. Install Docker

Follow the official Docker Ubuntu installation guide:

- https://docs.docker.com/engine/install/ubuntu/

## 4. Copy the repo

Clone the repo to the server, for example:

```bash
git clone <your-repo-url> /opt/pnpscribe
cd /opt/pnpscribe
```

## 5. Prepare deployment env files

Inside `deploy/`:

```bash
cp .env.example .env
cp env/web.env.example env/web.env
cp env/workers.env.example env/workers.env
cp env/caddy.env.example env/caddy.env
```

Then fill in:

- Postgres password
- `AUTH_SECRET`
- `AUTH_URL`
- `OPENAI_API_KEY`
- `APP_DOMAIN`
- optional Google auth keys

## 6. Start the stack

```bash
cd deploy
docker compose --env-file .env -f compose.prod.yml up -d --build
```

## 7. Run Prisma migrations

After the containers are up:

```bash
cd /opt/pnpscribe/deploy
docker compose --env-file .env -f compose.prod.yml exec web npx prisma migrate deploy
```

## 8. Check logs

```bash
docker compose --env-file .env -f compose.prod.yml logs web -n 200
docker compose --env-file .env -f compose.prod.yml logs ocr-worker -n 200
docker compose --env-file .env -f compose.prod.yml logs entity-worker -n 200
docker compose --env-file .env -f compose.prod.yml logs caddy -n 200
```

## 9. Update later

```bash
cd /opt/pnpscribe
git pull
cd deploy
docker compose --env-file .env -f compose.prod.yml up -d --build
docker compose --env-file .env -f compose.prod.yml exec web npx prisma migrate deploy
```

## Notes

- Uploaded files persist in the `uploads_data` Docker volume.
- Postgres data persists in `postgres_data`.
- Redis data persists in `redis_data`.
- Caddy handles HTTPS automatically once DNS points to the server.
