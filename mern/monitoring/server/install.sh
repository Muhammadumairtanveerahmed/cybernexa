#!/bin/bash
# ============================================================
# TechNexa — Prometheus + Grafana installer for the live EC2
# Safe: does not touch k3s, nginx, the app or MySQL data.
# Idempotent: re-running upgrades/restarts the monitoring stack.
# ============================================================
set -euo pipefail

DIR=/opt/technexa-monitoring
BUNDLE=/tmp/monitoring-server
GF_ADMIN_PASSWORD="${GF_ADMIN_PASSWORD:-TechNexa@2026}"
MYSQL_EXPORTER_USER="technexa_exporter"
MYSQL_EXPORTER_PASSWORD="${MYSQL_EXPORTER_PASSWORD:-TnxExp@2026!mon}"
MYSQL_HOST="10.43.248.73"
MYSQL_PORT="3306"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-6fef98b6f57adb2c7fb4641a}"

echo "=== [1/7] Docker + compose plugin ==="
systemctl is-active --quiet docker || systemctl start docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Installing docker compose plugin binary ..."
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker compose version | head -1

echo "=== [2/7] Copy bundle to $DIR ==="
mkdir -p "$DIR"
cp -a "$BUNDLE"/. "$DIR"/

echo "=== [3/7] Environment file ==="
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<ENV
GF_ADMIN_PASSWORD=${GF_ADMIN_PASSWORD}
MYSQL_EXPORTER_USER=${MYSQL_EXPORTER_USER}
MYSQL_EXPORTER_PASSWORD=${MYSQL_EXPORTER_PASSWORD}
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
ENV
  chmod 600 "$DIR/.env"
  echo "Created $DIR/.env"
else
  echo "Reusing existing $DIR/.env"
fi

echo "=== [4/7] MySQL exporter user ==="
POD=$(k3s kubectl get pods -o name 2>/dev/null | grep -i mysql | head -1 | cut -d/ -f2 || true)
if [ -n "${POD:-}" ]; then
  echo "MySQL pod: $POD"
  k3s kubectl exec "$POD" -- mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
    CREATE USER IF NOT EXISTS '${MYSQL_EXPORTER_USER}'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}';
    ALTER USER '${MYSQL_EXPORTER_USER}'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}';
    GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO '${MYSQL_EXPORTER_USER}'@'%';
    FLUSH PRIVILEGES;" 2>/dev/null \
    && echo "Exporter user ready" \
    || echo "WARNING: could not create exporter user (mysql_up will stay 0)"
else
  echo "WARNING: mysql pod not found"
fi

echo "=== [5/7] Starting containers ==="
cd "$DIR"
docker compose pull -q 2>/dev/null || true
docker compose up -d

echo "=== [6/7] Waiting for services ==="
for i in $(seq 1 40); do
  sleep 3
  if curl -fsS http://127.0.0.1:9090/-/ready >/dev/null 2>&1 && \
     curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo "Prometheus + Grafana ready after $((i*3))s"
    break
  fi
done

echo "=== [7/7] Status ==="
docker compose ps
echo
echo "--- Prometheus targets ---"
curl -fsS http://127.0.0.1:9090/api/v1/targets 2>/dev/null \
  | grep -o '"health":"[a-z]*"' | sort | uniq -c || true
echo
echo "=========================================================="
echo " Grafana    : http://<server-ip>:3001   (admin / ${GF_ADMIN_PASSWORD})"
echo " Dashboard  : http://<server-ip>:3001/d/technexa-server"
echo " Prometheus : localhost:9090 only (use SSH tunnel)"
echo "=========================================================="
