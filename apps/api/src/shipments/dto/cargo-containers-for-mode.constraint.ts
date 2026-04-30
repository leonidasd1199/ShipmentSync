import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { ShipmentMode } from "../../schemas/shipment.schema";

export function shipmentModeRequiresContainers(
  mode: ShipmentMode | undefined,
): boolean {
  return mode === ShipmentMode.OCEAN || mode === ShipmentMode.MULTIMODAL;
}

/**
 * OCEAN / MULTIMODAL: at least one container, each with a non-empty containerNumber.
 * AIR / LAND / etc.: containers are optional (empty array or placeholder rows allowed).
 */
@ValidatorConstraint({ name: "cargoContainersForMode", async: false })
export class CargoContainersForModeConstraint
  implements ValidatorConstraintInterface
{
  validate(
    cargo: { containers?: Array<{ containerNumber?: string }> } | undefined,
    args: ValidationArguments,
  ): boolean {
    const o = args.object as { mode?: ShipmentMode };
    const containers = cargo?.containers;
    if (containers === undefined) {
      return true;
    }
    const mode = o.mode;
    if (!shipmentModeRequiresContainers(mode)) {
      return true;
    }
    if (!Array.isArray(containers) || containers.length === 0) {
      return false;
    }
    return containers.every(
      (c) =>
        typeof c.containerNumber === "string" &&
        c.containerNumber.trim().length > 0,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const o = args.object as {
      mode?: ShipmentMode;
      cargo?: { containers?: unknown[] };
    };
    if (
      shipmentModeRequiresContainers(o.mode) &&
      (!o.cargo?.containers || o.cargo.containers.length === 0)
    ) {
      return "At least one container with a container number is required for OCEAN and MULTIMODAL shipments.";
    }
    return "Each container must have a non-empty container number for OCEAN and MULTIMODAL shipments.";
  }
}
