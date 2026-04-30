import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Injectable()
export class MetadataService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private getCollection() {
    return this.connection.collection("quotation_metadata");
  }

  async getServiceTypes() {
    const doc = await this.getCollection().findOne({ _id: "serviceTypes" } as any);
    return doc?.values ?? [];
  }

  async getShippingModes() {
    const doc = await this.getCollection().findOne({ _id: "shippingModes" } as any);
    return doc?.values ?? [];
  }

  async getIncotermsByService(serviceType: string) {
    const doc = await this.getCollection().findOne({ _id: "incotermsByService" } as any);

    if (!doc || !doc.values) {
      throw new Error("incotermsByService metadata not found");
    }

    const values = doc.values[serviceType];

    if (!values) {
      throw new Error(`No incoterms found for serviceType ${serviceType}`);
    }

    return values;
  }
}
