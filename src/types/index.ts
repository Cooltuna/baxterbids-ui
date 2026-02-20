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
  title: string;
  agency: string;
  closeDate: string;
  status: 'active' | 'closing-soon' | 'closed';
  value?: string;
  category?: string;
  url: string;
  sheetStatus?: 'Open' | 'Interested' | 'Bidding' | 'Won' | 'Lost' | 'No Bid';
  isAnalyzed?: boolean;
  external_id?: string;
  source?: string;
  description?: string;
  documents?: BidDocument[];
  enrichment?: BidEnrichment | null;
}

export interface Source {
  id: string;
  name: string;
}

export interface RFQ {
  id: string;
  bidId: string;
  vendor: string;
  status: 'draft' | 'sent' | 'received' | 'overdue';
  sentDate?: string;
  dueDate?: string;
  receivedDate?: string;
  quoteAmount?: string;
  notes?: string;
}

export interface Stats {
  totalBids: number;
  closingSoon: number;
  rfqsSent: number;
  rfqsOverdue: number;
}

// AI Analysis Types
export interface LineItem {
  description: string;
  quantity?: string;
  unit?: string;
  specifications?: string;
}

export interface BidSummary {
  bid_id: string;
  title: string;
  agency: string;
  scope: string;
  line_items: LineItem[];
  requirements: string[];
  deadline: string;
  estimated_value?: string;
  contact_info?: string;
  key_dates: {
    posted?: string;
    questions_due?: string;
    submission_due?: string;
    award_date?: string;
  };
  recommendations: string[];
  analyzed_at: string;
}

export interface Vendor {
  name: string;
  website?: string;
  contact?: string;
  products: string[];
  notes?: string;
  can_supply?: number[];  // Item numbers this vendor can supply
}

export interface VendorSearchResult {
  query: string;
  vendors: Vendor[];
  searched_at: string;
}

export interface RFQDraft {
  subject: string;
  body: string;
  vendor_name: string;
  bid_id: string;
  created_at: string;
}

// Quote Workflow Types (Phase B/C)
export interface QuoteItem {
  id: string;
  quote_id: string;
  line_number: number | null;
  part_number: string;
  description: string;
  qty: number;
  uom: string;
  unit_price: number | null;
  extended_price: number | null;
  lead_time: string | null;
  manufacturer: string;
  condition: string;
  availability: string | null;
  moq: number | null;
  notes: string;
  is_best_price: boolean;
  created_at: string;
}

export interface VendorQuote {
  id: string;
  rfq_id: string | null;
  bid_id: string;
  vendor_name: string;
  vendor_email: string;
  response_date: string;
  raw_email_id: string;
  attachment_urls: string[];
  shipping: number | null;
  terms: string | null;
  valid_until: string | null;
  status: 'pending' | 'accepted' | 'partial' | 'rejected' | 'countered' | 'expired';
  total_cost: number | null;
  parse_confidence: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: QuoteItem[];
}

export interface QuoteComparison {
  part_key: string; // part_number or description
  part_number: string;
  description: string;
  qty: number;
  vendors: {
    vendor_name: string;
    quote_id: string;
    item_id: string;
    unit_price: number | null;
    extended_price: number | null;
    lead_time: string | null;
    manufacturer: string;
    is_best_price: boolean;
  }[];
}
