import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const first = (...names) => names.map((name) => process.env[name]?.trim()).find(Boolean) || "";
const url = first("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL");
const anonKey = first("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
if (anonKey.startsWith("sb_secret_")) throw new Error("A secret Supabase key must never be published to the website.");
if (anonKey.split(".").length === 3) {
  const claims = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString());
  if (claims.role !== "anon") throw new Error("Use the Supabase anon/publishable key, not a service-role key.");
}
if (url && new URL(url).protocol !== "https:") throw new Error("Supabase URL must use HTTPS.");
if (!url || !anonKey) console.warn("Supabase public configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.");
const config = {
  apiUrl: first("NEXT_PUBLIC_PICKLE_API_URL", "PICKLE_API_URL") || "https://34-32-63-8.sslip.io",
  authUrl: "https://projectpickle.xyz",
  siteUrl: "https://projectpickle.xyz",
  supabase: { url, anonKey },
  usernameLoginUrl: "/api/supabase-login",
};
writeFileSync(fileURLToPath(new URL("../assets/config.js", import.meta.url)), "// Generated at build time. Public settings only.\nwindow.PICKLE_CONFIG = " + JSON.stringify(config, null, 2) + ";\n");
writeFileSync(fileURLToPath(new URL("../assets/config.json", import.meta.url)), JSON.stringify({ supabase: { url, anonKey } }, null, 2));
console.log("Public website configuration generated. Supabase: " + (url && anonKey ? "configured" : "not configured"));
