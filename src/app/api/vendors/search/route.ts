import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rzillfgpaxyibbistrig.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_V4w8hfRJYu6ytTCNF2Ddzg_n9cQzLjR';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Search companies table
    const companiesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?name=ilike.*${encodeURIComponent(query)}*&select=id,name,website&limit=10`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    
    const companies = await companiesRes.json();
    
    // For each company, get a contact email if available
    const results = await Promise.all(
      (companies || []).slice(0, 10).map(async (company: { id: string; name: string; website?: string }) => {
        // Try to get a contact for this company
        const contactRes = await fetch(
          `${SUPABASE_URL}/rest/v1/contacts?company_id=eq.${company.id}&select=email&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        const contacts = await contactRes.json();
        const email = contacts?.[0]?.email || '';
        
        return {
          id: company.id,
          name: company.name,
          website: company.website || '',
          email: email,
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Vendor search error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: 'Search failed',
    });
  }
}
