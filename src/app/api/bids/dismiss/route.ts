import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rzillfgpaxyibbistrig.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_V4w8hfRJYu6ytTCNF2Ddzg_n9cQzLjR';

export async function POST(request: NextRequest) {
  try {
    const { bidId, sourceId } = await request.json();
    
    if (!bidId) {
      return NextResponse.json({ success: false, error: 'bidId required' }, { status: 400 });
    }
    
    // Build filter - if sourceId provided, use it; otherwise just match bidId
    let filter = `external_id=eq.${encodeURIComponent(bidId)}`;
    if (sourceId) {
      filter += `&source_id=eq.${sourceId}`;
    }
    
    const url = `${SUPABASE_URL}/rest/v1/bids?${filter}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ dismissed: true }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase dismiss error:', error);
      return NextResponse.json({ success: false, error: 'Failed to dismiss bid' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dismiss API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
