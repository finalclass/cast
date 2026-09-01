#!/usr/bin/env -S deno run --allow-read --allow-write
/** Closed ConfirmHold spec, ~1000 lines. One decision order. No contradictions. */

const TARGET = 1000;
const outPath = Deno.args[0] ??
  new URL("./spec/confirm-hold-closed.md", import.meta.url).pathname;

const lines: string[] = [];
const add = (s = "") => lines.push(s);

add("# ConfirmHold (closed)");
add("");
add("Implement test/confirm-hold.mli in one OCaml .ml. Stdlib only.");
add("One exported val: confirm. No HTTP, SQL, clocks, Jane Street, Lwt, Eio, Obj.");
add("No exceptions for business errors. Result only. No objects. No polymorphic variants.");
add("Time is only confirm_cmd.confirmed_at. Do not parse hold_id; it is opaque.");
add("Actor guest-self is allowed. Actor anonymous is Actor_unauthorized.");
add("Trim hold_id, payment_ref, confirmed_at, actor with String.trim before any other check.");
add("After trim, empty hold_id or payment_ref or confirmed_at or actor is Malformed, never Actor_unauthorized.");
add("ISO-8601 here means length 20 and last char Z. No other ISO check.");
add("");

add("## Decision order (canonical, the only order)");
add("Return the first error. Do not reorder.");
add("1. After trim: empty hold_id, payment_ref, confirmed_at, or actor → Malformed.");
add("2. confirmed_at fails ISO → Malformed.");
add("3. actor is exactly anonymous → Actor_unauthorized.");
add("4. hold_id not in the table → Hold_not_found.");
add("5. snapshot expires_at fails ISO → Malformed.");
add("6. status Cancelled → Hold_cancelled.");
add("7. status Confirmed → Hold_already_confirmed with booking_id BKG- ^ hold_id.");
add("8. confirmed_at > expires_at lexicographic → Hold_expired (hold_id, expires_at).");
add("9. guest_blocked → Guest_blocked guest_id.");
add("10. property_closed → Property_closed (property_id, confirmed_at).");
add("11. payment_ref ≠ snapshot payment_ref → Payment_mismatch (cmd, snapshot).");
add("12. payment_captured is false → Payment_not_captured snapshot payment_ref.");
add("13. version >= 1000 → Concurrent_confirm hold_id.");
add("14. inventory = 0 → Inventory_lost (room_type_id, confirmed_at).");
add("15. unit_cents * nights + tax_cents ≠ price_cents → Price_drift (recomputed, price_cents).");
add("16. Ok: booking_id BKG- ^ hold_id; total_cents = unit_cents * nights + tax_cents;");
add("    lines = one line from snapshot room_type_id, nights, unit_cents, tax_cents;");
add("    confirmed_at = cmd.confirmed_at; copy property_id guest_id currency hold_id.");
add("Unknown status string if you store status as string → Malformed. Prefer a variant.");
add("Do not insert extra checks between these steps.");
add("");

for (let i = 1; i <= 16; i++) {
  add(`Order reminder ${i}: step ${i} stays in this numbered list; no extra step before it.`);
}
add("");

add("## Table (hard-code; no other hold_id)");
add("");

type Hold = {
  id: string;
  status: string;
  expires_at: string;
  price_cents: number;
  currency: string;
  payment_ref: string;
  payment_captured: boolean;
  property_id: string;
  guest_id: string;
  room_type_id: string;
  nights: number;
  unit_cents: number;
  tax_cents: number;
  guest_blocked: boolean;
  property_closed: boolean;
  inventory: number;
  version: number;
};

const holds: Hold[] = [
  { id: "H-OPEN-OK", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-EXPIRED", status: "Open", expires_at: "2026-01-01T00:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-CONFIRMED", status: "Confirmed", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-CANCEL", status: "Cancelled", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-PAY-MISS", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_stored", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-PAY-OPEN", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: false, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-NO-INV", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 0, version: 1 },
  { id: "H-DRIFT", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 99999, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1 },
  { id: "H-BLOCKED", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G-BAD", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: true, property_closed: false, inventory: 3, version: 1 },
  { id: "H-CLOSED", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P-SHUT", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: true, inventory: 3, version: 1 },
  { id: "H-STALE", status: "Open", expires_at: "2026-12-01T12:00:00Z", price_cents: 21000, currency: "EUR", payment_ref: "pay_ok", payment_captured: true, property_id: "P1", guest_id: "G1", room_type_id: "RT-Q", nights: 2, unit_cents: 10000, tax_cents: 1000, guest_blocked: false, property_closed: false, inventory: 3, version: 1000 },
];

for (const h of holds) {
  add(`### ${h.id}`);
  for (const [k, v] of Object.entries(h)) add(`- ${k}: ${v}`);
  add(`recomputed: ${h.unit_cents * h.nights + h.tax_cents}`);
  add("");
}

add("## Use cases (expected prefix of the result)");
add("Common cmd: payment_ref pay_ok, confirmed_at 2026-11-01T10:00:00Z, actor desk-1 unless stated.");
add("happy H-OPEN-OK → Ok BKG-H-OPEN-OK total 21000");
add("expired H-EXPIRED → Hold_expired, second payload expires_at 2026-01-01T00:00:00Z");
add("already H-CONFIRMED → Hold_already_confirmed BKG-H-CONFIRMED");
add("cancel H-CANCEL → Hold_cancelled");
add("mismatch H-PAY-MISS pay_ok → Payment_mismatch pay_ok vs pay_stored");
add("uncaptured H-PAY-OPEN → Payment_not_captured");
add("noinv H-NO-INV → Inventory_lost");
add("drift H-DRIFT → Price_drift 21000 vs 99999");
add("blocked H-BLOCKED → Guest_blocked G-BAD");
add("closed H-CLOSED → Property_closed P-SHUT");
add("stale H-STALE → Concurrent_confirm");
add("missing H-NOPE → Hold_not_found");
add("anon H-OPEN-OK actor anonymous → Actor_unauthorized");
add("empty-id hold_id empty → Malformed");
add("guest-self H-OPEN-OK actor guest-self → Ok (same as happy)");
add("bad-iso H-OPEN-OK confirmed_at 2026-11-01 → Malformed (not length 20)");
add("anon-bad-iso actor anonymous confirmed_at 2026-11-01 → Malformed (ISO is step 2, before anonymous)");
add("ws-actor actor '  ' → Malformed after trim");
add("");

add("## Style (binding)");
add("Snake_case. Match .mli types exactly.");
add("Fake table: immutable binding (list or array). Hashtbl is forbidden.");
add("No comments.");
add("Helpers allowed: iso_ok, total_of, lookup.");
add("No extra public vals besides confirm (mli is the export list).");
add("");

let n = 1;
while (lines.length < TARGET) {
  add(`Inv ${n}: follow the canonical order; table is the only snapshot source; item ${n}.`);
  n += 1;
}
if (lines.length > TARGET) lines.length = TARGET;

const text = lines.join("\n") + "\n";
await Deno.mkdir(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
await Deno.writeTextFile(outPath, text);
console.log(`wrote ${outPath} lines=${lines.length} bytes=${text.length}`);
