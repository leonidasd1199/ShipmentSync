import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ShipmentsController } from "./shipments.controller";
import { IncotermRequirementsController } from "./incoterm-requirements.controller";
import { ShipmentService } from "./services/shipment.service";
import { ShipmentDocumentService } from "./services/shipment-document.service";
import { DocumentEngineService } from "./services/document-engine.service";
import { DocumentTemplateService } from "./services/document-template.service";
import { ShipmentLedgerService } from "./services/shipment-ledger.service";
import { IncotermRequirementService } from "./services/incoterm-requirement.service";
import { StorageService } from "./services/storage.service";
import { Shipment, ShipmentSchema } from "../schemas/shipment.schema";
import {
  ShipmentDocument,
  ShipmentDocumentSchema,
} from "../schemas/shipment-document.schema";
import {
  ShipmentLedgerLine,
  ShipmentLedgerLineSchema,
} from "../schemas/shipment-ledger-line.schema";
import {
  ShipmentLedgerDocument,
  ShipmentLedgerDocumentSchema,
} from "../schemas/shipment-ledger-document.schema";
import {
  IncotermRequirement,
  IncotermRequirementSchema,
} from "../schemas/incoterm-requirement.schema";
import {
  DocumentTemplate,
  DocumentTemplateSchema,
} from "../schemas/document-template.schema";
import { Quotation, QuotationSchema } from "../schemas/quotation.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { Shipping, ShippingSchema } from "../schemas/shipping.schema";
import { AuthModule } from "../auth/auth.module";
import { DocumentTemplatesController } from "./document-templates.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: ShipmentDocument.name, schema: ShipmentDocumentSchema },
      { name: ShipmentLedgerLine.name, schema: ShipmentLedgerLineSchema },
      {
        name: ShipmentLedgerDocument.name,
        schema: ShipmentLedgerDocumentSchema,
      },
      { name: IncotermRequirement.name, schema: IncotermRequirementSchema },
      { name: DocumentTemplate.name, schema: DocumentTemplateSchema },
      { name: Quotation.name, schema: QuotationSchema },
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Shipping.name, schema: ShippingSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    ShipmentsController,
    IncotermRequirementsController,
    DocumentTemplatesController,
  ],
  providers: [
    ShipmentService,
    ShipmentDocumentService,
    DocumentEngineService,
    DocumentTemplateService,
    ShipmentLedgerService,
    IncotermRequirementService,
    StorageService,
  ],
  exports: [
    ShipmentService,
    ShipmentDocumentService,
    ShipmentLedgerService,
    IncotermRequirementService,
  ],
})
export class ShipmentsModule {}