/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";

import { useAgents } from "../../../hooks/useAgents";
import type { Agent } from "../../../utils/types/agent.type";
import BaseModal from "../BaseModal";

type Props = {
    open: boolean;
    shippingLineId: string;
    existingAgents?: Agent[];
    onAssign: (shippingLineId: string, agentIds: string[]) => Promise<void>;
    onClose: () => void;
    onAdded?: (addedIds: string[]) => void;
};

type RowAgent = Agent & { selected?: boolean };

const AssignAgentToShippingModal: React.FC<Props> = ({
    open,
    shippingLineId,
    existingAgents = [],
    onAssign,
    onClose,
    onAdded,
}) => {
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
    } = useAgents({
        autoload: open,
        defaultAssigned: "all",
        defaultShippingLineId: shippingLineId,
        defaultPage: 1,
        defaultPageSize: 10,
    } as any);

    const [tableRows, setTableRows] = useState<RowAgent[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [global, setGlobal] = useState("");
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: "", matchMode: FilterMatchMode.CONTAINS },
        firstName: { value: null, matchMode: FilterMatchMode.CONTAINS },
        lastName: { value: null, matchMode: FilterMatchMode.CONTAINS },
        email: { value: null, matchMode: FilterMatchMode.CONTAINS },
    });

    const onGlobalChange = (value: string) => {
        setGlobal(value);
        setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
        setPage(1);
    };

    useEffect(() => {
        if (open) void refresh();
    }, [open, page, pageSize, refresh]);

    useEffect(() => {
        if (open) {
            setSubmitError(null);
        }
    }, [open, shippingLineId]);

    useEffect(() => {
        if (!open) return;

        const existingIds = new Set((existingAgents ?? []).map((a) => String(a.id)));
        const prevSelectedById = new Map<string, boolean>(
            tableRows.map((r) => [String(r.id), Boolean(r.selected)]),
        );

        const nextRows: RowAgent[] = (agents ?? [])
            .filter((a) => !existingIds.has(String(a.id)))
            .map((a) => ({
                ...a,
                selected: prevSelectedById.get(String(a.id)) ?? false,
            }));

        setTableRows(nextRows);
    }, [open, agents, existingAgents, shippingLineId]);

    const displayName = (a: Agent) =>
        `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "—";

    const toggleRow = useCallback((rowId: string) => {
        setTableRows((prev) =>
            prev.map((r) =>
                String(r.id) === rowId ? { ...r, selected: !r.selected } : r,
            ),
        );
    }, []);

    const selectedCount = useMemo(
        () => tableRows.filter((r) => r.selected).length,
        [tableRows],
    );

    const allSelected = useMemo(() => {
        return tableRows.length > 0 && selectedCount === tableRows.length;
    }, [tableRows, selectedCount])


    const isIndeterminate =
        selectedCount > 0 && !allSelected;

    const headerCbRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (!headerCbRef.current) return;

        headerCbRef.current.indeterminate = isIndeterminate;
        headerCbRef.current.checked = allSelected;
    }, [isIndeterminate, allSelected]);

    const toggleSelectAll = () => {
        setTableRows((prev) => {
            if (allSelected) {
                return prev.map((r) => ({ ...r, selected: false }));
            }
            return prev.map((r) => ({ ...r, selected: true }));
        });
    };

    const selectCell = useCallback(
        (row: RowAgent) => {
            const id = String(row.id);
            const checked = Boolean(row.selected);
            return (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(id)}
                        className="h-4 w-4 rounded border border-neutral-400 bg-white appearance-none cursor-pointer 
                    checked:border-neutral-900 checked:bg-white 
                    relative 
                    before:content-['✓'] before:absolute before:inset-0 
                    before:flex before:items-center before:justify-center 
                    before:text-[0.75rem] before:font-semibold 
                    before:text-neutral-900 before:opacity-0 checked:before:opacity-100 
                    focus:ring-0 focus:outline-none"
                    />
                </div>
            );
        },
        [toggleRow],
    );

    const handleSave = useCallback(async () => {
        if (submitting) return;
        const ids = tableRows.filter((r) => r.selected).map((r) => String(r.id));
        if (!ids.length) return;

        setSubmitting(true);
        setSubmitError(null);
        try {
            await onAssign(shippingLineId, ids);
            onAdded?.(ids);
            onClose();
        } catch (e: any) {
            setSubmitError(
                e?.message ?? "Failed to assign agents to the shipping line.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [tableRows, submitting, onAssign, shippingLineId, onAdded, onClose]);

    if (!open) return null;

    const paginatorBtn =
        "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 h-8 w-8 p-0";
    const paginatorRoot = "flex items-center justify-center gap-1 py-2 bg-white";

    return (
        <BaseModal
            confirmModal
            confirmModalSize="lg"
            title={
                <div className="flex items-center justify-between gap-3">
                    <span>Add agents to supplier</span>
                    <span className="text-xs text-neutral-500">
                        {selectedCount > 0 ? `${selectedCount} selected` : ""}
                    </span>
                </div>
            }
            primaryActionLabel={submitting ? "Adding..." : "Add"}
            primaryActionDisabled={submitting || selectedCount === 0}
            onPrimaryAction={handleSave}
            secondaryActionLabel="Cancel"
            secondaryActionDisabled={submitting}
            onSecondaryAction={onClose}
            showCancel
        >
            <div className="mb-3 flex">
                <div className="relative w-full sm:max-w-xs">
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
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
                <DataTable
                    value={tableRows}
                    dataKey="id"
                    loading={isLoading}
                    className="text-sm min-w-0"
                    filters={filters}
                    filterDisplay="menu"
                    globalFilterFields={[
                        "firstName",
                        "lastName",
                        "email",
                        "address.city",
                        "address.country",
                    ]}
                    emptyMessage={
                        <div className="py-8 text-center text-sm text-neutral-500">
                            {error
                                ? "Error loading agents. Try again."
                                : "No available agents to add."}
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
                        header={() => (
                            <div className="flex items-center justify-center">
                                <input
                                    ref={headerCbRef}
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border border-neutral-400 bg-white appearance-none cursor-pointer 
                    checked:border-neutral-900 checked:bg-white 
                    relative 
                    before:content-['✓'] before:absolute before:inset-0 
                    before:flex before:items-center before:justify-center 
                    before:text-[0.75rem] before:font-semibold 
                    before:text-neutral-900 before:opacity-0 checked:before:opacity-100 
                    focus:ring-0 focus:outline-none"
                                />
                            </div>
                        )}
                        body={(row: RowAgent) => selectCell(row)}
                        headerStyle={{ width: "3.5rem", padding: "8px" }}
                        bodyStyle={{ padding: "8px" }}
                        style={{ width: "3.5rem" }}
                    />

                    <Column
                        header="Name"
                        sortable
                        body={(row: RowAgent) => (
                            <span className="truncate text-[13px] sm:text-[14px]">
                                {displayName(row)}
                            </span>
                        )}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14, paddingLeft: 8 }}
                        bodyStyle={{ paddingLeft: 8 }}
                        style={{ width: "55%" }}
                    />

                    <Column
                        field="email"
                        header="Email"
                        sortable
                        body={(row: RowAgent) => (row.email?.trim() ? row.email : "—")}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: 14, paddingBottom: 14 }}
                        style={{ width: "42%" }}
                    />
                </DataTable>
            </div>

            {submitError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                </div>
            )}
        </BaseModal>
    );
};

export default AssignAgentToShippingModal;
