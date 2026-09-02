import Counter from "@/models/Counter";

/**
 * Returns the next value in a named sequence atomically, so two intakes saved at
 * the same moment can never receive the same ticket number.
 */
export async function nextSequence(name: string) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc!.seq;
}

export async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`ticket-${year}`);
  return `TRK-${year}-${String(seq).padStart(4, "0")}`;
}

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`invoice-${year}`);
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}
