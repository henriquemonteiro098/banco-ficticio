// =============================================================================
// app.js — Lógica Reativa do Banco Fictício
// =============================================================================

// Estado Global
let state = {
  usuario: null,
  abaAtiva: 'banco',
  dadosBanco: null,
  todasContas: [],
  contaClienteAtiva: null,
  extratoCompleto: [],
  filtroExtratoAtual: 'todos',
  chartTipos: null,
  commandPaletteAberta: false,
  selectedSuggestionIndex: -1,
  filteredComandos: [],
  comandosDisponiveis: [
    { comando: '/saldo', titulo: 'Saldo da Conta Ativa', descricao: 'Saldo atual, limite e disponível da conta ativa', icone: 'fa-wallet' },
    { comando: '/extrato', titulo: 'Últimos Lançamentos', descricao: 'Últimos lançamentos com badges de valor (+/-)', icone: 'fa-receipt' },
    { comando: '/pix', titulo: 'Transferência PIX', descricao: 'Fluxo rápido de transferência PIX', icone: 'fa-bolt' },
    { comando: '/contas', titulo: 'Contas Cadastradas', descricao: 'Visão rápida das contas cadastradas', icone: 'fa-address-card' },
    { comando: '/agencias', titulo: 'Rede de Agências', descricao: 'Consulta de agências bancárias e códigos', icone: 'fa-building-columns' },
    { comando: '/emprestimo', titulo: 'Simular Empréstimo', descricao: 'Simulação e contratação de crédito pessoal a 1,89% a.m.', icone: 'fa-hand-holding-dollar' },
    { comando: '/ajuda', titulo: 'Guia de Comandos', descricao: 'Lista de comandos e perguntas que o assistente responde', icone: 'fa-circle-question' },
  ],
};

// Formatação Monetária (R$)
function formatarMoeda(valor) {
  const num = parseFloat(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formatação de Data e Hora
function formatarData(dataIso) {
  if (!dataIso) return '-';
  const data = new Date(dataIso);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Toast Notification
function showToast(mensagem, tipo = 'sucesso') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const corBg = tipo === 'sucesso' ? 'bg-emerald-600' : tipo === 'erro' ? 'bg-rose-600' : 'bg-indigo-600';
  const icone = tipo === 'sucesso' ? 'fa-circle-check' : tipo === 'erro' ? 'fa-circle-xmark' : 'fa-circle-info';

  toast.className = `toast-msg px-4 py-3 rounded-xl ${corBg} text-white shadow-xl flex items-center gap-3 text-xs font-medium max-w-sm`;
  toast.innerHTML = `
    <i class="fa-solid ${icone} text-sm"></i>
    <span>${mensagem}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Inicialização ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await verificarHealth();
  // Login padrão como admin para início imediato
  await realizarLoginAutomatico('admin', 'admin');
  await carregarDadosBanco();
  await carregarTodasContas();
  inicializarCommandPalette();
  inicializarSimuladorEmprestimo();
});

// Checar conexão com banco de dados
async function verificarHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'online') {
      document.getElementById('headerDbStatus').textContent = 'Online (porta 5432)';
    }
  } catch (err) {
    document.getElementById('headerDbStatus').textContent = 'Erro de Conexão';
    document.getElementById('headerDbStatus').classList.remove('text-emerald-400');
    document.getElementById('headerDbStatus').classList.add('text-rose-400');
  }
}

// ─── Navegação entre Abas ─────────────────────────────────────────────────────
function trocarAba(aba) {
  state.abaAtiva = aba;
  const navBanco = document.getElementById('navTabBanco');
  const navCliente = document.getElementById('navTabCliente');
  const viewBanco = document.getElementById('viewBanco');
  const viewCliente = document.getElementById('viewCliente');

  if (aba === 'banco') {
    navBanco.classList.add('tab-active');
    navCliente.classList.remove('tab-active');
    viewBanco.classList.remove('hidden');
    viewCliente.classList.add('hidden');
    carregarDadosBanco();
  } else {
    navCliente.classList.add('tab-active');
    navBanco.classList.remove('tab-active');
    viewCliente.classList.remove('hidden');
    viewBanco.classList.add('hidden');

    // Se o usuário logado for admin, carrega dados de um cliente padrão (Ana Paula) para exibição imediata
    if (!state.usuario || state.usuario.papel === 'admin') {
      carregarClientePorId(1);
    } else {
      carregarClienteLogado();
    }
  }
}

// ─── Autenticação & Usuários ──────────────────────────────────────────────────
async function realizarLoginAutomatico(login, senha) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });
    const data = await res.json();
    if (data.sucesso) {
      aplicarSessaoUsuario(data.usuario);
    }
  } catch (e) {
    console.warn('Falha no login automático:', e);
  }
}

async function realizarLogin(e) {
  e.preventDefault();
  const login = document.getElementById('inputLogin').value;
  const senha = document.getElementById('inputSenha').value;
  const erroDiv = document.getElementById('loginErro');

  erroDiv.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });
    const data = await res.json();

    if (!res.ok || !data.sucesso) {
      erroDiv.textContent = data.erro || 'Falha ao autenticar';
      erroDiv.classList.remove('hidden');
      return;
    }

    aplicarSessaoUsuario(data.usuario);
    fecharModalLogin();
    showToast(`Bem-vindo, ${data.usuario.nome}!`, 'sucesso');

    // Redireciona para a aba correspondente
    if (data.usuario.papel === 'cliente') {
      trocarAba('cliente');
    } else {
      trocarAba('banco');
    }
  } catch (err) {
    erroDiv.textContent = 'Erro ao conectar ao servidor';
    erroDiv.classList.remove('hidden');
  }
}

function aplicarSessaoUsuario(usuario) {
  state.usuario = usuario;
  document.getElementById('userDisplayName').textContent = usuario.nome;
  const badge = document.getElementById('userRoleBadge');
  badge.textContent = usuario.papel === 'admin' ? '🛡️ Administrador' : '👤 Cliente';
  badge.className = usuario.papel === 'admin'
    ? 'text-[11px] font-mono text-indigo-400 font-semibold'
    : 'text-[11px] font-mono text-emerald-400 font-semibold';

  if (usuario.papel === 'cliente') {
    carregarClienteLogado();
  }
}

function abrirModalLogin() {
  document.getElementById('modalLogin').classList.remove('hidden');
}

function fecharModalLogin() {
  document.getElementById('modalLogin').classList.add('hidden');
}

function preencherLogin(login, senha) {
  document.getElementById('inputLogin').value = login;
  document.getElementById('inputSenha').value = senha;
}

// ─── 🏛️ O Banco (Gestão) ─────────────────────────────────────────────────────

async function carregarDadosBanco() {
  try {
    const res = await fetch('/api/banco/dashboard');
    const data = await res.json();
    state.dadosBanco = data;

    // Atualiza KPIs
    const kpis = data.kpis;
    document.getElementById('kpiCustodia').textContent = formatarMoeda(kpis.total_custodia);
    document.getElementById('kpiClientes').textContent = kpis.total_clientes;
    document.getElementById('kpiContasSubtitle').textContent = `${kpis.total_contas_ativas} contas ativas vinculadas`;
    document.getElementById('kpiAgencias').textContent = kpis.total_agencias_ativas;
    document.getElementById('kpiVolumeTotal').textContent = formatarMoeda(kpis.volume_total);
    document.getElementById('kpiTotalTxSubtitle').textContent = `${kpis.total_transacoes} transações liquidadas`;

    // Renderizar gráfico
    renderizarGraficoTipos(data.distribuicao);

    // Renderizar agências
    renderizarTabelaAgencias(data.rankingAgencias);

    // Carregar tabela de transações
    await carregarTransacoesGlobais();
  } catch (err) {
    console.error('Erro ao carregar dashboard do banco:', err);
  }
}

function renderizarGraficoTipos(distribuicao) {
  const ctx = document.getElementById('chartTiposTx');
  if (!ctx) return;

  const labels = distribuicao.map(d => d.tipo.toUpperCase());
  const dados = distribuicao.map(d => parseFloat(d.volume));

  const cores = [
    '#6366f1', // transferencia / pix (indigo)
    '#10b981', // deposito (emerald)
    '#f59e0b', // pagamento (amber)
    '#ef4444', // saque (red)
    '#8b5cf6', // tarifa (purple)
    '#06b6d4', // estorno (cyan)
  ];

  if (state.chartTipos) {
    state.chartTipos.destroy();
  }

  state.chartTipos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: dados,
        backgroundColor: cores.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#0f172a',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { size: 10, family: 'Inter' },
            boxWidth: 12,
          }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatarMoeda(item.raw)}`,
          }
        }
      },
      cutout: '70%',
    }
  });
}

function renderizarTabelaAgencias(agencias) {
  const tbody = document.getElementById('tbodyAgencias');
  if (!tbody) return;

  tbody.innerHTML = agencias.map(ag => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="py-2.5">
        <span class="text-white font-medium">${ag.codigo}</span>
        <span class="text-slate-400 block text-[11px] font-sans">${ag.nome}</span>
      </td>
      <td class="py-2.5 text-slate-300 font-sans">${ag.cidade}/${ag.estado}</td>
      <td class="py-2.5 text-center text-slate-300">${ag.qtd_contas}</td>
      <td class="py-2.5 text-right font-bold text-emerald-400">${formatarMoeda(ag.saldo_total)}</td>
    </tr>
  `).join('');
}

async function carregarTodasContas() {
  try {
    const res = await fetch('/api/banco/contas');
    const contas = await res.json();
    state.todasContas = contas;
    document.getElementById('contasCount').textContent = contas.length;
    renderizarTabelaTodasContas(contas);
    popularSelectsContas(contas);
  } catch (err) {
    console.error('Erro ao carregar contas:', err);
  }
}

function renderizarTabelaTodasContas(contas) {
  const tbody = document.getElementById('tbodyTodasContas');
  if (!tbody) return;

  tbody.innerHTML = contas.map(ct => {
    const badgeStatus = ct.status === 'ativa'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : ct.status === 'bloqueada'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-2.5 px-3 text-white font-bold">${ct.numero}-${ct.digito}</td>
        <td class="py-2.5 px-3 text-slate-200 font-sans">
          <div class="flex items-center gap-2.5">
            <img src="/assets/avatars/avatar-${((ct.cliente_id - 1) % 8) + 1}.png" alt="" class="w-6 h-6 rounded-full object-cover border border-slate-700/60 shadow-sm" onerror="this.style.display='none'">
            <span>${ct.cliente_nome}</span>
          </div>
        </td>
        <td class="py-2.5 px-3 text-slate-400 text-[11px]">${ct.agencia_codigo}</td>
        <td class="py-2.5 px-3 uppercase text-[10px] text-slate-400">${ct.tipo}</td>
        <td class="py-2.5 px-3 text-right font-bold ${parseFloat(ct.saldo) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${formatarMoeda(ct.saldo)}
        </td>
        <td class="py-2.5 px-3 text-right text-slate-400">${formatarMoeda(ct.limite)}</td>
        <td class="py-2.5 px-3 text-center">
          <span class="px-2 py-0.5 rounded-full border text-[10px] uppercase font-semibold ${badgeStatus}">
            ${ct.status}
          </span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="acessarClientePorConta(${ct.cliente_id})" title="Acessar Área do Cliente deste titular" class="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white transition text-[11px] font-sans">
            Acessar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarTabelaContas() {
  const busca = document.getElementById('filtroContas').value.toLowerCase();
  const filtradas = state.todasContas.filter(ct =>
    ct.numero.includes(busca) ||
    ct.cliente_nome.toLowerCase().includes(busca) ||
    ct.agencia_codigo.includes(busca)
  );
  renderizarTabelaTodasContas(filtradas);
}

async function carregarTransacoesGlobais() {
  const tipo = document.getElementById('filtroTipoTxGlobal').value;
  try {
    const res = await fetch(`/api/banco/transacoes?tipo=${tipo}&limite=30`);
    const transacoes = await res.json();
    renderizarTabelaTransacoesGlobais(transacoes);
  } catch (err) {
    console.error('Erro ao carregar transações globais:', err);
  }
}

function renderizarTabelaTransacoesGlobais(transacoes) {
  const tbody = document.getElementById('tbodyTodasTransacoes');
  if (!tbody) return;

  if (transacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500 font-sans">Nenhuma transação encontrada</td></tr>`;
    return;
  }

  tbody.innerHTML = transacoes.map(t => {
    const corTipo = t.tipo === 'deposito' ? 'text-emerald-400' : t.tipo === 'pagamento' ? 'text-amber-400' : t.tipo === 'saque' ? 'text-rose-400' : 'text-indigo-400';
    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-2 px-3 text-slate-400 text-[11px]">${formatarData(t.realizada_em)}</td>
        <td class="py-2 px-3 uppercase text-[10px] font-bold ${corTipo}">${t.tipo}</td>
        <td class="py-2 px-3 text-slate-300 font-sans truncate max-w-xs">${t.descricao || '-'}</td>
        <td class="py-2 px-3 text-slate-400 text-[11px]">${t.conta_origem ? `${t.conta_origem} (${t.remetente || ''})` : '—'}</td>
        <td class="py-2 px-3 text-slate-400 text-[11px]">${t.conta_destino ? `${t.conta_destino} (${t.destinatario || ''})` : '—'}</td>
        <td class="py-2 px-3 text-right font-bold text-white">${formatarMoeda(t.valor)}</td>
        <td class="py-2 px-3 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}">
            ${t.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── 👤 Área do Cliente ───────────────────────────────────────────────────────

async function carregarClienteLogado() {
  if (state.usuario && state.usuario.cliente_id) {
    await carregarClientePorId(state.usuario.cliente_id);
  }
}

async function acessarClientePorConta(clienteId) {
  await carregarClientePorId(clienteId);
  trocarAba('cliente');
}

async function carregarClientePorId(clienteId) {
  try {
    const res = await fetch(`/api/cliente/${clienteId}/resumo`);
    const data = await res.json();

    const cliente = data.cliente;
    const contas = data.contas;

    // Atualiza cabeçalho do cliente
    document.getElementById('clienteNome').textContent = cliente.nome;
    document.getElementById('cardTitular').textContent = cliente.nome;
    document.getElementById('clienteDocs').textContent = `CPF: ${cliente.cpf} • ${cliente.cidade || ''}/${cliente.estado || ''}`;

    const iniciais = cliente.nome.split(' ').map(n => n[0]).slice(0, 2).join('');
    const avatarEl = document.getElementById('clienteAvatar');
    if (avatarEl) {
      const avatarId = ((cliente.id - 1) % 8) + 1;
      avatarEl.innerHTML = `<img src="/assets/avatars/avatar-${avatarId}.png" alt="${cliente.nome}" class="w-full h-full object-cover rounded-2xl" onerror="this.parentElement.textContent='${iniciais}'">`;
    }

    // Popula seletor de contas do cliente
    const select = document.getElementById('selectContaCliente');
    select.innerHTML = contas.map(ct => `
      <option value="${ct.id}">Conta ${ct.numero}-${ct.digito} (${ct.tipo.toUpperCase()}) — Saldo: ${formatarMoeda(ct.saldo)}</option>
    `).join('');

    if (contas.length > 0) {
      await selecionarContaCliente(contas[0].id);
    }
  } catch (err) {
    console.error('Erro ao carregar dados do cliente:', err);
  }
}

async function selecionarContaCliente(contaId) {
  try {
    const res = await fetch(`/api/cliente/conta/${contaId}/extrato`);
    const data = await res.json();

    state.contaClienteAtiva = data.conta;
    state.extratoCompleto = data.extrato;

    const ct = data.conta;
    document.getElementById('cardTipoConta').textContent = `Conta ${ct.tipo.charAt(0).toUpperCase() + ct.tipo.slice(1)}`;
    document.getElementById('cardNumeroConta').textContent = `${ct.numero}-${ct.digito}`;
    document.getElementById('cardAgencia').textContent = `${ct.agencia_codigo}`;
    document.getElementById('extratoContaNumero').textContent = `${ct.numero}-${ct.digito}`;

    // Saldos
    const saldo = parseFloat(ct.saldo) || 0;
    const limite = parseFloat(ct.limite) || 0;
    document.getElementById('clienteSaldo').textContent = formatarMoeda(saldo);
    document.getElementById('clienteLimite').textContent = formatarMoeda(limite);
    document.getElementById('clienteSaldoDisponivel').textContent = formatarMoeda(saldo + limite);

    // Atualiza conta de destino no simulador de empréstimo
    const elSimConta = document.getElementById('simuladorContaDestino');
    if (elSimConta) {
      elSimConta.textContent = `${ct.numero}-${ct.digito}`;
    }

    // Renderizar extrato
    renderizarExtrato();
  } catch (err) {
    console.error('Erro ao selecionar conta:', err);
  }
}

function filtrarExtrato(filtro) {
  state.filtroExtratoAtual = filtro;

  // Botões de filtro
  document.getElementById('btnExtratoTodos').className = filtro === 'todos' ? 'px-3 py-1 text-xs rounded-lg bg-indigo-600 text-white font-medium' : 'px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 font-medium hover:text-white';
  document.getElementById('btnExtratoEntrada').className = filtro === 'entrada' ? 'px-3 py-1 text-xs rounded-lg bg-emerald-600 text-white font-medium' : 'px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 font-medium hover:text-white';
  document.getElementById('btnExtratoSaida').className = filtro === 'saida' ? 'px-3 py-1 text-xs rounded-lg bg-rose-600 text-white font-medium' : 'px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 font-medium hover:text-white';

  renderizarExtrato();
}

function renderizarExtrato() {
  const lista = document.getElementById('listaExtrato');
  if (!lista) return;

  let itens = state.extratoCompleto;
  if (state.filtroExtratoAtual === 'entrada') {
    itens = itens.filter(t => t.direcao === 'entrada');
  } else if (state.filtroExtratoAtual === 'saida') {
    itens = itens.filter(t => t.direcao === 'saida');
  }

  if (itens.length === 0) {
    lista.innerHTML = `<div class="py-8 text-center text-xs text-slate-500">Nenhum lançamento no extrato para este filtro.</div>`;
    return;
  }

  lista.innerHTML = itens.map(t => {
    const isEntrada = t.direcao === 'entrada';
    const icone = isEntrada ? 'fa-arrow-down-left text-emerald-400 bg-emerald-500/10' : 'fa-arrow-up-right text-rose-400 bg-rose-500/10';
    const sinal = isEntrada ? '+' : '-';
    const corValor = isEntrada ? 'text-emerald-400 font-bold' : 'text-slate-100 font-bold';

    let detalheContraparte = '';
    if (t.tipo === 'transferencia') {
      detalheContraparte = isEntrada ? `De: ${t.remetente || 'Outra Conta'}` : `Para: ${t.destinatario || 'Outra Conta'}`;
    }

    const badgeOp = t.tipo === 'pix' ? '/assets/operacoes/op-pix.png' : t.tipo === 'transferencia' ? '/assets/operacoes/op-transferencia.png' : t.tipo === 'deposito' ? '/assets/operacoes/op-deposito.png' : t.tipo === 'saque' ? '/assets/operacoes/op-saque.png' : '/assets/operacoes/op-pagamento.png';

    return `
      <div class="py-3 flex items-center justify-between text-xs hover:bg-slate-900/60 px-2 rounded-xl transition">
        <div class="flex items-center gap-3">
          <img src="${badgeOp}" alt="${t.tipo}" class="w-9 h-9 rounded-xl object-contain p-0.5 border border-slate-700/50 bg-slate-900/60 shadow-sm flex-shrink-0" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
          <div class="w-9 h-9 rounded-xl items-center justify-center ${icone} hidden flex-shrink-0">
            <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          </div>
          <div>
            <p class="font-semibold text-white">${t.descricao || t.tipo.toUpperCase()}</p>
            <p class="text-[11px] text-slate-400">
              ${formatarData(t.realizada_em)} • <span class="uppercase">${t.tipo}</span> ${detalheContraparte ? `• ${detalheContraparte}` : ''}
            </p>
          </div>
        </div>
        <div class="text-right font-mono">
          <p class="${corValor}">${sinal} ${formatarMoeda(t.valor)}</p>
          <span class="text-[10px] text-slate-500 uppercase">${t.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Modais & Operações ───────────────────────────────────────────────────────

function popularSelectsContas(contas) {
  // Select de Destino do PIX
  const selectPix = document.getElementById('pixContaDestino');
  if (selectPix) {
    selectPix.innerHTML = contas.map(ct => `
      <option value="${ct.numero}">Conta ${ct.numero}-${ct.digito} — ${ct.cliente_nome} (${ct.tipo})</option>
    `).join('');
  }

  // Select de Operação Administrativa do Banco
  const selectOp = document.getElementById('opBancoConta');
  if (selectOp) {
    selectOp.innerHTML = contas.map(ct => `
      <option value="${ct.id}">Conta ${ct.numero}-${ct.digito} — ${ct.cliente_nome} [Saldo: ${formatarMoeda(ct.saldo)}]</option>
    `).join('');
  }
}

// Modal PIX
function abrirModalPix() {
  if (!state.contaClienteAtiva) {
    showToast('Selecione uma conta de cliente primeiro', 'erro');
    return;
  }
  document.getElementById('pixFeedback').classList.add('hidden');
  document.getElementById('modalPix').classList.remove('hidden');
}

function fecharModalPix() {
  document.getElementById('modalPix').classList.add('hidden');
}

async function executarTransferencia(e) {
  e.preventDefault();
  const contaDestino = document.getElementById('pixContaDestino').value;
  const valor = document.getElementById('pixValor').value;
  const descricao = document.getElementById('pixDescricao').value;
  const feedback = document.getElementById('pixFeedback');

  feedback.classList.add('hidden');

  try {
    const res = await fetch('/api/cliente/transferir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conta_origem_id: state.contaClienteAtiva.id,
        conta_destino_numero: contaDestino,
        valor,
        descricao,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      feedback.textContent = data.erro || 'Falha ao realizar transferência';
      feedback.className = 'text-xs text-rose-400 block';
      return;
    }

    fecharModalPix();
    showToast(`Transferência de ${formatarMoeda(valor)} realizada!`, 'sucesso');

    // Recarregar dados
    await selecionarContaCliente(state.contaClienteAtiva.id);
    await carregarDadosBanco();
    await carregarTodasContas();
  } catch (err) {
    feedback.textContent = 'Erro ao processar transferência';
    feedback.className = 'text-xs text-rose-400 block';
  }
}

// Modal Pagamento
function abrirModalPagamento() {
  if (!state.contaClienteAtiva) {
    showToast('Selecione uma conta primeiro', 'erro');
    return;
  }
  document.getElementById('pagFeedback').classList.add('hidden');
  document.getElementById('modalPagamento').classList.remove('hidden');
}

function fecharModalPagamento() {
  document.getElementById('modalPagamento').classList.add('hidden');
}

async function executarPagamento(e) {
  e.preventDefault();
  const valor = document.getElementById('pagValor').value;
  const descricao = document.getElementById('pagDescricao').value;
  const codigoBarras = document.getElementById('pagCodigoBarras').value;
  const feedback = document.getElementById('pagFeedback');

  feedback.classList.add('hidden');

  try {
    const res = await fetch('/api/cliente/pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conta_origem_id: state.contaClienteAtiva.id,
        valor,
        descricao,
        codigo_barras: codigoBarras,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      feedback.textContent = data.erro || 'Falha no pagamento';
      feedback.className = 'text-xs text-rose-400 block';
      return;
    }

    fecharModalPagamento();
    showToast(`Pagamento de ${formatarMoeda(valor)} liquidado!`, 'sucesso');

    await selecionarContaCliente(state.contaClienteAtiva.id);
    await carregarDadosBanco();
    await carregarTodasContas();
  } catch (err) {
    feedback.textContent = 'Erro ao processar pagamento';
    feedback.className = 'text-xs text-rose-400 block';
  }
}

// Modal Operação Administrativa do Banco
function abrirModalOperacaoBanco() {
  document.getElementById('opBancoFeedback').classList.add('hidden');
  document.getElementById('modalOperacaoBanco').classList.remove('hidden');
}

function fecharModalOperacaoBanco() {
  document.getElementById('modalOperacaoBanco').classList.add('hidden');
}

function abrirModalDepositoCliente() {
  abrirModalOperacaoBanco();
  if (state.contaClienteAtiva) {
    document.getElementById('opBancoConta').value = state.contaClienteAtiva.id;
  }
  document.getElementById('opBancoTipo').value = 'deposito';
  document.getElementById('opBancoDescricao').value = 'Depósito em dinheiro no caixa';
}

async function executarOperacaoBanco(e) {
  e.preventDefault();
  const conta_id = document.getElementById('opBancoConta').value;
  const tipo = document.getElementById('opBancoTipo').value;
  const valor = document.getElementById('opBancoValor').value;
  const descricao = document.getElementById('opBancoDescricao').value;
  const feedback = document.getElementById('opBancoFeedback');

  feedback.classList.add('hidden');

  try {
    const res = await fetch('/api/banco/operacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conta_id, tipo, valor, descricao }),
    });

    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      feedback.textContent = data.erro || 'Falha na operação';
      feedback.className = 'text-xs text-rose-400 block';
      return;
    }

    fecharModalOperacaoBanco();
    showToast(data.mensagem || 'Operação realizada com sucesso!', 'sucesso');

    await carregarDadosBanco();
    await carregarTodasContas();
    if (state.contaClienteAtiva && state.contaClienteAtiva.id == conta_id) {
      await selecionarContaCliente(conta_id);
    }
  } catch (err) {
    feedback.textContent = 'Erro ao processar operação';
    feedback.className = 'text-xs text-rose-400 block';
  }
}

// =============================================================================
// Command Palette & Chat IA Bancário (Phase 2 - M3)
// =============================================================================

function inicializarCommandPalette() {
  // Listener Global de Teclado no Window
  window.addEventListener('keydown', (e) => {
    // Tecla Escape fecha a palette
    if (e.key === 'Escape') {
      if (state.commandPaletteAberta) {
        fecharCommandPalette();
      }
      return;
    }

    // Tecla '/' abre a palette (se não estiver em campos editáveis)
    if (e.key === '/') {
      if (state.commandPaletteAberta) return;

      const activeEl = document.activeElement;
      const tagName = activeEl ? activeEl.tagName.toLowerCase() : '';
      const isEditable = activeEl && (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        activeEl.isContentEditable
      );

      if (!isEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        abrirCommandPalette();
        const input = document.getElementById('commandPaletteInput');
        if (input) {
          input.value = '/';
          renderizarSugestoesComandos('/');
        }
      }
    }
  });

  // Fechar ao clicar no backdrop escuro
  const modalCmd = document.getElementById('modalCommandPalette');
  if (modalCmd) {
    modalCmd.addEventListener('click', (e) => {
      if (e.target === modalCmd) {
        fecharCommandPalette();
      }
    });
  }

  // Eventos de Input e Navegação de Teclado na Palette
  const inputCmd = document.getElementById('commandPaletteInput');
  if (inputCmd) {
    inputCmd.addEventListener('input', (e) => {
      const val = e.target.value;
      const clearBtn = document.getElementById('btnClearCommandInput');
      if (clearBtn) {
        if (val) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      renderizarSugestoesComandos(val);
    });

    inputCmd.addEventListener('keydown', (e) => {
      const dropdown = document.getElementById('commandSuggestionsDropdown');
      const isDropdownVisible = dropdown && !dropdown.classList.contains('hidden');

      if (e.key === 'ArrowDown') {
        if (isDropdownVisible && state.filteredComandos.length > 0) {
          e.preventDefault();
          state.selectedSuggestionIndex = (state.selectedSuggestionIndex + 1) % state.filteredComandos.length;
          atualizarDestaqueSugestao();
        }
      } else if (e.key === 'ArrowUp') {
        if (isDropdownVisible && state.filteredComandos.length > 0) {
          e.preventDefault();
          state.selectedSuggestionIndex = (state.selectedSuggestionIndex - 1 + state.filteredComandos.length) % state.filteredComandos.length;
          atualizarDestaqueSugestao();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isDropdownVisible && state.selectedSuggestionIndex >= 0 && state.filteredComandos[state.selectedSuggestionIndex]) {
          const cmd = state.filteredComandos[state.selectedSuggestionIndex].comando;
          executarComandoRapido(cmd);
        } else {
          const texto = inputCmd.value.trim();
          if (texto) {
            enviarMensagemAssistente(texto);
          }
        }
      }
    });
  }
}

function abrirCommandPalette() {
  state.commandPaletteAberta = true;
  const modal = document.getElementById('modalCommandPalette');
  const input = document.getElementById('commandPaletteInput');
  const contaAtivaBadge = document.getElementById('commandPaletteContaAtiva');

  if (contaAtivaBadge) {
    if (state.contaClienteAtiva) {
      const titular = state.contaClienteAtiva.titular || (state.usuario ? state.usuario.nome : '');
      contaAtivaBadge.textContent = `Conta: ${state.contaClienteAtiva.numero}-${state.contaClienteAtiva.digito} (${titular || 'Ativa'})`;
    } else {
      contaAtivaBadge.textContent = 'Conta: 00010001-5 (Ana Paula)';
    }
  }

  if (modal) modal.classList.remove('hidden');
  if (input) {
    input.focus();
    renderizarSugestoesComandos(input.value);
  }
}

function fecharCommandPalette() {
  state.commandPaletteAberta = false;
  const modal = document.getElementById('modalCommandPalette');
  if (modal) modal.classList.add('hidden');
  const dropdown = document.getElementById('commandSuggestionsDropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function limparInputComando() {
  const input = document.getElementById('commandPaletteInput');
  const clearBtn = document.getElementById('btnClearCommandInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (clearBtn) clearBtn.classList.add('hidden');
  renderizarSugestoesComandos('');
}

function renderizarSugestoesComandos(texto) {
  const dropdown = document.getElementById('commandSuggestionsDropdown');
  const list = document.getElementById('commandSuggestionsList');
  if (!dropdown || !list) return;

  const t = (texto || '').trim().toLowerCase();

  if (!t || t === '/') {
    state.filteredComandos = [...state.comandosDisponiveis];
  } else if (t.startsWith('/')) {
    state.filteredComandos = state.comandosDisponiveis.filter(cmd =>
      cmd.comando.toLowerCase().startsWith(t) ||
      cmd.titulo.toLowerCase().includes(t.replace('/', '')) ||
      cmd.descricao.toLowerCase().includes(t.replace('/', ''))
    );
  } else {
    // Se o usuário digitou sem '/', ainda pode sugerir comandos correspondentes
    state.filteredComandos = state.comandosDisponiveis.filter(cmd =>
      cmd.comando.toLowerCase().includes(t) ||
      cmd.titulo.toLowerCase().includes(t) ||
      cmd.descricao.toLowerCase().includes(t)
    );
  }

  if (state.filteredComandos.length === 0) {
    dropdown.classList.add('hidden');
    state.selectedSuggestionIndex = -1;
    return;
  }

  dropdown.classList.remove('hidden');
  state.selectedSuggestionIndex = 0;

  list.innerHTML = state.filteredComandos.map((cmd, idx) => `
    <div
      class="command-suggestion-item flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${idx === 0 ? 'active bg-indigo-600/25 border-l-2 border-indigo-500' : 'hover:bg-slate-800/60'}"
      data-index="${idx}"
      data-command="${cmd.comando}"
      onmouseenter="selecionarSugestaoHover(${idx})"
      onclick="executarComandoRapido('${cmd.comando}')"
    >
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-xs">
          <i class="fa-solid ${cmd.icone}"></i>
        </span>
        <span class="font-mono text-xs font-bold text-indigo-300">${cmd.comando}</span>
        <span class="text-xs text-slate-300 hidden sm:inline">${cmd.descricao}</span>
      </div>
      <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800 rounded">Enter</kbd>
    </div>
  `).join('');
}

function selecionarSugestaoHover(idx) {
  state.selectedSuggestionIndex = idx;
  atualizarDestaqueSugestao();
}

function atualizarDestaqueSugestao() {
  const items = document.querySelectorAll('.command-suggestion-item');
  items.forEach((item, idx) => {
    if (idx === state.selectedSuggestionIndex) {
      item.classList.add('active', 'bg-indigo-600/25', 'border-l-2', 'border-indigo-500');
      item.classList.remove('hover:bg-slate-800/60');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('active', 'bg-indigo-600/25', 'border-l-2', 'border-indigo-500');
      item.classList.add('hover:bg-slate-800/60');
    }
  });
}

function executarComandoRapido(cmd) {
  const input = document.getElementById('commandPaletteInput');
  if (input) input.value = cmd;
  enviarMensagemAssistente(cmd);
}

function executarPerguntaRapida(pergunta) {
  const input = document.getElementById('commandPaletteInput');
  if (input) input.value = pergunta;
  enviarMensagemAssistente(pergunta);
}

async function enviarMensagemAssistente(mensagem) {
  if (!mensagem || !mensagem.trim()) return;

  const inputCmd = document.getElementById('commandPaletteInput');
  const dropdown = document.getElementById('commandSuggestionsDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  if (inputCmd) inputCmd.value = '';

  const clearBtn = document.getElementById('btnClearCommandInput');
  if (clearBtn) clearBtn.classList.add('hidden');

  // Adiciona pergunta do usuário no feed
  adicionarMensagemFeed('usuario', mensagem);

  // Indicador de carregamento
  const tempMsgId = 'msg-loading-' + Date.now();
  adicionarIndicadorCarregandoFeed(tempMsgId);

  const inicio = performance.now();
  const conta_id = state.contaClienteAtiva ? state.contaClienteAtiva.id : 1;
  const cliente_id = state.usuario && state.usuario.cliente_id ? state.usuario.cliente_id : 1;

  try {
    const res = await fetch('/api/assistente/consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, conta_id, cliente_id }),
    });

    const tempoRtt = Math.round(performance.now() - inicio);
    removerElementoFeed(tempMsgId);

    const data = await res.json();
    const tempoMs = data.tempo_ms !== undefined ? data.tempo_ms : tempoRtt;
    const tempoBadge = document.getElementById('commandLatencyBadge');
    if (tempoBadge) {
      tempoBadge.textContent = `⚡ ${Number(tempoMs).toFixed(1)}ms`;
      tempoBadge.classList.remove('hidden');
    }

    if (!data.sucesso && !data.tipo_resposta) {
      adicionarMensagemFeed('assistente', data.mensagem || 'Não foi possível processar a consulta no momento.', null, tempoMs);
      return;
    }

    adicionarMensagemFeed('assistente', data.texto, data, tempoMs);
  } catch (err) {
    removerElementoFeed(tempMsgId);
    adicionarMensagemFeed('assistente', 'Erro ao conectar ao assistente bancário. Verifique sua conexão com o servidor.');
  }
}

function adicionarMensagemFeed(remetente, texto, dataExtra = null, tempoMs = null) {
  const feed = document.getElementById('commandChatFeed');
  if (!feed) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'fade-in flex items-start gap-3';

  if (remetente === 'usuario') {
    msgDiv.innerHTML = `
      <div class="flex-1 flex justify-end">
        <div class="chat-bubble-user px-4 py-2.5 max-w-[85%] sm:max-w-[75%] text-xs shadow-md">
          <p class="font-medium whitespace-pre-wrap">${escapeHtml(texto)}</p>
        </div>
      </div>
      <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 text-xs shadow">
        <i class="fa-solid fa-user text-[11px]"></i>
      </div>
    `;
  } else {
    const cardHtml = dataExtra ? renderizarCardAssistente(dataExtra) : '';
    const badgeLatency = tempoMs !== null
      ? `<span class="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">⚡ ${Number(tempoMs).toFixed(1)}ms</span>`
      : '';

    msgDiv.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 text-xs">
        <i class="fa-solid fa-robot text-xs"></i>
      </div>
      <div class="chat-bubble-bot flex-1 bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-none p-3.5 space-y-2 text-slate-200">
        <div class="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-700/40 pb-1.5">
          <span class="font-semibold text-slate-300 flex items-center gap-1.5">
            <i class="fa-solid fa-building-columns text-[10px] text-indigo-400"></i> Assistente Bancário
          </span>
          ${badgeLatency}
        </div>
        <p class="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(texto)}</p>
        ${cardHtml}
      </div>
    `;
  }

  feed.appendChild(msgDiv);
  feed.scrollTop = feed.scrollHeight;
}

function adicionarIndicadorCarregandoFeed(id) {
  const feed = document.getElementById('commandChatFeed');
  if (!feed) return;

  const loadDiv = document.createElement('div');
  loadDiv.id = id;
  loadDiv.className = 'flex items-start gap-3 fade-in';
  loadDiv.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 text-xs">
      <i class="fa-solid fa-robot text-xs animate-pulse"></i>
    </div>
    <div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-slate-400 text-xs">
      <span class="pulse-indicator bg-indigo-400"></span>
      <span class="pulse-indicator bg-indigo-400" style="animation-delay: 0.2s"></span>
      <span class="pulse-indicator bg-indigo-400" style="animation-delay: 0.4s"></span>
      <span class="ml-1 text-[11px] text-slate-400 font-mono">Consultando PostgreSQL em tempo real...</span>
    </div>
  `;
  feed.appendChild(loadDiv);
  feed.scrollTop = feed.scrollHeight;
}

function removerElementoFeed(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderizarCardAssistente(data) {
  if (!data || !data.tipo_resposta) return '';

  const tipo = data.tipo_resposta;
  const d = data.dados;

  if (tipo === 'saldo' && d) {
    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-3 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
              <i class="fa-solid fa-wallet"></i>
            </span>
            <span class="font-bold text-white text-xs">Conta ${d.conta}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-indigo-500/20 text-indigo-300">${d.tipo}</span>
          </div>
          <span class="text-[11px] text-slate-400">${d.titular || ''}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span class="text-[10px] text-slate-400 block font-medium">Saldo em Conta</span>
            <span class="text-sm font-bold text-emerald-400 font-mono">${formatarMoeda(d.saldo)}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span class="text-[10px] text-slate-400 block font-medium">Cheque Especial</span>
            <span class="text-sm font-bold text-amber-400 font-mono">${formatarMoeda(d.limite)}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
            <span class="text-[10px] text-indigo-300 block font-medium">Total Disponível</span>
            <span class="text-sm font-bold text-indigo-200 font-mono">${formatarMoeda(d.saldo_disponivel)}</span>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-1">
          <button onclick="executarComandoRapido('/extrato')" class="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            <i class="fa-solid fa-receipt mr-1 text-slate-400"></i> Ver Extrato
          </button>
          <button onclick="executarComandoRapido('/pix')" class="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm">
            <i class="fa-solid fa-bolt mr-1"></i> Fazer PIX
          </button>
        </div>
      </div>
    `;
  }

  if (tipo === 'extrato' && Array.isArray(d)) {
    if (d.length === 0) {
      return `
        <div class="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
          Nenhum lançamento recente encontrado nesta conta.
        </div>
      `;
    }
    const itens = d.map(item => {
      const isEntrada = item.direcao === 'entrada';
      const badgeClass = isEntrada
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      const sinal = isEntrada ? '+' : '-';

      return `
        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
          <div class="flex items-center gap-2.5">
            <span class="w-6 h-6 rounded-md ${badgeClass} flex items-center justify-center text-[10px] font-bold">
              ${sinal}
            </span>
            <div>
              <p class="font-semibold text-slate-200 text-xs leading-tight">${escapeHtml(item.descricao || 'Operação')}</p>
              <p class="text-[10px] text-slate-400">${item.data_formatada || ''} • <span class="text-slate-500">${escapeHtml(item.contraparte || '')}</span></p>
            </div>
          </div>
          <div class="text-right">
            <span class="font-mono text-xs font-bold ${isEntrada ? 'text-emerald-400' : 'text-slate-200'}">
              ${item.valor_formatado || formatarMoeda(item.valor)}
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between pb-1 text-xs text-slate-400 font-medium">
          <span>Últimos Lançamentos</span>
          <span class="text-[10px] font-mono">${d.length} operações</span>
        </div>
        <div class="space-y-1.5">
          ${itens}
        </div>
      </div>
    `;
  }

  if (tipo === 'pix' && Array.isArray(d)) {
    const contatos = d.map(c => {
      const safeTitular = (c.titular || '').replace(/'/g, "\\'");
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 transition">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
              ${(c.titular || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="font-semibold text-slate-200 text-xs">${escapeHtml(c.titular)}</p>
              <p class="text-[10px] font-mono text-slate-400">Conta ${c.conta} • Ag ${c.agencia}</p>
            </div>
          </div>
          <button
            onclick="iniciarPixParaContato('${c.numero}', '${safeTitular}')"
            class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition shadow flex items-center gap-1"
          >
            <i class="fa-solid fa-paper-plane text-[10px]"></i>
            <span>Transferir</span>
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2.5 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span class="flex items-center gap-1.5">
            <i class="fa-brands fa-pix text-indigo-400"></i> Sugestões para Envio Imediato
          </span>
          <span class="text-[10px] font-mono">${d.length} contatos</span>
        </div>
        <div class="space-y-1.5">
          ${contatos}
        </div>
      </div>
    `;
  }

  if (tipo === 'contas' && Array.isArray(d)) {
    const contas = d.map(c => `
      <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-bold text-white">Conta ${c.conta}</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] uppercase font-mono bg-slate-800 text-slate-300">${c.tipo}</span>
          </div>
          <span class="font-mono text-xs font-bold text-emerald-400">${c.saldo_formatado}</span>
        </div>
        <div class="flex items-center justify-between mt-1 text-[10px] text-slate-400">
          <span>${escapeHtml(c.titular)}</span>
          <button onclick="selecionarContaDoChat(${c.id})" class="text-indigo-400 hover:underline">Selecionar</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium pb-1">
          <span>Visão Geral de Contas</span>
          <span class="text-[10px] font-mono">${d.length} contas</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${contas}
        </div>
      </div>
    `;
  }

  if (tipo === 'agencias' && Array.isArray(d)) {
    const ags = d.map(a => `
      <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white text-xs">Ag. ${a.codigo} — ${escapeHtml(a.nome)}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${a.total_contas} contas</span>
        </div>
        <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>${escapeHtml(a.cidade)}/${escapeHtml(a.estado)} • ${escapeHtml(a.telefone)}</span>
          <span class="font-mono text-slate-300 font-medium">${a.saldo_total_formatado}</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium pb-1">
          <span>Rede de Agências Bancárias</span>
          <span class="text-[10px] font-mono">${d.length} agências ativas</span>
        </div>
        <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          ${ags}
        </div>
      </div>
    `;
  }

  if (tipo === 'saldo_cliente' && d) {
    const contasCliente = Array.isArray(d.contas) ? d.contas.map(ct => `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px]">
        <div>
          <span class="font-mono font-bold text-white">${ct.conta}</span>
          <span class="ml-1.5 text-slate-400 capitalize">(${ct.tipo})</span>
        </div>
        <div class="text-right font-mono">
          <span class="text-emerald-400 font-bold">${ct.saldo_formatado}</span>
          <span class="text-[10px] text-slate-500 block">Disp: ${ct.saldo_disponivel_formatado}</span>
        </div>
      </div>
    `).join('') : '';

    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2.5 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <h4 class="font-bold text-white text-xs">${escapeHtml(d.cliente)}</h4>
            <span class="text-[10px] font-mono text-slate-400">CPF: ${d.cpf || 'Não informado'}</span>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block font-medium">Total Disponível</span>
            <span class="text-sm font-bold text-indigo-300 font-mono">${formatarMoeda(d.total_disponivel)}</span>
          </div>
        </div>
        <div class="space-y-1.5">
          ${contasCliente}
        </div>
      </div>
    `;
  }

  if (tipo === 'custodia_total' && d) {
    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-3 shadow-lg">
        <div class="text-center py-1">
          <span class="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Custódia Total sob Gestão</span>
          <span class="text-2xl font-black text-emerald-400 font-mono">${formatarMoeda(d.custodia_total)}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
          <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span class="text-[10px] text-slate-400 block">Contas Ativas</span>
            <span class="text-xs font-bold text-white font-mono">${d.total_contas}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span class="text-[10px] text-slate-400 block">Clientes</span>
            <span class="text-xs font-bold text-white font-mono">${d.total_clientes}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span class="text-[10px] text-slate-400 block">Agências</span>
            <span class="text-xs font-bold text-white font-mono">${d.agencias_ativas}</span>
          </div>
        </div>
      </div>
    `;
  }

  if (tipo === 'ultima_transferencia' && d) {
    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2.5 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <span class="text-xs font-bold text-white flex items-center gap-1.5">
            <i class="fa-solid fa-arrow-right-arrow-left text-indigo-400"></i> Última Transferência
          </span>
          <span class="font-mono text-xs font-bold text-indigo-300">${formatarMoeda(d.valor)}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span class="text-[10px] text-slate-400 block">Remetente</span>
            <span class="font-semibold text-slate-200 block truncate">${escapeHtml(d.remetente || '-')}</span>
            <span class="text-[10px] font-mono text-slate-500">Conta ${d.origem}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <span class="text-[10px] text-slate-400 block">Destinatário</span>
            <span class="font-semibold text-slate-200 block truncate">${escapeHtml(d.destinatario || '-')}</span>
            <span class="text-[10px] font-mono text-slate-500">Conta ${d.destino}</span>
          </div>
        </div>
        <div class="text-[10px] text-slate-400 text-right">
          Realizada em: ${d.data_formatada || '-'}
        </div>
      </div>
    `;
  if (tipo === 'emprestimo' && d) {
    return `
      <div class="mt-2.5 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-3 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
              <i class="fa-solid fa-hand-holding-dollar"></i>
            </span>
            <span class="font-bold text-white text-xs">Empréstimo Pessoal Pré-Aprovado</span>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Taxa 1,89% a.m.</span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span class="text-[10px] text-slate-400 block font-medium">Valor Solicitado</span>
            <span class="text-xs sm:text-sm font-bold text-white font-mono">${d.valor_solicitado_formatado}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span class="text-[10px] text-slate-400 block font-medium">Prazo &amp; Taxa</span>
            <span class="text-xs sm:text-sm font-bold text-indigo-300 font-mono">${d.meses}x de 1,89%</span>
          </div>
          <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
            <span class="text-[10px] text-emerald-300 block font-medium">Parcela Mensal</span>
            <span class="text-xs sm:text-sm font-bold text-emerald-400 font-mono">${d.valor_parcela_formatado}</span>
          </div>
        </div>

        <div class="p-2 rounded-lg bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
          <span>Total a pagar: <strong class="text-slate-200 font-mono">${d.total_a_pagar_formatado}</strong> (CET ${d.cet_anual_percentual})</span>
          <span>Conta: <strong class="text-slate-200 font-mono">${d.conta}</strong></span>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button onclick="abrirSimuladorNaAreaCliente(${d.valor_solicitado}, ${d.meses})" class="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-sliders text-indigo-400"></i> Ajustar no Simulador
          </button>
          <button onclick="contratarEmprestimoDireto(${d.conta_id}, ${d.valor_solicitado}, ${d.meses})" class="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-check"></i> Contratar Agora (1 Clique)
          </button>
        </div>
      </div>
    `;
  }

  return '';
}

function iniciarPixParaContato(contaNumero, titular) {
  fecharCommandPalette();
  if (!state.contaClienteAtiva && state.todasContas.length > 0) {
    state.contaClienteAtiva = state.todasContas[0];
  }
  abrirModalPix();
  const select = document.getElementById('pixContaDestino');
  if (select && contaNumero) {
    select.value = contaNumero;
  }
  showToast(`Destinatário selecionado: ${titular}`, 'sucesso');
}

async function selecionarContaDoChat(contaId) {
  fecharCommandPalette();
  trocarAba('cliente');
  await selecionarContaCliente(contaId);
  showToast('Conta selecionada com sucesso!', 'sucesso');
}

// ─── 💳 Funções Reativas do Simulador de Empréstimos (R1) ────────────────────

let stateEmprestimo = {
  valor: 5000,
  meses: 12,
  calculo: null,
};

function inicializarSimuladorEmprestimo() {
  atualizarCalculoSimulador();
}

function aoAlterarRangeValor(val) {
  stateEmprestimo.valor = parseFloat(val) || 500;
  const input = document.getElementById('inputValorEmprestimo');
  if (input) input.value = val;
  atualizarCalculoSimulador();
}

function aoAlterarInputValor(val) {
  let v = parseFloat(val);
  if (isNaN(v)) v = 500;
  stateEmprestimo.valor = v;
  const range = document.getElementById('rangeValorEmprestimo');
  if (range) range.value = Math.min(Math.max(v, 500), 50000);
  atualizarCalculoSimulador();
}

function definirValorSimulador(val) {
  aoAlterarRangeValor(val);
}

function aoAlterarRangeMeses(val) {
  stateEmprestimo.meses = parseInt(val, 10) || 12;
  const input = document.getElementById('inputMesesEmprestimo');
  if (input) input.value = val;
  atualizarCalculoSimulador();
}

function aoAlterarInputMeses(val) {
  let m = parseInt(val, 10);
  if (isNaN(m)) m = 12;
  stateEmprestimo.meses = m;
  const range = document.getElementById('rangeMesesEmprestimo');
  if (range) range.value = Math.min(Math.max(m, 6), 48);
  atualizarCalculoSimulador();
}

function definirMesesSimulador(val) {
  aoAlterarRangeMeses(val);
}

function atualizarCalculoSimulador() {
  const v = Math.min(Math.max(stateEmprestimo.valor || 5000, 500), 50000);
  const n = Math.min(Math.max(stateEmprestimo.meses || 12, 6), 48);
  const taxa = 0.0189; // 1,89% a.m.

  const fator = Math.pow(1 + taxa, n);
  const pmt = v * (taxa * fator) / (fator - 1);
  const valorParcela = Math.round(pmt * 100) / 100;
  const total = Math.round(valorParcela * n * 100) / 100;
  const juros = Math.round((total - v) * 100) / 100;

  stateEmprestimo.calculo = { valor: v, meses: n, pmt: valorParcela, total, juros };

  const elPmt = document.getElementById('simuladorValorParcela');
  const elTotal = document.getElementById('simuladorTotalPagar');
  const elJuros = document.getElementById('simuladorTotalJuros');
  const elConta = document.getElementById('simuladorContaDestino');

  if (elPmt) elPmt.textContent = formatarMoeda(valorParcela);
  if (elTotal) elTotal.textContent = formatarMoeda(total);
  if (elJuros) elJuros.textContent = formatarMoeda(juros);
  if (elConta) {
    if (state.contaClienteAtiva) {
      elConta.textContent = `${state.contaClienteAtiva.numero}-${state.contaClienteAtiva.digito}`;
    } else if (state.todasContas && state.todasContas.length > 0) {
      elConta.textContent = `${state.todasContas[0].numero}-${state.todasContas[0].digito}`;
    }
  }
}

function focarSimuladorEmprestimo() {
  const el = document.getElementById('cardSimuladorEmprestimo');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-emerald-500/50');
    setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500/50'), 1500);
  }
}

function abrirSimuladorNaAreaCliente(valor, meses) {
  fecharCommandPalette();
  trocarAba('cliente');
  if (valor) definirValorSimulador(valor);
  if (meses) definirMesesSimulador(meses);
  focarSimuladorEmprestimo();
}

async function contratarEmprestimoDireto(contaId, valor, meses) {
  fecharCommandPalette();
  trocarAba('cliente');
  if (valor) definirValorSimulador(valor);
  if (meses) definirMesesSimulador(meses);
  if (contaId && (!state.contaClienteAtiva || state.contaClienteAtiva.id !== contaId)) {
    await selecionarContaCliente(contaId);
  }
  await executarContratacaoEmprestimo();
}

async function executarContratacaoEmprestimo() {
  if (!state.contaClienteAtiva) {
    if (state.todasContas && state.todasContas.length > 0) {
      await selecionarContaCliente(state.todasContas[0].id);
    } else {
      showToast('Selecione uma conta ativa para receber o empréstimo.', 'erro');
      return;
    }
  }

  const btn = document.getElementById('btnContratarEmprestimo');
  const feedback = document.getElementById('simuladorFeedback');
  if (feedback) feedback.classList.add('hidden');

  const { valor, meses } = stateEmprestimo.calculo || { valor: 5000, meses: 12 };

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Efetivando transação atômica...</span>`;
  }

  try {
    const res = await fetch('/api/cliente/emprestimo/contratar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conta_id: state.contaClienteAtiva.id,
        valor,
        meses,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.sucesso) {
      if (feedback) {
        feedback.textContent = data.erro || 'Falha ao contratar empréstimo.';
        feedback.className = 'text-xs text-rose-400 block';
      }
      showToast(data.erro || 'Erro na contratação', 'erro');
      return;
    }

    showToast(`Empréstimo de ${formatarMoeda(valor)} creditado com sucesso!`, 'sucesso');

    // Recarregar dados imediatamente (Saldo, Extrato, Dashboard)
    await selecionarContaCliente(state.contaClienteAtiva.id);
    await carregarDadosBanco();
    await carregarTodasContas();

  } catch (err) {
    if (feedback) {
      feedback.textContent = 'Erro ao processar transação no servidor.';
      feedback.className = 'text-xs text-rose-400 block';
    }
    showToast('Erro de conexão ao contratar empréstimo', 'erro');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-bolt text-amber-300"></i> <span>Contratar Crédito em 1 Clique</span>`;
    }
  }
}
