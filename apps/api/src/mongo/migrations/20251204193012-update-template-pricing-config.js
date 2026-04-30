module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   */
  async up(db, client) {
    const collection = db.collection("templates");
    const cursor = collection.find({}, { projection: { priceConfiguration: 1 } });

    let updatedCount = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const template of cursor) {
      const priceConfig = template.priceConfiguration || {};

      const currency =
        typeof priceConfig.currency === "string" && priceConfig.currency.trim().length > 0
          ? priceConfig.currency
          : "USD";

      const templatePrice =
        typeof priceConfig.templatePrice === "number" && !Number.isNaN(priceConfig.templatePrice)
          ? priceConfig.templatePrice
          : null;

      const discountValue =
        priceConfig.discount && typeof priceConfig.discount.value === "number"
          ? priceConfig.discount.value
          : null;
      const applyTemplateDiscount = discountValue !== null;

      const taxesArray = Array.isArray(priceConfig.taxes) ? priceConfig.taxes : [];
      const templateTaxRate = taxesArray.reduce((sum, tax) => {
        if (tax && typeof tax.percentage === "number" && !Number.isNaN(tax.percentage)) {
          return sum + tax.percentage;
        }
        return sum;
      }, 0);
      const hasTaxes = templateTaxRate > 0;

      await collection.updateOne(
        { _id: template._id },
        {
          $set: {
            priceConfiguration: {
              currency,
              templatePrice,
              templateDiscount: discountValue,
              applyTemplateDiscount,
              templateTaxRate: hasTaxes ? templateTaxRate : null,
              applyTemplateTaxes: hasTaxes,
            },
          },
        },
      );
      updatedCount += 1;
    }

    console.log(`✅ Updated pricing configuration for ${updatedCount} template(s)`);
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   */
  async down(db, client) {
    const collection = db.collection("templates");
    const cursor = collection.find({}, { projection: { priceConfiguration: 1 } });

    let revertedCount = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const template of cursor) {
      const priceConfig = template.priceConfiguration || {};

      const discount =
        priceConfig.applyTemplateDiscount &&
        typeof priceConfig.templateDiscount === "number" &&
        !Number.isNaN(priceConfig.templateDiscount)
          ? {
              type: "percentage",
              value: priceConfig.templateDiscount,
            }
          : undefined;

      const taxes =
        priceConfig.applyTemplateTaxes &&
        typeof priceConfig.templateTaxRate === "number" &&
        !Number.isNaN(priceConfig.templateTaxRate)
          ? [
              {
                name: "TAX",
                percentage: priceConfig.templateTaxRate,
              },
            ]
          : undefined;

      const legacyConfig = {
        currency:
          typeof priceConfig.currency === "string" && priceConfig.currency.trim().length > 0
            ? priceConfig.currency
            : "USD",
      };

      if (discount) {
        legacyConfig.discount = discount;
      }

      if (taxes) {
        legacyConfig.taxes = taxes;
      }

      await collection.updateOne(
        { _id: template._id },
        { $set: { priceConfiguration: legacyConfig } },
      );
      revertedCount += 1;
    }

    console.log(`♻️ Reverted pricing configuration for ${revertedCount} template(s)`);
  },
};

