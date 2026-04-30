/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useClientUser } from "../../hooks/useClientUser"
import QuotationCard from "../../components/wrappers/QuotationCard"
import { ClientUserService } from "../../services/client.user.service"


export default function ClientQuotationsScreen() {

    const navigate = useNavigate()

    const { priceList, isLoading, error } = useClientUser()

    const [search, setSearch] = useState("")

    const handleDownload = async (quotation: any) => {
        const blob = await ClientUserService.downloadDeliveryPdf(quotation.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Quote-${quotation.quoteNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-56px)] flex items-center justify-center">
                Loading quotations...
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-[calc(100vh-56px)] flex items-center justify-center">
                Error loading quotations
            </div>
        )
    }

    const filtered = priceList.filter((q: any) =>
        q.destination?.toLowerCase().includes(search.toLowerCase()) ||
        q.origin?.toLowerCase().includes(search.toLowerCase()) ||
        q.quoteNumber?.toLowerCase().includes(search.toLowerCase())
    )

    return (

        <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain overflow-y-auto bg-white text-neutral-900 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">

                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                        <ArrowLeft size={16} />
                    </button>

                    <h1 className="text-[24px] font-semibold truncate">
                        Quotations
                    </h1>

                </div>
                <div className="relative w-full sm:max-w-xs">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search quotations..."
                        className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        ⌘K
                    </span>

                </div>

            </div>

            <div className="space-y-4">

                {filtered.map((quotation: any) => (

                    <QuotationCard
                        key={quotation.id}
                        quotation={quotation}
                        onDownload={()=>handleDownload(quotation)}
                    />

                ))}

            </div>

        </div>

    )
}