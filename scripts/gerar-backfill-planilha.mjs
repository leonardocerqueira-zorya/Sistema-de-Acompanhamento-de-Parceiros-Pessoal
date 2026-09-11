/**
 * Gera o TSV de backfill (parceiros + indicações) a partir da planilha
 * "Parceiros e Indicados.xlsx" do CRM, no formato que a aba Planilhas do sistema
 * entende (Importar > Colar dados).
 *
 * Uso:
 *   node scripts/gerar-backfill-planilha.mjs <caminho-da-planilha.xlsx> [saida.tsv]
 *
 * Não tem dependência: lê o .xlsx (zip + XML) direto com zlib.
 *
 * O que o script decide (e o importador não teria como adivinhar):
 *  - identidade do parceiro: agrupa as linhas pela Razão Social (col A), porque a
 *    coluna "Nome do Parceiro" varia entre razão social, nome completo e primeiro
 *    nome na mesma empresa;
 *  - reconciliação com a base: mapeia a razão social da planilha para o nome +
 *    CNPJ que o parceiro já tem no sistema, para o import casar o registro
 *    existente em vez de criar um duplicado;
 *  - data de entrada no programa: a planilha não tem essa coluna, então usa as
 *    datas confirmadas uma a uma e o resto cai na 1ª indicação do parceiro.
 *
 * Esses três dependem de dados reais de parceiro (CNPJ, razão social), que ficam
 * em reconciliacao.local.json, fora do versionamento. Veja reconciliacao.exemplo.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Leitura do .xlsx (zip + sharedStrings + sheet1), sem dependências
// ---------------------------------------------------------------------------

function unzip(buffer) {
  const files = new Map();
  // End of central directory -> offset do central directory
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo .xlsx inválido (EOCD não encontrado)');
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);

    const lnameLen = buffer.readUInt16LE(localOffset + 26);
    const lextraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lnameLen + lextraLen;
    const raw = buffer.subarray(dataStart, dataStart + compSize);
    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXmlText(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&#13;/g, '')
    .replace(/&amp;/g, '&');
}

function colIndex(ref) {
  const letters = ref.match(/[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheet(xlsxPath) {
  const files = unzip(fs.readFileSync(xlsxPath));
  const sharedXml = files.has('xl/sharedStrings.xml') ? files.get('xl/sharedStrings.xml').toString('utf8') : '';
  const strings = [];
  for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
    strings.push(decodeXmlText(text));
  }

  const sheetName = [...files.keys()].find(k => /^xl\/worksheets\/sheet1\.xml$/.test(k));
  if (!sheetName) throw new Error('Planilha sem xl/worksheets/sheet1.xml');
  const sheetXml = files.get(sheetName).toString('utf8');

  const rows = [];
  for (const rm of sheetXml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number((rm[1].match(/r="(\d+)"/) || [])[1]);
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      if (!ref) continue;
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/);
      const is = body.match(/<is>([\s\S]*?)<\/is>/);
      let value = null;
      if (type === 's' && v) value = strings[Number(v[1])];
      else if (type === 'inlineStr' && is) {
        let text = '';
        for (const t of is[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
        value = decodeXmlText(text);
      } else if (v) value = decodeXmlText(v[1]);
      if (value !== null && value !== '') cells[colIndex(ref)] = String(value).trim();
    }
    rows[rowNumber - 1] = cells;
  }
  return rows.map(r => (r ? Array.from(r, c => c ?? '') : []));
}

// ---------------------------------------------------------------------------
// Datas da planilha
// ---------------------------------------------------------------------------

/** Serial do Excel -> Date (UTC). Devolve null se não for um serial de data. */
function excelSerialToDate(value) {
  const n = Number(value);
  if (!/^\d+(\.\d+)?$/.test(String(value)) || !(n >= 20000 && n <= 60000)) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
}

/** Célula de data (serial do Excel ou DD/MM/AAAA) -> 'YYYY-MM-DD'. */
function cellToISODate(value) {
  if (!value) return null;
  const serial = excelSerialToDate(value);
  if (serial) return serial.toISOString().slice(0, 10);
  const br = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return null;
}

const MESES_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Safra ("Aug-26"). Quando digitada no Excel vira data do ano corrente: "Jun-26"
 * virou 2026-06-26, "Nov-25" virou 2026-11-25 — ou seja, o DIA guarda o ano real
 * da safra e o mês continua correto.
 */
function parseSafra(value) {
  if (!value) return null;
  const serial = excelSerialToDate(value);
  if (serial) return { year: 2000 + serial.getUTCDate(), month: serial.getUTCMonth() + 1 };
  const m = String(value).trim().match(/^([A-Za-z]{3})[a-z]*[-/ ](\d{2,4})$/);
  if (!m) return null;
  const month = MESES_EN[m[1].toLowerCase()];
  if (!month) return null;
  const yy = Number(m[2]);
  return { year: yy < 100 ? 2000 + yy : yy, month };
}

/**
 * Mês de origem de cada indicação, salvo da versão da planilha que ainda tinha a
 * coluna Safra (chave: "razão social|cliente indicado" normalizados). Só é usado
 * como último recurso para a data da indicação nas linhas em aberto, que não têm
 * "Data de entrada" — sem isso elas entram sem data nenhuma e somem das análises
 * por período. Apague o arquivo quando a planilha tiver a data de entrada de todas.
 */
const SAFRA_ANTERIOR = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('./safra-anterior.json', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
})();

const safraLabel = s => (s ? `${MESES_PT[s.month - 1]}/${String(s.year).slice(2)}` : '');
const safraFirstDay = s => (s ? `${s.year}-${String(s.month).padStart(2, '0')}-01` : null);
const toBR = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

// ---------------------------------------------------------------------------
// Identidade do parceiro
// ---------------------------------------------------------------------------

const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const chave = s => semAcento(s).toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(ltda|me|epp|eireli|s a|sa)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

/**
 * Reconciliação com a base, mantida fora do versionamento: traz CNPJ e razão
 * social de parceiro real e nome de cliente indicado. O arquivo modelo está em
 * reconciliacao.exemplo.json; sem ele o script ainda roda, mas cada parceiro da
 * planilha vira um cadastro novo (nenhum casa com quem já existe no sistema).
 *
 *  parceirosNaBase     razão social na planilha -> { nome, documento } do cadastro
 *                      atual (o sistema casa por CNPJ -> ID Conexa -> nome)
 *  entradaNoPrograma   data de entrada confirmada caso a caso; quem não está aqui
 *                      entra com a data da 1ª indicação que fez
 *  tier / executivo    quando a planilha está errada ou vazia
 *  contato             pessoa do parceiro, quando a planilha traz só o 1º nome
 *  parcelamento        forma de pagamento do contrato anual, por cliente indicado
 *                      (a comissão do anual segue o parcelamento do cliente)
 *  alias               razões sociais diferentes que são o mesmo parceiro
 *  ignorar             razões sociais que não viram parceiro nem indicação
 *
 * Todas as chaves são a razão social passada por chave() — sem acento, minúscula,
 * sem pontuação e sem ltda/me/epp/eireli.
 */
const RECONCILIACAO = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('./reconciliacao.local.json', import.meta.url), 'utf8'));
  } catch {
    console.warn('aviso: scripts/reconciliacao.local.json não encontrado — nenhum parceiro será reconciliado com a base');
    return {};
  }
})();

const PARCEIROS_NA_BASE = RECONCILIACAO.parceirosNaBase || {};
const ENTRADA_NO_PROGRAMA = RECONCILIACAO.entradaNoPrograma || {};
const TIER = RECONCILIACAO.tier || {};
const EXECUTIVO = RECONCILIACAO.executivo || {};
const CONTATO = RECONCILIACAO.contato || {};
const PARCELAMENTO = RECONCILIACAO.parcelamento || {};
const ALIAS = RECONCILIACAO.alias || {};
const IGNORAR = new Set(RECONCILIACAO.ignorar || []);


// ---------------------------------------------------------------------------
// Comissão dos planos legados
// ---------------------------------------------------------------------------

/** Lê a tabela de preços vigente direto de src/data/plansData.ts. */
function carregarPlanos() {
  const src = fs.readFileSync(new URL('../src/data/plansData.ts', import.meta.url), 'utf8');
  const re = /id:\s*'([^']+)',\s*commercialName:\s*'([^']+)',\s*collaboratorsRange:\s*'([^']+)',[\s\S]*?monthlyPrice:\s*([\d.]+),\s*annualFullPrice:\s*([\d.]+),[\s\S]*?commissionAmount:\s*([\d.]+),/g;
  const planos = [];
  for (const m of src.matchAll(re)) {
    planos.push({ id: m[1], nome: m[2], faixa: m[3], preco: Number(m[4]), precoAnual: Number(m[5]), comissao: Number(m[6]) });
  }
  if (planos.length === 0) throw new Error('não consegui ler os planos de src/data/plansData.ts');
  return planos;
}

const faixaTeto = faixa => {
  if (!faixa) return undefined;
  const nums = String(faixa).replace(/\./g, '').match(/\d+/g);
  return nums ? Number(nums[nums.length - 1]) : undefined;
};

/**
 * Comissão da indicação quando o preço da planilha não bate com nenhuma linha da
 * tabela (contratos legados com preço negociado). A comissão é função da faixa de
 * colaboradores, então cruzamos dois caminhos independentes — a faixa declarada e
 * o preço mais próximo dentro da mesma família de plano — e só usamos o valor
 * quando os dois chegam na mesma resposta. Discordou, fica em branco pro canal
 * preencher na mão.
 */
function comissaoDerivada(planos, nomePlano, precoBruto, faixa, anual) {
  const norma = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const preco = p => (anual ? p.precoAnual : p.preco);
  const exato = planos.find(p => norma(p.nome) === norma(nomePlano) && Math.abs(preco(p) - precoBruto) < 0.01);
  if (exato) return { valor: null, motivo: 'plano resolvido na tabela' };

  const teto = faixaTeto(faixa);
  const porFaixa = teto === undefined ? null : planos
    .map(p => ({ p, d: Math.abs(faixaTeto(p.faixa) - teto) }))
    .sort((a, b) => a.d - b.d)[0]?.p.comissao ?? null;

  const familia = planos.filter(p => norma(p.nome) === norma(nomePlano));
  const porPreco = (!precoBruto || familia.length === 0) ? null : familia
    .map(p => ({ p, d: Math.abs(preco(p) - precoBruto) }))
    .sort((a, b) => a.d - b.d)[0]?.p.comissao ?? null;

  if (porFaixa !== null && porFaixa === porPreco) return { valor: porFaixa, motivo: 'comissão pela faixa (preço legado fora da tabela)' };
  return { valor: null, motivo: `comissão indefinida: faixa aponta ${porFaixa ?? '—'} e preço aponta ${porPreco ?? '—'}` };
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

const CABECALHO = [
  'nome_do_parceiro',
  'empresa_razao_social',
  'cnpj_parceiro',
  'tier_do_parceiro',
  'pessoa_responsavel',
  'executivo_responsavel',
  'data_de_entrada_no_programa',
  'cliente_indicado',
  'cnpj_cliente',
  'id_conexa',
  'status',
  'data_da_indicacao',
  'data_de_fechamento',
  'dia_vencimento_fatura',
  'faixa_colaboradores',
  'plano',
  'recorrencia',
  'parcelamento',
  'mrr_bruto_tabela',
  'desconto_percentual',
  'valor_comissao',
  'data_cancelamento',
  'observacoes'
];

const ETAPAS = ['fechado', 'perdido', 'contato feito', 'negociacao', 'sem contato'];

/**
 * Descobre as colunas pelo cabeçalho, não pela posição — a planilha é editada à mão
 * e uma coluna a mais ou a menos desalinharia tudo em silêncio. Faixa de
 * colaboradores e etapa do funil não têm cabeçalho, então saem pelo conteúdo.
 */
/** Mês salvo da versão anterior da planilha, como 1º dia do mês. */
function mesAnterior(row, COL) {
  const k = chave(row[COL.razao]) + '|' + chave(row[COL.cliente]);
  const ym = SAFRA_ANTERIOR[k];
  return ym ? ym + '-01' : null;
}

function detectarColunas(cabecalho, dados) {
  const acha = (...fragmentos) =>
    cabecalho.findIndex(h => { const n = chave(h); return n && fragmentos.some(f => n.includes(f)); });

  const semNome = cabecalho.map((h, i) => (chave(h) ? -1 : i)).filter(i => i >= 0);
  const valores = i => dados.map(r => chave(r[i])).filter(Boolean);
  const proporcao = (i, teste) => {
    const v = valores(i);
    return v.length === 0 ? 0 : v.filter(teste).length / v.length;
  };

  const col = {
    razao: acha('razao social'),
    nome: acha('nome do parceiro'),
    idConexa: acha('conexa'),
    cliente: acha('cliente indicado'),
    cnpjCliente: acha('cnpj cliente'),
    entrada: acha('data de entrada'),
    fechamento: acha('data de fechamento', 'fechamento'),
    cancelamento: acha('cancelamento'),
    diaVencimento: acha('dia vencimento', 'vencimento'),
    executivo: acha('proprietario', 'executivo', 'responsavel'),
    plano: acha('plano'),
    valor: acha('valor'),
    recorrencia: acha('recorrencia'),
    desconto: acha('desconto'),
    parcelamento: acha('parcelamento'),
    hubspot: acha('hubspot'),
    safra: acha('safra'),
    faixa: semNome.find(i => proporcao(i, v => /^\d+ a \d+$|^\d+\+$/.test(v)) > 0.5) ?? -1,
    etapa: semNome.find(i => proporcao(i, v => ETAPAS.includes(v)) > 0.5) ?? -1
  };

  const obrigatorias = ['razao', 'nome', 'cliente', 'etapa', 'fechamento', 'plano', 'valor'];
  const faltando = obrigatorias.filter(k => col[k] < 0);
  if (faltando.length) {
    throw new Error(`não achei estas colunas na planilha: ${faltando.join(', ')} — confira o cabeçalho`);
  }
  return col;
}

const titulo = s => s.replace(/\s+/g, ' ').trim();
const limpaCelula = s => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();

// A planilha mistura "R$ 149,90" (texto brasileiro) com 969.9 (número cru do
// Excel). Só trata ponto como separador de milhar quando existe vírgula decimal.
// A saída vai em padrão brasileiro porque é isso que o importador espera — emitir
// "99.90" viraria 9990 na leitura.
function moeda(value) {
  if (!value) return '';
  const bruto = String(value).replace(/R\$\s?/g, '').trim();
  const n = parseFloat(/,/.test(bruto) ? bruto.replace(/\./g, '').replace(',', '.') : bruto);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '';
}

function percentual(value) {
  if (!value) return '';
  const n = parseFloat(String(value).replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(n)) return '';
  const pct = n > 0 && n < 1 ? n * 100 : n;
  return parseFloat(pct.toFixed(4)).toString().replace('.', ',');
}

export function gerar(xlsxPath) {
  const rows = readSheet(xlsxPath);
  const data = rows.slice(1).filter(r => r.some(c => c !== ''));
  const COL = detectarColunas(rows[0] || [], data);

  // 1. Agrupa por razão social (col A). "Não Parceiro" não é empresa: cada
  //    indicador vira um grupo próprio, pelo nome da col B.
  const grupos = new Map();
  for (const row of data) {
    const razao = limpaCelula(row[COL.razao]);
    const nome = limpaCelula(row[COL.nome]);
    const naoParceiro = chave(razao) === 'nao parceiro';
    const bruta = naoParceiro ? `np::${chave(nome)}` : (chave(razao) || chave(nome));
    const key = ALIAS[bruta] || bruta;
    if (!key) continue;
    if (!grupos.has(key)) {
      grupos.set(key, { key, razao: naoParceiro ? nome : razao, naoParceiro, contatos: new Map(), execs: new Map(), rows: [] });
    }
    const g = grupos.get(key);
    g.rows.push(row);
    if (nome && !naoParceiro && chave(nome) !== chave(razao)) g.contatos.set(nome, (g.contatos.get(nome) || 0) + 1);
    const exec = limpaCelula(row[COL.executivo]);
    if (exec) g.execs.set(exec, (g.execs.get(exec) || 0) + 1);
  }

  // 2. Resolve identidade, executivo e data de entrada de cada grupo.
  const maisFrequente = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  for (const g of grupos.values()) {
    const naBase = PARCEIROS_NA_BASE[g.key];
    g.nomeFinal = naBase ? naBase.nome : titulo(g.razao);
    g.documento = naBase ? naBase.documento || '' : '';
    g.novo = !naBase;
    g.contato = CONTATO[g.key] || maisFrequente(g.contatos) || (g.naoParceiro ? g.razao : '');
    g.executivoForcado = EXECUTIVO[g.key] || '';
    g.executivo = g.executivoForcado || maisFrequente(g.execs);
    g.tier = TIER[g.key] || '';

    const datas = g.rows
      .map(r => cellToISODate(r[COL.entrada]) || safraFirstDay(parseSafra(r[COL.safra])) || mesAnterior(r, COL))
      .filter(Boolean)
      .sort();
    g.primeiraIndicacao = datas[0] || '';
    // Parceiro já cadastrado não recebe data de entrada nova: o import não
    // sobrescreve campo preenchido, e chutar aqui só geraria ruído.
    g.entrada = g.novo ? (ENTRADA_NO_PROGRAMA[g.key] || g.primeiraIndicacao) : '';
  }

  // 3. Monta as linhas do TSV.
  const planos = carregarPlanos();
  const linhas = [CABECALHO];
  const avisos = [];
  let ignoradas = 0;
  let estimadas = 0;

  for (const g of [...grupos.values()].sort((a, b) => a.nomeFinal.localeCompare(b.nomeFinal, 'pt-BR'))) {
    if (IGNORAR.has(g.key)) { ignoradas += g.rows.length; continue; }

    for (const row of g.rows) {
      const cliente = limpaCelula(row[COL.cliente]);
      if (!cliente) { avisos.push(`${g.nomeFinal}: linha sem cliente indicado, descartada`); continue; }

      const safra = parseSafra(row[COL.safra]);
      const entrada = cellToISODate(row[COL.entrada]);
      const fechamento = cellToISODate(row[COL.fechamento]);
      // O mês de origem só substitui a data da indicação nas linhas em aberto
      // (perdida, em negociação, em contato). Fechada sem "Data de entrada" é furo
      // de cadastro e tem que aparecer na auditoria, não ser remendada aqui.
      const emAberto = limpaCelula(row[COL.etapa]).toLowerCase() !== 'fechado';
      const mesSalvo = emAberto ? (safraFirstDay(safra) || mesAnterior(row, COL)) : null;
      const dataIndicacao = entrada || mesSalvo;

      if (row[COL.entrada] && !entrada) {
        avisos.push(`${g.nomeFinal} / ${cliente}: data de entrada ilegível ("${row[COL.entrada]}"), usando o 1º dia de ${safraLabel(safra)}`);
      }

      // Fechada com preço fora da tabela: tenta derivar a comissão aqui, senão
      // a indicação entra sem comissão e cai na auditoria de dados faltantes.
      const anual = /anu/i.test(limpaCelula(row[COL.recorrencia]));
      // Contrato anual: a comissão acompanha a forma de pagamento do cliente.
      // A planilha não diz o parcelamento, então vem do mapa; sem entrada, à vista.
      const parcelamentoPlanilha = COL.parcelamento >= 0 ? limpaCelula(row[COL.parcelamento]) : '';
      const parcelamento = anual ? (parcelamentoPlanilha || PARCELAMENTO[chave(cliente)] || '1x') : '';

      let comissao = '';
      const plano = limpaCelula(row[COL.plano]);
      const precoBruto = Number(moeda(row[COL.valor]).replace(',', '.'));
      if (limpaCelula(row[COL.etapa]) === 'Fechado' && plano && precoBruto) {
        const d = comissaoDerivada(planos, plano, precoBruto, row[COL.faixa], anual);
        if (d.valor !== null) comissao = d.valor.toFixed(2).replace('.', ',');
        else if (!d.motivo.startsWith('plano resolvido')) avisos.push(`${g.nomeFinal} / ${cliente}: ${d.motivo}`);
      }

      // A safra não vai como campo: o sistema calcula a safra pela data da indicação
      // (ver vintageAnalytics). A coluna Safra da planilha só serve aqui para estimar
      // essa data quando a linha não tem "Data de entrada".
      const obs = ['Backfill planilha CRM'];
      if (row[COL.faixa]) obs.push(`${limpaCelula(row[COL.faixa])} colab.`);
      if (!entrada && dataIndicacao) {
        obs.push('data da indicação estimada: 1º dia do mês de origem, a planilha não tem o dia');
        estimadas++;
      }
      if (g.naoParceiro) obs.push('origem marcada como "Não Parceiro" na planilha');
      if (row[COL.hubspot]) obs.push(limpaCelula(row[COL.hubspot]));

      linhas.push([
        g.nomeFinal,
        g.naoParceiro ? '' : titulo(g.razao),
        g.documento,
        g.tier,
        g.contato,
        g.executivoForcado || limpaCelula(row[COL.executivo]) || g.executivo,
        g.entrada ? toBR(g.entrada) : '',
        cliente,
        limpaCelula(row[COL.cnpjCliente]),
        limpaCelula(row[COL.idConexa]),
        limpaCelula(row[COL.etapa]).toLowerCase() === 'sem contato' ? 'Novo' : limpaCelula(row[COL.etapa]),
        dataIndicacao ? toBR(dataIndicacao) : '',
        fechamento ? toBR(fechamento) : '',
        limpaCelula(row[COL.diaVencimento]),
        limpaCelula(row[COL.faixa]),
        limpaCelula(row[COL.plano]),
        limpaCelula(row[COL.recorrencia]),
        parcelamento,
        moeda(row[COL.valor]),
        percentual(row[COL.desconto]),
        comissao,
        cellToISODate(row[COL.cancelamento]) ? toBR(cellToISODate(row[COL.cancelamento])) : '',
        obs.join(' · ')
      ]);
    }
  }

  return { linhas, grupos: [...grupos.values()], avisos, ignoradas, estimadas };
}

// ---------------------------------------------------------------------------

const [, , entradaArg, saidaArg] = process.argv;
if (!entradaArg) {
  console.error('uso: node scripts/gerar-backfill-planilha.mjs <planilha.xlsx> [saida.tsv]');
  process.exit(1);
}

const saida = saidaArg || 'backfill-indicacoes.tsv';
const { linhas, grupos, avisos, ignoradas, estimadas } = gerar(entradaArg);
fs.writeFileSync(saida, linhas.map(l => l.join('\t')).join('\n'), 'utf8');

const novos = grupos.filter(g => g.novo && !IGNORAR.has(g.key));
console.log(`${path.basename(saida)}: ${linhas.length - 1} indicações, ${grupos.length} parceiros (${novos.length} novos)`);
if (ignoradas) console.log(`${ignoradas} linha(s) ignorada(s) por IGNORAR`);
if (estimadas) console.log(`${estimadas} indicação(ões) sem "Data de entrada" na planilha: usei o 1º dia do mês de origem`);
for (const a of avisos) console.log(`  aviso: ${a}`);
