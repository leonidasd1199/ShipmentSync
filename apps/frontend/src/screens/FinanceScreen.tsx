import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import FinanceLedgerDashboard from "./FinanceLedgerDashboard";

type FinanceTab = "credits" | "debits";

export default function FinanceScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: FinanceTab =
    tabParam === "credits" || tabParam === "debits" ? tabParam : "debits";

  const setTab = useCallback(
    (next: FinanceTab) => {
      setSearchParams({ tab: next }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-[24px] font-semibold whitespace-normal break-words truncate">
            Finance
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Finance dashboards"
          className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 sm:inline-flex sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "credits"}
            onClick={() => setTab("credits")}
            className={[
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "credits"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            ].join(" ")}
          >
            Credits Dashboard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "debits"}
            onClick={() => setTab("debits")}
            className={[
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "debits"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            ].join(" ")}
          >
            Debits Dashboard
          </button>
        </div>
      </div>

      {activeTab === "credits" ? (
        <FinanceLedgerDashboard
          side="CREDIT"
          panelHeading="Credits"
          emptyMessage="No credits found."
          amountColumnLabel="Amount"
          deleteModalTitle="Delete credit"
          deleteModalBody="Are you sure you want to delete this credit?"
          successDeleteMessage="Credit deleted successfully."
        />
      ) : (
        <FinanceLedgerDashboard
          side="DEBIT"
          panelHeading="Debits"
          emptyMessage="No debits found."
          amountColumnLabel="Amount to Paid"
          deleteModalTitle="Delete debit"
          deleteModalBody="Are you sure you want to delete this debit?"
          successDeleteMessage="Debit deleted successfully."
        />
      )}
    </div>
  );
}
