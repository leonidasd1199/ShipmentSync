type LabelCurrencyProps = {
    amount: number | string
    currency?: string
}

const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    CNY: "¥",
    RMB: "¥",
    GBP: "£",
    JPY: "¥"
}

export default function LabelCurrency({ amount, currency = "USD" }: LabelCurrencyProps) {
    const symbol = currencySymbols[currency] || "$"

    const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0)

    return (
        <span className="font-semibold">
            {symbol}{formatted}
        </span>
    )
}