# ConfirmHold seal

Green. 1 HTTP pour. Die unchanged.

## Heat

```
openai/gpt-oss-120b:0.7:42
```

Provider: cerebras (pinned, no fallbacks).

## Pour (succeeded)

```
cd /home/sel/cast
deno run -A test/heat.ts \
  --provider cerebras \
  --heat openai/gpt-oss-120b:0.7:42 \
  --spec test/spec/confirm-hold-sealed.md \
  --mli test/confirm-hold.mli \
  --out-dir test/runs/seal \
  --max-tokens 8000
```

Body: `test/runs/seal/openai_gpt-oss-120b-t0.7-s42-a1-2026-09-01T233125023Z.ml`
sha256 `a8dcf90bade77ed978d9e67973b88f1e62fee5702ec14d26a3df670b8a7aa740` lines=172 finish=stop tokens=3381+3001 2272ms

## Eval

```
deno run -A test/eval-confirm.ts \
  test/runs/seal/openai_gpt-oss-120b-t0.7-s42-a1-2026-09-01T233125023Z.ml
```

```
lint comments=0 hashtbl=0
COMPILE_OK
PASS happy  got=Ok BKG-H-OPEN-OK total 21000
PASS expired  got=Hold_expired H-EXPIRED 2026-01-01T00:00:00Z
PASS already  got=Hold_already_confirmed BKG-H-CONFIRMED
PASS cancel  got=Hold_cancelled H-CANCEL
PASS mismatch  got=Payment_mismatch pay_ok vs pay_stored
PASS uncaptured  got=Payment_not_captured pay_ok
PASS noinv  got=Inventory_lost RT-Q 2026-11-01T10:00:00Z
PASS drift  got=Price_drift 21000 vs 99999
PASS blocked  got=Guest_blocked G-BAD
PASS closed  got=Property_closed P-SHUT 2026-11-01T10:00:00Z
PASS stale  got=Concurrent_confirm H-STALE
PASS missing  got=Hold_not_found H-NOPE
PASS anon  got=Actor_unauthorized anonymous
PASS empty-id  got=Malformed empty field
PASS guest-self  got=Ok BKG-H-OPEN-OK total 21000
PASS bad-iso  got=Malformed bad confirmed_at
PASS anon-bad-iso  got=Malformed bad confirmed_at
PASS ws-actor  got=Malformed empty field
cases 18 pass, 0 fail
```

exit 0

## Spec vs closed

Copied `test/spec/confirm-hold-closed.md` → `test/spec/confirm-hold-sealed.md`.

Dropped Inv 1–699 and Order reminder 1–16.

Kept table, decision order 1–16, 18 use cases.

Added: ignore 500-line target; stop after `confirm`; compact records; no `(*`; no Hashtbl; helpers only `iso_ok` / `total_of` / `lookup`.

Unknown-status hole: status is a variant `Open | Confirmed | Cancelled`, not a string. No extra table row (sieve has no unknown-status case).
