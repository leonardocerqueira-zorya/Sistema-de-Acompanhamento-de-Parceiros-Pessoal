import { useState, useEffect, type FormEvent } from 'react';
import type { Partner, PartnerStatus, PartnerProfile } from '../types';
import { Users, Calendar, AlertTriangle, ShieldCheck, Tag, Award } from 'lucide-react';
import { evaluatePartnerMissingFields } from '../services/sheetsService';
import { normalizeDocument, formatDocument } from '../utils/analytics';
import { loadStoredPartnerTiers } from '../data/tiersData';
import { listProfiles, listPendingInvites } from '../services/authService';

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (partner: Partner) => void;
  initialData?: Partner | null;
  partners?: Partner[];
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
  partners = []
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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [status, setStatus] = useState<PartnerStatus>('ativo');
  const [notes, setNotes] = useState('');

  const missingFieldsList = initialData ? evaluatePartnerMissingFields(initialData) : [];

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
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setJoinedDate(initialData.joinedDate || '');
      setStatus(initialData.status || 'ativo');
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
      setEmail('');
      setPhone('');
      setJoinedDate(new Date().toISOString().slice(0, 10));
      setStatus('ativo');
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
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl max-w-xl w-full p-6 shadow-lg border border-zry-border my-8">
        
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Cidade</label>
              <input
                type="text"
                placeholder="Ex: São Paulo"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">UF</label>
              <input
                type="text"
                maxLength={2}
                placeholder="SP"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="w-20 bg-zry-lilas-30 border border-transparent rounded-xl px-3 py-2.5 text-[13px] text-zry-text font-bold text-center uppercase focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.tier ? ` (${p.tier})` : ''}
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-zry-text-2 mt-1">
                Quem trouxe este parceiro pro programa — gera comissão pra ele nas indicações fechadas deste parceiro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Status do Parceiro</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PartnerStatus)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              >
                <option value="ativo">Ativo</option>
                <option value="onboarding">Em Onboarding</option>
                <option value="inativo">Inativo</option>
              </select>
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
