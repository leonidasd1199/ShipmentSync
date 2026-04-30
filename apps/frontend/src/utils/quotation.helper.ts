/* eslint-disable @typescript-eslint/no-explicit-any */
export const formatDisplayDate = (dateStr: string): string => {
  const date = new Date(dateStr);

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export const calcProfit = (
  base: number,
  profit: { type: "percentage" | "fixed"; value: number }
): number => {

  if (profit.type === "percentage") {
    return (base * profit.value) / 100;
  }

  return profit.value;
};

export const calcWithProfit = (
  base: number,
  profit: { type: "percentage" | "fixed"; value: number }
): number => {

  return base + calcProfit(base, profit);
};

export const calcTotalSellingPrice = (route: any): number => {

  if (route.pricelistItems?.length) {

    return route.pricelistItems.reduce(
      (sum: number, item: any) =>
        sum + calcWithProfit(item.cost, item.profit),
      0
    );
  }

  const keys = [
    "oceanFreight",
    "destinationCharges",
    "originHandlingFees",
    "docFee",
    "inlandFreight"
  ] as const;

  let total = 0;

  for (const key of keys) {

    const base = route[key] || 0;

    const profit = route.profits?.[key] || {
      type: "percentage",
      value: 0
    };

    total += calcWithProfit(base, profit);
  }

  return total;
};

export const getOptionLabel = (index: number): string => {

  let label = "";
  let n = index;

  do {

    label = String.fromCharCode(65 + (n % 26)) + label;

    n = Math.floor(n / 26) - 1;

  } while (n >= 0);

  return label;
};