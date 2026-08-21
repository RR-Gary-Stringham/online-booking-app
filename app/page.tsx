import App from '@/src/App';
import { publicAppUrl } from '@/src/lib/app-url';

export default function HomePage() {
  return <App publicAppUrl={publicAppUrl()} />;
}
