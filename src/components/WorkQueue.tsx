'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://api.logisticollc.com'
  : 'http://localhost:8000';

interface PendingQuote {
  vendor: string;
  total: number | null;
  confidence: number | null;
  date: string;
  has_attachments: boolean;
}

interface WaitingVendor {
  vendor: string;
  sent: string;
  days_waiting: number;
  needs_followup: boolean;
}

interface QueueBid {
  bid_id: string;
  solicitation: string;
  title: string;
  source: string;
  status: string;
  close_date: string | null;
  rfqs_sent: number;
  rfqs_responded: number;
  quotes_received: number;
  total_rfqs: number;
  pending_quotes?: PendingQuote[];
  waiting_on?: WaitingVendor[];
  quotes?: { vendor: string; total: number | null }[];
}

interface WorkQueueData {
  new_responses: QueueBid[];
  awaiting_response: QueueBid[];
  ready_to_submit: QueueBid[];
  counts: {
    new_responses: number;
    awaiting_response: number;
    ready_to_submit: number;
  };
}

interface WorkQueueProps {
  onBidClick?: (bidId: string) => void;
}

export default function WorkQueuePanel({ onBidClick }: WorkQueueProps) {
  const [data, setData] = useState<WorkQueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'responses' | 'awaiting' | 'ready'>('responses');

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/work-queue`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.detail || 'Failed to load work queue');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const closeDateBadge = (dateStr: string | null) => {
    const days = daysUntil(dateStr);
    if (days === null) return null;
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/20 text-[var(--muted)]">Expired</span>;
    if (days === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] font-medium">Today!</span>;
    if (days <= 3) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 font-medium">{days}d left</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/10 text-[var(--muted)]">{days}d</span>;
  };

  const sourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      'HigherGov HUBZone': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      'CACI': 'bg-purple-500/10 text-purple-500 border-purple-500/30',
      'Fairmarkit': 'bg-green-500/10 text-green-500 border-green-500/30',
      'Logistico': 'bg-orange-500/10 text-orange-500 border-orange-500/30',
      'HigherGov IDIQ': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[source] || 'bg-[var(--muted)]/10 text-[var(--muted)] border-[var(--muted)]/30'}`}>
        {source}
      </span>
    );
  };

  const fmt = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 mx-auto border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-[var(--muted)]">Loading work queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
        {error}
        <button onClick={fetchQueue} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const counts = data.counts;
  const totalItems = counts.new_responses + counts.awaiting_response + counts.ready_to_submit;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('responses')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'responses'
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--accent)]/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📬</span>
            <span className="text-2xl font-bold text-[var(--foreground)]">{counts.new_responses}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Quotes to Review</p>
        </button>

        <button
          onClick={() => setActiveTab('awaiting')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'awaiting'
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--accent)]/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⏳</span>
            <span className="text-2xl font-bold text-[var(--foreground)]">{counts.awaiting_response}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Awaiting Vendors</p>
        </button>

        <button
          onClick={() => setActiveTab('ready')}
          className={`p-4 rounded-xl border text-left transition-all ${
            activeTab === 'ready'
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--accent)]/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✅</span>
            <span className="text-2xl font-bold text-[var(--foreground)]">{counts.ready_to_submit}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Ready to Submit</p>
        </button>
      </div>

      {totalItems === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">All Clear</h3>
          <p className="text-sm text-[var(--muted)]">No pending actions. Check back later or send more RFQs.</p>
        </div>
      )}

      {/* Quotes to Review */}
      {activeTab === 'responses' && data.new_responses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
            Vendor Quotes — Pending Review
          </h3>
          {data.new_responses.map((bid) => (
            <div
              key={bid.bid_id}
              onClick={() => onBidClick?.(bid.bid_id)}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{bid.solicitation}</span>
                  {sourceBadge(bid.source)}
                  {closeDateBadge(bid.close_date)}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {bid.quotes_received} quote{bid.quotes_received !== 1 ? 's' : ''} / {bid.total_rfqs} RFQs
                </span>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3 truncate">{bid.title}</p>
              <div className="flex flex-wrap gap-2">
                {bid.pending_quotes?.map((q, idx) => (
                  <div key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-sm">
                    <span className="font-medium text-[var(--foreground)]">{q.vendor}</span>
                    <span className="text-[var(--accent)] font-semibold">{fmt(q.total)}</span>
                    {q.has_attachments && <span title="Has attachments">📎</span>}
                    {q.confidence !== null && q.confidence < 0.7 && (
                      <span className="text-yellow-500 text-xs" title={`${Math.round(q.confidence * 100)}% parse confidence`}>⚠️</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'responses' && data.new_responses.length === 0 && (
        <div className="text-center py-6 text-sm text-[var(--muted)]">
          No quotes pending review.
        </div>
      )}

      {/* Awaiting Vendor Response */}
      {activeTab === 'awaiting' && data.awaiting_response.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
            RFQs Sent — Waiting for Vendors
          </h3>
          {data.awaiting_response.map((bid) => (
            <div
              key={bid.bid_id}
              onClick={() => onBidClick?.(bid.bid_id)}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{bid.solicitation}</span>
                  {sourceBadge(bid.source)}
                  {closeDateBadge(bid.close_date)}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {bid.rfqs_responded}/{bid.total_rfqs} responded
                </span>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3 truncate">{bid.title}</p>
              <div className="flex flex-wrap gap-2">
                {bid.waiting_on?.map((w, idx) => (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                      w.needs_followup
                        ? 'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                        : 'bg-[var(--background)] border-[var(--border)]'
                    }`}
                  >
                    <span className="text-[var(--foreground)]">{w.vendor.split('@')[0]}</span>
                    <span className={`text-xs ${w.needs_followup ? 'text-[var(--danger)] font-medium' : 'text-[var(--muted)]'}`}>
                      {w.days_waiting}d
                    </span>
                    {w.needs_followup && <span title="Follow up needed">🔔</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'awaiting' && data.awaiting_response.length === 0 && (
        <div className="text-center py-6 text-sm text-[var(--muted)]">
          No RFQs awaiting vendor responses.
        </div>
      )}

      {/* Ready to Submit */}
      {activeTab === 'ready' && data.ready_to_submit.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
            All Quotes In — Ready to Submit
          </h3>
          {data.ready_to_submit.map((bid) => (
            <div
              key={bid.bid_id}
              onClick={() => onBidClick?.(bid.bid_id)}
              className="p-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 hover:border-[var(--success)] transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{bid.solicitation}</span>
                  {sourceBadge(bid.source)}
                  {closeDateBadge(bid.close_date)}
                </div>
                <span className="text-xs text-[var(--success)] font-medium">
                  ✅ {bid.quotes_received} quote{bid.quotes_received !== 1 ? 's' : ''} ready
                </span>
              </div>
              <p className="text-sm text-[var(--muted)] truncate">{bid.title}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ready' && data.ready_to_submit.length === 0 && (
        <div className="text-center py-6 text-sm text-[var(--muted)]">
          No bids ready to submit yet.
        </div>
      )}
    </div>
  );
}
