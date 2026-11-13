import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import handler from "../api/supabase-login.mjs";

test("Vercel build exports public keys but not server-only credentials", () => {
  const root = mkdtempSync(join(tmpdir(), "pickle-public-config-"));
  mkdirSync(join(root, "scripts")); mkdirSync(join(root, "assets"));
  copyFileSync(new URL("../scripts/build-config.mjs", import.meta.url), join(root, "scripts/build-config.mjs"));
  try {
    const result = spawnSync(process.execPath, [join(root, "scripts/build-config.mjs")], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", SUPABASE_SERVICE_ROLE_KEY: "NEVER_PUBLISH_THIS" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(join(root, "assets/config.js"), "utf8");
    assert.ok(text.includes("sb_publishable_fixture"));
    assert.ok(!text.includes("NEVER_PUBLISH_THIS"));
    assert.equal(JSON.parse(readFileSync(join(root, "assets/config.json"), "utf8")).supabase.url, "https://fixture.supabase.co");
    const denied = spawnSync(process.execPath, [join(root, "scripts/build-config.mjs")], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong_key" }, encoding: "utf8" });
    assert.notEqual(denied.status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("username login resolves privately and returns only the Auth response", async () => {
  const original = globalThis.fetch;
  const oldEnv = { ...process.env };
  process.env.SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret";
  process.env.SUPABASE_ANON_KEY = "public-key";
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(calls.length === 1 ? [{ email: "private@example.com" }] : { access_token: "fixture-access", refresh_token: "fixture-refresh" })); };
  let status; let result;
  const response = { setHeader() {}, status(code) { status = code; return this; }, json(data) { result = data; return this; } };
  try {
    await handler({ method: "POST", headers: { "x-real-ip": "fixture-client" }, body: { username: "PicklePlayer", password: "correct-password" } }, response);
    assert.equal(status, 200);
    assert.equal(result.access_token, "fixture-access");
    assert.ok(!JSON.stringify(result).includes("server-secret"));
    assert.ok(!JSON.stringify(result).includes("private@example.com"));
    assert.ok(calls[0].url.includes("username=eq.pickleplayer"));
    assert.equal(JSON.parse(calls[1].init.body).email, "private@example.com");
  } finally {
    globalThis.fetch = original;
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
  }
});
