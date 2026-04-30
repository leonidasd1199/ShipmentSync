import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Loader2,
  Search,
  Ship,
  Trash2,
} from "lucide-react";

import { ShipmentsService } from "../services/shipments.service";
import type { LedgerLine, ShipmentLedgerRow } from "../utils/types/shipment.type";
import LedgerLineDocumentsModal from "../components/modals/LedgerLineDocumentsModal";
import ConfirmationModal from "../components/modals/ConfirmationModal";

function badgeClasses(status: LedgerLine["status"]): string {
  if (status === "APPROVED") return "bg-green-50 text-green-700";
  if (status === "REJECTED") return "bg-red-50 text-red-700";
  if (status === "SUBMITTED") return "bg-amber-50 text-amber-700";
  return "bg-neutral-100 text-neutral-600";
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function extractAgentName(row: ShipmentLedgerRow): string {
  const lineAny = row.line as any;
  const shipmentAny = row.shipment as any;
  const createdBy = shipmentAny?.createdBy;
  const createdByFullName =
    typeof createdBy === "object"
      ? `${createdBy?.firstName ?? ""} ${createdBy?.lastName ?? ""}`.trim()
      : "";
  return (
    createdByFullName ||
    (typeof createdBy === "object" ? createdBy?.name : undefined) ||
    shipmentAny?.createdByName ||
    lineAny?.agent?.name ||
    lineAny?.agentName ||
    lineAny?.createdByName ||
    lineAny?.createdBy?.name ||
    shipmentAny?.operationalUser?.name ||
    shipmentAny?.operationalUserName ||
    "—"
  );
}

function buildShipmentReference(row: ShipmentLedgerRow): string {
  return (
    row.shipment.bookingNumber ||
    row.shipment.mblNumber ||
    row.shipment.hblNumber ||
    row.shipment._id
  );
}

export type FinanceLedgerDashboardProps = {
  side: "DEBIT" | "CREDIT";
  panelHeading: string;
  emptyMessage: string;
  amountColumnLabel: string;
  deleteModalTitle: string;
  deleteModalBody: string;
  successDeleteMessage: string;
};

export default function FinanceLedgerDashboard({
  side,
  panelHeading,
  emptyMessage,
  amountColumnLabel,
  deleteModalTitle,
  deleteModalBody,
  successDeleteMessage,
}: FinanceLedgerDashboardProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ShipmentLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingRow, setDeletingRow] = useState<ShipmentLedgerRow | null>(null);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);
  const [docsRow, setDocsRow] = useState<ShipmentLedgerRow | null>(null);
  const [docsRefreshKey, setDocsRefreshKey] = useState(0);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ShipmentsService.getAllLedgerRowsBySide(side);
      setRows(data);
    } catch {
      setError(
        side === "DEBIT"
          ? "Failed to load debits."
          : "Failed to load credits.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [side]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(t);
  }, [success]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const supplier = row.line.supplier?.name ?? "";
      const agent = extractAgentName(row);
      const description = row.line.description ?? "";
      const shipmentRef = buildShipmentReference(row);
      const status = row.line.status ?? "";
      return (
        supplier.toLowerCase().includes(q) ||
        agent.toLowerCase().includes(q) ||
        description.toLowerCase().includes(q) ||
        shipmentRef.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const handleGoToShipment = (row: ShipmentLedgerRow) => {
    navigate(`/shipments/${row.shipment._id}/edit`, {
      state: { tab: "finance" },
    });
  };

  const handleDeleteLine = async () => {
    if (!deletingRow) return;
    setDeletingLineId(deletingRow.line._id);
    setError(null);
    setSuccess(null);
    try {
      await ShipmentsService.deleteLedgerLine(
        deletingRow.shipment._id,
        deletingRow.line._id,
      );
      setRows((prev) => prev.filter((r) => r.line._id !== deletingRow.line._id));
      setSuccess(successDeleteMessage);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete line.";
      setError(typeof msg === "string" ? msg : "Failed to delete line.");
    } finally {
      setDeletingLineId(null);
      setDeletingRow(null);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {panelHeading}
          </h2>
          <div className="relative w-full max-w-sm sm:shrink-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier, agent, note, shipment, status..."
              className="block w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-neutral-500">
              {emptyMessage}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                    <th className="px-3 py-2 text-left font-medium">
                      Supplier Name
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {amountColumnLabel}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Agent Name
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const canDelete = row.line.status === "DRAFT";
                    const isDeleting = deletingLineId === row.line._id;
                    return (
                      <tr
                        key={row.line._id}
                        className="border-b border-neutral-100 align-top last:border-0"
                      >
                        <td className="px-3 py-3 text-neutral-800">
                          {row.line.supplier?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 font-medium text-neutral-900">
                          {formatCurrency(row.line.amount, row.line.currency)}
                        </td>
                        <td className="px-3 py-3 text-neutral-700">
                          {extractAgentName(row)}
                        </td>
                        <td className="max-w-[320px] px-3 py-3 text-neutral-700">
                          <span className="line-clamp-2">
                            {row.line.description || "—"}
                          </span>
                          <div className="mt-1 text-xs text-neutral-400">
                            Ref: {buildShipmentReference(row)}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-1 text-xs font-medium ${badgeClasses(
                              row.line.status,
                            )}`}
                          >
                            {row.line.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleGoToShipment(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              <Ship size={12} />
                              Go to Shipment
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDocsRefreshKey((k) => k + 1);
                                setDocsRow(row);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              <Eye size={12} />
                              View Documents
                            </button>
                            <button
                              type="button"
                              disabled={!canDelete || isDeleting}
                              onClick={() => setDeletingRow(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {isDeleting ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {docsRow && (
        <LedgerLineDocumentsModal
          open
          shipmentId={docsRow.shipment._id}
          line={docsRow.line}
          refreshKey={docsRefreshKey}
          onClose={() => setDocsRow(null)}
          onDocumentsChanged={async () => {
            const docsShipmentId = docsRow.shipment._id;
            const docsLineId = docsRow.line._id;
            try {
              const lines =
                await ShipmentsService.getLedgerLines(docsShipmentId);
              setRows((prev) =>
                prev.map((r) =>
                  r.shipment._id === docsShipmentId &&
                  r.line._id === docsLineId
                    ? {
                        ...r,
                        line: lines.find((l) => l._id === docsLineId) ?? r.line,
                      }
                    : r,
                ),
              );
            } catch {
              /* ignore */
            }
          }}
        />
      )}

      {deletingRow && (
        <ConfirmationModal
          title={deleteModalTitle}
          onCancel={() => setDeletingRow(null)}
          onConfirm={() => void handleDeleteLine()}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        >
          <p className="text-sm text-neutral-600">{deleteModalBody}</p>
        </ConfirmationModal>
      )}
    </>
  );
}
