const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais para instâncias de gráficos para evitar sobreposição de canvas
let instanceChartOS = null;
let instanceChartCrit = null;

// ===================== ELEMENTOS DE LOGIN =====================
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const msg = document.getElementById('mensagem');
const loginBox = document.getElementById('login-box');
const appBox = document.getElementById('app-box');

// ===================== ELEMENTOS DE EQUIPAMENTO =====================
const btnSalvar = document.getElementById('btn-salvar');
const btnLimpar = document.getElementById('btn-limpar');
const msgEq = document.getElementById('msg-equipamento');

// ===================== ELEMENTOS DO FORMULÁRIO PMOC =====================
const selectEquipamento = document.getElementById('pmoc-equipamento');
const selectFrequencia = document.getElementById('pmoc-frequencia');
const selectTecnicoPMOC = document.getElementById('pmoc-tecnico');
const inputDatePMOC = document.getElementById('pmoc-data');
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
const msgFicha = document.getElementById('msg-ficha');
const fotoInput = document.getElementById('pmoc-foto');

// ===================== ELEMENTOS DO CADASTRO DE O.S. AR CONDICIONADO =====================
const selectOSEquipamento = document.getElementById('os-equipamento');
const selectOSTecnico = document.getElementById('os-tecnico');
const selectOSTipo = document.getElementById('os-tipo');
const selectOSStatus = document.getElementById('os-status');
const txtOSDefeito = document.getElementById('os-defeito');
const txtOSLaudo = document.getElementById('os-laudo');
const btnSalvarOS = document.getElementById('btn-salvar-os');
const msgOS = document.getElementById('msg-os');
const osFotoInput = document.getElementById('os-foto');
const osIdEdicao = document.getElementById('os-id-edicao');
const btnCancelarEdicaoOS = document.getElementById('btn-cancelar-edicao-os');

// ===================== ELEMENTOS DE O.S. GERAL =====================
const btnSalvarOSG = document.getElementById('btn-salvar-osg');
const msgOSG = document.getElementById('msg-osg');
const selectOSGTecnico = document.getElementById('osg-tecnico');
const osgFotoInput = document.getElementById('osg-foto');
const osgIdEdicao = document.getElementById('osg-id-edicao');
const btnCancelarEdicaoOSG = document.getElementById('btn-cancelar-edicao-osg');

// ===================== ELEMENTOS DE RH =====================
const btnSalvarFuncao = document.getElementById('btn-salvar-funcao');
const msgFuncao = document.getElementById('msg-funcao');
const btnSalvarColaborador = document.getElementById('btn-salvar-colaborador');
const msgColaborador = document.getElementById('msg-colaborador');
const selectFuncaoColab = document.getElementById('colab-funcao');

// ===================== ELEMENTOS DE CONFIGURAÇÃO DA CONTA =====================
const btnAtualizarSenha = document.getElementById('btn-atualizar-senha');
const msgConta = document.getElementById('msg-conta');

// ===================== ELEMENTOS DE CONTROLE ADMIN DE USUÁRIOS =====================
const btnAdminSalvarUsuario = document.getElementById('btn-admin-salvar-usuario');
const msgAdminUsuario = document.getElementById('msg-admin-usuario');

// ===================== CRITICIDADE — FLUXOGRAMA =====================
function calcularCriticidadeFluxograma() {
  const interrupcao = document.getElementById('crit-interrupcao').value;
  const seguranca = document.getElementById('crit-seguranca').value;
  const operacao = document.getElementById('crit-operacao').value;
  const reserva = document.getElementById('crit-reserva').value;

  let resultado = "Média (B)";

  if (interrupcao === "sim" || seguranca === "sim") {
    resultado = reserva === "nao" ? "Alta (A)" : "Média (B)";
  } else {
    if (operacao === "sim") {
      resultado = reserva === "nao" ? "Média (B)" : "Baixa (C)";
    } else {
      resultado = "Baixa (C)";
    }
  }

  document.getElementById('label-criticidade-calculada').innerText = "Classe " + resultado;
  return resultado.split(" ")[0];
}

function toggleItemsPorFrequencia() {
  const freq = selectFrequencia.value;
  document.querySelectorAll('.freq-item-t').forEach(item => {
    if (freq === 'T') {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
      item.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    }
  });
}

// ===================== VERIFICAR SESSÃO AO CARREGAR =====================
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) mostrarApp();
});

// ===================== GESTÃO DE ACESSO EXCLUSIVO DO MASTER =====================
function verificarRegraAdmin(email) {
  const emailNormalizado = email.toLowerCase().trim();
  if (emailNormalizado === 'fabianob.silva87@gmail.com' || emailNormalizado.includes('admin') || emailNormalizado.includes('master')) {
    document.getElementById('label-admin').style.display = 'block';
    document.getElementById('nav-usuarios').style.display = 'flex';
    carregarUsuariosSistema();
  } else {
    document.getElementById('label-admin').style.display = 'none';
    document.getElementById('nav-usuarios').style.display = 'none';
  }
}

// ===================== DASHBOARD ANALÍTICO =====================
async function renderizarGraficosDashboard() {
  const { count: countAtivos } = await supabaseClient.from('equipamentos').select('*', { count: 'exact', head: true });
  const { count: countFichas } = await supabaseClient.from('fichas_pmoc').select('*', { count: 'exact', head: true });
  
  const { count: countAbertas } = await supabaseClient.from('ordens_servico').select('*', { count: 'exact', head: true }).neq('status_os', 'Concluída');
  const { count: countFechadas } = await supabaseClient.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status_os', 'Concluída');

  document.getElementById('dash-txt-ativos').innerText = countAtivos || 0;
  document.getElementById('dash-txt-fichas').innerText = countFichas || 0;
  document.getElementById('dash-txt-os-abertas').innerText = countAbertas || 0;
  document.getElementById('dash-txt-os-fechadas').innerText = countFechadas || 0;

  const { data: dataStatus } = await supabaseClient.from('resumo_status_os').select('*');
  const labelsStatus = (dataStatus || []).map(item => item.status_os);
  const valoresStatus = (dataStatus || []).map(item => item.total);

  if(instanceChartOS) instanceChartOS.destroy();
  const ctxOS = document.getElementById('chartStatusOS').getContext('2d');
  instanceChartOS = new Chart(ctxOS, {
    type: 'bar',
    data: {
      labels: labelsStatus.length ? labelsStatus : ['Sem Dados'],
      datasets: [{
        label: 'Quantidade de O.S.',
        data: valoresStatus.length ? valoresStatus : [0],
        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
        borderWidth: 1
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const { data: dataContrast } = await supabaseClient.from('resumo_criticidade').select('*');
  const labelsCrit = (dataContrast || []).map(item => 'Classe ' + item.criticidade);
  const valoresCrit = (dataContrast || []).map(item => item.total);

  if(instanceChartCrit) instanceChartCrit.destroy();
  const ctxCrit = document.getElementById('chartCriticidade').getContext('2d');
  instanceChartCrit = new Chart(ctxCrit, {
    type: 'doughnut',
    data: {
      labels: labelsCrit.length ? labelsCrit : ['Nenhum Ativo'],
      datasets: [{
        data: valoresCrit.length ? valoresCrit : [1],
        backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// ===================== CADASTRO DE EQUIPAMENTO =====================
btnSalvar.addEventListener('click', async () => {
  const tag = document.getElementById('eq-tag').value.trim();
  const marca = document.getElementById('eq-marca').value.trim();
  const potencia = document.getElementById('eq-potencia').value.trim();
  const nr_serie = document.getElementById('eq-serie').value.trim();
  const patrimonio = document.getElementById('eq-patrimonio').value.trim();
  const produto = document.getElementById('eq-produto').value.trim();
  const bloco = document.getElementById('eq-bloco').value.trim();
  const setor = document.getElementById('eq-setor').value.trim();
  const sala = document.getElementById('eq-sala').value.trim();
  const instituicao = document.getElementById('eq-instituicao').value.trim();
  const validade = document.getElementById('eq-validade').value.trim();
  const criticidade = calcularCriticidadeFluxograma();

  if (!tag || !marca || !produto) {
    msgEq.style.color = "red";
    msgEq.innerText = "Os campos TAG, Marca e Equipamento são obrigatórios.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('equipamentos').insert([{
    tag, marca, potencia, nr_serie, patrimonio, produto,
    bloco, setor, sala, instituicao, validade, criticidade, user_id: user.id
  }]);

  if (error) {
    msgEq.style.color = "red";
    msgEq.innerText = "Erro: " + error.message;
  } else {
    msgEq.style.color = "green";
    msgEq.innerText = "Equipamento salvo com sucesso!";
    limparFormulario();
    carregarEquipamentos();
    setTimeout(() => msgEq.innerText = "", 3000);
  }
});

btnLimpar.addEventListener('click', limparFormulario);
function limparFormulario() {
  ['eq-tag','eq-marca','eq-potencia','eq-serie','eq-patrimonio',
   'eq-produto','eq-bloco','eq-setor','eq-sala','eq-instituicao','eq-validade'].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById('crit-interrupcao').value = "nao";
  document.getElementById('crit-seguranca').value = "nao";
  document.getElementById('crit-operacao').value = "nao";
  document.getElementById('crit-reserva').value = "nao";
  calcularCriticidadeFluxograma();
  msgEq.innerText = "";
}

async function carregarEquipamentos() {
  const tbody = document.getElementById('tbody-equipamentos');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando...</td></tr>';

  const { data, error } = await supabaseClient
    .from('equipamentos').select('*').order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum equipamento cadastrado.</td></tr>';
    atualizarSelectEquipamentos();
    return;
  }

  tbody.innerHTML = data.map(eq => `
    <tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || 'N/A'}</strong><br><small style="color:#718096">${eq.marca || 'N/A'}</small></td>
      <td>${eq.bloco || '-'} / ${eq.setor || '-'}<br><small style="color:#718096">${eq.sala || '-'}</small></td>
      <td><span class="tag-badge" style="background:#ebf4ff;color:#2b6cb0">${eq.criticidade || 'Média'}</span></td>
      <td><button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕ Excluir</button></td>
    </tr>
  `).join('');

  atualizarSelectEquipamentos();
}

async function excluirEquipamento(id) {
  if (!confirm("Confirma exclusão deste equipamento?")) return;
  const { error } = await supabaseClient.from('equipamentos').delete().eq('id', id);
  if (!error) carregarEquipamentos();
}

async function atualizarSelectEquipamentos() {
  if (!selectEquipamento) return;
  const { data, error } = await supabaseClient.from('equipamentos').select('id, tag, marca, produto');

  selectEquipamento.innerHTML = '<option value="">-- Selecione o Ativo (Tag) --</option>';
  if (selectOSEquipamento) selectOSEquipamento.innerHTML = '<option value="">-- Selecione o Ativo (Tag) --</option>';

  if (!error && data) {
    data.forEach(eq => {
      const opt = document.createElement('option');
      opt.value = eq.id;
      opt.textContent = `${eq.tag} - ${eq.produto || eq.marca}`;
      selectEquipamento.appendChild(opt);

      if (selectOSEquipamento) {
        const optOS = document.createElement('option');
        optOS.value = eq.id;
        optOS.textContent = eq.tag;
        selectOSEquipamento.appendChild(optOS);
      }
    });
  }
}

// ===================== FORMULÁRIO PMOC =====================
btnSalvarFicha.addEventListener('click', async () => {
  const equipamento_id = selectEquipamento.value;
  const tecnico_nome = selectTecnicoPMOC.value;
  const freq_inspecao = selectFrequencia.value;
  const data_escolhida = inputDatePMOC.value;
  const observacoes = document.getElementById('pmoc-obs').value.trim();
  const arquivoFoto = fotoInput.files[0];

  const fil_01 = document.querySelector('input[name="fil_01"]:checked')?.value;
  const bio_01 = document.querySelector('input[name="bio_01"]:checked')?.value;
  const bio_02 = document.querySelector('input[name="bio_02"]:checked')?.value;
  const mec_01 = document.querySelector('input[name="mec_01"]:checked')?.value;
  const fil_02 = document.querySelector('input[name="fil_02"]:checked')?.value || 'NA';
  const bio_03 = document.querySelector('input[name="bio_03"]:checked')?.value || 'NA';
  const ele_01 = document.querySelector('input[name="ele_01"]:checked')?.value || 'NA';
  const ele_02 = document.querySelector('input[name="ele_02"]:checked')?.value || 'NA';

  if (!equipamento_id || !tecnico_nome || !data_escolhida || !fil_01 || !bio_01 || !bio_02 || !mec_01) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Preencha os itens mensais obrigatórios.";
    return;
  }

  msgFicha.style.color = "blue";
  msgFicha.innerText = "Processando informações...";

  const { data: { user } } = await supabaseClient.auth.getUser();
  let fotoUrl = null;

  if (arquivoFoto) {
    const extensao = arquivoFoto.name.split('.').pop();
    const nomeArquivo = `${user.id}/pmoc_${Date.now()}.${extensao}`;
    const { error: uploadError } = await supabaseClient.storage.from('fotos-pmoc').upload(nomeArquivo, arquivoFoto);
    if (!uploadError) {
      const { data: publicUrlData } = supabaseClient.storage.from('fotos-pmoc').getPublicUrl(nomeArquivo);
      fotoUrl = publicUrlData.publicUrl;
    }
  }

  const { error } = await supabaseClient.from('fichas_pmoc').insert([{
    equipamento_id, user_id: user.id, tecnico_nome,
    observacoes: `[Frequência: ${freq_inspecao}] \n[DataInspecao: ${data_escolhida}] \nChecklist: FIL-01:${fil_01} | BIO-01:${bio_01} | BIO-02:${bio_02} | MEC-01:${mec_01} | FIL-02:${fil_02} | BIO-03:${bio_03} | ELE-01:${ele_01} | ELE-02:${ele_02}\n\nObservações: ${observacoes}`,
    foto_url: fotoUrl
  }]);

  if (error) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Erro ao salvar: " + error.message;
  } else {
    msgFicha.style.color = "green";
    msgFicha.innerText = "Formulário PMOC registrado!";
    limparFormularioFicha();
    carregarHistoricoFichas();
  }
});

async function carregarHistoricoFichas() {
  const tbody = document.getElementById('tbody-fichas');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Carregando histórico...</td></tr>';

  const { data, error } = await supabaseClient
    .from('fichas_pmoc')
    .select(`id, created_at, tecnico_nome, observacoes, foto_url,
      equipamentos (tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao)`).order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Nenhum laudo localizado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(ficha => {
    const matchData = ficha.observacoes.match(/\[DataInspecao:\s*([\d-]+)\]/);
    const dataFormatada = matchData ? new Date(matchData[1] + "T00:00:00").toLocaleDateString('pt-BR') : new Date(ficha.created_at).toLocaleDateString('pt-BR');
    const laudoID = "L-PMOC-" + ficha.id.toString().slice(0, 6).toUpperCase();
    const fichaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));
    return `
      <tr>
        <td><strong>${laudoID}</strong></td>
        <td>${dataFormatada}</td>
        <td>${ficha.equipamentos?.tag || 'N/A'}</td>
        <td>${ficha.tecnico_nome}</td>
        <td>${ficha.observacoes.includes("Trimestral") ? "Trimestral" : "Mensal"}</td>
        <td><button class="btn-primary" style="padding:4px 10px;" onclick="emitirRelatorio('${fichaB64}')">🖨️ Emitir</button></td>
      </tr>`;
  }).join('');
}

function emitirRelatorio(fichaBase64) {
  const ficha = JSON.parse(decodeURIComponent(escape(atob(fichaBase64))));
  const eq = ficha.equipamentos || {};
  const laudoID = "L-PMOC-" + ficha.id.toString().slice(0, 6).toUpperCase();
  
  // CORREÇÃO DE IMPRESSÃO: Limpa a área antiga eliminando páginas em branco acumuladas
  const target = document.getElementById('area-laudo-impressao');
  target.innerHTML = ''; 

  target.innerHTML = `
    <div class="laudo-header">
      <h2>FORMULÁRIO DE MANUTENÇÃO PMOC - CÓDIGO: ${laudoID}</h2>
      <p>Conforme Portaria MS nº 3.523/98</p>
    </div>
    <div class="laudo-section">
      <h3>1. IDENTIFICAÇÃO</h3>
      <p><strong>Ativo:</strong> ${eq.tag} | <strong>Bloco/Setor:</strong> ${eq.bloco} - ${eq.setor}</p>
      <p><strong>Técnico:</strong> ${ficha.tecnico_nome}</p>
    </div>
    <div class="laudo-section">
      <h3>2. OBSERVAÇÕES TÉCNICAS</h3>
      <div style="white-space:pre-wrap;">${ficha.observacoes}</div>
    </div>
    ${ficha.foto_url ? `<div class="laudo-section" style="text-align:center;"><img src="${ficha.foto_url}" class="laudo-img-preview"/></div>` : ''}
  `;
  window.print();
}

// ===================== AR CONDICIONADO: SALVAR / EDIÇÃO DE O.S. =====================
btnSalvarOS.addEventListener('click', async () => {
  const equipamento_id = selectOSEquipamento.value;
  const colaborador_id = selectOSTecnico.value;
  const tipo_os = selectOSTipo.value;
  const status_os = selectOSStatus.value;
  const descricao_defeito = txtOSDefeito.value.trim();
  const laudo_tecnico = txtOSLaudo.value.trim();
  const idEdicao = osIdEdicao.value;
  const arquivoFoto = osFotoInput.files[0];

  if (!equipamento_id || !colaborador_id || !descricao_defeito) {
    msgOS.style.color = "red";
    msgOS.innerText = "Campos obrigatórios ausentes.";
    return;
  }

  msgOS.style.color = "blue";
  msgOS.innerText = "Gravando modificações...";

  let fotoUrl = null;
  if (arquivoFoto) {
    const extensao = arquivoFoto.name.split('.').pop();
    const nomeArquivo = `os_clima/os_${Date.now()}.${extensao}`;
    const { data: uploadData } = await supabaseClient.storage.from('fotos-pmoc').upload(nomeArquivo, arquivoFoto);
    if(uploadData) {
      fotoUrl = supabaseClient.storage.from('fotos-pmoc').getPublicUrl(nomeArquivo).data.publicUrl;
    }
  }

  const payload = { equipamento_id, colaborador_id, tipo_os, status_os, descricao_defeito, laudo_tecnico };
  if(fotoUrl) payload.foto_url = fotoUrl;

  let resposta;
  if (idEdicao) {
    // Modo de Edição Ativo (UPDATE)
    resposta = await supabaseClient.from('ordens_servico').update(payload).eq('id', idEdicao);
  } else {
    // Modo de Inserção Normal (INSERT)
    const { data: { user } } = await supabaseClient.auth.getUser();
    payload.user_id = user.id;
    resposta = await supabaseClient.from('ordens_servico').insert([payload]);
  }

  if (resposta.error) {
    msgOS.style.color = "red";
    msgOS.innerText = "Erro operacional: " + resposta.error.message;
  } else {
    msgOS.style.color = "green";
    msgOS.innerText = "Registro concluído com sucesso!";
    resetarFormOS();
    carregarOrdensServico();
    carregarCentralUnificadaOS();
  }
});

function resetarFormOS() {
  txtOSDefeito.value = ""; txtOSLaudo.value = "";
  selectOSEquipamento.value = ""; selectOSTecnico.value = "";
  osIdEdicao.value = ""; osFotoInput.value = "";
  document.getElementById('titulo-formulario-os').innerText = "Abertura / Registro de Ordem de Serviço";
  btnCancelarEdicaoOS.style.display = "none";
}

btnCancelarEdicaoOS.addEventListener('click', resetarFormOS);

async function carregarOrdensServico() {
  const tbody = document.getElementById('tbody-os');
  if (!tbody) return;

  const { data } = await supabaseClient.from('ordens_servico').select(`id, created_at, tipo_os, status_os, descricao_defeito, laudo_tecnico, equipamento_id, colaborador_id, foto_url, equipamentos(tag), colaboradores(nome)`).order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Nenhuma O.S. aberta.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((os) => {
    const numOS = "OS-AC-" + os.id.toString().slice(0, 5).toUpperCase();
    const osB64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `
      <tr>
        <td><strong>${numOS}</strong></td>
        <td>${new Date(os.created_at).toLocaleDateString('pt-BR')}</td>
        <td><span class="tag-badge">${os.equipamentos?.tag || 'N/A'}</span></td>
        <td>${os.colaboradores?.nome || 'N/A'}</td>
        <td>${os.tipo_os}</td>
        <td><span class="tag-badge" style="background:#fef3c7;color:#d97706;">${os.status_os}</span></td>
        <td>
          <button class="btn-primary" style="background:#4a5568; padding:3px 8px;" onclick="emitirLaudoOS('${osB64}','${numOS}')">🖨️</button>
          <button class="btn-primary" style="background:#d97706; padding:3px 8px;" onclick="prepararEdicaoOS('${osB64}')">✍️ Editar</button>
        </td>
      </tr>`;
  }).join('');
}

function prepararEdicaoOS(osBase64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(osBase64))));
  selectOSEquipamento.value = os.equipment_id || os.equipamento_id;
  selectOSTecnico.value = os.colaborador_id;
  selectOSTipo.value = os.tipo_os;
  selectOSStatus.value = os.status_os;
  txtOSDefeito.value = os.descricao_defeito;
  txtOSLaudo.value = os.laudo_tecnico;
  osIdEdicao.value = os.id;

  document.getElementById('titulo-formulario-os').innerText = "✍️ Editando Ordem de Serviço: OS-AC-" + os.id.toString().slice(0,5).toUpperCase();
  btnCancelarEdicaoOS.style.display = "inline-block";
  document.getElementById('foco-formulario-os').scrollIntoView({ behavior: 'smooth' });
}

function emitirLaudoOS(osBase64, numOS) {
  const os = JSON.parse(decodeURIComponent(escape(atob(osBase64))));
  const target = document.getElementById('area-os-impressao');
  target.innerHTML = ''; // Limpeza de cache de páginas em branco

  target.innerHTML = `
    <div class="laudo-header">
      <h2>ORDEM DE SERVIÇO TÉCNICA - ${numOS}</h2>
    </div>
    <p><strong>Status:</strong> ${os.status_os} | <strong>Tipo:</strong> ${os.type_os || os.tipo_os}</p>
    <p><strong>Defeito Relatado:</strong> ${os.descricao_defeito}</p>
    <p><strong>Laudo de Atividades:</strong> ${os.laudo_tecnico || 'Em andamento.'}</p>
    ${os.foto_url ? `<div style="text-align:center; margin-top:20px;"><p><strong>Evidência Fotográfica:</strong></p><img src="${os.foto_url}" class="laudo-img-preview"/></div>` : ''}
  `;
  window.print();
}

// ===================== FACILITIES: SALVAR / EDIÇÃO DE O.S. GERAL =====================
btnSalvarOSG.addEventListener('click', async () => {
  const setor = document.getElementById('osg-setor').value.trim();
  const servico_requisitado = document.getElementById('osg-requisitado').value.trim();
  const tipo_manutencao = document.querySelector('input[name="osg-tipo"]:checked')?.value || 'Preventiva';
  const areas_servico = [...document.querySelectorAll('input[name="osg-area"]:checked')].map(c => c.value);
  const falha_relatada = document.getElementById('osg-falha').value.trim();
  const equipamento = document.getElementById('osg-equipamento').value.trim();
  const marca = document.getElementById('osg-marca').value.trim();
  const data_chamada = document.getElementById('osg-data-chamada').value || null;
  const data_entrega = document.getElementById('osg-data-entrega').value || null;
  const realizado_por = selectOSGTecnico.value;
  const aceite_servico = document.getElementById('osg-aceite').value.trim();
  const observacoes = document.getElementById('osg-obs').value.trim();
  const status_os = document.getElementById('osg-status').value;
  const idEdicaoG = osgIdEdicao.value;
  const arquivoFoto = osgFotoInput.files[0];

  if (!setor || !servico_requisitado || !falha_relatada) {
    msgOSG.style.color = 'red';
    msgOSG.innerText = 'Preencha os campos obrigatórios.';
    return;
  }

  msgOSG.style.color = 'blue';
  msgOSG.innerText = 'Processando informações de manutenção...';

  let fotoUrl = null;
  if (arquivoFoto) {
    const extensao = arquivoFoto.name.split('.').pop();
    const nomeArquivo = `os_facilities/osg_${Date.now()}.${extensao}`;
    const { data: uploadGData } = await supabaseClient.storage.from('fotos-pmoc').upload(nomeArquivo, arquivoFoto);
    if(uploadGData) {
      fotoUrl = supabaseClient.storage.from('fotos-pmoc').getPublicUrl(nomeArquivo).data.publicUrl;
    }
  }

  const payload = { setor, servico_requisitado, tipo_manutencao, areas_servico, falha_relatada, equipamento, marca, data_chamada, data_entrega, realizado_por, aceite_servico, observacoes, status_os };
  if(fotoUrl) payload.foto_url = fotoUrl;

  let resposta;
  if(idEdicaoG) {
    resposta = await supabaseClient.from('ordens_servico_geral').update(payload).eq('id', idEdicaoG);
  } else {
    const { data: { user } } = await supabaseClient.auth.getUser();
    payload.user_id = user.id;
    payload.numero_os = 'OSG-' + Date.now().toString().slice(-6);
    resposta = await supabaseClient.from('ordens_servico_geral').insert([payload]);
  }

  if (resposta.error) {
    msgOSG.style.color = 'red';
    msgOSG.innerText = 'Erro: ' + resposta.error.message;
  } else {
    msgOSG.style.color = 'green';
    msgOSG.innerText = 'O.S. Geral gravada com sucesso!';
    resetarFormOSG();
    carregarOSGeral();
    carregarCentralUnificadaOS();
  }
});

function resetarFormOSG() {
  document.getElementById('osg-requisitado').value = ''; document.getElementById('osg-setor').value = '';
  document.getElementById('osg-falha').value = ''; document.getElementById('osg-equipamento').value = '';
  document.getElementById('osg-marca').value = ''; document.getElementById('osg-aceite').value = '';
  document.getElementById('osg-obs').value = ''; osgIdEdicao.value = ""; osgFotoInput.value = "";
  document.querySelectorAll('input[name="osg-area"]').forEach(c => c.checked = false);
  document.getElementById('titulo-formulario-osg').innerText = "Nova O.S. Geral";
  btnCancelarEdicaoOSG.style.display = "none";
}

btnCancelarEdicaoOSG.addEventListener('click', resetarFormOSG);

async function carregarOSGeral() {
  const tbody = document.getElementById('tbody-osg');
  if (!tbody) return;

  const { data } = await supabaseClient.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Nenhuma O.S. Geral localizada.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((os) => {
    const numOS = os.numero_os || "OSG-" + os.id.toString().slice(0,5).toUpperCase();
    const osB64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `
      <tr>
        <td><strong>${numOS}</strong></td>
        <td>${os.data_chamada ? new Date(os.data_chamada + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
        <td>${os.setor}</td>
        <td><small>${(os.areas_servico || []).join(', ')}</small></td>
        <td>${os.tipo_manutencao}</td>
        <td><span class="tag-badge" style="background:#fef3c7;color:#d97706;">${os.status_os}</span></td>
        <td>
          <button class="btn-primary" style="padding:3px 8px;" onclick="imprimirOSGeral('${osB64}')">🖨️</button>
          <button class="btn-primary" style="background:#d97706; padding:3px 8px;" onclick="prepararEdicaoOSG('${osB64}')">✍️ Editar</button>
          <button class="btn-excluir" onclick="excluirOSGeral('${os.id}')">✕</button>
        </td>
      </tr>`;
  }).join('');
}

function prepararEdicaoOSG(osBase64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(osBase64))));
  document.getElementById('osg-requisitado').value = os.servico_requisitado;
  document.getElementById('osg-setor').value = os.setor;
  document.getElementById('osg-falha').value = os.falha_relatada;
  document.getElementById('osg-equipamento').value = os.equipamento;
  document.getElementById('osg-marca').value = os.marca;
  document.getElementById('osg-data-chamada').value = os.data_chamada;
  document.getElementById('osg-data-entrega').value = os.data_entrega;
  selectOSGTecnico.value = os.realizado_por;
  document.getElementById('osg-status').value = os.status_os;
  document.getElementById('osg-aceite').value = os.aceite_servico;
  document.getElementById('osg-obs').value = os.observacoes;
  osgIdEdicao.value = os.id;

  // Marcar as caixas de seleção salvas das áreas de facilities
  document.querySelectorAll('input[name="osg-area"]').forEach(chk => {
    chk.checked = (os.areas_servico || []).includes(chk.value);
  });

  document.getElementById('titulo-formulario-osg').innerText = "✍️ Editando O.S. Geral: " + (os.numero_os || 'Facilities');
  btnCancelarEdicaoOSG.style.display = "inline-block";
  document.getElementById('foco-formulario-osg').scrollIntoView({ behavior: 'smooth' });
}

// ===================== CENTRAL DE RELATÓRIOS UNIFICADOS =====================
async function carregarCentralUnificadaOS() {
  const tbody = document.getElementById('tbody-central-unificada-os');
  if (!tbody) return;

  const { data } = await supabaseClient.from('relatorio_unificado_os').select('*').order('created_at', { ascending: false });

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Nenhum documento centralizado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(doc => {
    const prefixo = doc.modulo_origem === 'Ar Condicionado' ? 'OS-AC-' : 'OS-GEN-';
    const docID = prefixo + doc.id.toString().slice(0, 5).toUpperCase();
    return `
      <tr>
        <td><strong>${docID}</strong></td>
        <td>${new Date(doc.created_at).toLocaleDateString('pt-BR')}</td>
        <td><small>${doc.modulo_origem}</small></td>
        <td><small>${doc.categoria_servico}</small></td>
        <td><span style="display:inline-block; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${doc.resumo_solicitacao || '—'}</span></td>
        <td><span class="tag-badge" style="background:#def7ec; color:#03543f;">${doc.status_os}</span></td>
      </tr>`;
  }).join('');
}

// ===================== CADASTRO DE FUNÇÃO / OPERADORES =====================
btnSalvarFuncao.addEventListener('click', async () => {
  const nome = document.getElementById('func-nome').value.trim();
  const salario = parseFloat(document.getElementById('func-salario').value);
  const nivel = document.getElementById('func-nivel').value;

  if (!nome || isNaN(salario)) {
    msgFuncao.style.color = "red"; msgFuncao.innerText = "Preencha dados válidos."; return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('funcoes').insert([{ nome, salario, nivel, user_id: user.id }]);

  if (!error) {
    document.getElementById('func-nome').value = ""; document.getElementById('func-salario').value = "";
    atualizarSelectFuncoes();
  }
});

btnSalvarColaborador.addEventListener('click', async () => {
  const nome = document.getElementById('colab-nome').value.trim();
  const cpf = document.getElementById('colab-cpf').value.trim();
  const funcao_id = selectFuncaoColab.value;

  if (!nome || !cpf || !funcao_id) { msgColaborador.innerText = "Campos obrigatórios ausentes."; return; }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('colaboradores').insert([{ nome, cpf, funcao_id, user_id: user.id }]);

  if (!error) {
    document.getElementById('colab-nome').value = ""; document.getElementById('colab-cpf').value = "";
    atualizarSelectColaboradores();
  }
});

// ===================== REFRESH DE PERFIS ADMIN =====================
btnAdminSalvarUsuario.addEventListener('click', async () => {
  const novoEmail = document.getElementById('adm-user-email').value.trim();
  const novaSenha = document.getElementById('adm-user-password').value;
  const roleAcesso = document.getElementById('adm-user-role').value;
  const modulos = [...document.querySelectorAll('.chk-acesso:checked')].map(cb => cb.value);

  if (!novoEmail || novaSenha.length < 6) return;

  const { error } = await supabaseClient.from('perfis_usuarios').insert([{ email: novoEmail, role: roleAcesso, password_hint: novaSenha, observacoes: `Modulos Permitidos: ${modulos.join(', ')}` }]);
  if (!error) {
    document.getElementById('adm-user-email').value = ""; document.getElementById('adm-user-password').value = "";
    carregarUsuariosSistema();
  }
});

// ===================== GESTÃO DE NAVEGAÇÃO INTERNA E GATILHOS =====================
function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');
  document.querySelectorAll('.app-section').forEach(el => el.style.display = 'none');
  const target = document.getElementById('section-' + name);
  if (target) target.style.display = 'block';

  if (name === 'dashboard') renderizarGraficosDashboard();
  if (name === 'relatorios') carregarHistoricoFichas();
  if (name === 'ordens') carregarOrdensServico();
  if (name === 'os-grid') carregarOSGeral();
  if (name === 'historico-os') carregarCentralUnificadaOS();
  if (name === 'usuarios') carregarUsuariosSistema();
}
