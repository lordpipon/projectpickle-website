'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, LogIn, Monitor } from 'lucide-react';
import { Header, Footer } from './Chrome.jsx';
import { api, supabase } from '../lib/client.js';
function normalize(value) { const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, ''); return raw.length === 8 ? raw.slice(0, 4) + '-' + raw.slice(4) : ''; }
export default function Device() {
  const params = useSearchParams(); const router = useRouter(); const code = normalize(params.get('code') || '');
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { let alive = true; supabase().then(client => client.auth.getUser()).then(result => { if (alive) setUser(result.data.user); }).catch(error => { if (alive) setError(error.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  async function approve() { setBusy(true); setError(''); try { await api('device/approve', { method: 'POST', body: { userCode: code } }); setDone(true); } catch (error) { setError(error.message); } finally { setBusy(false); } }
  const next = '/auth?code=' + encodeURIComponent(code);
  return <div className="site-root"><Header account /><main className="device-main"><section className="device-card"><Monitor size={28} className="device-mark" />{loading ? <p role="status">Checking your session…</p> : done ? <><Check size={36} /><h1>Launcher connected.</h1><p className="muted">You can close this tab. The launcher continues automatically.</p><Link className="btn" href="/account">Your account</Link></> : !code ? <><h1>Connect your launcher.</h1><p className="muted">Enter the eight-character code from the launcher.</p><form className="stack" onSubmit={event => { event.preventDefault(); const value = normalize(String(new FormData(event.currentTarget).get('code'))); if (!value) { setError('Enter an eight-character code.'); return; } setError(''); router.replace('/auth?code=' + value); }}><input className="code-input" name="code" placeholder="ABCD-EFGH" aria-label="Launcher code" autoComplete="one-time-code" required maxLength={12} /><button className="btn btn-primary">Continue</button></form></> : !user ? <><h1>Sign in to connect.</h1><p className="muted">Sign in with your Project Pickle account, then approve this launcher.</p><div className="code-display">{code}</div><Link className="btn btn-primary" href={'/account?next=' + encodeURIComponent(next)}><LogIn size={17} /> Sign in</Link></> : <><h1>Approve your launcher.</h1><p className="muted">Only approve if your own launcher shows this exact code.</p><div className="code-display">{code}</div><button className="btn btn-primary" disabled={busy} onClick={approve}>{busy ? 'Connecting…' : 'Approve and connect'}</button></>}{error && <p className="form-error" role="alert">{error}</p>}</section></main><Footer /></div>;
}
