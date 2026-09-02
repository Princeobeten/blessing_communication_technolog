"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Select, Textarea, Alert, PageHeader } from "@/components/ui";
import { getJSON, postJSON } from "@/lib/client";
import { DEVICE_TYPES, PRIORITY_OPTIONS } from "@/lib/constants";

type Customer = { _id: string; name: string; phone: string };
type Technician = { _id: string; name: string; role: string; active: boolean; openJobs: number };

/**
 * Repair Intake (Fig 3.7): register the customer, record device details,
 * document the reported issue and schedule the diagnosis - in one submission.
 */
export default function NewRepairPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("new");

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [device, setDevice] = useState({ type: "Laptop", brand: "", model: "", serialNumber: "", condition: "" });
  const [accessories, setAccessories] = useState("");
  const [reportedIssue, setReportedIssue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [technician, setTechnician] = useState("");
  const [expected, setExpected] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJSON<{ customers: Customer[] }>("/api/customers?limit=200")
      .then((d) => setCustomers(d.customers))
      .catch(() => setCustomers([]));
    getJSON<{ technicians: Technician[] }>("/api/technicians")
      .then((d) => setTechnicians(d.technicians.filter((t) => t.active)))
      .catch(() => setTechnicians([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...(mode === "existing" ? { customerId } : { customer: newCustomer }),
        device: {
          ...device,
          accessories: accessories
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        },
        reportedIssue,
        priority,
        technician: technician || null,
        // The date input gives a local calendar day; the API expects an ISO instant.
        expectedCompletionAt: expected ? new Date(`${expected}T17:00:00`).toISOString() : null,
      };
      const { job } = await postJSON<{ job: { _id: string; ticket: string } }>("/api/repairs", payload);
      router.push(`/repairs/${job._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the repair job.");
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/repairs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to repair jobs
      </Link>

      <PageHeader title="New repair intake" subtitle="Log a device into the workshop and open a work order" />

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Customer" subtitle="Register a new customer or select an existing record" />
            <div className="space-y-4 p-5">
              <div className="flex gap-2">
                {(["new", "existing"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      mode === m ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m === "new" ? "New customer" : "Existing customer"}
                  </button>
                ))}
              </div>

              {mode === "existing" ? (
                <Field label="Select customer" required>
                  <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                    <option value="">Choose a customer...</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} - {c.phone}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <Input
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Chinedu Okafor"
                      required
                    />
                  </Field>
                  <Field label="Phone number" required>
                    <Input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="08012345678"
                      required
                    />
                  </Field>
                  <Field label="Email" hint="Used for automatic status updates">
                    <Input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="customer@example.com"
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Device details" subtitle="What was brought in" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Device type" required>
                <Select value={device.type} onChange={(e) => setDevice({ ...device, type: e.target.value })} required>
                  {DEVICE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Brand" required>
                <Input
                  value={device.brand}
                  onChange={(e) => setDevice({ ...device, brand: e.target.value })}
                  placeholder="HP"
                  required
                />
              </Field>
              <Field label="Model">
                <Input
                  value={device.model}
                  onChange={(e) => setDevice({ ...device, model: e.target.value })}
                  placeholder="EliteBook 840 G5"
                />
              </Field>
              <Field label="Serial number">
                <Input
                  value={device.serialNumber}
                  onChange={(e) => setDevice({ ...device, serialNumber: e.target.value })}
                  placeholder="5CD9123ABC"
                />
              </Field>
              <Field label="Accessories received" hint="Comma separated, e.g. charger, bag">
                <Input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="Charger, bag" />
              </Field>
              <Field label="Physical condition">
                <Input
                  value={device.condition}
                  onChange={(e) => setDevice({ ...device, condition: e.target.value })}
                  placeholder="Scratched lid, cracked bezel"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Reported fault" subtitle="In the customer's own words" />
            <div className="p-5">
              <Field label="Description of the problem" required>
                <Textarea
                  value={reportedIssue}
                  onChange={(e) => setReportedIssue(e.target.value)}
                  placeholder="Laptop powers on but the screen stays blank. Started after a power surge."
                  required
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Scheduling" />
            <div className="space-y-4 p-5">
              <Field label="Priority">
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Assign technician" hint="Can be assigned later">
                <Select value={technician} onChange={(e) => setTechnician(e.target.value)}>
                  <option value="">Leave unassigned</option>
                  {technicians.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.openJobs} open)
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Expected completion">
                <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </Field>
            </div>
          </Card>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" loading={saving} className="w-full">
            Create work order
          </Button>
          <p className="text-center text-xs text-slate-500">
            A tracking number is generated automatically and the customer is notified.
          </p>
        </div>
      </form>
    </>
  );
}
