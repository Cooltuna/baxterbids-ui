import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1_WEPcLcnBB0u0r9HLpnzDVhsKVakx4mQTTGd0p283h4';

// Initialize Google Sheets API with service account
function getSheets() {
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
    // Local development - use default credentials
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
      range: 'Active Bids!A2:K100', // Skip header row
    });

    const rows = response.data.values || [];
    const today = new Date();
    
    // Columns: A=Source, B=Bid ID, C=Title, D=Status, E=Close Date, F=Days Left, G=Category, H=Est Value, I=Priority, J=Notes, K=Detail URL
    return rows.map((row) => {
      const closeDate = row[4] || ''; // Column E
      const daysLeft = parseInt(row[5]) || 0; // Column F
      
      let status: 'active' | 'closing-soon' | 'closed' = 'active';
      const sheetStatus = (row[3] || '').toLowerCase(); // Column D
      if (sheetStatus === 'closed' || daysLeft <= 0) {
        status = 'closed';
      } else if (daysLeft <= 3) {
        status = 'closing-soon';
      }

      return {
        id: row[1] || '',           // Column B - Bid ID
        title: row[2] || '',        // Column C - Title
        agency: row[0] || 'MBTA',   // Column A - Source (use as agency)
        closeDate: closeDate,
        status,
        value: row[7] || '',        // Column H - Est. Value
        category: row[6] || '',     // Column G - Category
        url: row[10] || '#',        // Column K - Detail URL
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
    
    // Adjust columns based on your RFQ Log structure
    // Assuming: A=RFQ ID, B=Bid ID, C=Vendor, D=Status, E=Sent Date, F=Due Date, G=Received Date, H=Quote Amount, I=Notes
    return rows.map((row) => {
      const sentDate = row[4] || '';
      const receivedDate = row[6] || '';
      let status: 'draft' | 'sent' | 'received' | 'overdue' = (row[3] || 'draft').toLowerCase() as any;
      
      // Auto-calculate overdue status
      if (status === 'sent' && sentDate && !receivedDate) {
        const sentDateTime = new Date(sentDate);
        const daysSinceSent = Math.floor(
          (today.getTime() - sentDateTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceSent > 2) status = 'overdue';
      }

      return {
        id: row[0] || '',           // Column A - RFQ ID
        bidId: row[1] || '',        // Column B - Bid ID
        vendor: row[2] || '',       // Column C - Vendor
        status,
        sentDate,
        dueDate: row[5] || '',      // Column F - Due Date
        receivedDate,
        quoteAmount: row[7] || '',  // Column H - Quote Amount
      };
    }).filter(rfq => rfq.id); // Filter out empty rows
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    throw error;
  }
}
