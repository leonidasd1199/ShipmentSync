/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback } from "react";
import classNames from "classnames";
import BaseModal from "./BaseModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { HistoryService, type HistoryItem } from "../../services/history.service";

export interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  entityType: "client" | "office" | "user" | string;
  entityId: string | null;
  title?: string;
  className?: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  open,
  onClose,
  entityType,
  entityId,
  title = "History",
  className,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string>("");
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);

  const totalPages = Math.ceil(total / pageSize);

  const fetchHistory = useCallback(async () => {
    if (!entityId || !entityType) return;

    setLoading(true);
    setError(null);
    try {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;

      if (toDate) toDate.setHours(23, 59, 59, 999);
      if (fromDate) fromDate.setHours(0, 0, 0, 0);

      const data = await HistoryService.findAll({
        entityType,
        entityId,
        page,
        pageSize,
        action,
        from: fromDate ? fromDate.toISOString() : undefined,
        to: toDate ? toDate.toISOString() : undefined,
      });

      setHistory(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, page, pageSize, action, from, to]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchHistory();
    }
  }, [action, from, to]);

  // ✅ FIX: update when page changes
  useEffect(() => {
    if (open) fetchHistory();
  }, [page]);

  const handleResetFilters = () => {
    setAction("");
    setFrom(null);
    setTo(null);
    setPage(1);
    fetchHistory();
  };

  if (!open) return null;

  return (
    <BaseModal
      className={classNames("px-6 py-5", className)}
      title={title}
      onHide={onClose}
      hideModalFooter
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          {/* Date pickers + reset */}
          <div className="flex flex-1 justify-end items-end gap-3 flex-wrap sm:flex-nowrap">
            <div className="w-full sm:w-[150px]">
              <label className="block text-sm font-medium text-neutral-800 mb-1">
                From
              </label>
              <DatePicker
                selected={from}
                onChange={(date) => setFrom(date)}
                dateFormat="yyyy-MM-dd"
                placeholderText="Start date"
                className="block w-full rounded-lg border border-neutral-300 px-3 py-[7px] text-sm bg-white text-neutral-900"
                maxDate={to || new Date()}
              />
            </div>

            <div className="w-full sm:w-[150px]">
              <label className="block text-sm font-medium text-neutral-800 mb-1">
                To
              </label>
              <DatePicker
                selected={to}
                onChange={(date) => setTo(date)}
                dateFormat="yyyy-MM-dd"
                placeholderText="End date"
                className="block w-full rounded-lg border border-neutral-300 px-3 py-[7px] text-sm bg-white text-neutral-900"
                minDate={from || undefined}
                maxDate={new Date()}
              />
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-sm text-neutral-500 border border-neutral-200 hover:border-neutral-300 rounded-lg px-3 py-[7px] bg-white hover:bg-neutral-50 transition"
              title="Reset filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-[#F8FAFC] text-sm font-semibold text-neutral-700">
              <tr>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Summary</th>
                <th className="px-4 py-2 text-left">Responsible</th>
                <th className="px-4 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    Loading history...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    No history records found.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h._id}>
                    <td className="px-4 py-2 text-neutral-800 capitalize">
                      {h.action}
                    </td>
                    <td className="px-4 py-2 text-neutral-700">{h.summary}</td>
                    <td className="px-4 py-2 text-neutral-700">{h.actorName}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {format(new Date(h.timestamp), "yyyy-MM-dd HH:mm:ss")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-neutral-700">
            <span>
              Page {page} of {totalPages || 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-md border border-neutral-300 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-md border border-neutral-300 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default HistoryModal;
