import { useState, type FormEvent } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createUser, deleteUser, updateUser } from '../services/users';
import type { Role, User } from '../types';

const roleLabels: Record<Role, string> = {
  admin: 'অ্যাডমিন',
  sub_admin: 'সাব-অ্যাডমিন',
  store_manager: 'শাখা ম্যানেজার',
};

export default function Users() {
  const { user: current } = useAuth();
  const data = useData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    role: Role;
    storeId?: string;
  } | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  if (!current) return null;

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditDraft({ role: u.role, storeId: u.storeId });
  }
  async function saveEdit(u: User) {
    if (!editDraft) return;
    const patch: Partial<User> = { role: editDraft.role };
    patch.storeId =
      editDraft.role === 'store_manager' ? editDraft.storeId ?? '' : undefined;
    try {
      await updateUser(u.id, patch);
      setEditingId(null);
      setEditDraft(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'সংরক্ষণ ব্যর্থ।');
    }
  }
  async function toggleNotes(u: User) {
    if (u.role === 'admin') return; // admins always can
    try {
      await updateUser(u.id, { canEditOwnNotes: !u.canEditOwnNotes });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'বদলানো যায়নি।');
    }
  }
  async function remove(u: User) {
    if (u.id === current!.id) {
      alert('নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না।');
      return;
    }
    if (u.role === 'admin') {
      alert('অ্যাডমিন অ্যাকাউন্ট মোছার আগে অন্য অ্যাডমিন থাকতে হবে।');
      return;
    }
    if (!confirm(`"${u.name}" ইউজার মুছে ফেলবেন?`)) return;
    try {
      await deleteUser(u.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">ইউজার ম্যানেজমেন্ট</h1>
          <p className="text-sm text-navy-500 mt-1">
            মোট {data.users.length} জন ইউজার। সাব-অ্যাডমিন ও শাখা ম্যানেজার যোগ করুন,
            শাখা অ্যাসাইন করুন, নোট এডিট অনুমতি নিয়ন্ত্রণ করুন।
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewForm((v) => !v)}>
          <Plus size={16} /> নতুন ইউজার
        </button>
      </div>

      {showNewForm && (
        <NewUserForm
          stores={data.stores}
          onClose={() => setShowNewForm(false)}
        />
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-navy-50 text-navy-700">
              <tr>
                <th className="text-left font-medium px-4 py-3">নাম</th>
                <th className="text-left font-medium px-4 py-3">ইমেইল</th>
                <th className="text-left font-medium px-4 py-3">রোল</th>
                <th className="text-left font-medium px-4 py-3">শাখা</th>
                <th className="text-left font-medium px-4 py-3">নিজের নোট এডিট</th>
                <th className="text-right font-medium px-4 py-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {data.users.map((u) => {
                const store = data.stores.find((s) => s.id === u.storeId);
                const isEditing = editingId === u.id;
                const isSelf = u.id === current.id;
                return (
                  <tr key={u.id} className="hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-900">{u.name}</div>
                      {isSelf && <div className="text-[11px] text-teal-700">(আপনি)</div>}
                    </td>
                    <td className="px-4 py-3 text-navy-700">{u.email}</td>
                    <td className="px-4 py-3">
                      {isEditing && !isSelf && u.role !== 'admin' ? (
                        <select
                          className="input h-8 py-1"
                          value={editDraft!.role}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft!, role: e.target.value as Role })
                          }
                        >
                          <option value="sub_admin">{roleLabels.sub_admin}</option>
                          <option value="store_manager">{roleLabels.store_manager}</option>
                        </select>
                      ) : (
                        <span
                          className={`badge ${
                            u.role === 'admin'
                              ? 'bg-gold-100 text-gold-800'
                              : u.role === 'sub_admin'
                                ? 'bg-navy-100 text-navy-800'
                                : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {roleLabels[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing && editDraft!.role === 'store_manager' ? (
                        <select
                          className="input h-8 py-1"
                          value={editDraft!.storeId ?? ''}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft!, storeId: e.target.value })
                          }
                        >
                          <option value="">— বেছে নিন —</option>
                          {data.stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-navy-700">
                          {u.role === 'store_manager' ? store?.name ?? '—' : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-navy-500">সবসময়</span>
                      ) : (
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!u.canEditOwnNotes}
                            onChange={() => toggleNotes(u)}
                            className="rounded border-navy-300"
                          />
                          <span className="text-xs text-navy-600">
                            {u.canEditOwnNotes ? 'অনুমতি আছে' : 'অনুমতি নেই'}
                          </span>
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              className="p-1.5 rounded text-teal-700 hover:bg-teal-50"
                              onClick={() => saveEdit(u)}
                              title="সংরক্ষণ"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              className="p-1.5 rounded text-navy-500 hover:bg-navy-100"
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(null);
                              }}
                              title="বাতিল"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {u.role !== 'admin' && (
                              <button
                                className="btn-outline text-xs py-1 px-2"
                                onClick={() => startEdit(u)}
                              >
                                সম্পাদনা
                              </button>
                            )}
                            {!isSelf && u.role !== 'admin' && (
                              <button
                                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                onClick={() => remove(u)}
                                title="মুছুন"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NewUserForm({
  stores,
  onClose,
}: {
  stores: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'sub_admin' | 'store_manager'>('store_manager');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [canEditOwnNotes, setCanEditOwnNotes] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        storeId: role === 'store_manager' ? storeId : undefined,
        canEditOwnNotes,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'তৈরি করা যায়নি।');
    }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-navy-800">নতুন ইউজার</h2>
        <button className="text-navy-500 hover:text-navy-800" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">নাম *</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">ইমেইল *</label>
          <input
            required
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">পাসওয়ার্ড *</label>
          <input
            required
            type="text"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="প্রথমিক পাসওয়ার্ড"
          />
        </div>
        <div>
          <label className="label">রোল</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as 'sub_admin' | 'store_manager')}
          >
            <option value="store_manager">{roleLabels.store_manager}</option>
            <option value="sub_admin">{roleLabels.sub_admin}</option>
          </select>
        </div>
        {role === 'store_manager' && (
          <div>
            <label className="label">শাখা *</label>
            <select
              className="input"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              required
            >
              {stores.length === 0 && <option value="">শাখা যোগ করুন প্রথমে</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={canEditOwnNotes}
              onChange={(e) => setCanEditOwnNotes(e.target.checked)}
              className="rounded border-navy-300"
            />
            <span className="text-sm text-navy-700">নিজের নোট এডিট করার অনুমতি</span>
          </label>
        </div>
        {err && (
          <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {err}
          </div>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline">
            বাতিল
          </button>
          <button type="submit" className="btn-primary">
            ইউজার তৈরি করুন
          </button>
        </div>
      </form>
    </div>
  );
}
