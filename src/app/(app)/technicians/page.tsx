"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Power } from "lucide-react";
import {
  Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th,
} from "@/components/ui";
import { getJSON, patchJSON, postJSON } from "@/lib/client";

type Staff = {
  _id: string; name: string; email: string; role: string; phone: string;
  specialization: string; active: boolean; openJobs: number;
};

const EMPTY = { name: "", email: "", password: "", role: "technician", phone: "", specialization: "" };

export default function TechniciansPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff((await getJSON<{ technicians: Staff[] }>("/api/technicians")).technicians);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await postJSON("/api/technicians", form);
      setOpen(false);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: Staff) {
    setError("");
    try {
      await patchJSON(`/api/technicians/${member._id}`, { active: !member.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the account.");
    }
  }

  return (
    <>
      <PageHeader
        title="Staff accounts"
        subtitle="Administrators and technicians who can sign in"
        action={<Button onClick={() => { setForm(EMPTY); setFormError(""); setOpen(true); }}><Plus className="h-4 w-4" /> Add staff</Button>}
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        {loading ? (
          <Spinner />
        ) : staff.length === 0 ? (
          <EmptyState title="No staff accounts" description="Add a technician so jobs can be assigned." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Specialization</Th><Th>Open jobs</Th><Th>Status</Th><Th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium text-slate-900">{member.name}</p>
                    {member.phone && <p className="text-xs text-slate-500">{member.phone}</p>}
                  </Td>
                  <Td className="text-slate-600">{member.email}</Td>
                  <Td><Badge tone={member.role === "admin" ? "blue" : "slate"}>{member.role}</Badge></Td>
                  <Td className="text-slate-600">{member.specialization || "-"}</Td>
                  <Td>{member.openJobs}</Td>
                  <Td>{member.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(member)}>
                      <Power className="h-4 w-4" />
                      {member.active ? "Disable" : "Enable"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a staff account">
        <form onSubmit={create} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Password" required hint="At least 6 characters"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="technician">Technician</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Specialization"><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Hardware / Networking" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create account</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
