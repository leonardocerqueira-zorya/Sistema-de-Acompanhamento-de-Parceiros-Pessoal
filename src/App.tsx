/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Referral, Partner, FilterState, AppNotification, CommissionInstallment, AccessState, UserProfile } from './types';
import {
  loadStoredPartners,
  saveStoredPartners,
  loadStoredReferrals,
  saveStoredReferrals,
  clearAllSystemData,
  exportAllData,
  importAllData
} from './services/storageService';
import { syncWithCloud, flushToCloud } from './services/syncService';
import {
  loadAccess,
  saveAccess,
  isMaster as checkIsMaster,
  listExecutives,
  scopePartnersForAccess,
  scopeReferralsForAccess
} from './services/accessService';
import {
  isSupabaseConfigured,
  getSession,
  onAuthStateChange,
  loadOrClaimOwnProfile,
  signOut as authSignOut
} from './services/authService';
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
import { updateReferralCommissionStatusFromInstallments, backfillAllCommissions } from './utils/commissionLogic';
import Navbar, { type AppTab } from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import UsersView from './components/UsersView';
import ChannelMetricsView from './components/ChannelMetricsView';
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
import SetPasswordModal from './components/SetPasswordModal';
import { RotateCcw, ShieldCheck, Check, Trash2, Mail, Download, Upload } from 'lucide-react';

export default function App() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [access, setAccess] = useState<AccessState>({ role: 'master', executive: null });
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Sincronização com a cópia compartilhada na nuvem (ver syncService).
  const [syncStatus, setSyncStatus] = useState<'off' | 'syncing' | 'ok' | 'error'>(
    isSupabaseConfigured ? 'syncing' : 'off'
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const lastSyncMsRef = useRef(0);

  // Login real (Supabase Auth, magic link). Sem Supabase configurado, o app roda
  // no modo antigo (dropdown livre de acesso, sem login) — ver Navbar.tsx.
  const [session, setSession] = useState<Session | null>(null);
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const loadProfileFor = async (s: Session | null) => {
      if (!s || !s.user.email) {
        setAuthProfile(null);
        setAuthChecked(true);
        return;
      }
      try {
        const p = await loadOrClaimOwnProfile(s.user.id, s.user.email);
        if (!active) return;
        if (!p) {
          setAccessDeniedMsg('Seu e-mail ainda não foi convidado. Peça ao Master para te adicionar em Usuários.');
          await authSignOut();
          setSession(null);
          setAuthProfile(null);
        } else {
          setAuthProfile(p);
        }
      } catch (err) {
        console.error('Erro ao carregar perfil de acesso', err);
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    getSession().then(s => {
      setSession(s);
      loadProfileFor(s);
    });
    const unsubscribe = onAuthStateChange(s => {
      setSession(s);
      loadProfileFor(s);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await authSignOut();
    setSession(null);
    setAuthProfile(null);
  };

  // Com Supabase configurado, o acesso vem do login real (authProfile), não do dropdown livre.
  const effectiveAccess: AccessState = (isSupabaseConfigured && authProfile)
    ? { role: authProfile.role, executive: authProfile.executiveName }
    : access;

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
  const [isSetPasswordOpen, setIsSetPasswordOpen] = useState(false);

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

    // Auto-generate commission installments (parceiro + embaixador, se houver) for
    // any won referrals lacking them — cobre backfills feitos fora da tela de edição.
    const { referrals: initializedReferrals, changed } = backfillAllCommissions(loadedReferrals, loadedPartners);

    if (changed) {
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

  // Sincroniza com a cópia compartilhada na nuvem: baixa o que as outras
  // máquinas salvaram, mescla por id com o que existe aqui (união — nada é
  // descartado) e devolve o resultado reconciliado. Roda ao abrir o app e
  // quando a aba volta ao foco, para o time ver o trabalho um do outro.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const runSync = async (isInitial: boolean) => {
      if (!active) return;
      lastSyncMsRef.current = Date.now();
      setSyncStatus('syncing');

      const outcome = await syncWithCloud();
      if (!active) return;

      if (outcome.status === 'failed') {
        setSyncStatus('error');
        if (isInitial) showToast(outcome.message);
        return;
      }

      setSyncStatus('ok');
      setLastSyncAt(new Date().toISOString());

      // Realinha o estado do React com o que está gravado, sempre. O merge pode
      // ter escrito no armazenamento depois da carga inicial (ou numa execução
      // concorrente), e aí a tela mostraria menos dados do que já existem.
      // Nada em edição é perdido: todo save grava no armazenamento na hora.
      setPartners(loadStoredPartners());
      setReferrals(loadStoredReferrals());
      setNotifications(loadNotifications());

      if (outcome.status === 'adopted' || outcome.status === 'merged') {
        showToast(outcome.message);
      }
    };

    runSync(true);

    // Traz o que o time salvou enquanto esta aba estava em segundo plano.
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastSyncMsRef.current < 30000) return;
      void runSync(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // Garante que a última alteração sobe mesmo se a aba fechar dentro do debounce.
    const onHide = () => {
      void flushToCloud();
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('pagehide', onHide);
    };
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

    const { referrals: finalReferrals } = backfillAllCommissions(updated, partners);
    setReferrals(finalReferrals);
    saveStoredReferrals(finalReferrals);
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

    // Se um embaixador foi associado agora, gera comissão de embaixador retroativa
    // para indicações já ganhas desse parceiro.
    const { referrals: finalReferrals, changed } = backfillAllCommissions(referrals, updated);
    if (changed) {
      setReferrals(finalReferrals);
      saveStoredReferrals(finalReferrals);
    }
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

      // A parcela pode ser do parceiro indicador ou do embaixador — procura nos dois.
      const isInPartnerInsts = (r.commissionInstallments || []).some(i => i.id === installmentId);

      const commissionInstallments = isInPartnerInsts
        ? (r.commissionInstallments || []).map(i => {
            if (i.id !== installmentId) return i;
            targetInstallment = { ...i, ...updates };
            return targetInstallment;
          })
        : r.commissionInstallments;

      const ambassadorCommissionInstallments = isInPartnerInsts
        ? r.ambassadorCommissionInstallments
        : (r.ambassadorCommissionInstallments || []).map(i => {
            if (i.id !== installmentId) return i;
            targetInstallment = { ...i, ...updates };
            return targetInstallment;
          });

      targetRef = updateReferralCommissionStatusFromInstallments({
        ...r,
        commissionInstallments,
        ambassadorCommissionInstallments
      });
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
        if (!existing.accountOwner && imported.accountOwner) existing.accountOwner = imported.accountOwner;
        if (!existing.email && imported.email) existing.email = imported.email;
        if (!existing.phone && imported.phone) existing.phone = imported.phone;
        if (!existing.company && imported.company) existing.company = imported.company;
        if (!existing.city && imported.city) existing.city = imported.city;
        if (!existing.state && imported.state) existing.state = imported.state;
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

    const mergedReferrals = [...remappedReferrals, ...referrals];
    // Garante comissões (parceiro + embaixador) para indicações importadas já "ganho".
    const { referrals: newReferrals } = backfillAllCommissions(mergedReferrals, newPartners);
    setPartners(newPartners);
    setReferrals(newReferrals);
    saveStoredPartners(newPartners);
    saveStoredReferrals(newReferrals);

    const newPartnersCount = newPartners.length - partners.length;
    if (result.referrals.length > 0) {
      showToast(`Planilha processada: ${newPartnersCount} parceiro(s) novo(s) e ${result.referrals.length} indicação(ões) importada(s).`);
      setActiveTab('referrals');
    } else {
      showToast(`Planilha processada: ${newPartnersCount} parceiro(s) novo(s) importado(s) (${result.partners.length} linha(s) reconciliada(s)).`);
      setActiveTab('partners');
    }
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
    if (!checkIsMaster(effectiveAccess)) {
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
  const isMaster = checkIsMaster(effectiveAccess);
  const executives = listExecutives(partners);
  const visiblePartners = scopePartnersForAccess(partners, effectiveAccess);
  const visibleReferrals = scopeReferralsForAccess(referrals, partners, effectiveAccess);

  const incompleteCount =
    visibleReferrals.filter(r => r.hasMissingData).length +
    visiblePartners.filter(p => p.hasMissingData).length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // Gate: exige login real quando o Supabase está configurado.
  if (isSupabaseConfigured && !authChecked) {
    return <div className="min-h-screen bg-zry-roxo" />;
  }
  if (isSupabaseConfigured && !session) {
    return <Login deniedMessage={accessDeniedMsg} />;
  }

  return (
    <div className="min-h-screen bg-zry-creme text-zry-text flex selection:bg-zry-coral selection:text-zry-roxo">

      {/* Rail de navegação */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incompleteCount={incompleteCount}
        authProfile={authProfile}
        isMaster={isMaster}
      />

      <div className="flex-1 min-w-0 flex flex-col sm:ml-16 pb-16 sm:pb-0">

        {/* Barra superior */}
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
          authProfile={authProfile}
          onLogout={isSupabaseConfigured ? handleLogout : undefined}
          onOpenSetPassword={isSupabaseConfigured ? () => setIsSetPasswordOpen(true) : undefined}
          onSearch={(query) => setFilter(prev => ({ ...prev, searchQuery: query }))}
          syncStatus={syncStatus}
          lastSyncAt={lastSyncAt}
        />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1480px] mx-auto px-5 sm:px-8 lg:px-10 py-8">

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
            isMaster={isMaster}
            onNavigateToChannelMetrics={() => setActiveTab('channel-metrics')}
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

        {activeTab === 'channel-metrics' && (
          <ChannelMetricsView referrals={referrals} isMaster={isMaster} />
        )}

        {activeTab === 'settings' && (
          <PlanSettingsView
            onSavedPlansChange={() => {
              showToast('Configurações de planos e comissões atualizadas com sucesso!');
            }}
          />
        )}

        {activeTab === 'users' && authProfile?.role === 'master' && (
          <UsersView
            currentUserId={authProfile.id}
            executiveSuggestions={executives}
          />
        )}

      </main>

      {/* Footer Info & System Management */}
      <footer className="border-t border-zry-border py-5 mt-10 text-[11px] text-zry-text-2">
        <div className="max-w-[1480px] mx-auto px-5 sm:px-8 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zry-positive inline-block"></span>
            <span>Gestão de indicações &amp; fechamentos</span>
            <span className="text-zry-border-strong">•</span>
            <span>Conferência manual, sem dados fictícios</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              onClick={() => setIsNotificationSettingsOpen(true)}
              className="hover:text-zry-roxo flex items-center gap-1.5 transition font-semibold"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Alertas &amp; e-mail</span>
            </button>

            <button
              onClick={handleExportBackup}
              className="hover:text-zry-roxo flex items-center gap-1.5 transition font-semibold"
              title="Exportar backup completo (parceiros + indicações) em JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar backup</span>
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              className="hover:text-zry-roxo flex items-center gap-1.5 transition font-semibold"
              title="Restaurar backup a partir de um arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restaurar backup</span>
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

            <button
              onClick={handleClearAllData}
              className="hover:text-zry-danger flex items-center gap-1.5 transition"
              title="Limpar todos os registros e começar do zero"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar dados</span>
            </button>
          </div>
        </div>
      </footer>

      </div>

      {/* Referral Modal */}
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => {
          setIsReferralModalOpen(false);
          setEditingReferral(null);
        }}
        onSave={handleSaveReferral}
        initialData={editingReferral}
        partners={visiblePartners}
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
        partners={partners}
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

      {/* Set Password Modal */}
      <SetPasswordModal
        isOpen={isSetPasswordOpen}
        onClose={() => setIsSetPasswordOpen(false)}
        userEmail={authProfile?.email}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-5 z-50 bg-zry-roxo text-zry-creme text-xs px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-zry-coral" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
