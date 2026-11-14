import { Suspense } from 'react';
import Account from '../../components/Account.jsx';
export const metadata = { title: 'Your account' };
export default function Page() { return <Suspense fallback={<p className="account-loading">Loading account…</p>}><Account /></Suspense>; }
