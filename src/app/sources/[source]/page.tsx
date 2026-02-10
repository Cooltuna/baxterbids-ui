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
  
  // Calculate stats
  const stats: SourceStats = {
    total: bids.length,
    closingToday: bids.filter(b => {
      const days = getDaysUntilClose(b.closeDate);
      return days !== null && days <= 0;
    }).length,
    closingThreeDays: bids.filter(b => {
      const days = getDaysUntilClose(b.closeDate);
      return days !== null && days > 0 && days <= 3;
    }).length,
    postedToday: bids.filter(b => {
      // Approximate - would need created_at field for accuracy
      return b.status === 'active';
    }).length,
    reviewed: bids.filter(b => b.sheetStatus && b.sheetStatus !== 'Open').length,
    interested: bids.filter(b => b.sheetStatus === 'Interested').length,
  };

  function getDaysUntilClose(closeDate: string): number | null {
    if (!closeDate) return null;
    const today = new Date();
    const close = new Date(closeDate);
    return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

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
  const filteredBids = bids.filter(bid => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'unreviewed') return !bid.sheetStatus || bid.sheetStatus === 'Open';
    if (statusFilter === 'interested') return bid.sheetStatus === 'Interested';
    if (statusFilter === 'closing-soon') {
      const days = getDaysUntilClose(bid.closeDate);
      return days !== null && days <= 3;
    }
    return true;
  });

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
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All', count: bids.length },
              { id: 'unreviewed', label: 'Unreviewed', count: stats.total - stats.reviewed },
              { id: 'interested', label: 'Interested', count: stats.interested },
              { id: 'closing-soon', label: 'Closing Soon', count: stats.closingThreeDays + stats.closingToday },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  statusFilter === filter.id
                    ? 'bg-[var(--accent)] text-white'
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
