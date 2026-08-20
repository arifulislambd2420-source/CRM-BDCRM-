import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { Customer } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createCustomer, updateCustomer } from '../services/customers';
import { addNote } from '../services/notes';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Customer | null;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  source: string;
  pipelineId: string;
  currentStageId: string;
  storeId: string;
}

const empty: FormState = {
  name: '',
  phone: '',
  address: '',
  source: '',
  pipelineId: '',
  currentStageId: '',
  storeId: '',
};

export default function CustomerForm({ open, onClose, editing }: Props) {
  const { user } = useAuth();
  const data = useData();
  const [form, setForm] = useState<FormState>(empty);
  const [err, setErr] = useState<string | null>(null);
  const [initialNote, setInitialNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { name, phone, address, source, pipelineId, currentStageId, storeId } = editing;
      setForm({ name, phone, address, source, pipelineId, currentStageId, storeId });
    } else {
      const defaultPipeline = data.pipelines[0];
      setForm({
        ...empty,
        source: data.settings.sources[0] ?? '',
        pipelineId: defaultPipeline?.id ?? '',
        currentStageId: defaultPipeline?.stages[0]?.id ?? '',
        storeId:
          user?.role === 'store_manager' && user.storeId
            ? user.storeId
            : data.stores[0]?.id ?? '',
      });
    }
    setInitialNote('');
    setErr(null);
  }, [open, editing, data.settings, data.stores, data.pipelines, user]);

  const stagesForPipeline = useMemo(
    () => data.pipelines.find((p) => p.id === form.pipelineId)?.stages ?? [],
    [data.pipelines, form.pipelineId],
  );

  if (!open || !user) return null;

  const canPickStore = user.role !== 'store_manager';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      if (editing) {
        await updateCustomer(user!, editing.id, form);
        if (initialNote.trim()) await addNote(user!, editing.id, initialNote.trim());
      } else {
        const created = await createCustomer(user!, form);
        if (initialNote.trim()) await addNote(user!, created.id, initialNote.trim());
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'সেভ করা যায়নি।');
    }
  }

  function logWhatsAppContact() {
    setInitialNote(
      (prev) =>
        prev ||
        `WhatsApp-এ যোগাযোগ হয়েছে (${new Date().toLocaleString('bn-BD')})`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50">
      <div className="bg-white rounded-lg shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100">
          <h2 className="text-base font-semibold text-navy-900">
            {editing ? 'কাস্টমার সম্পাদনা' : 'নতুন কাস্টমার'}
          </h2>
          <button onClick={onClose} className="text-navy-500 hover:text-navy-800">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">নাম *</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">ফোন *</label>
              <input
                required
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">ঠিকানা</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">সোর্স</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              {data.settings.sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">পাইপলাইন</label>
              <select
                className="input"
                value={form.pipelineId}
                onChange={(e) => {
                  const p = data.pipelines.find((p) => p.id === e.target.value);
                  setForm({
                    ...form,
                    pipelineId: e.target.value,
                    currentStageId: p?.stages[0]?.id ?? '',
                  });
                }}
              >
                {data.pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">স্টেজ</label>
              <select
                className="input"
                value={form.currentStageId}
                onChange={(e) => setForm({ ...form, currentStageId: e.target.value })}
              >
                {stagesForPipeline.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">শাখা</label>
            <select
              className="input"
              value={form.storeId}
              onChange={(e) => setForm({ ...form, storeId: e.target.value })}
              disabled={!canPickStore}
            >
              {data.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">
                {editing ? 'নতুন নোট যোগ করুন (ঐচ্ছিক)' : 'প্রথম নোট (ঐচ্ছিক)'}
              </label>
              <button
                type="button"
                onClick={logWhatsAppContact}
                className="text-xs text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                <MessageCircle size={13} /> WhatsApp যোগাযোগ লগ করুন
              </button>
            </div>
            <textarea
              className="input min-h-[70px] resize-y"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="যেমন: বই সম্পর্কে জিজ্ঞাসা করেছেন…"
            />
            <p className="text-[11px] text-navy-500 mt-1">
              নোট সেভ হলে তারিখ, লেখক ও ক্রমিক নম্বর স্বয়ংক্রিয়ভাবে যুক্ত হবে।
            </p>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              বাতিল
            </button>
            <button type="submit" className="btn-primary">
              {editing ? 'সংরক্ষণ' : 'যোগ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
