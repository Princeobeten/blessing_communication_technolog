import { Schema, model, models, type Model } from "mongoose";

/** Atomic sequence generator used for human-readable ticket and invoice numbers. */
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export type CounterDoc = { _id: string; seq: number };

export const Counter = (models.Counter as Model<CounterDoc>) || model<CounterDoc>("Counter", CounterSchema);
export default Counter;
