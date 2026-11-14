import { Suspense } from 'react';
import Device from '../../components/Device.jsx';
export const metadata = { title: 'Connect launcher' };
export default function Page() { return <Suspense fallback={<p className="account-loading">Loading connection…</p>}><Device /></Suspense>; }
