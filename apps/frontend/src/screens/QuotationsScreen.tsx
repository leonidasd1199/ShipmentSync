/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type JSX,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { Calendar } from "primereact/calendar";
import {
  ArrowLeft,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  Loader2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  FileText,
} from "lucide-react";

import { useQuotations } from "../hooks/useQuotations";
import type {
  QuotationFilters,
  QuotationListItemResponse,
} from "../utils/types/quotation.type";
import { useQuotationHelpers } from "../hooks/useQuotationsHelpers";
import { QuotationStatusEnum, TransitTypeEnum } from "../utils/constants";
import { QuotationsService, type MetadataOption } from "../services/quotations.service";

import "./QuotationsScreen.css";
import DeleteQuotationModal from "../components/modals/Quotations/DeleteQuotationModal";
import AcceptQuotationModal from "../components/modals/Quotations/AcceptQuotationModal";
import RejectQuotationModal from "../components/modals/Quotations/RejectQuotationModal";
import QuotationStatus from "../components/QuotationStatus";

type MenuPos = { top: number; left: number };

const SERVICE_TYPE_ICONS: Record<string, string> = {
  FCL: "🚢",
  LCL: "📦",
  AIR: "✈️",
  FTL: "🚛",
  INSURANCE: "🛡️",
  CUSTOMS: "📋",
  LOCAL_TRUCKING: "🚚",
};

export default function QuotationsScreen(): JSX.Element {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuotation, setMenuQuotation] =
    useState<QuotationListItemResponse | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const {
    quotations,
    isLoading,
    error,
    page,
    pageSize,
    total,
    filters,
    setFilters,
    refresh,
    setPage,
    setPageSize,
    deleteQuotation,
    acceptQuotation,
    rejectQuotation,
    downloadQuotationPdf
  } = useQuotations({
    autoload: true,
    defaultPage: 1,
    defaultPageSize: 10,
    defaultFilters: {},
  });

  const {
    shippingLines,
    agents,
    clients,
    isLoading: isLoadingHelpers,
    refresh: refreshHelpers,
  } = useQuotationHelpers({ autoload: true });

  const [filtersOpen, setFiltersOpen] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedShippingLineId, setSelectedShippingLineId] =
    useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedTransitType, setSelectedTransitType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] =
    useState<QuotationListItemResponse | null>(null);

  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<MetadataOption[]>([]);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);

  const [global, setGlobal] = useState("");
  const [tableFilters, setTableFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setTableFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
    setPage(1);
  };

  useEffect(() => {
    void refresh();
  }, [page, pageSize, filters, refresh]);

  useEffect(() => {
    void refreshHelpers();
  }, [refreshHelpers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onDocClick = (e: MouseEvent | globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMenuQuotation(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMenuQuotation(null);
      }
    };

    const onScroll = () => {
      setMenuOpen(false);
      setMenuQuotation(null);
    };

    const onResize = () => {
      setMenuOpen(false);
      setMenuQuotation(null);
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (dropdownOpen && serviceTypes.length === 0) {
      fetchServiceTypes();
    }
  }, [dropdownOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchServiceTypes = async () => {
    setLoadingServiceTypes(true);
    try {
      const data = await QuotationsService.getServiceTypes();
      console.log("Service types response:", data);
      setServiceTypes(data);
    } catch (err) {
      console.error("Failed to fetch service types:", err);
    } finally {
      setLoadingServiceTypes(false);
    }
  };

  const getServiceTypeIcon = (value: string): string => {
    return SERVICE_TYPE_ICONS[value] || "📦";
  };

  const handleBack = () => navigate(-1);

  type QuotationFilterPatch = {
    clientId?: string;
    shippingLineId?: string;
    agentId?: string | null;
    status?: QuotationStatusEnum | null;
    chargeType?: TransitTypeEnum;
    createdAtFrom?: string;
    createdAtTo?: string;
  };

  const applyFilterChange = useCallback(
    (partial: QuotationFilterPatch) => {
      setFilters((prev: QuotationFilters) => {
        const next: any = { ...(prev as QuotationFilters) };

        if ("clientId" in partial) {
          if (partial.clientId) next.clientId = partial.clientId;
          else delete next.clientId;
        }

        if ("shippingLineId" in partial) {
          if (partial.shippingLineId) next.shippingLineId = partial.shippingLineId;
          else delete next.shippingLineId;
        }

        if ("agentId" in partial) {
          if (partial.agentId) next.agentId = partial.agentId;
          else delete next.agentId;
        }

        if ("status" in partial) {
          if (partial.status) next.status = partial.status;
          else delete next.status;
        }

        if ("chargeType" in partial) {
          if (partial.chargeType) next.chargeType = partial.chargeType;
          else delete next.chargeType;
        }

        if ("createdAtFrom" in partial) {
          if (partial.createdAtFrom) next.createdAtFrom = partial.createdAtFrom;
          else delete next.createdAtFrom;
        }

        if ("createdAtTo" in partial) {
          if (partial.createdAtTo) next.createdAtTo = partial.createdAtTo;
          else delete next.createdAtTo;
        }

        next.page = 1;
        next.limit = pageSize;
        return next;
      });
      setPage(1);
    },
    [setFilters, setPage, pageSize],
  );

  const handleClientChange = (value: string) => {
    setSelectedClientId(value);
    applyFilterChange({ clientId: value || undefined });
  };

const handleShippingLineChange = (value: string) => {
  setSelectedShippingLineId(value);
  applyFilterChange({ shippingLineId: value || undefined });
};

  const handleAgentChange = (value: string) => {
    setSelectedAgentId(value);
    applyFilterChange({ agentId: value || null });
  };

  const handleTransitTypeChange = (value: string) => {
    setSelectedTransitType(value);
    applyFilterChange({
      chargeType: value ? (value as TransitTypeEnum) : undefined,
    });
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    applyFilterChange({
      status: value ? (value as QuotationStatusEnum) : null,
    });
  };

  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value);
    applyFilterChange({
      createdAtFrom: value ? value.toISOString() : undefined,
    });
  };

  const handleEndDateChange = (value: Date | null) => {
    setEndDate(value);
    applyFilterChange({
      createdAtTo: value ? value.toISOString() : undefined,
    });
  };

  const clearAllFilters = () => {
    setSelectedClientId("");
    setSelectedShippingLineId("");
    setSelectedAgentId("");
    setSelectedTransitType("");
    setSelectedStatus("");
    setStartDate(null);
    setEndDate(null);
    setGlobal("");
    setTableFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value: "" },
    }));

    setFilters({
      page: 1,
      limit: pageSize,
    } as any);
    setPage(1);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedClientId) count++;
    if (selectedShippingLineId) count++;
    if (selectedAgentId) count++;
    if (selectedTransitType) count++;
    if (selectedStatus) count++;
    if (startDate) count++;
    if (endDate) count++;
    return count;
  }, [
    selectedClientId,
    selectedShippingLineId,
    selectedAgentId,
    selectedTransitType,
    selectedStatus,
    startDate,
    endDate,
  ]);

  const headerTitle = useMemo(() => "Estimates", []);

  const paginatorBtn =
    "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-8 w-8 p-0";
  const paginatorRoot = "flex items-center justify-center gap-1 py-2 bg-white";

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return "—";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "—";

    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();

    return `${day}/${month}/${year}`;
  };

  const displayClient = (row: QuotationListItemResponse) =>
    (row.client as any)?.name ??
    (row.client as any)?.clientName ??
    "—";

  const displayShippingLine = (row: QuotationListItemResponse) =>
    row.shippingLine?.name ?? "—";

  const displayAgent = (row: QuotationListItemResponse) => {
    const first = (row.agent as any)?.firstName ?? "";
    const last = (row.agent as any)?.lastName ?? "";
    const full = `${first} ${last}`.trim();
    return full || "—";
  };

  const displayValidUntil = (row: QuotationListItemResponse) =>
    formatDate(row.validUntil);

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  const handleServiceTypeSelect = (serviceType: string) => {
    setDropdownOpen(false);
    navigate(`/estimates/new?serviceType=${serviceType}`);
  };

  const openEditPage = (row: QuotationListItemResponse) => {
    const id = (row as any).id ?? (row as any)._id;
    navigate(`/estimates/${id}/edit`);
  };

  // Delete modal handlers
  const openDeleteModal = (row: QuotationListItemResponse) => {
    setQuotationToDelete(row);
    setDeleteModalOpen(true);
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setQuotationToDelete(null);
  };

  const handleDeleteQuotation = async (id: string) => {
    await deleteQuotation(id);
    handleDeleteModalClose();
    void refresh();
  };

  const openMenu = (
    row: QuotationListItemResponse,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
    setMenuQuotation(row);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuQuotation(null);
  };

  const handleDownloadPdf = async (row: QuotationListItemResponse) => {
    const id = (row as any).id ?? (row as any)._id;
    const blob = await downloadQuotationPdf(id);

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quotation-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);

    closeMenu();
  };

  const actionsTemplate = (row: QuotationListItemResponse): JSX.Element => {
    const base =
      "inline-flex items-center justify-center rounded-lg border bg-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
    const btnCommon = "h-8 w-8 p-0 sm:h-7 sm:w-7 sm:p-0";

    const status = (row as any).status as QuotationStatusEnum | undefined;
    const canDelete = status === QuotationStatusEnum.Draft;

    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start flex-wrap max-[360px]:flex-col">
        {canDelete && (
          <button
            type="button"
            className={`${base} ${btnCommon} border-red-300 text-red-700 hover:bg-red-50`}
            title="Delete quotation"
            aria-label="Delete quotation"
            onClick={() => openDeleteModal(row)}
          >
            <Trash2 size={16} />
          </button>
        )}

        <button
          type="button"
          className={`${base} ${btnCommon} border-neutral-300 text-neutral-900 hover:bg-neutral-50`}
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
          onClick={(e) => openMenu(row, e)}
        >
          <MoreVertical size={16} />
        </button>
      </div>
    );
  };

  return (
    <>
      <DeleteQuotationModal
        open={deleteModalOpen}
        quotation={quotationToDelete as any}
        onClose={handleDeleteModalClose}
        onDelete={handleDeleteQuotation}
      />

      <AcceptQuotationModal
        open={acceptModalOpen}
        quotation={menuQuotation as any}
        onClose={() => setAcceptModalOpen(false)}
        onAccept={async (id: string) => {
          await acceptQuotation(id);
          setAcceptModalOpen(false);
          closeMenu();
          refresh();
        }}
      />

      <RejectQuotationModal
        open={rejectModalOpen}
        quotation={menuQuotation as any}
        onClose={() => setRejectModalOpen(false)}
        onReject={async (id: string) => {
          await rejectQuotation(id);
          setRejectModalOpen(false);
          closeMenu();
          refresh();
        }}
      />

      <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-[24px] font-semibold whitespace-normal break-words truncate">
              {headerTitle}
            </h1>
          </div>

          <div className="w-full flex flex-col gap-3">
            <div className="rounded-xl border border-neutral-200 bg-[#F8FAFC] px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-[#7C3AED] hover:bg-neutral-50"
                >
                  <SlidersHorizontal size={16} />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 rounded-full bg-[#7C3AED] px-2 py-[2px] text-xs font-semibold text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    disabled={activeFiltersCount === 0 && !global}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 disabled:text-neutral-300 disabled:border-neutral-200 disabled:bg-white disabled:cursor-default"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {filtersOpen && (
                <div className="mt-3 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Client
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All clients</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.clientName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Suppliers
                    </label>
                    <select
                      value={selectedShippingLineId}
                      onChange={(e) =>
                        handleShippingLineChange(e.target.value)
                      }
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All suppliers</option>
                      {shippingLines.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Agent
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => handleAgentChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All agents</option>
                      {agents.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Transit type
                    </label>
                    <select
                      value={selectedTransitType}
                      onChange={(e) => handleTransitTypeChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All types</option>
                      <option value={TransitTypeEnum.Air}>Air</option>
                      <option value={TransitTypeEnum.Land}>Land</option>
                      <option value={TransitTypeEnum.Maritime}>Maritime</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All statuses</option>
                      <option value={QuotationStatusEnum.Draft}>Draft</option>
                      <option value={QuotationStatusEnum.Sent}>Sent</option>
                      <option value={QuotationStatusEnum.Accepted}>
                        Accepted
                      </option>
                      <option value={QuotationStatusEnum.Rejected}>
                        Rejected
                      </option>
                      <option value={QuotationStatusEnum.Expired}>
                        Expired
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Created from
                    </label>
                    <Calendar
                      value={startDate}
                      onChange={(e) =>
                        handleStartDateChange(e.value as Date | null)
                      }
                      showIcon
                      className="w-full quotation-datepicker"
                      panelClassName="quotation-datepicker-panel"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Created to
                    </label>
                    <Calendar
                      value={endDate}
                      onChange={(e) =>
                        handleEndDateChange(e.value as Date | null)
                      }
                      showIcon
                      className="w-full quotation-datepicker"
                      panelClassName="quotation-datepicker-panel"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-auto" ref={dropdownRef}>
                <button
                  type="button"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                  title="Create quotation"
                  aria-label="Create quotation"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="listbox"
                  onClick={toggleDropdown}
                >
                  <span>+ Create Estimate</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full sm:w-56 rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
                    {loadingServiceTypes ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-6 bg-white">
                        <Loader2
                          size={18}
                          className="animate-spin text-neutral-400"
                        />
                        <span className="text-sm text-neutral-500">
                          Loading...
                        </span>
                      </div>
                    ) : serviceTypes.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-neutral-500 bg-white">
                        No service types available
                      </div>
                    ) : (
                      <ul className="py-1 bg-white" role="listbox">
                        {serviceTypes.map((st) => (
                          <li key={st.value}>
                            <button
                              type="button"
                              onClick={() => handleServiceTypeSelect(st.value)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
                              role="option"
                            >
                              <span className="text-lg">
                                {getServiceTypeIcon(st.value)}
                              </span>
                              <span className="font-medium">{st.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="relative w-full sm:max-w-sm">
                <input
                  value={global}
                  onChange={(e) => onGlobalChange(e.target.value)}
                  placeholder="Search..."
                  className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                  ⌘K
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
          <DataTable
            value={quotations}
            dataKey="id"
            lazy
            loading={isLoading || isLoadingHelpers}
            size="small"
            showGridlines
            removableSort
            className="text-sm min-w-0"
            filters={tableFilters}
            filterDisplay="menu"
            globalFilterFields={[
              "id",
              "client.name",
              "shippingLine.name",
              "agent.firstName",
              "agent.lastName",
              "notes",
              "status",
            ]}
            emptyMessage={
              <div className="py-8 text-center text-sm text-neutral-500">
                {error
                  ? "Error loading estimates. Try again."
                  : "No Estimates found."}
              </div>
            }
            paginator={total > quotations.length}
            first={(page - 1) * pageSize}
            rows={pageSize}
            totalRecords={total}
            onPage={(e) => {
              const newPage = Math.floor(e.first / e.rows) + 1;
              if (e.rows !== pageSize) setPageSize(e.rows);
              if (newPage !== page) setPage(newPage);
            }}
            pt={{
              root: { className: "rounded-xl overflow-hidden" },
              table: { className: "bg-white" },
              header: { className: "!bg-white !border-0" },
              thead: { className: "!bg-white" },
              paginator: {
                root: { className: paginatorRoot },
                firstPageButton: { className: paginatorBtn },
                prevPageButton: { className: paginatorBtn },
                nextPageButton: { className: paginatorBtn },
                lastPageButton: { className: paginatorBtn },
                pageButton: { className: paginatorBtn },
                rowsPerPageDropdown: { className: "ml-2" },
              },
            } as any}
          >
            <Column
              header="Client"
              sortable
              body={(row: QuotationListItemResponse) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {displayClient(row)}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "20%" }}
            />

            <Column
              header="Shipping line"
              sortable
              body={(row: QuotationListItemResponse) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {displayShippingLine(row)}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "20%" }}
            />

            <Column
              header="Agent"
              sortable
              body={(row: QuotationListItemResponse) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {displayAgent(row)}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "15%" }}
            />

            <Column
              header="Status"
              sortable
              body={(row: QuotationListItemResponse) => (
                <QuotationStatus
                  status={row.status || "-"}
                  className="truncate text-[13px] sm:text-[14px]"
                />
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Created at"
              sortable
              body={(row: QuotationListItemResponse) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {formatDate(row.createdAt)}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Valid until"
              sortable
              body={(row: QuotationListItemResponse) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {displayValidUntil(row)}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{
                paddingTop: 14,
                paddingBottom: 14,
                paddingRight: 32,
              }}
              bodyStyle={{ paddingRight: 32 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Actions"
              body={actionsTemplate}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!py-2 sm:!py-3 !px-3 sm:!px-8"
              headerStyle={{
                paddingTop: 14,
                paddingBottom: 14,
                paddingRight: 32,
              }}
              bodyStyle={{ paddingRight: 32 }}
              style={{ width: "10%" }}
            />
          </DataTable>
        </div>
      </div>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-48 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {menuQuotation?.status === QuotationStatusEnum.Sent && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:bg-green-50 focus:outline-none focus:ring-0 active:bg-green-50"
                  onClick={() => {
                    setAcceptModalOpen(true);
                  }}
                >
                  <CheckCircle2 size={16} />
                  Accept estimate
                </button>

                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:bg-red-50 focus:outline-none focus:ring-0 active:bg-red-50"
                  onClick={() => {
                    setRejectModalOpen(true);
                  }}
                >
                  <XCircle size={16} />
                  Reject estimate
                </button>
              </>
            )}

            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
              onClick={() => {
                if (menuQuotation) openEditPage(menuQuotation);
                closeMenu();
              }}
            >
              {menuQuotation?.status !== QuotationStatusEnum.Sent &&
                menuQuotation?.status !== QuotationStatusEnum.Accepted ? (
                <Pencil size={16} />
              ) : (
                <Eye size={16} />
              )}

              <span>
                {menuQuotation?.status !== QuotationStatusEnum.Sent &&
                  menuQuotation?.status !== QuotationStatusEnum.Accepted
                  ? "Edit"
                  : "View"}{" "}
                estimate
              </span>
            </button>
            {menuQuotation?.status !== QuotationStatusEnum.Draft && (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
                onClick={() => {
                  if (menuQuotation) handleDownloadPdf(menuQuotation);
                }}
              >
                <Download size={16} />
                Download Estimate
              </button>
            )}
            {(menuQuotation as any)?.sourcePricelistId && (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-neutral-200 px-3 py-2 text-left text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-0 active:bg-blue-50"
                onClick={() => {
                  navigate(`/pricing/quotations-sent?pricelistId=${(menuQuotation as any).sourcePricelistId}`);
                  closeMenu();
                }}
              >
                <FileText size={16} />
                Quotations Sent
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
