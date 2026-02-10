import { NextResponse } from 'next/server';
import { fetchBids, transformBid } from '@/lib/supabase';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const bids = await fetchBids();
    
    // Calculate cutoff: 2 days after close date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2);
    cutoffDate.setHours(0, 0, 0, 0);
    
    const transformedBids = bids
      .filter(b => b.status !== 'no bid') // Filter out "no bid" items
      .filter(b => {
        // Keep bids with no close date
        if (!b.close_date) return true;
        // Keep bids that closed within the last 2 days
        const closeDate = new Date(b.close_date);
        return closeDate >= cutoffDate;
      })
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
