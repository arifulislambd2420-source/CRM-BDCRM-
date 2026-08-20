import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { getCustomers } from '../services/customers';

const SOURCE_COLORS = ['#2f4a6f', '#c68729', '#328c76', '#5f7fa8', '#d69f3f', '#7fc8b3', '#8ba4c3'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
}

/** Heuristic: a customer counts as "confirmed" or "delivered" if the current stage name matches. */
function stageNameOf(
  pipelineId: string,
  stageId: string,
  pipelines: ReturnType<typeof useData>['pipelines'],
): string {
  const p = pipelines.find((p) => p.id === pipelineId);
  return p?.stages.find((s) => s.id === stageId)?.name ?? '—';
}

export default function Dashboard() {
  const { user } = useAuth();
  const data = useData();
  const [pipelineId, setPipelineId] = useState<string>(data.pipelines[0]?.id ?? '');
  useEffect(() => {
    // Adopt the first pipeline once data arrives from the API.
    if (!pipelineId && data.pipelines[0]) setPipelineId(data.pipelines[0].id);
  }, [data.pipelines, pipelineId]);
  if (!user) return null;

  const customers = useMemo(() => getCustomers(user), [user, data.customers]);

  const stageCounts = useMemo(() => {
    const p = data.pipelines.find((p) => p.id === pipelineId);
    if (!p) return [];
    const inPipeline = customers.filter((c) => c.pipelineId === pipelineId);
    return p.stages.map((s) => ({
      stage: s.name,
      count: inPipeline.filter((c) => c.currentStageId === s.id).length,
    }));
  }, [pipelineId, data.pipelines, customers]);

  const pipelineTotals = useMemo(
    () =>
      data.pipelines.map((p) => ({
        name: p.name,
        count: customers.filter((c) => c.pipelineId === p.id).length,
      })),
    [data.pipelines, customers],
  );

  const sourceCounts = useMemo(
    () =>
      data.settings.sources
        .map((s) => ({ source: s, count: customers.filter((c) => c.source === s).length }))
        .filter((r) => r.count > 0),
    [data.settings.sources, customers],
  );

  const total = customers.length;
  const confirmed = customers.filter((c) =>
    stageNameOf(c.pipelineId, c.currentStageId, data.pipelines).includes('কনফার্ম'),
  ).length;
  const delivered = customers.filter(
    (c) => stageNameOf(c.pipelineId, c.currentStageId, data.pipelines) === 'ডেলিভারি সম্পন্ন',
  ).length;
  const newLeads = customers.filter((c) => {
    const name = stageNameOf(c.pipelineId, c.currentStageId, data.pipelines);
    return name.includes('নতুন') || name.includes('অ্যাড ক্লিক') || name.includes('আবেদন');
  }).length;

  const recent = useMemo(
    () =>
      [...customers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6),
    [customers],
  );

  const perManager = useMemo(() => {
    if (user.role !== 'admin') return [];
    return data.users
      .filter((u) => u.role === 'store_manager')
      .map((m) => {
        const own = customers.filter((c) => c.createdById === m.id);
        return {
          name: m.name,
          store: data.stores.find((s) => s.id === m.storeId)?.name ?? '—',
          total: own.length,
          confirmed: own.filter((c) =>
            stageNameOf(c.pipelineId, c.currentStageId, data.pipelines).includes('কনফার্ম'),
          ).length,
          delivered: own.filter(
            (c) => stageNameOf(c.pipelineId, c.currentStageId, data.pipelines) === 'ডেলিভারি সম্পন্ন',
          ).length,
        };
      });
  }, [user.role, data.users, data.stores, data.pipelines, customers]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-navy-900">ড্যাশবোর্ড</h1>
        <p className="text-sm text-navy-500 mt-1">
          আসসালামু আলাইকুম, {user.name} — আপনার আজকের সংক্ষিপ্ত চিত্র।
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="মোট কাস্টমার" value={total} icon={<Users size={20} />} accent="navy" />
        <StatCard label="নতুন লিড" value={newLeads} icon={<Clock size={20} />} accent="gold" />
        <StatCard label="অর্ডার কনফার্ম" value={confirmed} icon={<TrendingUp size={20} />} accent="teal" />
        <StatCard label="ডেলিভারি সম্পন্ন" value={delivered} icon={<CheckCircle2 size={20} />} accent="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-navy-800">
              পাইপলাইন স্টেজ অনুযায়ী কাস্টমার
            </h2>
            <select
              className="input h-8 py-0 w-auto text-xs"
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
            >
              {data.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stageCounts} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <XAxis
                  dataKey="stage"
                  tick={{ fill: '#243a58', fontSize: 11 }}
                  interval={0}
                  height={40}
                />
                <YAxis allowDecimals={false} tick={{ fill: '#243a58', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: '#f2f5fa' }}
                  contentStyle={{ borderRadius: 6, border: '1px solid #dee6f0', fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#2f4a6f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-navy-800 mb-4">সোর্স অনুযায়ী</h2>
          <div className="h-64">
            {sourceCounts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-navy-400">
                কোন ডেটা নেই
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sourceCounts}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {sourceCounts.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: '1px solid #dee6f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-navy-800 mb-4">পাইপলাইন অনুযায়ী কাস্টমার</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart
                data={pipelineTotals}
                margin={{ top: 8, right: 12, left: -8, bottom: 8 }}
                layout="vertical"
              >
                <XAxis type="number" tick={{ fill: '#243a58', fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#243a58', fontSize: 11 }}
                  width={130}
                />
                <Tooltip
                  cursor={{ fill: '#f2f5fa' }}
                  contentStyle={{ borderRadius: 6, border: '1px solid #dee6f0', fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#328c76" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`card p-5 ${user.role === 'admin' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h2 className="text-sm font-semibold text-navy-800 mb-4">সাম্প্রতিক এন্ট্রি</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-navy-400">কোন কাস্টমার নেই।</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {recent.map((c) => {
                const store = data.stores.find((s) => s.id === c.storeId);
                const stage = stageNameOf(c.pipelineId, c.currentStageId, data.pipelines);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-navy-900 truncate">{c.name}</div>
                      <div className="text-xs text-navy-500 truncate">
                        {c.phone} · {store?.name ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge bg-navy-50 text-navy-700">{stage}</span>
                      <span className="text-xs text-navy-400">{formatDate(c.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {user.role === 'admin' && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-800 mb-4">শাখা ম্যানেজার পারফরম্যান্স</h2>
            {perManager.length === 0 ? (
              <p className="text-sm text-navy-400">কোন শাখা ম্যানেজার নেই।</p>
            ) : (
              <ul className="space-y-3">
                {perManager.map((m, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-navy-900 truncate">{m.name}</div>
                      <div className="text-xs text-navy-500">{m.total} টি</div>
                    </div>
                    <div className="text-xs text-navy-500 mb-1">{m.store}</div>
                    <div className="h-1.5 rounded-full bg-navy-100 overflow-hidden">
                      <div
                        className="h-full bg-teal-500"
                        style={{
                          width: `${
                            m.total ? Math.min(100, ((m.confirmed + m.delivered) / m.total) * 100) : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-navy-500 mt-1">
                      কনফার্ম {m.confirmed} · ডেলিভারি {m.delivered}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: 'navy' | 'gold' | 'teal';
}) {
  const bg =
    accent === 'gold'
      ? 'bg-gold-100 text-gold-700'
      : accent === 'teal'
        ? 'bg-teal-100 text-teal-700'
        : 'bg-navy-100 text-navy-700';
  return (
    <div className="stat-card flex items-center gap-4">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center ${bg}`}>{icon}</div>
      <div>
        <div className="text-xs text-navy-500">{label}</div>
        <div className="text-2xl font-semibold text-navy-900">{value}</div>
      </div>
    </div>
  );
}
