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

export interface BidDocument {
  name: string;
  filename: string;
  type: string;
  size: string;
  storage_path: string;
  download_url?: string;
}

export interface PurchaseHistoryRecord {
  contract: string;
  awardee: string | null;
  part_number: string | null;
  bidders: string | null;
  set_aside: string | null;
  unit_price: number | null;
  quantity: number | null;
  date: string | null;
}

export interface ApprovedSupplier {
  name: string;
  cage: string;
  part_number: string;
  cage_status?: string;
}

export interface BidEnrichment {
  enriched_at: string;
  highergov: {
    bid_info: {
      nsn: string;
      nomenclature: string;
      quantity: number;
      unit: string;
      std_price: number;
      last_price: number;
      est_value: number;
    };
    purchase_history: PurchaseHistoryRecord[];
    approved_suppliers: ApprovedSupplier[];
  };
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
  description: string | null;
  created_at: string;
  documents?: BidDocument[];
  sources?: { name: string };
  raw_data?: string | { enrichment?: BidEnrichment };
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
    select: '*,sources(name)',
    filter: 'or=(dismissed.is.null,dismissed.eq.false)',
    order: 'close_date.asc.nullslast',
  });
  
  return bids;
}

export async function fetchBidWithDocuments(externalId: string): Promise<Bid | null> {
  const bids = await supabaseQuery<Bid>('bids', {
    select: '*,sources(name)',
    filter: `external_id=eq.${externalId}`,
  });
  
  return bids.length > 0 ? bids[0] : null;
}

/**
 * Fetch a single bid by its UUID and return transformed
 */
export async function fetchBidById(id: string): Promise<ReturnType<typeof transformBid> | null> {
  const bids = await supabaseQuery<Bid>('bids', {
    select: '*,sources(name)',
    filter: `id=eq.${id}`,
  });
  
  if (bids.length === 0) return null;
  return transformBid(bids[0]);
}

export async function fetchBidsBySource(sourceName: string): Promise<Bid[]> {
  // First get the source ID
  const sources = await supabaseQuery<Source>('sources', {
    filter: `name=eq.${sourceName}`,
  });
  
  if (sources.length === 0) return [];
  
  const bids = await supabaseQuery<Bid>('bids', {
    select: '*,sources(name)',
    filter: `source_id=eq.${sources[0].id}&or=(dismissed.is.null,dismissed.eq.false)`,
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
  
  // Parse raw_data for enrichment
  let enrichment: BidEnrichment | null = null;
  if (bid.raw_data) {
    try {
      const rawData = typeof bid.raw_data === 'string' 
        ? JSON.parse(bid.raw_data) 
        : bid.raw_data;
      if (rawData?.enrichment) {
        enrichment = rawData.enrichment;
      }
    } catch (e) {
      console.warn('Failed to parse raw_data:', e);
    }
  }
  
  return {
    id: bid.id,  // Use Supabase UUID, not external_id
    external_id: bid.external_id || '',
    title: bid.title,
    agency: bid.agency || 'MBTA',
    closeDate: bid.close_date || '',
    status: uiStatus,
    value: bid.estimated_value || '',
    category: bid.category || '',
    url: bid.url || '#',
    sheetStatus: bid.status,
    source: bid.sources?.name || 'Unknown',
    description: bid.description || '',
    documents: bid.documents || [],
    enrichment,
  };
}

/**
 * Get a public URL for downloading a document from Supabase storage
 * Bucket is public, so we just construct the URL directly
 */
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  try {
    // URL encode the path components to handle spaces and special chars
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    return `${SUPABASE_URL}/storage/v1/object/public/bid-documents/${encodedPath}`;
  } catch (error) {
    console.error('Error getting document URL:', error);
    return null;
  }
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

/**
 * Fetch vendor quotes for a bid (with line items)
 */
export async function fetchQuotesForBid(bidId: string): Promise<any[]> {
  // Get quotes
  const quotes = await supabaseQuery<any>('rfq_quotes', {
    filter: `bid_id=eq.${bidId}`,
    order: 'created_at.desc',
  });

  // Get all quote items for these quotes
  if (quotes.length > 0) {
    const quoteIds = quotes.map((q: any) => q.id).join(',');
    const items = await supabaseQuery<any>('rfq_quote_items', {
      filter: `quote_id=in.(${quoteIds})`,
      order: 'line_number.asc',
    });

    // Attach items to their quotes
    const itemsByQuote: Record<string, any[]> = {};
    for (const item of items) {
      if (!itemsByQuote[item.quote_id]) itemsByQuote[item.quote_id] = [];
      itemsByQuote[item.quote_id].push(item);
    }
    for (const quote of quotes) {
      quote.items = itemsByQuote[quote.id] || [];
    }
  }

  return quotes;
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(quoteId: string, status: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/rfq_quotes?id=eq.${quoteId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

/**
 * Dismiss a bid (hides it from the dashboard without deleting)
 */
export async function dismissBid(bidId: string, sourceId: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/bids?external_id=eq.${encodeURIComponent(bidId)}&source_id=eq.${sourceId}`;
  
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
  
  return response.ok;
}
