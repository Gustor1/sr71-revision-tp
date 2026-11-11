/* SR71 – Labo de câblage : choisis le câble, clique sur 2 ports, vérifie. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const CABLES = {
    droit: { label: 'Droit (RJ45)', color: '#2f80ed' },
    croise: { label: 'Croisé (RJ45)', color: '#e2742b' },
    console: { label: 'Console (bleu)', color: '#7b61ff' },
  };

  /* --- modèles d'équipements --- */
  function swPorts() { const p = []; for (let i = 1; i <= 24; i++) p.push({ id: 'F0/' + i, kind: 'eth', label: 'Fa0/' + i }); p.push({ id: 'G0/1', kind: 'eth', label: 'Gi0/1' }, { id: 'G0/2', kind: 'eth', label: 'Gi0/2' }, { id: 'CON', kind: 'con', label: 'Console' }); return p; }
  const MODELS = {
    switch: { w: 380, h: 96, ports: swPorts, cls: 'dev-sw', sub: 'Catalyst 2960' },
    router: { w: 260, h: 96, ports: () => [{ id: 'G0/0/0', kind: 'eth', label: 'G0/0/0' }, { id: 'G0/0/1', kind: 'eth', label: 'G0/0/1' }, { id: 'CON', kind: 'con', label: 'Console' }, { id: 'AUX', kind: 'con', label: 'AUX' }], cls: 'dev-r', sub: 'ISR 4321' },
    vm: { w: 150, h: 78, ports: () => [{ id: 'NIC', kind: 'eth', label: 'Carte réseau' }], cls: 'dev-pc', sub: 'VM' },
    host: { w: 150, h: 78, ports: () => [{ id: 'USB', kind: 'ser', label: 'USB-série' }], cls: 'dev-host', sub: 'Ubuntu' },
  };
  const ROLE = { switch: 'S', router: 'R', vm: 'P', host: 'P' };

  /* --- scénarios --- */
  const SCEN = {
    annale: {
      title: 'Annale (PC-A — S1 — R1 — PC-B)',
      brief: "Topologie de l'annale : PC-A sur S1 F0/6, S1 F0/5 vers R1 G0/0/0, PC-B sur R1 G0/0/1. + le câble console de l'hôte vers l'équipement que tu configures.",
      devs: [
        { id: 'host', m: 'host', name: 'PC hôte', x: 40, y: 300, sub: 'Ubuntu · PuTTY' },
        { id: 'pca', m: 'vm', name: 'PC-A', x: 40, y: 60, sub: 'VM Windows 8' },
        { id: 's1', m: 'switch', name: 'S1', x: 260, y: 60 },
        { id: 'r1', m: 'router', name: 'R1', x: 690, y: 60 },
        { id: 'pcb', m: 'vm', name: 'PC-B', x: 790, y: 300, sub: 'VM Linux' },
      ],
      expect: [
        { a: 'pca.NIC', b: 's1.F0/6', t: 'droit' },
        { a: 's1.F0/5', b: 'r1.G0/0/0', t: 'droit' },
        { a: 'r1.G0/0/1', b: 'pcb.NIC', t: 'croise' },
        { a: 'host.USB', b: ['r1.CON', 's1.CON'], t: 'console' },
      ],
    },
    tp22: {
      title: 'TP2-2 – un routeur et un switch',
      brief: 'PC-A sur S1 F0/6, S1 F0/5 vers R1 G0/0/1, PC-B directement sur R1 G0/0/0.',
      devs: [
        { id: 'host', m: 'host', name: 'PC hôte', x: 40, y: 300, sub: 'Ubuntu · PuTTY' },
        { id: 'pca', m: 'vm', name: 'PC-A', x: 40, y: 60, sub: 'VM Windows 8' },
        { id: 's1', m: 'switch', name: 'S1', x: 260, y: 60 },
        { id: 'r1', m: 'router', name: 'R1', x: 690, y: 60 },
        { id: 'pcb', m: 'vm', name: 'PC-B', x: 790, y: 300, sub: 'VM Linux' },
      ],
      expect: [
        { a: 'pca.NIC', b: 's1.F0/6', t: 'droit' },
        { a: 's1.F0/5', b: 'r1.G0/0/1', t: 'droit' },
        { a: 'r1.G0/0/0', b: 'pcb.NIC', t: 'croise' },
        { a: 'host.USB', b: ['r1.CON', 's1.CON'], t: 'console' },
      ],
    },
    mac: {
      title: 'TP2-1 / VLAN – deux switchs',
      brief: 'PC-A sur S1 F0/6, S1 F0/1 relié à S2 F0/1, PC-B sur S2 F0/18.',
      devs: [
        { id: 'host', m: 'host', name: 'PC hôte', x: 400, y: 420, sub: 'Ubuntu · PuTTY' },
        { id: 'pca', m: 'vm', name: 'PC-A', x: 40, y: 260, sub: 'VM Windows 8' },
        { id: 's1', m: 'switch', name: 'S1', x: 40, y: 60 },
        { id: 's2', m: 'switch', name: 'S2', x: 560, y: 60 },
        { id: 'pcb', m: 'vm', name: 'PC-B', x: 790, y: 260, sub: 'VM Linux' },
      ],
      expect: [
        { a: 'pca.NIC', b: 's1.F0/6', t: 'droit' },
        { a: 's1.F0/1', b: 's2.F0/1', t: 'croise' },
        { a: 'pcb.NIC', b: 's2.F0/18', t: 'droit' },
        { a: 'host.USB', b: ['s1.CON', 's2.CON'], t: 'console' },
      ],
    },
    rots: {
      title: 'Inter-VLAN « router-on-a-stick »',
      brief: 'R1 G0/0/1 vers S1 F0/5 (trunk), S1 F0/1 vers S2 F0/1 (trunk), PC-A sur S1 F0/6, PC-B sur S2 F0/18.',
      devs: [
        { id: 'host', m: 'host', name: 'PC hôte', x: 420, y: 430, sub: 'Ubuntu · PuTTY' },
        { id: 'r1', m: 'router', name: 'R1', x: 340, y: 20 },
        { id: 'pca', m: 'vm', name: 'PC-A', x: 40, y: 400, sub: 'VM Windows 8' },
        { id: 's1', m: 'switch', name: 'S1', x: 40, y: 220 },
        { id: 's2', m: 'switch', name: 'S2', x: 560, y: 220 },
        { id: 'pcb', m: 'vm', name: 'PC-B', x: 790, y: 400, sub: 'VM Linux' },
      ],
      expect: [
        { a: 'r1.G0/0/1', b: 's1.F0/5', t: 'droit' },
        { a: 's1.F0/1', b: 's2.F0/1', t: 'croise' },
        { a: 'pca.NIC', b: 's1.F0/6', t: 'droit' },
        { a: 'pcb.NIC', b: 's2.F0/18', t: 'droit' },
        { a: 'host.USB', b: ['r1.CON', 's1.CON', 's2.CON'], t: 'console' },
      ],
    },
  };

  let svg, S, cables = [], sel = null, ctype = 'droit', fb, root, portPos = {};

  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  function draw() {
    svg.innerHTML = '';
    portPos = {};
    const H = Math.max(...S.devs.map(d => d.y + MODELS[d.m].h)) + 60;
    svg.setAttribute('viewBox', '0 0 960 ' + H);
    // cadre « PC hôte » qui contient les VM
    const vms = S.devs.filter(d => d.m === 'vm' || d.m === 'host');
    const gl = el('g', { class: 'cables' });
    S.devs.forEach(dv => {
      const M = MODELS[dv.m];
      const g = el('g', { class: 'dev ' + M.cls, transform: `translate(${dv.x},${dv.y})` }, svg);
      el('rect', { x: 0, y: 0, width: M.w, height: M.h, rx: 12, class: 'dev-body' }, g);
      const t = el('text', { x: 12, y: 22, class: 'dev-name' }, g); t.textContent = dv.name;
      const s = el('text', { x: 12, y: 38, class: 'dev-sub' }, g); s.textContent = dv.sub || M.sub;
      const ports = M.ports();
      if (dv.m === 'switch') {
        ports.forEach((p, i) => {
          let px, py;
          if (p.id.startsWith('F')) { const n = +p.id.split('/')[1]; const col = Math.floor((n - 1) / 2), row = (n - 1) % 2; px = 12 + col * 22; py = 46 + row * 22; }
          else if (p.id === 'G0/1') { px = 286; py = 46; } else if (p.id === 'G0/2') { px = 286; py = 68; } else { px = 330; py = 57; }
          port(g, dv, p, px, py, p.id.startsWith('F') ? p.id.split('/')[1] : p.id === 'CON' ? 'CON' : p.id.replace('G0/', 'G'));
        });
      } else if (dv.m === 'router') {
        ports.forEach((p, i) => { const px = 12 + i * 60, py = 54; port(g, dv, p, px, py, p.id === 'CON' ? 'CON' : p.id === 'AUX' ? 'AUX' : p.id); });
      } else {
        ports.forEach(p => port(g, dv, p, M.w - 34, M.h - 32, p.id === 'USB' ? 'USB' : 'NIC'));
      }
    });
    svg.appendChild(gl);
    cables.forEach((c, i) => {
      const A = portPos[c.a], B = portPos[c.b]; if (!A || !B) return;
      const midY = Math.max(A.y, B.y) + 40;
      const d = `M${A.x},${A.y} C${A.x},${midY} ${B.x},${midY} ${B.x},${B.y}`;
      const p = el('path', { d, class: 'cable', stroke: CABLES[c.t].color, 'stroke-dasharray': c.t === 'croise' ? '10 6' : c.t === 'console' ? '2 5' : '' }, gl);
      p.addEventListener('click', () => { cables.splice(i, 1); fb.innerHTML = ''; draw(); });
      const tt = el('title', {}, p); tt.textContent = CABLES[c.t].label + ' : ' + lab(c.a) + ' ↔ ' + lab(c.b) + ' (clic = retirer)';
    });
  }
  function lab(k) { const [d, p] = k.split('.'); const dv = S.devs.find(x => x.id === d); return dv.name + ' ' + (p === 'NIC' ? 'carte réseau' : p === 'USB' ? 'USB-série' : p); }
  function port(g, dv, p, x, y, short) {
    const key = dv.id + '.' + p.id;
    const used = cables.some(c => c.a === key || c.b === key);
    const gp = el('g', { class: 'port' + (p.kind !== 'eth' ? ' port-con' : '') + (used ? ' used' : '') + (sel === key ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': dv.name + ' ' + p.label }, g);
    const pw = dv.m === 'switch' && p.id.startsWith('F') ? 20 : (dv.m === 'router' && p.id.startsWith('G') ? 50 : 30);
    el('rect', { x, y, width: pw, height: 18, rx: 3 }, gp);
    const t = el('text', { x: x + pw / 2, y: y + 13, 'text-anchor': 'middle' }, gp); t.textContent = short;
    const tt = el('title', {}, gp); tt.textContent = dv.name + ' – ' + p.label;
    const w = pw;
    portPos[key] = { x: dv.x + x + w / 2, y: dv.y + y + 9, kind: p.kind };
    const act = () => click(key, p.kind);
    gp.addEventListener('click', act);
    gp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  }
  function click(key, kind) {
    if (cables.some(c => c.a === key || c.b === key)) { fb.innerHTML = '<p class="warn">Ce port est déjà utilisé. Clique sur le câble pour le retirer.</p>'; return; }
    if (!sel) { sel = key; draw(); fb.innerHTML = '<p class="muted">Port 1 : <b>' + lab(key) + '</b> — clique sur le 2ᵉ port.</p>'; return; }
    if (sel === key) { sel = null; draw(); fb.innerHTML = ''; return; }
    if (sel.split('.')[0] === key.split('.')[0]) { fb.innerHTML = '<p class="warn">On ne relie pas un équipement à lui-même.</p>'; sel = null; draw(); return; }
    cables.push({ a: sel, b: key, t: ctype });
    sel = null; draw();
    fb.innerHTML = '<p class="muted">Câble ' + CABLES[ctype].label + ' ajouté.</p>';
  }

  function check() {
    const res = []; let good = 0;
    const left = cables.slice();
    S.expect.forEach(e => {
      const bs = Array.isArray(e.b) ? e.b : [e.b];
      const i = left.findIndex(c => (c.a === e.a && bs.includes(c.b)) || (c.b === e.a && bs.includes(c.a)));
      const want = lab(e.a) + ' ↔ ' + bs.map(lab).join(' ou ');
      if (i < 0) { res.push(['ko', 'Manquant : ' + want + ' (' + CABLES[e.t].label + ')' + hintMissing(e)]); return; }
      const c = left.splice(i, 1)[0];
      if (c.t === e.t) { good++; res.push(['ok', want + ' — ' + CABLES[e.t].label]); }
      else if (e.t !== 'console' && c.t !== 'console') { good += 0.5; res.push(['mid', want + ' : tu as mis un câble ' + CABLES[c.t].label + '. En théorie il faut un ' + CABLES[e.t].label + ' (' + why(e) + '). En vrai ça marche quand même grâce à l’auto-MDIX des équipements récents.']); }
      else res.push(['ko', want + ' : mauvais câble (' + CABLES[c.t].label + '). ' + why(e)]);
    });
    left.forEach(c => {
      const a = portPos[c.a], b = portPos[c.b];
      let msg = 'En trop : ' + lab(c.a) + ' ↔ ' + lab(c.b) + '.';
      if (c.a.endsWith('AUX') || c.b.endsWith('AUX')) msg += ' Le port AUX n’est pas le port console !';
      else if ((a.kind === 'eth') !== (b.kind === 'eth')) msg += ' On ne branche pas un port Ethernet sur un port console.';
      res.push(['ko', msg]);
    });
    const total = S.expect.length;
    fb.innerHTML = '<p class="score">' + (good === total && !left.length ? '🎉 Câblage parfait !' : 'Score : ' + good + ' / ' + total) + '</p><ul class="checklist">' + res.map(([k, t]) => '<li class="' + k + '">' + (k === 'ok' ? '✓ ' : k === 'mid' ? '≈ ' : '✗ ') + t + '</li>').join('') + '</ul>';
    try { const best = JSON.parse(localStorage.getItem('sr71tp-cab') || '{}'); best[curId] = Math.max(best[curId] || 0, good / total); localStorage.setItem('sr71tp-cab', JSON.stringify(best)); } catch (e) { /* ignore */ }
  }
  function why(e) {
    const [a] = e.a.split('.'); const bs = Array.isArray(e.b) ? e.b : [e.b]; const [b] = bs[0].split('.');
    if (e.t === 'console') return 'la console se branche avec le câble bleu entre l’USB/COM de l’hôte et le port CONSOLE';
    const ra = ROLE[S.devs.find(x => x.id === a).m], rb = ROLE[S.devs.find(x => x.id === b).m];
    return e.t === 'droit' ? 'équipements de types différents (PC/routeur ↔ switch) = droit' : (ra === rb ? 'deux équipements du même type = croisé' : 'PC ↔ routeur = croisé (tous deux « terminaux »)');
  }
  function hintMissing(e) { return e.t === 'console' ? ' — sans console tu ne peux rien configurer !' : ''; }

  let curId = 'annale';
  function load(id) { curId = id; S = SCEN[id]; cables = []; sel = null; fb.innerHTML = ''; root.querySelector('#cabBrief').textContent = S.brief; draw(); }
  function solve() { cables = S.expect.map(e => ({ a: e.a, b: Array.isArray(e.b) ? e.b[0] : e.b, t: e.t })); sel = null; draw(); check(); }

  function init(r) {
    root = r;
    r.innerHTML = `
      <div class="cab-top">
        <label>Topologie <select id="cabSel">${Object.entries(SCEN).map(([k, s]) => `<option value="${k}">${s.title}</option>`).join('')}</select></label>
        <div class="cab-types" role="radiogroup" aria-label="Type de câble">
          ${Object.entries(CABLES).map(([k, c]) => `<button type="button" class="ctype${k === 'droit' ? ' on' : ''}" data-t="${k}" role="radio" aria-checked="${k === 'droit'}"><i style="background:${c.color}"></i>${c.label}</button>`).join('')}
        </div>
      </div>
      <p class="muted small" id="cabBrief"></p>
      <div class="cab-wrap"><svg id="cabSvg" viewBox="0 0 960 520" role="img" aria-label="Plan de câblage"></svg></div>
      <div class="cab-actions">
        <button class="btn" id="cabCheck" type="button">Vérifier mon câblage</button>
        <button class="btn ghost" id="cabReset" type="button">Tout débrancher</button>
        <button class="btn ghost" id="cabSolve" type="button">Montrer la solution</button>
      </div>
      <div id="cabFb" aria-live="polite"></div>`;
    svg = r.querySelector('#cabSvg'); fb = r.querySelector('#cabFb');
    r.querySelector('#cabSel').addEventListener('change', e => load(e.target.value));
    r.querySelectorAll('.ctype').forEach(b => b.addEventListener('click', () => { ctype = b.dataset.t; r.querySelectorAll('.ctype').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); }));
    r.querySelector('#cabCheck').addEventListener('click', check);
    r.querySelector('#cabReset').addEventListener('click', () => load(curId));
    r.querySelector('#cabSolve').addEventListener('click', solve);
    load('annale');
  }
  window.CABLING = { init };
})();
