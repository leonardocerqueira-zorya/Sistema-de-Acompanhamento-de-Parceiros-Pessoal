import { useState, useEffect, useMemo, type FormEvent } from 'react';
import type { Partner, PartnerStatus, PartnerProfile, Referral } from '../types';
import { Users, Calendar, AlertTriangle, ShieldCheck, Tag, Award, Activity } from 'lucide-react';
import { evaluatePartnerMissingFields } from '../services/sheetsService';
import { normalizeDocument, formatDocument } from '../utils/analytics';
import { loadStoredPartnerTiers } from '../data/tiersData';
import { BRAZIL_STATES, fetchCitiesByState } from '../data/brazilLocations';
import { listProfiles, listPendingInvites } from '../services/authService';
import {
  calculatePartnerEngagement,
  statusFromEngagement,
  ENGAGEMENT_ZERO_DAYS,
  ENGAGEMENT_DECAY_PER_DAY,
  ENGAGEMENT_ONBOARDING_MAX_DAYS,
  ENGAGEMENT_RISK_THRESHOLD,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_BADGE
} from '../utils/partnerEngagement';
import EngagementBar from './EngagementBar';

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (partner: Partner) => void;
  initialData?: Partner | null;
  partners?: Partner[];
  /** Indicações do canal — entram no cálculo do status automático. */
  referrals?: Referral[];
}

const PARTNER_PROFILES: PartnerProfile[] = [
  'Contabilidade',
  'BPO DP/RH',
  'Representante de Softwares',
  'Consultor de Negócios'
];

export default function PartnerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  partners = [],
  referrals = []
}: PartnerModalProps) {
  const partnerTiers = loadStoredPartnerTiers();
  const [name, setName] = useState('');
  const [idConexa, setIdConexa] = useState('');
  const [document, setDocument] = useState('');
  const [profile, setProfile] = useState<PartnerProfile | ''>('Contabilidade');
  const [tier, setTier] = useState('');
  const [ambassadorId, setAmbassadorId] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [accountOwner, setAccountOwner] = useState('');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [hasSignedContract, setHasSignedContract] = useState<'' | 'sim' | 'nao'>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Município é lista do IBGE filtrada por UF, não texto livre (nome digitado
  // errado quebrava relatório por cidade). Busca de novo a cada troca de UF;
  // o valor atual entra na lista mesmo se a busca ainda não voltou, pra não
  // sumir com o dado já salvo enquanto carrega.
  useEffect(() => {
    if (!state) {
      setCityOptions([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    fetchCitiesByState(state).then(names => {
      if (!cancelled) {
        setCityOptions(names);
        setCitiesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const cityOptionsWithCurrent =
    city && !cityOptions.includes(city) ? [city, ...cityOptions] : cityOptions;
  const stateOptionsWithCurrent =
    state && !BRAZIL_STATES.some(s => s.uf === state)
      ? [{ uf: state, name: state }, ...BRAZIL_STATES]
      : BRAZIL_STATES;

  const missingFieldsList = initialData ? evaluatePartnerMissingFields(initialData) : [];

  // Status não é escolhido, é consequência: a régua de saúde (decaimento por
  // dias sem indicar + indicações registradas) diz ativo / onboarding /
  // inativo. Recalcula junto com a Data de Entrada digitada aqui, porque é
  // dela que o decaimento parte — a pessoa vê o efeito antes de salvar.
  const engagement = useMemo(() => {
    const candidate: Partner = {
      ...(initialData ?? ({ id: '__novo__', name: '', status: 'ativo' } as Partner)),
      joinedDate: joinedDate || undefined
    };
    return calculatePartnerEngagement(candidate, referrals);
  }, [initialData, joinedDate, referrals]);

  // null = sem Data de Entrada, a régua não tem de quando decair. Aí o status
  // gravado fica como está (e o cadastro novo entra como ativo).
  const derivedStatus = statusFromEngagement(engagement);
  const status: PartnerStatus = derivedStatus ?? initialData?.status ?? 'ativo';

  const daysToZero =
    engagement.score !== null && engagement.score > 0
      ? Math.ceil(engagement.score / ENGAGEMENT_DECAY_PER_DAY)
      : 0;

  // Dias que ainda restam da janela de onboarding (só faz sentido sem indicação).
  const onboardingDaysLeft = Math.max(
    0,
    ENGAGEMENT_ONBOARDING_MAX_DAYS - (engagement.daysSinceJoined ?? 0)
  );

  // Risco tem duas causas e elas pedem ações diferentes: quem estourou o
  // onboarding nunca engatou a primeira indicação, quem decaiu já indicou e
  // parou. Dizer qual é evita procurar a explicação no lugar errado.
  const riskReason =
    engagement.referralCount === 0
      ? `Passaram ${engagement.daysSinceJoined} dias da entrada e nenhuma indicação foi registrada — o onboarding vale ${ENGAGEMENT_ONBOARDING_MAX_DAYS} dias. Inativa em ${daysToZero} dia(s); a primeira indicação ativa na hora.`
      : `Engajamento em ${Math.round(engagement.score ?? 0)}%, abaixo do limiar de ${ENGAGEMENT_RISK_THRESHOLD}%. Inativa em ${daysToZero} dia(s) sem indicar.`;

  const statusExplanation =
    derivedStatus === null
      ? `Preencha a Data de Entrada para o status ser calculado. Até lá vale o atual: ${PARTNER_STATUS_LABEL[status]}.`
      : status === 'inativo'
        ? `${ENGAGEMENT_ZERO_DAYS} dias sem indicar zeraram o engajamento. Uma indicação nova reativa na hora.`
        : status === 'onboarding'
          ? `Parceiro novo, ainda sem indicar: restam ${onboardingDaysLeft} de ${ENGAGEMENT_ONBOARDING_MAX_DAYS} dia(s) de onboarding. A primeira indicação passa para Ativo.`
          : status === 'risco'
            ? riskReason
            : `${engagement.referralCount} indicação(ões) registrada(s). Zera em ${daysToZero} dia(s) sem indicar de novo.`;

  // Executivos conhecidos pelo Usuários — perfil já criado (fez login) OU convite
  // enviado e ainda não aceito. Contam como executivo dos dois jeitos: o Master
  // já pode montar a carteira antes da pessoa sequer entrar no sistema.
  // Só o Master enxerga essas listas completas via RLS; se vier vazio (sem
  // Supabase, ou usuário sem acesso), cai pro campo de texto livre como fallback.
  const [registeredExecutives, setRegisteredExecutives] = useState<string[]>([]);
  const [pendingOnlyExecutives, setPendingOnlyExecutives] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([listProfiles(), listPendingInvites()])
      .then(([profiles, invites]) => {
        const activeNames = new Set(
          profiles
            .filter(p => p.role === 'executivo' && p.executiveName)
            .map(p => (p.executiveName as string).trim())
        );
        const pendingNames = new Set(
          invites
            .filter(i => i.role === 'executivo' && i.executiveName)
            .map(i => (i.executiveName as string).trim())
        );

        const allNames = Array.from(new Set([...activeNames, ...pendingNames]))
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        // "Só pendente": convidado mas ainda sem perfil criado (não fez login ainda).
        const pendingOnly = new Set(Array.from(pendingNames).filter(n => !activeNames.has(n)));

        setRegisteredExecutives(allNames);
        setPendingOnlyExecutives(pendingOnly);
      })
      .catch(() => {
        setRegisteredExecutives([]);
        setPendingOnlyExecutives(new Set());
      });
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setIdConexa(initialData.idConexa || '');
      setDocument(initialData.document ? formatDocument(initialData.document) : '');
      setProfile((initialData.profile as PartnerProfile) || 'Contabilidade');
      setTier(initialData.tier || '');
      setAmbassadorId(initialData.ambassadorId || '');
      setResponsiblePerson(initialData.responsiblePerson || '');
      setAccountOwner(initialData.accountOwner || '');
      setCompany(initialData.company || '');
      setCity(initialData.city || '');
      setState(initialData.state || '');
      setHasSignedContract(
        initialData.hasSignedContract === true ? 'sim' : initialData.hasSignedContract === false ? 'nao' : ''
      );
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setJoinedDate(initialData.joinedDate || '');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setIdConexa('');
      setDocument('');
      setProfile('Contabilidade');
      setTier('');
      setAmbassadorId('');
      setResponsiblePerson('');
      setAccountOwner('');
      setCompany('');
      setCity('');
      setState('');
      setHasSignedContract('');
      setEmail('');
      setPhone('');
      setJoinedDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do parceiro.');
      return;
    }

    const updatedPartner: Partner = {
      id: initialData ? initialData.id : 'p-' + Math.random().toString(36).substring(2, 9),
      idConexa: idConexa.trim() || undefined,
      document: normalizeDocument(document) || undefined,
      name: name.trim(),
      profile: (profile as PartnerProfile) || undefined,
      tier: tier || undefined,
      ambassadorId: ambassadorId || undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      accountOwner: accountOwner.trim() || undefined,
      company: company.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim().toUpperCase() || undefined,
      hasSignedContract: hasSignedContract === '' ? undefined : hasSignedContract === 'sim',
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      joinedDate: joinedDate || undefined,
      status,
      notes: notes.trim() || undefined
    };

    const missing = evaluatePartnerMissingFields(updatedPartner);
    updatedPartner.hasMissingData = missing.length > 0;
    updatedPartner.missingFields = missing;

    onSave(updatedPartner);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl max-w-3xl w-full p-6 shadow-lg border border-zry-border my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zry-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zry-lilas-30 text-zry-roxo rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zry-text">
                {initialData ? 'Editar Cadastro do Parceiro' : 'Cadastrar Novo Parceiro'}
              </h3>
              <p className="text-xs text-zry-text-2">
                Identificação, perfil de atuação e integração Conexa ERP
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zry-text-2 hover:text-zry-text font-bold text-sm">✕</button>
        </div>

        {/* Missing fields banner if opened for auditing */}
        {missingFieldsList.length > 0 && (
          <div className="mt-4 bg-zry-warning-bg border border-zry-warning/30 text-zry-warning text-[12px] p-3.5 rounded-zry-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-zry-warning shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Dados pendentes de preenchimento manual:</span>
              <p className="text-zry-warning mt-0.5">
                Os seguintes campos estão nulos e precisam ser preenchidos para completar o cadastro:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {missingFieldsList.map(field => (
                  <span key={field} className="bg-zry-warning/80 text-zry-warning font-semibold px-2 py-0.5 rounded-full text-[10px]">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                Nome do Parceiro *
              </label>
              <input
                type="text"
                placeholder="Ex: Nexus Contabilidade ou João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>ID Conexa</span>
                {!idConexa && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: CX-PAR-101"
                value={idConexa}
                onChange={(e) => setIdConexa(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text font-mono text-xs focus:outline-none focus:border-zry-border-strong ${!idConexa ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.2fr_1.2fr_auto_1fr] gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>CNPJ / CPF do Parceiro *</span>
                {!document && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                onBlur={(e) => { const f = formatDocument(e.target.value); if (f !== '—') setDocument(f); }}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text font-mono text-xs focus:outline-none focus:border-zry-border-strong ${!document ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Empresa / Razão Social</label>
              <input
                type="text"
                placeholder="Ex: Nexus Soluções Contábeis LTDA"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">UF</label>
              <select
                value={state}
                onChange={(e) => {
                  const v = e.target.value;
                  setState(v);
                  if (v !== state) setCity('');
                }}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2.5 text-[13px] text-zry-text font-bold focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                <option value="">Selecione</option>
                {stateOptionsWithCurrent.map(s => (
                  <option key={s.uf} value={s.uf}>{s.uf}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Cidade</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!state}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition disabled:opacity-50"
              >
                <option value="">
                  {!state ? 'Selecione o estado primeiro' : citiesLoading ? 'Carregando...' : 'Selecione'}
                </option>
                {cityOptionsWithCurrent.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Perfil do Parceiro *</span>
                {!profile && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as PartnerProfile)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                {PARTNER_PROFILES.map(prof => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Pessoa de Contato (no parceiro)</span>
                {!responsiblePerson && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="text"
                placeholder="Ex: contador, DP ou o próprio parceiro"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text focus:outline-none focus:border-zry-border-strong ${!responsiblePerson ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                Executivo Responsável (Zorya / QRPoint)
              </label>
              {registeredExecutives.length > 0 ? (
                <select
                  value={accountOwner}
                  onChange={(e) => setAccountOwner(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                >
                  <option value="">Nenhum</option>
                  {accountOwner && !registeredExecutives.includes(accountOwner) && (
                    <option value={accountOwner}>{accountOwner} (não cadastrado)</option>
                  )}
                  {registeredExecutives.map(ex => (
                    <option key={ex} value={ex}>
                      {ex}{pendingOnlyExecutives.has(ex) ? ' (convite pendente)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ex: Mariana Ramos ou Carlos Eduardo"
                  value={accountOwner}
                  onChange={(e) => setAccountOwner(e.target.value)}
                  className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                />
              )}
              <p className="text-[10px] text-zry-text-2 mt-1">
                {registeredExecutives.length > 0
                  ? 'Lista vem de Usuários — inclui quem já entrou e quem só recebeu o convite ainda. Define a carteira exibida quando esse executivo fizer login.'
                  : 'Nenhum executivo cadastrado ou convidado em Usuários ainda — digite o nome livremente por enquanto.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-zry-warning" />
                <span>Tier do Parceiro</span>
              </label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                <option value="">Sem tier definido</option>
                {partnerTiers.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-[10px] text-zry-text-2 mt-1">Editável em Configurações.</p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Embaixador Associado</label>
              <select
                value={ambassadorId}
                onChange={(e) => setAmbassadorId(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                <option value="">Nenhum</option>
                {partners
                  .filter(p => p.id !== initialData?.id)
                  .filter(p => p.tier?.toLowerCase().includes('embaixador') || p.id === ambassadorId)
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.tier ? ` (${p.tier})` : ''}
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-zry-text-2 mt-1">
                Quem trouxe este parceiro pro programa — gera comissão pra ele nas indicações fechadas deste parceiro. Só parceiros com tier Embaixador aparecem aqui.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zry-positive" />
                <span>Possui Contrato Assinado?</span>
              </label>
              <div className="grid grid-cols-2 gap-1 bg-zry-lilas p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setHasSignedContract('sim')}
                  className={`py-2 rounded-full font-bold text-[12px] transition ${hasSignedContract === 'sim' ? 'bg-zry-surface text-zry-text' : 'text-zry-text-2 hover:text-zry-text'}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setHasSignedContract('nao')}
                  className={`py-2 rounded-full font-bold text-[12px] transition ${hasSignedContract === 'nao' ? 'bg-zry-surface text-zry-text' : 'text-zry-text-2 hover:text-zry-text'}`}
                >
                  Não
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-zry-text mb-1.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zry-text-2" />
                <span>Status do Parceiro</span>
                <span className="text-[9.5px] font-bold text-zry-text-2 uppercase tracking-wide bg-zry-lilas-30 rounded-full px-1.5 py-0.5">
                  automático
                </span>
              </label>
              <div className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${PARTNER_STATUS_BADGE[status]}`}>
                    {PARTNER_STATUS_LABEL[status]}
                  </span>
                  <span className="text-[10.5px] font-semibold text-zry-text-2">
                    {engagement.score === null ? 'sem engajamento' : `${Math.round(engagement.score)}% de engajamento`}
                  </span>
                </div>
                <div className="mt-2">
                  <EngagementBar
                    score={engagement.score}
                    level={engagement.level}
                    showLabel={false}
                    size="sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-zry-text-2 mt-1">{statusExplanation}</p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5 flex items-center justify-between">
                <span>Data de Entrada no Programa *</span>
                {!joinedDate && <span className="text-[10px] text-zry-warning font-bold">Pendente</span>}
              </label>
              <input
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                className={`w-full bg-zry-lilas-30 border rounded-xl px-3 py-2 text-zry-text font-medium focus:outline-none focus:border-zry-border-strong ${!joinedDate ? 'border-zry-warning/40 bg-zry-warning-bg' : 'border-zry-border'}`}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">E-mail de Contato</label>
              <input
                type="email"
                placeholder="parceiro@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Observações do Acordo</label>
            <textarea
              rows={2}
              placeholder="Regras de comissão acordadas, modelo de indicação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
            />
          </div>

          {/* Buttons */}
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
              {initialData ? 'Salvar Parceiro' : 'Cadastrar Parceiro'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
