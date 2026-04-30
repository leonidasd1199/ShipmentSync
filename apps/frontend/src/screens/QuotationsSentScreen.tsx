import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Download, FileText } from "lucide-react";
import { QuotationsService } from "../services/quotations.service";
import type { QuotationResponse } from "../utils/types/quotation.type";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600 border-neutral-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function QuotationsSentScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pricelistId = searchParams.get("pricelistId") ?? undefined;

  const [quotations, setQuotations] = useState<QuotationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await QuotationsService.findAll({
          sourcePricelistId: pricelistId,
          limit: 100,
          sort: "createdAt",
          order: "DESC" as any,
        });
        setQuotations(res.items ?? []);
      } catch {
        setError("Could not load quotations.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [pricelistId]);

  const handleDownload = async (q: QuotationResponse) => {
    setDownloadingId(q.id);
    try {
      const blob = await QuotationsService.downloadPdf(q.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${q.quoteNumber ?? q.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors [&_svg]:block [&_svg]:shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Quotations Sent</h1>
            {pricelistId && (
              <p className="text-sm text-neutral-500 mt-0.5">Quotes generated from this pricelist</p>
            )}
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-neutral-300" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && quotations.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-white py-16 text-center">
            <FileText size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500">No quotations sent from this pricelist yet.</p>
          </div>
        )}

        {!loading && !error && quotations.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Quote #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Valid Until</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {q.quoteNumber ?? q.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {(q.client as any)?.name ?? q.clientId}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {q.portOfOriginData?.name && q.portOfDestinationData?.name
                        ? `${q.portOfOriginData.name} → ${q.portOfDestinationData.name}`
                        : q.incoterm ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {q.validUntil
                        ? new Date(q.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[q.status] ?? STATUS_COLORS.draft}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 font-medium">
                      {q.total != null
                        ? `${q.total.toLocaleString()} ${q.pricingConfig?.currency ?? "USD"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDownload(q)}
                        disabled={downloadingId === q.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                      >
                        {downloadingId === q.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />}
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
