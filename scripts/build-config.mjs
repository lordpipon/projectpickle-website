import { writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
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
const output = fileURLToPath(new URL('../public/assets/', import.meta.url));
mkdirSync(output, { recursive: true });
for (const name of readdirSync(fileURLToPath(new URL('../assets/', import.meta.url)))) {
  if (/\.(png|ico|svg|woff2)$/i.test(name) || name === 'inter-license.txt') copyFileSync(fileURLToPath(new URL('../assets/' + name, import.meta.url)), output + '/' + name);
}
const icon = new URL('../favicon.ico', import.meta.url);
if (existsSync(icon)) copyFileSync(icon, fileURLToPath(new URL('../public/favicon.ico', import.meta.url)));
writeFileSync(output + '/config.js', "// Generated at build time. Public settings only.\nwindow.PICKLE_CONFIG = " + JSON.stringify(config, null, 2) + ";\n");
writeFileSync(output + '/config.json', JSON.stringify({ supabase: { url, anonKey } }, null, 2));
console.log("Public website configuration generated. Supabase: " + (url && anonKey ? "configured" : "not configured"));
