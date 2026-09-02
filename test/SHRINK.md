# Shrink after green (2026-09-02)

Same die, same Heat `openai/gpt-oss-120b:0.7:42–46`, same `eval-confirm.ts` (19 cases).

| | sealed | min |
| --- | --- | --- |
| spec bytes | 8840 | 3008 |
| prompt tokens | 3397 | 1430 |
| pour wall (5 parallel) | 2.2 s | 4.0 s |
| green | 2/5 | 3/5 |

Min kept order, defaults+deltas table, and the 19 cases. It dropped per-field YAML and the 500-line sermon.

Min is not strictly better: one compiling miss used default `P1` on H-CLOSED (`Property_closed P1` instead of `P-SHUT`) — compact table is easier to misread. Some min bodies were *longer* (oss expanded the defaults).

Cutting after green works as a pass@k game, not as “same seed, shorter, still identical.” Re-record Heat after a shrink.
