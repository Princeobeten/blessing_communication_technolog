"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Cpu, Search } from "lucide-react";
import { Button, Input, Field, Alert } from "@/components/ui";
import { postJSON } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await postJSON("/api/auth/login", { email, password });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Field label="Email address" required>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@workshop.com"
          required
        />
      </Field>

      <Field label="Password" required>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </Field>

      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15">
            <Cpu className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">CRMS</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Computer Repair Management System</h1>
          <p className="mt-4 max-w-md text-brand-100">
            One place for device intake, repair tracking, technician assignment, spare-part inventory,
            billing and management reporting.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-brand-100">
            <li>• Real-time repair status for every work order</li>
            <li>• Automatic customer updates at each stage</li>
            <li>• Low-stock alerts on spare parts</li>
            <li>• Revenue and technician performance reports</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">Final year project prototype</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
              <Cpu className="h-5 w-5" />
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Staff sign in</h2>
          <p className="mt-1 mb-8 text-sm text-slate-500">
            Enter your credentials to open the workshop dashboard.
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <Link
              href="/track"
              className="flex items-center justify-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <Search className="h-4 w-4" />
              Are you a customer? Track your repair
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
