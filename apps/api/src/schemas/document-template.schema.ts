import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { ShipmentMode } from "./shipment.schema";
import { DocumentType } from "./shipment-document.schema";

export type DocumentTemplateDocument = HydratedDocument<DocumentTemplate>;

/**
 * Document Template Schema
 * Stores HTML templates for generating PDF documents based on shipment mode and document type
 */
@Schema({ timestamps: true, collection: "document_templates" })
export class DocumentTemplate {
  @Prop({
    type: String,
    enum: Object.values(ShipmentMode),
    required: true,
  })
  mode: ShipmentMode;

  @Prop({
    type: String,
    enum: Object.values(DocumentType),
    required: true,
  })
  documentType: DocumentType;

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 1,
  })
  templateVersion: number;

  @Prop({
    type: String,
    required: true,
  })
  html: string; // Handlebars template HTML

  @Prop({
    type: String,
    required: false,
  })
  css?: string; // Optional CSS styles

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  isActive: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: false,
  })
  updatedBy?: Types.ObjectId;
}

export const DocumentTemplateSchema =
  SchemaFactory.createForClass(DocumentTemplate);

// Unique index: only one active template per (mode, documentType)
DocumentTemplateSchema.index(
  { mode: 1, documentType: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);

// Index for querying templates
DocumentTemplateSchema.index({ mode: 1, documentType: 1 });
DocumentTemplateSchema.index({ isActive: 1 });
DocumentTemplateSchema.index({ createdAt: -1 });
