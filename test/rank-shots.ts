#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env
/**
 * Phase 2: score compiling pours against the spec on an integer 1–1000 scale.
 * Same spec+mli body as the pour. No seed. Does not regenerate code.
 */

import { basename, dirname, fromFileUrl, join } from "jsr:@std/path@1";
import { buildPrompt, loadEnv, retryAfterSeconds } from "./heat.ts";
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

function messageText(
  msg:
    | {
      content?: string | null | Array<{ type?: string; text?: string }>;
      reasoning?: string | null;
      reasoning_content?: string | null;
    }
    | undefined,
): string {
  if (!msg) return "";
  const fromContent = typeof msg.content === "string"
    ? msg.content
    : Array.isArray(msg.content)
    ? msg.content.map((p) => (typeof p === "string" ? p : p?.text ?? "")).join("")
    : "";
  return [fromContent, msg.reasoning, msg.reasoning_content]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n");
}

function parseScore(text: string): { score: number | null; reason?: string } {
  const reasons = [...text.matchAll(/^\s*REASON\s*[:=]?\s*(.+)$/gim)];
  const reason = reasons.at(-1)?.[1]?.trim();
  const scores = [...text.matchAll(/SCORE\s*[:=]?\s*(\d{1,4})\b/gi)];
  const last = scores.at(-1);
  if (last) {
    const n = Number(last[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) return { score: n, reason };
  }
  const json = [...text.matchAll(/"score"\s*:\s*(\d{1,4})\b/g)].at(-1);
  if (json) {
    const n = Number(json[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) return { score: n, reason };
  }
  return { score: null };
}

type RankRow = {
  ml: string;
  ok: boolean;
  score: number | null;
  reason?: string;
  error?: string;
  raw?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  elapsed_ms: number;
};

async function rankOne(
  env: Record<string, string>,
  opts: {
    model: string;
    temperature: number;
    provider?: string;
    maxTokens: number;
    reasoningEffort?: string;
  },
  system: string,
  user: string,
): Promise<Omit<RankRow, "ml">> {
  const started = Date.now();
  const key = env.OPENROUTER_API_KEY;
  if (!key) {
    return { ok: false, score: null, error: "OPENROUTER_API_KEY missing", elapsed_ms: Date.now() - started };
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (opts.reasoningEffort) body.reasoning = { effort: opts.reasoningEffort };
  if (opts.provider) {
    body.provider = { order: [opts.provider], allow_fallbacks: false };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/finalclass/cast",
      "X-OpenRouter-Title": "cast-rank-test",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      score: null,
      error: `http ${res.status} non-json: ${raw.slice(0, 400)}`,
      elapsed_ms: Date.now() - started,
    };
  }
  if (!res.ok) {
    const err = json.error as { message?: string; metadata?: unknown } | undefined;
    const extra = err?.metadata ? " " + JSON.stringify(err.metadata) : "";
    return {
      ok: false,
      score: null,
      error: `http ${res.status}: ${err?.message ?? raw.slice(0, 800)}${extra}`,
      elapsed_ms: Date.now() - started,
    };
  }
  const choices = json.choices as Array<{
    finish_reason?: string;
    native_finish_reason?: string;
    message?: {
      content?: string | null | Array<{ type?: string; text?: string }>;
      reasoning?: string | null;
      reasoning_content?: string | null;
    };
    error?: { message?: string };
  }>;
  const choice = choices?.[0];
  if (choice?.error?.message) {
    return {
      ok: false,
      score: null,
      error: choice.error.message,
      elapsed_ms: Date.now() - started,
    };
  }
  const content = messageText(choice?.message);
  if (!content) {
    const keys = choice?.message ? Object.keys(choice.message).join(",") : "no-message";
    return {
      ok: false,
      score: null,
      error: `empty content finish=${choice?.finish_reason ?? "?"} msg_keys=${keys}`,
      elapsed_ms: Date.now() - started,
    };
  }
  const parsed = parseScore(content);
  const usage = (json.usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
  return {
    ok: parsed.score !== null,
    score: parsed.score,
    reason: parsed.reason,
    raw: content.slice(0, 800),
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    cost: usage.cost,
    error: parsed.score === null ? "unparseable score: " + content.slice(0, 200) : undefined,
    elapsed_ms: Date.now() - started,
  };
}

async function rankWithRetry(
  env: Record<string, string>,
  opts: {
    model: string;
    temperature: number;
    provider?: string;
    maxTokens: number;
    reasoningEffort?: string;
  },
  system: string,
  user: string,
): Promise<Omit<RankRow, "ml">> {
  let last: Omit<RankRow, "ml"> | undefined;
  for (let t = 0; t < 8; t++) {
    last = await rankOne(env, opts, system, user);
    if (last.ok || !last.error) return last;
    const wait = retryAfterSeconds(last.error);
    if (wait === null) return last;
    console.log(`rate-limit, sleep ${wait}s (try ${t + 1}/8)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  return last!;
}

async function main() {
  let dir = join(HERE, "runs");
  let specPath = join(HERE, "spec/confirm-hold-closed.md");
  let mliPath = join(HERE, "confirm-hold.mli");
  let model = "google/gemini-2.5-flash";
  let temperature = 0.3;
  let provider: string | undefined;
  let concurrency = 20;
  let maxTokens = 2048;
  let reasoningEffort: string | undefined;
  const positional: string[] = [];
  const args = Deno.args;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--spec" || a.startsWith("--spec=")) {
      const [v, ni] = take(args, i, "--spec");
      specPath = v;
      i = ni;
    } else if (a === "--mli" || a.startsWith("--mli=")) {
      const [v, ni] = take(args, i, "--mli");
      mliPath = v;
      i = ni;
    } else if (a === "--model" || a.startsWith("--model=")) {
      const [v, ni] = take(args, i, "--model");
      model = v;
      i = ni;
    } else if (a === "--temperature" || a.startsWith("--temperature=")) {
      const [v, ni] = take(args, i, "--temperature");
      temperature = Number(v);
      i = ni;
    } else if (a === "--provider" || a.startsWith("--provider=")) {
      const [v, ni] = take(args, i, "--provider");
      provider = v || undefined;
      i = ni;
    } else if (a === "--reasoning-effort" || a.startsWith("--reasoning-effort=")) {
      const [v, ni] = take(args, i, "--reasoning-effort");
      reasoningEffort = v;
      i = ni;
    } else if (a === "--concurrency" || a.startsWith("--concurrency=")) {
      const [v, ni] = take(args, i, "--concurrency");
      concurrency = Number(v);
      i = ni;
    } else if (a === "--max-tokens" || a.startsWith("--max-tokens=")) {
      const [v, ni] = take(args, i, "--max-tokens");
      maxTokens = Number(v);
      i = ni;
    } else if (a.startsWith("-")) {
      console.error("unknown flag", a);
      Deno.exit(2);
    } else {
      positional.push(a);
    }
  }
  if (positional[0]) dir = positional[0];

  const okListPath = join(dir, "compile-ok.txt");
  let mls: string[] = [];
  try {
    mls = (await Deno.readTextFile(okListPath))
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    console.error("missing", okListPath, "— run compile-shots.ts first");
    Deno.exit(1);
  }
  if (mls.length === 0) {
    console.error("compile-ok.txt empty");
    Deno.exit(1);
  }

  const env = await loadEnv();
  const spec = await Deno.readTextFile(specPath);
  const mli = await Deno.readTextFile(mliPath);
  const pour = buildPrompt(spec, mli);
  const system =
    "You score one OCaml implementation against the given specification. " +
    "Do not generate or rewrite code. Output exactly two lines.";

  console.log(
    `rank model=${model} temperature=${temperature} seed=none provider=${provider ?? "any"} n=${mls.length} concurrency=${concurrency} scale=1-1000`,
  );

  const wall0 = Date.now();
  const rows = await mapPool(mls, concurrency, async (ml) => {
    const code = await Deno.readTextFile(ml);
    const user = pour.user +
      "\n\n## Candidate implementation\n\n```ocaml\n" +
      code.trim() +
      "\n```\n\n" +
      "Score this candidate against the specification on an integer scale 1–1000. " +
      "1 means unrelated. 1000 means every spec rule is honoured, including style " +
      "(no comments, only confirm is exported, exact decision order). " +
      "Use the full range; do not cluster at 1000. Typical compiling-but-imperfect code sits 600–900. " +
      "Reply with exactly two lines and nothing else:\n" +
      "SCORE <integer>\n" +
      "REASON <one sentence>\n";
    const r = await rankWithRetry(
      env,
      { model, temperature, provider, maxTokens, reasoningEffort },
      system,
      user,
    );
    const row: RankRow = { ml, ...r };
    console.log(
      `${row.ok ? "ok" : "FAIL"} ${basename(ml)} score=${row.score ?? "-"} ${row.elapsed_ms}ms` +
        (row.reason ? ` ${row.reason}` : "") +
        (row.error && !row.ok ? ` ${row.error}` : ""),
    );
    return row;
  });
  const wall_ms = Date.now() - wall0;

  const scored = rows.filter((r) => r.score !== null) as Array<RankRow & { score: number }>;
  scored.sort((a, b) => b.score - a.score || a.ml.localeCompare(b.ml));
  const winner = scored[0] ?? null;
  const scores = scored.map((r) => r.score);
  const mean = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;

  const summary = {
    wall_ms,
    concurrency,
    model,
    temperature,
    provider: provider ?? null,
    seed: null,
    scale: "1-1000",
    n: rows.length,
    scored: scored.length,
    mean_score: mean,
    max_score: winner?.score ?? null,
    winner: winner
      ? { ml: winner.ml, score: winner.score, reason: winner.reason }
      : null,
    ranking: scored.map((r) => ({
      ml: r.ml,
      score: r.score,
      reason: r.reason,
      elapsed_ms: r.elapsed_ms,
    })),
    failures: rows.filter((r) => r.score === null),
  };
  const out = join(dir, "ranking.json");
  const slug = model.replaceAll("/", "_");
  const outModel = join(dir, `ranking-${slug}.json`);
  const payload = JSON.stringify(summary, null, 2) + "\n";
  await Deno.writeTextFile(out, payload);
  await Deno.writeTextFile(outModel, payload);
  const unique = new Set(scores).size;
  console.log(
    `\nscored ${scored.length}/${rows.length} wall_ms=${wall_ms} mean=${mean?.toFixed(1) ?? "-"} unique_scores=${unique}`,
  );
  if (winner) {
    const ties = scored.filter((r) => r.score === winner.score).length;
    console.log(`winner score=${winner.score} ties=${ties} ${winner.ml}`);
    if (winner.reason) console.log(`reason ${winner.reason}`);
  }
  console.log(`ranking ${out}`);
  console.log(`ranking ${outModel}`);
}

await main();
