import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateShipmentDto } from "../src/shipments/dto/create-shipment.dto";
import { ShipmentMode } from "../src/schemas/shipment.schema";

function dtoFromPlain(plain: object): CreateShipmentDto {
  return plainToInstance(CreateShipmentDto, plain, {
    enableImplicitConversion: true,
  });
}

describe("CreateShipmentDto (cargo / containers vs mode)", () => {
  const base = {
    companyId: "507f1f77bcf86cd799439011",
    officeId: "507f1f77bcf86cd799439012",
    incoterm: "FOB",
    parties: {
      shipper: { name: "Shipper" },
      consignee: { name: "Consignee" },
    },
    operationalUserId: "507f1f77bcf86cd799439013",
  };

  it("AIR: accepts empty containers array", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.AIR,
      cargo: { containers: [] },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors).toHaveLength(0);
  });

  it('AIR: accepts placeholder row with empty containerNumber', async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.AIR,
      cargo: {
        containers: [{ containerNumber: "", sealNumber: "" }],
      },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors).toHaveLength(0);
  });

  it("OCEAN: rejects empty containers array", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.OCEAN,
      cargo: { containers: [] },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors.length).toBeGreaterThan(0);
    expect(cargoErrors[0].constraints).toMatchObject({
      cargoContainersForMode: expect.any(String),
    });
  });

  it("OCEAN: rejects container row with blank containerNumber", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.OCEAN,
      cargo: {
        containers: [{ containerNumber: "   " }],
      },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors.length).toBeGreaterThan(0);
  });

  it("OCEAN: accepts at least one container with number", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.OCEAN,
      cargo: { containers: [{ containerNumber: "MSKU1234567" }] },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors).toHaveLength(0);
  });

  it("MULTIMODAL: requires containers like OCEAN", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.MULTIMODAL,
      cargo: { containers: [] },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors.length).toBeGreaterThan(0);
  });

  it("LAND: empty containers allowed", async () => {
    const dto = dtoFromPlain({
      ...base,
      mode: ShipmentMode.LAND,
      cargo: { containers: [] },
    });
    const errors = await validate(dto);
    const cargoErrors = errors.filter((e) => e.property === "cargo");
    expect(cargoErrors).toHaveLength(0);
  });
});
