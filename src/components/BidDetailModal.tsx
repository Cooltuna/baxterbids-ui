'use client';

import { useState, useEffect } from 'react';
import { Bid, BidSummary, LineItem, Vendor, BidDocument } from '@/types';
import { analyzeBid, batchSearchVendors, checkApiHealth, getCachedAnalysis, getCachedVendors, getBidRFQs, fetchBidDetails, VendorMatrixResult, RFQRecord } from '@/lib/api';
import { getDocumentUrl } from '@/lib/supabase';
import RFQDraftModal from './RFQDraftModal';
import CustomVendorInput from './CustomVendorInput';

interface BidDetailModalProps {
  bid: Bid | null;
  onClose: () => void;
  autoAnalyze?: boolean;
  onAnalysisComplete?: () => void;
}

// Helper function to get file icon based on type
function getFileIcon(fileType: string) {
  const type = fileType?.toLowerCase() || '';
  
  if (type === 'pdf') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-2.5 9.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
      </svg>
    );
  }
  
  if (type === 'xlsx' || type === 'xls') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9 19H7v-2h2v2zm0-4H7v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-1-5V4l5 5h-5z"/>
      </svg>
    );
  }
  
  if (type === 'docx' || type === 'doc') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 12h8v2H8v-2zm0 4h8v2H8v-2z"/>
      </svg>
    );
  }
  
  // Default file icon
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
    </svg>
  );
}

type Tab = 'summary' | 'docs' | 'bom' | 'vendors' | 'rfq';

export default function BidDetailModal({ bid, onClose, autoAnalyze = false, onAnalysisComplete }: BidDetailModalProps) {
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
  const [sentRFQs, setSentRFQs] = useState<RFQRecord[]>([]);
  const [isLoadingRFQs, setIsLoadingRFQs] = useState(false);
  const [previewRFQ, setPreviewRFQ] = useState<RFQRecord | null>(null);
  const [showBidSummary, setShowBidSummary] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Check API availability on mount
  useEffect(() => {
    checkApiHealth().then(setApiAvailable);
  }, []);

  // Load sent RFQs for this bid
  const loadRFQs = async () => {
    if (!bid) return;
    setIsLoadingRFQs(true);
    try {
      const data = await getBidRFQs(bid.id);
      setSentRFQs(data.rfqs || []);
    } catch (err) {
      console.log('No RFQs found for bid');
      setSentRFQs([]);
    } finally {
      setIsLoadingRFQs(false);
    }
  };

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
      setSentRFQs([]);
      
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

  // Auto-analyze effect - must be before early return to follow React hooks rules
  useEffect(() => {
    // Only auto-analyze when autoAnalyze flag is set and conditions are met
    if (!autoAnalyze || !bid?.url || summary || isLoadingCache || isAnalyzing || apiAvailable === false) {
      return;
    }
    
    // Delay to let cache loading complete first
    const timer = setTimeout(async () => {
      // Re-check conditions and run analysis directly here
      if (!summary && !isLoadingCache && bid?.url) {
        setIsAnalyzing(true);
        setError(null);
        try {
          const result = await analyzeBid(bid.id, bid.url, bid.title);
          setSummary(result);
          setSelectedItems(new Set(result.line_items.map((_: unknown, i: number) => i)));
          setActiveTab('bom');
          setIsFromCache(false);
          onAnalysisComplete?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to analyze bid');
          onAnalysisComplete?.();
        } finally {
          setIsAnalyzing(false);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [autoAnalyze, bid?.id, bid?.url, bid?.title, summary, isLoadingCache, isAnalyzing, apiAvailable, onAnalysisComplete]);

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
      let rawBomText = usePastedBom ? bomText.trim() : undefined;
      
      // For Unison bids, fetch details using authenticated scraper
      if (bid.source?.toLowerCase() === 'unison' && !usePastedBom) {
        try {
          const details = await fetchBidDetails(bid.id, bid.url, 'unison');
          rawBomText = details.description;
        } catch (fetchErr) {
          console.warn('Failed to fetch Unison details, trying direct analysis:', fetchErr);
        }
      }
      
      const result = await analyzeBid(
        bid.id, 
        bid.url, 
        bid.title,
        rawBomText
      );
      setSummary(result);
      // Auto-select all items
      setSelectedItems(new Set(result.line_items.map((_, i) => i)));
      // Switch to BOM tab after analysis
      setActiveTab('bom');
      setShowPasteBom(false);
      setIsFromCache(false); // Fresh analysis
      // Notify parent that analysis is complete
      onAnalysisComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze bid');
      // Also notify on error so loading state clears
      onAnalysisComplete?.();
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
          <div className="flex items-center gap-1 px-6 pt-4 flex-shrink-0 overflow-x-auto">
            {/* Summary tab - always visible */}
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'summary'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
              }`}
            >
              📋 Summary
            </button>
            
            {/* Documents tab - only show if bid has documents */}
            {bid.documents && bid.documents.length > 0 && (
              <button
                onClick={async () => {
                  setActiveTab('docs');
                  // Load document URLs if not already loaded
                  if (Object.keys(documentUrls).length === 0 && bid.documents) {
                    setIsLoadingDocs(true);
                    const urls: Record<string, string> = {};
                    for (const doc of bid.documents) {
                      if (doc.storage_path) {
                        const url = await getDocumentUrl(doc.storage_path);
                        if (url) urls[doc.storage_path] = url;
                      }
                    }
                    setDocumentUrls(urls);
                    setIsLoadingDocs(false);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'docs'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                }`}
              >
                📄 Documents ({bid.documents.length})
              </button>
            )}
            
            {/* Other tabs - require summary */}
            {(['bom', 'vendors', 'rfq'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'rfq') {
                    loadRFQs();
                  }
                }}
                disabled={!summary}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {tab === 'bom' && `📦 BOM ${summary ? `(${summary.line_items.length})` : ''}`}
                {tab === 'vendors' && '🏢 Vendors'}
                {tab === 'rfq' && `📝 RFQ ${sentRFQs.length > 0 ? `(${sentRFQs.length})` : ''}`}
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
                {/* Show pre-populated description for email-based bids */}
                {!summary && bid.description ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--accent)]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email-based bid - Pre-analyzed
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <div className="bg-[var(--card)] rounded-lg p-4 border border-[var(--border)] whitespace-pre-wrap text-sm">
                        {bid.description}
                      </div>
                    </div>
                  </div>
                ) : !summary ? (
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

            {/* Documents Tab */}
            {activeTab === 'docs' && bid.documents && bid.documents.length > 0 && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    Bid Documents
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {bid.documents.length} document{bid.documents.length !== 1 ? 's' : ''} attached to this bid
                  </p>
                </div>

                {isLoadingDocs ? (
                  <div className="text-center py-8">
                    <svg className="w-8 h-8 mx-auto text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-[var(--muted)] mt-2">Loading documents...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bid.documents.map((doc, idx) => {
                      const downloadUrl = documentUrls[doc.storage_path];
                      const fileIcon = getFileIcon(doc.type);
                      
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                              {fileIcon}
                            </div>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{doc.name}</p>
                              <p className="text-xs text-[var(--muted)]">
                                {doc.type.toUpperCase()} {doc.size && `• ${doc.size}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {downloadUrl ? (
                              <>
                                <a
                                  href={['pdf'].includes(doc.type?.toLowerCase()) 
                                    ? downloadUrl 
                                    : `https://docs.google.com/viewer?url=${encodeURIComponent(downloadUrl)}&embedded=true`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                                >
                                  👁️ Preview
                                </a>
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
                                >
                                  ⬇️ Download
                                </a>
                              </>
                            ) : (
                              <span className="px-4 py-2 text-sm text-[var(--muted)]">
                                Loading...
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                              <div className="flex items-center gap-2">
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
                                <button
                                  onClick={() => {
                                    setVendorMatrix(prev => prev ? {
                                      ...prev,
                                      vendors: prev.vendors.filter((_, i) => i !== idx)
                                    } : null);
                                  }}
                                  className="px-2 py-1.5 text-xs font-medium rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
                                  title="Remove vendor"
                                >
                                  ✕
                                </button>
                              </div>
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

                        {/* Add Custom Vendor with Typeahead */}
                        <CustomVendorInput 
                          onDraftRFQ={(name, email) => {
                            handleDraftRFQ({
                              name: name,
                              contact: email || '',
                              products: [],
                              can_supply: vendorMatrix.items.map((_, i) => i + 1)
                            } as Vendor & { can_supply: number[] });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RFQ Tab */}
            {activeTab === 'rfq' && (
              <div className="space-y-6">
                {/* Bid Summary Button - Show when we have responses */}
                {sentRFQs.filter(r => r.status === 'responded').length > 0 && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--accent)]/10 to-[var(--success)]/10 border border-[var(--accent)]/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-[var(--foreground)]">📊 Ready to Build Your Bid?</h4>
                        <p className="text-sm text-[var(--muted)] mt-1">
                          {sentRFQs.filter(r => r.status === 'responded').length} vendor response(s) received
                        </p>
                      </div>
                      <button
                        onClick={() => setShowBidSummary(true)}
                        className="px-4 py-2 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
                      >
                        📋 Bid Summary & Analysis
                      </button>
                    </div>
                  </div>
                )}

                {/* Sent RFQs Log */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
                      📬 RFQ History
                    </h4>
                    <button
                      onClick={loadRFQs}
                      disabled={isLoadingRFQs}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      {isLoadingRFQs ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  
                  {sentRFQs.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] text-center">
                      <p className="text-[var(--muted)]">No RFQs sent yet for this bid</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sentRFQs.map((rfq) => (
                        <div 
                          key={rfq.id}
                          className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[var(--foreground)]">{rfq.vendor_name}</p>
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                  rfq.status === 'sent' 
                                    ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                                    : rfq.status === 'responded'
                                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                                    : rfq.status === 'won'
                                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                                    : 'bg-[var(--muted)]/20 text-[var(--muted)]'
                                }`}>
                                  {rfq.status === 'sent' ? '📤 Sent' : 
                                   rfq.status === 'responded' ? '📥 Responded' :
                                   rfq.status === 'won' ? '🏆 Won' :
                                   rfq.status === 'lost' ? '❌ Lost' : rfq.status}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--muted)] mt-1">{rfq.vendor_email}</p>
                              <p className="text-xs text-[var(--muted)] mt-1">
                                Sent: {new Date(rfq.sent_at).toLocaleString()}
                              </p>
                              {rfq.quoted_total && (
                                <p className="text-sm font-semibold text-[var(--success)] mt-2">
                                  💰 Quote: ${rfq.quoted_total.toLocaleString()}
                                </p>
                              )}
                              {rfq.response_received_at && (
                                <p className="text-xs text-[var(--muted)] mt-1">
                                  Response received: {new Date(rfq.response_received_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[var(--muted)]">
                                {JSON.parse(rfq.items_json || '[]').length} items
                              </p>
                            </div>
                          </div>
                          
                          {/* Response Details - Expandable for responded RFQs */}
                          {rfq.status === 'responded' && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                              <div className="flex items-center gap-3">
                                {rfq.notes && (
                                  <details className="flex-1">
                                    <summary className="cursor-pointer text-sm font-medium text-[var(--accent)] hover:underline">
                                      📋 View Quote Details
                                    </summary>
                                    <div className="mt-2 p-3 bg-[var(--background)] rounded-lg text-sm">
                                      <p className="whitespace-pre-wrap text-[var(--foreground)]">{rfq.notes}</p>
                                    </div>
                                  </details>
                                )}
                                <button
                                  onClick={() => setPreviewRFQ(rfq)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
                                >
                                  👁️ Preview
                                </button>
                                <button
                                  onClick={() => {
                                    const content = `RFQ Response - ${rfq.vendor_name}
=====================================
Bid ID: ${rfq.bid_id}
Vendor: ${rfq.vendor_name}
Email: ${rfq.vendor_email || 'N/A'}
Status: ${rfq.status}

Sent: ${new Date(rfq.sent_at).toLocaleString()}
Response Received: ${rfq.response_received_at ? new Date(rfq.response_received_at).toLocaleString() : 'N/A'}

QUOTED TOTAL: $${rfq.quoted_total?.toLocaleString() || 'N/A'}

Items Requested:
${JSON.parse(rfq.items_json || '[]').map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

Quote Details:
${rfq.notes || 'No details available'}
`;
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `RFQ_Response_${rfq.vendor_name.replace(/\s+/g, '_')}_${rfq.bid_id}.txt`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                                >
                                  ⬇️ Download
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick RFQ Section */}
                {vendorMatrix && (
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                      ➕ Send New RFQ
                    </h4>
                    <div className="grid gap-3">
                      {vendorMatrix.vendors.map((vendor, idx) => {
                        const alreadySent = sentRFQs.some(r => r.vendor_name === vendor.name);
                        return (
                          <div 
                            key={idx} 
                            className={`p-4 rounded-lg border flex items-center justify-between ${
                              alreadySent 
                                ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
                                : 'bg-[var(--card)] border-[var(--border)]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[var(--foreground)]">{vendor.name}</p>
                                {alreadySent && (
                                  <span className="text-xs text-[var(--success)]">✓ RFQ Sent</span>
                                )}
                              </div>
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
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                alreadySent
                                  ? 'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]'
                                  : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                              }`}
                            >
                              {alreadySent ? 'Send Again' : 'Draft RFQ'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!vendorMatrix && (
                  <div className="text-center py-8">
                    <p className="text-[var(--muted)] mb-4">
                      Research vendors first to send RFQs
                    </p>
                    <button
                      onClick={() => setActiveTab('vendors')}
                      className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors"
                    >
                      Go to Vendors Tab
                    </button>
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
            // Refresh RFQ list and switch to RFQ tab
            loadRFQs();
            setActiveTab('rfq');
          }}
        />
      )}

      {/* Bid Summary & Analysis Modal */}
      {showBidSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBidSummary(false)}
          />
          <div className="relative bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--accent)]/10 to-[var(--success)]/10">
              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">
                  📊 Bid Summary & Analysis
                </h3>
                <p className="text-sm text-[var(--muted)]">{bid?.title}</p>
              </div>
              <button
                onClick={() => setShowBidSummary(false)}
                className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] text-center">
                  <p className="text-3xl font-bold text-[var(--foreground)]">
                    {sentRFQs.filter(r => r.status === 'responded').length}
                  </p>
                  <p className="text-sm text-[var(--muted)]">Responses</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-center">
                  <p className="text-3xl font-bold text-[var(--success)]">
                    ${Math.min(...sentRFQs.filter(r => r.quoted_total).map(r => r.quoted_total!)).toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--muted)]">Lowest Quote</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-center">
                  <p className="text-3xl font-bold text-[var(--warning)]">
                    ${Math.max(...sentRFQs.filter(r => r.quoted_total).map(r => r.quoted_total!)).toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--muted)]">Highest Quote</p>
                </div>
              </div>

              {/* Vendor Comparison Table */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                  💰 Vendor Quote Comparison
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Vendor</th>
                        <th className="text-right py-3 px-4 font-semibold text-[var(--foreground)]">Quoted Total</th>
                        <th className="text-right py-3 px-4 font-semibold text-[var(--foreground)]">vs Lowest</th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--foreground)]">Response Time</th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--foreground)]">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentRFQs
                        .filter(r => r.status === 'responded' && r.quoted_total)
                        .sort((a, b) => (a.quoted_total || 0) - (b.quoted_total || 0))
                        .map((rfq, idx) => {
                          const lowestQuote = Math.min(...sentRFQs.filter(r => r.quoted_total).map(r => r.quoted_total!));
                          const diff = ((rfq.quoted_total! - lowestQuote) / lowestQuote * 100);
                          const responseTime = rfq.response_received_at && rfq.sent_at 
                            ? Math.round((new Date(rfq.response_received_at).getTime() - new Date(rfq.sent_at).getTime()) / (1000 * 60 * 60))
                            : null;
                          
                          return (
                            <tr key={rfq.id} className={`border-b border-[var(--border)] ${idx === 0 ? 'bg-[var(--success)]/5' : ''}`}>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && <span className="text-[var(--success)]">🏆</span>}
                                  <span className="font-medium text-[var(--foreground)]">{rfq.vendor_name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-[var(--foreground)]">
                                ${rfq.quoted_total?.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {idx === 0 ? (
                                  <span className="text-[var(--success)] font-medium">Lowest</span>
                                ) : (
                                  <span className="text-[var(--warning)]">+{diff.toFixed(1)}%</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-[var(--muted)]">
                                {responseTime !== null ? `${responseTime}h` : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {idx === 0 ? (
                                  <span className="px-2 py-1 text-xs rounded-full bg-[var(--success)]/20 text-[var(--success)] font-medium">
                                    Best Price
                                  </span>
                                ) : diff < 5 ? (
                                  <span className="px-2 py-1 text-xs rounded-full bg-[var(--warning)]/20 text-[var(--warning)] font-medium">
                                    Competitive
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs rounded-full bg-[var(--muted)]/20 text-[var(--muted)] font-medium">
                                    Higher
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">📝 Analysis Summary</h4>
                {(() => {
                  const responses = sentRFQs.filter(r => r.status === 'responded' && r.quoted_total);
                  const lowest = responses.length > 0 ? responses.reduce((a, b) => a.quoted_total! < b.quoted_total! ? a : b) : null;
                  const avg = responses.length > 0 ? responses.reduce((sum, r) => sum + r.quoted_total!, 0) / responses.length : 0;
                  
                  return (
                    <div className="space-y-2 text-sm text-[var(--muted)]">
                      <p>• Received <strong className="text-[var(--foreground)]">{responses.length}</strong> vendor quote(s)</p>
                      {lowest && (
                        <p>• <strong className="text-[var(--success)]">{lowest.vendor_name}</strong> offers the lowest price at <strong className="text-[var(--success)]">${lowest.quoted_total?.toLocaleString()}</strong></p>
                      )}
                      <p>• Average quote: <strong className="text-[var(--foreground)]">${avg.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong></p>
                      {lowest && avg > 0 && (
                        <p>• Lowest quote is <strong className="text-[var(--success)]">{((avg - lowest.quoted_total!) / avg * 100).toFixed(1)}%</strong> below average</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Bid Recommendation */}
              <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">💡 Bid Recommendation</h4>
                {(() => {
                  const responses = sentRFQs.filter(r => r.status === 'responded' && r.quoted_total);
                  const lowest = responses.length > 0 ? Math.min(...responses.map(r => r.quoted_total!)) : 0;
                  const markup15 = lowest * 1.15;
                  const markup20 = lowest * 1.20;
                  const markup25 = lowest * 1.25;
                  
                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--muted)]">Based on lowest vendor quote of <strong className="text-[var(--foreground)]">${lowest.toLocaleString()}</strong>:</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-center">
                          <p className="text-xs text-[var(--muted)]">15% Markup</p>
                          <p className="text-lg font-bold text-[var(--foreground)]">${markup15.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-center">
                          <p className="text-xs text-[var(--accent)]">20% Markup ⭐</p>
                          <p className="text-lg font-bold text-[var(--accent)]">${markup20.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-center">
                          <p className="text-xs text-[var(--muted)]">25% Markup</p>
                          <p className="text-lg font-bold text-[var(--foreground)]">${markup25.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  const responses = sentRFQs.filter(r => r.status === 'responded' && r.quoted_total);
                  const lowest = responses.length > 0 ? responses.reduce((a, b) => a.quoted_total! < b.quoted_total! ? a : b) : null;
                  const avg = responses.length > 0 ? responses.reduce((sum, r) => sum + r.quoted_total!, 0) / responses.length : 0;
                  
                  const content = `BID SUMMARY & ANALYSIS
=====================================
Bid: ${bid?.title}
Bid ID: ${bid?.id}
Generated: ${new Date().toLocaleString()}

VENDOR QUOTES
-------------
${responses.sort((a, b) => (a.quoted_total || 0) - (b.quoted_total || 0)).map((r, i) => 
  `${i + 1}. ${r.vendor_name}: $${r.quoted_total?.toLocaleString()}${i === 0 ? ' (LOWEST)' : ''}`
).join('\n')}

ANALYSIS
--------
• Total Responses: ${responses.length}
• Lowest Quote: $${lowest?.quoted_total?.toLocaleString()} (${lowest?.vendor_name})
• Highest Quote: $${Math.max(...responses.map(r => r.quoted_total!)).toLocaleString()}
• Average Quote: $${avg.toLocaleString(undefined, {maximumFractionDigits: 2})}

BID RECOMMENDATIONS
-------------------
• 15% Markup: $${(lowest?.quoted_total! * 1.15).toLocaleString(undefined, {maximumFractionDigits: 2})}
• 20% Markup: $${(lowest?.quoted_total! * 1.20).toLocaleString(undefined, {maximumFractionDigits: 2})}
• 25% Markup: $${(lowest?.quoted_total! * 1.25).toLocaleString(undefined, {maximumFractionDigits: 2})}

VENDOR DETAILS
--------------
${responses.map(r => `
${r.vendor_name}
  Quoted: $${r.quoted_total?.toLocaleString()}
  Email: ${r.vendor_email}
  Notes: ${r.notes || 'N/A'}
`).join('\n')}
`;
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Bid_Summary_${bid?.id}_${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
              >
                ⬇️ Export Analysis
              </button>
              <button
                onClick={() => setShowBidSummary(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RFQ Response Preview Modal */}
      {previewRFQ && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewRFQ(null)}
          />
          <div className="relative bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  Quote from {previewRFQ.vendor_name}
                </h3>
                <p className="text-sm text-[var(--muted)]">Bid: {previewRFQ.bid_id}</p>
              </div>
              <button
                onClick={() => setPreviewRFQ(null)}
                className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Quote Total */}
              <div className="p-4 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30">
                <p className="text-sm text-[var(--muted)]">Quoted Total</p>
                <p className="text-3xl font-bold text-[var(--success)]">
                  ${previewRFQ.quoted_total?.toLocaleString() || 'N/A'}
                </p>
              </div>

              {/* Vendor Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Vendor</p>
                  <p className="font-medium text-[var(--foreground)]">{previewRFQ.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Email</p>
                  <p className="font-medium text-[var(--foreground)]">{previewRFQ.vendor_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider">RFQ Sent</p>
                  <p className="font-medium text-[var(--foreground)]">{new Date(previewRFQ.sent_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Response Received</p>
                  <p className="font-medium text-[var(--foreground)]">
                    {previewRFQ.response_received_at ? new Date(previewRFQ.response_received_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Items Requested */}
              <div>
                <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Items Requested</p>
                <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                  <ul className="space-y-1 text-sm">
                    {JSON.parse(previewRFQ.items_json || '[]').map((item: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[var(--muted)]">{i + 1}.</span>
                        <span className="text-[var(--foreground)]">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Quote Details */}
              {previewRFQ.notes && (
                <div>
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Quote Details</p>
                  <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{previewRFQ.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  const content = `RFQ Response - ${previewRFQ.vendor_name}
=====================================
Bid ID: ${previewRFQ.bid_id}
Vendor: ${previewRFQ.vendor_name}
Email: ${previewRFQ.vendor_email || 'N/A'}

Sent: ${new Date(previewRFQ.sent_at).toLocaleString()}
Response Received: ${previewRFQ.response_received_at ? new Date(previewRFQ.response_received_at).toLocaleString() : 'N/A'}

QUOTED TOTAL: $${previewRFQ.quoted_total?.toLocaleString() || 'N/A'}

Items Requested:
${JSON.parse(previewRFQ.items_json || '[]').map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

Quote Details:
${previewRFQ.notes || 'No details available'}
`;
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `RFQ_Response_${previewRFQ.vendor_name.replace(/\s+/g, '_')}_${previewRFQ.bid_id}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
              >
                ⬇️ Download
              </button>
              <button
                onClick={() => setPreviewRFQ(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
