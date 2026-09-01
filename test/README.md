# Heat test

Pour one OCaml cavity from a fat spec through OpenRouter. Same Heat should be the same bytes — this checks whether it actually is.

Heat = `(model, temperature, seed)`.

## Files

| | |
| --- | --- |
| `confirm-hold.mli` | die |
| `spec/confirm-hold.md` | ~5000-line stand-in (open, padded) |
| `spec/confirm-hold-closed.md` | ~1000-line closed spec (one decision order) |
| `gen-spec.ts` | regenerates the fat spec |
| `gen-spec-closed.ts` | regenerates the closed spec |
| `heat.ts` | OpenRouter shot |

`spec/confirm-hold.md` is bulk: architecture notes, service notes, collaborator notes, error catalog, use cases, style. A live pour would instead get arch + service + contracts + use cases + libraries + skills. Here that mass is generated prose about **ConfirmHold**.

Target body: ~500 lines of OCaml implementing the `.mli`. Closed spec: drop the padding, keep one decision order, attach examples the compiler can run.

Conclusions from the probe live in the root README (who writes spec vs body, sieve, seed). Do not use the pourer as its own judge.

## Run

Key: `OPENROUTER_API_KEY` in the environment or `/home/sel/fc/.env.local` (`export KEY=` is ok).

```
./test/gen-spec.ts
./test/heat.ts --dry-run --heat openai/gpt-oss-20b:0:42
./test/heat.ts --heat openai/gpt-oss-20b:0:42 --repeat 2
./test/heat.ts --provider groq --heat meta-llama/llama-3.1-8b-instant:0:1 --repeat 2
./test/gen-spec-closed.ts
./test/heat.ts --provider cerebras --heat openai/gpt-oss-120b:0.7:42 \
  --spec test/spec/confirm-hold-closed.md --max-tokens 8000 --repeat 5
./test/heat.ts --provider cerebras --heat openai/gpt-oss-120b:0.7:0 \
  --spec test/spec/confirm-hold-closed.md --seed-from 0 --seed-to 99 \
  --concurrency 20 --max-tokens 8000
./test/compile-shots.ts test/runs/<dir> --concurrency 20
```

`t = 0` ignores seed. `t > 0` plus seed is what Cerebras oss-120b actually repeats. Gemini 3.6 Flash does not.

`--provider groq` pins OpenRouter to Groq and disables fallbacks. With a seed, `require_parameters` is on so providers that cannot honour `seed` are skipped.

Outputs: `test/runs/*.ml` + `*.json` (gitignored).

## Cost

The spec is ~5k lines. Prompt is tens of thousands of tokens. Pin a cheap/fast model for the first repeats.
