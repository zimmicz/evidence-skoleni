# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Job-interview take-home (MUNI, full-stack dev). Full brief in `docs/zadani.md` (Czech). Raw CSV exports in `data/` (generated, fictional institution `vzorova.example`). Data is intentionally dirty — treat every file as untrusted input.

Task: web app where HR sees training status of employees, whose training expires soon and what needs action; given limited session capacity, it recommends whom to enroll in which session.

Constraints from brief:

- Budget 3–4 h; priorities over perfection. Tech free choice, must be justified.
- Deploy publicly on a free service; source on GitHub. No API required (organizer's answer).
- Export date 1. 10. 2026 = default Reference date.
- Deliverables besides app: ≤1-page text `docs/zprava.md`, AI-usage note `docs/ai.md`.
- Submission by 29. 10. 2026 to janovic@ics.muni.cz.

## Commands

```sh
npm run dev            # Vite dev server, http://localhost:5173/evidence-skoleni/
npm test               # Vitest unit tests (src/**/*.test.ts)
npx vitest run src/domain/booking.test.ts -t "confirmed"   # single file / test
npm run test:e2e       # Playwright (starts dev server on :5179)
npm run lint           # oxlint
npm run format         # prettier --write (format:check in CI)
npm run typecheck      # tsc -b (app, node, test projects)
npm run build          # typecheck + vite build to dist/
```

CI (`.github/workflows/deploy.yml`) runs lint, format check, typecheck, unit, e2e, build, then deploys `dist/` to GitHub Pages on push to `main`. Vite `base` is `/evidence-skoleni/`; routing uses a hash router so Pages needs no 404 fallback.

## Architecture

Domain vocabulary in `CONTEXT.md` (use its terms). Decisions in `docs/adr/`.

Pure pipeline in `src/domain/` (no React), all unit-tested against the real `data/` files via `fixtures.ts`:

1. `csv.ts` — decode bytes (UTF-8, fallback windows-1250), sniff delimiter from header line, Papa Parse, detect file kind by exact header.
2. `import.ts` `buildDataset(tables, resolutions, referenceDate)` — strict validation in three tiers: **Normalization** (unambiguous, auto, listed), **Inconsistency** (HR resolves: map / exclude / ignore; stable id like `completions:kod_skoleni:KYB3R`, one resolution applies to all rows sharing it), **Rejected row** (structural: wrong column count, repeated header, bad/duplicate key). Each check site decides what an unresolved Inconsistency means (usually: row not used). Resolutions are re-applied on every build, so the pipeline is a pure function of (files, resolutions, reference date).
3. `compliance.ts` — Requirements per employee from catalog rules; status missing / expired / expiring / valid; best completion = latest Valid until (`null` = never expires).
4. `booking.ts` — urgency greedy (ADR 0001); Confirmed bookings and dismissed sessions come from persisted `BookingState`.

`src/state.tsx` — single React context: sample CSVs fetched with TanStack Query (`?url` imports of `data/*.csv`), persisted state (imported file texts, resolutions, bookings, settings) validated with Zod on load from localStorage and saved on every update; derived dataset/compliance/plan via `useMemo`.

UI: `src/pages/*` (Přehled, Zaměstnanci + detail, Termíny, Kvalita dat), `src/ui/forms.tsx` (react-hook-form + Zod: import, resolution, move booking), Tailwind only. Czech-only UI.

## Data facts

| file                    | delimiter | encoding     | notes                                              |
| ----------------------- | --------- | ------------ | -------------------------------------------------- |
| zamestnanci.csv         | `,`       | UTF-8 + BOM  | quoted email with comma (E0121)                    |
| katalog_skoleni.csv     | `,`       | UTF-8        | `povinne_pro` contains unquoted `;`                |
| absolvovana_skoleni.csv | `;`       | cp1250, CRLF | decimal comma, comment/total/repeated-header rows  |
| terminy_skoleni.csv     | `;`       | UTF-8 + BOM  | overbooked, zero-capacity, duplicate, invalid date |

- Dates: ISO, `d. m. yyyy`, `dd.mm.yyyy`, Excel serials (`43552`), placeholder 1900, future "zadáno předem".
- Duplicate employees by email (E1000/E1002 = E0155/E0124 without diacritics) → HR can merge.
- `rodne_cislo` is personal data — never parsed or displayed.
