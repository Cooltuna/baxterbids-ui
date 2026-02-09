// Supabase client for BaxterBids Dashboard

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rzillfgpaxyibbistrig.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_V4w8hfRJYu6ytTCNF2Ddzg_n9cQzLjR';

interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
}

async function supabaseQuery<T>(
  table: string,
  options: {
    select?: string;
    filter?: string;
    order?: string;
    limit?: number;
  } = {}
): Promise<T[]> {
  const params = new URLSearchParams();
  
  if (options.select) params.set('select', options.select);
  if (options.order) params.set('order', options.order);
  if (options.limit) params.set('limit', options.limit.toString());
  
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (options.filter) {
    url += `?${options.filter}&${params.toString()}`;
  } else if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 30 }, // Cache for 30 seconds
  });
  
  if (!response.ok) {
    console.error(`Supabase error: ${response.status}`);
    return [];
  }
  
  return response.json();
}

export interface Bid {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  agency: string;
  status: string;
  close_date: string | null;
  estimated_value: string | null;
  category: string | null;
  url: string | null;
  created_at: string;
}

export interface RFQ {
  id: string;
  bid_id: string;
  company_id: string;
  status: string;
  sent_date: string | null;
  due_date: string | null;
  received_date: string | null;
  quote_amount: number | null;
  notes: string | null;
}

export interface Source {
  id: string;
  name: string;
}

export async function fetchBids(): Promise<Bid[]> {
  const bids = await supabaseQuery<Bid>('bids', {
    select: '*',
    order: 'close_date.asc.nullslast',
  });
  
  return bids;
}

export async function fetchBidsBySource(sourceName: string): Promise<Bid[]> {
  // First get the source ID
  const sources = await supabaseQuery<Source>('sources', {
    filter: `name=eq.${sourceName}`,
  });
  
  if (sources.length === 0) return [];
  
  const bids = await supabaseQuery<Bid>('bids', {
    select: '*',
    filter: `source_id=eq.${sources[0].id}`,
    order: 'close_date.asc.nullslast',
  });
  
  return bids;
}

export async function fetchRFQs(): Promise<RFQ[]> {
  const rfqs = await supabaseQuery<RFQ>('rfqs', {
    select: '*,companies(name),bids(external_id,title)',
    order: 'created_at.desc',
  });
  
  return rfqs;
}

export async function fetchSources(): Promise<Source[]> {
  return supabaseQuery<Source>('sources', {
    select: 'id,name',
    filter: 'active=eq.true',
  });
}

// Transform Supabase bid to the format expected by the UI
export function transformBid(bid: Bid) {
  const today = new Date();
  const closeDate = bid.close_date ? new Date(bid.close_date) : null;
  const daysLeft = closeDate 
    ? Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  let uiStatus: 'active' | 'closing-soon' | 'closed' = 'active';
  if (bid.status === 'closed' || (daysLeft !== null && daysLeft <= 0)) {
    uiStatus = 'closed';
  } else if (daysLeft !== null && daysLeft <= 3) {
    uiStatus = 'closing-soon';
  }
  
  return {
    id: bid.external_id,
    title: bid.title,
    agency: bid.agency || 'MBTA',
    closeDate: bid.close_date || '',
    status: uiStatus,
    value: bid.estimated_value || '',
    category: bid.category || '',
    url: bid.url || '#',
    sheetStatus: bid.status,
  };
}

export function transformRFQ(rfq: any) {
  const today = new Date();
  const sentDate = rfq.sent_date ? new Date(rfq.sent_date) : null;
  
  let status: 'draft' | 'sent' | 'received' | 'overdue' = rfq.status || 'draft';
  
  // Auto-calculate overdue
  if (status === 'sent' && sentDate && !rfq.received_date) {
    const daysSinceSent = Math.floor(
      (today.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSent > 2) status = 'overdue';
  }
  
  return {
    id: rfq.id,
    bidId: rfq.bids?.external_id || rfq.bid_id || '',
    vendor: rfq.companies?.name || '',
    status,
    sentDate: rfq.sent_date?.split('T')[0] || '',
    dueDate: rfq.due_date?.split('T')[0] || '',
    receivedDate: rfq.received_date?.split('T')[0] || '',
    quoteAmount: rfq.quote_amount ? `$${rfq.quote_amount.toLocaleString()}` : '',
  };
}
