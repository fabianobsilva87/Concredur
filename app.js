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

// ===================== ELEMENTOS DE O.S. GERAL =====================
const btnSalvarOSG = document.getElementById('btn-salvar-osg');
const msgOSG = document.getElementById('msg-osg');
const selectOSGTecnico = document.getElementById('osg-tecnico');

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

// ===================== LOGIN =====================
btnLogin.addEventListener('click', async () => {
  msg.style.color = "#ff4d4d";
  msg.innerText = "Verificando acesso...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value, password: passwordInput.value,
  });
  if (error) {
    msg.style.color = "#ff4d4d";
    msg.innerText = "Erro no acesso: " + error.message;
  } else {
    msg.innerText = "";
    mostrarApp();
  }
});

// ===================== LOGOUT =====================
btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  appBox.style.display = "none";
  loginBox.style.display = "flex";
  emailInput.value = "";
  passwordInput.value = "";
});

// ===================== MOSTRAR APP =====================
async function mostrarApp() {
  loginBox.style.display = "none";
  appBox.style.display = "flex";

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    document.getElementById('user-display-email').innerText = user.email;
    verificarRegraAdmin(user.email);
  }

  if (inputDatePMOC) {
    inputDatePMOC.value = new Date().toISOString().split('T')[0];
  }

  const dataOSG = document.getElementById('osg-data-chamada');
  if (dataOSG) dataOSG.value = new Date().toISOString().split('T')[0];

  carregarEquipamentos();
  atualizarSelectEquipamentos();
  carregarHistoricoFichas();
  atualizarSelectColaboradores();
  atualizarSelectFuncoes();
  carregarOrdensServico();
  carregarOSGeral();
  carregarCentralUnificadaOS();
  toggleItemsPorFrequencia();
  renderizarGraficosDashboard();
}

// ===================== VERIFICAÇÃO DE PERMISSÕES MASTER =====================
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

// ===================== LÓGICA DO DASHBOARD (INDICADORES) =====================
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

// ===================== GESTÃO DE USUÁRIOS COM PERFIS E MÓDULOS DE ACESSO =====================
btnAdminSalvarUsuario.addEventListener('click', async () => {
  const novoEmail = document.getElementById('adm-user-email').value.trim();
  const novaSenha = document.getElementById('adm-user-password').value;
  const roleAcesso = document.getElementById('adm-user-role').value;

  const modulosSelecionados = [...document.querySelectorAll('.chk-acesso:checked')].map(cb => cb.value);

  if (!novoEmail || novaSenha.length < 6) {
    msgAdminUsuario.style.color = "#ef4444";
    msgAdminUsuario.innerText = "Informe um e-mail válido e senha com no mínimo 6 caracteres.";
    return;
  }

  msgAdminUsuario.style.color = "#3b82f6";
  msgAdminUsuario.innerText = "Registrando credenciais e permissões na base...";

  const { error } = await supabaseClient.from('perfis_usuarios').insert([
    { 
      email: novoEmail, 
      role: roleAcesso, 
      password_hint: novaSenha,
      observacoes: `Modulos Permitidos: ${modulosSelecionados.join(', ')}`
    }
  ]);

  if (error) {
    msgAdminUsuario.style.color = "#ef4444";
    msgAdminUsuario.innerText = "Erro ao registrar: " + error.message;
  } else {
    msgAdminUsuario.style.color = "#10b981";
    msgAdminUsuario.innerText = "Usuário e perfil criados com sucesso!";
    document.getElementById('adm-user-email').value = "";
    document.getElementById('adm-user-password').value = "";
    carregarUsuariosSistema();
  }
});

async function carregarUsuariosSistema() {
  const tbody = document.getElementById('tbody-usuarios-sistema');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">Carregando operadores...</td></tr>';

  const { data, error } = await supabaseClient.from('perfis_usuarios').select('*').order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">Nenhum operador adicional cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(u => {
    let corBadge = "background:#fee2e2; color:#991b1b;"; 
    if(u.role === 'tecnico') corBadge = "background:#e0f2fe; color:#0369a1;";
    if(u.role === 'master') corBadge = "background:#fef3c7; color:#d97706;";
    if(u.role === 'auditor') corBadge = "background:#e2e8f0; color:#4a5568;";

    let modulos = "Padrão";
    if (u.observacoes && u.observacoes.includes("Modulos Permitidos:")) {
      modulos = u.observacoes.replace("Modulos Permitidos: ", "").split(', ').map(m => `<span class="badge-modulo">${m}</span>`).join('');
    }

    return `
      <tr>
        <td><strong>${u.email}</strong></td>
        <td><span class="badge-perfil" style="${corBadge}">${u.role}</span></td>
        <td>${modulos}</td>
        <td><button class="btn-excluir" style="padding: 2px 6px; font-size:10px;" onclick="excluirUsuarioSistema('${u.id}')">✕ Revogar</button></td>
      </tr>
    `;
  }).join('');
}

async function excluirUsuarioSistema(id) {
  if (!confirm("Revogar acesso deste usuário?")) return;
  const { error } = await supabaseClient.from('perfis_usuarios').delete().eq('id', id);
  if (!error) carregarUsuariosSistema();
}

// ===================== CADASTRO DE FUNÇÃO =====================
btnSalvarFuncao.addEventListener('click', async () => {
  const nome = document.getElementById('func-nome').value.trim();
  const salario = parseFloat(document.getElementById('func-salario').value);
  const nivel = document.getElementById('func-nivel').value;

  if (!nome || isNaN(salario)) {
    msgFuncao.style.color = "red";
    msgFuncao.innerText = "Preencha o nome da função e um salário válido.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('funcoes').insert([{ nome, salario, nivel, user_id: user.id }]);

  if (error) {
    msgFuncao.style.color = "red";
    msgFuncao.innerText = "Erro ao salvar: " + error.message;
  } else {
    msgFuncao.style.color = "green";
    msgFuncao.innerText = "Função cadastrada com sucesso!";
    document.getElementById('func-nome').value = "";
    document.getElementById('func-salario').value = "";
    atualizarSelectFuncoes();
  }
});

// ===================== CADASTRO DE COLABORADOR =====================
btnSalvarColaborador.addEventListener('click', async () => {
  const nome = document.getElementById('colab-nome').value.trim();
  const data_nascimento = document.getElementById('colab-nascimento').value || null;
  const cpf = document.getElementById('colab-cpf').value.trim();
  const data_contratacao = document.getElementById('colab-contratacao').value || null;
  const funcao_id = selectFuncaoColab.value;
  const data_promocao = document.getElementById('colab-promocao').value || null;

  if (!nome || !cpf || !funcao_id) {
    msgColaborador.style.color = "red";
    msgColaborador.innerText = "Nome, CPF e Função vinculada são obrigatórios.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('colaboradores').insert([{
    nome, data_nascimento, cpf, data_contratacao, funcao_id, data_promocao, user_id: user.id
  }]);

  if (error) {
    msgColaborador.style.color = "red";
    msgColaborador.innerText = "Erro ao salvar: " + error.message;
  } else {
    msgColaborador.style.color = "green";
    msgColaborador.innerText = "Colaborador cadastrado com sucesso!";
    document.getElementById('colab-nome').value = "";
    document.getElementById('colab-cpf').value = "";
    selectFuncaoColab.value = "";
    atualizarSelectColaboradores();
  }
});

async function atualizarSelectFuncoes() {
  if (!selectFuncaoColab) return;
  const { data, error } = await supabaseClient.from('funcoes').select('id, nome, nivel').order('nome', { ascending: true });
  selectFuncaoColab.innerHTML = '<option value="">-- Selecione uma Função cadastrada --</option>';
  if (!error && data) {
    data.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.nome} (${f.nivel})`;
      selectFuncaoColab.appendChild(opt);
    });
  }
}

async function atualizarSelectColaboradores() {
  if (!selectTecnicoPMOC) return;
  const { data, error } = await supabaseClient.from('colaboradores').select('id, nome').order('nome', { ascending: true });

  selectTecnicoPMOC.innerHTML = '<option value="">-- Selecione o Colaborador Registrado --</option>';
  if (selectOSTecnico) selectOSTecnico.innerHTML = '<option value="">-- Selecione o Colaborador Registrado --</option>';
  if (selectOSGTecnico) selectOSGTecnico.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';

  if (!error && data) {
    data.forEach(c => {
      const optP = document.createElement('option');
      optP.value = c.nome;
      optP.textContent = c.nome;
      selectTecnicoPMOC.appendChild(optP);

      if (selectOSTecnico) {
        const optOS = document.createElement('option');
        optOS.value = c.id;
        optOS.textContent = c.nome;
        selectOSTecnico.appendChild(optOS);
      }

      if (selectOSGTecnico) {
        const optOSG = document.createElement('option');
        optOSG.value = c.nome;
        optOSG.textContent = c.nome;
        selectOSGTecnico.appendChild(optOSG);
      }
    });
  }
}

// ===================== SALVAR EQUIPAMENTO =====================
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

// ===================== SALVAR FORMULÁRIO PMOC =====================
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
    msgFicha.innerText = "Preencha a data de inspeção, técnico e os itens mensais obrigatórios.";
    return;
  }

  msgFicha.style.color = "blue";
  msgFicha.innerText = "Processando informações...";

  const { data: { user } } = await supabaseClient.auth.getUser();
  let fotoUrl = null;

  if (arquivoFoto) {
    msgFicha.innerText = "Enviando imagem técnica...";
    const extensao = arquivoFoto.name.split('.').pop();
    const nomeArquivo = `${user.id}/${Date.now()}.${extensao}`;
    const { error: uploadError } = await supabaseClient.storage.from('fotos-pmoc').upload(nomeArquivo, arquivoFoto);
    if (uploadError) {
      msgFicha.style.color = "red";
      msgFicha.innerText = "Erro no Storage: " + uploadError.message;
      return;
    }
    const { data: publicUrlData } = supabaseClient.storage.from('fotos-pmoc').getPublicUrl(nomeArquivo);
    fotoUrl = publicUrlData.publicUrl;
  }

  msgFicha.innerText = "Salvando formulário de manutenção...";

  const { error } = await supabaseClient.from('fichas_pmoc').insert([{
    equipamento_id, user_id: user.id, tecnico_nome,
    observacoes: `[Frequência: ${freq_inspecao === 'M' ? 'Mensal' : 'Trimestral'}] \n[DataInspecao: ${data_escolhida}] \nChecklist: FIL-01:${fil_01} | BIO-01:${bio_01} | BIO-02:${bio_02} | MEC-01:${mec_01} | FIL-02:${fil_02} | BIO-03:${bio_03} | ELE-01:${ele_01} | ELE-02:${ele_02}\n\nObservações: ${observacoes}`,
    foto_url: fotoUrl
  }]);

  if (error) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Erro ao salvar: " + error.message;
  } else {
    msgFicha.style.color = "green";
    msgFicha.innerText = "Formulário PMOC registrado com sucesso!";
    limparFormularioFicha();
    carregarHistoricoFichas();
    setTimeout(() => msgFicha.innerText = "", 4000);
  }
});

function limparFormularioFicha() {
  selectEquipamento.value = "";
  selectTecnicoPMOC.value = "";
  document.getElementById('pmoc-obs').value = "";
  selectFrequencia.value = "M";
  inputDatePMOC.value = new Date().toISOString().split('T')[0];
  if (fotoInput) fotoInput.value = "";
  document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
  toggleItemsPorFrequencia();
}

async function carregarHistoricoFichas() {
  const tbody = document.getElementById('tbody-fichas');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Carregando histórico...</td></tr>';

  const { data, error } = await supabaseClient
    .from('fichas_pmoc')
    .select(`id, created_at, tecnico_nome, observacoes, foto_url,
      equipamentos (tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao, validade, criticidade)`)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Nenhum laudo PMOC localizado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(ficha => {
    const matchData = ficha.observacoes.match(/\[DataInspecao:\s*([\d-]+)\]/);
    const dataFormatada = matchData
      ? new Date(matchData[1] + "T00:00:00").toLocaleDateString('pt-BR')
      : new Date(ficha.created_at).toLocaleDateString('pt-BR');
    const eq = ficha.equipamentos || { tag: "N/A", marca: "Desconhecido" };
    const isTrimestral = ficha.observacoes.includes("Frequência: Trimestral");
    const fichaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));
    const laudoID = "L-PMOC-" + ficha.id.toString().slice(0, 6).toUpperCase();

    return `
      <tr>
        <td><span class="tag-badge" style="background:#f3f4f6; color:#374151;">${laudoID}</span></td>
        <td>${dataFormatada}</td>
        <td><strong>${eq.tag}</strong> (${eq.produto || eq.marca})</td>
        <td>${ficha.tecnico_nome}</td>
        <td><span class="tag-badge" style="background:#ebf4ff;color:#2b6cb0;">${isTrimestral ? 'Trimestral' : 'Mensal'}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="emitirRelatorio('${fichaB64}')">
            🖨 Emitir Relatório
          </button>
        </td>
      </tr>`;
  }).join('');
}

function emitirRelatorio(fichaBase64) {
  const ficha = JSON.parse(decodeURIComponent(escape(atob(fichaBase64))));
  const eq = ficha.equipamentos || {};
  const matchData = ficha.observacoes.match(/\[DataInspecao:\s*([\d-]+)\]/);
  const dataInspecao = matchData
    ? new Date(matchData[1] + "T00:00:00").toLocaleDateString('pt-BR')
    : new Date(ficha.created_at).toLocaleDateString('pt-BR');
  const isTrimestral = ficha.observacoes.includes("Frequência: Trimestral");
  const extrairNota = (id) => {
    const regex = new RegExp(`${id}:([C|NC|NA]+)`);
    const match = ficha.observacoes.match(regex);
    return match ? match[1] : 'NA';
  };
  const laudoID = "L-PMOC-" + ficha.id.toString().slice(0, 6).toUpperCase();

  document.getElementById('area-laudo-impressao').innerHTML = `
    <div class="laudo-header">
      <h2>FORMULÁRIO DE MANUTENÇÃO PMOC - ÁREA HOSPITALAR</h2>
      <p>Conforme Portaria MS nº 3.523/98 e ABNT NBR 16.401</p>
      <div style="margin-top:10px;font-weight:bold;color:#004f9f;text-transform:uppercase; font-size:13px;">
        CÓDIMENTO DOCUMENTO: ${laudoID} | MODALIDADE: ${isTrimestral ? 'TRIMESTRAL' : 'MENSAL'}
      </div>
    </div>
    <div class="laudo-section">
      <h3>1. IDENTIFICAÇÃO DO EQUIPAMENTO E LOCALIZAÇÃO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>Hospital / Unidade:</strong></td><td>${eq.instituicao || 'N/A'}</td><td><strong>Setor / Sala:</strong></td><td>${eq.bloco || ''} - ${eq.setor || ''} (${eq.sala || ''})</td></tr>
        <tr><td><strong>Tag do Equipamento:</strong></td><td>${eq.tag || 'N/A'}</td><td><strong>Modelo / Capacidade:</strong></td><td>${eq.produto || ''} ${eq.potencia || ''}</td></tr>
        <tr><td><strong>Técnico Responsável:</strong></td><td>${ficha.tecnico_nome}</td><td><strong>Data da Inspeção:</strong></td><td>${dataInspecao}</td></tr>
      </table>
    </div>
    <div class="laudo-section">
      <h3>2. ROTINAS EXECUTADAS E CHECKLIST OPERACIONAL</h3>
      <table class="table-laudo-checklist">
        <thead><tr><th>ID</th><th>Grupo</th><th>Descrição do Item / Rotina</th><th style="text-align:center;">Freq.</th><th style="text-align:center;">Avaliação</th></tr></thead>
        <tbody>
          <tr><td>FIL-01</td><td>Qualidade do Ar</td><td>Filtros de Ar (G4/F7/F9)</td><td style="text-align:center;">M</td><td style="text-align:center;"><strong>${extrairNota('FIL-01')}</strong></td></tr>
          <tr><td>BIO-01</td><td>Biocontrole</td><td>Bandeja de condensado e aplicação de pastilha</td><td style="text-align:center;">M</td><td style="text-align:center;"><strong>${extrairNota('BIO-01')}</strong></td></tr>
          <tr><td>BIO-02</td><td>Biocontrole</td><td>Dreno e teste de escoamento de água</td><td style="text-align:center;">M</td><td style="text-align:center;"><strong>${extrairNota('BIO-02')}</strong></td></tr>
          <tr><td>MEC-01</td><td>Mecânica</td><td>Ruídos, vibrações e fixação do motoventilador</td><td style="text-align:center;">M</td><td style="text-align:center;"><strong>${extrairNota('MEC-01')}</strong></td></tr>
          ${isTrimestral ? `
          <tr><td>FIL-02</td><td>Qualidade do Ar</td><td>Diferencial de pressão dos filtros</td><td style="text-align:center;">T</td><td style="text-align:center;"><strong>${extrairNota('FIL-02')}</strong></td></tr>
          <tr><td>BIO-03</td><td>Biocontrole</td><td>Limpeza química das serpentinas</td><td style="text-align:center;">T</td><td style="text-align:center;"><strong>${extrairNota('BIO-03')}</strong></td></tr>
          <tr><td>ELE-01</td><td>Elétrica</td><td>Medição elétrica (A) do compressor e motores</td><td style="text-align:center;">T</td><td style="text-align:center;"><strong>${extrairNota('ELE-01')}</strong></td></tr>
          <tr><td>ELE-02</td><td>Elétrica</td><td>Reaperto de contatos elétricos e painel</td><td style="text-align:center;">T</td><td style="text-align:center;"><strong>${extrairNota('ELE-02')}</strong></td></tr>
          ` : `<tr style="color:#a0aec0;"><td colspan="5" style="text-align:center;font-style:italic;padding:10px;">Rotinas trimestrais omitidas nesta folha mensal.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="laudo-section">
      <h3>3. OBSERVAÇÕES GERAIS / PENDÊNCIAS</h3>
      <div style="border:1px solid #cbd5e0;padding:10px;border-radius:4px;font-size:12px;background:#fafafa;min-height:60px;white-space:pre-wrap;">
        ${ficha.observacoes.split('\n\nObservações: ')[1] || 'Nenhuma pendência relatada.'}
      </div>
    </div>
    ${ficha.foto_url ? `
    <div class="laudo-section" style="page-break-inside:avoid;">
      <h3>4. EVIDÊNCIA FOTOGRÁFICA</h3>
      <div style="text-align:center;margin-top:10px;">
        <img src="${ficha.foto_url}" class="laudo-img-preview"/>
      </div>
    </div>` : ''}
    <div class="laudo-footer" style="margin-top:60px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-around;gap:40px;margin-bottom:20px;">
        <div style="text-align:center;">
          <div class="linha-assinatura" style="width:220px;margin:0 auto 8px auto;"></div>
          <p><strong>Assinatura do Técnico</strong></p>
          <p style="font-size:11px;color:#4a5568;">${ficha.tecnico_nome}</p>
        </div>
        <div style="text-align:center;">
          <div class="linha-assinatura" style="width:220px;margin:0 auto 8px auto;"></div>
          <p><strong>Responsável por Área</strong></p>
          <p style="font-size:11px;color:#a0aec0;">Assinatura / Carimbo</p>
        </div>
      </div>
      <p style="font-size:10px;color:#a0aec0;margin-top:30px;border-top:1px solid #edf2f7;padding-top:10px;">Documento gerado eletronicamente | Controle de Climatização Hospitalar</p>
    </div>`;

  window.print();
}

// ===================== SALVAR O.S. AR CONDICIONADO =====================
btnSalvarOS.addEventListener('click', async () => {
  const equipamento_id = selectOSEquipamento.value;
  const colaborador_id = selectOSTecnico.value;
  const tipo_os = selectOSTipo.value;
  const status_os = selectOSStatus.value;
  const descricao_defeito = txtOSDefeito.value.trim();
  const laudo_tecnico = txtOSLaudo.value.trim();

  if (!equipamento_id || !colaborador_id || !descricao_defeito) {
    msgOS.style.color = "red";
    msgOS.innerText = "Os campos Ativo, Realizado por e Descrição do Defeito são obrigatórios.";
    return;
  }

  msgOS.style.color = "blue";
  msgOS.innerText = "Registrando Ordem de Serviço...";

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('ordens_servico').insert([{
    equipamento_id, colaborador_id, tipo_os, status_os,
    descricao_defeito, laudo_tecnico, user_id: user.id
  }]);

  if (error) {
    msgOS.style.color = "red";
    msgOS.innerText = "Erro ao salvar O.S.: " + error.message;
  } else {
    msgOS.style.color = "green";
    msgOS.innerText = "Ordem de Serviço salva com sucesso!";
    txtOSDefeito.value = "";
    txtOSLaudo.value = "";
    selectOSEquipamento.value = "";
    selectOSTecnico.value = "";
    carregarOrdensServico();
    carregarCentralUnificadaOS();
  }
});

async function carregarOrdensServico() {
  const tbody = document.getElementById('tbody-os');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Carregando Ordens de Serviço...</td></tr>';

  const { data, error } = await supabaseClient
    .from('ordens_servico').select(`id, created_at, tipo_os, status_os, descricao_defeito, laudo_tecnico,
      equipamentos (tag, marca, produto, potencia, nr_serie, patrimonio, bloco, setor, sala, instituicao),
      colaboradores (nome, cpf)`).order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Nenhuma O.S. aberta no momento.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((os) => {
    const dataOS = new Date(os.created_at).toLocaleDateString('pt-BR');
    const eq = os.equipamentos || { tag: "N/A" };
    const colab = os.colaboradores || { nome: "Não Atribuído" };
    const numOS = "OS-AC-" + os.id.toString().slice(0, 5).toUpperCase();
    const osB64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));

    return `
      <tr>
        <td><strong>${numOS}</strong></td>
        <td>${dataOS}</td>
        <td><span class="tag-badge">${eq.tag}</span></td>
        <td>${colab.nome}</td>
        <td>${os.tipo_os}</td>
        <td><span class="tag-badge" style="background:#fef3c7;color:#d97706;">${os.status_os}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 10px;font-size:11px;background:#4b5563;" onclick="emitirLaudoOS('${osB64}','${numOS}')">
            🖨 Imprimir O.S.
          </button>
        </td>
      </tr>`;
  }).join('');
}

function emitirLaudoOS(osBase64, numOS) {
  const os = JSON.parse(decodeURIComponent(escape(atob(osBase64))));
  const eq = os.equipamentos || {};
  const colab = os.colaboradores || {};
  const dataOS = new Date(os.created_at).toLocaleDateString('pt-BR');

  document.getElementById('area-os-impressao').innerHTML = `
    <div class="laudo-header" style="border-bottom:2px solid #4a5568;">
      <h2>ORDEM DE SERVIÇO DE MANUTENÇÃO TÉCNICA - ${numOS}</h2>
      <p>Controle Técnico Operacional Integrado PMOC</p>
    </div>
    <div class="laudo-section">
      <h3>1. INFORMAÇÕES DE PROTOCOLO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>Data de Abertura:</strong></td><td>${dataOS}</td><td><strong>Tipo de O.S.:</strong></td><td>${os.tipo_os}</td></tr>
        <tr><td><strong>Status Atual:</strong></td><td>${os.status_os}</td><td><strong>Realizado Por:</strong></td><td>${colab.nome || 'N/A'}</td></tr>
      </table>
    </div>
    <div class="laudo-section">
      <h3>2. ESPECIFICAÇÕES DO ATIVO CLIMATIZADOR</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>TAG Identificação:</strong></td><td>${eq.tag || 'N/A'}</td><td><strong>Nº Série Fabricante:</strong></td><td>${eq.nr_serie || 'N/A'}</td></tr>
        <tr><td><strong>Equipamento / Marca:</strong></td><td>${eq.produto || ''} ${eq.marca || ''}</td><td><strong>Capacidade Técnica:</strong></td><td>${eq.potencia || 'N/A'}</td></tr>
        <tr><td><strong>Local de Instalação:</strong></td><td colspan="3">${eq.instituicao || ''} - Bloco: ${eq.bloco || ''} / Setor: ${eq.setor || ''} (${eq.sala || ''})</td></tr>
      </table>
    </div>
    <div class="laudo-section">
      <h3>3. DESCRIÇÃO DO DEFEITO / SOLICITAÇÃO INICIAL</h3>
      <div style="border:1px solid #cbd5e0;padding:12px;border-radius:4px;font-size:12px;background:#fafafa;min-height:50px;white-space:pre-wrap;">${os.descricao_defeito}</div>
    </div>
    <div class="laudo-section">
      <h3>4. LAUDO TÉCNICO COMPLETO / SERVIÇOS EXECUTADOS</h3>
      <div style="border:1px solid #cbd5e0;padding:12px;border-radius:4px;font-size:12px;background:#fafafa;min-height:100px;white-space:pre-wrap;">
        ${os.laudo_tecnico || 'Nenhum laudo técnico registrado até o momento.'}
      </div>
    </div>
    <div class="laudo-footer" style="margin-top:70px;">
      <div style="display:flex;justify-content:space-around;">
        <div><div class="linha-assinatura" style="width:200px;"></div><p>Assinatura do Técnico</p></div>
        <div><div class="linha-assinatura" style="width:200px;"></div><p>Assinatura do Cliente / Supervisor</p></div>
      </div>
      <p style="font-size:10px;color:#a0aec0;margin-top:30px;">Comprovante de Execução de Atividade Técnica de Refrigeração</p>
    </div>`;

  window.print();
}

// ===================== SALVAR O.S. GERAL =====================
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

  if (!setor || !servico_requisitado || !falha_relatada) {
    msgOSG.style.color = 'red';
    msgOSG.innerText = 'Preencha os campos obrigatórios: Serviço Requisitado, Setor e Falha Relatada.';
    return;
  }

  msgOSG.style.color = 'blue';
  msgOSG.innerText = 'Registrando O.S....';

  const { data: { user } } = await supabaseClient.auth.getUser();
  const numero_os = 'OSG-' + Date.now().toString().slice(-6);

  const { error } = await supabaseClient.from('ordens_servico_geral').insert([{
    numero_os, setor, servico_requisitado, tipo_manutencao,
    areas_servico, falha_relatada, equipamento, marca,
    data_chamada, data_entrega, realizado_por,
    aceite_servico, observacoes, status_os, user_id: user.id
  }]);

  if (error) {
    msgOSG.style.color = 'red';
    msgOSG.innerText = 'Erro ao salvar: ' + error.message;
  } else {
    msgOSG.style.color = 'green';
    msgOSG.innerText = 'Ordem de Serviço Geral salva com sucesso!';
    limparFormOSG();
    carregarOSGeral();
    carregarCentralUnificadaOS();
    setTimeout(() => msgOSG.innerText = '', 3000);
  }
});

function limparFormOSG() {
  document.getElementById('osg-requisitado').value = '';
  document.getElementById('osg-setor').value = '';
  document.getElementById('osg-falha').value = '';
  document.getElementById('osg-equipamento').value = '';
  document.getElementById('osg-marca').value = '';
  document.getElementById('osg-data-entrega').value = '';
  document.getElementById('osg-aceite').value = '';
  document.getElementById('osg-obs').value = '';
  document.getElementById('osg-data-chamada').value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[name="osg-area"]').forEach(c => c.checked = false);
  const prev = document.querySelector('input[name="osg-tipo"][value="Preventiva"]');
  if (prev) prev.checked = true;
  if (selectOSGTecnico) selectOSGTecnico.value = '';
}

async function carregarOSGeral() {
  const tbody = document.getElementById('tbody-osg');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Carregando...</td></tr>';

  const { data, error } = await supabaseClient
    .from('ordens_servico_geral').select('*').order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">Nenhuma O.S. registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((os) => {
    const dataOS = os.data_chamada
      ? new Date(os.data_chamada + 'T00:00:00').toLocaleDateString('pt-BR')
      : new Date(os.created_at).toLocaleDateString('pt-BR');
    const areas = (os.areas_servico || []).join(', ') || '—';
    const numOS = os.numero_os || "OSG-" + os.id.toString().slice(0,5).toUpperCase();
    const osB64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `
      <tr>
        <td><strong>${numOS}</strong></td>
        <td>${dataOS}</td>
        <td>${os.setor}</td>
        <td style="font-size:11px;">${areas}</td>
        <td>${os.tipo_manutencao}</td>
        <td><span class="tag-badge" style="background:#fef3c7;color:#d97706;">${os.status_os}</span></td>
        <td style="display:flex;gap:6px;">
          <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="imprimirOSGeral('${osB64}')">🖨 Imprimir</button>
          <button class="btn-excluir" onclick="excluirOSGeral('${os.id}')">✕</button>
        </td>
      </tr>`;
  }).join('');
}

async function excluirOSGeral(id) {
  if (!confirm('Confirma exclusão desta O.S.?')) return;
  const { error } = await supabaseClient.from('ordens_servico_geral').delete().eq('id', id);
  if (!error) {
    carregarOSGeral();
    carregarCentralUnificadaOS();
  }
}

function imprimirOSGeral(osBase64) {
  const os = JSON.parse(decodeURIComponent(escape(atob(osBase64))));
  const areas = os.areas_servico || [];

  const dataFormatada = os.data_chamada
    ? new Date(os.data_chamada + 'T00:00:00').toLocaleDateString('pt-BR')
    : new Date(os.created_at).toLocaleDateString('pt-BR');

  const dataEntrega = os.data_entrega
    ? new Date(os.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR')
    : '___/___/______';

  const checkTipo = (val) => os.tipo_manutencao === val ? '(X)' : '(&nbsp;&nbsp;)';
  const checkArea = (val) => areas.includes(val) ? '☑' : '☐';

  document.getElementById('area-osg-impressao').innerHTML = `
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;max-width:720px;margin:0 auto;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px;">
        <div style="font-size:20px;font-weight:800;color:#1a202c;letter-spacing:1px;">
          UNIVAG<br><span style="font-size:11px;font-weight:400;color:#4a5568;">Centro Universitário</span>
        </div>
        <div style="border:2px solid #000;padding:8px 24px;text-align:center;">
          <strong style="font-size:15px;letter-spacing:1px;">ORDEM DE SERVIÇO</strong>
          <div style="font-size:11px;color:#4a5568;margin-top:4px;">Nº ${os.numero_os || '—'}</div>
        </div>
      </div>

      <div style="margin-bottom:12px;"><p><strong>Serviço Requisitado:</strong> ${os.servico_requisitado}</p></div>
      <div style="margin-bottom:14px;"><p><strong>Setor:</strong> ${os.setor}</p></div>

      <div style="margin-bottom:12px;">
        <strong>Serviço solicitado:</strong>&nbsp;
        ${checkTipo('Corretiva')} MANUT. CORRETIVA &nbsp;
        ${checkTipo('Preventiva')} MANUT. PREVENTIVA &nbsp;
        ${checkTipo('Reforma')} REFORMA &nbsp;
        ${checkTipo('Nova Obra')} NOVA OBRA &nbsp;
        ${checkTipo('Inspeção de Rota')} INSPEÇÃO DE ROTA &nbsp;
        ${checkTipo('Projeto')} PROJETO
      </div>

      <div style="margin-bottom:16px;">
        <strong>Serviço:</strong>&nbsp;
        ${checkArea('Ar Condicionado')} Ar Condicionado &nbsp;&nbsp;
        ${checkArea('Elétrica')} Elétrica &nbsp;&nbsp;
        ${checkArea('Hidráulica')} Hidráulica &nbsp;&nbsp;
        ${checkArea('Lógica e Telefonia')} Lógica e Telefonia<br>
        <span style="margin-left:56px;">
          ${checkArea('Impermeabilização')} Impermeabilização &nbsp;&nbsp;
          ${checkArea('Construção Civil')} Construção Civil &nbsp;&nbsp;
          ${checkArea('Marcenaria')} Marcenaria
        </span>
      </div>

      <div style="margin-bottom:16px;">
        <strong>Falha relatada / serviço solicitado:</strong>
        <div style="border:1px solid #cbd5e0;border-radius:3px;padding:10px;margin-top:6px;min-height:60px;background:#fafafa;white-space:pre-wrap;">
          ${os.falha_relatada || '—'}
        </div>
      </div>

      <div style="display:flex;gap:40px;margin-bottom:14px;">
        <p><strong>Equipamento:</strong> ${os.equipamento || '________________________'}</p>
        <p><strong>Marca:</strong> ${os.marca || '________________________'}</p>
      </div>

      <div style="margin-bottom:10px;"><strong>Data da Chamada:</strong> ${dataFormatada}</div>
      <div style="margin-bottom:14px;"><strong>Data de entrega do serviço:</strong> ${dataEntrega}</div>

      <div style="margin-bottom:12px;">
        <strong>Realizado Por:</strong>
        <span style="border-bottom:1px solid #000;display:inline-block;min-width:300px;padding-bottom:2px;">
          ${os.realizado_por || ''}
        </span>
      </div>

      <div style="margin-bottom:12px;">
        <strong>Aceite do Serviço:</strong>
        <span style="border-bottom:1px solid #000;display:inline-block;min-width:280px;padding-bottom:2px;">
          ${os.aceite_servico || ''}
        </span>
      </div>

      <div style="margin-bottom:20px;">
        <strong>(OBS:)</strong>
        <span style="border-bottom:1px solid #000;display:inline-block;min-width:340px;padding-bottom:2px;">
          ${os.observacoes || ''}
        </span>
      </div>

      <div style="display:flex;justify-content:space-around;margin-top:60px;page-break-inside:avoid;">
        <div style="text-align:center;">
          <div style="width:200px;height:1px;background:#000;margin:0 auto 6px;"></div>
          <p style="font-size:11px;">Técnico Responsável</p>
          <p style="font-size:10px;color:#4a5568;">${os.realizado_por || ''}</p>
        </div>
        <div style="text-align:center;">
          <div style="width:200px;height:1px;background:#000;margin:0 auto 6px;"></div>
          <p style="font-size:11px;">Aceite / Responsável pela Área</p>
          <p style="font-size:10px;color:#4a5568;">${os.aceite_servico || ''}</p>
        </div>
      </div>

      <p style="font-size:10px;color:#a0aec0;margin-top:30px;border-top:1px solid #edf2f7;padding-top:8px;text-align:center;">
        Documento gerado pelo Sistema PMOC | ${dataFormatada}
      </p>
    </div>`;

  window.print();
}

// ===================== CENTRAL DE RELATÓRIOS UNIFICADOS =====================
async function carregarCentralUnificadaOS() {
  const tbody = document.getElementById('tbody-central-unificada-os');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Consolidando histórico de laudos...</td></tr>';

  const { data, error } = await supabaseClient
    .from('relatorio_unificado_os')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">Nenhuma O.S. emitida no histórico unificado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(doc => {
    const dataDoc = new Date(doc.created_at).toLocaleDateString('pt-BR');
    const prefixo = doc.modulo_origem === 'Ar Condicionado' ? 'OS-AC-' : 'OS-GEN-';
    const docID = prefixo + doc.id.toString().slice(0, 5).toUpperCase();
    const badgeModulo = doc.modulo_origem === 'Ar Condicionado' 
      ? `<span class="tag-badge" style="background:#e0f2fe; color:#0369a1;">${doc.modulo_origem}</span>` 
      : `<span class="tag-badge" style="background:#f3f4f6; color:#4b5563;">${doc.modulo_origem}</span>`;

    return `
      <tr>
        <td><strong>${docID}</strong></td>
        <td>${dataDoc}</td>
        <td>${badgeModulo}</td>
        <td><small>${doc.categoria_servico}</small></td>
        <td><span style="display:inline-block; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${doc.resumo_solicitacao || '—'}</span></td>
        <td><span class="tag-badge" style="background:#def7ec; color:#03543f;">${doc.status_os}</span></td>
      </tr>`;
  }).join('');
}
