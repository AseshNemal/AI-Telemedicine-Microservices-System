import { NextRequest, NextResponse } from 'next/server';

const symptomServiceUrl =
  process.env.SYMPTOM_SERVICE_URL ??
  process.env.NEXT_PUBLIC_SYMPTOM_SERVICE_URL ??
  'http://localhost:8091';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const upstream = await fetch(`${symptomServiceUrl}/symptoms/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    const bodyText = await upstream.text();

    return new NextResponse(bodyText, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Symptom backend unavailable';
    return NextResponse.json(
      { error: 'backend_unavailable', details: message },
      { status: 502 },
    );
  }
}
