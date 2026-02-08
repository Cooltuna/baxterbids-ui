'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import BidTable from '@/components/BidTable';
import RFQTracker from '@/components/RFQTracker';
import BidDetailModal from '@/components/BidDetailModal';
import { useBids, useRFQs, useStats } from '@/hooks/useData';
import { Bid } from '@/types';
import { getRFQSummary, RFQSummary } from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'bids' | 'rfqs'>('bids');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  
  const { bids, isLoading: bidsLoading, timestamp: bidsTimestamp, refresh: refreshBids } = useBids();
  const { rfqs, isLoading: rfqsLoading, refresh: refreshRFQs } = useRFQs();
  const stats = useStats();
  const [rfqSummary, setRfqSummary] = useState<RFQSummary>({});

  // Fetch RFQ summary for dashboard badges
  useEffect(() => {
    const fetchSummary = async () => {
      const summary = await getRFQSummary();
      setRfqSummary(summary);
    };
    fetchSummary();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    refreshBids();
    refreshRFQs();
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

  return (
    <div className="min-h-screen">
      <Header 
        onRefresh={handleRefresh} 
        lastSync={formatTimestamp(bidsTimestamp)}
        isLoading={bidsLoading || rfqsLoading}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards stats={stats} isLoading={bidsLoading || rfqsLoading} />

        {/* Tab Navigation */}
        <div className="mt-8 flex items-center gap-4 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('bids')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === 'bids' 
                ? 'text-[var(--accent)]' 
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Active Bids
            <span className="ml-2 text-xs text-[var(--muted)]">({bids.length})</span>
            {activeTab === 'bids' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('rfqs')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === 'rfqs' 
                ? 'text-[var(--accent)]' 
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            RFQ Tracker
            {stats.rfqsOverdue > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[var(--danger)] rounded-full">
                {stats.rfqsOverdue}
              </span>
            )}
            {activeTab === 'rfqs' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>

          {/* Search */}
          <div className="ml-auto pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
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

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'bids' ? (
            <BidTable 
              bids={bids} 
              searchQuery={searchQuery} 
              isLoading={bidsLoading}
              onSelectBid={setSelectedBid}
              onBidUpdated={refreshBids}
              rfqSummary={rfqSummary}
            />
          ) : (
            <RFQTracker rfqs={rfqs} searchQuery={searchQuery} isLoading={rfqsLoading} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-[var(--muted)]">
            BaxterBids &copy; 2024 &middot; Powered by AI
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
