import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Pencil, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { getCustomer, updateCustomer } from '../services/customers';
import { addNote, canModifyNote, deleteNote, updateNote } from '../services/notes';
import { generateWhatsAppLink, toE164BD } from '../services/whatsapp';
import type { Customer, Note } from '../types';

function formatDT(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface InfoDraft {
  name: string;
  phone: string;
  address: string;
  source: string;
  storeId: string;
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const data = useData();
  const [noteText, setNoteText] = useState('');
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [infoDraft, setInfoDraft] = useState<InfoDraft | null>(null);

  const customer = user && id ? getCustomer(user, id) : undefined;

  const sortedNotes = useMemo<Note[]>(
    () =>
      customer
        ? [...customer.notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [customer],
  );

  if (!user) return null;
  if (!customer) {
    return (
      <div className="card p-10 text-center">
        <div className="text-navy-600 mb-4">কাস্টমার পাওয়া যায়নি।</div>
        <Link to="/customers" className="btn-outline">
          <ArrowLeft size={14} /> তালিকায় ফিরুন
        </Link>
      </div>
    );
  }

  const pipeline = data.pipelines.find((p) => p.id === customer.pipelineId);
  const store = data.stores.find((s) => s.id === customer.storeId);
  const editingInfo = infoDraft !== null;

  function startEditInfo(c: Customer) {
    setInfoDraft({
      name: c.name,
      phone: c.phone,
      address: c.address,
      source: c.source,
      storeId: c.storeId,
    });
  }
  function cancelEditInfo() {
    setInfoDraft(null);
  }
  async function saveInfo() {
    if (!infoDraft || !customer) return;
    try {
      await updateCustomer(user!, customer.id, infoDraft);
      setInfoDraft(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'সংরক্ষণ ব্যর্থ।');
    }
  }

  async function onPipelineChange(pipelineId: string) {
    const p = data.pipelines.find((p) => p.id === pipelineId);
    const first = p?.stages[0]?.id ?? '';
    try {
      await updateCustomer(user!, customer!.id, {
        pipelineId,
        currentStageId: first,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'পরিবর্তন ব্যর্থ।');
    }
  }
  async function onStageChange(stageId: string) {
    try {
      await updateCustomer(user!, customer!.id, { currentStageId: stageId });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'পরিবর্তন ব্যর্থ।');
    }
  }

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNoteErr(null);
    try {
      await addNote(user!, customer!.id, text);
      setNoteText('');
    } catch (e) {
      setNoteErr(e instanceof Error ? e.message : 'নোট যোগ করা যায়নি।');
    }
  }
  function startEditNote(n: Note) {
    setEditingNoteId(n.id);
    setEditingText(n.text);
  }
  async function saveEditNote() {
    if (!editingNoteId) return;
    try {
      await updateNote(user!, customer!.id, editingNoteId, editingText.trim());
      setEditingNoteId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'সম্পাদনা ব্যর্থ।');
    }
  }
  async function removeNote(noteId: string) {
    if (!confirm('এই নোট মুছে ফেলবেন?')) return;
    try {
      await deleteNote(user!, customer!.id, noteId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মোছা যায়নি।');
    }
  }

  const waLink = generateWhatsAppLink({
    storeNumber: toE164BD(customer.phone),
    message: `আসসালামু আলাইকুম ${customer.name},`,
    sourceTag: `crm-${customer.id}`,
  });

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/customers"
          className="text-sm text-navy-600 hover:text-navy-800 inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> কাস্টমার তালিকায় ফিরুন
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — customer info + pipeline */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {editingInfo ? (
                  <input
                    className="input text-lg font-semibold"
                    value={infoDraft!.name}
                    onChange={(e) =>
                      setInfoDraft({ ...infoDraft!, name: e.target.value })
                    }
                  />
                ) : (
                  <h1 className="text-xl font-semibold text-navy-900 truncate">
                    {customer.name}
                  </h1>
                )}
                {!editingInfo && (
                  <div className="text-sm text-navy-500 mt-0.5">{customer.phone}</div>
                )}
              </div>
              {!editingInfo ? (
                <button
                  onClick={() => startEditInfo(customer)}
                  className="btn-outline text-xs py-1 px-2 shrink-0"
                >
                  <Pencil size={12} /> সম্পাদনা
                </button>
              ) : (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={saveInfo}
                    className="btn-primary text-xs py-1 px-2"
                    title="সংরক্ষণ"
                  >
                    <Save size={12} />
                  </button>
                  <button
                    onClick={cancelEditInfo}
                    className="btn-outline text-xs py-1 px-2"
                    title="বাতিল"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {!editingInfo ? (
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow label="ঠিকানা" value={customer.address || '—'} />
                <InfoRow label="সোর্স" value={customer.source} />
                <InfoRow label="শাখা" value={store?.name ?? '—'} />
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full mt-2 text-teal-700 border-teal-200 hover:bg-teal-50"
                >
                  <MessageCircle size={14} /> WhatsApp-এ যোগাযোগ
                </a>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Field label="ফোন">
                  <input
                    className="input"
                    value={infoDraft!.phone}
                    onChange={(e) =>
                      setInfoDraft({ ...infoDraft!, phone: e.target.value })
                    }
                  />
                </Field>
                <Field label="ঠিকানা">
                  <input
                    className="input"
                    value={infoDraft!.address}
                    onChange={(e) =>
                      setInfoDraft({ ...infoDraft!, address: e.target.value })
                    }
                  />
                </Field>
                <Field label="সোর্স">
                  <select
                    className="input"
                    value={infoDraft!.source}
                    onChange={(e) =>
                      setInfoDraft({ ...infoDraft!, source: e.target.value })
                    }
                  >
                    {data.settings.sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="শাখা">
                  <select
                    className="input"
                    value={infoDraft!.storeId}
                    onChange={(e) =>
                      setInfoDraft({ ...infoDraft!, storeId: e.target.value })
                    }
                    disabled={user.role === 'store_manager'}
                  >
                    {data.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-800 mb-3">
              পাইপলাইন / স্টেজ
            </h2>
            <div className="space-y-3">
              <Field label="পাইপলাইন">
                <select
                  className="input"
                  value={customer.pipelineId}
                  onChange={(e) => onPipelineChange(e.target.value)}
                >
                  {data.pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="বর্তমান স্টেজ">
                <select
                  className="input"
                  value={customer.currentStageId}
                  onChange={(e) => onStageChange(e.target.value)}
                >
                  {(pipeline?.stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 text-xs text-navy-500">
              পাইপলাইন বদলালে স্টেজ প্রথমটিতে রিসেট হবে।
            </div>
          </div>
        </div>

        {/* Right column — notes timeline */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy-800">
                নোট টাইমলাইন
              </h2>
              <span className="text-xs text-navy-500">
                মোট {customer.notes.length} টি
              </span>
            </div>

            <form onSubmit={submitNote} className="mb-5">
              <textarea
                className="input min-h-[72px] resize-y"
                placeholder="নতুন নোট লিখুন…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              {noteErr && (
                <div className="text-xs text-red-600 mt-1">{noteErr}</div>
              )}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!noteText.trim()}
                >
                  নোট যোগ করুন
                </button>
              </div>
            </form>

            {sortedNotes.length === 0 ? (
              <div className="text-center text-sm text-navy-400 py-10">
                এখনো কোন নোট নেই। প্রথম নোট যোগ করুন।
              </div>
            ) : (
              <ol className="space-y-3">
                {sortedNotes.map((n) => {
                  const canEdit = canModifyNote(user, n);
                  const isEditing = editingNoteId === n.id;
                  return (
                    <li key={n.id} className="flex gap-3">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-semibold">
                        #{n.number}
                      </div>
                      <div className="flex-1 min-w-0 bg-navy-50/40 border border-navy-100 rounded-md p-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="text-xs text-navy-600 min-w-0">
                            <span className="font-medium text-navy-800">
                              {n.createdByName}
                            </span>
                            <span className="text-navy-400"> · {formatDT(n.createdAt)}</span>
                          </div>
                          {canEdit && !isEditing && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => startEditNote(n)}
                                className="p-1 rounded hover:bg-navy-100 text-navy-600"
                                title="সম্পাদনা"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => removeNote(n.id)}
                                className="p-1 rounded hover:bg-red-50 text-red-600"
                                title="মুছুন"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <div>
                            <textarea
                              className="input min-h-[60px] resize-y"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="btn-outline text-xs py-1 px-2"
                              >
                                বাতিল
                              </button>
                              <button
                                onClick={saveEditNote}
                                className="btn-primary text-xs py-1 px-2"
                                disabled={!editingText.trim()}
                              >
                                সংরক্ষণ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-navy-800 whitespace-pre-wrap">
                            {n.text}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-navy-500 mb-0.5">{label}</div>
      <div className="text-navy-800">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
