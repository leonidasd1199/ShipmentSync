const fs = require("fs");
const path = require("path");
const readline = require("readline");

/**
 * Minimal CSV line parser that handles quoted fields and commas.
 */
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const nextIsQuote = line[i + 1] === '"';
      if (inQuotes && nextIsQuote) {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function deriveType(functions) {
  if (!functions) return "other";
  if (functions.includes("1")) return "sea"; // Port (sea)
  if (functions.includes("4")) return "air"; // Airport
  if (functions.includes("2")) return "rail"; // Rail terminal
  if (functions.includes("3") || functions.includes("6")) return "inland"; // Road / ICD
  return "other";
}

function decodeCoord(part) {
  const match = part.match(/^(\d{2,3})(\d{2})([NSEW])$/);
  if (!match) return null;
  const deg = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  let value = deg + min / 60;
  const hemi = match[3];
  if (hemi === "S" || hemi === "W") {
    value *= -1;
  }
  return value;
}

function parseCoordinates(coordinates) {
  if (!coordinates) return { lat: null, lon: null };
  const parts = coordinates.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { lat: null, lon: null };
  const lat = decodeCoord(parts[0]);
  const lon = decodeCoord(parts[1]);
  return { lat, lon };
}

async function processFile(filePath, accumulator, countryNames) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 11) continue;

    const countryCode = (cols[1] || "").trim();
    const locationCode = (cols[2] || "").trim();
    const rawName = (cols[4] || cols[3] || "").trim().replace(/^\.+/, "");
    const functions = (cols[6] || "").trim();
    const status = (cols[7] || "").trim();
    const coordinates = (cols[10] || "").trim();

    // Store country name rows (rows with empty location code)
    if (countryCode && !locationCode) {
      if (rawName) {
        countryNames[countryCode] = rawName;
      }
      continue;
    }

    if (!countryCode || !locationCode) continue;

    // Skip deleted/obsolete entries (status starting with X)
    if (status && status.toUpperCase().startsWith("X")) continue;

    const unlocode = `${countryCode}${locationCode}`.toUpperCase();
    const type = deriveType(functions);
    const { lat, lon } = parseCoordinates(coordinates);

    const doc = {
      unlocode,
      name: rawName || unlocode,
      countryCode: countryCode.toUpperCase(),
      countryName: countryNames[countryCode],
      city: rawName || undefined,
      type,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = accumulator.get(unlocode);
    if (!existing) {
      accumulator.set(unlocode, doc);
    } else {
      // Merge missing fields
      if (existing.latitude === undefined && doc.latitude !== undefined) {
        existing.latitude = doc.latitude;
      }
      if (existing.longitude === undefined && doc.longitude !== undefined) {
        existing.longitude = doc.longitude;
      }
      if (!existing.countryName && doc.countryName) {
        existing.countryName = doc.countryName;
      }
    }
  }
}

async function loadAllPorts(seedDir) {
  const files = [
    "2024-2 UNLOCODE CodeListPart1.csv",
    "2024-2 UNLOCODE CodeListPart2.csv",
    "2024-2 UNLOCODE CodeListPart3.csv",
  ].map((name) => path.join(seedDir, name));

  const accumulator = new Map();
  const countryNames = {};

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File missing, skipping: ${filePath}`);
      continue;
    }
    await processFile(filePath, accumulator, countryNames);
  }

  return accumulator;
}

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const seedDir = path.join(__dirname, "..", "seedDataPorts");
    if (!fs.existsSync(seedDir)) {
      console.log("⚠️  seedDataPorts directory not found. Skipping import.");
      return;
    }

    const portsMap = await loadAllPorts(seedDir);
    const ports = Array.from(portsMap.values());
    if (!ports.length) {
      console.log("ℹ️  No ports parsed. Nothing to insert.");
      return;
    }

    const collection = db.collection("ports");
    const batchSize = 1000;
    let processed = 0;

    for (let i = 0; i < ports.length; i += batchSize) {
      const chunk = ports.slice(i, i + batchSize);
      const ops = chunk.map((doc) => ({
        updateOne: {
          filter: { unlocode: doc.unlocode },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      }));

      const result = await collection.bulkWrite(ops, { ordered: false });
      processed += chunk.length;
      const inserted = result?.upsertedCount || 0;
      console.log(
        `🛈 Processed ${processed}/${ports.length} ports (upserts: ${inserted})`
      );
    }

    console.log(`✅ Finished importing UN/LOCODE 2024-2 ports. Total parsed: ${ports.length}`);
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const seedDir = path.join(__dirname, "..", "seedDataPorts");
    if (!fs.existsSync(seedDir)) {
      console.log("⚠️  seedDataPorts directory not found. Skipping rollback.");
      return;
    }

    const portsMap = await loadAllPorts(seedDir);
    const unlocodes = Array.from(portsMap.keys());
    if (!unlocodes.length) {
      console.log("ℹ️  No ports parsed. Nothing to delete.");
      return;
    }

    const collection = db.collection("ports");
    const result = await collection.deleteMany({ unlocode: { $in: unlocodes } });
    console.log(`🗑️  Deleted ${result.deletedCount} ports from UN/LOCODE 2024-2 seed`);
  },
};


