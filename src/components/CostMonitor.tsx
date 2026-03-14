'use client';

import { useState, useEffect } from 'react';

interface CombinedUsage {
  period_days: number;
  combined: {
    total_cost: number;
    total_calls: number;
  };
  openclaw: {
    total_cost: number;
    total_calls: number;
    total_input?: number;
    total_output?: number;
    total_cache_read?: number;
    total_cache_write?: number;
    by_day?: Array<{
      date: string;
      calls: number;
      cost: number;
    }>;
    by_model?: Array<{
      model: string;
      calls: number;
      cost: number;
    }>;
    by_session_type?: Array<{
      type: string;
      calls: number;
      cost: number;
    }>;
  };
  scripts: {
    total_cost: number;
    total_calls: number;
    by_script?: Array<{
      script: string;
      calls: number;
      cost: number;
    }>;
    by_model?: Array<{
      model: string;
      calls: number;
      cost: number;
    }>;
  };
}

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://api.logisticollc.com'
  : 'http://localhost:8000';

export default function CostMonitor() {
  const [usage, setUsage] = useState<CombinedUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState(5);

  useEffect(() => {
    fetchUsage();
  }, [days]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tokens/usage?days=${days}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error('Failed to fetch usage');
      const data = await res.json();
      setUsage(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (n: number | null | undefined) => {
    if (n === null || n === undefined) return '$0.00';
    return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  };

  const shortModel = (model: string) => {
    return model
      .replace('claude-', '')
      .replace('-20250514', '')
      .replace('-20250214', '')
      .replace('delivery-mirror', '📨 delivery');
  };

  if (loading && !usage) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 text-sm">
        <div className="text-gray-400">Loading costs...</div>
      </div>
    );
  }

  if (error && !usage) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 text-sm">
        <div className="text-red-400">⚠️ {error}</div>
      </div>
    );
  }

  const totalCost = usage?.combined?.total_cost ?? 0;
  const ocCost = usage?.openclaw?.total_cost ?? 0;
  const scriptCost = usage?.scripts?.total_cost ?? 0;
  const dailyAvg = totalCost / (usage?.period_days || 1);
  const monthlyProjection = dailyAvg * 30;

  return (
    <div className="bg-gray-800 rounded-lg p-3 text-sm">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="font-medium text-white">API Costs</span>
          <span className="text-gray-400">({days}d)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold ${totalCost > 50 ? 'text-red-400' : totalCost > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
            {formatCost(totalCost)}
          </span>
          <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && usage && (
        <div className="mt-3 space-y-3 border-t border-gray-700 pt-3">
          {/* Period selector */}
          <div className="flex gap-2">
            {[1, 5, 7, 30].map((d) => (
              <button
                key={d}
                onClick={(e) => { e.stopPropagation(); setDays(d); }}
                className={`px-2 py-1 rounded text-xs ${
                  days === d 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">🤖 OpenClaw</div>
              <div className={`font-mono font-medium ${ocCost > 20 ? 'text-yellow-400' : 'text-white'}`}>{formatCost(ocCost)}</div>
              <div className="text-gray-500 text-xs">{usage.openclaw?.total_calls ?? 0} calls</div>
            </div>
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">📜 Scripts</div>
              <div className={`font-mono font-medium ${scriptCost > 20 ? 'text-yellow-400' : 'text-white'}`}>{formatCost(scriptCost)}</div>
              <div className="text-gray-500 text-xs">{usage.scripts?.total_calls ?? 0} calls</div>
            </div>
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">📊 ~Monthly</div>
              <div className={`font-mono font-medium ${monthlyProjection > 200 ? 'text-red-400' : monthlyProjection > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                {formatCost(monthlyProjection)}
              </div>
              <div className="text-gray-500 text-xs">${dailyAvg.toFixed(2)}/day</div>
            </div>
          </div>

          {/* By Session Type */}
          {usage.openclaw?.by_session_type && usage.openclaw.by_session_type.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">OpenClaw By Type</div>
              <div className="space-y-1">
                {usage.openclaw.by_session_type.map((s) => (
                  <div key={s.type} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">
                      {s.type === 'main' ? '💬 main' : s.type === 'cron' ? '⏰ cron' : s.type === 'slack' ? '💼 slack' : `📋 ${s.type}`}
                    </span>
                    <div className="flex gap-2">
                      <span className="text-gray-500">{s.calls} calls</span>
                      <span className="text-green-400 font-mono">{formatCost(s.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Model */}
          {usage.openclaw?.by_model && usage.openclaw.by_model.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">By Model</div>
              <div className="space-y-1">
                {usage.openclaw.by_model.filter(m => m.cost > 0).map((m) => (
                  <div key={m.model} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{shortModel(m.model)}</span>
                    <div className="flex gap-2">
                      <span className="text-gray-500">{m.calls} calls</span>
                      <span className="text-green-400 font-mono">{formatCost(m.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Day */}
          {usage.openclaw?.by_day && usage.openclaw.by_day.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">By Day</div>
              <div className="space-y-1">
                {usage.openclaw.by_day.filter(d => d.date !== 'unknown').slice(0, 7).map((d) => (
                  <div key={d.date} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{d.date}</span>
                    <div className="flex gap-2">
                      <span className="text-gray-500">{d.calls} calls</span>
                      <span className={`font-mono ${d.cost > 30 ? 'text-red-400' : d.cost > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {formatCost(d.cost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top scripts */}
          {usage.scripts?.by_script && usage.scripts.by_script.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">Top Scripts</div>
              <div className="space-y-1">
                {usage.scripts.by_script.slice(0, 5).map((s) => (
                  <div key={s.script} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300 truncate max-w-[150px]">{s.script}</span>
                    <div className="flex gap-2">
                      <span className="text-gray-500">{s.calls}x</span>
                      <span className="text-green-400 font-mono">{formatCost(s.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={(e) => { e.stopPropagation(); fetchUsage(); }}
            className="w-full text-xs text-gray-400 hover:text-white py-1"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}
