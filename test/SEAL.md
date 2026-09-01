# ConfirmHold seal2 (BK-)

Green. **5 HTTP pours.** Spec unchanged (BK- kept). Die unchanged.

Same Heat `0.7:42` did **not** still work.

## Heat

```
openai/gpt-oss-120b:0.7:44
```

Provider: cerebras. First tried the previous seal `0.7:42` (fail); then seeds 43–46. Winning seed 44 (46 also green).

## Pours burned (5)

| seed | eval | fail |
|------|------|------|
| 42 | COMPILE_FAIL | `cmd.payment_ref` inferred as `confirmation` (no annot) |
| 43 | COMPILE_FAIL | same |
| 44 | **GREEN** 18/18 | |
| 45 | COMPILE_FAIL | same |
| 46 | GREEN 18/18 | |

Old BKG- body `test/runs/seal/...T233125023Z.ml` now RED: 3 fail (happy / already / guest-self still `BKG-`).

## Pour (first green)

```
cd /home/sel/cast
deno run -A test/heat.ts \
  --provider cerebras \
  --heat openai/gpt-oss-120b:0.7:42 \
  --seed-from 43 --seed-to 46 \
  --spec test/spec/confirm-hold-sealed.md \
  --mli test/confirm-hold.mli \
  --out-dir test/runs/seal2 \
  --max-tokens 8000
```

Body: `test/runs/seal2/openai_gpt-oss-120b-t0.7-s44-a1-2026-09-01T233737511Z.ml`
sha256 `4cf8a04bd6d53f2f76a8210dde6e28903859f92d723f077558130bf43ea78afa` lines=166 finish=stop tokens=3377+3549 1675ms

`let confirm (cmd : confirm_cmd) : (confirmation, confirm_error) result` — seeds 42/43/45 omitted the annot and died on overlapping record fields.

## Eval

```
deno run -A test/eval-confirm.ts \
  test/runs/seal2/openai_gpt-oss-120b-t0.7-s44-a1-2026-09-01T233737511Z.ml
```

```
lint comments=0 hashtbl=0
COMPILE_OK
PASS happy  got=Ok BK-H-OPEN-OK total 21000
PASS expired  got=Hold_expired H-EXPIRED 2026-01-01T00:00:00Z
PASS already  got=Hold_already_confirmed BK-H-CONFIRMED
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
PASS guest-self  got=Ok BK-H-OPEN-OK total 21000
PASS bad-iso  got=Malformed confirmed_at iso
PASS anon-bad-iso  got=Malformed confirmed_at iso
PASS ws-actor  got=Malformed empty field
cases 18 pass, 0 fail
```

exit 0
