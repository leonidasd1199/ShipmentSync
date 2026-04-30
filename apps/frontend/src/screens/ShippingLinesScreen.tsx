/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Users, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useShipping } from "../hooks/useShipping";
import type { ShippingLine } from "../utils/types/shipping.type";

import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";
import { useAuthStore } from "../stores/auth.store";
import CreateEditShippingModal from "../components/modals/ShippingLines/CreateEditShippingLinesModal";
import DeleteShippingLinesModal from "../components/modals/ShippingLines/DeleteShippingLinesModal";
import HistoryModal from "../components/modals/HistoryModal";

type MenuPos = { top: number; left: number };

export default function ShippingLinesScreen() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const userPermissions = currentUser?.permissions ?? [];

  const {
    shippings,
    isLoading,
    error,
    refresh,
    createShipping,
    updateShipping,
    deleteShipping,
  } = useShipping({ autoload: true });

  const [global, setGlobal] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    email: { value: null, matchMode: FilterMatchMode.CONTAINS },
    phone: { value: null, matchMode: FilterMatchMode.CONTAINS },
    website: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  const canCreate = userPermissions.includes(PERMISSIONS.SHIPPING_CREATE);
  const canUpdate = userPermissions.includes(PERMISSIONS.SHIPPING_UPDATE);
  const canDelete = userPermissions.includes(PERMISSIONS.SHIPPING_DELETE);

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingLine | null>(null);
  const [deleting, setDeleting] = useState<ShippingLine | null>(null);

  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryShipping, setSelectedHistoryShipping] = useState<ShippingLine | null>(null);

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShipping, setMenuShipping] = useState<ShippingLine | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openMenu = (row: ShippingLine, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
    setMenuShipping(row);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuShipping(null);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent | globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    const onScroll = () => closeMenu();
    const onResize = () => closeMenu();

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

  const openCreate = () => setCreatingOpen(true);
  const closeCreate = () => setCreatingOpen(false);

  const openEdit = (row: ShippingLine) => setEditing(row);
  const closeEdit = () => setEditing(null);

  const openDelete = (row: ShippingLine) => setDeleting(row);
  const closeDelete = () => setDeleting(null);

  const onConfirmDelete = useCallback(
    async (id: string) => {
      await deleteShipping(id);
      closeDelete();
      refresh();
    },
    [deleteShipping, refresh]
  );

  const MobileLoaderCell = () =>
    isLoading ? (
      <div className="w-full flex items-center justify-center py-1.5">
        <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
      </div>
    ) : null;

  const DesktopLoaderCell = () =>
    isLoading ? (
      <div className="w-full flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
      </div>
    ) : null;

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[24px] font-semibold truncate">Suppliers</h1>
        </div>

        <div className="flex flex-col w-full sm:w-auto sm:items-end gap-2">
          <div className="relative w-full sm:max-w-xs">
            <input
              value={global}
              onChange={(e) => onGlobalChange(e.target.value)}
              placeholder="Search..."
              className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <PermissionGate
            requiredPermission={PERMISSIONS.SHIPPING_CREATE}
            userPermissions={userPermissions}
          >
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              title="Create shipping line"
              aria-label="Create shipping line"
            >
              <Plus size={16} />
              <span>Add Supplier</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
        <DataTable
          value={shippings}
          loading={isLoading}
          size="small"
          showGridlines
          className="text-sm min-w-0"
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={["name", "email", "phone", "website", "notes", "shippingModes"]}
          emptyMessage={
            <div className="py-8 text-center text-sm text-neutral-500">
              {error ? "Error loading shipping lines. Try again." : "No shipping lines found."}
            </div>
          }
          pt={{
            root: { className: "rounded-xl overflow-hidden" },
            table: { className: "bg-white" },
            header: { className: "!bg-white !border-0" },
            thead: { className: "!bg-white" },
          }}
          onValueChange={() => { }}
        >
          <Column
            field="name"
            header="Name"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: ShippingLine) => (
              <span className="truncate text-[13px] sm:text-[14px]">{row.name}</span>
            )}
            bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "24px" }}
            bodyStyle={{ paddingLeft: "24px" }}
            style={{ width: "26%" }}
          />

          <Column
            header=""
            body={MobileLoaderCell}
            className="table-cell lg:hidden text-center"
            headerClassName="lg:hidden !bg-[#F8FAFC]"
            bodyClassName="lg:hidden !py-2 sm:!py-3"
            style={{ width: "1%" }}
          />

          <Column
            field="shippingModes"
            header="Modes"
            sortable
            className="hidden lg:table-cell"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: ShippingLine) =>
              row.shippingModes?.length
                ? row.shippingModes.join(", ")
                : "—"
            }
            bodyClassName="hidden lg:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "18%" }}
          />

          <Column
            header=""
            body={DesktopLoaderCell}
            className="hidden lg:table-cell text-center"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC]"
            bodyClassName="hidden lg:table-cell !py-2 sm:!py-3"
            style={{ width: "6%" }}
          />

          <Column
            field="phone"
            header="Phone"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: ShippingLine) => (row.phone?.trim() ? row.phone : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "14%" }}
          />

          <Column
            field="email"
            header="Email"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: ShippingLine) => (row.email?.trim() ? row.email : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "22%" }}
          />

          <Column
            field="website"
            header="Website"
            sortable
            className="hidden md:table-cell"
            headerClassName="hidden md:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: ShippingLine) =>
              row.website?.trim() ? (
                <a
                  href={row.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-neutral-300 hover:decoration-neutral-700"
                >
                  {row.website}
                </a>
              ) : (
                "—"
              )
            }
            bodyClassName="hidden md:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "22%" }}
          />

          <Column
            header="Actions"
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!py-2 sm:!py-3 !px-2 sm:!px-4"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "16%" }}
            body={(row: ShippingLine) => (
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <PermissionGate
                  requiredPermission={PERMISSIONS.SHIPPING_UPDATE}
                  userPermissions={userPermissions}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                    aria-label="Edit shipping"
                    title="Edit shipping"
                  >
                    <Pencil size={16} strokeWidth={2} style={{ color: "#111827", display: "block" }} />
                  </button>
                </PermissionGate>

                <PermissionGate
                  requiredPermission={PERMISSIONS.SHIPPING_DELETE}
                  userPermissions={userPermissions}
                >
                  <button
                    type="button"
                    onClick={() => openDelete(row)}
                    className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-red-50 rounded-md"
                    aria-label="Delete shipping"
                    title="Delete shipping"
                  >
                    <Trash2 size={16} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                  </button>
                </PermissionGate>

                <PermissionGate
                  requiredPermission={PERMISSIONS.AGENT_LIST}
                  userPermissions={userPermissions}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/suppliers/${row._id}/agents`)}
                    className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                    aria-label="View agents"
                    title="View agents"
                  >
                    <Users size={16} strokeWidth={2} style={{ color: "#111827", display: "block" }} />
                  </button>
                </PermissionGate>

                <button
                  type="button"
                  onClick={(e) => openMenu(row, e)}
                  className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                  aria-haspopup="menu"
                  aria-label="More actions"
                  title="More"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            )}
          />
        </DataTable>
      </div>

      <div className="mt-3 text-center sm:text-right">
        <button
          type="button"
          onClick={refresh}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          title="Reload"
        >
          Reload
        </button>
      </div>

      <CreateEditShippingModal
        open={creatingOpen && canCreate}
        onClose={closeCreate}
        mode="create"
        onSaved={() => refresh()}
        createShipping={createShipping}
      />

      <CreateEditShippingModal
        open={!!editing && canUpdate}
        onClose={closeEdit}
        mode="edit"
        shipping={editing || undefined}
        onSaved={() => refresh()}
        updateShipping={updateShipping}
      />

      <DeleteShippingLinesModal
        open={!!deleting && canDelete}
        shipping={deleting}
        onClose={closeDelete}
        onDelete={onConfirmDelete}
      />

      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        entityType="shipping"
        entityId={selectedHistoryShipping?._id || ""}
        title={`Supplier History - ${selectedHistoryShipping?.name || ""}`}
      />

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 w-44 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <PermissionGate
              requiredPermission={PERMISSIONS.AUDIT_VIEW}
              userPermissions={userPermissions}
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
                onClick={() => {
                  setSelectedHistoryShipping(menuShipping);
                  setShowHistory(true);
                  closeMenu();
                }}
              >
                History
              </button>
            </PermissionGate>
          </div>,
          document.body
        )}
    </div>
  );
}
