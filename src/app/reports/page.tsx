'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
}

const REPORTS: ReportConfig[] = [
  {
    id: 'bid-activity',
    name: 'Bid Activity Summary',
    description: 'Overview of bids by source, status, and time period. Track new bids, win rates, and pipeline health.',
    icon: '📊',
    available: true,
  },
  {
    id: 'rfq-tracker',
    name: 'RFQ Status Report',
    description: 'All sent RFQs with response rates, average response time, and overdue tracking.',
    icon: '📝',
    available: true,
  },
  {
    id: 'vendor-performance',
    name: 'Vendor Performance',
    description: 'Vendor response rates, average pricing, lead times, and reliability scores.',
    icon: '🏢',
    available: false,
  },
  {
    id: 'cost-analysis',
    name: 'API Cost Analysis',
    description: 'Detailed breakdown of API costs by model, session type, and daily trends.',
    icon: '💰',
    available: true,
  },
  {
    id: 'source-health',
    name: 'Scraper Health',
    description: 'Status of all bid source scrapers — last run times, error rates, and bid freshness.',
    icon: '🔧',
    available: true,
  },
  {
    id: 'pipeline-funnel',
    name: 'Pipeline Funnel',
    description: 'Bids from discovery → interested → RFQ sent → quoted → awarded. Conversion at each stage.',
    icon: '📈',
    available: false,
  },
];

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://api.logisticollc.com'
  : 'http://localhost:8000';

// ===== Bid Activity Report =====
function BidActivityReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/bid-activity?days=${days}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData({ error: 'Report endpoint not available yet' });
      }
    } catch {
      setData({ error: 'API not reachable' });
    }
    setLoading(false);
  };

  if (loading) return <div className="text-[var(--muted)] p-8 text-center">Loading report...</div>;
  if (data?.error) return <div className="text-[var(--muted)] p-8 text-center">{data.error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[1, 7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm ${days === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}>
            {d}d
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data?.summary && Object.entries(data.summary).map(([key, value]: [string, any]) => (
          <div key={key} className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] uppercase">{key.replace(/_/g, ' ')}</p>
            <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* By Source */}
      {data?.by_source && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">By Source</h3>
          <div className="space-y-2">
            {data.by_source.map((s: any) => (
              <div key={s.source} className="flex items-center justify-between p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <span className="font-medium text-[var(--foreground)]">{s.source}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[var(--muted)]">{s.total} bids</span>
                  <span className="text-[var(--success)]">{s.new || 0} new</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== RFQ Tracker Report =====
function RFQTrackerReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/rfq-tracker`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData({ error: 'Report endpoint not available yet' });
      }
    } catch {
      setData({ error: 'API not reachable' });
    }
    setLoading(false);
  };

  if (loading) return <div className="text-[var(--muted)] p-8 text-center">Loading report...</div>;
  if (data?.error) return <div className="text-[var(--muted)] p-8 text-center">{data.error}</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)]">Total RFQs</p>
          <p className="text-2xl font-bold">{data?.total || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30">
          <p className="text-xs text-[var(--success)]">Responded</p>
          <p className="text-2xl font-bold text-[var(--success)]">{data?.responded || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30">
          <p className="text-xs text-[var(--warning)]">Awaiting</p>
          <p className="text-2xl font-bold text-[var(--warning)]">{data?.awaiting || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30">
          <p className="text-xs text-[var(--accent)]">Response Rate</p>
          <p className="text-2xl font-bold text-[var(--accent)]">{data?.response_rate || '0%'}</p>
        </div>
      </div>

      {/* RFQ List */}
      {data?.rfqs && data.rfqs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="py-2 px-3 font-medium text-[var(--muted)]">Vendor</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)]">Bid</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)]">Sent</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)]">Status</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)] text-right">Quote</th>
              </tr>
            </thead>
            <tbody>
              {data.rfqs.map((rfq: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card)]">
                  <td className="py-2 px-3 font-medium">{rfq.vendor_name || rfq.vendor_email}</td>
                  <td className="py-2 px-3 text-[var(--muted)] truncate max-w-[200px]">{rfq.subject}</td>
                  <td className="py-2 px-3 text-[var(--muted)]">{new Date(rfq.sent_at).toLocaleDateString()}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      rfq.status === 'responded' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
                      rfq.status === 'sent' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' :
                      'bg-[var(--muted)]/20 text-[var(--muted)]'
                    }`}>
                      {rfq.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[var(--success)]">
                    {rfq.quoted_total ? `$${rfq.quoted_total.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Cost Analysis Report =====
function CostAnalysisReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tokens/usage?days=${days}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  if (loading) return <div className="text-[var(--muted)] p-8 text-center">Loading report...</div>;
  if (!data) return <div className="text-[var(--muted)] p-8 text-center">No data available</div>;

  const ocCost = data.openclaw?.total_cost ?? 0;
  const scriptCost = data.scripts?.total_cost ?? 0;
  const totalCost = data.combined?.total_cost ?? 0;
  const dailyAvg = totalCost / (days || 1);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm ${days === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)]'}`}>
            {d}d
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)]">Total Cost</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">${totalCost.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)]">🤖 OpenClaw</p>
          <p className="text-2xl font-bold">${ocCost.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)]">📜 Scripts</p>
          <p className="text-2xl font-bold">${scriptCost.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30">
          <p className="text-xs text-[var(--accent)]">~Monthly</p>
          <p className="text-2xl font-bold text-[var(--accent)]">${(dailyAvg * 30).toFixed(2)}</p>
        </div>
      </div>

      {/* Daily Breakdown */}
      {data.openclaw?.by_day && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Daily Spend</h3>
          <div className="space-y-1">
            {data.openclaw.by_day.filter((d: any) => d.date !== 'unknown').map((day: any) => {
              const maxCost = Math.max(...data.openclaw.by_day.filter((d: any) => d.date !== 'unknown').map((d: any) => d.cost));
              const pct = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted)] w-20 shrink-0">{day.date}</span>
                  <div className="flex-1 h-6 bg-[var(--card)] rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${day.cost > 30 ? 'bg-red-500/60' : day.cost > 10 ? 'bg-yellow-500/60' : 'bg-[var(--success)]/60'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-16 text-right ${day.cost > 30 ? 'text-red-400' : day.cost > 10 ? 'text-yellow-400' : 'text-[var(--success)]'}`}>
                    ${day.cost.toFixed(2)}
                  </span>
                  <span className="text-xs text-[var(--muted)] w-16 text-right">{day.calls} calls</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By Model */}
      {data.openclaw?.by_model && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">By Model</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.openclaw.by_model.filter((m: any) => m.cost > 0).map((m: any) => (
              <div key={m.model} className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {m.model.replace('claude-', '').replace('-20250514', '').replace('-20250214', '')}
                </p>
                <p className="text-xl font-bold mt-1">${m.cost.toFixed(2)}</p>
                <p className="text-xs text-[var(--muted)]">{m.calls} calls</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Session Type */}
      {data.openclaw?.by_session_type && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">By Session Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.openclaw.by_session_type.map((s: any) => (
              <div key={s.type} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <p className="text-xs text-[var(--muted)]">
                  {s.type === 'main' ? '💬 Main' : s.type === 'cron' ? '⏰ Cron' : s.type === 'slack' ? '💼 Slack' : `📋 ${s.type}`}
                </p>
                <p className="text-lg font-bold mt-1">${s.cost.toFixed(2)}</p>
                <p className="text-xs text-[var(--muted)]">{s.calls} calls</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Scraper Health Report =====
function ScraperHealthReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/scraper-health`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData({ error: 'Report endpoint not available yet' });
      }
    } catch {
      setData({ error: 'API not reachable' });
    }
    setLoading(false);
  };

  if (loading) return <div className="text-[var(--muted)] p-8 text-center">Loading report...</div>;
  if (data?.error) return <div className="text-[var(--muted)] p-8 text-center">{data.error}</div>;

  return (
    <div className="space-y-4">
      {data?.sources?.map((src: any) => (
        <div key={src.name} className="flex items-center justify-between p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{src.healthy ? '✅' : '⚠️'}</span>
            <div>
              <p className="font-medium text-[var(--foreground)]">{src.name}</p>
              <p className="text-xs text-[var(--muted)]">{src.total_bids} bids total</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--foreground)]">{src.last_updated || 'Never'}</p>
            <p className="text-xs text-[var(--muted)]">{src.hours_ago != null ? `${src.hours_ago}h ago` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Main Reports Page =====
export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const renderReport = () => {
    switch (activeReport) {
      case 'bid-activity': return <BidActivityReport />;
      case 'rfq-tracker': return <RFQTrackerReport />;
      case 'cost-analysis': return <CostAnalysisReport />;
      case 'source-health': return <ScraperHealthReport />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeReport ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Reports</h2>
              <p className="text-[var(--muted)] mt-1">Custom reports for bid operations, vendor tracking, and cost analysis.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORTS.map((report) => (
                <button
                  key={report.id}
                  onClick={() => report.available && setActiveReport(report.id)}
                  disabled={!report.available}
                  className={`text-left p-6 rounded-xl border transition-all ${
                    report.available
                      ? 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg cursor-pointer'
                      : 'bg-[var(--card)]/50 border-[var(--border)] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{report.icon}</span>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{report.name}</h3>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{report.description}</p>
                  {!report.available && (
                    <span className="inline-block mt-3 px-2 py-1 text-xs rounded bg-[var(--muted)]/20 text-[var(--muted)]">
                      Coming Soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 rounded-lg hover:bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">
                  {REPORTS.find(r => r.id === activeReport)?.icon} {REPORTS.find(r => r.id === activeReport)?.name}
                </h2>
                <p className="text-sm text-[var(--muted)]">{REPORTS.find(r => r.id === activeReport)?.description}</p>
              </div>
            </div>
            {renderReport()}
          </>
        )}
      </main>
    </div>
  );
}
