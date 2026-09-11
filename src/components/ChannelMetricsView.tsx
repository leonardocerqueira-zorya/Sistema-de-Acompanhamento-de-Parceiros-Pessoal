import { useMemo, useState } from 'react';
import type { Referral, ChannelCostEntry, NewMrrEntry, MrrChannelBreakdownItem } from '../types';
import {
  loadChannelCosts,
  upsertChannelCost,
  deleteChannelCost,
  loadNewMrrEntries,
  upsertNewMrrEntry,
  deleteNewMrrEntry
} from '../services/channelMetricsService';
import { calculateChannelPeriodMetrics, checkMrrDiscrepancy } from '../utils/channelMetrics';
import { formatCurrency } from '../utils/analytics';
import {
  Wallet,
  TrendingUp,
  Users,
  Info,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  Building2
} from 'lucide-react';

interface ChannelMetricsViewProps {
  referrals: Referral[];
  isMaster: boolean;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(m, 10) - 1;
  return idx >= 0 && idx < 12 ? `${names[idx]}/${y}` : period;
}

interface ChannelRowDraft {
  channel: string;
  value: string;
}

export default function ChannelMetricsView({ referrals, isMaster }: ChannelMetricsViewProps) {
  const [costs, setCosts] = useState<ChannelCostEntry[]>(() => loadChannelCosts());
  const [mrrEntries, setMrrEntries] = useState<NewMrrEntry[]>(() => loadNewMrrEntries());

  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod());

  const existingCost = costs.find(c => c.period === selectedPeriod);
  const existingMrr = mrrEntries.find(m => m.period === selectedPeriod);

  const [costInput, setCostInput] = useState<string>(existingCost ? String(existingCost.totalCost) : '');
  const [costNotes, setCostNotes] = useState<string>(existingCost?.notes || '');
  const [costSaved, setCostSaved] = useState(false);

  const [totalMrrInput, setTotalMrrInput] = useState<string>(existingMrr ? String(existingMrr.totalNewMrr) : '');
  const [totalDealsInput, setTotalDealsInput] = useState<string>(
    existingMrr?.totalNewDealsCount !== undefined ? String(existingMrr.totalNewDealsCount) : ''
  );
  const [otherChannelsDraft, setOtherChannelsDraft] = useState<ChannelRowDraft[]>(
    existingMrr && existingMrr.otherChannels.length > 0
      ? existingMrr.otherChannels.map(c => ({ channel: c.channel, value: String(c.value) }))
      : [{ channel: '', value: '' }]
  );
  const [mrrNotes, setMrrNotes] = useState<string>(existingMrr?.notes || '');
  const [mrrSaved, setMrrSaved] = useState(false);

  // Troca de mês: recarrega o formulário com o que já existe pra esse período (ou limpa).
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const c = costs.find(x => x.period === period);
    const m = mrrEntries.find(x => x.period === period);
    setCostInput(c ? String(c.totalCost) : '');
    setCostNotes(c?.notes || '');
    setTotalMrrInput(m ? String(m.totalNewMrr) : '');
    setTotalDealsInput(m?.totalNewDealsCount !== undefined ? String(m.totalNewDealsCount) : '');
    setOtherChannelsDraft(
      m && m.otherChannels.length > 0 ? m.otherChannels.map(x => ({ channel: x.channel, value: String(x.value) })) : [{ channel: '', value: '' }]
    );
    setMrrNotes(m?.notes || '');
    setCostSaved(false);
    setMrrSaved(false);
  };

  const handleSaveCost = () => {
    const value = parseFloat(costInput);
    if (isNaN(value) || value < 0) {
      alert('Informe um valor válido para o custo do canal.');
      return;
    }
    const updated = upsertChannelCost(selectedPeriod, value, costNotes);
    setCosts(updated);
    setCostSaved(true);
    setTimeout(() => setCostSaved(false), 2500);
  };

  const handleDeleteCost = () => {
    if (!existingCost) return;
    if (!window.confirm(`Remover o custo do canal informado para ${formatPeriodLabel(selectedPeriod)}?`)) return;
    setCosts(deleteChannelCost(existingCost.id));
    setCostInput('');
    setCostNotes('');
  };

  const handleSaveMrr = () => {
    const total = parseFloat(totalMrrInput);
    if (isNaN(total) || total < 0) {
      alert('Informe um valor válido para o novo MRR total.');
      return;
    }
    const dealsCount = totalDealsInput.trim() ? parseInt(totalDealsInput, 10) : undefined;
    if (dealsCount !== undefined && (isNaN(dealsCount) || dealsCount < 0)) {
      alert('Informe um número válido para o total de vendas (ou deixe em branco).');
      return;
    }
    const channels: MrrChannelBreakdownItem[] = otherChannelsDraft
      .filter(c => c.channel.trim())
      .map(c => ({ channel: c.channel.trim(), value: parseFloat(c.value) || 0 }));
    const updated = upsertNewMrrEntry(selectedPeriod, total, dealsCount, channels, mrrNotes);
    setMrrEntries(updated);
    setMrrSaved(true);
    setTimeout(() => setMrrSaved(false), 2500);
  };

  const handleDeleteMrr = () => {
    if (!existingMrr) return;
    if (!window.confirm(`Remover o novo MRR informado para ${formatPeriodLabel(selectedPeriod)}?`)) return;
    setMrrEntries(deleteNewMrrEntry(existingMrr.id));
    setTotalMrrInput('');
    setTotalDealsInput('');
    setOtherChannelsDraft([{ channel: '', value: '' }]);
  };

  const handleAddChannelRow = () => setOtherChannelsDraft(prev => [...prev, { channel: '', value: '' }]);
  const handleRemoveChannelRow = (idx: number) =>
    setOtherChannelsDraft(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const handleChannelRowChange = (idx: number, field: 'channel' | 'value', value: string) =>
    setOtherChannelsDraft(prev => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));

  // Métricas do mês selecionado a partir do que já foi SALVO.
  const metrics = useMemo(
    () => calculateChannelPeriodMetrics(selectedPeriod, referrals, costs, mrrEntries),
    [selectedPeriod, referrals, costs, mrrEntries]
  );

  // Prévia ao vivo da divergência de MRR com o que está sendo digitado agora,
  // antes mesmo de salvar — "se não bater deve informar" vale já na digitação.
  const liveDiscrepancy = useMemo(() => {
    if (!totalMrrInput.trim()) return null;
    const draft: NewMrrEntry = {
      id: 'draft',
      period: selectedPeriod,
      totalNewMrr: parseFloat(totalMrrInput) || 0,
      otherChannels: otherChannelsDraft
        .filter(c => c.channel.trim())
        .map(c => ({ channel: c.channel.trim(), value: parseFloat(c.value) || 0 })),
      updatedAt: ''
    };
    return checkMrrDiscrepancy(draft, referrals, selectedPeriod);
  }, [totalMrrInput, otherChannelsDraft, referrals, selectedPeriod]);

  // Histórico: união de todos os períodos com custo e/ou MRR informados.
  const historyPeriods = useMemo(() => {
    const set = new Set<string>([...costs.map(c => c.period), ...mrrEntries.map(m => m.period)]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [costs, mrrEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">Custos & MRR do Canal</h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            Dados mensais informados pelo financeiro — usados para calcular CAC, CAP e a relevância do canal no MRR novo da empresa.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-zry-lilas-30 rounded-full px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-zry-text-2">Mês de referência</span>
          <input
            type="month"
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="bg-transparent border-0 outline-none text-[13px] font-bold text-zry-roxo cursor-pointer"
          />
        </div>
      </div>

      {/* Formulários lado a lado: Custo do Canal / Novo MRR & Canais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Custo do Canal */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-zry-text">Custo do Canal — {formatPeriodLabel(selectedPeriod)}</h3>
              <p className="text-[11px] text-zry-text-2">Valor total informado pelo financeiro (não é só comissão)</p>
            </div>
          </div>

          {isMaster ? (
            <div className="p-[22px] space-y-3.5">
              <div className="bg-zry-lilas-30 rounded-xl p-3 text-[11.5px] text-zry-text-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-zry-roxo shrink-0 mt-0.5" />
                <span>
                  Inclua aqui o custo TOTAL do canal no mês: comissões pagas/a pagar, time interno, ferramentas e qualquer outro custo que o financeiro já consolidou. É esse número que entra no cálculo de CAC e CAP.
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Custo Total do Canal (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 18500.00"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text font-bold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Observações (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: inclui 1 headcount full-time + ferramentas"
                  value={costNotes}
                  onChange={(e) => setCostNotes(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {existingCost ? (
                  <button
                    onClick={handleDeleteCost}
                    className="text-[12px] font-semibold text-zry-danger hover:opacity-80 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                ) : <span />}
                <button
                  onClick={handleSaveCost}
                  className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-5 py-2.5 rounded-full text-[12.5px] transition"
                >
                  {costSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{costSaved ? 'Salvo!' : 'Salvar Custo do Mês'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-[22px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Valor informado</span>
              <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
                {existingCost ? formatCurrency(existingCost.totalCost) : 'Não informado ainda'}
              </div>
              {existingCost?.notes && <p className="text-[12px] text-zry-text-2 mt-2">{existingCost.notes}</p>}
              <p className="text-[11px] text-zry-text-2 mt-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Só o Master pode preencher ou alterar este valor.
              </p>
            </div>
          )}
        </div>

        {/* Novo MRR & Canais de Origem */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-zry-text">Novo MRR & Canais — {formatPeriodLabel(selectedPeriod)}</h3>
              <p className="text-[11px] text-zry-text-2">MRR novo total da empresa e de onde veio</p>
            </div>
          </div>

          {isMaster ? (
          <div className="p-[22px] space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Novo MRR Total da Empresa (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 42000.00"
                  value={totalMrrInput}
                  onChange={(e) => setTotalMrrInput(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text font-bold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Total de Vendas (nº, todos os canais)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Ex: 34"
                  value={totalDealsInput}
                  onChange={(e) => setTotalDealsInput(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text font-bold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
                <span className="text-[10px] text-zry-text-2 mt-1 block">Opcional — habilita o Ticket Médio Total da empresa</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12px] font-semibold text-zry-text">Outros Canais (tudo que NÃO é Parceiros)</label>
              </div>
              <div className="space-y-2">
                {otherChannelsDraft.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Outbound, Inbound, Ads..."
                      value={row.channel}
                      onChange={(e) => handleChannelRowChange(idx, 'channel', e.target.value)}
                      className="flex-1 bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="R$"
                      value={row.value}
                      onChange={(e) => handleChannelRowChange(idx, 'value', e.target.value)}
                      className="w-32 bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text text-right font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                    />
                    <button
                      onClick={() => handleRemoveChannelRow(idx)}
                      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-zry-text-2 hover:text-zry-danger hover:bg-zry-danger-bg transition"
                      title="Remover canal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddChannelRow}
                className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-zry-roxo hover:opacity-80"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar canal
              </button>
            </div>

            {/* Prévia ao vivo: MRR do canal de parceiros implícito */}
            {totalMrrInput.trim() && (
              <div className="bg-zry-lilas-30 rounded-xl p-3 flex items-center justify-between text-[12.5px]">
                <span className="text-zry-text-2">MRR do Canal de Parceiros (calculado = total − outros canais):</span>
                <span className="font-bold text-zry-roxo">
                  {formatCurrency((parseFloat(totalMrrInput) || 0) - otherChannelsDraft.reduce((s, c) => s + (parseFloat(c.value) || 0), 0))}
                </span>
              </div>
            )}

            {/* Diferença que é exatamente o desconto concedido: explicação, não alerta */}
            {liveDiscrepancy && liveDiscrepancy.explainedByDiscount && (
              <div className="bg-zry-lilas-30 border border-zry-border rounded-xl p-3 text-[12px] text-zry-text-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-zry-text">A diferença é o desconto concedido — não é erro.</span>
                  <p className="mt-0.5">
                    Você informou <strong>{formatCurrency(liveDiscrepancy.declared || 0)}</strong>, que é o MRR de tabela das indicações
                    fechadas em {formatPeriodLabel(selectedPeriod)}. Tirando{' '}
                    <strong>{formatCurrency(liveDiscrepancy.discountTotal)}</strong> de desconto, sobram{' '}
                    <strong>{formatCurrency(liveDiscrepancy.fromReferrals)}</strong> — e é esse líquido, o que o cliente paga de fato, que o
                    canal usa em todas as métricas. Se o financeiro também trabalha com o líquido, troque o valor informado.
                  </p>
                </div>
              </div>
            )}
            {/* Alerta de divergência ao vivo, contra as indicações fechadas */}
            {liveDiscrepancy && liveDiscrepancy.hasDiscrepancy && !liveDiscrepancy.explainedByDiscount && (
              <div className="bg-zry-warning-bg border border-zry-warning/30 rounded-xl p-3 text-[12px] text-zry-warning flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Não bate com as indicações fechadas no sistema.</span>
                  <p className="mt-0.5">
                    Você informou <strong>{formatCurrency(liveDiscrepancy.declared || 0)}</strong> pro canal de parceiros, mas as indicações
                    fechadas em {formatPeriodLabel(selectedPeriod)} somam <strong>{formatCurrency(liveDiscrepancy.fromReferrals)}</strong> de
                    novo MRR — diferença de <strong>{formatCurrency(Math.abs(liveDiscrepancy.diff || 0))}</strong>. Confira se todas as
                    indicações desse mês já estão com status "Ganho" e valor de MRR preenchido.
                  </p>
                  {liveDiscrepancy.discountTotal > 0.01 && (
                    <p className="mt-1 opacity-80">
                      O canal conta o MRR líquido: {formatCurrency(liveDiscrepancy.grossFromReferrals)} de tabela −{' '}
                      {formatCurrency(liveDiscrepancy.discountTotal)} de desconto = {formatCurrency(liveDiscrepancy.fromReferrals)}.
                    </p>
                  )}
                </div>
              </div>
            )}
            {liveDiscrepancy && !liveDiscrepancy.hasDiscrepancy && (
              <div className="bg-zry-positive-bg border border-zry-positive/20 rounded-xl p-3 text-[12px] text-zry-positive flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Bate com as indicações fechadas no sistema ({formatCurrency(liveDiscrepancy.fromReferrals)}
                  {liveDiscrepancy.discountTotal > 0.01 ? ', já líquido de desconto' : ''}).
                </span>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Observações (opcional)</label>
              <input
                type="text"
                placeholder="Ex: campanha de Ads rodou só na 2ª quinzena"
                value={mrrNotes}
                onChange={(e) => setMrrNotes(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {existingMrr ? (
                <button
                  onClick={handleDeleteMrr}
                  className="text-[12px] font-semibold text-zry-danger hover:opacity-80 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              ) : <span />}
              <button
                onClick={handleSaveMrr}
                className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-5 py-2.5 rounded-full text-[12.5px] transition"
              >
                {mrrSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{mrrSaved ? 'Salvo!' : 'Salvar MRR do Mês'}</span>
              </button>
            </div>
          </div>
          ) : (
            <div className="p-[22px] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Novo MRR Total</span>
                  <div className="text-[20px] font-bold text-zry-roxo tracking-tight mt-1">
                    {existingMrr ? formatCurrency(existingMrr.totalNewMrr) : 'Não informado ainda'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Total de Vendas</span>
                  <div className="text-[20px] font-bold text-zry-roxo tracking-tight mt-1">
                    {existingMrr?.totalNewDealsCount !== undefined ? existingMrr.totalNewDealsCount : '—'}
                  </div>
                </div>
              </div>

              {existingMrr && existingMrr.otherChannels.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block mb-1.5">Outros Canais</span>
                  <div className="space-y-1.5">
                    {existingMrr.otherChannels.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-zry-lilas-30 rounded-lg px-3 py-1.5 text-[12.5px]">
                        <span className="text-zry-text">{c.channel}</span>
                        <span className="font-semibold text-zry-roxo">{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingMrr?.notes && <p className="text-[12px] text-zry-text-2">{existingMrr.notes}</p>}

              <p className="text-[11px] text-zry-text-2 flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Só o Master pode preencher ou alterar estes valores.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Análise do Canal (sozinho) */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zry-roxo bg-zry-lilas-30 px-2.5 py-1 rounded-full">
            Análise do Canal
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-zry-text">Canal de Parceiros — {formatPeriodLabel(selectedPeriod)}</h3>
            <p className="text-[11px] text-zry-text-2 mt-0.5">
              {metrics.closedDealsCount} negócio(s) fechado(s) por {metrics.activePartnersCount} parceiro(s) neste mês, somando{' '}
              {formatCurrency(metrics.channelMrrFromReferrals)} de novo MRR (calculado a partir das indicações
              {metrics.discrepancy.discountTotal > 0.01
                ? `, já líquido: ${formatCurrency(metrics.discrepancy.grossFromReferrals)} de tabela − ${formatCurrency(
                    metrics.discrepancy.discountTotal
                  )} de desconto`
                : ''}).
            </p>
          </div>
        </div>

        <div className="p-[22px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CAC por Cliente */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">CAC por Cliente</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.cacPorCliente !== null ? formatCurrency(metrics.cacPorCliente) : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Custo do canal ÷ nº de negócios fechados no mês. Quanto custou, em média, cada cliente novo trazido pelo canal.
            </p>
          </div>

          {/* CAC por Novo MRR */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">CAC por Novo MRR</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.cacPorMrr !== null ? `${formatCurrency(metrics.cacPorMrr)} / R$1` : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Custo do canal ÷ novo MRR gerado no mês. Quanto custa gerar R$ 1,00 de MRR novo através do canal.
            </p>
          </div>

          {/* CAP */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">CAP</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.cap !== null ? formatCurrency(metrics.cap) : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Custo de Aquisição por Parceiro: custo do canal ÷ nº de parceiros que fecharam pelo menos 1 negócio no mês.
            </p>
          </div>

          {/* Ticket Médio do Canal */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Ticket Médio do Canal</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.ticketMedioCanal !== null ? formatCurrency(metrics.ticketMedioCanal) : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Novo MRR do canal ÷ nº de negócios fechados no canal. Valor médio de cada venda trazida por parceiros.
            </p>
          </div>
        </div>

        {!existingCost && (
          <div className="mx-[22px] mb-[22px] bg-zry-warning-bg border border-zry-warning/30 rounded-xl p-3 text-[12px] text-zry-warning flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>
              Sem custo do canal informado para {formatPeriodLabel(selectedPeriod)} — CAC e CAP ficam em branco até{' '}
              {isMaster ? 'você preencher' : 'o Master preencher'}.
            </span>
          </div>
        )}
      </div>

      {/* Canal vs Total da Empresa (comparação) */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zry-roxo bg-zry-coral/20 px-2.5 py-1 rounded-full">
            Canal vs Total
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-zry-text">Canal de Parceiros comparado com a Empresa Toda</h3>
            <p className="text-[11px] text-zry-text-2 mt-0.5">
              Precisa do Novo MRR Total e do Total de Vendas preenchidos acima para todos os números aparecerem.
            </p>
          </div>
        </div>

        <div className="p-[22px] grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Relevância no MRR */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Relevância no MRR Novo</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.channelRelevancePercent !== null ? `${metrics.channelRelevancePercent.toFixed(1)}%` : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              % do novo MRR total da empresa no mês que veio do canal de parceiros (calculado pelas indicações fechadas).
            </p>
          </div>

          {/* Ticket Médio Total da Empresa */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Ticket Médio Total (Empresa)</span>
            <div className="text-[22px] font-bold text-zry-roxo tracking-tight mt-1.5">
              {metrics.ticketMedioTotal !== null ? formatCurrency(metrics.ticketMedioTotal) : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Novo MRR total da empresa ÷ total de vendas informado (todos os canais).
            </p>
          </div>

          {/* Comparação de Ticket Médio */}
          <div className="bg-zry-lilas-30 rounded-zry-lg p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zry-text-2 block">Ticket do Canal vs Total</span>
            <div
              className={`text-[22px] font-bold tracking-tight mt-1.5 ${
                metrics.ticketMedioComparisonPercent === null
                  ? 'text-zry-roxo'
                  : metrics.ticketMedioComparisonPercent >= 0
                  ? 'text-zry-positive'
                  : 'text-zry-danger'
              }`}
            >
              {metrics.ticketMedioComparisonPercent !== null
                ? `${metrics.ticketMedioComparisonPercent >= 0 ? '+' : ''}${metrics.ticketMedioComparisonPercent.toFixed(1)}%`
                : '—'}
            </div>
            <p className="text-[11px] text-zry-text-2 mt-2 leading-relaxed">
              Quanto o ticket médio do canal está acima (+) ou abaixo (−) do ticket médio da empresa toda.
            </p>
          </div>
        </div>

        {(metrics.companyTotalNewMrr === null || metrics.totalNewDealsCount === null) && (
          <div className="mx-[22px] mb-[22px] bg-zry-warning-bg border border-zry-warning/30 rounded-xl p-3 text-[12px] text-zry-warning flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>
              {metrics.companyTotalNewMrr === null
                ? `Sem Novo MRR Total informado para este mês — ${isMaster ? 'preencha no formulário acima' : 'aguardando o Master preencher'}.`
                : `Sem Total de Vendas informado para este mês — o Ticket Médio Total e a comparação ficam em branco até ${isMaster ? 'você preencher' : 'o Master preencher'}.`}
            </span>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2">
          <Building2 className="w-4 h-4 text-zry-roxo" />
          <h3 className="text-[14px] font-bold text-zry-text">Histórico Mensal</h3>
        </div>

        {historyPeriods.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-zry-text-2">
            Nenhum mês preenchido ainda. Use o formulário acima para começar o histórico.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 border-b border-zry-border">
                  <th className="py-3 px-[22px]">Mês</th>
                  <th className="py-3 px-3 text-right">Custo do Canal</th>
                  <th className="py-3 px-3 text-center">Fechados</th>
                  <th className="py-3 px-3 text-right">CAC/Cliente</th>
                  <th className="py-3 px-3 text-right">CAP</th>
                  <th className="py-3 px-3 text-right">MRR do Canal (calc.)</th>
                  <th className="py-3 px-3 text-center">Conferência</th>
                  <th className="py-3 px-[22px] text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {historyPeriods.map(period => {
                  const m = calculateChannelPeriodMetrics(period, referrals, costs, mrrEntries);
                  return (
                    <tr key={period} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                      <td className="py-3.5 px-[22px] font-semibold text-zry-text">{formatPeriodLabel(period)}</td>
                      <td className="py-3.5 px-3 text-right text-zry-text-2">{m.cost !== null ? formatCurrency(m.cost) : '—'}</td>
                      <td className="py-3.5 px-3 text-center text-zry-text-2">{m.closedDealsCount}</td>
                      <td className="py-3.5 px-3 text-right text-zry-text-2">{m.cacPorCliente !== null ? formatCurrency(m.cacPorCliente) : '—'}</td>
                      <td className="py-3.5 px-3 text-right text-zry-text-2">{m.cap !== null ? formatCurrency(m.cap) : '—'}</td>
                      <td className="py-3.5 px-3 text-right text-zry-text-2">{formatCurrency(m.channelMrrFromReferrals)}</td>
                      <td className="py-3.5 px-3 text-center">
                        {!m.discrepancy.hasEntry ? (
                          <span className="text-zry-text-2">—</span>
                        ) : m.discrepancy.explainedByDiscount ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas-30 text-zry-roxo"
                            title={`O informado bate com o MRR de tabela; a diferença de ${formatCurrency(
                              Math.abs(m.discrepancy.diff || 0)
                            )} é o desconto concedido`}
                          >
                            <Info className="w-3 h-3" /> Só o desconto
                          </span>
                        ) : m.discrepancy.hasDiscrepancy ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning"
                            title={`Diferença de ${formatCurrency(Math.abs(m.discrepancy.diff || 0))}`}
                          >
                            <AlertTriangle className="w-3 h-3" /> Não bate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-[22px] text-center">
                        <button
                          onClick={() => handlePeriodChange(period)}
                          className="text-[12px] font-semibold text-zry-roxo hover:opacity-80"
                        >
                          {isMaster ? 'Ver / editar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
