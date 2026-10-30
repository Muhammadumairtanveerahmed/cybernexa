# Deployment

## 1. Local development

```bash
# from mern/
npm install
docker compose up -d mysql
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run db:migrate
npm run db:seed
npm run dev
```

| Service | URL |
|---|---|
| React | http://localhost:5173 |
| API | http://localhost:5000/api |
| Health | http://localhost:5000/api/health |
| MySQL | localhost:3306 |

Vite proxies `/api`, `/uploads` and `/socket.io` to the API, so the browser sees one origin in
development.

## 2. Docker Compose

```bash
docker compose up --build
```

- `mysql` stores data in the `mysql_data` volume.
- `server` reads `server/.env` and mounts `server/uploads`.
- `client` is built with Vite and served by Nginx.
- Nginx proxies `/api` and `/socket.io` to the `server` container.

## 3. Production with k3s

1. Build and push the images:

```bash
docker build -f deploy/docker/Dockerfile.server -t registry/technexa-server:1.0 .
docker build -f deploy/docker/Dockerfile.client -t registry/technexa-client:1.0 .
docker push registry/technexa-server:1.0
docker push registry/technexa-client:1.0
```

2. Create the secret:

```bash
kubectl create secret generic technexa-secrets \
  --from-literal=DB_HOST=mysql \
  --from-literal=DB_USER=technexa \
  --from-literal=DB_PASSWORD='change-me' \
  --from-literal=DB_NAME=technexa \
  --from-literal=JWT_SECRET='change-me'
```

3. Apply the manifests:

```bash
kubectl apply -f deploy/k8s/
```

4. Add the ingress host and TLS certificate resolver in `deploy/k8s/ingress.yaml`.

## 4. Environment variables

### Server

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | API port (default `5000`) |
| `CLIENT_URL` | Yes | Allowed CORS origin |
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | No | MySQL port (default `3306`) |
| `DB_USER` | Yes | MySQL user |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Token signing key |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | No | Email |
| `OPENAI_API_KEY` | No | AI quiz generation |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | No | WebRTC calls behind NAT |

### Client

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL |
| `VITE_SOCKET_URL` | Socket.IO server URL |

## 5. Health checks

- API: `GET /api/health` returns `{ "ok": true }`.
- Kubernetes readiness and liveness probes should use this endpoint.
- The MySQL pool is checked at startup with `SELECT 1`.

## 6. Backups

- Dump MySQL daily: `mysqldump -u root -p technexa > backup-$(date +%F).sql`.
- Copy `server/uploads/` to object storage or a separate volume.
- Keep at least seven daily and four weekly backups.

## 7. HTTPS

- Use Let's Encrypt through the ingress controller (Traefik or Nginx).
- WebRTC calls and microphone access require a secure context (`https://` or `localhost`).
- Redirect HTTP to HTTPS at the ingress level.
