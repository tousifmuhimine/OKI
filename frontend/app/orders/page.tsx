"use client";

import { FormEvent, useEffect, useState } from "react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Order, OrderListResponse } from "@/types/crm";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    try {
      const response = await apiRequest<OrderListResponse>("/orders?limit=50&offset=0");
      setOrders(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setCustomerId("");
      setTotalAmount("");
      await loadOrders();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Sales</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Orders</h1>
        </header>

        <form
          onSubmit={createOrder}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Customer ID"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Total amount"
          />
          <button className="rounded-xl bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-800" type="submit">
            Add order
          </button>
        </form>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-card">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{order.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.customer_id}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.status}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{order.payment_status}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {order.total_amount} {order.currency}
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-slate-500" colSpan={5}>
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </ProtectedPage>
  );
}
