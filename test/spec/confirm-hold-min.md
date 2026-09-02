# ConfirmHold

Implement confirm-hold.mli as one .ml. Stdlib only. Result, no exceptions, no objects, no Hashtbl, no comments.
One val: confirm. open-paren+star forbidden. Stop after confirm.
Copy .mli types. Status = Open | Confirmed | Cancelled. holds = immutable list.
Helpers only: iso_ok (len 20 and last char Z), total_of (unit*nights+tax), lookup (List.find_opt on id).
Trim hold_id, payment_ref, confirmed_at, actor first.
Empty after trim → Malformed (never Actor_unauthorized).
guest-self allowed. anonymous or kiosk → Actor_unauthorized.
Do not parse hold_id. Compact records (several fields per line).

## Order (first error wins; do not reorder)
1. empty hold_id|payment_ref|confirmed_at|actor → Malformed
2. confirmed_at not ISO → Malformed
3. actor anonymous|kiosk → Actor_unauthorized
4. id not in holds → Hold_not_found
5. expires_at not ISO → Malformed
6. Cancelled → Hold_cancelled
7. Confirmed → Hold_already_confirmed (BK- ^ id)
8. confirmed_at > expires_at (string >) → Hold_expired (id, expires_at)
9. guest_blocked → Guest_blocked guest_id
10. property_closed → Property_closed (property_id, confirmed_at)
11. payment_ref ≠ snap → Payment_mismatch (cmd, snap)
12. not payment_captured → Payment_not_captured snap ref
13. version >= 1000 → Concurrent_confirm
14. inventory = 0 → Inventory_lost (room_type_id, confirmed_at)
15. unit*nights+tax ≠ price → Price_drift (recomputed, price)
16. Ok BK- ^ id; total = recomputed; one line from snap; confirmed_at trimmed; copy property guest currency hold_id

match lookup after 4; match status Cancelled|Confirmed|Open after 5.

## Table
Defaults: Open, expires 2026-12-01T12:00:00Z, price 21000, EUR, pay_ok, captured true, P1, G1, RT-Q, nights 2, unit 10000, tax 1000, blocked false, closed false, inv 3, version 1.
H-OPEN-OK defaults
H-EXPIRED expires 2026-01-01T00:00:00Z
H-CONFIRMED Confirmed
H-CANCEL Cancelled
H-PAY-MISS pay_stored
H-PAY-OPEN captured false
H-NO-INV inv 0
H-DRIFT price 99999
H-BLOCKED guest G-BAD blocked true
H-CLOSED property P-SHUT closed true
H-STALE version 1000
No other ids.

## Cases
Common: pay_ok, 2026-11-01T10:00:00Z, desk-1
happy H-OPEN-OK → Ok BK-H-OPEN-OK total 21000
expired H-EXPIRED → Hold_expired … 2026-01-01T00:00:00Z
already H-CONFIRMED → Hold_already_confirmed BK-H-CONFIRMED
cancel H-CANCEL → Hold_cancelled
mismatch H-PAY-MISS → Payment_mismatch pay_ok vs pay_stored
uncaptured H-PAY-OPEN → Payment_not_captured
noinv H-NO-INV → Inventory_lost
drift H-DRIFT → Price_drift 21000 vs 99999
blocked H-BLOCKED → Guest_blocked G-BAD
closed H-CLOSED → Property_closed P-SHUT
stale H-STALE → Concurrent_confirm
missing H-NOPE → Hold_not_found
anon anonymous → Actor_unauthorized
kiosk kiosk → Actor_unauthorized
empty-id hold_id "" → Malformed
guest-self guest-self → Ok (happy)
bad-iso confirmed_at 2026-11-01 → Malformed
anon-bad-iso anonymous + 2026-11-01 → Malformed (ISO before actor)
ws-actor actor "  " → Malformed
