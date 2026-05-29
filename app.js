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

// ELEMENTOS DO FORMULÁRIO PMOC
const selectEquipamento = document.getElementById('pmoc-equipamento');
const selectFrequencia = document.getElementById('pmoc-frequencia');
const selectTecnicoPMOC = document.getElementById('pmoc-tecnico');
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
const msgFicha = document.getElementById('msg-ficha');
const fotoInput = document.getElementById('pmoc-foto');

// ELEMENTOS DE RH (FUNÇÕES E COLABORADORES)
const btnSalvarFuncao = document.getElementById('btn-salvar-funcao');
const msgFuncao = document.getElementById('msg-funcao');
const btnSalvarColaborador = document.getElementById('btn-salvar-colaborador');
const msgColaborador = document.getElementById('msg-colaborador');
const selectFuncaoColab = document.getElementById('colab-funcao');

// ELEMENTOS DE CONFIGURAÇÃO DA CONTA
const btnAtualizarSenha = document.getElementById('btn-atualizar-senha');
const msgConta = document.getElementById('msg-conta');

// LÓGICA DO FLUXOGRAMA DE CRITICIDADE (BASEADO NA MATRIZ DE CRITICIDADE)
function calcularCriticidadeFluxograma() {
  const q1 = document.getElementById('crit-q1').value; // Interrompe produção
  const q2 = document.getElementById('crit-q2').value; // Risco segurança/meio ambiente
  const q3 = document.getElementById('crit-q3').value; // Tem reserva?

  let resultado = "Média (B)";
  
  if (q1 === "sim" || q2 === "sim") {
    if (q3 === "nao") {
      resultado = "Alta (A)";
    } else {
      resultado = "Média (B)";
    }
  } else {
    if (q3 === "sim") {
      resultado = "Baixa (C)";
    } else {
      resultado = "Média (B)";
    }
  }
  
  document.getElementById('label-criticidade-calculada').innerText = resultado;
  return resultado.split(" ")[0]; // Retorna "Alta", "Média" ou "Baixa"
}

function toggleItemsPorFrequencia() {
  const freq = selectFrequencia.value;
  const itensTrimestrais = document.querySelectorAll('.freq-item-t');
  
  itensTrimestrais.forEach(item => {
    if (freq === 'T') {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
      item.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    }
  });
}

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

// LOGOFF
btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  appBox.style.display = "none";
  loginBox.style.display = "flex";
  emailInput.value = "";
  passwordInput.value = "";
});

// MOSTRAR APP E CARREGAR INTERFACES SINCRO-DEDICADAS
async function mostrarApp() {
  loginBox.style.display = "none";
  appBox.style.display = "flex";
  
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    document.getElementById('user-display-email').innerText = user.email;
  }

  carregarEquipamentos();
  atualizarSelectEquipamentos();
  carregarHistoricoFichas();
  atualizarSelectColaboradores();
  atualizarSelectFuncoes();
  toggleItemsPorFrequencia();
}

// CADASTRO DE FUNÇÃO / CARGO
btnSalvarFuncao.addEventListener('click', async () => {
  const nome = document.getElementById('func-nome').value.trim();
  const salario = document.getElementById('func-salario').value.trim();
  const nivel = document.getElementById('func-nivel').value;

  if (!nome || !salario) {
    msgFuncao.style.color = "red";
    msgFuncao.innerText = "Preencha o nome da função e o salário base.";
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from('funcoes').insert([{ nome, salario, nivel, user_id: user.id }]);

  if (error) {
    msgFuncao.style.color = "red";
    msgFuncao.innerText = "Erro: " + error.message;
  } else {
    msgFuncao.style.color = "green";
    msgFuncao.innerText = "Função cadastrada com sucesso!";
    document.getElementById('func-nome').value = "";
    document.getElementById('func-salario').value = "";
    atualizarSelectFuncoes();
  }
});

// CADASTRO DE COLABORADOR
btnSalvarColaborador.addEventListener('click', async () => {
  const nome = document.getElementById('colab-nome').value.trim();
  const data_nascimento = document.getElementById('colab-nascimento').value;
  const cpf = document.getElementById('colab-cpf').value.trim();
  const data_contratacao = document.getElementById('colab-contratacao').value;
  const funcao_id = selectFuncaoColab.value;
  const data_promocao = document.getElementById('colab-promocao').value;

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
    msgColaborador.innerText = "Erro: " + error.message;
  } else {
    msgColaborador.style.color = "green";
    msgColaborador.innerText = "Colaborador cadastrado com sucesso!";
    document.getElementById('colab-nome').value = "";
    document.getElementById('colab-cpf').value = "";
    selectFuncaoColab.value = "";
    atualizarSelectColaboradores();
  }
});

// BUSCA DINÂMICA DE FUNÇÕES PARA O RH
async function atualizarSelectFuncoes() {
  if (!selectFuncaoColab) return;
  const { data, error } = await supabaseClient.from('funcoes').select('id, nome, nivel');
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

// BUSCA DINÂMICA DE COLABORADORES PARA MANUTENÇÃO / PMOC
async function atualizarSelectColaboradores() {
  if (!selectTecnicoPMOC) return;
  const { data, error } = await supabaseClient.from('colaboradores').select('id, nome');
  
  selectTecnicoPMOC.innerHTML = '<option value="">-- Selecione o Colaborador Registrado --</option>';
  const osTecnico = document.getElementById('os-tecnico');
  if (osTecnico) osTecnico.innerHTML = '<option value="">-- Selecione o Técnico --</option>';

  if (!error && data) {
    data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.nome; // Injeta o nome diretamente para rastreabilidade de laudos
      opt.textContent = c.nome;
      selectTecnicoPMOC.appendChild(opt);

      if (osTecnico) {
        const optOS = document.createElement('option');
        optOS.value = c.id;
        optOS.textContent = c.nome;
        osTecnico.appendChild(optOS);
      }
    });
  }
}

// SALVAR EQUIPAMENTO COM CRITICIDADE DO FLUXOGRAMA
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
  const criticidade = calcularCriticidadeFluxograma(); // Executa o fluxograma em tempo real

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
  document.getElementById('crit-q1').value = "nao";
  document.getElementById('crit-q2').value = "nao";
  document.getElementById('crit-q3').value = "nao";
  calcularCriticidadeFluxograma();
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
      <td><span class="tag-badge" style="background:#ebf4ff; color:#2b6cb0">${eq.criticidade || 'Média'}</span></td>
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

// ATUALIZAR SELECT DE EQUIPAMENTOS
async function atualizarSelectEquipamentos() {
  if (!selectEquipamento) return;

  const { data, error } = await supabaseClient
    .from('equipamentos')
    .select('id, tag, marca, produto');

  selectEquipamento.innerHTML = '<option value="">-- Selecione o Ativo (Tag) --</option>';
  const osEq = document.getElementById('os-equipamento');
  if (osEq) osEq.innerHTML = '<option value="">-- Selecione o Ativo --</option>';

  if (!error && data) {
    data.forEach(eq => {
      const opt = document.createElement('option');
      opt.value = eq.id;
      opt.textContent = `${eq.tag} - ${eq.produto || eq.marca}`;
      selectEquipamento.appendChild(opt);

      if (osEq) {
        const optOS = document.createElement('option');
        optOS.value = eq.id;
        optOS.textContent = eq.tag;
        osEq.appendChild(optOS);
      }
    });
  }
}

// SALVAR FORMULÁRIO PMOC HOSPITALAR
btnSalvarFicha.addEventListener('click', async () => {
  const equipamento_id = selectEquipamento.value;
  const tecnico_nome = selectTecnicoPMOC.value;
  const freq_inspecao = selectFrequencia.value;
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

  if (!equipamento_id || !tecnico_nome || !fil_01 || !bio_01 || !bio_02 || !mec_01) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Por favor, preencha todos os itens mensais obrigatórios e escolha o técnico.";
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

    const { error: uploadError } = await supabaseClient.storage
      .from('fotos-pmoc')
      .upload(nomeArquivo, arquivoFoto);

    if (uploadError) {
      msgFicha.style.color = "red";
      msgFicha.innerText = "Erro no Storage: " + uploadError.message;
      return; 
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from('fotos-pmoc')
      .getPublicUrl(nomeArquivo);
      
    fotoUrl = publicUrlData.publicUrl;
  }

  msgFicha.innerText = "Salvando formulário de manutenção...";

  const { error } = await supabaseClient.from('fichas_pmoc').insert([
    {
      equipamento_id,
      user_id: user.id,
      tecnico_nome,
      observacoes: `[Frequência: ${freq_inspecao === 'M' ? 'Mensal' : 'Trimestral'}] \nChecklist: FIL-01:${fil_01} | BIO-01:${bio_01} | BIO-02:${bio_02} | MEC-01:${mec_01} | FIL-02:${fil_02} | BIO-03:${bio_03} | ELE-01:${ele_01} | ELE-02:${ele_02}\n\nObservações: ${observacoes}`,
      foto_url: fotoUrl
    }
  ]);

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

// LIMPAR CAMPOS DO FORMULÁRIO PMOC
function limparFormularioFicha() {
  selectEquipamento.value = "";
  selectTecnicoPMOC.value = "";
  document.getElementById('pmoc-obs').value = "";
  selectFrequencia.value = "M";
  if (fotoInput) fotoInput.value = ""; 
  document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
  toggleItemsPorFrequencia();
}

// CARREGAR HISTÓRICO DE FORMULÁRIOS PMOC
async function carregarHistoricoFichas() {
  const tbody = document.getElementById('tbody-fichas');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando histórico...</td></tr>';

  const { data, error } = await supabaseClient
    .from('fichas_pmoc')
    .select(`
      id, created_at, tecnico_nome, observacoes, foto_url,
      equipamentos (tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, instituicao, validade, criticidade)
    `)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum formulário realizado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(ficha => {
    const dataFormatada = new Date(ficha.created_at).toLocaleDateString('pt-BR');
    const eq = ficha.equipamentos || { tag: "N/A", marca: "Desconhecido" };
    const isTrimestral = ficha.observacoes.includes("Frequência: Trimestral");
    const labelFreq = isTrimestral ? "Trimestral" : "Mensal";

    const fichaStringificavel = btoa(unescape(encodeURIComponent(JSON.stringify(ficha))));

    return `
      <tr>
        <td>${dataFormatada}</td>
        <td><strong>${eq.tag}</strong> (${eq.produto || eq.marca})</td>
        <td>${ficha.tecnico_nome}</td>
        <td><span class="tag-badge" style="background:#ebf4ff; color:#2b6cb0;">${labelFreq}</span></td>
        <td>
          <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="emitirRelatorio('${fichaStringificavel}')">
            🖨 Emitir Relatório
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// GERAR DOCUMENTO E IMPRIMIR
function emitirRelatorio(fichaBase64) {
  const ficha = JSON.parse(decodeURIComponent(escape(atob(fichaBase64))));
  const eq = ficha.equipamentos || {};
  const dataInspecao = new Date(ficha.created_at).toLocaleDateString('pt-BR');
  const isTrimestral = ficha.observacoes.includes("Frequência: Trimestral");

  const extrairNota = (id) => {
    const regex = new RegExp(`${id}:([C|NC|NA]+)`);
    const match = ficha.observacoes.match(regex);
    return match ? match[1] : 'NA';
  };

  const areaLaudo = document.getElementById('area-laudo-impressao');
  
  areaLaudo.innerHTML = `
    <div class="laudo-header">
      <h2>FORMULÁRIO DE MANUTENÇÃO PMOC - ÁREA HOSPITALAR</h2>
      <p>Conforme Portaria MS nº 3.523/98 e ABNT NBR 16.401</p>
      <div style="margin-top:10px; font-weight:bold; color:#004f9f; text-transform:uppercase;">
        MODALIDADE DA INSPEÇÃO: ${isTrimestral ? 'TRIMESTRAL' : 'MENSAL'}
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
        <thead>
          <tr><th>ID</th><th>Grupo</th><th>Descrição do Item / Rotina</th><th style="text-align:center;">Freq.</th><th style="text-align:center;">Avaliação</th></tr>
        </thead>
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
          ` : `
          <tr style="color:#a0aec0;"><td colspan="5" style="text-align:center; font-style:italic; padding:10px;">Rotinas trimestrais omitidas nesta folha mensal.</td></tr>
          `}
        </tbody>
      </table>
    </div>

    <div class="laudo-section">
      <h3>3. OBSERVAÇÕES GERAIS / PENDÊNCIAS</h3>
      <div style="border: 1px solid #cbd5e0; padding:10px; border-radius:4px; font-size:12px; background:#fafafa; min-height:60px; white-space: pre-wrap;">
        ${ficha.observacoes.split('\n\nObservações: ')[1] || 'Nenhuma pendência relatada.'}
      </div>
    </div>

    ${ficha.foto_url ? `
    <div class="laudo-section" style="page-break-inside: avoid;">
      <h3>4. EVIDÊNCIA FOTOGRÁFICA</h3>
      <div style="text-align:center; margin-top:10px;">
        <img src="${ficha.foto_url}" class="laudo-img-preview" />
      </div>
    </div>
    ` : ''}

    <div class="laudo-footer">
      <div class="linha-assinatura"></div>
      <p>Assinatura do Técnico: ${ficha.tecnico_nome}</p>
      <p style="font-size:10px; color:#a0aec0; margin-top:15px;">Documento gerado eletronicamente | Página 1 de 1</p>
    </div>
  `;

  window.print();
}

// LOGICA DE TROCA DE SENHA
btnAtualizarSenha.addEventListener('click', async () => {
  const novaSenha = document.getElementById('account-new-password').value;
  const confirmaSenha = document.getElementById('account-confirm-password').value;

  if (!novaSenha || !confirmaSenha) {
    msgConta.style.color = "red";
    msgConta.innerText = "Por favor, preencha ambos os campos.";
    return;
  }

  if (novaSenha.length < 6) {
    msgConta.style.color = "red";
    msgConta.innerText = "A senha deve conter no mínimo 6 caracteres.";
    return;
  }

  if (novaSenha !== confirmaSenha) {
    msgConta.style.color = "red";
    msgConta.innerText = "As senhas informadas não coincidem.";
    return;
  }

  msgConta.style.color = "blue";
  msgConta.innerText = "Processando atualização de credenciais...";

  const { error } = await supabaseClient.auth.updateUser({ password: novaSenha });

  if (error) {
    msgConta.style.color = "red";
    msgConta.innerText = "Erro ao atualizar: " + error.message;
  } else {
    msgConta.style.color = "green";
    msgConta.innerText = "Senha alterada com sucesso!";
    document.getElementById('account-new-password').value = "";
    document.getElementById('account-confirm-password').value = "";
    setTimeout(() => msgConta.innerText = "", 4000);
  }
});

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
