import { NextResponse } from 'next/server';
import { register, login, account, avatar, backend, identity, HttpError } from '../../../lib/server.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function jsonBody(request) {
  if (!request.body) return {};
  const reader = request.body.getReader(); const chunks = []; let length = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > 8192) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); } chunks.push(Buffer.from(next.value)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid request.'); }
}
async function handle(request, context) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-origin request rejected.');
    const path = (await context.params).segments.join('/');
    if (path === 'account/avatar' && request.method === 'POST') return NextResponse.json(await avatar(request));
    if (Number(request.headers.get('content-length') || 0) > 8192) throw new HttpError(413, 'Request too large.');
    const body = request.method === 'GET' ? {} : await jsonBody(request);
    let result;
    if (path === 'auth/register' && request.method === 'POST') result = await register(request, body);
    else if (path === 'auth/login' && request.method === 'POST') result = await login(body);
    else if (path === 'account/me' && request.method === 'GET') result = await account(request, 'me', body);
    else if (/^account\/(username|email|password)$/.test(path) && request.method === 'PATCH') result = await account(request, path.split('/')[1], body);
    else if (path === 'device/start' && request.method === 'POST') result = await backend('/api/auth/device/start', { method: 'POST', body });
    else if (path === 'device/approve' && request.method === 'POST') result = await backend('/api/auth/device/approve', { token: (await identity(request)).token, method: 'POST', body });
    else if (path === 'admin/players' && request.method === 'GET') result = await backend('/api/admin/players?query=' + encodeURIComponent(new URL(request.url).searchParams.get('query') || ''), { token: (await identity(request)).token });
    else if (path === 'admin/audit' && request.method === 'GET') result = await backend('/api/admin/audit', { token: (await identity(request)).token });
    else if (path === 'admin/shop' && request.method === 'GET') result = await backend('/api/admin/shop', { token:(await identity(request)).token });
    else if (/^admin\/cups\/[a-f0-9-]+$/.test(path) && request.method === 'PATCH') result = await backend('/api/'+path,{token:(await identity(request)).token,method:'PATCH',body});
    else if (/^admin\/players\/[a-f0-9-]+\/ban$/.test(path) && request.method === 'PATCH') result = await backend('/api/' + path, { token: (await identity(request)).token, method: 'PATCH', body });
    else if ((/^admin\/(shop|modes)$/.test(path) && request.method === 'PATCH') || (['admin/cups','admin/battlepass'].includes(path) && request.method === 'POST') || (/^admin\/players\/[a-f0-9-]+\/currency$/.test(path) && request.method === 'POST')) result = await backend('/api/' + path, { token: (await identity(request)).token, method: request.method, body });
    else if (path === 'battlepass' && ['GET','POST'].includes(request.method)) result = await backend('/api/battlepass', { token: (await identity(request)).token, method: request.method, ...(request.method === 'POST' ? { body } : {}) });
    else if ((/^admin\/cups\/[a-f0-9-]+\/matches$/.test(path) || /^cups\/[a-f0-9-]+\/enter$/.test(path)) && request.method === 'POST') result = await backend('/api/' + path, { token: (await identity(request)).token, method:'POST',body });
    else if (/^cups\/[a-f0-9-]+\/standings$/.test(path) && request.method === 'GET') result = await backend('/api/' + path);
    else if (['shop','game/settings'].includes(path) && request.method === 'GET') result = await backend('/api/' + path);
    else if (path === 'economy' && request.method === 'GET') result = await backend('/api/economy', { token: (await identity(request)).token });
    else if (path === 'shop/purchase' && request.method === 'POST') result = await backend('/api/shop/purchase', { token: (await identity(request)).token, method: 'POST', body });
    else throw new HttpError(404, 'Endpoint not found.');
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('API request failed:', error.message);
    return NextResponse.json({ error: { message: error instanceof HttpError ? error.message : 'Account service is temporarily unavailable. Please try again.' } }, { status: error instanceof HttpError ? error.status : 503, headers: { 'cache-control': 'no-store' } });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
