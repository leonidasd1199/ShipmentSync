module.exports = {
  /**
   * Backfill per-container packages from legacy top-level cargo fields:
   * cargo.packagesQuantity, cargo.packagesType, cargo.airDimensionsText
   */
  async up(db, client) {
    const shipments = db.collection("shipments");

    const docs = await shipments
      .find(
        {
          "cargo.containers.0": { $exists: true },
        },
        {
          projection: {
            _id: 1,
            cargo: 1,
          },
        },
      )
      .toArray();

    const ops = [];
    for (const doc of docs) {
      const cargo = doc.cargo || {};
      const containers = Array.isArray(cargo.containers) ? cargo.containers : [];
      if (containers.length === 0) {
        continue;
      }

      const hasAnyPackages = containers.some(
        (c) => Array.isArray(c.packages) && c.packages.length > 0,
      );
      if (hasAnyPackages) {
        continue;
      }

      const quantity =
        typeof cargo.packagesQuantity === "number" ? cargo.packagesQuantity : undefined;
      const type = typeof cargo.packagesType === "string" ? cargo.packagesType : undefined;
      const dimsText =
        typeof cargo.airDimensionsText === "string" ? cargo.airDimensionsText.trim() : "";

      let dimensions = undefined;
      if (dimsText) {
        const m = dimsText.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)(?:\s*(cm|in|m))?/);
        if (m) {
          dimensions = {
            length: Number(m[1]),
            width: Number(m[2]),
            height: Number(m[3]),
            ...(m[4] ? { unit: m[4].toLowerCase() } : { unit: "cm" }),
          };
        }
      }

      if (!quantity && !type && !dimensions) {
        continue;
      }

      const perContainerQty =
        typeof quantity === "number" && containers.length > 0
          ? Math.ceil(quantity / containers.length)
          : undefined;
      const packageTemplate = {
        ...(type ? { type } : {}),
        ...(typeof perContainerQty === "number" ? { quantity: perContainerQty } : {}),
        dimensions: dimensions || { length: 0, width: 0, height: 0, unit: "cm" },
      };

      const newContainers = containers.map((c) => ({
        ...c,
        packages: [packageTemplate],
      }));

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { "cargo.containers": newContainers } },
        },
      });
    }

    if (ops.length > 0) {
      await shipments.bulkWrite(ops);
    }
    console.log(`✅ Backfilled container packages for ${ops.length} shipment(s)`);
  },

  async down(db, client) {
    const shipments = db.collection("shipments");
    const docs = await shipments
      .find(
        { "cargo.containers.0": { $exists: true } },
        { projection: { _id: 1, "cargo.containers": 1 } },
      )
      .toArray();

    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            "cargo.containers": (doc.cargo.containers || []).map((c) => {
              const { packages, ...rest } = c;
              return rest;
            }),
          },
        },
      },
    }));

    if (ops.length > 0) {
      await shipments.bulkWrite(ops);
    }
    console.log(`↩️ Removed container packages for ${ops.length} shipment(s)`);
  },
};
