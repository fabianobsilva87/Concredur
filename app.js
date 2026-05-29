const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos de login
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnCadastro = document.getElementById('btn-cadastro');
const btnLogout = document.getElementById('btn-logout');
const msg = document.getElementById('mensagem');
const loginBox = document.getElementById('login-box');
const appBox = document.getElementById('app-box');

// Elementos de equipamento
const btnSalvar = document.getElementById('btn-salvar');
const btnLimpar = document.getElementById('btn-limpar');
const msgEq = document.getElementById('msg-equipamento');

// Verificar sessão ao carregar
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) mostrarApp();
});

// Login
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

// Cadastro
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

// Logout
btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  appBox.style.display = "none";
  loginBox.style.display = "flex";
  emailInput.value = "";
  passwordInput.value = "";
});

// Mostrar app e carregar dados
function mostrarApp() {
  loginBox.style.display = "none";
  appBox.style.display = "flex";
  carregarEquipamentos();
}

// Salvar equipamento
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

// Limpar formulário
btnLimpar.addEventListener('click', limparFormulario);
function limparFormulario() {
  document.getElementById('eq-marca').value = "";
  document.getElementById('eq-potencia').value = "";
  document.getElementById('eq-tag').value = "";
  document.getElementById('eq-patrimonio').value = "";
  msgEq.innerText = "";
}

// Carregar equipamentos
async function carregarEquipamentos() {
  const tbody = document.getElementById('tbody-equipamentos');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Carregando...</td></tr>';

  const { data, error } = await supabaseClient
    .from('equipamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Nenhum equipamento cadastrado.</td></tr>';
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
}

// Excluir equipamento
async function excluirEquipamento(id) {
  if (!confirm("Confirma exclusão deste equipamento?")) return;
  const { error } = await supabaseClient.from('equipamentos').delete().eq('id', id);
  if (!error) carregarEquipamentos();
}

// Navegação
function showSection(name) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');
}
// --- NOVOS ELEMENTOS DA FICHA PMOC ---
const selectEquipamento = document.getElementById('pmoc-equipamento');
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
const msgFicha = document.getElementById('msg-ficha');

// Modificar a função mostrarApp para carregar também os equipamentos no formulário do PMOC
function mostrarApp() {
  loginBox.style.display = "none";
  appBox.style.display = "flex";
  carregarEquipamentos();
  atualizarSelectEquipamentos(); // <--- Nova chamada
}

// Preenche o <select> do formulário PMOC com os equipamentos ativos
async function atualizarSelectEquipamentos() {
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

// Salvar a Ficha PMOC no Supabase
btnSalvarFicha.addEventListener('click', async () => {
  const equipamento_id = selectEquipamento.value;
  const tecnico_nome = document.getElementById('pmoc-tecnico').value.trim();
  const filtro_limpo = document.querySelector('input[name="filtro"]:checked')?.value;
  const serpentina_limpa = document.querySelector('input[name="serpentina"]:checked')?.value;
  const bandeja_limpa = document.querySelector('input[name="bandeja"]:checked')?.value;
  const ventilador_ok = document.querySelector('input[name="ventilador"]:checked')?.value;
  const observacoes = document.getElementById('pmoc-obs').value.trim();

  // Validação básica
  if (!equipamento_id || !tecnico_nome || !filtro_limpo || !serpentina_limpa || !bandeja_limpa || !ventilador_ok) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Por favor, preencha todos os campos e avaliações.";
    return;
  }

  msgFicha.style.color = "blue";
  msgFicha.innerText = "Salvando ficha técnica...";

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from('fichas_pmoc').insert([
    {
      equipamento_id,
      user_id: user.id,
      tecnico_nome,
      filtro_limpo,
      serpentina_limpa,
      bandeja_limpa,
      ventilador_ok,
      observacoes
    }
  ]);

  if (error) {
    msgFicha.style.color = "red";
    msgFicha.innerText = "Erro ao salvar ficha: " + error.message;
  } else {
    msgFicha.style.color = "green";
    msgFicha.innerText = "Ficha PMOC registrada com sucesso!";
    limparFormularioFicha();
    setTimeout(() => msgFicha.innerText = "", 4000);
  }
});

// Limpar campos da Ficha PMOC
function limparFormularioFicha() {
  selectEquipamento.value = "";
  document.getElementById('pmoc-tecnico').value = "";
  document.getElementById('pmoc-obs').value = "";
  
  // Desmarcar os botões do tipo rádio (C, NC, NA)
  document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
}

// Chame a atualização do select sempre que um novo equipamento for adicionado ou excluído
const originalCarregarEquipamentos = carregarEquipamentos;
carregarEquipamentos = async function() {
  await originalCarregarEquipamentos();
  atualizarSelectEquipamentos();
}
