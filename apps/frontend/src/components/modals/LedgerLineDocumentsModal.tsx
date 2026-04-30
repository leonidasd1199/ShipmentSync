import React, { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Loader2, AlertCircle, Paperclip } from "lucide-react";
import BaseModal from "./BaseModal";
import ConfirmationModal from "./ConfirmationModal";
import { ShipmentsService } from "../../services/shipments.service";
import type { LedgerLine, LedgerLineDocument } from "../../utils/types/shipment.type";

function formatDocDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export type LedgerLineDocumentsModalProps = {
  open: boolean;
  shipmentId: string;
  line: LedgerLine | null;
  refreshKey?: number;
  onClose: () => void;
  onDocumentsChanged?: () => void | Promise<void>;
  onAttachDocument?: () => void;
};

const LedgerLineDocumentsModal: React.FC<LedgerLineDocumentsModalProps> = ({
  open,
  shipmentId,
  line,
  refreshKey = 0,
  onClose,
  onDocumentsChanged,
  onAttachDocument,
}) => {
  const [items, setItems] = useState<LedgerLineDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const lineId = line?._id;

  const loadDocuments = useCallback(async () => {
    if (!shipmentId || !lineId) return;
    setLoading(true);
    setError(null);
    try {
      const docs = await ShipmentsService.getLedgerLineDocuments(
        shipmentId,
        lineId,
      );
      setItems(docs);
    } catch {
      setError("Failed to load documents.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, lineId]);

  useEffect(() => {
    if (!open || !lineId) {
      setItems([]);
      setError(null);
      return;
    }
    void loadDocuments();
  }, [open, lineId, refreshKey, loadDocuments]);

  const handleDownload = async (doc: LedgerLineDocument) => {
    if (!lineId) return;
    setDownloadingId(doc._id);
    try {
      const blob = await ShipmentsService.downloadLedgerLineDocumentBlob(
        shipmentId,
        lineId,
        doc._id,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalFileName || doc.fileName || "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const runDelete = async (documentId: string) => {
    if (!lineId) return;
    setConfirmDeleteId(null);
    setDeletingId(documentId);
    setError(null);
    try {
      await ShipmentsService.deleteLedgerLineDocument(
        shipmentId,
        lineId,
        documentId,
      );
      setItems((prev) => prev.filter((d) => d._id !== documentId));
      await onDocumentsChanged?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete document.";
      setError(typeof msg === "string" ? msg : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!open || !line) {
    return null;
  }

  const busy = downloadingId !== null || deletingId !== null;

  return (
    <>
      <BaseModal
        noHeader
        className="max-w-4xl !max-h-[min(85vh,32rem)] !overflow-hidden !p-0"
        hideModalFooter
        disableBackdrop={busy}
        onHide={busy ? () => {} : onClose}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="w-full shrink-0 border-b border-rose-100 bg-rose-50/90 px-3 py-3 sm:px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-semibold text-rose-950">
                    Documents
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-rose-900/90">
                  {loading
                    ? "…"
                    : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="box-border flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center !rounded-full border-2 border-neutral-700 bg-white p-0 text-[26px] font-light leading-none text-neutral-900 shadow-md transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
              >
                <span aria-hidden className="-mt-[5px] block select-none">
                  &times;
                </span>
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-300" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 py-4 text-sm text-red-600">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
              <p className="text-sm text-neutral-500">
                No documents uploaded yet.
              </p>
              {onAttachDocument && (
                <button
                  type="button"
                  onClick={onAttachDocument}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <Paperclip size={14} />
                  Attach document
                </button>
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-100/90">
                      <th className="px-3 py-2.5 font-medium text-neutral-500">
                        File name
                      </th>
                      <th className="px-3 py-2.5 font-medium text-neutral-500">
                        Description / Note
                      </th>
                      <th className="px-3 py-2.5 font-medium text-neutral-500">
                        Date
                      </th>
                      <th className="px-3 py-2.5 font-medium text-neutral-500">
                        Size
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium text-neutral-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((doc) => (
                      <tr
                        key={doc._id}
                        className="border-b border-neutral-100 hover:bg-neutral-50/80"
                      >
                        <td className="max-w-[180px] px-3 py-3 align-middle font-medium text-neutral-900">
                          <span className="break-words">{doc.originalFileName}</span>
                        </td>
                        <td className="max-w-[220px] px-3 py-3 align-middle text-neutral-600">
                          <span className="line-clamp-3 break-words">
                            {doc.note?.trim() ? doc.note : "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-middle text-neutral-600">
                          {formatDocDate(doc.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-middle text-neutral-600">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={
                                downloadingId === doc._id || deletingId === doc._id
                              }
                              onClick={() => void handleDownload(doc)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {downloadingId === doc._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download size={14} strokeWidth={2} />
                              )}
                              Download
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === doc._id}
                              onClick={() => setConfirmDeleteId(doc._id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-300 bg-white p-0 leading-none hover:bg-red-50 disabled:opacity-40"
                              aria-label="Delete document"
                            >
                              {deletingId === doc._id ? (
                                <Loader2
                                  size={16}
                                  strokeWidth={2}
                                  style={{
                                    color: "#DC2626",
                                    display: "block",
                                  }}
                                />
                              ) : (
                                <Trash2
                                  size={16}
                                  strokeWidth={2}
                                  style={{
                                    color: "#DC2626",
                                    display: "block",
                                  }}
                                />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>
      </BaseModal>

      {confirmDeleteId && (
        <ConfirmationModal
          title="Delete document"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => void runDelete(confirmDeleteId)}
          confirmLabel="Delete"
          cancelLabel="Cancel"
        >
          <p className="text-sm text-neutral-600">
            Are you sure you want to delete this document?
          </p>
        </ConfirmationModal>
      )}
    </>
  );
};

export default LedgerLineDocumentsModal;
