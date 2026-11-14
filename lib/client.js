'use client';
import { createClient } from '@supabase/supabase-js';
let pending;
export function safeNext(value) { return value === '/admin' || /^\/auth\?code=[A-Z0-9-]{8,12}$/.test(value || '') ? value : '/account'; }
export function supabase() {
  if (!pending) pending = fetch('/assets/config.json', { cache: 'no-store' }).then(response => response.json()).then(config => {
    if (!config.supabase?.url || !config.supabase.anonKey) throw new Error('Account service is not configured yet. Please contact support.');
    return createClient(config.supabase.url, config.supabase.anonKey, { auth: { storageKey: 'pickle.supabase.session', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }).catch(error => { pending = null; throw error; });
  return pending;
}
export async function api(path, { method = 'GET', body } = {}) {
  const client = await supabase();
  const session = (await client.auth.getSession()).data.session;
  const form = body instanceof FormData;
  const response = await fetch('/api/' + path, { method, headers: { ...(form ? {} : { 'content-type': 'application/json' }), ...(session ? { authorization: 'Bearer ' + session.access_token } : {}) }, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Could not complete the request.');
  return data;
}
