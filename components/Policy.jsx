import { Header, Footer } from './Chrome.jsx';
export default function Policy({ title, intro, sections }) {
  return <div className="site-root"><Header /><main className="policy-page wrap"><p className="muted">Last updated 14 November 2026</p><h1>{title}</h1>{intro && <p className="lede">{intro}</p>}<ol>{sections.map(([heading, text], index) => <li key={heading}><span className="policy-index">{String(index + 1).padStart(2, '0')}</span><div><h2>{heading}</h2><p>{text}</p></div></li>)}</ol></main><Footer /></div>;
}
