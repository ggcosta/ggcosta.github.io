(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const padel = { active: false, x: 0, y: 0 };   // easter-egg ball, read by the hero grid

  /* ---------- Hero name: split into letters ---------- */
  const name = document.querySelector("[data-split]");
  let charCount = 0;
  if (name) {
    const text = name.textContent.trim();
    name.setAttribute("aria-label", text);
    name.textContent = "";
    text.split(" ").forEach((word, wi, words) => {
      const w = document.createElement("span");
      w.className = "word";
      w.setAttribute("aria-hidden", "true");
      for (const ch of word) {
        const c = document.createElement("span");
        c.className = "char";
        c.style.setProperty("--i", charCount++);
        c.textContent = ch;
        w.appendChild(c);
      }
      name.appendChild(w);
      if (wi < words.length - 1) name.appendChild(document.createTextNode(" "));
    });
  }

  /* ---------- Hero subtitle: typewriter ---------- */
  const typed = document.querySelector(".typed");
  if (typed) {
    const full = typed.dataset.text;
    if (reduceMotion) {
      typed.textContent = full;
    } else {
      let i = 0;
      const tick = () => {
        typed.textContent = full.slice(0, ++i);
        if (i < full.length) setTimeout(tick, full[i - 1] === "." ? 380 : 28 + Math.random() * 40);
      };
      setTimeout(tick, charCount * 35 + 700);
    }
  }

  /* ---------- Scroll reveals ---------- */
  const reveals = document.querySelectorAll(".reveal");
  // stagger siblings that enter together
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.style.setProperty("--d", `${n++ * 90}ms`);
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  reveals.forEach((el) => io.observe(el));

  /* ---------- Nav: frosted on scroll + active link ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = [...document.querySelectorAll(".nav__links a")];
  const sectionIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle("is-active", a.hash === `#${e.target.id}`));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach((s) => sectionIo.observe(s));

  /* ---------- Aurora blob follows the cursor ---------- */
  const blob = document.querySelector(".aurora__blob");
  if (blob && !reduceMotion) {
    let tx = innerWidth * 0.5, ty = innerHeight * 0.3;
    let x = tx, y = ty;
    if (finePointer) {
      addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    }
    const loop = (t) => {
      if (!finePointer) {
        // drift slowly on touch devices
        tx = innerWidth * (0.5 + 0.3 * Math.sin(t / 7000));
        ty = innerHeight * (0.35 + 0.2 * Math.cos(t / 9000));
      }
      x += (tx - x) * 0.05;
      y += (ty - y) * 0.05;
      blob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Hero: interactive padel racket grid ---------- */
  const hero = document.querySelector(".hero");
  const canvas = document.querySelector(".hero__grid");
  if (hero && canvas) {
    const ctx = canvas.getContext("2d");
    let GAP = 32, BASE = 10, GROW = 10;   // smaller, sparser rackets on phones (set in resize)
    const RADIUS = 220;
    const REST_ANGLE = -0.6;           // resting tilt (radians)

    // draw one white padel racket once, then stamp it everywhere
    const sprite = document.createElement("canvas");
    sprite.width = 40; sprite.height = 76;
    {
      const g = sprite.getContext("2d");
      g.fillStyle = "#fff";
      g.beginPath();
      g.ellipse(20, 24, 18, 22, 0, 0, Math.PI * 2);   // head
      g.fill();
      g.beginPath();                                   // throat
      g.moveTo(9, 40); g.quadraticCurveTo(20, 50, 31, 40); g.lineTo(23, 54); g.lineTo(17, 54);
      g.fill();
      g.beginPath();                                   // handle
      g.roundRect(16, 52, 8, 24, 3);
      g.fill();
      g.globalCompositeOperation = "destination-out";  // the holes
      for (let y = 10; y <= 38; y += 7) {
        for (let x = 6; x <= 34; x += 7) {
          if (((x - 20) / 13) ** 2 + ((y - 24) / 17) ** 2 > 1) continue;
          g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
        }
      }
    }
    const SPRITE_RATIO = sprite.width / sprite.height;
    let w, h, dpr, dots = [];
    let px = -9999, py = -9999;      // pointer (canvas coords)
    let sx = -9999, sy = -9999;      // eased pointer
    const ripples = [];
    let visible = true, raf = 0;

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      // mobile address bars fire resize while scrolling; ignore small height-only changes
      if (r.width === w && Math.abs(r.height - h) < 120) return;
      w = r.width; h = r.height;
      const phone = w < 600;
      GAP = phone ? 30 : 32; BASE = phone ? 7 : 10; GROW = phone ? 7 : 10;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const ox = (w % GAP) / 2, oy = (h % GAP) / 2;
      for (let y = oy; y <= h; y += GAP) for (let x = ox; x <= w; x += GAP) dots.push(x, y);
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      sx += (px - sx) * 0.12;
      sy += (py - sy) * 0.12;
      if (padel.active) {
        // rackets follow the padel ball while it's in play
        const r = canvas.getBoundingClientRect();
        sx = padel.x - r.left;
        sy = padel.y - r.top;
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].r += 9;
        if (ripples[i].r > Math.hypot(w, h)) ripples.splice(i, 1);
      }
      for (let i = 0; i < dots.length; i += 2) {
        let x = dots[i], y = dots[i + 1];
        const dx = x - sx, dy = y - sy;
        const d = Math.hypot(dx, dy);
        let a = 0.13, size = BASE, angle = REST_ANGLE;
        if (d < RADIUS) {
          const f = 1 - d / RADIUS;
          a += f * f * 0.75;
          size += f * GROW;
          // push rackets gently away and swing their heads to face outwards
          x += (dx / (d || 1)) * f * 10;
          y += (dy / (d || 1)) * f * 10;
          let turn = Math.atan2(dy, dx) + Math.PI / 2 - REST_ANGLE;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));   // shortest way round
          angle += turn * Math.min(1, f * 1.6);
        }
        for (const rp of ripples) {
          const band = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rp.r);
          if (band < 40) {
            const f = (1 - band / 40) * Math.max(0, 1 - rp.r / 900);
            a += f * 0.8;
            size += f * GROW * 0.8;
            angle += f * Math.PI;   // a little spin as the wave passes
          }
        }
        const cos = Math.cos(angle) * dpr, sin = Math.sin(angle) * dpr;
        ctx.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr);
        ctx.globalAlpha = Math.min(a, 1);
        ctx.drawImage(sprite, -size * SPRITE_RATIO / 2, -size / 2, size * SPRITE_RATIO, size);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      if (visible && !reduceMotion) raf = requestAnimationFrame(draw);
    };

    const start = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

    resize();
    addEventListener("resize", () => { resize(); if (reduceMotion) draw(0); });
    // listen on the window: the canvas is full-bleed but the hero is only as wide as the content
    const overCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom ? r : null;
    };
    if (finePointer) {
      addEventListener("pointermove", (e) => {
        const r = overCanvas(e);
        if (r) { px = e.clientX - r.left; py = e.clientY - r.top; }
        else px = py = -9999;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => { px = py = -9999; });
    }
    addEventListener("click", (e) => {
      const r = overCanvas(e);
      if (!r || e.target.closest("a, button")) return;
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0 });
    });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(hero);
    start();

    // no cursor on touch screens: send a gentle wave across now and then
    if (!finePointer && !reduceMotion) {
      setInterval(() => {
        if (visible && !padel.active) ripples.push({ x: w * (0.2 + Math.random() * 0.6), y: h * (0.25 + Math.random() * 0.5), r: 0 });
      }, 5000);
    }

    // a ripple once the name has landed
    setTimeout(() => ripples.push({ x: w * 0.3, y: h * 0.45, r: 0 }), charCount * 35 + 500);
  }

  /* ---------- Hero: fade + lift on scroll ---------- */
  const heroContent = document.querySelector(".hero__content");
  if (heroContent && !reduceMotion) {
    const onHeroScroll = () => {
      const p = Math.min(scrollY / innerHeight, 1);
      heroContent.style.transform = `translate3d(0, ${p * -80}px, 0) scale(${1 - p * 0.05})`;
      heroContent.style.opacity = 1 - p * 1.2;
    };
    addEventListener("scroll", onHeroScroll, { passive: true });
    onHeroScroll();
  }

  /* ---------- Project cards: spotlight + tilt ---------- */
  document.querySelectorAll(".project").forEach((card) => {
    const screen = card.querySelector(".screen");
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
      if (finePointer && !reduceMotion && screen) {
        const s = screen.getBoundingClientRect();
        const px = (e.clientX - s.left) / s.width - 0.5;
        const py = (e.clientY - s.top) / s.height - 0.5;
        screen.style.setProperty("--ry", `${px * 8}deg`);
        screen.style.setProperty("--rx", `${py * -8}deg`);
      }
    });
    card.addEventListener("pointerleave", () => {
      screen?.style.setProperty("--rx", "0deg");
      screen?.style.setProperty("--ry", "0deg");
    });
  });

  /* ---------- Screenshot carousels ---------- */
  document.querySelectorAll("[data-carousel]").forEach((screen) => {
    const imgs = [...screen.querySelectorAll(":scope > img")];
    if (!imgs.length) return;
    screen.querySelector(".screen__empty")?.remove();

    let current = 0;
    imgs[0].classList.add("is-active");

    const caption = document.createElement("span");
    caption.className = "screen__caption mono";
    caption.setAttribute("aria-hidden", "true");
    const setCaption = (i) => {
      caption.classList.remove("is-in");
      void caption.offsetWidth; // restart the transition
      caption.textContent = imgs[i].dataset.caption || "";
      caption.classList.toggle("is-in", !!caption.textContent);
    };
    screen.appendChild(caption);
    setCaption(0);
    if (imgs.length < 2) return;

    const dots = document.createElement("div");
    dots.className = "screen__dots";
    const buttons = imgs.map((img, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `Show screenshot ${i + 1}: ${img.alt}`);
      b.addEventListener("click", () => { show(i); restart(); });
      dots.appendChild(b);
      return b;
    });
    buttons[0].classList.add("is-active");
    screen.appendChild(dots);

    const show = (i) => {
      imgs[current].classList.remove("is-active");
      buttons[current].classList.remove("is-active");
      current = (i + imgs.length) % imgs.length;
      imgs[current].classList.add("is-active");
      buttons[current].classList.add("is-active");
      setCaption(current);
    };

    let timer;
    const restart = () => {
      clearInterval(timer);
      if (!reduceMotion) timer = setInterval(() => show(current + 1), 4500);
    };

    // only cycle while visible
    new IntersectionObserver(([e]) => (e.isIntersecting ? restart() : clearInterval(timer)))
      .observe(screen);
  });

  /* ---------- Copy email ---------- */
  const toast = document.querySelector(".toast");
  let toastTimer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  document.querySelectorAll("[data-copy-email]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      try {
        await navigator.clipboard.writeText(email);
        showToast("Email copied to clipboard ✓");
      } catch {
        location.href = `mailto:${email}`;
      }
    });
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Easter eggs: type "lumen" or "padel" ---------- */
  let buffer = "";
  addEventListener("keydown", (e) => {
    if (e.key.length !== 1 || e.target.closest?.("input, textarea")) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-5);
    if (buffer === "padel") { buffer = ""; serve(); return; }
    if (buffer !== "lumen") return;
    buffer = "";
    showToast("✦ lights on");
    if (reduceMotion) return;
    const sweep = document.createElement("div");
    sweep.className = "sweep";
    document.body.appendChild(sweep);
    document.body.classList.add("lumen-on");
    sweep.addEventListener("animationend", () => sweep.remove());
    setTimeout(() => document.body.classList.remove("lumen-on"), 2500);
  });

  /* ---------- Padel mini-game ---------- */
  // Hit the ball before it bounces twice. Scores like a real game: 15, 30, 40, Game.
  const POINTS = ["Love", "15", "30", "40"];
  const GRAVITY = 0.42, R = 9;
  let ball = null;

  function serve() {
    if (ball) { hit(ball.x - 20, ball.y + 20); return; }   // already in play: just hit it
    if (reduceMotion) { showToast("🎾 Fancy a game?"); return; }

    const el = document.createElement("button");
    el.type = "button";
    el.className = "padel-ball";
    el.setAttribute("aria-label", "Padel ball: click to hit it");
    document.body.appendChild(el);

    ball = {
      el, x: innerWidth * 0.15, y: -R, vx: 7, vy: 2, spin: 0,
      bounces: 0, rally: false, score: 0, games: 0, still: 0, last: 0,
    };
    padel.active = true;
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(e.clientX, e.clientY); });
    showToast("Keep it up! One bounce max");
    requestAnimationFrame(step);
  }

  function hit(fromX, fromY) {
    const b = ball;
    b.vy = -(13 + Math.random() * 4);
    let vx = (b.x - fromX) * 0.35 + (Math.random() - 0.5) * 8;
    if (Math.abs(vx) < 3) vx = Math.sign(vx || 1) * 3;
    b.vx = vx;
    b.spin += vx * 4;
    b.bounces = 0;
    b.still = 0;
    b.el.classList.remove("is-hit");
    void b.el.offsetWidth;
    b.el.classList.add("is-hit");

    if (!b.rally) { b.rally = true; return; }   // first hit starts the rally
    b.score++;
    if (b.score > 3) {
      b.score = 0;
      b.games++;
      showToast(b.games === 1 ? "Game! ✦" : `Game! ✦ ${b.games} games`);
    } else {
      showToast(POINTS[b.score]);
    }
  }

  function step(t) {
    const b = ball;
    if (!b) return;
    const dt = b.last ? Math.min((t - b.last) / 16.67, 3) : 1;
    b.last = t;

    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // side walls are glass: the ball comes back off them
    if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.85; }
    if (b.x > innerWidth - R) { b.x = innerWidth - R; b.vx = -Math.abs(b.vx) * 0.85; }
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.6; }

    const floor = innerHeight - R;
    if (b.y > floor) {
      b.y = floor;
      if (b.vy > 2.5) {
        b.bounces++;
        if (b.rally && b.bounces === 2) {
          b.rally = false;
          b.score = 0;
          showToast("Double bounce. Point lost!");
        }
      }
      b.vy = -b.vy * 0.72;
      b.vx *= 0.92;
      if (Math.abs(b.vy) < 1.2) b.vy = 0;
    }

    b.spin += b.vx * dt * 3;
    b.el.style.transform = `translate3d(${b.x - 22}px, ${b.y - 22}px, 0) rotate(${b.spin}deg)`;
    padel.x = b.x;
    padel.y = b.y;

    // once it has rolled to a stop, leave the court
    const resting = b.y >= floor - 0.5 && Math.abs(b.vx) < 0.3;
    b.still = resting ? b.still + dt : 0;
    if (b.still > 180) { end(); return; }
    requestAnimationFrame(step);
  }

  function end() {
    const { el, games } = ball;
    ball = null;
    padel.active = false;
    el.classList.add("is-gone");
    setTimeout(() => el.remove(), 500);
    showToast(games ? "Good game! 🎾" : "Type padel for a rematch");
  }

  document.querySelectorAll("[data-padel]").forEach((el) => el.addEventListener("click", serve));

})();
