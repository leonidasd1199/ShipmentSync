import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CounterDocument = HydratedDocument<Counter>;

@Schema({ collection: "counters" })
export class Counter {
  @Prop({ type: String, required: true })
  _id: string; // e.g. "quotationNumber_2026"

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
