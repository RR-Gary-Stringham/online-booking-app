import App from '@/src/App';

export default function HomePage() {
  return <App publicAppUrl={process.env.APP_URL} />;
}
