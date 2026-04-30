import { useState, useRef, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { Pencil, Trash2, UserPlus, Plus, Loader2, ArrowLeft, MoreVertical } from "lucide-react";
import { useOffices } from "../hooks/useOffice";
import type { Office } from "../utils/types/office.type";
import CreateOfficeModal from "../components/modals/Offices/CreateOfficeModal";
import "./OfficeScreen.css";
import DeleteOfficeModal from "../components/modals/Offices/DeleteOfficeModal";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";
import { useAuthStore } from "../stores/auth.store";
import HistoryModal from "../components/modals/HistoryModal";

export default function OfficeScreen() {
  const {
    offices,
    isLoading,
    error,
    refresh,
    deleteOffice,
    createOffice,
    updateOffice,
  } = useOffices();

  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const userPermissions = currentUser?.permissions ?? [];

  const [global, setGlobal] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [deleting, setDeleting] = useState<Office | null>(null);

  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    phone: { value: null, matchMode: FilterMatchMode.CONTAINS },
    type: { value: null, matchMode: FilterMatchMode.EQUALS },
    description: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  const handleAdd = () => setShowCreate(true);
  const handleEdit = (row: Office) => setEditing(row);
  const handleDelete = async (row: Office) => setDeleting(row);
  const handleAssignUsers = (row: Office) => navigate(`/offices/${row.id}/users`);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [menuOffice, setMenuOffice] = useState<Office | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryOffice, setSelectedHistoryOffice] = useState<Office | null>(null);

  const openMenu = (row: Office, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
    setMenuOffice(row);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuOffice(null);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent | globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const actionsTemplate = (row: Office) => (
    <div className="flex items-center justify-center sm:justify-start gap-2 flex-nowrap">
      <PermissionGate
        requiredPermission={PERMISSIONS.OFFICE_UPDATE}
        userPermissions={userPermissions}
      >
        <button
          type="button"
          onClick={() => handleEdit(row)}
          className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50"
          aria-label="Edit office"
        >
          <Pencil
            size={16}
            strokeWidth={2}
            style={{ color: "#111827", display: "block" }}
            aria-hidden
          />
        </button>
      </PermissionGate>
      <PermissionGate
        requiredPermission={PERMISSIONS.OFFICE_DELETE}
        userPermissions={userPermissions}
      >
        <button
          type="button"
          onClick={() => handleDelete(row)}
          className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-red-50"
          aria-label="Delete office"
        >
          <Trash2
            size={16}
            strokeWidth={2}
            style={{ color: "#DC2626", display: "block" }}
            aria-hidden
          />
        </button>
      </PermissionGate>

      <PermissionGate
        requiredPermission={PERMISSIONS.USER_READ}
        userPermissions={userPermissions}
      >
        <button
          type="button"
          onClick={() => handleAssignUsers(row)}
          className="inline-flex items-center justify-center border border-neutral-900 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50"
          aria-label="Assign users to the office"
        >
          <UserPlus
            size={16}
            strokeWidth={2}
            style={{ color: "#111827", display: "block" }}
            aria-hidden
          />
        </button>
      </PermissionGate>

      <button
        type="button"
        onClick={(e) => openMenu(row, e)}
        className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
        aria-haspopup="menu"
        aria-label="More actions"
      >
        <MoreVertical size={16} />
      </button>
    </div>
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


  console.log('hola')
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
          <h1 className="text-[24px] font-semibold truncate">Offices</h1>
        </div>

        <div className="flex flex-col w-full sm:w-auto sm:items-end gap-2">
          <div className="relative w-full sm:max-w-xs">
            <input
              value={global}
              onChange={(e) => onGlobalChange(e.target.value)}
              placeholder="Search offices..."
              className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              ⌘K
            </span>
          </div>
          <PermissionGate
            requiredPermission={PERMISSIONS.OFFICE_CREATE}
            userPermissions={userPermissions}>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              title="Create office"
              aria-label="Create office"
            >
              <Plus size={16} />
              <span>Add Office</span>
            </button>
          </PermissionGate>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
        <DataTable
          value={offices}
          loading={false}
          size="small"
          showGridlines
          removableSort
          className="text-sm min-w-0"
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={[
            "name",
            "address.street",
            "address.city",
            "address.state",
            "address.zipCode",
            "address.country",
            "phone",
            "type",
            "description",
            "email",
          ]}
          emptyMessage={
            <div className="py-8 text-center text-sm text-neutral-500">
              {error ? "Error loading offices. Try again." : "No offices found."}
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
            body={(row: Office) => (
              <span className="truncate text-[13px] sm:text-[14px]">{row.name}</span>
            )}
            bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "24px" }}
            bodyStyle={{ paddingLeft: "24px" }}
            style={{ width: "28%" }}
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
            field="type"
            header="Type"
            sortable
            className="hidden lg:table-cell"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: Office) => {
              const t = row.type ?? "";
              return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
            }}
            bodyClassName="hidden lg:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "12%" }}
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
            body={(row: Office) => (row.phone?.trim() ? row.phone : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "18%" }}
          />

          <Column
            field="email"
            header="Email"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: Office) => (row.email?.trim() ? row.email : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "30%" }}
          />

          <Column
            header="Actions"
            body={actionsTemplate}
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!py-2 sm:!py-3 !px-2 sm:!px-4"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "60%" }}
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

      <CreateOfficeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="create"
        createOffice={createOffice}
        onSaved={() => { refresh() }}
      />

      <CreateOfficeModal
        open={!!editing}
        onClose={() => setEditing(null)}
        mode="edit"
        office={editing}
        updateOffice={updateOffice}
        onSaved={() => { refresh() }}
      />

      <DeleteOfficeModal
        open={!!deleting}
        office={deleting}
        onClose={() => setDeleting(null)}
        onDelete={async (id: string) => {
          await deleteOffice(id);
          setDeleting(null);
          refresh();
        }}
      />

      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        entityType="office"
        entityId={selectedHistoryOffice?.id || ""}
        title={`Office History - ${selectedHistoryOffice?.name || ""}`}
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
                className="block w-full border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium bg-white text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0"
                onClick={() => {
                  setSelectedHistoryOffice(menuOffice);
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
