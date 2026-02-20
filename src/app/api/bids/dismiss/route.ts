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
    
    // bidId is the Supabase UUID (primary key)
    const url = `${SUPABASE_URL}/rest/v1/bids?id=eq.${encodeURIComponent(bidId)}`;
    
    console.log('[Dismiss] bidId:', bidId, 'url:', url, 'key_prefix:', SUPABASE_KEY?.substring(0, 10));
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ dismissed: true, status: 'no bid' }),
    });
    
    const responseText = await response.text();
    console.log('[Dismiss] status:', response.status, 'response:', responseText?.substring(0, 200));
    
    if (!response.ok) {
      console.error('Supabase dismiss error:', responseText);
      return NextResponse.json({ success: false, error: 'Failed to dismiss bid', details: responseText }, { status: 500 });
    }
    
    // Check if anything was actually updated
    const updated = JSON.parse(responseText);
    if (!updated || updated.length === 0) {
      console.error('[Dismiss] No rows matched for id:', bidId);
      return NextResponse.json({ success: false, error: 'No bid found with that ID' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, updated: updated.length });
  } catch (error) {
    console.error('Dismiss API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
