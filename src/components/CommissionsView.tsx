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
    <div>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Comissões &amp; Liquidações
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            Liberação em 3 partes (1/3 nas mensalidades 1, 3 e 5), agendamentos, anexos de NFs e comprovantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-transparent border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Pagas (CSV)</span>
          </button>
        </div>
      </div>

      <div className="space-y-5">

      {/* Google Drive Official Links */}
      <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
        <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-zry-info" />
            <span className="text-[15px] font-bold text-zry-text tracking-tight">
              Pastas Oficiais no Google Drive (Zorya Parcerias)
            </span>
          </div>
          <span className="text-[12.5px] text-zry-text-2">
            Documentos acessíveis diretamente no sistema sem necessidade de busca manual
          </span>
        </div>

        <div className="p-[22px] grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Folder 1: Comissões a pagar */}
          <a
            href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-4 py-3.5 bg-zry-lilas-30 rounded-2xl border border-zry-border hover:border-zry-border-strong hover:bg-zry-lilas transition group"
          >
            <div className="truncate pr-2">
              <div className="text-[13px] font-bold text-zry-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zry-warning"></span>
                <span>1. Comissões a Pagar (NFs)</span>
              </div>
              <span className="text-[12px] text-zry-text-2">NFs solicitadas aguardando quitação</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zry-text-2 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </a>

          {/* Folder 2: NFs Pagas */}
          <a
            href={GOOGLE_DRIVE_CONFIG.paidFolder.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-4 py-3.5 bg-zry-lilas-30 rounded-2xl border border-zry-border hover:border-zry-border-strong hover:bg-zry-lilas transition group"
          >
            <div className="truncate pr-2">
              <div className="text-[13px] font-bold text-zry-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zry-positive"></span>
                <span>2. NFs Pagas (Quitações)</span>
              </div>
              <span className="text-[12px] text-zry-text-2">Arquivamento pós-pagamento</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zry-text-2 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </a>

          {/* Folder 3: Comprovantes */}
          <a
            href={GOOGLE_DRIVE_CONFIG.receiptsFolder.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-4 py-3.5 bg-zry-lilas-30 rounded-2xl border border-zry-border hover:border-zry-border-strong hover:bg-zry-lilas transition group"
          >
            <div className="truncate pr-2">
              <div className="text-[13px] font-bold text-zry-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zry-info"></span>
                <span>3. Comprovantes de Pagamento</span>
              </div>
              <span className="text-[12px] text-zry-text-2">Recibos e transferências PIX/TED</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zry-text-2 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </a>
        </div>
      </div>

      {/* Real-time Alerts Banner */}
      {(dueTodayList.length > 0 || releasingTodayList.length > 0 || awaitingInvoiceList.length > 0 || overdueList.length > 0) && (
        <div className="bg-zry-warning-bg border border-zry-warning/30 rounded-zry-lg px-[22px] py-[18px] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-zry-warning text-zry-creme rounded-full shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[15px] font-bold text-zry-text tracking-tight">Alertas de Prazos &amp; Comissões Hoje</h4>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {dueTodayList.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-danger-bg text-zry-danger">
                    🚨 {dueTodayList.length} pagamento(s) agendado(s) para HOJE
                  </span>
                )}
                {releasingTodayList.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive">
                    🔔 {releasingTodayList.length} comissão(ões) liberada(s) hoje (fatura cliente)
                  </span>
                )}
                {awaitingInvoiceList.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-surface text-zry-warning border border-zry-warning/30">
                    📄 {awaitingInvoiceList.length} aguardando emissão/anexo de NF
                  </span>
                )}
                {overdueList.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-danger text-zry-creme">
                    ⏰ {overdueList.length} agendada(s) atrasada(s) (sem comprovante)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {dueTodayList.length > 0 && (
              <button
                onClick={() => setActiveTab('agendadas')}
                className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
              >
                Pagar Vencimentos Hoje ({dueTodayList.length})
              </button>
            )}
            {releasingTodayList.length > 0 && (
              <button
                onClick={() => setActiveTab('a_liberar_mes')}
                className="flex items-center gap-2 bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
              >
                Ver Liberadas Hoje ({releasingTodayList.length})
              </button>
            )}
            {overdueList.length > 0 && (
              <button
                onClick={() => setActiveTab('agendadas')}
                className="flex items-center gap-2 bg-transparent border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
              >
                Ver Atrasadas ({overdueList.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('a_liberar_mes')}
            className={`flex items-center gap-2 border text-[12.5px] font-semibold px-4 py-2 rounded-full transition ${
              activeTab === 'a_liberar_mes'
                ? 'bg-zry-roxo text-zry-creme border-zry-roxo'
                : 'border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'
            }`}
          >
            <span>A Liberar no Mês</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'a_liberar_mes' ? 'bg-zry-coral text-zry-roxo' : 'bg-zry-lilas text-zry-roxo'
            }`}>
              {toReleaseList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('agendadas')}
            className={`flex items-center gap-2 border text-[12.5px] font-semibold px-4 py-2 rounded-full transition ${
              activeTab === 'agendadas'
                ? 'bg-zry-roxo text-zry-creme border-zry-roxo'
                : 'border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'
            }`}
          >
            <span>Comissões Agendadas</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'agendadas' ? 'bg-zry-coral text-zry-roxo' : 'bg-zry-lilas text-zry-roxo'
            }`}>
              {scheduledList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('historico_pagas')}
            className={`flex items-center gap-2 border text-[12.5px] font-semibold px-4 py-2 rounded-full transition ${
              activeTab === 'historico_pagas'
                ? 'bg-zry-roxo text-zry-creme border-zry-roxo'
                : 'border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'
            }`}
          >
            <span>Histórico de Pagas</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'historico_pagas' ? 'bg-zry-coral text-zry-roxo' : 'bg-zry-lilas text-zry-roxo'
            }`}>
              {paidList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('todas')}
            className={`flex items-center gap-2 border text-[12.5px] font-semibold px-4 py-2 rounded-full transition ${
              activeTab === 'todas'
                ? 'bg-zry-roxo text-zry-creme border-zry-roxo'
                : 'border-zry-border bg-zry-surface text-zry-text-2 hover:bg-zry-lilas-30'
            }`}
          >
            <span>Visão por Contrato</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'todas' ? 'bg-zry-coral text-zry-roxo' : 'bg-zry-lilas text-zry-roxo'
            }`}>
              {wonReferrals.length}
            </span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zry-text-2" />
          <input
            type="text"
            placeholder="Buscar parceiro ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zry-lilas-30 border border-transparent rounded-full pl-10 pr-4 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong transition"
          />
        </div>
      </div>

      {/* TAB 1: COMISSÕES A LIBERAR NO MÊS */}
      {activeTab === 'a_liberar_mes' && (
        <div className="space-y-4">
          
          {/* Month Selector Bar */}
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-[22px] py-[18px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12.5px] font-semibold text-zry-text-2">Mês de Referência da Liberação:</span>
              <input
                type="month"
                value={selectedMonth}
                disabled={allMonthsFilter}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2 text-[13px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong disabled:opacity-50"
              />
              <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-semibold text-zry-text-2 border border-zry-border bg-zry-surface px-4 py-2 rounded-full hover:bg-zry-lilas-30 transition">
                <input
                  type="checkbox"
                  checked={allMonthsFilter}
                  onChange={(e) => setAllMonthsFilter(e.target.checked)}
                  className="rounded border-zry-border-strong text-zry-roxo focus:ring-zry-roxo"
                />
                <span>Exibir Todos os Meses</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-zry-text-2">Total a liberar no período:</span>
              <span className="text-[20px] font-bold tracking-tight text-zry-positive">
                {formatCurrency(filteredToRelease.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {/* Table */}
          {filteredToRelease.length === 0 ? (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-zry-positive mx-auto" />
              <h3 className="text-[17px] font-bold tracking-tight text-zry-text mt-3">Nenhuma comissão a liberar para este período</h3>
              <p className="text-[13px] text-zry-text-2 mt-1.5 max-w-md mx-auto">
                Todas as comissões deste mês já foram notificadas ou agendadas, ou não há vencimentos de fatura previstos para este mês.
              </p>
            </div>
          ) : (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Parceiro Indicador</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Cliente Indicado</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Parcela &amp; Regra</th>
                      <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Valor Parcela</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Data Liberação (Fatura)</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Situação</th>
                      <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredToRelease.map((item) => {
                      const isPastOrToday = item.installment.releaseDate <= todayStr;
                      const isToday = item.installment.releaseDate === todayStr;
                      // Parcela sintética (não gravada no parceiro/embaixador): a indicação está "ganho" com
                      // comissão definida, mas sem Data de Fechamento/Vencimento — sem isso, ensureCommissionInstallmentsForReferral
                      // nunca gera parcelas reais e qualquer ação aqui (Anexar NF, Notificar) não teria onde persistir.
                      const isIncomplete = item.installment.id.startsWith('legacy-');

                      return (
                        <tr key={item.installment.id} className={`border-t border-zry-border hover:bg-zry-lilas-30/60 transition ${isIncomplete ? 'bg-zry-warning-bg/40' : ''}`}>
                          <td className="py-3.5 px-[22px] text-[13px]">
                            <div className="font-semibold text-zry-text flex items-center gap-2">
                              <span>{item.installment.partnerName}</span>
                              {item.installment.kind === 'embaixador' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                                  Embaixador
                                </span>
                              )}
                            </div>
                            {item.referral.clientCompany && (
                              <div className="text-[12px] text-zry-text-2 mt-0.5">{item.referral.clientCompany}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            <div className="font-semibold text-zry-text">{item.installment.clientName}</div>
                            <div className="text-[12px] text-zry-text-2 mt-0.5">
                              {item.referral.planRecurrence === 'anual' ? 'Plano Anual' : 'Plano Mensal'}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                              {item.installment.triggerDescription}
                            </span>
                            <div className="text-[11px] text-zry-text-2 mt-1">
                              {item.installment.installmentNumber}ª de {item.installment.totalInstallments} partes
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-[13px] text-right">
                            <div className="text-[15px] font-bold tracking-tight text-zry-text">
                              {formatCurrency(item.installment.value)}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zry-text-2" />
                              <span className={isPastOrToday ? 'font-semibold text-zry-positive' : 'text-zry-text-2'}>
                                {formatDateBR(item.installment.releaseDate)}
                              </span>
                            </div>
                            {isToday && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive mt-1.5">
                                Vence Hoje!
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            {isIncomplete ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning" title="Faltam Data de Fechamento e/ou Dia de Vencimento da Fatura na indicação">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Cadastro incompleto</span>
                              </span>
                            ) : item.installment.status === 'solicitada' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning">
                                <Clock className="w-3 h-3" />
                                <span>NF Solicitada ao Parceiro</span>
                              </span>
                            ) : isPastOrToday ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive">
                                <Sparkles className="w-3 h-3" />
                                <span>Liberada (Fatura Paga)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                                Aguardando vencimento da fatura
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-[22px] text-[13px] text-right">
                            {isIncomplete ? (
                              <button
                                onClick={() => onEditReferral(item.referral)}
                                className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition ml-auto"
                                title="Preencha Data de Fechamento e Dia de Vencimento da Fatura para gerar as parcelas de comissão"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Completar Fechamento p/ Liberar</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenNotifyModal(item)}
                                  className="flex items-center gap-1.5 bg-transparent border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
                                  title="Gerar mensagem de aviso para o parceiro emitir NF"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Avisar Parceiro</span>
                                </button>

                                <button
                                  onClick={() => handleOpenAttachInvoiceModal(item)}
                                  className="flex items-center gap-1.5 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>Anexar NF</span>
                                </button>

                                <button
                                  onClick={() => handleOpenDefaultModal(item)}
                                  className="flex items-center gap-1.5 bg-zry-danger-bg hover:bg-zry-danger-bg/70 text-zry-danger font-semibold px-3.5 py-[7px] rounded-full text-[12px] border border-zry-danger/30 transition"
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
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-[22px] py-[18px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-zry-text tracking-tight">Comissões com Datas de Pagamento Agendadas</h3>
              <p className="text-[12.5px] text-zry-text-2 mt-1">
                NFs já anexadas pelo time. Acompanhe os vencimentos e anexe o comprovante após a transferência.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-zry-text-2">Total Agendado:</span>
              <span className="text-[20px] font-bold tracking-tight text-zry-warning">
                {formatCurrency(filteredScheduled.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {filteredScheduled.length === 0 ? (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg p-12 text-center">
              <Clock className="w-10 h-10 text-zry-warning mx-auto" />
              <h3 className="text-[17px] font-bold tracking-tight text-zry-text mt-3">Nenhuma comissão agendada no momento</h3>
              <p className="text-[13px] text-zry-text-2 mt-1.5 max-w-md mx-auto">
                Assim que você anexar a Nota Fiscal recebida do parceiro e definir a data de pagamento, ela aparecerá aqui para controle de liquidação.
              </p>
            </div>
          ) : (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Parceiro &amp; Cliente</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Parcela</th>
                      <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Valor a Pagar</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Data Agendada</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Nota Fiscal Anexada</th>
                      <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Ação de Liquidação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScheduled.map(item => {
                      const isToday = item.installment.scheduledPaymentDate === todayStr;
                      const isOverdue = item.installment.scheduledPaymentDate && item.installment.scheduledPaymentDate < todayStr;

                      return (
                        <tr key={item.installment.id} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                          <td className="py-3.5 px-[22px] text-[13px]">
                            <div className="font-semibold text-zry-text flex items-center gap-2">
                              <span>{item.installment.partnerName}</span>
                              {item.installment.kind === 'embaixador' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                                  Embaixador
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-zry-text-2 mt-0.5">Cliente: {item.installment.clientName}</div>
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                              {item.installment.triggerDescription}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-[13px] text-right">
                            <div className="text-[15px] font-bold tracking-tight text-zry-text">
                              {formatCurrency(item.installment.value)}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zry-text-2" />
                              <span className={`font-semibold ${isOverdue ? 'text-zry-danger' : isToday ? 'text-zry-warning' : 'text-zry-text'}`}>
                                {formatDateBR(item.installment.scheduledPaymentDate)}
                              </span>
                            </div>
                            {isToday && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-danger-bg text-zry-danger mt-1.5">
                                Vencimento Hoje!
                              </span>
                            )}
                            {isOverdue && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-danger-bg text-zry-danger mt-1.5">
                                Vencida / Em Atraso
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-[13px]">
                            {item.installment.invoiceDoc ? (
                              <div className="space-y-1">
                                <button
                                  onClick={() => handleOpenDocViewer(item.installment.invoiceDoc!, 'Nota Fiscal', GOOGLE_DRIVE_CONFIG.toPayFolder.url)}
                                  className="flex items-center gap-1.5 text-zry-info hover:text-zry-roxo font-semibold underline cursor-pointer"
                                  title="Acessar documento diretamente sem procurar na pasta"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[150px]">{item.installment.invoiceDoc.name}</span>
                                </button>
                                <span className="text-[11px] text-zry-text-2 block">
                                  📁 Pasta Drive: Comissões a Pagar
                                </span>
                              </div>
                            ) : (
                              <span className="text-zry-text-2">Sem documento</span>
                            )}
                          </td>
                          <td className="py-3.5 px-[22px] text-[13px] text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenDefaultModal(item)}
                                className="flex items-center gap-1.5 bg-zry-danger-bg hover:bg-zry-danger-bg/70 text-zry-danger font-semibold px-3.5 py-[7px] rounded-full text-[12px] border border-zry-danger/30 transition"
                                title="Marcar como não liberada por inadimplência do cliente"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Inadimplência</span>
                              </button>
                              <button
                                onClick={() => handleOpenPaymentModal(item)}
                                className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Anexar Comprovante &amp; Marcar Paga</span>
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
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg px-[22px] py-[18px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-zry-text tracking-tight">Histórico Consolidado de Comissões Pagas</h3>
              <p className="text-[12.5px] text-zry-text-2 mt-1">
                NFs arquivadas na pasta de quitadas e comprovantes bancários anexados.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-zry-text-2">Total Pago:</span>
              <span className="text-[20px] font-bold tracking-tight text-zry-positive">
                {formatCurrency(filteredPaid.reduce((acc, i) => acc + i.installment.value, 0))}
              </span>
            </div>
          </div>

          {filteredPaid.length === 0 ? (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-zry-text-2 mx-auto" />
              <h3 className="text-[17px] font-bold tracking-tight text-zry-text mt-3">Nenhuma comissão quitada até o momento</h3>
              <p className="text-[13px] text-zry-text-2 mt-1.5 max-w-md mx-auto">
                Conforme as parcelas forem pagas e os comprovantes anexados, todo o histórico ficará auditável nesta seção.
              </p>
            </div>
          ) : (
            <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Parceiro &amp; Cliente</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Parcela</th>
                      <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Valor Pago</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Data Pagamento</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">Método</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-3">NF (Pasta: NFs Pagas)</th>
                      <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Comprovante de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaid.map(item => (
                      <tr key={item.installment.id} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                        <td className="py-3.5 px-[22px] text-[13px]">
                          <div className="font-semibold text-zry-text">{item.installment.partnerName}</div>
                          <div className="text-[12px] text-zry-text-2 mt-0.5">Cliente: {item.installment.clientName}</div>
                        </td>
                        <td className="py-3.5 px-3 text-[13px]">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                            {item.installment.triggerDescription}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-[13px] text-right">
                          <div className="text-[15px] font-bold tracking-tight text-zry-positive">
                            {formatCurrency(item.installment.value)}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-[13px] text-zry-text-2">
                          {formatDateBR(item.installment.paidDate)}
                        </td>
                        <td className="py-3.5 px-3 text-[13px]">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas text-zry-roxo">
                            {item.installment.paymentMethod || 'PIX'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-[13px]">
                          {item.installment.invoiceDoc ? (
                            <button
                              onClick={() => handleOpenDocViewer(item.installment.invoiceDoc!, 'Nota Fiscal Quitada', GOOGLE_DRIVE_CONFIG.paidFolder.url)}
                              className="flex items-center gap-1.5 text-zry-info hover:text-zry-roxo font-semibold underline cursor-pointer"
                              title="Visualizar NF arquivada na pasta NFs Pagas"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[130px]">{item.installment.invoiceDoc.name}</span>
                            </button>
                          ) : (
                            <span className="text-zry-text-2">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-[22px] text-[13px]">
                          {item.installment.receiptDoc ? (
                            <button
                              onClick={() => handleOpenDocViewer(item.installment.receiptDoc!, 'Comprovante de Pagamento', GOOGLE_DRIVE_CONFIG.receiptsFolder.url)}
                              className="flex items-center gap-1.5 text-zry-positive hover:text-zry-roxo font-semibold underline cursor-pointer"
                              title="Visualizar comprovante arquivado na pasta Comprovantes"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[130px]">{item.installment.receiptDoc.name}</span>
                            </button>
                          ) : (
                            <span className="text-zry-text-2">—</span>
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
          <div className="bg-zry-surface rounded-2xl p-4 border border-zry-border/80 shadow-xs">
            <h3 className="font-bold text-zry-text text-sm">Visão Geral Consolidada por Negócio Ganho</h3>
            <p className="text-xs text-zry-text-2 mt-0.5">
              Acompanhe o status e a liberação das parcelas de comissão por contrato fechado.
            </p>
          </div>

          <div className="bg-zry-surface rounded-3xl border border-zry-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zry-lilas-30 text-zry-text-2 font-semibold border-b border-zry-border">
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
                <tbody className="divide-y divide-zry-border">
                  {wonReferrals.map(ref => {
                    const insts = ref.commissionInstallments || [];
                    const paidCount = insts.filter(i => i.status === 'paga').length;
                    const totalCount = insts.length;

                    return (
                      <tr key={ref.id} className="hover:bg-zry-lilas-30/70 transition">
                        <td className="py-3.5 px-4 font-bold text-zry-text">
                          <div>{ref.partnerName}</div>
                          {ref.ambassadorName && (
                            <div className="text-[10px] font-semibold text-zry-warning flex items-center gap-1 mt-0.5">
                              <span className="bg-zry-warning-bg px-1.5 py-0.2 rounded-full border border-zry-warning/30">Embaixador</span>
                              <span>{ref.ambassadorName}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zry-text">{ref.clientName}</div>
                          {ref.clientCompany && <div className="text-[11px] text-zry-text-2">{ref.clientCompany}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-zry-text">
                          {formatCurrency(ref.dealValue)}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-zry-positive">
                          {formatCurrency(ref.commissionValue)}
                        </td>
                        <td className="py-3.5 px-4">
                          {totalCount > 0 ? (
                            <div>
                              <div className="flex items-center gap-1 font-bold text-zry-text">
                                <span>{paidCount} de {totalCount} pagas</span>
                              </div>
                              <div className="flex gap-1 mt-1">
                                {insts.map((i, idx) => (
                                  <span 
                                    key={idx} 
                                    title={`${i.triggerDescription}: ${i.status}`}
                                    className={`w-3 h-3 rounded-full ${
                                      i.status === 'paga' ? 'bg-zry-positive' :
                                      i.status === 'cancelada' ? 'bg-zry-danger' :
                                      i.status === 'agendada' ? 'bg-zry-warning' :
                                      i.status === 'solicitada' ? 'bg-zry-roxo' : 'bg-zry-lilas'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zry-text-2 italic">Pendente geração</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            ref.commissionStatus === 'paga' ? 'bg-zry-positive-bg text-zry-positive' :
                            ref.commissionStatus === 'a_pagar' ? 'bg-zry-warning-bg text-zry-warning' :
                            'bg-zry-lilas-30 text-zry-text-2'
                          }`}>
                            {ref.commissionStatus === 'paga' ? 'Totalmente Paga' :
                             ref.commissionStatus === 'a_pagar' ? 'Em Liquidação' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onEditReferral(ref)}
                            className="bg-zry-lilas-30 hover:bg-zry-lilas text-zry-text-2 font-semibold px-2.5 py-1.5 rounded-xl transition"
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

      </div>

      {/* MODAL 1: AVISAR PARCEIRO PARA EMISSÃO DE NF */}
      {notifyingInstallment && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zry-border space-y-4">
            <div className="flex items-center justify-between border-b border-zry-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zry-text">Notificar Parceiro para Emitir NF</h3>
                  <p className="text-xs text-zry-text-2">
                    {notifyingInstallment.installment.partnerName} • {notifyingInstallment.installment.clientName}
                  </p>
                </div>
              </div>
              <button onClick={() => setNotifyingInstallment(null)} className="text-zry-text-2 hover:text-zry-text-2 font-bold text-sm">✕</button>
            </div>

            <div className="bg-zry-lilas-30 border border-zry-border rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zry-text-2">Modelo de Mensagem (WhatsApp / E-mail):</span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-zry-info hover:text-zry-info font-bold"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5 text-zry-positive" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <div className="bg-zry-surface p-3 rounded-xl border border-zry-border text-zry-text whitespace-pre-line font-mono text-[11px] leading-relaxed">
                {getPartnerMessageText()}
              </div>
            </div>

            <div className="bg-zry-info-bg/70 p-3 rounded-xl border border-zry-info/30 text-zry-info text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">Valor da Parcela:</span> {formatCurrency(notifyingInstallment.installment.value)}
                <div className="text-[11px] text-zry-info">Data de Liberação: {formatDateBR(notifyingInstallment.installment.releaseDate)}</div>
              </div>
              <a
                href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-zry-info hover:text-zry-info underline"
              >
                <span>Abrir Pasta Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zry-border">
              <button
                type="button"
                onClick={() => setNotifyingInstallment(null)}
                className="px-4 py-2.5 text-[12.5px] text-zry-text-2 hover:text-zry-text font-semibold rounded-full text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleConfirmPartnerNotified}
                className="px-5 py-2 bg-zry-roxo hover:bg-zry-roxo text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Marcar como Notificado / NF Solicitada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ANEXAR NF & AGENDAR PAGAMENTO */}
      {attachingInvoiceInstallment && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zry-border space-y-4">
            <div className="flex items-center justify-between border-b border-zry-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zry-text">Anexar Nota Fiscal & Agendar Pagamento</h3>
                  <p className="text-xs text-zry-text-2">
                    {attachingInvoiceInstallment.installment.partnerName} • Parcela: {attachingInvoiceInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setAttachingInvoiceInstallment(null)} className="text-zry-text-2 hover:text-zry-text-2 font-bold text-sm">✕</button>
            </div>

            <div className="bg-zry-warning-bg p-3 rounded-xl border border-zry-warning/30 flex items-center justify-between text-xs text-zry-warning">
              <div>
                <span className="font-bold">Valor da Comissão a Pagar:</span> {formatCurrency(attachingInvoiceInstallment.installment.value)}
                <div className="text-[11px] text-zry-warning">Pasta Destino: Comissões a Pagar (Google Drive)</div>
              </div>
              <a
                href={GOOGLE_DRIVE_CONFIG.toPayFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-bold text-zry-warning hover:underline bg-zry-surface px-2.5 py-1 rounded-lg border border-zry-warning/30 shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5 text-zry-warning" />
                <span>Abrir Pasta</span>
              </a>
            </div>

            <div className="space-y-3 text-xs">
              {/* File upload */}
              <div>
                <label className="block font-semibold text-zry-text-2 mb-1">
                  Upload do Arquivo da Nota Fiscal (PDF ou XML)
                </label>
                <div className="border-2 border-dashed border-zry-border rounded-2xl p-4 text-center hover:bg-zry-lilas-30 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.xml,.png,.jpg,.jpeg"
                    onChange={handleInvoiceFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-zry-text-2 mx-auto" />
                  <p className="font-bold text-zry-text mt-1">
                    {invoiceFileName || 'Clique ou arraste a NF aqui'}
                  </p>
                  <p className="text-[11px] text-zry-text-2">Suporta PDF, XML e imagens</p>
                </div>
              </div>

              {/* Direct Drive link (optional) */}
              <div>
                <label className="block font-semibold text-zry-text-2 mb-1">
                  Link Direto do Documento no Google Drive (Sem buscar na pasta)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={invoiceDriveUrl}
                  onChange={(e) => setInvoiceDriveUrl(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text focus:ring-1 focus:ring-zry-roxo"
                />
                <span className="text-[10px] text-zry-text-2 mt-0.5 block">
                  Permite abrir e consultar o documento com 1 clique direto na tabela do sistema.
                </span>
              </div>

              {/* Scheduled Payment Date */}
              <div>
                <label className="block font-semibold text-zry-text-2 mb-1">
                  Data Agendada para o Pagamento *
                </label>
                <input
                  type="date"
                  value={invoiceScheduledDate}
                  onChange={(e) => setInvoiceScheduledDate(e.target.value)}
                  required
                  className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text font-bold focus:ring-1 focus:ring-zry-roxo"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zry-border">
              <button
                type="button"
                onClick={() => setAttachingInvoiceInstallment(null)}
                className="px-4 py-2.5 text-[12.5px] text-zry-text-2 hover:text-zry-text font-semibold rounded-full text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="px-5 py-2 bg-zry-roxo hover:bg-zry-roxo-hover text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Salvar NF & Agendar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ANEXAR COMPROVANTE & CONFIRMAR PAGAMENTO */}
      {payingInstallment && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zry-border space-y-4">
            <div className="flex items-center justify-between border-b border-zry-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zry-text">Liquidação & Comprovante de Pagamento</h3>
                  <p className="text-xs text-zry-text-2">
                    {payingInstallment.installment.partnerName} • {payingInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setPayingInstallment(null)} className="text-zry-text-2 hover:text-zry-text-2 font-bold text-sm">✕</button>
            </div>

            <div className="bg-zry-positive-bg p-3 rounded-xl border border-zry-positive/30 space-y-1 text-xs text-zry-positive">
              <div className="flex items-center justify-between">
                <span className="font-bold">Valor Quitado: {formatCurrency(payingInstallment.installment.value)}</span>
                <a
                  href={GOOGLE_DRIVE_CONFIG.receiptsFolder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-bold text-zry-positive hover:underline bg-zry-surface px-2.5 py-1 rounded-lg border border-zry-positive/30 shadow-2xs"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-zry-positive" />
                  <span>Pasta Comprovantes</span>
                </a>
              </div>
              <p className="text-[11px] text-zry-positive">
                ✨ A Nota Fiscal anexada será transferida logicamente para a pasta <strong>NFs Pagas</strong> no Drive.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Receipt File */}
              <div>
                <label className="block font-semibold text-zry-text-2 mb-1">
                  Upload do Comprovante Bancário (PIX / TED / Recibo)
                </label>
                <div className="border-2 border-dashed border-zry-border rounded-2xl p-4 text-center hover:bg-zry-lilas-30 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleReceiptFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-zry-text-2 mx-auto" />
                  <p className="font-bold text-zry-text mt-1">
                    {receiptFileName || 'Clique para carregar o comprovante'}
                  </p>
                  <p className="text-[11px] text-zry-text-2">PDF, PNG ou JPG</p>
                </div>
              </div>

              {/* Direct link */}
              <div>
                <label className="block font-semibold text-zry-text-2 mb-1">
                  Link Direto do Comprovante no Google Drive
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={receiptDriveUrl}
                  onChange={(e) => setReceiptDriveUrl(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text focus:ring-1 focus:ring-zry-roxo"
                />
              </div>

              {/* Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zry-text-2 mb-1">Data Efetiva do Pagamento *</label>
                  <input
                    type="date"
                    value={receiptPaidDate}
                    onChange={(e) => setReceiptPaidDate(e.target.value)}
                    required
                    className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zry-text-2 mb-1">Método de Liquidação</label>
                  <select
                    value={receiptPaymentMethod}
                    onChange={(e) => setReceiptPaymentMethod(e.target.value)}
                    className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text font-bold"
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
                <label className="block font-semibold text-zry-text-2 mb-1">Observações do Pagamento</label>
                <input
                  type="text"
                  placeholder="Ex: ID da transação PIX E000000000..."
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zry-border">
              <button
                type="button"
                onClick={() => setPayingInstallment(null)}
                className="px-4 py-2.5 text-[12.5px] text-zry-text-2 hover:text-zry-text font-semibold rounded-full text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-zry-roxo hover:bg-zry-roxo-hover text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Confirmar Liquidação & Marcar como Paga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INADIMPLÊNCIA DO CLIENTE (marca parcela como não liberada) */}
      {defaultingInstallment && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zry-border space-y-4">
            <div className="flex items-center justify-between border-b border-zry-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zry-danger-bg text-zry-danger rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zry-text">Marcar como Não Liberada</h3>
                  <p className="text-xs text-zry-text-2">
                    {defaultingInstallment.installment.partnerName} • {defaultingInstallment.installment.triggerDescription}
                  </p>
                </div>
              </div>
              <button onClick={() => setDefaultingInstallment(null)} className="text-zry-text-2 hover:text-zry-text-2 font-bold text-sm">✕</button>
            </div>

            <div className="bg-zry-danger-bg p-3 rounded-xl border border-zry-danger/30 text-xs text-zry-danger">
              <span className="font-bold">Valor da Parcela:</span> {formatCurrency(defaultingInstallment.installment.value)}
              <p className="mt-1 text-zry-danger">
                Esta parcela será marcada como <strong>cancelada</strong> (não liberada) e sai das listas de "A Liberar" e "Agendadas". Use quando o cliente ficar inadimplente e a comissão não for devida.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zry-text-2 mb-1 text-xs">Motivo</label>
              <input
                type="text"
                value={defaultReason}
                onChange={(e) => setDefaultReason(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-zry-border rounded-xl px-3 py-2 text-zry-text text-xs focus:ring-1 focus:ring-zry-danger"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zry-border">
              <button
                type="button"
                onClick={() => setDefaultingInstallment(null)}
                className="px-4 py-2.5 text-[12.5px] text-zry-text-2 hover:text-zry-text font-semibold rounded-full text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDefault}
                className="px-5 py-2 bg-zry-danger hover:bg-zry-danger text-white rounded-xl font-bold text-xs shadow-xs transition"
              >
                Confirmar Não Liberação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DOCUMENT PREVIEW & DIRECT ACCESS */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zry-border space-y-4">
            <div className="flex items-center justify-between border-b border-zry-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zry-text">{viewingDoc.title}</h3>
                  <p className="text-xs text-zry-text-2">{viewingDoc.doc.name}</p>
                </div>
              </div>
              <button onClick={() => setViewingDoc(null)} className="text-zry-text-2 hover:text-zry-text-2 font-bold text-sm">✕</button>
            </div>

            <div className="bg-zry-lilas-30 p-4 rounded-2xl border border-zry-border text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zry-text-2">Nome do Arquivo:</span>
                <span className="font-bold text-zry-text">{viewingDoc.doc.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zry-text-2">Data do Registro:</span>
                <span className="font-semibold text-zry-text">{formatDateBR(viewingDoc.doc.uploadedAt)}</span>
              </div>
              {viewingDoc.doc.driveFolderName && (
                <div className="flex justify-between">
                  <span className="text-zry-text-2">Pasta no Google Drive:</span>
                  <span className="font-bold text-zry-info">{viewingDoc.doc.driveFolderName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zry-border">
              <a
                href={viewingDoc.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-4 py-2 bg-zry-lilas-30 hover:bg-zry-lilas text-zry-text-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-zry-text-2" />
                <span>Abrir Pasta no Drive</span>
              </a>

              {viewingDoc.doc.fileData && (
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(viewingDoc.doc)}
                  className="w-full sm:w-auto px-5 py-2 bg-zry-roxo hover:bg-zry-roxo-hover text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
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
                  className="w-full sm:w-auto text-center px-5 py-2 bg-zry-roxo hover:bg-zry-roxo text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
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
