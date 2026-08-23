import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Package, Pencil, Plus, Trash2, X, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  LOW_STOCK_THRESHOLD,
  createProduct,
  deleteProduct,
  updateProduct,
} from '../services/products';
import { uploadUrl } from '../services/api';
import type { Product } from '../types';

function money(n: number): string {
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 })
    .format(n);
}

export default function Products() {
  const { user } = useAuth();
  const { products } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  if (!user) return null;
  const canEdit = user.role === 'admin' || user.role === 'sub_admin';

  const sorted = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, 'bn')),
    [products],
  );
  const lowStockCount = sorted.filter((p) => p.stockQuantity < LOW_STOCK_THRESHOLD).length;

  async function onDelete(p: Product) {
    if (!confirm(`"${p.name}" মুছে ফেলবেন?`)) return;
    try {
      await deleteProduct(p.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">প্রোডাক্ট</h1>
          <p className="text-sm text-navy-500 mt-1">
            মোট {sorted.length} টি প্রোডাক্ট
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-600">
                · {lowStockCount} টিতে স্টক কম
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> নতুন প্রোডাক্ট
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-navy-700">
              <tr>
                <th className="text-left font-medium px-4 py-3">ছবি</th>
                <th className="text-left font-medium px-4 py-3">নাম</th>
                <th className="text-right font-medium px-4 py-3">দাম</th>
                <th className="text-right font-medium px-4 py-3">স্টক</th>
                {canEdit && <th className="text-right font-medium px-4 py-3">অ্যাকশন</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="text-center py-12 text-navy-400">
                    কোন প্রোডাক্ট নেই।
                  </td>
                </tr>
              )}
              {sorted.map((p) => {
                const low = p.stockQuantity < LOW_STOCK_THRESHOLD;
                const img = uploadUrl(p.imagePath);
                return (
                  <tr key={p.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      {img ? (
                        <img src={img} alt="" className="w-12 h-12 rounded-md object-cover border border-navy-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-300">
                          <Package size={20} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-900">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-navy-500 truncate max-w-[400px]">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-navy-800">{money(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      {low ? (
                        <span className="badge bg-red-100 text-red-700 inline-flex items-center gap-1">
                          <AlertTriangle size={11} /> {p.stockQuantity}
                        </span>
                      ) : (
                        <span className="text-navy-700">{p.stockQuantity}</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditing(p); setShowForm(true); }}
                            className="p-1.5 rounded hover:bg-navy-100 text-navy-600"
                            title="সম্পাদনা"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => onDelete(p)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                            title="মুছুন"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <ProductForm
          open={showForm}
          editing={editing}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

interface FormState {
  name: string;
  price: string;
  stockQuantity: string;
  description: string;
}
const emptyForm: FormState = { name: '', price: '', stockQuantity: '', description: '' };

function ProductForm({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Product | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        price: String(editing.price),
        stockQuantity: String(editing.stockQuantity),
        description: editing.description,
      });
      setImagePreview(uploadUrl(editing.imagePath));
    } else {
      setForm(emptyForm);
      setImagePreview(null);
    }
    setImage(null);
    setErr(null);
  }, [open, editing]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImage(f);
    if (f) setImagePreview(URL.createObjectURL(f));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const priceNum = Number(form.price);
      const stockNum = Number.parseInt(form.stockQuantity, 10);
      if (!form.name.trim()) throw new Error('নাম দিন।');
      if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error('বৈধ দাম দিন।');
      if (!Number.isFinite(stockNum) || stockNum < 0) throw new Error('বৈধ স্টক দিন।');

      const payload = {
        name: form.name.trim(),
        price: priceNum,
        stockQuantity: stockNum,
        description: form.description.trim(),
        image: image ?? undefined,
      };

      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'সেভ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50">
      <div className="bg-white rounded-lg shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100">
          <h2 className="text-base font-semibold text-navy-900">
            {editing ? 'প্রোডাক্ট সম্পাদনা' : 'নতুন প্রোডাক্ট'}
          </h2>
          <button onClick={onClose} className="text-navy-500 hover:text-navy-800">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">ছবি</label>
            <div className="flex items-start gap-3">
              <div
                className="w-24 h-24 rounded-md border border-navy-200 bg-navy-50 flex items-center justify-center overflow-hidden shrink-0"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={26} className="text-navy-300" />
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-outline"
                >
                  <Upload size={14} /> {image || editing?.imagePath ? 'ছবি বদলান' : 'ছবি যোগ করুন'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickImage}
                />
                <p className="text-xs text-navy-500 mt-2">
                  ছবিটি স্বয়ংক্রিয়ভাবে ৪০০px-এ কমপ্রেস হবে (সর্বোচ্চ ৫MB আপলোড)।
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="label">নাম *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">দাম (টাকা) *</label>
              <input
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">স্টক পরিমাণ *</label>
              <input
                required
                type="number"
                inputMode="numeric"
                min="0"
                className="input"
                value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">বর্ণনা (ঐচ্ছিক)</label>
            <textarea
              className="input min-h-[70px] resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">বাতিল</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'সংরক্ষণ হচ্ছে…' : editing ? 'সংরক্ষণ' : 'যোগ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
