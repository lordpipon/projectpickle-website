// Runs on Vercel, not in the browser. The service-role key stays server-side.
const attempts = new Map();
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: { message: "POST required." } }); }
  const ip = req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
  const attempt = attempts.get(ip) || { count: 0, reset: now + 60000 };
  attempts.set(ip, attempt);
  if (++attempt.count > 15) { res.setHeader("Retry-After", "60"); return res.status(429).json({ error: { message: "Too many attempts. Wait a minute." } }); }
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !anon) return res.status(503).json({ error: { message: "Username login needs the server-side Supabase key configured in Vercel. You can still sign in with email." } });
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch { body = null; }
  if (!body || typeof body.username !== "string" || !/^[a-z0-9_]{3,20}$/i.test(body.username) || typeof body.password !== "string" || body.password.length > 128 || !body.password) return res.status(400).json({ error: { message: "Enter your username and password." } });
  try {
    const directory = await fetch(`${url}/rest/v1/account_directory?username=eq.${encodeURIComponent(body.username.toLowerCase())}&select=email&limit=1`, { headers: { apikey: secret, ...(secret.startsWith("sb_secret_") ? {} : { authorization: `Bearer ${secret}` }) }, signal: AbortSignal.timeout(8000) });
    if (!directory.ok) return res.status(503).json({ error: { message: "Username lookup is unavailable. Check that supabase/setup.sql has been run." } });
    const rows = await directory.json();
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "content-type": "application/json" }, body: JSON.stringify({ email: rows[0]?.email || "missing-account@invalid.example", password: body.password }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(401).json({ error: { message: "Username or password is incorrect." } });
    return res.status(200).json(await response.json());
  } catch { return res.status(503).json({ error: { message: "Account service is temporarily unavailable." } }); }
}
