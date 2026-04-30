import { Injectable, Logger } from "@nestjs/common";
import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Storage service abstraction for PDF files
 * Currently uses local filesystem, but can be swapped for S3 or other storage
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor() {
    // Use ./storage relative to project root, but can be configured via env var
    const projectRoot = process.cwd();
    this.basePath =
      process.env.STORAGE_PATH || join(projectRoot, "storage");
    this.ensureBasePath();
  }

  private async ensureBasePath(): Promise<void> {
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true });
    }
  }

  /**
   * Generate storage key/path for a document
   * Format: shipments/{shipmentId}/{documentType}/v{version}.pdf
   */
  generateStorageKey(
    shipmentId: string,
    documentType: string,
    version: number,
  ): string {
    return `shipments/${shipmentId}/${documentType}/v${version}.pdf`;
  }

  /**
   * Storage key for a ledger line supporting document (any mime).
   * Format: shipments/{shipmentId}/ledger-documents/{ledgerLineId}/{fileName}
   */
  generateLedgerDocumentStorageKey(
    shipmentId: string,
    ledgerLineId: string,
    fileName: string,
  ): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `shipments/${shipmentId}/ledger-documents/${ledgerLineId}/${safe}`;
  }

  /**
   * Get full file path from storage key
   */
  getFilePath(storageKey: string): string {
    return join(this.basePath, storageKey);
  }

  /**
   * Save PDF buffer to storage
   */
  async saveFile(storageKey: string, buffer: Buffer): Promise<void> {
    const filePath = this.getFilePath(storageKey);
    const dirPath = join(filePath, "..");
    
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    await writeFile(filePath, buffer);
  }

  /**
   * Remove a file from storage. Logs and swallows errors (best-effort cleanup).
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      const filePath = this.getFilePath(storageKey);
      await unlink(filePath);
    } catch (err) {
      this.logger.warn(
        `Could not delete stored file for key "${storageKey}": ${err}`,
      );
    }
  }

  /**
   * Read file from storage
   */
  async readFile(storageKey: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageKey);
    return readFile(filePath);
  }

  /**
   * Check if file exists
   */
  async fileExists(storageKey: string): Promise<boolean> {
    const filePath = this.getFilePath(storageKey);
    return existsSync(filePath);
  }

  /**
   * Generate a placeholder PDF buffer (stub implementation)
   * In production, this would use a PDF library like pdfkit or puppeteer
   */
  async generatePlaceholderPDF(
    shipmentId: string,
    documentType: string,
    version: number,
  ): Promise<Buffer> {
    // Stub: Generate a simple PDF-like buffer
    // In production, use pdfkit or similar
    const content = `Placeholder PDF for ${documentType} v${version} - Shipment ${shipmentId}\nGenerated at ${new Date().toISOString()}`;
    return Buffer.from(content);
  }
}