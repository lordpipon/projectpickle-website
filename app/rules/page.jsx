import Policy from '../../components/Policy.jsx';
import { rules } from '../../lib/policies.js';
export const metadata = { title: 'Community rules' };
export default function Page() { return <Policy title="Community rules." intro="These rules apply to Project Pickle and the official Discord community." sections={rules} />; }
