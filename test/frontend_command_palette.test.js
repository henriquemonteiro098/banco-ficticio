/**
 * test/frontend_command_palette.test.js — Frontend Verification for Command Bar & Chat IA (M3)
 *
 * Validates Requirement R1:
 * - Intelligent Command Bar trigger button in the header
 * - Command Palette / Chat IA modal structure in public/index.html
 * - Global hotkey handling ('/' and 'Escape') in public/app.js
 * - Dynamic suggested commands menu (/saldo, /extrato, /pix, /contas, /agencias, /ajuda)
 * - Natural language chat and latency indicator integration
 * - Rich interactive card rendering (/saldo, /extrato, /pix, /contas, /agencias, NL)
 * - CSS styling in public/styles.css
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const htmlContent = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const jsContent = fs.readFileSync(path.join(PUBLIC_DIR, 'app.js'), 'utf8');
const cssContent = fs.readFileSync(path.join(PUBLIC_DIR, 'styles.css'), 'utf8');

test('1. Intelligent Header Command Bar Trigger (Requirement R1)', async (t) => {
  await t.test('Gatilho principal #btnOpenCommandBar existe no index.html', () => {
    assert.ok(htmlContent.includes('id="btnOpenCommandBar"'), 'ID btnOpenCommandBar deve estar presente');
  });

  await t.test('Gatilho aciona abrirCommandPalette() ao clicar', () => {
    assert.ok(htmlContent.includes('onclick="abrirCommandPalette()"'), 'onclick deve chamar abrirCommandPalette()');
  });

  await t.test('Contém ícone de busca (fa-magnifying-glass)', () => {
    assert.ok(htmlContent.includes('fa-magnifying-glass'), 'Ícone fa-magnifying-glass deve estar no botão');
  });

  await t.test('Contém texto explicativo "Buscar ou digitar comando..."', () => {
    assert.ok(htmlContent.includes('Buscar ou digitar comando...'), 'Texto "Buscar ou digitar comando..." deve estar no botão');
  });

  await t.test('Contém badge de atalho de teclado com a tecla "/"', () => {
    assert.ok(htmlContent.includes('<kbd') && htmlContent.includes('>/</kbd>'), 'Badge kbd com "/" deve estar visível');
  });
});

test('2. Command Palette / Chat IA Modal Structure (Requirement R1)', async (t) => {
  await t.test('Modal #modalCommandPalette existe com role dialog', () => {
    assert.ok(htmlContent.includes('id="modalCommandPalette"'), 'Modal modalCommandPalette deve existir');
    assert.ok(htmlContent.includes('role="dialog"'), 'Acessibilidade: role dialog presente');
  });

  await t.test('Campo de entrada #commandPaletteInput configurado adequadamente', () => {
    assert.ok(htmlContent.includes('id="commandPaletteInput"'), 'Input commandPaletteInput deve existir');
    assert.ok(htmlContent.includes('placeholder="Digite um comando'), 'Placeholder orientativo deve existir');
  });

  await t.test('Badge de latência em tempo real #commandLatencyBadge existe', () => {
    assert.ok(htmlContent.includes('id="commandLatencyBadge"'), 'Badge de latência deve existir');
  });

  await t.test('Menu dinâmico de sugestões #commandSuggestionsDropdown existe', () => {
    assert.ok(htmlContent.includes('id="commandSuggestionsDropdown"'), 'Container commandSuggestionsDropdown deve existir');
    assert.ok(htmlContent.includes('id="commandSuggestionsList"'), 'Lista commandSuggestionsList deve existir');
  });

  await t.test('Feed de mensagens #commandChatFeed existe', () => {
    assert.ok(htmlContent.includes('id="commandChatFeed"'), 'Feed commandChatFeed deve existir');
  });

  await t.test('Botão de limpar entrada #btnClearCommandInput existe', () => {
    assert.ok(htmlContent.includes('id="btnClearCommandInput"'), 'Botão limpar input deve existir');
  });

  await t.test('Indicador de conta ativa do usuário no rodapé da palette', () => {
    assert.ok(htmlContent.includes('id="commandPaletteContaAtiva"'), 'Elemento commandPaletteContaAtiva deve existir');
  });

  await t.test('Mensagem de boas-vindas contém botões para os 6 comandos rápidos', () => {
    const comandos = ['/saldo', '/extrato', '/pix', '/contas', '/agencias', '/ajuda'];
    for (const cmd of comandos) {
      assert.ok(
        htmlContent.includes(`executarComandoRapido('${cmd}')`),
        `Botão de atalho rápido para ${cmd} deve existir na mensagem inicial`
      );
    }
  });

  await t.test('Mensagem de boas-vindas contém exemplos de perguntas livres', () => {
    assert.ok(htmlContent.includes('Qual o saldo da Ana Paula?'), 'Exemplo saldo Ana Paula presente');
    assert.ok(htmlContent.includes('Quanto temos sob custódia no banco?'), 'Exemplo custódia presente');
    assert.ok(htmlContent.includes('Qual foi a última transferência?'), 'Exemplo transferência presente');
  });
});

test('3. Hotkeys & Global Keyboard Event Listeners (Requirement R1)', async (t) => {
  await t.test('Listener de teclado window keydown registrado em public/app.js', () => {
    assert.ok(jsContent.includes("window.addEventListener('keydown'"), 'Listener de keydown deve ser registrado no window');
  });

  await t.test('Tecla "/" abre a Command Palette com guarda para inputs e campos editáveis', () => {
    assert.ok(jsContent.includes("e.key === '/'"), "Deve capturar pressionamento da tecla '/'");
    assert.ok(jsContent.includes("tagName === 'input'"), "Deve ignorar foco em input");
    assert.ok(jsContent.includes("tagName === 'textarea'"), "Deve ignorar foco em textarea");
    assert.ok(jsContent.includes("tagName === 'select'"), "Deve ignorar foco em select");
    assert.ok(jsContent.includes("isContentEditable"), "Deve ignorar foco em contentEditable");
    assert.ok(jsContent.includes("abrirCommandPalette()"), "Deve chamar abrirCommandPalette()");
  });

  await t.test('Tecla "Escape" fecha a Command Palette', () => {
    assert.ok(jsContent.includes("e.key === 'Escape'"), "Deve capturar tecla Escape");
    assert.ok(jsContent.includes("fecharCommandPalette()"), "Deve invocar fecharCommandPalette()");
  });

  await t.test('Navegação por setas (ArrowDown / ArrowUp) implementada para sugestões', () => {
    assert.ok(jsContent.includes("e.key === 'ArrowDown'"), "Navegação para baixo (ArrowDown) implementada");
    assert.ok(jsContent.includes("e.key === 'ArrowUp'"), "Navegação para cima (ArrowUp) implementada");
    assert.ok(jsContent.includes("atualizarDestaqueSugestao()"), "Função de destaque chamada na navegação");
  });

  await t.test('Tecla "Enter" seleciona sugestão ou submete pergunta livre', () => {
    assert.ok(jsContent.includes("e.key === 'Enter'"), "Tecla Enter tratada no input");
    assert.ok(jsContent.includes("executarComandoRapido"), "Enter aciona comando rápido selecionado");
    assert.ok(jsContent.includes("enviarMensagemAssistente"), "Enter aciona envio para o assistente");
  });
});

test('4. Dynamic Suggested Commands & Intent Filtering (Requirement R1)', async (t) => {
  await t.test('Todos os 6 comandos bancários estão cadastrados no estado global', () => {
    const comandosEsperados = ['/saldo', '/extrato', '/pix', '/contas', '/agencias', '/ajuda'];
    for (const cmd of comandosEsperados) {
      assert.ok(jsContent.includes(`comando: '${cmd}'`), `Comando ${cmd} deve estar declarado em state.comandosDisponiveis`);
    }
  });

  await t.test('Função renderizarSugestoesComandos implementada e trata prefixos', () => {
    assert.ok(jsContent.includes('function renderizarSugestoesComandos'), 'renderizarSugestoesComandos deve existir');
    assert.ok(jsContent.includes("t.startsWith('/')"), 'Filtro inteligente com prefixo / implementado');
  });

  await t.test('Funções de clique e hover para comandos sugeridos existem', () => {
    assert.ok(jsContent.includes('function selecionarSugestaoHover'), 'selecionarSugestaoHover deve existir');
    assert.ok(jsContent.includes('function executarComandoRapido'), 'executarComandoRapido deve existir');
    assert.ok(jsContent.includes('function executarPerguntaRapida'), 'executarPerguntaRapida deve existir');
  });
});

test('5. Natural Language Communication & Real-time Latency (Requirement R1)', async (t) => {
  await t.test('Função enviarMensagemAssistente envia POST para /api/assistente/consulta', () => {
    assert.ok(jsContent.includes("fetch('/api/assistente/consulta'"), 'Chamada fetch para endpoint correto');
    assert.ok(jsContent.includes("method: 'POST'"), 'Método POST especificado');
    assert.ok(jsContent.includes('conta_id'), 'Parâmetro conta_id enviado');
    assert.ok(jsContent.includes('cliente_id'), 'Parâmetro cliente_id enviado');
  });

  await t.test('Mede e exibe indicador de latência com badge', () => {
    assert.ok(jsContent.includes('performance.now()'), 'Mede tempo de resposta via performance.now');
    assert.ok(jsContent.includes('commandLatencyBadge'), 'Atualiza badge commandLatencyBadge');
    assert.ok(jsContent.includes('tempo_ms'), 'Utiliza métrica tempo_ms da resposta do backend');
  });

  await t.test('Indicador de carregamento em tempo real adicionado e removido do feed', () => {
    assert.ok(jsContent.includes('adicionarIndicadorCarregandoFeed'), 'adicionarIndicadorCarregandoFeed implementado');
    assert.ok(jsContent.includes('removerElementoFeed'), 'removerElementoFeed implementado');
  });
});

test('6. Rich Interactive Cards Rendering (Requirement R1)', async (t) => {
  await t.test('Função renderizarCardAssistente implementada para os tipos de resposta', () => {
    assert.ok(jsContent.includes('function renderizarCardAssistente'), 'renderizarCardAssistente deve existir');
    assert.ok(jsContent.includes("tipo === 'saldo'"), 'Renderiza card de /saldo');
    assert.ok(jsContent.includes("tipo === 'extrato'"), 'Renderiza card de /extrato');
    assert.ok(jsContent.includes("tipo === 'pix'"), 'Renderiza card de /pix');
    assert.ok(jsContent.includes("tipo === 'contas'"), 'Renderiza card de /contas');
    assert.ok(jsContent.includes("tipo === 'agencias'"), 'Renderiza card de /agencias');
    assert.ok(jsContent.includes("tipo === 'saldo_cliente'"), 'Renderiza card de saldo_cliente');
    assert.ok(jsContent.includes("tipo === 'custodia_total'"), 'Renderiza card de custodia_total');
    assert.ok(jsContent.includes("tipo === 'ultima_transferencia'"), 'Renderiza card de ultima_transferencia');
  });

  await t.test('Card de /saldo apresenta Saldo em Conta, Cheque Especial e Total Disponível', () => {
    assert.ok(jsContent.includes('Saldo em Conta'), 'Card saldo tem Saldo em Conta');
    assert.ok(jsContent.includes('Cheque Especial'), 'Card saldo tem Cheque Especial');
    assert.ok(jsContent.includes('Total Disponível'), 'Card saldo tem Total Disponível');
  });

  await t.test('Card de /extrato renderiza badges direcionais de valor (+ e -)', () => {
    assert.ok(jsContent.includes("item.direcao === 'entrada'"), 'Verifica direção da transação');
    assert.ok(jsContent.includes("text-emerald-400"), 'Badge verde para entradas');
    assert.ok(jsContent.includes("text-rose-400"), 'Badge vermelho para saídas');
  });

  await t.test('Card de /pix possui ação de transferência que preenche modal', () => {
    assert.ok(jsContent.includes('iniciarPixParaContato'), 'iniciarPixParaContato implementado');
    assert.ok(jsContent.includes('pixContaDestino'), 'Preenche campo de conta destino do PIX');
  });

  await t.test('Função escapeHtml protege o feed contra injeção de script', () => {
    assert.ok(jsContent.includes('function escapeHtml'), 'Higienização escapeHtml implementada');
  });
});

test('7. CSS Styling & Layout Polish (styles.css)', async (t) => {
  await t.test('Classe .command-palette-card com sombras e animação', () => {
    assert.ok(cssContent.includes('.command-palette-card'), 'Classe .command-palette-card declarada');
    assert.ok(cssContent.includes('animation: paletteScaleIn'), 'Animação de entrada suave da palette');
  });

  await t.test('Classe .command-suggestion-item com hover e destaque active', () => {
    assert.ok(cssContent.includes('.command-suggestion-item'), 'Classe .command-suggestion-item declarada');
    assert.ok(cssContent.includes('.command-suggestion-item.active'), 'Classe active para item selecionado');
  });

  await t.test('Classes de bolhas do chat .chat-bubble-user e .chat-bubble-bot', () => {
    assert.ok(cssContent.includes('.chat-bubble-user'), 'Estilo chat-bubble-user presente');
    assert.ok(cssContent.includes('.chat-bubble-bot'), 'Estilo chat-bubble-bot presente');
  });

  await t.test('Indicador pulsante de requisição em andamento (.pulse-indicator)', () => {
    assert.ok(cssContent.includes('.pulse-indicator'), 'Classe .pulse-indicator declarada');
  });
});
