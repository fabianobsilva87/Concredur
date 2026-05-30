// ===================== SUPABASE =====================
const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== INSTÂNCIAS DE GRÁFICOS =====================
let chartOS = null, chartCrit = null, chartOSG = null;

// ===================== UTILITÁRIOS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

async function uploadFoto(file, pasta) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const nome = `${pasta}/foto_${Date.now()}.${ext}`;
  const { data } = await db.storage.from('fotos-pmoc').upload(nome, file);
  return data ? db.storage.from('fotos-pmoc').getPublicUrl(nome).data.publicUrl : null;
}

// ===================== SESSÃO E LOGIN =====================
db.auth.getSession().then(({ data }) => {
  if (data.session) mostrarApp();
});

$('btn-login').addEventListener('click', async () => {
  const msg = $('mensagem');
  msg.style.color = '#718096';
  msg.innerText = 'Verificando acesso...';
  const { error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  if (error) {
    msg.style.color = '#dc2626';
    msg.innerText = 'Erro: ' + error.message;
  } else {
    msg.innerText = '';
    mostrarApp();
  }
});

$('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
  $('app-box').style.display = 'none';
  $('login-box').style.display = 'flex';
  $('email').value = '';
  $('password').value = '';
});

// ===================== MOSTRAR APP =====================
async function mostrarApp() {
  $('login-box').style.display = 'none';
  $('app-box').style.display = 'flex';

  const { data: { user } } = await db.auth.getUser();
  if (user) {
    $('user-display-email').innerText = user.email;
    verificarAdmin(user.email);
  }

  // Datas padrão
  if ($('pmoc-data')) $('pmoc-data').value = hoje();
  if ($('osg-data-chamada')) $('osg-data-chamada').value = hoje();

  // Carregar tudo
  carregarEquipamentos();
  atualizarSelectEquipamentos();
  atualizarSelectColaboradores();
  atualizarSelectFuncoes();
  carregarHistoricoFichas();
  carregarOrdensServico();
  carregarOSGeral();
  carregarCentralUnificadaOS();
  carregarFuncoes();
  carregarColaboradores();
  toggleItemsPorFrequencia();
  renderizarGraficosDashboard();
}

// ===================== ADMIN =====================
function verificarAdmin(email) {
  const e = email.toLowerCase().trim();
  const isAdmin = e === 'fabianob.silva87@gmail.com' || e.includes('admin') || e.includes('master');
  $('label-admin').style.display = isAdmin ? 'block' : 'none';
  $('nav-usuarios').style.display = isAdmin ? 'flex' : 'none';
  if (isAdmin) carregarUsuariosSistema();
}

// ===================== DASHBOARD — SEM DEPENDÊNCIA DE VIEWS =====================
async function renderizarGraficosDashboard() {
  // KPIs
  const [
    { count: countAtivos },
    { count: countFichas },
    { count: countAbertas },
    { count: countFechadas }
  ] = await Promise.all([
    db.from('equipamentos').select('*', { count: 'exact', head: true }),
    db.from('fichas_pmoc').select('*', { count: 'exact', head: true }),
    db.from('ordens_servico').select('*', { count: 'exact', head: true }).neq('status_os', 'Concluída'),
    db.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status_os', 'Concluída'),
  ]);

  $('dash-txt-ativos').innerText   = countAtivos   ?? 0;
  $('dash-txt-fichas').innerText   = countFichas   ?? 0;
  $('dash-txt-os-abertas').innerText  = countAbertas  ?? 0;
  $('dash-txt-os-fechadas').innerText = countFechadas ?? 0;

  // ---- Gráfico 1: Status O.S. Ar Condicionado ----
  const { data: dadosOS } = await db.from('ordens_servico').select('status_os');
  const contStatus = {};
  (dadosOS || []).forEach(r => { contStatus[r.status_os] = (contStatus[r.status_os] || 0) + 1; });
  const labOS = Object.keys(contStatus);
  const valOS = Object.values(contStatus);

  if (chartOS) chartOS.destroy();
  chartOS = new Chart($('chartStatusOS').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labOS.length ? labOS : ['Sem dados'],
      datasets: [{
        label: 'Qtd. O.S.',
        data: valOS.length ? valOS : [0],
        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1'],
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ---- Gráfico 2: Criticidade ----
  const { data: dadosCrit } = await db.from('equipamentos').select('criticidade');
  const contCrit = {};
  (dadosCrit || []).forEach(r => { const k = r.criticidade || 'Média'; contCrit[k] = (contCrit[k] || 0) + 1; });
  const labCrit = Object.keys(contCrit).map(k => 'Classe ' + k);
  const valCrit = Object.values(contCrit);

  if (chartCrit) chartCrit.destroy();
  chartCrit = new Chart($('chartCriticidade').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labCrit.length ? labCrit : ['Nenhum ativo'],
      datasets: [{
        data: valCrit.length ? valCrit : [1],
        backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } }
    }
  });

  // ---- Gráfico 3: Status O.S. Geral ----
  const { data: dadosOSG } = await db.from('ordens_servico_geral').select('status_os');
  const contOSG = {};
  (dadosOSG || []).forEach(r => { contOSG[r.status_os] = (contOSG[r.status_os] || 0) + 1; });
  const labOSG = Object.keys(contOSG);
  const valOSG = Object.values(contOSG);

  if (chartOSG) chartOSG.destroy();
  chartOSG = new Chart($('chartStatusOSG').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labOSG.length ? labOSG : ['Sem dados'],
      datasets: [{
        label: 'Qtd. O.S. Geral',
        data: valOSG.length ? valOSG : [0],
        backgroundColor: ['#f59e0b', '#8b5cf6', '#10b981', '#ec4899'],
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ---- Atividades recentes ----
  const { data: atv } = await db.from('ordens_servico')
    .select('created_at, status_os, descricao_defeito, equipamentos(tag)')
    .order('created_at', { ascending: false }).limit(5);

  const container = $('dash-atividades');
  if (!atv || !atv.length) {
    container.innerHTML = '<p style="color:#a0aec0;font-size:13px;">Nenhuma atividade recente.</p>';
    return;
  }
  container.innerHTML = atv.map(a => {
    const cls = a.status_os === 'Concluída' ? 'ok' : a.status_os === 'Em Andamento' ? '' : 'warn';
    return `<div class="dash-atividade-item ${cls}">
      <span>🛠️</span>
      <span><strong>${a.equipamentos?.tag || '—'}</strong> — ${(a.descricao_defeito || '').slice(0, 45)}...</span>
      <span style="margin-left:auto;white-space:nowrap;font-size:11px;color:#a0aec0;">${fmtDate(a.created_at)}</span>
    </div>`;
  }).join('');
}

// ===================== CRITICIDADE FLUXOGRAMA =====================
function calcularCriticidadeFluxograma() {
  const interrupcao = $('crit-interrupcao').value;
  const seguranca   = $('crit-seguranca').value;
  const operacao    = $('crit-operacao').value;
  const reserva     = $('crit-reserva').value;

  let resultado;
  if (interrupcao === 'sim' || seguranca === 'sim') {
    resultado = reserva === 'nao' ? 'Alta (A)' : 'Média (B)';
  } else {
    if (operacao === 'sim') {
      resultado = reserva === 'nao' ? 'Média (B)' : 'Baixa (C)';
    } else {
      resultado = 'Baixa (C)';
    }
  }

  $('label-criticidade-calculada').innerText = 'Classe ' + resultado;
  return resultado.split(' ')[0];
}

// ===================== TOGGLE CHECKLIST PMOC =====================
function toggleItemsPorFrequencia() {
  const freq = $('pmoc-frequencia')?.value;
  document.querySelectorAll('.freq-item-t').forEach(el => {
    el.style.display = freq === 'T' ? '' : 'none';
    if (freq !== 'T') el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
  });
}

// ===================== EQUIPAMENTOS =====================
$('btn-salvar').addEventListener('click', async () => {
  const tag = $('eq-tag').value.trim();
  if (!tag) { msgForm('msg-equipamento', 'TAG obrigatória.', 'red'); return; }

  const criticidade = calcularCriticidadeFluxograma();
  const payload = {
    tag,
    marca:       $('eq-marca').value.trim(),
    potencia:    $('eq-potencia').value.trim(),
    nr_serie:    $('eq-serie').value.trim(),
    patrimonio:  $('eq-patrimonio').value.trim(),
    produto:     $('eq-produto').value.trim(),
    bloco:       $('eq-bloco').value.trim(),
    setor:       $('eq-setor').value.trim(),
    sala:        $('eq-sala').value.trim(),
    instituicao: $('eq-instituicao').value.trim(),
    validade:    $('eq-validade').value.trim(),
    criticidade,
  };

  msgForm('msg-equipamento', 'Salvando...', 'blue');
  const { error } = await db.from('equipamentos').insert([payload]);
  if (error) {
    msgForm('msg-equipamento', 'Erro: ' + error.message, 'red');
  } else {
    msgForm('msg-equipamento', 'Equipamento salvo com sucesso!', 'green');
    $('btn-limpar').click();
    carregarEquipamentos();
  }
});

$('btn-limpar').addEventListener('click', () => {
  ['eq-tag','eq-marca','eq-potencia','eq-serie','eq-patrimonio','eq-produto',
   'eq-bloco','eq-setor','eq-sala','eq-instituicao','eq-validade'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('label-criticidade-calculada').innerText = 'Classe Média (B)';
});

async function carregarEquipamentos() {
  const tbody = $('tbody-equipamentos');
  if (!tbody) return;
  const { data } = await db.from('equipamentos').select('*').order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Nenhum equipamento cadastrado.</td></tr>';
    atualizarSelectEquipamentos(); return;
  }

  tbody.innerHTML = data.map(eq => `
    <tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || 'N/A'}</strong><br><small style="color:#a0aec0">${eq.marca || ''}</small></td>
      <td>${eq.bloco || '—'} / ${eq.setor || '—'}<br><small style="color:#a0aec0">${eq.sala || ''}</small></td>
      <td><span class="tag-badge" style="background:#ebf4ff;color:#2b6cb0">${eq.criticidade || 'Média'}</span></td>
      <td><button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕ Excluir</button></td>
    </tr>
  `).join('');
  atualizarSelectEquipamentos();
}

async function excluirEquipamento(id) {
  if (!confirm('Confirma exclusão deste equipamento?')) return;
  await db.from('equipamentos').delete().eq('id', id);
  carregarEquipamentos();
}

async function atualizarSelectEquipamentos() {
  const { data } = await db.from('equipamentos').select('id, tag, marca, produto');
  const sels = ['pmoc-equipamento', 'os-equipamento'].map($).filter(Boolean);
  sels.forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Ativo (Tag) --</option>';
    (data || []).forEach(eq => {
      const o = document.createElement('option');
      o.value = eq.id;
      o.textContent = `${eq.tag} — ${eq.produto || eq.marca || ''}`;
      sel.appendChild(o);
    });
  });
}

// ===================== COLABORADORES =====================
async function atualizarSelectColaboradores() {
  const { data } = await db.from('colaboradores').select('id, nome');
  const sels = ['pmoc-tecnico', 'os-tecnico', 'osg-tecnico'].map($).filter(Boolean);
  sels.forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome;
      sel.appendChild(o);
    });
  });
}

async function atualizarSelectFuncoes() {
  const { data } = await db.from('funcoes').select('id, nome');
  const sel = $('colab-funcao');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Selecione uma Função --</option>';
  (data || []).forEach(f => {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.nome;
    sel.appendChild(o);
  });
}

async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores');
  if (!tbody) return;
  const { data } = await db.from('colaboradores')
    .select('*, funcoes(nome)').order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="td-loading">Nenhum colaborador cadastrado.</td></tr>'; return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.cpf || '—'}</td>
      <td>${c.funcoes?.nome || '—'}</td>
      <td>${fmtDate(c.data_contratacao)}</td>
      <td><button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button></td>
    </tr>
  `).join('');
}

async function excluirColaborador(id) {
  if (!confirm('Confirma exclusão?')) return;
  await db.from('colaboradores').delete().eq('id', id);
  carregarColaboradores();
}

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes');
  if (!tbody) return;
  const { data } = await db.from('funcoes').select('*').order('created_at', { ascending: false });
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Nenhuma função cadastrada.</td></tr>'; return;
  }
  tbody.innerHTML = data.map(f => `
    <tr>
      <td><strong>${f.nome}</strong></td>
      <td>${f.nivel || '—'}</td>
      <td>R$ ${Number(f.salario || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
      <td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td>
    </tr>
  `).join('');
}

async function excluirFuncao(id) {
  if (!confirm('Confirma exclusão?')) return;
  await db.from('funcoes').delete().eq('id', id);
  carregarFuncoes();
}

// ===================== RH — FUNÇÕES =====================
$('btn-salvar-funcao').addEventListener('click', async () => {
  const nome = $('func-nome').value.trim();
  const salario = parseFloat($('func-salario').value);
  const nivel = $('func-nivel').value;
  if (!nome) { msgForm('msg-funcao', 'Informe o nome da função.', 'red'); return; }
  const { error } = await db.from('funcoes').insert([{ nome, salario: isNaN(salario) ? 0 : salario, nivel }]);
  if (!error) {
    msgForm('msg-funcao', 'Função salva!', 'green');
    $('func-nome').value = ''; $('func-salario').value = '';
    atualizarSelectFuncoes(); carregarFuncoes();
  } else {
    msgForm('msg-funcao', 'Erro: ' + error.message, 'red');
  }
});

// ===================== RH — COLABORADORES =====================
$('btn-salvar-colaborador').addEventListener('click', async () => {
  const nome = $('colab-nome').value.trim();
  const cpf  = $('colab-cpf').value.trim();
  const funcao_id = $('colab-funcao').value;
  if (!nome || !cpf) { msgForm('msg-colaborador', 'Nome e CPF são obrigatórios.', 'red'); return; }

  const payload = {
    nome, cpf, funcao_id: funcao_id || null,
    data_nascimento:  $('colab-nascimento').value  || null,
    data_contratacao: $('colab-contratacao').value || null,
    data_promocao:    $('colab-promocao').value    || null,
  };
  const { error } = await db.from('colaboradores').insert([payload]);
  if (!error) {
    msgForm('msg-colaborador', 'Colaborador salvo!', 'green');
    ['colab-nome','colab-cpf'].forEach(id => $(id).value = '');
    atualizarSelectColaboradores(); carregarColaboradores();
  } else {
    msgForm('msg-colaborador', 'Erro: ' + error.message, 'red');
  }
});

// ===================== FORMULÁRIO PMOC =====================
$('btn-salvar-ficha').addEventListener('click', async () => {
  const equipamento_id = $('pmoc-equipamento').value;
  const tecnico_id     = $('pmoc-tecnico').value;
  const data_inspecao  = $('pmoc-data').value;
  const freq           = $('pmoc-frequencia').value;
  const obs            = $('pmoc-obs').value.trim();

  if (!equipamento_id || !tecnico_id) {
    msgForm('msg-ficha', 'Selecione o equipamento e o técnico.', 'red'); return;
  }

  msgForm('msg-ficha', 'Salvando...', 'blue');

  // Coletar checklist
  const checkItems = [
    { nome: '[FIL-01] Filtros de Ar',           campo: 'fil_01', freq: 'M' },
    { nome: '[BIO-01] Bandeja / Pastilha',       campo: 'bio_01', freq: 'M' },
    { nome: '[BIO-02] Dreno / Escoamento',       campo: 'bio_02', freq: 'M' },
    { nome: '[MEC-01] Motoventilador',           campo: 'mec_01', freq: 'M' },
    { nome: '[FIL-02] Diferencial de Pressão',   campo: 'fil_02', freq: 'T' },
    { nome: '[BIO-03] Limpeza das Serpentinas',  campo: 'bio_03', freq: 'T' },
    { nome: '[ELE-01] Medição Elétrica',         campo: 'ele_01', freq: 'T' },
    { nome: '[ELE-02] Reaperto de Contatos',     campo: 'ele_02', freq: 'T' },
  ];
  const checklistResult = {};
  checkItems.forEach(item => {
    if (item.freq === 'M' || freq === 'T') {
      const sel = document.querySelector(`input[name="${item.campo}"]:checked`);
      checklistResult[item.campo] = sel ? sel.value : 'NA';
    }
  });

  // Montar observações completas
  const checkStr = JSON.stringify(checklistResult);
  const obsCompleto = `[DataInspecao: ${data_inspecao}]\n[Frequencia: ${freq === 'T' ? 'Trimestral' : 'Mensal'}]\n[Checklist: ${checkStr}]\n${obs}`;

  // Upload foto
  const foto_url = await uploadFoto($('pmoc-foto').files[0], 'pmoc');

  // Buscar nome do técnico
  const { data: colab } = await db.from('colaboradores').select('nome').eq('id', tecnico_id).single();
  const tecnico_nome = colab?.nome || 'N/A';

  const { data: { user } } = await db.auth.getUser();
  const payload = { equipamento_id, tecnico_nome, observacoes: obsCompleto, user_id: user.id };
  if (foto_url) payload.foto_url = foto_url;

  const { error } = await db.from('fichas_pmoc').insert([payload]);
  if (error) {
    msgForm('msg-ficha', 'Erro: ' + error.message, 'red');
  } else {
    msgForm('msg-ficha', 'Formulário PMOC salvo com sucesso!', 'green');
    $('pmoc-obs').value = '';
    $('pmoc-foto').value = '';
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]').forEach(r => r.checked = false);
    carregarHistoricoFichas();
    renderizarGraficosDashboard();
  }
});

async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Carregando histórico...</td></tr>';

  const { data, error } = await db.from('fichas_pmoc')
    .select(`id, created_at, tecnico_nome, observacoes, foto_url,
      equipamentos(tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao)`)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum laudo localizado.</td></tr>'; return;
  }

  tbody.innerHTML = data.map(ficha => {
    const matchData = ficha.observacoes?.match(/\[DataInspecao:\s*([\d-]+)\]/);
    const dataFmt   = matchData ? fmtDate(matchData[1]) : fmtDate(ficha.created_at);
    const laudoID   = 'L-PMOC-' + ficha.id.toString().slice(0, 6).toUpperCase();
    const b64       = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));
    const freq      = ficha.observacoes?.includes('Trimestral') ? 'Trimestral' : 'Mensal';
    return `<tr>
      <td><strong>${laudoID}</strong></td>
      <td>${dataFmt}</td>
      <td><span class="tag-badge">${ficha.equipamentos?.tag || 'N/A'}</span></td>
      <td>${ficha.tecnico_nome}</td>
      <td>${freq}</td>
      <td>
        <button class="btn-primary" style="padding:4px 12px;font-size:12px;" onclick="emitirRelatorioPMOC('${b64}')">🖨️ Emitir</button>
      </td>
    </tr>`;
  }).join('');
}

// ===================== IMPRESSÃO PMOC =====================
function emitirRelatorioPMOC(b64) {
  const ficha = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const eq    = ficha.equipamentos || {};
  const laudoID = 'L-PMOC-' + ficha.id.toString().slice(0, 6).toUpperCase();
  const obs   = ficha.observacoes || '';

  const matchData = obs.match(/\[DataInspecao:\s*([\d-]+)\]/);
  const matchFreq = obs.match(/\[Frequencia:\s*([^\]]+)\]/);
  const matchChk  = obs.match(/\[Checklist:\s*(\{[^}]+\})\]/);
  const dataFmt   = matchData ? fmtDate(matchData[1]) : fmtDate(ficha.created_at);
  const freq      = matchFreq ? matchFreq[1] : '—';
  let obsLimpa    = obs.replace(/\[DataInspecao:[^\]]+\]/g, '')
                       .replace(/\[Frequencia:[^\]]+\]/g, '')
                       .replace(/\[Checklist:[^\]]+\]/g, '')
                       .trim();

  // Checklist
  let checklistHTML = '';
  const nomes = {
    fil_01: '[FIL-01] Filtros de Ar (G4/F7/F9)',
    bio_01: '[BIO-01] Bandeja condensado / Pastilha',
    bio_02: '[BIO-02] Dreno e escoamento de água',
    mec_01: '[MEC-01] Ruídos e fixação do motoventilador',
    fil_02: '[FIL-02] Diferencial de pressão dos filtros',
    bio_03: '[BIO-03] Limpeza química das serpentinas',
    ele_01: '[ELE-01] Medição elétrica (A) do compressor',
    ele_02: '[ELE-02] Reaperto de contatos e painel',
  };
  if (matchChk) {
    try {
      const chk = JSON.parse(matchChk[1]);
      const rows = Object.entries(chk).map(([k, v]) => {
        const cls = v === 'C' ? 'check-c' : v === 'NC' ? 'check-nc' : 'check-na';
        return `<tr><td>${nomes[k] || k}</td><td class="${cls}">${v}</td></tr>`;
      }).join('');
      checklistHTML = `
        <div class="laudo-section">
          <div class="laudo-section-title">3. CHECKLIST DE ROTINAS</div>
          <table class="checklist-print-table">
            <thead><tr><th>Rotina Técnica</th><th>Resultado</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch (_) {}
  }

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">Manutenção Concredur — Sistema Integrado de Gestão</div>
      <h1>FORMULÁRIO DE MANUTENÇÃO PMOC</h1>
      <div class="doc-id">Código: ${laudoID}</div>
      <div class="doc-sub">Conforme Portaria MS nº 3.523/98 | Frequência: ${freq} | Data: ${dataFmt}</div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">1. IDENTIFICAÇÃO DO ATIVO</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">TAG / Código:</span><span class="info-value">${eq.tag || '—'}</span></div>
        <div class="info-item"><span class="info-label">Produto / Tipo:</span><span class="info-value">${eq.produto || '—'}</span></div>
        <div class="info-item"><span class="info-label">Marca / Fabricante:</span><span class="info-value">${eq.marca || '—'}</span></div>
        <div class="info-item"><span class="info-label">Potência:</span><span class="info-value">${eq.potencia || '—'}</span></div>
        <div class="info-item"><span class="info-label">Nº de Série:</span><span class="info-value">${eq.nr_serie || '—'}</span></div>
        <div class="info-item"><span class="info-label">Patrimônio:</span><span class="info-value">${eq.patrimonio || '—'}</span></div>
        <div class="info-item"><span class="info-label">Bloco / Edificação:</span><span class="info-value">${eq.bloco || '—'}</span></div>
        <div class="info-item"><span class="info-label">Setor:</span><span class="info-value">${eq.setor || '—'}</span></div>
        <div class="info-item"><span class="info-label">Sala / LAB:</span><span class="info-value">${eq.sala || '—'}</span></div>
        <div class="info-item"><span class="info-label">Instituição:</span><span class="info-value">${eq.instituicao || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">2. RESPONSÁVEL TÉCNICO</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Técnico:</span><span class="info-value">${ficha.tecnico_nome}</span></div>
        <div class="info-item"><span class="info-label">Data de Inspeção:</span><span class="info-value">${dataFmt}</span></div>
      </div>
    </div>

    ${checklistHTML}

    ${obsLimpa ? `<div class="laudo-section">
      <div class="laudo-section-title">4. OBSERVAÇÕES TÉCNICAS</div>
      <div class="laudo-obs">${obsLimpa}</div>
    </div>` : ''}

    ${ficha.foto_url ? `<div class="laudo-section laudo-foto">
      <div class="laudo-section-title">5. EVIDÊNCIA FOTOGRÁFICA</div>
      <img src="${ficha.foto_url}" alt="Foto da inspeção"/>
    </div>` : ''}

    <div class="laudo-footer">
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Técnico Responsável: ${ficha.tecnico_nome}</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Supervisor / Gestor</div>
      </div>
    </div>

    <div class="laudo-rodape">
      Gerado em ${new Date().toLocaleString('pt-BR')} | ${laudoID} | Manutenção Concredur
    </div>
  </div>`;

  imprimir('area-laudo-impressao', html);
}

// ===================== O.S. AR CONDICIONADO =====================
$('btn-salvar-os').addEventListener('click', async () => {
  const equipamento_id    = $('os-equipamento').value;
  const colaborador_id    = $('os-tecnico').value;
  const tipo_os           = $('os-tipo').value;
  const status_os         = $('os-status').value;
  const descricao_defeito = $('os-defeito').value.trim();
  const laudo_tecnico     = $('os-laudo').value.trim();
  const idEdicao          = $('os-id-edicao').value;

  if (!equipamento_id || !colaborador_id || !descricao_defeito) {
    msgForm('msg-os', 'Campos obrigatórios ausentes.', 'red'); return;
  }

  msgForm('msg-os', 'Gravando...', 'blue');
  const foto_url = await uploadFoto($('os-foto').files[0], 'os_clima');
  const payload = { equipamento_id, colaborador_id, tipo_os, status_os, descricao_defeito, laudo_tecnico };
  if (foto_url) payload.foto_url = foto_url;

  let resposta;
  if (idEdicao) {
    resposta = await db.from('ordens_servico').update(payload).eq('id', idEdicao);
  } else {
    const { data: { user } } = await db.auth.getUser();
    payload.user_id = user.id;
    resposta = await db.from('ordens_servico').insert([payload]);
  }

  if (resposta.error) {
    msgForm('msg-os', 'Erro: ' + resposta.error.message, 'red');
  } else {
    msgForm('msg-os', idEdicao ? 'O.S. atualizada!' : 'O.S. salva com sucesso!', 'green');
    resetarFormOS();
    carregarOrdensServico();
    carregarCentralUnificadaOS();
    renderizarGraficosDashboard();
  }
});

function resetarFormOS() {
  $('os-defeito').value = ''; $('os-laudo').value = '';
  $('os-equipamento').value = ''; $('os-tecnico').value = '';
  $('os-id-edicao').value = ''; $('os-foto').value = '';
  $('titulo-formulario-os').innerText = 'Abertura / Registro de Ordem de Serviço';
  $('btn-cancelar-edicao-os').style.display = 'none';
}

$('btn-cancelar-edicao-os').addEventListener('click', resetarFormOS);

async function carregarOrdensServico() {
  const tbody = $('tbody-os');
  if (!tbody) return;
  const { data } = await db.from('ordens_servico')
    .select(`id, created_at, tipo_os, status_os, descricao_defeito, laudo_tecnico,
      equipamento_id, colaborador_id, foto_url,
      equipamentos(tag), colaboradores(nome)`)
    .order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Nenhuma O.S. aberta.</td></tr>'; return;
  }

  tbody.innerHTML = data.map(os => {
    const numOS = 'OS-AC-' + os.id.toString().slice(0, 5).toUpperCase();
    const b64   = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    const sBadge = os.status_os === 'Concluída' ? 'success' : os.status_os === 'Em Andamento' ? '' : 'warning';
    return `<tr>
      <td><strong>${numOS}</strong></td>
      <td>${fmtDate(os.created_at)}</td>
      <td><span class="tag-badge">${os.equipamentos?.tag || 'N/A'}</span></td>
      <td>${os.colaboradores?.nome || 'N/A'}</td>
      <td>${os.tipo_os}</td>
      <td><span class="tag-badge ${sBadge}">${os.status_os}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn-primary" style="background:#4a5568;padding:4px 9px;font-size:12px;" onclick="emitirLaudoOS('${b64}','${numOS}')">🖨️</button>
        <button class="btn-primary" style="background:#d97706;padding:4px 9px;font-size:12px;" onclick="prepararEdicaoOS('${b64}')">✍️</button>
      </td>
    </tr>`;
  }).join('');
}

function prepararEdicaoOS(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  $('os-equipamento').value   = os.equipamento_id;
  $('os-tecnico').value       = os.colaborador_id;
  $('os-tipo').value          = os.tipo_os;
  $('os-status').value        = os.status_os;
  $('os-defeito').value       = os.descricao_defeito;
  $('os-laudo').value         = os.laudo_tecnico || '';
  $('os-id-edicao').value     = os.id;
  $('titulo-formulario-os').innerText = '✍️ Editando O.S.: OS-AC-' + os.id.toString().slice(0,5).toUpperCase();
  $('btn-cancelar-edicao-os').style.display = 'inline-block';
  $('foco-formulario-os').scrollIntoView({ behavior: 'smooth' });
}

// ===================== IMPRESSÃO O.S. AC =====================
function emitirLaudoOS(b64, numOS) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const sBadge = os.status_os === 'Concluída' ? 'check-c' : os.status_os === 'Em Andamento' ? '' : 'check-nc';

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">Manutenção Concredur — Sistema Integrado de Gestão</div>
      <h1>ORDEM DE SERVIÇO TÉCNICA — CLIMATIZAÇÃO</h1>
      <div class="doc-id">${numOS}</div>
      <div class="doc-sub">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">1. DADOS DA ORDEM</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Número O.S.:</span><span class="info-value"><strong>${numOS}</strong></span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="info-value ${sBadge}"><strong>${os.status_os}</strong></span></div>
        <div class="info-item"><span class="info-label">Tipo:</span><span class="info-value">${os.tipo_os}</span></div>
        <div class="info-item"><span class="info-label">Data de Abertura:</span><span class="info-value">${fmtDate(os.created_at)}</span></div>
        <div class="info-item"><span class="info-label">Equipamento (TAG):</span><span class="info-value">${os.equipamentos?.tag || '—'}</span></div>
        <div class="info-item"><span class="info-label">Técnico Responsável:</span><span class="info-value">${os.colaboradores?.nome || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">2. DEFEITO RELATADO</div>
      <div class="laudo-obs">${os.descricao_defeito || '—'}</div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">3. LAUDO TÉCNICO / ATIVIDADES EXECUTADAS</div>
      <div class="laudo-obs">${os.laudo_tecnico || 'Em andamento — laudo não finalizado.'}</div>
    </div>

    ${os.foto_url ? `<div class="laudo-section laudo-foto">
      <div class="laudo-section-title">4. EVIDÊNCIA FOTOGRÁFICA</div>
      <img src="${os.foto_url}" alt="Evidência técnica"/>
    </div>` : ''}

    <div class="laudo-footer">
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Técnico Responsável</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Responsável pelo Setor / Aceite</div>
      </div>
    </div>

    <div class="laudo-rodape">${numOS} | Manutenção Concredur | ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>`;

  imprimir('area-os-impressao', html);
}

// ===================== O.S. GERAL (FACILITIES) =====================
$('btn-salvar-osg').addEventListener('click', async () => {
  const setor              = $('osg-setor').value.trim();
  const servico_requisitado = $('osg-requisitado').value.trim();
  const tipo_manutencao    = document.querySelector('input[name="osg-tipo"]:checked')?.value || 'Preventiva';
  const areas_servico      = [...document.querySelectorAll('input[name="osg-area"]:checked')].map(c => c.value);
  const falha_relatada     = $('osg-falha').value.trim();
  const equipamento        = $('osg-equipamento').value.trim();
  const marca              = $('osg-marca').value.trim();
  const data_chamada       = $('osg-data-chamada').value || null;
  const data_entrega       = $('osg-data-entrega').value || null;
  const realizado_por      = $('osg-tecnico').value;
  const aceite_servico     = $('osg-aceite').value.trim();
  const observacoes        = $('osg-obs').value.trim();
  const status_os          = $('osg-status').value;
  const idEdicaoG          = $('osg-id-edicao').value;

  if (!setor || !servico_requisitado || !falha_relatada) {
    msgForm('msg-osg', 'Preencha os campos obrigatórios (*).', 'red'); return;
  }

  msgForm('msg-osg', 'Processando...', 'blue');
  const foto_url = await uploadFoto($('osg-foto').files[0], 'os_facilities');
  const payload = { setor, servico_requisitado, tipo_manutencao, areas_servico, falha_relatada, equipamento, marca, data_chamada, data_entrega, realizado_por: realizado_por || null, aceite_servico, observacoes, status_os };
  if (foto_url) payload.foto_url = foto_url;

  let resposta;
  if (idEdicaoG) {
    resposta = await db.from('ordens_servico_geral').update(payload).eq('id', idEdicaoG);
  } else {
    const { data: { user } } = await db.auth.getUser();
    payload.user_id = user.id;
    payload.numero_os = 'OSG-' + Date.now().toString().slice(-6);
    resposta = await db.from('ordens_servico_geral').insert([payload]);
  }

  if (resposta.error) {
    msgForm('msg-osg', 'Erro: ' + resposta.error.message, 'red');
  } else {
    msgForm('msg-osg', idEdicaoG ? 'O.S. Geral atualizada!' : 'O.S. Geral salva!', 'green');
    resetarFormOSG();
    carregarOSGeral();
    carregarCentralUnificadaOS();
    renderizarGraficosDashboard();
  }
});

function resetarFormOSG() {
  ['osg-requisitado','osg-setor','osg-falha','osg-equipamento',
   'osg-marca','osg-aceite','osg-obs'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('osg-id-edicao').value = ''; $('osg-foto').value = '';
  document.querySelectorAll('input[name="osg-area"]').forEach(c => c.checked = false);
  $('titulo-formulario-osg').innerText = 'Nova O.S. Geral';
  $('btn-cancelar-edicao-osg').style.display = 'none';
}

$('btn-cancelar-edicao-osg').addEventListener('click', resetarFormOSG);

async function carregarOSGeral() {
  const tbody = $('tbody-osg');
  if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Nenhuma O.S. Geral localizada.</td></tr>'; return;
  }

  tbody.innerHTML = data.map(os => {
    const numOS = os.numero_os || 'OSG-' + os.id.toString().slice(0,5).toUpperCase();
    const b64   = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    const sBadge = os.status_os === 'Concluída' ? 'success' : os.status_os === 'Em Andamento' ? '' : 'warning';
    return `<tr>
      <td><strong>${numOS}</strong></td>
      <td>${fmtDate(os.data_chamada)}</td>
      <td>${os.setor}</td>
      <td><small>${(os.areas_servico || []).join(', ')}</small></td>
      <td>${os.tipo_manutencao}</td>
      <td><span class="tag-badge ${sBadge}">${os.status_os}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn-primary" style="padding:4px 9px;font-size:12px;" onclick="imprimirOSGeral('${b64}')">🖨️</button>
        <button class="btn-primary" style="background:#d97706;padding:4px 9px;font-size:12px;" onclick="prepararEdicaoOSG('${b64}')">✍️</button>
        <button class="btn-excluir" onclick="excluirOSGeral('${os.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function prepararEdicaoOSG(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  $('osg-requisitado').value   = os.servico_requisitado;
  $('osg-setor').value         = os.setor;
  $('osg-falha').value         = os.falha_relatada;
  $('osg-equipamento').value   = os.equipamento;
  $('osg-marca').value         = os.marca;
  $('osg-data-chamada').value  = os.data_chamada || '';
  $('osg-data-entrega').value  = os.data_entrega || '';
  $('osg-tecnico').value       = os.realizado_por || '';
  $('osg-status').value        = os.status_os;
  $('osg-aceite').value        = os.aceite_servico;
  $('osg-obs').value           = os.observacoes;
  $('osg-id-edicao').value     = os.id;

  document.querySelectorAll('input[name="osg-area"]').forEach(chk => {
    chk.checked = (os.areas_servico || []).includes(chk.value);
  });

  $('titulo-formulario-osg').innerText = '✍️ Editando O.S.: ' + (os.numero_os || 'Facilities');
  $('btn-cancelar-edicao-osg').style.display = 'inline-block';
  $('foco-formulario-osg').scrollIntoView({ behavior: 'smooth' });
}

// ===================== IMPRESSÃO O.S. GERAL =====================
function imprimirOSGeral(b64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const numOS = os.numero_os || 'OSG-' + os.id.toString().slice(0,5).toUpperCase();
  const checkTipo = (val) => os.tipo_manutencao === val ? '(X)' : '(  )';

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div class="empresa">Manutenção Concredur — Sistema Integrado de Gestão</div>
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
        <div class="info-item"><span class="info-label">Equipamento:</span><span class="info-value">${os.equipamento || '—'}</span></div>
        <div class="info-item"><span class="info-label">Marca:</span><span class="info-value">${os.marca || '—'}</span></div>
        <div class="info-item"><span class="info-label">Data Chamada:</span><span class="info-value">${fmtDate(os.data_chamada)}</span></div>
        <div class="info-item"><span class="info-label">Data Prevista:</span><span class="info-value">${fmtDate(os.data_entrega)}</span></div>
        <div class="info-item"><span class="info-label">Técnico:</span><span class="info-value">${os.realizado_por || 'Não atribuído'}</span></div>
        <div class="info-item"><span class="info-label">Aceite:</span><span class="info-value">${os.aceite_servico || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">2. TIPO E ÁREA DE MANUTENÇÃO</div>
      <p style="font-size:12px; margin-bottom:8px;">
        ${checkTipo('Corretiva')} Corretiva &nbsp;&nbsp;
        ${checkTipo('Preventiva')} Preventiva &nbsp;&nbsp;
        ${checkTipo('Reforma')} Reforma &nbsp;&nbsp;
        ${checkTipo('Nova Obra')} Nova Obra &nbsp;&nbsp;
        ${checkTipo('Inspeção de Rota')} Inspeção de Rota &nbsp;&nbsp;
        ${checkTipo('Projeto')} Projeto
      </p>
      <p style="font-size:12px;"><strong>Área(s):</strong> ${(os.areas_servico || []).join(', ') || '—'}</p>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">3. FALHA RELATADA / SERVIÇO SOLICITADO</div>
      <div class="laudo-obs">${os.falha_relatada || '—'}</div>
    </div>

    ${os.observacoes ? `<div class="laudo-section">
      <div class="laudo-section-title">4. OBSERVAÇÕES</div>
      <div class="laudo-obs">${os.observacoes}</div>
    </div>` : ''}

    ${os.foto_url ? `<div class="laudo-section laudo-foto">
      <div class="laudo-section-title">5. EVIDÊNCIA FOTOGRÁFICA</div>
      <img src="${os.foto_url}" alt="Evidência"/>
    </div>` : ''}

    <div class="laudo-footer">
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Técnico Executante</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-linha"></div>
        <div class="assinatura-label">Responsável pelo Setor / Aceite: ${os.aceite_servico || '_______________'}</div>
      </div>
    </div>

    <div class="laudo-rodape">${numOS} | Manutenção Concredur | ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>`;

  imprimir('area-osg-impressao', html);
}

async function excluirOSGeral(id) {
  if (!confirm('Confirma exclusão desta O.S.?')) return;
  await db.from('ordens_servico_geral').delete().eq('id', id);
  carregarOSGeral();
  carregarCentralUnificadaOS();
}

// ===================== CENTRAL UNIFICADA =====================
async function carregarCentralUnificadaOS() {
  const tbody = $('tbody-central-unificada-os');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Consolidando...</td></tr>';

  // Tenta view; se não existir usa query direta
  const { data, error } = await db.from('relatorio_unificado_os')
    .select('*').order('created_at', { ascending: false });

  if (!error && data && data.length) {
    tbody.innerHTML = data.map(doc => {
      const prefixo = doc.modulo_origem === 'Ar Condicionado' ? 'OS-AC-' : 'OS-GEN-';
      const sBadge = doc.status_os === 'Concluída' ? 'success' : doc.status_os === 'Em Andamento' ? '' : 'warning';
      return `<tr>
        <td><strong>${prefixo + doc.id.toString().slice(0, 5).toUpperCase()}</strong></td>
        <td>${fmtDate(doc.created_at)}</td>
        <td>${doc.modulo_origem}</td>
        <td><small>${doc.categoria_servico || '—'}</small></td>
        <td><span style="display:inline-block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${doc.resumo_solicitacao || '—'}</span></td>
        <td><span class="tag-badge ${sBadge}">${doc.status_os}</span></td>
      </tr>`;
    }).join('');
    return;
  }

  // Fallback: buscar diretamente das duas tabelas
  const [{ data: ac }, { data: geral }] = await Promise.all([
    db.from('ordens_servico').select('id, created_at, tipo_os, status_os, descricao_defeito').order('created_at', { ascending: false }).limit(30),
    db.from('ordens_servico_geral').select('id, created_at, tipo_manutencao, status_os, servico_requisitado, numero_os').order('created_at', { ascending: false }).limit(30),
  ]);

  const linhas = [
    ...(ac    || []).map(d => ({ id: 'OS-AC-'  + d.id.toString().slice(0,5).toUpperCase(), data: d.created_at, modulo: 'Ar Condicionado', cat: d.tipo_os,           resumo: d.descricao_defeito, status: d.status_os })),
    ...(geral || []).map(d => ({ id: d.numero_os || 'OS-GEN-' + d.id.toString().slice(0,5).toUpperCase(), data: d.created_at, modulo: 'Facilities', cat: d.tipo_manutencao, resumo: d.servico_requisitado, status: d.status_os })),
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  if (!linhas.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum documento encontrado.</td></tr>'; return;
  }

  tbody.innerHTML = linhas.map(d => {
    const sBadge = d.status === 'Concluída' ? 'success' : d.status === 'Em Andamento' ? '' : 'warning';
    return `<tr>
      <td><strong>${d.id}</strong></td>
      <td>${fmtDate(d.data)}</td>
      <td>${d.modulo}</td>
      <td><small>${d.cat || '—'}</small></td>
      <td><span style="display:inline-block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.resumo || '—'}</span></td>
      <td><span class="tag-badge ${sBadge}">${d.status}</span></td>
    </tr>`;
  }).join('');
}

// ===================== CONTROLE DE USUÁRIOS =====================
$('btn-admin-salvar-usuario').addEventListener('click', async () => {
  const email     = $('adm-user-email').value.trim();
  const senha     = $('adm-user-password').value;
  const role      = $('adm-user-role').value;
  const modulos   = [...document.querySelectorAll('.chk-acesso:checked')].map(cb => cb.value);

  if (!email || senha.length < 6) {
    msgForm('msg-admin-usuario', 'E-mail e senha (mín. 6 dígitos) são obrigatórios.', 'red'); return;
  }

  const { error } = await db.from('perfis_usuarios').insert([{
    email, role, password_hint: senha,
    observacoes: 'Módulos: ' + modulos.join(', ')
  }]);

  if (!error) {
    msgForm('msg-admin-usuario', 'Usuário cadastrado!', 'green');
    $('adm-user-email').value = ''; $('adm-user-password').value = '';
    carregarUsuariosSistema();
  } else {
    msgForm('msg-admin-usuario', 'Erro: ' + error.message, 'red');
  }
});

async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema');
  if (!tbody) return;
  const { data } = await db.from('perfis_usuarios').select('*');
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Nenhum operador cadastrado.</td></tr>'; return;
  }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td><strong>${u.email}</strong></td>
      <td><span class="tag-badge">${u.role}</span></td>
      <td><small>${u.observacoes || 'Padrão'}</small></td>
      <td><button class="btn-excluir" onclick="excluirUsuarioSistema('${u.id}')">✕</button></td>
    </tr>
  `).join('');
}

async function excluirUsuarioSistema(id) {
  if (!confirm('Confirma exclusão?')) return;
  await db.from('perfis_usuarios').delete().eq('id', id);
  carregarUsuariosSistema();
}

// ===================== CONTA =====================
$('btn-atualizar-senha').addEventListener('click', async () => {
  const nova    = $('account-new-password').value;
  const confirm = $('account-confirm-password').value;
  if (!nova || nova !== confirm) {
    msgForm('msg-conta', 'As senhas não coincidem.', 'red'); return;
  }
  const { error } = await db.auth.updateUser({ password: nova });
  if (error) {
    msgForm('msg-conta', 'Erro: ' + error.message, 'red');
  } else {
    msgForm('msg-conta', 'Senha atualizada com sucesso!', 'green');
    $('account-new-password').value = ''; $('account-confirm-password').value = '';
  }
});

// ===================== NAVEGAÇÃO =====================
function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  $('nav-' + name)?.classList.add('active');
  document.querySelectorAll('.app-section').forEach(el => el.style.display = 'none');
  const target = $('section-' + name);
  if (target) target.style.display = 'block';

  const reloaders = {
    'dashboard':    () => renderizarGraficosDashboard(),
    'equipamentos': () => carregarEquipamentos(),
    'fichas':       () => { atualizarSelectEquipamentos(); atualizarSelectColaboradores(); },
    'relatorios':   () => carregarHistoricoFichas(),
    'ordens':       () => { carregarOrdensServico(); atualizarSelectEquipamentos(); atualizarSelectColaboradores(); },
    'os-grid':      () => { carregarOSGeral(); atualizarSelectColaboradores(); },
    'historico-os': () => carregarCentralUnificadaOS(),
    'funcoes':      () => carregarFuncoes(),
    'colaboradores':() => { carregarColaboradores(); atualizarSelectFuncoes(); },
    'usuarios':     () => carregarUsuariosSistema(),
  };
  reloaders[name]?.();
}

// ===================== UTILITÁRIO: MSG + IMPRESSÃO =====================
function msgForm(id, texto, cor) {
  const el = $(id);
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#2563eb';
  el.innerText = texto;
  if (cor === 'green') setTimeout(() => { el.innerText = ''; }, 4000);
}

function imprimir(areaId, html) {
  // Esconde todas as áreas de impressão
  document.querySelectorAll('.print-only').forEach(el => { el.innerHTML = ''; });
  // Injeta conteúdo na área correta
  const area = $(areaId);
  if (area) area.innerHTML = html;
  window.print();
}
