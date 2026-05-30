// ====================================================================
// 🏗️ CONEXÃO CENTRALIZADA DO SUPABASE
// ====================================================================
const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

// ====================================================================
// 🔒 CHECAGEM DE SESSÃO SEVERA (APENAS NAS SUBPÁGINAS)
// ====================================================================
async function verificarSessaoGlobal() {
  const { data: { session } } = await db.auth.getSession();
  
  // Pega o nome do arquivo atual
  const paginaAtual = window.location.pathname.split("/").pop();

  // SE NÃO HOUVER SESSÃO e o usuário NÃO estiver na tela de login, manda de volta para o index
  if (!session) {
    if (paginaAtual !== "" && paginaAtual !== "index.html") {
      window.location.href = "index.html";
    }
  } else {
    // SE HOUVER SESSÃO e o usuário tentar entrar no index.html, pula direto para o dashboard
    if (paginaAtual === "" || paginaAtual === "index.html") {
      window.location.href = "dashboard.html";
    }
    // Injeta o e-mail no cabeçalho se o elemento existir
    if (document.getElementById('user-display-email')) {
      document.getElementById('user-display-email').innerText = session.user.email;
    }
  }
}

async function executarLogout() {
  if (confirm("Deseja realmente encerrar a sessão?")) {
    await db.auth.signOut();
    window.location.href = "index.html";
  }
}

// Executa a validação de forma segura
verificarSessaoGlobal();
