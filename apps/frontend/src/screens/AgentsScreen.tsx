/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type JSX, useCallback, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { ArrowLeft, Pencil, Plus, Trash2, MoreVertical, DollarSign, History } from "lucide-react";

import { useAgents } from "../hooks/useAgents";
import { useShipping } from "../hooks/useShipping";
import { useAuthStore } from "../stores/auth.store";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";
import type { Agent } from "../utils/types/agent.type";
import CreateEditAgentModal from "../components/modals/Agents/CreateEditAgentModal";
import DeleteAgentModal from "../components/modals/Agents/DeleteAgentModal";
import AssignAgentToShippingModal from "../components/modals/Agents/AssignAgentToShippingModal";
import HistoryModal from "../components/modals/HistoryModal";

type Mode = "create" | "edit";
type MenuPos = { top: number; left: number };

export default function AgentsScreen(): JSX.Element {
    const { supplierId: shippingLineId } = useParams<{ supplierId: string }>();
    const navigate = useNavigate();

    const { user: currentUser } = useAuthStore();
    const userPermissions = currentUser?.permissions ?? [];

    const {
        agents,
        isLoading,
        error,
        page,
        pageSize,
        total,
        setPage,
        setPageSize,
        refresh,
        createAgent,
        updateAgent,
    } = useAgents({
        autoload: true,
        defaultAssigned: "true",
        defaultShippingLineId: shippingLineId ?? null,
        defaultPage: 1,
        defaultPageSize: 10,
    } as any);

    const {
        getShipping,
        addAgents,
        removeAgents: removeAgentsFromShipping,
    } = useShipping({ autoload: false });

    const [shippingLineName, setShippingLineName] = useState("");
    const [assignModalOpen, setAssignModalOpen] = useState(false);

    // History modal state
    const [showHistory, setShowHistory] = useState(false);
    const [selectedHistoryAgent, setSelectedHistoryAgent] = useState<Agent | null>(null);

    // Menu state
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAgent, setMenuAgent] = useState<Agent | null>(null);
    const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement | null>(null);

    const openMenu = (row: Agent, e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 8, left: rect.left - 120 + rect.width });
        setMenuAgent(row);
        setMenuOpen(true);
    };

    const closeMenu = () => {
        setMenuOpen(false);
        setMenuAgent(null);
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

    useEffect(() => {
        if (!shippingLineId) return;
        (async () => {
            try {
                const sl = await getShipping(shippingLineId);
                setShippingLineName(sl?.name ?? "");
            } catch {
                setShippingLineName("");
            }
        })();
    }, [shippingLineId, getShipping]);

    const [global, setGlobal] = useState("");
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: "", matchMode: FilterMatchMode.CONTAINS },
        firstName: { value: null, matchMode: FilterMatchMode.CONTAINS },
        lastName: { value: null, matchMode: FilterMatchMode.CONTAINS },
        email: { value: null, matchMode: FilterMatchMode.CONTAINS },
        phone: { value: null, matchMode: FilterMatchMode.CONTAINS },
    });

    const onGlobalChange = (value: string) => {
        setGlobal(value);
        setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
        setPage(1);
    };

    useEffect(() => {
        void refresh();
    }, [page, pageSize, shippingLineId, refresh]);

    const displayName = (a: Agent) =>
        `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "—";

    const handleBack = () => navigate("/suppliers");

    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [agentModalMode, setAgentModalMode] = useState<Mode>("create");
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

    const handleCreateAgent = () => {
        setAgentModalMode("create");
        setEditingAgent(null);
        setAgentModalOpen(true);
    };

    const handleEditAgent = (row: Agent) => {
        setAgentModalMode("edit");
        setEditingAgent(row);
        setAgentModalOpen(true);
    };

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

    const openDeleteModal = (row: Agent) => {
        setDeletingAgent(row);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpen(false);
        setDeletingAgent(null);
    };

    const handleDeleteAgent = useCallback(
        async (id: string) => {
            if (!shippingLineId) {
                throw new Error("Missing shipping line id");
            }

            const isLastItemOnPage = agents.length === 1 && page > 1;

            await removeAgentsFromShipping(shippingLineId, [id]);

            if (isLastItemOnPage) {
                setPage(page - 1);
            } else {
                await refresh();
            }
        },
        [agents.length, page, refresh, removeAgentsFromShipping, setPage, shippingLineId],
    );

    const handleAddAgent = () => {
        setAssignModalOpen(true);
    };

    // Navigate to pricing screen filtered by this agent
    const handleViewPricelists = useCallback((agent: Agent) => {
        // Navigate to pricing with agentId filter
        if (shippingLineId) {
            navigate(`/pricing/suppliers/${shippingLineId}?agentId=${agent.id}`);
        } else {
            navigate(`/pricing?agentId=${agent.id}`);
        }
    }, [navigate, shippingLineId]);

    const actionsTemplate = (row: Agent): JSX.Element => {
        const base =
            "inline-flex items-center justify-center rounded-lg border bg-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
        const btnCommon = "h-8 w-8 p-0 sm:h-7 sm:w-7 sm:p-0";

        return (
            <div className="flex items-center justify-center gap-2 sm:justify-start flex-wrap max-[360px]:flex-col">
                {/* View Pricelists Button - Always visible */}
                <button
                    type="button"
                    onClick={() => handleViewPricelists(row)}
                    className={`${base} ${btnCommon} border-blue-300 text-blue-700 hover:bg-blue-50`}
                    title="View pricelists"
                    aria-label="View pricelists"
                >
                    <DollarSign size={16} />
                </button>

                <PermissionGate
                    requiredPermission={PERMISSIONS.AGENT_UPDATE}
                    userPermissions={userPermissions}
                >
                    <button
                        type="button"
                        onClick={() => handleEditAgent(row)}
                        className={`${base} ${btnCommon} border-neutral-300 text-neutral-900 hover:bg-neutral-50`}
                        title="Edit agent"
                        aria-label="Edit agent"
                    >
                        <Pencil size={16} />
                    </button>
                </PermissionGate>

                <PermissionGate
                    requiredPermission={PERMISSIONS.AGENT_DELETE}
                    userPermissions={userPermissions}
                >
                    <button
                        type="button"
                        onClick={() => openDeleteModal(row)}
                        className={`${base} ${btnCommon} border-red-300 text-red-700 hover:bg-red-50`}
                        title="Delete agent"
                        aria-label="Delete agent"
                    >
                        <Trash2 size={16} />
                    </button>
                </PermissionGate>

                <button
                    type="button"
                    onClick={(e) => openMenu(row, e)}
                    className={`${base} ${btnCommon} border-neutral-300 text-neutral-900 hover:bg-neutral-50`}
                    aria-haspopup="menu"
                    aria-label="More actions"
                    title="More"
                >
                    <MoreVertical size={16} />
                </button>
            </div>
        );
    };

    const headerTitle = useMemo(() => {
        if (shippingLineName) return `Agents — ${shippingLineName}`;
        if (shippingLineId) return `Agents — ${shippingLineId}`;
        return "Agents";
    }, [shippingLineId, shippingLineName]);

    const paginatorBtn =
        "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-8 w-8 p-0";
    const paginatorRoot = "flex items-center justify-center gap-1 py-2 bg-white";

    return (
        <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                        title="Back to Shipping Lines"
                        aria-label="Back to Shipping Lines"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <h1 className="text-[24px] font-semibold whitespace-normal break-words truncate">
                        {headerTitle}
                    </h1>
                </div>

                <div className="w-full sm:flex sm:items-start sm:justify-between">
                    <div className="relative w-full sm:max-w-sm sm:ml-0">
                        <input
                            value={global}
                            onChange={(e) => onGlobalChange(e.target.value)}
                            placeholder="Search agents..."
                            className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                            ⌘K
                        </span>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:ml-4 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center sm:justify-end w-full sm:w-auto">
                        <PermissionGate
                            requiredPermission={PERMISSIONS.AGENT_CREATE}
                            userPermissions={userPermissions}
                        >
                            <button
                                type="button"
                                onClick={handleCreateAgent}
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                                title="Create agent"
                                aria-label="Create agent"
                            >
                                <Plus size={16} />
                                <span className="inline">Create Agent</span>
                            </button>
                        </PermissionGate>

                        <PermissionGate
                            requiredPermission={PERMISSIONS.AGENT_CREATE}
                            userPermissions={userPermissions}
                        >
                            <button
                                type="button"
                                onClick={handleAddAgent}
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                                title="Add existing agent"
                                aria-label="Add existing agent"
                            >
                                <Plus size={16} />
                                <span className="inline">Add Agent</span>
                            </button>
                        </PermissionGate>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
                <DataTable
                    value={agents}
                    dataKey="id"
                    lazy
                    loading={isLoading}
                    size="small"
                    showGridlines
                    removableSort
                    className="text-sm min-w-0"
                    filters={filters}
                    filterDisplay="menu"
                    globalFilterFields={[
                        "firstName",
                        "lastName",
                        "email",
                        "phone",
                        "address.city",
                        "address.country",
                    ]}
                    emptyMessage={
                        <div className="py-8 text-center text-sm text-neutral-500">
                            {error ? "Error loading agents. Try again." : "No agents found for this shipping line."}
                        </div>
                    }
                    paginator={total > agents.length}
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
                        header="Name"
                        sortable
                        body={(row: Agent) => (
                            <span className="truncate text-[13px] sm:text-[14px]">
                                {displayName(row)}
                            </span>
                        )}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14, paddingLeft: 24 }}
                        bodyStyle={{ paddingLeft: 24 }}
                        style={{ width: "40%" }}
                    />

                    <Column
                        field="email"
                        header="Email"
                        sortable
                        className="hidden sm:table-cell"
                        headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Agent) => (row.email?.trim() ? row.email : "—")}
                        bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
                        style={{ width: "25%" }}
                    />

                    <Column
                        field="phone"
                        header="Phone"
                        sortable
                        className="hidden sm:table-cell"
                        headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        body={(row: Agent) => (row.phone?.trim() ? row.phone : "—")}
                        bodyClassName="hidden sm:table-cell !text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
                        style={{ width: "15%" }}
                    />

                    <Column
                        header="Actions"
                        body={actionsTemplate}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!py-2 sm:!py-3 !px-3 sm:!px-4"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14, paddingRight: 16 }}
                        bodyStyle={{ paddingRight: 16 }}
                        style={{ width: "20%" }}
                    />
                </DataTable>
            </div>

            <CreateEditAgentModal
                open={agentModalOpen}
                onClose={() => setAgentModalOpen(false)}
                mode={agentModalMode}
                shippingLineId={shippingLineId}
                agent={agentModalMode === "edit" ? editingAgent : null}
                createAgent={createAgent as any}
                updateAgent={updateAgent as any}
                onSaved={async () => {
                    setAgentModalOpen(false);
                    setEditingAgent(null);
                    await refresh();
                }}
            />

            <DeleteAgentModal
                open={deleteModalOpen}
                agent={deletingAgent}
                onClose={closeDeleteModal}
                onDelete={async (id: string) => {
                    await handleDeleteAgent(id);
                    closeDeleteModal();
                }}
            />

            {shippingLineId && (
                <AssignAgentToShippingModal
                    open={assignModalOpen}
                    shippingLineId={shippingLineId}
                    existingAgents={agents}
                    onAssign={async (slId, ids) => {
                        await addAgents(slId, ids);
                    }}
                    onAdded={async () => {
                        setAssignModalOpen(false);
                        await refresh();
                    }}
                    onClose={() => setAssignModalOpen(false)}
                />
            )}

            <HistoryModal
                open={showHistory}
                onClose={() => setShowHistory(false)}
                entityType="agent"
                entityId={selectedHistoryAgent?.id || ""}
                title={`Agent History - ${displayName(selectedHistoryAgent || {} as Agent)}`}
            />

            {menuOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        className="fixed z-50 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl"
                        style={{ top: menuPos.top, left: menuPos.left }}
                    >
                        {/* View Pricelists Option */}
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
                            onClick={() => {
                                if (menuAgent) {
                                    handleViewPricelists(menuAgent);
                                }
                                closeMenu();
                            }}
                        >
                            <DollarSign size={14} className="text-blue-500" />
                            View Pricelists
                        </button>

                        {/* History Option */}
                        <PermissionGate
                            requiredPermission={PERMISSIONS.AUDIT_VIEW}
                            userPermissions={userPermissions}
                        >
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none border-t border-neutral-100"
                                onClick={() => {
                                    setSelectedHistoryAgent(menuAgent);
                                    setShowHistory(true);
                                    closeMenu();
                                }}
                            >
                                <History size={14} className="text-neutral-500" />
                                History
                            </button>
                        </PermissionGate>
                    </div>,
                    document.body
                )}
        </div>
    );
}