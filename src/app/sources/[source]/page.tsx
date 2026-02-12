'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import BidTable from '@/components/BidTable';
import BidDetailModal from '@/components/BidDetailModal';
import { Bid } from '@/types';
import { getRFQSummary, RFQSummary } from '@/lib/api';

interface SourceStats {
  total: number;
  closingToday: number;
  closingThreeDays: number;
  postedToday: number;
  reviewed: number;
  interested: number;
}

export default function SourceDashboard() {
  const params = useParams();
  const sourceKey = params.source as string;
  const isCACI = sourceKey?.toLowerCase() === 'caci';
  const sourceName = isCACI ? 'CACI' : sourceKey?.charAt(0).toUpperCase() + sourceKey?.slice(1);
  
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [rfqSummary, setRfqSummary] = useState<RFQSummary>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // CACI Login state
  const [caciStatus, setCaciStatus] = useState<'idle' | 'launching' | 'waiting' | 'success' | 'error'>('idle');
  const [caciMessage, setCaciMessage] = useState('');
  const [caciSession, setCaciSession] = useState<{ valid: boolean; cookieCount: number; hoursOld?: number } | null>(null);
  
  function getDaysUntilClose(closeDate: string): number | null {
    if (!closeDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates only, not times
    const close = new Date(closeDate);
    close.setHours(0, 0, 0, 0);
    return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function isExpired(closeDate: string): boolean {
    const days = getDaysUntilClose(closeDate);
    return days !== null && days < 0;
  }

  // Split bids into active and closed
  const activeBids = bids.filter(b => !isExpired(b.closeDate));
  const closedBids = bids.filter(b => isExpired(b.closeDate));

  // Calculate stats (based on active bids only)
  const stats: SourceStats = {
    total: activeBids.length,
    closingToday: activeBids.filter(b => {
      const days = getDaysUntilClose(b.closeDate);
      return days !== null && days === 0;
    }).length,
    closingThreeDays: activeBids.filter(b => {
      const days = getDaysUntilClose(b.closeDate);
      return days !== null && days > 0 && days <= 3;
    }).length,
    postedToday: activeBids.filter(b => {
      // Approximate - would need created_at field for accuracy
      return b.status === 'active';
    }).length,
    reviewed: activeBids.filter(b => b.sheetStatus && b.sheetStatus.toLowerCase() !== 'open').length,
    interested: activeBids.filter(b => b.sheetStatus?.toLowerCase() === 'interested').length,
  };

  // Fetch bids for this source
  useEffect(() => {
    async function fetchBids() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/bids?source=${params.source}`);
        const data = await res.json();
        if (data.success) {
          setBids(data.data);
          setTimestamp(data.timestamp);
        }
      } catch (error) {
        console.error('Error fetching bids:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (params.source) {
      fetchBids();
    }
  }, [params.source]);

  // Fetch RFQ summary
  useEffect(() => {
    const fetchSummary = async () => {
      const summary = await getRFQSummary();
      setRfqSummary(summary);
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check CACI session on load (if CACI source)
  useEffect(() => {
    if (isCACI) {
      checkCaciSession();
    }
  }, [isCACI]);

  // CACI Login Functions
  const CACI_LOGIN_URL = 'https://supplier.caci.com/page.aspx/en/usr/login';

  const checkCaciSession = async () => {
    try {
      const res = await fetch('/api/caci/session-status');
      const data = await res.json();
      setCaciSession({ valid: data.valid, cookieCount: data.cookieCount, hoursOld: data.hoursOld });
    } catch {
      setCaciSession({ valid: false, cookieCount: 0 });
    }
  };

  const openCaciPortal = () => {
    window.open(CACI_LOGIN_URL, '_blank', 'width=1200,height=800');
    setCaciStatus('waiting');
    setCaciMessage('Log in to CACI in the new window, then click "Save Session" below.');
  };

  const captureCaciSession = async () => {
    setCaciStatus('launching');
    setCaciMessage('Launching browser to capture session...');
    
    try {
      const res = await fetch('/api/caci/capture-session', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setCaciStatus('success');
        setCaciMessage(data.message);
        setCaciSession({ valid: true, cookieCount: data.cookieCount });
      } else {
        setCaciStatus('error');
        setCaciMessage(data.error || 'Failed to capture session');
      }
    } catch (error) {
      setCaciStatus('error');
      setCaciMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runCaciScraper = async () => {
    setCaciStatus('launching');
    setCaciMessage('Running CACI scraper...');
    
    try {
      const res = await fetch('/api/caci/scrape', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setCaciStatus('success');
        setCaciMessage(`Scraped ${data.bidCount} bids successfully!`);
        // Refresh the bid list
        handleRefresh();
      } else {
        setCaciStatus('error');
        setCaciMessage(data.error || 'Failed to run scraper');
      }
    } catch (error) {
      setCaciStatus('error');
      setCaciMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Add cache-busting timestamp to bypass Next.js revalidation
      const res = await fetch(`/api/bids?source=${params.source}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setBids(data.data);
        setTimestamp(data.timestamp);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  // Filter bids by status
  const filteredBids = (() => {
    // Closed tab shows expired bids
    if (statusFilter === 'closed') return closedBids;
    
    // All other tabs filter from active bids only
    if (statusFilter === 'all') return activeBids;
    if (statusFilter === 'unreviewed') return activeBids.filter(b => !b.sheetStatus || b.sheetStatus.toLowerCase() === 'open');
    if (statusFilter === 'interested') return activeBids.filter(b => b.sheetStatus?.toLowerCase() === 'interested');
    if (statusFilter === 'closing-soon') {
      return activeBids.filter(b => {
        const days = getDaysUntilClose(b.closeDate);
        return days !== null && days >= 0 && days <= 3;
      });
    }
    return activeBids;
  })();

  return (
    <div className="min-h-screen">
      <Header 
        onRefresh={handleRefresh} 
        lastSync={formatTimestamp(timestamp)}
        isLoading={isLoading}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← Back to Overview
          </Link>
        </div>

        {/* Source Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">{sourceName}</h1>
          <p className="text-[var(--muted)] mt-1">Bid opportunities from {sourceName}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</p>
            <p className="text-xs text-[var(--muted)]">Total Active</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--danger)]">{stats.closingToday}</p>
            <p className="text-xs text-[var(--muted)]">Closing Today</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--warning)]">{stats.closingThreeDays}</p>
            <p className="text-xs text-[var(--muted)]">Closing 3 Days</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--accent)]">{stats.interested}</p>
            <p className="text-xs text-[var(--muted)]">Interested</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--success)]">{stats.reviewed}</p>
            <p className="text-xs text-[var(--muted)]">Reviewed</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--muted)]">{stats.total - stats.reviewed}</p>
            <p className="text-xs text-[var(--muted)]">Unreviewed</p>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All Active', count: activeBids.length },
              { id: 'unreviewed', label: 'Unreviewed', count: stats.total - stats.reviewed },
              { id: 'interested', label: 'Interested', count: stats.interested },
              { id: 'closing-soon', label: 'Closing Soon', count: stats.closingThreeDays + stats.closingToday },
              { id: 'closed', label: 'Closed', count: closedBids.length },
              // CACI-only Login tab
              ...(isCACI ? [{ id: 'login', label: '🔑 Login', count: null }] : []),
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  statusFilter === filter.id
                    ? filter.id === 'closed' 
                      ? 'bg-[var(--muted)] text-white'
                      : filter.id === 'login'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
                }`}
              >
                {filter.label}
                {filter.count !== null && (
                  <span className="ml-2 text-xs opacity-75">({filter.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search (hide on login tab) */}
          {statusFilter !== 'login' && (
            <div className="ml-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search bids..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* CACI Login Panel (shown when login tab selected) */}
        {statusFilter === 'login' && isCACI && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">CACI Session Management</h2>
            
            {/* Status Message */}
            {caciMessage && (
              <div className={`mb-6 p-4 rounded-lg ${
                caciStatus === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
                caciStatus === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
                caciStatus === 'waiting' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' :
                'bg-[var(--background)] border border-[var(--border)] text-[var(--muted)]'
              }`}>
                <div className="flex items-center gap-3">
                  {caciStatus === 'launching' && (
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  )}
                  <span>{caciMessage}</span>
                </div>
              </div>
            )}

            {/* Session Status */}
            <div className={`mb-6 p-4 rounded-lg border ${
              caciSession?.valid 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-[var(--background)] border-[var(--border)]'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${caciSession?.valid ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-[var(--foreground)]">
                  {caciSession?.valid 
                    ? `Session active (${caciSession.cookieCount} cookies, ${caciSession.hoursOld?.toFixed(1)}h old)`
                    : 'No active session'
                  }
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="mb-6 text-sm text-[var(--muted)]">
              <p className="mb-2"><strong>To scrape CACI bids:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Click "Open CACI Portal" and log in manually</li>
                <li>Once logged in, click "Save Session" to capture cookies</li>
                <li>Click "Run Scraper" to fetch new bids</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openCaciPortal}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-medium rounded-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open CACI Portal
              </button>

              <button
                onClick={checkCaciSession}
                disabled={caciStatus === 'launching'}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] hover:bg-[var(--background)] text-[var(--foreground)] font-medium rounded-lg border border-[var(--border)] transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Check Session
              </button>

              <button
                onClick={captureCaciSession}
                disabled={caciStatus === 'launching'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Session
              </button>

              <button
                onClick={runCaciScraper}
                disabled={caciStatus === 'launching' || !caciSession?.valid}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Scraper
              </button>
            </div>
          </div>
        )}

        {/* Bid Table (hide on login tab) */}
        {statusFilter !== 'login' && (
          <BidTable 
            bids={filteredBids} 
            searchQuery={searchQuery} 
            isLoading={isLoading}
            onSelectBid={setSelectedBid}
            onBidUpdated={handleRefresh}
            rfqSummary={rfqSummary}
            showSource={false}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-[var(--muted)]">
            LogisticoDS &copy; 2024 &middot; {sourceName} Dashboard
          </p>
        </div>
      </footer>

      {/* Bid Detail Modal */}
      <BidDetailModal 
        bid={selectedBid}
        onClose={() => setSelectedBid(null)}
      />
    </div>
  );
}
