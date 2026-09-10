import { useState, useEffect, type FormEvent } from 'react';
import type { Referral, Partner, DealStatus, CommissionStatus, CommissionInstallment } from '../types';
import { evaluateMissingFields } from '../services/sheetsService';
import { ZORYA_PLANS, type PricingPlan, loadStoredPricingPlans } from '../data/plansData';
import { generateCommissionInstallments, calculateFirstInvoiceDueDate } from '../utils/commissionLogic';
import { formatCurrency, formatDateBR, normalizeDocument, formatDocument } from '../utils/analytics';
import { 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Users, 
  FileText, 
  Sparkles,
  Layers,
  Clock,
  ChevronDown
} from 'lucide-react';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (referral: Referral) => void;
  initialData?: Referral | null;
  partners: Partner[];
  pricingPlans?: PricingPlan[];
}

export default function ReferralModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  partners,
  pricingPlans
}: ReferralModalProps) {
  const plans = pricingPlans && pricingPlans.length > 0 ? pricingPlans : loadStoredPricingPlans();

  const [partnerId, setPartnerId] = useState('');
  const [idConexa, setIdConexa] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [referralDate, setReferralDate] = useState('');
  const [dealStatus, setDealStatus] = useState<DealStatus>('novo');
  
  // Plan & Pricing
  const [planId, setPlanId] = useState<string>('starter_1_14');
  const [planRecurrence, setPlanRecurrence] = useState<'mensal' | 'anual'>('mensal');
  const [planInstallments, setPlanInstallments] = useState<'1x' | '2x' | '3x'>('1x');
  
  const [mrrGross, setMrrGross] = useState<string>('149.90');
  const [discountPercent, setDiscountPercent] = useState<string>('10');
  const [discountValue, setDiscountValue] = useState<string>('14.99');
  const [mrrNet, setMrrNet] = useState<string>('134.91');
  const [dealValue, setDealValue] = useState<string>('134.91');
  const [grossDealValue, setGrossDealValue] = useState<string>('149.90');

  // Closure & Invoicing
  const [closeDate, setCloseDate] = useState('');
  const [invoiceDueDay, setInvoiceDueDay] = useState<number>(10);
  const [firstInvoiceDueDate, setFirstInvoiceDueDate] = useState<string>('');

  // Commissions
  const [commissionPercent, setCommissionPercent] = useState<string>('10');
  const [commissionValue, setCommissionValue] = useState<string>('300.00');
  const [commissionStatus, setCommissionStatus] = useState<CommissionStatus>('pendente_fechamento');
  const [commissionPaidDate, setCommissionPaidDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  // Existing installments if editing
  const [existingInstallments, setExistingInstallments] = useState<CommissionInstallment[]>([]);

  useEffect(() => {
    if (initialData) {
      setPartnerId(initialData.partnerId || (partners[0]?.id || ''));
      setClientName(initialData.clientName || '');
      setClientDocument(initialData.clientDocument ? formatDocument(initialData.clientDocument) : '');
      setClientCompany(initialData.clientCompany || '');
      setClientEmail(initialData.clientEmail || '');
      setClientPhone(initialData.clientPhone || '');
      setReferralDate(initialData.referralDate || '');
      setDealStatus(initialData.dealStatus || 'novo');
      setIdConexa(initialData.idConexa || '');
      setResponsiblePerson(initialData.responsiblePerson || '');
      
      setPlanId(initialData.planId || (plans[0]?.id || 'starter_1_14'));
      setPlanRecurrence(initialData.planRecurrence || 'mensal');
      setPlanInstallments(initialData.planInstallments || '1x');
      
      setMrrGross(initialData.mrrGross !== undefined ? initialData.mrrGross.toString() : (initialData.dealValue?.toString() || '149.90'));
      setDiscountPercent(initialData.discountPercent !== undefined ? initialData.discountPercent.toString() : '10');
      setDiscountValue(initialData.discountValue !== undefined ? initialData.discountValue.toString() : '14.99');
      setMrrNet(initialData.mrrNet !== undefined ? initialData.mrrNet.toString() : '134.91');
      setDealValue(initialData.dealValue !== undefined ? initialData.dealValue.toString() : '134.91');
      setGrossDealValue(initialData.grossDealValue !== undefined ? initialData.grossDealValue.toString() : '149.90');

      setCloseDate(initialData.closeDate || '');
      setInvoiceDueDay(initialData.invoiceDueDay || 10);
      setFirstInvoiceDueDate(initialData.firstInvoiceDueDate || '');

      setCommissionPercent(initialData.commissionPercent !== undefined ? initialData.commissionPercent.toString() : '10');
      setCommissionValue(initialData.commissionValue !== undefined ? initialData.commissionValue.toString() : '300.00');
      setCommissionStatus(initialData.commissionStatus || 'pendente_fechamento');
      setCommissionPaidDate(initialData.commissionPaidDate || '');
      setPaymentMethod(initialData.paymentMethod || '');
      setNotes(initialData.notes || '');
      setExistingInstallments(initialData.commissionInstallments || []);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setPartnerId(partners[0]?.id || '');
      setClientName('');
      setClientDocument('');
      setClientCompany('');
      setClientEmail('');
      setClientPhone('');
      setReferralDate(today);
      setDealStatus('novo');
      setIdConexa('');
      setResponsiblePerson('');
      
      // Default to Starter plan
      const defaultPlan = plans[0] || ZORYA_PLANS[0];
      setPlanId(defaultPlan.id);
      setPlanRecurrence('mensal');
      setPlanInstallments('1x');
      
      setMrrGross(defaultPlan.monthlyPrice.toFixed(2));
      setDiscountPercent('10');
      const disc = (defaultPlan.monthlyPrice * 0.1);
      setDiscountValue(disc.toFixed(2));
      setMrrNet((defaultPlan.monthlyPrice - disc).toFixed(2));
      setDealValue((defaultPlan.monthlyPrice - disc).toFixed(2));
      setGrossDealValue(defaultPlan.monthlyPrice.toFixed(2));

      setCloseDate('');
      setInvoiceDueDay(10);
      setFirstInvoiceDueDate(calculateFirstInvoiceDueDate(today, 10));

      setCommissionPercent('10');
      setCommissionValue(defaultPlan.commissionAmount.toFixed(2));
      setCommissionStatus('pendente_fechamento');
      setCommissionPaidDate('');
      setPaymentMethod('');
      setNotes('');
      setExistingInstallments([]);
    }
  }, [initialData, partners, isOpen]);

  // When plan changes, auto-populate standard values (MRR, Commission, Discounts)
  const applyPlanDefaults = (newPlanId: string, recurrence: 'mensal' | 'anual', installments: '1x' | '2x' | '3x') => {
    const plan = plans.find(p => p.id === newPlanId) || ZORYA_PLANS.find(p => p.id === newPlanId);
    if (!plan) return;

    // Rule: Default discount is 10% for monthly and 15% for annual (regardless of installments!)
    const discPct = recurrence === 'anual' ? 15 : 10;
    setDiscountPercent(discPct.toString());

    if (recurrence === 'mensal') {
      const grossMonthly = plan.monthlyPrice;
      const discVal = (grossMonthly * discPct) / 100;
      const netMonthly = grossMonthly - discVal;

      setMrrGross(grossMonthly.toFixed(2));
      setGrossDealValue(grossMonthly.toFixed(2));
      setDiscountValue(discVal.toFixed(2));
      setMrrNet(netMonthly.toFixed(2));
      setDealValue(netMonthly.toFixed(2));
    } else {
      // Anual
      const grossAnnual = plan.annualFullPrice;
      const discVal = (grossAnnual * discPct) / 100;
      const netAnnual = grossAnnual - discVal;
      const netMonthly = netAnnual / 12;

      setMrrGross(plan.monthlyPrice.toFixed(2));
      setGrossDealValue(grossAnnual.toFixed(2));
      setDiscountValue(discVal.toFixed(2));
      setMrrNet(netMonthly.toFixed(2));
      setDealValue(netAnnual.toFixed(2));
    }

    // Commission: fixed from plan table
    setCommissionValue(plan.commissionAmount.toFixed(2));
  };

  const handlePlanSelect = (newPlanId: string) => {
    setPlanId(newPlanId);
    applyPlanDefaults(newPlanId, planRecurrence, planInstallments);
  };

  const handleRecurrenceChange = (newRecurrence: 'mensal' | 'anual') => {
    setPlanRecurrence(newRecurrence);
    applyPlanDefaults(planId, newRecurrence, planInstallments);
  };

  const handleInstallmentsChange = (newInstallments: '1x' | '2x' | '3x') => {
    setPlanInstallments(newInstallments);
    applyPlanDefaults(planId, planRecurrence, newInstallments);
  };

  // Executive manual edits
  const handleDiscountPercentChange = (val: string) => {
    setDiscountPercent(val);
    const pct = parseFloat(val) || 0;
    const gross = parseFloat(grossDealValue) || 0;
    const discVal = (gross * pct) / 100;
    const net = gross - discVal;
    setDiscountValue(discVal.toFixed(2));
    setDealValue(net.toFixed(2));
    if (planRecurrence === 'anual') {
      setMrrNet((net / 12).toFixed(2));
    } else {
      setMrrNet(net.toFixed(2));
    }
  };

  const handleMrrNetChange = (val: string) => {
    setMrrNet(val);
    const mNet = parseFloat(val) || 0;
    if (planRecurrence === 'anual') {
      setDealValue((mNet * 12).toFixed(2));
    } else {
      setDealValue(mNet.toFixed(2));
    }
  };

  const handleDealStatusChange = (newStatus: DealStatus) => {
    setDealStatus(newStatus);
    if (newStatus === 'ganho') {
      const today = new Date().toISOString().slice(0, 10);
      if (!closeDate) {
        setCloseDate(today);
        setFirstInvoiceDueDate(calculateFirstInvoiceDueDate(today, invoiceDueDay));
      }
      if (commissionStatus === 'pendente_fechamento') {
        setCommissionStatus('a_pagar');
      }
    }
  };

  const handleCloseDateChange = (newDate: string) => {
    setCloseDate(newDate);
    if (newDate) {
      setFirstInvoiceDueDate(calculateFirstInvoiceDueDate(newDate, invoiceDueDay));
    }
  };

  const handleDueDayChange = (newDay: number) => {
    setInvoiceDueDay(newDay);
    const baseDate = closeDate || new Date().toISOString().slice(0, 10);
    setFirstInvoiceDueDate(calculateFirstInvoiceDueDate(baseDate, newDay));
  };

  // Preview generated installments if status is 'ganho'
  const activeFirstDueDate = firstInvoiceDueDate || (closeDate ? calculateFirstInvoiceDueDate(closeDate, invoiceDueDay) : '');
  const totalCommNum = parseFloat(commissionValue) || 0;
  
  const previewInstallments = dealStatus === 'ganho' && activeFirstDueDate && totalCommNum > 0
    ? generateCommissionInstallments(
        initialData?.id || 'temp',
        partnerId,
        partners.find(p => p.id === partnerId)?.name || '',
        clientName || 'Cliente',
        totalCommNum,
        planRecurrence,
        planInstallments,
        activeFirstDueDate
      )
    : [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert('Por favor, informe o nome do cliente indicado.');
      return;
    }

    const selectedPartner = partners.find(p => p.id === partnerId);
    const partnerName = selectedPartner ? selectedPartner.name : 'Parceiro Não Informado';

    const numDealValue = dealValue.trim() !== '' ? parseFloat(dealValue) : undefined;
    const numGrossValue = grossDealValue.trim() !== '' ? parseFloat(grossDealValue) : undefined;
    const numMrrGross = mrrGross.trim() !== '' ? parseFloat(mrrGross) : undefined;
    const numMrrNet = mrrNet.trim() !== '' ? parseFloat(mrrNet) : undefined;
    const numDiscountPercent = discountPercent.trim() !== '' ? parseFloat(discountPercent) : undefined;
    const numDiscountValue = discountValue.trim() !== '' ? parseFloat(discountValue) : undefined;
    
    const numCommPercent = commissionPercent.trim() !== '' ? parseFloat(commissionPercent) : undefined;
    const numCommValue = commissionValue.trim() !== '' ? parseFloat(commissionValue) : undefined;

    const refId = initialData ? initialData.id : 'ref-' + Math.random().toString(36).substring(2, 9);

    // Generate or preserve installments
    let finalInstallments: CommissionInstallment[] | undefined = undefined;
    if (dealStatus === 'ganho') {
      if (existingInstallments.length > 0) {
        // Parcelas já existentes podem ter NF/comprovante anexados — nunca regenerar
        // por aqui, mesmo que o cadastro tenha outros campos pendentes (ex: ID Conexa).
        finalInstallments = existingInstallments;
      } else if (activeFirstDueDate && numCommValue) {
        finalInstallments = generateCommissionInstallments(
          refId,
          partnerId,
          partnerName,
          clientName.trim(),
          numCommValue,
          planRecurrence,
          planInstallments,
          activeFirstDueDate
        );
      }
    }

    const baseReferral: Partial<Referral> = {
      id: refId,
      idConexa: idConexa.trim() || undefined,
      partnerId,
      partnerName,
      clientName: clientName.trim(),
      clientDocument: normalizeDocument(clientDocument) || undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      clientCompany: clientCompany.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      referralDate: referralDate || undefined,
      dealStatus,
      
      // Plans & Pricing
      planId,
      planRecurrence,
      planInstallments: planRecurrence === 'anual' ? planInstallments : undefined,
      mrrGross: numMrrGross,
      discountPercent: numDiscountPercent,
      discountValue: numDiscountValue,
      mrrNet: numMrrNet,
      dealValue: numDealValue,
      grossDealValue: numGrossValue,

      closeDate: closeDate || undefined,
      invoiceDueDay,
      firstInvoiceDueDate: activeFirstDueDate || undefined,

      commissionPercent: numCommPercent,
      commissionValue: numCommValue,
      commissionStatus,
      commissionPaidDate: commissionPaidDate || undefined,
      paymentMethod: paymentMethod || undefined,
      notes: notes.trim() || undefined,
      
      commissionInstallments: finalInstallments,

      // Ao salvar pelo formulário sempre há empresa/cliente (campo obrigatório):
      // completar um placeholder aqui o converte em cadastro real.
      isPlaceholder: false
    };

    const missingFields = evaluateMissingFields(baseReferral);
    const fullReferral: Referral = {
      ...(baseReferral as Referral),
      hasMissingData: missingFields.length > 0,
      missingFields
    };

    onSave(fullReferral);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl max-w-3xl w-full p-6 shadow-lg border border-zry-border my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zry-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zry-text">
                {initialData ? 'Editar Indicação & Contrato' : 'Registrar Nova Indicação'}
              </h3>
              <p className="text-xs text-zry-text-2">
                Tabela oficial de planos 2026, comissões em 3 etapas (1/3) e regras de desconto
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zry-text-2 hover:text-zry-text font-bold text-sm">✕</button>
        </div>

        {/* Placeholder completion banner (indicação registrada apenas como número) */}
        {initialData?.isPlaceholder && (
          <div className="mt-4 bg-zry-roxo text-zry-text-2 text-xs p-3 rounded-xl flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-zry-warning shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-zry-warning">Indicação sem empresa — complete o cadastro.</span>
              <p className="text-zry-text-2 mt-0.5">
                Esta indicação foi registrada apenas como número (backfill). Preencha a Razão Social / CNPJ e os
                demais dados do cliente para transformá-la em um cadastro completo, mantendo o histórico e a safra originais.
              </p>
            </div>
          </div>
        )}

        {/* Missing Data Warning if editing an incomplete record */}
        {!initialData?.isPlaceholder && initialData?.hasMissingData && initialData.missingFields && initialData.missingFields.length > 0 && (
          <div className="mt-4 bg-zry-warning-bg border border-zry-warning/30 text-zry-warning text-[12px] p-3.5 rounded-zry-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-zry-warning shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Campos pendentes identificados na planilha:</span>
              <ul className="list-disc list-inside mt-1 font-medium text-zry-warning">
                {initialData.missingFields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          
          {/* Section 1: Partner, Referral Date, ID Conexa, Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Parceiro Indicador *</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                {partners
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.company ? `(${p.company})` : ''}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Data da Indicação *</span>
                {!referralDate && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="date"
                value={referralDate}
                onChange={(e) => setReferralDate(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text focus:outline-none focus:border-zry-border-strong ${!referralDate ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>ID Conexa</span>
                {!idConexa && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: CX-IND-101"
                value={idConexa}
                onChange={(e) => setIdConexa(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text font-mono text-xs focus:outline-none focus:border-zry-border-strong ${!idConexa ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>
          </div>

          {/* Section 2: Client Info & Responsible Person */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Razão Social / Nome do Cliente Indicado *</span>
                {!clientName && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: Amanda Rocha ou Rocha Logística Ltda"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text focus:outline-none focus:border-zry-border-strong ${!clientName ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Pessoa Responsável (Executivo)</span>
                {!responsiblePerson && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: Mariana Ramos"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text focus:outline-none focus:border-zry-border-strong ${!responsiblePerson ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>CNPJ / CPF do Cliente Indicado *</span>
                {!clientDocument && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                value={clientDocument}
                onChange={(e) => setClientDocument(e.target.value)}
                onBlur={(e) => { const f = formatDocument(e.target.value); if (f !== '—') setClientDocument(f); }}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text font-mono text-xs focus:outline-none focus:border-zry-border-strong ${!clientDocument ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Empresa / Razão Social (se pessoa física)</label>
              <input
                type="text"
                placeholder="Ex: Rocha Logística Ltda"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">E-mail do Cliente</label>
              <input
                type="email"
                placeholder="cliente@empresa.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="(11) 99999-8888"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>
          </div>

          {/* Section 3: Plan & Financial Configuration (Tabela zorya. 2026) */}
          <div className="bg-zry-creme p-4 rounded-zry-lg border border-zry-border space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-zry-text flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-zry-info" />
                <span>Plano & Regras Comerciais (Tabela zorya. 2026)</span>
              </h4>
              <span className="text-[11px] bg-zry-info-bg text-zry-info px-2 py-0.5 rounded-md font-semibold">
                Preenchimento Automático
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Plan selector */}
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Plano Comercial Selecionado *</label>
                <select
                  value={planId}
                  onChange={(e) => handlePlanSelect(e.target.value)}
                  className="w-full bg-zry-surface border border-zry-border rounded-xl px-3 py-2 text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
                >
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Recorrência *</label>
                <div className="grid grid-cols-2 gap-1 bg-zry-lilas p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleRecurrenceChange('mensal')}
                    className={`py-2 rounded-full font-bold text-[12px] transition ${planRecurrence === 'mensal' ? 'bg-zry-surface text-zry-text' : 'text-zry-text-2 hover:text-zry-text'}`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecurrenceChange('anual')}
                    className={`py-2 rounded-full font-bold text-[12px] transition ${planRecurrence === 'anual' ? 'bg-zry-surface text-zry-text' : 'text-zry-text-2 hover:text-zry-text'}`}
                  >
                    Anual
                  </button>
                </div>
              </div>
            </div>

            {/* If Annual: Installment condition */}
            {planRecurrence === 'anual' && (
              <div className="bg-zry-info-bg/70 p-3 rounded-xl border border-zry-info/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-zry-info">Condição de Pagamento do Cliente (Anual):</span>
                  <p className="text-[11px] text-zry-info mt-0.5">
                    Benefício do programa: indicado mantém desconto de à vista (15%) mesmo parcelando em até 3x.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['1x', '2x', '3x'] as const).map(inst => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => handleInstallmentsChange(inst)}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition border ${
                        planInstallments === inst 
                          ? 'bg-zry-roxo text-white border-zry-info' 
                          : 'bg-zry-surface text-zry-text-2 border-zry-border hover:bg-zry-lilas-30'
                      }`}
                    >
                      {inst === '1x' ? 'À vista (1x)' : `Em ${inst}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Financial auto-filled editable inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zry-border">
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">MRR Bruto Tabela</label>
                <input
                  type="number"
                  step="0.01"
                  value={mrrGross}
                  onChange={(e) => setMrrGross(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                  % Desconto ({planRecurrence === 'anual' ? '15% padrão' : '10% padrão'})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={discountPercent}
                  onChange={(e) => handleDiscountPercentChange(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">MRR Líquido Final</label>
                <input
                  type="number"
                  step="0.01"
                  value={mrrNet}
                  onChange={(e) => handleMrrNetChange(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-roxo font-bold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              </div>
            </div>

            {/* Commission fixed value from table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zry-border">
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Valor Contratado Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
                <span className="text-[10px] text-zry-text-2">
                  {planRecurrence === 'anual' ? 'Total anual líquido com desconto' : 'Assinatura mensal líquida'}
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                  Comissão Fixa do Parceiro (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  className="w-full bg-zry-coral/15 border border-zry-coral/50 rounded-xl px-3 py-2 text-[13px] font-extrabold text-zry-roxo focus:outline-none focus:border-zry-coral transition"
                />
                <span className="text-[10px] text-zry-roxo">
                  Preenchido de acordo com o plano. Editável pelo executivo.
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Deal Status & Commission Release Schedule */}
          <div className="bg-zry-creme p-4 rounded-zry-lg border border-zry-border space-y-4">
            <h4 className="font-bold text-zry-text flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-zry-roxo" />
              <span>Status Comercial & Geração das Parcelas de Comissão</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Status Comercial *</label>
                <select
                  value={dealStatus}
                  onChange={(e) => handleDealStatusChange(e.target.value as DealStatus)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition focus:outline-none focus:border-zry-border-strong"
                >
                  <option value="novo">Novo Lead</option>
                  <option value="contato">Primeiro Contato</option>
                  <option value="qualificado">Qualificado</option>
                  <option value="negociacao">Em Negociação</option>
                  <option value="ganho">Ganho / Fechado</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>

              {dealStatus === 'ganho' && (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Data do Fechamento *</label>
                    <input
                      type="date"
                      value={closeDate}
                      onChange={(e) => handleCloseDateChange(e.target.value)}
                      required
                      className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition focus:outline-none focus:border-zry-border-strong"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                      Dia de Vencimento da Fatura (Cliente) *
                    </label>
                    <select
                      value={invoiceDueDay}
                      onChange={(e) => handleDueDayChange(parseInt(e.target.value, 10))}
                      className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition focus:outline-none focus:border-zry-border-strong"
                    >
                      {[5, 10, 15, 20, 25, 28].map(day => (
                        <option key={day} value={day}>Todo dia {day}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Generated Installments Live Preview when closed */}
            {dealStatus === 'ganho' && previewInstallments.length > 0 && (
              <div className="bg-zry-coral/10 border border-zry-coral/40 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zry-roxo font-bold">
                    <Sparkles className="w-4 h-4 text-zry-roxo" />
                    <span>Cronograma de Liberação de Comissões (Regra 1/3 e Faturas)</span>
                  </div>
                  <span className="text-[11px] font-bold text-zry-roxo bg-zry-surface px-2 py-0.5 rounded-md border border-zry-coral/40">
                    Total: {formatCurrency(totalCommNum)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {previewInstallments.map((inst, idx) => (
                    <div key={idx} className="bg-zry-surface p-2.5 rounded-xl border border-zry-coral/40 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-zry-text">{inst.triggerDescription}</span>
                        <span className="font-extrabold text-zry-roxo">{formatCurrency(inst.value)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-zry-text-2">
                        <Calendar className="w-3 h-3 text-zry-text-2" />
                        <span>Liberação: <strong>{formatDateBR(inst.releaseDate)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-zry-roxo leading-relaxed">
                  {planRecurrence === 'mensal' 
                    ? '💡 No plano mensal, a comissão é liberada em 3 partes (1/3 cada) nas 1ª, 3ª e 5ª mensalidades do cliente.'
                    : `💡 No plano anual ${planInstallments}, o pagamento acompanha as parcelas do cliente conforme quitação.`}
                </p>
              </div>
            )}

            {/* Commission General Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zry-border">
              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Status Geral da Comissão</label>
                <select
                  value={commissionStatus}
                  onChange={(e) => setCommissionStatus(e.target.value as CommissionStatus)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition focus:outline-none focus:border-zry-border-strong"
                >
                  <option value="pendente_fechamento">Pendente Fechamento</option>
                  <option value="a_pagar">A Pagar (Em liquidação por parcelas)</option>
                  <option value="paga">Paga (100% Liquidada)</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Forma de Pagamento ao Parceiro</label>
                <input
                  type="text"
                  placeholder="Ex: Chave PIX CNPJ, Transferência PJ"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition focus:outline-none focus:border-zry-border-strong"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Notes */}
          <div>
            <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Observações & Histórico</label>
            <textarea
              rows={2}
              placeholder="Detalhes adicionais da negociação, condições especiais de fechamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zry-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-[12.5px] text-zry-text-2 hover:text-zry-text font-semibold rounded-full"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo rounded-full font-bold text-[12.5px] transition"
            >
              {initialData ? 'Salvar Alterações' : 'Cadastrar Indicação'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
