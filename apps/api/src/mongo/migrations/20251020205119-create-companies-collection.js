module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   */
  async up(db, client) {
    const collections = await db.listCollections({ name: "companies" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("companies");
      console.log("✅ Created companies collection");
    } else {
      console.log("ℹ️ Companies collection already exists, skipping creation");
    }

    const collection = db.collection("companies");
    const existingIndexes = await collection.indexes();

    const ensureIndex = async (key, options) => {
      const indexName = options.name || Object.keys(key).map(k => `${k}_${key[k]}`).join("_");
      const exists = existingIndexes.some(i => i.name === indexName);
      if (!exists) {
        await collection.createIndex(key, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(`ℹ️ Index ${indexName} already exists, skipping`);
      }
    };

    await ensureIndex({ name: 1 }, { unique: true });
    await ensureIndex({ taxId: 1 }, { unique: true, sparse: true });
    await ensureIndex({ isActive: 1 }, {});
    await ensureIndex({ createdAt: -1 }, {});

    const count = await collection.countDocuments();
    if (count === 0) {
      await collection.insertMany([
        {
          name: "Meridian Logistics",
          description: "Main logistics company",
          taxId: "TAX123456789",
          email: "info@shipsync.com",
          phone: "+1-555-0123",
          address: {
            street: "123 Logistics Ave",
            city: "New York",
            state: "NY",
            zipCode: "10001",
            country: "USA",
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Global Shipping Ltd",
          description: "International shipping company",
          taxId: "TAX987654321",
          email: "contact@globalshipping.com",
          phone: "+1-555-0456",
          address: {
            street: "456 Harbor Blvd",
            city: "Los Angeles",
            state: "CA",
            zipCode: "90210",
            country: "USA",
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "FastTrack Logistics",
          description: "Express delivery services",
          taxId: "TAX456789123",
          email: "support@fasttrack.com",
          phone: "+1-555-0789",
          address: {
            street: "789 Speedway",
            city: "Chicago",
            state: "IL",
            zipCode: "60601",
            country: "USA",
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      console.log("✅ Companies collection populated with sample data");
    } else {
      console.log("ℹ️ Companies already populated, skipping insert");
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   */
  async down(db, client) {
    await db.collection("companies").drop();
    console.log("❌ Companies collection dropped");
  },
};
