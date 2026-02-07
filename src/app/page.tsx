'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import BidTable from '@/components/BidTable';
import RFQTracker from '@/components/RFQTracker';
import { Bid, RFQ } from '@/types';

// Demo data - will be replaced with API calls
const demoBids: Bid[] = [
  {
    id: 'MBTA-2024-001',
    title: 'Vehicle Maintenance Equipment - Heavy Duty Lifts',
    agency: 'MBTA',
    closeDate: '2024-02-15',
    status: 'active',
    value: '$125,000 - $175,000',
    category: 'Equipment',
    url: '#'
  },
  {
    id: 'MBTA-2024-002', 
    title: 'IT Infrastructure Upgrade - Network Switches',
    agency: 'MBTA',
    closeDate: '2024-02-12',
    status: 'closing-soon',
    value: '$85,000 - $120,000',
    category: 'Technology',
    url: '#'
  },
  {
    id: 'MBTA-2024-003',
    title: 'Janitorial Services - Bus Maintenance Facility',
    agency: 'MBTA',
    closeDate: '2024-02-20',
    status: 'active',
    value: '$200,000 - $300,000',
    category: 'Services',
    url: '#'
  },
  {
    id: 'MBTA-2024-004',
    title: 'Safety Equipment - Personal Protective Gear',
    agency: 'MBTA',
    closeDate: '2024-02-08',
    status: 'closing-soon',
    value: '$45,000 - $65,000',
    category: 'Equipment',
    url: '#'
  },
  {
    id: 'MBTA-2024-005',
    title: 'Electrical Supplies - Wire and Cable',
    agency: 'MBTA',
    closeDate: '2024-02-25',
    status: 'active',
    value: '$30,000 - $50,000',
    category: 'Materials',
    url: '#'
  },
];

const demoRFQs: RFQ[] = [
  {
    id: 'RFQ-001',
    bidId: 'MBTA-2024-001',
    vendor: 'Stertil-Koni USA',
    status: 'sent',
    sentDate: '2024-02-05',
    dueDate: '2024-02-07',
  },
  {
    id: 'RFQ-002',
    bidId: 'MBTA-2024-001',
    vendor: 'Rotary Lift',
    status: 'received',
    sentDate: '2024-02-05',
    receivedDate: '2024-02-06',
    quoteAmount: '$142,500',
  },
  {
    id: 'RFQ-003',
    bidId: 'MBTA-2024-002',
    vendor: 'CDW Government',
    status: 'overdue',
    sentDate: '2024-02-03',
    dueDate: '2024-02-05',
  },
  {
    id: 'RFQ-004',
    bidId: 'MBTA-2024-004',
    vendor: 'Grainger',
    status: 'draft',
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<'bids' | 'rfqs'>('bids');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = {
    totalBids: demoBids.length,
    closingSoon: demoBids.filter(b => b.status === 'closing-soon').length,
    rfqsSent: demoRFQs.filter(r => r.status === 'sent').length,
    rfqsOverdue: demoRFQs.filter(r => r.status === 'overdue').length,
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Tab Navigation */}
        <div className="mt-8 flex items-center gap-4 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('bids')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === 'bids' 
                ? 'text-[var(--accent)]' 
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Active Bids
            {activeTab === 'bids' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('rfqs')}
            className={`pb-4 px-2 text-sm font-medium transition-all relative ${
              activeTab === 'rfqs' 
                ? 'text-[var(--accent)]' 
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            RFQ Tracker
            {stats.rfqsOverdue > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[var(--danger)] rounded-full">
                {stats.rfqsOverdue}
              </span>
            )}
            {activeTab === 'rfqs' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>

          {/* Search */}
          <div className="ml-auto pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'bids' ? (
            <BidTable bids={demoBids} searchQuery={searchQuery} />
          ) : (
            <RFQTracker rfqs={demoRFQs} searchQuery={searchQuery} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-[var(--muted)]">
            BaxterBids &copy; 2024 &middot; Built with 🦡 energy
          </p>
        </div>
      </footer>
    </div>
  );
}
