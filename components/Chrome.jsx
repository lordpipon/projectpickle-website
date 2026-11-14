import Link from 'next/link';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
export const discord = 'https://discord.gg/Ct2Vfz2wW9';
export function Header({ account = false }) {
  return <header className={`site-nav wrap ${account ? 'header-back-only' : ''}`}>{!account && <Link className="brand" href="/"><img className="brand-mark" src="/assets/logo.png" alt="" width="36" height="36" /><span className="brand-word">Project Pickle</span></Link>}{account ? <Link className="text-link" href="/">Back home</Link> : <nav aria-label="Main"><Link href="/download">Download</Link><Link href="/support">Support</Link><Button asChild variant="outline" size="sm"><Link href="/account">Your account <ArrowUpRight size={15} /></Link></Button></nav>}</header>;
}
export function Footer() {
  return <footer className="home-footer wrap"><span>© 2026 Project Pickle. All rights reserved.</span><nav aria-label="Footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/rules">Rules</Link><a href={discord} target="_blank" rel="noreferrer">Discord <MessageCircle size={13} /></a></nav><p>Not affiliated with Epic Games. <a href="https://lordpipon.com" target="_blank" rel="noreferrer">lordpipon.com <ArrowUpRight size={11} /></a></p></footer>;
}
