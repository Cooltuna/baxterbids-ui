'use client';

import { useState, useEffect, useRef } from 'react';

interface VendorSuggestion {
  id: string;
  name: string;
  email: string;
  website: string;
}

interface CustomVendorInputProps {
  onDraftRFQ: (name: string, email: string) => void;
}

export default function CustomVendorInput({ onDraftRFQ }: CustomVendorInputProps) {
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [suggestions, setSuggestions] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for vendors as user types
  useEffect(() => {
    const searchVendors = async () => {
      if (vendorName.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/vendors/search?q=${encodeURIComponent(vendorName)}`);
        const data = await res.json();
        if (data.success) {
          setSuggestions(data.data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Vendor search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchVendors, 300);
    return () => clearTimeout(debounce);
  }, [vendorName]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: VendorSuggestion) => {
    setVendorName(suggestion.name);
    setVendorEmail(suggestion.email || '');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = () => {
    if (vendorName.trim()) {
      onDraftRFQ(vendorName.trim(), vendorEmail.trim());
      setVendorName('');
      setVendorEmail('');
      setSuggestions([]);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-[var(--background)] border-2 border-dashed border-[var(--border)]">
      <h5 className="font-semibold text-[var(--foreground)] mb-3">➕ Add Custom Vendor</h5>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Vendor Name with Typeahead */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or enter vendor name *"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            onFocus={() => vendorName.length >= 2 && setSuggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-[var(--muted)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          
          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {suggestions.map((suggestion, idx) => (
                <div
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`px-3 py-2 cursor-pointer text-sm ${
                    idx === selectedIndex 
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]' 
                      : 'hover:bg-[var(--background)]'
                  }`}
                >
                  <div className="font-medium">{suggestion.name}</div>
                  {suggestion.email && (
                    <div className="text-xs text-[var(--muted)]">{suggestion.email}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Input */}
        <input
          type="email"
          placeholder="Email Address"
          value={vendorEmail}
          onChange={(e) => setVendorEmail(e.target.value)}
          className="px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
        />

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!vendorName.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Draft RFQ
        </button>
      </div>
      <p className="text-xs text-[var(--muted)] mt-2">
        Start typing to search your vendor database, or enter a new vendor name
      </p>
    </div>
  );
}
