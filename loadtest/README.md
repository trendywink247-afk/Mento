# Mento Load Tests

k6-based load tests covering the API's hot endpoints.
Goal: validate readiness for 10 M MAU with a paid-promotion spike.

---

## Prerequisites

### Install k6

**macOS**
```bash
brew install k6
```

**Linux (Debian/Ubuntu)**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Docker (no install required)**
```bash
docker run --rm -i grafana/k6 run - < loadtest/k6/05-mixed-realistic.js
```

**Windows**
```bash
winget install k6
```

---

## Running the API locally

The tests assume `NODE_ENV=development` on the API so that `POST /auth/otp/request`
returns `devCode` in the response (no SMS sent).

```bash
# Start infrastructure
cd /root/Mento
pnpm db:up

# Start API in dev mode
pnpm --filter @mento/api dev
# API will listen on http://localhost:4000
```

---

## Running each scenario

All scripts accept a `BASE_URL` environment variable (default: `http://localhost:4000`).

### 01 — Onboarding (OTP + Mirror)
Models a signup campaign spike: 50 VUs for 90 seconds.
```bash
k6 run loadtest/k6/01-onboarding.js
k6 run -e BASE_URL=https://staging.mento.app loadtest/k6/01-onboarding.js
```

### 02 — Mentor Discovery (GET /mentors)
150 VUs browsing with random filters for 2 minutes.
```bash
k6 run loadtest/k6/02-mentor-discovery.js
# Inject known mentor UUIDs for realistic detail-page hits:
k6 run -e MENTOR_IDS="uuid1,uuid2,uuid3" loadtest/k6/02-mentor-discovery.js
```

### 03 — Chat List + History
200 VUs doing cold + warm conversation list reads + paginated message history.
```bash
k6 run loadtest/k6/03-chat-list-and-history.js
# Pre-supply a bearer token to skip per-setup OTP:
k6 run -e SETUP_TOKEN="eyJhbGci..." loadtest/k6/03-chat-list-and-history.js
# Pre-supply conversation IDs for realistic history reads:
k6 run -e CONV_IDS="uuid1,uuid2" loadtest/k6/03-chat-list-and-history.js
```

### 04 — Journal Upsert + Entry
80 VUs creating journals and writing entries.
```bash
k6 run loadtest/k6/04-journal-upsert-and-entry.js
```

### 05 — Mixed Realistic (main scenario)
500 VUs for 5 minutes, weighted traffic distribution.
```bash
k6 run loadtest/k6/05-mixed-realistic.js

# Save results for later analysis:
k6 run --out json=loadtest/results/mixed-$(date +%Y%m%d-%H%M).json \
  loadtest/k6/05-mixed-realistic.js
```

### Run against staging
```bash
BASE=https://staging.mento.app
k6 run -e BASE_URL=$BASE loadtest/k6/05-mixed-realistic.js
```

---

## SLO reference table

| Endpoint | Method | P95 target | Error budget |
|---|---|---|---|
| `/auth/otp/request` | POST | 500 ms | 0.1% |
| `/auth/otp/verify` | POST | 500 ms | 0.1% |
| `/onboarding/state` | GET | 300 ms | 0.1% |
| `/onboarding/mirror` | POST | 500 ms | 0.1% |
| `/mentors` | GET | 200 ms | 0.1% |
| `/mentors/:id` | GET | 200 ms | 0.1% |
| `/conversations` | GET | 300 ms | 0.1% |
| `/conversations/:id/messages` | GET | 300 ms | 0.1% |
| `/journals` | POST (upsert) | 400 ms | 0.1% |
| `/journals/:id/entries` | POST | 400 ms | 0.1% |
| All endpoints (mixed) | — | P95 < 500 ms, P99 < 1000 ms | 0.5% |

---

## Interpreting k6 output

```
scenarios: (100.00%) 1 scenario, 500 max VUs ...
✓ conv list 200
✓ mentor list 200
...

http_req_duration.............: avg=145ms  min=22ms  med=120ms  max=980ms  p(90)=280ms  p(95)=340ms
http_req_failed...............: 0.12%  ✗ 45 out of 37500
```

Key fields:

- **p(95)**: 95th-percentile latency. Must be below the SLO target.
- **http_req_failed**: percentage of non-2xx responses. Must be < 0.1% per endpoint.
- **checks**: named assertions. Any `✗` indicates a logic failure (wrong response body, missing field).
- **Custom Trend metrics** (e.g. `conv_list_duration`): confirm tagged thresholds with end-to-end timing.

A run **passes** when all `thresholds` lines show `✓`. If any threshold fails, k6 exits with code 99.

### Grafana integration

Add `--out influxdb=http://localhost:8086/k6` (InfluxDB v1) or
`--out experimental-prometheus-rw` (Prometheus remote write) to stream
metrics in real time. Tags (`endpoint`, `scenario`) are pre-applied in the
scripts for immediate panel filtering.

---

## Environment variables summary

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:4000` | API base URL |
| `SETUP_TOKEN` | — | Pre-created bearer token (skips OTP setup) |
| `CONV_IDS` | — | Comma-separated conversation UUIDs |
| `MENTOR_IDS` | — | Comma-separated mentor profile UUIDs |
