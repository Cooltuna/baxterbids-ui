export interface Bid {
  id: string;
  title: string;
  agency: string;
  closeDate: string;
  status: 'active' | 'closing-soon' | 'closed';
  value?: string;
  category?: string;
  url: string;
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
