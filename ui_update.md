# UI Build Instructions — Dual-Domain Brain Tumor Segmentation Demo Portal

## Context for the agent
This is a Next.js frontend for a research demo portal that lets an authenticated user upload a brain MRI (BraTS-format T2-weighted volume), run it through two pre-trained segmentation models (a baseline and a "dual-domain" model), and view a side-by-side comparison of their predictions. This is a **research demonstration tool, not a clinical product** — that distinction must be visually and textually clear throughout the UI, not just mentioned once.

Backend inference API is a separate FastAPI service (not built here) — assume it exposes:
- `POST /api/inference` → accepts a volume file (+ optional ground truth), returns comparison image data + per-region Dice scores + processing metadata
- Auth + data persistence handled via Supabase (Postgres + Auth)

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Auth + DB:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **PDF export:** `html2canvas` + `jsPDF` (client-side only, no backend PDF generation)
- **Icons:** `lucide-react`
- **Charts (Dice score bars):** `recharts`

---

## Design System

### Color Palette
Define these as CSS variables / Tailwind theme extension — do not hardcode hex values in components.

| Token | Hex | Usage |
|---|---|---|
| `--color-primary-dark` | `#095d7e` | Header, nav, primary headings |
| `--color-primary` | `#14967f` | Buttons, links, active states, focus rings |
| `--color-surface-alt` | `#ccecee` | Card backgrounds, hover states |
| `--color-background` | `#f1f9ff` | Page background |
| `--color-success` | `#e2fcd6` | High-Dice indicators, success toasts |
| `--color-warning` | `#e0a458` | Non-critical warnings |
| `--color-danger` | `#d64545` | Errors, invalid uploads, the disclaimer banner |
| `--color-text` | `#0f2a33` | Body text (dark, derived from primary-dark for contrast) |
| `--color-text-muted` | `#5a7d85` | Secondary text, captions |

### Typography
- Use a clean, clinical sans-serif (e.g. Inter or system font stack). No decorative fonts anywhere.
- Headings: `--color-primary-dark`
- Body: `--color-text`

### Component Conventions
- All primary CTAs use `--color-primary` background, white text, rounded corners (`rounded-lg`).
- All cards: `--color-surface-alt` or white background, subtle border, soft shadow — no harsh drop shadows.
- The disclaimer banner (see below) always uses `--color-warning` or `--color-danger` background — never green/teal, regardless of where else it appears.

---

## Global Layout

- Persistent top navbar: logo/project name (left), nav links (Landing / System / History if logged in), auth state (Login button or user avatar + Logout, right).
- Footer: link to GitHub repo, brief "Research demo only" line, link to thesis/institution.
- The disclaimer text (see Page 1) should also appear as a small persistent badge/pill in the navbar on every authenticated page — not just the landing page — so a user deep in the System page is never far from the reminder.

---

## Page 1 — Landing Page (`/`)

**Purpose:** explain the project in plain terms, drive to demo, disclaim clearly.

### Sections (top to bottom)
1. **Hero section**
   - Headline: plain-language framing, e.g. "Can teaching an AI to 'hear' an MRI's raw signal help it find brain tumors more precisely?"
   - Subheadline: one sentence on what the tool does.
   - Primary CTA button: **"Try the Demo"** → links to `/system` (redirects to `/login` if unauthenticated).
   - Secondary CTA (ghost/outline button): **"View on GitHub"** (external link).

2. **Disclaimer banner** — must be visually prominent, not a small footnote.
   - Background: `--color-warning` or `--color-danger`.
   - Icon: warning triangle (`lucide-react` `AlertTriangle`).
   - Text: something like *"This is a research demonstration tool only. It is not a medical device, has not received regulatory approval, and must never be used for clinical diagnosis or treatment decisions."*
   - Place this **immediately below the hero**, before any other content — not buried at the bottom of the page.

3. **"What is dual-domain?" explainer section**
   - Plain-language, non-technical explanation (2–3 short paragraphs or a simple 3-step visual):
     1. A normal MRI picture is what your model looks at.
     2. Underneath, that picture was actually built from raw signal data (k-space) the scanner captured first.
     3. This project tests whether showing the AI *both* the picture and that raw signal helps it find tumors better than showing it the picture alone.
   - Optional: simple side-by-side illustration/diagram component (static SVG or image placeholder) showing "spatial image" vs "frequency representation."
   - Avoid jargon here — no "Fourier transform," "encoder," "Dice coefficient" in this section specifically; save technical depth for a "Learn more" expandable or a link to the thesis/paper.

4. **Key results summary (optional, light)**
   - 2–3 stat cards (e.g. "Whole Tumor accuracy improvement: statistically significant across 187 test cases") — keep numbers simple, no full stats tables here, link out to full results if you have a public report.

5. **How it works (3-step visual)**
   - Upload → Compare → Review, as a simple horizontal 3-step component with icons.

6. **Final CTA**
   - Repeat "Try the Demo" button before the footer.

---

## Page 2 — Login / Signup (`/login`, `/signup`)

**Purpose:** auth via Supabase, minimal custom UI needed.

### Requirements
- Single card, centered, on `--color-background`.
- Fields: email, password (signup: + confirm password).
- Use Supabase Auth UI helpers or build a minimal custom form calling `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`.
- Toggle link between Login ↔ Signup.
- Show inline validation errors (invalid email, weak password, wrong credentials) — use `--color-danger` text, not just a generic toast.
- On successful login, redirect to `/system`.
- Include the same disclaimer text as a small line beneath the form (short version): *"By continuing you acknowledge this is a research demo, not a clinical tool."*
- No social login required unless you want to add Google OAuth via Supabase later — keep MVP to email/password.

---

## Page 3 — System Page (`/system`)

**Purpose:** the core product. Requires authentication — redirect to `/login` if no session.

### Layout: two-panel or stacked sections

### 3.1 Upload Section
- File input 1 (required): T2-weighted volume — label clearly: *"T2-weighted MRI volume (.nii / .nii.gz)"*.
- File input 2 (optional): Ground truth segmentation — label: *"Ground truth segmentation (optional — enables Dice score comparison)"*.
- Drag-and-drop zone + fallback "Browse files" button.
- File validation feedback inline: reject wrong extension, show file name + size once accepted.
- Slice selection control: radio/toggle — "Auto (best tumor slice)" vs "Manual" (reveals a slider once a volume is uploaded and processed, if you want live preview — otherwise just pass through to backend).
- Primary CTA: **"Run Comparison"** button — disabled until required file is present. Show a loading state (spinner + "Running inference…" text, maybe with elapsed time) while awaiting the API response.

### 3.2 Results Section (appears after inference completes)
- **Four-panel image comparison**, side by side (responsive: stack on mobile):
  1. Original scan
  2. Baseline model prediction (overlay)
  3. Dual-domain model prediction (overlay)
  4. Ground truth (only if provided)
  - Consistent color legend beneath the images: Red = Whole Tumor, Teal = Tumor Core, Yellow = Enhancing Tumor. Use a small legend component reused everywhere predictions are shown.
- **Dice score comparison table/cards** (only if ground truth was provided):
  - Rows: WT / TC / ET
  - Columns: Baseline DSC, Dual-Domain DSC, Δ (with up/down arrow, colored green/red)
  - Use `recharts` grouped bar chart as a visual alternative/addition to the table.
- **Processing metadata**: inference time, device used (CPU/GPU) — small muted text row.
- **Comments/notes field**: a `<textarea>` labeled *"Notes for this session"* — saves to the `notes` column on `InferenceSession` on blur or via explicit "Save note" button. Useful for annotating a specific run (e.g. during a viva).
- **Export as PDF button**:
  - On click: use `html2canvas` to capture the results section DOM node → generate image → embed into a `jsPDF` document → trigger download.
  - Include the disclaimer text and session metadata (timestamp, filename) in the generated PDF, not just the raw comparison image.

### 3.3 History Section (`/system/history` or a tab within `/system`)
- List of past sessions for the logged-in user: timestamp, filename, quick summary (e.g. mean WT DSC if available), and a "View" button that reloads that session's stored result (no re-running inference).
- Empty state: friendly message + CTA back to upload if no history exists yet.

---

## Shared Components to Build

- `<DisclaimerBanner variant="full" | "compact" | "pill" />` — one component, three visual variants, used across Landing, System, and PDF export.
- `<ComparisonPanel images={...} legend />` — the 4-panel image grid, reused in System results and History detail view.
- `<DiceScoreTable data={...} />` — reused in results and PDF export.
- `<ColorLegend />` — small reusable WT/TC/ET color key.
- `<AuthGuard>` — wrapper/middleware redirecting unauthenticated users away from `/system` and `/system/history`.

---

## Non-negotiable UX rules

1. The disclaimer must appear on: Landing page (full banner), every authenticated page (compact pill in navbar), and every exported PDF. Never remove it to "clean up" a screen.
2. Never auto-run inference on file select — always require an explicit "Run Comparison" click, so a user can't accidentally trigger a compute-heavy request.
3. Ground-truth-dependent UI (Dice scores) must gracefully hide, not error, when no ground truth is supplied.
4. All error states (bad file format, backend failure, timeout) must show a clear, human-readable message using `--color-danger` — never a raw stack trace or generic "Something went wrong."