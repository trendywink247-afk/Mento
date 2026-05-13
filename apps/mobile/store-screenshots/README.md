# Mento — Store Screenshot Specification

> Designer task. This file enumerates which screens to capture and at which sizes.
> Do NOT generate or fake images. Capture from a real device or Expo simulator.
> All screenshots must respect the anonymity constraint — no real names, no photos.
> Use the letter-avatar system as it appears in the app (single letter, colored tile).

---

## Required Sizes

| Platform | Size (px) | Aspect | Minimum | Maximum | Notes |
|---|---|---|---|---|---|
| iPhone 6.7" (Pro Max) | 1290 × 2796 | 9:19.5 | 3 | 10 | Required for App Store |
| iPhone 5.5" | 1242 × 2208 | 9:16 | 3 | 10 | Required for App Store |
| iPad 12.9" | 2048 × 2732 | 3:4 | 3 | 10 | Required only if iPad is supported (currently supportsTablet: false — skip unless we add tablet support) |
| Android phone | 1080 × 1920 | 9:16 | 2 | 8 | Required for Play Store |
| Android tablet | 1600 × 2560 | 10:16 | 2 | 8 | Optional — skip for MVP |

---

## Screens to Capture (in order — use this sequence for both iOS and Android)

### Screenshot 1 — Landing / Emotional welcome flash
**Screen**: Onboarding screen 1.1 — the full-screen emotional welcome  
**Text overlay (if added by designer)**: "A safe place. A place for guidance. A place to be yourself."  
**Notes**: Dark background with the Mento wordmark and a slow fade-in. Captures the brand mood.

---

### Screenshot 2 — Role pick
**Screen**: Pre-auth role selection  
**Text overlay**: "Are you an aspirant or a mentor?"  
**Notes**: Show both cards (Aspirant / Mentor) clearly. This is the first interactive screen users see.

---

### Screenshot 3 — Mentor list (discovery)
**Screen**: Mentors tab, populated with 4–6 mock mentor cards  
**Text overlay**: "Find your mentor. Anonymously."  
**Notes**: Use letter avatars only. Show the filter chips (Online, Prelims, Mains, Language). Show purple ticks on 2–3 cards. No real names — handles only (e.g. "A", "M", "P").

---

### Screenshot 4 — Mentor profile
**Screen**: Individual mentor profile expanded  
**Text overlay**: "Real journeys. Real guidance."  
**Notes**: Show year-by-year UPSC timeline, guidance categories, languages. Two CTAs visible: "Request for Chat" and "Request 1-on-1 Session". Purple tick visible. Letter avatar prominent.

---

### Screenshot 5 — Chat (active conversation)
**Screen**: Open chat thread between aspirant and mentor  
**Text overlay**: "Talk freely. Stay anonymous."  
**Notes**: Show the persistent safety banner at top ("Please avoid sharing personal details."). Show a few messages in both bubbles. No identifying information in message content — use UPSC-relevant mock content ("How did you manage current affairs in your third attempt?").

---

### Screenshot 6 — Chat — 160-char intro request
**Screen**: The intro request composer modal  
**Text overlay**: "160 characters. That's all you need."  
**Notes**: Show the character counter. Show the send button. Capture the simplicity of the entry point.

---

### Screenshot 7 — Journal categories
**Screen**: Journals tab, category grid visible  
**Text overlay**: "Your journey, documented."  
**Notes**: Show all category tiles: Personal, Prelims sub-subjects, Mains GS papers, Interview, per-mentor. Grid layout clearly visible.

---

### Screenshot 8 — Journal entry (per-mentor shared)
**Screen**: Open shared journal in edit mode (both users online indicator visible)  
**Text overlay**: "Shared notes. Built together."  
**Notes**: Show the "Both online — editing enabled" indicator. Show a journal entry with some UPSC-relevant mock text. Show the lock icon in read-only state for contrast (optional — second variant).

---

### Screenshot 9 — Profile / Pricing tiers
**Screen**: Profile tab showing subscription tier and upgrade options  
**Text overlay**: "Invest in guidance. Not just content."  
**Notes**: Show the three tiers (Basic ₹399, Pro ₹599, Max ₹999) with feature lists. Current tier highlighted.

---

### Screenshot 10 — Mentor home (Chats tab with pending requests)
**Screen**: Mentor's Chats tab showing incoming aspirant intro requests  
**Text overlay**: "Give back. Anonymously."  
**Notes**: Show 2–3 aspirant request cards with letter avatars. Show the archive tabs (Pending / Active / Archived). This is the mentor POV and differentiates the two-sided nature of the app.

---

## Production Checklist Before Submission

- [ ] All screenshots use letter avatars — no real faces, no real names.
- [ ] No phone numbers, emails, or personal data visible in any mock content.
- [ ] Purple tick appears on verified mentor cards in screenshot 3 and 4.
- [ ] Safety banner is visible in screenshot 5 (the chat screenshot).
- [ ] App name "Mento" appears in at least one screenshot.
- [ ] Screenshots are exported at the correct px dimensions (no upscaling).
- [ ] Rounded corners on iPhone frames should be applied at the device-frame stage, not in the raw export.
- [ ] Localized variants: English (India) is the primary locale. Add Hindi if resources allow.

---

## Tools Recommended

- **Expo Orbit** — connect simulator to Expo dashboard for clean screenshots.
- **Rottenwood / Previewed** — add device frames and optional text overlays.
- **Figma** — compose the final store-ready assets with overlay text and brand colors.

---

## Naming Convention for Files

```
{platform}-{size}-{number}-{screen-slug}.png

Examples:
iphone-67-01-landing.png
iphone-55-03-mentor-list.png
android-phone-05-chat.png
```

Place final assets in this directory (`apps/mobile/store-screenshots/`) before upload.
