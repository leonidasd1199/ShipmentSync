import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  DocumentTemplate,
  DocumentTemplateDocument,
} from "../../schemas/document-template.schema";
import { ShipmentMode } from "../../schemas/shipment.schema";
import { DocumentType } from "../../schemas/shipment-document.schema";

@Injectable()
export class DocumentTemplateService {
  constructor(
    @InjectModel(DocumentTemplate.name)
    private templateModel: Model<DocumentTemplateDocument>,
  ) {}

  /**
   * Create a new template
   */
  async create(
    dto: {
      mode: ShipmentMode;
      documentType: DocumentType;
      html: string;
      css?: string;
      userId: string;
    },
  ): Promise<DocumentTemplateDocument> {
    // Get next version
    const existing = await this.templateModel
      .findOne({
        mode: dto.mode,
        documentType: dto.documentType,
      })
      .sort({ templateVersion: -1 })
      .exec();

    const templateVersion = existing ? existing.templateVersion + 1 : 1;

    // If setting as active, deactivate others
    if (dto.mode && dto.documentType) {
      await this.templateModel.updateMany(
        {
          mode: dto.mode,
          documentType: dto.documentType,
          isActive: true,
        },
        { isActive: false },
      );
    }

    const template = await this.templateModel.create({
      mode: dto.mode,
      documentType: dto.documentType,
      templateVersion,
      html: dto.html,
      css: dto.css,
      isActive: true, // New templates are active by default
      createdBy: new Types.ObjectId(dto.userId),
    });

    return template;
  }

  /**
   * Find templates with filters
   */
  async findAll(filters: {
    mode?: ShipmentMode;
    documentType?: DocumentType;
    active?: boolean;
  }): Promise<DocumentTemplateDocument[]> {
    const query: any = {};

    if (filters.mode) {
      query.mode = filters.mode;
    }
    if (filters.documentType) {
      query.documentType = filters.documentType;
    }
    if (filters.active !== undefined) {
      query.isActive = filters.active;
    }

    return this.templateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Find active template for mode and document type
   */
  async findActive(
    mode: ShipmentMode,
    documentType: DocumentType,
  ): Promise<DocumentTemplateDocument | null> {
    return this.templateModel
      .findOne({
        mode,
        documentType,
        isActive: true,
      })
      .exec();
  }

  /**
   * Find template by ID
   */
  async findOne(id: string): Promise<DocumentTemplateDocument> {
    const template = await this.templateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    return template;
  }

  /**
   * Update template
   */
  async update(
    id: string,
    dto: {
      html?: string;
      css?: string;
      userId: string;
    },
  ): Promise<DocumentTemplateDocument> {
    const template = await this.findOne(id);

    const updateData: any = {
      updatedBy: new Types.ObjectId(dto.userId),
    };

    if (dto.html !== undefined) {
      updateData.html = dto.html;
    }
    if (dto.css !== undefined) {
      updateData.css = dto.css;
    }

    const updated = await this.templateModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    
    return updated;
  }

  /**
   * Activate a template (deactivates others for same mode+documentType)
   */
  async activate(id: string, userId: string): Promise<DocumentTemplateDocument> {
    const template = await this.findOne(id);

    // Deactivate other templates for same mode+documentType
    await this.templateModel.updateMany(
      {
        mode: template.mode,
        documentType: template.documentType,
        isActive: true,
        _id: { $ne: new Types.ObjectId(id) },
      },
      {
        isActive: false,
        updatedBy: new Types.ObjectId(userId),
      },
    );

    // Activate this template
    const updated = await this.templateModel
      .findByIdAndUpdate(
        id,
        {
          isActive: true,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    
    if (!updated) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    
    return updated;
  }

  /**
   * Delete template
   */
  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateModel.findByIdAndDelete(id).exec();
  }
}
