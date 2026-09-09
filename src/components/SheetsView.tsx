import { useState } from 'react';
import { 
  extractSpreadsheetId, 
  getSpreadsheetDetails, 
  readSheetValues, 
  parseSpreadsheetRows,
  type SheetImportResult 
} from '../services/sheetsService';
import { 
  downloadPartnerImportTemplateCSV, 
  downloadReferralImportTemplateCSV 
} from '../utils/csvExportTemplates';
import { getAccessToken, googleSignIn } from '../services/firebaseAuth';
import type { Partner, Referral } from '../types';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  ClipboardPaste,
  ShieldCheck,
  FileDown,
  Info,
  Users,
  FileText
} from 'lucide-react';

interface SheetsViewProps {
  onImportData: (result: SheetImportResult) => void;
  referrals: Referral[];
  partners: Partner[];
}

export default function SheetsView({
  onImportData,
  referrals,
  partners
}: SheetsViewProps) {
  const [sheetInput, setSheetInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Sheet inspection state
  const [sheetTitle, setSheetTitle] = useState<string | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');

  // Paste raw data state
  const [pastedData, setPastedData] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);

  const handleConnectSheet = async () => {
    if (!sheetInput.trim()) {
      setErrorMsg('Por favor, informe a URL ou o ID da planilha Google.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        // Prompt Google Sign in
        const authRes = await googleSignIn();
        token = authRes?.accessToken || null;
      }

      const cleanId = extractSpreadsheetId(sheetInput);
      const details = await getSpreadsheetDetails(cleanId);
      
      setSheetTitle(details.title);
      setAvailableSheets(details.sheets);
      setSelectedTab(details.sheets[0] || 'Sheet1');
      setSuccessMsg(`Planilha "${details.title}" conectada com sucesso! Selecione a aba para importar.`);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Falha ao conectar à planilha Google';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSheetTab = async () => {
    if (!sheetInput.trim() || !selectedTab) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanId = extractSpreadsheetId(sheetInput);
      const range = `${selectedTab}!A1:Z500`;
      const rows = await readSheetValues(cleanId, range);

      if (rows.length < 2) {
        setErrorMsg('A aba selecionada não contém linhas suficientes de cabeçalho e dados.');
        return;
      }

      const parsed = parseSpreadsheetRows(rows);
      onImportData(parsed);

      setSuccessMsg(
        `Importação concluída: ${parsed.referrals.length} indicações e ${parsed.partners.length} parceiros importados! ` +
        (parsed.rowsWithMissingData > 0 
          ? `(${parsed.rowsWithMissingData} registros possuem campos pendentes para preenchimento manual).` 
          : '')
      );
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao importar linhas da planilha';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Import directly by pasting CSV/TSV from Excel
  const handleImportPastedData = () => {
    if (!pastedData.trim()) return;

    try {
      const lines = pastedData.trim().split('\n');
      const matrix: string[][] = lines.map(line => {
        // If tab-separated (standard Excel copy-paste)
        if (line.includes('\t')) {
          return line.split('\t');
        }
        // If semicolon or comma separated
        if (line.includes(';')) {
          return line.split(';');
        }
        return line.split(',');
      });

      const parsed = parseSpreadsheetRows(matrix);
      if (parsed.partners.length === 0 && parsed.referrals.length === 0) {
        setErrorMsg('Não foi possível identificar colunas válidas no texto colado.');
        return;
      }

      onImportData(parsed);
      setShowPasteModal(false);
      setPastedData('');
      setSuccessMsg(
        parsed.referrals.length > 0
          ? `Dados do Excel importados: ${parsed.referrals.length} indicações processadas com sucesso! ` +
            (parsed.rowsWithMissingData > 0
              ? `(${parsed.rowsWithMissingData} registros possuem dados pendentes sinalizados).`
              : '')
          : `Dados do Excel importados: ${parsed.partners.length} parceiros processados com sucesso! ` +
            (parsed.rowsWithMissingData > 0
              ? `(${parsed.rowsWithMissingData} registros possuem dados pendentes sinalizados).`
              : '')
      );
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Falha ao processar dados colados.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Overview Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Integração com Planilhas (Google Sheets & Excel)
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Importe seus cadastros preservando a integridade original dos dados. Você pode utilizar tanto planilhas dedicadas de parceiros quanto de indicações.
            </p>
          </div>
        </div>

        {/* Data Integrity Rule Banner */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Regra de Integridade e Campos Nulos:</strong> Linhas ou colunas em branco <strong>NÃO são interpretadas como 0</strong> — são gravadas como <em>nulas</em>. Qualquer campo nulo é enviado diretamente para a aba <strong>Auditoria de Dados</strong> para conferência manual, assegurando que nenhum KPI de conversão ou comissão seja distorcido.
          </div>
        </div>

        {/* Templates Download Grid */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Modelos de Planilha Disponíveis para Download
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Partner Template */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Modelo para Cadastro de Parceiros</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  Contém colunas para: <strong>Parceiro, CNPJ/CPF, Data de Entrada, Perfil, Pessoa Responsável, ID Conexa, E-mail, Telefone</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadPartnerImportTemplateCSV}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo Parceiros (.csv)</span>
              </button>
            </div>

            {/* Referral Template */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Modelo para Cadastro de Indicações</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  Contém colunas para: <strong>Cliente, CNPJ/CPF, Parceiro, Data da Indicação, ID Conexa, Responsável, Status, MRR, Fechamento, Vencimento, Comissão</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadReferralImportTemplateCSV}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Modelo Indicações (.csv)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-4 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Method 1: Google Sheets Direct Sync */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h4 className="text-sm font-bold text-slate-900">Conectar Planilha Google Sheets</h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Via API Oficial do Google</span>
        </div>

        <p className="text-xs text-slate-600">
          Cole a URL pública ou compartilhada da sua planilha (ex: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-[11px]">https://docs.google.com/spreadsheets/d/SEU_ID/edit</code>) ou apenas o ID:
        </p>

        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <input
            type="text"
            placeholder="Cole a URL ou o ID da Planilha Google..."
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={handleConnectSheet}
            disabled={isLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Conectando...' : 'Localizar Planilha'}</span>
          </button>
        </div>

        {/* If sheet connected successfully */}
        {sheetTitle && availableSheets.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Planilha Localizada:</span>
                <span className="text-sm font-bold text-slate-900">{sheetTitle}</span>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                Pronta para leitura
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-600 font-medium">Aba da planilha:</span>
              <select
                value={selectedTab}
                onChange={(e) => setSelectedTab(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 font-medium"
              >
                {availableSheets.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button
                onClick={handleImportSheetTab}
                disabled={isLoading}
                className="ml-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-xs transition"
              >
                Importar Dados da Aba
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Method 2: Paste directly from Excel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h4 className="text-sm font-bold text-slate-900">Copiar e Colar Linhas do Excel (Manual)</h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Sem necessidade de login</span>
        </div>

        <p className="text-xs text-slate-600">
          Se você tem uma planilha salva no computador, basta selecionar as linhas no Excel (incluindo o cabeçalho), copiar (Ctrl+C) e colar aqui:
        </p>

        <button
          onClick={() => setShowPasteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
        >
          <ClipboardPaste className="w-4 h-4 text-slate-600" />
          <span>Abrir Caixa de Colar Dados do Excel</span>
        </button>
      </div>

      {/* Modal for Pasting Excel Data */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Colar Tabela do Excel / Planilha</h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Copie a tabela no Excel (com colunas como Parceiro, Cliente, Data, Status, Valor, Fechamento, Comissão) e cole na área abaixo:
            </p>

            <textarea
              rows={8}
              placeholder="Cole aqui os dados copiados do Excel..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              className="w-full font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportPastedData}
                disabled={!pastedData.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                Processar e Importar Linhas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
