#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/** Compile each .ml in a dir against confirm-hold.mli. */

import { basename, dirname, fromFileUrl, join } from "jsr:@std/path@1";
import { mapPool } from "./pool.ts";

const HERE = dirname(fromFileUrl(import.meta.url));

function take(args: string[], i: number, flag: string): [string, number] {
  const a = args[i];
  if (a === flag) {
    const v = args[i + 1];
    if (!v || v.startsWith("--")) {
      console.error(`${flag} needs a value`);
      Deno.exit(1);
    }
    return [v, i + 1];
  }
  if (a.startsWith(flag + "=")) return [a.slice(flag.length + 1), i];
  throw new Error("not this flag");
}

type CompileRow = {
  ml: string;
  ok: boolean;
  error?: string;
  elapsed_ms: number;
};

async function compileOne(
  ml: string,
  mli: string,
  ocamlc: string,
): Promise<CompileRow> {
  const started = Date.now();
  const work = await Deno.makeTempDir({ prefix: "cast-compile-" });
  try {
    await Deno.copyFile(mli, join(work, "confirm.mli"));
    await Deno.copyFile(ml, join(work, "confirm.ml"));
    const mliR = await new Deno.Command(ocamlc, {
      args: ["-c", "confirm.mli"],
      cwd: work,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (mliR.code !== 0) {
      return {
        ml,
        ok: false,
        error: "mli " + new TextDecoder().decode(mliR.stderr).trim().split("\n")[0],
        elapsed_ms: Date.now() - started,
      };
    }
    const r = await new Deno.Command(ocamlc, {
      args: ["-c", "confirm.ml"],
      cwd: work,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (r.code === 0) {
      return { ml, ok: true, elapsed_ms: Date.now() - started };
    }
    const err = new TextDecoder().decode(r.stderr).trim().split("\n")[0];
    return { ml, ok: false, error: err, elapsed_ms: Date.now() - started };
  } finally {
    await Deno.remove(work, { recursive: true });
  }
}

async function main() {
  let dir = join(HERE, "runs");
  let mli = join(HERE, "confirm-hold.mli");
  let concurrency = 1;
  const positional: string[] = [];
  const args = Deno.args;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--concurrency" || a.startsWith("--concurrency=")) {
      const [v, ni] = take(args, i, "--concurrency");
      concurrency = Number(v);
      i = ni;
    } else if (a === "--mli" || a.startsWith("--mli=")) {
      const [v, ni] = take(args, i, "--mli");
      mli = v;
      i = ni;
    } else if (a.startsWith("-")) {
      console.error("unknown flag", a);
      Deno.exit(2);
    } else {
      positional.push(a);
    }
  }
  if (positional[0]) dir = positional[0];
  if (positional[1]) mli = positional[1];
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    console.error("concurrency must be integer >= 1");
    Deno.exit(1);
  }

  const ocamlc = Deno.env.get("OCAMLC") ?? "/home/sel/.opam/5.4.0/bin/ocamlc";
  const mls: string[] = [];
  for await (const e of Deno.readDir(dir)) {
    if (e.isFile && e.name.endsWith(".ml")) mls.push(join(dir, e.name));
  }
  mls.sort();

  const wall0 = Date.now();
  const rows = await mapPool(mls, concurrency, async (ml) => {
    const row = await compileOne(ml, mli, ocamlc);
    if (row.ok) console.log(`OK  ${basename(ml)} ${row.elapsed_ms}ms`);
    else console.log(`FAIL ${basename(ml)}  ${row.error}`);
    return row;
  });
  const wall_ms = Date.now() - wall0;
  const okRows = rows.filter((r) => r.ok);
  const failRows = rows.filter((r) => !r.ok);
  console.log(`\ncompile ${okRows.length}/${mls.length} wall_ms=${wall_ms} concurrency=${concurrency}`);

  await Deno.writeTextFile(
    join(dir, "compile-ok.txt"),
    okRows.map((r) => r.ml).join("\n") + (okRows.length ? "\n" : ""),
  );
  if (failRows.length) {
    await Deno.writeTextFile(
      join(dir, "compile-fail.txt"),
      failRows.map((r) => `${r.ml}: ${r.error}`).join("\n") + "\n",
    );
    console.log(`failures ${join(dir, "compile-fail.txt")}`);
  }
  await Deno.writeTextFile(
    join(dir, "compile.json"),
    JSON.stringify(
      { wall_ms, concurrency, ok: okRows.length, n: mls.length, results: rows },
      null,
      2,
    ) + "\n",
  );
  Deno.exit(okRows.length === mls.length ? 0 : 1);
}

await main();
