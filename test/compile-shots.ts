#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/** Compile each .ml in a dir against confirm-hold.mli. */

import { dirname, fromFileUrl, join } from "jsr:@std/path@1";

const HERE = dirname(fromFileUrl(import.meta.url));
const dir = Deno.args[0] ?? join(HERE, "runs");
const mli = Deno.args[1] ?? join(HERE, "confirm-hold.mli");
const ocamlc = Deno.env.get("OCAMLC") ?? "/home/sel/.opam/5.4.0/bin/ocamlc";

const mls: string[] = [];
for await (const e of Deno.readDir(dir)) {
  if (e.isFile && e.name.endsWith(".ml")) mls.push(join(dir, e.name));
}
mls.sort();

const work = await Deno.makeTempDir({ prefix: "cast-compile-" });
const mliDest = join(work, "confirm.mli");
await Deno.copyFile(mli, mliDest);

let ok = 0;
const fail: string[] = [];
for (const ml of mls) {
  const dest = join(work, "confirm.ml");
  await Deno.copyFile(ml, dest);
  for (const f of ["confirm.cmi", "confirm.cmo"]) {
    try {
      await Deno.remove(join(work, f));
    } catch { /* */ }
  }
  const p = new Deno.Command(ocamlc, {
    args: ["-c", "confirm.mli"],
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  });
  const mliR = await p.output();
  if (mliR.code !== 0) {
    fail.push(`${ml}: mli ${new TextDecoder().decode(mliR.stderr)}`);
    continue;
  }
  const q = new Deno.Command(ocamlc, {
    args: ["-c", "confirm.ml"],
    cwd: work,
    stdout: "piped",
    stderr: "piped",
  });
  const r = await q.output();
  if (r.code === 0) {
    ok += 1;
    console.log(`OK  ${ml}`);
  } else {
    const err = new TextDecoder().decode(r.stderr).trim().split("\n")[0];
    fail.push(`${ml}: ${err}`);
    console.log(`FAIL ${ml}  ${err}`);
  }
}

console.log(`\ncompile ${ok}/${mls.length}`);
if (fail.length) {
  const out = join(dir, "compile-fail.txt");
  await Deno.writeTextFile(out, fail.join("\n") + "\n");
  console.log(`failures ${out}`);
}
await Deno.remove(work, { recursive: true });
Deno.exit(ok === mls.length ? 0 : 1);
