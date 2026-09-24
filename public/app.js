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
        <td class="py-2.5 px-3 text-slate-200 font-sans">${ct.cliente_nome}</td>
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
    document.getElementById('clienteAvatar').textContent = iniciais;

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

    return `
      <div class="py-3 flex items-center justify-between text-xs hover:bg-slate-900/60 px-2 rounded-xl transition">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center ${icone}">
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
