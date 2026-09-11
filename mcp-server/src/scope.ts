import type { FilterState, Partner, PeriodPreset, Referral } from '../../src/types';
import { filterReferrals } from '../../src/utils/analytics';
import type { Dataset } from './data';

// ---------------------------------------------------------------------------
// Recorte comum a várias ferramentas: período, parceiro e executivo.
//
// O filtro de período reusa filterReferrals/isDateInPeriod do app, então
// "trimestral" aqui significa exatamente o que significa na tela — e não uma
// segunda definição de trimestre que ninguém consegue reconciliar depois.
// ---------------------------------------------------------------------------

export interface ScopeArgs {
  periodo?: PeriodPreset;
  mes?: string;
  trimestre?: number;
  ano?: number;
  inicio?: string;
  fim?: string;
  parceiro_id?: string;
  executivo?: string;
}

export interface Scope {
  partners: Partner[];
  referrals: Referral[];
  descricao: string;
}

function descreverPeriodo(a: ScopeArgs): string {
  switch (a.periodo) {
    case undefined:
    case 'all':
      return 'todo o histórico';
    case 'mensal':
      return `mês ${a.mes ?? '(não informado)'}`;
    case 'trimestral':
      return `${a.trimestre ?? '?'}º trimestre de ${a.ano ?? '?'}`;
    case 'anual':
      return `ano de ${a.ano ?? '?'}`;
    case 'custom':
      return `${a.inicio ?? '?'} a ${a.fim ?? '?'}`;
    default:
      return String(a.periodo);
  }
}

export function aplicarRecorte(dataset: Dataset, args: ScopeArgs): Scope {
  let partners = dataset.partners;

  if (args.executivo) {
    const alvo = args.executivo.trim().toLowerCase();
    partners = partners.filter(p => (p.accountOwner ?? '').trim().toLowerCase() === alvo);
  }
  if (args.parceiro_id) {
    partners = partners.filter(p => p.id === args.parceiro_id);
  }

  // Indicação sem parceiro correspondente não pode entrar num recorte por
  // executivo/parceiro: ela não pertence a essa carteira.
  const escopoPorParceiro = Boolean(args.executivo || args.parceiro_id);
  const idsVisiveis = new Set(partners.map(p => p.id));

  const filtro: FilterState = {
    period: {
      preset: args.periodo ?? 'all',
      selectedMonth: args.mes,
      selectedQuarter: args.trimestre,
      selectedYear: args.ano,
      startDate: args.inicio,
      endDate: args.fim
    },
    partnerId: 'all',
    dealStatus: 'all',
    commissionStatus: 'all',
    onlyMissingData: false,
    searchQuery: ''
  };

  let referrals = filterReferrals(dataset.referrals, filtro);
  if (escopoPorParceiro) referrals = referrals.filter(r => idsVisiveis.has(r.partnerId));

  const partes = [descreverPeriodo(args)];
  if (args.executivo) partes.push(`carteira de ${args.executivo}`);
  if (args.parceiro_id) partes.push(`parceiro ${args.parceiro_id}`);

  return { partners, referrals, descricao: partes.join(', ') };
}
