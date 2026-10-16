// Maangi Cafe — infinite interactable photo stacks
(function(){
  const nav = document.getElementById('nav');
  addEventListener('scroll', ()=> nav.classList.toggle('scrolled', scrollY > 10), {passive:true});

  const ham = document.getElementById('hamburger');
  const mm = document.getElementById('mobileMenu');
  ham.addEventListener('click', ()=> mm.classList.toggle('open'));
  mm.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mm.classList.remove('open')));

  // Reveal on scroll
  const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('visible'); io.unobserve(e.target);} }),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // Open-now badge (11:00 - 24:00 IST)
  const badge = document.getElementById('openBadge');
  try{
    const hr = Number(new Intl.DateTimeFormat('en-IN',{hour:'numeric',hour12:false,timeZone:'Asia/Kolkata'}).format(new Date()).split(' ')[0]);
    const open = hr >= 11;
    badge.textContent = open ? '● open now • till 12 AM' : '● opens 11 AM today';
    if(!open){ badge.style.background='#f7e3d3'; badge.style.color='#8a3d1f'; }
  }catch(e){}

  // Lightbox
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lightboxImg'), lbCap = document.getElementById('lightboxCap');
  document.getElementById('lightboxClose').onclick = ()=>{ lb.classList.remove('open'); };
  lb.onclick = (e)=>{ if(e.target===lb) lb.classList.remove('open'); };
  addEventListener('keydown', e=>{ if(e.key==='Escape') lb.classList.remove('open'); });

  // ---- STACK ENGINE (Tinder-style sequential decks, manual only) ----
  // Strictly sequential: tap or swipe (any direction) advances exactly one
  // card forward — 1→2→3→…→1, forever. No autoplay, no jumping, no counters,
  // no arrows, no dots. Each deck owns its state.
  const stacks = [];
  document.querySelectorAll('[data-stack]').forEach(root=>{
    const stage = root.querySelector('.stack');
    const cards = [...stage.querySelectorAll('.photo')];
    let order = cards.map((_,i)=>i); // order[0]=front, order[1]=preview
    let busy = false, dragging = false;
    const LOCK = 700; // matches .65s CSS transition — one flip at a time

    function layout(){
      const n = cards.length;
      const isMobile = matchMedia('(max-width: 960px)').matches;
      // Duplex render: ONLY front + preview visible. Reserve parked
      // invisibly behind front, so the peek is ALWAYS the next card.
      const peekX = isMobile ? 8 : 14;
      const peekY = isMobile ? -16 : -12;
      const peekR = isMobile ? -1 : -2;
      const peekS = isMobile ? 0.955 : 0.945;
      const frontR = isMobile ? -4 : -6;
      cards.forEach((card, idx)=>{
        const pos = order.indexOf(idx);
        if(pos === 0){
          card.style.zIndex = n + 1;
          card.style.opacity = 1;
          card.style.filter = 'none';
          card.style.transform = `translate(0px, 0px) rotate(${frontR}deg) scale(1)`;
        } else if(pos === 1){
          card.style.zIndex = n;
          card.style.opacity = 1;
          card.style.filter = 'brightness(0.92)';
          card.style.transform = `translate(${peekX}px, ${peekY}px) rotate(${peekR}deg) scale(${peekS})`;
        } else {
          card.style.zIndex = 1;
          card.style.opacity = 0;
          card.style.filter = 'brightness(0.85)';
          card.style.transform = `translate(0px, 0px) rotate(${frontR}deg) scale(0.96)`;
        }
      });
    }

    // the ONLY move: front → back, preview → front. Locked mid-flip.
    // The outgoing card teleports (transition off) so the wrap-around is
    // invisible — only the preview glides to front. No snap-back flash.
    function next(){
      if(busy) return;
      busy = true;
      const out = cards[order[0]];
      out.style.transition = 'none';
      order.push(order.shift());
      layout();
      requestAnimationFrame(()=>{ out.style.transition = ''; });
      setTimeout(()=>{ busy = false; }, LOCK);
    }

    // tap = flip one forward · double-tap = fullscreen preview
    let clickT = null;
    // dragMoved is declared below (let); this handler only runs on user
    // events after init, so the closure reference is safe.
    stage.addEventListener('click', ()=>{
      if(dragMoved) return;
      if(clickT){ clearTimeout(clickT); clickT = null; openLB(cards[order[0]]); }
      else clickT = setTimeout(()=>{ clickT = null; next(); }, 260);
    });

    function openLB(fig){
      lbImg.src = fig.querySelector('img').src.replace('w=600','w=1000');
      lbCap.textContent = fig.dataset.caption || '';
      lb.classList.add('open');
    }

    // Tinder-style swipe: a flick in ANY direction dismisses the top card
    // and reveals the next one — always sequentially forward.
    let sx = 0, sy = 0, dx = 0, dy = 0, dragMoved = false;
    stage.addEventListener('pointerdown', e=>{
      dragging = true; dragMoved = false; sx = e.clientX; sy = e.clientY;
      try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    });
    stage.addEventListener('pointermove', e=>{
      if(!dragging || busy) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if(Math.abs(dx) > 8 || Math.abs(dy) > 8) dragMoved = true;
      const front = cards[order[0]];
      front.style.translate = `${dx * 0.55}px ${dy * 0.55}px`;
      front.style.rotate = `${dx * 0.06}deg`;
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      const front = cards[order[0]];
      front.style.translate = '0 0';
      front.style.rotate = '0deg';
      // any decisive flick → next card in order (never backwards, never jumps)
      if(Math.abs(dx) > 60 || Math.abs(dy) > 70) next();
      dx = 0; dy = 0;
      setTimeout(()=>{ dragMoved = false; }, 50);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // front + preview load eagerly so the deck never paints half-loaded
    [cards[0], cards[1]].forEach(c=>{
      const im = c && c.querySelector('img');
      if(im){ im.loading = 'eager'; try{ im.fetchPriority = 'high'; }catch(_){} }
    });

    layout();
    stacks.push({ relayout: layout });
  });

  // warm the HTTP cache for every deck image (idle time) so later flips
  // pull from cache instead of network — no pop-in mid-cycle
  function preloadDecks(){
    document.querySelectorAll('.photo img').forEach(img=>{
      const pre = new Image();
      pre.decoding = 'async';
      pre.src = img.currentSrc || img.src;
    });
  }
  if('requestIdleCallback' in window) requestIdleCallback(preloadDecks, { timeout: 2500 });
  else setTimeout(preloadDecks, 1500);

  // re-fan stacks when rotating / resizing across breakpoints
  let rzT; addEventListener('resize', ()=>{ clearTimeout(rzT); rzT=setTimeout(()=> stacks.forEach(s=>s.relayout && s.relayout()), 200); });

  // ---- MOBILE-ONLY: tabbar scrollspy + chips ----
  const tabLinks = [...document.querySelectorAll('.tabbar a[href^="#"]')];
  const spy = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting) return;
      const id = '#'+e.target.id;
      tabLinks.forEach(a=>a.classList.toggle('active', a.getAttribute('href')===id));
    });
  },{rootMargin:'-40% 0px -55% 0px'});
  ['top','stacks','menu','visit'].forEach(id=>{ const el=document.getElementById(id); if(el) spy.observe(el); });

  const chips = [...document.querySelectorAll('#chipRow a')];
  const chipSpy = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting) return;
      chips.forEach(c=>c.classList.toggle('active', c.getAttribute('href')==='#'+e.target.id));
    });
  },{rootMargin:'-30% 0px -60% 0px'});
  document.querySelectorAll('[data-stack]').forEach(el=>chipSpy.observe(el));

  // ---- MOBILE HERO REEL: direction-locked drag-to-scroll ----
  // touch-action:pan-y keeps vertical page scroll native; horizontal drags
  // are converted to scrollLeft manually so one axis always wins — no fight
  // between the swipe and the page scroll.
  const reel = document.querySelector('.mobile-reel-track');
  if(reel){
    let rDown = false, rLocked = false, rX = 0, rLeft = 0;
    reel.addEventListener('pointerdown', e=>{
      rDown = true; rLocked = false; rX = e.clientX; rLeft = reel.scrollLeft;
    });
    reel.addEventListener('pointermove', e=>{
      if(!rDown) return;
      const dx = e.clientX - rX;
      if(!rLocked && Math.abs(dx) > 10){ rLocked = true; reel.classList.add('dragging'); }
      if(rLocked) reel.scrollLeft = rLeft - dx;
    });
    const rEnd = ()=>{ rDown = false; rLocked = false; reel.classList.remove('dragging'); };
    reel.addEventListener('pointerup', rEnd);
    reel.addEventListener('pointercancel', rEnd);
  }
})();
