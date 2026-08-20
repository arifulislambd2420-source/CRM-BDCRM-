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
import type { Stage } from '../types';

type Tab = 'pipelines' | 'sources' | 'stores';

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
    <div className="card p-4 max-w-2xl">
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
