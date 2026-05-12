# Mento — post-Wave-3 review (2026-05-12)

## Verdict

The codebase is in reasonable shape: anonymity is properly maintained in the main public endpoints, the FB1-3 fixes are confirmed on disk, and the API/mobile typechecks pass clean. However, **the web production build is broken** due to a TS type mismatch in `ThemeToggle.tsx` — this blocks any CI/CD deploy. There is also a PII leak in `GET /journals/:id/audit` (raw User row returned), a logic bug in the chat page (both "Pending" and "Sent" tabs show the same data), and several hardcoded Tailwind color classes that should use CSS variables.

---

## CRITICAL (must fix before promo)

### 1. Web production build fails — `ThemeToggle.tsx` TS2322

`apps/web/components/ThemeToggle.tsx` line 14–17:

```ts
const ICONS: Record<Theme, React.ComponentType<{ size?: number; className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}
```

Lucide's `size` prop is typed as `string | number | null | undefined`; the local type wants `number | undefined`. TypeScript strict mode rejects the assignment. Both `pnpm typecheck` and `pnpm build` in `apps/web` fail with TS2322 (three identical errors, one per icon). The fix is to widen the local `ComponentType` constraint or cast via `as React.ComponentType<...>`.

**Reproduction:** `cd /root/Mento/apps/web && pnpm typecheck` exits 2.

---

### 2. Journal audit log leaks raw User rows (PII)

`apps/api/src/modules/journals/journals.service.ts` line 257–262:

```ts
return this.prisma.journalAuditLog.findMany({
  where: { journalId },
  orderBy: { timestamp: 'desc' },
  take: 200,
  include: { user: { include: { profile: true } } },   // ← raw User
})
```

`JournalAuditLog.user` is the full Prisma `User` row which carries `phone`, `email`, `googleSub`, `passwordHash`, `bannedAt`, `status`. The controller at `journals.controller.ts:38` returns this unchanged to any journal participant. A mentee who shares a journal with a mentor can call `GET /journals/:id/audit` and receive the mentor's phone number (and vice versa). This is a direct violation of the non-negotiable anonymity requirement. Fix: serialize each log entry to `{ id, action, diff, timestamp, actor: { displayHandle, avatarLetter, avatarColor } }`.

---

## HIGH (should fix this week)

### 3. Chat page "Sent" tab is identical to "Pending" tab

`apps/web/app/(app)/chat/page.tsx` lines 455–456:

```ts
const pendingRequests = requests.filter((r) => r.status === 'PENDING')
const sentRequests = requests.filter((r) => r.status === 'PENDING')   // ← copy-paste bug
```

Both variables are filtered for `PENDING`. The "Sent" tab should filter for requests the current user *sent* (where the user is the mentee), not just `PENDING`. The tab showing sent-but-not-yet-responded requests will always mirror the pending-received tab count, confusing mentors who see their pending items duplicated in "Sent".

### 4. `GET /journals/:id/audit` — adjacent concern: no serialization at all

Even if the PII fields were stripped, the raw response contains every Prisma-auto-included field (relation IDs, timestamps from the User model, etc.). The controller should always return an explicit response shape on audit endpoints. Ticket this separately from the phone/email fix above since it's a defence-in-depth issue even after PII is removed.

### 5. Hardcoded Tailwind color literals instead of CSS variables

Several files use literal Tailwind blue/white classes instead of the semantic CSS token system defined in `globals.css`:

- `apps/web/app/error.tsx:32` — `bg-blue-600 hover:bg-blue-700 text-white` (should be `bg-primary text-primary-foreground hover:opacity-90`)
- `apps/web/app/(app)/dashboard/page.tsx:112-155` — `bg-blue-50/60`, `text-blue-600`, `bg-blue-600 hover:bg-blue-700` (four instances; should use `bg-primary/5`, `text-primary`, etc.)
- `apps/web/app/(app)/journals/[id]/page.tsx:240` — `text-blue-600` (should be `text-primary`)
- `apps/web/app/onboarding/role/page.tsx:84,99` — `text-blue-600`, `text-blue-500`

This breaks dark mode and theme switching because Tailwind literal `blue-600` is not affected by the `.dark` CSS variable overrides in `globals.css`.

### 6. Framer Motion imported directly in multiple client components — no lazy boundary

`apps/web/app/(app)/layout.tsx`, `apps/web/app/onboarding/role/page.tsx`, `apps/web/app/onboarding/mirror/page.tsx`, `apps/web/app/onboarding/mentor/page.tsx`, `apps/web/components/OtpInput.tsx`, and `apps/web/components/onboarding/FlashSequence.tsx` all do `import { motion } from 'framer-motion'` at the top level. Framer Motion adds ~40 KB gzipped to the initial bundle even for routes that don't animate on page-load (e.g., the bare chat thread). The `apps/web/components/motion/` wrapper components (`MotionFade`, `MotionTap`, etc.) are the right abstraction but are not used consistently — the onboarding pages and layout bypass them and import `motion` directly. No `next/dynamic` boundary separates the animation bundle.

---

## MEDIUM (next iteration)

### 7. `online` sort key is a no-op on MentorCard

`apps/web/app/(app)/mentors/page.tsx` line 115: `Number(b.online ?? 0)`. The `MentorListItem.online` property (`apps/web/components/mentors/MentorCard.tsx:23`) is typed as `online?: boolean` but the `/mentors` API response (`mentors.service.ts`) never returns an `online` field — it is always `undefined`. The "Online first" sort therefore degenerates to `localeCompare(displayHandle)`. This should either be removed or the API should wire Socket.IO presence into the response.

### 8. SHARED_WITH_MENTOR journal category absent from the journals list page

`apps/web/app/(app)/journals/page.tsx` — the `CATEGORIES` constant (lines 11–44) includes Personal, Prelims (×8), Mains (×6), and Interview, but omits the `SHARED_WITH_MENTOR` category that exists in the Prisma schema (`schema.prisma:121`). Shared journals do surface in the "Shared with mentors" section above, but users cannot manually create a `SHARED_WITH_MENTOR` entry from the list page. This may be intentional (shared journals are only auto-created by the API when a chat request is accepted) but the intent should be documented.

### 9. Unarchive button in chat page is a no-op stub

`apps/web/app/(app)/chat/page.tsx` line 362: `handleUnarchive` does nothing except `await Promise.resolve()`. The UI renders an "Unarchive" button visible to users, but clicking it fires no API call and shows no feedback. Either remove the button for MVP or wire it to an endpoint.

### 10. `console.log` in api/main.ts

`apps/api/src/main.ts:85` — `console.log('[api] listening on ...')`. A `// eslint-disable-next-line no-console` comment is present, acknowledging this is intentional, but Pino is already the structured logger. This should use `app.get(Logger).log(...)` for consistency with the rest of the codebase.

---

## LOW / nit

### 11. Hardcoded hex colors in SVG/icon/OG assets (acceptable exceptions)

`app/icon.tsx`, `app/opengraph-image.tsx`, `app/(auth)/login/page.tsx` (Google brand colours), and `app/get-app/page.tsx` all contain hardcoded hex values. These are inside SVG `fill`/`stroke` attributes and metadata APIs where CSS variables cannot apply — this is correct and should not be changed.

### 12. `themeColor: '#2563eb'` in `app/layout.tsx:48`

This is a `<meta name="theme-color">` value — hardcoded hex is correct here (browser APIs don't accept CSS variables). Not a bug.

### 13. Mentor onboarding CTA copy — "Submit for verification"

`apps/web/app/onboarding/mentor/page.tsx:294` uses "Submit for verification" which is functional but clinical. The spec philosophy is calm, not transactional. Consider "Share your journey" or a matching phrase from the copy bank. Not spec-violating, but worth reviewing against `docs/Requirement.md` Section 1.6 (mentor flow).

---

## What you got right

- **FB1 (journal upsert):** `JournalsService.upsert` correctly uses `findFirst + create/update`, not `prisma.upsert` with a nullable compound key. The comment explaining the rationale is clear. ✅
- **FB2 (mentor handle reallocation):** `OnboardingService.submitMentorOnboarding` regenerates `displayHandle` to a `Mentor_*` prefix (via `generateDisplayHandle(letter)`) on role promotion, with a 5-retry conflict loop. ✅
- **FB3 (chat empty copy):** `EmptyAllState` in the chat page correctly says "Browse mentors and send your first 160-character intro" with a "Browse mentors" button linking to `/mentors`. No "admin will assign" text. ✅
- **SEC-1 (refresh token HMAC):** `auth.service.ts` uses `createHmac('sha256', key).update(token).digest('hex')`. No bcrypt. ✅
- **SEC-2 (CSPRNG OTP):** `otp.service.ts:generate6DigitCode` uses `crypto.randomInt(100000, 1_000_000)`. ✅
- **SEC-3 (chat-request PII strip):** `chat-requests.service.ts:listForUser` explicitly serializes to `{ id, displayHandle, avatarLetter, avatarColor, hasPurpleTick }`. No raw User row returned. ✅
- **SEC-4 (Socket.IO CORS):** `chat.gateway.ts` reads `CORS_ORIGINS` from env and allowlists origins in a callback. `origin: true` is gone. ✅
- **Dev "N" badge:** `next.config.mjs` has `devIndicators: { appIsrStatus: false, buildActivity: false }`. ✅
- **API typecheck:** `cd /root/Mento/apps/api && pnpm typecheck` exits 0. ✅
- **Mobile typecheck:** `cd /root/Mento/apps/mobile && pnpm typecheck` exits 0. ✅
- **Anonymity on /mentors, /mentors/:id:** `MentorsService` strips all PII — returns only `displayHandle`, `avatarLetter`, `avatarColor`, `hasPurpleTick`. Reviews similarly anonymized. ✅
- **Anonymity on /chat conversations:** `ChatService.listConversations` serializes the counterpart to anonymous identity only. ✅
- **Anonymity on /journals:** `JournalsService.listForUser` and `getJournal` return only `{ id, displayHandle, avatarLetter, avatarColor }` for counterparts. ✅
- **GET /me:** Returns `phone` and `email` — correct, this is own-data. ✅
- **Admin PII (GET /admin/users):** Returns `phone` and `email` — correct, behind `@Roles(Role.ADMIN)` guard. ✅
- **Landing page.tsx is a Server Component:** No `'use client'` directive. `async function HomePage()` — correct. ✅
- **Journals page imports CategoryIconBadge and relativeTime:** Both imports present at lines 8-9 of `apps/web/app/(app)/journals/page.tsx`. ✅
- **Mentors page has MentorCard + search + filters + sort:** Full discovery flow correctly present. ✅
- **Copy bank matches spec philosophy:** All entries in `apps/web/lib/copy.ts` match the spec tone. No exclamation-mark tone violations in lib/copy.ts. ✅

---

## Verified against the audit

- **FB1:** ✅ `JournalsService.upsert` at `journals.service.ts:64–88` uses `findFirst + create`, not `prisma.upsert`.
- **FB2:** ✅ `OnboardingService.submitMentorOnboarding` at `onboarding.service.ts:132` calls `generateDisplayHandle(letter)` with a 5-retry loop and `Mentor_*` prefix.
- **FB3:** ✅ `EmptyAllState` in `chat/page.tsx:48–68` says "Browse mentors and send your first 160-character intro" with a link to `/mentors`.
- **Dev "N" badge:** ✅ `next.config.mjs:9` — `devIndicators: { appIsrStatus: false, buildActivity: false }`.
- **SEC-1 (HMAC):** ✅ `auth.service.ts:196–199` — `createHmac('sha256', key).update(token).digest('hex')`.
- **SEC-2 (CSPRNG OTP):** ✅ `otp.service.ts:85` — `randomInt(100000, 1_000_000)` from `crypto`.
- **SEC-7 (CSPRNG handle):** ✅ `anonymity.ts:24` — `randomInt(1000, 10_000)` from `crypto`.
