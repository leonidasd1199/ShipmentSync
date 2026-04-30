/**
 * Canonical HAWB template aligned to operational paper format.
 * Keep in sync with migration and preview script.
 */
export const HAWB_STANDARD_HTML = `
<div class="hawb-document">
  <div class="hawb-topline">
    <div class="awb-code">{{transport.airlinePrefix}}</div>
    <div class="awb-airport">{{transport.airportOfDepartureCode}}</div>
    <div class="awb-number">{{transport.hawbNumber}}</div>
    <div class="awb-file">{{transport.fileNumber}}</div>
  </div>

  <div class="hawb-header-grid">
    <div class="title-col">
      <div class="hawb-title">AIR WAYBILL</div>
      <div class="hawb-subtitle">Not Negotiable</div>
      <div class="issued-by">Issued by {{company.legalName}}</div>
    </div>
  </div>

  <table class="party-table">
    <tr>
      <td>
        <div class="cell-title">Shipper's Name and Address</div>
        <div>{{parties.shipper.name}}</div>
        <div>{{parties.shipper.address}}</div>
        <div>{{parties.shipper.contact}}</div>
      </td>
      <td class="account-col">
        <div class="cell-title">Shipper's Account Number</div>
        <div>{{transport.shipperAccountNumber}}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="cell-title">Consignee's Name and Address</div>
        <div>{{parties.consignee.name}}</div>
        <div>{{parties.consignee.address}}</div>
        <div>{{parties.consignee.contact}}</div>
      </td>
      <td class="account-col">
        <div class="cell-title">Consignee's Account Number</div>
        <div>{{transport.consigneeAccountNumber}}</div>
      </td>
    </tr>
  </table>

  <table class="routing-table">
    <tr>
      <td><strong>Issuing Carrier's Agent Name and City:</strong><br/>{{transport.issuingCarrierAgent}}</td>
      <td><strong>Agent's IATA Code:</strong> {{transport.agentIataCode}}</td>
      <td><strong>Account No.:</strong> {{transport.agentAccountNumber}}</td>
    </tr>
    <tr>
      <td colspan="3"><strong>Airport of Departure and Requested Routing:</strong> {{transport.airportOfDeparture}}</td>
    </tr>
    <tr>
      <td><strong>To:</strong> {{transport.toAirportCode}}</td>
      <td><strong>By First Carrier:</strong> {{transport.firstCarrier}}</td>
      <td><strong>To:</strong> {{transport.airportOfDestination}}</td>
    </tr>
    <tr>
      <td colspan="3"><strong>Requested Flight/Date:</strong> {{transport.requestedFlight}} {{transport.requestedFlightDate}}</td>
    </tr>
  </table>

  <table class="charges-table">
    <tr>
      <td><strong>Currency:</strong> {{transport.currency}}</td>
      <td><strong>CHGS Code:</strong> {{transport.chargesCode}}</td>
      <td><strong>Declared Value for Carriage:</strong> {{transport.declaredValueCarriage}}</td>
      <td><strong>Declared Value for Customs:</strong> {{transport.declaredValueCustoms}}</td>
      <td><strong>Amount of Insurance:</strong> {{transport.insuranceAmount}}</td>
    </tr>
    <tr>
      <td colspan="5"><strong>Handling Information:</strong> {{transport.handlingInformation}}</td>
    </tr>
  </table>

  <table class="goods-table">
    <thead>
      <tr>
        <th class="pieces-col">No. of Pieces</th>
        <th class="weight-col">Gross Weight</th>
        <th class="charge-col">Chargeable Weight</th>
        <th class="rate-col">Rate / Charge</th>
        <th class="total-col">Total</th>
        <th class="goods-col">Nature and Quantity of Goods</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="pieces-col">{{cargo.packagesQuantity}}</td>
        <td class="weight-col">{{cargo.grossWeightKg}} KGS</td>
        <td class="charge-col">{{cargo.grossWeightKg}} KGS</td>
        <td class="rate-col">{{transport.ratePerKg}}</td>
        <td class="total-col">{{transport.totalCharge}}</td>
        <td class="goods-col">
          <div>{{cargo.goodsDescription}}</div>
          {{#if cargo.packagesType}}<div>{{cargo.packagesType}}</div>{{/if}}
          {{#if cargo.airDimensionsText}}<div>{{cargo.airDimensionsText}}</div>{{/if}}
        </td>
      </tr>
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td><strong>Total Prepaid:</strong> {{transport.totalPrepaid}}</td>
      <td><strong>Total Collect:</strong> {{transport.totalCollect}}</td>
      <td><strong>Charges at Destination:</strong> {{transport.chargesAtDestination}}</td>
      <td><strong>Total Collect Charges:</strong> {{transport.totalCollectCharges}}</td>
    </tr>
  </table>

  <table class="signature-table">
    <tr>
      <td>
        <div class="cell-title">Signature of Shipper or his Agent</div>
      </td>
      <td>
        <div class="cell-title">Executed on (date) at (place)</div>
        <div>{{transport.executedDate}} - {{transport.executedPlace}}</div>
      </td>
      <td>
        <div class="cell-title">Signature of Issuing Carrier or its Agent</div>
      </td>
    </tr>
  </table>
</div>
`;

export const HAWB_STANDARD_CSS = `
body { font-family: Arial, Helvetica, sans-serif; margin: 16px; color: #111; }
.hawb-document { width: 100%; font-size: 9px; }
.hawb-topline { display: grid; grid-template-columns: 55px 70px 1fr 1fr; border: 1px solid #2f7a4a; border-bottom: 0; background: #eaf5eb; }
.hawb-topline > div { border-right: 1px solid #2f7a4a; padding: 4px 6px; font-weight: 700; min-height: 20px; color: #1f5f35; }
.hawb-topline > div:last-child { border-right: 0; }
.hawb-header-grid { display: grid; grid-template-columns: 1fr; border: 1px solid #2f7a4a; padding: 6px; align-items: end; margin-bottom: 6px; background: #f3faf3; }
.hawb-title { font-size: 18px; font-weight: 800; text-transform: uppercase; }
.hawb-subtitle { font-size: 11px; margin-top: 2px; }
.issued-by { margin-top: 4px; font-size: 9px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
th, td { border: 1px solid #2f7a4a; padding: 5px; vertical-align: top; }
th { background: #eaf5eb; color: #1f5f35; text-transform: uppercase; font-size: 8px; }
.cell-title { font-weight: 700; margin-bottom: 2px; font-size: 8px; text-transform: uppercase; }
.account-col { width: 28%; }
.pieces-col { width: 10%; text-align: center; }
.weight-col { width: 12%; text-align: right; }
.charge-col { width: 13%; text-align: right; }
.rate-col { width: 12%; text-align: right; }
.total-col { width: 12%; text-align: right; }
.goods-col { width: 41%; }
`;
