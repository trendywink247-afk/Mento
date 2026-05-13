# Wave 14 Review — 2026-05-13

## Summary

**MAJOR issues: 2 | CRITICAL: 0 | MINOR: 4**

Wave 14 is a pure docs + lockfile patch wave (3 commits). The code
typechecks are clean on all three apps, 127 unit tests pass, and the
primary goal — unblocking Docker with a proper `@nestjs/schedule`
lockfile entry — is confirmed correct. However two doc-accuracy issues
are significant enough to flag before the next wave syncs these files,
and a 2.5 GB binary was committed to git history which cannot be undone
without a rewrite.

---

## CRITICAL

None.

---

## MAJOR

### M1 — 2.5 GB binary committed to git (`loadtest/results/02-mentor-discovery.txt`)

Commit `9f645a1` adds `loadtest/results/02-mentor-discovery.txt` at
2,511,193,013 bytes (2.5 GB). This is inside git object storage. `git
clone`, `git fetch`, and Docker layer caches must now materialize this
object on every checkout. The `.gitignore` at repo root only ignores
`apps/web/test-results/` — there is no rule covering
`loadtest/results/*.txt`.

The file is a raw k6 output dump from a scenario that crashed
immediately (scenario 02 generated zero effective HTTP traffic due to
`URLSearchParams` not being available in goja); the file is therefore
not even a valid result artifact.

**Impact:** This is permanent in git history unless a `git filter-repo`
or `git filter-branch` rewrite is performed. Every clone of this repo
will download 2.5 GB. CI/CD pipelines, Docker builds using
`git clone`, and any developer machine will be affected.

**Fix:** Add `loadtest/results/` to `.gitignore`, rewrite history to
remove the blob (`git filter-repo --path loadtest/results/
02-mentor-discovery.txt --invert-paths`), and force-push. If history
rewrite is not acceptable, at minimum add the gitignore to prevent
future additions.

---

### M2 — `docs/FOUNDER.md` "Open items" section is stale Wave-8 content

`docs/FOUNDER.md` (added in `9435799`) is dated 2026-05-13 and
describes itself as current, but its "Open items before paid launch"
section (lines 66-74) lists all seven Wave-8 blockers verbatim and
states the platform is **YELLOW**:

- BANNED user OTP 15-minute window (M3) — closed in `241086e`
- `listMentees` surfaces suspended/banned aspirants — closed
- Privacy policy and Terms pages — live since `451f694`
- WCAG nested-interactive a11y violation — fixed in `d196a10`
- Chat tab count mismatch — fixed
- Razorpay plan IDs missing — fixed in `451f694`
- Dashboard empty-state copy — fixed in Wave 1-3

`docs/RELEASE_READINESS.md` (updated in `a6963e4`) correctly says
**GREEN** and reconciles all seven closures. The two documents
contradict each other on the live launch readiness verdict.

An investor or advisor reading `FOUNDER.md` would conclude the product
has seven unresolved blockers — the opposite of the true state.

**Fix:** Replace the "Open items" section with the current pre-launch
checklist (operator credentials) from `RELEASE_READINESS.md`, and
change the verdict line to GREEN.

---

## MINOR

### m1 — `docs/STATUS.md` "Latest commit" field is stale after Wave 14

`docs/STATUS.md` line 9 reads:
```
Latest commit: `da593bc fix: Wave 12 reviewer criticals — schedule dep, robots.txt route groups`.
```

HEAD after Wave 14 is `9f645a1`. The field was not updated in the
docs-sync commit `a6963e4` and is now two commits stale (both `9f645a1`
and `a6963e4` are newer). Minor cosmetic issue — the wave history table
is complete and accurate.

---

### m2 — `docs/FOUNDER.md` Vitest count says 115, actual is 127

Line 112 of `FOUNDER.md`: `Vitest (115 unit)`. The live test run
produces 127 passing tests across 6 spec files (confirmed by `pnpm
test` output above). The 115 figure comes from an earlier Wave-7
snapshot.

---

### m3 — `docs/FOUNDER.md` journal categories count says 15, schema has 17

Line 26 of `FOUNDER.md`: "15 categories (Personal, 8 Prelims subjects,
6 Mains GS papers, Interview, Shared-with-mentor)". Counting:
1 PERSONAL + 8 PRELIMS_* + 6 MAINS_* + 1 INTERVIEW + 1
SHARED_WITH_MENTOR = 17 categories in the schema enum. The description
arithmetic also does not add up (1+8+6+1+1 = 17, not 15).

---

### m4 — `console.log` in `apps/api/src/main.ts` line 85

```ts
// eslint-disable-next-line no-console
console.log(`[api] listening on http://localhost:${port}`)
```

The `eslint-disable` comment shows this was intentional, but in
production this prints to stdout without going through pino (the project
logger), so it bypasses log redaction and structured JSON formatting.
Low risk (the message contains only the port, no PII), but inconsistent
with the pino setup used everywhere else.

---

## What's clean

- **Lockfile fix confirmed**: `@nestjs/schedule@4.1.2` appears at 3
  locations in `pnpm-lock.yaml` (lines 60, 2118, 10879). `apps/api/
  package.json` lists `"^4.1.0"`. The lock is consistent and
  `--frozen-lockfile` will succeed.

- **All typechecks pass**: `apps/api`, `apps/web`, `apps/mobile` — zero
  TypeScript errors. No TS6133 unused-import warnings.

- **127 unit tests pass** (6 spec files, 985 ms run).

- **PII clean**: grep over all `capture()` call sites in
  `apps/web/lib` and `apps/mobile/lib` found no phone, email, aadhaar,
  or googleSub in PostHog event props. `displayHandle` is used only as a
  UI display string (correct — it is the anonymized identity), never as
  an analytics property.

- **README accuracy**: 146 lines (under 200 limit). Quickstart ports
  (4000 API, 3030 web, 8081 Expo), file paths, and docker-compose paths
  are all valid. Wave count (13) and commit count (71) match git log.

- **FOUNDER.md**: exists, is dated, covers the real feature set.
  Production status table is accurate. Deferred items match spec.
  The "First-day operator checklist" and "Tech stack" sections are clean.

- **LOADTEST_BASELINE.md**: exists with real k6 numbers, honest failure
  analysis, script-bug root causes, and actionable recommendations.
  The result `.txt` files are committed (see M1 for the size concern).

- **`docs/CHANGELOG.md`**: Wave 9-13 entries present with correct commit
  SHAs and one-line summaries. Reverse-chronological order is correct.

- **`docs/RELEASE_READINESS.md`**: verdict is GREEN, all 15 categories
  covered, Wave-8 blocker reconciliation table is complete and accurate.

- **`SESSION.md`**: exists at `/root/Mento/SESSION.md`, contains
  up-to-date resume snapshot at `da593bc`, locked-decision table,
  wave history through Wave 13, and quick-verify commands.

- **Working-tree uncommitted changes**: 8 modified files visible in `git
  status` belong to post-Wave-14 in-progress work (per-phone throttler
  rewrite in auth, k6 script fixes for `URLSearchParams` and mirror DTO
  drift). These are Wave 15 changes and are outside the Wave 14 audit
  scope. They do not affect the committed state under review.
