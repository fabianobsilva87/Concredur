const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ELEMENTOS DE LOGIN
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnCadastro = document.getElementById('btn-cadastro');
const btnLogout = document.getElementById('btn-logout');
const msg = document.getElementById('mensagem');
const loginBox = document.getElementById('login-box');
const appBox = document.getElementById('app-box');

// ELEMENTOS DE EQUIPAMENTO
const btnSalvar = document.getElementById('btn-salvar');
const btnLimpar = document.getElementById('btn-limpar');
const msgEq = document.getElementById('msg-equipamento');

// ELEMENTOS DA FICHA PMOC
const selectEquipamento = document.getElementById('pmoc-equipamento');
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
const msgFicha = document.getElementById('msg-ficha');
const fotoInput = document.getElementById('pmoc-foto');

// VERIFICAR SESSÃO AO CARREGAR O APP
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) mostrarApp();
});

// LOGIN
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

// CADASTRO DE USUÁRIO
btnCadastro.addEventListener('click', async () => {
  msg.style.color = "#fff";
  msg.innerText = "Processando cadastro...";
  const { error } = await supabaseClient.auth.signUp({
    email: emailInput.value, password: passwordInput.value,
  });
  if (error) {
    msg.style.color = "#ff4d4d";
    msg.innerText = "Erro ao cadastrar: " + error.message;
  } else {
    msg.style.color = "#2efd72";
    msg.innerText = "Cadastro realizado! Verifique seu e-mail.";
  }
});

// LOGOUT
btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  appBox.style.display = "none";
  loginBox.style.display = "flex";
  emailInput.value = "";
  passwordInput.value = "";
});

// MOSTRAR APP E CARREGAR INTERFACES (FUNÇÃO UNIFICADA)
function mostrarApp() {
  loginBox.style.display = "none";
  appBox.style.display = "flex";
  carregarEquipamentos();
  atualizarSelectEquipamentos();
  carregarHistoricoFichas();
}

// SALVAR NOVO EQUIPAMENTO
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
  const criticidade = document.getElementById('eq-criticidade').value;

  if (!tag || !marca || !produto) {
    msgEq.style.color = "red";
    msgEq.innerText = "Os campos TAG, Marca e Equipamento são obrigatórios.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from('equipamentos').insert([
    { 
      tag, marca, potencia, nr_serie, patrimonio, produto, 
      bloco, setor, sala, instituicao, validade, criticidade,
      user_id: user.id 
    }
  ]);

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

// LIMPAR FORMULÁRIO DE EQUIPAMENTOS
btnLimpar.addEventListener('click', limparFormulario);
function limparFormulario() {
  document.getElementById('eq-tag').value = "";
  document.getElementById('eq-marca').value = "";
  document.getElementById('eq-potencia').value = "";
  document.getElementById('eq-serie').value = "";
  document.getElementById('eq-patrimonio').value = "";
  document.getElementById('eq-produto').value = "";
  document.getElementById('eq-bloco').value = "";
  document.getElementById('eq-setor').value = "";
  document.getElementById('eq-sala').value = "";
  document.getElementById('eq-instituicao').value = "";
  document.getElementById('eq-validade').value = "";
  document.getElementById('eq-criticidade').value = "Média";
  msgEq.innerText = "";
}

// CARREGAR EQUIPAMENTOS NA TABELA
async function carregarEquipamentos() {
  const tbody = document.getElementById('tbody-equipamentos');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando...</td></tr>';

  const { data, error } = await supabaseClient
    .from('equipamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum equipamento cadastrado.</td></tr>';
    atualizarSelectEquipamentos(); 
    return;
  }

  tbody.innerHTML = data.map(eq => `
    <tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || 'N/A'}</strong><br><small style="color:#718096">${eq.marca || 'N/A'}</small></td>
      <td>${eq.bloco || '-'} / ${eq.setor || '-'} <br> <small style="color:#718096">${eq.sala || '-'}</small></td>
      <td><span class="tag-badge" style="background:#edf2f7; color:#2d3748">${eq.criticidade || 'Média'}</span></td>
      <td><button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕ Excluir</button></td>
    </tr>
  `).join('');

  atualizarSelectEquipamentos();
}

// EXCLUIR EQUIPAMENTO
async function excluirEquipamento(id) {
  if (!confirm("Confirma exclusão deste equipamento?")) return;
  const { error } = await supabaseClient.from('equipamentos').delete().eq('id', id);
  if (!error) carregarEquipamentos();
}

// ATUALIZAR SELECT DE EQUIPAMENTOS NA FICHA PMOC
async function atualizarSelectEquipamentos() {
  if (!selectEquipamento) return;

  const { data, error } = await supabaseClient
    .from('equipamentos')
    .select('id, tag, marca, produto');

  if (error || !data) return;

  selectEquipamento.innerHTML = '<option value="">-- Selecione o Equipamento (Tag) --</option>';
  data.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq.id;
    opt.textContent = `${eq.tag} - ${eq.produto || eq.marca}`;
    selectEquipamento.appendChild(opt);
  });
}

// SALVAR FICHA PMOC COM POLÍTICA DE ARQUIVOS (FOTO)
btnSalvarFicha.addEventListener('click', async () => {
  const equipamento_id = selectEquipamento.value;
  const tecnico_nome = document.getElementById('pmoc-tecnico').value.trim();
  const filtro_limpo = document.querySelector('input[name="filtro"]:checked')?.value;
  const serpentina_limpa = document.querySelector('input[name="serpentina"]:checked')?.value;
  const bandeja_limpa = document.querySelector('input[name="bandeja"]:checked')?.value;
  const ventilador_ok = document.querySelector('input[name="ventilador"]:checked')?.value;
  const observacoes = document.getElementById('pmoc-obs').value.trim();
  const arquivoFoto = fotoInput.files[0]; 

  if (!equipamento_id || !tecnico_nome || !filtro_limpo || !serpentina_limpa || !bandeja_limpa || !ventilador_ok) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Por favor, preencha todos os campos e avaliações.";
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

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('fotos-pmoc')
      .upload(nomeArquivo, arquivoFoto);

    if (uploadError) {
      msgFicha.style.color = "red";
      if (uploadError.message.includes("row-level security")) {
        msgFicha.innerText = "Erro no Storage: Ative as Políticas de Inserção (RLS) para o bucket 'fotos-pmoc' no painel do Supabase.";
      } else {
        msgFicha.innerText = "Erro ao enviar foto: " + uploadError.message;
      }
      return; 
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from('fotos-pmoc')
      .getPublicUrl(nomeArquivo);
      
    fotoUrl = publicUrlData.publicUrl;
  }

  msgFicha.innerText = "Salvando ficha técnica...";

  const { error } = await supabaseClient.from('fichas_pmoc').insert([
    {
      equipamento_id,
      user_id: user.id,
      tecnico_nome,
      filtro_limpo,
      serpentina_limpa,
      bandeja_limpa,
      ventilador_ok,
      observacoes,
      foto_url: fotoUrl 
    }
  ]);

  if (error) {
    msgFicha.style.color = "red";
    if (error.message.includes("row-level security")) {
      msgFicha.innerText = "Erro na Tabela: Ative a política de Inserção (RLS) para a tabela 'fichas_pmoc' no Supabase.";
    } else {
      msgFicha.innerText = "Erro ao salvar ficha: " + error.message;
    }
  } else {
    msgFicha.style.color = "green";
    msgFicha.innerText = "Ficha PMOC registrada com sucesso!";
    limparFormularioFicha();
    carregarHistoricoFichas(); 
    setTimeout(() => msgFicha.innerText = "", 4000);
  }
});

// LIMPAR CAMPOS DA FICHA PMOC
function limparFormularioFicha() {
  selectEquipamento.value = "";
  document.getElementById('pmoc-tecnico').value = "";
  document.getElementById('pmoc-obs').value = "";
  if (fotoInput) fotoInput.value = ""; 
  document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
}

// CARREGAR HISTÓRICO DE FICHAS PMOC
async function carregarHistoricoFichas() {
  const tbody = document.getElementById('tbody-fichas');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando histórico...</td></tr>';

  const { data, error } = await supabaseClient
    .from('fichas_pmoc')
    .select(`
      id, created_at, tecnico_nome, filtro_limpo, serpentina_limpa, bandeja_limpa, ventilador_ok, observacoes, foto_url,
      equipamentos (tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao, validade, criticidade)
    `)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhuma inspeção realizada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(ficha => {
    const dataFormatada = new Date(ficha.created_at).toLocaleDateString('pt-BR');
    const eq = ficha.equipamentos || { tag: "N/A", marca: "Desconhecido" };
    
    const temProblema = [ficha.filtro_limpo, ficha.serpentina_limpa, ficha.bandeja_limpa, ficha.ventilador_ok].includes("NC");
    const statusBadge = temProblema 
      ? '<span class="tag-badge" style="background:#fff5f5; color:#c53030;">Não Conforme</span>' 
      : '<span class="tag-badge" style="background:#f0fff4; color:#22543d;">Conforme</span>';

    const fichaStringificavel = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));

    return `
      <tr>
        <td>${dataFormatada}</td>
        <td><strong>${eq.tag}</strong> (${eq.produto || eq.marca})</td>
        <td>${ficha.tecnico_nome}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="emitirRelatorio('${fichaStringificavel}')">
            🖨 Emitir Relatório
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// GERAR DOCUMENTO EXPANDIDO E CHAMAR IMPRESSÃO
function emitirRelatorio(fichaBase64) {
  const ficha = JSON.parse(decodeURIComponent(escape(atob(fichaBase64))));
  const eq = ficha.equipamentos || {};
  const dataInspecao = new Date(ficha.created_at).toLocaleDateString('pt-BR');
  
  const areaLaudo = document.getElementById('area-laudo-impressao');
  
  areaLaudo.innerHTML = `
    <div class="laudo-header">
      <h2>RELATÓRIO TÉCNICO DE INSPEÇÃO PERIÓDICA - PMOC</h2>
      <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    </div>
    
    <div class="laudo-section">
      <h3>1. ESPECIFICAÇÕES TÉCNICAS DO ATIVO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>TAG Consolidada:</strong></td><td>${eq.tag || 'N/A'}</td><td><strong>Nº de Série:</strong></td><td>${eq.nr_serie || 'N/A'}</td></tr>
        <tr><td><strong>Equipamento / Produto:</strong></td><td>${eq.produto || 'N/A'}</td><td><strong>Plaqueta / Patrimônio:</strong></td><td>${eq.patrimonio || 'N/A'}</td></tr>
        <tr><td><strong>Marca Fabricante:</strong></td><td>${eq.marca || 'N/A'}</td><td><strong>Capacidade/Potência:</strong></td><td>${eq.potencia || 'N/A'}</td></tr>
        <tr><td><strong>Validade / Garantia:</strong></td><td>${eq.validade || 'N/A'}</td><td><strong>Nível de Criticidade:</strong></td><td>${eq.criticidade || 'N/A'}</td></tr>
      </table>
    </div>

    <div class="laudo-section">
      <h3>2. LOCALIZAÇÃO E DETALHES DE INSTALAÇÃO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>Instituição:</strong></td><td>${eq.instituicao || 'N/A'}</td><td><strong>Descrição do Bloco:</strong></td><td>${eq.bloco || 'N/A'}</td></tr>
        <tr><td><strong>Descrição do Setor:</strong></td><td>${eq.setor || 'N/A'}</td><td><strong>Nº Sala / LAB:</strong></td><td>${eq.sala || 'N/A'}</td></tr>
      </table>
    </div>

    <div class="laudo-section">
      <h3>3. HISTÓRICO DA INSPEÇÃO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>Data da Execução:</strong></td><td>${dataInspecao}</td></tr>
        <tr><td><strong>Responsável Técnico:</strong></td><td>${ficha.tecnico_nome}</td></tr>
      </table>
    </div>

    <div class="laudo-section">
      <h3>4. ITENS AVALIADOS E CHECKLIST OPERACIONAL</h3>
      <table class="table-laudo-checklist">
        <thead>
          <tr><th>Item de Controle</th><th style="text-align:center; width:120px;">Avaliação</th></tr>
        </thead>
        <tbody>
          <tr><td>Condições e Limpeza do Filtro de Ar</td><td style="text-align:center;"><strong>${ficha.filtro_limpo}</strong></td></tr>
          <tr><td>Condições e Limpeza da Serpentina</td><td style="text-align:center;"><strong>${ficha.serpentina_limpa}</strong></td></tr>
          <tr><td>Higienização e Dreno da Bandeja de Condensado</td><td style="text-align:center;"><strong>${ficha.bandeja_limpa}</strong></td></tr>
          <tr><td>Estado Geral do Conjunto Ventilador/Rotor</td><td style="text-align:center;"><strong>${ficha.ventilador_ok}</strong></td></tr>
        </tbody>
      </table>
      <small style="color:#555; font-size:10px; margin-top:5px; display:block;">Legenda: C = Conforme | NC = Não Conforme | NA = Não Aplicável</small>
    </div>

    <div class="laudo-section">
      <h3>5. PARECER TÉCNICO / OBSERVAÇÕES</h3>
      <div style="border: 1px solid #cbd5e0; padding:10px; border-radius:4px; font-size:12px; background:#fafafa; min-height:50px;">
        ${ficha.observacoes ? ficha.observacoes : 'Nenhuma observação extra relatada pelo técnico.'}
      </div>
    </div>

    ${ficha.foto_url ? `
    <div class="laudo-section" style="page-break-inside: avoid;">
      <h3>6. EVIDÊNCIA FOTOGRÁFICA REGISTRADA</h3>
      <div style="text-align:center; margin-top:10px;">
        <img src="${ficha.foto_url}" alt="Foto da Inspeção Técnica" class="laudo-img-preview" />
      </div>
    </div>
    ` : ''}

    <div class="laudo-footer">
      <div class="linha-assinatura"></div>
      <p>Assinatura do Técnico Responsável</p>
      <p style="font-size:10px; color:#a0aec0; margin-top:20px;">Documento gerado pelo Sistema de Gestão PMOC Automatizado</p>
    </div>
  `;

  window.print();
}

// NAVEGAÇÃO ENTRE AS SEÇÕES DO APP
function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');

  document.querySelectorAll('.app-section').forEach(el => el.style.display = 'none');
  const targetSection = document.getElementById('section-' + name);
  if (targetSection) targetSection.style.display = 'block';

  if (name === 'relatorios') {
    carregarHistoricoFichas();
  }
}
