# Heat test

Pour one OCaml cavity from a fat spec through OpenRouter. Same Heat should be the same bytes — this checks whether it actually is.

Heat = `(model, temperature, seed)`.

## Files

| | |
| --- | --- |
| `confirm-hold.mli` | die |
| `spec/confirm-hold.md` | ~5000-line stand-in context (not a real SDD) |
| `gen-spec.ts` | regenerates the spec |
| `heat.ts` | OpenRouter shot |

`spec/confirm-hold.md` is bulk: architecture notes, service notes, collaborator notes, error catalog, use cases, style. A live pour would instead get arch + service + contracts + use cases + libraries + skills. Here that mass is generated prose about **ConfirmHold**.

Target body: ~500 lines of OCaml implementing the `.mli`.

## Run

Key: `OPENROUTER_API_KEY` in the environment or `/home/sel/fc/.env.local` (`export KEY=` is ok).

```
./test/gen-spec.ts
./test/heat.ts --dry-run --heat openai/gpt-oss-20b:0:42
./test/heat.ts --heat openai/gpt-oss-20b:0:42 --repeat 2
./test/heat.ts --provider groq --heat meta-llama/llama-3.1-8b-instant:0:1 --repeat 2
```

`--provider groq` pins OpenRouter to Groq and disables fallbacks. With a seed, `require_parameters` is on so providers that cannot honour `seed` are skipped.

Outputs: `test/runs/*.ml` + `*.json` (gitignored).

## Cost

The spec is ~5k lines. Prompt is tens of thousands of tokens. Pin a cheap/fast model for the first repeats.
