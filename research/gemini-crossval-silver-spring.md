---
title: Gemini cross-validation, Silver Spring
purpose: Second-source (Google Gemini) data on Silver Spring buildings, used to cross-check our own agent verification. Gemini is treated as a corroborating source, NOT ground truth; our verify workflow's findings win on conflict.
source: Gemini export "Silver Spring Master Apartment Comparison (1).xlsx", received 2026-06-19
---

# Gemini cross-validation (Silver Spring)

## Gemini marks "Verified 24/7 Desk" (corroborates our candidates)

| Building | Rent from | Sq ft | Metro walk | Drive to Kemp Mill | Noise note |
| --- | --- | --- | --- | --- | --- |
| Eleven55 Ripley | $2,472 | 886-1147 | 2 min | 19 min | Closest to the tracks; train-facing units noisy, prefer high street-side floors |
| The Veridian | $2,487 | 1086-1227 | 5 min | 18 min | Train noise in the East building; request West |
| Thayer & Spring | $2,733 | 850-1100 | 6 min | 19 min | Quieter Fenton Village; very visible front desk |
| The Pearl | $3,200 | 950-1150 | 7 min | 21 min | Hotel-standard concierge; set back from traffic, quietest |
| Lenox Park | $2,293 | 1037-1224 | 4 min | 17 min | High-rise next to Metro; strong 2BR ratio; pet-friendly |
| Arrive Silver Spring | $2,866 | 1204 | 8 min | 17 min | Formerly The Cameron; responsive management |

## Gemini "Disqualified Ledger" (no 24/7 lobby, per Gemini)

These are buildings to confirm OURSELVES (Gemini is not ground truth). If our own verification agrees they lack full-time staffing, they stay out; our `doorman=false` mapping already excludes them.

- Twin Towers (Southern Management)
- Cole Spring Plaza
- Silver Spring Towers
- Colesville Towers (was one of our original placeholders)
- Solaire 1150 Ripley
- University Towers

## How this is used

The Silver Spring verify workflow (wf_1b18a448-a89) independently checks the 6 corroborated buildings plus anything discovery finds. After it completes, run an independent verify on any disqualified-ledger building it did not already cover, so the "checked every Silver Spring building" claim rests on our own agents, with Gemini only as a second opinion.
