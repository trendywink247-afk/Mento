#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mento — Pre-deploy environment variable checker
#
# Usage:
#   ./scripts/check-env.sh [--file <path>]
#
# Reads an env file (default: ./.env.prod), checks every required and
# recommended variable, and exits 1 if any REQUIRED var is missing/empty or
# any REQUIRED_SECRET is shorter than its minimum length.
#
# Rules:
#   REQUIRED        — must be present and non-empty. Hard fail if missing.
#   REQUIRED_SECRET — must be present, non-empty, AND >= N chars. Hard fail if weak.
#   RECOMMENDED     — warn if missing; deployment may still partially work.
#   DEV_ONLY        — warn if the value suggests a dev/test mode in prod.
#
# Safe: reads the env file via grep/sed — never eval or source it.
# Silent about secret values: only their lengths are printed.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colour / formatting ───────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  RED=$(tput setaf 1)
  YELLOW=$(tput setaf 3)
  GREEN=$(tput setaf 2)
  CYAN=$(tput setaf 6)
  BOLD=$(tput bold)
  RESET=$(tput sgr0)
else
  RED="" YELLOW="" GREEN="" CYAN="" BOLD="" RESET=""
fi

# ── Argument parsing ──────────────────────────────────────────────────────────
ENV_FILE="./.env.prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --file=*)
      ENV_FILE="${1#--file=}"
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | head -20 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "${RED}Unknown argument: $1${RESET}" >&2
      exit 1
      ;;
  esac
done

# ── Verify env file exists ────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "${RED}${BOLD}ERROR:${RESET} env file not found: $ENV_FILE" >&2
  echo "  Copy .env.prod.example to .env.prod and fill in all secrets." >&2
  exit 1
fi

# ── Helper: read a single value from the env file ─────────────────────────────
# Strips surrounding single/double quotes. Never evals anything.
get_value() {
  local key="$1"
  # Match KEY=value lines; skip comment lines (#).
  local raw
  raw=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2-)
  # Strip surrounding quotes (single or double)
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  printf '%s' "$raw"
}

# ── Counters ──────────────────────────────────────────────────────────────────
fail_count=0
warn_count=0

missing_required=()
weak_secrets=()
missing_recommended=()
devonly_set=()

# ── Category definitions ──────────────────────────────────────────────────────
#
# REQUIRED: must be present and non-empty.
REQUIRED_VARS=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  REDIS_PASSWORD
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
)

# REQUIRED_SECRET: "VAR:MIN_LENGTH"
REQUIRED_SECRET_VARS=(
  "POSTGRES_PASSWORD:16"
  "REDIS_PASSWORD:16"
  "JWT_ACCESS_SECRET:32"
  "JWT_REFRESH_SECRET:32"
)

# RECOMMENDED: warn if absent, don't fail.
RECOMMENDED_VARS=(
  # Razorpay (billing)
  RAZORPAY_KEY_ID
  RAZORPAY_KEY_SECRET
  RAZORPAY_WEBHOOK_SECRET
  RAZORPAY_PLAN_BASIC
  RAZORPAY_PLAN_PRO
  RAZORPAY_PLAN_MAX
  # Google OAuth
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  # Sentry
  SENTRY_DSN_API
  NEXT_PUBLIC_SENTRY_DSN
  SENTRY_ORG
  SENTRY_PROJECT
  SENTRY_AUTH_TOKEN
  # PostHog analytics
  POSTHOG_API_KEY
  NEXT_PUBLIC_POSTHOG_KEY
  # Expo push notifications
  EXPO_ACCESS_TOKEN
  # SMS / OTP gateway
  SMS_PROVIDER
  SMS_API_KEY
  # Admin bootstrap
  ADMIN_BOOTSTRAP_PHONE
  # S3 / R2 uploads
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  S3_BUCKET
  # Web URLs
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_SOCKET_URL
  CORS_ORIGINS
  # GHCR image source
  GHCR_OWNER
)

# DEV_ONLY: warn if the value indicates dev/test mode in production.
# Format: "VAR:DANGEROUS_VALUE:NOTE"
DEV_ONLY_VARS=(
  "OTP_DEV_MODE:true:OTPs will be returned in API responses — real users can see each other's codes"
  "NODE_ENV:development:NODE_ENV should be 'production'"
)

# ── Print header ──────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}${CYAN}================================================================${RESET}"
echo "${BOLD}${CYAN}  Mento env check  --  $ENV_FILE${RESET}"
echo "${BOLD}${CYAN}================================================================${RESET}"
echo ""

# ── Check REQUIRED vars ───────────────────────────────────────────────────────
echo "${BOLD}--- REQUIRED vars ---${RESET}"

for var in "${REQUIRED_VARS[@]}"; do
  val=$(get_value "$var")
  if [[ -z "$val" ]]; then
    echo "  ${RED}[FAIL] MISSING REQUIRED: ${BOLD}$var${RESET}"
    missing_required+=("$var")
    (( fail_count++ )) || true
  else
    echo "  ${GREEN}[OK]   $var${RESET}"
  fi
done
echo ""

# ── Check REQUIRED_SECRET vars ────────────────────────────────────────────────
echo "${BOLD}--- REQUIRED_SECRET vars (minimum length enforced) ---${RESET}"

for spec in "${REQUIRED_SECRET_VARS[@]}"; do
  var="${spec%%:*}"
  min_len="${spec##*:}"
  val=$(get_value "$var")

  if [[ -z "$val" ]]; then
    # Already flagged by REQUIRED check; skip double-counting the fail but note it.
    echo "  ${RED}[FAIL] MISSING:       ${BOLD}$var${RESET}  (need >= ${min_len} chars)"
    # Only add to weak_secrets if not already in missing_required
    already_missing=0
    for m in "${missing_required[@]}"; do [[ "$m" == "$var" ]] && already_missing=1; done
    if [[ $already_missing -eq 0 ]]; then
      weak_secrets+=("$var (empty, need >= ${min_len} chars)")
      (( fail_count++ )) || true
    fi
  else
    actual_len="${#val}"
    if [[ "$actual_len" -lt "$min_len" ]]; then
      echo "  ${RED}[FAIL] WEAK SECRET:   ${BOLD}$var${RESET}  (${actual_len} chars, need >= ${min_len})"
      weak_secrets+=("$var (${actual_len} chars, need >= ${min_len})")
      (( fail_count++ )) || true
    else
      echo "  ${GREEN}[OK]   $var${RESET}  (${actual_len} chars)"
    fi
  fi
done
echo ""

# ── Check RECOMMENDED vars ────────────────────────────────────────────────────
echo "${BOLD}--- RECOMMENDED vars (warn only) ---${RESET}"

for var in "${RECOMMENDED_VARS[@]}"; do
  val=$(get_value "$var")
  if [[ -z "$val" ]]; then
    echo "  ${YELLOW}[WARN] RECOMMENDED missing: $var${RESET}"
    missing_recommended+=("$var")
    (( warn_count++ )) || true
  else
    echo "  ${GREEN}[OK]   $var${RESET}"
  fi
done
echo ""

# ── Check DEV_ONLY vars ───────────────────────────────────────────────────────
echo "${BOLD}--- DEV_ONLY vars (danger in production) ---${RESET}"

for spec in "${DEV_ONLY_VARS[@]}"; do
  var="${spec%%:*}"
  rest="${spec#*:}"
  dangerous_val="${rest%%:*}"
  note="${rest#*:}"
  val=$(get_value "$var")

  if [[ "$val" == "$dangerous_val" ]]; then
    echo "  ${RED}[WARN] DEV_ONLY active: ${BOLD}$var=${dangerous_val}${RESET}"
    echo "         ${YELLOW}$note${RESET}"
    devonly_set+=("$var=$dangerous_val")
    (( warn_count++ )) || true
  else
    echo "  ${GREEN}[OK]   $var${RESET}  (value: '${val:-<not set>}')"
  fi
done
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "${BOLD}${CYAN}================================================================${RESET}"
echo "${BOLD}  Summary${RESET}"
echo "${BOLD}${CYAN}================================================================${RESET}"

# Missing REQUIRED
if [[ ${#missing_required[@]} -gt 0 ]]; then
  echo "  ${RED}${BOLD}Missing REQUIRED (${#missing_required[@]}):${RESET}"
  for v in "${missing_required[@]}"; do
    echo "    ${RED}x  $v${RESET}"
  done
else
  echo "  ${GREEN}All REQUIRED vars present.${RESET}"
fi

# Weak secrets
if [[ ${#weak_secrets[@]} -gt 0 ]]; then
  echo "  ${RED}${BOLD}Weak REQUIRED_SECRET (${#weak_secrets[@]}):${RESET}"
  for v in "${weak_secrets[@]}"; do
    echo "    ${RED}x  $v${RESET}"
  done
else
  echo "  ${GREEN}All REQUIRED_SECRET vars meet length requirements.${RESET}"
fi

# Recommended
if [[ ${#missing_recommended[@]} -gt 0 ]]; then
  echo "  ${YELLOW}Missing RECOMMENDED (${#missing_recommended[@]} of ${#RECOMMENDED_VARS[@]}):${RESET}"
  for v in "${missing_recommended[@]}"; do
    echo "    ${YELLOW}-  $v${RESET}"
  done
else
  echo "  ${GREEN}All RECOMMENDED vars present.${RESET}"
fi

# Dev-only
if [[ ${#devonly_set[@]} -gt 0 ]]; then
  echo "  ${RED}DEV_ONLY flags active in prod (${#devonly_set[@]}):${RESET}"
  for v in "${devonly_set[@]}"; do
    echo "    ${RED}!  $v${RESET}"
  done
fi

echo ""
echo "  REQUIRED failures : ${fail_count}"
echo "  Warnings          : ${warn_count}"
echo ""

# ── Exit code ─────────────────────────────────────────────────────────────────
if [[ "$fail_count" -gt 0 ]]; then
  echo "${RED}${BOLD}RESULT: FAIL${RESET} -- $fail_count required check(s) failed. Fix before deploying."
  echo ""
  exit 1
else
  echo "${GREEN}${BOLD}RESULT: PASS${RESET} -- All required checks passed."
  if [[ "$warn_count" -gt 0 ]]; then
    echo "${YELLOW}         $warn_count warning(s) above -- some features may not work until filled.${RESET}"
  fi
  echo ""
  exit 0
fi
