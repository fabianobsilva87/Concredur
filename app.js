// Configuração de conexão com o Supabase
const SUPABASE_URL = "https://nweligwbgblblncaegir.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kajKILpAjRorDNIA...";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Pegando os elementos da tela
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnCadastro = document.getElementById('btn-cadastro');
const btnLogout = document.getElementById('btn-logout');
const msg = document.getElementById('mensagem');

const loginBox = document.getElementById('login-box');
const dashboardBox = document.getElementById('dashboard-box');

// Função de Cadastro
btnCadastro.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signUp({
        email: emailInput.value,
        password: passwordInput.value,
    });
    if (error) {
        msg.innerText = "Erro ao cadastrar: " + error.message;
    } else {
        msg.style.color = "green";
        msg.innerText = "Cadastro realizado! Verifique seu e-mail para confirmar.";
    }
});

// Função de Login
btnLogin.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value,
    });
    if (error) {
        msg.style.color = "red";
        msg.innerText = "Erro no acesso: " + error.message;
    } else {
        // Esconde a caixa de login e mostra o painel do sistema
        loginBox.style.display = "none";
        dashboardBox.style.display = "block";
    }
});

// Função de Sair
btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    loginBox.style.display = "block";
    dashboardBox.style.display = "none";
    msg.innerText = "";
    emailInput.value = "";
    passwordInput.value = "";
});
