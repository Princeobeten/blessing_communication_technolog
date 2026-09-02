/**
 * Seeds a demonstration workshop: staff accounts, customers, spare parts and a
 * spread of repair jobs at every stage of the workflow, plus invoices and the
 * notifications they generated.
 *
 *   npm run seed
 *
 * Existing data is cleared first, so never point this at production data.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../src/lib/db";
import User from "../src/models/User";
import Customer from "../src/models/Customer";
import RepairJob from "../src/models/RepairJob";
import Part from "../src/models/Part";
import StockMovement from "../src/models/StockMovement";
import Invoice from "../src/models/Invoice";
import Notification from "../src/models/Notification";
import Counter from "../src/models/Counter";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAfter = (date: Date, h: number) => new Date(date.getTime() + h * 60 * 60 * 1000);
const pad = (n: number) => String(n).padStart(4, "0");

async function seed() {
  await connectDB();
  console.log("Connected. Clearing existing collections...");

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    RepairJob.deleteMany({}),
    Part.deleteMany({}),
    StockMovement.deleteMany({}),
    Invoice.deleteMany({}),
    Notification.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  /* ---------- Staff ---------- */

  const passwordHash = await bcrypt.hash("password123", 10);

  const [admin, tunde, amaka, ibrahim] = await User.create([
    { name: "Blessing Adeyemi", email: "admin@crms.test", passwordHash, role: "admin", phone: "08030001111", specialization: "Workshop manager" },
    { name: "Tunde Bakare", email: "tunde@crms.test", passwordHash, role: "technician", phone: "08030002222", specialization: "Laptop hardware" },
    { name: "Amaka Nwosu", email: "amaka@crms.test", passwordHash, role: "technician", phone: "08030003333", specialization: "Software & data recovery" },
    { name: "Ibrahim Sani", email: "ibrahim@crms.test", passwordHash, role: "technician", phone: "08030004444", specialization: "Printers & peripherals" },
  ]);
  console.log("Created 4 staff accounts.");

  /* ---------- Customers ---------- */

  const customers = await Customer.create([
    { name: "Chinedu Okafor", phone: "08051110001", email: "chinedu@example.com", address: "14 Aba Road, Port Harcourt", createdBy: admin._id },
    { name: "Fatima Bello", phone: "08051110002", email: "fatima@example.com", address: "3 Ahmadu Bello Way, Kaduna", createdBy: admin._id },
    { name: "Grace Eze", phone: "08051110003", email: "grace@example.com", address: "22 Awolowo Road, Ikoyi", company: "Grace Ventures Ltd", createdBy: admin._id },
    { name: "Musa Danjuma", phone: "08051110004", email: "musa@example.com", address: "9 Ibrahim Taiwo Road, Ilorin", createdBy: admin._id },
    { name: "Ngozi Uche", phone: "08051110005", email: "ngozi@example.com", address: "7 Zik Avenue, Enugu", createdBy: admin._id },
    { name: "Samuel Adeoye", phone: "08051110006", email: "samuel@example.com", address: "18 Ring Road, Ibadan", company: "Bright Schools", createdBy: admin._id },
    { name: "Halima Yusuf", phone: "08051110007", email: "halima@example.com", address: "5 Yakubu Gowon Way, Jos", createdBy: admin._id },
    { name: "Emeka Obi", phone: "08051110008", email: "emeka@example.com", address: "31 New Market Road, Onitsha", createdBy: admin._id },
  ]);
  console.log(`Created ${customers.length} customers.`);

  /* ---------- Spare parts ---------- */

  const partSeed = [
    { sku: "SSD-480-KING", name: "480GB SATA SSD", category: "Storage", quantity: 12, reorderLevel: 4, unitCost: 32000, sellingPrice: 45000, supplier: "Kingston Distributor", location: "Shelf A1" },
    { sku: "RAM-8GB-DDR4", name: "8GB DDR4 Laptop RAM", category: "Memory", quantity: 9, reorderLevel: 4, unitCost: 26000, sellingPrice: 38000, supplier: "Computer Village", location: "Shelf A2" },
    { sku: "BAT-HP-840", name: "HP EliteBook 840 Battery", category: "Power", quantity: 3, reorderLevel: 4, unitCost: 28000, sellingPrice: 42000, supplier: "HP Reseller", location: "Shelf B1" },
    { sku: "SCR-156-LED", name: '15.6" LED Screen Panel', category: "Display", quantity: 5, reorderLevel: 3, unitCost: 45000, sellingPrice: 68000, supplier: "Panel Hub", location: "Shelf C1" },
    { sku: "KBD-DELL-3520", name: "Dell Latitude 3520 Keyboard", category: "Input", quantity: 2, reorderLevel: 3, unitCost: 14000, sellingPrice: 22000, supplier: "Dell Parts NG", location: "Shelf B2" },
    { sku: "CHG-65W-TYPEC", name: "65W USB-C Charger", category: "Power", quantity: 15, reorderLevel: 5, unitCost: 12000, sellingPrice: 19500, supplier: "Computer Village", location: "Shelf A3" },
    { sku: "FAN-CPU-LAP", name: "Laptop CPU Cooling Fan", category: "Cooling", quantity: 7, reorderLevel: 3, unitCost: 6500, sellingPrice: 12000, supplier: "Spares Direct", location: "Shelf C2" },
    { sku: "TNR-HP-85A", name: "HP 85A Toner Cartridge", category: "Printer", quantity: 0, reorderLevel: 2, unitCost: 22000, sellingPrice: 34000, supplier: "HP Reseller", location: "Shelf D1" },
    { sku: "PSU-450W-ATX", name: "450W ATX Power Supply", category: "Power", quantity: 6, reorderLevel: 2, unitCost: 18000, sellingPrice: 28000, supplier: "Spares Direct", location: "Shelf D2" },
    { sku: "THM-PASTE-MX4", name: "Thermal Paste (MX-4)", category: "Consumables", quantity: 20, reorderLevel: 6, unitCost: 3000, sellingPrice: 6000, supplier: "Spares Direct", location: "Drawer 1" },
  ];

  const parts = await Part.create(partSeed);
  await StockMovement.create(
    parts
      .filter((p) => p.quantity > 0)
      .map((p) => ({
        part: p._id, partName: p.name, type: "in", quantity: p.quantity, balanceAfter: p.quantity,
        reason: "Opening stock", by: admin._id, byName: admin.name,
      }))
  );
  console.log(`Created ${parts.length} spare parts.`);

  const partBySku = new Map(parts.map((p) => [p.sku, p]));

  /* ---------- Repair jobs ---------- */

  type Blueprint = {
    customer: number;
    technician: typeof tunde | null;
    device: { type: string; brand: string; model: string; serialNumber: string; accessories: string[]; condition: string };
    issue: string;
    status: string;
    receivedDaysAgo: number;
    diagnosis?: string;
    workDone?: string;
    labour?: number;
    parts?: { sku: string; qty: number }[];
    quote?: { labour: number; parts: number; approved?: boolean };
    priority?: string;
  };

  const blueprints: Blueprint[] = [
    {
      customer: 0, technician: tunde, receivedDaysAgo: 42, status: "delivered", priority: "normal",
      device: { type: "Laptop", brand: "HP", model: "EliteBook 840 G5", serialNumber: "5CD9123ABC", accessories: ["Charger"], condition: "Minor scratches on lid" },
      issue: "Laptop shuts down suddenly and battery does not charge past 40%.",
      diagnosis: "Battery cells degraded; charging circuit tested good.",
      workDone: "Replaced battery, updated BIOS, ran 3-hour discharge test.",
      labour: 12000, parts: [{ sku: "BAT-HP-840", qty: 1 }], quote: { labour: 12000, parts: 42000, approved: true },
    },
    {
      customer: 1, technician: amaka, receivedDaysAgo: 35, status: "delivered",
      device: { type: "Laptop", brand: "Lenovo", model: "ThinkPad T480", serialNumber: "PF2K88QT", accessories: ["Charger", "Bag"], condition: "Good" },
      issue: "Windows will not boot; stuck on repair loop after a power outage.",
      diagnosis: "Corrupted system partition; SMART reports failing sectors on the HDD.",
      workDone: "Recovered user data, installed 480GB SSD, clean Windows 11 install.",
      labour: 15000, parts: [{ sku: "SSD-480-KING", qty: 1 }], quote: { labour: 15000, parts: 45000, approved: true },
    },
    {
      customer: 2, technician: tunde, receivedDaysAgo: 28, status: "delivered", priority: "high",
      device: { type: "Desktop", brand: "Dell", model: "OptiPlex 3070", serialNumber: "DT77KL2", accessories: [], condition: "Dusty interior" },
      issue: "System does not power on at all after a thunderstorm.",
      diagnosis: "Power supply unit failed; motherboard and CPU tested good.",
      workDone: "Replaced PSU, cleaned interior, replaced thermal paste.",
      labour: 10000, parts: [{ sku: "PSU-450W-ATX", qty: 1 }, { sku: "THM-PASTE-MX4", qty: 1 }],
      quote: { labour: 10000, parts: 34000, approved: true },
    },
    {
      customer: 3, technician: ibrahim, receivedDaysAgo: 21, status: "delivered",
      device: { type: "Printer", brand: "HP", model: "LaserJet Pro M404", serialNumber: "VNC3K88", accessories: ["Power cable"], condition: "Good" },
      issue: "Prints faded pages and jams on every third sheet.",
      diagnosis: "Toner depleted and pickup roller worn.",
      workDone: "Replaced toner cartridge, cleaned paper path, serviced rollers.",
      labour: 8000, parts: [{ sku: "TNR-HP-85A", qty: 1 }], quote: { labour: 8000, parts: 34000, approved: true },
    },
    {
      customer: 4, technician: amaka, receivedDaysAgo: 14, status: "completed",
      device: { type: "Laptop", brand: "Acer", model: "Aspire 5", serialNumber: "NXA1S22", accessories: ["Charger"], condition: "Cracked bezel" },
      issue: "Screen stays blank although the keyboard lights come on.",
      diagnosis: "Display panel failed; external monitor works normally.",
      workDone: 'Replaced 15.6" LED panel and tested at full brightness.',
      labour: 14000, parts: [{ sku: "SCR-156-LED", qty: 1 }], quote: { labour: 14000, parts: 68000, approved: true },
    },
    {
      customer: 5, technician: tunde, receivedDaysAgo: 9, status: "in_progress", priority: "high",
      device: { type: "Laptop", brand: "Dell", model: "Latitude 3520", serialNumber: "9KLM33Z", accessories: ["Charger"], condition: "Worn keycaps" },
      issue: "Several keyboard keys do not respond and the machine runs very slowly.",
      diagnosis: "Keyboard membrane damaged by liquid; only 4GB RAM installed.",
      labour: 12000, parts: [{ sku: "KBD-DELL-3520", qty: 1 }, { sku: "RAM-8GB-DDR4", qty: 1 }],
      quote: { labour: 12000, parts: 60000, approved: true },
    },
    {
      customer: 6, technician: amaka, receivedDaysAgo: 6, status: "awaiting_parts",
      device: { type: "Laptop", brand: "HP", model: "Pavilion 15", serialNumber: "8CG1290", accessories: ["Charger", "Mouse"], condition: "Good" },
      issue: "Overheats and shuts down within twenty minutes of use.",
      diagnosis: "Cooling fan seized; heatsink clogged with dust.",
      labour: 9000, quote: { labour: 9000, parts: 12000, approved: true },
    },
    {
      customer: 7, technician: ibrahim, receivedDaysAgo: 4, status: "awaiting_approval",
      device: { type: "Desktop", brand: "HP", model: "ProDesk 400", serialNumber: "MXL0331", accessories: [], condition: "Good" },
      issue: "Random restarts and a loud clicking noise from the drive bay.",
      diagnosis: "Hard drive failing; recommend replacement with an SSD.",
      quote: { labour: 13000, parts: 45000 },
    },
    {
      customer: 0, technician: tunde, receivedDaysAgo: 2, status: "diagnosing", priority: "high",
      device: { type: "Laptop", brand: "Asus", model: "VivoBook 14", serialNumber: "K2M77PP", accessories: ["Charger"], condition: "Dented corner" },
      issue: "Laptop fell and now the touchpad and one USB port do not work.",
    },
    {
      customer: 2, technician: null, receivedDaysAgo: 1, status: "pending",
      device: { type: "Monitor", brand: "Samsung", model: "S24R350", serialNumber: "SMN4410", accessories: ["Power cable", "HDMI cable"], condition: "Good" },
      issue: "Monitor flickers and shows horizontal lines across the display.",
    },
    {
      customer: 4, technician: null, receivedDaysAgo: 0, status: "pending",
      device: { type: "Tablet", brand: "Samsung", model: "Galaxy Tab A8", serialNumber: "RQ8N221", accessories: ["Charger"], condition: "Screen protector fitted" },
      issue: "Tablet does not charge unless the cable is held at an angle.",
    },
    {
      customer: 5, technician: ibrahim, receivedDaysAgo: 30, status: "cancelled",
      device: { type: "Printer", brand: "Canon", model: "LBP6030", serialNumber: "CN77120", accessories: [], condition: "Aged" },
      issue: "Printer not recognised by any computer.",
      diagnosis: "Mainboard failure; repair cost exceeds the value of the unit.",
    },
  ];

  const STAGE_ORDER = ["pending", "diagnosing", "awaiting_approval", "in_progress", "awaiting_parts", "completed", "delivered"];
  const year = new Date().getFullYear();
  let ticketSeq = 0;
  let invoiceSeq = 0;
  const notifications: Record<string, unknown>[] = [];

  for (const bp of blueprints) {
    const customer = customers[bp.customer];
    const receivedAt = daysAgo(bp.receivedDaysAgo);
    const ticket = `TRK-${year}-${pad(++ticketSeq)}`;

    // Build a plausible history: every stage up to the current one.
    const stages = bp.status === "cancelled"
      ? ["pending", "diagnosing", "cancelled"]
      : STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(bp.status) + 1);

    const timeline = stages.map((status, i) => ({
      status,
      note: i === 0 ? "Device received at the workshop." : "",
      by: (bp.technician ?? admin)._id,
      byName: (bp.technician ?? admin).name,
      at: hoursAfter(receivedAt, i * 8),
    }));

    const partsUsed = (bp.parts ?? []).map((entry) => {
      const part = partBySku.get(entry.sku)!;
      return { part: part._id, name: part.name, quantity: entry.qty, unitPrice: part.sellingPrice, addedAt: hoursAfter(receivedAt, 12) };
    });

    const completedAt = ["completed", "delivered"].includes(bp.status)
      ? hoursAfter(receivedAt, 24 + Math.floor(Math.random() * 60))
      : null;

    const job = await RepairJob.create({
      ticket,
      customer: customer._id,
      device: bp.device,
      reportedIssue: bp.issue,
      diagnosis: bp.diagnosis ?? "",
      workDone: bp.workDone ?? "",
      status: bp.status,
      priority: bp.priority ?? "normal",
      technician: bp.technician?._id ?? null,
      estimate: bp.quote
        ? {
            labourCost: bp.quote.labour, partsCost: bp.quote.parts, total: bp.quote.labour + bp.quote.parts,
            notes: "", quotedAt: hoursAfter(receivedAt, 6),
            approved: Boolean(bp.quote.approved),
            approvedAt: bp.quote.approved ? hoursAfter(receivedAt, 10) : null,
            approvedBy: bp.quote.approved ? customer.name : "",
          }
        : undefined,
      partsUsed,
      labourCost: bp.labour ?? 0,
      receivedAt,
      completedAt,
      deliveredAt: bp.status === "delivered" ? hoursAfter(completedAt ?? receivedAt, 12) : null,
      timeline,
      createdBy: admin._id,
    });

    // Draw the parts used down from stock, leaving movement records behind.
    for (const entry of bp.parts ?? []) {
      const part = partBySku.get(entry.sku)!;
      part.quantity = Math.max(0, part.quantity - entry.qty);
      await part.save();
      await StockMovement.create({
        part: part._id, partName: part.name, type: "out", quantity: entry.qty, balanceAfter: part.quantity,
        reason: `Used on repair ${ticket}`, job: job._id,
        by: (bp.technician ?? admin)._id, byName: (bp.technician ?? admin).name,
      });
    }

    // Invoice the finished jobs.
    if (["completed", "delivered"].includes(bp.status)) {
      const items = [
        ...(bp.labour ? [{ description: "Repair labour / service charge", kind: "labour", quantity: 1, unitPrice: bp.labour, amount: bp.labour }] : []),
        ...partsUsed.map((p) => ({ description: p.name, kind: "part", quantity: p.quantity, unitPrice: p.unitPrice, amount: p.quantity * p.unitPrice })),
      ];
      const subtotal = items.reduce((s, i) => s + i.amount, 0);
      const total = subtotal;
      const fullyPaid = bp.status === "delivered";
      const amountPaid = fullyPaid ? total : Math.round(total * 0.4);

      await Invoice.create({
        invoiceNumber: `INV-${year}-${pad(++invoiceSeq)}`,
        job: job._id, ticket, customer: customer._id, items,
        subtotal, taxRate: 0, tax: 0, discount: 0, total,
        amountPaid, status: fullyPaid ? "paid" : "partial",
        payments: [{ amount: amountPaid, method: "transfer", reference: `TRF${Math.floor(Math.random() * 900000 + 100000)}`, at: completedAt ?? receivedAt, byName: admin.name }],
        issuedAt: completedAt ?? receivedAt,
        issuedBy: admin._id,
      });
    }

    // Notification history matching the timeline.
    for (const entry of timeline) {
      notifications.push({
        event: "job.status_changed", channel: "email", to: customer.email, recipientName: customer.name,
        customer: customer._id, job: job._id, ticket,
        subject: `[${ticket}] Repair status update: ${entry.status.replace(/_/g, " ")}`,
        message: `Hello ${customer.name},\n\nYour repair ${ticket} is now "${entry.status.replace(/_/g, " ")}".\n\nTrack your repair at /track using this number.`,
        status: "sent", sentAt: entry.at, createdAt: entry.at, updatedAt: entry.at,
      });
    }
  }

  await Notification.insertMany(notifications);

  // Leave the counters where the seeded data ended, so new records continue the sequence.
  await Counter.create([
    { _id: `ticket-${year}`, seq: ticketSeq },
    { _id: `invoice-${year}`, seq: invoiceSeq },
  ]);

  console.log(`Created ${blueprints.length} repair jobs, ${invoiceSeq} invoices, ${notifications.length} notifications.`);
  console.log("\nSign in with:");
  console.log("  Administrator  admin@crms.test   / password123");
  console.log("  Technician     tunde@crms.test   / password123");
  console.log("  Technician     amaka@crms.test   / password123");
  console.log("  Technician     ibrahim@crms.test / password123");

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
