import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { Pencil, Trash2, MoreVertical, Plus, ArrowLeft } from "lucide-react";
import type { Client } from "../utils/types/client.type";
import CreateEditClientModal from "../components/modals/Clients/CreateEditClientModal";
import DeleteClientModal from "../components/modals/Clients/DeleteClientModal";
import HistoryModal from "../components/modals/HistoryModal";
import { useClients } from "../hooks/useClient";
import { useNavigate } from "react-router-dom";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";
import { useAuthStore } from "../stores/auth.store";

type MenuPos = { top: number; left: number };

export default function ClientScreen() {
    const {
        clients,
        isLoading,
        error,
        refresh,
        deleteClient,
        createClient,
        updateClient,
    } = useClients();

    const { user } = useAuthStore();
    const userPermissions = user?.permissions || [];

    const navigate = useNavigate();

    const [global, setGlobal] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);
    const [deleting, setDeleting] = useState<Client | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedHistoryClient, setSelectedHistoryClient] = useState<Client | null>(null);

    const [menuOpen, setMenuOpen] = useState(false);
    const [menuClient, setMenuClient] = useState<Client | null>(null);
    const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement | null>(null);

    const openMenu = (row: Client, e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // Posicionar el menú debajo y alineado al botón
        setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width }); // ajusta -120 si querés más a la izquierda
        setMenuClient(row);
        setMenuOpen(true);
    };

    const closeMenu = () => {
        setMenuOpen(false);
        setMenuClient(null);
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

    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: "", matchMode: FilterMatchMode.CONTAINS },
        name: { value: null, matchMode: FilterMatchMode.CONTAINS },
        contactPerson: { value: null, matchMode: FilterMatchMode.CONTAINS },
        email: { value: null, matchMode: FilterMatchMode.CONTAINS },
        phone: { value: null, matchMode: FilterMatchMode.CONTAINS },
        taxId: { value: null, matchMode: FilterMatchMode.CONTAINS },
        isActive: { value: null, matchMode: FilterMatchMode.EQUALS },
    });

    const onGlobalChange = (value: string) => {
        setGlobal(value);
        setFilters((prev) => ({
            ...prev,
            global: { ...prev.global, value },
        }));
    };

    const renderOffice = (row: Client) => {
        const name = row.officeName;
        return name ?? row.officeId ?? "—";
    };

    const actionsTemplate = (row: Client) => (
        <div className="flex items-center gap-2">
            <PermissionGate requiredPermission={PERMISSIONS.CLIENT_UPDATE} userPermissions={userPermissions} >
                <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="inline-flex items-center justify-center border border-neutral-300 bg-white h-8 w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                    aria-label="Edit client"
                    title="Edit"
                >
                    <Pencil size={16} strokeWidth={2} style={{ color: "#111827", display: "block" }} />
                </button>
            </PermissionGate>

            <PermissionGate requiredPermission={PERMISSIONS.CLIENT_DELETE} userPermissions={userPermissions} >
                <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    className="inline-flex items-center justify-center border border-red-300 bg-white h-8 w-8 p-0 leading-none hover:bg-red-50 rounded-md"
                    aria-label="Delete client"
                    title="Delete"
                >
                    <Trash2 size={16} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                </button>
            </PermissionGate>

            <button
                type="button"
                onClick={(e) => openMenu(row, e)}
                className="inline-flex items-center justify-center border border-neutral-300 bg-white h-8 w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                aria-haspopup="menu"
                aria-label="More actions"
                title="More"
            >
                <MoreVertical size={16} />
            </button>
        </div>
    );

    return (
        <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                    <h1 className="text-[24px] font-semibold truncate">Clients</h1>
                </div>
                <div className="flex flex-col w-full sm:w-auto sm:items-end gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <input
                            value={global}
                            onChange={(e) => onGlobalChange(e.target.value)}
                            placeholder="Search clients..."
                            className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                            ⌘K
                        </span>
                    </div>
                    <PermissionGate requiredPermission={PERMISSIONS.CLIENT_CREATE} userPermissions={userPermissions} >
                        <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                            title="Create client"
                            aria-label="Create client"
                        >
                            <Plus size={16} />
                            <span>Add Client</span>
                        </button>
                    </PermissionGate>
                </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
                <DataTable
                    value={clients}
                    loading={isLoading}
                    size="small"
                    showGridlines
                    removableSort
                    className="text-sm min-w-0"
                    filters={filters}
                    filterDisplay="menu"
                    globalFilterFields={["name", "contactPerson", "email", "phone", "taxId"]}
                    emptyMessage={
                        <div className="py-8 text-center text-sm text-neutral-500">
                            {error ? "Error loading clients. Try again." : "No clients found."}
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
                        body={(row: Client) => (
                            <span className="truncate text-[13px] sm:text-[14px]">{row.name}</span>
                        )}
                        bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "24px" }}
                        bodyStyle={{ paddingLeft: "24px" }}
                        style={{ width: "24%" }}
                    />

                    <Column
                        field="officeId"
                        header="Office"
                        sortable
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Client) => <span className="truncate">{renderOffice(row)}</span>}
                        bodyClassName="!text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "20%" }}
                    />

                    <Column
                        field="contactPerson"
                        header="Contact"
                        sortable
                        className="hidden md:table-cell"
                        headerClassName="hidden md:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Client) => row.contactPerson || "—"}
                        bodyClassName="hidden md:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "16%" }}
                    />

                    <Column
                        field="email"
                        header="Email"
                        sortable
                        className="hidden lg:table-cell"
                        headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Client) => row.email || "—"}
                        bodyClassName="hidden lg:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "18%" }}
                    />

                    <Column
                        field="phone"
                        header="Phone"
                        sortable
                        className="hidden lg:table-cell"
                        headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Client) => row.phone || "—"}
                        bodyClassName="hidden lg:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "12%" }}
                    />

                    <Column
                        field="taxId"
                        header="Tax ID"
                        sortable
                        className="hidden xl:table-cell"
                        headerClassName="hidden xl:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Client) => row.taxId || "—"}
                        bodyClassName="hidden xl:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "10%" }}
                    />

                    <Column
                        header="Actions"
                        body={actionsTemplate}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!py-2 sm:!py-3 !px-2 sm:!px-4"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "24%" }}
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
            <CreateEditClientModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                mode="create"
                createClient={createClient}
                onSaved={() => {
                    refresh()
                }}
            />
            <CreateEditClientModal
                open={!!editing}
                onClose={() => setEditing(null)}
                mode="edit"
                client={editing}
                updateClient={updateClient}
                onSaved={() => {
                    refresh()
                }}
            />
            <DeleteClientModal
                open={!!deleting}
                client={deleting}
                onClose={() => setDeleting(null)}
                onDelete={async (id: string) => {
                    await deleteClient(id);
                    setDeleting(null);
                    refresh()
                }}
            />

            <HistoryModal
                open={showHistory}
                onClose={() => setShowHistory(false)}
                entityType="client"
                entityId={selectedHistoryClient?.id || ""}
                title={`Client History - ${selectedHistoryClient?.name || ""}`}
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
                                className="block w-full border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
                                onClick={() => {
                                    setSelectedHistoryClient(menuClient);
                                    setShowHistory(true);
                                    closeMenu();
                                }}
                            >
                                History
                            </button>
                        </PermissionGate>
                        <button
                            type="button"
                            className="block w-full border-b border-neutral-200 px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
                            onClick={() => {
                                console.log("Create shipment for", menuClient?.id);
                                closeMenu();
                            }}
                        >
                            Create shipment
                        </button>
                        <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-900 bg-white hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus:ring-0 active:bg-neutral-100"
                            onClick={() => {
                                console.log("Send quote to", menuClient?.id);
                                closeMenu();
                            }}
                        >
                            Send estimate
                        </button>
                    </div>,
                    document.body
                )}
        </div>
    );
}
