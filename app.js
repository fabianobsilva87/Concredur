// ===================== SUPABASE CONFIG CORE =====================
const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let globalEquipamentos = [];
let paginaAtualEquipamento = 0;
const itensPorPagina = 6;

// Canvas State
let canvas = document.getElementById('canvas-assinatura');
let ctx = canvas ? canvas.getContext('2d') : null;
let desenhando = false;

const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

function msgForm(id, texto, cor) { const el = $(id); if (el) { el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db'; el.innerText = texto; } }

// ===================== SESSÃO E ABA LOGOUT =====================
async function verificarSessaoGlobal() {
  const { data: { session } } = await db.auth.getSession();
  const pag = window.location.pathname.split("/").pop();

  if (!session) {
    if (pag !== "" && pag !== "index.html") { window.location.href = "index.html"; }
  } else {
    if (pag === "" || pag === "index.html") { window.location.href = "dashboard.html"; }
    if ($('user-display-email')) $('user-display-email').innerText = session.user.email;
  }
}
verificarSessaoGlobal();

if ($('btn-logout')) {
  $('btn-logout').addEventListener('click', async () => {
    if (confirm("Encerrar sessão?")) { await db.auth.signOut(); window.location.href = "index.html"; }
  });
}

let modoRecuperacao = false;
function toggleModoRecuperacao(ativar) {
  modoRecuperacao = ativar;
  if (ativar) {
    $('login-title').innerText = "Recuperação Cadastral";
    $('login-desc').innerText = "Insira seu e-mail institucional";
    $('login-password-group').style.display = "none";
  } else {
    $('login-title').innerText = "Acesso ao Sistema";
    $('login-password-group').style.display = "flex";
  }
}

// ===================== CANVAS ASSINATURA TOUCH SCREEN =====================
function inicializarCanvasAssinatura() {
  if (!canvas) return;
  const obterPosicao = (e) => {
    let rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  canvas.addEventListener('mousedown', (e) => { desenhando = true; ctx.beginPath(); let pos = obterPosicao(e); ctx.moveTo(pos.x, pos.y); });
  canvas.addEventListener('mousemove', (e) => { if (!desenhando) return; e.preventDefault(); let pos = obterPosicao(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  window.addEventListener('mouseup', () => desenhando = false);
  canvas.addEventListener('touchstart', (e) => { desenhando = true; ctx.beginPath(); let pos = obterPosicao(e); ctx.moveTo(pos.x, pos.y); });
  canvas.addEventListener('touchmove', (e) => { if (!desenhando) return; e.preventDefault(); let pos = obterPosicao(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  window.addEventListener('touchend', () => desenhando = false);
  ctx.lineWidth = 2; ctx.strokeStyle = "#000";
}
function limparCanvasAssinatura() { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }

// CPF Mask Listener
if ($('colab-cpf')) {
  $('colab-cpf').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    e.target.value = v;
  });
}

// ===================== ENGINE: EQUIPAMENTOS & QR CODE =====================
function calcularCriticidadeFluxograma() {
  const i = $('crit-interrupcao').value; const s = $('crit-seguranca').value;
  const o = $('crit-operacao').value; const r = $('crit-reserva').value;
  let res = (i === 'sim' || s === 'sim') ? (r === 'nao' ? 'Alta (A)' : 'Média (B)') : (o === 'sim' ? (r === 'nao' ? 'Média (B)' : 'Baixa (C)') : 'Baixa (C)');
  $('label-criticidade-calculada').innerText = 'Classe ' + res; return res.split(' ')[0];
}

if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag').value.trim(); if (!tag) { msgForm('msg-equipamento', 'TAG requerida.', 'red'); return; }
    await db.from('equipamentos').insert([{ tag, marca: $('eq-marca').value, produto: $('eq-produto').value, bloco: $('eq-bloco').value, setor: $('eq-setor').value, criticidade: calcularCriticidadeFluxograma() }]);
    msgForm('msg-equipamento', 'Salvo!', 'green'); location.reload();
  });
}

async function carregarEquipamentos() {
  const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
  globalEquipamentos = data || []; filtrarEquipamentos(0); atualizarSelectEquipamentos();
}

function filtrarEquipamentos(aba) {
  paginaAtualEquipamento += aba;
  const tbox = $('search-eq-termo'); const termo = tbox ? tbox.value.toLowerCase() : '';
  let items = globalEquipamentos.filter(e => e.tag.toLowerCase().includes(termo));
  const total = Math.ceil(items.length / itensPorPagina) || 1;
  if ($('txt-eq-paginacao')) $('txt-eq-paginacao').innerText = `Página ${paginaAtualEquipamento + 1} de ${total}`;
  const renderList = items.slice(paginaAtualEquipamento * itensPorPagina, (paginaAtualEquipamento * itensPorPagina) + itensPorPagina);
  const tbody = $('tbody-equipamentos-gerir'); if (!tbody) return;
  tbody.innerHTML = renderList.map(eq => `<tr><td><span class="tag-badge">${eq.tag}</span></td><td><strong>${eq.produto || '—'}</strong><br><small>${eq.marca || ''}</small></td><td>${eq.bloco || '—'} / ${eq.setor || '—'}</td><td><span class="tag-badge">Classe ${eq.criticidade}</span></td><td><button class="btn-primary" style="padding:3px 8px; font-size:11px;" onclick="exibirJanelaQRCode('${eq.qrcode_token}','${eq.tag}')">👁️ Ver QR</button></td><td><button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕</button></td></tr>`).join('');
}
function mudarPaginaEquipamento(d) { filtrarEquipamentos(d); }

function exibirJanelaQRCode(token, tag) {
  const alvo = $('qrcode-temp-generator'); alvo.innerHTML = '';
  new QRCode(alvo, { text: window.location.origin + "/pmoc.html?token=" + token, width: 128, height: 128 });
  setTimeout(() => {
    const src = alvo.querySelector('img').src;
    const win = window.open("", "_blank", "width=300,height=300");
    win.document.write(`<div style="text-align:center; font-family:sans-serif;"><h3>Ativo: ${tag}</h3><img src="${src}"/><br><button onclick="window.print()">Imprimir</button></div>`);
  }, 200);
}
async function excluirEquipamento(id) { if (confirm("Remover?")) { await db.from('equipamentos').delete().eq('id', id); carregarEquipamentos(); } }

async function atualizarSelectEquipamentos() {
  const sels = ['pmoc-equipamento', 'os-equipamento'].map($).filter(Boolean);
  const { data } = await db.from('equipamentos').select('id, tag, produto');
  sels.forEach(s => {
    s.innerHTML = '<option value="">-- Selecione o Ativo --</option>';
    (data || []).forEach(e => { s.innerHTML += `<option value="${e.id}">${e.tag} — ${e.produto || ''}</option>`; });
  });
}

async function carregarAtivoViaTokenQRCode(token) {
  const { data } = await db.from('equipamentos').select('id').eq('qrcode_token', token).single();
  if (data && $('pmoc-equipamento')) $('pmoc-equipamento').value = data.id;
}

// ===================== ENGINE: HISTÓRICO PMOC & PDF =====================
if ($('btn-salvar-ficha')) {
  $('btn-salvar-ficha').addEventListener('click', async () => {
    const eq = $('pmoc-equipamento').value; const tec = $('pmoc-tecnico').value;
    if (!eq || !tec) { msgForm('msg-ficha', 'Preencha os campos obrigatórios', 'red'); return; }
    const ass = canvas.toDataURL();
    const { data: colab } = await db.from('colaboradores').select('nome').eq('id', tec).single();
    await db.from('fichas_pmoc').insert([{ equipamento_id: eq, tecnico_nome: colab?.nome || 'Técnico', observacoes: $('pmoc-obs').value, assinatura_digital: ass }]);
    msgForm('msg-ficha', 'Laudo Salvo!', 'green'); location.reload();
  });
}

async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  const { data } = await db.from('fichas_pmoc').select('*, equipamentos(tag, produto, bloco, setor)').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(f => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(f))));
    return `<tr><td>L-PMOC</td><td>${new Date(f.created_at).toLocaleDateString('pt-BR')}</td><td><span class="tag-badge">${f.equipamentos?.tag}</span></td><td>${f.tecnico_nome}</td><td>Mensal</td><td><button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="emitirRelatorioPMOC('${b64}')">🖨️ PDF</button></td></tr>`;
  }).join('');
}

function emitirRelatorioPMOC(b64) {
  const f = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const html = `<div class="laudo-wrapper" id="pdf-container-target"><div class="laudo-header"><h2>CONCREDUR — PMOC</h2></div><p><strong>Ativo:</strong> ${f.equipamentos?.tag}</p><p><strong>Técnico:</strong> ${f.tecnico_nome}</p><div class="laudo-obs">${f.observacoes}</div><div style="text-align:center;"><img src="${f.assinatura_digital}"/></div><br><button class="btn-primary no-print" onclick="exportarParaPDFCorporativo()">Baixar PDF</button></div>`;
  $('area-laudo-impressao').innerHTML = html; window.print();
}
function exportarParaPDFCorporativo() { html2pdf().set({ margin: 10, filename: `Laudo_PMOC.pdf`, html2canvas: { scale: 2 }, jsPDF: { format: 'a4' } }).from($('pdf-target')).save(); }

// ===================== ENGINE: OS (AC & FACILITIES) =====================
if ($('btn-salvar-os')) {
  $('btn-salvar-os').addEventListener('click', async () => {
    await db.from('ordens_servico').insert([{ equipamento_id: $('os-equipamento').value, colaborador_id: $('os-tecnico').value, tipo_os: $('os-tipo').value, status_os: $('os-status').value, descricao_defeito: $('os-defeito').value }]);
    location.reload();
  });
}
if ($('btn-salvar-osg')) {
  $('btn-salvar-osg').addEventListener('click', async () => {
    await db.from('ordens_servico_geral').insert([{ setor: $('osg-setor').value, servico_requisitado: $('osg-requisitado').value, falha_relatada: $('osg-falha').value, tipo_manutencao: document.querySelector('input[name="osg-tipo"]:checked')?.value || 'Preventiva', status_os: $('osg-status').value, numero_os: 'OSG-' + Date.now().toString().slice(-6) }]);
    location.reload();
  });
}
async function carregarOrdensServico() {
  const tbody = $('tbody-os'); if (!tbody) return;
  const { data } = await db.from('ordens_servico').select('*, equipamentos(tag), colaboradores(nome)').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(os => `<tr><td>OS-AC</td><td>${fmtDate(os.created_at)}</td><td><span class="tag-badge">${os.equipamentos?.tag}</span></td><td>${os.colaboradores?.nome || '—'}</td><td>${os.tipo_os}</td><td>${statusBadge(os.status_os)}</td><td>—</td></tr>`).join('');
}
async function carregarOSGeral() {
  const tbody = $('tbody-osg'); if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*');
  tbody.innerHTML = (data || []).map(o => `<tr><td><strong>${o.numero_os}</strong></td><td>${fmtDate(o.created_at)}</td><td>${o.setor}</td><td>Facilities</td><td>${statusBadge(o.status_os)}</td></tr>`).join('');
}
async function carregarCentralUnificadaOS() {
  const tbody = $('tbody-central-unificada-os'); if (!tbody) return;
  const [{ data: ac }, { data: f }] = await Promise.all([db.from('ordens_servico').select('id, created_at, tipo_os, status_os, descricao_defeito'), db.from('ordens_servico_geral').select('id, created_at, tipo_manutencao, status_os, servico_requisitado, numero_os')]);
  const arr = [...(ac || []).map(d => ({ id: 'OS-AC', data: d.created_at, mod: 'Refrigeração', cat: d.tipo_os, res: d.descricao_defeito, st: d.status_os })), ...(f || []).map(d => ({ id: d.numero_os, data: d.created_at, mod: 'Facilities', cat: d.tipo_manutencao, res: d.servico_requisitado, st: d.status_os }))];
  tbody.innerHTML = arr.map(l => `<tr><td><strong>${l.id}</strong></td><td>${fmtDate(l.data)}</td><td>${l.mod}</td><td>${l.cat}</td><td>${l.res.slice(0,25)}...</td><td>${statusBadge(l.st)}</td></tr>`).join('');
}

// ===================== ENGINE: DASHBOARD METRICS =====================
async function carregarAgendaManutencoes() {
  const tbody = $('tbody-agenda-pmoc'); if (!tbody) return;
  const { data } = await db.from('cronograma_pmoc').select('*, equipamentos(tag, bloco, setor)').order('data_prevista', { ascending: true }).limit(5);
  tbody.innerHTML = (data || []).map(c => `<tr><td><span class="tag-badge">${c.equipamentos?.tag}</span></td><td>${c.equipamentos?.bloco} / ${c.equipamentos?.setor}</td><td>${fmtDate(c.data_prevista)}</td><td><span class="tag-badge warning">${c.status}</span></td></tr>`).join('');
}
async function renderizarGraficosDashboard() {
  const [{ count: catv }, { count: cfch }, { count: cab }, { count: cfc }, { data: logs }] = await Promise.all([db.from('equipamentos').select('*', { count: 'exact', head: true }), db.from('fichas_pmoc').select('*', { count: 'exact', head: true }), db.from('ordens_servico').select('*', { count: 'exact', head: true }).neq('status_os', 'Concluída'), db.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status_os', 'Concluída'), db.from('logs_auditoria').select('*').order('created_at', { ascending: false }).limit(4)]);
  if ($('dash-txt-ativos')) { $('dash-txt-ativos').innerText = catv; $('dash-txt-fichas').innerText = cfch; $('dash-txt-os-abertas').innerText = cab; $('dash-txt-os-fechadas').innerText = cfc; }
  if ($('dash-atividades')) $('dash-atividades').innerHTML = (logs || []).map(l => `<div style="font-size:12px; margin-bottom:4px;">🔒 <strong>${l.usuario_email || 'Sistema'}</strong>: ${l.acao} em ${l.tabela}</div>`).join('');
}

// ===================== ENGINE: ADMIN, COLABORADORES & CARGOS =====================
if ($('btn-admin-salvar-usuario')) {
  $('btn-admin-salvar-usuario').addEventListener('click', async () => {
    await db.from('profiles').insert([{ email: $('adm-user-email').value, role: $('adm-user-role').value }]); location.reload();
  });
}
if ($('btn-salvar-colaborador')) {
  $('btn-salvar-colaborador').addEventListener('click', async () => {
    await db.from('colaboradores').insert([{ nome: $('colab-nome').value, cpf: $('colab-cpf').value, funcao_id: $('colab-funcao').value }]); location.reload();
  });
}
if ($('btn-salvar-funcao')) {
  $('btn-salvar-funcao').addEventListener('click', async () => {
    await db.from('funcoes').insert([{ nome: $('func-nome').value, salario: $('func-salario').value, nivel: $('func-nivel').value }]); location.reload();
  });
}
async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema'); if (!tbody) return;
  const { data } = await db.from('profiles').select('*');
  tbody.innerHTML = (data || []).map(u => `<tr><td><strong>${u.email}</strong></td><td><span class="tag-badge">${u.role}</span></td><td><button class="btn-excluir" onclick="excluirPerfil('${u.id}')">✕</button></td></tr>`).join('');
}
async function excluirPerfil(id) { await db.from('profiles').delete().eq('id', id); carregarUsuariosSistema(); }

async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores'); if (!tbody) return;
  const { data } = await db.from('colaboradores').select('*, funcoes(nome)');
  tbody.innerHTML = (data || []).map(c => `<tr><td>${c.nome}</td><td>${c.cpf}</td><td>${c.funcoes?.nome || '—'}</td><td>${fmtDate(c.created_at)}</td><td><button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button></td></tr>`).join('');
}
async function excluirColaborador(id) { await db.from('colaboradores').delete().eq('id', id); carregarColaboradores(); }

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes'); if (!tbody) return;
  const { data } = await db.from('funcoes').select('*');
  tbody.innerHTML = (data || []).map(f => `<tr><td>${f.nome}</td><td>${f.nivel}</td><td>R$ ${f.salario}</td><td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td></tr>`).join('');
}
async function excluirFuncao(id) { await db.from('funcoes').delete().eq('id', id); carregarFuncoes(); }

async function atualizarSelectFuncoes() {
  const s = $('colab-funcao'); if (!s) return;
  const { data } = await db.from('funcoes').select('id, nome');
  s.innerHTML = '<option value="">-- Selecione --</option>';
  (data || []).forEach(f => { s.innerHTML += `<option value="${f.id}">${f.nome}</option>`; });
}
async function atualizarSelectColaboradores() {
  const sels = ['pmoc-tecnico', 'os-tecnico', 'osg-tecnico'].map($).filter(Boolean);
  const { data } = await db.from('colaboradores').select('id, nome');
  sels.forEach(s => {
    s.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => { s.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  });
}

// ===================== SUB-ABAS CONTROLLERS =====================
function alternarSubAbasPMOC(modo) {
  $('sub-pmoc-form').style.display = modo === 'form' ? 'block' : 'none';
  $('sub-pmoc-historico').style.display = modo === 'hist' ? 'block' : 'none';
}
function alternarSubAbasOS(modo) {
  $('sub-os-ac').style.display = modo === 'ac' ? 'block' : 'none';
  $('sub-os-fac').style.display = modo === 'fac' ? 'block' : 'none';
  $('sub-os-central').style.display = modo === 'central' ? 'block' : 'none';
}
function alternarSubAbasRH(modo) {
  $('sub-rh-usuarios').style.display = modo === 'usuarios' ? 'block' : 'none';
  $('sub-rh-colab').style.display = modo === 'colab' ? 'block' : 'none';
  $('sub-rh-cargo').style.display = modo === 'cargo' ? 'block' : 'none';
}
