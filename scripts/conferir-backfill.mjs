/**
 * Roda o importador REAL do sistema (parseSpreadsheetRows + backfillAllCommissions)
 * sobre o TSV gerado e imprime o que vai entrar na base — sem abrir o navegador.
 *
 * Uso:
 *   node scripts/conferir-backfill.mjs [backfill-indicacoes.tsv]
 *
 * Os módulos do app são TypeScript e usam import.meta.env/localStorage, então o
 * script empacota tudo com o esbuild que já vem com o Vite, injetando os dois.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsv = path.resolve(process.argv[2] || 'backfill-indicacoes.tsv');
if (!fs.existsSync(tsv)) {
  console.error(`não achei ${tsv} — rode antes o scripts/gerar-backfill-planilha.mjs`);
  process.exit(1);
}

const entrada = `
const memoria = new Map();
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, v); },
  removeItem: k => { memoria.delete(k); },
  clear: () => memoria.clear()
};

import fs from 'node:fs';
import { parseSpreadsheetRows } from './src/services/sheetsService';
import { backfillAllCommissions } from './src/utils/commissionLogic';

const matriz = fs.readFileSync(${JSON.stringify(tsv)}, 'utf8').trim()
  .split('\\n').map(l => l.replace(/\\r$/, '').split('\\t'));
const lido = parseSpreadsheetRows(matriz);
const { referrals } = backfillAllCommissions(lido.referrals, lido.partners);

const ganhas = referrals.filter(r => r.dealStatus === 'ganho');
const ativas = ganhas.filter(r => !r.churnedAt);
const real = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

console.log('parceiros:', lido.partners.length, '| indicações:', referrals.length);
console.log('por status:', JSON.stringify(referrals.reduce((a, r) => (a[r.dealStatus] = (a[r.dealStatus] || 0) + 1, a), {})));
console.log('novos parceiros com data de entrada:', lido.partners.filter(p => p.joinedDate).length);
console.log('parceiros sem executivo:', lido.partners.filter(p => !p.accountOwner).map(p => p.name).join(', ') || 'nenhum');

console.log('\\nfechadas:', ganhas.length,
  '| plano resolvido:', ganhas.filter(r => r.planId).length,
  '| comissão:', ganhas.filter(r => r.commissionValue).length,
  '| parcelas geradas:', ganhas.filter(r => r.commissionInstallments?.length).length);
console.log('MRR líquido ativo:', real(ativas.reduce((s, r) => s + (r.mrrNet || 0), 0)),
  '| churn:', real(ganhas.filter(r => r.churnedAt).reduce((s, r) => s + (r.mrrNet || 0), 0)),
  \`(\${ganhas.filter(r => r.churnedAt).length} canceladas)\`);
console.log('comissão total a provisionar:', real(ganhas.reduce((s, r) => s + (r.commissionValue || 0), 0)));

// A 1ª fatura cai no mês seguinte quando o dia de vencimento é anterior ao dia do
// fechamento — e as parcelas da comissão têm que seguir a fatura, não o fechamento.
const rolam = ganhas.filter(r => r.closeDate && r.invoiceDueDay && r.invoiceDueDay < Number(r.closeDate.slice(8, 10)));
const erradas = rolam.filter(r => r.firstInvoiceDueDate?.slice(0, 7) === r.closeDate?.slice(0, 7));
const parcelaForaDaFatura = ganhas.filter(r => r.commissionInstallments?.length && r.firstInvoiceDueDate
  && r.commissionInstallments[0].releaseDate !== r.firstInvoiceDueDate);
console.log('\\n1ª fatura no mês seguinte:', rolam.length, 'indicações |', erradas.length === 0 ? 'OK' : \`ERRO em \${erradas.length}\`);
console.log('1ª parcela casando com a 1ª fatura:', parcelaForaDaFatura.length === 0 ? 'OK' : \`ERRO em \${parcelaForaDaFatura.length}\`);

// No plano anual a comissão acompanha a forma de pagamento do cliente:
// à vista = 1 parcela, 2x = duas de 50%, 3x = três de 1/3.
const anuais = ganhas.filter(r => r.planRecurrence === 'anual');
if (anuais.length) {
  console.log('\\ncontratos anuais:');
  for (const r of anuais) {
    const parcelas = (r.commissionInstallments || [])
      .map(i => \`\${i.triggerDescription} \${real(i.value)} em \${i.releaseDate}\`).join(' · ');
    console.log(\`  - \${r.clientName} (\${r.planInstallments}): contrato \${real(r.dealValue)} | MRR \${real(r.mrrNet)} | comissão \${real(r.commissionValue)}\`);
    console.log(\`      \${parcelas || 'sem parcelas'}\`);
  }
}

const pendentes = ganhas.filter(r => !r.commissionValue || !r.commissionInstallments?.length);
if (pendentes.length) {
  console.log('\\nfechadas que entram sem comissão (completar na mão):');
  for (const r of pendentes) console.log(\`  - \${r.partnerName} / \${r.clientName}: \${(r.missingFields || []).join(', ') || 'sem plano/valor reconhecido'}\`);
}
`;

const bundle = await esbuild.build({
  stdin: { contents: entrada, resolveDir: raiz, sourcefile: 'conferir.mts', loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  external: ['node:fs'],
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
  logLevel: 'warning'
});

const tmp = path.join(raiz, 'node_modules', '.cache-conferir-backfill.mjs');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, bundle.outputFiles[0].text);
try {
  await import(pathToFileURL(tmp).href);
} finally {
  fs.rmSync(tmp, { force: true });
}
