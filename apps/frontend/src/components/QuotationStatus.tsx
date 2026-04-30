import React from "react";
import { QuotationStatusEnum } from "../utils/constants";

interface QuotationStatusProps {
    status: QuotationStatusEnum | string;
    className?: string;
}

const STATUS_STYLES: Record<string, string> = {
    [QuotationStatusEnum.Rejected]: "text-[#8B0000]",
    [QuotationStatusEnum.Accepted]: "text-[#556B2F]",
    [QuotationStatusEnum.Draft]: "text-[#4B5563]",
    [QuotationStatusEnum.Sent]: "text-[#2563EB]",
};

const QuotationStatus: React.FC<QuotationStatusProps> = ({
    status,
    className = "",
}) => {
    const colorClass = STATUS_STYLES[status] || "text-neutral-600";
    const formattedStatus = String(status).toUpperCase();

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${colorClass} bg-current`} />
            <span className="text-xs font-semibold text-black">
                {formattedStatus}
            </span>
        </div>
    );
};

export default QuotationStatus;
