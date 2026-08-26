import { useEffect, useState, type FormEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  addStage,
  createPipeline,
  deletePipeline,
  deleteStage,
  renamePipeline,
  renameStage,
  reorderStages,
} from '../services/pipelines';
import { updateSources } from '../services/settings';
import { createStore, deleteStore, updateStore } from '../services/stores';
import { apiFetch } from '../services/api';
import type { Stage } from '../types';

type Tab = 'pipelines' | 'sources' | 'stores' | 'integrations';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('pipelines');
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-navy-900">সেটিংস</h1>
        <p className="text-sm text-navy-500 mt-1">
          পাইপলাইন, কাস্টমার সোর্স ও শাখা ব্যবস্থাপনা।
        </p>
      </div>

      <div className="flex gap-1 border-b border-navy-200 mb-4 overflow-x-auto">
        {(
          [
            ['pipelines', 'পাইপলাইন'],
            ['sources', 'সোর্স'],
            ['stores', 'শাখা'],
            ['integrations', 'মেসেজিং ইন্টিগ্রেশন'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-navy-800 text-navy-900 font-medium'
                : 'border-transparent text-navy-500 hover:text-navy-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pipelines' && <PipelinesTab />}
      {tab === 'sources' && <SourcesTab />}
      {tab === 'stores' && <StoresTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pipelines tab                                                       */
/* ------------------------------------------------------------------ */

function PipelinesTab() {
  const data = useData();
  const [selectedId, setSelectedId] = useState(data.pipelines[0]?.id ?? '');
  useEffect(() => {
    if (!selectedId && data.pipelines[0]) setSelectedId(data.pipelines[0].id);
  }, [data.pipelines, selectedId]);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const selected = data.pipelines.find((p) => p.id === selectedId);

  async function submitNewPipeline(e: FormEvent) {
    e.preventDefault();
    const name = newPipelineName.trim();
    if (!name) return;
    try {
      const p = await createPipeline(name);
      setSelectedId(p.id);
      setNewPipelineName('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'তৈরি করা যায়নি।');
    }
  }
  function startRename(id: string, name: string) {
    setRenamingId(id);
    setRenameDraft(name);
  }
  async function saveRename() {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name) {
      try { await renamePipeline(renamingId, name); } catch (e) {
        alert(e instanceof Error ? e.message : 'নাম বদলানো যায়নি।');
      }
    }
    setRenamingId(null);
  }
  async function removePipeline(id: string, name: string) {
    if (!confirm(`"${name}" পাইপলাইন মুছে ফেলবেন?`)) return;
    try {
      await deletePipeline(id);
      if (selectedId === id) setSelectedId(data.pipelines[0]?.id ?? '');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-4 lg:col-span-1">
        <h2 className="text-sm font-semibold text-navy-800 mb-3">সব পাইপলাইন</h2>
        <ul className="space-y-1 mb-4">
          {data.pipelines.length === 0 && (
            <li className="text-sm text-navy-400 py-2">কোন পাইপলাইন নেই।</li>
          )}
          {data.pipelines.map((p) => {
            const active = p.id === selectedId;
            const isRenaming = renamingId === p.id;
            return (
              <li
                key={p.id}
                className={`rounded-md ${active ? 'bg-navy-100' : 'hover:bg-navy-50'}`}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1 p-1.5">
                    <input
                      className="input h-8 py-1 flex-1"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      autoFocus
                    />
                    <button className="p-1.5 text-teal-700 hover:bg-teal-50 rounded" onClick={saveRename} title="সংরক্ষণ">
                      <Save size={14} />
                    </button>
                    <button className="p-1.5 text-navy-500 hover:bg-navy-100 rounded" onClick={() => setRenamingId(null)} title="বাতিল">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 p-1.5">
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className="flex-1 text-left px-2 py-1 text-sm text-navy-800 min-w-0"
                    >
                      <div className="truncate">{p.name}</div>
                      <div className="text-[11px] text-navy-500">{p.stages.length} টি স্টেজ</div>
                    </button>
                    <button className="p-1.5 text-navy-500 hover:bg-navy-100 rounded" onClick={() => startRename(p.id, p.name)} title="নাম পরিবর্তন">
                      <Pencil size={13} />
                    </button>
                    <button className="p-1.5 text-red-600 hover:bg-red-50 rounded" onClick={() => removePipeline(p.id, p.name)} title="মুছুন">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <form onSubmit={submitNewPipeline} className="flex gap-2">
          <input
            className="input"
            placeholder="নতুন পাইপলাইনের নাম"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={!newPipelineName.trim()}>
            <Plus size={14} />
          </button>
        </form>
      </div>

      <div className="card p-4 lg:col-span-2">
        {!selected ? (
          <div className="text-center text-sm text-navy-400 py-10">
            একটি পাইপলাইন বেছে নিন।
          </div>
        ) : (
          <StagesEditor pipelineId={selected.id} stages={selected.stages} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stages editor (drag-and-drop + up/down click reorder)               */
/* ------------------------------------------------------------------ */

function StagesEditor({ pipelineId, stages }: { pipelineId: string; stages: Stage[] }) {
  const [newStageName, setNewStageName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(stages, oldIndex, newIndex);
    void reorderStages(pipelineId, reordered.map((s) => s.id));
  }

  function move(id: string, direction: -1 | 1) {
    const idx = stages.findIndex((s) => s.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= stages.length) return;
    const reordered = arrayMove(stages, idx, target);
    void reorderStages(pipelineId, reordered.map((s) => s.id));
  }

  async function submitNewStage(e: FormEvent) {
    e.preventDefault();
    const name = newStageName.trim();
    if (!name) return;
    try {
      await addStage(pipelineId, name);
      setNewStageName('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'যোগ করা যায়নি।');
    }
  }

  function startRename(id: string, name: string) {
    setRenamingId(id);
    setRenameDraft(name);
  }
  async function saveRename() {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name) {
      try { await renameStage(pipelineId, renamingId, name); } catch (e) {
        alert(e instanceof Error ? e.message : 'নাম বদলানো যায়নি।');
      }
    }
    setRenamingId(null);
  }
  async function removeStage(id: string, name: string) {
    if (!confirm(`স্টেজ "${name}" মুছে ফেলবেন?`)) return;
    try {
      await deleteStage(pipelineId, id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-navy-800 mb-1">স্টেজ তালিকা</h2>
      <p className="text-xs text-navy-500 mb-3">
        গ্রিপ আইকনে চেপে টেনে সাজান, অথবা তীর বাটন ব্যবহার করুন।
      </p>

      {stages.length === 0 ? (
        <div className="text-center text-sm text-navy-400 py-6 border border-dashed border-navy-200 rounded-md">
          কোন স্টেজ নেই।
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-1.5">
              {stages.map((stage, i) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  index={i}
                  total={stages.length}
                  renaming={renamingId === stage.id}
                  renameDraft={renameDraft}
                  onStartRename={() => startRename(stage.id, stage.name)}
                  onRenameChange={setRenameDraft}
                  onSaveRename={saveRename}
                  onCancelRename={() => setRenamingId(null)}
                  onMoveUp={() => move(stage.id, -1)}
                  onMoveDown={() => move(stage.id, 1)}
                  onDelete={() => removeStage(stage.id, stage.name)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <form onSubmit={submitNewStage} className="flex gap-2 mt-4">
        <input
          className="input"
          placeholder="নতুন স্টেজের নাম"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!newStageName.trim()}>
          <Plus size={14} /> স্টেজ যোগ
        </button>
      </form>
    </div>
  );
}

function SortableStageRow({
  stage,
  index,
  total,
  renaming,
  renameDraft,
  onStartRename,
  onRenameChange,
  onSaveRename,
  onCancelRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  stage: Stage;
  index: number;
  total: number;
  renaming: boolean;
  renameDraft: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 bg-white border border-navy-100 rounded-md px-1 py-1"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-navy-300 hover:text-navy-600 p-1"
        aria-label="সরান"
      >
        <GripVertical size={14} />
      </button>
      <div className="text-xs text-navy-500 w-6 text-center">{index + 1}.</div>
      {renaming ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            className="input h-8 py-1"
            value={renameDraft}
            onChange={(e) => onRenameChange(e.target.value)}
            autoFocus
          />
          <button
            className="p-1.5 text-teal-700 hover:bg-teal-50 rounded"
            onClick={onSaveRename}
            title="সংরক্ষণ"
          >
            <Save size={14} />
          </button>
          <button
            className="p-1.5 text-navy-500 hover:bg-navy-100 rounded"
            onClick={onCancelRename}
            title="বাতিল"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 text-sm text-navy-800 truncate">{stage.name}</div>
          <button
            className="p-1.5 text-navy-500 hover:bg-navy-100 rounded disabled:opacity-30"
            onClick={onMoveUp}
            disabled={index === 0}
            title="উপরে"
          >
            <ArrowUp size={13} />
          </button>
          <button
            className="p-1.5 text-navy-500 hover:bg-navy-100 rounded disabled:opacity-30"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="নিচে"
          >
            <ArrowDown size={13} />
          </button>
          <button
            className="p-1.5 text-navy-500 hover:bg-navy-100 rounded"
            onClick={onStartRename}
            title="নাম পরিবর্তন"
          >
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            onClick={onDelete}
            title="মুছুন"
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Sources tab                                                         */
/* ------------------------------------------------------------------ */

function SourcesTab() {
  const data = useData();
  const [newSource, setNewSource] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newSource.trim();
    if (!name) return;
    if (data.settings.sources.includes(name)) {
      alert('এই সোর্স ইতিমধ্যে আছে।');
      return;
    }
    try {
      await updateSources([...data.settings.sources, name]);
      setNewSource('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'যোগ করা যায়নি।');
    }
  }
  async function saveEdit() {
    if (editingIdx === null) return;
    const name = editDraft.trim();
    if (!name) return setEditingIdx(null);
    const next = data.settings.sources.slice();
    next[editingIdx] = name;
    try { await updateSources(next); } catch (e) {
      alert(e instanceof Error ? e.message : 'বদলানো যায়নি।');
    }
    setEditingIdx(null);
  }
  async function remove(idx: number) {
    const name = data.settings.sources[idx];
    if (!confirm(`"${name}" সোর্স মুছে ফেলবেন? পুরনো কাস্টমারদের সোর্স তালিকায় এটি দেখাবে না।`))
      return;
    try {
      await updateSources(data.settings.sources.filter((_, i) => i !== idx));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div className="card p-4 max-w-2xl">
      <h2 className="text-sm font-semibold text-navy-800 mb-1">কাস্টমার সোর্স</h2>
      <p className="text-xs text-navy-500 mb-3">
        কাস্টমার ফর্মের সোর্স ড্রপডাউনের অপশনগুলো এখানে ব্যবস্থাপনা করুন।
      </p>
      <ul className="space-y-1.5 mb-4">
        {data.settings.sources.length === 0 && (
          <li className="text-sm text-navy-400 py-2 text-center">কোন সোর্স নেই।</li>
        )}
        {data.settings.sources.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-1 bg-white border border-navy-100 rounded-md px-2 py-1"
          >
            {editingIdx === i ? (
              <>
                <input
                  className="input h-8 py-1 flex-1"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  autoFocus
                />
                <button className="p-1.5 text-teal-700 hover:bg-teal-50 rounded" onClick={saveEdit} title="সংরক্ষণ">
                  <Save size={14} />
                </button>
                <button className="p-1.5 text-navy-500 hover:bg-navy-100 rounded" onClick={() => setEditingIdx(null)} title="বাতিল">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 text-sm text-navy-800">{s}</div>
                <button
                  className="p-1.5 text-navy-500 hover:bg-navy-100 rounded"
                  onClick={() => {
                    setEditingIdx(i);
                    setEditDraft(s);
                  }}
                  title="নাম পরিবর্তন"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  onClick={() => remove(i)}
                  title="মুছুন"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="নতুন সোর্স"
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!newSource.trim()}>
          <Plus size={14} /> যোগ
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stores tab                                                          */
/* ------------------------------------------------------------------ */

function StoresTab() {
  const data = useData();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await createStore(name);
      setNewName('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'যোগ করা যায়নি।');
    }
  }
  async function saveEdit() {
    if (!editingId) return;
    const name = editDraft.trim();
    if (name) {
      try { await updateStore(editingId, { name }); } catch (e) {
        alert(e instanceof Error ? e.message : 'বদলানো যায়নি।');
      }
    }
    setEditingId(null);
  }
  async function remove(id: string, name: string) {
    if (!confirm(`"${name}" শাখা মুছে ফেলবেন? এই শাখার কাস্টমার/ম্যানেজারদের ম্যানুয়ালি অন্য শাখায় সরাতে হবে।`))
      return;
    try {
      await deleteStore(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div className="card p-4 max-w-2xl" id="stores-tab">
      <h2 className="text-sm font-semibold text-navy-800 mb-1">শাখা</h2>
      <p className="text-xs text-navy-500 mb-3">
        কাস্টমার ও শাখা ম্যানেজারদের শাখা এখানে ব্যবস্থাপনা করুন।
      </p>
      <ul className="space-y-1.5 mb-4">
        {data.stores.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-1 bg-white border border-navy-100 rounded-md px-2 py-1"
          >
            {editingId === s.id ? (
              <>
                <input
                  className="input h-8 py-1 flex-1"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  autoFocus
                />
                <button className="p-1.5 text-teal-700 hover:bg-teal-50 rounded" onClick={saveEdit} title="সংরক্ষণ">
                  <Save size={14} />
                </button>
                <button className="p-1.5 text-navy-500 hover:bg-navy-100 rounded" onClick={() => setEditingId(null)} title="বাতিল">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-navy-800 truncate">{s.name}</div>
                  <div className="text-[11px] text-navy-500">
                    {s.managerIds.length} জন ম্যানেজার
                  </div>
                </div>
                <button
                  className="p-1.5 text-navy-500 hover:bg-navy-100 rounded"
                  onClick={() => {
                    setEditingId(s.id);
                    setEditDraft(s.name);
                  }}
                  title="নাম পরিবর্তন"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                  onClick={() => remove(s.id, s.name)}
                  title="মুছুন"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="নতুন শাখার নাম"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!newName.trim()}>
          <Plus size={14} /> যোগ
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations tab — WhatsApp / Messenger accounts                    */
/* ------------------------------------------------------------------ */

interface IntegrationAccount {
  id: string;
  accountType: 'whatsapp' | 'messenger';
  label: string;
  active: boolean;
  wabaId: string;
  phoneNumberId: string;
  pageId: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  webhookVerifyToken: string;
  createdAt: string;
  updatedAt: string;
}

type IADraft = Omit<IntegrationAccount, 'id' | 'createdAt' | 'updatedAt'>;

const BLANK_DRAFT: IADraft = {
  accountType: 'whatsapp',
  label: '',
  active: true,
  wabaId: '',
  phoneNumberId: '',
  pageId: '',
  appId: '',
  appSecret: '',
  accessToken: '',
  webhookVerifyToken: '',
};

function IntegrationsTab() {
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id or 'new'
  const [draft, setDraft] = useState<IADraft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/integration-accounts');
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setDraft({ ...BLANK_DRAFT });
    setEditing('new');
    setShowToken(false);
  }

  function startEdit(acc: IntegrationAccount) {
    setDraft({
      accountType: acc.accountType,
      label: acc.label,
      active: acc.active,
      wabaId: acc.wabaId,
      phoneNumberId: acc.phoneNumberId,
      pageId: acc.pageId,
      appId: acc.appId,
      appSecret: '',  // never pre-fill secrets; user must re-enter to change
      accessToken: '',
      webhookVerifyToken: acc.webhookVerifyToken,
    });
    setEditing(acc.id);
    setShowToken(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.label.trim()) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await apiFetch('/api/integration-accounts', {
          method: 'POST',
          body: JSON.stringify(draft),
        });
        setAccounts((prev) => [...prev, created]);
      } else {
        const updated = await apiFetch(`/api/integration-accounts/${encodeURIComponent(editing!)}`, {
          method: 'PATCH',
          body: JSON.stringify(draft),
        });
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
      setEditing(null);
    } catch (err: any) {
      alert(err?.message ?? 'সংরক্ষণ ব্যর্থ।');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`"${label}" অ্যাকাউন্ট মুছে ফেলবেন? এই অ্যাকাউন্টের কথোপকথনগুলো থাকবে কিন্তু নতুন বার্তা আসবে না।`)) return;
    await apiFetch(`/api/integration-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  function field(key: keyof IADraft, value: string | boolean) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const isWA = draft.accountType === 'whatsapp';

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">মেসেজিং ইন্টিগ্রেশন</h2>
          <p className="text-xs text-navy-500 mt-0.5">
            WhatsApp Cloud API ও Facebook Messenger অ্যাকাউন্ট পরিচালনা করুন।
            একাধিক নম্বর বা পেজ যোগ করা যাবে।
          </p>
        </div>
        {editing === null && (
          <button className="btn-primary text-sm" onClick={startNew}>
            <Plus size={14} /> নতুন যোগ
          </button>
        )}
      </div>

      {/* Account form */}
      {editing !== null && (
        <div className="card p-5 border-2 border-teal-200">
          <h3 className="text-sm font-semibold text-navy-800 mb-4">
            {editing === 'new' ? 'নতুন ইন্টিগ্রেশন' : 'সম্পাদনা করুন'}
          </h3>
          <form onSubmit={save} className="space-y-3">
            {/* Type + Label row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-navy-600 mb-1">ধরন</label>
                <select
                  className="input"
                  value={draft.accountType}
                  onChange={(e) => field('accountType', e.target.value as 'whatsapp' | 'messenger')}
                  disabled={editing !== 'new'}
                >
                  <option value="whatsapp">WhatsApp Cloud API</option>
                  <option value="messenger">Facebook Messenger</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">লেবেল (নিজের জন্য)</label>
                <input
                  className="input"
                  value={draft.label}
                  onChange={(e) => field('label', e.target.value)}
                  placeholder="যেমন: মূল নম্বর"
                  required
                />
              </div>
            </div>

            {/* WhatsApp-specific fields */}
            {isWA && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-navy-600 mb-1">WABA ID</label>
                  <input
                    className="input font-mono text-xs"
                    value={draft.wabaId}
                    onChange={(e) => field('wabaId', e.target.value)}
                    placeholder="WhatsApp Business Account ID"
                  />
                </div>
                <div>
                  <label className="block text-xs text-navy-600 mb-1">Phone Number ID</label>
                  <input
                    className="input font-mono text-xs"
                    value={draft.phoneNumberId}
                    onChange={(e) => field('phoneNumberId', e.target.value)}
                    placeholder="Phone Number ID (Meta panel থেকে)"
                  />
                </div>
              </div>
            )}

            {/* Messenger-specific fields */}
            {!isWA && (
              <div>
                <label className="block text-xs text-navy-600 mb-1">Page ID</label>
                <input
                  className="input font-mono text-xs"
                  value={draft.pageId}
                  onChange={(e) => field('pageId', e.target.value)}
                  placeholder="Facebook Page ID"
                />
              </div>
            )}

            {/* Shared credential fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-navy-600 mb-1">App ID</label>
                <input
                  className="input font-mono text-xs"
                  value={draft.appId}
                  onChange={(e) => field('appId', e.target.value)}
                  placeholder="Meta App ID"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">
                  Webhook Verify Token{' '}
                  <span className="text-navy-400">(নিজে তৈরি করুন)</span>
                </label>
                <div className="relative">
                  <input
                    className="input font-mono text-xs pr-9"
                    type={showToken ? 'text' : 'password'}
                    value={draft.webhookVerifyToken}
                    onChange={(e) => field('webhookVerifyToken', e.target.value)}
                    placeholder="যেকোনো গোপন স্ট্রিং"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-navy-600 mb-1">
                Access Token{' '}
                <span className="text-navy-400">
                  {editing !== 'new' ? '(খালি রাখলে বদলাবে না)' : ''}
                </span>
              </label>
              <input
                className="input font-mono text-xs"
                type="password"
                value={draft.accessToken}
                onChange={(e) => field('accessToken', e.target.value)}
                placeholder={editing !== 'new' ? '••• পুরনো টোকেন বদলাতে এখানে দিন' : 'System User Access Token'}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs text-navy-600 mb-1">
                App Secret{' '}
                <span className="text-navy-400">
                  {editing !== 'new' ? '(খালি রাখলে বদলাবে না)' : '(ঐচ্ছিক)'}
                </span>
              </label>
              <input
                className="input font-mono text-xs"
                type="password"
                value={draft.appSecret}
                onChange={(e) => field('appSecret', e.target.value)}
                placeholder={editing !== 'new' ? '••• পুরনো App Secret বদলাতে এখানে দিন' : 'App Secret'}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ia-active"
                type="checkbox"
                checked={draft.active}
                onChange={(e) => field('active', e.target.checked)}
                className="h-4 w-4 rounded border-navy-300 text-teal-600"
              />
              <label htmlFor="ia-active" className="text-sm text-navy-700">
                সক্রিয় (নতুন বার্তা গ্রহণ করবে)
              </label>
            </div>

            {/* Webhook URL hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Meta-তে রেজিস্ট্রেশনের জন্য Webhook URL:</p>
              <p className="font-mono break-all">
                https://YOUR_DOMAIN/api/webhook/{draft.accountType}
              </p>
              <p>
                Verify Token হিসেবে উপরের <strong>Webhook Verify Token</strong> দিন।
                আপনার ডোমেইন নিশ্চিত করার পর পূর্ণ URL জানাবেন।
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary" disabled={saving || !draft.label.trim()}>
                <Save size={14} /> {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                <X size={14} /> বাতিল
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div className="text-sm text-navy-400 py-4">লোড হচ্ছে…</div>
      ) : accounts.length === 0 && editing === null ? (
        <div className="card p-6 text-center text-sm text-navy-400">
          কোনো ইন্টিগ্রেশন কনফিগার করা নেই।
          <br />
          <button className="mt-2 text-teal-600 hover:underline text-sm" onClick={startNew}>
            প্রথমটি যোগ করুন →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-navy-900">{acc.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      acc.accountType === 'whatsapp'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {acc.accountType === 'whatsapp' ? 'WhatsApp' : 'Messenger'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      acc.active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {acc.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-navy-500 space-y-0.5 font-mono">
                    {acc.phoneNumberId && <div>Phone Number ID: {acc.phoneNumberId}</div>}
                    {acc.wabaId && <div>WABA ID: {acc.wabaId}</div>}
                    {acc.pageId && <div>Page ID: {acc.pageId}</div>}
                    {acc.webhookVerifyToken && <div>Verify Token: ••••••</div>}
                    {acc.accessToken && <div>Access Token: ••••••</div>}
                  </div>
                  <div className="mt-2 text-xs text-navy-400 font-mono break-all">
                    Webhook: /api/webhook/{acc.accountType}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="p-1.5 text-navy-500 hover:bg-navy-100 rounded"
                    onClick={() => startEdit(acc)}
                    title="সম্পাদনা"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    onClick={() => remove(acc.id, acc.label)}
                    title="মুছুন"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
