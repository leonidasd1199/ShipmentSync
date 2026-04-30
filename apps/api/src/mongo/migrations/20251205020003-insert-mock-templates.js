module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("templates");

    // Get a company ID (use the first company)
    const company = await db.collection("companies").findOne({});
    if (!company) {
      console.log("⚠️  No companies found. Skipping template creation.");
      return;
    }

    // Get a user ID from ops_admin role for createdBy/updatedBy
    const user = await db.collection("users").findOne({ roleCode: "ops_admin" });
    if (!user) {
      console.log("⚠️  No ops_admin users found. Skipping template creation.");
      return;
    }

    const mockTemplates = [
      {
        name: "LCL - EXW",
        category: "EXW",
        serviceType: "LCL",
        shippingModes: ["maritime"],
        headerFields: [],
        items: [
          {
            id: "1",
            label: "Pick up",
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: true,
            defaultPrice: 100,
            defaultQuantity: 1,
            defaultDiscount: 0,
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: true,
            taxRate: 15,
          },
          {
            id: "2",
            label: "Ocean Freight CBM",
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 50,
            defaultQuantity: 1,
            order: 2,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "3",
            label: "DTHC",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 75,
            order: 3,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "4",
            label: "Origin Charges",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 25,
            order: 4,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
        ],
        equipmentItems: [],
        pricingConfig: {
          currency: "USD",
          templatePrice: null,
          templateDiscount: 10,
          applyTemplateDiscount: true,
          templateTaxRate: null,
          applyTemplateTaxes: false,
        },
        notes: "1000KGS: 1CBM\nSubject to space availability",
        showAgentToClient: true,
        showCarrierToClient: true,
        showCommodityToClient: true,
        showNotesToClient: true,
        companyId: company._id,
        createdBy: user._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "FCL - CIF",
        category: "CIF",
        serviceType: "FCL",
        shippingModes: ["maritime"],
        headerFields: [
          {
            id: "3",
            label: "ETD",
            inputType: "date",
            required: false,
            order: 1,
          },
          {
            id: "4",
            label: "ETA",
            inputType: "date",
            required: false,
            order: 2,
          },
        ],
        items: [
          {
            id: "1",
            label: "Ocean Freight",
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: true,
            defaultPrice: 2500,
            defaultQuantity: 1,
            defaultDiscount: 0,
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "2",
            label: "Insurance",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 150,
            order: 2,
            applyTemplateDiscount: false,
            applyTaxes: false,
          },
          {
            id: "3",
            label: "Freight",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 200,
            order: 3,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
        ],
        equipmentItems: [
          {
            id: "1",
            label: "20DV",
            fields: [
              { key: "size", label: "Size", inputType: "text", defaultValue: "20DV", order: 1 },
              { key: "weightKg", label: "Weight (kg)", inputType: "number", defaultValue: 0, order: 2 },
            ],
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 2500,
            defaultQuantity: 1,
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "2",
            label: "40HC",
            fields: [
              { key: "size", label: "Size", inputType: "text", defaultValue: "40HC", order: 1 },
              { key: "weightKg", label: "Weight (kg)", inputType: "number", defaultValue: 0, order: 2 },
            ],
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 4500,
            defaultQuantity: 1,
            order: 2,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
        ],
        pricingConfig: {
          currency: "USD",
          templatePrice: null,
          templateDiscount: 5,
          applyTemplateDiscount: true,
          templateTaxRate: null,
          applyTemplateTaxes: false,
        },
        notes: "CIF terms: Cost, Insurance, and Freight\nTransit time: 25-30 days",
        showAgentToClient: true,
        showCarrierToClient: true,
        showCommodityToClient: true,
        showNotesToClient: true,
        companyId: company._id,
        createdBy: user._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "AIR - DAP",
        category: "DAP",
        serviceType: "AIR",
        shippingModes: ["air"],
        headerFields: [
          {
            id: "3",
            label: "Flight Date",
            inputType: "date",
            required: true,
            order: 1,
          },
        ],
        items: [
          {
            id: "1",
            label: "Air Freight",
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: true,
            defaultPrice: 8.5,
            defaultQuantity: 1,
            defaultDiscount: 0,
            notes: "Per kg",
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "2",
            label: "Fuel Surcharge",
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 2.5,
            defaultQuantity: 1,
            notes: "Per kg",
            order: 2,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "3",
            label: "Security Fee",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 50,
            order: 3,
            applyTemplateDiscount: false,
            applyTaxes: false,
          },
          {
            id: "4",
            label: "Customs Clearance",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 150,
            order: 4,
            applyTemplateDiscount: false,
            applyTaxes: false,
          },
        ],
        equipmentItems: [],
        pricingConfig: {
          currency: "USD",
          templatePrice: null,
          templateDiscount: 0,
          applyTemplateDiscount: false,
          templateTaxRate: null,
          applyTemplateTaxes: false,
        },
        notes: "DAP terms: Delivered At Place\nFastest transit time: 2-5 days",
        showAgentToClient: true,
        showCarrierToClient: true,
        showCommodityToClient: true,
        showNotesToClient: true,
        companyId: company._id,
        createdBy: user._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "FTL - FOB",
        category: "FOB",
        serviceType: "FTL",
        shippingModes: ["road"],
        headerFields: [
          {
            id: "3",
            label: "Pickup Date",
            inputType: "date",
            required: true,
            order: 1,
          },
        ],
        items: [
          {
            id: "1",
            label: "Full Truck Load",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: true,
            defaultPrice: 1200,
            defaultDiscount: 0,
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "2",
            label: "Fuel Surcharge",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 150,
            order: 2,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "3",
            label: "Toll Fees",
            hasPrice: true,
            hasQuantity: false,
            hasDiscount: false,
            defaultPrice: 75,
            order: 3,
            applyTemplateDiscount: false,
            applyTaxes: false,
          },
        ],
        equipmentItems: [
          {
            id: "1",
            label: "8' Truck",
            fields: [
              { key: "capacity", label: "Capacity (kg)", inputType: "number", defaultValue: 5000, order: 1 },
            ],
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 1200,
            defaultQuantity: 1,
            order: 1,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
          {
            id: "2",
            label: "16' Truck",
            fields: [
              { key: "capacity", label: "Capacity (kg)", inputType: "number", defaultValue: 10000, order: 1 },
            ],
            hasPrice: true,
            hasQuantity: true,
            hasDiscount: false,
            defaultPrice: 2000,
            defaultQuantity: 1,
            order: 2,
            applyTemplateDiscount: true,
            applyTaxes: false,
          },
        ],
        pricingConfig: {
          currency: "USD",
          templatePrice: null,
          templateDiscount: 0,
          applyTemplateDiscount: false,
          templateTaxRate: null,
          applyTemplateTaxes: false,
        },
        notes: "FOB terms: Free On Board\nDoor-to-door service available",
        showAgentToClient: true,
        showCarrierToClient: true,
        showCommodityToClient: true,
        showNotesToClient: true,
        companyId: company._id,
        createdBy: user._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert templates (skip duplicates based on name + companyId)
    let inserted = 0;
    let skipped = 0;

    for (const template of mockTemplates) {
      const existing = await collection.findOne({
        name: template.name,
        companyId: company._id,
      });
      if (!existing) {
        await collection.insertOne(template);
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(`✅ Inserted ${inserted} mock templates`);
    if (skipped > 0) {
      console.log(`ℹ️ Skipped ${skipped} templates (already exist)`);
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("templates");

    const templateNames = ["LCL - EXW", "FCL - CIF", "AIR - DAP", "FTL - FOB"];

    const result = await collection.deleteMany({
      name: { $in: templateNames },
    });

    console.log(`🗑️ Deleted ${result.deletedCount} mock templates`);
  },
};