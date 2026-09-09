import { getAccessToken } from './firebaseAuth';
import { normalizeDocument } from '../utils/analytics';
import type { Referral, Partner, DealStatus, CommissionStatus } from '../types';

export interface SheetImportResult {
  partners: Partner[];
  referrals: Referral[];
  totalRows: number;
  rowsWithMissingData: number;
}

// Helper to extract spreadsheet ID from Google Sheet URL or direct ID
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// Fetch spreadsheet metadata (title and sheet tabs)
export async function getSpreadsheetDetails(spreadsheetId: string): Promise<{ title: string; sheets: string[] }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticação Google necessária para acessar o Google Sheets.');
  }

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Erro ${response.status} ao acessar a planilha`;
    throw new Error(message);
  }

  const data = await response.json();
  const title = data.properties?.title || 'Planilha Sem Título';
  const sheets = (data.sheets || []).map((s: { properties: { title: string } }) => s.properties.title);

  return { title, sheets };
}

// Read raw values from a Google Sheet range
export async function readSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Autenticação Google necessária para ler a planilha.');
  }

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const encodedRange = encodeURIComponent(range);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedRange}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Erro ao ler intervalo ${range}`);
  }

  const data = await response.json();
  return data.values || [];
}

// Check missing fields for Partners
export function evaluatePartnerMissingFields(partner: Partial<Partner>): string[] {
  const missing: string[] = [];
  if (!partner.name || partner.name.trim() === '') missing.push('Nome do Parceiro');
  if (!partner.document || partner.document.trim() === '') missing.push('CNPJ/CPF do Parceiro');
  if (!partner.joinedDate || partner.joinedDate.trim() === '') missing.push('Data de Entrada no Programa');
  if (!partner.idConexa || partner.idConexa.trim() === '') missing.push('ID Conexa');
  if (!partner.profile || partner.profile.trim() === '') missing.push('Perfil do Parceiro');
  if (!partner.responsiblePerson || partner.responsiblePerson.trim() === '') missing.push('Pessoa Responsável');
  if ((!partner.email || partner.email.trim() === '') && (!partner.phone || partner.phone.trim() === '')) {
    missing.push('E-mail ou Telefone de Contato');
  }
  return missing;
}

// Check missing fields and build referral object without inventing missing data
// "Linha ou coluna em branco não é 0 é nulo."
export function evaluateMissingFields(ref: Partial<Referral>): string[] {
  // Indicação "só número" (sem empresa): conta como uma única pendência — completar o cadastro.
  // Não sinalizamos cada campo individual para não poluir a auditoria com dezenas de nulos por design.
  if (ref.isPlaceholder && (!ref.clientName || ref.clientName.trim() === '')) {
    return ['Empresa/Cliente não vinculado — completar cadastro'];
  }

  const missing: string[] = [];
  if (!ref.partnerName || ref.partnerName.trim() === '') missing.push('Nome do Parceiro');
  if (!ref.clientName || ref.clientName.trim() === '') missing.push('Razão Social / Nome do Cliente');
  if (!ref.clientDocument || ref.clientDocument.trim() === '') missing.push('CNPJ/CPF do Cliente');
  if (!ref.referralDate || ref.referralDate.trim() === '') missing.push('Data da Indicação');
  if (!ref.idConexa || ref.idConexa.trim() === '') missing.push('ID Conexa');
  if (!ref.responsiblePerson || ref.responsiblePerson.trim() === '') missing.push('Pessoa Responsável');
  
  // If deal is won (fechada/ganho), close date, deal value, invoice due day and commission are expected
  if (ref.dealStatus === 'ganho') {
    if (ref.dealValue === undefined || ref.dealValue === null || ref.dealValue <= 0) {
      missing.push('Valor do Negócio Fechado');
    }
    if (!ref.closeDate || ref.closeDate.trim() === '') {
      missing.push('Data de Fechamento');
    }
    if (ref.commissionValue === undefined || ref.commissionValue === null || ref.commissionValue <= 0) {
      missing.push('Valor da Comissão Fixa');
    }
    if (!ref.invoiceDueDay) {
      missing.push('Dia de Vencimento da Fatura');
    }
  }

  // If commission is marked as paid, payment date is expected
  if (ref.commissionStatus === 'paga') {
    if (!ref.commissionPaidDate || ref.commissionPaidDate.trim() === '') {
      missing.push('Data do Pagamento da Comissão');
    }
  }

  return missing;
}

// Calculate comprehensive audit metrics for the data quality bar
export function calculateDataAuditMetrics(partners: Partner[], referrals: Referral[]): {
  totalRecords: number;
  totalFieldsAudited: number;
  totalFieldsCompleted: number;
  totalFieldsMissing: number;
  completionPercentage: number;
  missingPercentage: number;
  partnersWithMissingCount: number;
  referralsWithMissingCount: number;
} {
  let totalFieldsAudited = 0;
  let totalFieldsCompleted = 0;
  let totalFieldsMissing = 0;
  let partnersWithMissingCount = 0;
  let referralsWithMissingCount = 0;

  // Partner fields: name, joinedDate, idConexa, profile, responsiblePerson, email/phone
  partners.forEach(p => {
    const partnerAuditFields = [
      p.name,
      p.document,
      p.joinedDate,
      p.idConexa,
      p.profile,
      p.responsiblePerson,
      (p.email || p.phone)
    ];

    partnerAuditFields.forEach(val => {
      totalFieldsAudited++;
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        totalFieldsCompleted++;
      } else {
        totalFieldsMissing++;
      }
    });

    const missing = evaluatePartnerMissingFields(p);
    if (missing.length > 0) {
      partnersWithMissingCount++;
    }
  });

  // Referral fields: clientName, partnerName, referralDate, idConexa, responsiblePerson, dealStatus
  // Plus conditional fields if won: closeDate, dealValue, commissionValue, invoiceDueDay
  referrals.forEach(r => {
    // Placeholder (só número): conta como 1 pendência de cadastro, sem auditar campo a campo
    // (evita derrubar o índice de preenchimento com nulos que existem por design).
    if (r.isPlaceholder && (!r.clientName || r.clientName.trim() === '')) {
      referralsWithMissingCount++;
      return;
    }

    const refCoreFields = [
      r.clientName,
      r.clientDocument,
      r.partnerName,
      r.referralDate,
      r.idConexa,
      r.responsiblePerson,
      r.dealStatus
    ];

    refCoreFields.forEach(val => {
      totalFieldsAudited++;
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        totalFieldsCompleted++;
      } else {
        totalFieldsMissing++;
      }
    });

    if (r.dealStatus === 'ganho') {
      const wonFields = [
        r.closeDate,
        r.dealValue,
        r.commissionValue,
        r.invoiceDueDay
      ];
      wonFields.forEach(val => {
        totalFieldsAudited++;
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          totalFieldsCompleted++;
        } else {
          totalFieldsMissing++;
        }
      });
    }

    const missing = evaluateMissingFields(r);
    if (missing.length > 0) {
      referralsWithMissingCount++;
    }
  });

  const totalRecords = partners.length + referrals.length;
  const completionPercentage = totalFieldsAudited > 0
    ? Math.round((totalFieldsCompleted / totalFieldsAudited) * 1000) / 10
    : 100;
  const missingPercentage = totalFieldsAudited > 0
    ? Math.round((totalFieldsMissing / totalFieldsAudited) * 1000) / 10
    : 0;

  return {
    totalRecords,
    totalFieldsAudited,
    totalFieldsCompleted,
    totalFieldsMissing,
    completionPercentage,
    missingPercentage,
    partnersWithMissingCount,
    referralsWithMissingCount
  };
}

// Normalize deal status string from spreadsheets
function parseDealStatus(value: string | undefined): DealStatus {
  if (!value) return 'novo';
  const v = value.toLowerCase().trim();
  if (v === 'enviada' || v === 'enviado' || v === 'novo' || v === 'nova') return 'novo';
  if (v.includes('ganho') || v.includes('fechad') || v.includes('won') || v.includes('vendid') || v.includes('aprovad')) return 'ganho';
  if (v.includes('perdid') || v.includes('cancelad') || v.includes('lost') || v.includes('recusad')) return 'perdido';
  if (v.includes('negoc') || v.includes('propost') || v.includes('pipeline')) return 'negociacao';
  if (v.includes('qualif')) return 'qualificado';
  if (v.includes('contat') || v.includes('andamento') || v.includes('lead')) return 'contato';
  return 'novo';
}

// Normalize commission status string from spreadsheets
function parseCommissionStatus(value: string | undefined, dealStatus: DealStatus): CommissionStatus {
  if (!value) {
    return dealStatus === 'ganho' ? 'a_pagar' : 'pendente_fechamento';
  }
  const v = value.toLowerCase().trim();
  if (v.includes('paga') || v.includes('liquid') || v.includes('quitad') || v.includes('paid')) return 'paga';
  if (v.includes('cancel')) return 'cancelada';
  if (v.includes('pagar') || v.includes('devid') || v.includes('aberto')) return 'a_pagar';
  return 'pendente_fechamento';
}

// Parse currency or number from cell string
export function parseCurrency(val: string | number | undefined | null): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  // Clean R$, $, dots, commas
  const cleaned = val.toString().replace(/R\$\s?|\$/g, '').trim();
  // Handle Brazilian format: 1.234,56 -> 1234.56
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? undefined : num;
}

// Parse date into YYYY-MM-DD
export function parseDateString(val: string | undefined | null): string | undefined {
  if (!val || val.trim() === '') return undefined;
  const s = val.trim();
  // If DD/MM/YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    let year = brMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  // If already YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

// Convert parsed matrix from spreadsheet into structured Partners and Referrals
export function parseSpreadsheetRows(rows: string[][]): SheetImportResult {
  if (rows.length < 2) {
    return { partners: [], referrals: [], totalRows: 0, rowsWithMissingData: 0 };
  }

  const headers = rows[0].map(h => (h || '').toLowerCase().trim());

  // Map header indexes
  const partnerIdx = headers.findIndex(h => h.includes('parceir') || h.includes('indicador') || h.includes('canal'));
  const partnerDateIdx = headers.findIndex(h => h.includes('entrada') || h.includes('cadastro') || h.includes('onboarding'));
  const partnerProfileIdx = headers.findIndex(h => h.includes('perfil') || h.includes('tipo parceir') || h.includes('categoria'));
  const responsibleIdx = headers.findIndex(h => h.includes('respons') || h.includes('executiv') || h.includes('gestor') || h.includes('sdr'));
  const conexaIdx = headers.findIndex(h => h.includes('conexa') || h.includes('id_conexa') || h.includes('erp'));

  // CNPJ/CPF columns. A referral sheet has an explicit "cnpj_cpf_cliente"; a partner sheet has a generic "cnpj_cpf".
  const hasDocWord = (h: string) => h.includes('cnpj') || h.includes('cpf') || h.includes('documento') || h.includes('doc ');
  const docPartnerIdx = headers.findIndex(h => hasDocWord(h) && (h.includes('parceir') || h.includes('indicador')));
  const docClientIdx = headers.findIndex(h => hasDocWord(h) && (h.includes('client') || h.includes('razao') || h.includes('empresa')));
  const docAnyIdx = headers.findIndex(h => hasDocWord(h));

  const clientIdx = headers.findIndex(h => h.includes('cliente') || h.includes('empresa') || h.includes('lead') || h.includes('indica') || h.includes('razao'));
  const refDateIdx = headers.findIndex(h => h.includes('data') && (h.includes('indica') || h.includes('envio') || h.includes('registro')));
  const statusIdx = headers.findIndex(h => (h.includes('status') || h.includes('estagio') || h.includes('fase')) && !h.includes('comis') && !h.includes('pagamento'));
  const valueIdx = headers.findIndex(h => h.includes('valor') && (h.includes('neg') || h.includes('fech') || h.includes('contrat') || h.includes('venda') || h.includes('liquido') || h.includes('mrr')));
  const closeDateIdx = headers.findIndex(h => h.includes('fechamento') || (h.includes('data') && h.includes('ganho')));
  const invoiceDueIdx = headers.findIndex(h => h.includes('vencimento') || h.includes('fatura') || h.includes('dia_venc'));
  const commPercentIdx = headers.findIndex(h => (h.includes('%') || h.includes('perc')) && h.includes('comis'));
  const commValueIdx = headers.findIndex(h => h.includes('comiss') && (h.includes('valor') || h.includes('r$')));
  const commStatusIdx = headers.findIndex(h => h.includes('comis') && (h.includes('status') || h.includes('pag')));
  const commPaidDateIdx = headers.findIndex(h => h.includes('pago em') || h.includes('data pag') || h.includes('liquid'));
  const notesIdx = headers.findIndex(h => h.includes('obs') || h.includes('nota') || h.includes('coment'));

  const partnersMap = new Map<string, Partner>();
  const referrals: Referral[] = [];
  let rowsWithMissingData = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => !cell || cell.trim() === '')) continue;

    const partnerName = partnerIdx >= 0 && row[partnerIdx] ? row[partnerIdx].trim() : '';
    const clientName = clientIdx >= 0 && row[clientIdx] ? row[clientIdx].trim() : '';
    
    // Skip completely empty lines
    if (!partnerName && !clientName) continue;

    const partnerJoinDate = partnerDateIdx >= 0 && row[partnerDateIdx]?.trim() ? parseDateString(row[partnerDateIdx]) : undefined;
    const partnerProfile = partnerProfileIdx >= 0 && row[partnerProfileIdx]?.trim() ? (row[partnerProfileIdx].trim() as any) : undefined;
    const responsiblePerson = responsibleIdx >= 0 && row[responsibleIdx]?.trim() ? row[responsibleIdx].trim() : undefined;
    const idConexa = conexaIdx >= 0 && row[conexaIdx]?.trim() ? row[conexaIdx].trim() : undefined;

    // Resolve CNPJ/CPF for partner and client from the available columns.
    const rawDocPartner = docPartnerIdx >= 0 ? row[docPartnerIdx]?.trim() : undefined;
    const rawDocClient = docClientIdx >= 0 ? row[docClientIdx]?.trim() : undefined;
    const rawDocAny = docAnyIdx >= 0 ? row[docAnyIdx]?.trim() : undefined;

    // Partner doc: explicit partner column, or the generic column when the sheet has no client column at all.
    const partnerDocRaw = rawDocPartner || (docPartnerIdx < 0 && docClientIdx < 0 && !clientName ? rawDocAny : undefined);
    // Client doc: explicit client column, or the generic column when there is a client and no explicit partner doc column.
    const clientDocRaw = rawDocClient || (docClientIdx < 0 && docPartnerIdx < 0 && clientName ? rawDocAny : undefined);
    const partnerDocument = partnerDocRaw ? normalizeDocument(partnerDocRaw) || undefined : undefined;
    const clientDocument = clientDocRaw ? normalizeDocument(clientDocRaw) || undefined : undefined;

    // Register partner if not existing
    const partnerKey = (partnerName || 'Parceiro Não Identificado').toLowerCase();
    if (!partnersMap.has(partnerKey)) {
      const pObj: Partner = {
        id: 'p-' + Math.random().toString(36).substring(2, 9),
        name: partnerName || 'Parceiro Não Identificado',
        idConexa: idConexa,
        document: partnerDocument,
        profile: partnerProfile,
        responsiblePerson: responsiblePerson,
        joinedDate: partnerJoinDate,
        status: 'ativo'
      };
      const partnerMissing = evaluatePartnerMissingFields(pObj);
      pObj.hasMissingData = partnerMissing.length > 0;
      pObj.missingFields = partnerMissing;
      partnersMap.set(partnerKey, pObj);
    } else {
      const p = partnersMap.get(partnerKey)!;
      if (partnerJoinDate && !p.joinedDate) p.joinedDate = partnerJoinDate;
      if (partnerProfile && !p.profile) p.profile = partnerProfile;
      if (responsiblePerson && !p.responsiblePerson) p.responsiblePerson = responsiblePerson;
      if (idConexa && !p.idConexa) p.idConexa = idConexa;
      if (partnerDocument && !p.document) p.document = partnerDocument;
      const partnerMissing = evaluatePartnerMissingFields(p);
      p.hasMissingData = partnerMissing.length > 0;
      p.missingFields = partnerMissing;
    }

    // If clientName is provided, register this referral
    if (clientName) {
      const partner = partnersMap.get(partnerKey)!;
      const referralDate = refDateIdx >= 0 && row[refDateIdx]?.trim() ? parseDateString(row[refDateIdx]) : undefined;
      const dealStatus = parseDealStatus(statusIdx >= 0 ? row[statusIdx] : undefined);
      const dealValue = valueIdx >= 0 && row[valueIdx]?.trim() ? parseCurrency(row[valueIdx]) : undefined;
      const closeDate = closeDateIdx >= 0 && row[closeDateIdx]?.trim() ? parseDateString(row[closeDateIdx]) : undefined;
      const invoiceDueDay = invoiceDueIdx >= 0 && row[invoiceDueIdx]?.trim() ? parseInt(row[invoiceDueIdx].replace(/\D/g, ''), 10) || undefined : undefined;
      
      const commissionPercent = commPercentIdx >= 0 && row[commPercentIdx]?.trim() ? parseCurrency(row[commPercentIdx]) : undefined;
      let commissionValue = commValueIdx >= 0 && row[commValueIdx]?.trim() ? parseCurrency(row[commValueIdx]) : undefined;

      // Calculate commission if percentage & dealValue exist and commissionValue wasn't provided in formula
      if (dealValue && commissionPercent && commissionValue === undefined) {
        commissionValue = (dealValue * commissionPercent) / 100;
      }

      const commissionStatus = parseCommissionStatus(commStatusIdx >= 0 ? row[commStatusIdx] : undefined, dealStatus);
      const commissionPaidDate = commPaidDateIdx >= 0 && row[commPaidDateIdx]?.trim() ? parseDateString(row[commPaidDateIdx]) : undefined;
      const notes = notesIdx >= 0 && row[notesIdx]?.trim() ? row[notesIdx].trim() : undefined;

      const refObj: Partial<Referral> = {
        id: 'ref-' + Math.random().toString(36).substring(2, 9),
        idConexa: idConexa,
        partnerId: partner.id,
        partnerName: partner.name,
        clientName: clientName,
        clientDocument: clientDocument,
        responsiblePerson: responsiblePerson,
        referralDate,
        dealStatus,
        dealValue,
        closeDate,
        invoiceDueDay,
        commissionPercent,
        commissionValue,
        commissionStatus,
        commissionPaidDate,
        notes
      };

      const missingFields = evaluateMissingFields(refObj);
      const hasMissingData = missingFields.length > 0;
      if (hasMissingData) rowsWithMissingData++;

      referrals.push({
        ...(refObj as Referral),
        hasMissingData,
        missingFields
      });
    }
  }

  return {
    partners: Array.from(partnersMap.values()),
    referrals,
    totalRows: referrals.length > 0 ? referrals.length : partnersMap.size,
    rowsWithMissingData
  };
}
