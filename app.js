// ====================================================================
// 🏗️ CONEXÃO CENTRALIZADA DO SUPABASE
// ====================================================================
const SUPABASE_URL = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================================
// ⚙️ UTILITÁRIOS GLOBAIS DE FORMATAÇÃO E DATA
// ====================================================================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

// Função para gerar as Badges de Status padronizadas em todas as telas
function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

// Mensagens informativas integradas para formulários
function msgForm(id, texto, cor) {
  const el = $(id); 
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.innerText = texto;
}

// ====================================================================
// 🔒 VALIDAÇÃO DE SESSÃO E PERFIS REAIS (SEGURANÇA MULTIPÁGINAS)
// ====================================================================
async function verificarAcessoPagina() {
  const { data: { session } } = await db.auth.getSession();
  
  // Se não houver sessão ativa, joga o usuário de volta para a tela de login
  if (!session) {
    window.location.href = window.location.origin + "/index.html";
    return;
  }

  // Atualiza o e-mail no cabeçalho se o elemento existir na página atual
  if ($('user-display-email')) {
    $('user-display-email').innerText = session.user.email;
  }

  // Busca as regras de perfil direto na tabela de governança
  const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).single();
  
  if (profile) {
    // Se o usuário for um auditor (somente leitura), bloqueia preventivamente botões de ação
    if (profile.role === 'auditor') {
      document.querySelectorAll('.btn-primary:not(.btn-refresh)').forEach(btn => btn.style.display = 'none');
      document.querySelectorAll('.btn-excluir').forEach(btn => btn.style.display = 'none');
    }
  }
}

// Executa a checagem automaticamente se não estivermos na tela de login
if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
  verificarAcessoPagina();
}

// ====================================================================
// 📷 MOTOR DE UPLOAD AUTOMÁTICO (SUPABASE STORAGE BUCKET)
// ====================================================================
async function uploadFoto(file, pasta) {
  if (!file) return null;
  
  // Extrai a extensão e define um nome único com timestamp para evitar colisão
  const ext = file.name.split('.').pop();
  const nome = `${pasta}/foto_${Date.now()}.${ext}`;
  
  // Validação corporativa de tamanho de arquivo (Máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Arquivo muito pesado. O limite máximo permitido é 5MB.");
    return null;
  }
  
  const { data, error } = await db.storage.from('fotos-pmoc').upload(nome, file);
  
  if (error) {
    console.error("Erro crítico no upload do Storage:", error.message);
    return null;
  }
  
  // Retorna a URL pública gerada no Bucket do Supabase
  return data ? db.storage.from('fotos-pmoc').getPublicUrl(nome).data.publicUrl : null;
}

// ====================================================================
// 📱 COMPORTAMENTO OFFLINE E INSTALAÇÃO PWA
// ====================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('data:text/javascript,self.addEventListener("fetch",()=>{}).')
      .then(reg => console.log('Service Worker PWA Homologado com Sucesso!'))
      .catch(err => console.warn('Erro ao registrar Service Worker:', err));
  });
}
