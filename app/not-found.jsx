import Link from 'next/link';
import { Header, Footer } from '../components/Chrome.jsx';
export default function NotFound() { return <div className="site-root"><Header /><main className="support-page wrap"><h1>Not here.</h1><p className="lede">That page could not be found.</p><Link className="btn btn-primary" href="/">Back home</Link></main><Footer /></div>; }
