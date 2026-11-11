/* SR71 – Révision TP : navigation, rendu des pages, exercices */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };
  const best = (k, score) => { const b = store.get('sr71tp-best', {}); if (!(k in b) || score > b[k]) { b[k] = score; store.set('sr71tp-best', b); } };

  /* ---------- toast + copie ---------- */
  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1600); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copié ✓'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copié ✓'); } catch (e2) { toast('Copie impossible'); } ta.remove(); }
  }
  function decorate(root) {
    $$('pre.code', root).forEach(pre => {
      if (pre.dataset.dec) return; pre.dataset.dec = 1;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = 'Copier'; b.setAttribute('aria-label', 'Copier le bloc');
      b.addEventListener('click', e => {
        e.stopPropagation();
        const txt = [...pre.childNodes].filter(n => n !== b).map(n => n.textContent).join('');
        copy(txt.replace(/\s{2,}(#|←|→|\().*$/gm, '').replace(/\n{2,}/g, '\n').trim());
      });
      pre.appendChild(b);
    });
  }

  /* ---------- navigation ---------- */
  const PAGES = ['accueil', 'annale', 'a4', 'commandes', 'enonce', 'simulateur', 'cablage', 'exos', 'examen'];
  const inited = {};
  function route() {
    let id = (location.hash || '#accueil').slice(1);
    if (!PAGES.includes(id)) id = 'accueil';
    $$('.page').forEach(p => p.classList.toggle('on', p.dataset.page === id));
    $$('.tabs a').forEach(a => { const on = a.getAttribute('href') === '#' + id; a.classList.toggle('on', on); if (on) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); } else a.removeAttribute('aria-current'); });
    if (!inited[id]) { inited[id] = true; (INIT[id] || (() => {}))(); }
    if (id === 'accueil') renderProgress();
    if (id === 'a4') fitA4();
    window.scrollTo(0, 0);
    document.title = 'SR71 · ' + ($('.tabs a.on') ? $('.tabs a.on').textContent : 'Révision TP');
  }

  const INIT = {
    accueil() { checklist($('#jourJ')); },
    annale() {
      decorate($('#p-annale'));
      const cb = $('#hideAns'); const body = $('#annaleBody');
      cb.addEventListener('change', () => { body.classList.toggle('hide-ans', cb.checked); $$('.revealed', body).forEach(x => x.classList.remove('revealed')); });
      body.addEventListener('click', e => { const a = e.target.closest('.ans'); if (a && body.classList.contains('hide-ans')) a.classList.add('revealed'); });
      $$('[data-sim]').forEach(b => b.addEventListener('click', () => { location.hash = '#simulateur'; setTimeout(() => SIM.pick(b.dataset.sim), 30); }));
    },
    a4() { $('#printA4').addEventListener('click', () => window.print()); window.addEventListener('resize', fitA4); },
    commandes: renderMachines,
    enonce: renderPhrases,
    simulateur() { SIM.init($('#sim')); },
    cablage() { CABLING.init($('#cab')); },
    exos: renderExos,
    examen() { EXAM.render($('#exam')); },
  };

  /* ---------- checklist persistée ---------- */
  function checklist(ul) {
    const k = ul.dataset.store; const st = store.get(k, []);
    $$('input', ul).forEach((c, i) => { c.checked = !!st[i]; c.addEventListener('change', () => { const s = $$('input', ul).map(x => x.checked); store.set(k, s); }); });
  }

  /* ---------- progression ---------- */
  function renderProgress() {
    const b = store.get('sr71tp-best', {}); const cab = store.get('sr71tp-cab', {});
    const tiles = [
      ['Énoncé → commande', b.trad], ['Dans quel mode ?', b.mode], ['Dépannage', b.dep], ['Ordre des commandes', b.ord], ['Sous-réseaux', b.sub],
      ['Câblage annale', cab.annale !== undefined ? Math.round(cab.annale * 100) : undefined],
    ];
    $('#progress').innerHTML = tiles.map(([t, v]) => `<div class="pt${v === undefined ? ' none' : v >= 80 ? ' good' : ''}"><b>${v === undefined ? '—' : v + ' %'}</b><span>${t}</span></div>`).join('');
  }

  /* ---------- commandes par machine ---------- */
  function renderMachines() {
    const tabs = $('#mtabs'), body = $('#mbody');
    tabs.innerHTML = DATA.machines.map((m, i) => `<button role="tab" type="button" data-i="${i}" aria-selected="${i === 0}"><span class="ic">${m.icon}</span><b>${m.name}</b><small>${m.os}</small></button>`).join('');
    const show = i => {
      const m = DATA.machines[i];
      $$('button', tabs).forEach(b => b.setAttribute('aria-selected', b.dataset.i == i));
      body.innerHTML = `<p class="role">${esc(m.role)}</p>` + m.groups.map(g => `<section class="cgroup"><h3>${esc(g.title)}</h3><div class="cmds">${g.cmds.map(c => `
        <div class="cmd${c.plain ? ' plain' : ''}"><button type="button" class="c" title="${c.plain ? '' : 'Copier'}" ${c.plain ? 'disabled' : ''}><code>${esc(c.c)}</code></button><p>${esc(c.d)}</p><span class="freq f${c.f}" title="${['', 'bonus', 'vu en TP', "dans l'annale"][c.f]}">${'★'.repeat(c.f)}</span></div>`).join('')}</div></section>`).join('');
      $$('.cmd .c', body).forEach(b => b.addEventListener('click', () => { if (!b.disabled) copy(b.textContent.replace(/\n /g, '\n ')); }));
      store.set('sr71tp-mtab', i);
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
    tabs.addEventListener('keydown', e => { const cur = +($('[aria-selected="true"]', tabs) || {}).dataset.i || 0; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (cur + (e.key === 'ArrowRight' ? 1 : -1) + DATA.machines.length) % DATA.machines.length; show(n); $$('button', tabs)[n].focus(); } });
    show(store.get('sr71tp-mtab', 0));
  }

  /* ---------- énoncé → commande ---------- */
  function renderPhrases() {
    const cats = ['Tout', ...new Set(DATA.phrases.map(p => p.cat))];
    let cat = 'Tout', q = '';
    $('#phCats').innerHTML = cats.map(c => `<button type="button" class="chip${c === 'Tout' ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
    const tb = $('#phTable tbody');
    const draw = () => {
      const qq = q.toLowerCase();
      const rows = DATA.phrases.filter(p => (cat === 'Tout' || p.cat === cat) && (!qq || (p.en + ' ' + p.fr + ' ' + p.cmd + ' ' + p.cat).toLowerCase().includes(qq)));
      tb.innerHTML = rows.map(p => `<tr><td><b>${esc(p.en)}</b><br><span class="small muted">${esc(p.fr)}</span></td><td><button type="button" class="c"><code>${esc(p.cmd)}</code></button>${p.alt ? `<br><span class="small muted">${esc(p.alt)}</span>` : ''}</td><td><span class="mode">${esc(p.mode)}</span><br><span class="small muted">${esc(p.dev)}</span></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Rien trouvé.</td></tr>';
      $$('.c', tb).forEach(b => b.addEventListener('click', () => copy(b.textContent)));
    };
    $('#phCats').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; $$('.chip', $('#phCats')).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#phSearch').addEventListener('input', e => { q = e.target.value; draw(); });
    $('#vocab').innerHTML = DATA.vocab.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('');
    draw();
  }

  /* ---------- correction des commandes tapées ---------- */
  function cmdMatches(user, canon) {
    const u = user.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
    const c = canon.trim().toLowerCase().split(' ');
    for (let i = 0; i < c.length; i++) {
      const ct = c[i];
      if (ct === '*') return u.length > i;
      const ut = u[i]; if (ut === undefined) return false;
      if (/^\{.*\}$/.test(ct)) { if (ut !== ct.slice(1, -1)) return false; continue; }
      if (ct.includes('*')) { const re = new RegExp('^' + ct.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+') + '$'); if (!re.test(ut)) return false; continue; }
      if (/[\d/.:%@="]|^-/.test(ct)) { if (ut !== ct) return false; continue; }
      if (!(ut === ct || (ct.startsWith(ut) && (ut.length >= 2 || ct === 'terminal')))) return false;
    }
    return u.length === c.length;
  }
  const accepts = (p, v) => p.ans.some(a => cmdMatches(v, a));

  /* ---------- exercices ---------- */
  const EXOS = [
    { id: 'trad', t: '⌨️ Énoncé → commande', f: exTrad },
    { id: 'mode', t: '🧭 Dans quel mode ?', f: exMode },
    { id: 'dep', t: '🩺 Dépannage', f: exDep },
    { id: 'ord', t: '🔢 Remets dans l’ordre', f: exOrd },
    { id: 'sub', t: '🧮 Sous-réseaux express', f: exSub },
    { id: 'tpq', t: '❓ Questions des TP', f: exTpq },
  ];
  function renderExos() {
    const tabs = $('#xtabs');
    tabs.innerHTML = EXOS.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}">${x.t}</button>`).join('');
    tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', tabs).forEach(x => x.setAttribute('aria-selected', x === b)); EXOS[+b.dataset.i].f($('#xbody')); });
    EXOS[0].f($('#xbody'));
  }
  function scoreLine(ok, n) { return `<p class="score">${ok} / ${n}${n ? ' · ' + Math.round(100 * ok / n) + ' %' : ''}</p>`; }

  function exTrad(box) {
    const cats = ['Tout', ...new Set(DATA.phrases.map(p => p.cat))];
    let pool, i, ok, n, cat = 'Tout';
    const start = () => { pool = shuffle(DATA.phrases.filter(p => cat === 'Tout' || p.cat === cat)).slice(0, 12); i = 0; ok = 0; n = 0; q(); };
    const q = () => {
      if (i >= pool.length) { const s = Math.round(100 * ok / n); if (cat === 'Tout') best('trad', s); box.querySelector('.xq').innerHTML = `<h3>Terminé !</h3>${scoreLine(ok, n)}<button class="btn" type="button" id="again">Recommencer</button>`; box.querySelector('#again').onclick = start; return; }
      const p = pool[i];
      box.querySelector('.xq').innerHTML = `
        <p class="small muted">Question ${i + 1} / ${pool.length} · ${esc(p.cat)} · ${esc(p.dev)}</p>
        <p class="qen">« ${esc(p.en)} »</p>
        <p class="small">${esc(p.q || 'Quelle commande tapes-tu ?')} <span class="mode">${esc(p.mode)}</span></p>
        <form class="xform"><input class="mono" id="xin" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Ta commande"><button class="btn" type="submit">Valider</button><button class="btn ghost" type="button" id="skip">Je sèche</button></form>
        <div id="xfb" aria-live="polite"></div>`;
      const inp = box.querySelector('#xin'); inp.focus();
      const done = (good) => {
        n++; if (good) ok++;
        box.querySelector('#xfb').innerHTML = `<p class="${good ? 'ok' : 'ko'}">${good ? '✓ Bien vu !' : '✗ Réponse attendue :'}</p><pre class="code">${esc(p.cmd)}</pre>${p.alt ? `<p class="small muted">${esc(p.alt)}</p>` : ''}<button class="btn" type="button" id="next">Suivante →</button>`;
        box.querySelector('.xform').querySelectorAll('input,button').forEach(x => { x.disabled = true; });
        const nx = box.querySelector('#next'); nx.focus(); nx.onclick = () => { i++; q(); };
        box.querySelector('.xsc').innerHTML = scoreLine(ok, n);
      };
      box.querySelector('.xform').onsubmit = e => { e.preventDefault(); if (inp.value.trim()) done(accepts(p, inp.value)); };
      box.querySelector('#skip').onclick = () => done(false);
    };
    box.innerHTML = `<div class="xhead"><p>Tape la commande comme dans PuTTY (les abréviations IOS sont acceptées : <code>sh</code>, <code>conf t</code>…).</p><div class="chips">${cats.map(c => `<button type="button" class="chip${c === 'Tout' ? ' on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div><div class="xsc"></div><div class="xq"></div>`;
    box.querySelector('.chips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; $$('.chip', box).forEach(x => x.classList.toggle('on', x === b)); start(); };
    start();
  }

  function exMode(box) {
    const opts = ['>', '#', '(config)#', '(config-if)#', '(config-line)#'];
    const labels = { '>': 'Router>', '#': 'Router#', '(config)#': 'Router(config)#', '(config-if)#': 'Router(config-if)#', '(config-line)#': 'Router(config-line)#' };
    let pool = shuffle(DATA.modes).slice(0, 15), i = 0, ok = 0;
    const q = () => {
      if (i >= pool.length) { best('mode', Math.round(100 * ok / pool.length)); box.innerHTML = `<h3>Terminé !</h3>${scoreLine(ok, pool.length)}<button class="btn" type="button" id="again">Recommencer</button>`; box.querySelector('#again').onclick = () => exMode(box); return; }
      const [c, m] = pool[i];
      box.innerHTML = `<p class="small muted">${i + 1} / ${pool.length} · score ${ok}</p><p>Dans quel mode tapes-tu :</p><pre class="code big">${esc(c)}</pre><div class="opts">${opts.map(o => `<button type="button" class="opt mono" data-o="${o}">${labels[o]}</button>`).join('')}</div><div id="xfb" aria-live="polite"></div>`;
      box.querySelector('.opts').onclick = e => {
        const b = e.target.closest('.opt'); if (!b || box.querySelector('.opt.sel')) return;
        const good = b.dataset.o === m; if (good) ok++;
        b.classList.add('sel', good ? 'good' : 'bad'); if (!good) box.querySelector(`[data-o="${CSS.escape(m)}"]`).classList.add('good');
        box.querySelector('#xfb').innerHTML = `<p class="${good ? 'ok' : 'ko'}">${good ? '✓' : '✗ C’était ' + labels[m]}</p><button class="btn" type="button" id="next">Suivante →</button>`;
        const nx = box.querySelector('#next'); nx.focus(); nx.onclick = () => { i++; q(); };
      };
    };
    q();
  }

  function exDep(box) {
    let pool = shuffle(DATA.troubles), i = 0, ok = 0;
    const q = () => {
      if (i >= pool.length) { best('dep', Math.round(100 * ok / pool.length)); box.innerHTML = `<h3>Terminé !</h3>${scoreLine(ok, pool.length)}<button class="btn" type="button" id="again">Recommencer</button>`; box.querySelector('#again').onclick = () => exDep(box); return; }
      const t = pool[i]; const order = shuffle(t.o.map((o, k) => k));
      box.innerHTML = `<p class="small muted">${i + 1} / ${pool.length} · score ${ok}</p><p class="qen">🩺 ${esc(t.s)}</p><p>Quelle est la cause la plus probable ?</p><div class="opts col">${order.map(k => `<button type="button" class="opt" data-k="${k}">${esc(t.o[k])}</button>`).join('')}</div><div id="xfb" aria-live="polite"></div>`;
      box.querySelector('.opts').onclick = e => {
        const b = e.target.closest('.opt'); if (!b || box.querySelector('.opt.sel')) return;
        const good = +b.dataset.k === t.ok; if (good) ok++;
        b.classList.add('sel', good ? 'good' : 'bad'); box.querySelector(`[data-k="${t.ok}"]`).classList.add('good');
        box.querySelector('#xfb').innerHTML = `<p class="${good ? 'ok' : 'ko'}">${good ? '✓ Exact.' : '✗ Pas tout à fait.'}</p><p class="expl">${esc(t.e)}</p><button class="btn" type="button" id="next">Suivant →</button>`;
        const nx = box.querySelector('#next'); nx.focus(); nx.onclick = () => { i++; q(); };
      };
    };
    q();
  }

  function exOrd(box) {
    let k = 0, total = 0, okc = 0;
    const q = () => {
      if (k >= DATA.orders.length) { best('ord', Math.round(100 * okc / total)); box.innerHTML = `<h3>Terminé !</h3>${scoreLine(okc, total)}<button class="btn" type="button" id="again">Recommencer</button>`; box.querySelector('#again').onclick = () => exOrd(box); return; }
      const o = DATA.orders[k]; let picked = [];
      const sh = shuffle(o.steps.map((s, i) => i));
      const draw = () => {
        box.innerHTML = `<p class="small muted">Série ${k + 1} / ${DATA.orders.length}</p><h3>${esc(o.t)}</h3><p class="small">Clique les étapes dans l'ordre. Clique une étape choisie pour l'enlever.</p>
          <ol class="picked">${picked.map(i => `<li><button type="button" class="opt mono" data-u="${i}">${esc(o.steps[i])}</button></li>`).join('')}</ol>
          <div class="opts col">${sh.filter(i => !picked.includes(i)).map(i => `<button type="button" class="opt mono" data-p="${i}">${esc(o.steps[i])}</button>`).join('')}</div>
          <div id="xfb"></div>`;
        box.onclick = e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.p !== undefined) { picked.push(+b.dataset.p); if (picked.length === o.steps.length) return verdict(); draw(); }
          else if (b.dataset.u !== undefined) { picked = picked.filter(x => x !== +b.dataset.u); draw(); }
        };
      };
      const verdict = () => {
        box.onclick = null;
        let good = 0; picked.forEach((p, i) => { if (p === i || o.steps[p] === o.steps[i]) good++; });
        total += o.steps.length; okc += good;
        box.innerHTML = `<h3>${esc(o.t)}</h3><ol class="picked">${picked.map((p, i) => `<li class="${p === i || o.steps[p] === o.steps[i] ? 'ok' : 'ko'}"><code>${esc(o.steps[p])}</code>${p === i || o.steps[p] === o.steps[i] ? '' : ` <span class="small">→ attendu : <code>${esc(o.steps[i])}</code></span>`}</li>`).join('')}</ol><p class="expl">${esc(o.note)}</p><button class="btn" type="button" id="next">Suivant →</button>`;
        box.querySelector('#next').onclick = () => { k++; q(); };
      };
      draw();
    };
    q();
  }

  function exSub(box) {
    const n2ip = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
    let ok = 0, n = 0;
    const q = () => {
      const len = [24, 25, 26, 27, 28, 29, 30][Math.floor(Math.random() * 7)];
      const ip = [[172, 16 + Math.floor(Math.random() * 16)], [192, 168], [10, Math.floor(Math.random() * 256)]][Math.floor(Math.random() * 3)].concat([Math.floor(Math.random() * 256), 1 + Math.floor(Math.random() * 254)]);
      const ipn = ip.reduce((a, b) => a * 256 + b, 0); const block = 2 ** (32 - len);
      const net = Math.floor(ipn / block) * block;
      const A = { mask: n2ip(2 ** 32 - block), net: n2ip(net), first: n2ip(net + 1), last: n2ip(net + block - 2), bc: n2ip(net + block - 1), hosts: String(block - 2) };
      box.innerHTML = `<p class="small muted">Score ${ok} / ${n}</p><p class="qen mono">${ip.join('.')}/${len}</p>
        <form class="subf">${[['mask', 'Masque'], ['net', 'Adresse réseau'], ['first', '1ʳᵉ adresse utilisable (= souvent le routeur)'], ['last', 'Dernière utilisable'], ['bc', 'Broadcast'], ['hosts', 'Nb d’hôtes']].map(([k, l]) => `<label>${l}<input class="mono" name="${k}" autocomplete="off"></label>`).join('')}
        <div><button class="btn" type="submit">Corriger</button> <button class="btn ghost" type="button" id="nx">Autre adresse</button></div></form><div id="xfb"></div>`;
      box.querySelector('#nx').onclick = q;
      box.querySelector('.subf').onsubmit = e => {
        e.preventDefault(); const f = e.target; let g = 0;
        Object.keys(A).forEach(k => { const good = f[k].value.trim() === A[k]; f[k].classList.toggle('good', good); f[k].classList.toggle('bad', !good); if (good) g++; });
        n++; if (g === 6) ok++; best('sub', Math.round(100 * ok / n));
        box.querySelector('#xfb').innerHTML = `<p class="${g === 6 ? 'ok' : 'ko'}">${g}/6 justes.</p><pre class="code">masque ${A.mask} · réseau ${A.net} · ${A.first} → ${A.last} · broadcast ${A.bc} · ${A.hosts} hôtes\nAstuce : taille du bloc = 2^(32-${len}) = ${block}. Le réseau est le multiple de ${block} juste en dessous.</pre>`;
      };
    };
    q();
  }

  function exTpq(box) {
    box.innerHTML = `<p>Les questions posées dans tes TP. Réfléchis, puis clique pour voir la réponse.</p><div class="flips">${DATA.tpQuestions.map(q => `<details class="flip"><summary><span class="tag">${q.tp}</span> ${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div>`;
  }

  /* ---------- fiche A4 : mise à l'échelle écran + contrôle de débordement ---------- */
  function fitA4() {
    const sheets = $$('.sheet'); if (!sheets.length || !$('#p-a4').classList.contains('on')) return;
    const wrap = $('.sheets'); const avail = wrap.clientWidth;
    const pxPerMm = 96 / 25.4; const w = 210 * pxPerMm;
    const s = Math.min(1, avail / w);
    wrap.style.setProperty('--s', s);
    const over = sheets.map(sh => { const c = $('.sh-cols', sh); return c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2; });
    $('#a4fit').textContent = over.some(Boolean) ? '⚠ une face déborde' : '✓ Recto et verso tiennent chacun sur une page A4.';
    window.__a4over = over;
  }

  /* ---------- thème ---------- */
  function themeInit() {
    $('#themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('sr71tp-theme', nx);
      try { localStorage.setItem('sr71tp-theme', nx); } catch (e) { /* */ }
    });
  }

  window.APP = { toast, decorate, cmdMatches };
  window.addEventListener('hashchange', route);
  themeInit();
  route();
})();
