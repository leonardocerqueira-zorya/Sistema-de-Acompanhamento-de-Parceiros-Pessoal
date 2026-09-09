import { useState, type ChangeEvent } from 'react';
import type { Referral, CommissionInstallment, AttachedDocument } from '../types';
import { formatCurrency, formatDateBR } from '../utils/analytics';
import { GOOGLE_DRIVE_CONFIG } from '../data/plansData';
import { 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Download, 
  Search, 
  Filter, 
  FileText, 
  ExternalLink, 
  Upload, 
  MessageSquare, 
  Copy, 
  Check, 
  FolderOpen, 
  Receipt,
  Sparkles,
  ShieldAlert,
  Eye,
  X
} from 'lucide-react';

interface CommissionsViewProps {
  referrals: Referral[];
  onUpdateInstallment: (
    referralId: string, 
    installmentId: string, 
    updates: Partial<CommissionInstallment>
  ) => void;
  onUpdateCommission: (referralId: string, updates: Partial<Referral>) => void;
  onEditReferral: (referral: Referral) => void;
}

export default function CommissionsView({
  referrals,
  onUpdateInstallment,
  onUpdateCommission,
  onEditReferral
}: CommissionsViewProps) {
  // Navigation tabs:
  // 1: a_liberar_mes (Comissões a Liberar no Mês)
  // 2: agendadas (Acompanhar Comissões Agendadas)
  // 3: historico_pagas (Histórico de Comissões Pagas)
  // 4: todas (Todas as Comissões & Contratos)
  const [activeTab, setActiveTab] = useState<'a_liberar_mes' | 'agendadas' | 'historico_pagas' | 'todas'>('a_liberar_mes');

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

  // Month selector for "a_liberar_mes"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [allMonthsFilter, setAllMonthsFilter] = useState<boolean>(false);

  // Modals
  const [notifyingInstallment, setNotifyingInstallment] = useState<{ referral: Referral; installment: CommissionInstallment } | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const [attachingInvoiceInstallment, setAttachingInvoiceInstallment] = useState<{ referral: Referral; installment: CommissionInstallment } | null>(null);
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [invoiceDriveUrl, setInvoiceDriveUrl] = useState('');
  const [invoiceScheduledDate, setInvoiceScheduledDate] = useState(todayStr);
  const [invoiceFileData, setInvoiceFileData] = useState<string>('');

  const [payingInstallment, setPayingInstallment] = useState<{ referral: Referral; installment: CommissionInstallment } | null>(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [receiptDriveUrl, setReceiptDriveUrl] = useState('');
  const [receiptPaidDate, setReceiptPaidDate] = useState(todayStr);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState('PIX');
  const [receiptFileData, setReceiptFileData] = useState<string>('');
  const [receiptNotes, setReceiptNotes] = useState('');

  // Document Viewer Modal
  const [viewingDoc, setViewingDoc] = useState<{ doc: AttachedDocument; title: string; folderUrl: string } | null>(null);

  // Inadimplência do Cliente: marca a parcela como não liberada (cancelada), com motivo.
  const [defaultingInstallment, setDefaultingInstallment] = useState<{ referral: Referral; installment: CommissionInstallment } | null>(null);
  const [defaultReason, setDefaultReason] = useState('Inadimplência do cliente');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all installments across all won referrals
  const wonReferrals = referrals.filter(r => r.dealStatus === 'ganho');

  interface FlatInstallment {
    installment: CommissionInstallment;
    referral: Referral;
  }

  const allFlatInstallments: FlatInstallment[] = [];
  wonReferrals.forEach(ref => {
    if (ref.commissionInstallments && ref.commissionInstallments.length > 0) {
      ref.commissionInstallments.forEach(inst => {
        allFlatInstallments.push({ installment: inst, referral: ref });
      });
    } else if (ref.commissionValue && ref.commissionValue > 0) {
      // Fallback single installment for legacy/unmigrated
      const inst: CommissionInstallment = {
        id: `legacy-${ref.id}`,
        referralId: ref.id,
        partnerId: ref.partnerId,
        partnerName: ref.partnerName,
        clientName: ref.clientName,
        installmentNumber: 1,
        totalInstallments: 1,
        triggerDescription: 'Comissão Única',
        value: ref.commissionValue,
        releaseDate: ref.closeDate || todayStr,
        status: ref.commissionStatus === 'paga' ? 'paga' : 'a_liberar',
        scheduledPaymentDate: ref.commissionPaidDate || undefined,
        paidDate: ref.commissionPaidDate || undefined,
        paymentMethod: ref.paymentMethod || undefined
      };
      allFlatInstallments.push({ installment: inst, referral: ref });
    }

    // Comissões do embaixador (parceiro que trouxe o parceiro indicador) — mesma
    // mecânica de liberação/NF/pagamento, só que pra outra pessoa e outro cronograma.
    if (ref.ambassadorCommissionInstallments && ref.ambassadorCommissionInstallments.length > 0) {
      ref.ambassadorCommissionInstallments.forEach(inst => {
        allFlatInstallments.push({ installment: inst, referral: ref });
      });
    }
  });

  // Calculate Alerts:
  // 1. Vencendo hoje: scheduledPaymentDate === todayStr and status === 'agendada'
  const dueTodayList = allFlatInstallments.filter(item => 
    item.installment.status === 'agendada' && 
    item.installment.scheduledPaymentDate === todayStr
  );

  // 2. Sendo liberadas hoje: releaseDate === todayStr and (status === 'a_liberar' or 'solicitada')
  const releasingTodayList = allFlatInstallments.filter(item => 
    item.installment.releaseDate === todayStr && 
    ['a_liberar', 'solicitada'].includes(item.installment.status)
  );

  // 3. Aguardando anexo de NF (notificadas ou já vencidas aguardando NF)
  const awaitingInvoiceList = allFlatInstallments.filter(item =>
    ['a_liberar', 'solicitada'].includes(item.installment.status) &&
    item.installment.releaseDate <= todayStr
  );

  // 4. Atrasadas: agendadas com data de pagamento já vencida e ainda sem comprovante (não quitadas)
  const overdueList = allFlatInstallments.filter(item =>
    item.installment.status === 'agendada' &&
    !!item.installment.scheduledPaymentDate &&
    item.installment.scheduledPaymentDate < todayStr &&
    !item.installment.receiptDoc
  );

  // Tab 1: Comissões a Liberar no Mês
  const toReleaseList = allFlatInstallments.filter(item => {
    if (!['a_liberar', 'solicitada'].includes(item.installment.status)) return false;
    if (allMonthsFilter) return true;
    return item.installment.releaseDate.startsWith(selectedMonth) || item.installment.releaseDate < selectedMonth;
  });

  // Tab 2: Comissões Agendadas
  const scheduledList = allFlatInstallments.filter(item => 
    item.installment.status === 'agendada'
  );

  // Tab 3: Histórico de Comissões Pagas
  const paidList = allFlatInstallments.filter(item => 
    item.installment.status === 'paga'
  );

  // Search filtering
  const filterBySearch = (list: FlatInstallment[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => 
      item.installment.partnerName.toLowerCase().includes(q) ||
      item.installment.clientName.toLowerCase().includes(q) ||
      item.installment.triggerDescription.toLowerCase().includes(q) ||
      (item.referral.clientCompany && item.referral.clientCompany.toLowerCase().includes(q))
    );
  };

  const filteredToRelease = filterBySearch(toReleaseList);
  const filteredScheduled = filterBySearch(scheduledList);
  const filteredPaid = filterBySearch(paidList);

  // Handlers for Notifying Partner
  const handleOpenNotifyModal = (item: FlatInstallment) => {
    setNotifyingInstallment(item);
    setCopiedMessage(false);
  };

  const getPartnerMessageText = () => {
    if (!notifyingInstallment) return '';
    const { installment, referral } = notifyingInstallment;
    return `Olá ${installment.partnerName}!\n\nA comissão referente à indicação do cliente *${installment.clientName}* (${installment.triggerDescription}) no valor de *${formatCurrency(installment.value)}* está disponível para liberação após quitação da fatura.\n\nPor favor, emita sua Nota Fiscal e nos envie para agendarmos o pagamento.\n\nObrigado pela parceria!`;
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(getPartnerMessageText());
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleConfirmPartnerNotified = () => {
    if (!notifyingInstallment) return;
    onUpdateInstallment(notifyingInstallment.referral.id, notifyingInstallment.installment.id, {
      status: 'solicitada',
      partnerNotified: true,
      partnerNotifiedDate: todayStr
    });
    setNotifyingInstallment(null);
  };

  // Handlers for Inadimplência do Cliente (marca a parcela como não liberada / cancelada)
  const handleOpenDefaultModal = (item: FlatInstallment) => {
    setDefaultingInstallment(item);
    setDefaultReason('Inadimplência do cliente');
  };

  const handleConfirmDefault = () => {
    if (!defaultingInstallment) return;
    onUpdateInstallment(defaultingInstallment.referral.id, defaultingInstallment.installment.id, {
      status: 'cancelada',
      notes: defaultReason.trim() || 'Inadimplência do cliente'
    });
    setDefaultingInstallment(null);
  };

  // Handlers for Attaching Invoice
  const handleOpenAttachInvoiceModal = (item: FlatInstallment) => {
    setAttachingInvoiceInstallment(item);
    setInvoiceFileName(item.installment.invoiceDoc?.name || `NF_${item.installment.partnerName.replace(/\s+/g, '_')}_${item.installment.installmentNumber}.pdf`);
    setInvoiceDriveUrl(item.installment.invoiceDoc?.url || '');
    setInvoiceScheduledDate(item.installment.scheduledPaymentDate || todayStr);
    setInvoiceFileData(item.installment.invoiceDoc?.fileData || '');
  };

  const handleInvoiceFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInvoiceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInvoiceFileData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoice = () => {
    if (!attachingInvoiceInstallment) return;
    if (!invoiceScheduledDate) {
      alert('Por favor, defina a data de pagamento agendada.');
      return;
    }

    const doc: AttachedDocument = {
      name: invoiceFileName || 'Nota_Fiscal.pdf',
      url: invoiceDriveUrl.trim() || undefined,
      driveFolderId: GOOGLE_DRIVE_CONFIG.toPayFolder.id,
      driveFolderName: GOOGLE_DRIVE_CONFIG.toPayFolder.name,
      uploadedAt: todayStr,
      fileData: invoiceFileData || undefined
    };

    onUpdateInstallment(
      attachingInvoiceInstallment.referral.id, 
      attachingInvoiceInstallment.installment.id, 
      {
        status: 'agendada',
        invoiceDoc: doc,
        scheduledPaymentDate: invoiceScheduledDate
      }
    );

    setAttachingInvoiceInstallment(null);
  };

  // Handlers for Confirming Payment & Attaching Receipt
  const handleOpenPaymentModal = (item: FlatInstallment) => {
    setPayingInstallment(item);
    setReceiptFileName(`Comprovante_${item.installment.partnerName.replace(/\s+/g, '_')}_${item.installment.installmentNumber}.pdf`);
    setReceiptDriveUrl('');
    setReceiptPaidDate(todayStr);
    setReceiptPaymentMethod('PIX');
    setReceiptFileData('');
    setReceiptNotes('');
  };

  const handleReceiptFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptFileData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = () => {
    if (!payingInstallment) return;
    if (!receiptPaidDate) {
      alert('Por favor, informe a data efetiva do pagamento.');
      return;
    }

    const receiptDoc: AttachedDocument = {
      name: receiptFileName || 'Comprovante_Pagamento.pdf',
      url: receiptDriveUrl.trim() || undefined,
      driveFolderId: GOOGLE_DRIVE_CONFIG.receiptsFolder.id,
      driveFolderName: GOOGLE_DRIVE_CONFIG.receiptsFolder.name,
      uploadedAt: todayStr,
      fileData: receiptFileData || undefined
    };

    // Automatically transition the NF to folder "NFs Pagas" as requested!
    let updatedInvoiceDoc = payingInstallment.installment.invoiceDoc;
    if (updatedInvoiceDoc) {
      updatedInvoiceDoc = {
        ...updatedInvoiceDoc,
        driveFolderId: GOOGLE_DRIVE_CONFIG.paidFolder.id,
        driveFolderName: GOOGLE_DRIVE_CONFIG.paidFolder.name
      };
    }

    onUpdateInstallment(
      payingInstallment.referral.id,
      payingInstallment.installment.id,
      {
        status: 'paga',
        paidDate: receiptPaidDate,
        paymentMethod: receiptPaymentMethod,
        receiptDoc,
        invoiceDoc: updatedInvoiceDoc,
        notes: receiptNotes.trim() || undefined
      }
    );

    setPayingInstallment(null);
  };

  // Document Viewer Helper
  const handleOpenDocViewer = (doc: AttachedDocument, title: string, folderUrl: string) => {
    if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setViewingDoc({ doc, title, folderUrl });
  };

  const handleDownloadDoc = (doc: AttachedDocument) => {
    if (doc.fileData) {
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.name;
      a.click();
    } else if (doc.url) {
      window.open(doc.url, '_blank');
    }
  };

  const handleExportCSV = () => {
    if (paidList.length === 0) {
      alert('Nenhuma comissão paga registrada para exportar.');
      return;
    }

    const headers = [
      'Parceiro',
      'Cliente',
      'Parcela',
      'Valor (R$)',
      'Data Pagamento',
      'Metodo',
      'Documento NF',
      'Pasta NF',
      'Comprovante',
      'Pasta Comprovante'
    ];

    const rows = paidList.map(item => [
      `"${item.installment.partnerName}"`,
      `"${item.installment.clientName}"`,
      `"${item.installment.triggerDescription}"`,
      item.installment.value,
      `"${item.installment.paidDate || ''}"`,
      `"${item.installment.paymentMethod || 'PIX'}"`,
      `"${item.installment.invoiceDoc?.name || ''}"`,
      `"${GOOGLE_DRIVE_CONFIG.paidFolder.name}"`,
      `"${item.installment.receiptDoc?.name || ''}"`,
      `"${GOOGLE_DRIVE_CONFIG.receiptsFolder.name}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `comissoes_pagas_zorya_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Google Drive Official Links */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Gestão Estratégica de Comissões & Liquidações
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Liberação em 3 partes (1/3 nas mensalidades 1, 3 e 5), agendamentos, anexos de NFs e comprovantes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar Pagas (CSV)</span>
            </button>
          </div>
        </div>

        {/* Google Drive Fast-Access Links Bar */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">
                Pastas Oficiais no Google Drive (Zorya Parcerias)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Documentos acessíveis diretamente no sistema sem necessidade de busca manual
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Folder 1: Comissões a pagar */}
            <a
              href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition group"
            >
              <div className="truncate pr-2">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>1. Comissões a Pagar (NFs)</span>
                </div>
                <span className="text-[11px] text-amber-700">NFs solicitadas aguardando quitação</span>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </a>

            {/* Folder 2: NFs Pagas */}
            <a
              href={GOOGLE_DRIVE_CONFIG.paidFolder.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition group"
            >
              <div className="truncate pr-2">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>2. NFs Pagas (Quitações)</span>
                </div>
                <span className="text-[11px] text-emerald-700">Arquivamento pós-pagamento</span>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </a>

            {/* Folder 3: Comprovantes */}
            <a
              href={GOOGLE_DRIVE_CONFIG.receiptsFolder.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition group"
            >
              <div className="truncate pr-2">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span>3. Comprovantes de Pagamento</span>
                </div>
                <span className="text-[11px] text-indigo-700">Recibos e transferências PIX/TED</span>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* Real-time Alerts Banner */}
      {(dueTodayList.length > 0 || releasingTodayList.length > 0 || awaitingInvoiceList.length > 0 || overdueList.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-amber-950 text-sm">Alertas de Prazos & Comissões Hoje</h4>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {dueTodayList.length > 0 && (
                  <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md border border-rose-200">
                    🚨 {dueTodayList.length} pagamento(s) agendado(s) para HOJE
                  </span>
                )}
                {releasingTodayList.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                    🔔 {releasingTodayList.length} comissão(ões) liberada(s) hoje (fatura cliente)
                  </span>
                )}
                {awaitingInvoiceList.length > 0 && (
                  <span className="bg-amber-100 text-amber-900 font-medium px-2 py-0.5 rounded-md border border-amber-200">
                    📄 {awaitingInvoiceList.length} aguardando emissão/anexo de NF
                  </span>
                )}
                {overdueList.length > 0 && (
                  <span className="bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-md border border-rose-300">
                    ⏰ {overdueList.length} agendada(s) atrasada(s) (sem comprovante)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dueTodayList.length > 0 && (
              <button
                onClick={() => setActiveTab('agendadas')}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
              >
                Pagar Vencimentos Hoje ({dueTodayList.length})
              </button>
            )}
            {releasingTodayList.length > 0 && (
              <button
                onClick={() => setActiveTab('a_liberar_mes')}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
              >
                Ver Liberadas Hoje ({releasingTodayList.length})
              </button>
            )}
            {overdueList.length > 0 && (
              <button
                onClick={() => setActiveTab('agendadas')}
                className="bg-rose-800 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
              >
                Ver Atrasadas ({overdueList.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('a_liberar_mes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'a_liberar_mes'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>A Liberar no Mês</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === 'a_liberar_mes' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {toReleaseList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('agendadas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'agendadas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>Comissões Agendadas</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === 'agendadas' ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {scheduledList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('historico_pagas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'historico_pagas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>Histórico de Pagas</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === 'historico_pagas' ? 'bg-blue-400 text-slate-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {paidList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('todas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'todas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>Visão por Contrato</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700">
              {wonReferrals.length}
            </span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar parceiro ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* TAB 1: COMISSÕES A LIBERAR NO MÊS */}
      {activeTab === 'a_liberar_mes' && (
        <div className="space-y-4">
          
          {/* Month Selector Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700">Mês de Referência da Liberação:</span>
              <input
                type="month"
                value={selectedMonth}
                disabled={allMonthsFilter}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-bold focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={allMonthsFilter}
                  onChange={(e) => setAllMonthsFilter(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold">Exibir Todos os Meses</span>
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Total a liberar no período:</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {formatCurrency(filteredToRelease.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {/* Table */}
          {filteredToRelease.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-3">Nenhuma comissão a liberar para este período</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Todas as comissões deste mês já foram notificadas ou agendadas, ou não há vencimentos de fatura previstos para este mês.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Parceiro Indicador</th>
                      <th className="py-3 px-4">Cliente Indicado</th>
                      <th className="py-3 px-4">Parcela & Regra</th>
                      <th className="py-3 px-4">Valor Parcela</th>
                      <th className="py-3 px-4">Data Liberação (Fatura)</th>
                      <th className="py-3 px-4">Situação</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredToRelease.map((item) => {
                      const isPastOrToday = item.installment.releaseDate <= todayStr;
                      const isToday = item.installment.releaseDate === todayStr;
                      // Parcela sintética (não gravada no parceiro/embaixador): a indicação está "ganho" com
                      // comissão definida, mas sem Data de Fechamento/Vencimento — sem isso, ensureCommissionInstallmentsForReferral
                      // nunca gera parcelas reais e qualquer ação aqui (Anexar NF, Notificar) não teria onde persistir.
                      const isIncomplete = item.installment.id.startsWith('legacy-');

                      return (
                        <tr key={item.installment.id} className={`hover:bg-slate-50/70 transition ${isIncomplete ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.installment.partnerName}</span>
                              {item.installment.kind === 'embaixador' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200">
                                  Embaixador
                                </span>
                              )}
                            </div>
                            {item.referral.clientCompany && (
                              <div className="text-[11px] text-slate-500">{item.referral.clientCompany}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">{item.installment.clientName}</div>
                            <div className="text-[11px] text-slate-500">
                              {item.referral.planRecurrence === 'anual' ? 'Plano Anual' : 'Plano Mensal'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.installment.triggerDescription}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {item.installment.installmentNumber}ª de {item.installment.totalInstallments} partes
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900 text-sm">
                              {formatCurrency(item.installment.value)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className={`font-semibold ${isPastOrToday ? 'text-emerald-700 font-bold' : 'text-slate-700'}`}>
                                {formatDateBR(item.installment.releaseDate)}
                              </span>
                            </div>
                            {isToday && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                Vence Hoje!
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {isIncomplete ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md text-[11px]" title="Faltam Data de Fechamento e/ou Dia de Vencimento da Fatura na indicação">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Cadastro incompleto</span>
                              </span>
                            ) : item.installment.status === 'solicitada' ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>NF Solicitada ao Parceiro</span>
                              </span>
                            ) : isPastOrToday ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md text-[11px]">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>Liberada (Fatura Paga)</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">
                                Aguardando vencimento da fatura
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isIncomplete ? (
                              <button
                                onClick={() => onEditReferral(item.referral)}
                                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs ml-auto"
                                title="Preencha Data de Fechamento e Dia de Vencimento da Fatura para gerar as parcelas de comissão"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>Completar Fechamento p/ Liberar</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenNotifyModal(item)}
                                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-xl transition"
                                  title="Gerar mensagem de aviso para o parceiro emitir NF"
                                >
                                  <MessageSquare className="w-3 h-3 text-slate-600" />
                                  <span>Avisar Parceiro</span>
                                </button>

                                <button
                                  onClick={() => handleOpenAttachInvoiceModal(item)}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Anexar NF</span>
                                </button>

                                <button
                                  onClick={() => handleOpenDefaultModal(item)}
                                  className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-xl transition border border-rose-200"
                                  title="Marcar como não liberada por inadimplência do cliente"
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>Inadimplência</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMISSÕES AGENDADAS */}
      {activeTab === 'agendadas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Comissões com Datas de Pagamento Agendadas</h3>
              <p className="text-slate-500 mt-0.5">
                NFs já anexadas pelo time. Acompanhe os vencimentos e anexe o comprovante após a transferência.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Total Agendado:</span>
              <span className="font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                {formatCurrency(filteredScheduled.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {filteredScheduled.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Clock className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-3">Nenhuma comissão agendada no momento</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Assim que você anexar a Nota Fiscal recebida do parceiro e definir a data de pagamento, ela aparecerá aqui para controle de liquidação.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Parceiro & Cliente</th>
                      <th className="py-3 px-4">Parcela</th>
                      <th className="py-3 px-4">Valor a Pagar</th>
                      <th className="py-3 px-4">Data Agendada</th>
                      <th className="py-3 px-4">Nota Fiscal Anexada</th>
                      <th className="py-3 px-4 text-right">Ação de Liquidação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredScheduled.map(item => {
                      const isToday = item.installment.scheduledPaymentDate === todayStr;
                      const isOverdue = item.installment.scheduledPaymentDate && item.installment.scheduledPaymentDate < todayStr;

                      return (
                        <tr key={item.installment.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{item.installment.partnerName}</span>
                              {item.installment.kind === 'embaixador' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200">
                                  Embaixador
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600">Cliente: {item.installment.clientName}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.installment.triggerDescription}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900 text-sm">
                              {formatCurrency(item.installment.value)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className={`font-bold ${isOverdue ? 'text-rose-600' : isToday ? 'text-amber-600' : 'text-slate-800'}`}>
                                {formatDateBR(item.installment.scheduledPaymentDate)}
                              </span>
                            </div>
                            {isToday && (
                              <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                Vencimento Hoje!
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                                Vencida / Em Atraso
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.installment.invoiceDoc ? (
                              <div className="space-y-1">
                                <button
                                  onClick={() => handleOpenDocViewer(item.installment.invoiceDoc!, 'Nota Fiscal', GOOGLE_DRIVE_CONFIG.toPayFolder.url)}
                                  className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                                  title="Acessar documento diretamente sem procurar na pasta"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[150px]">{item.installment.invoiceDoc.name}</span>
                                </button>
                                <span className="text-[10px] text-slate-500 block">
                                  📁 Pasta Drive: Comissões a Pagar
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sem documento</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenDefaultModal(item)}
                                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-xl transition border border-rose-200"
                                title="Marcar como não liberada por inadimplência do cliente"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Inadimplência</span>
                              </button>
                              <button
                                onClick={() => handleOpenPaymentModal(item)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Anexar Comprovante & Marcar Paga</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTÓRICO DE COMISSÕES PAGAS */}
      {activeTab === 'historico_pagas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Histórico Consolidado de Comissões Pagas</h3>
              <p className="text-slate-500 mt-0.5">
                NFs arquivadas na pasta de quitadas e comprovantes bancários anexados.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Total Pago:</span>
              <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {formatCurrency(filteredPaid.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {filteredPaid.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-3">Nenhuma comissão quitada até o momento</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Conforme as parcelas forem pagas e os comprovantes anexados, todo o histórico ficará auditável nesta seção.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Parceiro & Cliente</th>
                      <th className="py-3 px-4">Parcela</th>
                      <th className="py-3 px-4">Valor Pago</th>
                      <th className="py-3 px-4">Data Pagamento</th>
                      <th className="py-3 px-4">Método</th>
                      <th className="py-3 px-4">NF (Pasta: NFs Pagas)</th>
                      <th className="py-3 px-4">Comprovante de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPaid.map(item => (
                      <tr key={item.installment.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.installment.partnerName}</div>
                          <div className="text-[11px] text-slate-600">Cliente: {item.installment.clientName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.installment.triggerDescription}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-emerald-800 text-sm">
                            {formatCurrency(item.installment.value)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {formatDateBR(item.installment.paidDate)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[11px]">
                            {item.installment.paymentMethod || 'PIX'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.installment.invoiceDoc ? (
                            <button
                              onClick={() => handleOpenDocViewer(item.installment.invoiceDoc!, 'Nota Fiscal Quitada', GOOGLE_DRIVE_CONFIG.paidFolder.url)}
                              className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                              title="Visualizar NF arquivada na pasta NFs Pagas"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[130px]">{item.installment.invoiceDoc.name}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.installment.receiptDoc ? (
                            <button
                              onClick={() => handleOpenDocViewer(item.installment.receiptDoc!, 'Comprovante de Pagamento', GOOGLE_DRIVE_CONFIG.receiptsFolder.url)}
                              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                              title="Visualizar comprovante arquivado na pasta Comprovantes"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[130px]">{item.installment.receiptDoc.name}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TODAS AS COMISSÕES & VISÃO POR CONTRATO */}
      {activeTab === 'todas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm">Visão Geral Consolidada por Negócio Ganho</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe o status e a liberação das parcelas de comissão por contrato fechado.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Parceiro & Empresa</th>
                    <th className="py-3 px-4">Cliente Indicado</th>
                    <th className="py-3 px-4">Valor Contrato (R$)</th>
                    <th className="py-3 px-4">Comissão Fixa</th>
                    <th className="py-3 px-4">Progresso das Parcelas (1/3)</th>
                    <th className="py-3 px-4">Status Geral</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wonReferrals.map(ref => {
                    const insts = ref.commissionInstallments || [];
                    const paidCount = insts.filter(i => i.status === 'paga').length;
                    const totalCount = insts.length;

                    return (
                      <tr key={ref.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{ref.partnerName}</div>
                          {ref.ambassadorName && (
                            <div className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 mt-0.5">
                              <span className="bg-amber-100 px-1.5 py-0.2 rounded-full border border-amber-200">Embaixador</span>
                              <span>{ref.ambassadorName}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{ref.clientName}</div>
                          {ref.clientCompany && <div className="text-[11px] text-slate-500">{ref.clientCompany}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatCurrency(ref.dealValue)}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-800">
                          {formatCurrency(ref.commissionValue)}
                        </td>
                        <td className="py-3.5 px-4">
                          {totalCount > 0 ? (
                            <div>
                              <div className="flex items-center gap-1 font-bold text-slate-800">
                                <span>{paidCount} de {totalCount} pagas</span>
                              </div>
                              <div className="flex gap-1 mt-1">
                                {insts.map((i, idx) => (
                                  <span 
                                    key={idx} 
                                    title={`${i.triggerDescription}: ${i.status}`}
                                    className={`w-3 h-3 rounded-full ${
                                      i.status === 'paga' ? 'bg-emerald-500' :
                                      i.status === 'cancelada' ? 'bg-rose-400' :
                                      i.status === 'agendada' ? 'bg-amber-400' :
                                      i.status === 'solicitada' ? 'bg-blue-400' : 'bg-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pendente geração</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            ref.commissionStatus === 'paga' ? 'bg-emerald-100 text-emerald-800' :
                            ref.commissionStatus === 'a_pagar' ? 'bg-amber-100 text-amber-900' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {ref.commissionStatus === 'paga' ? 'Totalmente Paga' :
                             ref.commissionStatus === 'a_pagar' ? 'Em Liquidação' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onEditReferral(ref)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-xl transition"
                          >
                            Editar Contrato
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: AVISAR PARCEIRO PARA EMISSÃO DE NF */}
      {notifyingInstallment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Notificar Parceiro para Emitir NF</h3>
                  <p className="text-xs text-slate-500">
                    {notifyingInstallment.installment.partnerName} • {notifyingInstallment.installment.clientName}
                  </p>
                </div>
              </div>
              <button onClick={() => setNotifyingInstallment(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Modelo de Mensagem (WhatsApp / E-mail):</span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-bold"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-line font-mono text-[11px] leading-relaxed">
                {getPartnerMessageText()}
              </div>
            </div>

            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-indigo-900 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">Valor da Parcela:</span> {formatCurrency(notifyingInstallment.installment.value)}
                <div className="text-[11px] text-indigo-700">Data de Liberação: {formatDateBR(notifyingInstallment.installment.releaseDate)}</div>
              </div>
              <a
                href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
              >
                <span>Abrir Pasta Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNotifyingInstallment(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleConfirmPartnerNotified}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Marcar como Notificado / NF Solicitada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ANEXAR NF & AGENDAR PAGAMENTO */}
      {attachingInvoiceInstallment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Anexar Nota Fiscal & Agendar Pagamento</h3>
                  <p className="text-xs text-slate-500">
                    {attachingInvoiceInstallment.installment.partnerName} • Parcela: {attachingInvoiceInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setAttachingInvoiceInstallment(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
              <div>
                <span className="font-bold">Valor da Comissão a Pagar:</span> {formatCurrency(attachingInvoiceInstallment.installment.value)}
                <div className="text-[11px] text-amber-700">Pasta Destino: Comissões a Pagar (Google Drive)</div>
              </div>
              <a
                href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-bold text-amber-900 hover:underline bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>Abrir Pasta</span>
              </a>
            </div>

            <div className="space-y-3 text-xs">
              {/* File upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload do Arquivo da Nota Fiscal (PDF ou XML)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.xml,.png,.jpg,.jpeg"
                    onChange={handleInvoiceFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-800 mt-1">
                    {invoiceFileName || 'Clique ou arraste a NF aqui'}
                  </p>
                  <p className="text-[11px] text-slate-500">Suporta PDF, XML e imagens</p>
                </div>
              </div>

              {/* Direct Drive link (optional) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link Direto do Documento no Google Drive (Sem buscar na pasta)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={invoiceDriveUrl}
                  onChange={(e) => setInvoiceDriveUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Permite abrir e consultar o documento com 1 clique direto na tabela do sistema.
                </span>
              </div>

              {/* Scheduled Payment Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data Agendada para o Pagamento *
                </label>
                <input
                  type="date"
                  value={invoiceScheduledDate}
                  onChange={(e) => setInvoiceScheduledDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAttachingInvoiceInstallment(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Salvar NF & Agendar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ANEXAR COMPROVANTE & CONFIRMAR PAGAMENTO */}
      {payingInstallment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Liquidação & Comprovante de Pagamento</h3>
                  <p className="text-xs text-slate-500">
                    {payingInstallment.installment.partnerName} • {payingInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setPayingInstallment(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1 text-xs text-emerald-900">
              <div className="flex items-center justify-between">
                <span className="font-bold">Valor Quitado: {formatCurrency(payingInstallment.installment.value)}</span>
                <a
                  href={GOOGLE_DRIVE_CONFIG.receiptsFolder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-bold text-emerald-800 hover:underline bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pasta Comprovantes</span>
                </a>
              </div>
              <p className="text-[11px] text-emerald-700">
                ✨ A Nota Fiscal anexada será transferida logicamente para a pasta <strong>NFs Pagas</strong> no Drive.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Receipt File */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload do Comprovante Bancário (PIX / TED / Recibo)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleReceiptFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-800 mt-1">
                    {receiptFileName || 'Clique para carregar o comprovante'}
                  </p>
                  <p className="text-[11px] text-slate-500">PDF, PNG ou JPG</p>
                </div>
              </div>

              {/* Direct link */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link Direto do Comprovante no Google Drive
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={receiptDriveUrl}
                  onChange={(e) => setReceiptDriveUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Efetiva do Pagamento *</label>
                  <input
                    type="date"
                    value={receiptPaidDate}
                    onChange={(e) => setReceiptPaidDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Método de Liquidação</label>
                  <select
                    value={receiptPaymentMethod}
                    onChange={(e) => setReceiptPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    <option value="PIX">PIX</option>
                    <option value="TED Banco">TED</option>
                    <option value="DOC">DOC</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Boleto">Boleto</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações do Pagamento</label>
                <input
                  type="text"
                  placeholder="Ex: ID da transação PIX E000000000..."
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayingInstallment(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Confirmar Liquidação & Marcar como Paga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INADIMPLÊNCIA DO CLIENTE (marca parcela como não liberada) */}
      {defaultingInstallment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Marcar como Não Liberada</h3>
                  <p className="text-xs text-slate-500">
                    {defaultingInstallment.installment.partnerName} • {defaultingInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setDefaultingInstallment(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs text-rose-900">
              <span className="font-bold">Valor da Parcela:</span> {formatCurrency(defaultingInstallment.installment.value)}
              <p className="mt-1 text-rose-800">
                Esta parcela será marcada como <strong>cancelada</strong> (não liberada) e sai das listas de "A Liberar" e "Agendadas". Use quando o cliente ficar inadimplente e a comissão não for devida.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">Motivo</label>
              <input
                type="text"
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDefaultingInstallment(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDefault}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Confirmar Não Liberação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DOCUMENT PREVIEW & DIRECT ACCESS */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{viewingDoc.title}</h3>
                  <p className="text-xs text-slate-500">{viewingDoc.doc.name}</p>
                </div>
              </div>
              <button onClick={() => setViewingDoc(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Nome do Arquivo:</span>
                <span className="font-bold text-slate-900">{viewingDoc.doc.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data do Registro:</span>
                <span className="font-semibold text-slate-800">{formatDateBR(viewingDoc.doc.uploadedAt)}</span>
              </div>
              {viewingDoc.doc.driveFolderName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Pasta no Google Drive:</span>
                  <span className="font-bold text-blue-700">{viewingDoc.doc.driveFolderName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <a
                href={viewingDoc.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
                <span>Abrir Pasta no Drive</span>
              </a>

              {viewingDoc.doc.fileData && (
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(viewingDoc.doc)}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo Anexo</span>
                </button>
              )}

              {viewingDoc.doc.url && (
                <a
                  href={viewingDoc.doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto text-center px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Documento Direto</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
