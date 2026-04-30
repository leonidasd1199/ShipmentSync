import { ShipmentMode } from "../../schemas/shipment.schema";
import { DocumentType } from "../../schemas/shipment-document.schema";
import {
  BL_STANDARD_CSS,
  BL_STANDARD_HTML,
} from "../templates/bl-standard.template";
import {
  MANIFIESTO_CARGA_STANDARD_CSS,
  MANIFIESTO_CARGA_STANDARD_HTML,
} from "../templates/manifiesto-carga-standard.template";
import {
  CARTA_PORTE_STANDARD_CSS,
  CARTA_PORTE_STANDARD_HTML,
} from "../templates/carta-porte-standard.template";
import {
  HAWB_STANDARD_CSS,
  HAWB_STANDARD_HTML,
} from "../templates/hawb-standard.template";

export interface SeedTemplate {
  mode: ShipmentMode;
  documentType: DocumentType;
  html: string;
  css?: string;
}

export const seedTemplates: SeedTemplate[] = [
  {
    mode: ShipmentMode.OCEAN,
    documentType: DocumentType.BL,
    html: BL_STANDARD_HTML,
    css: BL_STANDARD_CSS,
  },
  {
    mode: ShipmentMode.LAND,
    documentType: DocumentType.CARTA_PORTE,
    html: CARTA_PORTE_STANDARD_HTML,
    css: CARTA_PORTE_STANDARD_CSS,
  },
  {
    mode: ShipmentMode.LAND,
    documentType: DocumentType.MANIFIESTO_CARGA,
    html: MANIFIESTO_CARGA_STANDARD_HTML,
    css: MANIFIESTO_CARGA_STANDARD_CSS,
  },
  {
    mode: ShipmentMode.AIR,
    documentType: DocumentType.HAWB,
    html: HAWB_STANDARD_HTML,
    css: HAWB_STANDARD_CSS,
  },
];
