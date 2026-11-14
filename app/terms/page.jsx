import Policy from '../../components/Policy.jsx';
import { terms } from '../../lib/policies.js';
export const metadata = { title: 'Terms of service' };
export default function Page() { return <Policy title="Terms of service." intro="The terms for using Project Pickle and its community services." sections={terms} />; }
