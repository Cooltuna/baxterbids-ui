'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Bid, Source } from '@/types';

interface SourceWithStats extends Source {
  stats: {
    total: number;
    closingToday: number;
    closingThreeDays: number;
    unreviewed: number;
  };
}

export default function Home() {
  const [sources, setSources] = useState<SourceWithStats[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [urgentBids, setUrgentBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<string>();

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch sources
        const sourcesRes = await fetch('/api/sources');
        const sourcesData = await sourcesRes.json();
        
        // Fetch all bids
        const bidsRes = await fetch('/api/bids');
        const bidsData = await bidsRes.json();
        
        if (bidsData.success) {
          const bids = bidsData.data;
          setAllBids(bids);
          setTimestamp(bidsData.timestamp);
          
          // Calculate urgent bids (closing within 3 days)
          const urgent = bids.filter((bid: Bid) => {
            if (!bid.closeDate) return false;
            const days = getDaysUntilClose(bid.closeDate);
            return days !== null && days <= 3;
          }).sort((a: Bid, b: Bid) => {
            const daysA = getDaysUntilClose(a.closeDate) ?? 999;
            const daysB = getDaysUntilClose(b.closeDate) ?? 999;
            return daysA - daysB;
          });
          setUrgentBids(urgent.slice(0, 10));
          
          // Calculate stats per source
          if (sourcesData.success) {
            const sourcesWithStats = sourcesData.data.map((source: Source) => {
              const sourceBids = bids.filter((b: Bid) => b.source === source.name);
              return {
                ...source,
                stats: {
                  total: sourceBids.length,
                  closingToday: sourceBids.filter((b: Bid) => {
                    const days = getDaysUntilClose(b.closeDate);
                    return days !== null && days <= 0;
                  }).length,
                  closingThreeDays: sourceBids.filter((b: Bid) => {
                    const days = getDaysUntilClose(b.closeDate);
                    return days !== null && days > 0 && days <= 3;
                  }).length,
                  unreviewed: sourceBids.filter((b: Bid) => !b.sheetStatus || b.sheetStatus === 'Open').length,
                }
              };
            });
            setSources(sourcesWithStats);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  function getDaysUntilClose(closeDate: string): number | null {
    if (!closeDate) return null;
    const today = new Date();
    const close = new Date(closeDate);
    return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const handleRefresh = () => {
    window.location.reload();
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

  // Overall stats
  const totalBids = allBids.length;
  const totalClosingToday = allBids.filter(b => {
    const days = getDaysUntilClose(b.closeDate);
    return days !== null && days <= 0;
  }).length;
  const totalClosingThreeDays = allBids.filter(b => {
    const days = getDaysUntilClose(b.closeDate);
    return days !== null && days > 0 && days <= 3;
  }).length;
  const totalUnreviewed = allBids.filter(b => !b.sheetStatus || b.sheetStatus === 'Open').length;

  return (
    <div className="min-h-screen">
      <Header 
        onRefresh={handleRefresh} 
        lastSync={formatTimestamp(timestamp)}
        isLoading={isLoading}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">LogisticoDS Overview</h1>
          <p className="text-[var(--muted)] mt-1">Unified bid management across all sources</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)]">
            <p className="text-4xl font-bold text-[var(--foreground)]">{totalBids}</p>
            <p className="text-sm text-[var(--muted)] mt-1">Total Active Bids</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--danger)]/30">
            <p className="text-4xl font-bold text-[var(--danger)]">{totalClosingToday}</p>
            <p className="text-sm text-[var(--muted)] mt-1">Closing Today</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--warning)]/30">
            <p className="text-4xl font-bold text-[var(--warning)]">{totalClosingThreeDays}</p>
            <p className="text-sm text-[var(--muted)] mt-1">Closing in 3 Days</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--accent)]/30">
            <p className="text-4xl font-bold text-[var(--accent)]">{totalUnreviewed}</p>
            <p className="text-sm text-[var(--muted)] mt-1">Unreviewed</p>
          </div>
        </div>

        {/* Source Cards */}
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Bid Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {isLoading ? (
            // Loading skeletons
            [1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] animate-pulse">
                <div className="h-6 w-32 bg-[var(--border)] rounded mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-16 bg-[var(--border)] rounded" />
                  <div className="h-16 bg-[var(--border)] rounded" />
                </div>
              </div>
            ))
          ) : (
            sources.map(source => (
              <Link
                key={source.id}
                href={`/sources/${source.name.toLowerCase()}`}
                className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] hover:border-[var(--accent)] transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                    {source.name}
                  </h3>
                  <svg className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-[var(--foreground)]">{source.stats.total}</p>
                    <p className="text-xs text-[var(--muted)]">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--accent)]">{source.stats.unreviewed}</p>
                    <p className="text-xs text-[var(--muted)]">Unreviewed</p>
                  </div>
                </div>
                
                {(source.stats.closingToday > 0 || source.stats.closingThreeDays > 0) && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex gap-4">
                    {source.stats.closingToday > 0 && (
                      <span className="text-xs text-[var(--danger)] font-medium">
                        ⚠️ {source.stats.closingToday} closing today
                      </span>
                    )}
                    {source.stats.closingThreeDays > 0 && (
                      <span className="text-xs text-[var(--warning)] font-medium">
                        ⏰ {source.stats.closingThreeDays} closing soon
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>

        {/* Urgent Bids */}
        {urgentBids.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
              ⚡ Urgent - Closing Soon
            </h2>
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--background)]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase">Source</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase">Bid</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase">Closes</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--muted)] uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {urgentBids.map(bid => {
                    const daysLeft = getDaysUntilClose(bid.closeDate);
                    return (
                      <tr key={`${bid.source}-${bid.id}`} className="hover:bg-[var(--background)] transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--accent)]/10 text-xs font-medium text-[var(--accent)]">
                            {bid.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-[var(--foreground)]">{bid.title}</p>
                          <p className="text-sm text-[var(--muted)]">{bid.id} · {bid.agency}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-medium ${daysLeft !== null && daysLeft <= 0 ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}>
                            {daysLeft !== null && daysLeft <= 0 ? 'TODAY' : `${daysLeft} days`}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {new Date(bid.closeDate).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/sources/${bid.source?.toLowerCase()}`}
                            className="text-sm text-[var(--accent)] hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Quick Actions */}
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left">
            <p className="font-medium text-[var(--foreground)]">📊 Export Report</p>
            <p className="text-sm text-[var(--muted)]">Download bid summary as CSV</p>
          </button>
          <button className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left">
            <p className="font-medium text-[var(--foreground)]">🔔 Notification Settings</p>
            <p className="text-sm text-[var(--muted)]">Configure alerts and reminders</p>
          </button>
          <button className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left">
            <p className="font-medium text-[var(--foreground)]">⚙️ Source Configuration</p>
            <p className="text-sm text-[var(--muted)]">Manage bid source settings</p>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-[var(--muted)]">
            LogisticoDS &copy; 2024 &middot; Discovery System
          </p>
        </div>
      </footer>
    </div>
  );
}
