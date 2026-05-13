# Mento — Alerting & Observability

## Overview

Mento uses two complementary alerting layers:
- **Sentry** — application errors, exceptions, and performance traces
- **Prometheus + Alertmanager** — metric-based threshold alerts (OTP abuse, paywall spikes, ban rate, latency)

---

## Sentry Setup

### 1. DSN configuration

Set `SENTRY_DSN_API` in your `.env`. The SDK is initialised in `apps/api/src/main.ts`
before the app bootstraps, so even boot failures are captured.

```
SENTRY_DSN_API=https://XXXX@oXXXXX.ingest.sentry.io/XXXXXX
```

### 2. Sentry dashboard alert rules

Navigate to: **Your Project → Alerts → Create Alert Rule**

#### Error rate alert (backend)
| Field | Value |
|---|---|
| Condition | Number of events > 50 in 5 minutes |
| Filter | environment: production, level: error |
| Action | Notify Slack #alerts-prod + PagerDuty |

#### Performance alert — P95 latency
| Field | Value |
|---|---|
| Condition | p95(transaction.duration) > 1000ms |
| Filter | transaction.op: http.server |
| Action | Notify Slack #alerts-prod |

#### New error type (issue alert)
| Field | Value |
|---|---|
| Trigger | First time an issue is seen |
| Filter | environment: production |
| Action | Notify Slack #alerts-new-errors |

### 3. Sentry → Slack integration
1. Go to **Settings → Integrations → Slack**.
2. Install the Slack app and authorise the workspace.
3. In each alert rule, set Action to **Send a Slack notification** and pick the channel.

### 4. Sentry → PagerDuty integration
1. Go to **Settings → Integrations → PagerDuty**.
2. Add your PagerDuty service key.
3. Assign PagerDuty to critical alert rules (e.g. error rate > 200/5min).

---

## Prometheus Metrics

The API exposes metrics at `GET /metrics` in Prometheus exposition format.

**Security**: Caddy returns HTTP 403 for any public request to `/metrics`.
Prometheus scrapes `api:4000/metrics` directly inside the docker network — it
never goes through Caddy.

### Custom counters exposed

| Metric | Labels | Description |
|---|---|---|
| `mento_signup_total` | `method` (otp, google) | New user registrations |
| `mento_otp_request_total` | — | OTP send requests |
| `mento_otp_verify_total` | `outcome` (ok, wrong, locked, rate_limited) | OTP verify attempts |
| `mento_paywall_total` | `requiredTier` (FREE, BASIC, PRO, MAX) | Requests blocked by tier guard |
| `mento_subscription_change_total` | `to` (activated, cancelled), `tier` | Subscription lifecycle |
| `mento_moderation_action_total` | `action` (warn, dismiss, suspend, ban) | Admin moderation decisions |
| `mento_chat_request_total` | `outcome` (sent, accepted, declined) | Chat request lifecycle |
| `mento_session_request_total` | `outcome` (sent, accepted, declined, cancelled) | Session request lifecycle |

### Custom histograms

| Metric | Labels | Description |
|---|---|---|
| `mento_http_request_duration_seconds` | `route`, `status` | HTTP request duration (buckets: 10ms–5s) |

Standard Node.js metrics (`process_cpu_seconds_total`, heap, GC, event loop lag)
are collected via `collectDefaultMetrics`.

---

## Prometheus Scrape Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: mento_api
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets:
          - api:4000   # docker internal network only
    metrics_path: /metrics
```

To verify inside the docker network:
```bash
curl http://api:4000/metrics
```

---

## Alertmanager Rules

Example `alerts/mento.yml` to ship with your Prometheus deployment:

```yaml
groups:
  - name: mento_security
    rules:
      # OTP brute-force: > 10 locked-outcome verifies per minute
      - alert: OtpBruteForce
        expr: |
          rate(mento_otp_verify_total{outcome="locked"}[1m]) * 60 > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "OTP brute-force detected"
          description: "More than 10 OTP lockouts per minute for 2 consecutive minutes."

      # Paywall spike: > 100 paywall blocks per minute (sudden spike = bad actor or campaign)
      - alert: PaywallSpike
        expr: |
          rate(mento_paywall_total[1m]) * 60 > 100
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "High paywall hit rate"
          description: "Over 100 paywall blocks/min for 3 minutes. Check for bot traffic or viral content."

      # Moderation ban rate: > 5 bans per hour
      - alert: HighBanRate
        expr: |
          rate(mento_moderation_action_total{action="ban"}[1h]) * 3600 > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High ban rate"
          description: "More than 5 bans in the last hour. Review moderation queue."

  - name: mento_latency
    rules:
      # P95 latency > 1s for 5 minutes
      - alert: HighP95Latency
        expr: |
          histogram_quantile(
            0.95,
            rate(mento_http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API P95 latency > 1s"
          description: "95th percentile response time exceeded 1 second for 5 minutes."

  - name: mento_infrastructure
    rules:
      # Postgres connection pool saturation (if pgbouncer / Prisma exposes pool metrics)
      # Placeholder — wire to actual pool metric when available.
      - alert: PgPoolSaturation
        expr: |
          pg_pool_used_connections / pg_pool_max_connections > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Postgres connection pool > 90%"
          description: "Connection pool is near capacity. Scale up or reduce connection leaks."
```

---

## Runbook cross-references

See `docs/RUNBOOK.md` for:
- How to restart services
- How to drain and redeploy
- Postgres backup restore procedure
