# MedScribe UI Overhaul Proposal (Clinical Luxe)

## Document Control

**Version:** 1.0  
**Date:** February 7, 2026  
**Owner:** Product Design (UX/UI)  
**Status:** Implementation Spec

---

## 1) Objectives and Scope

### Primary Objectives

- Improve ease of use for physicians during live encounters.
- Increase readability for transcript and note-review tasks.
- Deliver a premium visual feel while preserving clinical trust.
- Use screen space more effectively without creating visual overload.

### In Scope

- End-to-end UI rework direction.
- Detailed proposal for three priority screens:
  - Home
  - Encounters
  - Transcribe
- Mobile-first behavior (recording on phones).
- Desktop behavior for post-visit copy/edit workflows.
- Motion and interaction guidelines.

### Constraints and Assumptions

- Keep current purple primary color.
- No fixed brand system; typography and complementary colors are open.
- Note generation happens only after visit completion and full audio processing.
- Product references: Nabla, Vero Scribe.

---

## 2) Persona and Core Jobs-To-Be-Done

## Persona: Practicing Physician

**Context:** Time-constrained, high cognitive load, often multitasking in clinic rooms.  
**Primary Device Modes:**

- Mobile: capture encounter in real time.
- Desktop: review, copy, and edit generated SOAP notes.

**Top Jobs-To-Be-Done**

- Start recording with confidence in one action.
- Monitor capture/transcription state with minimal attention.
- Quickly find and reopen past encounters.
- After processing, review and finalize notes with strong readability.

**Design Implications**

- Clear hierarchy and predictable placement of critical actions.
- State visibility at all times (recording, paused, uploading, processing, ready).
- Dense but scannable information blocks.
- Reduced decision fatigue via progressive disclosure.

---

## 3) Experience Principles (Clinical Luxe)

1. **Calm Authority**: Interface communicates confidence and precision.
2. **Density with Discipline**: More information on screen, but grouped and rhythmically spaced.
3. **Readability First**: Large text surfaces use strict typography rules and line-length control.
4. **Single-Task Dominance**: At any moment, one action is visually dominant.
5. **State Transparency**: System status is always visible and never ambiguous.

---

## 4) Information Architecture (High-Level)

- **Home**
  - Daily context and quick-start actions.
  - Recent encounter shortcuts.
  - System readiness and latency health indicator.

- **Encounters**
  - Searchable list of active/completed encounters.
  - Status-centric browsing (recording, processing, ready, finalized).
  - Fast transitions into transcript/note views.

- **Transcribe**
  - Live capture state and controls.
  - Streaming transcript timeline.
  - Post-visit processing state and generated note handoff.

---

## 5) Screen-Level Wireframe Proposals

## 5.1 Home (Mobile First)

**Primary Intent:** Start new recording quickly, resume in-progress encounters, and see operational status.

### Mobile Wireframe (Concept)

```text
┌──────────────────────────────┐
│ MedScribe        Dr. Name    │
│ Good morning                 │
├──────────────────────────────┤
│ [ Start New Encounter ]      │  <- Primary CTA (full width)
├──────────────────────────────┤
│ System Status                │
│ ● Mic Ready  ● ASR Online    │
│ ● Queue Low  ● Sync Healthy  │
├──────────────────────────────┤
│ Continue Working             │
│ #ENC-2041  Processing 67%    │
│ Last update: 2m ago          │
├──────────────────────────────┤
│ Recent Encounters            │
│ - Maria A.   Ready Note      │
│ - Alan K.    Finalized       │
│ - New Patient Processing      │
└──────────────────────────────┘
Bottom Nav: Home | Encounters | Transcribe
```

### Desktop Adaptation

- 12-column layout with three panels:
  - Left: quick actions + system health.
  - Center: active and recent encounters.
  - Right: clinician productivity shortcuts (copy latest note, open unfinished).
- Keep start action visually strongest with elevated card and contrast border.

---

## 5.2 Encounters

**Primary Intent:** Find, filter, and open encounters with minimum clicks.

### Mobile Wireframe (Concept)

```text
┌──────────────────────────────┐
│ Encounters                   │
│ [ Search by patient/name ]   │
├──────────────────────────────┤
│ Filters: Active | Processing │
│          Ready | Finalized   │
├──────────────────────────────┤
│ Maria A.          READY      │
│ 10:22 AM • 14m audio         │
│ [Open Transcript] [Open Note]│
├──────────────────────────────┤
│ Aaron L.       PROCESSING    │
│ Started 8:04 AM • 39%        │
│ [View Status]                │
├──────────────────────────────┤
│ Nina R.         FINALIZED    │
│ Yesterday • copied 1x        │
│ [Open Note]                  │
└──────────────────────────────┘
```

### Desktop Adaptation

- Split layout:
  - Left rail: saved filters and date presets.
  - Main table/list: compact rows with status chips and quick actions.
  - Preview pane: metadata + note snapshot.
- Dense rows with strict rhythm (no dead white gaps).

---

## 5.3 Transcribe

**Primary Intent:** Confident live recording and low-friction review while processing completes.

### Mobile Wireframe (Concept)

```text
┌──────────────────────────────┐
│ Encounter: New Visit         │
│ Patient: [Name]              │
├──────────────────────────────┤
│ ● Recording   00:12:44       │
│ [Pause] [Bookmark] [End Visit]│
├──────────────────────────────┤
│ Live Transcript              │
│ Dr: How are you feeling...?  │
│ Pt: Better than yesterday... │
│ Dr: Any chest pain today?    │
│ ...                          │
├──────────────────────────────┤
│ Tabs: Transcript | Status    │
│ Status (post-end):           │
│ Uploading -> ASR -> Note Gen │
│ Current: ASR 82%             │
└──────────────────────────────┘
```

### Desktop Adaptation

- Two-stage layout:
  - During recording: transcript-first center pane + right control rail.
  - After end-visit: processing timeline + generated note readiness panel.
- Once note is ready, show direct transition CTA: `Open Generated Note`.

---

## 6) Visual System: Clinical Luxe

## 6.1 Color Direction

Retain purple as the primary brand signal; add premium neutrals and functional accents.

```css
:root {
  --brand-primary: #6e56cf;
  --brand-primary-strong: #5b45b0;
  --brand-primary-soft: #eee9ff;

  --bg-canvas: #f4f2f8;
  --bg-surface: #ffffff;
  --bg-elevated: #fbfafd;

  --text-primary: #17151f;
  --text-secondary: #4f4a63;
  --text-muted: #7c7691;

  --border-subtle: #e3dff0;
  --success: #178a64;
  --warning: #b7791f;
  --error: #b42318;
  --info: #2f6fde;
}
```

### Usage Rules

- Purple is reserved for high-importance actions and active states.
- Large reading surfaces stay neutral for long-session comfort.
- Status colors are semantic only (never decorative).
- Avoid pure white full-screen backgrounds; use layered neutrals.

## 6.2 Typography Proposal

- **Display/Headings:** `Fraunces` (high-character serif for premium tone).
- **Body/UI:** `Source Sans 3` (high legibility in dense clinical UI).

### Type Scale (Mobile Base)

- H1: 30/36
- H2: 24/30
- H3: 20/26
- Body L: 17/26
- Body M: 15/22
- Body S: 13/18
- Data/Meta: 12/16

### Readability Rules

- Transcript/note lines target 60-75 chars desktop, 34-42 chars mobile.
- Paragraph spacing > line spacing for clinical text scanning.
- Avoid center-aligned long text blocks.

## 6.3 Spacing and Density

- Base unit: 4px.
- Use compact card internals (12-16px padding mobile, 16-20px desktop).
- Vertical section rhythm: 16/24/32 tiers.
- Replace empty whitespace with purposeful support content (status, shortcuts, metadata).

---

## 7) Interaction and Motion Specification

## Core Motion Principles

- Motion communicates system state, not decoration.
- Fast interactions for controls (120-180ms).
- Medium transitions for panel/layout changes (220-320ms).
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` for most UI transitions.

## Key Motion Moments

1. **Home Load Sequence (Staggered Reveal)**
   - Header -> primary CTA -> status module -> recent encounters.
   - 40ms stagger to establish hierarchy.

2. **Recording State Pulse**
   - Subtle pulse on recording indicator every 1.6s.
   - Never blink aggressively; preserve clinical calm.

3. **Encounter Row Expand**
   - Quick expand/collapse for metadata and secondary actions (180ms).

4. **Processing Pipeline Animation**
   - Stepper animation from `Uploading -> ASR -> Note Generation`.
   - Current step highlighted with gentle progress sweep.

5. **Ready Note Handoff**
   - Processing panel morphs into a success card with `Open Generated Note` CTA.

---

## 8) Component Strategy for Future Expansion

- Build around reusable primitives:
  - `StatusChip`
  - `EncounterCard`
  - `TranscriptBlock`
  - `ProcessingTimeline`
  - `PrimaryActionBar`
- Add module slots in layout for future features (templates, provider preferences, QA flags).
- Keep a tokenized system (color, type, spacing, radius, shadow, motion) from day one.

---

## 9) UX Content and Labeling Guidance

- Prefer explicit status labels:
  - `Recording`
  - `Paused`
  - `Processing Audio`
  - `Generating Note`
  - `Ready for Review`
  - `Finalized`
- Use action-first buttons:
  - `Start New Encounter`
  - `End Visit`
  - `Open Generated Note`
  - `Copy Note`
- Avoid vague language like `Submit`, `Continue`, `Done` when context is critical.

---

## 10) Recommended Accessibility Baseline

Even without a formal target, apply these minimums to improve safety and readability:

- Contrast ratio >= 4.5:1 for body text.
- Minimum tap target 44x44px on mobile.
- Visible keyboard focus for desktop workflows.
- Do not use color alone to indicate status.
- Respect reduced-motion preference for non-essential animations.

---

## 11) Design Deliverables

This proposal supports the following immediate deliverables:

- Wireframes for Home, Encounters, and Transcribe (mobile + desktop adaptation).
- Clinical Luxe visual direction with color, type, spacing, and motion foundations.
- Component-level strategy designed for future module expansion.

---

## 12) Immediate Next Design Actions

1. Convert wireframe concepts into low-fidelity flows for the three screens.
2. Build a v1 token set in code (color/type/spacing/motion).
3. Produce a high-fidelity pass for Home and Transcribe first.
4. Validate with 3-5 physician walkthroughs before implementation freeze.

---

## 13) Implementation Blueprint (Screen by Screen)

## 13.1 Home

### Mobile Structure (Top to Bottom)

1. App header (brand, physician profile entry)
2. Primary action card (`Start New Encounter`)
3. System status cluster (mic, ASR, queue, sync)
4. Continue working card (single in-progress encounter)
5. Recent encounters list (max 5)
6. Bottom navigation (`Home`, `Encounters`, `Transcribe`)

### Desktop Structure

- **Column A (3/12):** quick actions + system status.
- **Column B (6/12):** active/in-progress + recent encounters.
- **Column C (3/12):** productivity shortcuts (`Open Latest Note`, `Open Unfinished`).

### Behavioral Rules

- Primary CTA is always visible above the fold on mobile.
- Only one in-progress encounter is shown in `Continue Working`; others remain in recent list.
- Status chips update in place without full-card layout shift.

## 13.2 Encounters

### Mobile Structure (Top to Bottom)

1. Screen title + search input
2. Horizontal status filters (`Active`, `Processing`, `Ready`, `Finalized`)
3. Encounter cards (compact rows with quick actions)

### Desktop Structure

- **Left rail:** saved filters + date ranges.
- **Center:** compact encounter rows with status and actions.
- **Right pane:** selected encounter summary and note snapshot.

### Behavioral Rules

- Default sort: most recent encounter first.
- Filter selection persists between app sessions.
- `Ready` and `Processing` statuses show progress metadata at row level.

## 13.3 Transcribe

### Mobile Structure (Top to Bottom)

1. Encounter and patient header
2. Recording strip (state + timer + controls)
3. Live transcript feed
4. Tab row (`Transcript`, `Status`)
5. Post-end processing pipeline panel

### Desktop Structure

- **During recording:** center transcript pane + right control panel.
- **After visit end:** processing timeline replaces control panel until note generation completes.

### Behavioral Rules

- `End Visit` transitions state from live capture to processing pipeline.
- `Open Generated Note` appears only when all processing stages are complete.
- Transcript feed autoscrolls during live capture and pauses on manual user scroll.

---

## 14) Component Contract

## 14.1 Required Components

- `PrimaryActionCard`
  - Props: title, subtitle, actionLabel, onAction
  - States: default, hover, pressed, disabled
- `StatusChip`
  - Props: label, tone (`neutral | success | warning | error | info`), icon
  - States: static, live-updating
- `EncounterRow`
  - Props: patientName, status, timestamp, duration, progress, actions[]
  - States: collapsed, expanded, selected
- `RecordingStrip`
  - Props: isRecording, elapsedTime, onPause, onBookmark, onEndVisit
  - States: recording, paused, disabled
- `ProcessingTimeline`
  - Props: currentStage, stageProgress, stages[]
  - States: active, complete, error

## 14.2 Shared Interaction Rules

- Disable destructive actions while network state is unknown.
- Every status change must have text label + icon (not color-only).
- Critical action buttons (`Start New Encounter`, `End Visit`) require consistent placement per breakpoint.

---

## 15) Tokenized UI Spec (Implementation Ready)

## 15.1 Radius and Elevation

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-1: 0 1px 2px rgba(23, 21, 31, 0.06);
  --shadow-2: 0 6px 16px rgba(23, 21, 31, 0.08);
  --shadow-3: 0 12px 28px rgba(23, 21, 31, 0.12);
}
```

## 15.2 Spacing Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

## 15.3 Breakpoints

- `sm`: 360-767px (phones)
- `md`: 768-1023px (tablets)
- `lg`: >=1024px (desktop)

---

## 16) Motion Contract (Per Interaction)

| Interaction             |         Duration | Easing                         | Trigger              | Notes                      |
| ----------------------- | ---------------: | ------------------------------ | -------------------- | -------------------------- |
| Home staggered load     | 280ms each block | cubic-bezier(0.2, 0.8, 0.2, 1) | first render         | 40ms stagger interval      |
| Recording pulse         |      1600ms loop | ease-in-out                    | recording active     | reduced opacity range only |
| Encounter expand        |            180ms | cubic-bezier(0.2, 0.8, 0.2, 1) | row tap/click        | height + opacity           |
| Tab switch              |            140ms | ease-out                       | tab change           | content crossfade          |
| Processing stage update |            220ms | ease-out                       | backend stage update | no layout jump             |

**Reduced Motion Rule:** if `prefers-reduced-motion` is active, disable pulse and use instant state changes.

---

## 17) Content and State Matrix

| State      | Label              | User Action                  | Result                                    |
| ---------- | ------------------ | ---------------------------- | ----------------------------------------- |
| Idle       | `Ready to Record`  | Start New Encounter          | opens Transcribe in recording-ready mode  |
| Recording  | `Recording`        | Pause / Bookmark / End Visit | updates live capture state                |
| Paused     | `Paused`           | Resume / End Visit           | returns to recording or starts processing |
| Processing | `Generating Note`  | View Status                  | shows pipeline progress                   |
| Ready      | `Ready for Review` | Open Generated Note          | opens note review/edit workflow           |
| Finalized  | `Finalized`        | Open Note / Copy Note        | review and copy flow                      |

---

## 18) Acceptance Criteria (Design Implementation)

- Home, Encounters, and Transcribe each have mobile and desktop layout definitions.
- All critical actions are visible without scrolling on default phone viewport where applicable.
- Processing pipeline is represented with explicit stage labels and stage progress.
- Purple remains the primary accent and neutral layered surfaces are applied.
- Components use shared tokens for color, spacing, radius, elevation, and motion.
- Transcribe flow enforces post-visit note generation handoff (`End Visit` -> processing -> `Open Generated Note`).
