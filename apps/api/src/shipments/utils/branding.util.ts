import { existsSync, readFileSync } from "fs";
import { extname, resolve } from "path";

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Reads an image from disk and returns a data URI suitable for PDF HTML (Playwright).
 * @param filePath Absolute path or path relative to process.cwd()
 */
export function readImageFileAsDataUri(filePath: string): string | null {
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    return null;
  }
  const ext = extname(abs).toLowerCase();
  const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";
  const buf = readFileSync(abs);
  return `data:${mime};base64,${buf.toString("base64")}`;
}
