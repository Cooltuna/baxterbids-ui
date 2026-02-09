import { NextResponse } from 'next/server';
import { fetchBids, transformBid } from '@/lib/supabase';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const bids = await fetchBids();
    const transformedBids = bids
      .filter(b => b.status !== 'no bid') // Filter out "no bid" items
      .map(transformBid);
    
    return NextResponse.json({
      success: true,
      data: transformedBids,
      timestamp: new Date().toISOString(),
      source: 'supabase',
    });
  } catch (error) {
    console.error('API Error fetching bids:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch bids from Supabase',
      data: [],
      timestamp: new Date().toISOString(),
    });
  }
}
