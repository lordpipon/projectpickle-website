import Policy from '../../components/Policy.jsx';
import { privacy } from '../../lib/policies.js';
export const metadata = { title: 'Privacy policy' };
export default function Page() { return <Policy title="Privacy policy." intro="What we process, why we process it, and how to contact us." sections={privacy} />; }
