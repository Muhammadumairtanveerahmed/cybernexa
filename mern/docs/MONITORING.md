# TechNexa Monitoring (Prometheus + Grafana)

TechNexa exposes a Prometheus-compatible metrics endpoint and ships a ready
Grafana dashboard, so the health of the platform can be watched live during the
demo and in production.

```
 Browser / Portal
        |
        v
  React (Vite :5173)  --->  Express API (:5000)  --->  MySQL (:3306)
                                   |
                                   |  GET /metrics  (Prometheus text format)
                                   v
                            Prometheus (:9090)
                                   |
                                   v
                             Grafana (:3001)
```

## 1. What is monitored

### HTTP / API health
| Metric | Type | Meaning |
| --- | --- | --- |
| `technexa_http_requests_total` | counter | Every API request, labelled by `method`, `route`, `status` |
| `technexa_http_request_duration_seconds` | histogram | Response time (p50 / p95 / p99 latency) |
| `technexa_http_requests_in_flight` | gauge | Requests being processed right now |
| `technexa_http_errors_total` | counter | Only 5xx responses — real server failures |

### Runtime health (Node.js)
| Metric | Meaning |
| --- | --- |
| `technexa_process_cpu_*` | CPU time used by the API process |
| `technexa_process_resident_memory_bytes` | RAM used |
| `technexa_nodejs_heap_size_used_bytes` / `_total_bytes` | V8 heap usage |
| `technexa_nodejs_eventloop_lag_*` | Event-loop delay (blocking detection) |
| `technexa_process_start_time_seconds` | Used to compute uptime |
| `technexa_nodejs_active_handles_total` | Open sockets / servers |

### Database health
| Metric | Meaning |
| --- | --- |
| `technexa_db_pool_connections{state="used\|free\|queued\|limit"}` | MySQL connection-pool saturation |

### Real-time (Socket.IO) health
| Metric | Meaning |
| --- | --- |
| `technexa_online_users` | Distinct users connected over WebSockets |
| `technexa_socket_connections` | Raw socket connections (tabs/devices) |

### Business / product health (read from MySQL on each scrape)
| Metric | Meaning |
| --- | --- |
| `technexa_users_total{label="role/status"}` | Students, teachers, admins and their approval status |
| `technexa_enrollments_total{status}` | Pending / approved / rejected / completed enrollments |
| `technexa_quiz_attempts_total{status}` | In-progress vs submitted quiz attempts |
| `technexa_quiz_violations_total{type}` | Anti-cheat events: `screen_hidden`, `window_blur`, `fullscreen_exit`, `page_leave`, `copy_attempt`, `other` |
| `technexa_quiz_violations_last_24h{type}` | Same, limited to the last 24 hours |
| `technexa_login_events_total{status}` | Success / failed / suspended / blocked logins |
| `technexa_logins_last_24h{status}` | Login outcomes in the last 24 hours |
| `technexa_call_logs_total{status}` | Audio/video calls: missed, answered, rejected, ended |
| `technexa_new_users_last_24h` | Signup velocity |
| `technexa_contact_messages_total` | Contact-form messages received |
| `technexa_subscribers_total` | Newsletter subscribers |

### Application events (counters incremented by the app)
| Metric | Meaning |
| --- | --- |
| `technexa_login_attempts_total{role,result}` | Login outcomes grouped by role |
| `technexa_enrollments_submitted_total` | Enrollment forms successfully submitted |
| `technexa_ai_quiz_generation_total{provider,result}` | AI quiz generation: `gemini`, `openai`, `builtin` × `success`/`error` |

## 2. Endpoints

| Service | URL | Credentials |
| --- | --- | --- |
| Metrics (raw) | http://localhost:5000/metrics | none (or `METRICS_TOKEN`) |
| Prometheus | http://localhost:9090 | none |
| Grafana | http://localhost:3001 | `admin` / `technexa` (view-only anonymous access is enabled for local demos) |
| Dashboard | http://localhost:3001/d/technexa-overview | `admin` / `technexa` |
| Prometheus targets | http://localhost:9090/targets | none |

## 3. Quick start

### Option A — API runs on Windows (XAMPP MySQL), monitoring in Docker
This is the setup used for the demo.

```bat
START-TECHNEXA.bat      :: MySQL + API + Vite
START-MONITORING.bat    :: Prometheus + Grafana (Docker)
```

Or manually:

```powershell
docker compose -f mern/monitoring/docker-compose.monitoring.yml up -d
```

Prometheus scrapes `host.docker.internal:5000`, i.e. the API on the host.

### Option B — everything in Docker
```powershell
cd mern
docker compose up -d
```

In this mode Prometheus scrapes `server:5000` from inside the compose network.

### Option C — Prometheus/Grafana installed natively on Windows
```powershell
prometheus.exe --config.file=mern/monitoring/prometheus/prometheus.local.yml
```

Then add a Prometheus datasource `http://localhost:9090` in Grafana and import
`mern/monitoring/grafana/dashboards/technexa-overview.json`.

## 4. Grafana dashboard

**TechNexa — Platform Overview** (`uid: technexa-overview`) is provisioned
automatically. Panels:

1. API requests / second
2. Error rate (5xx %)
3. Response time p95
4. In-flight requests
5. Traffic & errors over time
6. Response-time percentiles (p50 / p95 / p99)
7. Top routes in the selected time range
8. HTTP status-code split
9. Real-time users (online users + socket connections)
10. Users by role / status
11. Enrollments by status
12. Quiz attempts by status
13. Quiz violations by type
14. Login attempts in the last 24 hours
15. AI quiz generation by provider / result
16. MySQL pool connections
17. Node.js heap memory
18. Process CPU
19. API uptime
20. Contact messages
21. Newsletter subscribers

The dashboard auto-refreshes every 30 seconds.

## 5. Security

- `/metrics` is excluded from its own request metrics (no feedback loop).
- Set `METRICS_TOKEN` in `mern/server/.env` to require
  `Authorization: Bearer <token>` on `GET /metrics`.
- If you enable the token, also uncomment the `authorization:` block in
  `monitoring/prometheus/prometheus.yml`.
- In production, never expose port `9090` or `3001` publicly. Put them behind
  the reverse proxy with authentication, or keep them on the private network.
- Grafana's default admin password (`technexa`) must be changed before any
  public deployment (`GF_SECURITY_ADMIN_PASSWORD`).
- The local monitoring compose enables read-only anonymous access
  (`GF_AUTH_ANONYMOUS_ENABLED`) so the dashboard opens without a login during the
  demo. Disable it for any public deployment.

## 6. Retention

Prometheus keeps 15 days of samples (`--storage.tsdb.retention.time=15d`).
Data lives in the `technexa-monitoring_prometheus_data` Docker volume and
survives container restarts.

## 7. Useful commands

```powershell
# status
docker compose -f mern/monitoring/docker-compose.monitoring.yml ps

# logs
docker logs technexa-prometheus
docker logs technexa-grafana

# stop
docker compose -f mern/monitoring/docker-compose.monitoring.yml down

# stop and delete stored metrics
docker compose -f mern/monitoring/docker-compose.monitoring.yml down -v
```

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Prometheus target is `DOWN` | API is not running on port 5000, or Docker cannot reach the host. Run `START-TECHNEXA.bat` first. |
| Grafana shows "No data" | Wait one scrape interval (15s). Check http://localhost:9090/targets. |
| Grafana container restarts | Port `3001` already in use. Change the mapping in `docker-compose.monitoring.yml`. |
| `docker` command not found | Start Docker Desktop first (`START-MONITORING.bat` does this). |
| Dashboard missing | Grafana provisioning runs at startup; restart with `docker compose ... restart grafana`. |
