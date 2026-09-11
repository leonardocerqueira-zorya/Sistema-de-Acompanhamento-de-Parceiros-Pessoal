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
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  // Carrega um .tsv/.csv salvo em disco na mesma área de colagem: é o mesmo
  // conteúdo de um Ctrl+C da planilha, mas sem depender de abrir o arquivo no Excel.
  const handlePickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = String(e.target?.result || '').replace(/^\uFEFF/, '');
      if (!text.trim()) {
        setErrorMsg('O arquivo está vazio.');
        return;
      }
      setPastedData(text);
      setLoadedFileName(file.name);
      setErrorMsg(null);
    };
    reader.onerror = () => setErrorMsg('Não consegui ler o arquivo.');
    reader.readAsText(file, 'utf-8');
  };

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
      // Colagem vinda de arquivo salvo no Windows traz \r no fim da linha, que gruda
      // na última coluna e quebra a leitura dela (data/valor viram texto inválido).
      const lines = pastedData.trim().split('\n').map(line => line.replace(/\r$/, ''));
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
      setLoadedFileName(null);
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
    <div className="max-w-4xl mx-auto">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">
            Importação de Planilhas
          </h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            Google Sheets e Excel — importe cadastros de parceiros e indicações preservando os dados originais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadPartnerImportTemplateCSV}
            className="flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Modelo Parceiros (.csv)
          </button>
          <button
            type="button"
            onClick={downloadReferralImportTemplateCSV}
            className="flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Modelo Indicações (.csv)
          </button>
        </div>
      </div>

      <div className="space-y-5">

        {/* Overview Card */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-[18px] h-[18px]" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-zry-text leading-none">
                Integração com Planilhas (Google Sheets &amp; Excel)
              </h3>
              <p className="text-[12.5px] text-zry-text-2 mt-1.5">
                Importe seus cadastros preservando a integridade original dos dados. Você pode utilizar tanto planilhas dedicadas de parceiros quanto de indicações.
              </p>
            </div>
          </div>

          <div className="p-[22px] space-y-5">
            {/* Data Integrity Rule Banner */}
            <div className="bg-zry-warning-bg border border-zry-warning/30 rounded-zry-lg p-4 flex items-start gap-3">
              <ShieldCheck className="w-[18px] h-[18px] text-zry-warning shrink-0 mt-0.5" />
              <div className="text-[12.5px] text-zry-warning leading-relaxed">
                <strong>Regra de Integridade e Campos Nulos:</strong> Linhas ou colunas em branco <strong>NÃO são interpretadas como 0</strong> — são gravadas como <em>nulas</em>. Qualquer campo nulo é enviado diretamente para a aba <strong>Auditoria de Dados</strong> para conferência manual, assegurando que nenhum KPI de conversão ou comissão seja distorcido.
              </div>
            </div>

            {/* Templates Download Grid */}
            <div>
              <span className="text-[11px] font-semibold text-zry-text-2 uppercase tracking-wider block mb-3">
                Modelos de Planilha Disponíveis para Download
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Partner Template */}
                <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-zry-text font-bold text-[13px]">
                      <Users className="w-4 h-4 text-zry-roxo" />
                      <span>Modelo para Cadastro de Parceiros</span>
                    </div>
                    <p className="text-[12px] text-zry-text-2 mt-1.5 leading-relaxed">
                      Contém colunas para: <strong>Parceiro, CNPJ/CPF, Data de Entrada, Perfil, Pessoa Responsável, ID Conexa, E-mail, Telefone</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadPartnerImportTemplateCSV}
                    className="self-start flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Modelo Parceiros (.csv)</span>
                  </button>
                </div>

                {/* Referral Template */}
                <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-zry-text font-bold text-[13px]">
                      <FileText className="w-4 h-4 text-zry-roxo" />
                      <span>Modelo para Cadastro de Indicações</span>
                    </div>
                    <p className="text-[12px] text-zry-text-2 mt-1.5 leading-relaxed">
                      Contém colunas para: <strong>Cliente, CNPJ/CPF, Parceiro, Data da Indicação, ID Conexa, Responsável, Status, MRR, Fechamento, Vencimento, Comissão</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadReferralImportTemplateCSV}
                    className="self-start flex items-center gap-1.5 border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Modelo Indicações (.csv)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="bg-zry-danger-bg border border-zry-danger/30 text-zry-danger text-[12.5px] p-4 rounded-zry-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-zry-danger mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-zry-positive-bg border border-zry-positive/30 text-zry-positive text-[12.5px] p-4 rounded-zry-lg flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-zry-positive mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Method 1: Google Sheets Direct Sync */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-zry-roxo text-zry-creme flex items-center justify-center font-bold text-[12px]">
                1
              </span>
              <h4 className="text-[15px] font-bold text-zry-text">Conectar Planilha Google Sheets</h4>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas-30 text-zry-text-2">
              Via API Oficial do Google
            </span>
          </div>

          <div className="p-[22px] space-y-4">
            <p className="text-[12.5px] text-zry-text-2 leading-relaxed">
              Cole a URL pública ou compartilhada da sua planilha (ex: <code className="bg-zry-lilas-30 px-1.5 py-0.5 rounded-md text-zry-text-2 font-mono text-[11px]">https://docs.google.com/spreadsheets/d/SEU_ID/edit</code>) ou apenas o ID:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                placeholder="Cole a URL ou o ID da Planilha Google..."
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                className="flex-1 bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder-zry-text-2 focus:outline-none focus:border-zry-border-strong"
              />
              <button
                onClick={handleConnectSheet}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Conectando...' : 'Localizar Planilha'}</span>
              </button>
            </div>

            {/* If sheet connected successfully */}
            {sheetTitle && availableSheets.length > 0 && (
              <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 block">Planilha Localizada</span>
                    <span className="text-[15px] font-bold text-zry-text">{sheetTitle}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-positive-bg text-zry-positive">
                    Pronta para leitura
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
                  <span className="text-zry-text-2 font-medium">Aba da planilha:</span>
                  <select
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className="bg-zry-surface border border-zry-border rounded-full px-3.5 py-1.5 text-[12.5px] text-zry-text font-semibold focus:outline-none focus:border-zry-border-strong"
                  >
                    {availableSheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleImportSheetTab}
                    disabled={isLoading}
                    className="ml-auto flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Importar Dados da Aba
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Method 2: Paste directly from Excel */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg shadow-sm">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-zry-roxo text-zry-creme flex items-center justify-center font-bold text-[12px]">
                2
              </span>
              <h4 className="text-[15px] font-bold text-zry-text">Enviar Arquivo ou Colar Linhas do Excel</h4>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-lilas-30 text-zry-text-2">
              Sem necessidade de login
            </span>
          </div>

          <div className="p-[22px] space-y-4">
            <p className="text-[12.5px] text-zry-text-2 leading-relaxed">
              Envie um arquivo <strong>.tsv</strong>, <strong>.csv</strong> ou <strong>.txt</strong> salvo no computador — ou selecione as linhas no Excel
              (incluindo o cabeçalho), copie com Ctrl+C e cole. É aqui que entra a importação em lote de parceiros e indicações;
              o "Restaurar backup" do rodapé é outra coisa: ele só lê arquivo <strong>.json</strong> e substitui toda a base.
            </p>

            <button
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
            >
              <Upload className="w-4 h-4" />
              <span>Enviar arquivo ou colar dados</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Pasting Excel Data */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-zry-roxo/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zry-surface rounded-zry-xl max-w-2xl w-full shadow-sm border border-zry-border">
            <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
                  <ClipboardPaste className="w-[18px] h-[18px]" />
                </span>
                <h3 className="text-[15px] font-bold text-zry-text">Colar Tabela do Excel / Planilha</h3>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zry-text-2 hover:bg-zry-lilas-30 hover:text-zry-text text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="p-[22px] space-y-4">
              <p className="text-[12.5px] text-zry-text-2 leading-relaxed">
                Copie a tabela no Excel (com colunas como Parceiro, Cliente, Data, Status, Valor, Fechamento, Comissão) e cole na área abaixo — ou escolha um arquivo .tsv/.csv:
              </p>

              <label className="flex items-center gap-2.5 border border-dashed border-zry-border-strong rounded-zry-lg px-3.5 py-3 cursor-pointer hover:bg-zry-lilas-30 transition">
                <Upload className="w-4 h-4 text-zry-roxo shrink-0" />
                <span className="text-[12.5px] text-zry-text-2">
                  {loadedFileName
                    ? <><span className="font-semibold text-zry-text">{loadedFileName}</span> carregado — confira abaixo e importe</>
                    : 'Selecionar arquivo .tsv, .csv ou .txt'}
                </span>
                <input
                  type="file"
                  accept=".tsv,.csv,.txt,text/plain,text/csv,text/tab-separated-values"
                  className="hidden"
                  onChange={e => {
                    handlePickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>

              <textarea
                rows={8}
                placeholder="Cole aqui os dados copiados do Excel..."
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                className="w-full font-mono text-[11px] bg-zry-lilas-30 border border-transparent rounded-zry-lg p-3.5 focus:outline-none focus:border-zry-border-strong text-zry-text placeholder-zry-text-2"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-[18px] py-2.5 rounded-full text-[12.5px] font-semibold text-zry-text-2 hover:bg-zry-lilas-30 hover:text-zry-text transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportPastedData}
                  disabled={!pastedData.trim()}
                  className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
                >
                  Processar e Importar Linhas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
