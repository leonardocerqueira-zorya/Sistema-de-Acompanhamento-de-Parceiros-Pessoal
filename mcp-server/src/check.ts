import './env';
import { createServiceClient, loadDataset } from './data';

// ---------------------------------------------------------------------------
// Conferência de configuração: roda uma vez, diz se a chave funciona e sai.
//
// Existe porque o servidor stdio, quando a credencial está certa, simplesmente
// fica esperando em silêncio — o que é indistinguível de "travou" para quem não
// é dev. Aqui a resposta é sempre explícita: deu certo e achou N parceiros, ou
// deu errado e o motivo está em português.
//
// Rodar: npm run mcp:check
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Conferindo a configuracao do servidor MCP...\n');

  let client;
  try {
    client = createServiceClient();
  } catch (err) {
    console.error('X  Falta configuracao.\n');
    console.error(`   ${err instanceof Error ? err.message : err}\n`);
    console.error('   Abra o arquivo mcp-server/.env e cole a chave depois do "=".');
    process.exit(1);
  }

  console.log('OK Chave encontrada. Conectando no Supabase...');

  let dados;
  try {
    dados = await loadDataset(client);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\nX  Nao consegui ler os dados.\n');
    console.error(`   ${msg}\n`);
    if (/JWT|api key|Invalid|401/i.test(msg)) {
      console.error('   Isso costuma ser chave errada. Confira se voce copiou a linha');
      console.error('   "service_role" (e nao a "anon public") la no Supabase.');
    }
    process.exit(1);
  }

  console.log('OK Conectado.\n');
  console.log('Encontrei no banco:');
  console.log(`  ${dados.partners.length} parceiros`);
  console.log(`  ${dados.referrals.length} indicacoes`);
  console.log(`  ${dados.channelCosts.length} meses com custo do canal informado`);
  console.log(`  ${dados.newMrrEntries.length} meses com MRR novo informado`);

  if (dados.partners.length === 0) {
    console.log('\n!  Zero parceiros. A conexao funcionou, mas nao veio dado nenhum.');
    console.log('   Provavelmente a chave nao e a service_role (a anon nao le tudo).');
    process.exit(1);
  }

  console.log('\nTudo certo. Pode reiniciar o Claude Code e comecar a perguntar.');
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
