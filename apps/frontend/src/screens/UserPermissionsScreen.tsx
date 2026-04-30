/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { ArrowLeft, Loader2, ScanEye, MoreVertical } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { usePermissions } from "../hooks/usePermissions";
import type { User } from "../utils/types/user.type";
import { useNavigate } from "react-router-dom";
import AssignPermissionsToUserModal from "../components/modals/Users/AssignPermissionstoUserModal";
import HistoryModal from "../components/modals/HistoryModal";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";

export default function UserPermissions() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const companyId =
    (currentUser as any)?.company?._id ??
    (currentUser as any)?.company?.id ??
    null;

  const {
    users,
    permissions: allPermissions,
    isLoading,
    error,
    refresh,
    fetchCompanyUsers,
    assignPermissions,
    removePermissions,
  } = usePermissions({
    autoload: !!companyId,
    companyId,
  });

  const [global, setGlobal] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
    firstName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    lastName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    email: { value: null, matchMode: FilterMatchMode.CONTAINS },
    phone: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    if (companyId) void fetchCompanyUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  const currentUserId = (currentUser as any)?._id ?? (currentUser as any)?.id;

  const usersMapped = useMemo(() => {
    return (users ?? []).map((u: User & { office_disabled?: boolean }) => {
      const id = (u as any)._id ?? (u as any).id;
      const phone = (u as any).phone ?? "";
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
      return { ...u, id, phone, fullName };
    });
  }, [users]);

  // ===== Modal state =====
  const [modalOpen, setModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<{
    id: string;
    name: string;
    email: string;
    permissions: string[];
  } | null>(null);

  const handleViewPermissions = useCallback((row: any) => {
    const name = row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ");
    setTargetUser({
      id: row.id,
      name,
      email: row.email ?? "",
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    });
    setModalOpen(true);
  }, []);

  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [menuUser, setMenuUser] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openMenu = (row: any, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
    setMenuUser(row);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuUser(null);
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

  const ActionsCell = (row: any) => {
    const isSelf = row.id === currentUserId;
    return (
      <div className="flex items-center justify-end sm:justify-start gap-2 flex-nowrap">
        <button
          type="button"
          onClick={() => !isSelf && handleViewPermissions(row)}
          disabled={isSelf}
          className={`inline-flex items-center justify-center border h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none rounded
            ${isSelf
              ? "border-neutral-200 bg-neutral-100 cursor-not-allowed opacity-60"
              : "border-neutral-300 bg-white hover:bg-neutral-50"
            }`}
          aria-label="View permissions"
          title={isSelf ? "You cannot manage your own permissions" : "View permissions"}
        >
          <ScanEye size={16} strokeWidth={2} style={{ color: "#111827", display: "block" }} aria-hidden />
        </button>

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
  };

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
          <h1 className="text-[24px] font-semibold truncate">User Permissions</h1>
        </div>

        <div className="flex flex-col w-full sm:w-auto sm:items-end gap-2">
          <div className="relative w-full sm:max-w-xs">
            <input
              value={global}
              onChange={(e) => onGlobalChange(e.target.value)}
              placeholder="Search users..."
              className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0">
        <DataTable
          value={usersMapped}
          loading={isLoading}
          size="small"
          showGridlines
          removableSort
          className="text-sm min-w-0"
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={["fullName", "firstName", "lastName", "email", "phone"]}
          emptyMessage={
            <div className="py-8 text-center text-sm text-neutral-500">
              {error ? "Error loading users. Try again." : "No users found."}
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
            field="fullName"
            header="Name"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: any) => (
              <span className="truncate text-[13px] sm:text-[14px]">
                {row.fullName || "—"}
              </span>
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
            header=""
            body={DesktopLoaderCell}
            className="hidden lg:table-cell text-center"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC]"
            bodyClassName="hidden lg:table-cell !py-2 sm:!py-3"
            style={{ width: "6%" }}
          />

          <Column
            field="email"
            header="Email"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: any) => (row.email?.trim() ? row.email : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "28%" }}
          />

          <Column
            field="phone"
            header="Phone"
            sortable
            className="hidden lg:table-cell"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: any) => (row.phone?.trim() ? row.phone : "—")}
            bodyClassName="hidden lg:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "18%" }}
          />

          <Column
            header="Actions"
            body={ActionsCell}
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!py-2 sm:!py-3 !px-2 sm:!px-4"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "20%" }}
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

      <AssignPermissionsToUserModal
        open={modalOpen && !!targetUser}
        onClose={() => setModalOpen(false)}
        userId={targetUser?.id || ""}
        userName={targetUser?.name}
        userEmail={targetUser?.email}
        userPermissions={targetUser?.permissions || []}
        allPermissions={allPermissions || []}
        onAssign={assignPermissions}
        onRemove={removePermissions}
        onSaved={async () => {
          await refresh();
        }}
      />

      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        entityType="user"
        entityId={selectedHistoryUser?.id || ""}
        title={`User History - ${selectedHistoryUser?.fullName || ""}`}
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
            userPermissions={currentUser?.permissions ?? []}
          >
            <button
              type="button"
              className="block w-full border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium bg-white text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0"
              onClick={() => {
                setSelectedHistoryUser(menuUser);
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
