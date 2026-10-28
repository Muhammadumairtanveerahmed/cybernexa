#!/usr/bin/env bash
# ============================================================
# TechNexa — rebuild the site image from source and roll it
# out on the single-node k3s cluster running on this EC2 box.
#
# Usage (on the server):
#   cd ~/cybernexa && bash scripts/deploy-k3s.sh
#
# What it does:
#   1. git pull (latest code from GitHub)
#   2. docker build  -> cybernexa:1.0
#   3. import the image into k3s containerd (imagePullPolicy: Never)
#   4. kubectl apply + rollout restart, then wait for success
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-cybernexa:1.0}"

echo "[1/4] Pulling latest code"
git pull --ff-only

echo "[2/4] Building image ${IMAGE}"
sudo docker build -t "${IMAGE}" .

echo "[3/4] Importing image into k3s containerd"
sudo docker save "${IMAGE}" | sudo k3s ctr images import -

echo "[4/4] Applying manifests + rolling out"
sudo k3s kubectl apply -f k8s/
sudo k3s kubectl rollout restart deployment/cybernexa
sudo k3s kubectl rollout status deployment/cybernexa --timeout=180s

PUBIP="$(curl -fsS -m 5 https://ifconfig.me || echo '<server-ip>')"
echo "======================================================"
echo "DONE — TechNexa is LIVE"
echo "Site  : http://${PUBIP}"
echo "Admin : http://${PUBIP}/admin"
echo "======================================================"
