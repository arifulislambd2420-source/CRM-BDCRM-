import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { GripVertical, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { getCustomers, moveCustomerStage } from '../services/customers';
import type { Customer, Stage } from '../types';
import { generateWhatsAppLink, toE164BD } from '../services/whatsapp';

export default function Pipeline() {
  const { user } = useAuth();
  const data = useData();
  const nav = useNavigate();
  const [pipelineId, setPipelineId] = useState(data.pipelines[0]?.id ?? '');
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!pipelineId && data.pipelines[0]) setPipelineId(data.pipelines[0].id);
  }, [data.pipelines, pipelineId]);
  const openDetail = (c: Customer) => nav(`/customers/${c.id}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const pipeline = data.pipelines.find((p) => p.id === pipelineId);
  const visible = useMemo(
    () => (user ? getCustomers(user) : []),
    [user, data.customers],
  );
  const inPipeline = useMemo(
    () => (pipeline ? visible.filter((c) => c.pipelineId === pipeline.id) : []),
    [visible, pipeline],
  );

  if (!user) return null;

  async function moveTo(customerId: string, toStageId: string) {
    try {
      await moveCustomerStage(user!, customerId, pipelineId, toStageId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'সরানো যায়নি।');
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const stageId = String(over.id);
    const customerId = String(active.id);
    const customer = inPipeline.find((c) => c.id === customerId);
    if (!customer || customer.currentStageId === stageId) return;
    void moveTo(customerId, stageId);
  }

  const activeCustomer = activeId ? inPipeline.find((c) => c.id === activeId) : null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">পাইপলাইন</h1>
          <p className="text-sm text-navy-500 mt-1">
            কার্ড টেনে অন্য স্টেজে সরান, অথবা কার্ডের ভেতরের ড্রপডাউন থেকে বেছে নিন।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-navy-600">পাইপলাইন:</label>
          <select
            className="input w-auto"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            {data.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({visible.filter((c) => c.pipelineId === p.id).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!pipeline ? (
        <div className="card p-10 text-center text-navy-500">কোন পাইপলাইন নেই।</div>
      ) : pipeline.stages.length === 0 ? (
        <div className="card p-10 text-center text-navy-500">
          এই পাইপলাইনে এখনো কোন স্টেজ যোগ করা হয়নি। সেটিংস থেকে স্টেজ যোগ করুন।
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {pipeline.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                pipelineStages={pipeline.stages}
                customers={inPipeline.filter((c) => c.currentStageId === stage.id)}
                onOpen={openDetail}
                onMoveStage={(c, toId) => void moveTo(c.id, toId)}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCustomer && (
              <div className="w-72 rotate-1 opacity-95">
                <CardShell
                  customer={activeCustomer}
                  pipelineStages={pipeline.stages}
                  onOpen={() => {}}
                  onMoveStage={() => {}}
                  overlay
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

    </div>
  );
}

function KanbanColumn({
  stage,
  pipelineStages,
  customers,
  onOpen,
  onMoveStage,
}: {
  stage: Stage;
  pipelineStages: Stage[];
  customers: Customer[];
  onOpen: (c: Customer) => void;
  onMoveStage: (c: Customer, toStageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-72 rounded-lg border transition-colors ${
        isOver
          ? 'border-teal-400 bg-teal-50/60'
          : 'border-navy-200 bg-navy-50/40'
      } flex flex-col`}
    >
      <div className="px-3 py-2.5 border-b border-navy-100 flex items-center justify-between bg-white/70 rounded-t-lg">
        <div className="text-sm font-semibold text-navy-800 truncate">{stage.name}</div>
        <div className="text-xs text-navy-600 bg-white rounded-full px-2 py-0.5 border border-navy-100">
          {customers.length}
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {customers.length === 0 && (
          <div className="text-xs text-navy-400 text-center py-6">খালি</div>
        )}
        {customers.map((c) => (
          <DraggableCard
            key={c.id}
            customer={c}
            pipelineStages={pipelineStages}
            onOpen={onOpen}
            onMoveStage={onMoveStage}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  customer,
  pipelineStages,
  onOpen,
  onMoveStage,
}: {
  customer: Customer;
  pipelineStages: Stage[];
  onOpen: (c: Customer) => void;
  onMoveStage: (c: Customer, toStageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: customer.id,
  });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <CardShell
        customer={customer}
        pipelineStages={pipelineStages}
        onOpen={onOpen}
        onMoveStage={onMoveStage}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function CardShell({
  customer,
  pipelineStages,
  onOpen,
  onMoveStage,
  dragHandleProps,
  overlay,
}: {
  customer: Customer;
  pipelineStages: Stage[];
  onOpen: (c: Customer) => void;
  onMoveStage: (c: Customer, toStageId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const waLink = generateWhatsAppLink({
    storeNumber: toE164BD(customer.phone),
    message: `আসসালামু আলাইকুম ${customer.name}, আপনার সাথে যোগাযোগের জন্য।`,
    sourceTag: `crm-${customer.id}`,
  });
  return (
    <div
      className={`bg-white rounded-md border border-navy-100 ${
        overlay ? 'shadow-card' : 'shadow-soft'
      }`}
    >
      <div className="flex items-start gap-1 p-2.5">
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          className="cursor-grab active:cursor-grabbing text-navy-300 hover:text-navy-600 -m-1 p-1 shrink-0"
          aria-label="সরান"
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={() => onOpen(customer)}
          className="text-left flex-1 min-w-0"
        >
          <div className="text-sm font-medium text-navy-900 truncate">{customer.name}</div>
          <div className="text-xs text-navy-500 truncate">{customer.phone}</div>
        </button>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-teal-700 hover:bg-teal-50 rounded p-1 shrink-0"
          title="WhatsApp"
        >
          <MessageCircle size={13} />
        </a>
      </div>
      <div className="px-2.5 pb-2 flex items-center gap-1.5 flex-wrap">
        <span className="badge bg-navy-50 text-navy-700 border border-navy-100 text-[10px] px-1.5 py-0">
          {customer.source}
        </span>
        {customer.notes.length > 0 && (
          <span className="text-[10px] text-navy-500">{customer.notes.length} নোট</span>
        )}
      </div>
      <div className="px-2 pb-2">
        <select
          className="w-full text-xs bg-navy-50 border border-navy-100 rounded px-1.5 py-1 text-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-400"
          value={customer.currentStageId}
          onChange={(e) => onMoveStage(customer, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="স্টেজ পরিবর্তন"
          disabled={overlay}
        >
          {pipelineStages.map((s) => (
            <option key={s.id} value={s.id}>
              → {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
