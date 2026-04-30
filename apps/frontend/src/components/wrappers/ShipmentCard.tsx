/* eslint-disable @typescript-eslint/no-explicit-any */
import ExpandableCard from "../ExpandableCard"
import {
  shipmentColumnConfig,
  shipmentCargoConfig
} from "../../configs/shipmentCard.config"

export default function ShipmentCard({
  shipment
}: {
  shipment: any
}) {

  return (

    <ExpandableCard
      data={shipment}
      columnConfig={shipmentColumnConfig}
      expandedData={shipment.cargo?.containers ?? []}
      expandedColumnConfig={shipmentCargoConfig}
    />

  )

}