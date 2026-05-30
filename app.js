// ===================== SUPABASE CONFIG =====================
// ⚠️  SEGURANÇA:
//   A ANON KEY abaixo é segura para o front-end pois é somente leitura pública.
//   O acesso real aos dados é controlado por Row Level Security (RLS) no Supabase.
//   NUNCA exponha a SERVICE_ROLE_KEY no front-end.
const SUPABASE_URL      = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== ESTADO GLOBAL =====================
let globalEquipamentos = [];
let paginaAtualEquipamento = 0;
const itensPorPagina = 8;
let chartOS = null, chartCrit = null, chartOSG = null;
let modoRecuperacao = false;

// Canvas assinatura
let canvas = document.getElementById('canvas-sandbox');
canvas = document.getElementById('canvas-assinatura');
let ctx = canvas ? canvas.getContext('2d') : null;
let desenhando = false;

// ===================== UTILITÁRIOS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

function msgForm(id, texto, cor) {
  const el = $(id);
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.innerText = texto;
  if (cor === 'green') setTimeout(() => { el.innerText = ''; }, 4000);
}

// ===================== COMPRESSÃO E UPLOAD DE FOTO =====================
const FOTO_CONFIG = {
  maxWidth:    1280,   
  maxHeight:   1280,   
  qualidade:   0.78,   
  maxBytes:    800_000 
};

function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        let { width, height } = img;
        const { maxWidth, maxHeight } = FOTO_CONFIG;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Falha ao compactar a imagem.')); return; }
          resolve(blob);
        }, 'image/jpeg', FOTO_CONFIG.qualidade);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadFoto(file, pasta, msgId) {
  if (!file) return null;
  let blob = file;
  if (file.type.startsWith('image/')) {
    try {
      if (msgId) msgForm(msgId, '🗜️ Comprimindo imagem...', 'blue');
      blob = await comprimirImagem(file);
    } catch (err) {
      console.warn('Compressão falhou:', err.message);
      blob = file; 
    }
  }
  const nomeArq = `${pasta}/foto_${Date.now()}.jpg`;
  const { data, error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) return null;
  const { data: { publicUrl } } = db.storage.from('fotos-pmoc').getPublicUrl(nomeArq);
  return publicUrl;
}

// ===================== SESSÃO & ROTEAMENTO =====================
async function verificarSessaoGlobal() {
  const { data: { user }, error } = await db.auth.getUser();
  const pag = window.location.pathname.split('/').pop();
  if (!user || error) {
    if (pag !== '' && pag !== 'index.html') window.location.href = 'index.html';
  } else {
    if (pag === '' || pag === 'index.html') window.location.href = 'dashboard.html';
    if ($('user-display-email')) $('user-display-email').innerText = user.email;
  }
}
verificarSessaoGlobal();

if ($('btn-logout')) {
  $('btn-logout').addEventListener('click', async () => {
    if (confirm('Encerrar sessão?')) { await db.auth.signOut(); window.location.href = 'index.html'; }
  });
}

function toggleModoRecuperacao(ativar) {
  modoRecuperacao = ativar;
  if ($('login-title')) $('login-title').innerText = ativar ? 'Recuperação de Acesso' : 'Acesso ao Sistema';
  if ($('login-desc')) $('login-desc').innerText = ativar ? 'Digite seu e-mail para receber o link de redefinição.' : 'Informe suas credenciais para continuar';
  if ($('login-password-group')) $('login-password-group').style.display = ativar ? 'none' : 'flex';
  if ($('link-recuperar')) $('link-recuperar').style.display = ativar ? 'none' : 'inline';
  if ($('link-voltar')) $('link-voltar').style.display = ativar ? 'inline' : 'none';
  if ($('btn-login')) $('btn-login').querySelector('span').nextSibling.textContent = ativar ? ' Enviar Link' : ' Entrar no Sistema';
}

function inicializarCanvasAssinatura() {
  canvas = document.getElementById('canvas-assinatura');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.lineWidth = 2; ctx.strokeStyle = '#1a202c'; ctx.lineCap = 'round';
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  canvas.addEventListener('mousedown', (e) => { desenhando = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', (e) => { if (!desenhando) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  window.addEventListener('mouseup', () => desenhando = false);
  canvas.addEventListener('touchstart', (e) => { desenhando = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (!desenhando) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }, { passive: false });
  window.addEventListener('touchend', () => desenhando = false);
}
function limparCanvasAssinatura() { if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); }

function calcularCriticidadeFluxograma() {
  const el = (id) => $(id);
  if (!el('crit-interrupcao')) return 'Média';
  const i = el('crit-interrupcao').value, s = el('crit-seguranca').value;
  const o = el('crit-operacao').value,  r = el('crit-reserva').value;
  const res = (i === 'sim' || s === 'sim')
    ? (r === 'nao' ? 'Alta (A)' : 'Média (B)')
    : (o === 'sim' ? (r === 'nao' ? 'Média (B)' : 'Baixa (C)') : 'Baixa (C)');
  if ($('label-criticidade-calculada')) $('label-criticidade-calculada').innerText = 'Classe ' + res;
  return res.split(' ')[0];
}

const FREQ_HIERARQUIA = { M: ['M'], T: ['M','T'], S: ['M','T','S'], A: ['M','T','S','A'] };
function toggleItemsPorFrequencia() {
  const freq = $('pmoc-frequencia')?.value || 'M';
  const ativas = FREQ_HIERARQUIA[freq] || ['M'];
  [
    { cls: 'freq-item-t', fq: 'T' },
    { cls: 'freq-item-s', fq: 'S' },
    { cls: 'freq-item-a', fq: 'A' },
  ].forEach(({ cls, fq }) => {
    const mostrar = ativas.includes(fq);
    document.querySelectorAll('.' + cls).forEach(el => {
      el.style.display = mostrar ? '' : 'none';
      if (!mostrar) el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    });
  });
}

// ===================== EQUIPAMENTOS =====================
const EQ_CAMPOS_EXTRAS = {
  AC:   ['eq-potencia','eq-ciclo','eq-tensao','eq-gas','eq-instalacao-ac','eq-validade'],
  BEB:  ['eq-cap-beb','eq-tipo-beb','eq-filtro-beb','eq-validade-filtro-beb','eq-lacre-beb','eq-validade-lacre-beb'],
  CLIM: ['eq-vazao-clim','eq-tipo-clim','eq-painel-clim','eq-validade-painel-clim','eq-tensao-clim','eq-consumo-clim'],
  VEN:  ['eq-potencia-ven','eq-tipo-ven','eq-diametro-ven','eq-tensao-ven'],
  OUT:  [],
};
const EQ_CATEGORIA_LABEL = { AC: '❄️ Ar Condicionado', BEB: '💧 Bebedouro', CLIM: '🌀 Climatizador Evaporativo', VEN: '💨 Ventilador/Exaustor', OUT: '🔧 Outros' };

function toggleCamposEquipamento() {
  const cat = $('eq-categoria')?.value || '';
  document.querySelectorAll('.eq-campo-condicional').forEach(el => el.style.display = 'none');
  Object.values(EQ_CAMPOS_EXTRAS).flat().forEach(id => { if ($(id)) $(id).value = ''; });
  if (!cat) return;
  document.querySelectorAll(`.eq-campo-${cat}`).forEach(el => el.style.display = 'block');
  document.querySelectorAll('.eq-campo-localizacao, .eq-campo-criticidade').forEach(el => el.style.display = 'block');
}

if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag')?.value.trim(); const cat = $('eq-categoria')?.value;
    if (!tag || !cat)  { msgForm('msg-equipamento', 'TAG e Categoria são obrigatórias.', 'red'); return; }
    msgForm('msg-equipamento', 'Salvando...', 'blue');
    const payload = {
      tag, categoria: cat,
      marca: $('eq-marca')?.value.trim()||null, produto: $('eq-produto')?.value.trim()||null,
      nr_serie: $('eq-serie')?.value.trim()||null, patrimonio: $('eq-patrimonio')?.value.trim()||null,
      bloco: $('eq-bloco')?.value.trim()||null, setor: $('eq-setor')?.value.trim()||null,
      sala: $('eq-sala')?.value.trim()||null, instituicao: $('eq-instituicao')?.value.trim()||null,
      criticidade: calcularCriticidadeFluxograma(),
    };
    const extras = {};
    (EQ_CAMPOS_EXTRAS[cat] || []).forEach(id => {
      const el = $(id); if (!el || !el.value.trim()) return;
      extras[id.replace('eq-','')] = el.value.trim();
    });
    if (Object.keys(extras).length) payload.extras_tecnico = extras;
    if ($('eq-potencia')?.value) payload.potencia = $('eq-potencia').value.trim();
    if ($('eq-validade')?.value) payload.validade = $('eq-validade').value.trim();

    const { error } = await db.from('equipamentos').insert([payload]);
    if (error) { msgForm('msg-equipamento', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-equipamento', '✓ Equipamento salvo!', 'green');
    setTimeout(() => location.href = 'gerir-equipamentos.html', 1200);
  });
}

async function carregarEquipamentos() {
  const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
  globalEquipamentos = data || []; filtrarEquipamentos(0); atualizarSelectEquipamentos();
}

function filtrarEquipamentos(delta) {
  paginaAtualEquipamento = Math.max(0, paginaAtualEquipamento + delta);
  const termo = ($('search-eq-termo')?.value || '').toLowerCase();
  const crit = ($('search-eq-criticidade')?.value || '');
  const bloco = ($('search-eq-bloco')?.value || '').toLowerCase();
  let items = globalEquipamentos.filter(e =>
    (!termo || e.tag.toLowerCase().includes(termo) || (e.produto || '').toLowerCase().includes(termo)) &&
    (!crit || (e.criticidade || '') === crit) &&
    (!bloco || (e.bloco || '').toLowerCase().includes(bloco))
  );
  const total = Math.max(1, Math.ceil(items.length / itensPorPagina));
  paginaAtualEquipamento = Math.min(paginaAtualEquipamento, total - 1);
  if ($('txt-eq-paginacao')) $('txt-eq-paginacao').innerText = `Página ${paginaAtualEquipamento + 1} de ${total}`;
  const slice = items.slice(paginaAtualEquipamento * itensPorPagina, (paginaAtualEquipamento + 1) * itensPorPagina);
  const tbody = $('tbody-equipamentos-gerir'); if (!tbody) return;
  if (!slice.length) { tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum ativo encontrado.</td></tr>'; return; }
  tbody.innerHTML = slice.map(eq => {
    const critCls = eq.criticidade === 'Alta' ? 'danger' : eq.criticidade === 'Baixa' ? 'success' : '';
    return `<tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || '—'}</strong><br><small style="color:#a0aec0">${eq.marca || ''}</small></td>
      <td>${eq.bloco || '—'} / ${eq.setor || '—'}<br><small style="color:#a0aec0">${eq.sala || ''}</small></td>
      <td><span class="tag-badge ${critCls}">Classe ${eq.criticidade || 'Média'}</span></td>
      <td>${eq.qrcode_token ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;" onclick="exibirJanelaQRCode('${eq.qrcode_token}','${eq.tag}')">👁️ QR</button>` : '—'}</td>
      <td><button class="btn-primary" style="background:#4a5568;padding:3px 8px;font-size:11px;" onclick="editarEquipamento('${eq.id}')">✍️</button> <button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕</button></td>
    </tr>`;
  }).join('');
}
function mudarPaginaEquipamento(d) { filtrarEquipamentos(d); }
async function excluirEquipamento(id) { if (confirm('Remover ativo?')) { await db.from('equipamentos').delete().eq('id', id); carregarEquipamentos(); } }
function editarEquipamento(id) { location.href = 'equipamentos.html?edit=' + id; }

async function atualizarSelectEquipamentos() {
  const { data } = await db.from('equipamentos').select('id, tag, produto, categoria');
  ['pmoc-equipamento', 'os-equipamento'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Ativo --</option>';
    (data || []).forEach(e => {
      const opt = document.createElement('option'); opt.value = e.id; opt.textContent = `${e.tag} — ${e.produto || ''}`; opt.dataset.categoria = e.categoria || 'OUT'; sel.appendChild(opt);
    });
  });
}

function onEquipamentoSelecionado() {
  const sel = $('pmoc-equipamento'); if (!sel) return;
  const cat = sel.options[sel.selectedIndex]?.dataset?.categoria || '';
  ['AC','BEB','CLIM','VEN','OUT'].forEach(t => { const el = $('checklist-' + t); if (el) { el.style.display = 'none'; el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false); } });
  if (!cat) { if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'block'; return; }
  if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'none';
  const alvo = $('checklist-' + cat) || $('checklist-OUT'); if (alvo) alvo.style.display = 'block';
  if ($('pmoc-tipo-badge')) $('pmoc-tipo-badge').style.display = 'block';
  if ($('pmoc-tipo-label')) $('pmoc-tipo-label').textContent = EQ_CATEGORIA_LABEL[cat] || 'Outro';
  toggleItemsPorFrequencia();
}

// ===================== COLABORADORES & FUNÇÕES =====================
async function atualizarSelectColaboradores() {
  const { data } = await db.from('colaboradores').select('id, nome');
  ['pmoc-tecnico', 'os-tecnico', 'osg-tecnico'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  });
}
async function atualizarSelectFuncoes() {
  const sel = $('colab-funcao'); if (!sel) return;
  const { data } = await db.from('funcoes').select('id, nome');
  sel.innerHTML = '<option value="">-- Selecione uma Função --</option>';
  (data || []).forEach(f => { sel.innerHTML += `<option value="${f.id}">${f.nome}</option>'; });
}
async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores'); if (!tbody) return;
  const { data } = await db.from('colaboradores').select('*, funcoes(nome)').order('nome', { ascending: true });
  tbody.innerHTML = (data || []).length ? data.map(c => `<tr><td><strong>${c.nome}</strong></td><td>${c.cpf || '—'}</td><td>${c.funcoes?.nome || '—'}</td><td><button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button></td></tr>`).join('') : '<tr><td colspan="4" class="td-loading">Sem registros.</td></tr>';
}
async function excluirColaborador(id) { if (confirm('Remover colaborador?')) { await db.from('colaboradores').delete().eq('id', id); carregarColaboradores(); } }

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes'); if (!tbody) return;
  const { data } = await db.from('funcoes').select('*').order('nome', { ascending: true });
  tbody.innerHTML = (data || []).length ? data.map(f => `<tr><td><strong>${f.nome}</strong></td><td>${f.nivel || '—'}</td><td>R$ ${Number(f.salario || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td></tr>`).join('') : '<tr><td colspan="4" class="td-loading">Sem registros.</td></tr>';
}
async function excluirFuncao(id) { if (confirm('Remover função?')) { await db.from('funcoes').delete().eq('id', id); carregarFuncoes(); } }

if ($('btn-salvar-colaborador')) {
  $('btn-salvar-colaborador').addEventListener('click', async () => {
    const nome = $('colab-nome')?.value.trim(); const cpf = $('colab-cpf')?.value.trim();
    if (!nome || !cpf || !validarCPF(cpf)) { msgForm('msg-colaborador', 'Verifique o nome e o CPF informado.', 'red'); return; }
    const { error } = await db.from('colaboradores').insert([{ nome, cpf: cpf.replace(/\D/g, ''), funcao_id: $('colab-funcao')?.value || null }]);
    if (!error) { msgForm('msg-colaborador', '✓ Salvo!', 'green'); carregarColaboradores(); atualizarSelectColaboradores(); $('colab-nome').value = ''; $('colab-cpf').value = ''; }
  });
}
if ($('btn-salvar-funcao')) {
  $('btn-salvar-funcao').addEventListener('click', async () => {
    const nome = $('func-nome')?.value.trim(); if (!nome) return;
    const { error } = await db.from('funcoes').insert([{ nome, salario: parseFloat($('func-salario')?.value) || 0, nivel: $('func-nivel')?.value || 'Pleno' }]);
    if (!error) { msgForm('msg-funcao', '✓ Salva!', 'green'); carregarFuncoes(); atualizarSelectFuncoes(); $('func-nome').value = ''; }
  });
}

// ===================== FORMULÁRIO PMOC =====================
if ($('btn-salvar-ficha')) {
  $('btn-salvar-ficha').addEventListener('click', async () => {
    const equipamento_id = $('pmoc-equipamento')?.value; const tecnico_id = $('pmoc-tecnico')?.value;
    if (!equipamento_id || !tecnico_id) { msgForm('msg-ficha', 'Preencha os campos obrigatórios.', 'red'); return; }
    msgForm('msg-ficha', 'Salvando...', 'blue');
    const freq = $('pmoc-frequencia')?.value || 'M'; const dataInsp = $('pmoc-data')?.value || hoje();
    const cat = $('pmoc-equipamento').options[$('pmoc-equipamento').selectedIndex]?.dataset?.categoria || 'OUT';
    
    const checklistResult = {};
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]:checked').forEach(r => { checklistResult[r.name] = r.value; });

    let assinaturaBase64 = null; 
    if (canvas && ctx) { 
      const idat = ctx.getImageData(0, 0, canvas.width, canvas.height); 
      if (idat.data.some((v, i) => i % 4 === 3 && v > 0)) {
        // Correção de codificação de string para renderização em laudo nativo
        assinaturaBase64 = canvas.toDataURL('image/png'); 
      }
    }
    
    const obsCompleto = `[DataInspecao: ${dataInsp}]\n[Frequencia: ${freq === 'M' ? 'Mensal' : freq === 'T' ? 'Trimestral' : freq === 'S' ? 'Semestral' : 'Anual'}]\n[TipoEquipamento: ${cat}]\n[Checklist: ${JSON.stringify(checklistResult)}]\n${$('pmoc-obs')?.value.trim() || ''}`;
    const foto_url = await uploadFoto($('pmoc-foto')?.files[0], 'pmoc', 'msg-ficha');
    const { data: colab } = await db.from('colaboradores').select('nome').eq('id', tecnico_id).single();
    const { data: { user } } = await db.auth.getUser();

    const payload = { equipamento_id, tecnico_nome: colab?.nome || 'Técnico', observacoes: obsCompleto, user_id: user?.id };
    if (foto_url) payload.foto_url = foto_url; 
    if (assinaturaBase64) payload.assinatura_digital = assinaturaBase64; // Correção da colisão de variáveis (Blindado)

    const { error } = await db.from('fichas_pmoc').insert([payload]);
    if (error) { msgForm('msg-ficha', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-ficha', '✓ PMOC salvo!', 'green'); limparCanvasAssinatura(); if ($('pmoc-obs')) $('pmoc-obs').value = '';
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]').forEach(r => r.checked = false);
    carregarHistoricoFichas(); alternarSubAbasPMOC('hist');
  });
}

let _fichasCache = [];
async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  const { data } = await db.from('fichas_pmoc').select('*, equipamentos(tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, categoria)').order('created_at', { ascending: false });
  _fichasCache = data || []; renderHistoricoFichas(_fichasCache);
}
function filtrarHistoricoFichas() {
  const tag = ($('filtro-hist-tag')?.value || '').toLowerCase(); const tipo = $('filtro-hist-tipo')?.value || ''; const freq = $('filtro-hist-freq')?.value || '';
  renderHistoricoFichas(_fichasCache.filter(f => (f.equipamentos?.tag || '').toLowerCase().includes(tag) && (!tipo || (f.observacoes || '').includes(`[TipoEquipamento: ${tipo}]`)) && (!freq || (f.observacoes || '').includes(`[Frequencia: ${freq}]`))));
}
function renderHistoricoFichas(data) {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Sem registros.</td></tr>'; return; }
  tbody.innerHTML = data.map(f => {
    const matchFreq = f.observacoes?.match(/\[Frequencia:\s*([^\]]+)\]/); const freq = matchFreq ? matchFreq[1] : 'Mensal';
    const matchTipo = f.observacoes?.match(/\[TipoEquipamento:\s*([^\]]+)\]/); const tipo = matchTipo ? matchTipo[1] : 'OUT';
    return `<tr>
      <td><strong>L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}</strong></td>
      <td>${fmtDate(f.created_at)}</td>
      <td><span class="tag-badge">${f.equipamentos?.tag || '—'}</span></td>
      <td><small>${tipo}</small></td>
      <td>${f.tecnico_nome}</td>
      <td><span class="tag-badge">${freq}</span></td>
      <td><button class="btn-primary" style="padding:4px 12px;font-size:12px;" onclick="emitirRelatorioPMOC('${btoa(unescape(encodeURIComponent(JSON.stringify(f))))}')">🖨️ Emitir</button></td>
    </tr>`;
  }).join('');
}

// ===================== IMPRESSÃO PMOC & OS =====================
function emitirRelatorioPMOC(b64) {
  const f = JSON.parse(decodeURIComponent(escape(atob(b64)))); const eq = f.equipamentos || {};
  
  // Tratamento de falhas contra Base64 ausentes ou quebrados em laudos antigos (Evita folhas em branco)
  const assinaturaHTML = (f.assinatura_digital && f.assinatura_digital.includes('data:image'))
    ? `<div style="text-align:center;margin-top:8px;"><img src="${f.assinatura_digital}" style="max-width:200px;max-height:70px;border:1px dashed #ccc;" alt="Assinatura digital"/></div>`
    : '';

  const html = `<div class="laudo-wrapper"><div class="laudo-header"><h1>PMOC — CONCREDUR</h1><p>Código: L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}</p></div><div class="laudo-section"><div class="laudo-section-title">IDENTIFICAÇÃO DO ATIVO</div><p>TAG: ${eq.tag || '—'} | Tipo: ${eq.produto || '—'} | Local: ${eq.bloco || '—'}</p></div><div class="laudo-section"><div class="laudo-section-title">RESPONSÁVEL</div><p>Técnico: ${f.tecnico_nome}</p></div>${assinaturaHTML}</div>`;
  imprimir('area-laudo-impressao', html);
}

// ===================== ORDENS DE SERVIÇO =====================
if ($('btn-salvar-os')) {
  $('btn-salvar-os').addEventListener('click', async () => {
    const payload = { equipamento_id: $('os-equipamento').value, colaborador_id: $('os-tecnico').value, tipo_os: $('os-tipo').value, status_os: $('os-status').value, descricao_defeito: $('os-defeito').value.trim(), laudo_tecnico: $('os-laudo').value.trim() };
    const idEd = $('os-id-edicao').value;
    const { error } = idEd ? await db.from('ordens_servico').update(payload).eq('id', idEd) : await db.from('ordens_servico').insert([payload]);
    if (!error) { resetarFormOS(); carregarOrdensServico(); carregarCentralUnificadaOS(); }
  });
}
async function carregarOrdensServico() {
  const tbody = $('tbody-os'); if (!tbody) return;
  const { data } = await db.from('ordens_servico').select('*, equipamentos(tag), colaboradores(nome)').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(os => `<tr><td><strong>OS-AC-${os.id.toString().slice(0,5).toUpperCase()}</strong></td><td>${fmtDate(os.created_at)}</td><td><span class="tag-badge">${os.equipamentos?.tag || '—'}</span></td><td>${os.colaboradores?.nome || '—'}</td><td>${os.tipo_os}</td><td>${statusBadge(os.status_os)}</td></tr>`).join('');
}

// ===================== FACILITIES =====================
if ($('btn-salvar-osg')) {
  $('btn-salvar-osg').addEventListener('click', async () => {
    const payload = { setor: $('osg-setor').value, servico_requisitado: $('osg-requisitado').value, falha_relatada: $('osg-falha').value, status_os: $('osg-status').value };
    const { error } = await db.from('ordens_servico_geral').insert([payload]);
    if (!error) { resetarFormOSG(); carregarOSGeral(); carregarCentralUnificadaOS(); }
  });
}
async function carregarOSGeral() {
  const tbody = $('tbody-osg'); if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(os => `<tr><td><strong>${os.numero_os || 'OSG'}</strong></td><td>${fmtDate(os.created_at)}</td><td>${os.setor}</td><td>${statusBadge(os.status_os)}</td></tr>`).join('');
}

async function carregarCentralUnificadaOS() {
  const tbody = $('tbody-central-unificada-os'); if (!tbody) return;
  const { data: ac } = await db.from('ordens_servico').select('id,created_at,tipo_os,status_os,descricao_defeito').limit(20);
  const { data: g } = await db.from('ordens_servico_geral').select('id,created_at,tipo_manutencao,status_os,servico_requisitado,numero_os').limit(20);
  const linhas = [...(ac || []).map(d => ({ id:'OS-AC-'+d.id.toString().slice(0,5).toUpperCase(), data:d.created_at, mod:'Refrigeração', cat:d.tipo_os, st:d.status_os })), ...(g || []).map(d => ({ id:d.numero_os||'OSG', data:d.created_at, mod:'Facilities', cat:d.tipo_manutencao, st:d.status_os }))].sort((a,b) => new Date(b.data) - new Date(a.data));
  tbody.innerHTML = linhas.map(l => `<tr><td><strong>${l.id}</strong></td><td>${fmtDate(l.data)}</td><td>${l.mod}</td><td>${l.cat || '—'}</td><td>${statusBadge(l.st)}</td></tr>`).join('');
}

// ===================== GESTÃO DE USUÁRIOS (ROTA MÓVEL WHATSAPP) =====================
if ($('btn-admin-salvar-usuario')) {
  $('btn-admin-salvar-usuario').addEventListener('click', async () => {
    const email = $('adm-user-email')?.value.trim(); const cpf = $('adm-user-cpf')?.value.trim();
    const role = $('adm-user-role')?.value; const nome = $('adm-user-nome')?.value.trim();
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'none';
    if (!email || !nome || !cpf || !validarCPF(cpf)) { msgForm('msg-admin-usuario', 'Campos obrigatórios inválidos.', 'red'); return; }
    msgForm('msg-admin-usuario', 'Inserindo credenciais no banco público...', 'blue');

    const novoId = crypto.randomUUID();
    const { error } = await db.from('profiles').insert([{ id: novoId, email, nome, role, cpf: cpf.replace(/\D/g, ''), status: 'pendente' }]);
    if (error) { msgForm('msg-admin-usuario', 'Erro: ' + error.message, 'red'); return; }

    const tokenWhatsApp = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    if ($('adm-link-gerado')) $('adm-link-gerado').value = tokenWhatsApp;
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'block';

    msgForm('msg-admin-usuario', '✓ Pré-cadastro efetuado com sucesso!', 'green');
    $('adm-user-email').value = ''; $('adm-user-cpf').value = ''; $('adm-user-nome').value = '';
    carregarUsuariosSistema();
  });
}

async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema'); if (!tbody) return;
  const { data: { user: userAtual } } = await db.auth.getUser();
  const { data: perfis, error } = await db.from('profiles').select('*').order('email', { ascending: true });

  let lista = perfis || [];
  const adminNaLista = lista.some(u => u.email === userAtual?.email);
  if (userAtual?.email && !adminNaLista) {
    lista = [{ id: userAtual.id, email: userAtual.email, role: 'admin', nome: 'Administrador', cpf: null, status: 'ativo', _isCurrentUser: true }, ...lista];
  } else if (userAtual?.email) {
    lista = lista.map(u => u.email === userAtual.email ? { ...u, _isCurrentUser: true } : u);
  }

  const roleBadge = { admin: '<span class="tag-badge danger">🛡️ Admin</span>', master: '<span class="tag-badge warning">👨‍💻 Master</span>', tecnico: '<span class="tag-badge">🔬 Técnico</span>', auditor: '<span class="tag-badge" style="background:#f3e8ff;color:#7c3aed;">👁️ Auditor</span>' };
  const statusBadgeUser = { ativo: '<span class="tag-badge success">● Ativo</span>', pendente: '<span class="tag-badge warning">⏳ Aguardando</span>' };

  tbody.innerHTML = lista.map(u => {
    const isVoce = !!u._isCurrentUser;
    return `<tr${isVoce ? ' style="background:#f0f7ff;"' : ''}>
      <td><strong>${u.nome || u.email}</strong>${isVoce ? '<span class="tag-badge" style="background:#dbeafe;color:#1e40af;margin-left:6px;font-size:10px;">Você</span>' : ''}<br><small style="color:#a0aec0;">${u.email}</small></td>
      <td>${u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
      <td>${roleBadge[u.role] || `<span>${u.role || '—'}</span>`}</td>
      <td>${statusBadgeUser[u.status] || statusBadgeUser['ativo']}</td>
      <td>${isVoce ? '—' : `<button class="btn-excluir" onclick="excluirPerfil('${u.id}','${u.email}')">✕ Revogar</button> ${u.status === 'pendente' ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-left:4px;background:#d97706;border-color:#d97706;" onclick="reenviarConvite('${u.email}')">↺ Link</button>` : ''}`}</td>
    </tr>`;
  }).join('');
}

async function excluirPerfil(id, email) {
  if (confirm(`Revogar acesso de "${email}"?`)) { await db.from('profiles').delete().eq('id', id); carregarUsuariosSistema(); }
}
function reenviarConvite(email) {
  if ($('wrapper-link-ativacao') && $('adm-link-gerado')) {
    $('adm-link-gerado').value = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    $('wrapper-link-ativacao').style.display = 'block'; $('wrapper-link-ativacao').scrollIntoView({ behavior: 'smooth' });
  }
}

// ===================== VALIDAÇÃO CPF =====================
function validarCPF(cpf) {
  const s = cpf.replace(/\D/g, ''); if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let soma = 0; for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0; if (r !== parseInt(s[9])) return false;
  soma = 0; for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0; return r === parseInt(s[10]);
}

// ===================== CONTROLLERS & ENGINE IMPRESSÃO =====================
function alternarSubAbasPMOC(m) { if($('sub-pmoc-form'))$('sub-pmoc-form').style.display=m==='form'?'block':'none'; if($('sub-pmoc-historico'))$('sub-pmoc-historico').style.display=m==='hist'?'block':'none'; if(m==='hist')carregarHistoricoFichas(); }
function alternarSubAbasOS(m) { if($('sub-os-ac'))$('sub-os-ac').style.display=m==='ac'?'block':'none'; if($('sub-os-fac'))$('sub-os-fac').style.display=m==='fac'?'block':'none'; if($('sub-os-central'))$('sub-os-central').style.display=m==='central'?'block':'none'; if(m==='central')carregarCentralUnificadaOS(); }
function alternarSubAbasRH(m) { if($('sub-rh-usuarios'))$('sub-rh-usuarios').style.display=m==='usuarios'?'block':'none'; if($('sub-rh-colab'))$('sub-rh-colab').style.display=m==='colab'?'block':'none'; if($('sub-rh-cargo'))$('sub-rh-cargo').style.display=m==='cargo'?'block':'none'; }
function resetarFormOS() { ['os-defeito','os-laudo','os-id-edicao'].forEach(id => { if($(id)) $(id).value=''; }); }
function resetarFormOSG() { ['osg-setor','osg-requisitado','osg-falha'].forEach(id => { if($(id)) $(id).value=''; }); }

function imprimir(areaId, html) {
  document.querySelectorAll('.print-only').forEach(el => { el.innerHTML = ''; });
  const area = $(areaId); if (!area) return; area.innerHTML = html; window.print();
  const limpar = () => { area.innerHTML = ''; window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
}
