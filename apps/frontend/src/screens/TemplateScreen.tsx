/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { ArrowLeft, SlidersHorizontal, Pencil, Trash2, Plus } from "lucide-react";

import { TemplatesService } from "../services/templates.service";
import type { Template } from "../utils/types/template.type";
import { useAuthStore } from "../stores/auth.store";

import "./TemplatesScreen.css";
import DeleteTemplateModal from "../components/modals/Templates/DeleteTemplateModal";

const SERVICE_TYPE_ICONS: Record<string, string> = {
  FCL: "🚢",
  LCL: "📦",
  AIR: "✈️",
  FTL: "🚛",
  INSURANCE: "🛡️",
  CUSTOMS: "📋",
  "LOCAL_TRUCKING": "🚚",
  OTHER: "📦",
};

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const SHIPPING_MODES = ["maritime", "air", "road"];

export default function TemplatesScreen(): JSX.Element {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const companyId = (currentUser as any)?.company?._id ?? (currentUser as any)?.company?.id ?? null;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filtersOpen, setFiltersOpen] = useState(true);

  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedShippingMode, setSelectedShippingMode] = useState<string>("");
  const [selectedIsActive, setSelectedIsActive] = useState<string>("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

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

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const filters: any = {};
      
      if (selectedServiceType) filters.serviceType = selectedServiceType;
      if (selectedCategory) filters.category = selectedCategory;
      if (selectedShippingMode) filters.shippingMode = selectedShippingMode;
      if (selectedIsActive !== "") filters.isActive = selectedIsActive === "true";
      
      const data = await TemplatesService.find(filters);
      setTemplates(data);
    } catch (err: any) {
      console.error("Error fetching templates:", err);
      setError(err?.message ?? "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, [companyId, selectedServiceType, selectedCategory, selectedShippingMode, selectedIsActive]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleBack = () => navigate(-1);

  const handleServiceTypeChange = (value: string) => {
    setSelectedServiceType(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setPage(1);
  };

  const handleShippingModeChange = (value: string) => {
    setSelectedShippingMode(value);
    setPage(1);
  };

  const handleIsActiveChange = (value: string) => {
    setSelectedIsActive(value);
    setPage(1);
  };

  const clearAllFilters = () => {
    setSelectedServiceType("");
    setSelectedCategory("");
    setSelectedShippingMode("");
    setSelectedIsActive("");
    setGlobal("");
    setTableFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value: "" },
    }));
    setPage(1);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedServiceType) count++;
    if (selectedCategory) count++;
    if (selectedShippingMode) count++;
    if (selectedIsActive !== "") count++;
    return count;
  }, [selectedServiceType, selectedCategory, selectedShippingMode, selectedIsActive]);

  const headerTitle = useMemo(() => "Templates", []);

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

  const getServiceTypeIcon = (value: string): string => {
    return SERVICE_TYPE_ICONS[value] || "📦";
  };

  const displayServiceType = (row: Template) => {
    const icon = getServiceTypeIcon(row.serviceType);
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="truncate text-[13px] sm:text-[14px]">{row.serviceType}</span>
      </div>
    );
  };

  const displayShippingModes = (row: Template) => {
    if (!row.shippingModes || row.shippingModes.length === 0) return "—";
    return (
      <div className="flex flex-wrap gap-1">
        {row.shippingModes.map((mode) => (
          <span
            key={mode}
            className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] sm:text-xs font-medium text-neutral-700 capitalize"
          >
            {mode}
          </span>
        ))}
      </div>
    );
  };

  const displayStatus = (row: Template) => {
    const isActive = row.isActive ?? true;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] sm:text-xs font-medium ${
          isActive
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-neutral-100 text-neutral-600 border border-neutral-200"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
    );
  };

  const openEditPage = (row: Template) => {
    const id = (row as any).id ?? (row as any)._id;
    navigate(`/templates/${id}/edit`);
  };

  const openDeleteModal = (row: Template) => {
    setTemplateToDelete(row);
    setDeleteModalOpen(true);
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    await TemplatesService.remove(id);
    handleDeleteModalClose();
    void fetchTemplates();
  };

  const actionsTemplate = (row: Template): JSX.Element => {
    const base =
      "inline-flex items-center justify-center rounded-lg border bg-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
    const btnCommon = "h-8 w-8 p-0 sm:h-7 sm:w-7 sm:p-0";

    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start flex-wrap max-[360px]:flex-col">
        <button
          type="button"
          className={`${base} ${btnCommon} border-neutral-300 text-neutral-900 hover:bg-neutral-50`}
          title="Edit template"
          aria-label="Edit template"
          onClick={() => openEditPage(row)}
        >
          <Pencil size={16} />
        </button>

        <button
          type="button"
          className={`${base} ${btnCommon} border-red-300 text-red-700 hover:bg-red-50`}
          title="Delete template"
          aria-label="Delete template"
          onClick={() => openDeleteModal(row)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  // Filter templates based on global search
  const filteredTemplates = useMemo(() => {
    if (!global) return templates;

    const searchLower = global.toLowerCase();
    return templates.filter((template) => {
      const searchableFields = [
        template.name,
        template.serviceType,
        template.category,
        template.notes,
        ...(template.shippingModes || []),
      ];

      return searchableFields.some((field) =>
        field?.toLowerCase().includes(searchLower)
      );
    });
  }, [templates, global]);

  // Paginate filtered templates
  const paginatedTemplates = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTemplates.slice(startIndex, endIndex);
  }, [filteredTemplates, page, pageSize]);

  return (
    <>
      <DeleteTemplateModal
        open={deleteModalOpen}
        template={templateToDelete as any}
        onClose={handleDeleteModalClose}
        onDelete={handleDeleteTemplate}
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
                      Service Type
                    </label>
                    <select
                      value={selectedServiceType}
                      onChange={(e) => handleServiceTypeChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All service types</option>
                      {Object.keys(SERVICE_TYPE_ICONS).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Category (Incoterm)
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All categories</option>
                      {INCOTERMS.map((inc) => (
                        <option key={inc} value={inc}>
                          {inc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Shipping Mode
                    </label>
                    <select
                      value={selectedShippingMode}
                      onChange={(e) => handleShippingModeChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All suppliers</option>
                      {SHIPPING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-600">
                      Status
                    </label>
                    <select
                      value={selectedIsActive}
                      onChange={(e) => handleIsActiveChange(e.target.value)}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs sm:text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">All statuses</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => navigate("/templates/new")}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                title="Create template"
                aria-label="Create template"
              >
                <Plus size={16} />
                <span>Create Template</span>
              </button>

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
            value={paginatedTemplates}
            dataKey="_id"
            lazy
            loading={isLoading}
            size="small"
            showGridlines
            removableSort
            className="text-sm min-w-0"
            filters={tableFilters}
            filterDisplay="menu"
            globalFilterFields={["name", "serviceType", "category", "notes"]}
            emptyMessage={
              <div className="py-8 text-center text-sm text-neutral-500">
                {error ? "Error loading templates. Try again." : "No templates found."}
              </div>
            }
            paginator={filteredTemplates.length > pageSize}
            first={(page - 1) * pageSize}
            rows={pageSize}
            totalRecords={filteredTemplates.length}
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
              header="Name"
              sortable
              body={(row: Template) => (
                <span className="truncate text-[13px] sm:text-[14px] font-medium">
                  {row.name}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "25%" }}
            />

            <Column
              header="Service Type"
              sortable
              body={displayServiceType}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "15%" }}
            />

            <Column
              header="Category"
              sortable
              body={(row: Template) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {row.category}
                </span>
              )}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Shipping Modes"
              body={displayShippingModes}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "15%" }}
            />

            <Column
              header="Status"
              sortable
              body={displayStatus}
              headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
              bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
              headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
              style={{ width: "10%" }}
            />

            <Column
              header="Created at"
              sortable
              body={(row: Template) => (
                <span className="truncate text-[13px] sm:text-[14px]">
                  {formatDate((row as any).createdAt)}
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
              style={{ width: "10%" }}
            />
          </DataTable>
        </div>
      </div>
    </>
  );
}