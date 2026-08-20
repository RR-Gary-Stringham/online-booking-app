import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: 'Both from and to query parameters are required.' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    status: 'not_configured',
    message: 'Persistent provider settings and Google OAuth must be connected before live availability is enabled.',
    from,
    to,
    slots: [],
  }, { status: 503 });
}
