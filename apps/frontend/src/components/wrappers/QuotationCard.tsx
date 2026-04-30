/* eslint-disable @typescript-eslint/no-explicit-any */
import { Download } from "lucide-react"
import ExpandableCard from "../ExpandableCard"
import { quotationColumnConfig, quotationItemsConfig } from "../../configs/quotationCard.config"

export default function QuotationCard({
    quotation,
    onDownload
}: {
    quotation: any
    onDownload: () => void
}) {

    return (

        <ExpandableCard
            data={quotation}
            columnConfig={quotationColumnConfig}
            expandedData={quotation.items}
            expandedColumnConfig={quotationItemsConfig}

            action={
                <button
                    onClick={onDownload}
                    style={{ backgroundColor: "#fff", color: "#404040" }}
                    className="flex items-center gap-2 text-sm border border-neutral-300 px-3 py-2 rounded-md shadow-sm"
                >
                    <Download size={16} />
                    Download
                </button>
            }

        />

    )
}