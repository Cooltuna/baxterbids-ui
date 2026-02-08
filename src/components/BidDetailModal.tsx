'use client';

import { useState, useEffect } from 'react';
import { Bid, BidSummary, LineItem, Vendor } from '@/types';
import { analyzeBid, batchSearchVendors, checkApiHealth, getCachedAnalysis, getCachedVendors, VendorMatrixResult } from '@/lib/api';
import RFQDraftModal from './RFQDraftModal';

interface BidDetailModalProps {
  bid: Bid | null;
  onClose: () => void;
}

type Tab = 'summary' | 'bom' | 'vendors' | 'rfq';

export default function BidDetailModal({ bid, onClose }: BidDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<BidSummary | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [vendorMatrix, setVendorMatrix] = useState<VendorMatrixResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSearchingVendors, setIsSearchingVendors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [showPasteBom, setShowPasteBom] = useState(false);
  const [bomText, setBomText] = useState('');
  const [rfqVendor, setRfqVendor] = useState<Vendor | null>(null);
  const [rfqItems, setRfqItems] = useState<LineItem[]>([]);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(false);

  // Check API availability on mount
  useEffect(() => {
    checkApiHealth().then(setApiAvailable);
  }, []);

  // Reset state and load cached data when bid changes
  useEffect(() => {
    if (bid) {
      // Reset state
      setSummary(null);
      setSelectedItems(new Set());
      setVendorMatrix(null);
      setError(null);
      setActiveTab('summary');
      setShowPasteBom(false);
      setBomText('');
      setIsFromCache(false);
      
      // Try to load cached data
      const loadCachedData = async () => {
        setIsLoadingCache(true);
        try {
          // Load cached analysis
          const cachedAnalysis = await getCachedAnalysis(bid.id);
          if (cachedAnalysis) {
            setSummary(cachedAnalysis);
            setSelectedItems(new Set(cachedAnalysis.line_items.map((_: LineItem, i: number) => i)));
            setIsFromCache(true);
            
            // If we have analysis, also try to load cached vendors
            const cachedVendors = await getCachedVendors(bid.id);
            if (cachedVendors) {
              setVendorMatrix(cachedVendors);
            }
          }
        } catch (err) {
          // Silently fail - cache loading is optional
          console.log('No cached data available');
        } finally {
          setIsLoadingCache(false);
        }
      };
      
      loadCachedData();
    }
  }, [bid?.id]);

  if (!bid) return null;

  const handleAnalyze = async (usePastedBom = false) => {
    if (!bid.url) {
      setError('No URL available for this bid');
      return;
    }

    if (usePastedBom && !bomText.trim()) {
      setError('Please paste the BOM text first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeBid(
        bid.id, 
        bid.url, 
        bid.title,
        usePastedBom ? bomText.trim() : undefined
      );
      setSummary(result);
      // Auto-select all items
      setSelectedItems(new Set(result.line_items.map((_, i) => i)));
      // Switch to BOM tab after analysis
      setActiveTab('bom');
      setShowPasteBom(false);
      setIsFromCache(false); // Fresh analysis
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze bid');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const toggleAllItems = () => {
    if (!summary) return;
    if (selectedItems.size === summary.line_items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(summary.line_items.map((_, i) => i)));
    }
  };

  const handleBatchResearch = async () => {
    if (!summary || selectedItems.size === 0 || !bid) return;

    setIsSearchingVendors(true);
    setError(null);
    setActiveTab('vendors');

    try {
      const items = Array.from(selectedItems).map(i => summary.line_items[i]);
      // Include bid_id for caching
      const result = await batchSearchVendors(items, bid.id);
      setVendorMatrix(result);
      setIsFromCache(false); // Fresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search vendors');
    } finally {
      setIsSearchingVendors(false);
    }
  };

  const handleDraftRFQ = (vendor: Vendor & { can_supply?: number[] }) => {
    // Get the items this vendor can supply
    if (vendorMatrix && vendor.can_supply) {
      const vendorItems = vendor.can_supply.map(num => vendorMatrix.items[num - 1]).filter(Boolean);
      setRfqItems(vendorItems as LineItem[]);
    } else if (summary) {
      // If no vendor matrix, use selected items
      const items = Array.from(selectedItems).map(i => summary.line_items[i]);
      setRfqItems(items);
    }
    setRfqVendor(vendor);
  };

  const exportBOM = () => {
    if (!summary) return;
    
    const csv = [
      ['Item #', 'Description', 'Quantity', 'Unit', 'Specifications'].join(','),
      ...summary.line_items.map((item, i) => [
        i + 1,
        `"${item.description.replace(/"/g, '""')}"`,
        item.quantity || '',
        item.unit || '',
        `"${(item.specifications || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOM_${bid.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex-1 pr-8">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {bid.title}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {bid.id} • {bid.agency}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* API Status Banner */}
          {apiAvailable === false && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30 flex-shrink-0">
              <div className="flex items-center gap-2 text-[var(--warning)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium">API Server Offline</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Run <code className="px-1 py-0.5 rounded bg-[var(--card)]">python api_server.py</code> in the bids folder.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-4 flex-shrink-0">
            {(['summary', 'bom', 'vendors', 'rfq'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={tab !== 'summary' && !summary}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {tab === 'summary' && '📋 Summary'}
                {tab === 'bom' && `📦 BOM ${summary ? `(${summary.line_items.length})` : ''}`}
                {tab === 'vendors' && '🏢 Vendors'}
                {tab === 'rfq' && '📝 RFQ'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
                {error}
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div>
                {!summary ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--card)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                      AI-Powered Analysis
                    </h3>
                    <p className="text-[var(--muted)] mb-6 max-w-md mx-auto">
                      Analyze this bid to extract the Bill of Materials, requirements, and key dates.
                    </p>
                    
                    {!showPasteBom ? (
                      <div className="space-y-3">
                        <button
                          onClick={() => handleAnalyze(false)}
                          disabled={isAnalyzing || apiAvailable === false}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAnalyzing ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Auto-Analyze from URL
                            </>
                          )}
                        </button>
                        <div className="text-[var(--muted)] text-sm">or</div>
                        <button
                          onClick={() => setShowPasteBom(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--card)] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Paste BOM from Fairmarkit
                        </button>
                        <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                          For detailed BOMs, copy the item list from Fairmarkit and paste it here
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto text-left">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                          Paste BOM text from Fairmarkit:
                        </label>
                        <textarea
                          value={bomText}
                          onChange={(e) => setBomText(e.target.value)}
                          placeholder="Paste the entire bid details including items list from Fairmarkit..."
                          className="w-full h-48 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                        />
                        <div className="flex items-center justify-between mt-3">
                          <button
                            onClick={() => setShowPasteBom(false)}
                            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAnalyze(true)}
                            disabled={isAnalyzing || !bomText.trim()}
                            className="inline-flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAnalyzing ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Analyzing...
                              </>
                            ) : (
                              'Analyze Pasted BOM'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Scope */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                        Scope
                      </h4>
                      <p className="text-[var(--foreground)]">{summary.scope}</p>
                    </div>

                    {/* Key Dates */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                        Key Dates
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {summary.key_dates.posted && (
                          <div className="p-3 rounded-lg bg-[var(--card)]">
                            <p className="text-xs text-[var(--muted)]">Posted</p>
                            <p className="font-medium">{summary.key_dates.posted}</p>
                          </div>
                        )}
                        {summary.key_dates.questions_due && (
                          <div className="p-3 rounded-lg bg-[var(--card)]">
                            <p className="text-xs text-[var(--muted)]">Questions Due</p>
                            <p className="font-medium">{summary.key_dates.questions_due}</p>
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
                          <p className="text-xs text-[var(--warning)]">Submission Due</p>
                          <p className="font-medium text-[var(--warning)]">{summary.deadline}</p>
                        </div>
                        {summary.key_dates.award_date && (
                          <div className="p-3 rounded-lg bg-[var(--card)]">
                            <p className="text-xs text-[var(--muted)]">Award Date</p>
                            <p className="font-medium">{summary.key_dates.award_date}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Requirements */}
                    {summary.requirements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                          Requirements
                        </h4>
                        <ul className="space-y-1">
                          {summary.requirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[var(--foreground)]">
                              <span className="text-[var(--accent)]">•</span>
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {summary.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                          💡 Recommendations
                        </h4>
                        <ul className="space-y-1">
                          {summary.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[var(--foreground)]">
                              <span className="text-[var(--success)]">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setActiveTab('bom')}
                        className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors"
                      >
                        View Bill of Materials →
                      </button>
                      {isFromCache && (
                        <button
                          onClick={() => {
                            setSummary(null);
                            setVendorMatrix(null);
                            setIsFromCache(false);
                          }}
                          className="px-4 py-2 border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--card)] transition-colors"
                        >
                          Re-analyze
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BOM Tab */}
            {activeTab === 'bom' && summary && (
              <div>
                {/* BOM Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === summary.line_items.length}
                        onChange={toggleAllItems}
                        className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                      <span className="text-sm font-medium">Select All</span>
                    </label>
                    <span className="text-sm text-[var(--muted)]">
                      {selectedItems.size} of {summary.line_items.length} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportBOM}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={handleBatchResearch}
                      disabled={selectedItems.size === 0 || isSearchingVendors}
                      className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSearchingVendors ? 'Researching...' : `Research ${selectedItems.size} Items`}
                    </button>
                  </div>
                </div>

                {/* BOM List */}
                <div className="space-y-2">
                  {summary.line_items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedItems.has(idx)
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/50'
                          : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(idx)}
                          onChange={() => toggleItem(idx)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-mono text-[var(--muted)] mr-2">#{idx + 1}</span>
                              <span className="font-medium text-[var(--foreground)]">{item.description}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--muted)]">
                            {item.quantity && (
                              <span className="px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                                Qty: {item.quantity}
                              </span>
                            )}
                            {item.unit && (
                              <span className="px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                                Unit: {item.unit}
                              </span>
                            )}
                          </div>
                          {item.specifications && (
                            <p className="text-sm text-[var(--muted)] mt-2">
                              <span className="font-medium">Specs:</span> {item.specifications}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendors Tab */}
            {activeTab === 'vendors' && (
              <div>
                {isSearchingVendors ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-[var(--muted)] mt-4">Researching vendors for {selectedItems.size} items...</p>
                    <p className="text-xs text-[var(--muted)] mt-1">This may take a moment</p>
                  </div>
                ) : !vendorMatrix ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--card)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                      No Vendor Research Yet
                    </h3>
                    <p className="text-[var(--muted)] mb-4">
                      Go to the BOM tab, select items, and click &quot;Research Items&quot;
                    </p>
                    <button
                      onClick={() => setActiveTab('bom')}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors"
                    >
                      Go to BOM
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Recommendations */}
                    {vendorMatrix.recommendations.length > 0 && (
                      <div className="p-4 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/30">
                        <h4 className="font-semibold text-[var(--accent)] mb-2">💡 Recommendations</h4>
                        <ul className="space-y-1">
                          {vendorMatrix.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-[var(--foreground)]">→ {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Vendor Matrix */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        Vendor Coverage Matrix
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th className="text-left py-2 px-3 font-semibold">Vendor</th>
                              {vendorMatrix.items.map((item, idx) => (
                                <th key={idx} className="text-center py-2 px-2 font-medium" title={item.description}>
                                  #{idx + 1}
                                </th>
                              ))}
                              <th className="text-center py-2 px-3 font-semibold">Coverage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendorMatrix.vendors.map((vendor, vidx) => (
                              <tr key={vidx} className="border-b border-[var(--border)] hover:bg-[var(--card)]">
                                <td className="py-2 px-3">
                                  <div>
                                    <p className="font-medium">{vendor.name}</p>
                                    {vendor.website && (
                                      <a 
                                        href={vendor.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-[var(--accent)] hover:underline"
                                      >
                                        {vendor.website.replace(/^https?:\/\//, '').split('/')[0]}
                                      </a>
                                    )}
                                  </div>
                                </td>
                                {vendorMatrix.items.map((_, idx) => (
                                  <td key={idx} className="text-center py-2 px-2">
                                    {vendor.can_supply.includes(idx + 1) ? (
                                      <span className="text-[var(--success)]">✓</span>
                                    ) : (
                                      <span className="text-[var(--muted)]">-</span>
                                    )}
                                  </td>
                                ))}
                                <td className="text-center py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    vendor.can_supply.length === vendorMatrix.items.length
                                      ? 'bg-[var(--success)]/20 text-[var(--success)]'
                                      : vendor.can_supply.length >= vendorMatrix.items.length / 2
                                      ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                                      : 'bg-[var(--card)] text-[var(--muted)]'
                                  }`}>
                                    {vendor.can_supply.length}/{vendorMatrix.items.length}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Item Legend */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                        Item Legend
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {vendorMatrix.items.map((item, idx) => (
                          <div key={idx} className="text-sm p-2 rounded bg-[var(--card)]">
                            <span className="font-mono text-[var(--accent)]">#{idx + 1}</span>
                            <span className="mx-2">-</span>
                            <span className="text-[var(--foreground)]">{item.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Vendor Details */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        Vendor Details
                      </h4>
                      <div className="space-y-3">
                        {vendorMatrix.vendors.map((vendor, idx) => (
                          <div key={idx} className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-semibold text-[var(--foreground)]">{vendor.name}</h5>
                                {vendor.website && (
                                  <a 
                                    href={vendor.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-[var(--accent)] hover:underline"
                                  >
                                    {vendor.website}
                                  </a>
                                )}
                              </div>
                              <button 
                                onClick={() => handleDraftRFQ({
                                  name: vendor.name,
                                  website: vendor.website,
                                  contact: vendor.contact,
                                  products: [],
                                  can_supply: vendor.can_supply
                                } as Vendor & { can_supply: number[] })}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
                              >
                                Draft RFQ
                              </button>
                            </div>
                            {vendor.contact && (
                              <p className="text-sm text-[var(--foreground)] mt-2">📧 {vendor.contact}</p>
                            )}
                            {vendor.notes && (
                              <p className="text-sm text-[var(--muted)] mt-2">{vendor.notes}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {vendor.can_supply.map((itemNum) => (
                                <span key={itemNum} className="px-2 py-0.5 text-xs rounded bg-[var(--success)]/10 text-[var(--success)]">
                                  #{itemNum}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RFQ Tab */}
            {activeTab === 'rfq' && (
              <div>
                {!vendorMatrix ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--card)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                      RFQ Generator
                    </h3>
                    <p className="text-[var(--muted)] mb-4">
                      Research vendors first, then generate RFQs from the vendor matrix.
                    </p>
                    <button
                      onClick={() => setActiveTab('vendors')}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors"
                    >
                      Go to Vendors Tab
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/30">
                      <h4 className="font-semibold text-[var(--accent)] mb-2">📝 How to Generate RFQs</h4>
                      <ol className="text-sm space-y-2 text-[var(--foreground)]">
                        <li>1. Go to the <strong>Vendors</strong> tab</li>
                        <li>2. Find a vendor you want to request quotes from</li>
                        <li>3. Click the <strong>&quot;Draft RFQ&quot;</strong> button next to their name</li>
                        <li>4. AI will generate a professional email based on the items they can supply</li>
                        <li>5. Review, edit, and send!</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        Quick RFQ - Select a Vendor
                      </h4>
                      <div className="grid gap-3">
                        {vendorMatrix.vendors.map((vendor, idx) => (
                          <div 
                            key={idx} 
                            className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{vendor.name}</p>
                              <p className="text-sm text-[var(--muted)]">
                                Can supply {vendor.can_supply.length} of {vendorMatrix.items.length} items
                              </p>
                            </div>
                            <button 
                              onClick={() => handleDraftRFQ({
                                name: vendor.name,
                                website: vendor.website,
                                contact: vendor.contact,
                                products: [],
                                can_supply: vendor.can_supply
                              } as Vendor & { can_supply: number[] })}
                              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
                            >
                              Draft RFQ
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--card)]/50 flex-shrink-0">
            <div className="text-sm text-[var(--muted)]">
              {isLoadingCache && (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading saved data...
                </span>
              )}
              {summary && !isLoadingCache && (
                <span className="flex items-center gap-2">
                  {isFromCache && (
                    <span className="px-2 py-0.5 text-xs rounded bg-[var(--success)]/20 text-[var(--success)]">
                      📁 Cached
                    </span>
                  )}
                  Analyzed {new Date(summary.analyzed_at).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={bid.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
              >
                Open Original
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RFQ Draft Modal */}
      {rfqVendor && summary && (
        <RFQDraftModal
          isOpen={!!rfqVendor}
          onClose={() => {
            setRfqVendor(null);
            setRfqItems([]);
          }}
          bidId={bid.id}
          bidTitle={summary.title || bid.title}
          vendor={rfqVendor}
          items={rfqItems}
          deadline={summary.deadline || bid.closeDate}
          onSent={() => {
            // Could refresh RFQ list here
          }}
        />
      )}
    </div>
  );
}
