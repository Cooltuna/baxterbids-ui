'use client';

import { useState, useEffect } from 'react';
import { LineItem, Vendor } from '@/types';
import { draftRFQ } from '@/lib/api';

const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://settlement-poker-median-component.trycloudflare.com'
  : 'http://localhost:8000';

interface RFQDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  bidId: string;
  bidTitle: string;
  vendor: Vendor;
  items: LineItem[];
  deadline: string;
  onSent?: () => void;
}

export default function RFQDraftModal({
  isOpen,
  onClose,
  bidId,
  bidTitle,
  vendor,
  items,
  deadline,
  onSent
}: RFQDraftModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // Default to test email if no vendor contact
  const [vendorEmail, setVendorEmail] = useState(vendor.contact || '65baxter@gmail.com');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate draft when modal opens
  useEffect(() => {
    if (isOpen && !subject) {
      generateDraft();
    }
  }, [isOpen]);

  const generateDraft = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await draftRFQ(
        bidId,
        bidTitle,
        items,
        vendor.name,
        deadline,
        vendorEmail || undefined
      );
      setSubject(result.subject);
      setBody(result.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const fullEmail = `To: ${vendorEmail}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInEmail = () => {
    // Don't encode the email address itself, just subject and body
    const mailtoLink = `mailto:${vendorEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Use location.href instead of window.open for mailto links
    window.location.href = mailtoLink;
  };

  const handleSend = async () => {
    if (!vendorEmail) {
      setError('Please enter a vendor email address');
      return;
    }
    
    // Basic email validation
    if (!vendorEmail.includes('@') || !vendorEmail.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/rfq/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bid_id: bidId,
          vendor_name: vendor.name,
          vendor_email: vendorEmail,
          subject,
          body,
          items: items.map(i => i.description)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send RFQ');
      }

      setSuccess(true);
      onSent?.();
      
      // Close after showing success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send RFQ');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {isPreview ? 'Preview RFQ' : 'Draft RFQ'}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                To: {vendor.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-sm">
                ✅ RFQ sent successfully!
              </div>
            )}

            {isGenerating ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 mx-auto text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-[var(--muted)] mt-2">Generating RFQ draft...</p>
              </div>
            ) : isPreview ? (
              /* Preview Mode */
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--muted)] mb-1">To:</div>
                  <div className="font-medium">{vendorEmail || '(no email)'}</div>
                </div>
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--muted)] mb-1">Subject:</div>
                  <div className="font-medium">{subject}</div>
                </div>
                <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--muted)] mb-2">Message:</div>
                  <div className="whitespace-pre-wrap text-sm">{body}</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/30">
                  <div className="text-sm text-[var(--muted)] mb-1">Items Requested ({items.length}):</div>
                  <ul className="text-sm space-y-1">
                    {items.slice(0, 5).map((item, i) => (
                      <li key={i}>• {item.description}</li>
                    ))}
                    {items.length > 5 && (
                      <li className="text-[var(--muted)]">... and {items.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Send To (Email) *
                  </label>
                  <input
                    type="email"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    placeholder="vendor@example.com"
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] font-medium"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Email will be sent from 65baxter@gmail.com
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
                </div>
                <div className="text-xs text-[var(--muted)]">
                  📦 {items.length} items will be included in this RFQ
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--card)]/50">
            <button
              onClick={generateDraft}
              disabled={isGenerating}
              className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              🔄 Regenerate
            </button>
            <div className="flex items-center gap-2">
              {isPreview ? (
                <>
                  <button
                    onClick={() => setIsPreview(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                  >
                    ← Edit
                  </button>
                  <button
                    onClick={handleCopyToClipboard}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                  >
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    onClick={handleOpenInEmail}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Open in Email
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !vendorEmail}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Direct
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsPreview(true)}
                    disabled={!subject || !body}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
