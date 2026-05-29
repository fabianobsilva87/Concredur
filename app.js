
// Configuração de conexão com o Supabase
const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    msg.style.color = "blue";
    msg.innerText = "Processando cadastro...";
    
    // Atualizado para usar o novo nome da variável
    const { data, error } = await supabaseClient.auth.signUp({
        email: emailInput.value,
        password: passwordInput.value,
    });
    
    if (error) {
        msg.style.color = "red";
        msg.innerText = "Erro ao cadastrar: " + error.message;
    } else {
        msg.style.color = "green";
        msg.innerText = "Cadastro realizado! Verifique seu e-mail para confirmar.";
    }
});

// Função de Login
btnLogin.addEventListener('click', async () => {
    msg.style.color = "blue";
    msg.innerText = "Verificando acesso...";

    // Atualizado para usar o novo nome da variável
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value,
    });
    
    if (error) {
        msg.style.color = "red";
        msg.innerText = "Erro no acesso: " + error.message;
    } else {
        msg.innerText = "";
        loginBox.style.display = "none";
        dashboardBox.style.display = "block";
    }
});

// Função de Sair
btnLogout.addEventListener('click', async () => {
    // Atualizado para usar o novo nome da variável
    await supabaseClient.auth.signOut();
    loginBox.style.display = "block";
    dashboardBox.style.display = "none";
    msg.innerText = "";
    emailInput.value = "";
    passwordInput.value = "";
});
// 1. FUNÇÃO PARA CADASTRAR A MANUTENÇÃO
const formManutencao = document.getElementById('form-manutencao');

if (formManutencao) {
    formManutencao.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Pega os dados digitados na tela
        const cliente = document.getElementById('pmoc-cliente').value;
        const equipamento = document.getElementById('pmoc-equipamento').value;
        const tag = document.getElementById('pmoc-tag').value;
        const tipo = document.getElementById('pmoc-tipo').value;
        const descricao = document.getElementById('pmoc-descricao').value;
        const tecnico = document.getElementById('pmoc-tecnico').value;

        // Envia para a tabela 'manutencoes' do Supabase
        const { data, error } = await supabaseClient
            .from('manutencoes')
            .insert([
                { 
                    cliente: cliente, 
                    equipamento: equipamento, 
                    tag_identificacao: tag, 
                    tipo_manutencao: tipo, 
                    descricao: descricao, 
                    tecnico_responsavel: tecnico 
                }
            ]);

        if (error) {
            alert('Erro ao salvar no banco: ' + error.message);
        } else {
            alert('Manutenção registrada com sucesso no PMOC!');
            formManutencao.reset(); // Limpa os campos do formulário
        }
    });
}

// 2. FUNÇÃO PARA GERAR O RELATÓRIO NA TELA
const btnRelatorio = document.getElementById('btn-carregar-relatorio');
const listaRelatorios = document.getElementById('lista-relatorios');

if (btnRelatorio) {
    btnRelatorio.addEventListener('click', async () => {
        // Busca todas as manutenções salvas no Supabase
        const { data: manutencoes, error } = await supabaseClient
            .from('manutencoes')
            .select('*')
            .order('created_at', { ascending: false }); // Traz as mais recentes primeiro

        if (error) {
            alert('Erro ao gerar relatório: ' + error.message);
            return;
        }

        if (manutencoes.length === 0) {
            listaRelatorios.innerHTML = '<p>Nenhuma manutenção encontrada para este período.</p>';
            return;
        }

        // Monta uma tabela bonita com os dados recebidos
        let htmlTabela = `
            <table border="1" style="width:100%; border-collapse: collapse; text-align: left; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 8px;">Data</th>
                        <th style="padding: 8px;">Cliente</th>
                        <th style="padding: 8px;">Equipamento (TAG)</th>
                        <th style="padding: 8px;">Tipo</th>
                        <th style="padding: 8px;">Atividades</th>
                        <th style="padding: 8px;">Técnico</th>
                    </tr>
                </thead>
                <tbody>
        `;

        manutencoes.forEach(item => {
            // Formata a data para o padrão brasileiro (DD/MM/AAAA)
            const dataFormatada = new Date(item.created_at).toLocaleDateString('pt-BR');
            
            htmlTabela += `
                <tr>
                    <td style="padding: 8px;">${dataFormatada}</td>
                    <td style="padding: 8px;">${item.cliente}</td>
                    <td style="padding: 8px;">${item.equipamento} (${item.tag_identificacao || 'S/ Tág'})</td>
                    <td style="padding: 8px;">${item.tipo_manutencao}</td>
                    <td style="padding: 8px;">${item.descricao}</td>
                    <td style="padding: 8px;">${item.tecnico_responsavel}</td>
                </tr>
            `;
        });

        htmlTabela += '</tbody></table>';
        
        // Adiciona um botão rápido para o usuário conseguir imprimir o relatório em PDF usando o próprio navegador
        htmlTabela += `<br><button onclick="window.print()" style="background-color: #28a745; color: white;">Imprimir / Salvar em PDF</button>`;

        listaRelatorios.innerHTML = htmlTabela;
    });
}
