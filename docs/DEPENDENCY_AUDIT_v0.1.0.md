# Dependency Audit — v0.1.0

**Date:** 2026-05-13
**Tool:** `pnpm audit --json` (pnpm 10.0.0)
**Scope:** `/root/Mento` workspace (apps/api, apps/web, apps/mobile, packages/*)
**Total dependencies scanned:** 1,068

---

## Headline

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Moderate | 0 |
| Low      | 0 |
| Info     | 0 |

---

## High

### Advisory GHSA-5478-66c3-rhxr — `@chenglou/pretext` (DoS via algorithmic complexity)

| Field | Value |
|-------|-------|
| Package | `@chenglou/pretext@0.0.4` |
| Severity | **High** |
| CVE | None assigned |
| CWE | CWE-407 (Inefficient Algorithmic Complexity) |
| Title | Pretext: Algorithmic Complexity (DoS) in the text analysis phase |
| Reported path | `.>@chenglou/pretext` (audit tool output) |
| Fix available | `>=0.0.5` |
| CVSS score | Not scored (0.0) |

#### Description

`isRepeatedSingleCharRun()` in the library's text analysis phase rescans the entire accumulated segment on every merge iteration, producing O(n²) CPU work. An attacker who controls text passed to `prepare()` can block the main thread for ~20 seconds with 80 KB of repeated ASCII punctuation (e.g., `"(".repeat(80_000)`).

Attack requires no authentication. Works in browser (UI freeze) and Node.js (server CPU saturation).

#### Triage — DOES NOT AFFECT MENTO

**Critical finding: this advisory does not belong to the Mento project.**

Evidence:

1. `@chenglou/pretext` has **zero entries in `/root/Mento/pnpm-lock.yaml`** (18,549 lines searched, 0 matches).
2. `pnpm why @chenglou/pretext` resolves to `my-app@3.4.0 /root/GeekSpace2.0` — the neighbouring GeekSpace2.0 project on the same machine, which shares the pnpm content-addressable store.
3. None of Mento's `package.json` files (root, api, web, mobile, or any package) declare `@chenglou/pretext` as a dependency.
4. No source file under `/root/Mento/apps/` imports from `@chenglou/pretext`.

The `pnpm audit` command scans the global pnpm store rather than only the packages declared in the local lockfile when packages are co-installed, producing a false-positive attribution to Mento.

**Recommended action for Mento: `accept-risk` — not our package.**

**Recommended action for GeekSpace2.0: `upgrade` `@chenglou/pretext` to `>=0.0.5`.**

---

## Moderate

None.

---

## Low / Info

None.

---

## Recommended Actions

### For Mento (this repo)

1. **No package upgrades required.** The single advisory is a false positive traced to the co-resident GeekSpace2.0 project using the shared pnpm store.

2. **Isolate audit in CI** — add `--audit-level=moderate` and run `pnpm audit` with `--filter` scoped to Mento packages only, or run it inside the Docker build context so the pnpm store is clean and contains only Mento's dependencies. Example:
   ```bash
   pnpm audit --filter "mento" --audit-level=moderate
   ```
   This prevents the shared-store bleed from reporting GeekSpace2.0 advisories in Mento's CI.

3. **Schedule a re-audit** after Phase E–F land (Razorpay + R2 upload), which will add new transitive dependencies (payment SDKs, file upload libraries) that warrant a fresh scan.

### For GeekSpace2.0 (separate repo, separate wave)

4. Upgrade `@chenglou/pretext` from `0.0.4` → `0.0.5` in `/root/GeekSpace2.0/package.json`. This is a minor patch with no API changes. Run `pnpm install` and re-audit.

---

## Notes on audit fidelity

- `pnpm audit` in a shared-store environment can attribute a neighbour project's vulnerabilities to the scanned workspace if the global store contains packages not present in the local lockfile. Always cross-reference with `pnpm why <package>` and lockfile grep before acting on an advisory.
- No `pnpm.overrides` stanza is needed in `/root/Mento/package.json` because the vulnerable package is not a Mento dependency at all.
