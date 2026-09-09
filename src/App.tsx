/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import type { Referral, Partner, FilterState, AppNotification, CommissionInstallment, AccessState } from './types';
import {
  loadStoredPartners,
  saveStoredPartners,
  loadStoredReferrals,
  saveStoredReferrals,
  clearAllSystemData,
  exportAllData,
  importAllData
} from './services/storageService';
import {
  loadAccess,
  saveAccess,
  isMaster as checkIsMaster,
  listExecutives,
  scopePartnersForAccess,
  scopeReferralsForAccess
} from './services/accessService';
import { 
  loadNotifications, 
  dispatchNotification, 
  markAsRead, 
  markAllAsRead, 
  clearNotifications 
} from './services/notificationService';
import type { SheetImportResult } from './services/sheetsService';
import { formatCurrency, normalizeDocument } from './utils/analytics';
import { calculateReferralVintages, checkAndTriggerVintageCutoffNotifications } from './utils/vintageAnalytics';
import { generateCommissionInstallments, updateReferralCommissionStatusFromInstallments } from './utils/commissionLogic';
import Navbar, { type AppTab } from './components/Navbar';
import Dashboard from './components/Dashboard';
import ReferralsTable from './components/ReferralsTable';
import CommissionsView from './components/CommissionsView';
import PartnersView from './components/PartnersView';
import CarteirasView from './components/CarteirasView';
import SheetsView from './components/SheetsView';
import DataAuditView from './components/DataAuditView';
import PlanSettingsView from './components/PlanSettingsView';
import ReferralModal from './components/ReferralModal';
import PartnerModal from './components/PartnerModal';
import BulkReferralModal from './components/BulkReferralModal';
import NotificationCenterModal from './components/NotificationCenterModal';
import NotificationSettingsModal from './components/NotificationSettingsModal';
import { RotateCcw, ShieldCheck, Check, Trash2, Mail, Download, Upload } from 'lucide-react';

export default function App() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [access, setAccess] = useState<AccessState>({ role: 'master', executive: null });
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter state for dashboard and lists
  const [filter, setFilter] = useState<FilterState>({
    period: { preset: 'all' },
    partnerId: 'all',
    dealStatus: 'all',
    commissionStatus: 'all',
    onlyMissingData: false,
    searchQuery: ''
  });

  // Modal states
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show temporary feedback toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial load from storage with installment backfill
  useEffect(() => {
    const loadedPartners = loadStoredPartners();
    const loadedReferrals = loadStoredReferrals();
    const loadedNotifications = loadNotifications();
    const today = new Date().toISOString().slice(0, 10);

    // Auto-generate installments for any won referrals lacking them
    let hasChanges = false;
    const initializedReferrals = loadedReferrals.map(ref => {
      if (ref.dealStatus === 'ganho' && (!ref.commissionInstallments || ref.commissionInstallments.length === 0) && ref.commissionValue && ref.commissionValue > 0) {
        hasChanges = true;
        const insts = generateCommissionInstallments(
          ref.id,
          ref.partnerId,
          ref.partnerName,
          ref.clientName,
          ref.commissionValue,
          ref.planRecurrence || 'mensal',
          ref.planInstallments || '1x',
          ref.firstInvoiceDueDate || ref.closeDate || today
        );
        // If referral was already marked paga, mark installments as paga
        if (ref.commissionStatus === 'paga') {
          insts.forEach(i => {
            i.status = 'paga';
            i.paidDate = ref.commissionPaidDate || today;
            i.paymentMethod = ref.paymentMethod || 'PIX';
          });
        }
        return {
          ...ref,
          commissionInstallments: insts
        };
      }
      return ref;
    });

    if (hasChanges) {
      saveStoredReferrals(initializedReferrals);
    }

    setPartners(loadedPartners);
    setReferrals(initializedReferrals);
    setNotifications(loadedNotifications);
    setAccess(loadAccess());

    // Check for referral vintages approaching their cutoff (dia 15 do mês seguinte) and
    // emit notifications with pending referral count + potential MRR. Deduplicated per vintage/cutoff.
    try {
      checkAndTriggerVintageCutoffNotifications(calculateReferralVintages(initializedReferrals));
      setNotifications(loadNotifications());
    } catch (err) {
      console.error('Erro ao verificar cortes de safra na inicialização', err);
    }
  }, []);

  // Save referral with automatic notifications for creation, status changes, and commission transitions
  const handleSaveReferral = (referral: Referral) => {
    let updated: Referral[];
    const existing = referrals.find(r => r.id === referral.id);

    if (existing) {
      updated = referrals.map(r => r.id === referral.id ? referral : r);
      showToast('Indicação e dados atualizados com sucesso!');

      // Check for deal status transition (e.g. from 'negociacao' to 'ganho')
      if (existing.dealStatus !== referral.dealStatus) {
        const notif = dispatchNotification({
          type: 'mudanca_status',
          title: `Status do Negócio Alterado: ${referral.clientName}`,
          message: `O negócio com ${referral.clientName} (indicado por ${referral.partnerName}) mudou de '${existing.dealStatus.toUpperCase()}' para '${referral.dealStatus.toUpperCase()}'.`,
          referralId: referral.id,
          partnerId: referral.partnerId,
          partnerName: referral.partnerName,
          dealValue: referral.dealValue,
          commissionValue: referral.commissionValue
        });
        setNotifications(loadNotifications());
      }

      // Check for commission becoming 'a_pagar'
      if (existing.commissionStatus !== 'a_pagar' && referral.commissionStatus === 'a_pagar') {
        const notif = dispatchNotification({
          type: 'comissao_a_pagar',
          title: `Comissão Liberada: ${referral.partnerName}`,
          message: `Comissão no valor de ${formatCurrency(referral.commissionValue)} está pronta para liquidação referente ao cliente ${referral.clientName}.`,
          referralId: referral.id,
          partnerId: referral.partnerId,
          partnerName: referral.partnerName,
          dealValue: referral.dealValue,
          commissionValue: referral.commissionValue
        });
        setNotifications(loadNotifications());
      }
    } else {
      updated = [referral, ...referrals];
      showToast('Nova indicação registrada com sucesso!');

      // Trigger New Referral Notification
      const notif = dispatchNotification({
        type: 'nova_indicacao',
        title: `Nova Indicação Recebida: ${referral.clientName}`,
        message: `O parceiro ${referral.partnerName} registrou uma nova oportunidade comercial (${referral.clientName}).`,
        referralId: referral.id,
        partnerId: referral.partnerId,
        partnerName: referral.partnerName,
        dealValue: referral.dealValue,
        commissionValue: referral.commissionValue
      });
      setNotifications(loadNotifications());
    }

    setReferrals(updated);
    saveStoredReferrals(updated);
  };

  const handleDeleteReferral = (id: string) => {
    const updated = referrals.filter(r => r.id !== id);
    setReferrals(updated);
    saveStoredReferrals(updated);
    showToast('Indicação removida.');
  };

  const handleSavePartner = (partner: Partner) => {
    let updated: Partner[];
    const exists = partners.some(p => p.id === partner.id);
    if (exists) {
      updated = partners.map(p => p.id === partner.id ? partner : p);
      showToast('Parceiro atualizado.');
    } else {
      updated = [...partners, partner];
      showToast('Novo parceiro cadastrado.');
    }
    setPartners(updated);
    saveStoredPartners(updated);
  };

  const handleDeletePartner = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    saveStoredPartners(updated);
    showToast('Parceiro removido.');
  };

  // Commission updates directly triggered from CommissionsView
  const handleUpdateCommission = (referralId: string, updates: Partial<Referral>) => {
    let targetRef: Referral | undefined;

    const updated = referrals.map(r => {
      if (r.id === referralId) {
        targetRef = { ...r, ...updates };
        return targetRef;
      }
      return r;
    });

    setReferrals(updated);
    saveStoredReferrals(updated);

    if (targetRef) {
      if (updates.commissionStatus === 'paga') {
        dispatchNotification({
          type: 'comissao_paga',
          title: `Comissão Paga com Sucesso: ${targetRef.partnerName}`,
          message: `Pagamento de ${formatCurrency(targetRef.commissionValue)} confirmado para ${targetRef.partnerName} (${targetRef.paymentMethod || 'PIX'}).`,
          referralId: targetRef.id,
          partnerId: targetRef.partnerId,
          partnerName: targetRef.partnerName,
          dealValue: targetRef.dealValue,
          commissionValue: targetRef.commissionValue
        });
        setNotifications(loadNotifications());
      } else if (updates.commissionStatus === 'a_pagar') {
        dispatchNotification({
          type: 'comissao_a_pagar',
          title: `Comissão a Pagar: ${targetRef.partnerName}`,
          message: `Comissão de ${formatCurrency(targetRef.commissionValue)} definida para liquidação.`,
          referralId: targetRef.id,
          partnerId: targetRef.partnerId,
          partnerName: targetRef.partnerName,
          dealValue: targetRef.dealValue,
          commissionValue: targetRef.commissionValue
        });
        setNotifications(loadNotifications());
      }
    }

    showToast('Status da comissão atualizado com sucesso!');
  };

  // Installment updates (NF attachment, scheduled payment, liquidation/receipt)
  const handleUpdateInstallment = (
    referralId: string, 
    installmentId: string, 
    updates: Partial<CommissionInstallment>
  ) => {
    let targetRef: Referral | undefined;
    let targetInstallment: CommissionInstallment | undefined;

    const updated = referrals.map(r => {
      if (r.id !== referralId) return r;

      const insts = (r.commissionInstallments || []).map(i => {
        if (i.id !== installmentId) return i;
        targetInstallment = { ...i, ...updates };
        return targetInstallment;
      });

      const newCommStatus = updateReferralCommissionStatusFromInstallments(insts);
      targetRef = {
        ...r,
        commissionInstallments: insts,
        commissionStatus: newCommStatus
      };
      return targetRef;
    });

    setReferrals(updated);
    saveStoredReferrals(updated);

    if (targetInstallment && targetRef) {
      if (updates.status === 'paga') {
        dispatchNotification({
          type: 'comissao_paga',
          title: `Comissão Parcela Paga: ${targetInstallment.partnerName}`,
          message: `Parcela (${targetInstallment.triggerDescription}) no valor de ${formatCurrency(targetInstallment.value)} paga com sucesso (${targetInstallment.paymentMethod || 'PIX'}). Comprovante anexado.`,
          referralId: targetRef.id,
          partnerId: targetRef.partnerId,
          partnerName: targetRef.partnerName,
          dealValue: targetRef.dealValue,
          commissionValue: targetInstallment.value
        });
        setNotifications(loadNotifications());
        showToast('Comprovante anexado e comissão liquidada com sucesso!');
      } else if (updates.status === 'agendada') {
        dispatchNotification({
          type: 'comissao_a_pagar',
          title: `Pagamento Agendado: ${targetInstallment.partnerName}`,
          message: `NF anexada. Pagamento de ${formatCurrency(targetInstallment.value)} agendado para ${targetInstallment.scheduledPaymentDate}.`,
          referralId: targetRef.id,
          partnerId: targetRef.partnerId,
          partnerName: targetRef.partnerName,
          dealValue: targetRef.dealValue,
          commissionValue: targetInstallment.value
        });
        setNotifications(loadNotifications());
        showToast('Nota Fiscal anexada e pagamento agendado!');
      } else if (updates.status === 'solicitada') {
        showToast('Parceiro notificado para emissão da NF!');
      }
    }
  };

  const handleImportSheetData = (result: SheetImportResult) => {
    // Reconcile the partner vínculo so imported referrals keep pointing to the correct partner id.
    // Matching priority: CNPJ/CPF -> ID Conexa -> Name (case-insensitive).
    const newPartners = [...partners];

    const findExistingPartner = (candidate: { document?: string; idConexa?: string; name: string }) => {
      const doc = normalizeDocument(candidate.document);
      const conexa = (candidate.idConexa || '').trim().toLowerCase();
      const name = (candidate.name || '').trim().toLowerCase();
      return newPartners.find(p => {
        if (doc && normalizeDocument(p.document) === doc) return true;
        if (conexa && (p.idConexa || '').trim().toLowerCase() === conexa) return true;
        if (name && (p.name || '').trim().toLowerCase() === name) return true;
        return false;
      });
    };

    // Map from the import-batch partner id -> the reconciled (existing or new) partner id.
    const partnerIdRemap = new Map<string, string>();

    result.partners.forEach(imported => {
      const existing = findExistingPartner(imported);
      if (existing) {
        // Backfill any fields the existing partner was missing, without overwriting good data.
        if (!existing.document && imported.document) existing.document = imported.document;
        if (!existing.idConexa && imported.idConexa) existing.idConexa = imported.idConexa;
        if (!existing.joinedDate && imported.joinedDate) existing.joinedDate = imported.joinedDate;
        if (!existing.profile && imported.profile) existing.profile = imported.profile;
        if (!existing.responsiblePerson && imported.responsiblePerson) existing.responsiblePerson = imported.responsiblePerson;
        partnerIdRemap.set(imported.id, existing.id);
      } else {
        newPartners.push(imported);
        partnerIdRemap.set(imported.id, imported.id);
      }
    });

    // Remap imported referrals to the reconciled partner id / name so the vínculo never breaks.
    const remappedReferrals = result.referrals.map(ref => {
      const targetId = partnerIdRemap.get(ref.partnerId) || ref.partnerId;
      const targetPartner = newPartners.find(p => p.id === targetId);
      return {
        ...ref,
        partnerId: targetId,
        partnerName: targetPartner ? targetPartner.name : ref.partnerName
      };
    });

    const newReferrals = [...remappedReferrals, ...referrals];
    setPartners(newPartners);
    setReferrals(newReferrals);
    saveStoredPartners(newPartners);
    saveStoredReferrals(newReferrals);

    showToast(`Planilha processada: ${result.referrals.length} linhas importadas.`);
    setActiveTab('referrals');
  };

  const handleChangeAccess = (next: AccessState) => {
    setAccess(next);
    saveAccess(next);
    // Ao entrar como executivo, limpa filtro de parceiro para não conflitar com o escopo da carteira.
    if (next.role === 'executivo') {
      setFilter(prev => ({ ...prev, partnerId: 'all' }));
    }
    showToast(
      next.role === 'master'
        ? 'Acesso Master ativado: visão completa do canal.'
        : `Acesso Executivo: exibindo a carteira de ${next.executive || '—'}.`
    );
  };

  // Master-only: cria N indicações "só número" (sem empresa) para preservar conversão e perdidos.
  const handleBulkCreateReferrals = (newRefs: Referral[]) => {
    if (!checkIsMaster(access)) {
      showToast('Apenas o acesso Master pode registrar indicações sem empresa.');
      return;
    }
    const updated = [...newRefs, ...referrals];
    setReferrals(updated);
    saveStoredReferrals(updated);
    showToast(`${newRefs.length} indicação(ões) sem empresa registradas para completar depois.`);
    setActiveTab('referrals');
  };

  // Backup: baixa todo o estado (parceiros + indicações + notificações) como JSON.
  const handleExportBackup = () => {
    try {
      const json = exportAllData();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_canal_parcerias_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Backup completo exportado com sucesso.');
    } catch (err) {
      console.error('Erro ao exportar backup', err);
      showToast('Falha ao exportar o backup.');
    }
  };

  // Restore: lê um arquivo JSON de backup e substitui o estado atual.
  const handleImportBackupFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      if (!window.confirm('Restaurar este backup substituirá TODOS os parceiros e indicações atuais. Deseja continuar?')) {
        return;
      }
      const result = importAllData(text);
      if (result.ok) {
        setPartners(result.partners);
        setReferrals(result.referrals);
        setNotifications(loadNotifications());
        showToast(result.message);
      } else {
        showToast(result.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = () => {
    if (window.confirm('Tem certeza de que deseja limpar todos os registros e começar com a base 100% zerada?')) {
      const { partners: p, referrals: r } = clearAllSystemData();
      setPartners(p);
      setReferrals(r);
      showToast('Todos os dados foram limpos. Base zerada para inserção manual.');
    }
  };

  // Notification action handlers
  const handleMarkNotificationAsRead = (id: string) => {
    const updated = markAsRead(id);
    setNotifications(updated);
  };

  const handleMarkAllNotificationsAsRead = () => {
    const updated = markAllAsRead();
    setNotifications(updated);
  };

  const handleClearAllNotifications = () => {
    clearNotifications();
    setNotifications([]);
  };

  // Quick navigation helpers
  const handleNavigateToReferrals = (onlyMissing?: boolean) => {
    if (onlyMissing) {
      setFilter(prev => ({ ...prev, onlyMissingData: true }));
    }
    setActiveTab('referrals');
  };

  const handleNavigateToCommissions = () => {
    setActiveTab('commissions');
  };

  const handleSelectPartner = (partnerId: string) => {
    setFilter(prev => ({ ...prev, partnerId }));
    setActiveTab('referrals');
  };

  // Derived access scoping: executivo vê apenas sua carteira; master vê tudo.
  const isMaster = checkIsMaster(access);
  const executives = listExecutives(partners);
  const visiblePartners = scopePartnersForAccess(partners, access);
  const visibleReferrals = scopeReferralsForAccess(referrals, partners, access);

  const incompleteCount =
    visibleReferrals.filter(r => r.hasMissingData).length +
    visiblePartners.filter(p => p.hasMissingData).length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Navigation Topbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewReferral={() => {
          setEditingReferral(null);
          setIsReferralModalOpen(true);
        }}
        onOpenNewPartner={() => {
          setEditingPartner(null);
          setIsPartnerModalOpen(true);
        }}
        incompleteCount={incompleteCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        access={access}
        executives={executives}
        onChangeAccess={handleChangeAccess}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <Dashboard
            referrals={visibleReferrals}
            partners={visiblePartners}
            filter={filter}
            onFilterChange={setFilter}
            onNavigateToReferrals={handleNavigateToReferrals}
            onNavigateToCommissions={handleNavigateToCommissions}
            onSelectPartner={handleSelectPartner}
            onOpenNewPartner={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            onOpenNewReferral={() => {
              setEditingReferral(null);
              setIsReferralModalOpen(true);
            }}
            onNavigateToSheets={() => setActiveTab('sheets')}
            onEditPartner={(p) => {
              setEditingPartner(p);
              setIsPartnerModalOpen(true);
            }}
            onEditReferral={(ref) => {
              setEditingReferral(ref);
              setIsReferralModalOpen(true);
            }}
          />
        )}

        {activeTab === 'referrals' && (
          <ReferralsTable
            referrals={visibleReferrals}
            partners={visiblePartners}
            filter={filter}
            onFilterChange={setFilter}
            onEditReferral={(ref) => {
              setEditingReferral(ref);
              setIsReferralModalOpen(true);
            }}
            onDeleteReferral={handleDeleteReferral}
            onOpenNewReferral={() => {
              setEditingReferral(null);
              setIsReferralModalOpen(true);
            }}
            isMaster={isMaster}
            onOpenBulk={() => setIsBulkModalOpen(true)}
          />
        )}

        {activeTab === 'commissions' && (
          <CommissionsView
            referrals={visibleReferrals}
            onUpdateInstallment={handleUpdateInstallment}
            onUpdateCommission={handleUpdateCommission}
            onEditReferral={(ref) => {
              setEditingReferral(ref);
              setIsReferralModalOpen(true);
            }}
          />
        )}

        {activeTab === 'partners' && (
          <PartnersView
            partners={visiblePartners}
            referrals={visibleReferrals}
            onOpenNewPartner={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            onEditPartner={(p) => {
              setEditingPartner(p);
              setIsPartnerModalOpen(true);
            }}
            onDeletePartner={handleDeletePartner}
            onSelectPartnerForReferrals={handleSelectPartner}
          />
        )}

        {activeTab === 'carteiras' && (
          <CarteirasView
            partners={visiblePartners}
            referrals={visibleReferrals}
            onSelectPartnerForReferrals={handleSelectPartner}
            onEditPartner={(p) => {
              setEditingPartner(p);
              setIsPartnerModalOpen(true);
            }}
          />
        )}

        {activeTab === 'sheets' && (
          <SheetsView
            onImportData={handleImportSheetData}
            referrals={visibleReferrals}
            partners={visiblePartners}
          />
        )}

        {activeTab === 'audit' && (
          <DataAuditView
            partners={visiblePartners}
            referrals={visibleReferrals}
            onEditPartner={(p) => {
              setEditingPartner(p);
              setIsPartnerModalOpen(true);
            }}
            onEditReferral={(ref) => {
              setEditingReferral(ref);
              setIsReferralModalOpen(true);
            }}
            onOpenSpreadsheetImport={() => setActiveTab('sheets')}
          />
        )}

        {activeTab === 'settings' && (
          <PlanSettingsView
            onSavedPlansChange={() => {
              showToast('Configurações de planos e comissões atualizadas com sucesso!');
            }}
          />
        )}

      </main>

      {/* Footer Info & System Management */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Sistema de Gestão de Indicações &amp; Fechamentos</span>
            <span className="text-slate-300">•</span>
            <span>Intervenção e Conferência Manual Humana (Sem Dados Fictícios)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNotificationSettingsOpen(true)}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition font-medium"
            >
              <Mail className="w-3.5 h-3.5 text-emerald-600" />
              <span>Configurar Alertas &amp; E-mail</span>
            </button>

            <span className="text-slate-200">|</span>

            <button
              onClick={handleExportBackup}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition font-medium"
              title="Exportar backup completo (parceiros + indicações) em JSON"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Backup</span>
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition font-medium"
              title="Restaurar backup a partir de um arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Restaurar Backup</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportBackupFile(file);
                e.target.value = '';
              }}
            />

            <span className="text-slate-200">|</span>

            <button
              onClick={handleClearAllData}
              className="text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
              title="Limpar todos os registros e começar do zero"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Dados / Começar do Zero</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Referral Modal */}
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => {
          setIsReferralModalOpen(false);
          setEditingReferral(null);
        }}
        onSave={handleSaveReferral}
        initialData={editingReferral}
        partners={partners}
      />

      {/* Partner Modal */}
      <PartnerModal
        isOpen={isPartnerModalOpen}
        onClose={() => {
          setIsPartnerModalOpen(false);
          setEditingPartner(null);
        }}
        onSave={handleSavePartner}
        initialData={editingPartner}
      />

      {/* Bulk (number-only) Referral Modal — master only */}
      <BulkReferralModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onCreate={handleBulkCreateReferrals}
        partners={partners}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearAll={handleClearAllNotifications}
        onOpenSettings={() => {
          setIsNotificationCenterOpen(false);
          setIsNotificationSettingsOpen(true);
        }}
        onNavigateToReferral={(refId) => {
          setActiveTab('referrals');
          if (refId) {
            const found = referrals.find(r => r.id === refId);
            if (found) {
              setEditingReferral(found);
              setIsReferralModalOpen(true);
            }
          }
        }}
        onNavigateToCommissions={() => setActiveTab('commissions')}
      />

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
        onSavedSettings={() => {
          showToast('Configurações de alertas atualizadas com sucesso!');
        }}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
