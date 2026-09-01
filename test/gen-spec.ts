#!/usr/bin/env -S deno run --allow-read --allow-write
/** Generate a ~5000-line ConfirmHold spec. Deterministic. Not a real SDD. */

const TARGET = 5000;
const outPath = Deno.args[0] ?? new URL("./spec/confirm-hold.md", import.meta.url).pathname;

const lines: string[] = [];
const add = (s = "") => lines.push(s);

add("# ConfirmHold");
add("");
add("This document is a bulk stand-in for the context a Cast cavity would receive:");
add("system architecture sketch, owning service, contracts it may call, use cases,");
add("library notes, and style. It describes one endpoint: HoldEngine.confirm.");
add("The implementation target is OCaml matching test/confirm-hold.mli, about 500 lines.");
add("");

add("## 1. Architecture sketch");
add("");
add("The booking system is a closed layered design. Clients talk only to Managers.");
add("Managers sequence Engines and ResourceAccess. Engines never call each other.");
add("ResourceAccess exposes atomic business verbs, never CRUD names.");
add("ConfirmHold is a cavity of HoldEngine. HoldEngine encapsulates how a hold");
add("becomes a booking. InventoryEngine encapsulates allotment math. PaymentAccess");
add("encapsulates capture/refund verbs. GuestAccess encapsulates blocklist lookup.");
add("This cavity must not open HTTP, SQL, or clocks. Time is in confirm_cmd.confirmed_at.");
add("");

for (let i = 1; i <= 40; i++) {
  add(`Arch ${i}: closed layers; no retry inside confirm; Manager owns retries.`);
}
add("");

add("## 2. Owning service: HoldEngine");
add("");
add("HoldEngine is the volatility vault for hold lifecycle: create, extend, cancel, confirm.");
add("This spec covers only confirm. Other operations are out of scope for this cavity.");
add("Holds are time-bounded reservations of inventory that are not yet bookings.");
add("Confirmation is irreversible from this cavity's point of view. Compensation is another use case.");
add("");

for (let i = 1; i <= 30; i++) {
  add(`Service ${i}: confirm stays one function returning result; no start/finish split.`);
}
add("");

add("## 3. Contracts this cavity may assume (not call)");
add("");
add("The surrounding engine has already loaded snapshots. Confirm is pure.");
add("Assumed snapshot fields the implementation may pattern-match in local types:");
add("- hold.status: Open | Expired | Confirmed | Cancelled");
add("- hold.expires_at, hold.price_cents, hold.currency, hold.payment_ref");
add("- hold.property_id, hold.guest_id, hold.room_type_id, hold.nights");
add("- hold.tax_cents, hold.unit_cents, hold.created_at");
add("Because this test cavity has no extra parameters, encode snapshot recovery as");
add("deterministic functions from hold_id in the .ml (fake in-memory tables).");
add("That stands in for ResourceAccess results.");
add("");

const verbs = [
  "InventoryAccess.reserve",
  "InventoryAccess.release",
  "PaymentAccess.capture",
  "PaymentAccess.void",
  "GuestAccess.block_status",
  "PropertyAccess.open_on",
  "BookingAccess.insert",
  "HoldAccess.load",
  "HoldAccess.mark_confirmed",
];
for (const [i, v] of verbs.entries()) {
  for (let k = 1; k <= 6; k++) {
    add(`Collab ${i + 1}.${k}: do not call ${v}; snapshot is a local table.`);
  }
}
add("");

add("## 4. Command and result");
add("");
add("confirm_cmd.hold_id identifies the hold. It is an opaque string. Do not parse it.");
add("confirm_cmd.payment_ref must equal the hold's stored payment_ref or Payment_mismatch.");
add("confirm_cmd.confirmed_at is ISO-8601 UTC. Compare as strings of equal length only if");
add("both are 20-character UTC forms ending with Z; otherwise Malformed.");
add("confirm_cmd.actor is a staff or system id. Actor \"guest-self\" is allowed.");
add("Actor \"anonymous\" is Actor_unauthorized.");
add("");
add("Success returns confirmation with booking_id = \"BKG-\" ^ hold_id.");
add("total_cents = unit_cents * nights + tax_cents.");
add("lines has exactly one line for this cavity (single room type holds only).");
add("");

add("## 5. Error catalog");
add("");
const errors: [string, string][] = [
  ["Hold_not_found", "No snapshot for hold_id."],
  ["Hold_expired", "confirmed_at is strictly after hold.expires_at."],
  ["Hold_already_confirmed", "status is Confirmed; payload is existing booking_id."],
  ["Hold_cancelled", "status is Cancelled."],
  ["Payment_mismatch", "cmd.payment_ref differs from snapshot payment_ref."],
  ["Payment_not_captured", "snapshot says payment not captured (flag payment_captured = false)."],
  ["Inventory_lost", "allotment for room_type_id on the stay dates is zero."],
  ["Price_drift", "recomputed total differs from snapshot price_cents."],
  ["Guest_blocked", "guest is on the blocklist."],
  ["Property_closed", "property is closed on confirmed_at date (calendar day UTC)."],
  ["Actor_unauthorized", "actor is anonymous or empty."],
  ["Concurrent_confirm", "snapshot version token is stale (version >= 1000 means stale)."],
  ["Malformed", "missing required snapshot fields or bad ISO timestamp."],
];
for (const [name, desc] of errors) {
  for (let k = 1; k <= 6; k++) {
    add(`Error ${name} / ${k}: ${desc} Use the variant.`);
  }
}
add("");

add("## 6. Decision order");
add("");
add("Evaluate in this exact order and return the first error:");
add("1. Malformed command (empty hold_id, empty payment_ref, empty confirmed_at, actor empty).");
add("2. Actor_unauthorized if actor is \"anonymous\".");
add("3. Hold_not_found if hold_id not in the fake table.");
add("4. Malformed if snapshot ISO fields are not 20 chars ending with Z.");
add("5. Hold_cancelled.");
add("6. Hold_already_confirmed.");
add("7. Hold_expired if confirmed_at > expires_at (lexicographic on the ISO form).");
add("8. Guest_blocked.");
add("9. Property_closed.");
add("10. Payment_mismatch.");
add("11. Payment_not_captured.");
add("12. Concurrent_confirm.");
add("13. Inventory_lost.");
add("14. Price_drift.");
add("15. Ok confirmation.");
add("");

add("## 7. Fake snapshot table (must be implemented in the .ml)");
add("");
add("Hard-code these holds. No other hold_id exists.");
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
  {
    id: "H-OPEN-OK",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-EXPIRED",
    status: "Open",
    expires_at: "2026-01-01T00:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-CONFIRMED",
    status: "Confirmed",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-CANCEL",
    status: "Cancelled",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-PAY-MISS",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_stored",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-PAY-OPEN",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: false,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-NO-INV",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 0,
    version: 1,
  },
  {
    id: "H-DRIFT",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 99999,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-BLOCKED",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G-BAD",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: true,
    property_closed: false,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-CLOSED",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P-SHUT",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: true,
    inventory: 3,
    version: 1,
  },
  {
    id: "H-STALE",
    status: "Open",
    expires_at: "2026-12-01T12:00:00Z",
    price_cents: 21000,
    currency: "EUR",
    payment_ref: "pay_ok",
    payment_captured: true,
    property_id: "P1",
    guest_id: "G1",
    room_type_id: "RT-Q",
    nights: 2,
    unit_cents: 10000,
    tax_cents: 1000,
    guest_blocked: false,
    property_closed: false,
    inventory: 3,
    version: 1000,
  },
];

for (const h of holds) {
  add(`### Snapshot ${h.id}`);
  for (const [k, v] of Object.entries(h)) {
    add(`- ${k}: ${v}`);
  }
  add(`Price check: unit_cents * nights + tax_cents = ${h.unit_cents * h.nights + h.tax_cents}; snapshot price_cents = ${h.price_cents}.`);
  add("");
}

add("## 8. Use cases");
add("");
const cases = [
  ["happy", "H-OPEN-OK", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Ok, booking_id BKG-H-OPEN-OK, total 21000"],
  ["expired", "H-EXPIRED", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Hold_expired"],
  ["already", "H-CONFIRMED", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Hold_already_confirmed BKG-H-CONFIRMED"],
  ["cancel", "H-CANCEL", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Hold_cancelled"],
  ["mismatch", "H-PAY-MISS", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Payment_mismatch"],
  ["uncaptured", "H-PAY-OPEN", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Payment_not_captured"],
  ["noinv", "H-NO-INV", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Inventory_lost"],
  ["drift", "H-DRIFT", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Price_drift"],
  ["blocked", "H-BLOCKED", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Guest_blocked"],
  ["closed", "H-CLOSED", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Property_closed"],
  ["stale", "H-STALE", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Concurrent_confirm"],
  ["missing", "H-NOPE", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Hold_not_found"],
  ["anon", "H-OPEN-OK", "pay_ok", "2026-11-01T10:00:00Z", "anonymous", "Actor_unauthorized"],
  ["empty-id", "", "pay_ok", "2026-11-01T10:00:00Z", "desk-1", "Malformed"],
];

for (const [name, hold, pay, at, actor, expect] of cases) {
  for (let k = 1; k <= 6; k++) {
    add(`UC ${name} #${k}: hold=${hold || "(empty)"} pay=${pay} at=${at} actor=${actor} => ${expect}`);
    add(`UC ${name} #${k} note: Manager collected payment; cavity only judges.`);
  }
}
add("");

add("## 9. Style and libraries");
add("");
add("OCaml 5. Standard library only. No Jane Street, no Lwt, no Eio in this cavity.");
add("Use Result. No exceptions for business errors. No Obj. No open Printf in the public path.");
add("Snake_case. Match the .mli types exactly. Do not add extra public vals.");
add("Put the fake table in a private module or let-binding. Keep confirm as the only exported val.");
add("Target about 450–550 lines including the table, helpers, and match tree.");
add("Helpers allowed: iso_ok, total_of, lookup, unauthorized.");
add("Comments: none, except if a helper's name is insufficient. Prefer none.");
add("");

for (let i = 1; i <= 40; i++) {
  add(`Style ${i}: match Open|Expired|Confirmed|Cancelled; unknown => Malformed.`);
}
add("");

add("## 10. Worked totals");
add("");
for (let nights = 1; nights <= 14; nights++) {
  for (let unit = 5000; unit <= 15000; unit += 2500) {
    for (let tax = 0; tax <= 2000; tax += 500) {
      add(`Worked total nights=${nights} unit_cents=${unit} tax_cents=${tax} => ${unit * nights + tax}.`);
    }
  }
}

add("");
add("## 11. Padding narrative (stand-in for skills / framework notes)");
add("");
let n = 1;
while (lines.length < TARGET) {
  add(
    `Ctx ${n}: stand-in for arch/skills/libs; ConfirmHold; item ${n}.`,
  );
  n += 1;
}

if (lines.length > TARGET) lines.length = TARGET;

const text = lines.join("\n") + "\n";
await Deno.mkdir(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
await Deno.writeTextFile(outPath, text);
console.log(`wrote ${outPath} lines=${lines.length} bytes=${text.length}`);
