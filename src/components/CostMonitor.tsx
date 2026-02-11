'use client';

import { useState, useEffect } from 'react';

interface UsageData {
  period_days: number;
  overall: {
    calls: number | null;
    total_input: number | null;
    total_output: number | null;
    total_cost: number | null;
  };
  by_script: Array<{
    script: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  }>;
  by_model: Array<{
    model: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  }>;
  by_day: Array<{
    date: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CostMonitor() {
  const [usage, setUsage] = useState<UsageData | null>(null);
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

  const formatNumber = (n: number | null) => {
    if (n === null || n === undefined) return '0';
    return n.toLocaleString();
  };

  const formatCost = (n: number | null) => {
    if (n === null || n === undefined) return '$0.00';
    return `$${n.toFixed(4)}`;
  };

  const shortModel = (model: string) => {
    return model
      .replace('claude-', '')
      .replace('-20250514', '')
      .replace('-20250214', '');
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

  const totalCost = usage?.overall?.total_cost ?? 0;
  const totalCalls = usage?.overall?.calls ?? 0;

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
          <span className={`font-mono font-bold ${totalCost > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
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

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">Calls</div>
              <div className="text-white font-medium">{formatNumber(totalCalls)}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">Input</div>
              <div className="text-white font-medium">{formatNumber(usage.overall?.total_input)}t</div>
            </div>
            <div className="bg-gray-700/50 rounded p-2">
              <div className="text-gray-400 text-xs">Output</div>
              <div className="text-white font-medium">{formatNumber(usage.overall?.total_output)}t</div>
            </div>
          </div>

          {/* By Model */}
          {usage.by_model && usage.by_model.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">By Model</div>
              <div className="space-y-1">
                {usage.by_model.map((m) => (
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

          {/* By Script */}
          {usage.by_script && usage.by_script.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">By Script</div>
              <div className="space-y-1">
                {usage.by_script.map((s) => (
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

          {/* By Day */}
          {usage.by_day && usage.by_day.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-1">By Day</div>
              <div className="space-y-1">
                {usage.by_day.slice(0, 5).map((d) => (
                  <div key={d.date} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{d.date}</span>
                    <div className="flex gap-2">
                      <span className="text-gray-500">{d.calls} calls</span>
                      <span className="text-green-400 font-mono">{formatCost(d.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCalls === 0 && (
            <div className="text-gray-500 text-xs text-center py-2">
              No API usage recorded yet. Costs will appear as scripts run.
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
