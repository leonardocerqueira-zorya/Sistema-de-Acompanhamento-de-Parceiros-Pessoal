import React, { useState } from 'react';
import type { PricingPlan } from '../data/plansData';
import {
  recalculatePlanValues,
  resetStoredPricingPlans,
  saveStoredPricingPlans,
  loadStoredPricingPlans
} from '../data/plansData';
import {
  loadStoredPartnerTiers,
  saveStoredPartnerTiers,
  resetStoredPartnerTiers
} from '../data/tiersData';
import { AMBASSADOR_ACTIVATION_BONUS_VALUE } from '../utils/commissionLogic';
import { formatCurrency } from '../utils/analytics';
import {
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  DollarSign,
  Sparkles,
  Layers,
  Percent,
  Award,
  Plus,
  Trash2
} from 'lucide-react';

interface PlanSettingsViewProps {
  plans?: PricingPlan[];
  onPlansUpdated?: (newPlans: PricingPlan[]) => void;
  onSavedPlansChange?: () => void;
}

export default function PlanSettingsView({ plans, onPlansUpdated, onSavedPlansChange }: PlanSettingsViewProps) {
  const [editablePlans, setEditablePlans] = useState<PricingPlan[]>(() => plans || loadStoredPricingPlans());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activePlanEdit, setActivePlanEdit] = useState<string | null>(null);

  const [editableTiers, setEditableTiers] = useState<string[]>(() => loadStoredPartnerTiers());
  const [newTierName, setNewTierName] = useState('');
  const [tiersSaved, setTiersSaved] = useState(false);

  const handleAddTier = () => {
    const name = newTierName.trim();
    if (!name || editableTiers.includes(name)) return;
    setEditableTiers(prev => [...prev, name]);
    setNewTierName('');
    setTiersSaved(false);
  };

  const handleRenameTier = (index: number, value: string) => {
    setEditableTiers(prev => prev.map((t, i) => (i === index ? value : t)));
    setTiersSaved(false);
  };

  const handleRemoveTier = (index: number) => {
    setEditableTiers(prev => prev.filter((_, i) => i !== index));
    setTiersSaved(false);
  };

  const handleSaveTiers = () => {
    const cleaned = editableTiers.map(t => t.trim()).filter(Boolean);
    saveStoredPartnerTiers(cleaned);
    setEditableTiers(cleaned);
    setTiersSaved(true);
    setTimeout(() => setTiersSaved(false), 3500);
  };

  const handleResetTiers = () => {
    if (confirm('Restaurar os tiers para o padrão (Parceiro Zorya, Growth, Estratégico, Embaixador Zorya)?')) {
      setEditableTiers(resetStoredPartnerTiers());
      setTiersSaved(false);
    }
  };

  const handlePriceChange = (planId: string, field: 'monthlyPrice' | 'commissionAmount', value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);

    setEditablePlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;

      const updatedMonthly = field === 'monthlyPrice' ? numValue : plan.monthlyPrice;
      const updatedCommission = field === 'commissionAmount' ? numValue : plan.commissionAmount;

      return recalculatePlanValues({
        ...plan,
        monthlyPrice: updatedMonthly,
        commissionAmount: updatedCommission
      });
    }));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    saveStoredPricingPlans(editablePlans);
    onPlansUpdated?.(editablePlans);
    onSavedPlansChange?.();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar todos os valores para a tabela oficial original zorya. 2026?')) {
      const defaults = resetStoredPricingPlans();
      setEditablePlans(defaults);
      onPlansUpdated?.(defaults);
      onSavedPlansChange?.();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Configuração de Planos &amp; Comissões
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            MRR padrão e comissão fixa por indicação — usados para auto-preencher o fechamento de negócio.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
          >
            <Save className="w-4 h-4" />
            Salvar Alterações
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-zry-positive-bg border border-zry-positive/30 text-zry-positive p-4 rounded-zry-lg flex items-center gap-2.5 text-[12.5px] animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-zry-positive shrink-0" />
          <span className="font-semibold">
            Tabela de planos e comissões atualizada com sucesso! Todas as novas indicações e simulações utilizarão os novos valores.
          </span>
        </div>
      )}

      {/* Rules Information Box */}
      <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 text-[12.5px] text-zry-text-2 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-zry-text">Cálculo Automático em Tempo Real:</span>
          <p className="leading-relaxed mt-1">
            Ao alterar o <strong className="text-zry-text">MRR Mensal</strong> ou a <strong className="text-zry-text">Comissão Fixa</strong>, o sistema recalcula instantaneamente os preços com 10% de desconto mensal,
            os valores de planos anuais (-15% à vista, -10% em 2x e -5% em 3x) e as parcelas liberadas para os parceiros indicadores (1/3 a cada 1ª, 3ª e 5ª mensalidade).
          </p>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm overflow-hidden">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
            <Sliders className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-zry-text leading-none">Tabela de Planos &amp; Valores de Comissão</h2>
            <p className="text-[12.5px] text-zry-text-2 mt-1.5">
              {editablePlans.length} planos configurados — edite o MRR base e a comissão fixa diretamente na tabela.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Plano &amp; Faixa</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">MRR Base (R$/mês)</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Com 10% Desc.</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Comissão Fixa (R$)</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Liberado (1/3 Parcela)</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Anual Cheio (12x)</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Anual À Vista (-15%)</th>
                <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Anual 3x (-5%)</th>
              </tr>
            </thead>
            <tbody>
              {editablePlans.map((plan) => {
                const thirdInstallment = plan.commissionAmount / 3;
                const isEditing = activePlanEdit === plan.id;

                return (
                  <tr
                    key={plan.id}
                    className="border-t border-zry-border hover:bg-zry-lilas-30 transition-colors"
                  >
                    <td className="py-3.5 px-[22px] text-[13px]">
                      <div className="font-bold text-zry-text text-[13px]">{plan.commercialName}</div>
                      <div className="text-[12px] text-zry-text-2 mt-0.5">
                        {plan.collaboratorsRange} colaboradores
                      </div>
                    </td>

                    {/* Editable MRR */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-zry-text-2 font-semibold text-[12px]">R$</span>
                        <input
                          type="number"
                          step="0.10"
                          value={plan.monthlyPrice}
                          onChange={(e) => handlePriceChange(plan.id, 'monthlyPrice', e.target.value)}
                          onFocus={() => setActivePlanEdit(plan.id)}
                          className="w-24 bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-1.5 text-right text-[13px] font-semibold text-zry-text focus:outline-none focus:border-zry-border-strong"
                        />
                      </div>
                    </td>

                    {/* Monthly with 10% discount */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right font-semibold text-zry-text">
                      {formatCurrency(plan.monthly10PercentDiscountPrice)}
                    </td>

                    {/* Editable Commission */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-zry-text-2 font-semibold text-[12px]">R$</span>
                        <input
                          type="number"
                          step="10.00"
                          value={plan.commissionAmount}
                          onChange={(e) => handlePriceChange(plan.id, 'commissionAmount', e.target.value)}
                          onFocus={() => setActivePlanEdit(plan.id)}
                          className="w-24 bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-1.5 text-right text-[13px] font-semibold text-zry-text focus:outline-none focus:border-zry-border-strong"
                        />
                      </div>
                    </td>

                    {/* Commission 1/3 portion */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive">
                        {formatCurrency(thirdInstallment)}
                      </span>
                    </td>

                    {/* Annual Full Price */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right text-zry-text-2">
                      {formatCurrency(plan.annualFullPrice)}
                    </td>

                    {/* Annual Cash Price */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right font-bold text-zry-text">
                      {formatCurrency(plan.annualCashPrice)}
                    </td>

                    {/* Annual 3x Price */}
                    <td className="py-3.5 px-[22px] text-[13px] text-right font-medium text-zry-text-2">
                      {formatCurrency(plan.annual3xPrice)}
                      <span className="text-[11px] text-zry-text-2 block mt-0.5">
                        (3x de {formatCurrency(plan.annual3xInstallment)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Tiers Editor */}
      <div className="bg-zry-surface rounded-3xl p-6 shadow-xs border border-zry-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-zry-warning-bg text-zry-warning rounded-xl">
                <Award className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-zry-text">Tiers de Parceiros</h2>
            </div>
            <p className="text-sm text-zry-text-2 max-w-2xl">
              Categorias exibidas no cadastro do parceiro. O tier <strong>Embaixador Zorya</strong> é só uma convenção de nome —
              o que realmente gera comissão de embaixador é o campo "Embaixador Associado" no cadastro de cada parceiro.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetTiers}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zry-text-2 hover:text-zry-text bg-zry-lilas-30 hover:bg-zry-lilas rounded-xl transition"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Padrão
            </button>
            <button
              type="button"
              onClick={handleSaveTiers}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zry-roxo hover:bg-zry-roxo shadow-sm rounded-xl transition"
            >
              <Save className="w-4 h-4" />
              Salvar Tiers
            </button>
          </div>
        </div>

        {tiersSaved && (
          <div className="bg-zry-positive-bg border border-zry-positive/30 text-zry-positive px-4 py-3 rounded-2xl flex items-center gap-3 text-sm shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-zry-positive shrink-0" />
            <span className="font-semibold">Tiers atualizados com sucesso!</span>
          </div>
        )}

        <div className="bg-zry-warning-bg/70 border border-zry-warning/30 rounded-2xl p-4 text-xs text-zry-warning flex items-start gap-3">
          <Info className="w-4 h-4 text-zry-warning shrink-0 mt-0.5" />
          <p>
            Bônus único de ativação do embaixador: <strong>{formatCurrency(AMBASSADOR_ACTIVATION_BONUS_VALUE)}</strong> por
            parceiro indicado, pago na primeira indicação fechada desse parceiro.
          </p>
        </div>

        <div className="space-y-2">
          {editableTiers.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={t}
                onChange={(e) => handleRenameTier(idx, e.target.value)}
                className="flex-1 px-3 py-2 bg-zry-lilas-30 border border-zry-border rounded-xl text-zry-text font-medium text-sm focus:bg-zry-surface focus:border-zry-roxo focus:ring-1 focus:ring-zry-roxo"
              />
              <button
                type="button"
                onClick={() => handleRemoveTier(idx)}
                className="p-2 text-zry-danger hover:text-zry-danger hover:bg-zry-danger-bg rounded-xl transition"
                title="Remover tier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-zry-border">
          <input
            type="text"
            placeholder="Novo tier..."
            value={newTierName}
            onChange={(e) => setNewTierName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTier(); } }}
            className="flex-1 px-3 py-2 bg-zry-lilas-30 border border-zry-border rounded-xl text-zry-text text-sm focus:bg-zry-surface focus:border-zry-roxo focus:ring-1 focus:ring-zry-roxo"
          />
          <button
            type="button"
            onClick={handleAddTier}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zry-info bg-zry-info-bg hover:bg-zry-info-bg rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
