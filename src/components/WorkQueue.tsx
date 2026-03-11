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

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/work-queue`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.detail || 'Failed to load');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 60000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const fmt = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const closeBadge = (dateStr: string | null) => {
    const days = daysUntil(dateStr);
    if (days === null) return null;
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/20 text-[var(--muted)]">Expired</span>;
    if (days === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--danger)]/10 text-[var(--danger)] font-medium">Due Today!</span>;
    if (days <= 3) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 font-medium">{days}d left</span>;
    return <span className="text-xs text-[var(--muted)]">{days}d</span>;
  };

  const sourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      'HigherGov HUBZone': 'bg-blue-500/10 text-blue-500',
      'CACI': 'bg-purple-500/10 text-purple-500',
      'Fairmarkit': 'bg-green-500/10 text-green-500',
      'Logistico': 'bg-orange-500/10 text-orange-500',
      'HigherGov IDIQ': 'bg-cyan-500/10 text-cyan-500',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[source] || 'bg-[var(--muted)]/10 text-[var(--muted)]'}`}>
        {source}
      </span>
    );
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const hours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 mx-auto border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-[var(--muted)]">Loading action items...</p>
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

  const { new_responses, awaiting_response, ready_to_submit, counts } = data;
  const allItems = [...new_responses, ...awaiting_response, ...ready_to_submit];

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--accent)]"></span>
          <span className="text-[var(--foreground)] font-medium">{counts.new_responses}</span>
          <span className="text-[var(--muted)]">new quotes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="text-[var(--foreground)] font-medium">{counts.awaiting_response}</span>
          <span className="text-[var(--muted)]">awaiting vendors</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--success)]"></span>
          <span className="text-[var(--foreground)] font-medium">{counts.ready_to_submit}</span>
          <span className="text-[var(--muted)]">ready to submit</span>
        </div>
        <button
          onClick={fetchQueue}
          className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* ─── New Vendor Quotes ─── */}
      {new_responses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider mb-3">
            📬 New Vendor Quotes
          </h3>
          <div className="space-y-2">
            {new_responses.map((bid) => (
              <div
                key={bid.bid_id}
                onClick={() => onBidClick?.(bid.bid_id)}
                className="p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 hover:border-[var(--accent)] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[var(--foreground)]">{bid.solicitation}</span>
                    {sourceBadge(bid.source)}
                    {closeBadge(bid.close_date)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {bid.pending_quotes?.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--foreground)]">{q.vendor}</span>
                        {q.has_attachments && <span className="text-xs">📎</span>}
                        {q.confidence !== null && q.confidence < 0.7 && (
                          <span className="text-xs text-yellow-500" title={`${Math.round(q.confidence * 100)}% parse confidence`}>⚠️ low confidence</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[var(--accent)]">{fmt(q.total)}</span>
                        <span className="text-xs text-[var(--muted)]">{timeAgo(q.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Awaiting Vendor Response ─── */}
      {awaiting_response.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wider mb-3">
            ⏳ Awaiting Vendor Response
          </h3>
          <div className="space-y-2">
            {awaiting_response.map((bid) => {
              const hasFollowUp = bid.waiting_on?.some(w => w.needs_followup);
              return (
                <div
                  key={bid.bid_id}
                  onClick={() => onBidClick?.(bid.bid_id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    hasFollowUp
                      ? 'border-[var(--danger)]/30 bg-[var(--danger)]/5 hover:border-[var(--danger)]'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[var(--foreground)]">{bid.solicitation}</span>
                      {sourceBadge(bid.source)}
                      {closeBadge(bid.close_date)}
                      {hasFollowUp && <span className="text-xs text-[var(--danger)] font-medium">🔔 Follow up</span>}
                    </div>
                    <span className="text-xs text-[var(--muted)]">
                      {bid.rfqs_responded}/{bid.total_rfqs} responded
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bid.waiting_on?.map((w, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-1 rounded-lg ${
                          w.needs_followup
                            ? 'bg-[var(--danger)]/10 text-[var(--danger)]'
                            : 'bg-[var(--background)] text-[var(--muted)]'
                        }`}
                      >
                        {w.vendor.split('@')[0]} · {w.days_waiting}d
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Ready to Submit ─── */}
      {ready_to_submit.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--success)] uppercase tracking-wider mb-3">
            ✅ Ready to Submit
          </h3>
          <div className="space-y-2">
            {ready_to_submit.map((bid) => (
              <div
                key={bid.bid_id}
                onClick={() => onBidClick?.(bid.bid_id)}
                className="p-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 hover:border-[var(--success)] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[var(--foreground)]">{bid.solicitation}</span>
                    {sourceBadge(bid.source)}
                    {closeBadge(bid.close_date)}
                  </div>
                  <span className="text-xs text-[var(--success)] font-medium">
                    {bid.quotes_received} quote{bid.quotes_received !== 1 ? 's' : ''} ready
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">All Clear</h3>
          <p className="text-sm text-[var(--muted)]">No pending actions. Send RFQs from the source dashboards to get started.</p>
        </div>
      )}
    </div>
  );
}
