export interface BidDocument {
  name: string;
  filename: string;
  type: string;
  size: string;
  storage_path: string;
  download_url?: string;
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
  source?: string;
  description?: string;
  documents?: BidDocument[];
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
