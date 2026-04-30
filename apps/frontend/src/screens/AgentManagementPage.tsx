import React, { useCallback, useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Link2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Ship,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  X,
  ExternalLink,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { AgentsService } from "../services/agents.service";
import { ShippingsService } from "../services/shipping.service";

// =============================================================================
// TYPES
// =============================================================================

type Agent = {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  address?: {
    street: string;
    city: string;
    country: string;
    state?: string;
    zip?: string;
  };
  notes?: string;
  shippingLineId?: string;
  shippingLineIds?: string[];
  shippingLines?: Array<{ id: string; _id?: string; name: string }>;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ShippingLine = {
  id?: string;
  _id?: string;
  name: string;
  shippingModes?: string[];
};

type MagicLinkResponse = {
  link: string;
  expiresAt: string;
};

// =============================================================================
// STYLES
// =============================================================================

const inputBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";

const menuItemStyle = {
  backgroundColor: 'transparent',
};

const dropdownStyle = {
  backgroundColor: '#ffffff',
};

const modalStyle = {
  backgroundColor: '#ffffff',
};

// =============================================================================
// DROPDOWN MENU COMPONENT
// =============================================================================

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, children, width = "w-48" }) => {
  if (!isOpen) return null;
  
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div 
        className={`absolute right-0 top-full mt-1 z-20 ${width} rounded-lg border border-neutral-200 shadow-lg py-1`}
        style={dropdownStyle}
      >
        {children}
      </div>
    </>
  );
};

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ onClick, icon, label, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
      danger 
        ? "text-red-600 hover:bg-red-50" 
        : "text-neutral-700 hover:bg-neutral-100"
    }`}
    style={menuItemStyle}
  >
    <span className={danger ? "" : "text-neutral-500"}>{icon}</span>
    {label}
  </button>
);

// =============================================================================
// AGENT CARD COMPONENT
// =============================================================================

interface AgentCardProps {
  agent: Agent;
  onViewDetails: (agent: Agent) => void;
  onGenerateMagicLink: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onViewDetails,
  onGenerateMagicLink,
  onEdit,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Unknown";
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase() || "??";

  const isActive = agent.isActive !== false;
  const supplierNames = agent.shippingLines?.map(sl => sl.name).join(", ") || null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              isActive ? "bg-blue-600" : "bg-neutral-400"
            }`}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-900 truncate">
                {displayName}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-sm text-neutral-500">
              <Mail size={12} />
              <span className="truncate">{agent.email}</span>
            </div>

            {supplierNames && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-neutral-500">
                <Ship size={12} />
                <span className="truncate">{supplierNames}</span>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
            style={{ backgroundColor: '#ffffff', color: '#6b7280' }}
          >
            <MoreVertical size={16} />
          </button>

          <DropdownMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuItem
              onClick={() => { onViewDetails(agent); setMenuOpen(false); }}
              icon={<Eye size={14} />}
              label="View Details"
            />
            <MenuItem
              onClick={() => { onGenerateMagicLink(agent); setMenuOpen(false); }}
              icon={<Link2 size={14} />}
              label="Generate Magic Link"
            />
            <MenuItem
              onClick={() => { onEdit(agent); setMenuOpen(false); }}
              icon={<Edit size={14} />}
              label="Edit Agent"
            />
            <hr className="my-1 border-neutral-200" />
            <MenuItem
              onClick={() => { onDelete(agent); setMenuOpen(false); }}
              icon={<Trash2 size={14} />}
              label="Delete Agent"
              danger
            />
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onGenerateMagicLink(agent)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-blue-600 hover:bg-blue-50 transition-colors text-xs font-medium"
        >
          <Link2 size={14} />
          Magic Link
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// AGENT TABLE ROW COMPONENT
// =============================================================================

interface AgentTableRowProps {
  agent: Agent;
  onViewDetails: (agent: Agent) => void;
  onGenerateMagicLink: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

const AgentTableRow: React.FC<AgentTableRowProps> = ({
  agent,
  onViewDetails,
  onGenerateMagicLink,
  onEdit,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Unknown";
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase() || "??";

  const isActive = agent.isActive !== false;
  const supplierNames = agent.shippingLines?.map(sl => sl.name).join(", ") || null;

  return (
    <tr className="hover:bg-neutral-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-xs ${
              isActive ? "bg-blue-600" : "bg-neutral-400"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">
              {displayName}
            </p>
            <p className="text-xs text-neutral-500 truncate">{agent.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {supplierNames ? (
          <span className="text-sm text-neutral-700">{supplierNames}</span>
        ) : (
          <span className="text-sm text-neutral-400 italic">Not assigned</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isActive
              ? "bg-green-100 text-green-700"
              : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onGenerateMagicLink(agent)}
            className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 bg-white text-blue-600 hover:bg-blue-50 transition-colors"
            title="Generate Magic Link"
          >
            <Link2 size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#6b7280' }}
            >
              <MoreVertical size={16} />
            </button>

            <DropdownMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} width="w-44">
              <MenuItem
                onClick={() => { onViewDetails(agent); setMenuOpen(false); }}
                icon={<Eye size={14} />}
                label="View Details"
              />
              <MenuItem
                onClick={() => { onEdit(agent); setMenuOpen(false); }}
                icon={<Edit size={14} />}
                label="Edit"
              />
              <hr className="my-1 border-neutral-200" />
              <MenuItem
                onClick={() => { onDelete(agent); setMenuOpen(false); }}
                icon={<Trash2 size={14} />}
                label="Delete"
                danger
              />
            </DropdownMenu>
          </div>
        </div>
      </td>
    </tr>
  );
};

// =============================================================================
// MAGIC LINK MODAL COMPONENT
// =============================================================================

interface MagicLinkModalProps {
  agent: Agent;
  onClose: () => void;
}

const MagicLinkModal: React.FC<MagicLinkModalProps> = ({ agent, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [magicLink, setMagicLink] = useState<MagicLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Agent";

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const agentId = agent.id || agent._id;
      if (!agentId) throw new Error("Agent ID not found");
      
      const response = await AgentsService.generateMagicLink(agentId);
      
      let link = response.link || (response as any).url || (response as any).magicLink || "";
      const expiresAt = response.expiresAt || (response as any).expiresIn || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      if (!link) {
        throw new Error("No link received from server");
      }
      
      if (link.includes('localhost:3000')) {
        link = link.replace('localhost:3000', 'localhost:5173');
      }
      if (link.includes('/auth/magic-link')) {
        link = link.replace('/auth/magic-link', '/agent/auth');
      }
      
      setMagicLink({ link, expiresAt });
    } catch (err: any) {
      console.error("Failed to generate magic link:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to generate magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agent.id, agent._id]);

  useEffect(() => {
    generateLink();
  }, [generateLink]);

  const handleCopy = async () => {
    if (!magicLink) return;
    try {
      await navigator.clipboard.writeText(magicLink.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatExpiresAt = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Magic Link</h2>
              <p className="text-sm text-neutral-500">For {displayName}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
            style={{ backgroundColor: '#ffffff', color: '#6b7280' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-3" />
              <p className="text-sm text-neutral-500">Generating magic link...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
                <button type="button" onClick={generateLink} className="mt-2 text-sm font-medium text-red-700 hover:text-red-800">
                  Try again
                </button>
              </div>
            </div>
          )}

          {magicLink && !loading && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Magic link generated successfully!</p>
                  <p className="text-sm text-green-700 mt-0.5">Share this link with the agent to give them access.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Magic Link</label>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      readOnly
                      value={magicLink.link}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm bg-neutral-50 text-neutral-700 pr-10"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-md p-1.5 hover:bg-neutral-200 transition-colors"
                      style={{ background: 'none', backgroundColor: 'transparent' }}
                      title="Copy to clipboard"
                    >
                      {copied 
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Clock size={14} />
                <span>Expires: {formatExpiresAt(magicLink.expiresAt)}</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={handleCopy} 
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 transition-colors"
                  style={{ backgroundColor: '#ffffff', color: '#374151' }}
                >
                  {copied ? <><Check size={16} style={{ color: '#16a34a' }} />Copied!</> : <><Copy size={16} />Copy Link</>}
                </button>
                <a 
                  href={magicLink.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 transition-colors"
                  style={{ backgroundColor: '#ffffff', color: '#374151' }}
                >
                  <ExternalLink size={16} />Open
                </a>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={generateLink}
                  disabled={loading}
                  className="inline-flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                  style={{ background: 'none', backgroundColor: 'transparent', color: '#525252' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                  <span style={{ color: '#525252' }}>Generate new link</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// AGENT DETAILS MODAL COMPONENT
// =============================================================================

interface AgentDetailsModalProps {
  agent: Agent;
  onClose: () => void;
  onGenerateMagicLink: () => void;
  onEdit: () => void;
}

const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({
  agent,
  onClose,
  onGenerateMagicLink,
  onEdit,
}) => {
  const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || "Unknown";
  const initials = displayName.split(" ").map((n) => n.charAt(0)).join("").substring(0, 2).toUpperCase() || "??";
  const isActive = agent.isActive !== false;
  const supplierNames = agent.shippingLines?.map(sl => sl.name).join(", ") || null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Agent Details</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
            style={{ backgroundColor: '#ffffff', color: '#6b7280' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 mb-6">
            <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl ${isActive ? "bg-blue-600" : "bg-neutral-400"}`}>
              {initials}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-neutral-900">{displayName}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Email</p>
                <p className="text-sm text-neutral-900">{agent.email}</p>
              </div>
            </div>

            {agent.phone && (
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-500">Phone</p>
                  <p className="text-sm text-neutral-900">{agent.phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Ship size={18} className="text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Suppliers</p>
                <p className="text-sm text-neutral-900">{supplierNames || "Not assigned"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock size={18} className="text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Created</p>
                <p className="text-sm text-neutral-900">{formatDate(agent.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 flex items-center gap-2">
          <button 
            type="button" 
            onClick={onGenerateMagicLink} 
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 transition-colors"
            style={{ backgroundColor: '#ffffff', color: '#374151' }}
          >
            <Link2 size={16} />Generate Magic Link
          </button>
          <button 
            type="button" 
            onClick={onEdit} 
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 transition-colors"
            style={{ backgroundColor: '#ffffff', color: '#374151' }}
          >
            <Edit size={16} />Edit
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// CREATE/EDIT AGENT MODAL
// =============================================================================

interface CreateEditAgentModalProps {
  agent?: Agent | null;
  shippingLines: ShippingLine[];
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEditAgentModal: React.FC<CreateEditAgentModalProps> = ({
  agent,
  shippingLines,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(agent);

  const [firstName, setFirstName] = useState(agent?.firstName || "");
  const [lastName, setLastName] = useState(agent?.lastName || "");
  const [email, setEmail] = useState(agent?.email || "");
  const [phone, setPhone] = useState(agent?.phone || "");
  const [whatsapp, setWhatsapp] = useState(agent?.whatsapp || "");
  const [street, setStreet] = useState(agent?.address?.street || "");
  const [city, setCity] = useState(agent?.address?.city || "");
  const [country, setCountry] = useState(agent?.address?.country || "");
  const [state, setState] = useState(agent?.address?.state || "");
  const [zip, setZip] = useState(agent?.address?.zip || "");
  const [notes, setNotes] = useState(agent?.notes || "");
  
  // Support multiple suppliers - convert all IDs to strings
  const getInitialSupplierIds = (): string[] => {
    // Try shippingLineIds array first (new format)
    if (agent?.shippingLineIds?.length) {
      return agent.shippingLineIds.map(id => String(id)).filter(Boolean);
    }
    // Try populated shippingLines virtual
    if (agent?.shippingLines?.length) {
      return agent.shippingLines.map(sl => String(sl.id || sl._id || "")).filter(Boolean);
    }
    // Fallback to single shippingLineId (legacy)
    if (agent?.shippingLineId) {
      return [String(agent.shippingLineId)];
    }
    return [];
  };
  
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(getInitialSupplierIds());
  const [isActive, setIsActive] = useState(agent?.isActive !== false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!firstName.trim()) { setError("First name is required"); return; }
    if (!lastName.trim()) { setError("Last name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!phone.trim()) { setError("Phone is required"); return; }
    if (!street.trim() || !city.trim() || !country.trim()) {
      setError("Address (street, city, country) is required"); return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const agentId = agent?.id || agent?._id;
      
      // Build payload - explicitly set shippingLineId to null if none selected
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || undefined,
        address: {
          street: street.trim(),
          city: city.trim(),
          country: country.trim(),
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
        },
        notes: notes.trim() || undefined,
        isActive,
      };

      // Handle suppliers - send the selected IDs or null/empty to clear
      if (selectedSupplierIds.length > 0) {
        payload.shippingLineId = selectedSupplierIds[0];
        payload.shippingLineIds = selectedSupplierIds;
      } else {
        // Explicitly clear suppliers
        payload.shippingLineId = null;
        payload.shippingLineIds = [];
      }

      console.log('Saving agent with payload:', payload);
      
      if (isEdit && agentId) {
        await AgentsService.update(agentId, payload);
      } else {
        await AgentsService.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to save agent:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to save agent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div
      className="w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden"
      style={modalStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
        <h2 className="text-lg font-semibold text-neutral-900">
          {isEdit ? "Edit Agent" : "Create Agent"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
          style={{ backgroundColor: "#ffffff", color: "#6b7280" }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-5 overflow-y-auto bg-white max-h-[70vh]">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@example.com"
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              WhatsApp
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+1 234 567 8900"
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className={`${inputBase} resize-none`}
            />
          </div>

          <div className="md:col-span-3 border-t border-neutral-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Street <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="123 Main Street"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="USA"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="10001"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Suppliers
            </label>

            <div className="rounded-lg border border-neutral-300 bg-white max-h-40 overflow-y-auto">
              {shippingLines.length === 0 ? (
                <p className="px-3 py-2 text-sm text-neutral-500">
                  No suppliers available
                </p>
              ) : (
                shippingLines.map((sl) => {
                  const supplierId = String(sl.id || sl._id || "");
                  const isChecked = selectedSupplierIds.includes(supplierId);

                  return (
                    <label
                      key={supplierId}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer border-b border-neutral-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) setSelectedSupplierIds((prev) => [...prev, supplierId]);
                          else setSelectedSupplierIds((prev) => prev.filter((id) => id !== supplierId));
                        }}
                        className="h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white"
                      />
                      <span className="text-sm text-neutral-700">{sl.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            {selectedSupplierIds.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {selectedSupplierIds.length} supplier
                {selectedSupplierIds.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          <div className="md:col-span-3 flex items-center gap-3 pt-1">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white"
            />
            <label htmlFor="isActive" className="text-sm text-neutral-700 select-none">
              Active
            </label>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-neutral-200 flex items-center justify-end gap-2 bg-white shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#ffffff", color: "#374151" }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#ffffff", color: "#374151" }}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : (
            <span>{isEdit ? "Save Changes" : "Create Agent"}</span>
          )}
        </button>
      </div>
    </div>
  </div>
);

};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AgentsManagementPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState<Agent | null>(null);
  const [selectedAgentForMagicLink, setSelectedAgentForMagicLink] = useState<Agent | null>(null);
  const [selectedAgentForEdit, setSelectedAgentForEdit] = useState<Agent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [agentsResponse, shippingLinesData] = await Promise.all([
        AgentsService.findAll(),
        ShippingsService.findAll(),
      ]);
      setAgents(agentsResponse.items as Agent[]);
      setShippingLines(shippingLinesData as ShippingLine[]);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredAgents = useMemo(() => {
    return (agents as Agent[]).filter((agent) => {
      const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim();
      const supplierNames = agent.shippingLines?.map(sl => sl.name).join(" ") || "";
      const agentSupplierIds = agent.shippingLines?.map(sl => sl.id || sl._id) || [];

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        displayName.toLowerCase().includes(searchLower) ||
        agent.email?.toLowerCase().includes(searchLower) ||
        supplierNames.toLowerCase().includes(searchLower);

      const isActive = agent.isActive !== false;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      const matchesSupplier = !supplierFilter || agentSupplierIds.includes(supplierFilter);

      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [agents, searchQuery, statusFilter, supplierFilter]);

  const handleRefresh = useCallback(() => { loadData(); }, [loadData]);
  const handleViewDetails = useCallback((agent: Agent) => { setSelectedAgentForDetails(agent); }, []);
  const handleGenerateMagicLink = useCallback((agent: Agent) => { setSelectedAgentForMagicLink(agent); }, []);
  const handleEdit = useCallback((agent: Agent) => { setSelectedAgentForEdit(agent); }, []);
  
  const handleDelete = useCallback(async (agent: Agent) => {
    const displayName = agent.name || `${agent.firstName || ""} ${agent.lastName || ""}`.trim();
    const agentId = agent.id || agent._id;
    if (!agentId) return;
    
    if (window.confirm(`Are you sure you want to delete ${displayName}? This action cannot be undone.`)) {
      try {
        await AgentsService.removeAgents([agentId]);
        loadData();
      } catch (err: any) {
        console.error("Failed to delete agent:", err);
        alert(err?.response?.data?.message || err?.message || "Failed to delete agent.");
      }
    }
  }, [loadData]);

  const handleCreateAgent = useCallback(() => { setShowCreateModal(true); }, []);

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((a: any) => a.isActive !== false).length;
    return { total, active, inactive: total - active };
  }, [agents]);

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-neutral-50 text-neutral-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Agents</h1>
              <p className="text-sm text-neutral-500">Manage agents and generate access links</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={handleRefresh} 
              disabled={isLoading} 
              className="inline-flex items-center justify-center rounded-lg p-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#6b7280' }}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            {/* <button 
              type="button" 
              onClick={handleCreateAgent} 
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#374151' }}
            >
              <Plus size={16} /><span className="hidden sm:inline">Add Agent</span>
            </button> */}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-500">Total Agents</p>
            <p className="text-xl sm:text-2xl font-semibold text-neutral-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-500">Active</p>
            <p className="text-xl sm:text-2xl font-semibold text-green-600 mt-1">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-neutral-500">Inactive</p>
            <p className="text-xl sm:text-2xl font-semibold text-neutral-400 mt-1">{stats.inactive}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error loading agents</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
            <button type="button" onClick={loadData} className="text-sm font-medium text-red-700 hover:text-red-800">Retry</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputBase} pl-9`}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
              >
                <option value="">All Suppliers</option>
                {shippingLines.map((sl: any) => (
                  <option key={sl.id || sl._id} value={sl.id || sl._id}>{sl.name}</option>
                ))}
              </select>
              <div className="hidden sm:flex items-center border border-neutral-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-neutral-100 text-neutral-900" : "bg-white text-neutral-700 hover:bg-neutral-50"}`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-2 text-sm ${viewMode === "table" ? "bg-neutral-100 text-neutral-900" : "bg-white text-neutral-700 hover:bg-neutral-50"}`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-3" />
            <p className="text-sm text-neutral-500">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-3">
              <Users className="w-6 h-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 mb-1">No agents found</h3>
            <p className="text-sm text-neutral-500 mb-4">
              {searchQuery || statusFilter !== "all" || supplierFilter ? "Try adjusting your search or filters" : "Get started by adding your first agent"}
            </p>
            {!searchQuery && statusFilter === "all" && !supplierFilter && (
              <button 
                type="button" 
                onClick={handleCreateAgent} 
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition-colors"
                style={{ backgroundColor: '#ffffff', color: '#374151' }}
              >
                <Plus size={16} />Add Agent
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id || agent._id}
                agent={agent}
                onViewDetails={handleViewDetails}
                onGenerateMagicLink={handleGenerateMagicLink}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredAgents.map((agent) => (
                    <AgentTableRow
                      key={agent.id || agent._id}
                      agent={agent}
                      onViewDetails={handleViewDetails}
                      onGenerateMagicLink={handleGenerateMagicLink}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAgentForDetails && (
        <AgentDetailsModal
          agent={selectedAgentForDetails}
          onClose={() => setSelectedAgentForDetails(null)}
          onGenerateMagicLink={() => { setSelectedAgentForMagicLink(selectedAgentForDetails); setSelectedAgentForDetails(null); }}
          onEdit={() => { setSelectedAgentForEdit(selectedAgentForDetails); setSelectedAgentForDetails(null); }}
        />
      )}

      {selectedAgentForMagicLink && (
        <MagicLinkModal agent={selectedAgentForMagicLink} onClose={() => setSelectedAgentForMagicLink(null)} />
      )}

      {(showCreateModal || selectedAgentForEdit) && (
        <CreateEditAgentModal
          agent={selectedAgentForEdit}
          shippingLines={shippingLines as ShippingLine[]}
          onClose={() => { setShowCreateModal(false); setSelectedAgentForEdit(null); }}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}