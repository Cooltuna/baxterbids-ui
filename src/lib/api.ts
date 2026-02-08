/**
 * BaxterBids API Client
 * Communicates with the local Python API server
 */

import { BidSummary, VendorSearchResult, RFQDraft, LineItem } from '@/types';

// API base URL - local dev or can be configured via env
const API_BASE = process.env.NEXT_PUBLIC_BAXTERBIDS_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(response.status, error.detail || response.statusText);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    // Network error - API server probably not running
    throw new ApiError(0, 'Cannot connect to BaxterBids API. Is the server running?');
  }
}

/**
 * Check if the API server is running
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get cached analysis for a bid (if previously analyzed)
 */
export async function getCachedAnalysis(bidId: string): Promise<BidSummary | null> {
  try {
    return await fetchApi<BidSummary>(`/bids/${encodeURIComponent(bidId)}/analysis`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null; // No cached data
    }
    throw error;
  }
}

/**
 * Get cached vendors for a bid
 */
export async function getCachedVendors(bidId: string): Promise<VendorMatrixResult | null> {
  try {
    return await fetchApi<VendorMatrixResult>(`/bids/${encodeURIComponent(bidId)}/vendors`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null; // No cached data
    }
    throw error;
  }
}

/**
 * Analyze a bid opportunity
 */
export async function analyzeBid(
  bidId: string,
  bidUrl: string,
  title?: string,
  rawBomText?: string
): Promise<BidSummary> {
  return fetchApi<BidSummary>('/analyze', {
    method: 'POST',
    body: JSON.stringify({
      bid_id: bidId,
      bid_url: bidUrl,
      title,
      raw_bom_text: rawBomText,
    }),
  });
}

/**
 * Search for vendors
 */
export async function searchVendors(
  query: string,
  productType?: string,
  location?: string
): Promise<VendorSearchResult> {
  return fetchApi<VendorSearchResult>('/vendors/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      product_type: productType,
      location,
    }),
  });
}

/**
 * Batch search for vendors for multiple items
 */
export interface VendorMatrixResult {
  vendors: Array<{
    name: string;
    website?: string;
    contact?: string;
    can_supply: number[];
    notes?: string;
  }>;
  matrix: Record<string, number[]>;
  item_coverage: Record<string, string[]>;
  recommendations: string[];
  items: Array<{ description: string; quantity?: string; specifications?: string }>;
  searched_at: string;
  item_count: number;
  vendor_count: number;
}

export async function batchSearchVendors(
  items: Array<{ description: string; quantity?: string; specifications?: string }>,
  bidId?: string,
  location?: string
): Promise<VendorMatrixResult> {
  return fetchApi<VendorMatrixResult>('/vendors/search/batch', {
    method: 'POST',
    body: JSON.stringify({
      bid_id: bidId,
      items,
      location,
    }),
  });
}

/**
 * Generate an RFQ draft
 */
export async function draftRFQ(
  bidId: string,
  bidTitle: string,
  lineItems: LineItem[],
  vendorName: string,
  deadline: string,
  vendorEmail?: string
): Promise<RFQDraft> {
  return fetchApi<RFQDraft>('/rfq/draft', {
    method: 'POST',
    body: JSON.stringify({
      bid_id: bidId,
      bid_title: bidTitle,
      line_items: lineItems,
      vendor_name: vendorName,
      vendor_email: vendorEmail,
      deadline,
    }),
  });
}

/**
 * Update bid status (e.g., mark as "No Bid")
 */
export async function updateBidStatus(
  bidId: string,
  status: 'No Bid' | 'Interested' | 'Bidding' | 'Won' | 'Lost' | 'Open'
): Promise<{ bid_id: string; status: string; updated_at: string }> {
  return fetchApi(`/bids/${encodeURIComponent(bidId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export { ApiError };
