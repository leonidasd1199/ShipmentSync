/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnConfig } from "../components/ExpandableCard"

const formatDate = (date?: string) => {
  if (!date) return "-"
  return new Date(date).toLocaleDateString()
}

export const shipmentColumnConfig: ColumnConfig<any>[] = [

  {
    label: "Mode",
    accessor: "mode"
  },

  {
    label: "Incoterm",
    accessor: "incoterm"
  },

  {
    label: "Shipper",
    accessor: "parties",
    CellTemplate: ({ row }) => (
      <span>{row.parties?.shipper?.name || "-"}</span>
    )
  },

  {
    label: "Consignee",
    accessor: "parties",
    CellTemplate: ({ row }) => (
      <span>{row.parties?.consignee?.name || "-"}</span>
    )
  },

  {
    label: "Booking",
    accessor: "bookingNumber"
  },

  {
    label: "MBL",
    accessor: "mblNumber"
  },

  {
    label: "HBL",
    accessor: "hblNumber"
  },

  {
    label: "Vessel",
    accessor: "transport",
    CellTemplate: ({ row }) => (
      <span>{row.transport?.vesselName || "-"}</span>
    )
  },

  {
    label: "Voyage",
    accessor: "transport",
    CellTemplate: ({ row }) => (
      <span>{row.transport?.voyageNumber || "-"}</span>
    )
  },

  {
    label: "Origin",
    accessor: "transport",
    CellTemplate: ({ row }) => (
      <span>{row.transport?.placeOfReceipt || "-"}</span>
    )
  },

  {
    label: "Destination",
    accessor: "transport",
    CellTemplate: ({ row }) => (
      <span>{row.transport?.placeOfDelivery || "-"}</span>
    )
  },

  {
    label: "ETD",
    accessor: "dates",
    CellTemplate: ({ row }) => (
      <span>{formatDate(row.dates?.etd)}</span>
    )
  },

  {
    label: "ETA",
    accessor: "dates",
    CellTemplate: ({ row }) => (
      <span>{formatDate(row.dates?.eta)}</span>
    )
  }

]

export const shipmentCargoConfig: ColumnConfig<any>[] = [

  {
    label: "Container #",
    accessor: "containerNumber"
  },

  {
    label: "Seal",
    accessor: "sealNumber"
  },

  {
    label: "Type",
    accessor: "containerType"
  }

]