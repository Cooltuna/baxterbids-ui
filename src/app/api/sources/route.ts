import { NextResponse } from 'next/server';
import { fetchSources } from '@/lib/supabase';

export const revalidate = 300; // Revalidate every 5 minutes (sources don't change often)

export async function GET() {
  try {
    const sources = await fetchSources();
    
    return NextResponse.json({
      success: true,
      data: sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API Error fetching sources:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sources from Supabase',
      data: [],
      timestamp: new Date().toISOString(),
    });
  }
}
