#!/bin/bash
# ============================================================
# CyberNexa Solutions — server-side one-shot installer
# Run THIS FILE ON THE EC2 SERVER (Ubuntu 22.04 / 24.04 / 26.04)
# Usage:  sudo bash ec2-bootstrap.sh https://<url-to-cybernexa-deploy.zip>
# It installs: Node 20, MySQL 8, the app, systemd auto-restart service
# ============================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

URL="${1:?Usage: sudo bash ec2-bootstrap.sh <zip-url>}"
# Secrets come from the environment at run time so they are never committed.
# Example:  sudo ADMIN_PASSWORD='...' DB_PASSWORD='...' bash ec2-bootstrap.sh <zip-url>
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CHANGE_ME_ADMIN_PASSWORD}"
DB_PASSWORD="${DB_PASSWORD:-CHANGE_ME_STRONG_DB_PASSWORD}"
OWNER_EMAIL="${OWNER_EMAIL:-umair799283@gmail.com}"

echo "[1/7] System packages"
apt-get update -y
apt-get install -y curl git unzip mysql-server ufw

echo "[2/7] Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[3/7] MySQL database + user"
if ! systemctl is-active --quiet mysql; then systemctl start mysql; fi
systemctl enable mysql
mysql <<SQL
CREATE DATABASE IF NOT EXISTS cybernexa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cybernexa'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON cybernexa.* TO 'cybernexa'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "[4/7] Download + install application"
mkdir -p /opt/cybernexa
curl -fsSL "${URL}" -o /tmp/cybernexa-deploy.zip
unzip -o /tmp/cybernexa-deploy.zip -d /opt/cybernexa
cd /opt/cybernexa
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "[5/7] Configuration (.env)"
cat > /opt/cybernexa/.env <<ENV
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

echo "[6/7] systemd service (auto-restart)"
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
chown -R www-data:www-data /opt/cybernexa
systemctl daemon-reload
systemctl enable --now cybernexa

echo "[7/7] Firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
echo y | ufw enable

sleep 3
echo "--- Health check ---"
curl -fsS http://localhost:3000/healthz && echo
echo "======================================================"
echo "DONE! CyberNexa is live on this server, port 3000."
echo "Open http://<this-server-public-ip>:3000 in a browser."
echo "======================================================"