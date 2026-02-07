'use client';

import { RFQ } from '@/types';

interface RFQTrackerProps {
  rfqs: RFQ[];
  searchQuery: string;
  isLoading?: boolean;
}

export default function RFQTracker({ rfqs, searchQuery, isLoading = false }: RFQTrackerProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 skeleton rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-3 w-1/2 skeleton rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredRFQs = rfqs.filter(rfq =>
    rfq.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfq.bidId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusConfig = (status: RFQ['status']) => {
    switch (status) {
      case 'draft':
        return {
          badge: 'badge badge-closed',
          label: 'Draft',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
          color: 'text-[var(--muted)]',
          bg: 'bg-[var(--muted)]/10',
        };
      case 'sent':
        return {
          badge: 'badge badge-pending',
          label: 'Sent',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          ),
          color: 'text-amber-400',
          bg: 'bg-amber-400/10',
        };
      case 'received':
        return {
          badge: 'badge badge-active',
          label: 'Received',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-[var(--success)]',
          bg: 'bg-[var(--success)]/10',
        };
      case 'overdue':
        return {
          badge: 'badge badge-overdue',
          label: 'Overdue',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-[var(--danger)]',
          bg: 'bg-[var(--danger)]/10',
        };
    }
  };

  const groupedRFQs = {
    overdue: filteredRFQs.filter(r => r.status === 'overdue'),
    sent: filteredRFQs.filter(r => r.status === 'sent'),
    draft: filteredRFQs.filter(r => r.status === 'draft'),
    received: filteredRFQs.filter(r => r.status === 'received'),
  };

  return (
    <div className="space-y-6">
      {/* Overdue Section - Prominent */}
      {groupedRFQs.overdue.length > 0 && (
        <div className="rounded-xl border-2 border-[var(--danger)]/50 bg-[var(--danger)]/5 p-6 animate-pulse-glow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--danger)]/20">
              <svg className="w-6 h-6 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--danger)]">Overdue RFQs</h3>
              <p className="text-sm text-[var(--muted)]">These vendors haven&apos;t responded - follow up needed</p>
            </div>
          </div>
          <div className="space-y-3">
            {groupedRFQs.overdue.map(rfq => (
              <RFQCard key={rfq.id} rfq={rfq} config={getStatusConfig(rfq.status)} />
            ))}
          </div>
        </div>
      )}

      {/* Sent Section */}
      {groupedRFQs.sent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
            Awaiting Response ({groupedRFQs.sent.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedRFQs.sent.map((rfq, index) => (
              <div key={rfq.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <RFQCard rfq={rfq} config={getStatusConfig(rfq.status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Section */}
      {groupedRFQs.draft.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--muted)] rounded-full"></span>
            Drafts ({groupedRFQs.draft.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedRFQs.draft.map((rfq, index) => (
              <div key={rfq.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <RFQCard rfq={rfq} config={getStatusConfig(rfq.status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Received Section */}
      {groupedRFQs.received.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-[var(--success)] rounded-full"></span>
            Quotes Received ({groupedRFQs.received.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedRFQs.received.map((rfq, index) => (
              <div key={rfq.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <RFQCard rfq={rfq} config={getStatusConfig(rfq.status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredRFQs.length === 0 && (
        <div className="text-center py-12 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <svg className="w-12 h-12 mx-auto text-[var(--muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-[var(--muted)]">No RFQs found</p>
          <button className="mt-4 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-medium rounded-lg transition-all">
            Create First RFQ
          </button>
        </div>
      )}
    </div>
  );
}

interface RFQCardProps {
  rfq: RFQ;
  config: ReturnType<typeof getStatusConfig>;
}

function getStatusConfig(status: RFQ['status']) {
  switch (status) {
    case 'draft':
      return {
        badge: 'badge badge-closed',
        label: 'Draft',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        color: 'text-[var(--muted)]',
        bg: 'bg-[var(--muted)]/10',
      };
    case 'sent':
      return {
        badge: 'badge badge-pending',
        label: 'Sent',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        ),
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
      };
    case 'received':
      return {
        badge: 'badge badge-active',
        label: 'Received',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-[var(--success)]',
        bg: 'bg-[var(--success)]/10',
      };
    case 'overdue':
      return {
        badge: 'badge badge-overdue',
        label: 'Overdue',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-[var(--danger)]',
        bg: 'bg-[var(--danger)]/10',
      };
  }
}

function RFQCard({ rfq, config }: RFQCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--accent)]/30 transition-all hover:shadow-lg hover:shadow-[var(--accent)]/5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <div className={config.color}>{config.icon}</div>
          </div>
          <div>
            <h4 className="font-medium text-[var(--foreground)]">{rfq.vendor}</h4>
            <p className="text-sm text-[var(--muted)] mt-0.5">Bid: {rfq.bidId}</p>
          </div>
        </div>
        <span className={config.badge}>{config.label}</span>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {rfq.sentDate && (
            <div>
              <span className="text-[var(--muted)]">Sent: </span>
              <span className="text-[var(--foreground)]">{new Date(rfq.sentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {rfq.quoteAmount && (
            <div>
              <span className="text-[var(--muted)]">Quote: </span>
              <span className="text-[var(--success)] font-semibold">{rfq.quoteAmount}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {rfq.status === 'overdue' && (
            <button className="px-3 py-1.5 bg-[var(--danger)] hover:bg-[var(--danger)]/80 text-white text-xs font-medium rounded-lg transition-all">
              Follow Up
            </button>
          )}
          {rfq.status === 'draft' && (
            <button className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black text-xs font-medium rounded-lg transition-all">
              Send RFQ
            </button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
