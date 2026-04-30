/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnConfig } from "../components/ExpandableCard"
import LabelCurrency from "../components/LabelCurrency";

/** Shape expected by QuotationCard / ExpandableCard for each quotation row (must match accessors below) */
export type QuotationCardRow = {
  id?: string;
  quoteNumber: string;
  destination: string;
  date: string;
  validUntil: string;
  origin: string;
  items: QuotationCardItem[];
};

/** Shape expected for each line item in the expanded section (must match quotationItemsConfig accessors) */
export type QuotationCardItem = {
  description: string;
  amount: number;
  currency?: string;
};

export const quotationColumnConfig: ColumnConfig<any>[] = [

  {
    label: "Quotation #",
    accessor: "quoteNumber"
  },

  {
    label: "Destination",
    accessor: "destination"
  },

  {
    label: "Date",
    accessor: "date"
  },

  {
    label: "Valid",
    accessor: "validUntil"
  },

  {
    label: "Origin",
    accessor: "origin",
    CellTemplate: ({ row }) => (
      <span className="font-medium">
        {row.origin || "-"}
      </span>
    )

  }


];

export const quotationItemsConfig: ColumnConfig<any>[] = [

  {
    label: "Description",
    accessor: "description"
  },

  {
    label: "Amount",
    accessor: "amount",
    CellTemplate: ({ row }) => (
      <LabelCurrency
        amount={row.amount}
        currency={row.currency}
      />
    )
  }
]