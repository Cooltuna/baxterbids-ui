'use client';

import { Stats } from '@/types';

interface StatsCardsProps {
  stats: Stats;
  isLoading?: boolean;
}

export default function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  const cards = [
    {
      label: 'Active Bids',
      value: stats.totalBids,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'from-[var(--accent)] to-cyan-400',
      bgColor: 'bg-[var(--accent)]/10',
      textColor: 'text-[var(--accent)]',
    },
    {
      label: 'Closing Soon',
      value: stats.closingSoon,
      subtitle: 'within 3 days',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-400',
    },
    {
      label: 'RFQs Sent',
      value: stats.rfqsSent,
      subtitle: 'awaiting response',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400',
    },
    {
      label: 'Overdue',
      value: stats.rfqsOverdue,
      subtitle: 'need follow-up',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'from-red-400 to-rose-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      pulse: stats.rfqsOverdue > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-[var(--accent)]/50 hover:shadow-lg hover:shadow-[var(--accent)]/5 animate-fade-in ${card.pulse ? 'animate-pulse-glow' : ''}`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Background gradient */}
          <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-5 blur-2xl`} />
          
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm text-[var(--muted)] font-medium">{card.label}</p>
              {isLoading ? (
                <div className="h-10 w-16 mt-2 skeleton rounded" />
              ) : (
                <p className={`text-4xl font-bold mt-2 ${card.textColor}`}>
                  {card.value}
                </p>
              )}
              {card.subtitle && (
                <p className="text-xs text-[var(--muted)] mt-1">{card.subtitle}</p>
              )}
            </div>
            <div className={`p-3 rounded-xl ${card.bgColor}`}>
              <div className={card.textColor}>{card.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
