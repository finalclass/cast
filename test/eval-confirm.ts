#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/** Compile a ConfirmHold .ml against the die and run the spec use cases. */

import { dirname, fromFileUrl, join } from "jsr:@std/path@1";

const HERE = dirname(fromFileUrl(import.meta.url));
const mli = Deno.args[1] ?? join(HERE, "confirm-hold.mli");
const ml = Deno.args[0];
if (!ml) {
  console.error("usage: ./test/eval-confirm.ts BODY.ml [DIE.mli]");
  Deno.exit(2);
}

const ocamlc = Deno.env.get("OCAMLC") ?? "/home/sel/.opam/5.4.0/bin/ocamlc";
const work = await Deno.makeTempDir({ prefix: "cast-eval-" });

const driver = `
open Confirm

let cmd hold_id payment_ref confirmed_at actor =
  { hold_id; payment_ref; confirmed_at; actor }

let common hold = cmd hold "pay_ok" "2026-11-01T10:00:00Z" "desk-1"

let show = function
  | Ok c -> Printf.sprintf "Ok %s total %d" c.booking_id c.total_cents
  | Error (Hold_not_found id) -> "Hold_not_found " ^ id
  | Error (Hold_expired (id, exp)) -> Printf.sprintf "Hold_expired %s %s" id exp
  | Error (Hold_already_confirmed s) -> "Hold_already_confirmed " ^ s
  | Error (Hold_cancelled id) -> "Hold_cancelled " ^ id
  | Error (Payment_mismatch (a, b)) -> Printf.sprintf "Payment_mismatch %s vs %s" a b
  | Error (Payment_not_captured p) -> "Payment_not_captured " ^ p
  | Error (Inventory_lost (rt, t)) -> Printf.sprintf "Inventory_lost %s %s" rt t
  | Error (Price_drift (a, b)) -> Printf.sprintf "Price_drift %d vs %d" a b
  | Error (Guest_blocked g) -> "Guest_blocked " ^ g
  | Error (Property_closed (p, t)) -> Printf.sprintf "Property_closed %s %s" p t
  | Error (Actor_unauthorized a) -> "Actor_unauthorized " ^ a
  | Error (Concurrent_confirm id) -> "Concurrent_confirm " ^ id
  | Error (Malformed s) -> "Malformed " ^ s

let check name got want_prefix =
  let g = show got in
  let ok =
    String.length g >= String.length want_prefix
    && String.sub g 0 (String.length want_prefix) = want_prefix
  in
  Printf.printf "%s %s  got=%s\\n" (if ok then "PASS" else "FAIL") name g;
  if ok then 0 else 1

let () =
  let n = 0 in
  let n = n + check "happy" (confirm (common "H-OPEN-OK")) "Ok BK-H-OPEN-OK total 21000" in
  let n = n + check "expired" (confirm (common "H-EXPIRED")) "Hold_expired H-EXPIRED 2026-01-01T00:00:00Z" in
  let n = n + check "already" (confirm (common "H-CONFIRMED")) "Hold_already_confirmed BK-H-CONFIRMED" in
  let n = n + check "cancel" (confirm (common "H-CANCEL")) "Hold_cancelled" in
  let n = n + check "mismatch" (confirm (cmd "H-PAY-MISS" "pay_ok" "2026-11-01T10:00:00Z" "desk-1")) "Payment_mismatch pay_ok vs pay_stored" in
  let n = n + check "uncaptured" (confirm (common "H-PAY-OPEN")) "Payment_not_captured" in
  let n = n + check "noinv" (confirm (common "H-NO-INV")) "Inventory_lost" in
  let n = n + check "drift" (confirm (common "H-DRIFT")) "Price_drift 21000 vs 99999" in
  let n = n + check "blocked" (confirm (common "H-BLOCKED")) "Guest_blocked G-BAD" in
  let n = n + check "closed" (confirm (common "H-CLOSED")) "Property_closed P-SHUT" in
  let n = n + check "stale" (confirm (common "H-STALE")) "Concurrent_confirm" in
  let n = n + check "missing" (confirm (common "H-NOPE")) "Hold_not_found" in
  let n = n + check "anon" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "anonymous")) "Actor_unauthorized" in
  let n = n + check "empty-id" (confirm (cmd "" "pay_ok" "2026-11-01T10:00:00Z" "desk-1")) "Malformed" in
  let n = n + check "guest-self" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "guest-self")) "Ok BK-H-OPEN-OK total 21000" in
  let n = n + check "bad-iso" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01" "desk-1")) "Malformed" in
  let n = n + check "anon-bad-iso" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01" "anonymous")) "Malformed" in
  let n = n + check "ws-actor" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "  ")) "Malformed" in
  exit n
`;

try {
  const src = await Deno.readTextFile(ml);
  const comments = (src.match(/\(\*/g) ?? []).length;
  const hashtbl = /\bHashtbl\b/.test(src);
  console.log(`lint comments=${comments} hashtbl=${hashtbl ? 1 : 0}`);

  await Deno.copyFile(mli, join(work, "confirm.mli"));
  await Deno.copyFile(ml, join(work, "confirm.ml"));
  await Deno.writeTextFile(join(work, "driver.ml"), driver);

  const mliR = await new Deno.Command(ocamlc, {
    args: ["-c", "confirm.mli"],
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (mliR.code !== 0) {
    console.log("COMPILE_FAIL mli " + new TextDecoder().decode(mliR.stderr));
    Deno.exit(1);
  }
  const mlR = await new Deno.Command(ocamlc, {
    args: ["-c", "confirm.ml"],
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (mlR.code !== 0) {
    console.log("COMPILE_FAIL " + new TextDecoder().decode(mlR.stderr).trim().split("\n")[0]);
    Deno.exit(1);
  }
  console.log("COMPILE_OK");
  const link = await new Deno.Command(ocamlc, {
    args: ["-o", "driver", "confirm.cmo", "driver.ml"],
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (link.code !== 0) {
    console.log("LINK_FAIL " + new TextDecoder().decode(link.stderr));
    Deno.exit(1);
  }
  const run = await new Deno.Command(join(work, "driver"), {
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const out = new TextDecoder().decode(run.stdout) + new TextDecoder().decode(run.stderr);
  console.log(out.trimEnd());
  const fails = (out.match(/^FAIL /gm) ?? []).length;
  const passes = (out.match(/^PASS /gm) ?? []).length;
  console.log(`cases ${passes} pass, ${fails} fail`);
  if (comments > 0 || hashtbl) {
    console.log("LINT_FAIL");
    Deno.exit(1);
  }
  Deno.exit(run.code === 0 && fails === 0 ? 0 : 1);
} finally {
  await Deno.remove(work, { recursive: true });
}
