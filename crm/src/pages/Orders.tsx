import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, CircleDollarSign, Package, Plus, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  STATUS_COLORS, STATUS_LABELS, PAYMENT_METHODS,
  cancelOrder, confirmOrder, createOrder, listOrders, recordPayment,
} from '../services/orders';
import type { Order } from '../types';

function money(n: number) {
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main list
// ─────────────────────────────────────────────────────────────────────────────
export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load(status = statusFilter) {
    setLoading(true);
    try {
      const { orders } = await listOrders({ status: status || undefined });
      setOrders(orders);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function onConfirm(order: Order) {
    if (!confirm(`অর্ডার #${order.id.slice(-6)} কনফার্ম করবেন? স্টক কাটা যাবে।`)) return;
    try {
      const { order: updated, warnings } = await confirmOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
      if (warnings.length) alert('সতর্কতা:\n' + warnings.join('\n'));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'কনফার্ম করা যায়নি।');
    }
  }

  async function onCancel(order: Order) {
    if (!confirm(`অর্ডার #${order.id.slice(-6)} বাতিল করবেন?`)) return;
    try {
      const updated = await cancelOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'বাতিল করা যায়নি।');
    }
  }

  async function onPaymentAdded(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelectedOrder(updated);
  }

  if (!user) return null;
  const canManage = user.role === 'admin' || user.role === 'sub_admin' || user.role === 'store_manager';

  return (
    <div className="flex gap-4 h-full">
      {/* Left: list */}
      <div className={`flex-1 min-w-0 ${selectedOrder ? 'hidden md:block' : ''}`}>
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">অর্ডার</h1>
            <p className="text-sm text-navy-500 mt-0.5">মোট {orders.length} টি</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">সব স্ট্যাটাস</option>
              <option value="pending">মুলতুবি</option>
              <option value="confirmed">কনফার্ম</option>
              <option value="cancelled">বাতিল</option>
            </select>
            {canManage && (
              <button onClick={() => setShowNew(true)} className="btn-primary">
                <Plus size={15} /> নতুন অর্ডার
              </button>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-navy-400">লোড হচ্ছে…</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-navy-400">কোনো অর্ডার নেই।</div>
          ) : (
            <div className="divide-y divide-navy-100">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left px-4 py-3 hover:bg-navy-50 transition-colors flex items-center gap-3 ${selectedOrder?.id === order.id ? 'bg-navy-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-navy-900 text-sm">{order.customerName}</span>
                      <span className={`badge text-xs ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="text-xs text-navy-500 mt-0.5">
                      {order.items.length} পণ্য · {money(order.totalDiscountedAmount)}
                      {order.totalDue > 0 && (
                        <span className="text-red-600 ml-2">· বাকি {money(order.totalDue)}</span>
                      )}
                    </div>
                    <div className="text-xs text-navy-400">{fmtDate(order.createdAt)}</div>
                  </div>
                  <ChevronRight size={16} className="text-navy-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onPaymentAdded={onPaymentAdded}
          canManage={canManage}
        />
      )}

      {showNew && (
        <NewOrderModal
          onClose={() => setShowNew(false)}
          onCreated={(o) => {
            setOrders((prev) => [o, ...prev]);
            setSelectedOrder(o);
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order detail panel
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetail({
  order, onClose, onConfirm, onCancel, onPaymentAdded, canManage,
}: {
  order: Order;
  onClose: () => void;
  onConfirm: (o: Order) => void;
  onCancel: (o: Order) => void;
  onPaymentAdded: (o: Order) => void;
  canManage: boolean;
}) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0]);
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayErr(null);
    setPayBusy(true);
    try {
      const { order: updated } = await recordPayment(order.id, {
        amount: Number(payAmount),
        paymentMethod: payMethod,
        note: payNote,
      });
      onPaymentAdded(updated);
      setShowPayForm(false);
      setPayAmount('');
      setPayNote('');
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : 'পেমেন্ট যোগ করা যায়নি।');
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <div className="w-full md:w-[440px] shrink-0 card overflow-y-auto max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-100 sticky top-0 bg-white z-10">
        <div>
          <div className="font-semibold text-navy-900 text-sm">{order.customerName}</div>
          <div className="text-xs text-navy-500">{order.customerPhone}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700"><X size={18} /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Line items */}
        <div>
          <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">পণ্যসমূহ</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <Package size={14} className="text-navy-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-navy-900">{item.productName}</div>
                  <div className="text-xs text-navy-500">
                    {item.quantity} × {money(item.unitDiscountedPrice)}
                    {item.unitOriginalPrice !== item.unitDiscountedPrice && (
                      <span className="line-through ml-1 text-navy-400">{money(item.unitOriginalPrice)}</span>
                    )}
                  </div>
                </div>
                <div className="text-navy-800 font-medium">{money(item.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-navy-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-navy-600">
            <span>মূল মোট</span><span>{money(order.totalOriginalAmount)}</span>
          </div>
          <div className="flex justify-between text-navy-800 font-medium">
            <span>বিক্রয় মোট</span><span>{money(order.totalDiscountedAmount)}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>পরিশোধিত</span><span>{money(order.totalPaid)}</span>
          </div>
          <div className={`flex justify-between font-semibold ${order.totalDue > 0 ? 'text-red-600' : 'text-green-700'}`}>
            <span>বাকি</span><span>{money(order.totalDue)}</span>
          </div>
        </div>

        {/* Payments */}
        {order.payments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">পেমেন্ট ইতিহাস</h3>
            <div className="space-y-1.5">
              {order.payments.map((pay) => (
                <div key={pay.id} className="flex items-center gap-2 text-sm">
                  <CircleDollarSign size={13} className="text-green-600 shrink-0" />
                  <div className="flex-1">
                    <span className="text-navy-700">{pay.paymentMethod}</span>
                    {pay.note && <span className="text-navy-400 ml-1 text-xs">({pay.note})</span>}
                    <span className="text-navy-400 text-xs ml-1">· {fmtDate(pay.paymentDate)}</span>
                  </div>
                  <span className="text-green-700 font-medium">{money(pay.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-navy-50 rounded-md px-3 py-2 text-sm text-navy-700">{order.notes}</div>
        )}

        {/* Actions */}
        {canManage && order.status !== 'cancelled' && (
          <div className="space-y-2 pt-1">
            {order.status === 'pending' && (
              <button onClick={() => onConfirm(order)} className="btn-primary w-full">
                অর্ডার কনফার্ম করুন (স্টক কাটবে)
              </button>
            )}
            <button
              onClick={() => setShowPayForm(!showPayForm)}
              className="btn-outline w-full"
            >
              <CircleDollarSign size={14} /> পেমেন্ট যোগ করুন
            </button>
            {showPayForm && (
              <form onSubmit={submitPayment} className="bg-navy-50 rounded-md p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">পরিমাণ (৳)</label>
                    <input required type="number" min="1" step="0.01" className="input" value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">পদ্ধতি</label>
                    <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">নোট (ঐচ্ছিক)</label>
                  <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                </div>
                {payErr && <div className="text-red-600 text-xs">{payErr}</div>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPayForm(false)} className="btn-outline flex-1">বাতিল</button>
                  <button type="submit" className="btn-primary flex-1" disabled={payBusy}>
                    {payBusy ? 'সংরক্ষণ…' : 'সংরক্ষণ'}
                  </button>
                </div>
              </form>
            )}
            <button
              onClick={() => onCancel(order)}
              className="w-full text-sm text-red-600 hover:text-red-800 py-1"
            >
              অর্ডার বাতিল করুন
            </button>
          </div>
        )}

        <div className="text-xs text-navy-400 pt-1">
          তৈরি: {order.createdByName} · {fmtDate(order.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Order modal
// ─────────────────────────────────────────────────────────────────────────────
interface LineItem {
  productId: string;
  quantity: number;
  unitDiscountedPrice: string;
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Order) => void }) {
  const { customers, products } = useData();
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ productId: '', quantity: 1, unitDiscountedPrice: '' }]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() =>
    customers.filter((c) =>
      !search || c.name.includes(search) || c.phone.includes(search)
    ).slice(0, 50),
    [customers, search],
  );

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function setLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      // Auto-fill price when product changes
      if (patch.productId) {
        const prod = productMap.get(patch.productId);
        if (prod) updated.unitDiscountedPrice = String(Number(prod.price));
      }
      return updated;
    }));
  }

  const totals = useMemo(() => {
    let orig = 0; let disc = 0;
    for (const l of lines) {
      const prod = productMap.get(l.productId);
      if (!prod) continue;
      orig += Number(prod.price) * l.quantity;
      disc += Number(l.unitDiscountedPrice || prod.price) * l.quantity;
    }
    return { orig, disc };
  }, [lines, productMap]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!customerId) { setErr('কাস্টমার নির্বাচন করুন।'); return; }
    const validLines = lines.filter((l) => l.productId);
    if (!validLines.length) { setErr('কমপক্ষে একটি পণ্য যোগ করুন।'); return; }
    setBusy(true);
    try {
      const created = await createOrder({
        customerId,
        items: validLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitDiscountedPrice: Number(l.unitDiscountedPrice),
        })),
        notes,
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'অর্ডার তৈরি করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50">
      <div className="bg-white rounded-lg shadow-card w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-navy-900">নতুন অর্ডার</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Customer */}
          <div>
            <label className="label">কাস্টমার *</label>
            <input
              className="input mb-2"
              placeholder="নাম বা ফোন দিয়ে খুঁজুন…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              required
              className="input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              size={4}
            >
              <option value="">— কাস্টমার নির্বাচন করুন —</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div>
            <label className="label">পণ্যসমূহ *</label>
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const prod = productMap.get(line.productId);
                return (
                  <div key={idx} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-end">
                    <div>
                      {idx === 0 && <span className="label">পণ্য</span>}
                      <select
                        className="input"
                        value={line.productId}
                        onChange={(e) => setLine(idx, { productId: e.target.value })}
                      >
                        <option value="">— পণ্য নির্বাচন করুন —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({money(Number(p.price))})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      {idx === 0 && <span className="label">পরিমাণ</span>}
                      <input
                        type="number" min="1" className="input"
                        value={line.quantity}
                        onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      {idx === 0 && (
                        <span className="label">
                          বিক্রয় মূল্য
                          {prod && <span className="text-navy-400 ml-1 text-xs">(মূল: {money(Number(prod.price))})</span>}
                        </span>
                      )}
                      <input
                        type="number" min="0" step="0.01" className="input"
                        value={line.unitDiscountedPrice}
                        placeholder={prod ? String(Number(prod.price)) : '০'}
                        onChange={(e) => setLine(idx, { unitDiscountedPrice: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 mt-5"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, { productId: '', quantity: 1, unitDiscountedPrice: '' }])}
              className="btn-outline mt-2 text-sm"
            >
              <Plus size={13} /> আরেকটি পণ্য
            </button>
          </div>

          {/* Totals preview */}
          {totals.disc > 0 && (
            <div className="bg-navy-50 rounded-md px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between text-navy-500">
                <span>মূল মোট</span><span>{money(totals.orig)}</span>
              </div>
              <div className="flex justify-between text-navy-800 font-semibold">
                <span>বিক্রয় মোট</span><span>{money(totals.disc)}</span>
              </div>
              {totals.orig > totals.disc && (
                <div className="flex justify-between text-green-700 text-xs">
                  <span>ছাড়</span><span>{money(totals.orig - totals.disc)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">নোট (ঐচ্ছিক)</label>
            <textarea className="input min-h-[60px] resize-y" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          {err && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline flex-1">বাতিল</button>
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? 'তৈরি হচ্ছে…' : 'অর্ডার তৈরি করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
