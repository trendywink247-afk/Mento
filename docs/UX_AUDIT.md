# Mento — UI/UX Audit vs international B2C bar

> Audit date: 2026-05-11. Target: 10M MAU in 3 months. Reference apps: WhatsApp, Stripe, Linear, Notion, Calm, Headspace, Cred.
> Captured via Playwright Chrome 1.59 — screenshots in `apps/web/e2e/ui-screenshots/`.

## Verdict

**Not on par.** What's there works and is calm/legible. But for a 10M-MAU promo push it ships flat — no motion, no hero asset, no trust signals, no logo, generic copy where the philosophy bank should sing. Roughly **60% of the way to international B2C bar**. I'm listing every gap; you decide which to close before promo.

There's also one **functional regression** caught visually (journal click silently doesn't navigate). And several copy/anonymity bugs the test surfaced. Those are bugs, not polish — I'd close those before any animation work.

## Severity legend

- **B (Blocker)** — would lose users in funnel or breach trust on launch day
- **H (High)** — visibly amateur next to Stripe/Linear, lowers conversion
- **M (Medium)** — polish that converts well-but-not-great → great
- **L (Low)** — nitpick / brand-builder

---

## Page-by-page findings

### 1. Landing `/` (screenshot `01-landing.png`)

**What's there:** Centered wordmark + 50-word paragraph + blue "Get started" + "Already a member? Sign in" + footer tagline.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| L1 | B | Next.js dev-tools "N" badge in bottom-left is visible. Will leak to production if not disabled. | Add `devIndicators: { buildActivity: false, appIsrStatus: false }` to `next.config.mjs`, or rely on `process.env.NODE_ENV === 'production'` to hide. |
| L2 | H | No logo / brand mark — "Mento" is just the word in Geist/system font. | Commission a wordmark (or generate one) — a single SVG, ~2 days designer work. Make a `<Logo />` React component. |
| L3 | H | No social proof above the fold. Aspirants who land here have no reason to trust an anonymous platform. | Add: live mentor count (`{n} verified mentors`), aspirants-helped count, 2-3 anonymized testimonials, a press strip if any. |
| L4 | H | No "how it works" / value-prop section. Visitors need to scroll through 3 micro-steps that say what happens. | 3-column band: "Tell us where you are → Match anonymously → Walk together." 1 illustration per column. |
| L5 | H | No mentor preview. The product IS its mentors — show 4-6 anonymous letter-avatar cards with mini-bios. | Render `<MentorPreviewStrip>` pulling 6 verified mentors via `/mentors?isVerified=true&limit=6`. |
| L6 | H | No FAQ. UPSC aspirants are skeptical. | FAQ accordion: "How is this anonymous?" "Is this a coaching institute?" "How are mentors verified?" "What does it cost?" |
| L7 | H | No footer. No privacy/terms/contact links → fails Play Store / App Store policy + Indian regulatory hygiene. | Footer with: About · Privacy · Terms · Refund · Contact · Twitter/X · LinkedIn · "Made in India" badge. |
| L8 | M | Body copy is too long for hero (3 lines). Hero copy in best-in-class B2C is 1-line punch + 1-line subhead. | "Walk the UPSC path with someone who's been there." + "Anonymous, verified mentors. No coaching pitch." |
| L9 | M | "We honour the struggle" tagline at the bottom — beautiful copy, but invisible at fold. | Move it under the hero or use it as a header strip. |
| L10 | M | No hero illustration / video / Lottie. Pure type-on-white feels under-loved for an emotional product. | Subtle Lottie of two letter-avatars drifting together, or a calm gradient mesh, or a still photograph of a desk/sunrise (no faces, anonymity-safe). |
| L11 | L | "Get started" button: solid blue, no hover state captured. No microinteraction. | `transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]`. Add a `→` arrow that slides on hover. |

**Reference bar:** [stripe.com](https://stripe.com), [linear.app](https://linear.app), [headspace.com](https://headspace.com).

---

### 2. Role pick `/onboarding/role` (`02-role-pick.png`)

**What's there:** Two stacked card buttons "I'm preparing for UPSC" / "I'd like to mentor" + hint at bottom.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| R1 | M | Cards are visually identical — left side has no iconography to differentiate Aspirant vs Mentor. | Add a small illustration / icon on the left of each card (an open book vs a lit candle, for instance). |
| R2 | M | No "Back" affordance — once on `/onboarding/role`, you can only commit forward. | Top-left chevron back to `/`. |
| R3 | M | Welcome flash is gated on this click. Some users might want to skip the flash. | Add a `?skipIntro=true` query param the flash respects; or remember "seen before" in localStorage so returning users skip. |
| R4 | L | The hint "You can be both later. Pick what brought you here." is informational gold — make it bolder. | Render it inside a soft bubble with an info icon. |
| R5 | L | Tagline "We honour the struggle" repeats on both this and the landing. Without a logo, it's the brand surface — keep it but pair it with the wordmark consistently. | Place under a real logo once one exists. |

---

### 3. Welcome flash `/onboarding/welcome` (`03-welcome-flash-1.png`)

**What's there:** Single line of copy ("This is a safe place.") centered, fades in/out over ~1.5s per line, 8 lines total.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| W1 | H | Total duration of the flash is ~12s before the user reaches the login form. That's a long wait for a return visitor and even a new one with weak attention. | Default to 800ms/line (6s total) and let users tap to advance. Also: skip on subsequent visits via localStorage flag. |
| W2 | M | No progress indicator — user doesn't know how long this will go on. | Subtle dot row at the bottom: `· · · ● · · · ·` (current step lit). |
| W3 | M | Each line floats alone in space — no atmosphere. | Add a subtle background motion: a slow horizontal gradient drift, or a single ember/light, or breath-in-breath-out animation. Lottie or pure CSS. |
| W4 | M | Typography is system-sans — beautiful copy deserves a serif or a hand-picked sans for emotion. | Pair with Inter Display / Söhne / DM Serif for hero phrases. |
| W5 | L | No way to opt out of the flash for screen-reader users. | Wrap in `<section role="region" aria-live="polite">` with a "Skip introduction" button. |

---

### 4. Login `/login` (`04-login-empty.png`)

**What's there:** Card with "Mento" + "UPSC mentorship" header, phone input pre-filled with `+91`, helper text, "Send OTP" CTA.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| L1' | H | No Google sign-in option. Spec section 1.5 says Mobile + Google. India users sign in with Google constantly. | Add Google OAuth button above the phone input (Phase J in the plan — bring it forward). |
| L2' | H | The card sits inside a giant white void. On a 1440-tall screen there's >50% empty space. | Reduce vertical centering or add a left-side panel with the philosophy copy + a stat badge. |
| L3' | M | No country flag/picker on the phone input. Users could be NRI or visiting; locking to +91 is fine but should be visible. | Read-only flag chip with India tricolor inside the input. |
| L4' | M | "We'll send a 6-digit code by SMS" — but spec says SMS costs ₹0.15 per OTP and 10M users at even 2 attempts each = ₹3L+ in OTP costs. Set expectations / mitigate. | Add: "By continuing you agree to Terms & Privacy" and a checkbox for marketing-WhatsApp consent (DLT compliance friendly later). |
| L5' | L | Header card is named "Mento" + "UPSC mentorship". This is the only place we describe the product to a logged-out user mid-funnel — easy to skim past. | Add a single trust line: "10,000+ aspirants. Verified mentors." |

---

### 5. Login error state (`05-login-error-bad-phone.png`)

**What's there:** Below the input, red text "Phone must be in E.164 format e.g. +911234567890".

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| E1 | H | Error message uses "E.164" — that's RFC terminology, not user language. | "Please enter a 10-digit Indian mobile number (e.g. +91 98765 43210)." |
| E2 | M | Input ring stays neutral; only the message turns red. | Mirror the error onto the input: `aria-invalid`, red ring, slight shake animation. |
| E3 | M | No live validation — error only appears on submit. | Validate on blur and on next keystroke after the first invalid submit. |

---

### 6. OTP entry `/otp` (`05b-otp-empty.png`)

**What's there:** Card with title, phone shown, single input with `123456` placeholder, "Verify & sign in" disabled until 6 digits, "Use a different number" link.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| O1 | H | Single text input — not the 6-box segmented OTP UI that WhatsApp/Stripe/Razorpay use. | Build a 6-cell `<OtpInput>` with auto-focus advance, paste support, backspace handling. (~1 day) |
| O2 | H | No "Resend OTP" countdown. Indian carriers occasionally drop the first SMS. | "Resend in 30s" → "Resend OTP" after 30s. The api already rate-limits at 3/hour/phone. |
| O3 | H | No auto-detect OTP. On Android Chrome, `autocomplete="one-time-code"` + `inputmode="numeric"` enables Web OTP API. | Add both attributes to the input + opt into the Web OTP API; auto-fills the SMS on Pixel/Samsung. |
| O4 | M | The phone is shown as `+91999...` — no edit affordance visually next to it. | Phone chip with a small pencil icon → goes back. |
| O5 | M | "Use a different number" is muted-foreground link. Should be a button-styled secondary action. | Same height/weight as the primary CTA, secondary style. |

---

### 7. Mirror — journey step (`07-mirror-journey.png`)

**What's there:** 9 stacked option buttons, one selected gets a slight bg, blue "Next" button.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| M1 | H | No progress indicator. The Mirror is a 7-step wizard but users don't know that. Drop-off risk is high. | Add a progress bar / "Step 3 of 7" label at the top. |
| M2 | H | The selected state is a faint background tint — easy to miss. | Add a clear left-side indicator (a vertical blue stripe), bolder border, or a checkmark on the right. |
| M3 | M | "Have written Mains" — the row that's selected — sits 7 entries down. The form is information-dense vertically. | Use a 2-column grid on screens ≥1024px. |
| M4 | M | No "Save and finish later" anywhere in the wizard. | Save progress to API on each step (you already track `OnboardingEvent`); add a "Save & finish later" link that emails/SMS the resume link. Critical for completion rate. |
| M5 | L | "Where are you in your journey?" — could be warmer per the philosophy bank. | "Let's place you on the map." or "Where are you right now?" |

---

### 8. Mirror — knowledge sliders (`10-mirror-knowledge.png`)

**What's there:** 11 native HTML `<input type="range">` sliders, all defaulted to ~30% with "Just started" label.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| K1 | H | Native HTML range sliders look like a system widget. International B2C apps **never** ship native range. | Custom slider built on Radix Slider / a Tailwind track. Add a soft shadow on the thumb. Or replace with a 5-step segmented control (faster, more honest). |
| K2 | H | All sliders default to the same value — looks fake when submitted. | Default to 0% ("No idea") so users have to engage with each. |
| K3 | M | Label "Just started" doesn't change as you drag — only at thresholds. Wait, looking again it does. OK but the threshold copy is bland. | Replace with: "Haven't opened the book" / "Read once" / "Comfortable" / "Could teach this" / "Strong" — language that respects the struggle. |
| K4 | M | 11 sliders is a lot for one screen. Some users will tap through without thinking. | Group into "Polity & History" / "Geography & Environment" / "Sci-Tech & Economy" / "Essay & Ethics" / "Current Affairs"; 2-3 sliders per group, accordion-collapsible. |
| K5 | L | "Drag each slider — be honest." is the entire instruction. Could lean harder into the philosophy bank. | "There's no right answer. Lower is safer than higher — we'll show you what to study, not judge you." |

---

### 9. Mirror — challenges (`11b-mirror-challenges-selected.png`)

**What's there:** 12 chip-style buttons in a wrap layout, 3 selected (blue solid).

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| C1 | M | Selected chips are solid blue, unselected are white-with-border. Good visual hierarchy. Minor: hover state not captured. | `hover:border-primary/40 hover:bg-primary/5` for unselected, slight ripple on click. |
| C2 | M | No selected counter. Users don't know if there's a min or max. | "Pick all that apply. Minimum 1." + live count badge: "3 selected". |
| C3 | L | Chips wrap into an awkward 3-2-3-2-2 layout. | Force consistent rows via `grid-cols-3` on md+ — even visual rhythm. |

---

### 10. Dashboard `/dashboard` (`13-dashboard.png`)

**What's there:** Sidebar with "Mento" + handle + role + Sign-out; main has "Welcome", profile card with letter avatar, and a muted "your conversations will appear in chat" note.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| D1 | B | **The dashboard is empty.** No suggested mentors, no journal prompt, no daily nudge, no streak, no next-step CTA. For 10M users this is the first thing they see post-onboarding — it must lead them. | Three cards: "Browse mentors that match your Mirror →", "Start today's journal entry →", "Read what other aspirants reflected on this week". Plus a sticky right-rail with a tiny streak / activity widget. |
| D2 | H | Sidebar logo is just "Mento" in bold. No avatar tile next to handle. Inconsistent with the rest of the app. | Add `<LetterAvatar size={32}>` left of the handle. Group `Mento` brand at the top, then the user identity card below. |
| D3 | H | "Welcome" headline — no name, no warmth. | "Welcome, {displayHandle}." Then a sub-line: "It's good to see you again." (uses the philosophy register.) |
| D4 | M | No header — page jumps straight from sidebar to title. | Slim top bar with notification bell, settings, sign-out (move sign-out out of sidebar). |
| D5 | M | Sidebar is monochrome — no current-page indicator other than slightly different bg on "Dashboard". | Add a 3-px left accent bar on the active item + filled icon vs outlined. |
| D6 | M | "Sign out" sits at the bottom of the sidebar with a border — orphaned. | Move into a small user-menu popover triggered from the avatar in the top-right header. |
| D7 | L | Letter avatar in the profile card is `B / SLATE` — defaulted-beginner. The placeholder text says "ASPIRANT · joined 5/11/2026" — handle "Aspirant_2311". Looks lifeless. | Show a journey progress: "Where you are: One year in" + "Mirror complete" badge. |

---

### 11. Journals categories `/journals` (`21-journals-categories.png`)

**What's there:** Personal section, then Prelims (8 cards in a 3-col grid), then Mains (6 cards), then Interview (1 card). All cards say "Start your first entry".

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| J1 | B | **Personal journal button doesn't navigate.** Click in the test stayed on the same page (see `22-journal-detail-empty.png` — same as 21). The "1 Issue" Next.js badge appears, suggesting a runtime error in the click handler / upsert. | Investigate `journals.upsert(category)` — likely the unique compound `(ownerId, category, conversationId)` fails when `conversationId` is null because Postgres treats nulls as not-equal-to-each-other in unique constraints. Need to either coalesce or restructure the constraint. **Fix before any other journals work.** |
| J2 | H | No icon per category. Polity vs History vs Economy looks identical — easy to misclick. | Tiny icon mark per category (a column for Polity, a quill for Essay, etc. — Lucide icons are free). |
| J3 | H | No entry counts visible. Just "Start your first entry" everywhere. | "0 entries · last updated 5 minutes ago" — even empty states should show that the page is alive. |
| J4 | M | Group labels are tiny muted gray. Could be slightly more emphatic. | Section header with a thin underline + count: "Prelims (8)". |
| J5 | L | "Reflect privately, or together with a mentor." — under-uses the philosophy. | "Where you write down what you can't tell anyone else. Some pages stay with you. Others, you and your mentor write together." |

---

### 12. Chat empty state `/chat` (`24-chat-empty.png`)

**What's there:** "No conversations yet. An admin will assign you a mentor or aspirant soon."

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| Ch1 | B | **Copy is wrong.** Spec section 1.7-1.8: mentees browse mentors and send 160-char chat requests. Admin doesn't assign. This copy is from the legacy Phase 2 flow. | "No conversations yet. → Browse Mentors and send your first intro." (CTA button → /mentors) |
| Ch2 | H | Empty state has zero illustration / icon / personality. WhatsApp's empty state shows the lock icon + "Your messages are private". | A single soft illustration (chat bubble), one warm line of copy, one prominent CTA. |
| Ch3 | H | No tabs for the request lifecycle. Spec section 1.7 calls for WhatsApp-style "sent / pending / archived / unanswered". Not built yet. | Tabbed top-bar inside `/chat`: All · Pending · Archived. Each tab shows its empty state with role-specific copy. |
| Ch4 | M | "Chats" in the sidebar — make sure the count badge shows unread once chat lands. | Sidebar item supports `{label} <Badge>{unread}</Badge>`. |

---

### 13. Mentors list `/mentors` (`25-mentors-empty.png`)

**What's there:** 2-column grid of mentor cards with letter avatar, handle, journey, guidance categories, rate, languages. Top has "Verified only" / "Interview-attempted" filter chips.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| Me1 | B | **Mentor handles say `Aspirant_2779` etc.** When a user submits mentor onboarding, role flips ASPIRANT→MENTOR but the display handle stays. This breaks anonymity intent. | In `submitMentorOnboarding`, reallocate handle: `Mentor_M_NNNN` based on new letter. Migration: scan existing mentors and re-issue handles. |
| Me2 | H | "Mains · 1×" then below "Mains · Essay" — confusing repetition. Top is journey ("attempted Mains once"), bottom is guidance categories. | Reword: "Mains · written 1 time" + a separate row labelled "Guides: Mains, Essay". Or use icons. |
| Me3 | H | No reviews count, no mentees-helped count, no online dot. Spec section 1.8 says default sort by online + metrics on profile. | Card metrics row: `12 mentees · 88 chats · 4 sessions`. Plus online presence indicator (green dot). |
| Me4 | H | Filter chips don't show selected state strongly. Could miss that "Verified only" is active. | Active chips: solid primary background; inactive: subtle border + muted text. |
| Me5 | H | No search input. With 100+ mentors, no way to find by handle/optional/rate. | Search bar at top + dropdown filters (Optional subject, Language, Rate band) — Stripe-style. |
| Me6 | M | All cards look identical because seed data is uniform. In production, mentor cards need a stronger differentiator. | Lift one detail to a tagline ("Cleared in 2023 · Rank 142") — the most useful "is this person credible" line. |
| Me7 | M | ₹500/hr is shown but no indication this is for 1:1 sessions (chat is free). Will confuse. | Pill: "Chat free · 1:1 ₹500/hr". |
| Me8 | L | No mentee → mentee cross-pairing (mentors don't see other aspirants in /mentors). That's fine per spec. | Confirm spec — mentors have a "Mentees" tab instead per spec 1.6. |

---

### 14. Get-app `/get-app` desktop view (`40-get-app-desktop.png`)

**What's there:** Single message "Mento works best as an app" + 2 dark/green store buttons + "Open this page on a desktop browser..."

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| G1 | H | Wait — this is the DESKTOP view! Why is anyone seeing this on desktop? It's the mobile-redirect target. On desktop a user should not normally reach it. | Either: don't expose at all on desktop, OR if a desktop user finds it, show: "You're on a desktop — go back to the web app" with a return link. |
| G2 | H | The store buttons are generic — not the official Apple / Google badges. App-store reviewers will reject if the official badges are not used. | Use the licensed App Store + Play Store badges (free, brand-compliant). |
| G3 | M | No QR code. The fastest path is: user is on a friend's laptop, wants to install — scans the QR with their phone. | Add a QR linking to a smart `mento.app/install` URL that detects platform and forwards to store. |
| G4 | L | No screenshot of the app. Users don't know what they're installing. | 3-screenshot carousel showing chat, mentor profile, journal entry. |

---

### 15. Mobile UA → `/get-app` (`50-mobile-get-app.png`)

**What's there:** Same content as desktop, scaled to a Pixel 8 viewport. Readable.

**Gaps:**

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| MR1 | H | Same as G1-G4. On mobile this IS the intended landing → must be polished. | Hero illustration, then the two store buttons sized for thumb. App Store badge top, Play Store below for India (Android dominant). |
| MR2 | M | Above-the-fold space (the white band above "Mento works best as an app") is wasted. | A small Mento logo at the top + a 1-line manifesto. |
| MR3 | L | Footer empty space could carry "Already have the app? → Open" deep-link. | Universal links / App Links button that, if app is installed, opens it directly. |

---

## Cross-cutting B2C bar gaps

These apply across every screen.

| # | Severity | Observation | Recommendation |
|---|---|---|---|
| X1 | H | **Zero animations anywhere.** No fade, no slide, no spring. The spec section 1.3 explicitly calls for "Movement everywhere — static = dead." | Adopt Framer Motion. Apply `motion.div` with subtle fade+slide on page mount; `whileTap={{ scale: 0.97 }}` on all buttons; `layout` animation on tab switches. ~1.5 days. |
| X2 | H | **No skeleton loaders.** Pages just flash empty until data lands. | Skeleton card variants for: dashboard cards, mentor cards, journal entries, chat list rows. ~0.5 day. |
| X3 | H | **No haptics on web** — fine. **No focus rings visible on hover/tap** — they're there in CSS but very subtle. | Strengthen `--ring` from `221 83% 53%` to high-contrast pairing; add `focus-visible:outline-2 outline-offset-2` on all interactive components. |
| X4 | H | **No iconography.** Sidebar nav, journal categories, mentor cards — all text-only. Lucide is already in deps. | Add icons to sidebar items, category cards, filter chips, action buttons. Visual scanning improves dramatically. |
| X5 | H | **Typography is fully system-sans.** International B2C apps almost universally ship with a chosen font (Inter, Manrope, Söhne). | Add Inter via `next/font` + Inter Display for headings. Type-scale tokens: `text-display`, `text-title`, `text-body`. |
| X6 | H | **No dark mode.** Hard requirement for B2C in 2026 — many users only run dark. | Already have a `.dark` selector in CSS — define the palette and add a system-preference auto-toggle + manual override. |
| X7 | H | **No PostHog SDK actually loaded.** Onboarding events are persisted to `OnboardingEvent` table only. The 10M-MAU growth plan needs real product analytics. | Phase J — wire PostHog cloud or self-hosted, capture `$pageview`, `$identify` after login, and funnel events. |
| X8 | H | **No Sentry runtime initialization.** Errors die in console. At 10M MAU you'll get hundreds of crash reports/day. | `Sentry.init` in api `main.ts`, web `instrumentation.ts`, mobile root layout. |
| X9 | H | **No i18n scaffolding.** UPSC is multilingual (Hindi, Tamil, Malayalam) — retrofitting i18n later costs 3× more than building it in from day 1. | Add `next-intl` now; wrap every string in `t('key.path')`. Ship English-only but the plumbing's there. |
| X10 | H | **No accessibility audit.** Tab order, ARIA, screen-reader labels not verified. | `axe-playwright` integration in the existing test suite; aim for 0 critical violations. |
| X11 | M | **No empty-state illustrations** anywhere. Every "no data yet" is plain text. | Commission or pull a free illustration set (unDraw, Storyset). One per empty state. |
| X12 | M | **No microcopy bank.** Errors, button labels, hints — each written ad-hoc. | Move all strings to `lib/copy.ts` (some already there). Single source of truth for tone. |
| X13 | M | **Page transitions are hard navigations.** Even SPA Next.js, /journals → /journals/[id] feels janky. | Use Next.js client navigation with `<Link prefetch />` for all internal routes. Loading state via `loading.tsx` files. |
| X14 | M | **The dev-tools "N" badge** in bottom-left appears in every screenshot. | `next.config.mjs` → `devIndicators: false` or environment-gate. |
| X15 | M | **No keyboard shortcuts.** Power users (mentors, admins) won't get any. | `cmd+K` command palette later; for now `?` shows shortcuts. |
| X16 | L | **No favicon set.** Default Next.js favicon. | Generate a Mento favicon set (192, 512, maskable, apple-touch). |
| X17 | L | **No OpenGraph / Twitter card images** for share previews. | Set up `app/opengraph-image.tsx` with dynamic OG image per page. Critical for organic share-driven growth. |

---

## Functional bugs caught visually (must-fix-before-promo)

| # | Severity | Bug | Fix sketch |
|---|---|---|---|
| FB1 | **B** | `/journals` Personal click does not navigate; runtime error in upsert handler. | Likely Prisma `unique([ownerId, category, conversationId])` fails with `conversationId=null`. Test the SQL path locally. Two fixes: (a) use `findFirst({ where: { ownerId, category, conversationId: null } })` then `create`, OR (b) split into "personal" vs "shared" tables. Pick (a) for MVP. |
| FB2 | **B** | Mentors keep `Aspirant_NNNN` handles even after promotion to MENTOR. | In `submitMentorOnboarding`, regenerate handle via `generateDisplayHandle(letter)` and update Profile. Plus a backfill script for existing accounts. |
| FB3 | H | Chat empty state copy ("admin will assign you a mentor") contradicts the actual product flow (mentees discover + request). | Replace with "No conversations yet. Browse mentors to send your first intro." + CTA → /mentors. |
| FB4 | H | Mentor profile detail page wasn't reachable in the tour because the mentor list was full of `Aspirant_NNNN` handles — but the bigger issue is that the handle bug breaks discoverability. | Fix FB2 first. |
| FB5 | H | The Zustand-hydration race I fixed during the tour: refreshing any `(app)` page would bump users to `/login` briefly. I already shipped a `hasHydrated` gate but it should be QA-tested across all routes. | Run a Playwright test that refreshes `/dashboard`, `/journals/[id]`, `/admin/users` and asserts URL stays. |

---

## Effort estimate to close all H+B items

| Item | Effort |
|---|---|
| Landing rebuild (logo, hero, value props, social proof, FAQ, footer) | 4 days |
| Welcome flash polish + skip + reduce duration | 0.5 day |
| Login: Google OAuth + segmented OTP input + Web OTP API + resend countdown | 2 days |
| Mirror: progress indicator + custom slider + segmented controls + step copy | 2 days |
| Dashboard: 3 next-step cards + header + sidebar polish | 1.5 days |
| Mentors: search + filters + metrics + online dot + handle bug | 2 days |
| Chat: tabs (sent/pending/archived) + correct empty copy + illustration | 1.5 days |
| Get-app: official badges + QR + screenshot carousel | 1 day |
| Framer Motion across app + skeletons | 1.5 days |
| Iconography pass (Lucide) | 1 day |
| Typography (Inter via next/font + scale) | 0.5 day |
| Empty-state illustrations (unDraw) | 1 day |
| Dark mode toggle + tokens | 1 day |
| PostHog + Sentry wiring | 1 day |
| Functional bugs FB1-FB5 | 1.5 days |
| Accessibility pass (axe + manual) | 1.5 days |
| **Total** | **~22 dev-days** (≈ 4.5 weeks single eng, ~2.5 weeks two engs) |

---

## My recommendation for the 10M-MAU push, ranked

If I had to pick a minimum viable polish set BEFORE you spend on paid promo:

1. **Fix FB1-FB5** (functional bugs). Non-negotiable.
2. **Landing rebuild.** Single biggest acquisition lever — this is what paid traffic hits first.
3. **Onboarding progress indicators + skip flash.** Drop-off in onboarding is the funnel-killer.
4. **Segmented OTP input + Web OTP API.** India auth conversion lever.
5. **Dashboard "what's next" cards.** Without them, post-onboarding silence kills retention.
6. **Chat tabs + correct empty copy.** Until this is right, the entire product flow can't run.
7. **Iconography + typography + skeletons.** The "feels expensive" delta. Cheapest win-per-day of work.
8. **PostHog + Sentry.** Can't measure or fix what you don't see.

Everything else (animations, dark mode, illustrations, i18n) is iteration-2 territory — ship the above first, watch funnel data for 7 days, then double down on whichever step bleeds users.

---

## Files captured

All under `apps/web/e2e/ui-screenshots/`:

```
01-landing.png                  Landing — empty marketing
02-role-pick.png                Pre-auth role pick
03-welcome-flash-1.png          Welcome flash mid-cycle
03-welcome-flash-2.png          Welcome flash 2nd phrase
04-login-empty.png              Login form empty
05-login-error-bad-phone.png    Phone format error
05b-otp-empty.png               OTP entry empty
06-mirror-intro.png             Mirror title screen
07-mirror-journey.png           Journey-stage picker
07b-mirror-journey-selected.png Journey selected
08-mirror-background.png        Background picker (beginner branch)
09-mirror-reflection.png        Honest-reflection screen
10-mirror-knowledge.png         11 knowledge sliders
11-mirror-challenges.png        Challenges multi-select
11b-mirror-challenges-selected.png  Challenges with 3 selected
12-mirror-privacy.png           Privacy notice
13-dashboard.png                Post-Mirror dashboard (sparse)
20-dashboard-loaded.png         Dashboard via separate session
21-journals-categories.png      Journal categories grid
22-journal-detail-empty.png     (Actually the same screen — FB1 bug)
24-chat-empty.png               Chat empty state (wrong copy)
25-mentors-empty.png            Mentors list with handle bug
30-mentor-welcome.png           Mentor philosophy screen
31-mentor-journey.png           Mentor wizard step 1
40-get-app-desktop.png          Get-app page (desktop)
50-mobile-get-app.png           Pixel 8 viewport hitting /
```
