import type { ChannelCostEntry, MrrChannelBreakdownItem, NewMrrEntry } from '../types';
import { markLocalChange, isTracking } from './syncState';
import { queueWrite, registerRowResolver, costToRow, mrrToRow } from './repository';

const COSTS_STORAGE_KEY = 'canal_custos_v1';
const MRR_STORAGE_KEY = 'canal_novo_mrr_v1';

// Envia ao banco só os registros que mudaram, um por linha (mesma ideia do
// storageService): o mês que o Master acabou de preencher não reescreve os
// outros meses nem o trabalho de outra pessoa.
function queueEntryDelta<T extends { id: string }>(
  table: 'channel_costs' | 'new_mrr_entries',
  previous: T[],
  next: T[],
  toRow: (item: T) => Record<string, unknown>
): void {
  if (!isTracking()) return;

  const previousRows = new Map<string, string>();
  for (const item of previous) {
    if (item?.id) previousRows.set(item.id, JSON.stringify(toRow(item)));
  }

  const nextIds = new Set<string>();
  for (const item of next) {
    if (!item?.id) continue;
    nextIds.add(item.id);
    if (previousRows.get(item.id) !== JSON.stringify(toRow(item))) {
      queueWrite(table, item.id, 'upsert');
    }
  }

  for (const id of previousRows.keys()) {
    if (!nextIds.has(id)) queueWrite(table, id, 'delete');
  }
}

// ---------------------------------------------------------------------------
// Custos do Canal (por mês)
// ---------------------------------------------------------------------------

export function loadChannelCosts(): ChannelCostEntry[] {
  try {
    const raw = localStorage.getItem(COSTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler custos do canal do localStorage', e);
  }
  return [];
}

export function saveChannelCosts(entries: ChannelCostEntry[]): void {
  const previous = loadChannelCosts();
  try {
    localStorage.setItem(COSTS_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Erro ao salvar custos do canal no localStorage', e);
  }
  queueEntryDelta('channel_costs', previous, entries, costToRow);
  markLocalChange();
}

// Cria ou atualiza (por período) o custo do canal informado pelo financeiro.
export function upsertChannelCost(period: string, totalCost: number, notes?: string): ChannelCostEntry[] {
  const current = loadChannelCosts();
  const existing = current.find(e => e.period === period);
  const now = new Date().toISOString();

  let updated: ChannelCostEntry[];
  if (existing) {
    updated = current.map(e =>
      e.period === period ? { ...e, totalCost, notes: notes?.trim() || undefined, updatedAt: now } : e
    );
  } else {
    updated = [
      ...current,
      { id: 'cost-' + Math.random().toString(36).substring(2, 9), period, totalCost, notes: notes?.trim() || undefined, updatedAt: now }
    ];
  }

  updated.sort((a, b) => b.period.localeCompare(a.period));
  saveChannelCosts(updated);
  return updated;
}

export function deleteChannelCost(id: string): ChannelCostEntry[] {
  const updated = loadChannelCosts().filter(e => e.id !== id);
  saveChannelCosts(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Novo MRR & Canais de Origem (por mês)
// ---------------------------------------------------------------------------

export function loadNewMrrEntries(): NewMrrEntry[] {
  try {
    const raw = localStorage.getItem(MRR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler novo MRR do localStorage', e);
  }
  return [];
}

export function saveNewMrrEntries(entries: NewMrrEntry[]): void {
  const previous = loadNewMrrEntries();
  try {
    localStorage.setItem(MRR_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Erro ao salvar novo MRR no localStorage', e);
  }
  queueEntryDelta('new_mrr_entries', previous, entries, mrrToRow);
  markLocalChange();
}

export function upsertNewMrrEntry(
  period: string,
  totalNewMrr: number,
  totalNewDealsCount: number | undefined,
  otherChannels: MrrChannelBreakdownItem[],
  notes?: string
): NewMrrEntry[] {
  const current = loadNewMrrEntries();
  const existing = current.find(e => e.period === period);
  const now = new Date().toISOString();
  const cleanChannels = otherChannels
    .map(c => ({ channel: c.channel.trim(), value: c.value || 0 }))
    .filter(c => c.channel.length > 0);

  let updated: NewMrrEntry[];
  if (existing) {
    updated = current.map(e =>
      e.period === period
        ? { ...e, totalNewMrr, totalNewDealsCount, otherChannels: cleanChannels, notes: notes?.trim() || undefined, updatedAt: now }
        : e
    );
  } else {
    updated = [
      ...current,
      {
        id: 'mrr-' + Math.random().toString(36).substring(2, 9),
        period,
        totalNewMrr,
        totalNewDealsCount,
        otherChannels: cleanChannels,
        notes: notes?.trim() || undefined,
        updatedAt: now
      }
    ];
  }

  updated.sort((a, b) => b.period.localeCompare(a.period));
  saveNewMrrEntries(updated);
  return updated;
}

export function deleteNewMrrEntry(id: string): NewMrrEntry[] {
  const updated = loadNewMrrEntries().filter(e => e.id !== id);
  saveNewMrrEntries(updated);
  return updated;
}

// Reenvio de pendência: o repositório guarda só o id, então relê o registro
// atual na hora de subir (uma edição posterior sobe já na versão final).
registerRowResolver('channel_costs', id => {
  const found = loadChannelCosts().find(e => e.id === id);
  return found ? costToRow(found) : null;
});

registerRowResolver('new_mrr_entries', id => {
  const found = loadNewMrrEntries().find(e => e.id === id);
  return found ? mrrToRow(found) : null;
});
