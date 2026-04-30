const bcrypt = require('bcryptjs');

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    
    // Create users collection only if it doesn't exist
    const collections = await db.listCollections({ name: "users" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("users");
      console.log("✅ Created users collection");
    } else {
      console.log("ℹ️  Users collection already exists, skipping creation");
    }
    
    // Create indexes for users collection
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ roleCode: 1 });
    await db.collection("users").createIndex({ isActive: 1 });
    await db.collection("users").createIndex({ company: 1 });
    await db.collection("users").createIndex({ office: 1 });
    await db.collection("users").createIndex({ createdAt: -1 });
    
    // Insert sample users with role references
    const roles = await db.collection("roles").find({}).toArray();
    const roleMap = new Map(roles.map(role => [role.code, role._id]));
    
    // Get companies and offices for relationships
    const companies = await db.collection("companies").find({}).toArray();
    const companyMap = new Map(companies.map(company => [company.name, company._id]));
    
    const offices = await db.collection("offices").find({}).toArray();
    const officeMap = new Map(offices.map(office => [`${office.companyName}-${office.name}`, office._id]));
    
    await db.collection("users").insertMany([
      {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@shipsync.com",
        password: await bcrypt.hash('password123', 10),
        roleCode: "ops_admin",
        role: roleMap.get("ops_admin"),
        company: companyMap.get("Meridian Logistics"),
        companyName: "Meridian Logistics",
        office: officeMap.get("Meridian Logistics-Headquarters"),
        officeName: "Headquarters",
        isActive: true,
        phone: "+1234567890",
        address: "123 Main St, City, State",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@client.com",
        password: await bcrypt.hash('password123', 10),
        roleCode: "client",
        role: roleMap.get("client"),
        company: companyMap.get("Global Shipping Ltd"),
        companyName: "Global Shipping Ltd",
        office: officeMap.get("Global Shipping Ltd-Port Office"),
        officeName: "Port Office",
        isActive: true,
        phone: "+1234567891",
        address: "456 Oak Ave, City, State",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: "Admin",
        lastName: "User",
        email: "admin@fasttrack.com",
        password: await bcrypt.hash('password123', 10),
        roleCode: "admin",
        role: roleMap.get("admin"),
        company: companyMap.get("FastTrack Logistics")  ,
        companyName: "FastTrack Logistics",
        office: officeMap.get("FastTrack Logistics-Express Hub"),
        officeName: "Express Hub",
        isActive: true,
        phone: "+1234567892",
        address: "789 Pine St, City, State",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: "Mike",
        lastName: "Johnson",
        email: "mike.johnson@fasttrack.com",
        password: await bcrypt.hash('password123', 10),
        roleCode: "client",
        role: roleMap.get("client"),
        company: companyMap.get("FastTrack Logistics"),
        companyName: "FastTrack Logistics",
        office: officeMap.get("FastTrack Logistics-Express Hub"),
        officeName: "Express Hub",
        isActive: true,
        phone: "+1234567893",
        address: "321 Express Way, City, State",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    
    console.log("✅ Users collection created and populated with sample data");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection("users").drop();
    console.log("❌ Users collection dropped");
  }
};
