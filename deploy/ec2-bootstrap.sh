#!/bin/bash
# ============================================================
# TechNexa Solutions — server-side one-shot installer
# Run THIS FILE ON THE EC2 SERVER (Ubuntu 22.04 / 24.04 / 26.04)
#
# Usage:
#   git URL  : sudo bash ec2-bootstrap.sh https://github.com/USER/REPO.git
#   zip URL  : sudo bash ec2-bootstrap.sh https://github.com/USER/REPO/archive/refs/heads/main.zip
#
# Secrets (optional — override before running):
#   sudo ADMIN_PASSWORD='...' DB_PASSWORD='...' bash ec2-bootstrap.sh <url>
#
# Installs: Node 20, MySQL 8, the app, systemd auto-restart service
# ============================================================
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

URL="${1:?Usage: sudo bash ec2-bootstrap.sh <git-or-zip-url>}"
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
rm -rf /opt/cybernexa
if [[ "${URL}" == *.git ]]; then
  git clone --depth 1 "${URL}" /opt/cybernexa
else
  rm -rf /tmp/cnzip && mkdir -p /tmp/cnzip/extracted
  curl -fsSL "${URL}" -o /tmp/cnzip/app.zip
  unzip -o -q /tmp/cnzip/app.zip -d /tmp/cnzip/extracted
  mkdir -p /opt/cybernexa
  top=$(find /tmp/cnzip/extracted -mindepth 1 -maxdepth 1 -type d | head -1 || true)
  if [ -n "${top}" ] && [ "$(find /tmp/cnzip/extracted -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]; then
    cp -a "${top}"/. /opt/cybernexa/
  else
    cp -a /tmp/cnzip/extracted/. /opt/cybernexa/
  fi
fi
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
Description=TechNexa Solutions website
After=network.target mysql.service

[Service]
WorkingDirectory=/opt/cybernexa
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=80
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
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
curl -fsS http://localhost/healthz && echo
PUBIP=$(curl -fsS https://ifconfig.me || echo "<this-server-public-ip>")
echo "======================================================"
echo "DONE! TechNexa is LIVE."
echo "Open this in your browser:  http://${PUBIP}"
echo "Admin panel:                http://${PUBIP}/admin"
echo "======================================================"