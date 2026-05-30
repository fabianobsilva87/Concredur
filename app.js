// ===================== SUPABASE CONFIG =====================
// ⚠️  SEGURANÇA:
//   A ANON KEY abaixo é segura para o front-end pois é somente leitura pública.
//   O acesso real aos dados é controlado por Row Level Security (RLS) no Supabase.
//   NUNCA exponha a SERVICE_ROLE_KEY no front-end.
const SUPABASE_URL      = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== ESTADO GLOBAL =====================
let globalEquipamentos = [];
let paginaAtualEquipamento = 0;
const itensPorPagina = 8;
let chartOS = null, chartCrit = null, chartOSG = null;
let modoRecuperacao = false;

// Canvas assinatura
let canvas = document.getElementById('canvas-assinatura');
let ctx = canvas ? canvas.getContext('2d') : null;
let desenhando = false;

// ===================== UTILITÁRIOS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

function msgForm(id, texto, cor) {
  const el = $(id);
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.innerText = texto;
  if (cor === 'green') setTimeout(() => { el.innerText = ''; }, 4000);
}

// ===================== COMPRESSÃO E UPLOAD DE FOTO =====================
const FOTO_CONFIG = {
  maxWidth:    1280,   
  max
