import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Download,
  Send,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  ListPlus,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Ship,
  FileText,
  Percent,
  DollarSign,
  Lock,
} from "lucide-react";
import {
  OperatorPricingService,
  type OperatorPricelist,
  type QuoteSnapshotPayload,
} from "../services/operator-pricing.service";
import { ShippingsService } from "../services/shipping.service";
import { PortsService } from "../services/ports.service";
import { QuotationsService } from "../services/quotations.service";
import { QuotationStatusEnum } from "../utils/constants";
import { useAuthStore } from "../stores/auth.store";
import SearchablePortSelect from "../components/SearchablePortSelectWithCreate";
import { useClients } from "../hooks/useClient";
import type { Client as BackendClient } from "../utils/types/client.type";
import type { QuotationLegacyItemDto } from "../utils/types/quotation.type";
import type { Port } from "../utils/types/port.type";
import { buildQuotePdfFile } from "../services/quotationsPdf/quotePdf.service";
import { buildPricelistQuoteHTML } from "../services/quotationsPdf/pricelistQuoteHtml.service";

// =============================================================================
// TYPES
// =============================================================================

interface ItemProfit {
  type: "percentage" | "fixed";
  value: number;
}

const defaultProfits = (): Record<string, ItemProfit> => ({
  rateAllIn: { type: "percentage", value: 0 },
  oceanFreight: { type: "percentage", value: 0 },
  destinationCharges: { type: "percentage", value: 0 },
  originHandlingFees: { type: "percentage", value: 0 },
  docFee: { type: "percentage", value: 0 },
  inlandFreight: { type: "percentage", value: 0 },
});

interface PricelistRouteItem {
  id: string;
  label: string;       // original item name from agent
  chargeType: string;  // OCEAN_FREIGHT, DESTINATION_CHARGE, etc.
  equipmentType?: string; // 20GP, 40HC, etc.
  cost: number;
  profit: ItemProfit;
}

interface RouteData {
  id: string;
  pol: string;
  pod: string;
  /** Port IDs for dropdown selection */
  polPortId?: string;
  podPortId?: string;
  /** Auto-calculated: sum of all charge fields */
  rateAllIn: number;
  oceanFreight: number;
  destinationCharges: number;
  originHandlingFees: number;
  docFee: number;
  inlandFreight: number;
  /** Per-item profit margins */
  profits: Record<string, ItemProfit>;
  /** Original pricelist items — used instead of fixed fields when from pricelist */
  pricelistItems?: PricelistRouteItem[];
  isFromPricelist?: boolean;
}

const calcRateAllIn = (route: Pick<RouteData, "oceanFreight" | "destinationCharges" | "originHandlingFees" | "docFee" | "inlandFreight">): number =>
  route.oceanFreight + route.destinationCharges + route.originHandlingFees + route.docFee + route.inlandFreight;

interface ShippingLineData {
  id: string;
  name: string;
  description: string;
  freeDays: string;
  transitTime: string;
  routes: RouteData[];
  sourcePricelistId?: string;
  sourcePricelistName?: string;
  supplierName?: string;
  supplierId?: string;
  isFromPricelist?: boolean;
}

interface QuoteDetails {
  quoteNumber: string;
  date: string;
  validFrom: string;
  validUntil: string;
  origin: string;
  originPortId: string;
  destination: string;
  destinationPortId: string;
  incoterm: string;
  equipment: string;
  commodity: string;
  salesExecutive: string;
  clientId: string;
  clientName: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface PricelistWithSupplier extends OperatorPricelist {
  supplierName?: string;
  supplierId?: string;
}

const SERVICE_TYPE_SHIPPING_MODE: Record<string, "maritime" | "air" | "road" | null> = {
  FCL: "maritime",
  LCL: "maritime",
  AIR: "air",
  FTL: "road",
  LOCAL_TRUCKING: "road",
  CUSTOMS: null,
  INSURANCE: null,
  OTHER: null,
};

// =============================================================================
// STYLES
// =============================================================================

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  color: "#1F2937",
  border: "1px solid #D1D5DB",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
};

const READONLY_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: "#F3F4F6",
  color: "#6B7280",
  cursor: "not-allowed",
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateId = () => Math.random().toString(36).substring(2, 9);

const formatCurrency = (value: number): string =>
  `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const extractShippingLineName = (agentName: string): string => {
  const carriers = ["MSC", "OOCL", "HPL", "COSCO", "CMA", "EVERGREEN", "HAPAG", "MAERSK", "ONE", "YANG MING", "ZIM"];
  const upperName = agentName.toUpperCase();
  for (const carrier of carriers) {
    if (upperName.includes(carrier)) return carrier;
  }
  return agentName;
};

const formatDateInput = (date: Date): string => date.toISOString().split("T")[0];

const calcProfit = (base: number, profit: ItemProfit): number => {
  if (profit.type === "percentage") return (base * profit.value) / 100;
  return profit.value;
};

const calcWithProfit = (base: number, profit: ItemProfit): number => base + calcProfit(base, profit);

/** Total selling price = sum of each sub-item + its profit */
const calcTotalSellingPrice = (route: RouteData): number => {
  if (route.pricelistItems?.length) {
    return route.pricelistItems.reduce((sum, item) => sum + calcWithProfit(item.cost, item.profit), 0);
  }
  const keys = ["oceanFreight", "destinationCharges", "originHandlingFees", "docFee", "inlandFreight"] as const;
  let total = 0;
  for (const key of keys) {
    const base = route[key] as number;
    const profit = route.profits[key] || { type: "percentage" as const, value: 0 };
    total += calcWithProfit(base, profit);
  }
  return total;
};

/** Total profit amount */
const calcTotalProfitAmount = (route: RouteData): number => {
  if (route.pricelistItems?.length) {
    return route.pricelistItems.reduce((sum, item) => sum + calcProfit(item.cost, item.profit), 0);
  }
  const keys = ["oceanFreight", "destinationCharges", "originHandlingFees", "docFee", "inlandFreight"] as const;
  let total = 0;
  for (const key of keys) {
    const base = route[key] as number;
    const profit = route.profits[key] || { type: "percentage" as const, value: 0 };
    total += calcProfit(base, profit);
  }
  return total;
};

const getOptionLabel = (index: number): string => {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

// =============================================================================
// INLINE PROFIT CELL — reusable for each table cell
// =============================================================================

interface ProfitCellProps {
  profit: ItemProfit;
  baseValue: number;
  onChange: (updated: ItemProfit) => void;
}

const ProfitCell: React.FC<ProfitCellProps> = ({ profit, baseValue, onChange }) => {
  const profitAmount = calcProfit(baseValue, profit);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...profit, type: profit.type === "percentage" ? "fixed" : "percentage" })}
          className="p-0.5 rounded transition-colors text-xs font-medium flex-shrink-0"
          style={{
            backgroundColor: profit.type === "percentage" ? "#DBEAFE" : "#FEF3C7",
            color: profit.type === "percentage" ? "#2563EB" : "#92400E",
          }}
          title={`Switch to ${profit.type === "percentage" ? "fixed USD" : "percentage"}`}
        >
          {profit.type === "percentage" ? <Percent size={11} /> : <DollarSign size={11} />}
        </button>
        <div className="relative inline-block">
          <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-green-600 text-xs">
            {profit.type === "percentage" ? "%" : "$"}
          </span>
          <input
            type="number"
            value={profit.value}
            onChange={(e) => onChange({ ...profit, value: Number(e.target.value) || 0 })}
            className="w-16 pl-4 pr-1 py-1 rounded border text-xs text-center text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#BBF7D0" }}
            placeholder="0"
          />
        </div>
      </div>
      {profitAmount > 0 && (
        <span className="text-[10px] text-green-600 font-medium">
          +${profitAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
};

// =============================================================================
// ADD PRICELIST MODAL
// =============================================================================

interface AddPricelistModalProps {
  visible: boolean;
  onClose: () => void;
  onAddPricelists: (pricelists: PricelistWithSupplier[]) => void;
  existingPricelistIds: string[];
}

const AddPricelistModal: React.FC<AddPricelistModalProps> = ({
  visible,
  onClose,
  onAddPricelists,
  existingPricelistIds,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPricelists, setAllPricelists] = useState<PricelistWithSupplier[]>([]);
  const [selectedPricelists, setSelectedPricelists] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);

  useEffect(() => { if (visible) loadAllPricelists(); }, [visible]);

  const loadAllPricelists = async () => {
    setLoading(true);
    setError(null);
    try {
      const suppliers = await ShippingsService.findAll();
      const allData: PricelistWithSupplier[] = [];
      for (const supplier of suppliers) {
        try {
          const response = await OperatorPricingService.getSupplierPricelists(supplier._id, { status: "approved" });
          const enriched: PricelistWithSupplier[] = response.pricelists.map((p) => ({ ...p, supplierName: supplier.name, supplierId: supplier._id }));
          allData.push(...enriched);
        } catch (err) { console.error(`Failed to load pricelists for ${supplier.name}:`, err); }
      }
      setAllPricelists(allData);
      setExpandedAgents([...new Set(allData.map((p) => p.agent.id))]);
    } catch (err) { setError("Error loading pricelists. Please try again."); console.error(err); } finally { setLoading(false); }
  };

  const pricelistsByAgent = useMemo(() => {
    const grouped: Record<string, { agent: OperatorPricelist["agent"]; supplierName?: string; pricelists: PricelistWithSupplier[] }> = {};
    allPricelists.forEach((pricelist) => {
      if (!grouped[pricelist.agent.id]) grouped[pricelist.agent.id] = { agent: pricelist.agent, supplierName: pricelist.supplierName, pricelists: [] };
      grouped[pricelist.agent.id].pricelists.push(pricelist);
    });
    return grouped;
  }, [allPricelists]);

  const filteredAgents = useMemo(() => {
    if (!searchTerm) return pricelistsByAgent;
    const filtered: typeof pricelistsByAgent = {};
    const term = searchTerm.toLowerCase();
    Object.entries(pricelistsByAgent).forEach(([agentId, data]) => {
      const matchingPricelists = data.pricelists.filter((p) =>
        p.agent.name.toLowerCase().includes(term) || (p.supplierName && p.supplierName.toLowerCase().includes(term)) || p.items.some((item) => item.name.toLowerCase().includes(term))
      );
      if (matchingPricelists.length > 0) filtered[agentId] = { agent: data.agent, supplierName: data.supplierName, pricelists: matchingPricelists };
    });
    return filtered;
  }, [pricelistsByAgent, searchTerm]);

  const toggleAgent = (agentId: string) => setExpandedAgents((prev) => (prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]));
  const togglePricelist = (pricelistId: string) => setSelectedPricelists((prev) => (prev.includes(pricelistId) ? prev.filter((id) => id !== pricelistId) : [...prev, pricelistId]));
  const handleAddSelected = () => { onAddPricelists(allPricelists.filter((p) => selectedPricelists.includes(p.pricelistId))); setSelectedPricelists([]); onClose(); };
  const isAlreadyAdded = (pricelistId: string) => existingPricelistIds.includes(pricelistId);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2"><ListPlus className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold text-neutral-900">Add Existing Pricelists</h2></div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors" style={{ backgroundColor: "#FFFFFF", border: "1px solid #D1D5DB" }}><X size={20} className="text-neutral-600" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by supplier, agent or route..." className="w-full pl-10 pr-4 py-2 rounded-lg text-sm placeholder-neutral-400 focus:ring-2 focus:ring-blue-500" style={{ ...INPUT_STYLE, paddingLeft: "2.5rem" }} />
          </div>
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-neutral-400" /></div>}
          {error && <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p><button type="button" onClick={loadAllPricelists} className="ml-auto text-sm font-medium text-red-700 hover:underline">Retry</button></div>}
          {!loading && !error && Object.keys(filteredAgents).length === 0 && <div className="text-center py-8"><FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" /><p className="text-neutral-500">No approved pricelists available.</p></div>}
          <div className="space-y-2">
            {Object.entries(filteredAgents).map(([agentId, { agent, supplierName, pricelists }]) => (
              <div key={agentId} className="border border-neutral-200 rounded-lg overflow-hidden">
                <button type="button" className="w-full flex items-center justify-between p-3 hover:bg-neutral-100 transition-colors" style={{ backgroundColor: "#F9FAFB" }} onClick={() => toggleAgent(agentId)}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">{extractShippingLineName(agent.name)}</span>
                    {supplierName && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{supplierName}</span>}
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{pricelists.length} pricelist(s)</span>
                  </div>
                  {expandedAgents.includes(agentId) ? <ChevronUp className="w-5 h-5 text-neutral-500" /> : <ChevronDown className="w-5 h-5 text-neutral-500" />}
                </button>
                {expandedAgents.includes(agentId) && (
                  <div className="border-t border-neutral-200">
                    {pricelists.map((pricelist) => {
                      const alreadyAdded = isAlreadyAdded(pricelist.pricelistId);
                      const isSelected = selectedPricelists.includes(pricelist.pricelistId);
                      return (
                        <div key={pricelist.pricelistId} className={`flex items-start gap-3 p-3 border-b border-neutral-100 last:border-b-0 ${alreadyAdded ? "opacity-60" : "hover:bg-neutral-50"}`} style={{ backgroundColor: alreadyAdded ? "#F9FAFB" : "#FFFFFF" }}>
                          <input type="checkbox" checked={isSelected || alreadyAdded} onChange={() => togglePricelist(pricelist.pricelistId)} disabled={alreadyAdded} className="mt-1 h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-neutral-900">Week: {new Date(pricelist.weekStart).toLocaleDateString("en-US")}{pricelist.weekEnd && ` - ${new Date(pricelist.weekEnd).toLocaleDateString("en-US")}`}</span>
                              {pricelist.supplierName && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">{pricelist.supplierName}</span>}
                              {alreadyAdded && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"><Check className="w-3 h-3" /> Already added</span>}
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5">{pricelist.itemCount} items • Total: {formatCurrency(pricelist.totalCost)}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pricelist.items.slice(0, 3).map((item) => (<span key={item.id} className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded">{item.name}</span>))}
                              {pricelist.items.length > 3 && <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 text-xs rounded">+{pricelist.items.length - 3} more</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}>Cancel</button>
          <button type="button" onClick={handleAddSelected} disabled={selectedPricelists.length === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}><Plus size={16} />Add {selectedPricelists.length > 0 && `(${selectedPricelists.length})`}</button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// CLIENT SELECTOR MODAL
// =============================================================================

interface ClientSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectClients: (clients: Client[], sendToAll: boolean) => void;
}

const ClientSelectorModal: React.FC<ClientSelectorModalProps> = ({ visible, onClose, onSelectClients }) => {
  const { clients: backendClients, isLoading: loading } = useClients();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendToAll, setSendToAll] = useState(false);

  const clients: Client[] = useMemo(() => backendClients.map((c: BackendClient) => ({ id: c.id || "", name: c.name, email: c.email || "", company: c.contactPerson || c.officeName || "" })), [backendClients]);
  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()) || c.company?.toLowerCase().includes(searchTerm.toLowerCase()));
  const toggleClient = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const handleSend = () => { onSelectClients(clients.filter((c) => selectedIds.includes(c.id)), sendToAll); onClose(); };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl shadow-xl max-w-md w-full" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Select Clients</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors" style={{ backgroundColor: "#FFFFFF", border: "1px solid #D1D5DB" }}><X size={20} className="text-neutral-600" /></button>
        </div>
        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search client..." className="w-full pl-10 pr-4 py-2 rounded-lg text-sm placeholder-neutral-400 focus:ring-2 focus:ring-blue-500" style={{ ...INPUT_STYLE, paddingLeft: "2.5rem" }} />
          </div>
          <label className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-200 cursor-pointer">
            <input type="checkbox" checked={sendToAll} onChange={(e) => { setSendToAll(e.target.checked); if (e.target.checked) setSelectedIds(clients.map((c) => c.id)); }} className="h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed" />
            <span className="text-sm text-neutral-700">Send to all clients</span>
          </label>
          {loading ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div> : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {filteredClients.map((client) => (
                <label key={client.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(client.id)} onChange={() => toggleClient(client.id)} className="h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed" />
                  <div><p className="text-sm font-medium text-neutral-900">{client.name}</p><p className="text-xs text-neutral-500">{client.company && `${client.company} • `}{client.email}</p></div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}>Cancel</button>
          <button type="button" onClick={handleSend} disabled={selectedIds.length === 0 && !sendToAll} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}><Send size={16} />Send ({sendToAll ? "All" : selectedIds.length})</button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ROUTE EDIT MODAL
// =============================================================================

interface RouteEditModalProps {
  visible: boolean;
  route: RouteData | null;
  onClose: () => void;
  onSave: (route: RouteData) => void;
  isFromPricelist?: boolean;
  ports: Port[];
  portsLoading: boolean;
  originCountry: string;
  destinationCountry: string;
  onPortCreated: (port: Port) => void;
}

const RouteEditModal: React.FC<RouteEditModalProps> = ({ visible, route, onClose, onSave, isFromPricelist, ports, portsLoading, originCountry, destinationCountry, onPortCreated }) => {
  const [editedRoute, setEditedRoute] = useState<RouteData | null>(null);
  useEffect(() => { if (route) setEditedRoute({ ...route, profits: { ...route.profits } }); }, [route]);
  if (!visible || !editedRoute) return null;

  const handleCostChange = (field: keyof RouteData, value: number) => {
    setEditedRoute((prev) => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      updated.rateAllIn = calcRateAllIn(updated);
      return updated;
    });
  };
  const handleProfitChange = (key: string, profit: ItemProfit) => setEditedRoute((prev) => prev ? { ...prev, profits: { ...prev.profits, [key]: profit } } : null);
  const handlePricelistItemProfitChange = (itemId: string, profit: ItemProfit) =>
    setEditedRoute((prev) => prev ? { ...prev, pricelistItems: prev.pricelistItems?.map((item) => item.id === itemId ? { ...item, profit } : item) } : null);
  const handlePricelistItemCostChange = (itemId: string, cost: number) =>
    setEditedRoute((prev) => prev ? { ...prev, pricelistItems: prev.pricelistItems?.map((item) => item.id === itemId ? { ...item, cost } : item) } : null);

  const handlePortSelect = (field: "polPortId" | "podPortId", portId: string) => {
    const port = ports.find((p: any) => (p._id || p.id) === portId);
    const portName = port ? getPortLabel(port) : "";
    setEditedRoute((prev) => {
      if (!prev) return null;
      if (field === "polPortId") return { ...prev, polPortId: portId, pol: portName };
      return { ...prev, podPortId: portId, pod: portName };
    });
  };

  const handleSave = () => {
    if (editedRoute) {
      onSave({ ...editedRoute, rateAllIn: calcRateAllIn(editedRoute) });
      onClose();
    }
  };

  const readOnlyPrices = isFromPricelist && editedRoute.isFromPricelist;

  const costFields = [
    { key: "oceanFreight", label: "Ocean Freight" },
    { key: "destinationCharges", label: "Destination Charges" },
    { key: "originHandlingFees", label: "Origin Handling" },
    { key: "docFee", label: "Doc Fee" },
    { key: "inlandFreight", label: "Inland Freight" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl shadow-xl max-w-lg w-full" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Edit Route</h2>
            {readOnlyPrices && <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><Lock size={10} /> Prices from pricelist are read-only</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors" style={{ backgroundColor: "#FFFFFF", border: "1px solid #D1D5DB" }}><X size={20} className="text-neutral-600" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Port fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <SearchablePortSelect
                value={editedRoute.polPortId || ""}
                onChange={(id) => handlePortSelect("polPortId", id)}
                ports={ports}
                loading={portsLoading}
                disabled={false}
                placeholder={originCountry ? `Search port in ${originCountry}...` : "Search port of origin..."}
                label="Port of Origin (POL)"
                onPortCreated={onPortCreated}
              />
              {originCountry && !editedRoute.polPortId && (
                <p className="mt-1 text-xs text-blue-600">
                  💡 Should be a port in: <strong>{originCountry}</strong>
                </p>
              )}
            </div>
            <div>
              <SearchablePortSelect
                value={editedRoute.podPortId || ""}
                onChange={(id) => handlePortSelect("podPortId", id)}
                ports={ports}
                loading={portsLoading}
                disabled={false}
                placeholder={destinationCountry ? `Search port in ${destinationCountry}...` : "Search port of landing..."}
                label="Port of Landing (POD)"
                onPortCreated={onPortCreated}
              />
              {destinationCountry && !editedRoute.podPortId && (
                <p className="mt-1 text-xs text-blue-600">
                  💡 Should be a port in: <strong>{destinationCountry}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-neutral-200 pt-4">
            <h4 className="text-sm font-medium text-neutral-600 mb-3">Cost & Profit per Item</h4>
            <div className="space-y-3">
              {editedRoute.pricelistItems?.length ? (
                editedRoute.pricelistItems.map((item) => {
                  const profit = item.profit || { type: "percentage" as const, value: 0 };
                  const base = item.cost ?? 0;
                  return (
                    <div key={item.id} className="grid grid-cols-3 gap-3 items-center">
                      <label className="text-sm font-medium text-neutral-700">
                        {item.label}
                        {editedRoute.isFromPricelist && <Lock size={10} className="inline ml-1 text-amber-500" />}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 text-sm">$</span>
                        <input
                          type="number"
                          value={base}
                          readOnly={!!editedRoute.isFromPricelist}
                          onChange={editedRoute.isFromPricelist ? undefined : (e) => handlePricelistItemCostChange(item.id, Number(e.target.value) || 0)}
                          style={{ ...(editedRoute.isFromPricelist ? READONLY_INPUT_STYLE : INPUT_STYLE), paddingLeft: "1.75rem" }}
                        />
                      </div>
                      <ProfitCell profit={profit} baseValue={base} onChange={(p) => handlePricelistItemProfitChange(item.id, p)} />
                    </div>
                  );
                })
              ) : (
                costFields.map(({ key, label }) => {
                  const profit = editedRoute.profits[key] || { type: "percentage" as const, value: 0 };
                  const base = editedRoute[key as keyof RouteData] as number;
                  return (
                    <div key={key} className="grid grid-cols-3 gap-3 items-center">
                      <label className="text-sm font-medium text-neutral-700">{label} {readOnlyPrices && <Lock size={10} className="inline text-amber-500" />}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 text-sm">$</span>
                        <input type="number" value={base} onChange={(e) => handleCostChange(key as keyof RouteData, Number(e.target.value) || 0)} readOnly={!!readOnlyPrices} style={{ ...(readOnlyPrices ? READONLY_INPUT_STYLE : INPUT_STYLE), paddingLeft: "1.75rem" }} />
                      </div>
                      <ProfitCell profit={profit} baseValue={base} onChange={(p) => handleProfitChange(key, p)} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Rate All In (base):</span>
              <span className="font-medium">{formatCurrency(calcRateAllIn(editedRoute))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Total Profit:</span>
              <span className="font-medium text-green-700">+{formatCurrency(calcTotalProfitAmount(editedRoute))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-green-200">
              <span className="text-neutral-700">Selling Price:</span>
              <span className="text-green-700">{formatCurrency(calcTotalSellingPrice(editedRoute))}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}>Cancel</button>
          <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}><Check size={16} />Save</button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SHIPPING LINE CARD — ORIGINAL VERTICAL LAYOUT
// Routes = columns, Items = rows, with PROFIT sub-column per route
// =============================================================================

interface ShippingLineCardProps {
  shippingLine: ShippingLineData;
  optionLabel: string;
  onUpdate: (updated: ShippingLineData) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  ports: Port[];
  portsLoading: boolean;
  originCountry: string;
  originPortId: string;
  destinationCountry: string;
  destinationPortId: string;
  onPortCreated: (port: Port) => void;
}

const ShippingLineCard: React.FC<ShippingLineCardProps> = ({ shippingLine, optionLabel, onUpdate, onDelete, onDuplicate, ports, portsLoading, originCountry, originPortId, destinationCountry, destinationPortId, onPortCreated }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [editingRoute, setEditingRoute] = useState<RouteData | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerValues, setHeaderValues] = useState({ name: shippingLine.name, description: shippingLine.description, freeDays: shippingLine.freeDays, transitTime: shippingLine.transitTime });

  const isFromPricelist = !!shippingLine.isFromPricelist;

  useEffect(() => { setHeaderValues({ name: shippingLine.name, description: shippingLine.description, freeDays: shippingLine.freeDays, transitTime: shippingLine.transitTime }); }, [shippingLine]);

  const handleRouteChange = (routeId: string, field: keyof RouteData, value: number) => {
    const updatedRoutes = shippingLine.routes.map((r) => {
      if (r.id !== routeId) return r;
      const updated = { ...r, [field]: value };
      updated.rateAllIn = calcRateAllIn(updated);
      return updated;
    });
    onUpdate({ ...shippingLine, routes: updatedRoutes });
  };

  const handleRouteProfitChange = (routeId: string, itemKey: string, profit: ItemProfit) => {
    const updatedRoutes = shippingLine.routes.map((r) => {
      if (r.id !== routeId) return r;
      return { ...r, profits: { ...r.profits, [itemKey]: profit } };
    });
    onUpdate({ ...shippingLine, routes: updatedRoutes });
  };

  const handlePricelistItemProfitChange = (routeId: string, itemId: string, profit: ItemProfit) => {
    const updatedRoutes = shippingLine.routes.map((r) => {
      if (r.id !== routeId) return r;
      return { ...r, pricelistItems: r.pricelistItems?.map((item) => item.id === itemId ? { ...item, profit } : item) };
    });
    onUpdate({ ...shippingLine, routes: updatedRoutes });
  };

  const handlePricelistItemCostChange = (routeId: string, itemId: string, cost: number) => {
    const updatedRoutes = shippingLine.routes.map((r) => {
      if (r.id !== routeId) return r;
      return { ...r, pricelistItems: r.pricelistItems?.map((item) => item.id === itemId ? { ...item, cost } : item) };
    });
    onUpdate({ ...shippingLine, routes: updatedRoutes });
  };

  const handleAddRoute = () => {
    const polPort = originPortId ? ports.find((p) => p._id === originPortId) : null;
    const podPort = destinationPortId ? ports.find((p) => p._id === destinationPortId) : null;
    // For pricelist cards, inherit item structure from first pricelist route but with editable costs
    const templateRoute = shippingLine.routes.find((r) => r.pricelistItems?.length);
    const inheritedItems = templateRoute?.pricelistItems?.map((item) => ({
      ...item,
      id: generateId(),
      cost: 0,
      profit: { type: "percentage" as const, value: 0 },
    }));
    const newRoute: RouteData = {
      id: generateId(),
      pol: polPort ? getPortLabel(polPort) : "",
      pod: podPort ? getPortLabel(podPort) : "",
      polPortId: originPortId || undefined,
      podPortId: destinationPortId || undefined,
      rateAllIn: 0, oceanFreight: 0, destinationCharges: 0, originHandlingFees: 0, docFee: 0, inlandFreight: 0,
      profits: defaultProfits(),
      pricelistItems: inheritedItems,
      isFromPricelist: false,
    };
    onUpdate({ ...shippingLine, routes: [...shippingLine.routes, newRoute] });
  };

  const handleDeleteRoute = (routeId: string) => onUpdate({ ...shippingLine, routes: shippingLine.routes.filter((r) => r.id !== routeId) });
  const handleHeaderSave = () => { onUpdate({ ...shippingLine, ...headerValues }); setEditingHeader(false); };

  const allCostRows = [
    { key: "oceanFreight", label: "Ocean Freight" },
    { key: "destinationCharges", label: "Destination Charges" },
    { key: "originHandlingFees", label: "Origin Handling Fees" },
    { key: "docFee", label: "Doc Fee per BL" },
    { key: "inlandFreight", label: "Inland Freight" },
  ];
  // For pricelist-based lines, only show rows that have a value in at least one route
  const costRows = isFromPricelist
    ? allCostRows.filter(({ key }) => shippingLine.routes.some((r) => (r[key as keyof RouteData] as number) > 0))
    : allCostRows;

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden mb-4 shadow-sm" style={{ backgroundColor: "#FFFFFF" }}>
      {/* HEADER */}
      <div className="px-4 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: "#1E3A5F", color: "#FFFFFF" }}>
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          {editingHeader ? (
            <div className="flex gap-2 flex-1 items-center flex-wrap">
              <span className="px-2 py-0.5 text-xs font-bold rounded" style={{ backgroundColor: "#FBBF24", color: "#1E3A5F" }}>Option {optionLabel}</span>
              <input type="text" value={headerValues.name} onChange={(e) => setHeaderValues({ ...headerValues, name: e.target.value })} placeholder="Name" className="w-28 px-2 py-1 rounded text-sm" style={{ backgroundColor: "#FFFFFF", color: "#1F2937", border: "none" }} />
              <input type="text" value={headerValues.description} onChange={(e) => setHeaderValues({ ...headerValues, description: e.target.value })} placeholder="Description" className="flex-1 min-w-32 px-2 py-1 rounded text-sm" style={{ backgroundColor: "#FFFFFF", color: "#1F2937", border: "none" }} />
              <input type="text" value={headerValues.freeDays} onChange={(e) => setHeaderValues({ ...headerValues, freeDays: e.target.value })} placeholder="Free Days" className="w-24 px-2 py-1 rounded text-sm" style={{ backgroundColor: "#FFFFFF", color: "#1F2937", border: "none" }} />
              <input type="text" value={headerValues.transitTime} onChange={(e) => setHeaderValues({ ...headerValues, transitTime: e.target.value })} placeholder="Transit" className="w-24 px-2 py-1 rounded text-sm" style={{ backgroundColor: "#FFFFFF", color: "#1F2937", border: "none" }} />
              <button type="button" onClick={handleHeaderSave} className="p-1.5 rounded transition-colors" style={{ backgroundColor: "#22C55E", color: "#FFFFFF" }}><Check size={14} /></button>
            </div>
          ) : (
            <>
              <span className="px-2 py-0.5 text-xs font-bold rounded" style={{ backgroundColor: "#FBBF24", color: "#1E3A5F" }}>Option {optionLabel}</span>
              <Ship className="w-5 h-5 flex-shrink-0" />
              {shippingLine.supplierName ? (
                <>
                  <span className="font-semibold text-lg">{shippingLine.supplierName}</span>
                  <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>{shippingLine.name}</span>
                </>
              ) : (
                <span className="font-semibold text-lg">{shippingLine.name}</span>
              )}
              <span style={{ opacity: 0.8 }} className="text-sm">{shippingLine.description}</span>
              {shippingLine.freeDays && <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "#FFFFFF", color: "#1F2937" }}>Free Days: {shippingLine.freeDays}</span>}
              {shippingLine.transitTime && <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: "#FFFFFF", color: "#1F2937" }}>Transit: {shippingLine.transitTime}</span>}
              {isFromPricelist && <span className="px-2 py-0.5 text-xs rounded flex items-center gap-1" style={{ backgroundColor: "rgba(251,191,36,0.2)", color: "#FDE68A" }}><Lock size={10} /> Pricelist</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {shippingLine.sourcePricelistId && (
            <button
              type="button"
              onClick={() => navigate(`/pricing/quotations-sent?pricelistId=${shippingLine.sourcePricelistId}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-white/20"
              style={{ color: "#FDE68A", border: "1px solid rgba(253,230,138,0.4)" }}
              title="Quotations Sent"
            >
              <FileText size={13} />
              Quotations Sent
            </button>
          )}
          <button type="button" onClick={() => setEditingHeader(!editingHeader)} className="p-2 rounded transition-colors hover:bg-white/10" title="Edit header"><Edit size={16} color="#FFFFFF" /></button>
          <button type="button" onClick={onDuplicate} className="p-2 rounded transition-colors hover:bg-white/10" title="Duplicate"><Copy size={16} color="#FFFFFF" /></button>
          <button type="button" onClick={onDelete} className="p-2 rounded transition-colors hover:bg-white/10" title="Delete"><Trash2 size={16} color="#FFFFFF" /></button>
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-2 rounded transition-colors hover:bg-white/10">{expanded ? <ChevronUp size={16} color="#FFFFFF" /> : <ChevronDown size={16} color="#FFFFFF" />}</button>
        </div>
      </div>

      {/* TABLE — routes as COLUMNS, items as ROWS, with profit sub-column */}
      {expanded && (
        <div className="overflow-x-auto" style={{ backgroundColor: "#FFFFFF" }}>
          <table className="w-full text-sm">
            <thead>
              {/* Row 1: DESCRIPTION + route headers (spanning 2 cols each) */}
              <tr style={{ backgroundColor: "#F3F4F6" }} className="border-b border-neutral-200">
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 w-40" rowSpan={2}>
                  DESCRIPTION
                </th>
                {shippingLine.routes.map((route) => (
                  <th key={route.id} colSpan={2} className="px-2 py-2 text-center border-l border-neutral-300" style={{ minWidth: "240px" }}>
                    <div className="flex items-center justify-center gap-1">
                      <div className="text-left">
                        <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Port of Origin</div>
                        <div className="font-semibold text-neutral-900 text-sm">{route.pol || <span className="text-neutral-400 italic">—</span>}</div>
                        <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mt-1">Port of Landing</div>
                        <div className="text-sm text-neutral-600">{route.pod || <span className="text-neutral-400 italic">—</span>}</div>
                      </div>
                      <div className="flex flex-col gap-0.5 ml-1">
                        <button type="button" onClick={() => setEditingRoute(route)} className="p-1 rounded transition-colors hover:bg-neutral-200" style={{ backgroundColor: "#FFFFFF" }} title="Edit route"><Edit size={12} className="text-neutral-500" /></button>
                        <button type="button" onClick={() => handleDeleteRoute(route.id)} className="p-1 rounded transition-colors hover:bg-red-100" style={{ backgroundColor: "#FFFFFF" }} title="Delete route"><Trash2 size={12} className="text-red-500" /></button>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="w-12 px-3 py-3" rowSpan={2}>
                  <button type="button" onClick={handleAddRoute} className="p-1.5 rounded transition-colors hover:bg-blue-200" style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }} title="Add route"><Plus size={14} /></button>
                </th>
              </tr>
              {/* Row 2: sub-headers VALOR | PROFIT per route */}
              <tr style={{ backgroundColor: "#F9FAFB" }} className="border-b border-neutral-200">
                {shippingLine.routes.map((route) => (
                  <React.Fragment key={`sub-${route.id}`}>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-neutral-500 border-l border-neutral-300" style={{ minWidth: "110px" }}>
                      VALOR
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium border-l border-neutral-100" style={{ minWidth: "110px", backgroundColor: "#F0FDF4", color: "#15803D" }}>
                      PROFIT
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* RATE ALL IN — auto-calculated, read-only */}
              <tr style={{ backgroundColor: "#FEF9C3" }} className="border-b border-neutral-200">
                <td className="px-4 py-2 font-bold" style={{ color: "#92400E" }}>
                  RATE ALL IN
                  <div className="text-[10px] font-normal text-amber-600">auto-calculated</div>
                </td>
                {shippingLine.routes.map((route) => (
                  <React.Fragment key={route.id}>
                    <td colSpan={2} className="px-2 py-2 text-center border-l border-neutral-300" style={{ backgroundColor: "#FEF9C3" }}>
                      <span className="font-bold text-sm" style={{ color: "#92400E" }}>
                        USD {calcRateAllIn(route).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </React.Fragment>
                ))}
                <td />
              </tr>

              {/* SELLING PRICE */}
              <tr style={{ backgroundColor: "#DCFCE7" }} className="border-b border-neutral-200">
                <td className="px-4 py-2 font-bold text-green-800">
                  SELLING PRICE
                  <div className="text-[10px] font-normal text-green-600">with profit</div>
                </td>
                {shippingLine.routes.map((route) => {
                  const sellingPrice = calcTotalSellingPrice(route);
                  const totalProfit = calcTotalProfitAmount(route);
                  return (
                    <React.Fragment key={route.id}>
                      <td colSpan={2} className="px-2 py-2 text-center border-l border-neutral-300" style={{ backgroundColor: "#DCFCE7" }}>
                        <span className="font-bold text-green-800 text-sm">
                          USD {sellingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {totalProfit > 0 && (
                          <div className="text-xs text-green-600">
                            +${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} profit
                          </div>
                        )}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td />
              </tr>

              {/* COST BREAKDOWN ROWS — pricelist items OR fixed charge fields */}
              {isFromPricelist && shippingLine.routes.some((r) => r.pricelistItems?.length) ? (() => {
                // Collect rows from the first route that has items (preserving all items by id)
                const firstRoute = shippingLine.routes.find((r) => r.pricelistItems?.length);
                const pricelistRows: { id: string; chargeType: string; label: string }[] =
                  firstRoute?.pricelistItems?.map((i) => ({ id: i.id, chargeType: i.chargeType, label: i.label })) ?? [];
                const CHARGE_LABELS: Record<string, string> = {
                  OCEAN_FREIGHT: "Ocean Freight",
                  DESTINATION_CHARGE: "Destination Charge",
                  DOC_FEE: "Doc Fee",
                  LOCAL_CHARGES: "Local Charges",
                  INLAND_FREIGHT: "Inland Freight",
                  OTHER: "Other",
                };
                return pricelistRows.map(({ id, chargeType, label }, idx) => (
                  <tr key={id} style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }} className="border-b border-neutral-100">
                    <td className="px-4 py-2 text-neutral-700">
                      <div className="font-medium text-sm">{label}</div>
                      <div className="mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>
                          {CHARGE_LABELS[chargeType] ?? chargeType}
                        </span>
                        <Lock size={10} className="inline ml-1 text-neutral-400" />
                      </div>
                    </td>
                    {shippingLine.routes.map((route) => {
                      const item = route.pricelistItems?.find((i) => i.id === id) ?? route.pricelistItems?.find((i) => i.chargeType === chargeType && i.label === label);
                      if (!item) {
                        return (
                          <React.Fragment key={route.id}>
                            <td className="px-2 py-2 text-center border-l border-neutral-300 text-neutral-400">—</td>
                            <td className="px-2 py-2 text-center border-l border-neutral-100" style={{ backgroundColor: idx % 2 === 0 ? "#FAFFF5" : "#F5FFF0" }} />
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={route.id}>
                          <td className="px-2 py-2 text-center border-l border-neutral-300">
                            <div className="relative inline-block">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-400 text-sm">$</span>
                              <input
                                type="number"
                                value={item.cost}
                                readOnly={!!route.isFromPricelist}
                                onChange={route.isFromPricelist ? undefined : (e) => handlePricelistItemCostChange(route.id, item.id, Number(e.target.value) || 0)}
                                className="w-24 pl-5 pr-2 py-1.5 rounded border border-neutral-200 text-sm text-center text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ backgroundColor: route.isFromPricelist ? "#F3F4F6" : "#FFFFFF", cursor: route.isFromPricelist ? "not-allowed" : "text" }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center border-l border-neutral-100" style={{ backgroundColor: idx % 2 === 0 ? "#FAFFF5" : "#F5FFF0" }}>
                            <ProfitCell
                              profit={item.profit}
                              baseValue={item.cost}
                              onChange={(p) => handlePricelistItemProfitChange(route.id, item.id, p)}
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td />
                  </tr>
                ));
              })() : costRows.map(({ key, label }, idx) => (
                <tr key={key} style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }} className="border-b border-neutral-100">
                  <td className="px-4 py-2 text-neutral-700">
                    {label}
                    {isFromPricelist && <Lock size={10} className="inline ml-1 text-neutral-400" />}
                  </td>
                  {shippingLine.routes.map((route) => {
                    const profit = route.profits[key] || { type: "percentage" as const, value: 0 };
                    const baseValue = route[key as keyof RouteData] as number;
                    return (
                      <React.Fragment key={route.id}>
                        <td className="px-2 py-2 text-center border-l border-neutral-300">
                          <div className="relative inline-block">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-400 text-sm">$</span>
                            <input
                              type="number"
                              value={baseValue}
                              onChange={(e) => handleRouteChange(route.id, key as keyof RouteData, Number(e.target.value) || 0)}
                              readOnly={isFromPricelist && !!route.isFromPricelist}
                              className="w-24 pl-5 pr-2 py-1.5 rounded border border-neutral-200 text-sm text-center text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              style={{
                                backgroundColor: isFromPricelist && route.isFromPricelist ? "#F3F4F6" : "#FFFFFF",
                                cursor: isFromPricelist && route.isFromPricelist ? "not-allowed" : "text",
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center border-l border-neutral-100" style={{ backgroundColor: idx % 2 === 0 ? "#FAFFF5" : "#F5FFF0" }}>
                          <ProfitCell
                            profit={profit}
                            baseValue={baseValue}
                            onChange={(p) => handleRouteProfitChange(route.id, key, p)}
                          />
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RouteEditModal
        visible={!!editingRoute}
        route={editingRoute}
        onClose={() => setEditingRoute(null)}
        onSave={(updatedRoute) => { onUpdate({ ...shippingLine, routes: shippingLine.routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)) }); }}
        isFromPricelist={isFromPricelist}
        ports={ports}
        portsLoading={portsLoading}
        originCountry={originCountry}
        destinationCountry={destinationCountry}
        onPortCreated={onPortCreated}
      />
    </div>
  );
};

// =============================================================================
// LOCATION FIELD — free text OR specific port selection
// =============================================================================

const getPortLabel = (port: Port) => {
  const code = (port as any).unlocode || port.code || "";
  const name = port.name || "";
  const country = (port as any).countryName || (port as any).countryCode || port.country || "";
  if (code && name && country) return `${name} (${code}) - ${country}`;
  if (code && name) return `${name} (${code})`;
  if (name && country) return `${name} - ${country}`;
  return name || code || "Unknown Port";
};

interface LocationFieldProps {
  label: string;
  value: string;
  portId: string;
  ports: Port[];
  portsLoading: boolean;
  onChange: (text: string, portId: string) => void;
  onPortCreated: (port: Port) => void;
}

const LocationField: React.FC<LocationFieldProps> = ({ label, value, portId, ports, portsLoading, onChange, onPortCreated }) => {
  const [showPortSearch, setShowPortSearch] = useState(false);
  const selectedPort = portId ? ports.find((p) => p._id === portId) ?? null : null;

  const handlePortSelect = (id: string) => {
    const port = ports.find((p) => p._id === id);
    if (port) {
      onChange(getPortLabel(port), id);
      setShowPortSearch(false);
    }
  };

  const handlePortCreatedLocal = (port: Port) => {
    onPortCreated(port);
    onChange(getPortLabel(port), port._id);
    setShowPortSearch(false);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
        {label}
        {portsLoading && <Loader2 size={12} className="animate-spin text-neutral-400" />}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, "")}
        style={INPUT_STYLE}
        placeholder="e.g. Argentina"
      />
      <div className="mt-1 min-h-[20px]">
        {selectedPort ? (
          <span
            className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5"
            style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
          >
            📍 {getPortLabel(selectedPort)}
            <button
              type="button"
              onClick={() => onChange(value, "")}
              title="Remove specific port"
              style={{ color: "#FFFFFF", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
            >
              <X size={11} />
            </button>
          </span>
        ) : portsLoading ? (
          <span className="inline-flex items-center gap-1 text-xs text-neutral-400 px-2 py-0.5">
            <Loader2 size={11} className="animate-spin" />
            Loading ports...
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowPortSearch((v) => !v)}
            className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 transition-colors"
            style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", cursor: "pointer" }}
          >
            <Search size={11} />
            {showPortSearch ? "Cancel" : "Select specific port"}
          </button>
        )}
      </div>
      {showPortSearch && !selectedPort && (
        <div className="mt-2">
          <SearchablePortSelect
            value=""
            onChange={handlePortSelect}
            ports={ports}
            loading={portsLoading}
            disabled={false}
            placeholder="Search port..."
            label=""
            onPortCreated={handlePortCreatedLocal}
          />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CreateQuoteScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPricelistId = searchParams.get("pricelistId");
  const initialSupplierId = searchParams.get("supplierId");
  const { user } = useAuthStore();
  const { clients: backendClients } = useClients();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedQuotationId, setSavedQuotationId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingOriginPortCode, setPendingOriginPortCode] = useState<string | null>(null);
  const [pendingDestPortCode, setPendingDestPortCode] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState("FCL");
  const [availableIncoterms, setAvailableIncoterms] = useState<string[]>([]);

  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails>({
    quoteNumber: `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    date: formatDateInput(new Date()),
    validFrom: formatDateInput(new Date()),
    validUntil: formatDateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    origin: "",
    originPortId: "",
    destination: "",
    destinationPortId: "",
    incoterm: "FOB",
    equipment: "40' HC",
    commodity: "General Cargo",
    salesExecutive: "",
    clientId: "",
    clientName: "",
  });

  const [shippingLines, setShippingLines] = useState<ShippingLineData[]>([]);
  const [addedPricelistIds, setAddedPricelistIds] = useState<string[]>([]);
  const [showAddPricelistModal, setShowAddPricelistModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [ports, setPorts] = useState<Port[]>([]);
  const [portsLoading, setPortsLoading] = useState(false);

  useEffect(() => {
    setPortsLoading(true);
    PortsService.findAll().then(setPorts).catch(console.error).finally(() => setPortsLoading(false));
  }, []);

  const handlePortCreated = (port: Port) => setPorts((prev) => [...prev, port]);

  const formatWeekRange = (start: string, end?: string | null) => {
    const s = new Date(start).toLocaleDateString("en-US");
    const e = end ? new Date(end).toLocaleDateString("en-US") : "";
    return e ? `${s} - ${e}` : s;
  };

  useEffect(() => { if (initialPricelistId) loadInitialPricelist(); }, [initialPricelistId]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 5000); return () => clearTimeout(t); } }, [error]);

  // Load incoterms when serviceType changes
  useEffect(() => {
    if (!serviceType) return;
    QuotationsService.getIncoterms(serviceType).then(setAvailableIncoterms).catch(console.error);
  }, [serviceType]);

  const detectServiceTypeFromPricelist = (pricelist: PricelistWithSupplier): string => {
    const firstItem = pricelist.items[0];
    if (!firstItem) return "FCL";
    const eq = firstItem.equipmentType;
    if (eq === "LCL") return "LCL";
    if (firstItem.chargeType === "OCEAN_FREIGHT" || eq) return "FCL";
    return "FCL";
  };

  // Resolve pending port codes — fires when either the code or the ports list changes
  // NOTE: API returns `unlocode` (not `code`) — search both fields
  useEffect(() => {
    if (!pendingOriginPortCode || ports.length === 0) return;
    const port = ports.find((p) => (p as any).unlocode === pendingOriginPortCode || (p as any).code === pendingOriginPortCode);
    if (port) {
      setQuoteDetails((prev) => ({ ...prev, originPortId: port._id, origin: getPortLabel(port) }));
      setPendingOriginPortCode(null);
    }
  }, [pendingOriginPortCode, ports]);

  useEffect(() => {
    if (!pendingDestPortCode || ports.length === 0) return;
    const port = ports.find((p) => (p as any).unlocode === pendingDestPortCode || (p as any).code === pendingDestPortCode);
    if (port) {
      setQuoteDetails((prev) => ({ ...prev, destinationPortId: port._id, destination: getPortLabel(port) }));
      setPendingDestPortCode(null);
    }
  }, [pendingDestPortCode, ports]);

  // Auto-fill POL for all routes when origin port changes
  useEffect(() => {
    if (!quoteDetails.originPortId) return;
    const port = ports.find((p) => p._id === quoteDetails.originPortId);
    const polName = port ? getPortLabel(port) : "";
    setShippingLines((prev) =>
      prev.map((sl) => ({
        ...sl,
        routes: sl.routes.map((r) => ({ ...r, polPortId: quoteDetails.originPortId, pol: polName })),
      }))
    );
  }, [quoteDetails.originPortId, ports]);

  // Auto-fill POD for all routes when destination port changes
  useEffect(() => {
    if (!quoteDetails.destinationPortId) return;
    const port = ports.find((p) => p._id === quoteDetails.destinationPortId);
    const podName = port ? getPortLabel(port) : "";
    setShippingLines((prev) =>
      prev.map((sl) => ({
        ...sl,
        routes: sl.routes.map((r) => ({ ...r, podPortId: quoteDetails.destinationPortId, pod: podName })),
      }))
    );
  }, [quoteDetails.destinationPortId, ports]);

  const loadInitialPricelist = async () => {
    setLoading(true);
    try {
      const suppliers = await ShippingsService.findAll();
      let foundPricelist: PricelistWithSupplier | null = null;
      if (initialSupplierId) {
        const supplier = suppliers.find((s) => s._id === initialSupplierId);
        const data = await OperatorPricingService.getSupplierPricelists(initialSupplierId);
        const found = data.pricelists.find((p) => p.pricelistId === initialPricelistId);
        if (found) foundPricelist = { ...found, supplierName: supplier?.name, supplierId: initialSupplierId };
      } else {
        for (const supplier of suppliers) {
          try {
            const data = await OperatorPricingService.getSupplierPricelists(supplier._id);
            const found = data.pricelists.find((p) => p.pricelistId === initialPricelistId);
            if (found) { foundPricelist = { ...found, supplierName: supplier.name, supplierId: supplier._id }; break; }
          } catch (err) { console.error(`Failed to load pricelists for ${supplier.name}:`, err); }
        }
      }
      if (foundPricelist) {
        setShippingLines([convertPricelistToShippingLine(foundPricelist)]);
        setAddedPricelistIds([foundPricelist.pricelistId]);
        setServiceType(detectServiceTypeFromPricelist(foundPricelist));
        const firstItem = foundPricelist.items[0];
        if (firstItem) {
          if (firstItem.incoterm) setQuoteDetails((prev) => ({ ...prev, incoterm: firstItem.incoterm }));
          if (firstItem.lane?.originPortCode) setPendingOriginPortCode(firstItem.lane.originPortCode);
          if (firstItem.lane?.destinationPortCode) setPendingDestPortCode(firstItem.lane.destinationPortCode);
        }
      }
    } catch (err) { setError("Error loading initial pricelist"); console.error(err); } finally { setLoading(false); }
  };

  const convertPricelistToShippingLine = (pricelist: PricelistWithSupplier): ShippingLineData => {
    const CHARGE_FIELD_MAP: Record<string, keyof Pick<RouteData, "oceanFreight" | "destinationCharges" | "originHandlingFees" | "docFee" | "inlandFreight">> = {
      OCEAN_FREIGHT: "oceanFreight",
      DESTINATION_CHARGE: "destinationCharges",
      DOC_FEE: "docFee",
      OTHER: "originHandlingFees",
    };

    // All pricelist items become a single route/column with all items as rows
    const first = pricelist.items[0];
    const route: RouteData = {
      id: generateId(),
      pol: first?.lane?.originName ?? first?.lane?.originPortCode ?? "",
      pod: first?.lane?.destinationName ?? first?.lane?.destinationPortCode ?? "",
      polPortId: undefined,
      podPortId: undefined,
      rateAllIn: 0,
      oceanFreight: 0,
      destinationCharges: 0,
      originHandlingFees: 0,
      docFee: 0,
      inlandFreight: 0,
      profits: {
        rateAllIn: { type: "fixed", value: 0 },
        oceanFreight: { type: "fixed", value: 0 },
        destinationCharges: { type: "fixed", value: 0 },
        originHandlingFees: { type: "fixed", value: 0 },
        docFee: { type: "fixed", value: 0 },
        inlandFreight: { type: "fixed", value: 0 },
      },
      isFromPricelist: true,
      pricelistItems: pricelist.items.map((item) => ({
        id: item.id,
        label: item.name,
        chargeType: item.chargeType ?? "OTHER",
        equipmentType: item.equipmentType,
        cost: item.cost,
        profit: { type: "fixed" as const, value: 0 },
      })),
    };
    for (const item of pricelist.items) {
      const field = CHARGE_FIELD_MAP[item.chargeType ?? "OTHER"] ?? "originHandlingFees";
      route[field] += item.cost;
    }
    route.rateAllIn = calcRateAllIn(route);
    const routes: RouteData[] = [route];

    return {
      id: generateId(),
      name: pricelist.supplierName ?? extractShippingLineName(pricelist.agent.name),
      description: `Week ${formatWeekRange(pricelist.weekStart, pricelist.weekEnd)}`,
      freeDays: "21 Days",
      transitTime: "65-75 Days",
      routes,
      sourcePricelistId: pricelist.pricelistId,
      sourcePricelistName: `${pricelist.agent.name} - ${new Date(pricelist.weekStart).toLocaleDateString("en-US")}${pricelist.weekEnd ? ` - ${new Date(pricelist.weekEnd).toLocaleDateString("en-US")}` : ""}`,
      supplierName: pricelist.supplierName,
      supplierId: pricelist.supplierId,
      isFromPricelist: true,
    };
  };

  const handleAddPricelists = (pricelists: PricelistWithSupplier[]) => {
    setShippingLines((prev) => [...prev, ...pricelists.map(convertPricelistToShippingLine)]);
    setAddedPricelistIds((prev) => [...prev, ...pricelists.map((p) => p.pricelistId)]);
    setSuccess(`Added ${pricelists.length} pricelist(s) to the quote`);
    setSavedQuotationId(null);
    setIsDirty(true);
    // Auto-fill ports/incoterm/serviceType from first new pricelist
    const first = pricelists[0];
    if (first) {
      setServiceType(detectServiceTypeFromPricelist(first));
      const firstItem = first.items[0];
      if (firstItem) {
        if (firstItem.incoterm) setQuoteDetails((prev) => ({ ...prev, incoterm: firstItem.incoterm }));
        if (firstItem.lane?.originPortCode) setPendingOriginPortCode(firstItem.lane.originPortCode);
        if (firstItem.lane?.destinationPortCode) setPendingDestPortCode(firstItem.lane.destinationPortCode);
      }
    }
  };

  const handleAddNewShippingLine = () => {
    setShippingLines((prev) => [...prev, {
      id: generateId(),
      name: "New Carrier",
      description: "Description",
      freeDays: "21 Days",
      transitTime: "65-75 Days",
      routes: [{
        id: generateId(),
        pol: "Origin Port",
        pod: "Destination",
        rateAllIn: 0,
        oceanFreight: 0,
        destinationCharges: 0,
        originHandlingFees: 0,
        docFee: 0,
        inlandFreight: 0,
        profits: defaultProfits(),
      }],
    }]);
  };

  const handleUpdateShippingLine = (index: number, updated: ShippingLineData) => setShippingLines((prev) => prev.map((sl, i) => (i === index ? updated : sl)));
  const handleDeleteShippingLine = (index: number) => { const line = shippingLines[index]; if (line.sourcePricelistId) setAddedPricelistIds((prev) => prev.filter((id) => id !== line.sourcePricelistId)); setShippingLines((prev) => prev.filter((_, i) => i !== index)); };
  const handleDuplicateShippingLine = (index: number) => { const original = shippingLines[index]; setShippingLines((prev) => [...prev.slice(0, index + 1), { ...original, id: generateId(), name: `${original.name} (Copy)`, sourcePricelistId: undefined, sourcePricelistName: undefined, isFromPricelist: false, routes: original.routes.map((r) => ({ ...r, id: generateId(), isFromPricelist: false, profits: { ...r.profits } })) }, ...prev.slice(index + 1)]); };

  const handleSave = async () => {
    if (!quoteDetails.clientId) { setError("Please select a client before saving."); return; }
    if (shippingLines.length === 0) { setError("Please add at least one pricelist."); return; }
    const companyId = (user as any)?.company?._id ?? (user as any)?.company?.id;
    if (!companyId) { setError("No company associated to your user."); return; }
    const shippingLineId = shippingLines.find((sl) => sl.supplierId)?.supplierId ?? "";
    if (!shippingLineId) { setError("Could not determine shipping line. Please add a pricelist first."); return; }

    setSaving(true);
    setError(null);
    try {
      const chargeRows = [
        { key: "oceanFreight" as const, label: "Ocean Freight" },
        { key: "destinationCharges" as const, label: "Destination Charges" },
        { key: "originHandlingFees" as const, label: "Origin Handling Fees" },
        { key: "docFee" as const, label: "Doc Fee per BL" },
        { key: "inlandFreight" as const, label: "Inland Freight" },
      ];
      const legacyItems: QuotationLegacyItemDto[] = [];
      for (const sl of shippingLines) {
        for (const route of sl.routes) {
          if (route.pricelistItems?.length) {
            for (const item of route.pricelistItems) {
              const itemProfit = item.profit || { type: "percentage" as const, value: 0 };
              legacyItems.push({
                type: "cargo",
                description: `${item.label}${route.pol ? ` | ${route.pol} → ${route.pod}` : ""}${sl.supplierName ? ` (${sl.supplierName})` : ""}`,
                price: calcWithProfit(item.cost, itemProfit),
                cost: item.cost,
                quantity: 1,
                transitType: "maritime",
                ...(item.equipmentType ? { equipmentType: item.equipmentType } : {}),
              });
            }
          } else {
            for (const { key, label } of chargeRows) {
              const base = route[key];
              if (base > 0) {
                const profit = route.profits[key] || { type: "percentage" as const, value: 0 };
                legacyItems.push({
                  type: "cargo",
                  description: `${label}${route.pol ? ` | ${route.pol} → ${route.pod}` : ""}${sl.supplierName ? ` (${sl.supplierName})` : ""}`,
                  price: calcWithProfit(base, profit),
                  cost: base,
                  quantity: 1,
                  transitType: "maritime",
                });
              }
            }
          }
        }
      }

      const dto = {
        clientId: quoteDetails.clientId,
        companyId,
        shippingLineId,
        validUntil: quoteDetails.validUntil,
        serviceType,
        incoterm: quoteDetails.incoterm,
        originPortId: quoteDetails.originPortId || undefined,
        destinationPortId: quoteDetails.destinationPortId || undefined,
        shippingMode: (SERVICE_TYPE_SHIPPING_MODE[serviceType] ?? "maritime") as "maritime" | "air" | "road",
        legacyItems,
        status: QuotationStatusEnum.Draft,
        sourcePricelistId: addedPricelistIds[0] || undefined,
      };

      if (savedQuotationId) {
        await QuotationsService.update(savedQuotationId, dto);
      } else {
        const created = await QuotationsService.create(dto);
        const createdData = (created as any).data ?? created;
        const newId = createdData._id ?? createdData.id;
        setSavedQuotationId(newId);
        if (createdData.quoteNumber) {
          setQuoteDetails((prev) => ({ ...prev, quoteNumber: createdData.quoteNumber }));
        }
      }
      setIsDirty(false);
      setSuccess("Quote saved successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Error saving quote.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const buildQuoteSnapshot = (): QuoteSnapshotPayload => {
    const legacyItems: QuoteSnapshotPayload["legacyItems"] = [];
    let total = 0;
    shippingLines.forEach((sl, idx) => {
      const optLabel = getOptionLabel(idx);
      const displayName = sl.supplierName || sl.name;
      sl.routes.forEach((r) => {
        const price = calcTotalSellingPrice(r);
        total += price;
        legacyItems.push({
          type: "cargo",
          description: `OPTION ${optLabel} — ${displayName}: ${r.pol || "—"} - ${r.pod || "—"}`,
          price,
        });
      });
    });
    const validUntil = quoteDetails.validUntil
      ? new Date(quoteDetails.validUntil + "T23:59:59.999Z").toISOString()
      : undefined;
    return { legacyItems, total: legacyItems.length > 0 ? total : undefined, validUntil };
  };

  const handleSendToClients = async (clients: Client[], sendToAll: boolean) => {
    if (!savedQuotationId) { setError("Please save the quote first before sending."); return; }
    if (addedPricelistIds.length === 0) { setError("No pricelist associated to send."); return; }
    setSending(true);
    try {
      const pdfFile = await buildQuotePdfFile(buildPricelistQuoteHTML({ quoteDetails, shippingLines }), quoteDetails.quoteNumber);
      const quoteSnapshot = buildQuoteSnapshot();
      await OperatorPricingService.sendToClients({
        quotationId: savedQuotationId,
        pricelistId: addedPricelistIds[0],
        clientIds: sendToAll ? [] : clients.map((c) => c.id),
        sendToAll,
        pdf: pdfFile,
        quoteSnapshot,
      });
      await QuotationsService.update(savedQuotationId, { status: QuotationStatusEnum.Sent });
      setSuccess(`Quote sent to ${sendToAll ? "all clients" : `${clients.length} client(s)`}`);
    } catch (err) { setError("Error sending quote"); console.error(err); } finally { setSending(false); }
  };

  const handleDownloadPDF = async () => {
    try {
      const pdfFile = await buildQuotePdfFile(buildPricelistQuoteHTML({ quoteDetails, shippingLines }), quoteDetails.quoteNumber);
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFile.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError("Error generating PDF"); console.error(err); }
  };

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto p-4 sm:p-6" style={{ backgroundColor: "#FFFFFF", color: "#1F2937" }}>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center justify-center rounded-lg px-3 py-2 transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}><ArrowLeft size={16} /></button>
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden sm:block" />
              <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 truncate">Create Quote</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={shippingLines.length === 0 || saving || (!isDirty && !!savedQuotationId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100"
              style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : savedQuotationId && !isDirty ? <Check size={16} className="text-green-600" /> : null}
              <span className="hidden sm:inline">{saving ? "Saving..." : savedQuotationId && !isDirty ? "Saved" : "Save Quote"}</span>
            </button>
            <button type="button" onClick={handleDownloadPDF} disabled={!savedQuotationId || isDirty} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}><Download size={16} /><span className="hidden sm:inline">Download PDF</span></button>
            <button type="button" onClick={() => setShowClientModal(true)} disabled={!savedQuotationId || isDirty || sending} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}<span className="hidden sm:inline">{sending ? "Sending..." : "Send to Clients"}</span></button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p></div>}
      {success && <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{success}</p></div>}

      <div className="rounded-xl border border-neutral-200 p-6 mb-6" style={{ backgroundColor: "#FFFFFF" }}>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quote Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Quote Number</label><input type="text" value={quoteDetails.quoteNumber} readOnly style={READONLY_INPUT_STYLE} /></div>
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Date</label><input type="date" value={quoteDetails.date} onChange={(e) => { setQuoteDetails({ ...quoteDetails, date: e.target.value }); setIsDirty(true); }} style={{ ...INPUT_STYLE, colorScheme: "light" }} /></div>
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Valid From</label><input type="date" value={quoteDetails.validFrom} onChange={(e) => { setQuoteDetails({ ...quoteDetails, validFrom: e.target.value }); setIsDirty(true); }} style={{ ...INPUT_STYLE, colorScheme: "light" }} /></div>
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Valid Until</label><input type="date" value={quoteDetails.validUntil} onChange={(e) => { setQuoteDetails({ ...quoteDetails, validUntil: e.target.value }); setIsDirty(true); }} style={{ ...INPUT_STYLE, colorScheme: "light" }} /></div>
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Sales Executive</label><input type="text" value={quoteDetails.salesExecutive} onChange={(e) => { setQuoteDetails({ ...quoteDetails, salesExecutive: e.target.value }); setIsDirty(true); }} style={INPUT_STYLE} /></div>
          <LocationField
            label="Origin"
            value={quoteDetails.origin}
            portId={quoteDetails.originPortId}
            ports={ports}
            portsLoading={portsLoading}
            onChange={(text, id) => setQuoteDetails({ ...quoteDetails, origin: text, originPortId: id })}
            onPortCreated={handlePortCreated}
          />
          <LocationField
            label="Destination"
            value={quoteDetails.destination}
            portId={quoteDetails.destinationPortId}
            ports={ports}
            portsLoading={portsLoading}
            onChange={(text, id) => setQuoteDetails({ ...quoteDetails, destination: text, destinationPortId: id })}
            onPortCreated={handlePortCreated}
          />
          {/* Service Type is auto-detected from pricelist — hidden from UI */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Incoterm
              {addedPricelistIds.length > 0 && <span className="ml-1 text-[10px] text-neutral-400">(from pricelist)</span>}
            </label>
            <select
              value={quoteDetails.incoterm}
              onChange={(e) => { setQuoteDetails((prev) => ({ ...prev, incoterm: e.target.value })); setIsDirty(true); setSavedQuotationId(null); }}
              disabled={addedPricelistIds.length > 0}
              style={{ ...INPUT_STYLE, appearance: "auto", ...(addedPricelistIds.length > 0 ? { backgroundColor: "#F3F4F6", color: "#6B7280", cursor: "not-allowed" } : {}) }}
            >
              <option value="">— Select incoterm —</option>
              {availableIncoterms.map((inc) => (
                <option key={inc} value={inc}>{inc}</option>
              ))}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-neutral-700 mb-1">Equipment</label><input type="text" value={quoteDetails.equipment} onChange={(e) => { setQuoteDetails({ ...quoteDetails, equipment: e.target.value }); setIsDirty(true); }} style={INPUT_STYLE} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="block text-sm font-medium text-neutral-700 mb-1">Commodity</label><input type="text" value={quoteDetails.commodity} onChange={(e) => { setQuoteDetails({ ...quoteDetails, commodity: e.target.value }); setIsDirty(true); }} style={INPUT_STYLE} /></div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Client <span className="text-red-500">*</span></label>
            <select
              value={quoteDetails.clientId}
              onChange={(e) => {
                const selected = backendClients.find((c: BackendClient) => (c.id || (c as any)._id) === e.target.value);
                setQuoteDetails({ ...quoteDetails, clientId: e.target.value, clientName: selected?.name ?? "" });
                setIsDirty(true);
                setSavedQuotationId(null);
              }}
              style={{ ...INPUT_STYLE, appearance: "auto" }}
            >
              <option value="">— Select client —</option>
              {backendClients.map((c: BackendClient) => (
                <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button type="button" onClick={() => setShowAddPricelistModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}><ListPlus size={16} />Add Existing Pricelist</button>
        <button type="button" onClick={handleAddNewShippingLine} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}><Plus size={16} />Create New Shipping Line</button>
        {addedPricelistIds.length > 0 && <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full">{addedPricelistIds.length} pricelist(s) added</span>}
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-neutral-400" /></div>}

      {!loading && shippingLines.length === 0 && (
        <div className="text-center py-12 rounded-xl border border-neutral-200" style={{ backgroundColor: "#FFFFFF" }}>
          <Ship className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-600 mb-2">No shipping lines in quote</h3>
          <p className="text-neutral-500 mb-6">Add existing pricelists or create new shipping lines to get started.</p>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => setShowAddPricelistModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-700" style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "1px solid #2563EB" }}><ListPlus size={16} />Add Pricelist</button>
            <button type="button" onClick={handleAddNewShippingLine} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-neutral-100" style={{ backgroundColor: "#FFFFFF", color: "#374151", border: "1px solid #D1D5DB" }}><Plus size={16} />Create New Line</button>
          </div>
        </div>
      )}

      {shippingLines.map((sl, index) => (
        <ShippingLineCard
          key={sl.id}
          shippingLine={sl}
          optionLabel={getOptionLabel(index)}
          onUpdate={(updated) => handleUpdateShippingLine(index, updated)}
          onDelete={() => handleDeleteShippingLine(index)}
          onDuplicate={() => handleDuplicateShippingLine(index)}
          ports={ports}
          portsLoading={portsLoading}
          originCountry={quoteDetails.origin}
          originPortId={quoteDetails.originPortId}
          destinationCountry={quoteDetails.destination}
          destinationPortId={quoteDetails.destinationPortId}
          onPortCreated={handlePortCreated}
        />
      ))}

      <AddPricelistModal visible={showAddPricelistModal} onClose={() => setShowAddPricelistModal(false)} onAddPricelists={handleAddPricelists} existingPricelistIds={addedPricelistIds} />
      <ClientSelectorModal visible={showClientModal} onClose={() => setShowClientModal(false)} onSelectClients={handleSendToClients} />
    </div>
  );
}