'use client';

interface HeaderProps {
  onRefresh?: () => void;
  lastSync?: string;
  isLoading?: boolean;
}

export default function Header({ onRefresh, lastSync = 'Never', isLoading = false }: HeaderProps) {
  return (
    <header className="glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-cyan-400 flex items-center justify-center shadow-lg shadow-[var(--accent)]/20">
              <span className="text-xl">🦡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">BaxterBids</h1>
              <p className="text-xs text-[var(--muted)]">Government Bid Discovery</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
              Dashboard
            </a>
            <a href="#" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              Sources
            </a>
            <a href="#" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              Analytics
            </a>
            <a href="#" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              Settings
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-[var(--card)] transition-colors">
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></span>
            </button>

            {/* Sync Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
              <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-[var(--success)]'}`}></span>
              <span className="text-xs text-[var(--muted)]">
                {isLoading ? 'Syncing...' : `Synced ${lastSync}`}
              </span>
            </div>

            {/* Refresh Button */}
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-[var(--accent)]/20"
            >
              <svg 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline text-sm">
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
