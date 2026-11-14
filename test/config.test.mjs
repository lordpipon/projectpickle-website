import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { safeNext } from '../lib/client.js';
import { rules } from '../lib/policies.js';

test("Vercel build exports public keys but not server-only credentials", () => {
  const root = mkdtempSync(join(tmpdir(), "pickle-public-config-"));
  mkdirSync(join(root, "scripts")); mkdirSync(join(root, "assets"));
  copyFileSync(new URL("../scripts/build-config.mjs", import.meta.url), join(root, "scripts/build-config.mjs"));
  try {
    const result = spawnSync(process.execPath, [join(root, "scripts/build-config.mjs")], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", SUPABASE_SERVICE_ROLE_KEY: "NEVER_PUBLISH_THIS" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(join(root, "public/assets/config.js"), "utf8");
    assert.ok(text.includes("sb_publishable_fixture"));
    assert.ok(!text.includes("NEVER_PUBLISH_THIS"));
    assert.equal(JSON.parse(readFileSync(join(root, "public/assets/config.json"), "utf8")).supabase.url, "https://fixture.supabase.co");
    const denied = spawnSync(process.execPath, [join(root, "scripts/build-config.mjs")], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong_key" }, encoding: "utf8" });
    assert.notEqual(denied.status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('login return destinations reject open redirects', () => {
  assert.equal(safeNext('/admin'), '/admin');
  assert.equal(safeNext('/auth?code=ABCD-EFGH'), '/auth?code=ABCD-EFGH');
  for (const value of ['https://evil.example', '//evil.example', '/auth?code=ABCD-EFGH&url=https://evil.example', 'javascript:alert(1)']) assert.equal(safeNext(value), '/account');
});
test('the supplied community policy contains all ten rules', () => {
  assert.equal(rules.length, 10);
  assert.ok(rules.some(([title]) => title.includes('Account')));
  assert.ok(rules.some(([title]) => title.includes('Discord')));
});
