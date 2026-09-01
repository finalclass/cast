#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env
/**
 * Cast Heat shot: OpenRouter pour of ConfirmHold from a fat spec.
 *
 * Heat = (model, temperature, seed)
 *
 *   ./test/heat.ts --heat openai/gpt-oss-20b:0:42
 *   ./test/heat.ts --model openai/gpt-oss-20b --temperature 0 --seed 42 --repeat 2
 *   ./test/heat.ts --provider groq --heat meta-llama/llama-3.1-8b-instant:0:1
 *
 * OPENROUTER_API_KEY from env or ../../fc/.env.local / .env.local (export KEY= ok).
 */

import { dirname, fromFileUrl, join } from "jsr:@std/path@1";

const HERE = dirname(fromFileUrl(import.meta.url));
const ROOT = join(HERE, "..");

type Heat = { model: string; temperature: number; seed: number };

type Opts = {
  heat: Heat;
  provider?: string;
  repeat: number;
  spec: string;
  mli: string;
  outDir: string;
  maxTokens: number;
  dryRun: boolean;
  requireParameters: boolean;
};

function parseSimpleEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();
    if (!line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function loadEnv(): Promise<Record<string, string>> {
  const merged: Record<string, string> = { ...Deno.env.toObject() };
  const candidates = [
    join(ROOT, ".env.local"),
    join(HERE, ".env.local"),
    "/home/sel/fc/.env.local",
  ];
  for (const p of candidates) {
    try {
      const parsed = parseSimpleEnv(await Deno.readTextFile(p));
      for (const [k, v] of Object.entries(parsed)) {
        if (merged[k] === undefined) merged[k] = v;
      }
    } catch {
      // missing is fine
    }
  }
  return merged;
}

function usage(): never {
  console.log(`usage: ./test/heat.ts --heat MODEL:TEMP:SEED [flags]
   or: ./test/heat.ts --model MODEL --temperature T --seed S [flags]

flags:
  --provider=groq     pin OpenRouter provider (no fallbacks)
  --repeat=N          same heat N times (default 1)
  --spec=PATH         default test/spec/confirm-hold.md
  --mli=PATH          default test/confirm-hold.mli
  --out-dir=PATH      default test/runs
  --max-tokens=N      default 8000
  --dry-run           print prompt stats, no HTTP
  --no-require-params do not set provider.require_parameters
`);
  Deno.exit(2);
}

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

function parseHeat(raw: string): Heat {
  const parts = raw.split(":");
  if (parts.length < 3) {
    console.error("heat must be MODEL:TEMP:SEED");
    Deno.exit(1);
  }
  const seedStr = parts.pop()!;
  const tempStr = parts.pop()!;
  return { model: parts.join(":"), temperature: Number(tempStr), seed: Number(seedStr) };
}

function parseArgs(args: string[]): Opts {
  let model = "";
  let temperature = 0;
  let seed = 0;
  let sawHeat = false;
  let sawModel = false;
  let provider: string | undefined;
  let repeat = 1;
  let spec = join(HERE, "spec/confirm-hold.md");
  let mli = join(HERE, "confirm-hold.mli");
  let outDir = join(HERE, "runs");
  let maxTokens = 8000;
  let dryRun = false;
  let requireParameters = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") usage();
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--no-require-params") requireParameters = false;
    else if (a === "--heat" || a.startsWith("--heat=")) {
      const [v, ni] = take(args, i, "--heat");
      const h = parseHeat(v);
      model = h.model;
      temperature = h.temperature;
      seed = h.seed;
      sawHeat = true;
      i = ni;
    } else if (a === "--model" || a.startsWith("--model=")) {
      const [v, ni] = take(args, i, "--model");
      model = v;
      sawModel = true;
      i = ni;
    } else if (a === "--temperature" || a.startsWith("--temperature=")) {
      const [v, ni] = take(args, i, "--temperature");
      temperature = Number(v);
      i = ni;
    } else if (a === "--seed" || a.startsWith("--seed=")) {
      const [v, ni] = take(args, i, "--seed");
      seed = Number(v);
      i = ni;
    } else if (a === "--provider" || a.startsWith("--provider=")) {
      const [v, ni] = take(args, i, "--provider");
      provider = v;
      i = ni;
    } else if (a === "--repeat" || a.startsWith("--repeat=")) {
      const [v, ni] = take(args, i, "--repeat");
      repeat = Number(v);
      i = ni;
    } else if (a === "--spec" || a.startsWith("--spec=")) {
      const [v, ni] = take(args, i, "--spec");
      spec = v;
      i = ni;
    } else if (a === "--mli" || a.startsWith("--mli=")) {
      const [v, ni] = take(args, i, "--mli");
      mli = v;
      i = ni;
    } else if (a === "--out-dir" || a.startsWith("--out-dir=")) {
      const [v, ni] = take(args, i, "--out-dir");
      outDir = v;
      i = ni;
    } else if (a === "--max-tokens" || a.startsWith("--max-tokens=")) {
      const [v, ni] = take(args, i, "--max-tokens");
      maxTokens = Number(v);
      i = ni;
    } else {
      console.error("unknown flag", a);
      usage();
    }
  }

  if (!sawHeat && !sawModel) usage();
  if (!model) {
    console.error("model required");
    Deno.exit(1);
  }
  if (!Number.isFinite(temperature) || !Number.isInteger(seed)) {
    console.error("temperature must be a number, seed an integer");
    Deno.exit(1);
  }
  if (!Number.isInteger(repeat) || repeat < 1) {
    console.error("repeat must be integer >= 1");
    Deno.exit(1);
  }

  return {
    heat: { model, temperature, seed },
    provider,
    repeat,
    spec,
    mli,
    outDir,
    maxTokens,
    dryRun,
    requireParameters,
  };
}

function slugHeat(h: Heat): string {
  const m = h.model.replaceAll("/", "_");
  return `${m}-t${h.temperature}-s${h.seed}`;
}

function stripFences(s: string): string {
  let t = s.trim();
  const re = /^```(?:ocaml|ml|markdown)?\s*\n([\s\S]*?)\n```\s*$/;
  const m = t.match(re);
  if (m) t = m[1];
  return t.replace(/^\uFEFF/, "");
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildPrompt(spec: string, mli: string): { system: string; user: string } {
  const system =
    "You generate OCaml. Output only the contents of a single .ml file. " +
    "No markdown fences, no commentary before or after. " +
    "Implement exactly the given .mli. Target about 500 lines. " +
    "Standard library only. Business errors are result variants, not exceptions.";
  const user =
    "Implement ConfirmHold in OCaml.\n\n" +
    "## Interface (binding)\n\n```ocaml\n" +
    mli.trim() +
    "\n```\n\n## Specification\n\n" +
    spec;
  return { system, user };
}

type ShotMeta = {
  heat: Heat;
  provider?: string;
  attempt: number;
  ok: boolean;
  error?: string;
  sha256?: string;
  lines?: number;
  bytes?: number;
  finish_reason?: string;
  native_finish_reason?: string;
  model_served?: string;
  system_fingerprint?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  elapsed_ms: number;
  out_file?: string;
};

async function shot(
  opts: Opts,
  env: Record<string, string>,
  system: string,
  user: string,
  attempt: number,
): Promise<ShotMeta> {
  const started = Date.now();
  const key = env.OPENROUTER_API_KEY;
  if (!key) {
    return {
      heat: opts.heat,
      provider: opts.provider,
      attempt,
      ok: false,
      error: "OPENROUTER_API_KEY missing",
      elapsed_ms: Date.now() - started,
    };
  }

  const body: Record<string, unknown> = {
    model: opts.heat.model,
    temperature: opts.heat.temperature,
    seed: opts.heat.seed,
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  const provider: Record<string, unknown> = {};
  if (opts.provider) {
    provider.order = [opts.provider];
    provider.allow_fallbacks = false;
  }
  if (opts.requireParameters) provider.require_parameters = true;
  if (Object.keys(provider).length) body.provider = provider;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/finalclass/cast",
      "X-OpenRouter-Title": "cast-heat-test",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      heat: opts.heat,
      provider: opts.provider,
      attempt,
      ok: false,
      error: `http ${res.status} non-json: ${raw.slice(0, 400)}`,
      elapsed_ms: Date.now() - started,
    };
  }

  if (!res.ok) {
    const err = json.error as { message?: string; metadata?: unknown } | undefined;
    const extra = err?.metadata ? " " + JSON.stringify(err.metadata) : "";
    return {
      heat: opts.heat,
      provider: opts.provider,
      attempt,
      ok: false,
      error: `http ${res.status}: ${err?.message ?? raw.slice(0, 800)}${extra}`,
      elapsed_ms: Date.now() - started,
    };
  }

  const choices = json.choices as Array<{
    finish_reason?: string;
    native_finish_reason?: string;
    message?: { content?: string | null };
    error?: { message?: string };
  }>;
  const choice = choices?.[0];
  if (choice?.error?.message) {
    return {
      heat: opts.heat,
      provider: opts.provider,
      attempt,
      ok: false,
      error: choice.error.message,
      elapsed_ms: Date.now() - started,
    };
  }
  const content = choice?.message?.content;
  if (!content) {
    return {
      heat: opts.heat,
      provider: opts.provider,
      attempt,
      ok: false,
      error: "empty content",
      finish_reason: choice?.finish_reason,
      elapsed_ms: Date.now() - started,
    };
  }

  const code = stripFences(content);
  const hash = await sha256(code);
  const usage = (json.usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };

  await Deno.mkdir(opts.outDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const base = `${slugHeat(opts.heat)}-a${attempt}-${stamp}`;
  const outFile = join(opts.outDir, `${base}.ml`);
  await Deno.writeTextFile(outFile, code);

  const meta: ShotMeta = {
    heat: opts.heat,
    provider: opts.provider,
    attempt,
    ok: true,
    sha256: hash,
    lines: code.split("\n").length,
    bytes: code.length,
    finish_reason: choice?.finish_reason,
    native_finish_reason: choice?.native_finish_reason,
    model_served: typeof json.model === "string" ? json.model : undefined,
    system_fingerprint: typeof json.system_fingerprint === "string"
      ? json.system_fingerprint
      : undefined,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    cost: usage.cost,
    elapsed_ms: Date.now() - started,
    out_file: outFile,
  };
  await Deno.writeTextFile(join(opts.outDir, `${base}.json`), JSON.stringify(meta, null, 2) + "\n");
  return meta;
}

async function main() {
  const opts = parseArgs(Deno.args);
  const env = await loadEnv();
  const spec = await Deno.readTextFile(opts.spec);
  const mli = await Deno.readTextFile(opts.mli);
  const specLines = spec.split("\n").length;
  const { system, user } = buildPrompt(spec, mli);

  console.log(`heat model=${opts.heat.model} temperature=${opts.heat.temperature} seed=${opts.heat.seed}`);
  if (opts.provider) console.log(`provider=${opts.provider} (pinned, no fallbacks)`);
  console.log(`spec ${opts.spec} lines=${specLines} bytes=${spec.length}`);
  console.log(`mli  ${opts.mli}`);
  console.log(`prompt chars≈${system.length + user.length} repeat=${opts.repeat}`);

  if (opts.dryRun) {
    console.log("dry-run: no HTTP");
    return;
  }

  const results: ShotMeta[] = [];
  for (let i = 1; i <= opts.repeat; i++) {
    console.log(`\nshot ${i}/${opts.repeat}`);
    const r = await shot(opts, env, system, user, i);
    results.push(r);
    if (!r.ok) console.log(`FAIL ${r.error}`);
    else {
      console.log(`ok sha256=${r.sha256} lines=${r.lines} tokens=${r.prompt_tokens}+${r.completion_tokens} ${r.elapsed_ms}ms`);
      if (r.out_file) console.log(`  ${r.out_file}`);
    }
  }

  const hashes = results.filter((r) => r.ok && r.sha256).map((r) => r.sha256!);
  if (opts.repeat > 1) {
    const unique = new Set(hashes);
    console.log(`\nidentical=${unique.size === 1 && hashes.length === opts.repeat} unique_hashes=${unique.size} ok=${hashes.length}/${opts.repeat}`);
    for (const h of unique) console.log(`  ${h}`);
  }
}

if (import.meta.main) {
  await main();
}
