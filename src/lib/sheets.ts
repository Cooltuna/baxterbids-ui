import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1_WEPcLcnBB0u0r9HLpnzDVhsKVakx4mQTTGd0p283h4';

// Initialize Google Sheets API with service account
function getSheets() {
  // For local dev, use service account JSON file
  // For Vercel, use GOOGLE_SERVICE_ACCOUNT env var (base64 encoded)
  let auth;
  
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    // Decode base64 service account credentials
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT, 'base64').toString()
    );
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } else {
    // Local development - use default credentials or API key
    auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  return google.sheets({ version: 'v4', auth });
}

export interface SheetBid {
  id: string;
  title: string;
  agency: string;
  closeDate: string;
  status: 'active' | 'closing-soon' | 'closed';
  value?: string;
  category?: string;
  url: string;
}

export interface SheetRFQ {
  id: string;
  bidId: string;
  vendor: string;
  status: 'draft' | 'sent' | 'received' | 'overdue';
  sentDate?: string;
  dueDate?: string;
  receivedDate?: string;
  quoteAmount?: string;
}

export async function fetchBids(): Promise<SheetBid[]> {
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Active Bids!A2:H100', // Skip header row
    });

    const rows = response.data.values || [];
    const today = new Date();
    
    return rows.map((row) => {
      const closeDate = row[3] || '';
      const daysUntilClose = closeDate 
        ? Math.ceil((new Date(closeDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      
      let status: 'active' | 'closing-soon' | 'closed' = 'active';
      if (daysUntilClose <= 0) status = 'closed';
      else if (daysUntilClose <= 3) status = 'closing-soon';

      return {
        id: row[0] || '',
        title: row[1] || '',
        agency: row[2] || 'MBTA',
        closeDate: closeDate,
        status,
        value: row[4] || '',
        category: row[5] || 'General',
        url: row[6] || '#',
      };
    }).filter(bid => bid.id); // Filter out empty rows
  } catch (error) {
    console.error('Error fetching bids:', error);
    throw error;
  }
}

export async function fetchRFQs(): Promise<SheetRFQ[]> {
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'RFQ Log!A2:I100', // Skip header row
    });

    const rows = response.data.values || [];
    const today = new Date();
    
    return rows.map((row) => {
      const sentDate = row[4] || '';
      const receivedDate = row[6] || '';
      let status: 'draft' | 'sent' | 'received' | 'overdue' = row[3]?.toLowerCase() || 'draft';
      
      // Auto-calculate overdue status
      if (status === 'sent' && sentDate && !receivedDate) {
        const daysSinceSent = Math.floor(
          (today.getTime() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceSent > 2) status = 'overdue';
      }

      return {
        id: row[0] || '',
        bidId: row[1] || '',
        vendor: row[2] || '',
        status,
        sentDate,
        dueDate: row[5] || '',
        receivedDate,
        quoteAmount: row[7] || '',
      };
    }).filter(rfq => rfq.id); // Filter out empty rows
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    throw error;
  }
}
