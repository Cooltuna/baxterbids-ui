import { NextResponse } from 'next/server';
import { fetchRFQs, transformRFQ } from '@/lib/supabase';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const rfqs = await fetchRFQs();
    const transformedRFQs = rfqs.map(transformRFQ);
    
    return NextResponse.json({
      success: true,
      data: transformedRFQs,
      timestamp: new Date().toISOString(),
      source: 'supabase',
    });
  } catch (error) {
    console.error('API Error fetching RFQs:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch RFQs from Supabase',
      data: [],
      timestamp: new Date().toISOString(),
    });
  }
}
