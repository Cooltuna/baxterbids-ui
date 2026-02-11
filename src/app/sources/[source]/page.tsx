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
  const sourceName = (params.source as string)?.charAt(0).toUpperCase() + (params.source as string)?.slice(1);
  
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [rfqSummary, setRfqSummary] = useState<RFQSummary>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
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
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  statusFilter === filter.id
                    ? filter.id === 'closed' 
                      ? 'bg-[var(--muted)] text-white'
                      : 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
                }`}
              >
                {filter.label}
                <span className="ml-2 text-xs opacity-75">({filter.count})</span>
              </button>
            ))}
          </div>

          {/* Search */}
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
        </div>

        {/* Bid Table */}
        <BidTable 
          bids={filteredBids} 
          searchQuery={searchQuery} 
          isLoading={isLoading}
          onSelectBid={setSelectedBid}
          onBidUpdated={handleRefresh}
          rfqSummary={rfqSummary}
          showSource={false}
        />
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
