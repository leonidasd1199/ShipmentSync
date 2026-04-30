// =============================================================================
// SEARCHABLE PORT SELECT COMPONENT WITH CREATE PORT CAPABILITY
// =============================================================================

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import classNames from 'classnames';
import { Search, X, Plus, Loader2, AlertCircle } from 'lucide-react';
import { PortsService } from '../services/ports.service';
import type { Port } from '../utils/types/port.type';

interface SearchablePortSelectProps {
  value: string;
  onChange: (value: string) => void;
  ports: Port[];
  loading: boolean;
  disabled: boolean;
  placeholder: string;
  label: string;
  onPortCreated?: (port: Port) => void;
}

const MAX_SUGGESTIONS = 8;
const MIN_SEARCH_LENGTH = 2;

// Port type options as expected by the backend
const PORT_TYPE_OPTIONS = [
  { value: 'sea', label: 'Sea Port' },
  { value: 'air', label: 'Airport' },
  { value: 'rail', label: 'Rail Terminal' },
  { value: 'inland', label: 'Inland Port' },
  { value: 'other', label: 'Other' },
] as const;

type PortType = 'sea' | 'air' | 'rail' | 'inland' | 'other';

const labelBase = "mb-1 block text-xs sm:text-sm font-medium text-neutral-700";
const inputBase = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";
const selectBase = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all appearance-none";

// Helper function to get port display name
const getPortDisplayName = (port: any): string => {
  if (!port) return "";
  const code = port.code || port.unlocode || "";
  const name = port.name || "";
  const country = port.countryName || port.country || "";
  if (code && name && country) return `${name} (${code}) - ${country}`;
  if (name && country) return `${name} - ${country}`;
  if (name) return name;
  return code || "Unknown Port";
};

// Helper function to search ports
const searchPorts = (ports: Port[], term: string, maxResults: number): Port[] => {
  if (term.length < MIN_SEARCH_LENGTH) return [];
  
  const lowerTerm = term.toLowerCase();
  const results: Port[] = [];
  
  for (let i = 0; i < ports.length && results.length < maxResults; i++) {
    const port = ports[i] as any;
    const name = (port.name || "").toLowerCase();
    const code = (port.code || port.unlocode || "").toLowerCase();
    const country = (port.countryName || port.country || "").toLowerCase();
    
    if (name.includes(lowerTerm) || code.includes(lowerTerm) || country.includes(lowerTerm)) {
      results.push(port);
    }
  }
  
  return results;
};

const SearchablePortSelect = memo(function SearchablePortSelect({
  value,
  onChange,
  ports,
  loading,
  disabled,
  placeholder,
  label,
  onPortCreated,
}: SearchablePortSelectProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Create port form state
  const [newPortName, setNewPortName] = useState("");
  const [newPortCode, setNewPortCode] = useState("");
  const [newPortCountry, setNewPortCountry] = useState("");
  const [newPortType, setNewPortType] = useState<PortType>("sea");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected port
  const selectedPort = useMemo(() => {
    if (!value) return null;
    return ports.find((p: any) => (p.id || p._id) === value);
  }, [ports, value]);

  // Live search results
  const suggestions = useMemo(() => {
    return searchPorts(ports, searchTerm, MAX_SUGGESTIONS);
  }, [ports, searchTerm]);

  // Update dropdown position when focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isFocused, searchTerm]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update position on scroll
  useEffect(() => {
    if (!isFocused) return;
    const handleScroll = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isFocused]);

  const handleSelect = useCallback((portId: string) => {
    onChange(portId);
    setIsFocused(false);
    setSearchTerm("");
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange("");
    setSearchTerm("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (!disabled && !loading) {
      setIsFocused(true);
    }
  }, [disabled, loading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        const firstPort = suggestions[0] as any;
        handleSelect(firstPort.id || firstPort._id);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
      setSearchTerm("");
      inputRef.current?.blur();
    }
  }, [suggestions, handleSelect]);

  const openCreateModal = useCallback(() => {
    setNewPortName(searchTerm);
    setNewPortCode("");
    setNewPortCountry("");
    setNewPortType("sea");
    setCreateError(null);
    setShowCreateModal(true);
    setIsFocused(false);
  }, [searchTerm]);

  const handleCreatePort = useCallback(async () => {
    if (!newPortName.trim()) {
      setCreateError("Port name is required");
      return;
    }
    if (!newPortCountry.trim()) {
      setCreateError("Country is required");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const newPort = await PortsService.create({
        name: newPortName.trim(),
        code: newPortCode.trim() || newPortName.trim().substring(0, 5).toUpperCase(),
        country: newPortCountry.trim(),
        type: newPortType,
        isActive: true,
      } as any);

      // Notify parent to refresh ports list
      if (onPortCreated) {
        onPortCreated(newPort);
      }

      // Select the newly created port
      onChange(newPort._id || (newPort as any).id);
      
      // Close modal and reset
      setShowCreateModal(false);
      setSearchTerm("");
      setNewPortName("");
      setNewPortCode("");
      setNewPortCountry("");
      setNewPortType("sea");
    } catch (error: any) {
      console.error("Failed to create port:", error);
      setCreateError(error?.response?.data?.message || error?.message || "Failed to create port. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [newPortName, newPortCode, newPortCountry, newPortType, onChange, onPortCreated]);

  const showSuggestions = isFocused && searchTerm.length > 0;
  const hasMinChars = searchTerm.length >= MIN_SEARCH_LENGTH;
  const noResults = hasMinChars && suggestions.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <label className={labelBase}>{label}</label>
      
      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={isFocused ? searchTerm : (selectedPort ? getPortDisplayName(selectedPort) : "")}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={classNames(
            "w-full pl-9 pr-8 py-2 text-sm bg-white border border-neutral-300 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400",
            "placeholder-neutral-400 transition-all",
            disabled && "opacity-50 cursor-not-allowed",
            selectedPort && !isFocused && "text-neutral-900",
            !selectedPort && !isFocused && "text-neutral-400"
          )}
        />
        {/* Clear button */}
        {(value || searchTerm) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 bg-transparent text-neutral-400 hover:text-neutral-600 transition-colors border-0 outline-none"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div 
          className="fixed rounded-lg shadow-lg overflow-hidden border border-neutral-200"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
            backgroundColor: 'white',
          }}
        >
          {!hasMinChars ? (
            <div className="px-3 py-2 text-xs text-neutral-400 bg-white">
              Type {MIN_SEARCH_LENGTH - searchTerm.length} more character{MIN_SEARCH_LENGTH - searchTerm.length > 1 ? "s" : ""}...
            </div>
          ) : noResults ? (
            <div className="flex flex-col bg-white">
              <div className="px-3 py-2 text-xs text-neutral-500 bg-white">
                No results for "<span className="font-medium">{searchTerm}</span>"
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full px-3 py-2 text-left text-xs text-blue-600 bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center gap-2 border-t border-neutral-200"
              >
                <Plus size={14} />
                <span>Create new port: "{searchTerm}"</span>
              </button>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto bg-white">
              {suggestions.map((port: any, index) => {
                const portId = port.id || port._id;
                return (
                  <button
                    key={portId}
                    type="button"
                    onClick={() => handleSelect(portId)}
                    className={classNames(
                      "w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 bg-white",
                      "hover:bg-neutral-50 text-neutral-700",
                      index === 0 && "bg-neutral-50"
                    )}
                  >
                    <span className="truncate flex-1">{getPortDisplayName(port)}</span>
                    {index === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-500">
                        Enter
                      </span>
                    )}
                  </button>
                );
              })}
              {suggestions.length >= MAX_SUGGESTIONS && (
                <div className="px-3 py-1.5 text-[10px] text-neutral-400 border-t border-neutral-100 bg-white">
                  Type more to refine results
                </div>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full px-3 py-2 text-left text-xs text-blue-600 bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center gap-2 border-t border-neutral-200"
              >
                <Plus size={14} />
                <span>Create new port</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Port Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 10000, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Create New Port</h2>
              <p className="text-sm text-neutral-500 mt-1">Add a new port to the database</p>
            </div>
            
            <div className="p-5 space-y-4">
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{createError}</p>
                </div>
              )}

              <div>
                <label className={labelBase}>Port Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPortName}
                  onChange={(e) => setNewPortName(e.target.value)}
                  placeholder="e.g., Shanghai"
                  className={inputBase}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelBase}>Port Code</label>
                <input
                  type="text"
                  value={newPortCode}
                  onChange={(e) => setNewPortCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CNSHA (optional)"
                  className={inputBase}
                  maxLength={10}
                />
                <p className="mt-1 text-xs text-neutral-400">Leave empty to auto-generate from port name</p>
              </div>

              <div>
                <label className={labelBase}>Country <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPortCountry}
                  onChange={(e) => setNewPortCountry(e.target.value)}
                  placeholder="e.g., China"
                  className={inputBase}
                />
              </div>

              <div>
                <label className={labelBase}>Port Type <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={newPortType}
                    onChange={(e) => setNewPortType(e.target.value as PortType)}
                    className={selectBase}
                  >
                    {PORT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-neutral-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePort}
                disabled={creating || !newPortName.trim() || !newPortCountry.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Create Port</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SearchablePortSelect;