import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { deleteCustomer, getCustomers } from '../services/customers';
import type { Customer, Pipeline } from '../types';
import CustomerForm from '../components/CustomerForm';
import { generateWhatsAppLink, toE164BD } from '../services/whatsapp';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function stageName(pipelines: Pipeline[], pipelineId: string, stageId: string): string {
  const p = pipelines.find((p) => p.id === pipelineId);
  return p?.stages.find((s) => s.id === stageId)?.name ?? '—';
}

const stageBadge = (stage: string): string => {
  if (stage.includes('নতুন') || stage.includes('অ্যাড ক্লিক') || stage.includes('আবেদন'))
    return 'bg-navy-100 text-navy-800';
  if (stage.includes('কনফার্ম') || stage.includes('পেমেন্ট') || stage.includes('নিশ্চিত'))
    return 'bg-teal-100 text-teal-800';
  if (stage === 'ডেলিভারি সম্পন্ন') return 'bg-teal-100 text-teal-800';
  return 'bg-gold-100 text-gold-800';
};

export default function Customers() {
  const { user } = useAuth();
  const data = useData();
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  if (!user) return null;

  const visible = useMemo(() => getCustomers(user), [user, data.customers]);

  const stagesForPipeline = useMemo(
    () => data.pipelines.find((p) => p.id === pipelineId)?.stages ?? [],
    [data.pipelines, pipelineId],
  );

  const filtered = useMemo(() => {
    return visible.filter((c) => {
      if (source && c.source !== source) return false;
      if (pipelineId && c.pipelineId !== pipelineId) return false;
      if (stageId && c.currentStageId !== stageId) return false;
      if (storeId && c.storeId !== storeId) return false;
      if (from && c.createdAt < new Date(from).toISOString()) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (c.createdAt > end.toISOString()) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        if (!c.name.toLowerCase().includes(s) && !c.phone.includes(q)) return false;
      }
      return true;
    });
  }, [visible, source, pipelineId, stageId, storeId, from, to, q]);

  async function onDelete(c: Customer) {
    if (!confirm(`"${c.name}" মুছে ফেলবেন?`)) return;
    try {
      await deleteCustomer(user!, c.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  const canPickStore = user.role !== 'store_manager';
  const hasFilters = q || source || pipelineId || stageId || storeId || from || to;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">কাস্টমার</h1>
          <p className="text-sm text-navy-500 mt-1">
            মোট {filtered.length} টি {hasFilters ? 'ফিল্টার ফলাফল' : 'কাস্টমার'}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          <Plus size={16} /> নতুন কাস্টমার
        </button>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              className="input pl-9"
              placeholder="নাম বা ফোন দিয়ে খুঁজুন…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={pipelineId}
            onChange={(e) => {
              setPipelineId(e.target.value);
              setStageId('');
            }}
          >
            <option value="">সব পাইপলাইন</option>
            {data.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            disabled={!pipelineId}
          >
            <option value="">সব স্টেজ</option>
            {stagesForPipeline.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">সব সোর্স</option>
            {data.settings.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {canPickStore ? (
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">সব শাখা</option>
              {data.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <div />
          )}
          <div className="flex gap-2 lg:col-span-6">
            <input
              type="date"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              title="From"
            />
            <input
              type="date"
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              title="To"
            />
            {hasFilters && (
              <button
                className="btn-outline"
                onClick={() => {
                  setQ('');
                  setSource('');
                  setPipelineId('');
                  setStageId('');
                  setStoreId('');
                  setFrom('');
                  setTo('');
                }}
              >
                ফিল্টার ক্লিয়ার
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-navy-700">
              <tr>
                <th className="text-left font-medium px-4 py-3">নাম</th>
                <th className="text-left font-medium px-4 py-3">ফোন</th>
                <th className="text-left font-medium px-4 py-3">সোর্স</th>
                <th className="text-left font-medium px-4 py-3">পাইপলাইন / স্টেজ</th>
                <th className="text-left font-medium px-4 py-3">শাখা</th>
                <th className="text-left font-medium px-4 py-3">নোট</th>
                <th className="text-left font-medium px-4 py-3">যোগ করা</th>
                <th className="text-right font-medium px-4 py-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-navy-400">
                    কোন কাস্টমার পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const store = data.stores.find((s) => s.id === c.storeId);
                const pipeline = data.pipelines.find((p) => p.id === c.pipelineId);
                const stage = stageName(data.pipelines, c.pipelineId, c.currentStageId);
                const waLink = generateWhatsAppLink({
                  storeNumber: toE164BD(c.phone),
                  message: `আসসালামু আলাইকুম ${c.name}, আপনার সাথে যোগাযোগের জন্য।`,
                  sourceTag: `crm-${c.id}`,
                });
                return (
                  <tr key={c.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-medium text-navy-900 hover:text-navy-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.address && (
                        <div className="text-xs text-navy-500 truncate max-w-[200px]">
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-navy-700">{c.phone}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-navy-50 text-navy-700 border border-navy-100">
                        {c.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-navy-500">{pipeline?.name ?? '—'}</div>
                      <span className={`badge mt-1 ${stageBadge(stage)}`}>{stage}</span>
                    </td>
                    <td className="px-4 py-3 text-navy-700">{store?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-navy-600 text-xs">{c.notes.length} টি</td>
                    <td className="px-4 py-3 text-navy-500 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-teal-50 text-teal-700"
                          title="WhatsApp-এ যোগাযোগ"
                        >
                          <MessageCircle size={15} />
                        </a>
                        <button
                          onClick={() => {
                            setEditing(c);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-navy-100 text-navy-600"
                          title="সম্পাদনা"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-600"
                          title="মুছুন"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerForm open={showForm} onClose={() => setShowForm(false)} editing={editing} />
    </div>
  );
}
