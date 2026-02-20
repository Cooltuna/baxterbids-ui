'use client';

import { useState, useMemo } from 'react';
import { Bid } from '@/types';
import { RFQSummary } from '@/lib/api';

interface WorkflowQueueProps {
  bids: Bid[];
  onSelectBid?: (bid: Bid) => void;
  onMarkInterested?: (bid: Bid) => void;
  rfqSummary?: RFQSummary;
}

type WorkflowStage = 'new' | 'interested' | 'rfq_sent' | 'quotes_received' | 'awarded';

const STAGES: { id: WorkflowStage; label: string; emoji: string; color: string; borderColor: string; bgColor: string }[] = [
  { id: 'new', label: 'New / Open', emoji: '📥', color: 'text-blue-400', borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/5' },
  { id: 'interested', label: 'Interested', emoji: '⭐', color: 'text-amber-400', borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5' },
  { id: 'rfq_sent', label: 'RFQ Sent', emoji: '📤', color: 'text-purple-400', borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/5' },
  { id: 'quotes_received', label: 'Quotes In', emoji: '💰', color: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/5' },
  { id: 'awarded', label: 'Awarded', emoji: '🏆', color: 'text-[var(--accent)]', borderColor: 'border-[var(--accent)]/30', bgColor: 'bg-[var(--accent)]/5' },
];

function getDaysUntilClose(closeDate: string): number | null {
  if (!closeDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const close = new Date(closeDate);
  close.setHours(0, 0, 0, 0);
  return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isExpired(closeDate: string): boolean {
  const days = getDaysUntilClose(closeDate);
  return days !== null && days < 0;
}

function getUrgencyClass(closeDate: string): string {
  const days = getDaysUntilClose(closeDate);
  if (days === null) return '';
  if (days <= 0) return 'border-l-4 border-l-[var(--danger)]';
  if (days <= 1) return 'border-l-4 border-l-red-400';
  if (days <= 3) return 'border-l-4 border-l-[var(--warning)]';
  return '';
}

function formatCloseDate(closeDate: string): string {
  if (!closeDate) return '—';
  const days = getDaysUntilClose(closeDate);
  const date = new Date(closeDate);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  if (days === null) return dateStr;
  if (days <= 0) return `⚠️ TODAY`;
  if (days === 1) return `🔥 Tomorrow`;
  if (days <= 3) return `⏰ ${days}d — ${dateStr}`;
  if (days <= 7) return `${days}d — ${dateStr}`;
  return dateStr;
}

function classifyBid(bid: Bid, rfqSummary: RFQSummary): WorkflowStage {
  const status = (bid.sheetStatus || 'Open').toLowerCase();
  
  // Check RFQ summary for this bid
  const rfqInfo = rfqSummary[bid.id];
  
  if (status === 'won' || status === 'awarded') return 'awarded';
  
  // If we have quotes received
  if (rfqInfo && rfqInfo.received > 0) return 'quotes_received';
  
  // If RFQs were sent
  if (rfqInfo && rfqInfo.sent > 0) return 'rfq_sent';
  
  // If marked interested or bidding
  if (status === 'interested' || status === 'bidding') return 'interested';
  
  // Default: new/open
  return 'new';
}

export default function WorkflowQueue({ bids, onSelectBid, onMarkInterested, rfqSummary = {} }: WorkflowQueueProps) {
  const [collapsedStages, setCollapsedStages] = useState<Set<WorkflowStage>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter out expired and dismissed, classify into stages
  const stageData = useMemo(() => {
    const activeBids = bids.filter(b => !isExpired(b.closeDate));
    
    // Apply search filter
    const filtered = searchQuery
      ? activeBids.filter(b =>
          b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.agency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.external_id?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : activeBids;

    // Sort all bids by close date ascending (soonest first)
    const sorted = [...filtered].sort((a, b) => {
      const dateA = a.closeDate ? new Date(a.closeDate).getTime() : Infinity;
      const dateB = b.closeDate ? new Date(b.closeDate).getTime() : Infinity;
      return dateA - dateB;
    });

    // Group by stage
    const groups: Record<WorkflowStage, Bid[]> = {
      new: [],
      interested: [],
      rfq_sent: [],
      quotes_received: [],
      awarded: [],
    };

    for (const bid of sorted) {
      const stage = classifyBid(bid, rfqSummary);
      groups[stage].push(bid);
    }

    return groups;
  }, [bids, rfqSummary, searchQuery]);

  const toggleStage = (stage: WorkflowStage) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const totalActive = Object.values(stageData).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-4 mb-2">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search bids..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <span className="text-sm text-[var(--muted)]">{totalActive} active bids</span>
      </div>

      {/* Pipeline summary bar */}
      <div className="flex gap-2 mb-6">
        {STAGES.map(stage => {
          const count = stageData[stage.id].length;
          return (
            <button
              key={stage.id}
              onClick={() => {
                const el = document.getElementById(`stage-${stage.id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`flex-1 py-2 px-3 rounded-lg border ${stage.borderColor} ${stage.bgColor} text-center transition-all hover:opacity-80`}
            >
              <span className="text-lg">{stage.emoji}</span>
              <p className={`text-xl font-bold ${stage.color}`}>{count}</p>
              <p className="text-xs text-[var(--muted)]">{stage.label}</p>
            </button>
          );
        })}
      </div>

      {/* Stage columns */}
      {STAGES.map(stage => {
        const stageBids = stageData[stage.id];
        const isCollapsed = collapsedStages.has(stage.id);

        return (
          <div key={stage.id} id={`stage-${stage.id}`} className={`rounded-xl border ${stage.borderColor} ${stage.bgColor} overflow-hidden`}>
            {/* Stage header */}
            <button
              onClick={() => toggleStage(stage.id)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--card)]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{stage.emoji}</span>
                <h3 className={`text-base font-semibold ${stage.color}`}>{stage.label}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stage.bgColor} ${stage.color} border ${stage.borderColor}`}>
                  {stageBids.length}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-[var(--muted)] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Bid cards */}
            {!isCollapsed && stageBids.length > 0 && (
              <div className="px-4 pb-4 space-y-2">
                {stageBids.map(bid => {
                  const rfqInfo = rfqSummary[bid.id];
                  return (
                    <div
                      key={bid.id}
                      onClick={() => onSelectBid?.(bid)}
                      className={`bg-[var(--card)] rounded-lg p-4 border border-[var(--border)] hover:border-[var(--accent)]/50 cursor-pointer transition-all group ${getUrgencyClass(bid.closeDate)}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: bid info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {bid.external_id && (
                              <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                                {bid.external_id}
                              </span>
                            )}
                            <span className="text-xs text-[var(--muted)]">{bid.agency}</span>
                          </div>
                          <p className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-[var(--accent)] transition-colors">
                            {bid.title?.replace(/^Buy#\d+:\s*/, '')}
                          </p>
                          {/* RFQ info */}
                          {rfqInfo && (
                            <div className="flex gap-3 mt-1.5">
                              {rfqInfo.sent > 0 && (
                                <span className="text-xs text-purple-400">📤 {rfqInfo.sent} RFQ{rfqInfo.sent > 1 ? 's' : ''} sent</span>
                              )}
                              {rfqInfo.received > 0 && (
                                <span className="text-xs text-emerald-400">💰 {rfqInfo.received} quote{rfqInfo.received > 1 ? 's' : ''} in</span>
                              )}
                              {rfqInfo.overdue > 0 && (
                                <span className="text-xs text-red-400">⏰ {rfqInfo.overdue} overdue</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: close date + action */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs font-medium whitespace-nowrap">
                            {formatCloseDate(bid.closeDate)}
                          </p>
                          {bid.value && (
                            <p className="text-xs text-[var(--muted)] mt-0.5">{bid.value}</p>
                          )}
                          {/* Quick action for new bids */}
                          {stage.id === 'new' && onMarkInterested && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkInterested(bid);
                              }}
                              className="mt-2 px-2.5 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                            >
                              ⭐ Interested
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!isCollapsed && stageBids.length === 0 && (
              <div className="px-5 pb-4">
                <p className="text-sm text-[var(--muted)] italic">No bids in this stage</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
