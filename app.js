// ===================== SUPABASE CONFIG =====================
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
let canvas = document.getElementById('canvas-assinatura');
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

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Falha ao compactar a imagem.')); return; }
            resolve(blob);
          },
          'image/jpeg',
          FOTO_CONFIG.qualidade
        );
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
      console.warn('Compressão falhou, usando arquivo original:', err.message);
      blob = file; 
    }
  }

  const nomeArq = `${pasta}/foto_${Date.now()}.jpg`;
  const { data, error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('Erro no upload:', error.message);
    return null;
  }

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

// ===================== MODO RECUPERAÇÃO DE SENHA =====================
function toggleModoRecuperacao(ativar) {
  modoRecuperacao = ativar;
  if ($('login-title')) $('login-title').innerText = ativar ? 'Recuperação de Acesso' : 'Acesso ao Sistema';
  if ($('login-desc')) $('login-desc').innerText = ativar ? 'Digite seu e-mail para receber o link de redefinição.' : 'Informe suas credenciais para continuar';
  if ($('login-password-group')) $('login-password-group').style.display = ativar ? 'none' : 'flex';
  if ($('link-recuperar')) $('link-recuperar').style.display = ativar ? 'none' : 'inline';
  if ($('link-voltar')) $('link-voltar').style.display = ativar ? 'inline' : 'none';
  if ($('btn-login')) $('btn-login').querySelector('span').nextSibling.textContent = ativar ? ' Enviar Link' : ' Entrar no Sistema';
}

// ===================== CANVAS DE ASSINATURA DIGITAL =====================
function inicializarCanvasAssinatura() {
  canvas = document.getElementById('canvas-assinatura');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a202c';
  ctx.lineCap = 'round';

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

// ===================== CRITICIDADE =====================
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

// ===================== TOGGLE CHECKLIST PMOC =====================
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

// ===================== EQUIPAMENTOS — CATEGORIAS & MAPEAMENTO =====================
const EQ_CAMPOS_EXTRAS = {
  AC:   ['eq-potencia','eq-ciclo','eq-tensao','eq-gas','eq-instalacao-ac','eq-validade'],
  BEB:  ['eq-cap-beb','eq-tipo-beb','eq-filtro-beb','eq-validade-filtro-beb','eq-lacre-beb','eq-validade-lacre-beb'],
  CLIM: ['eq-vazao-clim','eq-tipo-clim','eq-painel-clim','eq-validade-painel-clim','eq-tensao-clim','eq-consumo-clim'],
  VEN:  ['eq-potencia-ven','eq-tipo-ven','eq-diametro-ven','eq-tensao-ven'],
  OUT:  [],
};

const EQ_CATEGORIA_LABEL = {
  AC: '❄️ Ar Condicionado', BEB: '💧 Bebedouro',
  CLIM: '🌀 Climatizador Evaporativo', VEN: '💨 Ventilador/Exaustor', OUT: '🔧 Outros',
};

function toggleCamposEquipamento() {
  const cat = $('eq-categoria')?.value || '';

  document.querySelectorAll('.eq-campo-condicional').forEach(el => el.style.display = 'none');
  
  Object.values(EQ_CAMPOS_EXTRAS).flat().forEach(id => { 
    const el = $(id);
    if (el) el.value = '';
  });

  if (!cat) return;

  document.querySelectorAll(`.eq-campo-${cat}`).forEach(el => el.style.display = 'block');
  document.querySelectorAll('.eq-campo-localizacao, .eq-campo-criticidade').forEach(el => el.style.display = 'block');
}

// ===================== EQUIPAMENTOS — CADASTRO =====================
if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag')?.value.trim();
    const cat = $('eq-categoria')?.value;
    if (!tag)  { msgForm('msg-equipamento', 'TAG é obrigatória.',      'red'); return; }
    if (!cat)  { msgForm('msg-equipamento', 'Selecione a categoria do ativo.', 'red'); return; }
    msgForm('msg-equipamento', 'Salvando...', 'blue');

    const payload = {
      tag, categoria: cat,
      marca:       $('eq-marca')?.value.trim()      || null,
      produto:     $('eq-produto')?.value.trim()    || null,
      nr_serie:    $('eq-serie')?.value.trim()       || null,
      patrimonio:  $('eq-patrimonio')?.value.trim() || null,
      bloco:       $('eq-bloco')?.value.trim()      || null,
      setor:       $('eq-setor')?.value.trim()      || null,
      sala:        $('eq-sala')?.value.trim()       || null,
      instituicao: $('eq-instituicao')?.value.trim()|| null,
      criticidade: calcularCriticidadeFluxograma(),
    };

    const extras = {};
    (EQ_CAMPOS_EXTRAS[cat] || []).forEach(id => {
      const el = $(id); if (!el || !el.value.trim()) return;
      extras[id.replace('eq-','')] = el.value.trim();
    });
    if (Object.keys(extras).length) payload.extras_tecnico = extras;

    if ($('eq-potencia')?.value)   payload.potencia = $('eq-potencia').value.trim();
    if ($('eq-validade')?.value)   payload.validade = $('eq-validade').value.trim();

    const { error } = await db.from('equipamentos').insert([payload]);
    if (error) { msgForm('msg-equipamento', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-equipamento', '✓ Equipamento salvo com sucesso!', 'green');
    setTimeout(() => location.href = 'gerir-equipamentos.html', 1200);
  });
}

if ($('btn-limpar')) {
  $('btn-limpar').addEventListener('click', () => {
    if ($('eq-categoria')) $('eq-categoria').value = '';
    document.querySelectorAll('input[id^="eq-"], select[id^="eq-"]')
      .forEach(el => { el.value = ''; });
    if ($('label-criticidade-calculada')) $('label-criticidade-calculada').innerText = 'Classe Média (B)';
    toggleCamposEquipamento();
  });
}

// ===================== EQUIPAMENTOS — LISTAGEM =====================
async function carregarEquipamentos() {
  const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
  globalEquipamentos = data || [];
  filtrarEquipamentos(0);
  atualizarSelectEquipamentos();
}

function filtrarEquipamentos(delta) {
  paginaAtualEquipamento = Math.max(0, paginaAtualEquipamento + delta);
  const termo  = ($('search-eq-termo')?.value  || '').toLowerCase();
  const crit   = ($('search-eq-criticidade')?.value || '');
  const bloco  = ($('search-eq-bloco')?.value  || '').toLowerCase();

  let items = globalEquipamentos.filter(e =>
    (!termo  || e.tag.toLowerCase().includes(termo) || (e.produto || '').toLowerCase().includes(termo)) &&
    (!crit   || (e.criticidade || '') === crit) &&
    (!bloco  || (e.bloco || '').toLowerCase().includes(bloco))
  );

  const total = Math.max(1, Math.ceil(items.length / itensPorPagina));
  paginaAtualEquipamento = Math.min(paginaAtualEquipamento, total - 1);
  if ($('txt-eq-paginacao')) $('txt-eq-paginacao').innerText = `Página ${paginaAtualEquipamento + 1} de ${total}`;

  const slice = items.slice(paginaAtualEquipamento * itensPorPagina, (paginaAtualEquipamento + 1) * itensPorPagina);
  const tbody = $('tbody-equipamentos-gerir');
  if (!tbody) return;

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum equipamento encontrado.</td></tr>'; return;
  }

  tbody.innerHTML = slice.map(eq => {
    const critCls = eq.criticidade === 'Alta' ? 'danger' : eq.criticidade === 'Baixa' ? 'success' : '';
    return `<tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || '—'}</strong><br><small style="color:#a0aec0">${eq.marca || ''}</small></td>
      <td>${eq.bloco || '—'} / ${eq.setor || '—'}<br><small style="color:#a0aec0">${eq.sala || ''}</small></td>
      <td><span class="tag-badge ${critCls}">Classe ${eq.criticidade || 'Média'}</span></td>
      <td>${eq.qrcode_token
        ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;" onclick="exibirJanelaQRCode('${eq.qrcode_token}','${eq.tag}')">👁️ QR</button>`
        : '<span style="color:#a0aec0;font-size:11px;">—</span>'}</td>
      <td>
        <button class="btn-primary" style="background:#4a5568;padding:3px 8px;font-size:11px;" onclick="editarEquipamento('${eq.id}')">✍️</button>
        <button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function mudarPaginaEquipamento(d) { filtrarEquipamentos(d); }

async function excluirEquipamento(id) {
  if (!confirm('Remover este equipamento?')) return;
  await db.from('equipamentos').delete().eq('id', id);
  carregarEquipamentos();
}

function editarEquipamento(id) {
  location.href = 'equipamentos.html?edit=' + id;
}

function exibirJanelaQRCode(token, tag) {
  const alvo = $('qrcode-temp-generator');
  if (!alvo) return;
  alvo.innerHTML = '';
  new QRCode(alvo, { text: window.location.origin + '/pmoc.html?token=' + token, width: 160, height: 160 });
  setTimeout(() => {
    const img = alvo.querySelector('img');
    if (!img) return;
    const win = window.open('', '_blank', 'width=340,height=360');
    win.document.write(`
      <html><head><title>QR Code — ${tag}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:20px;">
        <h3 style="margin-bottom:10px;">🏗️ Ativo: <strong>${tag}</strong></h3>
        <img src="${img.src}" style="border:1px solid #ccc;padding:10px;"/>
        <br><small style="color:#888;">Escaneie para abrir PMOC deste ativo</small>
        <br><button onclick="window.print()" style="margin-top:14px;padding:8px 18px;background:#1a56db;color:#fff;border:none;border-radius:4px;cursor:pointer;">🖨️ Imprimir</button>
      </body></html>`);
  }, 250);
}

async function atualizarSelectEquipamentos() {
  const { data } = await db.from('equipamentos').select('id, tag, produto, categoria');
  ['pmoc-equipamento', 'os-equipamento'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Ativo --</option>';
    (data || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.tag} — ${e.produto || ''}`;
      opt.dataset.categoria = e.categoria || 'OUT';
      sel.appendChild(opt);
    });
  });
}

function onEquipamentoSelecionado() {
  const sel = $('pmoc-equipamento');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const cat = opt?.dataset?.categoria || '';

  ['AC','BEB','CLIM','VEN','OUT'].forEach(t => {
    const el = $('checklist-' + t);
    if (el) el.style.display = 'none';
    if (el) el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
  });

  const placeholder = $('checklist-placeholder');

  if (!cat || cat === '') {
    if (placeholder) placeholder.style.display = 'block';
    if ($('pmoc-tipo-badge')) $('pmoc-tipo-badge').style.display = 'none';
    return;
  }

  if (placeholder) placeholder.style.display = 'none';

  const alvo = $('checklist-' + cat) || $('checklist-OUT');
  if (alvo) alvo.style.display = 'block';

  const badge = $('pmoc-tipo-badge');
  const labelEl = $('pmoc-tipo-label');
  if (badge && labelEl) {
    labelEl.textContent = EQ_CATEGORIA_LABEL[cat] || 'Outro';
    badge.style.display = 'block';
  }

  toggleItemsPorFrequencia();
}

async function carregarAtivoViaTokenQRCode(token) {
  const { data } = await db.from('equipamentos').select('id').eq('qrcode_token', token).single();
  if (data && $('pmoc-equipamento')) $('pmoc-equipamento').value = data.id;
}

// Edição de Equipamento
(async () => {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId && $('eq-tag')) {
    const { data } = await db.from('equipamentos').select('*').eq('id', editId).single();
    if (data) {
      if ($('eq-categoria') && data.categoria) {
        $('eq-categoria').value = data.categoria;
        toggleCamposEquipamento();
      }
      const mapa = { tag:'tag', marca:'marca', potencia:'potencia', serie:'nr_serie',
        patrimonio:'patrimonio', produto:'produto', bloco:'bloco', setor:'setor',
        sala:'sala', instituicao:'instituicao', validade:'validade' };
      Object.entries(mapa).forEach(([htmlK, dbK]) => {
        if ($('eq-' + htmlK) && data[dbK]) $('eq-' + htmlK).value = data[dbK];
      });
      if (data.extras_tecnico) {
        Object.entries(data.extras_tecnico).forEach(([k, v]) => {
          const el = $('eq-' + k); if (el) el.value = v;
        });
      }

      if ($('msg-equipamento')) $('msg-equipamento').innerText = '✏️ Modo Edição — salvar irá atualizar o registro';
      if ($('btn-salvar')) {
        $('btn-salvar').innerText = '💾 Atualizar Equipamento';
        $('btn-salvar').onclick = async (ev) => {
          ev.stopImmediatePropagation();
          const cat = $('eq-categoria')?.value || data.categoria;
          const extras = {};
          (EQ_CAMPOS_EXTRAS[cat] || []).forEach(id => {
            const el = $(id); if (!el || !el.value.trim()) return;
            extras[id.replace('eq-','')] = el.value.trim();
          });
          const payload = {
            tag: $('eq-tag').value.trim(), categoria: cat,
            marca: $('eq-marca')?.value.trim()||null, produto: $('eq-produto')?.value.trim()||null,
            nr_serie: $('eq-serie')?.value.trim()||null, patrimonio: $('eq-patrimonio')?.value.trim()||null,
            potencia: $('eq-potencia')?.value.trim()||null, validade: $('eq-validade')?.value.trim()||null,
            bloco: $('eq-bloco')?.value.trim()||null, setor: $('eq-setor')?.value.trim()||null,
            sala: $('eq-sala')?.value.trim()||null, instituicao: $('eq-instituicao')?.value.trim()||null,
            criticidade: calcularCriticidadeFluxograma(),
            extras_tecnico: Object.keys(extras).length ? extras : null,
          };
          await db.from('equipamentos').update(payload).eq('id', editId);
          msgForm('msg-equipamento', '✓ Equipamento atualizado!', 'green');
          setTimeout(() => location.href = 'gerir-equipamentos.html', 1000);
        };
      }
    }
  }
})();

// ===================== COLABORADORES & FUNÇÕES =====================
async function atualizarSelectColaboradores() {
  const { data } = await db.from('colaboradores').select('id, nome');
  ['pmoc-tecnico', 'os-tecnico', 'osg-tecnico'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
  });
}

async function atualizarSelectFuncoes() {
  const sel = $('colab-funcao');
  if (!sel) return;
  const { data } = await db.from('funcoes').select('id, nome');
  sel.innerHTML = '<option value="">-- Selecione uma Função --</option>';
  (data || []).forEach(f => { sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`; });
}

async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores'); if (!tbody) return;
  const { data } = await db.from('colaboradores').select('*, funcoes(nome)').order('nome', { ascending: true });
  tbody.innerHTML = (data || []).length
    ? (data || []).map(c => `<tr>
        <td><strong>${c.nome}</strong></td><td>${c.cpf || '—'}</td>
        <td>${c.funcoes?.nome || '—'}</td>
        <td><button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="td-loading">Nenhum colaborador cadastrado.</td></tr>';
}

async function excluirColaborador(id) {
  if (confirm('Remover colaborador?')) { await db.from('colaboradores').delete().eq('id', id); carregarColaboradores(); }
}

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes'); if (!tbody) return;
  const { data } = await db.from('funcoes').select('*').order('nome', { ascending: true });
  tbody.innerHTML = (data || []).length
    ? (data || []).map(f => `<tr>
        <td><strong>${f.nome}</strong></td><td>${f.nivel || '—'}</td>
        <td>R$ ${Number(f.salario || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
        <td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="td-loading">Nenhuma função cadastrada.</td></tr>';
}

async function excluirFuncao(id) {
  if (confirm('Remover função?')) { await db.from('funcoes').delete().eq('id', id); carregarFuncoes(); }
}

if ($('btn-salvar-colaborador')) {
  $('btn-salvar-colaborador').addEventListener('click', async () => {
    const nome = $('colab-nome')?.value.trim();
    const cpf  = $('colab-cpf')?.value.trim();
    if (!nome)              { msgForm('msg-colaborador', 'Nome completo é obrigatório.', 'red'); return; }
    if (!cpf)               { msgForm('msg-colaborador', 'CPF é obrigatório.', 'red'); return; }
    if (!validarCPF(cpf))   { msgForm('msg-colaborador', '❌ CPF inválido.', 'red'); return; }
    const cpfLimpo = cpf.replace(/\D/g, '');
    const { error } = await db.from('colaboradores').insert([{ nome, cpf: cpfLimpo, funcao_id: $('colab-funcao')?.value || null }]);
    if (!error) { msgForm('msg-colaborador', '✓ Técnico salvo!', 'green'); carregarColaboradores(); atualizarSelectColaboradores(); if ($('colab-nome')) $('colab-nome').value = ''; if ($('colab-cpf')) $('colab-cpf').value = ''; }
    else msgForm('msg-colaborador', 'Erro: ' + error.message, 'red');
  });
}

if ($('btn-salvar-funcao')) {
  $('btn-salvar-funcao').addEventListener('click', async () => {
    const nome = $('func-nome')?.value.trim();
    if (!nome) { msgForm('msg-funcao', 'Nome da função obrigatório.', 'red'); return; }
    const { error } = await db.from('funcoes').insert([{ nome, salario: parseFloat($('func-salario')?.value) || 0, nivel: $('func-nivel')?.value || 'Pleno' }]);
    if (!error) { msgForm('msg-funcao', '✓ Função salva!', 'green'); carregarFuncoes(); atualizarSelectFuncoes(); if ($('func-nome')) $('func-nome').value = ''; }
    else msgForm('msg-funcao', 'Erro: ' + error.message, 'red');
  });
}

// ===================== FORMULÁRIO PMOC =====================
if ($('btn-salvar-ficha')) {
  $('btn-salvar-ficha').addEventListener('click', async () => {
    const equipamento_id = $('pmoc-equipamento')?.value;
    const tecnico_id     = $('pmoc-tecnico')?.value;
    if (!equipamento_id || !tecnico_id) { msgForm('msg-ficha', 'Selecione o equipamento e o técnico.', 'red'); return; }
    msgForm('msg-ficha', 'Salvando...', 'blue');

    const freq = $('pmoc-frequencia')?.value || 'M';
    const dataInsp = $('pmoc-data')?.value || hoje();
    const obs = $('pmoc-obs')?.value.trim() || '';

    const selEq = $('pmoc-equipamento');
    const catOpt = selEq?.options[selEq.selectedIndex];
    const cat = catOpt?.dataset?.categoria || 'OUT';

    const TODOS_CAMPOS_CHECKLIST = [
      'fil_01','bio_01','bio_02','mec_01','fil_02','bio_03','ele_01','ele_02','mec_02',
      'ref_01','ref_02','ele_03','ele_04','mec_03','bio_04','ins_01',
      'ref_03','mec_04','mec_05','ele_05','ele_06','bio_05','ins_02','ins_03',
      'beb_01','beb_02','beb_03','beb_04','beb_05','beb_06','beb_07','beb_08',
      'beb_09','beb_10','beb_11','beb_12','beb_13','beb_14','beb_15',
      'clm_01','clm_02','clm_03','clm_04','clm_05','clm_06','clm_07','clm_08','clm_09',
      'clm_10','clm_11','clm_12','clm_13','clm_14','clm_15','clm_16',
      'ven_01','ven_02','ven_03','ven_04','ven_05','ven_06','ven_07','ven_08','ven_09','ven_10',
      'ger_01','ger_02','ger_03','ger_04','ger_05',
    ];
    const checklistResult = {};
    TODOS_CAMPOS_CHECKLIST.forEach(campo => {
      const sel = document.querySelector(`input[name="${campo}"]:checked`);
      if (sel) checklistResult[campo] = sel.value;
    });

    let signatureBase64 = null;
    if (canvas && ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasPixels = imageData.data.some((v, i) => i % 4 === 3 && v > 0);
      if (hasPixels) signatureBase64 = canvas.toDataURL('image/png');
    }

    const freqLabel = { M: 'Mensal', T: 'Trimestral', S: 'Semestral', A: 'Anual' }[freq] || 'Mensal';
    const obsCompleto = `[DataInspecao: ${dataInsp}]\n[Frequencia: ${freqLabel}]\n[TipoEquipamento: ${cat}]\n[Checklist: ${JSON.stringify(checklistResult)}]\n${obs}`;

    const foto_url = await uploadFoto($('pmoc-foto')?.files[0], 'pmoc', 'msg-ficha');
    const { data: colab } = await db.from('colaboradores').select('nome').eq('id', tecnico_id).single();
    const { data: { user } } = await db.auth.getUser();

    const payload = {
      equipamento_id, tecnico_nome: colab?.nome || 'Técnico',
      observacoes: obsCompleto, user_id: user?.id,
    };
    if (foto_url) payload.foto_url = foto_url;
    if (signatureBase64) payload.assinatura_digital = signatureBase64;

    const { error } = await db.from('fichas_pmoc').insert([payload]);
    if (error) { msgForm('msg-ficha', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-ficha', '✓ Laudo PMOC salvo com sucesso!', 'green');
    limparCanvasAssinatura();
    if ($('pmoc-obs')) $('pmoc-obs').value = '';
    if ($('pmoc-foto')) $('pmoc-foto').value = '';
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]').forEach(r => r.checked = false);
    await carregarHistoricoFichas();
    alternarSubAbasPMOC('hist');
  });
}

let _fichasCache = [];

async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Carregando histórico...</td></tr>';
  const { data } = await db.from('fichas_pmoc')
    .select('*, equipamentos(tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao, categoria)')
    .order('created_at', { ascending: false });

  _fichasCache = data || [];
  renderizarHistoricoFichas(_fichasCache);
}

function filtrarHistoricoFichas() {
  const tag  = ($('filtro-hist-tag')?.value  || '').toLowerCase();
  const tipo = $('filtro-hist-tipo')?.value  || '';
  const freq = $('filtro-hist-freq')?.value  || '';

  const filtrado = _fichasCache.filter(f => {
    const fTag  = (f.equipamentos?.tag || '').toLowerCase().includes(tag);
    const fTipo = !tipo || (f.observacoes || '').includes(`[TipoEquipamento: ${tipo}]`);
    const fFreq = !freq || (f.observacoes || '').includes(`[Frequencia: ${freq}]`);
    return fTag && fTipo && fFreq;
  });
  renderizarHistoricoFichas(filtrado);
}

function renderizarHistoricoFichas(data) {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Nenhum laudo encontrado.</td></tr>'; return; }

  tbody.innerHTML = data.map(f => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(f))));
    const matchData = f.observacoes?.match(/\[DataInspecao:\s*([\d-]+)\]/);
    const dataFmt = matchData ? fmtDate(matchData[1]) : fmtDate(f.created_at);
    const matchFreqHist = f.observacoes?.match(/\[Frequencia:\s*([^\]]+)\]/);
    const freq = matchFreqHist ? matchFreqHist[1] : 'Mensal';
    const freqBadgeCls = freq === 'Anual' ? 'danger' : freq === 'Semestral' ? 'semestral' : freq === 'Trimestral' ? 'andamento' : 'success';
    const matchTipo = f.observacoes?.match(/\[TipoEquipamento:\s*([^\]]+)\]/);
    const tipo = matchTipo ? matchTipo[1] : (f.equipamentos?.categoria || 'OUT');
    const tipoLabel = { AC:'❄️ A.C.', BEB:'💧 Beb.', CLIM:'🌀 Clim.', VEN:'💨 Vent.', OUT:'🔧 Geral' }[tipo] || tipo;
    const laudoID = 'L-PMOC-' + f.id.toString().slice(0,6).toUpperCase();
    return `<tr>
      <td><strong>${laudoID}</strong></td>
      <td>${dataFmt}</td>
      <td><span class="tag-badge">${f.equipamentos?.tag || '—'}</span></td>
      <td><small>${tipoLabel}</small></td>
      <td>${f.tecnico_nome}</td>
      <td><span class="tag-badge ${freqBadgeCls}">${freq}</span></td>
      <td>
        <button class="btn-primary" style="padding:4px 12px;font-size:12px;" onclick="emitirRelatorioPMOC('${b64}')">🖨️ Emitir</button>
      </td>
    </tr>`;
  }).join('');
}

// ===================== IMPRESSÃO PMOC =====================
function emitirRelatorioPMOC(b64) {
  const f = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const eq = f.equipamentos || {};
  const obs = f.observacoes || '';
  const laudoID = 'L-PMOC-' + f.id.toString().slice(0,6).toUpperCase();

  const matchData = obs.match(/\[DataInspecao:\s*([\d-]+)\]/);
  const matchFreq = obs.match(/\[Frequencia:\s*([^\]]+)\]/);
  const matchChk  = obs.match(/\[Checklist:\s*(\{[^}]+\})\]/);
  const dataFmt   = matchData ? fmtDate(matchData[1]) : fmtDate(f.created_at);
  const freq      = matchFreq ? matchFreq[1] : '—';
  let obsLimpa    = obs
    .replace(/\[DataInspecao:[^\]]+\]/g, '')
    .replace(/\[Frequencia:[^\]]+\]/g, '')
    .replace(/\[TipoEquipamento:[^\]]+\]/g, '')
    .replace(/\[Checklist:[^\]]+\]/g, '')
    .trim();

  const matchTipoImp = obs.match(/\[TipoEquipamento:\s*([^\]]+)\]/);
  const tipoEq = matchTipoImp ? matchTipoImp[1] : (f.equipamentos?.categoria || 'OUT');
  const tipoLabelImp = { AC:'❄️ Ar Condicionado / Split', BEB:'💧 Bebedouro', CLIM:'🌀 Climatizador Evaporativo', VEN:'💨 Ventilador / Exaustor', OUT:'🔧 Equipamento Geral' }[tipoEq] || 'Equipamento';

  const nomes = {
    fil_01:'[FIL-01] Filtros de Ar (G4/F7/F9) — Higienização/Substituição',
    bio_01:'[BIO-01] Bandeja de Condensados — Pastilha Sanitizante',
    bio_02:'[BIO-02] Rede de Drenagem — Desobstrução e Teste de Escoamento',
    mec_01:'[MEC-01] Conjunto Ventilação — Ruídos, Coxins e Fixadores',
    fil_02:'[FIL-02] Diferencial de Pressão de Filtros — Manômetro',
    bio_03:'[BIO-03] Serpentinas — Limpeza Química por Presão',
    ele_01:'[ELE-01] Medição de Corrente/Tensão dos Compressores',
    ele_02:'[ELE-02] Reaperto dos Bornes de Comando e Potência',
    mec_02:'[MEC-02] Lubrificação de Rolamentos e Buchas do Motoventilador',
    ref_01:'[REF-01] Verificação de Carga de Gás Refrigerante',
    ref_02:'[REF-02] Verificação de Vazamentos no Circuito Frigorífico',
    ele_03:'[ELE-03] Medição de Isolamento Elétrico (Megôhmetro)',
    ele_04:'[ELE-04] Teste dos Dispositivos de Proteção',
    mec_03:'[MEC-03] Inspeção e Substituição de Correias e Polias',
    bio_04:'[BIO-04] Coleta de Amostra de Água — Análise Microbiológica',
    ins_01:'[INS-01] Inspeção Estrutural — Suportes, Fixações e Isolamento Térmico',
    ref_03:'[REF-03] Substituição de Gás Refrigerante e Registro ART',
    mec_04:'[MEC-04] Substituição de Rolamentos, Buchas e Selos Mecânicos',
    mec_05:'[MEC-05] Limpeza e Inspeção do Compressor — Óleo e Visor',
    ele_05:'[ELE-05] Revisão de Capacitores e Contatores Desgastados',
    ele_06:'[ELE-06] Termografia Elétrica do Painel e Cabos',
    bio_05:'[BIO-05] Higienização Completa — Laudos Microbiológicos',
    ins_02:'[INS-02] Revisão Geral do PMOC — Documentação e ART',
    ins_03:'[INS-03] Análise de Desempenho — Delta T, COP e Eficiência',
    beb_01:'[BEB-01] Limpeza Externa — Gabinete, Torneiras e Bica',
    beb_02:'[BEB-02] Verificação do Sistema de Refrigeração (temperatura)',
    beb_03:'[BEB-03] Inspeção Visual de Vazamentos nas Conexões',
    beb_04:'[BEB-04] Verificação e Higienização da Bandeja Coletora',
    beb_05:'[BEB-05] Higienização Interna com Solução Sanitizante',
    beb_06:'[BEB-06] Limpeza e Verificação do Reservatório Interno',
    beb_07:'[BEB-07] Verificação de Carga de Gás / Compressor',
    beb_08:'[BEB-08] Verificação de Validade do Elemento Filtrante',
    beb_09:'[BEB-09] Substituição do Elemento Filtrante',
    beb_10:'[BEB-10] Análise Microbiológica da Água (laudo laboratorial)',
    beb_11:'[BEB-11] Verificação e Regulagem da Temperatura de Saída',
    beb_12:'[BEB-12] Aplicação de Lacre e Registro de Sanitização',
    beb_13:'[BEB-13] Revisão Completa do Sistema de Refrigeração',
    beb_14:'[BEB-14] Substituição de Vedações, O-rings e Torneiras',
    beb_15:'[BEB-15] Laudo Sanitário Anual — Documentação ANVISA',
    clm_01:'[CLM-01] Limpeza do Reservatório — Remoção de Lodo e Calcário',
    clm_02:'[CLM-02] Limpeza e Inspeção do Painel Evaporativo',
    clm_03:'[CLM-03] Verificação de Nível e Funcionamento da Boia',
    clm_04:"[CLM-04] Verificação da Bomba d\'Água — Funcionamento e Fluxo",
    clm_05:'[CLM-05] Inspeção do Ventilador Axial — Ruídos e Fixação',
    clm_06:'[CLM-06] Limpeza Química do Reservatório — Descalcificação',
    clm_07:'[CLM-07] Limpeza dos Distribuidores de Água (aspersores)',
    clm_08:'[CLM-08] Medição de Corrente do Motor e da Bomba',
    clm_09:'[CLM-09] Lubrificação de Rolamentos do Motor e da Bomba',
    clm_10:'[CLM-10] Inspeção do Painel Evaporativo — Avaliação para Substituição',
    clm_11:'[CLM-11] Análise Microbiológica da Água (Controle de Legionela)',
    clm_12:'[CLM-12] Verificação do Sistema Elétrico — Quadro e Proteções',
    clm_13:'[CLM-13] Tratamento Biocida — Produto Antiincrustante',
    clm_14:'[CLM-14] Substituição do Painel Evaporativo',
    clm_15:'[CLM-15] Revisão Geral da Bomba — Impelidor, Eixo e Vedação',
    clm_16:'[CLM-16] Laudo Técnico Anual — Relatório de Qualidade da Água',
    ven_01:'[VEN-01] Limpeza das Pás/Hélice e Grelha de Proteção',
    ven_02:'[VEN-02] Verificação de Ruídos, Vibração e Folgas Mecânicas',
    ven_03:'[VEN-03] Verificação de Fixação — Parafusos e Suportes',
    ven_04:'[VEN-04] Lubrificação dos Rolamentos/Buchas com Graxa',
    ven_05:'[VEN-05] Medição de Corrente do Motor (amperagem)',
    ven_06:'[VEN-06] Reaperto das Conexões Elétricas no Quadro',
    ven_07:'[VEN-07] Medição de Isolamento Elétrico (Megôhmetro)',
    ven_08:'[VEN-08] Análise de Vibração — Verificação de Desbalanceamento',
    ven_09:'[VEN-09] Substituição de Rolamentos e Buchas Desgastados',
    ven_10:'[VEN-10] Balanceamento Dinâmico das Pás/Hélice',
    ger_01:'[GER-01] Inspeção Visual Geral — Conservação e Integridade',
    ger_02:'[GER-02] Limpeza Geral — Remoção de Poeira e Oxidação',
    ger_03:'[GER-03] Verificação de Fixação — Suportes e Estrutura',
    ger_04:'[GER-04] Verificação Elétrica — Conexões e Proteções',
    ger_05:'[GER-05] Teste de Funcionamento e Parâmetros Operacionais',
  };

  let checklistHTML = '';
  if (matchChk) {
    try {
      const chk = JSON.parse(matchChk[1]);
      const GRUPOS_POR_TIPO = {
        AC: [
          { label: '🔧 Rotinas Mensais',     campos: ['fil_01','bio_01','bio_02','mec_01'] },
          { label: '📅 Rotinas Trimestrais',  campos: ['fil_02','bio_03','ele_01','ele_02','mec_02'] },
          { label: '📆 Rotinas Semestrais',   campos: ['ref_01','ref_02','ele_03','ele_04','mec_03','bio_04','ins_01'] },
          { label: '📋 Rotinas Anuais',       campos: ['ref_03','mec_04','mec_05','ele_05','ele_06','bio_05','ins_02','ins_03'] },
        ],
        BEB: [
          { label: '🔧 Rotinas Mensais',     campos: ['beb_01','beb_02','beb_03','beb_04'] },
          { label: '📅 Rotinas Trimestrais',  campos: ['beb_05','beb_06','beb_07','beb_08'] },
          { label: '📆 Rotinas Semestrais',   campos: ['beb_09','beb_10','beb_11','beb_12'] },
          { label: '📋 Rotinas Anuais',       campos: ['beb_13','beb_14','beb_15'] },
        ],
        CLIM: [
          { label: '🔧 Rotinas Mensais',     campos: ['clm_01','clm_02','clm_03','clm_04','clm_05'] },
          { label: '📅 Rotinas Trimestrais',  campos: ['clm_06','clm_07','clm_08','clm_09'] },
          { label: '📆 Rotinas Semestrais',   campos: ['clm_10','clm_11','clm_12','clm_13'] },
          { label: '📋 Rotinas Anuais',       campos: ['clm_14','clm_15','clm_16'] },
        ],
        VEN: [
          { label: '🔧 Rotinas Mensais',     campos: ['ven_01','ven_02','ven_03'] },
          { label: '📅 Rotinas Trimestrais',  campos: ['ven_04','ven_05','ven_06'] },
          { label: '📆 Rotinas Semestrais',   campos: ['ven_07','ven_08'] },
          { label: '📋 Rotinas Anuais',       campos: ['ven_09','ven_10'] },
        ],
        OUT: [
          { label: '🔧 Verificações Gerais',  campos: ['ger_01','ger_02','ger_03','ger_04','ger_05'] },
        ],
      };

      const grupos = GRUPOS_POR_TIPO[tipoEq] || GRUPOS_POR_TIPO['OUT'];

      let allRows = '';
      grupos.forEach(g => {
        const camposPresentes = g.campos.filter(k => k in chk);
        if (!camposPresentes.length) return;

        allRows += `<tr class="checklist-group-header"><td colspan="2" style="background:#2d3748;color:#fff;font-weight:700;font-size:11px;padding:5px 10px;letter-spacing:.3px;">${g.label}</td></tr>`;
        camposPresentes.forEach(k => {
          const v   = chk[k];
          const cls = v === 'C' ? 'check-c' : v === 'NC' ? 'check-nc' : 'check-na';
          const op  = v === 'NA' ? 'opacity:.45;' : '';
          allRows += `<tr style="${op}"><td>${nomes[k] || k}</td><td class="${cls}" style="text-align:center;width:70px;"><strong>${v}</strong></td></tr>`;
        });
      });

      checklistHTML = `<div class="laudo-section">
        <div class="laudo-section-title">3. CHECKLIST DE ROTINAS TÉCNICAS — ${freq.toUpperCase()}</div>
        <table class="checklist-print-table">
          <thead><tr><th>Rotina Técnica</th><th style="width:70px;text-align:center;">Result.</th></tr></thead>
          <tbody>${allRows}</tbody>
        </table></div>`;
    } catch(_) {}
  }

  const assinaturaHTML = f.assinatura_digital
    ? `<div style="text-align:center;margin-top:8px;"><img src="${f.assinatura_digital}" style="max-width:200px;max-height:70px;border:1px dashed #ccc;" alt="Assinatura"/></div>`
    : '';

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">MANUTENÇÃO CONCREDUR — Sistema Integrado de Gestão</div>
      <h1>FORMULÁRIO DE MANUTENÇÃO PREVENTIVA — PMOC</h1>
      <div class="doc-id">Código: ${laudoID} &nbsp;|&nbsp; ${tipoLabelImp}</div>
      <div class="doc-sub">Conforme Portaria MS nº 3.523/98 &nbsp;|&nbsp; Frequência: ${freq} &nbsp;|&nbsp; Data: ${dataFmt}</div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">1. IDENTIFICAÇÃO DO ATIVO</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">TAG / Código:</span><span class="info-value">${eq.tag||'—'}</span></div>
        <div class="info-item"><span class="info-label">Produto / Tipo:</span><span class="info-value">${eq.produto||'—'}</span></div>
        <div class="info-item"><span class="info-label">Marca:</span><span class="info-value">${eq.marca||'—'}</span></div>
        <div class="info-item"><span class="info-label">Potência:</span><span class="info-value">${eq.potencia||'—'}</span></div>
        <div class="info-item"><span class="info-label">Nº de Série:</span><span class="info-value">${eq.nr_serie||'—'}</span></div>
        <div class="info-item"><span class="info-label">Patrimônio:</span><span class="info-value">${eq.patrimonio||'—'}</span></div>
        <div class="info-item"><span class="info-label">Bloco / Edificação:</span><span class="info-value">${eq.bloco||'—'}</span></div>
        <div class="info-item"><span class="info-label">Setor:</span><span class="info-value">${eq.setor||'—'}</span></div>
        <div class="info-item"><span class="info-label">Sala:</span><span class="info-value">${eq.sala||'—'}</span></div>
        <div class="info-item"><span class="info-label">Instituição:</span><span class="info-value">${eq.instituicao||'—'}</span></div>
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">2. RESPONSÁVEL TÉCNICO</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Técnico:</span><span class="info-value"><strong>${f.tecnico_nome}</strong></span></div>
        <div class="info-item"><span class="info-label">Data da Inspeção:</span><span class="info-value">${dataFmt}</span></div>
      </div>
    </div>
    ${checklistHTML}
    ${obsLimpa ? `<div class="laudo-section">
      <div class="laudo-section-title">4. OBSERVAÇÕES TÉCNICAS</div>
      <div class="laudo-obs">${obsLimpa}</div>
    </div>` : ''}
    ${f.foto_url ? `<div class="laudo-section laudo-foto">
      <div class="laudo-section-title">5. EVIDÊNCIA FOTOGRÁFICA</div>
      <img src="${f.foto_url}" alt="Foto"/>
    </div>` : ''}
    <div class="laudo-footer">
      <div class="assinatura-box">
        ${assinaturaHTML}
        <div class="assinatura-linha" style="${f.assinatura_digital ? 'margin-top:4px;' : 'margin-top:50px;'}"></div>
        <div class="assinatura-label">Técnico Responsável: <strong>${f.tecnico_nome}</strong></div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha" style="margin-top:60px;"></div>
        <div class="assinatura-label">Supervisor / Gestor</div>
      </div>
    </div>
    <div class="laudo-rodape">Gerado em ${new Date().toLocaleString('pt-BR')} &nbsp;|&nbsp; ${laudoID}</div>
  </div>`;

  imprimir('area-laudo-impressao', html);
}

// ===================== ORDENS DE SERVIÇO — AR CONDICIONADO =====================
if ($('btn-salvar-os')) {
  $('btn-salvar-os').addEventListener('click', async () => {
    const equipamento_id    = $('os-equipamento')?.value;
    const colaborador_id    = $('os-tecnico')?.value;
    const tipo_os           = $('os-tipo')?.value;
    const status_os         = $('os-status')?.value;
    const descricao_defeito = $('os-defeito')?.value.trim();
    const laudo_tecnico     = $('os-laudo')?.value.trim();
    const idEdicao          = $('os-id-edicao')?.value;

    if (!equipamento_id || !colaborador_id || !descricao_defeito) {
      msgForm('msg-os', 'Equipamento, técnico e defeito são obrigatórios.', 'red'); return;
    }
    msgForm('msg-os', 'Gravando...', 'blue');

    const foto_url = await uploadFoto($('os-foto')?.files[0], 'os_clima', 'msg-os');
    const payload = { equipamento_id, colaborador_id, tipo_os, status_os, descricao_defeito, laudo_tecnico };
    if (foto_url) payload.foto_url = foto_url;

    let resposta;
    if (idEdicao) {
      resposta = await db.from('ordens_servico').update(payload).eq('id', idEdicao);
    } else {
      const { data: { user } } = await db.auth.getUser();
      payload.user_id = user?.id;
      resposta = await db.from('ordens_servico').insert([payload]);
    }

    if (resposta.error) { msgForm('msg-os', 'Erro: ' + resposta.error.message, 'red'); return; }
    msgForm('msg-os', idEdicao ? '✓ O.S. atualizada!' : '✓ O.S. salva!', 'green');
    resetarFormOS();
    await carregarOrdensServico();
    await carregarCentralUnificadaOS();
  });
}

function resetarFormOS() {
  ['os-defeito','os-laudo'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['os-equipamento','os-tecnico','os-foto'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('os-id-edicao')) $('os-id-edicao').value = '';
  if ($('titulo-formulario-os')) $('titulo-formulario-os').innerText = 'Abertura / Atualização de O.S. Técnica';
  if ($('btn-cancelar-edicao-os')) $('btn-cancelar-edicao-os').style.display = 'none';
}
if ($('btn-cancelar-edicao-os')) $('btn-cancelar-edicao-os').addEventListener('click', resetarFormOS);

async function carregarOrdensServico() {
  const tbody = $('tbody-os'); if (!tbody) return;
  const { data } = await db.from('ordens_servico')
    .select('id, created_at, tipo_os, status_os, descricao_defeito, laudo_tecnico, equipamento_id, colaborador_id, foto_url, equipamentos(tag), colaboradores(nome)')
    .order('created_at', { ascending: false });

  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhuma O.S. cadastrada.</td></tr>'; return; }

  tbody.innerHTML = data.map(os => {
    const numOS = 'OS-AC-' + os.id.toString().slice(0,5).toUpperCase();
    const b64   = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `<tr>
      <td><strong>${numOS}</strong></td>
      <td>${fmtDate(os.created_at)}</td>
      <td><span class="tag-badge">${os.equipamentos?.tag || '—'}</span></td>
      <td>${os.colaboradores?.nome || '—'}</td>
      <td>${os.tipo_os}</td>
      <td>${statusBadge(os.status_os)}</td>
      <td style="white-space:nowrap;">
        <button class="btn-primary" style="background:#4a5568;padding:3px 9px;font-size:12px;" onclick="emitirLaudoOS('${b64}','${numOS}')">🖨️</button>
        <button class="btn-primary" style="background:#d97706;padding:3px 9px;font-size:12px;" onclick="prepararEdicaoOS('${b64}')">✍️</button>
      </td>
    </tr>`;
  }).join('');
}

function prepararEdicaoOS(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  if ($('os-equipamento')) $('os-equipamento').value = os.equipamento_id;
  if ($('os-tecnico'))     $('os-tecnico').value     = os.colaborador_id;
  if ($('os-tipo'))        $('os-tipo').value        = os.tipo_os;
  if ($('os-status'))      $('os-status').value      = os.status_os;
  if ($('os-defeito'))     $('os-defeito').value     = os.descricao_defeito;
  if ($('os-laudo'))       $('os-laudo').value       = os.laudo_tecnico || '';
  if ($('os-id-edicao'))   $('os-id-edicao').value   = os.id;
  if ($('titulo-formulario-os')) $('titulo-formulario-os').innerText = '✍️ Editando: ' + 'OS-AC-' + os.id.toString().slice(0,5).toUpperCase();
  if ($('btn-cancelar-edicao-os')) $('btn-cancelar-edicao-os').style.display = 'inline-block';
  if ($('foco-formulario-os')) $('foco-formulario-os').scrollIntoView({ behavior: 'smooth' });
}

function emitirLaudoOS(b64, numOS) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">MANUTENÇÃO CONCREDUR — Sistema Integrado de Gestão</div>
      <h1>ORDEM DE SERVIÇO TÉCNICA — CLIMATIZAÇÃO</h1>
      <div class="doc-id">${numOS}</div>
      <div class="doc-sub">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">1. DADOS DA ORDEM</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Número O.S.:</span><span class="info-value"><strong>${numOS}</strong></span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="info-value"><strong>${os.status_os}</strong></span></div>
        <div class="info-item"><span class="info-label">Tipo:</span><span class="info-value">${os.tipo_os}</span></div>
        <div class="info-item"><span class="info-label">Data:</span><span class="info-value">${fmtDate(os.created_at)}</span></div>
        <div class="info-item"><span class="info-label">Equipamento (TAG):</span><span class="info-value">${os.equipamentos?.tag||'—'}</span></div>
        <div class="info-item"><span class="info-label">Técnico:</span><span class="info-value">${os.colaboradores?.nome||'—'}</span></div>
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">2. DEFEITO RELATADO</div>
      <div class="laudo-obs">${os.descricao_defeito||'—'}</div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">3. LAUDO TÉCNICO</div>
      <div class="laudo-obs">${os.laudo_tecnico||'Em andamento.'}</div>
    </div>
  </div>`;
  imprimir('area-os-impressao', html);
}

// ===================== O.S. GERAL (FACILITIES) =====================
if ($('btn-salvar-osg')) {
  $('btn-salvar-osg').addEventListener('click', async () => {
    const setor = $('osg-setor')?.value.trim();
    const servico_requisitado = $('osg-requisitado')?.value.trim();
    const falha_relatada = $('osg-falha')?.value.trim();
    if (!setor || !servico_requisitado || !falha_relatada) {
      msgForm('msg-osg', 'Preencha os campos obrigatórios (*).', 'red'); return;
    }
    msgForm('msg-osg', 'Processando...', 'blue');

    const tipo_manutencao = document.querySelector('input[name="osg-tipo"]:checked')?.value || 'Preventiva';
    const areas_servico   = [...document.querySelectorAll('input[name="osg-area"]:checked')].map(c => c.value);
    const status_os       = $('osg-status')?.value;
    const idEdicaoG       = $('osg-id-edicao')?.value;

    const foto_url = await uploadFoto($('osg-foto')?.files[0], 'os_facilities', 'msg-osg');
    const payload  = {
      setor, servico_requisitado, falha_relatada, tipo_manutencao, areas_servico, status_os,
      equipamento:  $('osg-equipamento')?.value.trim()  || null,
      realizado_por:$('osg-tecnico')?.value             || null,
    };
    if (foto_url) payload.foto_url = foto_url;

    let resposta;
    if (idEdicaoG) {
      resposta = await db.from('ordens_servico_geral').update(payload).eq('id', idEdicaoG);
    } else {
      const { data: { user } } = await db.auth.getUser();
      payload.user_id = user?.id;
      payload.numero_os = 'OSG-' + Date.now().toString().slice(-6);
      resposta = await db.from('ordens_servico_geral').insert([payload]);
    }
    if (resposta.error) { msgForm('msg-osg', 'Erro: ' + resposta.error.message, 'red'); return; }
    msgForm('msg-osg', idEdicaoG ? '✓ O.S. atualizada!' : '✓ O.S. Geral salva!', 'green');
    resetarFormOSG();
    await carregarOSGeral();
    await carregarCentralUnificadaOS();
  });
}

function resetarFormOSG() {
  ['osg-requisitado','osg-setor','osg-falha','osg-equipamento'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['osg-id-edicao','osg-foto'].forEach(id => { if ($(id)) $(id).value = ''; });
  document.querySelectorAll('input[name="osg-area"]').forEach(c => c.checked = false);
}
if ($('btn-cancelar-edicao-osg')) $('btn-cancelar-edicao-osg').addEventListener('click', resetarFormOSG);

async function carregarOSGeral() {
  const tbody = $('tbody-osg'); if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Nenhuma O.S. Geral cadastrada.</td></tr>'; return; }
  tbody.innerHTML = data.map(os => {
    const numOS = os.numero_os || 'OSG-' + os.id.toString().slice(0,5).toUpperCase();
    const b64   = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `<tr>
      <td><strong>${numOS}</strong></td>
      <td>${fmtDate(os.data_chamada || os.created_at)}</td>
      <td>${os.setor}</td>
      <td><small>${(os.areas_servico || []).join(', ') || '—'}</small></td>
      <td>${statusBadge(os.status_os)}</td>
      <td style="white-space:nowrap;">
        <button class="btn-primary" style="padding:3px 9px;font-size:12px;" onclick="imprimirOSGeral('${b64}')">🖨️</button>
        <button class="btn-primary" style="background:#d97706;padding:3px 9px;font-size:12px;" onclick="prepararEdicaoOSG('${b64}')">✍️</button>
        <button class="btn-excluir" onclick="excluirOSGeral('${os.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function prepararEdicaoOSG(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  if ($('osg-requisitado')) $('osg-requisitado').value = os.servico_requisitado;
  if ($('osg-setor'))       $('osg-setor').value       = os.setor;
  if ($('osg-falha'))       $('osg-falha').value       = os.falha_relatada;
  if ($('osg-equipamento')) $('osg-equipamento').value = os.equipamento;
  if ($('osg-tecnico'))     $('osg-tecnico').value     = os.realizado_por || '';
  if ($('osg-status'))      $('osg-status').value      = os.status_os;
  if ($('osg-id-edicao'))   $('osg-id-edicao').value   = os.id;
  document.querySelectorAll('input[name="osg-area"]').forEach(chk => { chk.checked = (os.areas_servico||[]).includes(chk.value); });
  if ($('foco-formulario-osg')) $('foco-formulario-osg').scrollIntoView({ behavior: 'smooth' });
}

function imprimirOSGeral(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const numOS = os.numero_os || 'OSG-' + os.id.toString().slice(0,5).toUpperCase();
  const checkTipo = (v) => os.tipo_manutencao === v ? '(X)' : '(  )';
  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">MANUTENÇÃO CONCREDUR — Sistema Integrado de Gestão</div>
      <h1>ORDEM DE SERVIÇO — FACILITIES / GERAL</h1>
      <div class="doc-id">Nº Protocolo: ${numOS}</div>
      <div class="doc-sub">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">1. DADOS DA SOLICITAÇÃO</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Nº O.S.:</span><span class="info-value"><strong>${numOS}</strong></span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="info-value"><strong>${os.status_os}</strong></span></div>
        <div class="info-item"><span class="info-label">Setor Requisitante:</span><span class="info-value">${os.setor}</span></div>
        <div class="info-item"><span class="info-label">Serviço:</span><span class="info-value">${os.servico_requisitado}</span></div>
        <div class="info-item"><span class="info-label">Equipamento:</span><span class="info-value">${os.equipamento||'—'}</span></div>
        <div class="info-item"><span class="info-label">Técnico:</span><span class="info-value">${os.realizado_por||'Não atribuído'}</span></div>
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">2. TIPO E ÁREA</div>
      <p style="font-size:12px;margin-bottom:8px;">
        ${checkTipo('Corretiva')} Corretiva &nbsp;&nbsp;
        ${checkTipo('Preventiva')} Preventiva &nbsp;&nbsp;
        ${checkTipo('Reforma')} Reforma
      </p>
      <p style="font-size:12px;"><strong>Especialidades:</strong> ${(os.areas_servico||[]).join(', ')||'—'}</p>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">3. FALHA RELATADA</div>
      <div class="laudo-obs">${os.falha_relatada||'—'}</div>
    </div>
  </div>`;
  imprimir('area-osg-impressao', html);
}

async function excluirOSGeral(id) {
  if (!confirm('Confirma exclusão desta O.S.?')) return;
  await db.from('ordens_servico_geral').delete().eq('id', id);
  await carregarOSGeral();
  await carregarCentralUnificadaOS();
}

// ===================== CENTRAL UNIFICADA =====================
async function carregarCentralUnificadaOS() {
  const tbody = $('tbody-central-unificada-os'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Consolidando registros...</td></tr>';

  const { data: view, error } = await db.from('relatorio_unificado_os').select('*').order('created_at', { ascending: false });
  if (!error && view && view.length) {
    tbody.innerHTML = view.map(doc => {
      const pre = doc.modulo_origem === 'Ar Condicionado' ? 'OS-AC-' : 'OS-GEN-';
      return `<tr>
        <td><strong>${pre + doc.id.toString().slice(0,5).toUpperCase()}</strong></td>
        <td>${fmtDate(doc.created_at)}</td>
        <td>${doc.modulo_origem}</td>
        <td><small>${doc.categoria_servico||'—'}</small></td>
        <td><span style="max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.resumo_solicitacao||'—'}</span></td>
        <td>${statusBadge(doc.status_os)}</td>
      </tr>`;
    }).join(''); return;
  }

  const [{ data: ac }, { data: g }] = await Promise.all([
    db.from('ordens_servico').select('id,created_at,tipo_os,status_os,descricao_defeito').order('created_at',{ascending:false}).limit(40),
    db.from('ordens_servico_geral').select('id,created_at,tipo_manutencao,status_os,servico_requisitado,numero_os').order('created_at',{ascending:false}).limit(40),
  ]);
  const linhas = [
    ...(ac||[]).map(d => ({ id:'OS-AC-'+d.id.toString().slice(0,5).toUpperCase(), data:d.created_at, mod:'Refrigeração', cat:d.tipo_os, res:d.descricao_defeito, st:d.status_os })),
    ...(g||[]).map(d  => ({ id:d.numero_os||'OSG-'+d.id.toString().slice(0,5).toUpperCase(), data:d.created_at, mod:'Facilities', cat:d.tipo_manutencao, res:d.servico_requisitado, st:d.status_os })),
  ].sort((a,b) => new Date(b.data) - new Date(a.data));

  tbody.innerHTML = linhas.length
    ? lines.map(l => `<tr>
        <td><strong>${l.id}</strong></td><td>${fmtDate(l.data)}</td>
        <td>${l.mod}</td><td><small>${l.cat||'—'}</small></td>
        <td><span style="max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(l.res||'—').slice(0,60)}</span></td>
        <td>${statusBadge(l.st)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="td-loading">Nenhum registro encontrado.</td></tr>';
}

// ===================== DASHBOARD — GRÁFICOS & KPIs =====================
async function renderizarGraficosDashboard() {
  const [
    { count: catv }, { count: cfch },
    { count: cab }, { count: cfc }
  ] = await Promise.all([
    db.from('equipamentos').select('*',{count:'exact',head:true}),
    db.from('fichas_pmoc').select('*',{count:'exact',head:true}),
    db.from('ordens_servico').select('*',{count:'exact',head:true}).neq('status_os','Concluída'),
    db.from('ordens_servico').select('*',{count:'exact',head:true}).eq('status_os','Concluída'),
  ]);
  if ($('dash-txt-ativos'))    $('dash-txt-ativos').innerText    = catv ?? 0;
  if ($('dash-txt-fichas'))    $('dash-txt-fichas').innerText    = cfch ?? 0;
  if ($('dash-txt-os-abertas'))  $('dash-txt-os-abertas').innerText  = cab  ?? 0;
  if ($('dash-txt-os-fechadas')) $('dash-txt-os-fechadas').innerText = cfc  ?? 0;

  const { data: dadosOS } = await db.from('ordens_servico').select('status_os');
  const contOS = {}; (dadosOS||[]).forEach(r => { contOS[r.status_os] = (contOS[r.status_os]||0)+1; });
  const ctxOS = $('chartStatusOS');
  if (ctxOS) {
    if (chartOS) chartOS.destroy();
    chartOS = new Chart(ctxOS.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(contOS).length ? Object.keys(contOS) : ['Sem dados'],
        datasets: [{ label: 'O.S.', data: Object.values(contOS).length ? Object.values(contOS) : [0], backgroundColor: ['#f59e0b','#3b82f6','#10b981'], borderRadius: 5 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f1f5f9'}}, x:{grid:{display:false}} } }
    });
  }

  const { data: dadosCrit } = await db.from('equipamentos').select('criticidade');
  const contCrit = {}; (dadosCrit||[]).forEach(r => { const k=r.criticidade||'Média'; contCrit[k]=(contCrit[k]||0)+1; });
  const ctxCrit = $('chartCriticidade');
  if (ctxCrit) {
    if (chartCrit) chartCrit.destroy();
    chartCrit = new Chart(ctxCrit.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(contCrit).length ? Object.keys(contCrit).map(k=>'Classe '+k) : ['Nenhum ativo'],
        datasets: [{ data: Object.values(contCrit).length ? Object.values(contCrit) : [1], backgroundColor:['#ef4444','#3b82f6','#10b981'], borderWidth:2, borderColor:'#fff' }]
      },
      options: { responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12}}} }
    });
  }

  const { data: dadosOSG } = await db.from('ordens_servico_geral').select('status_os');
  const contOSG = {}; (dadosOSG||[]).forEach(r => { contOSG[r.status_os]=(contOSG[r.status_os]||0)+1; });
  const ctxOSG = $('chartStatusOSG');
  if (chartOSG) chartOSG.destroy();
  chartOSG = new Chart(ctxOSG.getContext('2d'), {
    type: 'bar',
    data: {
      labels: Object.keys(contOSG).length ? Object.keys(contOSG) : ['Sem dados'],
      datasets: [{ label: 'O.S. Facilities', data: Object.values(contOSG).length ? Object.values(contOSG) : [0], backgroundColor:['#f59e0b','#8b5cf6','#10b981'], borderRadius:5 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f1f5f9'}}, x:{grid:{display:false}} } }
  });
}

// ===================== VALIDAÇÃO CPF =====================
function validarCPF(cpf) {
  const s = cpf.replace(/\D/g, '');
  if (s.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(s[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(s[10])) return false;

  return true;
}

function formatarCPF(valor) {
  return valor.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

document.querySelectorAll('.input-cpf').forEach(el => {
  el.addEventListener('input', (e) => { e.target.value = formatarCPF(e.target.value); });
});

// ===================== GESTÃO DE USUÁRIOS — CONVITE HÍBRIDO =====================
if ($('btn-admin-salvar-usuario')) {
  $('btn-admin-salvar-usuario').addEventListener('click', async () => {
    const email  = $('adm-user-email')?.value.trim();
    const cpf    = $('adm-user-cpf')?.value.trim();
    const role   = $('adm-user-role')?.value;
    const nome   = $('adm-user-nome')?.value.trim();

    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'none';

    if (!email || !nome) { msgForm('msg-admin-usuario', 'Nome e E-mail são obrigatórios.', 'red'); return; }
    if (!cpf || !validarCPF(cpf)) { msgForm('msg-admin-usuario', '❌ CPF inválido.', 'red'); return; }

    msgForm('msg-admin-usuario', '📨 Cadastrando e gerando credenciais temporárias...', 'blue');

    const novoId = crypto.randomUUID();
    const cpfLimpo = cpf.replace(/\D/g, '');

    const { error: dbError } = await db.from('profiles').insert([{
      id: novoId,
      email,
      nome,
      role,
      cpf: cpfLimpo,
      status: 'pendente'
    }]);

    if (dbError) {
      msgForm('msg-admin-usuario', '❌ Erro ao registrar perfil no banco: ' + dbError.message, 'red');
      return;
    }

    const linkAtivacaoNativo = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar`;
    
    if ($('adm-link-gerado') && $('wrapper-link-ativacao')) {
      $('lbl-link-contexto').innerText = "🔗 Link de Ativação Gerado (Novo Cadastro):";
      $('desc-link-contexto').innerText = "Copie o link abaixo e mande para o técnico via WhatsApp:";
      $('adm-link-gerado').value = linkAtivacaoNativo;
      $('wrapper-link-ativacao').style.display = 'block'; 
    }

    // Dispara em background
    await db.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/index.html` });
    msgForm('msg-admin-usuario', `✅ Operador cadastrado! Link de ativação disponível abaixo.`, 'green');
    
    if ($('adm-user-cpf')) $('adm-user-cpf').value = '';
    if ($('adm-user-nome')) $('adm-user-nome').value = '';
    const icon = $('cpf-status-icon'); if (icon) icon.textContent = '';
    
    await carregarUsuariosSistema();
  });
}

async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Carregando operadores...</td></tr>';

  const { data: { user: userAtual } } = await db.auth.getUser();

  let lista = [];
  const { data: perfis, error } = await db.from('profiles').select('*').order('email', { ascending: true });

  if (!error && perfis) lista = perfis;

  const adminNaLista = lista.some(u => u.email === userAtual?.email);
  if (userAtual?.email && !adminNaLista) {
    lista = [{ id: userAtual.id, email: userAtual.email, role: 'admin', nome: 'Administrador', cpf: null, status: 'ativo', _isCurrentUser: true }, ...lista];
  } else if (userAtual?.email) {
    lista = lista.map(u => u.email === userAtual.email ? { ...u, _isCurrentUser: true } : u);
  }

  if (!lista.length) { tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Nenhum perfil cadastrado.</td></tr>'; return; }

  const roleBadge = {
    admin:   '<span class="tag-badge danger">🛡️ Admin</span>',
    master:  '<span class="tag-badge warning">👨‍💻 Master</span>',
    tecnico: '<span class="tag-badge">🔬 Técnico</span>',
    auditor: '<span class="tag-badge" style="background:#f3e8ff;color:#7c3aed;">👁️ Auditor</span>',
  };
  const statusBadgeUser = {
    ativo:    '<span class="tag-badge success">● Ativo</span>',
    pendente: '<span class="tag-badge warning">⏳ Aguardando convite</span>',
  };

  tbody.innerHTML = lista.map(u => {
    const isVoce = !!u._isCurrentUser;
    const cpfFmt = u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—';
    return `<tr${isVoce ? ' style="background:#f0f7ff;"' : ''}>
      <td><strong>${u.nome || u.email}</strong>${isVoce ? '<span class="tag-badge" style="background:#dbeafe;color:#1e40af;margin-left:6px;font-size:10px;">Você</span>' : ''}<br><small style="color:#a0aec0;">${u.email}</small></td>
      <td>${cpfFmt}</td>
      <td>${roleBadge[u.role] || `<span>${u.role || '—'}</span>`}</td>
      <td>${statusBadgeUser[u.status] || statusBadgeUser['ativo']}</td>
      <td>
        ${isVoce
          ? '<span style="color:#a0aec0;font-size:12px;">—</span>'
          : `<button class="btn-excluir" onclick="excluirPerfil('${u.id}','${u.email}')">✕ Revogar</button>
             ${u.status === 'pendente' ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-left:4px;background:#d97706;border-color:#d97706;" onclick="reenviarConvite('${u.email}')">↺ Reenviar</button>` : ''}`
        }
      </td>
    </tr>`;
  }).join('');
}

async function excluirPerfil(id, email) {
  if (!confirm(`Revogar acesso de "${email}"?`)) return;
  await db.from('profiles').delete().eq('id', id);
  await carregarUsuariosSistema();
}

// RECUPERAÇÃO E GERAÇÃO OPERACIONAL DE LINKS NA TELA (ALTERAÇÃO ATUAL)
async function reenviarConvite(email) {
  if ($('wrapper-link-ativacao') && $('adm-link-gerado')) {
    // Monta o link na hora para o administrador copiar
    const linkRecuperado = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar`;
    
    $('lbl-link-contexto').innerText = `🔗 Link de Reenvio Recuperado para: ${email}`;
    $('desc-link-contexto').innerText = "O e-mail foi enfileirado no servidor. Copie o token de contingência abaixo para envio imediato via WhatsApp:";
    $('adm-link-gerado').value = linkRecuperado;
    $('wrapper-link-ativacao').style.display = 'block';
    
    // Rola a tela de forma suave até a caixa do link para facilitar a visualização
    $('wrapper-link-ativacao').scrollIntoView({ behavior: 'smooth' });
  }

  // Aciona o disparo de e-mail opcional em background para manter a compatibilidade
  await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/index.html' });
}

// ===================== SUB-ABAS CONTROLLERS =====================
function alternarSubAbasPMOC(modo) {
  if ($('sub-pmoc-form'))      $('sub-pmoc-form').style.display      = modo === 'form' ? 'block' : 'none';
  if ($('sub-pmoc-historico')) $('sub-pmoc-historico').style.display = modo === 'hist' ? 'block' : 'none';
  if (modo === 'hist') carregarHistoricoFichas();
}
function alternarSubAbasOS(modo) {
  if ($('sub-os-ac'))      $('sub-os-ac').style.display      = modo === 'ac'      ? 'block' : 'none';
  if ($('sub-os-fac'))     $('sub-os-fac').style.display     = modo === 'fac'     ? 'block' : 'none';
  if ($('sub-os-central')) $('sub-os-central').style.display = modo === 'central' ? 'block' : 'none';
  if (modo === 'central') carregarCentralUnificadaOS();
}
function alternarSubAbasRH(modo) {
  if ($('sub-rh-usuarios')) $('sub-rh-usuarios').style.display = modo === 'usuarios' ? 'block' : 'none';
  if ($('sub-rh-colab'))    $('sub-rh-colab').style.display    = modo === 'colab'    ? 'block' : 'none';
  if ($('sub-rh-cargo'))    $('sub-rh-cargo').style.display    = modo === 'cargo'    ? 'block' : 'none';
}

// ===================== MOTOR UNIVERSAL DE IMPRESSÃO =====================
function imprimir(areaId, html) {
  document.querySelectorAll('.print-only').forEach(el => { el.innerHTML = ''; });
  const area = $(areaId);
  if (!area) return;
  area.innerHTML = html;
  window.print();
  const limpar = () => { area.innerHTML = ''; window.removeEventListener('afterprint', limpar); };
  window.addEventListener('afterprint', limpar);
}
