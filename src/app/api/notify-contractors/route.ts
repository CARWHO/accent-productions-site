import { NextResponse } from 'next/server';

// Thin proxy to edge function
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ message: 'Not configured' }, { status: 500 });
    }

    const body = await request.json();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email-contractors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to notify-contractors edge function:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
