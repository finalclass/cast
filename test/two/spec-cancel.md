# Cancel (cavity)

Implement Cancel against the given .mli (Hold first, then Cancel). `open Hold`.
Do not duplicate Hold types. After `open Hold`, copy every type from cancel.mli into this .ml (ocamlc will not see those names otherwise). Stdlib only. One exported val: cancel.
No HTTP, SQL, clocks, Jane Street, Lwt, Eio, Obj. Result only. No objects. No polymorphic variants.
Do not parse hold_id.

Trim hold_id, reason, stamp.at, stamp.actor, stamp.note with String.trim before any other check.
After trim, empty hold_id or reason or stamp.at or stamp.actor or stamp.note is Malformed, never Actor_unauthorized.
ISO-8601: length 20 and last char Z on stamp.at only.
Actor guest-self is allowed. Actor anonymous or kiosk is Actor_unauthorized.

Ignore any 500-line target. About 120–180 lines then STOP after `cancel`.
No comments (`(*` forbidden). No Hashtbl. Immutable list `holds`.
Status variant `Open | Confirmed | Cancelled`. Helpers only: `iso_ok`, `lookup`.
`iso_ok s` is `String.length s = 20 && s.[19] = 'Z'`.
`lookup id` is `List.find_opt (fun h -> h.id = id) holds`.
Write hold records compactly (several fields per line).

## Decision order (the only order)
Return the first error.
1. After trim: empty hold_id, reason, stamp.at, stamp.actor, or stamp.note → Malformed.
2. stamp.at fails ISO → Malformed.
3. stamp.actor is exactly anonymous or exactly kiosk → Actor_unauthorized.
4. hold_id not in the table → Hold_not_found.
5. status Cancelled → Hold_cancelled hold_id.
6. status Confirmed → Hold_already_confirmed with BK- ^ hold_id.
7. Ok ().

Do not insert extra checks. After step 4 match the option; then match status.

## Table (same ids as Confirm; hard-code)

H-OPEN-OK Open expires 2026-12-01T12:00:00Z
H-EXPIRED Open expires 2026-01-01T00:00:00Z
H-CONFIRMED Confirmed expires 2026-12-01T12:00:00Z
H-CANCEL Cancelled expires 2026-12-01T12:00:00Z
H-PAY-MISS Open, H-PAY-OPEN Open, H-NO-INV Open, H-DRIFT Open,
H-BLOCKED Open, H-CLOSED Open, H-STALE Open
Other fields unused by cancel; still include id and status and expires_at.

## Use cases
Common: reason user, stamp.at 2026-11-01T10:00:00Z, stamp.actor desk-1.
happy H-OPEN-OK → Ok
already-cancel H-CANCEL → Hold_cancelled
already-conf H-CONFIRMED → Hold_already_confirmed BK-H-CONFIRMED
missing H-NOPE → Hold_not_found
anon stamp.actor anonymous → Actor_unauthorized
kiosk stamp.actor kiosk → Actor_unauthorized
empty-id hold_id empty → Malformed
empty-reason reason empty → Malformed
bad-iso stamp.at 2026-11-01 → Malformed
ws-actor stamp.actor '  ' → Malformed
empty-note stamp.note empty → Malformed
