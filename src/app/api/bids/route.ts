import { NextRequest, NextResponse } from 'next/server';
import { fetchBids, fetchBidsBySource, transformBid } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; // Required for request.url usage
export const revalidate = 0;

// Map URL slugs to actual source names in Supabase
const SOURCE_NAMES: Record<string, string> = {
  'caci': 'CACI',
  'highergov-hubzone': 'HigherGov HUBZone',
  'highergov hubzone': 'HigherGov HUBZone', // Handle URL-decoded space
  'sam.gov': 'SAM.gov',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get('source');
    
    // Fetch bids - either all or by source
    let bids;
    if (sourceFilter) {
      // Normalize: decode URI and check both dash/space versions
      const normalized = decodeURIComponent(sourceFilter).toLowerCase();
      const mappedName = SOURCE_NAMES[normalized] || SOURCE_NAMES[normalized.replace(/ /g, '-')];
      if (mappedName) {
        bids = await fetchBidsBySource(mappedName);
      } else {
        // Try title case first, then uppercase (for acronyms like CACI)
        const titleCase = sourceFilter.charAt(0).toUpperCase() + sourceFilter.slice(1);
        bids = await fetchBidsBySource(titleCase);
        
        // If no results, try uppercase (handles CACI, SAM, etc.)
        if (bids.length === 0) {
          bids = await fetchBidsBySource(sourceFilter.toUpperCase());
        }
      }
    } else {
      bids = await fetchBids();
    }
    
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
      source: sourceFilter || 'all',
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
