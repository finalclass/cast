# Confirm (cavity)

Implement Confirm against the given .mli (Hold first, then Confirm). `open Hold`.
Do not duplicate Hold types. After `open Hold`, copy types from confirm.mli into the .ml, but never copy a `val` line (that is a signature, not a body). Annotate `let confirm (cmd : confirm_cmd)`. Stdlib only. One exported val: confirm.
No HTTP, SQL, clocks, Jane Street, Lwt, Eio, Obj. Result only. No objects. No polymorphic variants.
Do not parse hold_id; it is opaque.
Actor guest-self is allowed. Actor anonymous or kiosk is Actor_unauthorized.
Trim hold_id, payment_ref, stamp.at, stamp.actor, stamp.note with String.trim before any other check.
After trim, empty hold_id or payment_ref or stamp.at or stamp.actor or stamp.note is Malformed, never Actor_unauthorized.
ISO-8601 here means length 20 and last char Z, applied to stamp.at. No other ISO check.
confirmation.confirmed_at is the trimmed stamp.at.

Ignore any request to write about 500 lines. Padding, dummy lets, repeated records, or trailing garbage make the file fail to compile. A correct file is about 180–220 lines and then STOPS. The last line of the file is the last line of `confirm`. Do not emit markdown. Do not emit commentary.

The two-character sequence open-paren then star is forbidden anywhere (no comments). Hashtbl is forbidden. Use an immutable list named `holds`.

Status MUST be a variant `Open | Confirmed | Cancelled`, never a string. Matching on status is exhaustive on those three constructors. Do not add an unknown-status branch; there is no unknown status.

Helpers allowed, and only these names: `iso_ok`, `total_of`, `lookup`.
- `iso_ok s` is `String.length s = 20 && s.[19] = 'Z'`
- `total_of h` is `h.unit_cents * h.nights + h.tax_cents`
- `lookup id` is `List.find_opt (fun h -> h.id = id) holds`
Copy the .mli types at the top of the .ml. Define a private `status` and `hold` (or `hold_snapshot`) record with the table fields below. Write each hold record compactly (several fields per line), not one field per line.

## Decision order (canonical, the only order)
Return the first error. Do not reorder. Do not insert extra checks between these steps.
1. After trim: empty hold_id, payment_ref, stamp.at, stamp.actor, or stamp.note → Malformed.
2. stamp.at fails ISO → Malformed.
3. stamp.actor is exactly anonymous or exactly kiosk → Actor_unauthorized.
4. hold_id not in the table → Hold_not_found.
5. snapshot expires_at fails ISO → Malformed.
6. status Cancelled → Hold_cancelled.
7. status Confirmed → Hold_already_confirmed with booking_id BK- ^ hold_id.
8. stamp.at > expires_at lexicographic (OCaml string `>`) → Hold_expired (hold_id, expires_at).
9. guest_blocked → Guest_blocked guest_id.
10. property_closed → Property_closed (property_id, stamp.at).
11. payment_ref ≠ snapshot payment_ref → Payment_mismatch (cmd, snapshot).
12. payment_captured is false → Payment_not_captured snapshot payment_ref.
13. version >= 1000 → Concurrent_confirm hold_id.
14. inventory = 0 → Inventory_lost (room_type_id, stamp.at).
15. unit_cents * nights + tax_cents ≠ price_cents → Price_drift (recomputed, price_cents).
16. Ok: booking_id BK- ^ hold_id; total_cents = unit_cents * nights + tax_cents;
    lines = one line from snapshot room_type_id, nights, unit_cents, tax_cents;
    confirmed_at = trimmed stamp.at; copy property_id guest_id currency hold_id.

Implement confirm as nested `if` / `else if` / `match lookup hold_id` in this same numeric order. After step 4, `match` the option; after step 5, `match` status with Cancelled, Confirmed, Open.

## Table (hard-code; no other hold_id)

### H-OPEN-OK
- id: H-OPEN-OK
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-EXPIRED
- id: H-EXPIRED
- status: Open
- expires_at: 2026-01-01T00:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-CONFIRMED
- id: H-CONFIRMED
- status: Confirmed
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-CANCEL
- id: H-CANCEL
- status: Cancelled
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-PAY-MISS
- id: H-PAY-MISS
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_stored
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-PAY-OPEN
- id: H-PAY-OPEN
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: false
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-NO-INV
- id: H-NO-INV
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 0
- version: 1
recomputed: 21000

### H-DRIFT
- id: H-DRIFT
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 99999
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-BLOCKED
- id: H-BLOCKED
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G-BAD
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: true
- property_closed: false
- inventory: 3
- version: 1
recomputed: 21000

### H-CLOSED
- id: H-CLOSED
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P-SHUT
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: true
- inventory: 3
- version: 1
recomputed: 21000

### H-STALE
- id: H-STALE
- status: Open
- expires_at: 2026-12-01T12:00:00Z
- price_cents: 21000
- currency: EUR
- payment_ref: pay_ok
- payment_captured: true
- property_id: P1
- guest_id: G1
- room_type_id: RT-Q
- nights: 2
- unit_cents: 10000
- tax_cents: 1000
- guest_blocked: false
- property_closed: false
- inventory: 3
- version: 1000
recomputed: 21000

## Use cases (expected prefix of the result)
Common cmd: payment_ref pay_ok, stamp.at 2026-11-01T10:00:00Z, stamp.actor desk-1 unless stated.
happy H-OPEN-OK → Ok BK-H-OPEN-OK total 21000
expired H-EXPIRED → Hold_expired, second payload expires_at 2026-01-01T00:00:00Z
already H-CONFIRMED → Hold_already_confirmed BK-H-CONFIRMED
cancel H-CANCEL → Hold_cancelled
mismatch H-PAY-MISS pay_ok → Payment_mismatch pay_ok vs pay_stored
uncaptured H-PAY-OPEN → Payment_not_captured
noinv H-NO-INV → Inventory_lost
drift H-DRIFT → Price_drift 21000 vs 99999
blocked H-BLOCKED → Guest_blocked G-BAD
closed H-CLOSED → Property_closed P-SHUT
stale H-STALE → Concurrent_confirm
missing H-NOPE → Hold_not_found
anon H-OPEN-OK stamp.actor anonymous → Actor_unauthorized
kiosk H-OPEN-OK stamp.actor kiosk → Actor_unauthorized
empty-id hold_id empty → Malformed
guest-self H-OPEN-OK stamp.actor guest-self → Ok (same as happy)
bad-iso H-OPEN-OK stamp.at 2026-11-01 → Malformed (not length 20)
anon-bad-iso stamp.actor anonymous stamp.at 2026-11-01 → Malformed (ISO is step 2, before anonymous)
ws-actor stamp.actor '  ' → Malformed after trim
empty-note stamp.note empty → Malformed

## Style (binding)
Snake_case. Match .mli types exactly.
Fake table: immutable binding (list). Hashtbl is forbidden.
No comments.
Helpers allowed: iso_ok, total_of, lookup.
No extra public vals besides confirm (mli is the export list).
Stop after confirm. The module must compile as-is against Hold then Confirm.
