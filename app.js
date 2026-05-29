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
  msg.style.color = "blue";
  msg.innerText = "Verificando acesso...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value, password: passwordInput.value,
  });
  if (error) {
    msg.style.color = "red";
    msg.innerText = "Erro no acesso: " + error.message;
  } else {
    msg.innerText = "";
    mostrarApp();
  }
});

// CADASTRO DE USUÁRIO
btnCadastro.addEventListener('click', async () => {
  msg.style.color = "blue";
  msg.innerText = "Processando cadastro...";
  const { error } = await supabaseClient.auth.signUp({
    email: emailInput.value, password: passwordInput.value,
  });
  if (error) {
    msg.style.color = "red";
    msg.innerText = "Erro ao cadastrar: " + error.message;
  } else {
    msg.style.color = "green";
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
  const marca = document.getElementById('eq-marca').value.trim();
  const potencia = document.getElementById('eq-potencia').value.trim();
  const tag = document.getElementById('eq-tag').value.trim();
  const patrimonio = document.getElementById('eq-patrimonio').value.trim();

  if (!marca || !potencia || !tag || !patrimonio) {
    msgEq.style.color = "red";
    msgEq.innerText = "Preencha todos os campos.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from('equipamentos').insert([
    { marca, potencia, tag, patrimonio, user_id: user.id }
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
  document.getElementById('eq-marca').value = "";
  document.getElementById('eq-potencia').value = "";
  document.getElementById('eq-tag').value = "";
  document.getElementById('eq-patrimonio').value = "";
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
      <td>${eq.marca}</td>
      <td>${eq.potencia}</td>
      <td>${eq.patrimonio}</td>
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
    .select('id, tag, marca');

  if (error || !data) return;

  selectEquipamento.innerHTML = '<option value="">-- Selecione o Equipamento (Tag) --</option>';
  data.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq.id;
    opt.textContent = `${eq.tag} - ${eq.marca}`;
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
    carregarHistoricoFichas(); // Sincroniza a aba de histórico
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

// CARREGAR HISTÓRICO DE FICHAS PMOC (COM JOIN DE EQUIPAMENTOS)
async function carregarHistoricoFichas() {
  const tbody = document.getElementById('tbody-fichas');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando histórico...</td></tr>';

  // Faz a requisição buscando os dados da ficha e as colunas linkadas da tabela equipamentos
  const { data, error } = await supabaseClient
    .from('fichas_pmoc')
    .select(`
      id,
      created_at,
      tecnico_nome,
      filtro_limpo,
      serpentina_limpa,
      bandeja_limpa,
      ventilador_ok,
      observacoes,
      foto_url,
      equipamentos (tag, marca, potencia, patrimonio)
    `)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhuma inspeção realizada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(ficha => {
    const dataFormatada = new Date(ficha.created_at).toLocaleDateString('pt-BR');
    const eq = ficha.equipamentos || { tag: "N/A", marca: "Desconhecido" };
    
    // Verifica se há alguma não conformidade (NC) listada nos checklists
    const temProblema = [ficha.filtro_limpo, ficha.serpentina_limpa, ficha.bandeja_limpa, ficha.ventilador_ok].includes("NC");
    const statusBadge = temProblema 
      ? '<span class="tag-badge" style="background:#fff5f5; color:#c53030;">Não Conforme</span>' 
      : '<span class="tag-badge" style="background:#f0fff4; color:#22543d;">Conforme</span>';

    // Guardar os dados convertidos em JSON para injetar de forma direta no escopo do botão de impressão
    const ficha Stringificável = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));

    return `
      <tr>
        <td>${dataFormatada}</td>
        <td><strong>${eq.tag}</strong> (${eq.marca})</td>
        <td>${ficha.tecnico_nome}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="emitirRelatorio('${fichaStringificável}')">
            🖨 Emitir Relatório
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// GERAR DOCUMENTO E CHAMAR IMPRESSÃO/SALVAMENTO EM PDF
function emitirRelatorio(fichaBase64) {
  // Decodifica o objeto da ficha que enviamos por parâmetro
  const ficha = JSON.parse(decodeURIComponent(escape(atob(fichaBase64))));
  const eq = ficha.equipamentos || {};
  const dataInspeção = new Date(ficha.created_at).toLocaleDateString('pt-BR');
  
  const areaLaudo = document.getElementById('area-laudo-impressao');
  
  // Estrutura HTML formal do documento de Laudo de PMOC
  areaLaudo.innerHTML = `
    <div class="laudo-header">
      <h2>RELATÓRIO TÉCNICO DE INSPEÇÃO PERIÓDICA - PMOC</h2>
      <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    </div>
    
    <div class="laudo-section">
      <h3>1. DADOS COMPLEMENTARES DO EQUIPAMENTO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>TAG Identificação:</strong></td><td>${eq.tag || 'N/A'}</td><td><strong>Patrimônio:</strong></td><td>${eq.patrimonio || 'N/A'}</td></tr>
        <tr><td><strong>Marca Fabricante:</strong></td><td>${eq.marca || 'N/A'}</td><td><strong>Capacidade/Potência:</strong></td><td>${eq.potencia || 'N/A'}</td></tr>
      </table>
    </div>

    <div class="laudo-section">
      <h3>2. HISTÓRICO DA INSPEÇÃO</h3>
      <table class="table-laudo-dados">
        <tr><td><strong>Data da Execução:</strong></td><td>${dataInspeção}</td></tr>
        <tr><td><strong>Responsável Técnico:</strong></td><td>${ficha.tecnico_nome}</td></tr>
      </table>
    </div>

    <div class="laudo-section">
      <h3>3. ITENS AVALIADOS E CHECKLIST OPERACIONAL</h3>
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
      <h3>4. PARECER TÉCNICO / OBSERVAÇÕES</h3>
      <div style="border: 1px solid #cbd5e0; padding:10px; border-radius:4px; font-size:12px; background:#fafafa; min-height:50px;">
        ${ficha.observacoes ? ficha.observacoes : 'Nenhuma observação extra relatada pelo técnico.'}
      </div>
    </div>

    ${ficha.foto_url ? `
    <div class="laudo-section" style="page-break-inside: avoid;">
      <h3>5. EVIDÊNCIA FOTOGRÁFICA REGISTRADA</h3>
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

  // Dispara a janela de impressão do Navegador (O CSS cuidará do resto ocultando o painel do app)
  window.print();
}

// NAVEGAÇÃO ENTRE AS SEÇÕES DO APP (EQUIPAMENTOS / FICHAS / RELATORIOS)
function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');

  document.querySelectorAll('.app-section').forEach(el => el.style.display = 'none');
  const targetSection = document.getElementById('section-' + name);
  if (targetSection) targetSection.style.display = 'block';

  // Se o usuário clicar na aba de histórico, atualiza os registros do banco automaticamente
  if (name === 'relatorios') {
    carregarHistoricoFichas();
  }
}
