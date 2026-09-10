import type { ChannelCostEntry, MrrChannelBreakdownItem, NewMrrEntry } from '../types';
import { markLocalChange } from './syncState';

const COSTS_STORAGE_KEY = 'canal_custos_v1';
const MRR_STORAGE_KEY = 'canal_novo_mrr_v1';

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
  try {
    localStorage.setItem(COSTS_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Erro ao salvar custos do canal no localStorage', e);
  }
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
  try {
    localStorage.setItem(MRR_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Erro ao salvar novo MRR no localStorage', e);
  }
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
