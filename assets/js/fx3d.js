/**
 * Effets 3D du portfolio — canvas wireframe, coverflow, tilt tactile.
 * Sans dépendance externe ; respecte prefers-reduced-motion.
 */
(function () {
  'use strict';

  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer =
    typeof matchMedia === 'function' && matchMedia('(pointer:fine)').matches;

  /* ---------- helpers thème ---------- */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(94,139,255,${a})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ============================================================
   * HERO — mesh 3D wireframe (icosaèdre + satellites)
   * ============================================================ */
  function initHeroMesh() {
    const canvas = document.getElementById('hero3d');
    const hero = document.querySelector('.hero');
    if (!canvas || !hero || reduced) {
      if (canvas) canvas.remove();
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const PHI = (1 + Math.sqrt(5)) / 2;
    const base = [
      [-1, PHI, 0],
      [1, PHI, 0],
      [-1, -PHI, 0],
      [1, -PHI, 0],
      [0, -1, PHI],
      [0, 1, PHI],
      [0, -1, -PHI],
      [0, 1, -PHI],
      [PHI, 0, -1],
      [PHI, 0, 1],
      [-PHI, 0, -1],
      [-PHI, 0, 1],
    ];

    const faces = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];

    const edgeSet = new Set();
    faces.forEach((f) => {
      for (let i = 0; i < 3; i++) {
        const a = f[i];
        const b = f[(i + 1) % 3];
        edgeSet.add(a < b ? a + '-' + b : b + '-' + a);
      }
    });
    const edges = [...edgeSet].map((k) => k.split('-').map(Number));

    /* satellites orbitaux (points + liens vers sommets proches) */
    const sats = Array.from({ length: 18 }, (_, i) => {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const r = 1.55 + Math.random() * 0.55;
      return {
        x: r * Math.sin(v) * Math.cos(u),
        y: r * Math.sin(v) * Math.sin(u),
        z: r * Math.cos(v),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        pulse: 0.6 + Math.random() * 0.8,
        link: i % base.length,
      };
    });

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let visible = true;
    let raf = 0;
    let t0 = performance.now();

    /* tilt cible (souris / doigt / gyro) */
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let userUntil = 0;

    function resize() {
      const r = hero.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rot(p, ax, ay, az) {
      let { x, y, z } = p;
      let c = Math.cos(ay);
      let s = Math.sin(ay);
      let xz = x * c + z * s;
      z = -x * s + z * c;
      x = xz;
      c = Math.cos(ax);
      s = Math.sin(ax);
      let yz = y * c - z * s;
      z = y * s + z * c;
      y = yz;
      c = Math.cos(az);
      s = Math.sin(az);
      const xy = x * c - y * s;
      y = x * s + y * c;
      x = xy;
      return { x, y, z };
    }

    function project(p, scale) {
      const fov = 2.6;
      const z = p.z + fov;
      const k = scale / z;
      return {
        x: w * 0.62 + p.x * k,
        y: h * 0.42 + p.y * k,
        z: p.z,
        s: k,
      };
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;

      const elapsed = now * 0.001;
      const idleX = Math.sin(elapsed * 0.35) * 0.14;
      const idleY = Math.cos(elapsed * 0.28) * 0.11;
      const aimX = now < userUntil ? tx : idleX;
      const aimY = now < userUntil ? ty : idleY;
      cx += (aimX - cx) * 0.08;
      cy += (aimY - cy) * 0.08;

      const ax = elapsed * 0.35 + cy * 0.55;
      const ay = elapsed * 0.48 + cx * 0.7;
      const az = elapsed * 0.12;

      const scale = Math.min(w, h) * (w < 640 ? 0.28 : 0.34);

      ctx.clearRect(0, 0, w, h);

      const accent = cssVar('--accent', '#5e8bff');
      const accent2 = cssVar('--accent-2', '#b06bff');

      const verts = base.map((v) =>
        project(rot({ x: v[0], y: v[1], z: v[2] }, ax, ay, az), scale)
      );

      /* faces semi-transparentes (profondeur) */
      const faceDepth = faces
        .map((f) => {
          const a = verts[f[0]];
          const b = verts[f[1]];
          const c = verts[f[2]];
          return { f, z: (a.z + b.z + c.z) / 3, a, b, c };
        })
        .sort((u, v) => u.z - v.z);

      faceDepth.forEach(({ a, b, c, z }) => {
        const depth = (z + 2) / 4;
        const alpha = 0.02 + depth * 0.06;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(accent, alpha);
        ctx.fill();
      });

      /* arêtes */
      edges.forEach(([i, j]) => {
        const a = verts[i];
        const b = verts[j];
        const depth = ((a.z + b.z) / 2 + 2) / 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = hexToRgba(accent, 0.18 + depth * 0.45);
        ctx.lineWidth = 1 + depth * 0.8;
        ctx.stroke();
      });

      /* sommets */
      verts.forEach((p) => {
        const depth = (p.z + 2) / 4;
        const r = 1.6 + depth * 2.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accent, 0.35 + depth * 0.55);
        ctx.fill();
      });

      /* satellites + liens */
      sats.forEach((s) => {
        const wobble = 1 + Math.sin(elapsed * s.speed + s.phase) * 0.06;
        const p = project(
          rot(
            { x: s.x * wobble, y: s.y * wobble, z: s.z * wobble },
            ax * 0.7,
            ay * 1.1,
            az
          ),
          scale
        );
        const target = verts[s.link];
        const pulse =
          0.35 + 0.35 * Math.sin(elapsed * s.pulse * 2 + s.phase);

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = hexToRgba(accent2, 0.08 + pulse * 0.18);
        ctx.lineWidth = 1;
        ctx.stroke();

        const r = 1.2 + pulse * 2.2;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        g.addColorStop(0, hexToRgba(accent2, 0.55));
        g.addColorStop(1, hexToRgba(accent2, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(accent2, 0.7);
        ctx.fill();
      });

      if (visible) raf = requestAnimationFrame(frame);
      else running = false;
    }

    function start() {
      if (running || !visible) return;
      running = true;
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }

    function pointerNorm(clientX, clientY) {
      const r = hero.getBoundingClientRect();
      tx = ((clientX - r.left) / r.width - 0.5) * 1.4;
      ty = ((clientY - r.top) / r.height - 0.5) * 1.2;
    }

    hero.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        pointerNorm(e.clientX, e.clientY);
        userUntil = performance.now() + 2000;
      },
      { passive: true }
    );

    hero.addEventListener(
      'pointerleave',
      () => {
        userUntil = 0;
      },
      { passive: true }
    );

    /* gyro mobile (si autorisé / dispo) — sans prompt obligatoire */
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      !finePointer
    ) {
      const onOrient = (e) => {
        if (e.beta == null || e.gamma == null) return;
        /* le doigt prime sur le gyro */
        if (performance.now() < userUntil - 400) return;
        ty = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
        tx = Math.max(-1, Math.min(1, e.gamma / 45));
        userUntil = performance.now() + 500;
      };
      window.addEventListener('deviceorientation', onOrient, {
        passive: true,
      });
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 }
    );
    io.observe(hero);

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => resize())
        : null;
    if (ro) ro.observe(hero);
    else window.addEventListener('resize', resize, { passive: true });

    /* recalcul couleurs au changement de thème */
    const mo = new MutationObserver(() => {
      /* couleurs lues à chaque frame via cssVar — rien à cacher */
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    resize();
    start();
  }

  /* ============================================================
   * CAROUSEL — coverflow 3D (réutilisable)
   * ============================================================ */
  function createCoverflow(opts) {
    const track = document.getElementById(opts.trackId);
    const dotsEl = document.getElementById(opts.dotsId);
    const prevBtn = document.getElementById(opts.prevId);
    const nextBtn = document.getElementById(opts.nextId);
    const root = document.getElementById(opts.rootId);
    if (!track || !dotsEl || !root) return;

    const slides = [...track.querySelectorAll(opts.slideSel || '.cf-card')];
    const n = slides.length;
    if (!n) return;

    root.classList.add('coverflow');
    track.classList.add('coverflow-track');

    let i = 0;
    let timer = null;
    const AUTO_MS = opts.autoMs || 4800;
    const label = opts.label || 'Slide';

    dotsEl.innerHTML = '';
    slides.forEach((_, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', label + ' ' + (idx + 1));
      b.addEventListener('click', () => {
        go(idx);
        bump();
      });
      dotsEl.appendChild(b);
    });
    const dots = [...dotsEl.querySelectorAll('button')];

    function render() {
      const isMobile = window.innerWidth < 820;
      const trackW = track.clientWidth || root.clientWidth || window.innerWidth;
      const xStep = isMobile ? trackW * 0.52 : trackW * 0.38;
      const rot = isMobile ? 46 : 52;
      const zStep = isMobile ? 140 : 180;

      slides.forEach((slide, idx) => {
        const offset = idx - i;
        const abs = Math.abs(offset);
        const hidden = abs > 2;
        const vis = Math.max(-2, Math.min(2, offset));
        const visAbs = Math.abs(vis);
        slide.style.setProperty('--cf-x', (vis * xStep).toFixed(1) + 'px');
        slide.style.setProperty('--cf-z', (-visAbs * zStep).toFixed(1) + 'px');
        slide.style.setProperty('--cf-ry', vis * -rot + 'deg');
        slide.style.setProperty('--cf-s', (1 - visAbs * 0.08).toFixed(3));
        slide.style.opacity = hidden
          ? '0'
          : String(Math.max(0.4, 1 - abs * 0.2));
        slide.style.zIndex = String(100 - abs);
        slide.style.visibility = hidden ? 'hidden' : 'visible';
        slide.style.pointerEvents = offset === 0 ? 'auto' : 'none';
        slide.setAttribute('aria-hidden', offset === 0 ? 'false' : 'true');
        slide.classList.toggle('is-active', offset === 0);
      });
      dots.forEach((d, idx) =>
        d.setAttribute('aria-selected', idx === i ? 'true' : 'false')
      );
    }

    function go(next) {
      i = ((next % n) + n) % n;
      render();
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function start() {
      if (reduced || n < 2 || opts.auto === false) return;
      stop();
      timer = setInterval(() => go(i + 1), AUTO_MS);
    }
    function bump() {
      stop();
      start();
    }

    prevBtn?.addEventListener('click', () => {
      go(i - 1);
      bump();
    });
    nextBtn?.addEventListener('click', () => {
      go(i + 1);
      bump();
    });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget)) start();
    });

    let x0 = null;
    track.addEventListener(
      'pointerdown',
      (e) => {
        x0 = e.clientX;
        stop();
        track.setPointerCapture?.(e.pointerId);
      },
      { passive: true }
    );
    track.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 36) go(i + (dx < 0 ? 1 : -1));
      bump();
    });

    window.addEventListener('resize', render, { passive: true });

    render();
    requestAnimationFrame(() => {
      render();
      start();
    });
  }

  function initCoverflow() {
    createCoverflow({
      rootId: 'projCarousel',
      trackId: 'projTrack',
      dotsId: 'projDots',
      prevId: 'projPrev',
      nextId: 'projNext',
      slideSel: '.proj.cf-card, .proj',
      label: 'Projet',
      autoMs: 4800,
    });
    createCoverflow({
      rootId: 'xpCarousel',
      trackId: 'xpTrack',
      dotsId: 'xpDots',
      prevId: 'xpPrev',
      nextId: 'xpNext',
      slideSel: '.xp.cf-card, .xp',
      label: 'Expérience',
      autoMs: 5200,
    });
  }

  /* ============================================================
   * TILT 3D — souris + tactile (skills / cartes)
   * ============================================================ */
  function initTilt() {
    if (reduced) return;
    const cells = document.querySelectorAll('.tilt');
    cells.forEach((cell) => {
      let rafId = 0;
      let px = 0.5;
      let py = 0.5;
      let active = false;

      function apply() {
        rafId = 0;
        if (!active) return;
        const rx = (py - 0.5) * -10;
        const ry = (px - 0.5) * 12;
        cell.style.transform =
          'perspective(900px) rotateX(' +
          rx +
          'deg) rotateY(' +
          ry +
          'deg) translateZ(8px)';
        cell.style.setProperty('--gx', px * 100 + '%');
        cell.style.setProperty('--gy', py * 100 + '%');
      }

      function schedule() {
        if (!rafId) rafId = requestAnimationFrame(apply);
      }

      function onMove(e) {
        const r = cell.getBoundingClientRect();
        const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        if (cx == null) return;
        px = (cx - r.left) / r.width;
        py = (cy - r.top) / r.height;
        active = true;
        cell.classList.add('tilting');
        schedule();
      }

      function onEnd() {
        active = false;
        cell.classList.remove('tilting');
        cell.style.transform = '';
      }

      cell.addEventListener('pointermove', onMove, { passive: true });
      cell.addEventListener('pointerenter', onMove, { passive: true });
      cell.addEventListener('pointerleave', onEnd, { passive: true });
      cell.addEventListener(
        'pointerdown',
        (e) => {
          cell.setPointerCapture?.(e.pointerId);
          onMove(e);
        },
        { passive: true }
      );
      cell.addEventListener('pointerup', onEnd, { passive: true });
    });

  }

  /* ============================================================
   * DEPTH SCROLL — titres & sections en perspective
   * ============================================================ */
  function initDepthScroll() {
    if (reduced) return;
    const heads = document.querySelectorAll('.sec-head');
    if (!heads.length) return;

    function update() {
      const vh = window.innerHeight;
      heads.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const mid = r.top + r.height * 0.5;
        const t = (mid - vh * 0.42) / vh;
        const clamped = Math.max(-1, Math.min(1, t));
        el.style.transform =
          'perspective(1000px) translateZ(' +
          -Math.abs(clamped) * 36 +
          'px) rotateX(' +
          clamped * 5 +
          'deg)';
      });
    }

    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            update();
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  /* ============================================================
   * HERO TITLE — float 3D par lettre (léger)
   * ============================================================ */
  function initHeroFloat() {
    if (reduced) return;
    /* après l'anim lift du titre pour éviter le conflit de transform */
    setTimeout(() => {
      document
        .querySelectorAll('.hero h1 .fill, .hero h1 .stroke')
        .forEach((el) => el.classList.add('float-3d'));
    }, 1400);
  }

  /* boot */
  function boot() {
    const steps = [
      initHeroMesh,
      initCoverflow,
      initTilt,
      initDepthScroll,
      initHeroFloat,
    ];
    steps.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[fx3d]', fn.name, err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
