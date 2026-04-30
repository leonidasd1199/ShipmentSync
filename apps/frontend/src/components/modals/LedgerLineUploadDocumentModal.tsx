import React, { useCallback, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { CloudUpload } from "lucide-react";
import BaseModal from "./BaseModal";
import { ShipmentsService } from "../../services/shipments.service";

export type LedgerLineUploadDocumentModalProps =
  | {
      open: boolean;
      mode: "local";
      lineLabel: string;
      onHide: () => void;
      onConfirm: (file: File, note: string) => void;
    }
  | {
      open: boolean;
      mode: "persist";
      shipmentId: string;
      lineId: string;
      lineLabel: string;
      onHide: () => void;
      onUploaded: () => void | Promise<void>;
    };

export default function LedgerLineUploadDocumentModal(
  props: LedgerLineUploadDocumentModalProps,
) {
  const { open, lineLabel, onHide } = props;
  const persistLineId = props.mode === "persist" ? props.lineId : "";
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setNote("");
    setDragOver(false);
    setError(null);
    setUploading(false);
  }, [open, lineLabel, props.mode, persistLineId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handlePrimary = useCallback(async () => {
    if (!file || uploading) return;
    const trimmedNote = note.trim();

    if (props.mode === "local") {
      props.onConfirm(file, trimmedNote);
      onHide();
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await ShipmentsService.uploadLedgerLineDocument(
        props.shipmentId,
        props.lineId,
        file,
        { note: trimmedNote || undefined },
      );
      await props.onUploaded();
      onHide();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Upload failed. Please try again.";
      setError(typeof msg === "string" ? msg : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [file, note, uploading, props, onHide]);

  if (!open) return null;

  return (
    <BaseModal
      className="max-w-lg px-6 py-5"
      title="Upload Document"
      disableBackdrop={uploading}
      primaryActionLabel={uploading ? "Uploading…" : "Upload Document"}
      primaryActionDisabled={!file || uploading}
      onPrimaryAction={() => void handlePrimary()}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={uploading}
      onSecondaryAction={onHide}
      onHide={uploading ? () => {} : onHide}
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-800">Line: </span>
          {lineLabel}
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Document
          </label>
          <div
            role="presentation"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={classNames(
              "flex min-h-[140px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
              dragOver
                ? "border-[#00C2C7] bg-[#00C2C7]/5"
                : "border-neutral-300 bg-neutral-50/80",
            )}
          >
            <CloudUpload
              className="mb-2 h-9 w-9 text-neutral-400"
              strokeWidth={1.25}
            />
            <p className="mb-2 text-sm text-neutral-600">
              Drag &amp; drop your file here or
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-full border border-[#00C2C7] bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-[#00C2C7]/10 focus:outline-none focus:ring-2 focus:ring-[#00C2C7]/40 disabled:opacity-50"
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                e.target.value = "";
              }}
            />
            {file && (
              <p className="mt-3 max-w-full truncate text-xs font-medium text-neutral-800">
                {file.name}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="ledger-upload-note"
            className="mb-1 block text-sm font-medium text-neutral-800"
          >
            Note
          </label>
          <textarea
            id="ledger-upload-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional notes about this document…"
            rows={3}
            maxLength={4000}
            disabled={uploading}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#00C2C7] focus:outline-none focus:ring-2 focus:ring-[#00C2C7]/30 disabled:opacity-60 [color-scheme:light]"
          />
          <p className="mt-1 text-right text-[10px] text-neutral-400">
            {note.length} / 4000
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
