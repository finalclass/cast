# Cast

A method for generating software: **compile the contracts, then pour implementations from spec+heat.** Never patch generated code.

Cast is a foundry, not an architecture. You bring the decomposition — IDesign, or anything else that can express contracts. Cast is how the metal is poured.

This repository is the manifesto. There is no harness here yet.

## The idea

The specification is the source of truth. It carries **Heat**: the `(model, temperature, seed)` used to generate from it.

Generated code is object code. You do not edit it. You re-pour.

Same spec + same heat → a new shot, from scratch. A compile error or a failed assertion is not a patch on the output. It is a signal to correct the spec or the heat, then pour again.

This is a compiler whose backend is an LLM.

```
spec + heat     ← you work here
dies (.mli, …)  ← compiled contracts (the mold)
bodies          ← poured from scratch, parallel, one shot per cavity
_build          ← kept; the language compiler is incremental
```

## Why

Agents that patch code accumulate drift. Spec-driven tools still treat the repository as something to incrementally edit. Cast treats generation like compilation: you do not edit `.o` files.

The unit of regeneration is a **cavity** (one endpoint / one operation body). Change three cavities → three new shots from scratch. The rest of `_build` stays. If shared service types change, every cavity in that service re-pours.

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Heat** | `(model, temperature, seed)`. Polish: *wytop*. |
| **Die heat** | One heat for generating the interface files. |
| **Shot heat** | Per-cavity heat for generating a body. |
| **Die** | Compiled contracts / interfaces (e.g. OCaml `.mli`). |
| **Cavity** | One endpoint — a generation unit *inside* a service contract. |
| **Pour** | The parallel generation wave of all cavities. |
| **Shot** | One cavity's generation with its shot heat. |

A cavity is not a service. The architectural contract stays at the service (a cohesive facet, typically several operations). Cavities are how Cast *links and generates*. The die you compile first is the service contract; endpoint `.mli` files are slices of that die, not the other way around.

## Pipeline

1. **Write the spec.** The spec includes Heat.
2. **Cut the dies.** Generate interfaces with the die heat. Service contracts first; cavities are derived from them.
3. **Compile the dies.** Type-check the interface graph. If this fails, do not pour.
4. **Pour.** Generate every cavity in parallel, each with its own shot heat, always from scratch.
5. **Compile the program.** Keep `_build`. Unchanged units take seconds.

The wall-clock of a pour is the slowest shot, not the sum. On Cerebras `gpt-oss-120b`, one hundred ConfirmHold shots at concurrency 20 finished in about 15 seconds. Spec correction and die-heat iteration sit outside that window. One failed compile and those 15 seconds are gone; you fix the spec and pour again.

## Who writes what

A strong model writes the spec **and** the checks that will later accept or reject a pour (worked examples, lints). A fast shot model pours the `.ml`. Those are different jobs.

The checks are programs. If a sentence in the spec has no check, the pourer will skip it and nobody will notice. “Score this 1–1000” is not a check.

For **one** cavity, skip the foundry: let the strong model write the body, then run the checks. Cast pays when there are many cavities and wall-clock is the slowest shot — not when you spend a frontier call on every endpoint, and not when you spend one on reviewing 69 almost-identical pours.

## The sieve

Gates, in order:

1. Compile the body against the die.
2. Run the spec’s examples and lints (the compiler, a test driver, grep — not chat).
3. Optionally a **different** model reviews only the survivors. It looks for missing checks. Its output is a spec patch, never an edit of `.ml`.

An LLM judge on the pourer, or a rank of every compiling shot, saturates and invents nits. Keep it off the acceptance path.

This is the same idea as Axe **labels**: a named verification pipeline (`[test]`, `[contract]`, …), deterministic tools first, an agent only for what a script cannot say yes/no to. Cast does not use the Axe harness. It re-pours instead of syncing a delta.

## Heat (what actually repeated)

- `temperature = 0` is greedy. Seed is unused. A hundred seeds produced one hash.
- `temperature > 0` plus seed: Cerebras `openai/gpt-oss-120b` repeated byte-for-byte. `google/gemini-3.6-flash` did not (three hashes from five identical heats), and thinking ate an 8k token cap before any body appeared.
- Shot heat we keep: oss-120b on Cerebras. About 2 s per shot. On a closed ConfirmHold spec, 69/100 compiled. Production is the sieve plus a closed spec, not a smarter pourer.

Die heat stays a stronger model. Shot heat stays cheap and, where the provider actually honours it, seed-stable.

## What you never do

- Patch generated code to silence a compiler or a test.
- Skip compiling dies before the pour.
- Let the linker grain become the design grain (one-operation “services”).
- Treat Heat as a chat setting. Heat lives in the spec.
- Let the pourer grade its own shots.
- Treat an LLM score as the acceptance test.

## Status

Manifesto plus a Heat probe under `test/` (one OCaml cavity through OpenRouter). Not a product harness.

## Related

[Axiomatic Engineering](https://github.com/finalclass/axiomatic-engineering) (`axe`) is spec-anchored development: human-authored docs are the source, code is derived by a delta sync. Cast is a different manufacturing layer — from-scratch pour, Heat in the spec, contracts compiled before bodies exist.
