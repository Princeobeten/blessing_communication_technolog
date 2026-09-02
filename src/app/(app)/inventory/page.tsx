"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, AlertTriangle, ArrowDownUp } from "lucide-react";
import {
  Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th,
} from "@/components/ui";
import { getJSON, patchJSON, postJSON } from "@/lib/client";
import { formatMoney } from "@/lib/utils";

type Part = {
  _id: string; sku: string; name: string; category: string; quantity: number; reorderLevel: number;
  unitCost: number; sellingPrice: number; supplier: string; location: string; lowStock: boolean;
};

const EMPTY_FORM = {
  sku: "", name: "", category: "", quantity: "0", reorderLevel: "5",
  unitCost: "0", sellingPrice: "0", supplier: "", location: "",
};

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [adjustPart, setAdjustPart] = useState<Part | null>(null);
  const [adjust, setAdjust] = useState({ adjustBy: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (lowOnly) params.set("low", "true");
      const data = await getJSON<{ parts: Part[] }>(`/api/parts?${params}`);
      setParts(data.parts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, [q, lowOnly]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await postJSON("/api/parts", {
        ...form,
        quantity: Number(form.quantity) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unitCost: Number(form.unitCost) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
      });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the part.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustPart) return;
    setSaving(true);
    setFormError("");
    try {
      await patchJSON(`/api/parts/${adjustPart._id}`, {
        adjustBy: Number(adjust.adjustBy),
        reason: adjust.reason,
      });
      setAdjustPart(null);
      setAdjust({ adjustBy: "", reason: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not adjust stock.");
    } finally {
      setSaving(false);
    }
  }

  const lowCount = parts.filter((p) => p.lowStock).length;
  const stockValue = parts.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);

  return (
    <>
      <PageHeader
        title="Spare parts inventory"
        subtitle="Stock levels, reorder alerts and part pricing"
        action={
          <Button onClick={() => { setForm(EMPTY_FORM); setFormError(""); setAddOpen(true); }}>
            <Plus className="h-4 w-4" /> Add part
          </Button>
        }
      />

      {lowCount > 0 && !lowOnly && (
        <div className="mb-4">
          <Alert tone="info">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {lowCount} part(s) are at or below their reorder level.
              <button className="font-semibold underline" onClick={() => setLowOnly(true)}>Show only these</button>
            </span>
          </Alert>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by part name or SKU" className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Low stock only
          </label>
          <span className="text-sm text-slate-500">Stock value: <strong className="text-slate-900">{formatMoney(stockValue)}</strong></span>
        </div>

        {error && <div className="p-4"><Alert>{error}</Alert></div>}

        {loading ? (
          <Spinner />
        ) : parts.length === 0 ? (
          <EmptyState title="No spare parts" description={lowOnly ? "Nothing is below its reorder level." : "Add the parts your workshop keeps in stock."} />
        ) : (
          <Table>
            <thead>
              <tr><Th>Part</Th><Th>Category</Th><Th>In stock</Th><Th>Unit cost</Th><Th>Selling price</Th><Th>Supplier</Th><Th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parts.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku}{p.location && ` · ${p.location}`}</p>
                  </Td>
                  <Td className="text-slate-600">{p.category}</Td>
                  <Td>
                    <span className="font-medium text-slate-900">{p.quantity}</span>
                    <span className="ml-2">
                      {p.quantity === 0 ? <Badge tone="red">Out of stock</Badge> : p.lowStock ? <Badge tone="amber">Reorder</Badge> : null}
                    </span>
                  </Td>
                  <Td className="text-slate-600">{formatMoney(p.unitCost)}</Td>
                  <Td className="text-slate-900">{formatMoney(p.sellingPrice)}</Td>
                  <Td className="text-slate-600">{p.supplier || "-"}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setAdjustPart(p); setAdjust({ adjustBy: "", reason: "" }); setFormError(""); }}>
                      <ArrowDownUp className="h-4 w-4" /> Adjust
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a spare part">
        <form onSubmit={addPart} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" required><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SSD-480-KING" required /></Field>
            <Field label="Part name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="480GB SSD" required /></Field>
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Storage" /></Field>
            <Field label="Supplier"><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></Field>
            <Field label="Opening quantity"><Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
            <Field label="Reorder level" hint="Alert when stock reaches this"><Input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
            <Field label="Unit cost"><Input type="number" min="0" step="100" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></Field>
            <Field label="Selling price" required><Input type="number" min="0" step="100" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required /></Field>
          </div>
          <Field label="Storage location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Shelf B2" /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add part</Button>
          </div>
        </form>
      </Modal>

      <Modal open={adjustPart !== null} onClose={() => setAdjustPart(null)} title={`Adjust stock - ${adjustPart?.name ?? ""}`}>
        <form onSubmit={saveAdjustment} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <p className="text-sm text-slate-600">
            Current stock: <strong>{adjustPart?.quantity}</strong>. Enter a positive number for stock received, or a
            negative number to write stock off.
          </p>
          <Field label="Adjust by" required>
            <Input type="number" value={adjust.adjustBy} onChange={(e) => setAdjust({ ...adjust, adjustBy: e.target.value })} placeholder="e.g. 10 or -2" required />
          </Field>
          <Field label="Reason" required>
            <Select value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} required>
              <option value="">Select a reason...</option>
              <option>Stock received from supplier</option>
              <option>Stock count correction</option>
              <option>Damaged / written off</option>
              <option>Returned to supplier</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustPart(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save adjustment</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
