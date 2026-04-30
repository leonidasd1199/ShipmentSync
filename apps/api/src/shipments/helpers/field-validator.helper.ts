/**
 * Helper to validate nested field paths in shipment objects
 * Supports dot notation like "transport.vesselName", "cargo.containers"
 */
export class FieldValidatorHelper {
  /**
   * Get nested value from object using dot notation path
   */
  static getNestedValue(obj: any, path: string): any {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Check if a field path exists and has a non-empty value
   */
  static validateField(obj: any, fieldPath: string): {
    valid: boolean;
    error?: string;
  } {
    const value = this.getNestedValue(obj, fieldPath);

    if (value === undefined || value === null) {
      return {
        valid: false,
        error: `Field '${fieldPath}' is missing`,
      };
    }

    // Check for empty strings
    if (typeof value === "string" && value.trim() === "") {
      return {
        valid: false,
        error: `Field '${fieldPath}' is empty`,
      };
    }

    // Check for empty arrays
    if (Array.isArray(value) && value.length === 0) {
      return {
        valid: false,
        error: `Field '${fieldPath}' is an empty array`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate multiple required fields
   */
  static validateRequiredFields(
    obj: any,
    requiredFields: string[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const fieldPath of requiredFields) {
      const result = this.validateField(obj, fieldPath);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}