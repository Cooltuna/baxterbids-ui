'use client';

import { useState, useEffect, useMemo } from 'react';
import { VendorQuote, QuoteItem, QuoteComparison } from '@/types';
import { fetchQuotesForBid, updateQuoteStatus } from '@/lib/supabase';

interface QuotesTabProps {
  bidId: string;
  bidTitle: string;
}

export default function QuotesTab({ bidId, bidTitle }: QuotesTabProps) {
  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'comparison' | 'list'>('comparison');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Load quotes
  useEffect(() => {
    loadQuotes();
  }, [bidId]);

  async function loadQuotes() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchQuotesForBid(bidId);
      setQuotes(data as VendorQuote[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load quotes');
    } finally {
      setIsLoading(false);
    }
  }

  // Build comparison matrix
  const comparison = useMemo(() => {
    if (quotes.length === 0) return [];

    // Collect all unique parts across all quotes
    const partMap = new Map<string, QuoteComparison>();

    for (const quote of quotes) {
      if (!quote.items) continue;
      for (const item of quote.items) {
        const key = item.part_number || item.description || `line-${item.line_number}`;

        if (!partMap.has(key)) {
          partMap.set(key, {
            part_key: key,
            part_number: item.part_number || '',
            description: item.description || '',
            qty: item.qty || 0,
            vendors: [],
          });
        }

        partMap.get(key)!.vendors.push({
          vendor_name: quote.vendor_name,
          quote_id: quote.id,
          item_id: item.id,
          unit_price: item.unit_price,
          extended_price: item.extended_price,
          lead_time: item.lead_time,
          manufacturer: item.manufacturer || '',
          is_best_price: item.is_best_price,
        });
      }
    }

    return Array.from(partMap.values());
  }, [quotes]);

  // Vendor names for column headers
  const vendorNames = useMemo(() => {
    return quotes.map(q => q.vendor_name);
  }, [quotes]);

  async function handleStatusChange(quoteId: string, newStatus: string) {
    setUpdatingStatus(quoteId);
    const ok = await updateQuoteStatus(quoteId, newStatus);
    if (ok) {
      setQuotes(prev => prev.map(q =>
        q.id === quoteId ? { ...q, status: newStatus as VendorQuote['status'] } : q
      ));
    }
    setUpdatingStatus(null);
  }

  // Format currency
  const fmt = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const confidenceColor = (c: number | null) => {
    if (c === null) return 'text-[var(--muted)]';
    if (c >= 0.8) return 'text-[var(--success)]';
    if (c >= 0.5) return 'text-yellow-500';
    return 'text-[var(--danger)]';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
      accepted: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
      partial: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      rejected: 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30',
      countered: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
      expired: 'bg-[var(--muted)]/10 text-[var(--muted)] border-[var(--muted)]/30',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  // ─── Loading / Empty states ─────────────────────────
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 mx-auto border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-[var(--muted)]">Loading vendor quotes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
        {error}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📭</div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">No Quotes Yet</h3>
        <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
          When vendors respond to your RFQs, their quotes will appear here for comparison.
          Send RFQs from the RFQ tab to get started.
        </p>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
            Vendor Quotes ({quotes.length})
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1">
            {comparison.length > 0
              ? `${comparison.length} line items across ${vendorNames.length} vendor${vendorNames.length !== 1 ? 's' : ''}`
              : 'Responses received but no line items parsed'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'comparison'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--muted)] hover:bg-[var(--card)]'
            }`}
          >
            📊 Compare
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--muted)] hover:bg-[var(--card)]'
            }`}
          >
            📋 List
          </button>
          <button
            onClick={loadQuotes}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--muted)] hover:bg-[var(--card)] transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ─── Comparison View ─────────────────────────── */}
      {viewMode === 'comparison' && comparison.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-3 text-xs font-semibold text-[var(--muted)] uppercase w-1/4">
                  Line Item
                </th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-[var(--muted)] uppercase w-16">
                  Qty
                </th>
                {vendorNames.map((name) => (
                  <th key={name} className="text-center py-3 px-3 text-xs font-semibold text-[var(--muted)] uppercase">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.part_key} className="border-b border-[var(--border)]/50 hover:bg-[var(--card)]/50">
                  <td className="py-3 px-3">
                    <div className="font-medium text-[var(--foreground)]">
                      {row.description || row.part_number}
                    </div>
                    {row.part_number && row.description && (
                      <div className="text-xs text-[var(--muted)]">{row.part_number}</div>
                    )}
                  </td>
                  <td className="text-center py-3 px-2 text-[var(--muted)]">
                    {row.qty}
                  </td>
                  {vendorNames.map((vendorName) => {
                    const vendorData = row.vendors.find(v => v.vendor_name === vendorName);
                    if (!vendorData) {
                      return (
                        <td key={vendorName} className="text-center py-3 px-3 text-[var(--muted)]">
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={vendorName}
                        className={`text-center py-3 px-3 ${
                          vendorData.is_best_price
                            ? 'bg-[var(--success)]/5'
                            : ''
                        }`}
                      >
                        <div className={`font-semibold ${
                          vendorData.is_best_price
                            ? 'text-[var(--success)]'
                            : 'text-[var(--foreground)]'
                        }`}>
                          {fmt(vendorData.unit_price)}
                          {vendorData.is_best_price && ' ✅'}
                        </div>
                        {vendorData.extended_price && (
                          <div className="text-xs text-[var(--muted)]">
                            ext: {fmt(vendorData.extended_price)}
                          </div>
                        )}
                        {vendorData.lead_time && (
                          <div className="text-xs text-[var(--muted)]">
                            ⏱ {vendorData.lead_time}
                          </div>
                        )}
                        {vendorData.manufacturer && (
                          <div className="text-xs text-[var(--muted)]">
                            🏭 {vendorData.manufacturer}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-[var(--border)] font-semibold">
                <td className="py-3 px-3 text-[var(--foreground)]">Total</td>
                <td></td>
                {vendorNames.map((vendorName) => {
                  const quote = quotes.find(q => q.vendor_name === vendorName);
                  const itemTotal = comparison.reduce((sum, row) => {
                    const v = row.vendors.find(v => v.vendor_name === vendorName);
                    return sum + (v?.extended_price || 0);
                  }, 0);
                  const shipping = quote?.shipping || 0;
                  const grandTotal = (quote?.total_cost) || (itemTotal + shipping);
                  return (
                    <td key={vendorName} className="text-center py-3 px-3">
                      <div className="text-[var(--foreground)]">{fmt(grandTotal)}</div>
                      {shipping > 0 && (
                        <div className="text-xs text-[var(--muted)]">+{fmt(shipping)} shipping</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* No line items but quotes exist */}
      {viewMode === 'comparison' && comparison.length === 0 && quotes.length > 0 && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
          <p className="font-medium text-yellow-500 mb-1">⚠️ Quotes received but no line items parsed</p>
          <p className="text-[var(--muted)]">
            The vendor responses didn&apos;t contain structured pricing data. 
            Check the vendor cards below for raw notes.
          </p>
        </div>
      )}

      {/* ─── List / Card View ────────────────────────── */}
      <div className="space-y-4">
        {quotes.map((quote) => (
          <div
            key={quote.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            {/* Quote header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-lg">
                  🏢
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--foreground)]">{quote.vendor_name}</h4>
                  <p className="text-xs text-[var(--muted)]">
                    {quote.vendor_email} • {new Date(quote.response_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(quote.status)}
                <span className={`text-xs ${confidenceColor(quote.parse_confidence)}`}>
                  {quote.parse_confidence !== null ? `${Math.round(quote.parse_confidence * 100)}% confidence` : ''}
                </span>
              </div>
            </div>

            {/* Quote details */}
            <div className="px-5 py-4">
              {/* Stats row */}
              <div className="flex items-center gap-6 mb-4">
                {quote.total_cost && (
                  <div>
                    <span className="text-xs text-[var(--muted)]">Total</span>
                    <p className="text-lg font-bold text-[var(--foreground)]">{fmt(quote.total_cost)}</p>
                  </div>
                )}
                {quote.items && quote.items.length > 0 && (
                  <div>
                    <span className="text-xs text-[var(--muted)]">Line Items</span>
                    <p className="text-lg font-bold text-[var(--foreground)]">{quote.items.length}</p>
                  </div>
                )}
                {quote.shipping && (
                  <div>
                    <span className="text-xs text-[var(--muted)]">Shipping</span>
                    <p className="text-lg font-bold text-[var(--foreground)]">{fmt(quote.shipping)}</p>
                  </div>
                )}
                {quote.terms && (
                  <div>
                    <span className="text-xs text-[var(--muted)]">Terms</span>
                    <p className="text-sm font-medium text-[var(--foreground)]">{quote.terms}</p>
                  </div>
                )}
                {quote.valid_until && (
                  <div>
                    <span className="text-xs text-[var(--muted)]">Valid Until</span>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {new Date(quote.valid_until).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {quote.notes && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--background)] text-sm text-[var(--muted)]">
                  💬 {quote.notes}
                </div>
              )}

              {/* Line items (list view) */}
              {viewMode === 'list' && quote.items && quote.items.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-[var(--muted)] uppercase">Line Items</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-[var(--muted)] border-b border-[var(--border)]/30">
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">Part / Description</th>
                          <th className="text-right py-2 px-2">Qty</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Extended</th>
                          <th className="text-left py-2 px-2">Lead Time</th>
                          <th className="text-left py-2 px-2">Mfg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-b border-[var(--border)]/20 ${
                              item.is_best_price ? 'bg-[var(--success)]/5' : ''
                            }`}
                          >
                            <td className="py-2 px-2 text-[var(--muted)]">{item.line_number}</td>
                            <td className="py-2 px-2">
                              <div className="font-medium">{item.description}</div>
                              {item.part_number && (
                                <div className="text-xs text-[var(--muted)]">{item.part_number}</div>
                              )}
                            </td>
                            <td className="text-right py-2 px-2">{item.qty} {item.uom}</td>
                            <td className={`text-right py-2 px-2 font-medium ${
                              item.is_best_price ? 'text-[var(--success)]' : ''
                            }`}>
                              {fmt(item.unit_price)}
                              {item.is_best_price && ' ✅'}
                            </td>
                            <td className="text-right py-2 px-2">{fmt(item.extended_price)}</td>
                            <td className="py-2 px-2 text-[var(--muted)]">{item.lead_time || '—'}</td>
                            <td className="py-2 px-2 text-[var(--muted)]">{item.manufacturer || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]/30">
                {quote.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(quote.id, 'accepted')}
                      disabled={updatingStatus === quote.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50"
                    >
                      ✅ Accept
                    </button>
                    <button
                      onClick={() => handleStatusChange(quote.id, 'partial')}
                      disabled={updatingStatus === quote.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      📋 Partial Accept
                    </button>
                    <button
                      onClick={() => handleStatusChange(quote.id, 'rejected')}
                      disabled={updatingStatus === quote.id}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
                    >
                      ❌ Reject
                    </button>
                  </>
                )}
                {quote.status !== 'pending' && (
                  <button
                    onClick={() => handleStatusChange(quote.id, 'pending')}
                    disabled={updatingStatus === quote.id}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--muted)] hover:bg-[var(--card)] transition-colors"
                  >
                    ↩️ Reset to Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
