import type { Pipeline, Stage } from '../types';
import { apiFetch } from './api';
import { dataStore, refreshPipelines } from './store';

export function getPipelines(): Pipeline[] {
  return dataStore.getPipelines();
}
export function getPipeline(id: string): Pipeline | undefined {
  return dataStore.getPipelines().find((p) => p.id === id);
}
export function getStage(pipelineId: string, stageId: string): Stage | undefined {
  return getPipeline(pipelineId)?.stages.find((s) => s.id === stageId);
}

/** Count helpers used by UI hints; server also enforces at delete time. */
export function countCustomersOnPipeline(pipelineId: string): number {
  return dataStore.getCustomers().filter((c) => c.pipelineId === pipelineId).length;
}
export function countCustomersOnStage(stageId: string): number {
  return dataStore.getCustomers().filter((c) => c.currentStageId === stageId).length;
}

export async function createPipeline(name: string): Promise<Pipeline> {
  const p = await apiFetch<Pipeline>('/api/pipelines', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  await refreshPipelines();
  return p;
}
export async function renamePipeline(pipelineId: string, name: string): Promise<void> {
  await apiFetch(`/api/pipelines/${encodeURIComponent(pipelineId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  await refreshPipelines();
}
export async function deletePipeline(pipelineId: string): Promise<void> {
  await apiFetch(`/api/pipelines/${encodeURIComponent(pipelineId)}`, { method: 'DELETE' });
  await refreshPipelines();
}

export async function addStage(pipelineId: string, name: string): Promise<Stage> {
  const s = await apiFetch<Stage>(
    `/api/pipelines/${encodeURIComponent(pipelineId)}/stages`,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
  await refreshPipelines();
  return s;
}
export async function renameStage(
  pipelineId: string,
  stageId: string,
  name: string,
): Promise<void> {
  await apiFetch(
    `/api/pipelines/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
    { method: 'PATCH', body: JSON.stringify({ name }) },
  );
  await refreshPipelines();
}
export async function deleteStage(pipelineId: string, stageId: string): Promise<void> {
  await apiFetch(
    `/api/pipelines/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
    { method: 'DELETE' },
  );
  await refreshPipelines();
}
export async function reorderStages(
  pipelineId: string,
  orderedIds: string[],
): Promise<void> {
  await apiFetch(`/api/pipelines/${encodeURIComponent(pipelineId)}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
  await refreshPipelines();
}
