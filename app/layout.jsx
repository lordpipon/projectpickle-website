import './shadcn.css';
import '../assets/web.css';
import '../assets/home.css';
import '../assets/account.css';
import '../assets/admin.css';
import './next.css';
export const metadata = { title: { default: 'Project Pickle · Underground', template: '%s · Project Pickle' }, description: 'A Fortnite revival for Chapter 5 Season 1 — Underground.', icons: { icon: '/favicon.ico' } };
export default function Layout({ children }) { return <html lang="en"><body>{children}</body></html>; }
