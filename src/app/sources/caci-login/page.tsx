'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

export default function CACILoginPage() {
  const [status, setStatus] = useState<'idle' | 'launching' | 'waiting' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ cookies: number; expires?: string } | null>(null);

  const CACI_LOGIN_URL = 'https://supplier.caci.com/page.aspx/en/usr/login';
  const CACI_BIDS_URL = 'https://supplier.caci.com/page.aspx/en/rfp/request_browse_extranet';

  const openCACIPortal = () => {
    window.open(CACI_LOGIN_URL, '_blank', 'width=1200,height=800');
    setStatus('waiting');
    setMessage('Log in to CACI in the new window, then click "Save Session" below.');
  };

  const captureSession = async () => {
    setStatus('launching');
    setMessage('Launching browser to capture session...');
    
    try {
      const res = await fetch('/api/caci/capture-session', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        setSessionInfo({ cookies: data.cookieCount });
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to capture session');
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runScraper = async () => {
    setStatus('launching');
    setMessage('Running CACI scraper...');
    
    try {
      const res = await fetch('/api/caci/scrape', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        setStatus('success');
        setMessage(`Scraped ${data.bidCount} bids successfully!`);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to run scraper');
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const checkSession = async () => {
    setStatus('launching');
    setMessage('Checking session status...');
    
    try {
      const res = await fetch('/api/caci/session-status');
      const data = await res.json();
      
      if (data.valid) {
        setStatus('success');
        setMessage(`Session valid! ${data.cookieCount} cookies saved.`);
        setSessionInfo({ cookies: data.cookieCount });
      } else {
        setStatus('idle');
        setMessage(data.message || 'No valid session found');
        setSessionInfo(null);
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← Back to Overview
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">CACI Login</h1>
          <p className="text-[var(--muted)] mt-1">Manual login to capture session for CACI scraper</p>
        </div>

        {/* Status Card */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${
            status === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            status === 'waiting' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
            'bg-[var(--card)] border-[var(--border)] text-[var(--muted)]'
          }`}>
            <div className="flex items-center gap-3">
              {status === 'launching' && (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {status === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {status === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {status === 'waiting' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{message}</span>
            </div>
          </div>
        )}

        {/* Session Info */}
        {sessionInfo && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--accent)]/30">
            <h3 className="font-semibold text-[var(--foreground)] mb-2">Session Status</h3>
            <p className="text-sm text-[var(--muted)]">
              ✅ {sessionInfo.cookies} cookies saved
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] mb-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">How to Login</h2>
          <ol className="list-decimal list-inside space-y-3 text-[var(--muted)]">
            <li>Click <strong className="text-[var(--foreground)]">"Open CACI Portal"</strong> below</li>
            <li>Log in with your CACI credentials in the new window</li>
            <li>Complete MFA if prompted</li>
            <li>Once you see the dashboard, come back here</li>
            <li>Click <strong className="text-[var(--foreground)]">"Save Session"</strong> to capture cookies</li>
            <li>Then click <strong className="text-[var(--foreground)]">"Run Scraper"</strong> to fetch bids</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Open Portal */}
          <button
            onClick={openCACIPortal}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-[var(--accent)]/20"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open CACI Portal
            </div>
          </button>

          {/* Check Session */}
          <button
            onClick={checkSession}
            disabled={status === 'launching'}
            className="bg-[var(--card)] hover:bg-[var(--card)]/80 text-[var(--foreground)] font-semibold px-6 py-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition-all disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check Session
            </div>
          </button>

          {/* Save Session */}
          <button
            onClick={captureSession}
            disabled={status === 'launching'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Session
            </div>
          </button>

          {/* Run Scraper */}
          <button
            onClick={runScraper}
            disabled={status === 'launching' || !sessionInfo}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-4 rounded-xl transition-all hover:shadow-lg hover:shadow-green-500/20 disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Scraper
            </div>
          </button>
        </div>

        {/* Quick Link to CACI Bids */}
        <div className="mt-8 pt-8 border-t border-[var(--border)]">
          <Link 
            href="/sources/caci"
            className="text-[var(--accent)] hover:underline"
          >
            View CACI Bids →
          </Link>
        </div>
      </main>
    </div>
  );
}
