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
  sheetStatus?: string;
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
    return rows
      .filter(row => {
        // Skip "No Bid" items
        const sheetStatus = (row[3] || '').toLowerCase();
        return sheetStatus !== 'no bid' && row[1]; // Must have bid ID and not be "No Bid"
      })
      .map((row) => {
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
          sheetStatus: row[3] || 'Open',  // Column D - Status from sheet
        };
      });
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
      range: 'RFQ Log!A2:H100', // Skip header row
    });

    const rows = response.data.values || [];
    const today = new Date();
    
    // Actual columns: A=Date, B=Bid ID, C=Distributor, D=Contact, E=Items Requested, F=Quote Received (status), G=Quote Amount, H=Notes
    return rows.map((row, index) => {
      const sentDate = row[0] || ''; // Column A - Date (when sent)
      const statusRaw = (row[5] || 'sent').toLowerCase(); // Column F - Quote Received
      
      // Map status: "sent" means waiting, "received" means got quote
      let status: 'draft' | 'sent' | 'received' | 'overdue' = 'sent';
      if (statusRaw === 'received' || statusRaw === 'yes') {
        status = 'received';
      } else if (statusRaw === 'draft') {
        status = 'draft';
      }
      
      // Auto-calculate overdue status (more than 2 days since sent, no quote)
      if (status === 'sent' && sentDate) {
        const sentDateTime = new Date(sentDate);
        const daysSinceSent = Math.floor(
          (today.getTime() - sentDateTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceSent > 2) status = 'overdue';
      }

      return {
        id: `RFQ-${index + 1}`,     // Generate ID from row index
        bidId: row[1] || '',        // Column B - Bid ID
        vendor: row[2] || '',       // Column C - Distributor
        status,
        sentDate: sentDate.split(' ')[0], // Just the date part
        dueDate: '',                // Not in current structure
        receivedDate: status === 'received' ? sentDate : '',
        quoteAmount: row[6] || '',  // Column G - Quote Amount
      };
    }).filter(rfq => rfq.bidId); // Filter out empty rows
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    throw error;
  }
}
