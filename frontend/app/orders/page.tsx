"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShoppingCart, Plus, Hash, DollarSign, Building2 } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Order, OrderListResponse } from "@/types/crm";

type OrderWithCustomer = Order & { customer_name?: string | null };

export default function OrdersPage() {
  const [orders, setOrders]           = useState<OrderWithCustomer[]>([]);
  const [customerId, setCustomerId]   = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  async function loadOrders() {
    try {
      const response = await apiRequest<OrderListResponse>("/orders?limit=50&offset=0");
      setOrders(response.data as OrderWithCustomer[]);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadOrders(); }, []);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          total_amount: Number(totalAmount || 0),
          status: "draft",
          payment_status: "pending",
          currency: "USD",
        }),
      });
      setCustomerId(""); setTotalAmount("");
      await loadOrders();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge: Record<string, string> = {
    draft:     "bg-white/40 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-white/20 dark:border-white/5",
    confirmed: "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    shipped:   "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    completed: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    cancelled: "bg-rose-500/20 text-rose-700 dark:bg-rose-500/30 dark:text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
  };

  const paymentBadge: Record<string, string> = {
    pending:  "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    paid:     "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    refunded: "bg-white/40 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-white/20 dark:border-white/5",
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400 drop-shadow-sm">Sales</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Orders</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 glass-panel px-3 py-1.5 rounded-xl">
            <ShoppingCart size={14} className="text-brand-500 dark:text-brand-400" />
            <span>{orders.length} total</span>
          </div>
        </div>

        <form
          onSubmit={createOrder}
          className="mb-6 grid animate-fade-in gap-3 glass-card p-5 sm:grid-cols-3"
        >
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Customer ID (paste from Customers page)"
            />
          </div>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Total amount"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60"
          >
            <Plus size={15} />
            {loading ? "Adding…" : "Add order"}
          </button>
        </form>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 backdrop-blur-md">
            {error}
          </p>
        ) : null}

        <div className="animate-fade-in overflow-hidden glass-card">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/20 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {(orders ?? []).map((order) => (
                <tr key={order.id} className="group transition hover:bg-white/40 dark:hover:bg-white/10">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{order.id.slice(0, 8)}…</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                        <Building2 size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {(order as OrderWithCustomer).customer_name ?? "Unknown Customer"}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {order.customer_id.slice(0, 12)}…
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusBadge[order.status] ?? statusBadge["draft"]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${paymentBadge[order.payment_status] ?? paymentBadge["pending"]}`}>
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800 dark:text-white">
                    {order.total_amount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{order.currency}</span>
                  </td>
                </tr>
              ))}
              {(orders ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                    No orders yet. Add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ProtectedPage>
  );
}
