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

The wall-clock of a pour is the slowest shot, not the sum — in theory on the order of 15 seconds. Spec correction and die-heat iteration sit outside that window. One failed compile and the 15 seconds are gone; you fix the spec and pour again.

## What you never do

- Patch generated code to silence a compiler or a test.
- Skip compiling dies before the pour.
- Let the linker grain become the design grain (one-operation “services”).
- Treat Heat as a chat setting. Heat lives in the spec.

## Status

Manifesto only. The pour harness is not in this tree.

## Related

[Axiomatic Engineering](https://github.com/finalclass/axiomatic-engineering) (`axe`) is spec-anchored development: human-authored docs are the source, code is derived by a delta sync. Cast is a different manufacturing layer — from-scratch pour, Heat in the spec, contracts compiled before bodies exist.
