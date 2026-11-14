'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, LogOut, ShieldCheck } from 'lucide-react';
import { Header, Footer } from './Chrome.jsx';
import PasswordInput from './PasswordInput.jsx';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { api, supabase, safeNext } from '../lib/client.js';

export default function Account() {
  const params = useSearchParams(); const router = useRouter();
  const registering = params.get('mode') === 'register'; const currentMode = registering ? 'register' : 'login';
  const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  async function refresh() { const next = await api('account/me'); setProfile(next); return next; }
  useEffect(() => {
    let alive = true;
    (async () => { try { const client = await supabase(); if ((await client.auth.getSession()).data.session) { const next = await api('account/me'); if (alive) setProfile(next); } } catch (error) { if (alive) setMessage(error.message); } finally { if (alive) setLoading(false); } })();
    return () => { alive = false; };
  }, []);
  function mode(next) {
    setMessage(''); const query = new URLSearchParams();
    if (next === 'register') query.set('mode', 'register');
    if (safeNext(params.get('next')) !== '/account') query.set('next', safeNext(params.get('next')));
    router.replace('/account' + (query.size ? '?' + query : ''), { scroll: false });
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (registering && data.password !== data.confirmPassword) throw new Error('Passwords do not match.');
      if (registering && data.agree !== 'on') throw new Error('Accept the Terms, Privacy Policy and Rules to continue.');
      const result = await api(registering ? 'auth/register' : 'auth/login', { method: 'POST', body: data });
      const adopted = await (await supabase()).auth.setSession({ access_token: result.session.access_token, refresh_token: result.session.refresh_token });
      if (adopted.error) throw adopted.error;
      await refresh(); router.replace(safeNext(params.get('next')));
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function change(event, action) {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice(''); const form = event.currentTarget;
    try {
      await api('account/' + action, { method: 'PATCH', body: Object.fromEntries(new FormData(form)) });
      if (action === 'password') { await (await supabase()).auth.signOut({ scope: 'local' }); setProfile(null); setMessage('Password changed. Sign in with your new password.'); }
      else { await refresh(); setNotice(action === 'username' ? 'Username updated. You can change it again in seven days.' : 'Email updated.'); }
      form.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  async function upload(event) {
    const file = event.target.files?.[0]; if (!file || busy) return; setBusy(true); setNotice('');
    try { const body = new FormData(); body.set('avatar', file); await api('account/avatar', { method: 'POST', body }); await refresh(); setNotice('Profile picture updated. It will also appear in the launcher.'); }
    catch (error) { setNotice(error.message); } finally { setBusy(false); event.target.value = ''; }
  }
  const locked = profile?.user.usernameChangeAvailableAt > Date.now();
  return (
    <div className="site-root dark">
      <Header account />
      <main className="account-shell">
        {loading ? <p className="account-loading" role="status">Loading your account…</p> : !profile ? (
          <section className="account-auth">
            <div className="account-intro"><img className="account-art" src="/assets/logo.png" alt="Project Pickle" width="72" height="72" /><h1>Project<br />Pickle.</h1></div>
            <div className="account-auth-form">
              <h2>{registering ? 'Create your account.' : 'Welcome back.'}</h2>
              <p className="muted">{registering ? 'Join Project Pickle. No email code required.' : 'Sign in to your Project Pickle account.'}</p>
              <Tabs value={currentMode} onValueChange={mode} className="account-access-tabs">
                <TabsList aria-label="Account access"><TabsTrigger value="login">Sign in</TabsTrigger><TabsTrigger value="register">Create account</TabsTrigger></TabsList>
                <TabsContent value={currentMode}>
                  <form className="stack" onSubmit={submit} key={currentMode}>
                    <div className="field"><Label htmlFor="identity">{registering ? 'Email' : 'Email or username'}</Label><Input id="identity" name={registering ? 'email' : 'identity'} type={registering ? 'email' : 'text'} autoComplete={registering ? 'email' : 'username'} maxLength={254} required /></div>
                    {registering && <div className="field"><Label htmlFor="username">Username</Label><Input id="username" name="username" autoComplete="nickname" pattern="[A-Za-z0-9_]{3,20}" minLength={3} maxLength={20} required /><small>3–20 letters, numbers or underscores.</small></div>}
                    <PasswordInput name="password" minLength={registering ? 8 : 1} autoComplete={registering ? 'new-password' : 'current-password'} />
                    {registering && <><PasswordInput label="Confirm password" name="confirmPassword" minLength={8} autoComplete="new-password" /><label className="legal-agreement"><input name="agree" type="checkbox" required /><span>I agree to the <Link href="/terms" target="_blank">Terms</Link>, <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/rules" target="_blank">Rules</Link>.</span></label></>}
                    {message && <p className="form-error" role="alert">{message}</p>}
                    <Button size="lg" className="w-full" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        ) : (
          <section>
            <div className="dashboard-heading">
              <div className="profile-heading"><Avatar className="size-16 rounded-2xl"><AvatarImage src={profile.user.avatarUrl || '/assets/logo.png'} alt="Your profile picture" /><AvatarFallback>{profile.user.displayName.slice(0, 2)}</AvatarFallback></Avatar><div><p className="muted">Your account</p><h1>{profile.user.displayName}</h1></div></div>
              <Button variant="destructive" onClick={async () => { await (await supabase()).auth.signOut(); setProfile(null); }}><LogOut size={17} /> Sign out</Button>
            </div>
            <div className="dashboard-layout">
              <aside className="account-sidebar"><a href="#profile">Profile</a><a href="#security">Security</a><a href="#devices">Link a device</a>{profile.user.isAdmin && <Link href="/admin"><ShieldCheck size={15} /> Moderation</Link>}</aside>
              <div className="account-settings">
                {notice && <p className="account-feedback" role="status">{notice}</p>}
                <section className="settings-section" id="profile">
                  <h2>Profile</h2>
                  <label className="avatar-upload"><Camera size={18} /><span>{busy ? 'Please wait…' : 'Change profile picture'}</span><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} /><small>JPEG, PNG or WebP. Maximum 2 MB.</small></label>
                  <form className="settings-form" onSubmit={event => change(event, 'username')}><div className="field"><Label htmlFor="profile-name">Username</Label><Input id="profile-name" name="username" defaultValue={profile.user.displayName} key={profile.user.displayName} pattern="[A-Za-z0-9_]{3,20}" required maxLength={20} /></div><p className="muted">{locked ? `You can change your username on ${new Date(profile.user.usernameChangeAvailableAt).toLocaleDateString()}.` : 'You can change your username once every seven days.'}</p><Button variant="secondary" disabled={busy || locked}>Save username</Button></form>
                </section>
                <section className="settings-section" id="security">
                  <h2>Email &amp; security</h2>
                  <form className="settings-form" onSubmit={event => change(event, 'email')}><div className="field"><Label htmlFor="profile-email">Email</Label><Input id="profile-email" name="email" type="email" defaultValue={profile.email} required maxLength={254} /></div><PasswordInput name="currentPassword" label="Current password" /><Button variant="secondary" disabled={busy}>Update email</Button></form>
                  <form className="settings-form" onSubmit={event => change(event, 'password')}><h3>Change password</h3><PasswordInput name="currentPassword" label="Current password" /><PasswordInput name="newPassword" label="New password" autoComplete="new-password" minLength={8} /><PasswordInput name="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength={8} /><Button variant="secondary" disabled={busy}>Update password</Button></form>
                </section>
                <section className="settings-section" id="devices">
                  <h2>Connect your launcher</h2><p className="muted">Start login in the launcher and approve its code here.</p>
                  <form className="settings-form" onSubmit={event => { event.preventDefault(); const raw = String(new FormData(event.currentTarget).get('code')).replace(/[^A-Za-z0-9]/g, '').toUpperCase(); if (raw.length !== 8) { setNotice('Enter the eight-character code from your launcher.'); return; } router.push('/auth?code=' + raw.slice(0, 4) + '-' + raw.slice(4)); }}><div className="field"><Label htmlFor="device-code">Device code</Label><Input id="device-code" name="code" className="code-input" autoComplete="one-time-code" placeholder="ABCD-EFGH" maxLength={12} required /></div><Button>Review connection</Button></form>
                </section>
              </div>
            </div>
          </section>
        )}
      </main><Footer />
    </div>
  );
}
