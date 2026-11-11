/* SR71 – Générateur d'examens blancs (même structure que l'annale, valeurs aléatoires) */
(function () {
  'use strict';
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[rnd(0, a.length - 1)];
  const n2ip = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
  const ip2n = s => s.split('.').reduce((a, b) => a * 256 + (+b), 0);
  const maskOf = l => n2ip(2 ** 32 - 2 ** (32 - l));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function subnet(len) {
    const kind = pick(['172', '192', '10']);
    let base;
    if (kind === '172') base = ip2n('172.' + rnd(16, 31) + '.' + rnd(0, 250) + '.0');
    else if (kind === '192') base = ip2n('192.168.' + rnd(0, 250) + '.0');
    else base = ip2n('10.' + rnd(0, 250) + '.' + rnd(0, 250) + '.0');
    const block = 2 ** (32 - len);
    base += Math.floor(rnd(0, Math.max(0, 256 / block - 1))) * block;
    return base;
  }

  function generate() {
    const len0 = pick([24, 24, 24, 25, 26, 27]), len1 = pick([24, 24, 24, 25, 26, 27]);
    const n0 = subnet(len0); let n1 = subnet(len1);
    if (Math.abs(n1 - n0) < 256) n1 += 256 * 3;
    const hex = () => rnd(1, 255).toString(16);
    const pfx = pick(['2001:db8:acad', '2001:fe:ab', '2001:db8:' + hex(), '2001:' + hex() + ':' + hex()]);
    const sub0 = rnd(1, 20).toString(16), sub1 = (parseInt(sub0, 16) + rnd(1, 9)).toString(16);
    const rl = pick(['fe80::1', 'fe80::1', 'fe80::a', 'fe80::254']);
    const minLen = pick([5, 6, 8]);
    const secrets = { 5: ['class', 'enabl'], 6: ['class6', 'secret'], 8: ['class123', 'enable88'] };
    const cons = { 5: ['cisco', 'conso'], 6: ['cisco1', 'consol'], 8: ['cisco123', 'console8'] };
    const pcaPort = rnd(2, 24); let rPort = rnd(1, 24); while (rPort === pcaPort) rPort = rnd(1, 24);
    const P = {
      seed: Date.now(), rname: 'R1', sname: 'S1',
      domain: pick(['ccna-lab.com', 'utbm-lab.com', 'sr71-lab.fr', 'netlab.com']),
      minLen, secret: pick(secrets[minLen]), con: pick(cons[minLen]),
      user: pick(['admin', 'netadmin', 'sr71']), upass: pick(['admin1pass', 'P@ssw0rd', 'Adm1nP@55']), rsa: pick([1024, 1024, 2048]),
      len0, len1, mask0: maskOf(len0), mask1: maskOf(len1),
      net0: n2ip(n0), net1: n2ip(n1),
      r_g0: n2ip(n0 + 1), r_g1: n2ip(n1 + 1), s_ip: n2ip(n0 + 2), pca: n2ip(n0 + 10), pcb: n2ip(n1 + 10),
      gua0: pfx + ':' + sub0 + '::1/64', gua1: pfx + ':' + sub1 + '::1/64', p6_0: pfx + ':' + sub0 + '::/64', p6_1: pfx + ':' + sub1 + '::/64',
      lla: rl, s_lla: rl.replace(/[0-9a-f]+$/, m => (parseInt(m, 16) + 1).toString(16)),
      pcaPort, rPort, used: ['FastEthernet0/' + Math.min(pcaPort, rPort), 'FastEthernet0/' + Math.max(pcaPort, rPort)],
    };
    if (P.s_lla === P.lla) P.s_lla = 'fe80::2';
    P.hosts = [{ name: 'PC-A', ip: P.pca, port: 'FastEthernet0/' + pcaPort }, { name: 'PC-B', ip: P.pcb }, { name: 'R1', ip: P.r_g0, port: 'FastEthernet0/' + rPort }];
    return P;
  }

  let P = null;
  function load() { try { P = JSON.parse(localStorage.getItem('sr71tp-exam')); } catch (e) { P = null; } if (!P) { P = generate(); store(); } }
  function store() { try { localStorage.setItem('sr71tp-exam', JSON.stringify(P)); } catch (e) { /* ignore */ } }

  function topoSvg() {
    return `<svg viewBox="0 0 640 120" class="topo" role="img" aria-label="Topologie de l'examen blanc">
      <g class="t-pc"><rect x="8" y="34" width="86" height="46" rx="8"/><text x="51" y="62">PC-A</text></g>
      <g class="t-sw"><rect x="190" y="34" width="96" height="46" rx="8"/><text x="238" y="62">S1</text></g>
      <g class="t-r"><rect x="380" y="34" width="96" height="46" rx="23"/><text x="428" y="62">R1</text></g>
      <g class="t-pc"><rect x="546" y="34" width="86" height="46" rx="8"/><text x="589" y="62">PC-B</text></g>
      <line x1="94" y1="57" x2="190" y2="57"/><line x1="286" y1="57" x2="380" y2="57"/><line x1="476" y1="57" x2="546" y2="57" stroke-dasharray="6 4"/>
      <text class="t-lab" x="182" y="28" text-anchor="end">F0/${P.pcaPort}</text><text class="t-lab" x="294" y="28">F0/${P.rPort}</text>
      <text class="t-lab" x="372" y="28" text-anchor="end">G0/0/0</text><text class="t-lab" x="484" y="28">G0/0/1</text>
    </svg>`;
  }

  function render(root) {
    load();
    const sw = `S1 ports used: F0/${P.pcaPort} (PC-A) and F0/${P.rPort} (R1)`;
    const rows = (arr) => arr.map(([t, s, p]) => `<tr><td>${t}</td><td>${s}</td><td class="num">${p}</td></tr>`).join('');
    root.innerHTML = `
      <div class="exam-bar">
        <button class="btn" id="exNew" type="button">🎲 Nouveau sujet</button>
        <button class="btn ghost" id="exTimer" type="button">⏱ Lancer le chrono (55 min)</button>
        <span class="timer" id="exClock" aria-live="off"></span>
        <button class="btn ghost" id="exSimR" type="button">Faire R1 dans le simulateur</button>
        <button class="btn ghost" id="exSimS" type="button">Faire S1 dans le simulateur</button>
        <button class="btn ghost" id="exPrint" type="button">🖨 Imprimer le sujet</button>
      </div>
      <article class="paper" id="exPaper">
        <h3>Skills Assessment – sujet blanc n°${String(P.seed).slice(-4)}</h3>
        ${topoSvg()}
        <p class="small muted">${sw}</p>
        <h4>Addressing Table</h4>
        <table class="tbl"><thead><tr><th>Device</th><th>Interface</th><th>IP Address</th><th>Default Gateway</th></tr></thead><tbody>
          <tr><td rowspan="2">R1</td><td>G0/0/0</td><td>${P.r_g0}/${P.len0}<br>${P.gua0}<br>${P.lla}</td><td>N/A</td></tr>
          <tr><td>G0/0/1</td><td>${P.r_g1}/${P.len1}<br>${P.gua1}<br>${P.lla}</td><td>N/A</td></tr>
          <tr><td>S1</td><td>VLAN 1</td><td>${P.s_ip}/${P.len0}<br>Auto<br>${P.s_lla}</td><td>${P.r_g0}<br>Auto<br>Auto</td></tr>
          <tr><td>PCA</td><td>NIC</td><td>${P.pca}/${P.len0}<br>Auto<br>Auto</td><td>${P.r_g0}<br>Auto<br>Auto</td></tr>
          <tr><td>PCB</td><td>NIC</td><td>${P.pcb}/${P.len1}<br>Auto<br>Auto</td><td>${P.r_g1}<br>Auto<br>Auto</td></tr>
        </tbody></table>
        <h4>Initialize and reload devices (−10 if an old configuration is still present)</h4>
        <p>Erase the startup configurations and VLANs, change the SDM template of the switch to support IPv6, reload.</p>
        <h4>Configure S1 (12 p)</h4>
        <table class="tbl"><thead><tr><th>Task</th><th>Specification</th><th>Pts</th></tr></thead><tbody>${rows([
          ['Disable DNS lookup', '', 2], ['Switch name', 'S1-family_name', 2], ['Shutdown all unused interfaces', '', 3],
          ['Configure Management Interface (SVI) on VLAN1', 'Description (1) · L3 IPv4 address and gateway (2) · IPv6 Link Local Address (2)', 5]])}</tbody></table>
        <h4>Configure R1 (30 p)</h4>
        <table class="tbl"><thead><tr><th>Task</th><th>Specification</th><th>Pts</th></tr></thead><tbody>${rows([
          ['Disable DNS lookup', '', 1], ['Router name', 'R1-family_name', 1], ['Domain name', P.domain, 1], ['Set the minimum length for passwords', P.minLen + ' characters', 1],
          ['Encrypted privileged EXEC password', P.secret, 1], ['Console access password', P.con, 1], ['Create an administrative user in the local database', 'Username: ' + P.user + ' · Password: ' + P.upass, 2],
          ['Generate an RSA crypto key', P.rsa + ' bits modulus', 1], ['Set login on vty lines to use local database', '', 1], ['Set vty lines to accept SSH connections only', '', 1],
          ['Encrypt the clear text passwords', '', 1], ['Configure an MOTD Banner', '', 1], ['Enable IPv6 Routing', '', 1],
          ['Configure Interface G0/0/0', 'Description · IPv4 · IPv6 LLA · IPv6 GUA · Activate', 8], ['Configure Interface G0/0/1', 'Description · IPv4 · IPv6 LLA · IPv6 GUA · Activate', 8]])}</tbody></table>
        <h4>Configure host computers – a Windows and a Linux (8 p)</h4>
        <p>PCA: set IPv4 address and gateway (2) · PCB: set IPv4 address and gateway (2) · PCA: write down the IPv6 GUA (2) · PCB: write down the IPv6 GUA (2)</p>
        <h4>Test and Verify End-to-End Connectivity (24 p)</h4>
        <p>PCA → PCB: IPv4, IPv6 GUA (5+5) · if it fails: PCA → G0/0/0 IPv4 + LLA · PCB → G0/0/1 IPv4 + LLA · PCA → G0/0/1 IPv4 + GUA · PCB → G0/0/0 IPv4 + GUA (2 each). Other command showing delay and breaks in the path (2). SSH from the Linux workstation to the router, leave it open (4).</p>
        <h4>Use the IOS CLI to gather device information (16 p)</h4>
        <p>IPv4 interface summary · IPv4 routing table · L2↔L3 mapping · detailed IPv4 info on G0/0/0 · IPv6 routing table · IPv6 interface summary · MAC addresses on the switch · save the configuration.</p>
      </article>
      <details class="corr" id="exCorr"><summary>👀 Correction complète de ce sujet</summary>${correction()}</details>`;

    root.querySelector('#exNew').onclick = () => { P = generate(); store(); render(root); window.APP && APP.toast('Nouveau sujet généré'); };
    root.querySelector('#exPrint').onclick = () => { document.body.classList.add('print-exam'); window.print(); setTimeout(() => document.body.classList.remove('print-exam'), 500); };
    root.querySelector('#exSimR').onclick = () => { location.hash = '#simulateur'; setTimeout(() => window.SIM && SIM.pick('blanc'), 50); };
    root.querySelector('#exSimS').onclick = () => { location.hash = '#simulateur'; setTimeout(() => window.SIM && SIM.pick('blanc-s'), 50); };
    const btn = root.querySelector('#exTimer'), clk = root.querySelector('#exClock');
    btn.onclick = () => {
      if (window.__exT) { clearInterval(window.__exT); window.__exT = null; btn.textContent = '⏱ Lancer le chrono (55 min)'; clk.textContent = ''; return; }
      const end = Date.now() + 55 * 60000; btn.textContent = '■ Arrêter';
      const tick = () => { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); clk.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + (s < 300 ? ' ⚠' : ''); if (!s) { clearInterval(window.__exT); window.__exT = null; clk.textContent = 'Temps écoulé !'; } };
      tick(); window.__exT = setInterval(tick, 1000);
    };
    if (window.APP) APP.decorate(root);
  }

  function correction() {
    const S = window.SIM;
    const pre = (t) => `<pre class="code copyable">${esc(t)}</pre>`;
    return `
      <div class="grid2">
        <section><h4>S1 (init + config)</h4>${pre(S.solS1(Object.assign({}, P)).replace('S1-Nom', 'S1-TonNom'))}</section>
        <section><h4>R1</h4>${pre(S.solR1(P).replace('R1-Nom', 'R1-TonNom'))}</section>
      </div>
      <div class="grid2">
        <section><h4>PC-A (Windows, cmd admin)</h4>${pre(`netsh interface ipv4 set address name="Ethernet" static ${P.pca} ${P.mask0} ${P.r_g0}
netsh advfirewall set allprofiles state off
ipconfig        → GUA = « Adresse IPv6 » commençant par ${P.p6_0.replace('::/64', ':')}`)}</section>
        <section><h4>PC-B (Linux)</h4>${pre(`sudo ip addr add ${P.pcb}/${P.len1} dev enp0s3
sudo ip route add default via ${P.r_g1}
ip -6 addr show dev enp0s3   → ligne « inet6 ${P.p6_1.replace('::/64', ':')}… scope global »`)}</section>
      </div>
      <h4>Tests (dans l'ordre de l'énoncé)</h4>
      ${pre(`PC-A> ping ${P.pcb}                 (IPv4 → PC-B)
PC-A> ping <GUA de PC-B>              (IPv6, lue sur PC-B)
PC-A> ping ${P.r_g0}  +  ping ${P.lla}%<index>   (→ G0/0/0)
PC-B$ ping -c4 ${P.r_g1}  +  ping -6 -c4 -I enp0s3 ${P.lla}   (→ G0/0/1)
PC-A> ping ${P.r_g1}  +  ping ${P.gua1.split('/')[0]}           (→ G0/0/1 GUA)
PC-B$ ping -c4 ${P.r_g0}  +  ping -c4 ${P.gua0.split('/')[0]}   (→ G0/0/0 GUA)
Délais/coupures : tracert (Windows) / traceroute (Linux)
PC-B$ ssh ${P.user}@${P.r_g1}     (mot de passe ${P.upass}) – laisser ouvert`)}
      <h4>Partie 4</h4>
      ${pre(`show ip interface brief
show ip route
show arp
show ip interface g0/0/0
show ipv6 route
show ipv6 interface brief
show mac address-table      (sur S1)
copy running-config startup-config`)}
      <p class="small muted">Masques : /${P.len0} = ${P.mask0} · /${P.len1} = ${P.mask1}. Réseaux : ${P.net0}/${P.len0} et ${P.net1}/${P.len1}.</p>`;
  }

  window.EXAM = { render, params: () => { load(); return P; } };
})();
