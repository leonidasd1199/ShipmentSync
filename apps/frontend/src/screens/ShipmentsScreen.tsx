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
import {
  ArrowLeft,
  SlidersHorizontal,
  Pencil,
  MoreVertical,
  Eye,
  Ship,
  Plane,
  Truck,
  Globe,
} from "lucide-react";

import { useShipments } from "../hooks/useShipments";
import type { Shipment } from "../utils/types/shipment.type";
import { ShipmentStatusEnum, ShipmentModeEnum } from "../utils/constants";

import "./QuotationsScreen.css";

type MenuPos = { top: number; left: number };

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  [ShipmentStatusEnum.DRAFT]: {
    dot: "bg-neutral-400",
    text: "text-neutral-600",
    label: "Draft",
  },
  [ShipmentStatusEnum.READY_FOR_FINANCE]: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    label: "Ready for Finance",
  },
  [ShipmentStatusEnum.FINANCE_REVIEW]: {
    dot: "bg-orange-500",
    text: "text-orange-700",
    label: "Finance Review",
  },
  [ShipmentStatusEnum.APPROVED]: {
    dot: "bg-green-600",
    text: "text-green-700",
    label: "Approved",
  },
  [ShipmentStatusEnum.CLOSED]: {
    dot: "bg-neutral-700",
    text: "text-neutral-700",
    label: "Closed",
  },
};

const MODE_ICONS: Record<string, JSX.Element> = {
  [ShipmentModeEnum.OCEAN]: <Ship size={14} className="text-blue-500" />,
  [ShipmentModeEnum.AIR]: <Plane size={14} className="text-sky-500" />,
  [ShipmentModeEnum.LAND]: <Truck size={14} className="text-orange-500" />,
  [ShipmentModeEnum.MULTIMODAL]: <Globe size={14} className="text-purple-500" />,
};

function ShipmentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    dot: "bg-neutral-400",
    text: "text-neutral-600",
    label: status,
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
      <span className={`text-xs font-semibold ${style.text} whitespace-nowrap`}>
        {style.label.toUpperCase()}
      </span>
    </div>
  );
}

export default function ShipmentsScreen(): JSX.Element {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShipment, setMenuShipment] = useState<Shipment | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMode, setSelectedMode] = useState("");

  const [global, setGlobal] = useState("");
  const [tableFilters, setTableFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
  });

  const { shipments, isLoading, error, applyFilters, setFilters, refresh } =
    useShipments({ autoload: true });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen) return;

    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMenuShipment(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMenuShipment(null);
      }
    };
    const onScroll = () => {
      setMenuOpen(false);
      setMenuShipment(null);
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  const handleStatusChange = useCallback(
    (value: string) => {
      setSelectedStatus(value);
      applyFilters({ status: value || undefined });
    },
    [applyFilters],
  );

  const handleModeChange = useCallback(
    (value: string) => {
      setSelectedMode(value);
      applyFilters({ mode: value || undefined });
    },
    [applyFilters],
  );

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setTableFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  const clearAllFilters = () => {
    setSelectedStatus("");
    setSelectedMode("");
    setGlobal("");
    setTableFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value: "" },
    }));
    setFilters({});
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatus) count++;
    if (selectedMode) count++;
    return count;
  }, [selectedStatus, selectedMode]);

  const openMenu = (row: Shipment, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
    setMenuShipment(row);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuShipment(null);
  };

  const formatDate = (value: string | undefined) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();
    return `${day}/${month}/${year}`;
  };

  const paginatorBtn =
    "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-8 w-8 p-0";
  const paginatorRoot =
    "flex items-center justify-center gap-1 py-2 bg-white";

  const actionsTemplate = (row: Shipment): JSX.Element => {
    const base =
      "inline-flex items-center justify-center rounded-lg border bg-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
    const btnCommon = "h-8 w-8 p-0 sm:h-7 sm:w-7";

    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        {row.status === ShipmentStatusEnum.DRAFT && (
          <button
            type="button"
            className={`${base} ${btnCommon} border-neutral-300 text-neutral-700 hover:bg-neutral-50`}
            title="Edit shipment"
            aria-label="Edit shipment"
            onClick={() => navigate(`/shipments/${row._id}/edit`)}
          >
            <Pencil size={15} />
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
          <MoreVertical size={15} />
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-[24px] font-semibold whitespace-normal break-words truncate">
              Shipments
            </h1>
          </div>

          <div className="w-full flex flex-col gap-3">
            {/* Filter panel */}
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
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {filtersOpen && (
                <div className="mt-3 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                      <option value={ShipmentStatusEnum.DRAFT}>Draft</option>
                      <option value={ShipmentStatusEnum.READY_FOR_FINANCE}>
                        Ready for Finance
                      </option>
                      <option value={ShipmentStatusEnum.FINANCE_REVIEW}>
                        Finance Review
                      </option>
                      <option value={ShipmentStatusEnum.APPROVED}>
                        Approved
                      </option>
                      <option value={ShipmentStatusEnum.CLOSED}>Closed</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Mode
                    </label>
                    <select
                      value={selectedMode}
                      onChange={(e) => handleModeChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All modes</option>
                      <option value={ShipmentModeEnum.OCEAN}>Ocean</option>
                      <option value={ShipmentModeEnum.AIR}>Air</option>
                      <option value={ShipmentModeEnum.LAND}>Land</option>
                      <option value={ShipmentModeEnum.MULTIMODAL}>
                        Multimodal
                      </option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                onClick={() => navigate("/shipments/new")}
              >
                + Create Shipment
              </button>

              <div className="relative w-full sm:max-w-sm">
                <input
                  value={global}
                  onChange={(e) => onGlobalChange(e.target.value)}
                  placeholder="Search booking, MBL, HBL..."
                  className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                  ⌘K
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
          <DataTable
            value={shipments}
            dataKey="_id"
            loading={isLoading}
            size="small"
            showGridlines
            removableSort
            className="text-sm min-w-0"
            filters={tableFilters}
            filterDisplay="menu"
            globalFilterFields={[
              "bookingNumber",
              "mblNumber",
              "hblNumber",
              "incoterm",
              "mode",
              "parties.shipper.name",
              "parties.consignee.name",
            ]}
            emptyMessage={
              <div className="py-10 flex flex-col items-center gap-3 text-sm">
                {error ? (
                  <>
                    <span className="text-red-500 font-medium">
                      {(error as any)?.response?.data?.message
                        ?? (error as any)?.message
                        ?? "Error loading shipments."}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <span className="text-neutral-500">No shipments found.</span>
                )}
              </div>
            }
            paginator={shipments.length > 10}
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
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
              header="Booking / MBL"
              sortable
              body={(row: Shipment) => (
                <div className="flex flex-col gap-0.5">
                  <span className="truncate text-[13px] sm:text-[14px] font-medium">
                    {row.bookingNumber ?? row.mblNumber ?? "—"}
                  </span>
                  {row.hblNumber && (
                    <span className="text-[11px] text-neutral-500 truncate">
                      HBL: {row.hblNumber}
                    </span>
                  )}
                </div>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "20%" }}
            />

            <Column
              header="Mode"
              sortable
              field="mode"
              body={(row: Shipment) => (
                <div className="flex items-center gap-1.5">
                  {MODE_ICONS[row.mode] ?? null}
                  <span className="text-[13px] sm:text-[14px]">{row.mode}</span>
                </div>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Incoterm"
              sortable
              field="incoterm"
              body={(row: Shipment) => (
                <span className="truncate text-[13px] sm:text-[14px] font-mono font-medium">
                  {row.incoterm ?? "—"}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "8%" }}
            />

            <Column
              header="Shipper"
              sortable
              body={(row: Shipment) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {row.parties?.shipper?.name ?? "—"}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "18%" }}
            />

            <Column
              header="Consignee"
              sortable
              body={(row: Shipment) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {row.parties?.consignee?.name ?? "—"}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "18%" }}
            />

            <Column
              header="Status"
              sortable
              field="status"
              body={(row: Shipment) => (
                <ShipmentStatusBadge status={row.status} />
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "14%" }}
            />

            <Column
              header="Created at"
              sortable
              body={(row: Shipment) => (
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
              style={{ width: "8%" }}
            />
          </DataTable>
        </div>
      </div>

      {/* Context menu portal */}
      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none"
              onClick={() => {
                if (menuShipment) {
                  navigate(
                    menuShipment.status === ShipmentStatusEnum.DRAFT
                      ? `/shipments/${menuShipment._id}/edit`
                      : `/shipments/${menuShipment._id}/edit`,
                  );
                }
                closeMenu();
              }}
            >
              {menuShipment?.status === ShipmentStatusEnum.DRAFT ? (
                <Pencil size={15} />
              ) : (
                <Eye size={15} />
              )}
              <span>
                {menuShipment?.status === ShipmentStatusEnum.DRAFT
                  ? "Edit shipment"
                  : "View shipment"}
              </span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
