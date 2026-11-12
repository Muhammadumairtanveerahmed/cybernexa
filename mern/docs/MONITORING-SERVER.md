# TechNexa — Live Server Monitoring (Prometheus + Grafana)

Monitoring stack jo **production EC2 server** par chal rahi hai:

- Host: `54.161.79.42` (EC2, Ubuntu 26.04, `ubuntu@ip-172-31-36-154`)
- Install path: `/opt/technexa-monitoring`
- Managed with Docker Compose, auto-start on reboot (`restart: unless-stopped`)
- **The live website, k3s, nginx and MySQL were not modified.** The stack only
  reads existing endpoints and adds a MySQL exporter user.

## 1. What is running

| Container | Image | Listens on | Purpose |
| --- | --- | --- | --- |
| `technexa-prometheus` | prom/prometheus:v2.55.1 | `127.0.0.1:9090` | Scrapes and stores all metrics |
| `technexa-grafana` | grafana/grafana:11.3.0 | `0.0.0.0:3001` | Dashboards (public) |
| `technexa-node-exporter` | prom/node-exporter:v1.8.2 | `127.0.0.1:9100` | CPU, RAM, disk, network, load |
| `technexa-mysqld-exporter` | prom/mysqld-exporter:v0.14.0 | `127.0.0.1:9104` | MySQL connections, queries, buffer pool |
| `technexa-blackbox-exporter` | prom/blackbox-exporter:v0.25.0 | `127.0.0.1:9115` | Website uptime + response time probes |

Only Grafana (`3001`) is exposed outside the host. Prometheus and every
exporter are bound to `127.0.0.1`, so they cannot be reached from the internet.

## 2. Access

### Grafana (public)

```
http://54.161.79.42:3001/d/technexa-server
```

Login: `admin` / password stored in `/opt/technexa-monitoring/.env`
(`GF_ADMIN_PASSWORD`).

**Port 3001 must be allowed in the AWS Security Group.**
Add an inbound rule: `Type = Custom TCP`, `Port = 3001`, `Source = 0.0.0.0/0`
(or your own IP for more security).

### Prometheus (localhost only)

Prometheus is intentionally not exposed. Use an SSH tunnel from your PC:

```powershell
ssh -i "$env:USERPROFILE\Downloads\cybernexa.pem" -N `
  -L 9090:127.0.0.1:9090 ubuntu@54.161.79.42
```

Then open `http://localhost:9090/targets`.

### Both services through one tunnel

`monitoring/server/open-grafana-tunnel.bat` opens both tunnels
(`3001` and `9090`) in one window. Keep the window open and browse
`http://localhost:3001/d/technexa-server`.

## 3. What is monitored

### Server (node-exporter)
- CPU usage per core and total
- Memory used / available, swap
- Disk usage per filesystem
- Disk read/write throughput
- Network receive/transmit bandwidth
- Load average (1m / 5m)
- Boot time / uptime

### MySQL (mysqld-exporter, connected to the k3s `mysql` service)
- `mysql_up` — is the database reachable
- Threads connected vs `max_connections`
- Queries per second
- Slow queries per second
- InnoDB buffer pool utilisation
- Table/lock and replication counters

### Website (blackbox-exporter)
Probes every 15 seconds:
- `http://127.0.0.1/healthz` (local health endpoint)
- `http://127.0.0.1/` (homepage through nginx)
- `http://54.161.79.42/healthz` (full public path)

Each probe exports: success/failure, response time, HTTP status code.

### Prometheus itself
- Number of scrape targets up
- Scrape duration, sample volume, storage size

### Grafana dashboard
**TechNexa — Server Overview** (`uid: technexa-server`) has 20 panels:
CPU, Memory, Disk, Uptime, CPU over time, Memory over time, Network traffic,
Disk I/O, Filesystem usage, Load average, Website up/down, Website response
time, HTTP status codes, MySQL up, MySQL connections, MySQL queries/sec,
MySQL slow queries, MySQL buffer pool, Prometheus targets up, Swap usage.

Refresh: every 30 seconds, default range last 6 hours.

## 4. Managing the stack

All commands run from the server:

```bash
cd /opt/technexa-monitoring

# status
sudo docker compose ps

# logs
sudo docker logs technexa-prometheus --tail 50
sudo docker logs technexa-grafana --tail 50

# restart / update
sudo docker compose pull
sudo docker compose up -d

# stop
sudo docker compose down

# stop and delete stored metrics/dashboards
sudo docker compose down -v
```

Re-running `install.sh` (in `monitoring/server/`) is safe — it copies the
configuration again, recreates the exporter user and restarts the stack.

## 5. Reinstall / redeploy from this repo

```bash
scp -i cybernexa.pem -r mern/monitoring/server/* ubuntu@54.161.79.42:/tmp/monitoring-server/
ssh -i cybernexa.pem ubuntu@54.161.79.42 "sudo bash /tmp/monitoring-server/install.sh"
```

## 6. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Grafana page does not load | AWS Security Group does not allow TCP 3001. Add the rule. |
| Dashboard shows "No data" | Wait one scrape interval (15s). Check `http://localhost:9090/targets`. |
| `mysql_up = 0` | The exporter user was not created or the MySQL pod moved. Re-run `install.sh`. |
| `probe_success = 0` for the public URL | The site is down or nginx is misbehaving — check `http://54.161.79.42/healthz`. |
| Permission denied in Grafana logs | Fix permissions: `sudo chmod -R a+rX /opt/technexa-monitoring && sudo docker restart technexa-grafana`. |
| Containers do not start after reboot | Docker is enabled (`systemctl is-enabled docker` should print `enabled`). |

## 7. Security notes

- Prometheus/exporters are localhost-only; Grafana is the only public port.
- Change the Grafana admin password for any long-term or public use.
- Keep the `.env` file at `chmod 600`.
- Rotate the MySQL exporter user password if the server is ever shared.
