#!/bin/bash
# ============================================================
# CyberNexa Solutions — AWS EC2 one-click setup (Ubuntu 22.04)
# Paste this as the EC2 "User data" when launching the instance,
# or run it on the server as root:  sudo bash ec2-userdata.sh
# It installs: Node 20, MySQL 8, the app, systemd service, firewall
# ============================================================
set -euo pipefail
exec > /var/log/cybernexa-setup.log 2>&1
export DEBIAN_FRONTEND=noninteractive

# ---------- Tunables ----------
# Set BEFORE launch — passwords used by the admin panel and MySQL.
# Values can also be supplied from the environment so they are never committed.
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CHANGE_ME_ADMIN_PASSWORD}"
DB_PASSWORD="${DB_PASSWORD:-CHANGE_ME_STRONG_DB_PASSWORD}"
OWNER_EMAIL="${OWNER_EMAIL:-umair799283@gmail.com}"
APP_DIR="/opt/cybernexa"
# Where does the code come from? Pick ONE:
# REPO_URL="https://github.com/Muhammadumairtanveerahmed/cybernexa-solutions.git"
UPLOAD_MODE="yes"   # "yes" = you scp/upload the folder to $APP_DIR yourself

echo "[1/6] System packages"
apt-get update -y
apt-get install -y curl git mysql-server ufw

echo "[2/6] Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[3/6] MySQL database + user"
systemctl enable --now mysql
mysql <<SQL
CREATE DATABASE IF NOT EXISTS cybernexa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cybernexa'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON cybernexa.* TO 'cybernexa'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "[4/6] Application code"
mkdir -p "${APP_DIR}"
cd "${APP_DIR}"
if [ "${UPLOAD_MODE}" = "no" ] && [ -n "${REPO_URL:-}" ]; then
  git clone "${REPO_URL}" .
else
  echo "Upload your project files into ${APP_DIR} (scp -r . ubuntu@SERVER_IP:/opt/cybernexa/)"
fi
if [ -f package.json ]; then
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
fi

echo "[5/6] Configuration (.env)"
cat > "${APP_DIR}/.env" <<ENV
PORT=3000
ADMIN_PASSWORD=${ADMIN_PASSWORD}
OWNER_EMAIL=${OWNER_EMAIL}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cybernexa
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=cybernexa
# Optional: real SMTP (Gmail app password or AWS SES) — leave empty to use FormSubmit relay
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ENV

echo "[6/6] systemd service + firewall"
cat > /etc/systemd/system/cybernexa.service <<'SVC'
[Unit]
Description=CyberNexa Solutions website
After=network.target mysql.service

[Service]
WorkingDirectory=/opt/cybernexa
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
SVC
chown -R www-data:www-data "${APP_DIR}"
systemctl daemon-reload
systemctl enable --now cybernexa

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

sleep 3
echo "--- Health check ---"
curl -fsS http://localhost:3000/healthz && echo
echo "CyberNexa is LIVE at http://<your-instance-public-ip>:3000"
echo "Full setup log: /var/log/cybernexa-setup.log"