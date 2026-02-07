import { NextResponse } from 'next/server';
import { fetchRFQs } from '@/lib/sheets';

export const revalidate = 30; // Revalidate every 30 seconds

export async function GET() {
  try {
    const rfqs = await fetchRFQs();
    
    return NextResponse.json({
      success: true,
      data: rfqs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API Error fetching RFQs:', error);
    
    // Return demo data as fallback
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch RFQs from Google Sheets',
      data: getDemoRFQs(),
      timestamp: new Date().toISOString(),
    });
  }
}

function getDemoRFQs() {
  return [
    {
      id: 'RFQ-001',
      bidId: 'MBTA-2024-001',
      vendor: 'Stertil-Koni USA',
      status: 'sent',
      sentDate: '2024-02-05',
    },
    {
      id: 'RFQ-002',
      bidId: 'MBTA-2024-001',
      vendor: 'Rotary Lift',
      status: 'received',
      sentDate: '2024-02-05',
      receivedDate: '2024-02-06',
      quoteAmount: '$142,500',
    },
  ];
}
