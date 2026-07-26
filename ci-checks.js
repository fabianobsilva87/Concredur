const fs=require('fs'),path=require('path'),cp=require('child_process');
const DIR='/mnt/project';
const htmls=fs.readdirSync(DIR).filter(f=>f.endsWith('.html')).sort();
let falhas=0;
const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)falhas++;};

// 1 node --check app.js
try{cp.execSync('node --check '+DIR+'/app.js',{stdio:'pipe'});ok('1. node --check app.js',true);}
catch(e){ok('1. node --check app.js',false);console.log(String(e.stderr));}

const RE_INLINE=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const inline={};
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');const b=[];let m;
  RE_INLINE.lastIndex=0;while((m=RE_INLINE.exec(s)))b.push(m[1]);inline[f]=b;}

// 2 blocos inline
let badBlocks=[];
for(const f of htmls)inline[f].forEach((b,i)=>{try{new Function(b);}catch(e){badBlocks.push(f+'#'+(i+1)+': '+e.message);}});
ok('2. blocos <script> inline válidos ('+htmls.length+' páginas)',badBlocks.length===0);
badBlocks.forEach(x=>console.log('   '+x));

// 3 handlers órfãos
const appSrc=fs.readFileSync(path.join(DIR,'app.js'),'utf8');
const defsDe=src=>{const s=new Set();let m;
  const r1=/function\s+([A-Za-z_$][\w$]*)\s*\(/g;while((m=r1.exec(src)))s.add(m[1]);
  const r2=/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g;while((m=r2.exec(src)))s.add(m[1]);
  const r3=/window\.([A-Za-z_$][\w$]*)\s*=/g;while((m=r3.exec(src)))s.add(m[1]);
  return s;};
const defsApp=defsDe(appSrc);
const topo=src=>{const s=new Set();let m;
  const r1=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;while((m=r1.exec(src)))s.add(m[1]);
  const r2=/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;while((m=r2.exec(src)))s.add(m[1]);
  return s;};
const topoApp=topo(appSrc);
const GLOBAIS=new Set(['location','window','document','alert','confirm','print','history','this','event','open','parseInt','parseFloat','Math','JSON','console','navigator']);
let orfaos=[];
for(const f of htmls){
  const s=fs.readFileSync(path.join(DIR,f),'utf8');
  const carregaApp=/<script[^>]*src=["']app\.js["']/.test(s);
  const defs=new Set([...(carregaApp?defsApp:[]),...defsDe(inline[f].join('\n'))]);
  let m;const rh=/\son(?:click|change|input|submit|keyup|keydown|blur|focus)\s*=\s*"([^"]*)"/gi;
  while((m=rh.exec(s))){
    let c;const rc=/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    while((c=rc.exec(m[1]))){const n=c[2];
      if(!GLOBAIS.has(n)&&!defs.has(n)&&!/^(location|window|document)\./.test(m[1]))orfaos.push(f+' → '+n+'()');}
  }
}
orfaos=[...new Set(orfaos)];
ok('3. handlers onclick/onchange/oninput sem função definida',orfaos.length===0);
orfaos.forEach(x=>console.log('   '+x));

// 4 colisões app.js x páginas
let colisoes=[];
for(const f of htmls){
  const s=fs.readFileSync(path.join(DIR,f),'utf8');
  if(!/<script[^>]*src=["']app\.js["']/.test(s))continue;
  for(const n of topo(inline[f].join('\n')))if(topoApp.has(n))colisoes.push(f+' redefine '+n);
}
ok('4. funções/constantes redefinidas entre app.js e páginas',colisoes.length===0);
colisoes.forEach(x=>console.log('   '+x));

// 5 IDs duplicados
let dups=[];
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');const vis={};let m;
  const r=/\sid\s*=\s*["']([^"']+)["']/g;while((m=r.exec(s)))vis[m[1]]=(vis[m[1]]||0)+1;
  Object.entries(vis).filter(([,c])=>c>1).forEach(([k,c])=>dups.push(f+' → #'+k+' ('+c+'x)'));}
ok('5. IDs HTML duplicados por página',dups.length===0);
dups.forEach(x=>console.log('   '+x));

// 6 consistência do menu
const menus={};
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');
  const nav=(s.match(/<nav[\s\S]*?<\/nav>/)||[''])[0];
  menus[f]=(nav.match(/location\.href='([^']+)'/g)||[]).join('|');}
const ref=menus[htmls[0]];const divergentes=htmls.filter(f=>menus[f]!==ref);
ok('6. consistência dos itens de menu entre as páginas ('+(ref.split('|').length)+' itens)',divergentes.length===0);
divergentes.forEach(f=>console.log('   diverge: '+f));

console.log('\n'+(falhas?'⚠ '+falhas+' check(s) com falha':'LINHA DE BASE: 6/6 OK'));
process.exit(falhas?1:0);
