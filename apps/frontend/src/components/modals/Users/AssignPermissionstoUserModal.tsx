/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BaseModal from "../BaseModal";

type PermissionItem = { id: string; code: string; description: string };

type AssignPermissionsToUserModalProps = {
    open: boolean;
    onClose: () => void;

    userId: string;
    userName?: string;
    userEmail?: string;
    userPermissions: string[];

    allPermissions: PermissionItem[];

    onAssign: (userId: string, permissionCodes: string[]) => Promise<any>;
    onRemove: (userId: string, permissionCodes: string[]) => Promise<any>;

    onSaved?: (result: { added: string[]; removed: string[] }) => void;
};

const normalize = (s: string) => s.toLowerCase().trim();

const AssignPermissionsToUserModal: React.FC<AssignPermissionsToUserModalProps> = ({
    open,
    onClose,
    userId,
    userName,
    userEmail,
    userPermissions,
    allPermissions,
    onAssign,
    onRemove,
    onSaved,
}) => {
    const [originalSelected, setOriginalSelected] = useState<Set<string>>(new Set());
    const [currentSelected, setCurrentSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const base = new Set((userPermissions ?? []).map((c) => String(c)));
        setOriginalSelected(base);
        setCurrentSelected(new Set(base));
        setSearch("");
        setErrorMsg(null);
    }, [open, userPermissions]);

    const filteredPermissions = useMemo(() => {
        const q = normalize(search);
        if (!q) return allPermissions.slice().sort((a, b) => a.code.localeCompare(b.code));
        return allPermissions
            .filter((p) => normalize(p.code).includes(q) || normalize(p.description || "").includes(q))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [allPermissions, search]);

    const toggleCode = useCallback((code: string) => {
        setCurrentSelected((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }, []);

    // --- Select all (sobre la lista filtrada) ---
    const headerCbRef = useRef<HTMLInputElement | null>(null);
    const filteredCodes = useMemo(() => filteredPermissions.map((p) => p.code), [filteredPermissions]);
    const selectedInFilteredCount = useMemo(
        () => filteredCodes.filter((c) => currentSelected.has(c)).length,
        [filteredCodes, currentSelected]
    );
    const allFilteredSelected = filteredCodes.length > 0 && selectedInFilteredCount === filteredCodes.length;
    const isFilteredIndeterminate =
        selectedInFilteredCount > 0 && selectedInFilteredCount < filteredCodes.length;

    useEffect(() => {
        if (headerCbRef.current) headerCbRef.current.indeterminate = isFilteredIndeterminate;
    }, [isFilteredIndeterminate]);

    const toggleSelectAllFiltered = useCallback(() => {
        setCurrentSelected((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                // deseleccionar todos los filtrados
                for (const c of filteredCodes) next.delete(c);
            } else {
                // seleccionar todos los filtrados
                for (const c of filteredCodes) next.add(c);
            }
            return next;
        });
    }, [allFilteredSelected, filteredCodes]);

    // --- Diffs estrictos contra originalSelected ---
    const { toAdd, toRemove, hasChanges } = useMemo(() => {
        const add: string[] = [];
        const rem: string[] = [];
        for (const code of currentSelected) if (!originalSelected.has(code)) add.push(code);
        for (const code of originalSelected) if (!currentSelected.has(code)) rem.push(code);
        return { toAdd: add, toRemove: rem, hasChanges: add.length > 0 || rem.length > 0 };
    }, [currentSelected, originalSelected]);

    const handleSave = useCallback(async () => {
        if (!hasChanges || submitting) return;
        setSubmitting(true);
        setErrorMsg(null);

        const snapshotOriginal = new Set(originalSelected);
        const snapshotCurrent = new Set(currentSelected);

        try {
            if (toAdd.length > 0) {
                await onAssign(userId, toAdd);
            }

            const afterAssignOriginal = new Set(snapshotOriginal);
            for (const c of toAdd) afterAssignOriginal.add(c);

            if (toRemove.length > 0) {
                try {
                    await onRemove(userId, toRemove);
                    setOriginalSelected(new Set(snapshotCurrent));
                    onSaved?.({ added: toAdd, removed: toRemove });
                    onClose();
                    return;
                } catch (err: any) {
                    setOriginalSelected(afterAssignOriginal);
                    setCurrentSelected(afterAssignOriginal);
                    setErrorMsg(
                        err?.response?.data?.message ||
                        err?.message ||
                        "Some changes could not be removed. Additions were saved."
                    );
                    onSaved?.({ added: toAdd, removed: [] });
                    return;
                }
            } else {
                setOriginalSelected(new Set(snapshotCurrent));
                onSaved?.({ added: toAdd, removed: [] });
                onClose();
                return;
            }
        } catch (err: any) {
            setOriginalSelected(snapshotOriginal);
            setCurrentSelected(snapshotOriginal);
            setErrorMsg(
                err?.response?.data?.message ||
                err?.message ||
                "Failed to assign new permissions. No changes were applied."
            );
        } finally {
            setSubmitting(false);
        }
    }, [hasChanges, submitting, originalSelected, currentSelected, toAdd, toRemove, onAssign, onRemove, userId, onSaved, onClose]);

    if (!open) return null;

    return (
        <BaseModal
            confirmModal
            confirmModalSize="lg"
            title={
                <div className="flex flex-col">
                    <span className="font-medium">Assign permissions</span>
                    {(userName || userEmail) && (
                        <span className="text-xs text-neutral-500">
                            {userName ? userName : ""}{userName && userEmail ? " • " : ""}{userEmail ? userEmail : ""}
                        </span>
                    )}
                </div>
            }
            primaryActionLabel={submitting ? "Saving..." : "Save"}
            primaryActionDisabled={submitting || !hasChanges}
            onPrimaryAction={handleSave}
            secondaryActionLabel="Cancel"
            secondaryActionDisabled={submitting}
            onSecondaryAction={onClose}
            showCancel
        >
            {/* Search */}
            <div className="mb-3">
                <div className="relative w-full sm:max-w-xs">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search permissions..."
                        className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        ⌘K
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                    <thead className="bg-[#F8FAFC] text-neutral-700 font-semibold">
                        <tr>
                            <th className="text-left px-3 py-2 w-10">
                                <input
                                    ref={headerCbRef}
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={toggleSelectAllFiltered}
                                    className="h-4 w-4 rounded border border-neutral-400 bg-white appearance-none cursor-pointer 
                             checked:border-neutral-900 checked:bg-white 
                             relative 
                             before:content-['✓'] before:absolute before:inset-0 
                             before:flex before:items-center before:justify-center 
                             before:text-[0.75rem] before:font-semibold 
                             before:text-neutral-900 before:opacity-0 checked:before:opacity-100 
                             focus:ring-0 focus:outline-none"
                                    aria-label="Toggle all (filtered)"
                                />
                            </th>
                            <th className="text-left px-3 py-2">Code</th>
                            <th className="text-left px-3 py-2">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPermissions.map((p) => {
                            const checked = currentSelected.has(p.code);
                            return (
                                <tr key={p.id} className="border-t border-neutral-200">
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCode(p.code)}
                                            className="h-4 w-4 rounded border border-neutral-400 bg-white appearance-none cursor-pointer 
                                 checked:border-neutral-900 checked:bg-white 
                                 relative 
                                 before:content-['✓'] before:absolute before:inset-0 
                                 before:flex before:items-center before:justify-center 
                                 before:text-[0.75rem] before:font-semibold 
                                 before:text-neutral-900 before:opacity-0 checked:before:opacity-100 
                                 focus:ring-0 focus:outline-none"
                                            aria-label={`Toggle ${p.code}`}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-neutral-900">{p.code}</td>
                                    <td className="px-3 py-2 text-neutral-700">{p.description || "—"}</td>
                                </tr>
                            );
                        })}

                        {filteredPermissions.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                                    No permissions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
                <div className="text-neutral-600">
                    <span className="font-medium">{currentSelected.size}</span> selected
                    {hasChanges && (
                        <>
                            {" · "}
                            <span className="text-emerald-700">{toAdd.length} to add</span>
                            {" · "}
                            <span className="text-amber-700">{toRemove.length} to remove</span>
                        </>
                    )}
                </div>
                {errorMsg && (
                    <div className="ml-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                        {errorMsg}
                    </div>
                )}
            </div>
        </BaseModal>
    );
};

export default AssignPermissionsToUserModal;
