'use client';

import { useState } from 'react';
import { Bid } from '@/types';

interface BidTableProps {
  bids: Bid[];
  searchQuery: string;
  isLoading?: boolean;
  onSelectBid?: (bid: Bid) => void;
}

export default function BidTable({ bids, searchQuery, isLoading = false, onSelectBid }: BidTableProps) {
  const [sortBy, setSortBy] = useState<'closeDate' | 'title'>('closeDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredBids = bids
    .filter(bid => 
      bid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bid.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bid.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'closeDate') {
        const dateA = new Date(a.closeDate).getTime();
        const dateB = new Date(b.closeDate).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return sortOrder === 'asc' 
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });

  const handleSort = (column: 'closeDate' | 'title') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (status: Bid['status']) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-active">Active</span>;
      case 'closing-soon':
        return <span className="badge badge-pending">Closing Soon</span>;
      case 'closed':
        return <span className="badge badge-closed">Closed</span>;
    }
  };

  const getDaysUntilClose = (closeDate: string) => {
    const today = new Date();
    const close = new Date(closeDate);
    const diff = Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--card)]">
              <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                <button 
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-2 hover:text-[var(--foreground)] transition-colors"
                >
                  Opportunity
                  {sortBy === 'title' && (
                    <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Category
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Est. Value
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                <button 
                  onClick={() => handleSort('closeDate')}
                  className="flex items-center gap-2 hover:text-[var(--foreground)] transition-colors"
                >
                  Closes
                  {sortBy === 'closeDate' && (
                    <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredBids.map((bid, index) => {
              const daysLeft = getDaysUntilClose(bid.closeDate);
              return (
                <tr 
                  key={bid.id}
                  className="bg-[var(--background)] hover:bg-[var(--card)] transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-6 py-4">
                    <div>
                      <button
                        onClick={() => onSelectBid?.(bid)}
                        className="text-left font-medium text-[var(--foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                      >
                        {bid.title}
                      </button>
                      <p className="text-sm text-[var(--muted)] mt-1">
                        {bid.id} &middot; {bid.agency}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--card)] text-xs font-medium text-[var(--foreground)]">
                      {bid.category || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                    {bid.value || 'TBD'}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-[var(--foreground)]">
                        {new Date(bid.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className={`text-xs mt-1 ${daysLeft <= 3 ? 'text-[var(--warning)]' : 'text-[var(--muted)]'}`}>
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Closed'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(bid.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onSelectBid?.(bid)}
                        className="p-2 rounded-lg hover:bg-[var(--accent)]/10 text-[var(--muted)] hover:text-[var(--accent)] transition-all"
                        title="Analyze Bid"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-[var(--accent)]/10 text-[var(--muted)] hover:text-[var(--accent)] transition-all"
                        title="Create RFQ"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <a 
                        href={bid.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-[var(--accent)]/10 text-[var(--muted)] hover:text-[var(--accent)] transition-all"
                        title="Open Source"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {isLoading && (
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton rounded" />
                <div className="h-3 w-1/2 skeleton rounded" />
              </div>
              <div className="h-6 w-20 skeleton rounded" />
              <div className="h-6 w-24 skeleton rounded" />
            </div>
          ))}
        </div>
      )}
      
      {!isLoading && filteredBids.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-[var(--muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[var(--muted)]">No bids found matching your search</p>
        </div>
      )}
    </div>
  );
}
