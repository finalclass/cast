#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/** Compile a two-cavity body against Hold + Confirm|Cancel and run cases. */

import { dirname, fromFileUrl, join } from "jsr:@std/path@1";

const HERE = dirname(fromFileUrl(import.meta.url));
const cavity = Deno.args[0];
const ml = Deno.args[1];
if ((cavity !== "confirm" && cavity !== "cancel") || !ml) {
  console.error("usage: ./test/two/eval-two.ts confirm|cancel BODY.ml");
  Deno.exit(2);
}

const ocamlc = Deno.env.get("OCAMLC") ?? "/home/sel/.opam/5.4.0/bin/ocamlc";
const work = await Deno.makeTempDir({ prefix: "cast-two-" });

const confirmDriver = `
open Hold
open Confirm

let cmd hold_id payment_ref at actor note =
  { hold_id; payment_ref; stamp = { at; actor; note } }

let common hold = cmd hold "pay_ok" "2026-11-01T10:00:00Z" "desk-1" "n1"

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
  let n = n + check "mismatch" (confirm (cmd "H-PAY-MISS" "pay_ok" "2026-11-01T10:00:00Z" "desk-1" "n1")) "Payment_mismatch pay_ok vs pay_stored" in
  let n = n + check "uncaptured" (confirm (common "H-PAY-OPEN")) "Payment_not_captured" in
  let n = n + check "noinv" (confirm (common "H-NO-INV")) "Inventory_lost" in
  let n = n + check "drift" (confirm (common "H-DRIFT")) "Price_drift 21000 vs 99999" in
  let n = n + check "blocked" (confirm (common "H-BLOCKED")) "Guest_blocked G-BAD" in
  let n = n + check "closed" (confirm (common "H-CLOSED")) "Property_closed P-SHUT" in
  let n = n + check "stale" (confirm (common "H-STALE")) "Concurrent_confirm" in
  let n = n + check "missing" (confirm (common "H-NOPE")) "Hold_not_found" in
  let n = n + check "anon" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "anonymous" "n1")) "Actor_unauthorized" in
  let n = n + check "kiosk" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "kiosk" "n1")) "Actor_unauthorized" in
  let n = n + check "empty-id" (confirm (cmd "" "pay_ok" "2026-11-01T10:00:00Z" "desk-1" "n1")) "Malformed" in
  let n = n + check "guest-self" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "guest-self" "n1")) "Ok BK-H-OPEN-OK total 21000" in
  let n = n + check "bad-iso" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01" "desk-1" "n1")) "Malformed" in
  let n = n + check "anon-bad-iso" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01" "anonymous" "n1")) "Malformed" in
  let n = n + check "ws-actor" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "  " "n1")) "Malformed" in
  let n = n + check "empty-note" (confirm (cmd "H-OPEN-OK" "pay_ok" "2026-11-01T10:00:00Z" "desk-1" "")) "Malformed" in
  exit n
`;

const cancelDriver = `
open Hold
open Cancel

let cmd hold_id at actor reason note =
  { hold_id; stamp = { at; actor; note }; reason }

let common hold = cmd hold "2026-11-01T10:00:00Z" "desk-1" "user" "n1"

let show = function
  | Ok () -> "Ok"
  | Error (Hold_not_found id) -> "Hold_not_found " ^ id
  | Error (Hold_cancelled id) -> "Hold_cancelled " ^ id
  | Error (Hold_already_confirmed s) -> "Hold_already_confirmed " ^ s
  | Error (Actor_unauthorized a) -> "Actor_unauthorized " ^ a
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
  let n = n + check "happy" (cancel (common "H-OPEN-OK")) "Ok" in
  let n = n + check "already-cancel" (cancel (common "H-CANCEL")) "Hold_cancelled" in
  let n = n + check "already-conf" (cancel (common "H-CONFIRMED")) "Hold_already_confirmed BK-H-CONFIRMED" in
  let n = n + check "missing" (cancel (common "H-NOPE")) "Hold_not_found" in
  let n = n + check "anon" (cancel (cmd "H-OPEN-OK" "2026-11-01T10:00:00Z" "anonymous" "user" "n1")) "Actor_unauthorized" in
  let n = n + check "kiosk" (cancel (cmd "H-OPEN-OK" "2026-11-01T10:00:00Z" "kiosk" "user" "n1")) "Actor_unauthorized" in
  let n = n + check "empty-id" (cancel (cmd "" "2026-11-01T10:00:00Z" "desk-1" "user" "n1")) "Malformed" in
  let n = n + check "empty-reason" (cancel (cmd "H-OPEN-OK" "2026-11-01T10:00:00Z" "desk-1" "" "n1")) "Malformed" in
  let n = n + check "bad-iso" (cancel (cmd "H-OPEN-OK" "2026-11-01" "desk-1" "user" "n1")) "Malformed" in
  let n = n + check "ws-actor" (cancel (cmd "H-OPEN-OK" "2026-11-01T10:00:00Z" "  " "user" "n1")) "Malformed" in
  let n = n + check "empty-note" (cancel (cmd "H-OPEN-OK" "2026-11-01T10:00:00Z" "desk-1" "user" "")) "Malformed" in
  exit n
`;

async function run(cmd: string, args: string[]): Promise<{ code: number; err: string; out: string }> {
  const r = await new Deno.Command(cmd, {
    args,
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: r.code,
    out: new TextDecoder().decode(r.stdout),
    err: new TextDecoder().decode(r.stderr),
  };
}

try {
  const src = await Deno.readTextFile(ml);
  const comments = (src.match(/\(\*/g) ?? []).length;
  const hashtbl = /\bHashtbl\b/.test(src);
  console.log(`lint comments=${comments} hashtbl=${hashtbl ? 1 : 0}`);

  await Deno.copyFile(join(HERE, "hold.mli"), join(work, "hold.mli"));
  const mliName = cavity === "confirm" ? "confirm.mli" : "cancel.mli";
  await Deno.copyFile(join(HERE, mliName), join(work, mliName));
  await Deno.copyFile(ml, join(work, cavity === "confirm" ? "confirm.ml" : "cancel.ml"));
  await Deno.writeTextFile(join(work, "driver.ml"), cavity === "confirm" ? confirmDriver : cancelDriver);

  for (const f of ["hold.mli", mliName]) {
    const r = await run(ocamlc, ["-c", f]);
    if (r.code !== 0) {
      console.log("COMPILE_FAIL " + f + " " + r.err.trim().split("\n")[0]);
      Deno.exit(1);
    }
  }
  const body = cavity === "confirm" ? "confirm.ml" : "cancel.ml";
  const r = await run(ocamlc, ["-c", body]);
  if (r.code !== 0) {
    console.log("COMPILE_FAIL " + r.err.trim().split("\n")[0]);
    Deno.exit(1);
  }
  console.log("COMPILE_OK");
  const cmo = cavity === "confirm" ? "confirm.cmo" : "cancel.cmo";
  const link = await run(ocamlc, ["-o", "driver", cmo, "driver.ml"]);
  if (link.code !== 0) {
    console.log("LINK_FAIL " + link.err.trim().split("\n")[0]);
    Deno.exit(1);
  }
  const exe = await run(join(work, "driver"), []);
  const out = (exe.out + exe.err).trimEnd();
  console.log(out);
  const fails = (out.match(/^FAIL /gm) ?? []).length;
  const passes = (out.match(/^PASS /gm) ?? []).length;
  console.log(`cases ${passes} pass, ${fails} fail`);
  if (comments > 0 || hashtbl) {
    console.log("LINT_FAIL");
    Deno.exit(1);
  }
  Deno.exit(exe.code === 0 && fails === 0 ? 0 : 1);
} finally {
  await Deno.remove(work, { recursive: true });
}
