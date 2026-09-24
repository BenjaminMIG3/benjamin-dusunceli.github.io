const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const sstore={get(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let lang = store.get('lang') || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'fr');
let theme = store.get('theme') || 'dark';

function applyLang(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    if(I18N[lang][k] === undefined) return;
    if(el.children.length && el.firstChild && el.firstChild.nodeType === 3)
      el.firstChild.nodeValue = I18N[lang][k];
    else
      el.textContent = I18N[lang][k];
  });
  const lt = document.getElementById('langToggle');
  if(lt) lt.innerHTML = lang==='fr' ? '<b>FR</b>/EN' : 'FR/<b>EN</b>';
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme',theme);
  const tt = document.getElementById('themeToggle');
  if(tt) tt.textContent = theme;
}
document.getElementById('langToggle')?.addEventListener('click',()=>{
  lang=lang==='fr'?'en':'fr';store.set('lang',lang);
  finalizeScr(); applyLang(); scrambleVisible();
});
document.getElementById('themeToggle')?.addEventListener('click',()=>{
  theme=theme==='dark'?'light':'dark';store.set('theme',theme);
  finalizeScr(); applyTheme(); scrambleVisible();
});
applyLang(); applyTheme();
const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

/* ================= BOOT ================= */
const boot = document.getElementById('boot');
if(boot){
  if(reduced || sstore.get('booted')){
    boot.remove();
  }else{
    document.body.style.overflow='hidden';
    const lines=[...boot.querySelectorAll('.boot-line')];
    const bar=document.getElementById('bootBar');
    lines.forEach(l=>setTimeout(()=>l.classList.add('on'), +l.dataset.t));
    let p=0;
    const iv=setInterval(()=>{p=Math.min(100,p+Math.random()*24);if(bar)bar.style.width=p+'%';if(p>=100)clearInterval(iv)},110);
    setTimeout(()=>{
      boot.classList.add('done');
      document.body.style.overflow='';
      sstore.set('booted','1');
      setTimeout(()=>boot.remove(),800);
    },1350);
  }
}

/* ================= SCRAMBLE ENGINE (rapide) ================= */
const GLYPHS = "!<>-_\\/[]{}—=+*^?#01";
const activeScr = new Map();
let scrRunning = false;
let scrLast = 0;
const SCR_STEP = 18; /* ms entre frames */

function scrLoop(now){
  scrRunning = true;
  if(now - scrLast >= SCR_STEP){
    scrLast = now;
    activeScr.forEach((s,el)=>{
      if(s.delay > 0){ s.delay--; return }
      s.frame++;
      if(s.frame >= s.total){
        el.textContent = s.target;
        el.classList.add('done');
        activeScr.delete(el);
        return;
      }
      const prog = s.frame / s.total;
      const chars = s.target;
      let out = '';
      const lockAt = prog * chars.length;
      for(let i=0;i<chars.length;i++){
        const ch = chars[i];
        if(ch === ' ') out += ' ';
        else if(i < lockAt) out += ch;
        else out += GLYPHS[(Math.random()*GLYPHS.length)|0];
      }
      el.textContent = out;
    });
  }
  if(activeScr.size) requestAnimationFrame(scrLoop);
  else scrRunning = false;
}
function scramble(el){
  if(reduced) return;
  if(activeScr.has(el)) el.textContent = activeScr.get(el).target;
  const target = el.textContent;
  if(!target.trim()) return;
  /* ~3× plus court qu'avant : ~8–20 frames au lieu de 14–70 */
  activeScr.set(el,{
    target,
    frame:0,
    total: Math.min(20, Math.max(6, Math.round(target.length * .4))),
    delay: (Math.random()*2)|0
  });
  if(!scrRunning) requestAnimationFrame(scrLoop);
}
function finalizeScr(){
  activeScr.forEach((s,el)=>{ el.textContent = s.target });
  activeScr.clear();
}
function leafEls(root){
  const out = [];
  root.querySelectorAll('*').forEach(el=>{
    if(el.closest('.boot')) return;
    if(el.children.length === 0 && el.textContent.trim().length > 0 && el.textContent.length < 220)
      out.push(el);
  });
  return out;
}
function inView(el){
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.width > 0;
}
function scrambleVisible(){
  if(reduced) return;
  leafEls(document.body).forEach(el=>{ if(inView(el)) scramble(el) });
}

/* ================= REVEALS ================= */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(!e.isIntersecting)return;
    e.target.classList.add('in');
    leafEls(e.target).forEach(el=>{
      if(!el.dataset.scr){ el.dataset.scr = '1'; scramble(el) }
    });
    io.unobserve(e.target);
  });
},{threshold:.15,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('.reveal,.edu,.sec-head,.stack-item,.cell,footer').forEach(el=>io.observe(el));

/* ================= SCROLL ENGINE ================= */
const progressBar=document.getElementById('progressBar');
const stackItems=[...document.querySelectorAll('.stack-item')];
const eduFlow=document.getElementById('eduFlow');
const drawLine=document.getElementById('drawLine');
const navH = 56;

function onScroll(){
  const doc=document.documentElement;
  const max=doc.scrollHeight-innerHeight;
  if(progressBar && max > 0) progressBar.style.width=(scrollY/max*100)+'%';

  if(!reduced){
    for(let i=0;i<stackItems.length-1;i++){
      const card=stackItems[i].querySelector('.xp');
      const next=stackItems[i+1];
      if(!card||!next) continue;
      const nr=next.getBoundingClientRect();
      const start=innerHeight*.85, end=navH+40;
      const prog=Math.min(1,Math.max(0,(start-nr.top)/(start-end)));
      card.style.transform=`scale(${1-prog*.06}) translateY(${prog*-8}px)`;
      card.style.filter=`brightness(${1-prog*.35})`;
    }
    if(eduFlow && drawLine){
      const r=eduFlow.getBoundingClientRect();
      const prog=Math.min(1,Math.max(0,(innerHeight*.75-r.top)/r.height));
      const len=r.height;
      drawLine.style.strokeDasharray=len;
      drawLine.style.strokeDashoffset=len*(1-prog);
    }
  }
}
let ticking=false;
addEventListener('scroll',()=>{
  if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false});ticking=true}
},{passive:true});
addEventListener('resize',onScroll,{passive:true});
onScroll();

/* ================= PROJECTS CAROUSEL ================= */
(function initCarousel(){
  const track = document.getElementById('projTrack');
  const dotsEl = document.getElementById('projDots');
  const prevBtn = document.getElementById('projPrev');
  const nextBtn = document.getElementById('projNext');
  const root = document.getElementById('projCarousel');
  if(!track || !dotsEl || !root) return;

  const slides = [...track.querySelectorAll('.proj')];
  const n = slides.length;
  if(!n) return;

  let i = 0;
  let timer = null;
  const AUTO_MS = 4500;

  slides.forEach((_, idx)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role','tab');
    b.setAttribute('aria-label', `Projet ${idx+1}`);
    b.addEventListener('click',()=>{ go(idx); bump(); });
    dotsEl.appendChild(b);
  });
  const dots = [...dotsEl.querySelectorAll('button')];

  function render(){
    track.style.transform = `translate3d(${-i * 100}%,0,0)`;
    dots.forEach((d,idx)=> d.setAttribute('aria-selected', idx===i ? 'true' : 'false'));
  }
  function go(next){
    i = ((next % n) + n) % n;
    render();
  }
  function stop(){ if(timer){ clearInterval(timer); timer=null } }
  function start(){
    if(reduced || n < 2) return;
    stop();
    timer = setInterval(()=> go(i+1), AUTO_MS);
  }
  function bump(){ stop(); start(); }

  prevBtn?.addEventListener('click',()=>{ go(i-1); bump(); });
  nextBtn?.addEventListener('click',()=>{ go(i+1); bump(); });

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', (e)=>{
    if(!root.contains(e.relatedTarget)) start();
  });

  /* swipe tactile */
  let x0 = null;
  track.addEventListener('pointerdown',e=>{ x0 = e.clientX; stop(); },{passive:true});
  track.addEventListener('pointerup',e=>{
    if(x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if(Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    bump();
  });

  render();
  start();
})();

/* ================= CURSOR ================= */
if(matchMedia('(pointer:fine)').matches && !reduced){
  document.body.classList.add('cursor-on');
  const dot=document.querySelector('.cursor-dot');
  const ring=document.querySelector('.cursor-ring');
  if(dot && ring){
    let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my;
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px'});
    (function loop(){
      rx+=(mx-rx)*.14; ry+=(my-ry)*.14;
      ring.style.left=rx+'px'; ring.style.top=ry+'px';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a,button,.chip').forEach(el=>{
      el.addEventListener('mouseenter',()=>document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave',()=>document.body.classList.remove('cursor-hover'));
    });
  }
}

/* ================= MAGNETIC BUTTONS ================= */
if(matchMedia('(pointer:fine)').matches && !reduced){
  document.querySelectorAll('.magnetic').forEach(btn=>{
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      const x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
      btn.style.transform=`translate(${x*.22}px,${y*.3}px)`;
    });
    btn.addEventListener('mouseleave',()=>{btn.style.transform=''});
  });
}

/* ================= TILT + GLARE ================= */
if(matchMedia('(pointer:fine)').matches && !reduced){
  document.querySelectorAll('.tilt').forEach(cell=>{
    cell.addEventListener('mousemove',e=>{
      const r=cell.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
      cell.style.transform=`rotateX(${(py-.5)*-6}deg) rotateY(${(px-.5)*6}deg)`;
      cell.style.setProperty('--gx',(px*100)+'%');
      cell.style.setProperty('--gy',(py*100)+'%');
    });
    cell.addEventListener('mouseleave',()=>{cell.style.transform=''});
  });
}

/* ================= SCROLLSPY ================= */
const spyLinks=[...document.querySelectorAll('.nav-links a[href^="#"]')];
const spySections=spyLinks
  .map(a=>document.getElementById(a.getAttribute('href').slice(1)))
  .filter(Boolean);
function spy(){
  if(!spySections.length) return;
  const mark=scrollY+innerHeight*.35;
  let current=null;
  for(const s of spySections){
    if(s.offsetTop<=mark) current=s.id;
  }
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)
    current=spySections[spySections.length-1].id;
  spyLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+current));
}
addEventListener('scroll',()=>{requestAnimationFrame(spy)},{passive:true});
spy();

/* ================= INITIAL DECODE ================= */
function initialScramble(){
  leafEls(document.body).forEach(el=>{
    if(inView(el) && !el.dataset.scr){ el.dataset.scr='1'; scramble(el) }
  });
}
if(document.getElementById('boot')) setTimeout(initialScramble, 1400);
else initialScramble();

/* ================= MARQUEE duplicate ================= */
const mq=document.getElementById('mqTrack');
if(mq) mq.innerHTML += mq.innerHTML;
