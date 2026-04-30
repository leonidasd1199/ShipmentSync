/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import BaseModal from "../BaseModal";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import { useOffices } from "../../../hooks/useOffice";
import type { OfficeUser } from "../../../utils/types/office.type";
import { useCompany } from "../../../hooks/useCompany";

type Props = {
    open: boolean;
    officeId: string;
    companyId: string;
    existingUsers: OfficeUser[];
    onClose: () => void;
    onAdded?: (addedIds: string[]) => void;
};

const AssignUserToOfficeModal: React.FC<Props> = ({
    open,
    officeId,
    companyId,
    existingUsers,
    onClose,
    onAdded,
}) => {
    const { users: companyUsers, isLoading, error } = useCompany({
        companyId,
        autoload: true,
    });
    const { assignUsers } = useOffices({ autoload: false });

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());

    const [global, setGlobal] = useState("");
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: "", matchMode: FilterMatchMode.CONTAINS },
        name: { value: null, matchMode: FilterMatchMode.CONTAINS },
        email: { value: null, matchMode: FilterMatchMode.CONTAINS },
    });

    const onGlobalChange = (value: string) => {
        setGlobal(value);
        setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    };

    const existingIds = useMemo(() => {
        const s = new Set<string>();
        for (const u of existingUsers ?? []) if (u?._id) s.add(String(u._id));
        return s;
    }, [existingUsers]);

    const availableUsers = useMemo<OfficeUser[]>(() => {
        if (!companyUsers?.length) return [];
        return companyUsers.filter((u) => !existingIds.has(String(u._id)));
    }, [companyUsers, existingIds]);

    useEffect(() => {
        if (open) {
            setSelectionIds(new Set());
            setSubmitError(null);
        }
    }, [open, companyId]);

    const displayName = (u: OfficeUser) =>
        u.name?.trim() ||
        `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
        u.email ||
        "—";

    const handleSave = useCallback(async () => {
        if (!selectionIds.size || submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const ids = Array.from(selectionIds);
            await assignUsers(officeId, ids);
            onAdded?.(ids);
            onClose();
        } catch (e: any) {
            setSubmitError(e?.message ?? "Failed to assign users to the office.");
        } finally {
            setSubmitting(false);
        }
    }, [assignUsers, officeId, selectionIds, submitting, onAdded, onClose]);

    const allSelected =
        availableUsers.length > 0 && selectionIds.size === availableUsers.length;
    const isIndeterminate =
        selectionIds.size > 0 && selectionIds.size < availableUsers.length;

    const headerCbRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (headerCbRef.current) headerCbRef.current.indeterminate = isIndeterminate;
    }, [isIndeterminate]);

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectionIds(new Set());
        } else {
            setSelectionIds(new Set(availableUsers.map((u) => String(u._id))));
        }
    };

    const toggleRow = useCallback((rowId: string) => {
        setSelectionIds((prev) => {
            const next = new Set(prev);
            if (next.has(rowId)) next.delete(rowId);
            else next.add(rowId);
            return next;
        });
    }, []);

    type RowType = OfficeUser & { __selected?: boolean };
    const tableRows: RowType[] = useMemo(
        () =>
            availableUsers.map((u) => ({
                ...u,
                __selected: selectionIds.has(String(u._id)),
            })),
        [availableUsers, selectionIds]
    );

    const selectTable = useCallback(
        (row: RowType) => {
            const id = String(row._id);
            return (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={!!row.__selected}
                        onChange={() => toggleRow(id)}
                        className={`h-4 w-4 rounded border border-neutral-400 bg-white appearance-none cursor-pointer 
                            checked:border-neutral-900 checked:bg-white 
                            relative 
                            before:content-['✓'] before:absolute before:inset-0 
                            before:flex before:items-center before:justify-center 
                            before:text-[0.75rem] before:font-semibold 
                            before:text-neutral-900 before:opacity-0 checked:before:opacity-100 
                            focus:ring-0 focus:outline-none`}
                    />
                </div>
            );
        },
        [toggleRow]
    );

    if (!open) return null;

    return (
        <BaseModal
            confirmModal
            confirmModalSize="lg"
            title={
                <div className="flex items-center justify-between gap-3">
                    <span>Add users to office</span>
                    <span className="text-xs text-neutral-500">
                        {selectionIds.size > 0 ? `${selectionIds.size} selected` : ""}
                    </span>
                </div>
            }
            primaryActionLabel={submitting ? "Saving..." : "Save"}
            primaryActionDisabled={submitting || selectionIds.size === 0}
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
                        placeholder="Search users..."
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
                    dataKey="_id"
                    loading={isLoading}
                    className="text-sm min-w-0"
                    filters={filters}
                    filterDisplay="menu"
                    globalFilterFields={["name", "firstName", "lastName", "email"]}
                    emptyMessage={
                        <div className="py-8 text-center text-sm text-neutral-500">
                            {error
                                ? "Error loading company users. Try again."
                                : "No available users to add."}
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
                        body={selectTable}
                        headerStyle={{ width: "3.5rem", padding: "8px" }}
                        bodyStyle={{ padding: "8px" }}
                        style={{ width: "3.5rem" }}
                    />

                    <Column
                        field="name"
                        header="Name"
                        sortable
                        body={(row: RowType) => (
                            <span className="truncate text-[13px] sm:text-[14px]">
                                {displayName(row)}
                            </span>
                        )}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!text-neutral-900 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "8px" }}
                        bodyStyle={{ paddingLeft: "8px" }}
                        style={{ width: "60%" }}
                    />

                    <Column
                        field="email"
                        header="Email"
                        sortable
                        body={(row: RowType) => (row.email?.trim() ? row.email : "—")}
                        headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
                        bodyClassName="!text-neutral-700 !py-2 sm:!py-3"
                        headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
                        style={{ width: "40%" }}
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

export default AssignUserToOfficeModal;
