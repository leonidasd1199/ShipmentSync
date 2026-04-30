/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";

import { useOffices } from "../hooks/useOffice";
import { useAuthStore } from "../stores/auth.store";
import { useUser } from "../hooks/useUser"; // 👈 NUEVO

import CreateEditUserModal from "../components/modals/Users/CreateEditUserModal";
import type { OfficeUser } from "../utils/types/office.type";
import DisableUserFromOfficeModal from "../components/modals/Users/DisableUserFromOfficeModal";
import AssignUserToOfficeModal from "../components/modals/Users/AssignUserToOfficeModal";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";

export default function OfficeUsersScreen() {
  const { id: officeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const userPermissions = currentUser?.permissions ?? [];

  const { getOfficeUsers, getOffice, assignNewUser } = useOffices({ autoload: false });

  // 👇 sacamos updateUser del hook useUser
  const { updateUser } = useUser({ autoload: false });

  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [officeName, setOfficeName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<OfficeUser | null>(null);

  const [removing, setRemoving] = useState<OfficeUser | null>(null);

  const [showAddUsers, setShowAddUsers] = useState(false);

  const [global, setGlobal] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    email: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  const load = useCallback(async () => {
    if (!officeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [usersResp, officeResp] = await Promise.all([
        getOfficeUsers(officeId),
        getOffice(officeId).catch(() => null),
      ]);
      setUsers(usersResp ?? []);
      setOfficeName((officeResp as any)?.name ?? (officeResp as any)?.data?.name ?? "");
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [getOfficeUsers, getOffice, officeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = (u: OfficeUser) =>
    u.name?.trim() || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—";

  const isSelf = (row: OfficeUser) =>
    (currentUser?.email ?? "").toLowerCase() === (row.email ?? "").toLowerCase();

  const handleBack = () => navigate("/offices");

  const handleAddUser = () => {
    if (!officeId) return;
    setEditingUser(null);
    setUserModalMode("create");
    setUserModalOpen(true);
  };

  const handleEditUser = (row: OfficeUser) => {
    setEditingUser(row);
    setUserModalMode("edit");
    setUserModalOpen(true);
  };

  const actionsTemplate = (row: OfficeUser) => {
    const disabled = isSelf(row);

    const base =
      "inline-flex items-center justify-center rounded-lg border bg-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
    const btnCommon = "h-8 w-8 p-0 sm:h-7 sm:w-7 sm:p-0";

    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start flex-wrap max-[360px]:flex-col">
        <PermissionGate
          requiredPermission={PERMISSIONS.USER_UPDATE}
          userPermissions={userPermissions}
        >
          <button
            type="button"
            onClick={() => handleEditUser(row)}
            disabled={disabled}
            className={`${base} ${btnCommon} border-neutral-300 text-neutral-900 hover:bg-neutral-50`}
            title="Edit user"
            aria-label="Edit user"
          >
            <Pencil size={16} />
          </button>
        </PermissionGate>

        <PermissionGate
          requiredPermission={PERMISSIONS.USER_DELETE}
          userPermissions={userPermissions}
        >
          <button
            type="button"
            onClick={() => setRemoving(row)}
            disabled={disabled}
            className={`${base} ${btnCommon} border-red-300 text-red-700 hover:bg-red-50`}
            title="Delete user"
            aria-label="Delete user"
          >
            <Trash2 size={16} />
          </button>
        </PermissionGate>
      </div>
    );
  };

  const headerTitle = useMemo(() => {
    if (officeName) return `Office Users — ${officeName}`;
    if (officeId) return `Office Users — ${officeId}`;
    return "Office Users";
  }, [officeId, officeName]);

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
      {/* Header / Search / Actions */}
      <div className="mb-4 flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            title="Back to Offices"
            aria-label="Back to Offices"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[24px] font-semibold whitespace-normal break-words truncate">
            {headerTitle}
          </h1>
        </div>

        <div className="w-full sm:flex sm:items-start sm:justify-between">
          {/* Search box */}
          <div className="relative w-full sm:max-w-sm sm:ml-0">
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

          {/* Actions */}
          <div className="mt-2 sm:mt-0 sm:ml-4 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center sm:justify-end w-full sm:w-auto">
            <PermissionGate
              requiredPermission={PERMISSIONS.USER_CREATE}
              userPermissions={userPermissions}
            >
              <button
                type="button"
                onClick={handleAddUser}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                title="Create user for office"
                aria-label="Create user for office"
              >
                <Plus size={16} />
                <span className="inline">Create User</span>
              </button>
            </PermissionGate>

            <PermissionGate
              requiredPermission={PERMISSIONS.OFFICE_UPDATE}
              userPermissions={userPermissions}
            >
              <button
                type="button"
                onClick={() => setShowAddUsers(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                title="Add existing user"
                aria-label="Add existing user"
              >
                <Plus size={16} />
                <span className="inline">Add User</span>
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
        <DataTable
          value={users}
          loading={isLoading}
          size="small"
          showGridlines
          removableSort
          className="text-sm min-w-0"
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={["name", "firstName", "lastName", "email", "phone"]}
          emptyMessage={
            <div className="py-8 text-center text-sm text-neutral-500">
              {error ? "Error loading users. Try again." : "No users found for this office."}
            </div>
          }
          pt={{
            root: { className: "rounded-xl overflow-hidden" },
            table: { className: "bg-white" },
            header: { className: "!bg-white !border-0" },
            thead: { className: "!bg-white" },
          }}
        >
          <Column
            field="name"
            header="Name"
            sortable
            body={(row: OfficeUser) => (
              <span className="truncate text-[13px] sm:text-[14px]">{displayName(row)}</span>
            )}
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "24px" }}
            bodyStyle={{ paddingLeft: "24px" }}
            style={{ width: "46%" }}
          />

          <Column
            field="email"
            header="Email"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: OfficeUser) => (row.email?.trim() ? row.email : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "20%" }}
          />

          <Column
            field="phone"
            header="Phone"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: OfficeUser) => (row.phone?.trim() ? row.phone : "—")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "14%" }}
          />

          <Column
            field="isActive"
            header="Status"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: OfficeUser) => (row.isActive === false ? "Inactive" : "Active")}
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "10%" }}
          />

          <Column
            field="lastLoginAt"
            header="Last login"
            sortable
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: OfficeUser) =>
              row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : "—"
            }
            bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3 !whitespace-nowrap !overflow-hidden !text-ellipsis"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "16%" }}
          />

          <Column
            header="Actions"
            body={actionsTemplate}
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!py-2 sm:!py-3 !px-3 sm:!px-8"
            headerStyle={{
              paddingTop: "14px",
              paddingBottom: "14px",
              paddingRight: "32px",
            }}
            bodyStyle={{
              paddingRight: "32px",
            }}
            style={{ width: "38%" }}
          />
        </DataTable>
      </div>

      <div className="mt-3 text-center sm:text-right">
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          title="Reload"
        >
          Reload
        </button>
      </div>
      <CreateEditUserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        mode={userModalMode}
        officeId={officeId!}
        user={editingUser}
        assignNewUser={assignNewUser}
        updateUser={updateUser}
        onSaved={() => {
          setUserModalOpen(false);
          void load();
        }}
      />

      <DisableUserFromOfficeModal
        open={!!removing}
        officeId={officeId}
        user={removing}
        onClose={() => setRemoving(null)}
        onRemoved={(userId: string) =>
          setUsers((prev) => prev.filter((u) => u._id !== userId))
        }
      />

      <AssignUserToOfficeModal
        open={showAddUsers}
        officeId={officeId!}
        companyId={currentUser?.company?.id || ""}
        existingUsers={users}
        onClose={() => setShowAddUsers(false)}
        onAdded={() => {
          void load();
        }}
      />
    </div>
  );
}
