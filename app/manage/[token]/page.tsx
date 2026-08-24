import { publicAppUrl } from '@/src/lib/app-url';
import ManageBooking from './ManageBooking';

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ManageBooking token={token} publicAppUrl={publicAppUrl()} />;
}
