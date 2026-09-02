"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Table, Td, Textarea, Th,
} from "@/components/ui";
import { getJSON, postJSON } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Customer = {
  _id: string; name: string; phone: string; email: string; address: string; company: string;
  jobCount: number; createdAt: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", company: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJSON<{ customers: Customer[] }>(`/api/customers?q=${encodeURIComponent(q)}`);
      setCustomers(data.customers);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await postJSON("/api/customers", form);
      setOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", company: "", notes: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone who has brought a device to the workshop"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Register customer
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or email" className="pl-9" />
          </div>
        </div>

        {error && <div className="p-4"><Alert>{error}</Alert></div>}

        {loading ? (
          <Spinner />
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={q ? "Try a different search term." : "Register a customer or create a repair intake."}
            action={<Button size="sm" onClick={() => setOpen(true)}>Register customer</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Repairs</Th><Th>Registered</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/customers/${c._id}`} className="font-medium text-brand-600 hover:text-brand-700">{c.name}</Link>
                    {c.company && <p className="text-xs text-slate-500">{c.company}</p>}
                  </Td>
                  <Td>{c.phone}</Td>
                  <Td className="text-slate-600">{c.email || "-"}</Td>
                  <Td>{c.jobCount}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Register a customer">
        <form onSubmit={save} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Phone number" required>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Field>
            <Field label="Email" hint="Used for automatic repair updates">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Company">
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save customer</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
