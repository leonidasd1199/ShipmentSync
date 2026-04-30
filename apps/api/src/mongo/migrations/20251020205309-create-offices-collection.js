module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create offices collection only if it doesn't exist
    const collections = await db.listCollections({ name: "offices" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("offices");
      console.log("✅ Created offices collection");
    } else {
      console.log("ℹ️  Offices collection already exists, skipping creation");
    }
    
    // Create indexes for offices collection
    await db.collection("offices").createIndex({ name: 1, company: 1 }, { unique: true });
    await db.collection("offices").createIndex({ company: 1 });
    await db.collection("offices").createIndex({ isActive: 1 });
    await db.collection("offices").createIndex({ createdAt: -1 });
    
    // Get companies to create office relationships
    const companies = await db.collection("companies").find({}).toArray();
    const companyMap = new Map(companies.map(company => [company.name, company._id]));
    
    // Insert sample offices
    await db.collection("offices").insertMany([
      // Meridian Logistics offices
      {
        name: "Headquarters",
        company: companyMap.get("Meridian Logistics"),
        companyName: "Meridian Logistics",
        description: "Main headquarters office",
        type: "headquarters",
        email: "hq@meridian-logistics.com",
        phone: "+1-555-0123",
        address: {
          street: "123 Logistics Ave",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Warehouse East",
        company: companyMap.get("Meridian Logistics"),
        companyName: "Meridian Logistics",
        description: "Eastern region warehouse",
        type: "warehouse",
        email: "warehouse@meridian-logistics.com",
        phone: "+1-555-0124",
        address: {
          street: "456 Industrial Blvd",
          city: "Boston",
          state: "MA",
          zipCode: "02101",
          country: "USA"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Global Shipping Ltd offices
      {
        name: "Port Office",
        company: companyMap.get("Global Shipping Ltd"),
        companyName: "Global Shipping Ltd",
        description: "Main port operations office",
        type: "operations",
        email: "port@globalshipping.com",
        phone: "+1-555-0456",
        address: {
          street: "456 Harbor Blvd",
          city: "Los Angeles",
          state: "CA",
          zipCode: "90210",
          country: "USA"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Distribution Center",
        company: companyMap.get("Global Shipping Ltd"),
        companyName: "Global Shipping Ltd",
        description: "Regional distribution center",
        type: "distribution",
        email: "distribution@globalshipping.com",
        phone: "+1-555-0457",
        address: {
          street: "789 Cargo Way",
          city: "San Francisco",
          state: "CA",
          zipCode: "94101",
          country: "USA"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // FastTrack Logistics offices
      {
        name: "Express Hub",
        company: companyMap.get("FastTrack Logistics"),
        companyName: "FastTrack Logistics",
        description: "Express delivery hub",
        type: "hub",
        email: "hub@fasttrack.com",
        phone: "+1-555-0789",
        address: {
          street: "789 Speedway",
          city: "Chicago",
          state: "IL",
          zipCode: "60601",
          country: "USA"
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    
    console.log("✅ Offices collection created and populated with sample data");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection("offices").drop();
    console.log("❌ Offices collection dropped");
  }
};
