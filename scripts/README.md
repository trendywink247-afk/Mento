# scripts/

Operational scripts for the Mento production stack. Deploy to `/srv/mento/scripts/` on the server and make executable.

## Scripts

| Script | Purpose |
|---|---|
| `backup-pg.sh` | Dump the production Postgres database to a gzip file, optionally upload to S3/R2, and prune local copies older than 7 days |
| `restore-pg.sh` | Restore a gzip backup into the production Postgres container; requires explicit confirmation; refuses to restore against a healthy API unless `--force` |

## Installation

```bash
# On the server (run once during first deploy — see docs/DEPLOY.md §2)
cp -r /srv/mento/scripts /srv/mento/scripts
chmod +x /srv/mento/scripts/backup-pg.sh
chmod +x /srv/mento/scripts/restore-pg.sh
```

## Cron setup

Add to `/etc/cron.d/mento-backup` (runs as root, daily at 02:00):

```
0 2 * * * root /srv/mento/scripts/backup-pg.sh >> /var/log/mento-backup.log 2>&1
```

Or use `/etc/crontab` / a user crontab (`crontab -e`). The script also writes to syslog via `logger -t mento-backup` so entries appear in `/var/log/syslog`.

## Backup location

Local backups are written to `/srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz`.

Copies older than 7 days are pruned automatically by `backup-pg.sh`.

## Remote upload (optional)

Set `BACKUP_S3_BUCKET` in `.env.prod` to enable upload to Cloudflare R2 or AWS S3 after each backup. Also set `BACKUP_S3_REGION` (default `auto` for R2) and the matching `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ENDPOINT_URL`. If `BACKUP_S3_BUCKET` is empty, the upload step is silently skipped and the local copy is kept.

## Restore

See `docs/RUNBOOK.md §Backups` for the full step-by-step restore runbook.

Quick reference:

```bash
# Restore from a local backup (interactive — will prompt)
/srv/mento/scripts/restore-pg.sh /srv/mento/backups/mento-20260513-020001.sql.gz

# Restore non-interactively
/srv/mento/scripts/restore-pg.sh -y /srv/mento/backups/mento-20260513-020001.sql.gz
```
