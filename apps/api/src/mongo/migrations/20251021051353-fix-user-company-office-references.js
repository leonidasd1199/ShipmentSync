const { MongoClient } = require("mongodb");

module.exports = {
  async up(db, client) {
    console.log("🔧 Fixing user company and office references...");

    // Get all companies and create a name-to-id mapping
    const companies = await db.collection("companies").find({}).toArray();
    const companyMap = new Map();
    companies.forEach((company) => {
      companyMap.set(company.name, company._id);
    });

    // Get all offices and create a name-to-id mapping
    const offices = await db.collection("offices").find({}).toArray();
    const officeMap = new Map();
    offices.forEach((office) => {
      officeMap.set(`${office.companyName}-${office.name}`, office._id);
    });

    // Update users to fix company references
    const users = await db.collection("users").find({}).toArray();
    
    for (const user of users) {
      const updates = {};
      
      // Fix company reference if companyName exists but company is null
      if (user.companyName && !user.company) {
        const companyId = companyMap.get(user.companyName);
        if (companyId) {
          updates.company = companyId;
          console.log(`✅ Fixed company reference for ${user.email}: ${user.companyName}`);
        } else {
          console.log(`❌ Company not found for ${user.email}: ${user.companyName}`);
        }
      }

      // Fix office references if officeNames exist but offices are empty/null
      if (user.officeNames && user.officeNames.length > 0 && (!user.offices || user.offices.length === 0)) {
        const officeIds = [];
        for (const officeName of user.officeNames) {
          const officeKey = `${user.companyName}-${officeName}`;
          const officeId = officeMap.get(officeKey);
          if (officeId) {
            officeIds.push(officeId);
          } else {
            console.log(`❌ Office not found for ${user.email}: ${officeKey}`);
          }
        }
        if (officeIds.length > 0) {
          updates.offices = officeIds;
          console.log(`✅ Fixed office references for ${user.email}: ${user.officeNames.join(", ")}`);
        }
      }

      // Apply updates (separate $set and $unset operations)
      if (updates.company || updates.offices) {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $set: updates }
        );
      }
      
      // Remove denormalized fields
      await db.collection("users").updateOne(
        { _id: user._id },
        { $unset: { companyName: "", officeNames: "" } }
      );
    }

    console.log("✅ User company and office references fixed!");
  },

  async down(db, client) {
    console.log("🔄 Reverting user company and office references...");

    // This is a destructive migration, so we'll just log what would be reverted
    console.log("⚠️  This migration removes denormalized fields and cannot be fully reverted");
    console.log("⚠️  To revert, you would need to restore from backup");
  },
};