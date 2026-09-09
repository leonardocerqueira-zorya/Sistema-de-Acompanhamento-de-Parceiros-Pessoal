import React, { useState } from 'react';
import type { PricingPlan } from '../data/plansData';
import { 
  recalculatePlanValues, 
  resetStoredPricingPlans, 
  saveStoredPricingPlans, 
  loadStoredPricingPlans 
} from '../data/plansData';
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
  Percent
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
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Configuração de Planos & Valores de Comissão</h2>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Edite o MRR padrão e o valor fixo de comissão por indicação de cada plano. 
            Ao selecionar um plano no fechamento de negócio, os valores são auto-preenchidos com base nesta tabela.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Padrão
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm rounded-xl transition"
          >
            <Save className="w-4 h-4" />
            Salvar Alterações
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Tabela de planos e comissões atualizada com sucesso! Todas as novas indicações e simulações utilizarão os novos valores.
          </span>
        </div>
      )}

      {/* Rules Information Box */}
      <div className="bg-linear-to-r from-indigo-50/70 to-purple-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-indigo-900">Cálculo Automático em Tempo Real:</span>
          <p className="text-indigo-800 leading-relaxed">
            Ao alterar o <strong>MRR Mensal</strong> ou a <strong>Comissão Fixa</strong>, o sistema recalcula instantaneamente os preços com 10% de desconto mensal, 
            os valores de planos anuais (-15% à vista, -10% em 2x e -5% em 3x) e as parcelas liberadas para os parceiros indicadores (1/3 a cada 1ª, 3ª e 5ª mensalidade).
          </p>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Plano & Faixa</th>
                <th className="py-3.5 px-4 text-right">MRR Base (R$/mês)</th>
                <th className="py-3.5 px-4 text-right">Com 10% Desc.</th>
                <th className="py-3.5 px-4 text-right">Comissão Fixa (R$)</th>
                <th className="py-3.5 px-4 text-right">Liberado (1/3 Parcela)</th>
                <th className="py-3.5 px-4 text-right">Anual Cheio (12x)</th>
                <th className="py-3.5 px-4 text-right">Anual À Vista (-15%)</th>
                <th className="py-3.5 px-4 text-right">Anual 3x (-5%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {editablePlans.map((plan) => {
                const thirdInstallment = plan.commissionAmount / 3;
                const isEditing = activePlanEdit === plan.id;

                return (
                  <tr 
                    key={plan.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{plan.commercialName}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {plan.collaboratorsRange} colaboradores
                      </div>
                    </td>

                    {/* Editable MRR */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-slate-400 font-semibold">R$</span>
                        <input
                          type="number"
                          step="0.10"
                          value={plan.monthlyPrice}
                          onChange={(e) => handlePriceChange(plan.id, 'monthlyPrice', e.target.value)}
                          onFocus={() => setActivePlanEdit(plan.id)}
                          className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-right font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                        />
                      </div>
                    </td>

                    {/* Monthly with 10% discount */}
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                      {formatCurrency(plan.monthly10PercentDiscountPrice)}
                    </td>

                    {/* Editable Commission */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-slate-400 font-semibold">R$</span>
                        <input
                          type="number"
                          step="10.00"
                          value={plan.commissionAmount}
                          onChange={(e) => handlePriceChange(plan.id, 'commissionAmount', e.target.value)}
                          onFocus={() => setActivePlanEdit(plan.id)}
                          className="w-24 px-2 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-lg text-right font-bold text-emerald-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                    </td>

                    {/* Commission 1/3 portion */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        {formatCurrency(thirdInstallment)}
                      </span>
                    </td>

                    {/* Annual Full Price */}
                    <td className="py-3.5 px-4 text-right text-slate-500">
                      {formatCurrency(plan.annualFullPrice)}
                    </td>

                    {/* Annual Cash Price */}
                    <td className="py-3.5 px-4 text-right font-bold text-indigo-700">
                      {formatCurrency(plan.annualCashPrice)}
                    </td>

                    {/* Annual 3x Price */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      {formatCurrency(plan.annual3xPrice)}
                      <span className="text-[10px] text-slate-400 block">
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
    </div>
  );
}
