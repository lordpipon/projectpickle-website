import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const apiOrigin = () => (process.env.PICKLE_API_URL || 'https://34-32-63-8.sslip.io').replace(/\/+$/, '');
function settings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) throw new HttpError(503, 'Account service is not configured. Please contact support.');
  return { url, anon, secret };
}
const client = (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function backend(path, { token, service = false, method = 'GET', body } = {}) {
  const response = await fetch(apiOrigin() + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(service ? { 'x-pickle-service-key': settings().secret } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new HttpError(response.status, data.error?.message || 'The account backend could not complete the request.');
  return data;
}
export async function identity(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  const { url, anon } = settings();
  const { data, error } = await client(url, anon).auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  return { token, user: data.user };
}
export async function register(request, body) {
  if (body.agree !== 'on' && body.agree !== true) throw new HttpError(400, 'Accept the Terms, Privacy Policy and Rules to continue.');
  const { email, username, password, confirmPassword } = body;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 128 || password !== confirmPassword) throw new HttpError(400, 'Use a valid email, a 3–20 character username, and matching passwords of at least 8 characters.');
  const { url, anon, secret } = settings();
  // Vercel supplies this IP header. Raw addresses are never persisted on the VPS.
  const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for'))?.split(',')[0]?.trim() || (!process.env.VERCEL ? request.headers.get('x-real-ip') : null);
  if (!ip && process.env.VERCEL) throw new HttpError(503, 'Could not verify this connection. Please try again.');
  const ipHash = createHmac('sha256', process.env.RATE_LIMIT_SECRET || secret).update(ip || 'local-development').digest('hex');
  const reservation = await backend('/api/web/registration/reserve', { service: true, method: 'POST', body: { ipHash, email: email.trim().toLowerCase(), username } });
  const admin = client(url, secret); let createdId;
  try {
    const created = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { username } });
    if (created.error) throw new HttpError(/already|registered|exists|duplicate/i.test(created.error.message) ? 409 : 400, /already|registered|exists|duplicate/i.test(created.error.message) ? 'An account with this email or username already exists. Sign in instead.' : created.error.message);
    createdId = created.data.user.id;
    await backend('/api/web/registration/complete', { service: true, method: 'POST', body: { reservationId: reservation.reservationId, userId: createdId } });
    const session = await client(url, anon).auth.signInWithPassword({ email: email.trim(), password });
    if (session.error) throw new HttpError(400, 'Account created. Please sign in with your password.');
    return { session: session.data.session };
  } catch (error) {
    if (createdId) {
      // Do not delete a completed account if only the response or sign-in failed.
      const existing = await backend('/api/web/accounts/lookup?username=' + encodeURIComponent(username), { service: true }).catch(() => null);
      if (existing?.id !== createdId) await admin.auth.admin.deleteUser(createdId);
    }
    await backend('/api/web/registration/release', { service: true, method: 'POST', body: { reservationId: reservation.reservationId } }).catch(() => {});
    throw error;
  }
}
export async function login(body) {
  if (typeof body.identity !== 'string' || body.identity.length > 254 || typeof body.password !== 'string' || !body.password || body.password.length > 128) throw new HttpError(400, 'Enter your email or username and password.');
  const { url, anon, secret } = settings();
  let email = body.identity.trim();
  if (!email.includes('@')) {
    const account = await backend('/api/web/accounts/lookup?username=' + encodeURIComponent(email), { service: true }).catch(() => null);
    if (!account) throw new HttpError(401, 'Email, username or password is incorrect.');
    email = account.email;
  }
  const auth = client(url, anon);
  let result = await auth.auth.signInWithPassword({ email, password: body.password });
  // Legacy accounts were created while confirmation was enabled. The project
  // explicitly uses email-free registration now. No admin role is granted here.
  if (result.error?.code === 'email_not_confirmed') {
    const admin = client(url, secret);
    for (let page = 1; page <= 10; page++) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (list.error) break;
      const match = list.data.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
      if (match) { await admin.auth.admin.updateUserById(match.id, { email_confirm: true }); result = await auth.auth.signInWithPassword({ email, password: body.password }); break; }
      if (list.data.users.length < 200) break;
    }
  }
  if (result.error || !result.data.session) throw new HttpError(401, 'Email, username or password is incorrect.');
  try { await backend('/api/me', { token: result.data.session.access_token }); }
  catch (error) { await auth.auth.signOut(); throw error; }
  return { session: result.data.session };
}
async function checkPassword(user, password) {
  if (typeof password !== 'string' || !password || password.length > 128) throw new HttpError(400, 'Enter your current password.');
  const { url, anon } = settings();
  const auth = client(url, anon);
  const result = await auth.auth.signInWithPassword({ email: user.email, password });
  if (result.error) throw new HttpError(403, 'Your current password is incorrect.');
  await auth.auth.signOut({ scope: 'local' });
}
export async function account(request, action, body) {
  const { token, user } = await identity(request); const { url, secret } = settings(); const admin = client(url, secret);
  if (action === 'me') return backend('/api/account', { token });
  if (action === 'username') {
    const result = await backend('/api/me', { token, method: 'PATCH', body: { displayName: body.username } });
    const metadata = await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, username: result.user.displayName } });
    if (metadata.error) console.error('Profile metadata sync failed. Canonical username remains on the backend.');
    return result;
  }
  if (action === 'email') {
    await checkPassword(user, body.currentPassword);
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254) throw new HttpError(400, 'Enter a valid email address.');
    const result = await admin.auth.admin.updateUserById(user.id, { email: body.email.trim(), email_confirm: true });
    if (result.error) throw new HttpError(409, 'That email cannot be used. It may already belong to another account.');
    return { ok: true };
  }
  if (action === 'password') {
    await checkPassword(user, body.currentPassword);
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 128 || body.newPassword !== body.confirmPassword) throw new HttpError(400, 'New passwords must match and contain at least 8 characters.');
    const result = await admin.auth.admin.updateUserById(user.id, { password: body.newPassword });
    if (result.error) throw new HttpError(400, result.error.message);
    await backend('/api/account/revoke-devices', { token, method: 'POST', body: {} });
    await admin.auth.admin.signOut(token, 'global'); return { ok: true };
  }
  throw new HttpError(404, 'Unknown account action.');
}
export async function avatar(request) {
  const { token, user } = await identity(request); const { url, secret } = settings();
  if (Number(request.headers.get('content-length') || 0) > 2_000_000) throw new HttpError(413, 'Choose an image smaller than 2 MB.');
  const file = (await request.formData()).get('avatar');
  if (!(file instanceof File) || file.size > 2_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HttpError(400, 'Choose a JPEG, PNG or WebP image smaller than 2 MB.');
  let image;
  try { image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000 }).rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toBuffer(); }
  catch { throw new HttpError(400, 'This image could not be read. Try another image.'); }
  const admin = client(url, secret);
  const previous = await backend('/api/account', { token });
  const bucket = 'pickle-avatars';
  const existing = await admin.storage.getBucket(bucket);
  if (existing.error) { const created = await admin.storage.createBucket(bucket, { public: true, fileSizeLimit: 2_000_000, allowedMimeTypes: ['image/webp'] }); if (created.error && !/exists/i.test(created.error.message)) throw new HttpError(503, 'Profile picture storage is unavailable.'); }
  const path = `${user.id}/${randomUUID()}.webp`;
  const upload = await admin.storage.from(bucket).upload(path, image, { contentType: 'image/webp', cacheControl: '3600' });
  if (upload.error) throw new HttpError(503, 'Profile picture upload failed.');
  const avatarUrl = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  try {
    const result = await backend('/api/account/avatar', { token, method: 'PATCH', body: { avatarUrl } });
    if (previous.user.avatarUrl) {
      try { const old = new URL(previous.user.avatarUrl); const prefix = '/storage/v1/object/public/' + bucket + '/'; if (old.origin === new URL(url).origin && old.pathname.startsWith(prefix + user.id + '/')) await admin.storage.from(bucket).remove([old.pathname.slice(prefix.length)]); } catch {}
    }
    return result;
  }
  catch (error) { await admin.storage.from(bucket).remove([path]); throw error; }
}
export { backend };
