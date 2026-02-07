import { NextResponse } from 'next/server';
import { fetchBids } from '@/lib/sheets';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const bids = await fetchBids();
    
    return NextResponse.json({
      success: true,
      data: bids,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API Error fetching bids:', error);
    
    // Return demo data as fallback
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch bids from Google Sheets',
      data: getDemoBids(),
      timestamp: new Date().toISOString(),
    });
  }
}

function getDemoBids() {
  return [
    {
      id: 'MBTA-2024-001',
      title: 'Vehicle Maintenance Equipment - Heavy Duty Lifts',
      agency: 'MBTA',
      closeDate: '2024-02-15',
      status: 'active',
      value: '$125,000 - $175,000',
      category: 'Equipment',
      url: '#'
    },
    {
      id: 'MBTA-2024-002',
      title: 'IT Infrastructure Upgrade - Network Switches',
      agency: 'MBTA',
      closeDate: '2024-02-12',
      status: 'closing-soon',
      value: '$85,000 - $120,000',
      category: 'Technology',
      url: '#'
    },
  ];
}
