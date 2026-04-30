import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  Calendar,
  Ship,
  User,
  DollarSign,
  FileText,
  Eye,
  Check,
  XCircle,
  Plus,
  Send,
  Users,
} from "lucide-react";
import {
  OperatorPricingService,
  type OperatorPricelist,
} from "../services/operator-pricing.service";
import { ShippingsService } from "../services/shipping.service";
import type { ShippingLine } from "../utils/types/shipping.type";
import type { PricelistStatus } from "../services/pricing.service";

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_BADGES: Record<
  PricelistStatus | "all",
  { style: string; label: string }
> = {
  all: {
    style: "bg-neutral-50 text-neutral-600 border-neutral-200",
    label: "All",
  },
  draft: {
    style: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Draft",
  },
  submitted: {
    style: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Pending Approval",
  },
  approved: {
    style: "bg-green-50 text-green-700 border-green-200",
    label: "Approved",
  },
  rejected: {
    style: "bg-red-50 text-red-700 border-red-200",
    label: "Rejected",
  },
  superseded: {
    style: "bg-neutral-50 text-neutral-500 border-neutral-200",
    label: "Superseded",
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface AgentOption {
  id: string;
  name: string;
  email: string;
  supplierId: string;
  supplierName: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatWeekRange = (start: string, end?: string) => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate);
  if (!end) {
    endDate.setDate(startDate.getDate() + 6);
  }
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", { ...options, year: "numeric" })}`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// =============================================================================
// PRICELIST DETAIL MODAL
// =============================================================================

interface PricelistDetailModalProps {
  pricelist: OperatorPricelist | null;
  onClose: () => void;
  onApprove: (pricelistId: string) => Promise<void>;
  onReject: (pricelistId: string, reason: string) => Promise<void>;
  onCreateQuote: (pricelistId: string) => void;
  onViewQuotationsSent: (pricelistId: string) => void;
  approving: boolean;
  rejecting: boolean;
}

const PricelistDetailModal: React.FC<PricelistDetailModalProps> = ({
  pricelist,
  onClose,
  onApprove,
  onReject,
  onCreateQuote,
  onViewQuotationsSent,
  approving,
  rejecting,
}) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  if (!pricelist) return null;

  const statusBadge = STATUS_BADGES[pricelist.status] || STATUS_BADGES.all;
  const canApprove = pricelist.status === "submitted";
  const canReject = pricelist.status === "submitted";
  const canCreateQuote = pricelist.status === "approved";

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectError("Rejection reason is required");
      return;
    }

    setRejectError(null);
    await onReject(pricelist.pricelistId, rejectionReason.trim());
    setShowRejectModal(false);
    setRejectionReason("");
  };

  return (
    <>
      {/* Main Detail Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">
                Pricelist Details
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Week: {formatWeekRange(pricelist.weekStart, pricelist.weekEnd)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={approving || rejecting}
              className="p-2 rounded-lg bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 bg-white">
            {/* Agent Info */}
            <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900">
                  {pricelist.agent.name}
                </h3>
                <p className="text-sm text-neutral-500">
                  {pricelist.agent.email}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusBadge.style}`}
              >
                {statusBadge.label}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <p className="text-xs text-neutral-500">Items</p>
                <p className="text-2xl font-semibold text-neutral-900 mt-1">
                  {pricelist.itemCount}
                </p>
              </div>
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <p className="text-xs text-neutral-500">Total Cost</p>
                <p className="text-2xl font-semibold text-blue-600 mt-1">
                  ${pricelist.totalCost.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <p className="text-xs text-neutral-500">Submitted</p>
                <p className="text-sm font-medium text-neutral-900 mt-1">
                  {formatDate(pricelist.submittedAt)}
                </p>
              </div>
            </div>

            {/* Approved Info */}
            {pricelist.status === "approved" && pricelist.approvedAt && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Approved - Ready to create customer quote
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Approved on {formatDate(pricelist.approvedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Reason (if rejected/draft with rejection) */}
            {pricelist.rejectionReason && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-700 mt-0.5">
                      {pricelist.rejectionReason}
                    </p>
                    {pricelist.rejectedAt && (
                      <p className="text-xs text-red-600 mt-1">
                        Rejected on {formatDate(pricelist.rejectedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <FileText size={16} />
                Items ({pricelist.items.length})
              </h3>
              <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">
                        Incoterm
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">
                        Currency
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {pricelist.items.map((item) => (
                      <tr key={item.id} className="bg-white hover:bg-neutral-50">
                        <td className="px-4 py-3 text-sm text-neutral-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {item.incoterm}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-neutral-900">
                          {item.cost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {item.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {canCreateQuote && (
                <button
                  type="button"
                  onClick={() => onCreateQuote(pricelist.pricelistId)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus size={16} />
                  Create Customer Quote
                </button>
              )}
              {canCreateQuote && (
                <button
                  type="button"
                  onClick={() => onViewQuotationsSent(pricelist.pricelistId)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium"
                >
                  <FileText size={16} />
                  Quotations Sent
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={approving || rejecting}
                className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Close
              </button>
              {canReject && (
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(pricelist.pricelistId)}
                  disabled={approving || rejecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {approving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Approve
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">
                Reject Pricelist
              </h3>
            </div>
            <div className="p-6 space-y-4 bg-white">
              {rejectError && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle size={16} />
                  {rejectError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    setRejectError(null);
                  }}
                  placeholder="Please provide a reason for rejection..."
                  rows={4}
                  className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 bg-white flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setRejectError(null);
                }}
                disabled={rejecting}
                className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {rejecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Confirm Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OperatorPricingScreen() {
  const navigate = useNavigate();
  const { supplierId: urlSupplierId } = useParams<{ supplierId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAgentId = searchParams.get("agentId");

  // State
  const [suppliers, setSuppliers] = useState<ShippingLine[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    urlSupplierId || null
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    urlAgentId || null
  );
  const [pricelists, setPricelists] = useState<OperatorPricelist[]>([]);
  const [allPricelistsGlobal, setAllPricelistsGlobal] = useState<OperatorPricelist[]>([]);
  const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPricelists, setLoadingPricelists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<PricelistStatus | "all">(
    "all"
  );
  const [selectedPricelist, setSelectedPricelist] =
    useState<OperatorPricelist | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Get selected agent info
  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return allAgents.find((a) => a.id === selectedAgentId) || null;
  }, [allAgents, selectedAgentId]);

  // Load suppliers and all pricelists from all suppliers
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const supplierData = await ShippingsService.findAll();
        setSuppliers(supplierData);

        // Load pricelists from all suppliers to get all agents
        const allPricelists: OperatorPricelist[] = [];
        const agentMap = new Map<string, AgentOption>();

        for (const supplier of supplierData) {
          try {
            const response = await OperatorPricingService.getSupplierPricelists(
              supplier._id,
              {}
            );
            allPricelists.push(...response.pricelists);

            // Extract agents
            response.pricelists.forEach((p) => {
              if (!agentMap.has(p.agent.id)) {
                agentMap.set(p.agent.id, {
                  id: p.agent.id,
                  name: p.agent.name,
                  email: p.agent.email,
                  supplierId: supplier._id,
                  supplierName: supplier.name,
                });
              }
            });
          } catch (err) {
            console.error(`Failed to load pricelists for ${supplier.name}:`, err);
          }
        }

        setAllPricelistsGlobal(allPricelists);
        setAllAgents(
          Array.from(agentMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );

        // Set initial supplier if provided in URL or if there's only one
        if (urlSupplierId) {
          setSelectedSupplierId(urlSupplierId);
        } else if (supplierData.length === 1) {
          setSelectedSupplierId(supplierData[0]._id);
        }

        // If agentId is in URL, auto-select the supplier for that agent
        if (urlAgentId) {
          const agent = Array.from(agentMap.values()).find(
            (a) => a.id === urlAgentId
          );
          if (agent && !urlSupplierId) {
            setSelectedSupplierId(agent.supplierId);
          }
        }
      } catch (err: any) {
        console.error("Failed to load data:", err);
        setError(err?.response?.data?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [urlSupplierId, urlAgentId]);

  // Load filtered pricelists when filters change
  useEffect(() => {
    const loadPricelists = async () => {
      setLoadingPricelists(true);
      setError(null);
      try {
        let filteredPricelists: OperatorPricelist[] = [];

        // If agent is selected, filter from global pricelists
        if (selectedAgentId) {
          filteredPricelists = allPricelistsGlobal.filter(
            (p) => p.agent.id === selectedAgentId
          );

          // Also filter by supplier if selected
          if (selectedSupplierId) {
            // We need to check supplier - find the agent's supplier
            const agent = allAgents.find((a) => a.id === selectedAgentId);
            if (agent && agent.supplierId !== selectedSupplierId) {
              // Agent doesn't belong to this supplier, show empty
              filteredPricelists = [];
            }
          }
        } else if (selectedSupplierId) {
          // No agent selected, but supplier is selected
          const response = await OperatorPricingService.getSupplierPricelists(
            selectedSupplierId,
            {}
          );
          filteredPricelists = response.pricelists;
        } else {
          // No filters - show all
          filteredPricelists = allPricelistsGlobal;
        }

        // Filter by status
        if (selectedStatus !== "all") {
          const statusToFilter =
            selectedStatus === "rejected" ? "draft" : selectedStatus;
          filteredPricelists = filteredPricelists.filter(
            (p) =>
              p.status === statusToFilter ||
              (selectedStatus === "rejected" && p.status === "rejected")
          );
        }

        setPricelists(filteredPricelists);
      } catch (err: any) {
        console.error("Failed to load pricelists:", err);
        setError(err?.response?.data?.message || "Failed to load pricelists");
      } finally {
        setLoadingPricelists(false);
      }
    };

    if (!loading) {
      loadPricelists();
    }
  }, [
    selectedSupplierId,
    selectedAgentId,
    selectedStatus,
    allPricelistsGlobal,
    allAgents,
    loading,
  ]);

  // Handlers
  const handleSupplierSelect = useCallback(
    (supplierId: string | null) => {
      setSelectedSupplierId(supplierId);
      setError(null);
      setSuccess(null);

      if (supplierId) {
        navigate(`/pricing/suppliers/${supplierId}`, { replace: true });
      } else {
        navigate("/pricing", { replace: true });
      }

      // Clear agent if it doesn't belong to this supplier
      if (supplierId && selectedAgentId) {
        const agent = allAgents.find((a) => a.id === selectedAgentId);
        if (agent && agent.supplierId !== supplierId) {
          setSelectedAgentId(null);
          setSearchParams({});
        }
      }
    },
    [navigate, selectedAgentId, allAgents, setSearchParams]
  );

  const handleAgentSelect = useCallback(
    (agentId: string | null) => {
      setSelectedAgentId(agentId);
      setError(null);
      setSuccess(null);

      // Update URL with agent filter
      if (agentId) {
        setSearchParams({ agentId });

        // Auto-select supplier when agent is selected
        const agent = allAgents.find((a) => a.id === agentId);
        if (agent && !selectedSupplierId) {
          setSelectedSupplierId(agent.supplierId);
          navigate(`/pricing/suppliers/${agent.supplierId}?agentId=${agentId}`, {
            replace: true,
          });
        }
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams, allAgents, selectedSupplierId, navigate]
  );

  const handleViewDetails = useCallback((pricelist: OperatorPricelist) => {
    setSelectedPricelist(pricelist);
  }, []);

  const handleCreateQuote = useCallback(
    (pricelistId: string) => {
      setSelectedPricelist(null);
      navigate(`/quotes/new?pricelistId=${pricelistId}`);
    },
    [navigate]
  );

  const handleViewQuotationsSent = useCallback(
    (pricelistId: string) => {
      setSelectedPricelist(null);
      navigate(`/pricing/quotations-sent?pricelistId=${pricelistId}`);
    },
    [navigate]
  );

  const refreshPricelists = useCallback(async () => {
    // Reload all pricelists
    const allPricelists: OperatorPricelist[] = [];
    const agentMap = new Map<string, AgentOption>();

    for (const supplier of suppliers) {
      try {
        const response = await OperatorPricingService.getSupplierPricelists(
          supplier._id,
          {}
        );
        allPricelists.push(...response.pricelists);

        response.pricelists.forEach((p) => {
          if (!agentMap.has(p.agent.id)) {
            agentMap.set(p.agent.id, {
              id: p.agent.id,
              name: p.agent.name,
              email: p.agent.email,
              supplierId: supplier._id,
              supplierName: supplier.name,
            });
          }
        });
      } catch (err) {
        console.error(`Failed to reload pricelists for ${supplier.name}:`, err);
      }
    }

    setAllPricelistsGlobal(allPricelists);
    setAllAgents(
      Array.from(agentMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [suppliers]);

  const handleApprove = useCallback(
    async (pricelistId: string) => {
      setApproving(true);
      setError(null);
      try {
        await OperatorPricingService.approvePricelist(pricelistId);
        setSuccess(
          "Pricelist approved successfully! You can now create a customer quote."
        );
        setTimeout(() => setSuccess(null), 4000);
        await refreshPricelists();
        setSelectedPricelist(null);
      } catch (err: any) {
        console.error("Failed to approve pricelist:", err);
        setError(err?.response?.data?.message || "Failed to approve pricelist");
      } finally {
        setApproving(false);
      }
    },
    [refreshPricelists]
  );

  const handleReject = useCallback(
    async (pricelistId: string, reason: string) => {
      setRejecting(true);
      setError(null);
      try {
        await OperatorPricingService.rejectPricelist(pricelistId, reason);
        setSuccess("Pricelist rejected successfully!");
        setTimeout(() => setSuccess(null), 3000);
        await refreshPricelists();
        setSelectedPricelist(null);
      } catch (err: any) {
        console.error("Failed to reject pricelist:", err);
        setError(err?.response?.data?.message || "Failed to reject pricelist");
      } finally {
        setRejecting(false);
      }
    },
    [refreshPricelists]
  );

  // Stats - based on current filters
  const stats = useMemo(() => {
    let relevantPricelists = allPricelistsGlobal;

    if (selectedAgentId) {
      relevantPricelists = relevantPricelists.filter(
        (p) => p.agent.id === selectedAgentId
      );
    } else if (selectedSupplierId) {
      const agent = allAgents.find((a) => a.supplierId === selectedSupplierId);
      if (agent) {
        relevantPricelists = relevantPricelists.filter((p) =>
          allAgents.some(
            (a) => a.id === p.agent.id && a.supplierId === selectedSupplierId
          )
        );
      }
    }

    const submitted = relevantPricelists.filter(
      (p) => p.status === "submitted"
    ).length;
    const approved = relevantPricelists.filter(
      (p) => p.status === "approved"
    ).length;
    const draftRejected = relevantPricelists.filter(
      (p) => p.status === "draft" || p.status === "rejected"
    ).length;

    return {
      submitted,
      approved,
      draftRejected,
      total: relevantPricelists.length,
    };
  }, [allPricelistsGlobal, selectedAgentId, selectedSupplierId, allAgents]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Loading data...</p>
        </div>
      </div>
    );
  }

  // No suppliers
  if (suppliers.length === 0) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            No Suppliers Found
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            No suppliers are available. Please create a supplier first.
          </p>
          <button
            type="button"
            onClick={() => navigate("/suppliers")}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            <Ship size={16} />
            Go to Suppliers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <DollarSign className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden sm:block" />
              <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 truncate">
                Pricelist Review & Approval
              </h1>
            </div>
          </div>

          {/* Quick action to create quote */}
          <button
            type="button"
            onClick={() => navigate("/quotes/new")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            New Quote
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Agent Selector - Always visible */}
          {allAgents.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Users size={14} className="text-neutral-400 flex-shrink-0" />
              <select
                value={selectedAgentId || ""}
                onChange={(e) => handleAgentSelect(e.target.value || null)}
                className="flex-1 sm:w-64 rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Agents</option>
                {allAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.supplierName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Supplier Selector */}
          {suppliers.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Ship size={14} className="text-neutral-400 flex-shrink-0" />
              <select
                value={selectedSupplierId || ""}
                onChange={(e) => handleSupplierSelect(e.target.value || null)}
                className="flex-1 sm:w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear filters button */}
          {(selectedAgentId || selectedSupplierId) && (
            <button
              type="button"
              onClick={() => {
                handleAgentSelect(null);
                handleSupplierSelect(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>

        {/* Selected Agent Info Banner */}
        {selectedAgent && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900">
                Viewing pricelists for: {selectedAgent.name}
              </p>
              <p className="text-xs text-blue-600">
                {selectedAgent.email} • {selectedAgent.supplierName}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Content */}
      {loadingPricelists ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500">Total</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">
                {stats.total}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-xs text-blue-600">Pending</p>
              <p className="text-2xl font-semibold text-blue-700 mt-1">
                {stats.submitted}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600">Approved</p>
              <p className="text-2xl font-semibold text-green-700 mt-1">
                {stats.approved}
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600">Draft/Rejected</p>
              <p className="text-2xl font-semibold text-amber-700 mt-1">
                {stats.draftRejected}
              </p>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto bg-white">
            {(["all", "submitted", "approved", "rejected"] as const).map(
              (status) => {
                const label =
                  status === "rejected"
                    ? "Draft/Rejected"
                    : STATUS_BADGES[status].label;
                const isActive = selectedStatus === status;

                let activeStyle = "";
                if (isActive) {
                  switch (status) {
                    case "submitted":
                      activeStyle = "border-blue-500 text-blue-600 bg-blue-50";
                      break;
                    case "approved":
                      activeStyle =
                        "border-green-500 text-green-600 bg-green-50";
                      break;
                    case "rejected":
                      activeStyle =
                        "border-amber-500 text-amber-600 bg-amber-50";
                      break;
                    default:
                      activeStyle =
                        "border-neutral-900 text-neutral-900 bg-neutral-50";
                  }
                }

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? activeStyle
                        : "border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 bg-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* Pricelists List */}
          {pricelists.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">
                {selectedAgentId
                  ? `No pricelists found for ${selectedAgent?.name || "this agent"}`
                  : selectedStatus === "all"
                    ? "No pricelists found"
                    : selectedStatus === "rejected"
                      ? "No draft/rejected pricelists"
                      : `No ${STATUS_BADGES[selectedStatus].label.toLowerCase()} pricelists`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pricelists.map((pricelist) => {
                const statusBadge =
                  STATUS_BADGES[pricelist.status] || STATUS_BADGES.all;
                const canCreateQuote = pricelist.status === "approved";

                return (
                  <div
                    key={pricelist.pricelistId}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900">
                            {pricelist.agent.name}
                          </h3>
                          <p className="text-xs text-neutral-500">
                            {pricelist.agent.email}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge.style}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatWeekRange(
                            pricelist.weekStart,
                            pricelist.weekEnd
                          )}
                        </span>
                        <span>{pricelist.itemCount} items</span>
                        <span className="font-medium text-neutral-700">
                          ${pricelist.totalCost.toLocaleString()}
                        </span>
                        {pricelist.submittedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Submitted {formatDate(pricelist.submittedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canCreateQuote && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCreateQuote(pricelist.pricelistId)
                          }
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                          title="Create customer quote from this pricelist"
                        >
                          <Send size={14} />
                          <span className="hidden sm:inline">Create Quote</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewDetails(pricelist)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedPricelist && (
        <PricelistDetailModal
          pricelist={selectedPricelist}
          onClose={() => setSelectedPricelist(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onCreateQuote={handleCreateQuote}
          onViewQuotationsSent={handleViewQuotationsSent}
          approving={approving}
          rejecting={rejecting}
        />
      )}
    </div>
  );
}