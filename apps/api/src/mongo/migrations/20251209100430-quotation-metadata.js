module.exports = {
  async up(db, client) {
    // Service Types with labels
    await db.collection("quotation_metadata").insertOne({
      _id: "serviceTypes",
      values: [
        { value: "FCL", label: "FCL Maritime" },
        { value: "LCL", label: "LCL" },
        { value: "AIR", label: "Air Freight" },
        { value: "FTL", label: "FTL" },
        { value: "INSURANCE", label: "Cargo Insurance" },
        { value: "CUSTOMS", label: "Customs" },
        { value: "LOCAL_TRUCKING", label: "Local Trucking" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Incoterms by Service Type
    await db.collection("quotation_metadata").insertOne({
      _id: "incotermsByService",
      values: {
        FCL: ["EXW", "CIF", "FOB", "DAP", "CFR"],
        LCL: ["EXW", "CIF", "FOB", "DAP", "CFR"],
        AIR: ["EXW", "DAP", "CIP"],
        FTL: ["EXW", "DAP", "FOB"],
        INSURANCE: ["EXW", "CIF", "DAP", "DDP"],
        CUSTOMS: ["EXW", "DAP"],
        LOCAL_TRUCKING: ["EXW", "DAP"]
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Shipping Modes
    await db.collection("quotation_metadata").insertOne({
      _id: "shippingModes",
      values: ["maritime", "air", "road"],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  async down(db, client) {
    await db.collection("quotation_metadata").deleteOne({ _id: "serviceTypes" });
    await db.collection("quotation_metadata").deleteOne({ _id: "incotermsByService" });
    await db.collection("quotation_metadata").deleteOne({ _id: "shippingModes" });
  }
};