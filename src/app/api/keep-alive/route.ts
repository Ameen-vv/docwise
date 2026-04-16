import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Lightweight query to wake up Supabase compute.
    const { error } = await supabase.from('documents').select('id').limit(1);

    if (error) {
      console.error('Supabase keep-alive query failed:', error);
      return NextResponse.json(
        { ok: false, message: 'Supabase keep-alive query failed.' },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }

    return NextResponse.json(
      { ok: true, message: 'Supabase is awake.' },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('Keep-alive endpoint failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Unexpected keep-alive failure.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }
}
