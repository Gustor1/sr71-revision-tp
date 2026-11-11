/* SR71 – Mini-simulateur Cisco IOS (pédagogique, pas exhaustif)
   Modes, abréviations (conf t, sh ip int br…), aide « ? », Tab, historique,
   messages d'erreur réalistes + indices en français, missions auto-corrigées. */
(function () {
  'use strict';

  /* ================= utilitaires adresses ================= */
  const isIp = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every(n => +n <= 255);
  const ip2n = s => s.split('.').reduce((a, b) => (a * 256) + (+b), 0);
  const n2ip = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');
  const maskLen = m => { const n = ip2n(m); let c = 0, seen0 = false; for (let i = 31; i >= 0; i--) { const bit = Math.floor(n / 2 ** i) % 2; if (bit) { if (seen0) return -1; c++; } else seen0 = true; } return c; };
  const isMask = s => isIp(s) && maskLen(s) >= 0;
  const netOf = (ip, m) => { const l = maskLen(m); const n = ip2n(ip); const block = 2 ** (32 - l); return n2ip(Math.floor(n / block) * block); };
  const sameNet = (a, b, m) => netOf(a, m) === netOf(b, m);

  function expand6(a) {
    a = a.toLowerCase().split('%')[0];
    if (!/^[0-9a-f:]+$/.test(a) || !a.includes(':')) return null;
    let parts;
    if (a.includes('::')) {
      const [l, r] = a.split('::');
      if (a.split('::').length > 2) return null;
      const L = l ? l.split(':') : [], R = r ? r.split(':') : [];
      const fill = 8 - L.length - R.length; if (fill < 1) return null;
      parts = [...L, ...Array(fill).fill('0'), ...R];
    } else parts = a.split(':');
    if (parts.length !== 8 || parts.some(p => p.length > 4 || p === '')) return null;
    return parts.map(p => p.padStart(4, '0'));
  }
  function compress6(parts) {
    const h = parts.map(p => p.replace(/^0+(?=.)/, ''));
    let best = -1, bl = 0;
    for (let i = 0; i < 8; i++) { if (h[i] === '0') { let j = i; while (j < 8 && h[j] === '0') j++; if (j - i > bl && j - i > 1) { best = i; bl = j - i; } i = j; } }
    if (best < 0) return h.join(':');
    return (h.slice(0, best).join(':') + '::' + h.slice(best + bl).join(':'));
  }
  const norm6 = a => { const e = expand6(a); return e ? compress6(e).toUpperCase() : a.toUpperCase(); };
  const isV6 = s => !!expand6(s);
  const isV6p = s => { const m = s.match(/^(.+)\/(\d{1,3})$/); return !!(m && isV6(m[1]) && +m[2] <= 128); };
  function net6(addrP) { // /64 only (suffisant ici)
    const [a, l] = addrP.split('/'); const e = expand6(a); const len = +l;
    const keep = Math.floor(len / 16); const out = e.map((p, i) => i < keep ? p : '0000');
    return compress6(out).toUpperCase() + '/' + len;
  }

  /* ================= interfaces ================= */
  const TYPES = [['gigabitethernet', 'GigabitEthernet', 'Gi'], ['fastethernet', 'FastEthernet', 'Fa'], ['vlan', 'Vlan', 'Vl']];
  function parseIf(tok) {
    const m = tok.toLowerCase().match(/^([a-z]+)\s*([\d/.]+)$/);
    if (!m) return null;
    const t = TYPES.find(T => T[0].startsWith(m[1]));
    if (!t) return null;
    return t[1] + m[2];
  }
  const shortIf = n => { const t = TYPES.find(T => n.startsWith(T[1])); return t ? t[2] + n.slice(t[1].length) : n; };

  function makeIfaces(type) {
    const o = {};
    const base = () => ({ desc: null, ip: null, mask: null, v6: [], lla: null, shut: false, swmode: null, access: 1, native: 1, allowed: null, helper: null, enc: null, ndO: false, ndM: false, dhcp6: null, relay6: null });
    if (type === 'router') {
      ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'].forEach(n => { o[n] = Object.assign(base(), { shut: true }); });
    } else {
      for (let i = 1; i <= 24; i++) o['FastEthernet0/' + i] = base();
      o['GigabitEthernet0/1'] = base(); o['GigabitEthernet0/2'] = base();
      o['Vlan1'] = Object.assign(base(), { shut: true });
    }
    return o;
  }
  function blankCfg(type) {
    return {
      hostname: type === 'router' ? 'Router' : 'Switch', lookup: true, domain: null, minLen: 0,
      secret: null, enpass: null, spe: false, banner: null, v6r: false, users: {}, sshv: null, rsa: 0,
      dgw: null, routes: [], v6routes: [], dhcpEx: [], pools: {}, v6pools: {},
      con: { pass: null, login: false, local: false, sync: false },
      vty: { range: type === 'router' ? '0 4' : '0 15', pass: null, login: false, local: false, transport: null },
      ifaces: makeIfaces(type),
    };
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* fausses empreintes pour l'affichage */
  const fake7 = s => '0' + [...s].map((c, i) => ((c.charCodeAt(0) ^ (0x2b + i * 7)) & 0xff).toString(16).padStart(2, '0').toUpperCase()).join('');
  const fake9 = s => { let h = 5381; for (const c of s + 'sr71') h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; const al = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; let o = ''; let x = h; for (let i = 0; i < 43; i++) { o += al[x % 64]; x = ((x * 1103515245 + 12345) >>> 0); } return '$9$' + o.slice(0, 14) + '$' + o.slice(14); };
  const fakeMac = (seed) => { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; const x = h.toString(16).padStart(8, '0'); return '0050.56' + x.slice(0, 2) + '.' + x.slice(2, 6); };

  /* ================= patrons de commandes ================= */
  const PH = {
    '<ip>': { lab: 'A.B.C.D', t: s => isIp(s) ? s : false },
    '<mask>': { lab: 'A.B.C.D', t: s => isMask(s) ? s : false },
    '<v6p>': { lab: 'X:X:X:X::X/<0-128>', t: s => isV6p(s) ? s : false },
    '<v6>': { lab: 'X:X:X:X::X', t: s => isV6(s) ? s : false },
    '<if>': { lab: 'interface (ex. g0/0/0)', t: s => parseIf(s) || false },
    '<num>': { lab: '<nombre>', t: s => /^\d+$/.test(s) ? +s : false },
    '<word>': { lab: 'WORD', t: s => s },
    '<rest>': { lab: 'LINE', rest: true },
  };
  // préférences d'abréviation façon IOS (en cas d'ambiguïté)
  const PREF = { s: 'show', sh: 'show', c: 'configure', co: 'configure', con: 'configure', conf: 'configure', t: 'terminal', int: 'interface', i: 'interface', e: 'enable', en: 'enable', ex: 'exit', no: 'no', n: 'no', d: 'description', de: 'description', des: 'description', desc: 'description', r: 'reload', re: 'reload', ru: 'running-config', run: 'running-config', st: 'startup-config', sta: 'startup-config', start: 'startup-config', b: 'brief', br: 'brief', p: 'password', pa: 'password', l: 'login', lo: 'login', log: 'login', ip: 'ip', ipv: 'ipv6', ro: 'route', rou: 'route', wr: 'write', w: 'write', sw: 'switchport', ac: 'access', h: 'hostname', ho: 'hostname', sec: 'secret', u: 'username', us: 'username', v: 'vlan', a: 'address', ad: 'address', addr: 'address', li: 'line', m: 'mode', tr: 'trunk', cl: 'clock', ma: 'mac', inte: 'interface', interf: 'interface', er: 'erase', del: 'delete', ping: 'ping', pi: 'ping', tra: 'traceroute', ver: 'version', ve: 'version', ar: 'arp' };

  const C = []; // définitions
  function cmd(modes, pat, run, opt = {}) { C.push(Object.assign({ modes, pat, toks: pat.split(' ').map(w => PH[w] ? Object.assign({ ph: w }, PH[w]) : { kw: w }), run }, opt)); }

  const MODES = {
    user: '>', priv: '#', config: '(config)#', if: '(config-if)#', range: '(config-if-range)#', subif: '(config-subif)#',
    line: '(config-line)#', vlan: '(config-vlan)#', dhcp: '(dhcp-config)#', dhcp6: '(config-dhcpv6)#',
  };
  const SUB = ['if', 'range', 'subif', 'line', 'vlan', 'dhcp', 'dhcp6'];
  const CONF = ['config', ...SUB];
  const EXEC = ['user', 'priv'];
  const IFM = ['if', 'range', 'subif'];

  /* ---------- helpers d'état ---------- */
  const R = d => d.run;
  const curIfs = d => (d.ctx || []).map(n => R(d).ifaces[n]).filter(Boolean);
  function linkUp(d, n) {
    const ifc = R(d).ifaces[n]; if (!ifc || ifc.shut) return false;
    if (n.startsWith('Vlan')) { const v = +n.slice(4); return Object.keys(R(d).ifaces).some(p => !p.startsWith('Vlan') && (d.links || []).includes(p) && !R(d).ifaces[p].shut && (R(d).ifaces[p].swmode === 'trunk' || (R(d).ifaces[p].access || 1) === v)); }
    if (n.includes('.')) return linkUp(d, n.split('.')[0]);
    return (d.links || []).includes(n);
  }
  const status = (d, n) => R(d).ifaces[n].shut ? 'administratively down' : (linkUp(d, n) ? 'up' : 'down');
  const proto = (d, n) => linkUp(d, n) ? 'up' : 'down';
  const out = (...l) => l.join('\n');

  /* ================= EXEC ================= */
  cmd(['user'], 'enable', (d) => {
    if (R(d).secret || R(d).enpass) { d.pending = { k: 'enpw', tries: 0 }; return { prompt: 'Password: ', hide: true }; }
    d.mode = 'priv';
  });
  cmd(['priv'], 'disable', d => { d.mode = 'user'; });
  cmd(['user', 'priv'], 'exit', d => { d.mode = 'user'; return out('', d.run.hostname + ' con0 is now available', '', 'Press RETURN to get started.'); });
  cmd(['user', 'priv'], 'logout', d => { d.mode = 'user'; return 'Press RETURN to get started.'; });
  cmd(['priv'], 'configure terminal', d => { d.mode = 'config'; return 'Enter configuration commands, one per line.  End with CNTL/Z.'; });
  cmd(['priv'], 'configure', d => { d.pending = { k: 'conft' }; return { prompt: 'Configuring from terminal, memory, or network [terminal]? ' }; });

  cmd(['priv'], 'copy running-config startup-config', d => { d.pending = { k: 'copy' }; return { prompt: 'Destination filename [startup-config]? ' }; });
  cmd(['priv'], 'write memory', d => save(d));
  cmd(['priv'], 'write', d => save(d));
  cmd(['priv'], 'write erase', d => { d.pending = { k: 'erase' }; return { prompt: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]' }; });
  cmd(['priv'], 'erase startup-config', d => { d.pending = { k: 'erase' }; return { prompt: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]' }; });
  cmd(['priv'], 'delete <word>', (d, [f]) => {
    if (d.type !== 'switch' || !/^(flash:)?vlan\.dat$/i.test(f)) return '%Error deleting flash:/' + f.replace(/^flash:/i, '') + ' (No such file or directory)';
    d.pending = { k: 'del1' }; return { prompt: 'Delete filename [vlan.dat]? ' };
  });
  cmd(['priv'], 'reload', d => {
    if (JSON.stringify(d.run) !== JSON.stringify(d.start || blankCfg(d.type)) ) { d.pending = { k: 'rlsave' }; return { prompt: 'System configuration has been modified. Save? [yes/no]: ' }; }
    d.pending = { k: 'rlgo' }; return { prompt: 'Proceed with reload? [confirm]' };
  });
  cmd(['priv'], 'clock set <rest>', (d, [r]) => { if (!/^\d{1,2}:\d{2}:\d{2} \d{1,2} [a-z]{3,} \d{4}$/i.test(r.trim())) return "% Format attendu : clock set 15:00:00 31 Jan 2035"; d.clock = r.trim(); });
  cmd(['priv'], 'clear mac address-table dynamic', () => '');

  cmd(['user', 'priv'], 'ping <word>', (d, [t]) => ping(d, t));
  cmd(['user', 'priv'], 'ping ipv6 <word>', (d, [t]) => ping(d, t));
  cmd(['user', 'priv'], 'traceroute <word>', (d, [t]) => trace(d, t));
  cmd(['user', 'priv'], 'ssh -l <word> <word>', (d, [u, t]) => out('Trying ' + t + ' ...', '% Simulateur : une seule machine à la fois. Sur le vrai switch tu serais connecté à ' + t + ' (Ctrl+Maj+6 puis x pour revenir).'));
  cmd(['user', 'priv'], 'telnet <word>', (d, [t]) => out('Trying ' + t + ' ... Open', '% Simulateur : connexion non simulée.'));

  /* ---- show ---- */
  const SH = ['user', 'priv'];
  cmd(['priv'], 'show running-config', d => runText(d, d.run));
  cmd(['priv'], 'show startup-config', d => d.start ? 'Using 1789 out of 33554432 bytes\n' + runText(d, d.start) : 'startup-config is not present');
  cmd(SH, 'show version', d => verText(d));
  cmd(SH, 'show clock', d => '*' + (d.clock || '12:34:56.789 UTC Wed Nov 11 2026'));
  cmd(SH, 'show ip interface brief', d => ipBrief(d));
  cmd(SH, 'show ipv6 interface brief', d => v6Brief(d));
  cmd(SH, 'show ip route', d => ipRoute(d), { only: 'router' });
  cmd(SH, 'show ipv6 route', d => v6Route(d), { only: 'router' });
  cmd(SH, 'show arp', d => arpText(d));
  cmd(SH, 'show ip arp', d => arpText(d));
  cmd(SH, 'show ip interface', d => Object.keys(R(d).ifaces).filter(n => !(d.type === 'switch' && n.startsWith('Fast') && !linkUp(d, n))).map(n => ipIfText(d, n)).join('\n'));
  cmd(SH, 'show ip interface <if>', (d, [n]) => R(d).ifaces[n] ? ipIfText(d, n) : badIf());
  cmd(SH, 'show ipv6 interface <if>', (d, [n]) => R(d).ifaces[n] ? v6IfText(d, n) : badIf());
  cmd(SH, 'show interfaces <if>', (d, [n]) => R(d).ifaces[n] ? ifText(d, n) : badIf());
  cmd(SH, 'show interfaces', d => Object.keys(R(d).ifaces).slice(0, 4).map(n => ifText(d, n)).join('\n') + '\n (…)');
  cmd(['priv'], 'show mac address-table', d => macText(d), { only: 'switch' });
  cmd(SH, 'show vlan brief', d => vlanText(d), { only: 'switch' });
  cmd(SH, 'show vlan', d => vlanText(d), { only: 'switch' });
  cmd(SH, 'show interfaces trunk', d => trunkText(d), { only: 'switch' });
  cmd(SH, 'show sdm prefer', d => ' The current template is "' + (d.sdm.active === 'default' ? 'default' : d.sdm.active) + '" template.\n' + (d.sdm.active === 'default' ? ' This template does NOT support IPv6.' : ' IPv4 and IPv6 are supported.') + (d.sdm.next ? '\n\n On next reload, template will be "' + d.sdm.next + '" template.' : ''), { only: 'switch' });
  cmd(SH, 'show ip ssh', d => R(d).rsa ? 'SSH Enabled - version ' + (R(d).sshv === 2 ? '2.0' : '1.99') + '\nAuthentication methods:publickey,keyboard-interactive,password\nAuthentication timeout: 120 secs; Authentication retries: 3\nMinimum expected Diffie Hellman key size : ' + R(d).rsa + ' bits' : 'SSH Disabled - version 1.99\n%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).');
  cmd(SH, 'show crypto key mypubkey rsa', d => R(d).rsa ? '% Key pair was generated at: 12:00:00 UTC Nov 11 2026\nKey name: ' + R(d).hostname + '.' + R(d).domain + '\nKey type: RSA KEYS\n Storage Device: private-config\n Usage: General Purpose Key\n Key is not exportable.\n Key Data:\n  30819F30 0D06092A 864886F7 0D010101 05000381 8D003081 89028181 00C3...' : '');
  cmd(['priv'], 'show history', d => d.hist.slice(-10).map(h => '  ' + h).join('\n'));
  cmd(SH, 'show users', () => '    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00');
  cmd(['priv'], 'show ip dhcp binding', d => 'Bindings from all pools not associated with VRF:\nIP address      Client-ID/              Lease expiration        Type       State      Interface\n                Hardware address/\n                User name\n(aucun client dans le simulateur)', { only: 'router' });
  cmd(['priv'], 'show ip dhcp pool', d => Object.keys(R(d).pools).map(p => 'Pool ' + p + ' :\n Network : ' + (R(d).pools[p].net || '—') + '\n Default router : ' + (R(d).pools[p].gw || '—')).join('\n\n') || '', { only: 'router' });

  /* ================= CONFIG GLOBAL ================= */
  const G = ['config'];
  cmd(CONF, 'end', d => { d.mode = 'priv'; d.ctx = null; });
  cmd(CONF, 'exit', d => { if (d.mode === 'config') { d.mode = 'priv'; } else { d.mode = 'config'; d.ctx = null; } });
  cmd(CONF, 'do <rest>', (d, [r]) => { const m = d.mode; d.mode = 'priv'; const res = execLine(d, r, true); d.mode = m; return res; });
  cmd(G, 'hostname <word>', (d, [h]) => { R(d).hostname = h; });
  cmd(G, 'no hostname', d => { R(d).hostname = d.type === 'router' ? 'Router' : 'Switch'; });
  cmd(G, 'no ip domain-lookup', d => { R(d).lookup = false; });
  cmd(G, 'no ip domain lookup', d => { R(d).lookup = false; });
  cmd(G, 'ip domain-lookup', d => { R(d).lookup = true; });
  cmd(G, 'ip domain-name <word>', (d, [n]) => { R(d).domain = n; });
  cmd(G, 'ip domain name <word>', (d, [n]) => { R(d).domain = n; });
  cmd(G, 'security passwords min-length <num>', (d, [n]) => { if (n < 0 || n > 16) return '% Invalid input'; R(d).minLen = n; });
  cmd(G, 'enable secret <word>', (d, [p]) => pwOk(d, p, () => { R(d).secret = p; }));
  cmd(G, 'enable password <word>', (d, [p]) => pwOk(d, p, () => { R(d).enpass = p; }));
  cmd(G, 'no enable secret', d => { R(d).secret = null; });
  cmd(G, 'service password-encryption', d => { R(d).spe = true; });
  cmd(G, 'no service password-encryption', d => { R(d).spe = false; });
  cmd(G, 'banner motd <rest>', (d, [r]) => banner(d, r));
  cmd(G, 'no banner motd', d => { R(d).banner = null; });
  cmd(G, 'ipv6 unicast-routing', d => { R(d).v6r = true; }, { only: 'router' });
  cmd(G, 'no ipv6 unicast-routing', d => { R(d).v6r = false; }, { only: 'router' });
  cmd(G, 'username <word> secret <word>', (d, [u, p]) => pwOk(d, p, () => { R(d).users[u] = { p, t: 'secret' }; }));
  cmd(G, 'username <word> password <word>', (d, [u, p]) => pwOk(d, p, () => { R(d).users[u] = { p, t: 'password' }; }));
  cmd(G, 'username <word> privilege <num> secret <word>', (d, [u, , p]) => pwOk(d, p, () => { R(d).users[u] = { p, t: 'secret' }; }));
  cmd(G, 'crypto key generate rsa', d => rsaStart(d));
  cmd(G, 'crypto key generate rsa general-keys', d => rsaStart(d));
  cmd(G, 'crypto key generate rsa modulus <num>', (d, [n]) => rsaStart(d, n));
  cmd(G, 'crypto key generate rsa general-keys modulus <num>', (d, [n]) => rsaStart(d, n));
  cmd(G, 'crypto key zeroize rsa', d => { R(d).rsa = 0; return '% All keys will be removed.\n% All router certs issued using these keys will also be removed.'; });
  cmd(G, 'ip ssh version <num>', (d, [v]) => { if (!R(d).rsa) return 'Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).'; R(d).sshv = v; });
  cmd(G, 'ip default-gateway <ip>', (d, [g]) => { R(d).dgw = g; }, { only: 'switch' });
  cmd(G, 'no ip default-gateway', d => { R(d).dgw = null; }, { only: 'switch' });
  cmd(G, 'sdm prefer dual-ipv4-and-ipv6 default', d => sdm(d, 'dual-ipv4-and-ipv6 default'), { only: 'switch' });
  cmd(G, 'sdm prefer lanbase-routing', d => sdm(d, 'lanbase-routing'), { only: 'switch' });
  cmd(G, 'sdm prefer default', d => sdm(d, 'default'), { only: 'switch' });
  cmd(G, 'ip route <ip> <mask> <word>', (d, [n, m, h]) => { R(d).routes.push({ n, m, h }); }, { only: 'router' });
  cmd(G, 'ip route <ip> <mask> <word> <num>', (d, [n, m, h, ad]) => { R(d).routes.push({ n, m, h, ad }); }, { only: 'router' });
  cmd(G, 'ipv6 route <v6p> <word>', (d, [p, h]) => { R(d).v6routes.push({ p, h }); }, { only: 'router' });
  cmd(G, 'ip dhcp excluded-address <ip> <ip>', (d, [a, b]) => { R(d).dhcpEx.push([a, b]); }, { only: 'router' });
  cmd(G, 'ip dhcp excluded-address <ip>', (d, [a]) => { R(d).dhcpEx.push([a]); }, { only: 'router' });
  cmd(G, 'ip dhcp pool <word>', (d, [p]) => { R(d).pools[p] = R(d).pools[p] || {}; d.mode = 'dhcp'; d.ctx = [p]; }, { only: 'router' });
  cmd(G, 'ipv6 dhcp pool <word>', (d, [p]) => { R(d).v6pools[p] = R(d).v6pools[p] || {}; d.mode = 'dhcp6'; d.ctx = [p]; }, { only: 'router' });
  cmd(G, 'vlan <num>', (d, [v]) => { if (v < 1 || v > 4094) return '% Invalid input'; d.vlans[v] = d.vlans[v] || { name: v === 1 ? 'default' : 'VLAN' + String(v).padStart(4, '0') }; d.mode = 'vlan'; d.ctx = [v]; }, { only: 'switch' });
  cmd(G, 'no vlan <num>', (d, [v]) => { if (v === 1) return '%Default VLAN 1 may not be deleted.'; delete d.vlans[v]; }, { only: 'switch' });
  cmd(['vlan'], 'name <word>', (d, [n]) => { d.vlans[d.ctx[0]].name = n; });
  cmd(G, 'line console <num>', (d, [n]) => { if (n !== 0) return '% Invalid input'; d.mode = 'line'; d.ctx = ['con']; });
  cmd(G, 'line vty <num> <num>', (d, [a, b]) => { const max = 15; if (a !== 0 || b > max) return '% Invalid input'; R(d).vty.range = a + ' ' + b; d.mode = 'line'; d.ctx = ['vty']; });
  cmd(G, 'interface <if>', (d, [n]) => enterIf(d, n));
  cmd(G, 'interface range <rest>', (d, [r]) => enterRange(d, r));

  /* ================= LINE ================= */
  const L = ['line'];
  const ln = d => R(d)[d.ctx[0]];
  cmd(L, 'password <word>', (d, [p]) => pwOk(d, p, () => { ln(d).pass = p; }));
  cmd(L, 'login', d => { ln(d).login = true; ln(d).local = false; if (!ln(d).pass) return '% Login disabled on line ' + (d.ctx[0] === 'con' ? '0' : '1') + ', until \'password\' is set'; });
  cmd(L, 'login local', d => { ln(d).local = true; ln(d).login = false; });
  cmd(L, 'no login', d => { ln(d).login = false; ln(d).local = false; });
  cmd(L, 'logging synchronous', d => { ln(d).sync = true; });
  cmd(L, 'transport input ssh', d => { if (d.ctx[0] !== 'vty') return '% Invalid input'; ln(d).transport = 'ssh'; });
  cmd(L, 'transport input telnet ssh', d => { ln(d).transport = 'telnet ssh'; });
  cmd(L, 'transport input ssh telnet', d => { ln(d).transport = 'telnet ssh'; });
  cmd(L, 'transport input telnet', d => { ln(d).transport = 'telnet'; });
  cmd(L, 'transport input all', d => { ln(d).transport = 'all'; });
  cmd(L, 'transport input none', d => { ln(d).transport = 'none'; });
  cmd(L, 'exec-timeout <num> <num>', () => '');

  /* ================= INTERFACE ================= */
  cmd(IFM, 'description <rest>', (d, [t]) => { curIfs(d).forEach(i => { i.desc = t; }); });
  cmd(IFM, 'no description', d => { curIfs(d).forEach(i => { i.desc = null; }); });
  cmd(['if', 'subif'], 'ip address <ip> <mask>', (d, [a, m]) => {
    const n = d.ctx[0];
    if (d.type === 'switch' && !n.startsWith('Vlan')) return '% Invalid input detected : sur un 2960, l\'adresse IP se met sur l\'interface VLAN (SVI), pas sur un port physique.';
    if (a === netOf(a, m) || a === n2ip(ip2n(netOf(a, m)) + 2 ** (32 - maskLen(m)) - 1)) return '% Bad mask /' + maskLen(m) + ' for address ' + a;
    const clash = Object.keys(R(d).ifaces).find(k => k !== n && R(d).ifaces[k].ip && sameNet(R(d).ifaces[k].ip, a, m));
    if (clash) return '% ' + netOf(a, m) + ' overlaps with ' + shortIf(clash);
    R(d).ifaces[n].ip = a; R(d).ifaces[n].mask = m;
  });
  cmd(['if', 'subif'], 'no ip address', d => { curIfs(d).forEach(i => { i.ip = null; i.mask = null; }); });
  cmd(['if', 'subif'], 'ipv6 address <v6p>', (d, [p]) => v6need(d, () => { const i = curIfs(d)[0]; const v = norm6(p.split('/')[0]) + '/' + p.split('/')[1]; if (v.startsWith('FE80')) return '% Utilise « ipv6 address ' + p.split('/')[0] + ' link-local » pour une link-local.'; if (!i.v6.includes(v)) i.v6.push(v); }));
  cmd(['if', 'subif'], 'ipv6 address <v6> link-local', (d, [a]) => v6need(d, () => { if (!/^fe[89ab]/i.test(a)) return '% Invalid link-local address'; curIfs(d)[0].lla = norm6(a); }));
  cmd(['if', 'subif'], 'no ipv6 address', d => { curIfs(d).forEach(i => { i.v6 = []; i.lla = null; }); });
  cmd(['if', 'subif'], 'ipv6 enable', d => v6need(d, () => {}));
  cmd(['if', 'subif'], 'ipv6 address autoconfig', d => v6need(d, () => {}));
  cmd(IFM, 'shutdown', d => { curIfs(d).forEach(i => { i.shut = true; }); return (d.ctx || []).filter(n => !n.includes('.')).map(n => '%LINK-5-CHANGED: Interface ' + n + ', changed state to administratively down').join('\n'); });
  cmd(IFM, 'no shutdown', d => {
    curIfs(d).forEach(i => { i.shut = false; });
    return (d.ctx || []).map(n => linkUp(d, n) ? (n.startsWith('Vlan') ? '' : '%LINK-3-UPDOWN: Interface ' + n + ', changed state to up\n') + '%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + n + ', changed state to up' : (n.startsWith('Vlan') ? '' : '%LINK-3-UPDOWN: Interface ' + n + ', changed state to down')).filter(Boolean).join('\n');
  });
  cmd(IFM, 'switchport mode access', d => { curIfs(d).forEach(i => { i.swmode = 'access'; }); }, { only: 'switch' });
  cmd(IFM, 'switchport mode trunk', d => { curIfs(d).forEach(i => { i.swmode = 'trunk'; }); }, { only: 'switch' });
  cmd(IFM, 'switchport mode dynamic desirable', d => { curIfs(d).forEach(i => { i.swmode = 'dynamic desirable'; }); }, { only: 'switch' });
  cmd(IFM, 'switchport access vlan <num>', (d, [v]) => { let m = ''; if (!d.vlans[v]) { d.vlans[v] = { name: 'VLAN' + String(v).padStart(4, '0') }; m = '% Access VLAN does not exist. Creating vlan ' + v; } curIfs(d).forEach(i => { i.access = v; }); return m; }, { only: 'switch' });
  cmd(IFM, 'no switchport access vlan', d => { curIfs(d).forEach(i => { i.access = 1; }); }, { only: 'switch' });
  cmd(IFM, 'switchport trunk native vlan <num>', (d, [v]) => { curIfs(d).forEach(i => { i.native = v; }); }, { only: 'switch' });
  cmd(IFM, 'switchport trunk allowed vlan <word>', (d, [v]) => { curIfs(d).forEach(i => { i.allowed = v; }); }, { only: 'switch' });
  cmd(['if'], 'ip helper-address <ip>', (d, [a]) => { curIfs(d)[0].helper = a; }, { only: 'router' });
  cmd(['subif'], 'encapsulation dot1q <num>', (d, [v]) => { curIfs(d)[0].enc = v; }, { only: 'router' });
  cmd(['subif'], 'encapsulation dot1q <num> native', (d, [v]) => { curIfs(d)[0].enc = v + ' native'; }, { only: 'router' });
  cmd(['if'], 'ipv6 nd other-config-flag', d => { curIfs(d)[0].ndO = true; }, { only: 'router' });
  cmd(['if'], 'ipv6 nd managed-config-flag', d => { curIfs(d)[0].ndM = true; }, { only: 'router' });
  cmd(['if'], 'ipv6 dhcp server <word>', (d, [p]) => { curIfs(d)[0].dhcp6 = p; }, { only: 'router' });
  cmd(['if'], 'ipv6 dhcp relay destination <v6> <if>', (d, [a, i]) => { curIfs(d)[0].relay6 = norm6(a) + ' ' + i; }, { only: 'router' });
  cmd(['if', 'range'], 'duplex <word>', () => '');
  cmd(['if', 'range'], 'speed <word>', () => '');

  /* ================= DHCP ================= */
  const pool = d => R(d).pools[d.ctx[0]];
  cmd(['dhcp'], 'network <ip> <mask>', (d, [n, m]) => { pool(d).net = n + ' ' + m; });
  cmd(['dhcp'], 'default-router <ip>', (d, [g]) => { pool(d).gw = g; });
  cmd(['dhcp'], 'domain-name <word>', (d, [n]) => { pool(d).dom = n; });
  cmd(['dhcp'], 'dns-server <ip>', (d, [n]) => { pool(d).dns = n; });
  cmd(['dhcp'], 'lease <rest>', (d, [l]) => { pool(d).lease = l; });
  const p6 = d => R(d).v6pools[d.ctx[0]];
  cmd(['dhcp6'], 'dns-server <v6>', (d, [a]) => { p6(d).dns = norm6(a); });
  cmd(['dhcp6'], 'domain-name <word>', (d, [n]) => { p6(d).dom = n; });
  cmd(['dhcp6'], 'address prefix <v6p>', (d, [p]) => { p6(d).pfx = p.toUpperCase(); });

  /* ================= actions ================= */
  function pwOk(d, p, fn) {
    if (R(d).minLen && p.length < R(d).minLen) return '% Password too short - must be at least ' + R(d).minLen + ' characters. Password configuration failed';
    fn();
  }
  function banner(d, r) {
    r = r.replace(/^\s+/, '');
    const del = r[0]; if (!del) return '% Incomplete command.';
    const rest = r.slice(1); const end = rest.indexOf(del);
    if (end >= 0) { R(d).banner = { del, text: rest.slice(0, end) }; return; }
    d.pending = { k: 'banner', del, lines: rest ? [rest] : [] };
    return { prompt: '', pre: 'Enter TEXT message.  End with the character \'' + del + '\'.' };
  }
  function rsaStart(d, n) {
    if (/^(Router|Switch)$/.test(R(d).hostname)) return '% Please define a hostname other than ' + R(d).hostname + '.';
    if (!R(d).domain) return '% Please define a domain-name first.';
    if (n !== undefined) return rsaGen(d, n);
    d.pending = { k: 'rsa' };
    return { pre: 'The name for the keys will be: ' + R(d).hostname + '.' + R(d).domain + '\nChoose the size of the key modulus in the range of 360 to 4096 for your\n  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes.\n', prompt: 'How many bits in the modulus [512]: ' };
  }
  function rsaGen(d, n) {
    n = +n || 512; if (n < 360 || n > 4096) return '% Invalid input';
    R(d).rsa = n;
    return '% Generating ' + n + ' bit RSA keys, keys will be non-exportable...\n[OK] (elapsed time was 1 seconds)\n\n%SSH-5-ENABLED: SSH 1.99 has been enabled';
  }
  function sdm(d, t) {
    d.sdm.next = t === d.sdm.active ? null : t;
    return 'Changes to the running SDM preferences have been stored, but cannot take effect until the next reload.\nUse \'show sdm prefer\' to see what SDM preference is currently active.';
  }
  function v6need(d, fn) {
    if (d.type === 'switch' && d.sdm.active === 'default') return { err: true, msg: "% Invalid input detected at '^' marker.", hint: "💡 Le template SDM actuel ne gère pas l'IPv6 → (config)# sdm prefer dual-ipv4-and-ipv6 default (ou lanbase-routing) puis end + reload." };
    return fn();
  }
  function enterIf(d, n) {
    const ifs = R(d).ifaces;
    if (n.includes('.')) {
      if (d.type !== 'router') return '% Invalid input';
      const phys = n.split('.')[0]; if (!ifs[phys]) return badIf();
      if (!ifs[n]) ifs[n] = { desc: null, ip: null, mask: null, v6: [], lla: null, shut: false, enc: null };
      d.mode = 'subif'; d.ctx = [n]; return;
    }
    if (!ifs[n]) {
      if (d.type === 'switch' && n.startsWith('Vlan')) { ifs[n] = Object.assign(JSON.parse(JSON.stringify(ifs['Vlan1'] || {})), { desc: null, ip: null, mask: null, v6: [], lla: null, shut: true }); }
      else return badIf();
    }
    d.mode = 'if'; d.ctx = [n];
  }
  function enterRange(d, r) {
    const parts = r.replace(/\s+/g, '').split(','); const list = [];
    for (const p of parts) {
      const m = p.match(/^([a-z]+)([\d/]+?)(\d+)(?:-(\d+))?$/i);
      if (!m) return "% Invalid input detected at '^' marker.\n  (format : interface range f0/1-4 , f0/7-24 , g0/1-2)";
      const t = parseIf(m[1] + '0'); if (!t) return '% Invalid input';
      const type = t.slice(0, -1); const a = +m[3], b = m[4] ? +m[4] : a;
      if (b < a) return '% Invalid input';
      for (let i = a; i <= b; i++) { const n = type + m[2] + i; if (!R(d).ifaces[n]) return '% Interface ' + shortIf(n) + ' n\'existe pas sur cet équipement'; list.push(n); }
    }
    d.mode = 'range'; d.ctx = list;
  }
  function save(d) { d.start = clone(d.run); d.flags.saved = true; return 'Building configuration...\n[OK]'; }
  function badIf() { return "% Invalid input detected at '^' marker.\n  (interface inexistante : sur ce " + 'modèle utilise show ip interface brief pour voir les noms)'; }

  function doReload(d) {
    const lines = [];
    if (d.sdm.next) { d.sdm.active = d.sdm.next; d.sdm.next = null; }
    if (d.vlanDel) { d.vlans = { 1: { name: 'default' } }; d.vlanDel = false; }
    d.run = d.start ? clone(d.start) : blankCfg(d.type);
    d.mode = 'user'; d.ctx = null;
    d.flags.reloads++;
    if (!d.start && Object.keys(d.vlans).length === 1) d.flags.cleanBoot = true;
    lines.push('', 'Reload requested by console. Reload Reason: Reload Command.', '', 'System Bootstrap, Version 16.9(4r), RELEASE SOFTWARE', 'Copyright (c) 1994-2019 by cisco Systems, Inc.', '', 'Initializing Hardware ...', '', 'Cisco IOS Software, ' + (d.type === 'router' ? 'ISR Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 16.9.4' : 'C2960 Software (C2960-LANBASEK9-M), Version 15.2(2)E7') + ', RELEASE SOFTWARE (fc2)', '');
    if (!d.start) {
      lines.push('         --- System Configuration Dialog ---', '');
      d.pending = { k: 'dialog' };
      return { pre: lines.join('\n'), prompt: 'Would you like to enter the initial configuration dialog? [yes/no]: ' };
    }
    lines.push('Press RETURN to get started!');
    return lines.join('\n');
  }

  function handlePending(d, raw) {
    const p = d.pending; d.pending = null; const a = raw.trim().toLowerCase();
    switch (p.k) {
      case 'enpw': {
        const ok = (R(d).secret && raw === R(d).secret) || (!R(d).secret && raw === R(d).enpass);
        if (ok) { d.mode = 'priv'; return ''; }
        if (p.tries < 2) { d.pending = { k: 'enpw', tries: p.tries + 1 }; return { prompt: 'Password: ', hide: true }; }
        return '% Bad secrets';
      }
      case 'conft': if (a === '' || 'terminal'.startsWith(a)) { d.mode = 'config'; return 'Enter configuration commands, one per line.  End with CNTL/Z.'; } return '?Must be "terminal", "memory" or "network"';
      case 'copy': return save(d);
      case 'erase': if (a === '' || a === 'y' || a === 'yes') { d.start = null; d.flags.erased = true; return '[OK]\nErase of nvram: complete\n%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram'; } return '';
      case 'del1': d.pending = { k: 'del2' }; return { prompt: 'Delete flash:/vlan.dat? [confirm]' };
      case 'del2': if (a === '' || a === 'y') { if (Object.keys(d.vlans).length > 1 || !d.vlanDel) { d.vlanDel = true; d.flags.vlanDeleted = true; return ''; } } return '';
      case 'rlsave':
        if (a.startsWith('y')) save(d);
        else if (!a.startsWith('n')) { d.pending = p; return { prompt: '% Please answer \'yes\' or \'no\'.\nSystem configuration has been modified. Save? [yes/no]: ' }; }
        d.pending = { k: 'rlgo' }; return { prompt: 'Proceed with reload? [confirm]' };
      case 'rlgo': if (a === '' || a === 'y') return doReload(d); return '';
      case 'dialog':
        if (a.startsWith('n')) { d.flags.dialogNo = true; return out('', '', 'Press RETURN to get started!', ''); }
        if (a.startsWith('y')) { d.flags.dialogNo = true; return out('% Dans l\'épreuve réponds « no » : le dialogue de configuration fait perdre du temps.', '% Simulateur : dialogue ignoré.', '', 'Press RETURN to get started!'); }
        d.pending = p; return { prompt: '% Please answer \'yes\' or \'no\'.\nWould you like to enter the initial configuration dialog? [yes/no]: ' };
      case 'rsa': return rsaGen(d, a === '' ? 512 : a);
      case 'banner': {
        const i = raw.indexOf(p.del);
        if (i >= 0) { p.lines.push(raw.slice(0, i)); R(d).banner = { del: p.del, text: p.lines.join('\n') }; return ''; }
        p.lines.push(raw); d.pending = p; return { prompt: '' };
      }
    }
    return '';
  }

  /* ================= analyse d'une ligne ================= */
  function tokenize(raw) {
    const toks = []; const re = /\S+/g; let m;
    while ((m = re.exec(raw))) toks.push({ s: m[0], i: m.index });
    // fusion « gig 0/0/0 » → « gig0/0/0 » après interface / range
    for (let k = 0; k < toks.length - 1; k++) {
      const prev = (toks[k - 1] || { s: '' }).s.toLowerCase();
      const t = toks[k].s.toLowerCase();
      if (/^[a-z]+$/.test(t) && /^\d/.test(toks[k + 1].s) && TYPES.some(T => T[0].startsWith(t)) && (prev.length >= 2 && ('interface'.startsWith(prev) || 'interfaces'.startsWith(prev)))) {
        toks[k] = { s: toks[k].s + toks[k + 1].s, i: toks[k].i }; toks.splice(k + 1, 1);
      }
    }
    return toks;
  }

  function match(d, toks, raw, modes) {
    let alive = C.filter(c => c.modes.some(m => modes.includes(m)) && (!c.only || c.only === d.type)).map(c => ({ c, args: [], rest: false }));
    let failAt = -1;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i].s.toLowerCase();
      const stillRest = alive.filter(a => a.rest);
      const cand = alive.filter(a => !a.rest);
      const kws = new Set(); cand.forEach(a => { const pt = a.c.toks[i]; if (pt && pt.kw && pt.kw.startsWith(t)) kws.add(pt.kw); });
      let chosen = null;
      if (kws.has(t)) chosen = t; else if (kws.size === 1) chosen = [...kws][0]; else if (kws.size > 1) { if (PREF[t] && kws.has(PREF[t])) chosen = PREF[t]; else return { amb: true, at: toks[i].i, opts: [...kws] }; }
      const next = [];
      for (const a of cand) {
        const pt = a.c.toks[i]; if (!pt) continue;
        if (pt.kw) { if (pt.kw === chosen) next.push(a); continue; }
        if (chosen) continue; // un mot-clé correspond : on le préfère aux paramètres libres
        if (pt.rest) { a.args.push(raw.slice(toks[i].i)); a.rest = true; next.push(a); continue; }
        const v = pt.t(toks[i].s); if (v !== false) { a.args.push(v); next.push(a); }
      }
      alive = [...stillRest, ...next];
      if (!alive.length) { failAt = toks[i].i; break; }
    }
    if (failAt >= 0) return { fail: true, at: failAt };
    const complete = alive.filter(a => a.rest || a.c.toks.length === toks.length);
    if (complete.length) return { ok: complete[0] };
    return { incomplete: true, alive };
  }

  function nextHelp(d, toks, raw, modes, partial) {
    // liste des suites possibles pour l'aide « ? »
    let alive = C.filter(c => c.modes.some(m => modes.includes(m)) && (!c.only || c.only === d.type));
    const n = toks.length;
    const res = new Map();
    for (const c of alive) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        const pt = c.toks[i]; const t = toks[i].s.toLowerCase();
        if (!pt) { ok = false; break; }
        if (pt.rest) break;
        if (i === n - 1 && partial !== null) { /* dernier mot en cours */ }
        if (pt.kw) { if (!(pt.kw === t || (pt.kw.startsWith(t) && (PREF[t] === pt.kw || true)))) { ok = false; break; } }
        else if (pt.t && pt.t(toks[i].s) === false) { ok = false; break; }
      }
      if (!ok) continue;
      if (partial !== null) {
        const pt = c.toks[n]; if (pt && pt.kw && pt.kw.startsWith(partial)) res.set(pt.kw, 1);
      } else {
        const pt = c.toks[n];
        if (!pt) res.set('<cr>', 1); else if (pt.kw) res.set(pt.kw, 1); else res.set(pt.lab, 1);
      }
    }
    return [...res.keys()].sort((a, b) => (a === '<cr>') - (b === '<cr>') || a.localeCompare(b));
  }

  function hintOtherMode(d, toks, raw) {
    for (const m of ['priv', 'config', 'if', 'line', 'range', 'vlan']) {
      if (m === d.mode) continue;
      const r = match(d, toks, raw, [m]);
      if (r.ok) {
        const where = { priv: 'mode privilégié #  (tape « enable »)', config: 'mode configuration globale (config)#  (tape « configure terminal »' + (SUB.includes(d.mode) ? ' ou « exit »' : '') + ')', if: 'mode interface (config-if)#  (tape « interface … »)', line: 'mode ligne (config-line)#  (tape « line console 0 » ou « line vty 0 4 »)', range: 'mode interface range', vlan: 'mode vlan (config-vlan)#' }[m];
        return '💡 Cette commande existe, mais en ' + where + '.' + (m === 'priv' && CONF.includes(d.mode) ? '  Astuce : préfixe-la par « do » (ex. do show ip interface brief).' : '');
      }
    }
    // commande d'un autre type d'équipement
    const other = C.find(c => c.only && c.only !== d.type && match(Object.assign({}, d, { type: c.only }), toks, raw, c.modes).ok);
    if (other) return '💡 Cette commande existe sur un ' + (other.only === 'router' ? 'routeur' : 'switch') + ', pas sur ce ' + (d.type === 'router' ? 'routeur' : 'switch') + '.';
    return '';
  }

  function execLine(d, raw, fromDo) {
    const toks = tokenize(raw);
    if (!toks.length) return '';
    let modes = [d.mode];
    let r = match(d, toks, raw, modes);
    // en sous-mode, IOS accepte aussi les commandes globales (et change de mode)
    if (!r.ok && SUB.includes(d.mode)) {
      const r2 = match(d, toks, raw, ['config']);
      if (r2.ok) { const prev = d.mode; d.mode = 'config'; d.ctx = null; r = r2; r.from = prev; }
    }
    if (r.amb) return '% Ambiguous command:  "' + raw.trim() + '"';
    if (r.ok) {
      const res = r.ok.c.run(d, r.ok.args, raw);
      if (res && res.err) return res.msg + '\n' + res.hint;
      return res;
    }
    if (r.incomplete) return '% Incomplete command.';
    // échec
    const caret = ' '.repeat(r.at + (fromDo ? 0 : promptOf(d).length)) + '^';
    if (EXEC.includes(d.mode) && toks.length === 1 && R(d).lookup && !fromDo) {
      return { translating: true, text: 'Translating "' + toks[0].s + '"...domain server (255.255.255.255)', after: '% Unknown command or computer name, or unable to find computer address\n💡 La recherche DNS est active : c\'est pour ça que l\'énoncé demande « no ip domain-lookup ».' };
    }
    const h = hintOtherMode(d, toks, raw);
    return (fromDo ? '' : caret + '\n') + "% Invalid input detected at '^' marker." + (h ? '\n' + h : '');
  }

  function promptOf(d) { return R(d).hostname + MODES[d.mode]; }

  /* ================= affichages ================= */
  function runText(d, c) {
    const L = ['Building configuration...', '', 'Current configuration : 1789 bytes', '!', 'version ' + (d.type === 'router' ? '16.9' : '15.2'), 'no service pad', 'service timestamps debug datetime msec', 'service timestamps log datetime msec'];
    L.push((c.spe ? '' : 'no ') + 'service password-encryption');
    L.push('!', 'hostname ' + c.hostname, '!', 'boot-start-marker', 'boot-end-marker', '!');
    if (c.minLen) L.push('security passwords min-length ' + c.minLen);
    if (c.secret) L.push('enable secret 9 ' + fake9(c.secret));
    if (c.enpass) L.push('enable password ' + (c.spe ? '7 ' + fake7(c.enpass) : c.enpass));
    L.push('!', 'no aaa new-model');
    if (!c.lookup) L.push('no ip domain lookup');
    if (c.domain) L.push('ip domain name ' + c.domain);
    c.dhcpEx.forEach(e => L.push('ip dhcp excluded-address ' + e.join(' ')));
    Object.entries(c.pools).forEach(([n, p]) => { L.push('!', 'ip dhcp pool ' + n); if (p.net) L.push(' network ' + p.net); if (p.gw) L.push(' default-router ' + p.gw); if (p.dom) L.push(' domain-name ' + p.dom); if (p.dns) L.push(' dns-server ' + p.dns); if (p.lease) L.push(' lease ' + p.lease); });
    L.push('!');
    if (c.v6r) L.push('ipv6 unicast-routing');
    Object.entries(c.v6pools).forEach(([n, p]) => { L.push('ipv6 dhcp pool ' + n); if (p.pfx) L.push(' address prefix ' + p.pfx); if (p.dns) L.push(' dns-server ' + p.dns); if (p.dom) L.push(' domain-name ' + p.dom); });
    if (d.type === 'switch') L.push('!', 'spanning-tree mode pvst', 'spanning-tree extend system-id');
    Object.entries(c.users).forEach(([u, p]) => L.push('username ' + u + (p.t === 'secret' ? ' secret 9 ' + fake9(p.p) : ' password ' + (c.spe ? '7 ' + fake7(p.p) : p.p))));
    if (c.sshv) L.push('!', 'ip ssh version ' + c.sshv);
    L.push('!');
    Object.keys(c.ifaces).sort(ifSort).forEach(n => {
      const i = c.ifaces[n]; L.push('interface ' + n);
      if (i.desc) L.push(' description ' + i.desc);
      if (i.enc) L.push(' encapsulation dot1Q ' + i.enc);
      if (i.swmode === 'access' || (i.access && i.access !== 1)) { if (i.access && i.access !== 1) L.push(' switchport access vlan ' + i.access); if (i.swmode === 'access') L.push(' switchport mode access'); }
      if (i.native && i.native !== 1) L.push(' switchport trunk native vlan ' + i.native);
      if (i.allowed) L.push(' switchport trunk allowed vlan ' + i.allowed);
      if (i.swmode && i.swmode !== 'access') L.push(' switchport mode ' + i.swmode);
      if (i.ip) L.push(' ip address ' + i.ip + ' ' + i.mask); else if (!n.startsWith('Fast') && !(d.type === 'switch' && n.startsWith('Gigabit'))) L.push(' no ip address');
      if (i.helper) L.push(' ip helper-address ' + i.helper);
      if (i.lla) L.push(' ipv6 address ' + i.lla + ' link-local');
      (i.v6 || []).forEach(v => L.push(' ipv6 address ' + v));
      if (i.ndM) L.push(' ipv6 nd managed-config-flag');
      if (i.ndO) L.push(' ipv6 nd other-config-flag');
      if (i.dhcp6) L.push(' ipv6 dhcp server ' + i.dhcp6);
      if (i.relay6) L.push(' ipv6 dhcp relay destination ' + i.relay6);
      if (i.shut) L.push(' shutdown');
      if (d.type === 'router' && !n.includes('.')) L.push(' negotiation auto');
      L.push('!');
    });
    if (c.dgw) L.push('ip default-gateway ' + c.dgw);
    L.push('ip forward-protocol nd', 'ip http server', 'ip http secure-server');
    c.routes.forEach(r => L.push('ip route ' + r.n + ' ' + r.m + ' ' + r.h + (r.ad ? ' ' + r.ad : '')));
    c.v6routes.forEach(r => L.push('ipv6 route ' + r.p.toUpperCase() + ' ' + r.h.toUpperCase()));
    L.push('!');
    if (c.banner) L.push('banner motd ^C' + c.banner.text + '^C');
    L.push('!');
    L.push('line con 0');
    if (c.con.pass) L.push(' password ' + (c.spe ? '7 ' + fake7(c.con.pass) : c.con.pass));
    if (c.con.sync) L.push(' logging synchronous');
    if (c.con.login) L.push(' login'); if (c.con.local) L.push(' login local');
    if (d.type === 'router') L.push(' transport input none', ' stopbits 1', 'line aux 0', ' stopbits 1');
    L.push('line vty ' + c.vty.range);
    if (c.vty.pass) L.push(' password ' + (c.spe ? '7 ' + fake7(c.vty.pass) : c.vty.pass));
    if (c.vty.login) L.push(' login'); if (c.vty.local) L.push(' login local');
    if (c.vty.transport) L.push(' transport input ' + c.vty.transport);
    if (c.vty.range === '0 4' && d.type === 'switch') L.push('line vty 5 15', ' login');
    L.push('!', 'end');
    return L.join('\n');
  }
  function ifSort(a, b) { const k = s => (s.startsWith('Vlan') ? 9 : s.startsWith('Fast') ? 1 : 2) * 1e6 + s.replace(/\D+/g, ' ').trim().split(' ').reduce((x, y, i) => x + (+y) * [10000, 100, 1, .01][i], 0); return k(a) - k(b); }
  function ipBrief(d) {
    const L = ['Interface              IP-Address      OK? Method Status                Protocol'];
    Object.keys(R(d).ifaces).sort(ifSort).forEach(n => {
      const i = R(d).ifaces[n];
      L.push(n.padEnd(23) + (i.ip || 'unassigned').padEnd(16) + 'YES ' + (i.ip ? 'manual' : 'unset ').padEnd(7) + status(d, n).padEnd(22) + proto(d, n));
    });
    return L.join('\n');
  }
  const llaOf = (d, n) => R(d).ifaces[n].lla || ('FE80::250:56FF:FE' + fakeMac(n + d.type).slice(7, 9).toUpperCase() + ':' + fakeMac(n + d.type).slice(10).toUpperCase());
  function v6Brief(d) {
    const L = [];
    Object.keys(R(d).ifaces).sort(ifSort).forEach(n => {
      const i = R(d).ifaces[n]; const st = '[' + (i.shut ? 'administratively down' : linkUp(d, n) ? 'up' : 'down') + '/' + proto(d, n) + ']';
      L.push(n.padEnd(23) + st);
      if (i.lla || (i.v6 && i.v6.length)) { L.push('    ' + llaOf(d, n)); i.v6.forEach(v => L.push('    ' + v.split('/')[0])); }
      else L.push('    unassigned');
    });
    return L.join('\n');
  }
  function ipRoute(d) {
    const L = ['Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP', '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area', '       * - candidate default, U - per-user static route', ''];
    const def = R(d).routes.find(r => r.n === '0.0.0.0');
    L.push('Gateway of last resort is ' + (def ? def.h + ' to network 0.0.0.0' : 'not set'), '');
    if (def) L.push('S*    0.0.0.0/0 [1/0] via ' + def.h);
    const ent = [];
    Object.keys(R(d).ifaces).sort(ifSort).forEach(n => { const i = R(d).ifaces[n]; if (i.ip && linkUp(d, n)) { ent.push('C        ' + netOf(i.ip, i.mask) + '/' + maskLen(i.mask) + ' is directly connected, ' + n); ent.push('L        ' + i.ip + '/32 is directly connected, ' + n); } });
    R(d).routes.filter(r => r.n !== '0.0.0.0').forEach(r => ent.push('S        ' + r.n + '/' + maskLen(r.m) + ' [' + (r.ad || 1) + '/0] via ' + r.h));
    if (!ent.length && !def) L.push('(table vide : aucune interface avec IP n\'est up/up)');
    return L.concat(ent).join('\n');
  }
  function v6Route(d) {
    if (!R(d).v6r) return 'IPv6 Routing Table - default - 1 entries\nCodes: C - Connected, L - Local, S - Static\nL   FF00::/8 [0/0]\n     via Null0, receive\n💡 ipv6 unicast-routing n\'est pas activé.';
    const ent = [];
    Object.keys(R(d).ifaces).sort(ifSort).forEach(n => { const i = R(d).ifaces[n]; if (linkUp(d, n)) (i.v6 || []).forEach(v => { ent.push('C   ' + net6(v) + ' [0/0]\n     via ' + n + ', directly connected'); ent.push('L   ' + v.split('/')[0] + '/128 [0/0]\n     via ' + n + ', receive'); }); });
    R(d).v6routes.forEach(r => ent.push('S   ' + r.p.toUpperCase() + ' [1/0]\n     via ' + r.h.toUpperCase()));
    ent.push('L   FF00::/8 [0/0]\n     via Null0, receive');
    return 'IPv6 Routing Table - default - ' + ent.length + ' entries\nCodes: C - Connected, L - Local, S - Static, U - Per-user Static route\n       B - BGP, R - RIP, H - NHRP, I1 - ISIS L1\n' + ent.join('\n');
  }
  function ipIfText(d, n) {
    const i = R(d).ifaces[n];
    const L = [n + ' is ' + status(d, n) + ', line protocol is ' + proto(d, n)];
    if (i.ip) L.push('  Internet address is ' + i.ip + '/' + maskLen(i.mask), '  Broadcast address is 255.255.255.255', '  Address determined by setup command', '  MTU is 1500 bytes', '  Helper address is ' + (i.helper || 'not set'), '  Directed broadcast forwarding is disabled', '  Outgoing Common access list is not set', '  Inbound  access list is not set', '  Proxy ARP is enabled', '  Security level is default', '  Split horizon is enabled', '  ICMP redirects are always sent', '  ICMP unreachables are always sent', '  IP fast switching is enabled', '  IP CEF switching is enabled');
    else L.push('  Internet protocol processing disabled');
    return L.join('\n');
  }
  function v6IfText(d, n) {
    const i = R(d).ifaces[n];
    if (!i.lla && !(i.v6 || []).length) return n + ' is ' + status(d, n) + ', line protocol is ' + proto(d, n) + '\n  IPv6 is not enabled';
    const sn = a => { const e = expand6(a); return compress6(['ff02', '0', '0', '0', '0', '1', 'ff' + e[6].slice(2), e[7]]).toUpperCase(); };
    const g = ['FF02::1'].concat(R(d).v6r ? ['FF02::2'] : []).concat([sn(llaOf(d, n))]).concat((i.v6 || []).map(v => sn(v.split('/')[0])).filter((x, k, arr) => arr.indexOf(x) === k));
    return [n + ' is ' + status(d, n) + ', line protocol is ' + proto(d, n), '  IPv6 is enabled, link-local address is ' + llaOf(d, n), '  No Virtual link-local address(es):', '  Global unicast address(es):'].concat((i.v6 || []).map(v => '    ' + v.split('/')[0] + ', subnet is ' + net6(v))).concat(['  Joined group address(es):'], g.map(x => '    ' + x), ['  MTU is 1500 bytes', '  ND DAD is enabled, number of DAD attempts: 1', R(d).v6r ? '  ND advertised reachable time is 0 (unspecified)\n  Hosts use stateless autoconfig for addresses.' : '  ND RAs are suppressed (ipv6 unicast-routing désactivé)']).join('\n');
  }
  function ifText(d, n) {
    const i = R(d).ifaces[n]; const mac = fakeMac(n + d.type);
    return [n + ' is ' + status(d, n) + ', line protocol is ' + proto(d, n), '  Hardware is ' + (n.startsWith('Vlan') ? 'EtherSVI' : d.type === 'router' ? 'ISR4321-2x1GE' : n.startsWith('Fast') ? 'Fast Ethernet' : 'Gigabit Ethernet') + ', address is ' + mac + ' (bia ' + mac + ')'].concat(i.desc ? ['  Description: ' + i.desc] : []).concat(i.ip ? ['  Internet address is ' + i.ip + '/' + maskLen(i.mask)] : []).concat(['  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,', '     reliability 255/255, txload 1/255, rxload 1/255', '  Encapsulation ARPA, loopback not set', '  Full Duplex, 1000Mbps, link type is auto, media type is RJ45', '  5 minute input rate 0 bits/sec, 0 packets/sec', '  5 minute output rate 0 bits/sec, 0 packets/sec']).join('\n');
  }
  function arpText(d) {
    const L = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
    Object.keys(R(d).ifaces).forEach(n => { const i = R(d).ifaces[n]; if (i.ip && linkUp(d, n)) { L.push('Internet  ' + i.ip.padEnd(17) + '-'.padEnd(11) + fakeMac(n + d.type) + '  ARPA   ' + n); (d.env.hosts || []).forEach(h => { if (h.ip && d.seen[h.ip] && sameNet(h.ip, i.ip, i.mask)) L.push('Internet  ' + h.ip.padEnd(17) + '0'.padEnd(11) + fakeMac(h.name) + '  ARPA   ' + n); }); } });
    if (L.length === 1) return '';
    return L.join('\n');
  }
  function macText(d) {
    const L = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
    (d.env.hosts || []).forEach(h => { if (h.port && linkUp(d, h.port)) L.push(('   ' + (R(d).ifaces[h.port].access || 1)).padEnd(8) + fakeMac(h.name) + '    DYNAMIC     ' + shortIf(h.port)); });
    L.push('Total Mac Addresses for this criterion: ' + (L.length - 5));
    return L.join('\n');
  }
  function vlanText(d) {
    const L = ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    Object.keys(d.vlans).map(Number).sort((a, b) => a - b).forEach(v => {
      const ports = Object.keys(R(d).ifaces).filter(n => !n.startsWith('Vlan') && R(d).ifaces[n].swmode !== 'trunk' && (R(d).ifaces[n].access || 1) === v).map(shortIf);
      const chunks = []; for (let i = 0; i < ports.length; i += 4) chunks.push(ports.slice(i, i + 4).join(', '));
      L.push(String(v).padEnd(5) + d.vlans[v].name.padEnd(33) + 'active    ' + (chunks[0] || ''));
      chunks.slice(1).forEach(c => L.push(' '.repeat(48) + c));
    });
    L.push('1002 fddi-default                     act/unsup', '1003 token-ring-default               act/unsup', '1004 fddinet-default                  act/unsup', '1005 trnet-default                    act/unsup');
    return L.join('\n');
  }
  function trunkText(d) {
    const t = Object.keys(R(d).ifaces).filter(n => R(d).ifaces[n].swmode === 'trunk' && linkUp(d, n));
    if (!t.length) return '';
    return ['Port        Mode             Encapsulation  Status        Native vlan'].concat(t.map(n => shortIf(n).padEnd(12) + 'on               802.1q         trunking      ' + (R(d).ifaces[n].native || 1)), ['', 'Port        Vlans allowed on trunk'], t.map(n => shortIf(n).padEnd(12) + (R(d).ifaces[n].allowed || '1-4094'))).join('\n');
  }
  function verText(d) {
    return d.type === 'router'
      ? 'Cisco IOS XE Software, Version 16.09.04\nCisco IOS Software [Fuji], ISR Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 16.9.4, RELEASE SOFTWARE (fc2)\n\nROM: IOS-XE ROMMON\n' + R(d).hostname + ' uptime is 12 minutes\nSystem image file is "bootflash:isr4300-universalk9.16.09.04.SPA.bin"\n\ncisco ISR4321/K9 (1RU) processor with 1647778K/6147K bytes of memory.\n2 Gigabit Ethernet interfaces\n32768K bytes of non-volatile configuration memory.\n\nConfiguration register is 0x2102'
      : 'Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.2(2)E7, RELEASE SOFTWARE (fc3)\n\n' + R(d).hostname + ' uptime is 12 minutes\nSystem image file is "flash:/c2960-lanbasek9-mz.152-2.E7.bin"\n\ncisco WS-C2960-24TT-L (PowerPC405) processor with 65536K bytes of memory.\n24 FastEthernet interfaces\n2 Gigabit Ethernet interfaces\n64K bytes of flash-simulated non-volatile configuration memory.\nBase ethernet MAC Address       : ' + fakeMac('base' + d.type) + '\n\nConfiguration register is 0xF';
  }

  /* ----- ping / traceroute (logique simplifiée) ----- */
  function reach(d, t) {
    const v6 = t.includes(':');
    const hosts = d.env.hosts || [];
    const ifs = Object.entries(R(d).ifaces).filter(([n, i]) => linkUp(d, n));
    if (!v6) {
      if (!isIp(t)) return { err: '% Unrecognized host or address, or protocol not running.' };
      if (ifs.some(([, i]) => i.ip === t)) return { ok: true };
      const direct = ifs.find(([, i]) => i.ip && sameNet(i.ip, t, i.mask));
      const host = hosts.find(h => h.ip === t);
      if (direct) {
        if (!host) return { ok: false };
        if (host.needsGw && d.type === 'router') { /* le PC répond s'il a une passerelle : on suppose oui */ }
        return { ok: true, first: !d.seen[t] };
      }
      if (d.type === 'switch') {
        if (!R(d).dgw) return { ok: false, why: "💡 Le switch n'a pas d'ip default-gateway : il ne sait pas joindre un autre réseau." };
        return host ? { ok: true } : { ok: false };
      }
      if (host && host.remote) return { ok: true };
      return { ok: false, why: '💡 Aucune route vers ce réseau (show ip route).' };
    }
    if (!isV6(t)) return { err: '% Unrecognized host or address.' };
    const n6 = norm6(t);
    if (n6.startsWith('FE80')) return { ask: true };
    if (ifs.some(([, i]) => (i.v6 || []).some(v => v.split('/')[0] === n6))) return { ok: true };
    const direct = ifs.find(([, i]) => (i.v6 || []).some(v => net6(v) === net6(n6 + '/64')));
    const host = hosts.find(h => (h.v6 || []).map(norm6).includes(n6));
    if (direct && host) return { ok: true };
    return { ok: false };
  }
  function ping(d, t) {
    const r = reach(d, t);
    if (r.err) return r.err;
    if (r.ask) return 'Output Interface: \n% Une link-local a besoin de l\'interface de sortie : ping ' + t + ' puis donne l\'interface (ex. GigabitEthernet0/0/0).';
    const v6 = t.includes(':');
    const head = 'Type escape sequence to abort.\nSending 5, 100-byte ICMP' + (v6 ? '' : '') + ' Echos to ' + (v6 ? norm6(t) : t) + ', timeout is 2 seconds:';
    if (r.ok) { const first = r.first; d.seen[t] = 1; return head + '\n' + (first ? '.!!!!' : '!!!!!') + '\nSuccess rate is ' + (first ? '80 percent (4/5)' : '100 percent (5/5)') + ', round-trip min/avg/max = 1/1/2 ms'; }
    return head + '\n.....\nSuccess rate is 0 percent (0/5)' + (r.why ? '\n' + r.why : '');
  }
  function trace(d, t) {
    const r = reach(d, t);
    if (r.err) return r.err;
    return 'Type escape sequence to abort.\nTracing the route to ' + t + '\nVRF info: (vrf in name/id, vrf out name/id)\n  1 ' + (r.ok ? t + ' 1 msec 0 msec 1 msec' : '*  *  *\n  2 *  *  *\n  (…)');
  }

  /* ================= MISSIONS ================= */
  const I = (d, n) => R(d).ifaces[n] || {};
  const lo = s => (s || '').toLowerCase();
  const has6 = (i, a) => (i.v6 || []).includes(norm6(a.split('/')[0]) + '/' + a.split('/')[1]);
  function routerIfChecks(n, ip, mask, gua, lla, pts) {
    return [
      { t: n + ' : description', p: 1, ok: d => !!I(d, n).desc },
      { t: n + ' : IPv4 ' + ip + ' ' + mask, p: 2, ok: d => I(d, n).ip === ip && I(d, n).mask === mask },
      { t: n + ' : link-local ' + lla, p: 2, ok: d => I(d, n).lla === norm6(lla) },
      { t: n + ' : GUA ' + gua, p: 2, ok: d => has6(I(d, n), gua) },
      { t: n + ' : activée (no shutdown)', p: 1, ok: d => !I(d, n).shut },
    ];
  }
  function r1Mission(P) {
    return [
      { t: 'Disable DNS lookup', p: 1, ok: d => !R(d).lookup },
      { t: 'Router name ' + P.rname + '-…', p: 1, ok: d => lo(R(d).hostname).startsWith(lo(P.rname) + '-') && R(d).hostname.length > P.rname.length + 1 },
      { t: 'Domain name ' + P.domain, p: 1, ok: d => R(d).domain === P.domain },
      { t: 'Passwords min-length ' + P.minLen, p: 1, ok: d => R(d).minLen === P.minLen },
      { t: 'Enable secret ' + P.secret, p: 1, ok: d => R(d).secret === P.secret },
      { t: 'Console password ' + P.con + ' + login', p: 1, ok: d => R(d).con.pass === P.con && (R(d).con.login || R(d).con.local) },
      { t: 'User ' + P.user + ' / ' + P.upass, p: 2, ok: d => R(d).users[P.user] && R(d).users[P.user].p === P.upass },
      { t: 'RSA key ' + P.rsa + ' bits', p: 1, ok: d => R(d).rsa >= P.rsa },
      { t: 'vty : login local', p: 1, ok: d => R(d).vty.local },
      { t: 'vty : SSH only', p: 1, ok: d => R(d).vty.transport === 'ssh' },
      { t: 'service password-encryption', p: 1, ok: d => R(d).spe },
      { t: 'MOTD banner', p: 1, ok: d => !!R(d).banner },
      { t: 'ipv6 unicast-routing', p: 1, ok: d => R(d).v6r },
      ...routerIfChecks('GigabitEthernet0/0/0', P.r_g0, P.mask0, P.gua0, P.lla, 8),
      ...routerIfChecks('GigabitEthernet0/0/1', P.r_g1, P.mask1, P.gua1, P.lla, 8),
      { t: 'Bonus : config sauvegardée (copy run start)', p: 0, ok: d => d.flags.saved && d.start && JSON.stringify(d.start) === JSON.stringify(d.run) },
    ];
  }
  function s1Mission(P) {
    return [
      { t: 'Init : startup-config effacée', p: 0, ok: d => d.flags.erased },
      { t: 'Init : vlan.dat supprimé', p: 0, ok: d => d.flags.vlanDeleted },
      { t: 'Init : SDM IPv6 actif (après reload)', p: 0, ok: d => d.sdm.active !== 'default' },
      { t: 'Init : redémarré sans ancienne config (−10 sinon)', p: 0, ok: d => d.flags.cleanBoot },
      { t: 'Disable DNS lookup', p: 2, ok: d => !R(d).lookup },
      { t: 'Switch name ' + P.sname + '-…', p: 2, ok: d => lo(R(d).hostname).startsWith(lo(P.sname) + '-') && R(d).hostname.length > P.sname.length + 1 },
      { t: 'Shutdown all unused interfaces (garder ' + P.used.map(shortIf).join(', ') + ')', p: 3, ok: d => Object.keys(R(d).ifaces).filter(n => !n.startsWith('Vlan')).every(n => P.used.includes(n) ? !I(d, n).shut : I(d, n).shut) },
      { t: 'SVI VLAN 1 : description', p: 1, ok: d => !!I(d, 'Vlan1').desc },
      { t: 'SVI VLAN 1 : IPv4 ' + P.s_ip + ' + no shutdown', p: 1, ok: d => I(d, 'Vlan1').ip === P.s_ip && I(d, 'Vlan1').mask === P.mask0 && !I(d, 'Vlan1').shut },
      { t: 'Gateway ' + P.r_g0, p: 1, ok: d => R(d).dgw === P.r_g0 },
      { t: 'SVI VLAN 1 : link-local ' + P.s_lla, p: 2, ok: d => I(d, 'Vlan1').lla === norm6(P.s_lla) },
    ];
  }
  const ANNALE = { rname: 'R1', sname: 'S1', domain: 'ccna-lab.com', minLen: 5, secret: 'class', con: 'cisco', user: 'admin', upass: 'admin1pass', rsa: 1024,
    r_g0: '172.16.2.1', r_g1: '172.16.3.1', mask0: '255.255.255.0', mask1: '255.255.255.0', gua0: '2001:fe:ab:2::1/64', gua1: '2001:fe:ab:3::1/64', lla: 'fe80::1',
    s_ip: '172.16.2.2', s_lla: 'fe80::2', used: ['FastEthernet0/5', 'FastEthernet0/6'],
    hosts: [{ name: 'PC-A', ip: '172.16.2.10', port: 'FastEthernet0/6', v6: ['2001:fe:ab:2:250:56ff:fe11:a'] }, { name: 'PC-B', ip: '172.16.3.10', v6: ['2001:fe:ab:3:250:56ff:fe22:b'] }, { name: 'R1', ip: '172.16.2.1', port: 'FastEthernet0/5' }] };

  function solR1(P) {
    return `enable
configure terminal
no ip domain-lookup
hostname ${P.rname}-Nom
ip domain-name ${P.domain}
security passwords min-length ${P.minLen}
enable secret ${P.secret}
line console 0
 password ${P.con}
 login
 logging synchronous
 exit
username ${P.user} secret ${P.upass}
crypto key generate rsa general-keys modulus ${P.rsa}
line vty 0 4
 login local
 transport input ssh
 exit
service password-encryption
banner motd #Authorized Access Only!#
ipv6 unicast-routing
interface g0/0/0
 description LAN vers ${P.sname}
 ip address ${P.r_g0} ${P.mask0}
 ipv6 address ${P.lla} link-local
 ipv6 address ${P.gua0}
 no shutdown
interface g0/0/1
 description LAN vers PC-B
 ip address ${P.r_g1} ${P.mask1}
 ipv6 address ${P.lla} link-local
 ipv6 address ${P.gua1}
 no shutdown
end
copy running-config startup-config`;
  }
  function solS1(P) {
    return `enable
erase startup-config
delete vlan.dat
configure terminal
sdm prefer dual-ipv4-and-ipv6 default
end
reload
   (Save? no → [confirm] Entrée → dialog? no)
enable
configure terminal
no ip domain-lookup
hostname ${P.sname}-Nom
interface range ${rangeOf(P.used)}
 shutdown
interface vlan 1
 description Management SVI
 ip address ${P.s_ip} ${P.mask0}
 ipv6 address ${P.s_lla} link-local
 no shutdown
 exit
ip default-gateway ${P.r_g0}
end`;
  }
  function rangeOf(used) {
    const u = used.map(n => +n.split('/')[1]);
    const segs = []; let s = null;
    for (let i = 1; i <= 25; i++) { const free = i <= 24 && !u.includes(i); if (free && s === null) s = i; if (!free && s !== null) { segs.push(s === i - 1 ? 'f0/' + s : 'f0/' + s + '-' + (i - 1)); s = null; } }
    return segs.join(' , ') + ' , g0/1-2';
  }

  const MISSIONS = {
    'annale-r1': { title: 'Annale – configurer R1 (30 pts + interfaces)', type: 'router', P: ANNALE, links: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'], obj: r1Mission, sol: solR1,
      intro: "Énoncé de l'annale, partie R1. Le routeur est déjà vierge. Les câbles G0/0/0 (vers S1) et G0/0/1 (vers PC-B) sont branchés." },
    'annale-s1': { title: 'Annale – initialiser et configurer S1 (12 pts)', type: 'switch', P: ANNALE, links: ['FastEthernet0/5', 'FastEthernet0/6'], obj: s1Mission, sol: solS1, dirty: true,
      intro: "Attention : l'élève précédent n'a PAS nettoyé ce switch (ancienne config + VLAN). Commence par l'initialiser (erase, delete vlan.dat, SDM, reload) puis configure S1. Ports câblés : F0/5 (R1) et F0/6 (PC-A)." },
    'tp1': { title: 'TP1 – configuration de base d’un switch', type: 'switch', P: ANNALE, links: ['FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/3'],
      obj: () => [
        { t: 'hostname S1', p: 1, ok: d => R(d).hostname === 'S1' },
        { t: 'console : password cisco + login', p: 1, ok: d => R(d).con.pass === 'cisco' && R(d).con.login },
        { t: 'console : logging synchronous', p: 1, ok: d => R(d).con.sync },
        { t: 'enable secret class', p: 1, ok: d => R(d).secret === 'class' },
        { t: 'vty 0 15 : password class + login (Telnet)', p: 1, ok: d => R(d).vty.pass === 'class' && R(d).vty.login },
        { t: 'service password-encryption', p: 1, ok: d => R(d).spe },
        { t: 'banner motd', p: 1, ok: d => !!R(d).banner },
        { t: 'no ip domain-lookup', p: 1, ok: d => !R(d).lookup },
        { t: 'interface vlan 1 : 192.168.1.4/24 + no shutdown', p: 2, ok: d => I(d, 'Vlan1').ip === '192.168.1.4' && I(d, 'Vlan1').mask === '255.255.255.0' && !I(d, 'Vlan1').shut },
      ],
      sol: () => 'enable\nconfigure terminal\nhostname S1\nline console 0\n password cisco\n login\n logging synchronous\n exit\nenable secret class\nline vty 0 15\n password class\n login\n exit\nservice password-encryption\nbanner motd "This is a secure system. Authorized Access Only!"\nno ip domain-lookup\ninterface vlan 1\n ip address 192.168.1.4 255.255.255.0\n no shutdown\nend\nshow running-config',
      intro: 'TP1 : nommer, sécuriser console/enable/vty, bannière, DNS, IP de gestion 192.168.1.4/24.' },
    'tp3-ssh': { title: 'TP3-2 – SSH sur le switch', type: 'switch', P: ANNALE, links: ['FastEthernet0/1', 'FastEthernet0/6'],
      obj: () => [
        { t: 'hostname S1', p: 1, ok: d => R(d).hostname === 'S1' },
        { t: 'ip domain-name utbm-lab.com', p: 1, ok: d => R(d).domain === 'utbm-lab.com' },
        { t: 'clé RSA 1024', p: 2, ok: d => R(d).rsa >= 1024 },
        { t: 'username admin secret Adm1nP@55', p: 2, ok: d => R(d).users.admin && R(d).users.admin.p === 'Adm1nP@55' },
        { t: 'vty : transport input telnet ssh', p: 1, ok: d => /ssh/.test(R(d).vty.transport || '') },
        { t: 'vty : login local', p: 1, ok: d => R(d).vty.local },
        { t: 'SVI vlan 1 192.168.20.253/24 up', p: 2, ok: d => I(d, 'Vlan1').ip === '192.168.20.253' && !I(d, 'Vlan1').shut },
      ],
      sol: () => 'enable\nconfigure terminal\nhostname S1\nip domain-name utbm-lab.com\ncrypto key generate rsa general-keys modulus 1024\nusername admin secret Adm1nP@55\nline vty 0 15\n transport input telnet ssh\n login local\n exit\ninterface vlan 1\n ip address 192.168.20.253 255.255.255.0\n no shutdown\nend\nshow ip ssh',
      intro: 'TP3-2 partie 3 : rendre le switch accessible en SSH.' },
    'vlan': { title: 'Lab VLAN & trunk (bonus)', type: 'switch', P: ANNALE, links: ['FastEthernet0/1', 'FastEthernet0/6', 'FastEthernet0/18'],
      obj: () => [
        { t: 'VLAN 10 nommé Operations', p: 1, ok: d => d.vlans[10] && d.vlans[10].name === 'Operations' },
        { t: 'VLAN 99 nommé Management', p: 1, ok: d => d.vlans[99] && d.vlans[99].name === 'Management' },
        { t: 'F0/6 en access VLAN 10', p: 2, ok: d => I(d, 'FastEthernet0/6').access === 10 && I(d, 'FastEthernet0/6').swmode === 'access' },
        { t: 'F0/1 en trunk', p: 2, ok: d => I(d, 'FastEthernet0/1').swmode === 'trunk' },
        { t: 'F0/1 : native VLAN 1000', p: 1, ok: d => I(d, 'FastEthernet0/1').native === 1000 },
        { t: 'SVI vlan 99 : 192.168.1.11/24 up', p: 2, ok: d => I(d, 'Vlan99').ip === '192.168.1.11' && !I(d, 'Vlan99').shut },
      ],
      sol: () => 'enable\nconfigure terminal\nvlan 10\n name Operations\nvlan 99\n name Management\nvlan 1000\n name Native\ninterface f0/6\n switchport mode access\n switchport access vlan 10\ninterface f0/1\n switchport mode trunk\n switchport trunk native vlan 1000\ninterface vlan 99\n ip address 192.168.1.11 255.255.255.0\n no shutdown\nend\nshow vlan brief\nshow interfaces trunk',
      intro: 'Lab Cisco « Configurer les VLAN et le trunking » (version courte).' },
    'libre-r': { title: 'Bac à sable – routeur', type: 'router', P: ANNALE, links: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'], obj: () => [], sol: () => '(aucune solution : fais ce que tu veux !)', intro: 'Routeur vierge, les 2 interfaces sont câblées.' },
    'libre-s': { title: 'Bac à sable – switch', type: 'switch', P: ANNALE, links: ['FastEthernet0/1', 'FastEthernet0/5', 'FastEthernet0/6'], obj: () => [], sol: () => '(aucune solution : fais ce que tu veux !)', intro: 'Switch vierge (SDM par défaut, sans IPv6).' },
  };

  function newDevice(m) {
    const d = { type: m.type, mode: 'user', ctx: null, run: blankCfg(m.type), start: null, pending: null, hist: [], hi: 0,
      vlans: { 1: { name: 'default' } }, vlanDel: false, sdm: { active: 'default', next: null }, links: m.links.slice(),
      env: { hosts: (m.P.hosts || []) }, seen: {}, flags: { saved: false, erased: false, vlanDeleted: false, cleanBoot: false, reloads: 0, dialogNo: false } };
    if (m.dirty) {
      d.run.hostname = 'S1-Dupont'; d.run.lookup = true; d.run.banner = { del: '#', text: 'Config du groupe precedent' };
      d.run.ifaces['Vlan1'].ip = '192.168.99.2'; d.run.ifaces['Vlan1'].mask = '255.255.255.0'; d.run.ifaces['Vlan1'].shut = false;
      d.run.ifaces['FastEthernet0/6'].access = 30; d.run.ifaces['FastEthernet0/6'].swmode = 'access';
      d.vlans[30] = { name: 'Ancien_TP' };
      d.start = clone(d.run);
      d.mode = 'user';
    }
    return d;
  }

  /* ================= interface utilisateur ================= */
  let D = null, M = null, MID = null, el = {}, extra = null;

  function print(text, cls) {
    if (text === undefined || text === null || text === '') return;
    const div = document.createElement('div'); if (cls) div.className = cls;
    div.textContent = text; el.out.appendChild(div);
  }
  function setPrompt(p, hide) { el.prompt.textContent = p; el.inp.type = hide ? 'password' : 'text'; }
  function refreshPrompt() { if (D.pendingPrompt !== undefined && D.pending) setPrompt(D.pendingPrompt, D.pendingHide); else setPrompt(promptOf(D)); el.mode.textContent = modeLabel(D.mode); el.mode.dataset.m = D.mode; }
  function modeLabel(m) { return { user: 'Utilisateur  >', priv: 'Privilégié  #', config: 'Config globale  (config)#', if: 'Interface  (config-if)#', range: 'Plage d’interfaces', subif: 'Sous-interface', line: 'Ligne  (config-line)#', vlan: 'VLAN', dhcp: 'Pool DHCP', dhcp6: 'Pool DHCPv6' }[m]; }

  function handleResult(res) {
    if (res && typeof res === 'object') {
      if (res.translating) {
        print(res.text); el.inp.disabled = true;
        setTimeout(() => { print(res.after, 'warn'); el.inp.disabled = false; el.inp.focus(); after(); }, 1300);
        return true;
      }
      if (res.pre) print(res.pre);
      D.pendingPrompt = res.prompt; D.pendingHide = !!res.hide;
      return false;
    }
    D.pendingPrompt = undefined;
    if (typeof res === 'string') res.split('\n').forEach(l => print(l, /^%[A-Z0-9]+-\d-/.test(l) ? 'log' : l.startsWith('💡') ? 'hint' : (/^%/.test(l) || /^\s*\^$/.test(l)) ? 'err' : ''));
    return false;
  }
  function after() { refreshPrompt(); renderObj(); el.out.scrollTop = el.out.scrollHeight; el.wrap.scrollTop = el.wrap.scrollHeight; }

  function submit(raw) {
    const shown = D.pending && D.pendingHide ? '' : raw;
    print((el.prompt.textContent) + shown, 'echo');
    let res;
    if (D.pending) res = handlePending(D, raw);
    else {
      if (raw.trim()) { D.hist.push(raw); }
      D.hi = D.hist.length;
      if (/\?\s*$/.test(raw)) { help(raw); after(); return; }
      res = execLine(D, raw);
    }
    if (handleResult(res)) return;
    after();
  }
  function help(raw) {
    const body = raw.replace(/\?\s*$/, '');
    const partial = /\S$/.test(body) ? body.split(/\s+/).pop().toLowerCase() : null;
    const toks = tokenize(partial !== null ? body.slice(0, body.length - partial.length) : body);
    const modes = [D.mode].concat(SUB.includes(D.mode) ? ['config'] : []);
    const list = nextHelp(D, toks, body, modes, partial);
    if (!list.length) print("% Unrecognized command", 'err');
    else print(list.map(x => '  ' + x).join('\n'));
    el.inp.value = body; // IOS réaffiche la commande
  }
  function tab() {
    const v = el.inp.value; if (!v || /\s$/.test(v)) return;
    const partial = v.split(/\s+/).pop().toLowerCase();
    const before = v.slice(0, v.length - partial.length);
    const modes = [D.mode].concat(SUB.includes(D.mode) ? ['config'] : []);
    const list = nextHelp(D, tokenize(before), before, modes, partial).filter(x => !x.startsWith('<'));
    if (list.length === 1) el.inp.value = before + list[0] + ' ';
    else if (PREF[partial] && list.includes(PREF[partial])) el.inp.value = before + PREF[partial] + ' ';
  }

  function renderObj() {
    if (!M) return;
    const objs = M.obj(M.P);
    const total = objs.reduce((a, o) => a + o.p, 0);
    let got = 0;
    el.obj.innerHTML = '';
    if (!objs.length) { el.obj.innerHTML = '<li class="muted">Mode libre : pas d\'objectifs. Essaie « ? » pour l\'aide.</li>'; el.score.textContent = ''; return; }
    objs.forEach(o => {
      let ok = false; try { ok = !!o.ok(D); } catch (e) { ok = false; }
      if (ok) got += o.p;
      const li = document.createElement('li'); li.className = ok ? 'done' : '';
      li.innerHTML = '<span class="tick">' + (ok ? '✓' : '○') + '</span><span>' + escapeHtml(o.t) + '</span>' + (o.p ? '<span class="pts">' + o.p + ' pt' + (o.p > 1 ? 's' : '') + '</span>' : '');
      el.obj.appendChild(li);
    });
    el.score.textContent = total ? got + ' / ' + total + ' pts' : '';
    el.bar.style.width = (total ? (100 * got / total) : 0) + '%';
    if (total && got === total && !D.flags.cheered) { D.flags.cheered = true; print('🎉 Tous les objectifs sont validés ! Pense à vérifier avec show running-config / show ip interface brief.', 'hint'); }
  }
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function load(id, custom) {
    MID = id; M = custom || MISSIONS[id]; extra = custom || null;
    D = newDevice(M);
    el.out.innerHTML = '';
    el.title.textContent = M.title;
    el.intro.textContent = M.intro || '';
    el.sol.textContent = M.sol(M.P);
    el.solBox.open = false;
    print('Simulateur pédagogique · abréviations, « ? », Tab et ↑↓ acceptés', 'muted');
    print('Press RETURN to get started!', '');
    D.mode = 'user';
    after();
    el.inp.focus({ preventScroll: true });
  }

  function init(root) {
    root.innerHTML = `
      <div class="sim-top">
        <label>Mission <select id="simSel"></select></label>
        <button class="btn ghost" id="simReset" type="button">↺ Recommencer</button>
        <span class="sim-mode" id="simMode"></span>
      </div>
      <div class="sim-grid">
        <div class="sim-term" id="simWrap" tabindex="-1">
          <div id="simOut" class="sim-out" aria-live="polite"></div>
          <div class="sim-line"><span id="simPrompt"></span><input id="simIn" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Commande IOS"></div>
        </div>
        <aside class="sim-side">
          <h3 id="simTitle"></h3>
          <p class="muted small" id="simIntro"></p>
          <div class="progress"><div id="simBar"></div></div>
          <p class="score" id="simScore"></p>
          <ul class="objs" id="simObj"></ul>
          <details id="simSolBox"><summary>Voir la solution</summary><pre class="code" id="simSol"></pre></details>
          <div class="sim-keys small muted">
            <b>Raccourcis</b> : <kbd>?</kbd> aide · <kbd>Tab</kbd> compléter · <kbd>↑</kbd><kbd>↓</kbd> historique · « do show … » depuis le mode config.
          </div>
        </aside>
      </div>`;
    el = { out: root.querySelector('#simOut'), inp: root.querySelector('#simIn'), prompt: root.querySelector('#simPrompt'), mode: root.querySelector('#simMode'), wrap: root.querySelector('#simWrap'),
      obj: root.querySelector('#simObj'), score: root.querySelector('#simScore'), bar: root.querySelector('#simBar'), title: root.querySelector('#simTitle'), intro: root.querySelector('#simIntro'), sol: root.querySelector('#simSol'), solBox: root.querySelector('#simSolBox'), sel: root.querySelector('#simSel') };
    Object.entries(MISSIONS).forEach(([k, m]) => { const o = document.createElement('option'); o.value = k; o.textContent = m.title; el.sel.appendChild(o); });
    const ob = document.createElement('option'); ob.value = 'blanc'; ob.textContent = 'Examen blanc (adresses aléatoires) – R1'; el.sel.appendChild(ob);
    const ob2 = document.createElement('option'); ob2.value = 'blanc-s'; ob2.textContent = 'Examen blanc (adresses aléatoires) – S1'; el.sel.appendChild(ob2);
    el.sel.addEventListener('change', () => pick(el.sel.value));
    root.querySelector('#simReset').addEventListener('click', () => pick(el.sel.value));
    el.wrap.addEventListener('click', () => { if (!getSelection().toString()) el.inp.focus(); });
    el.inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const v = el.inp.value; el.inp.value = ''; submit(v); e.preventDefault(); }
      else if (e.key === 'Tab') { e.preventDefault(); tab(); }
      else if (e.key === '?' && !D.pending) { e.preventDefault(); const v = el.inp.value + '?'; el.inp.value = ''; print(el.prompt.textContent + v, 'echo'); help(v); after(); }
      else if (e.key === 'ArrowUp') { if (D.hi > 0) { D.hi--; el.inp.value = D.hist[D.hi] || ''; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (D.hi < D.hist.length) { D.hi++; el.inp.value = D.hist[D.hi] || ''; } e.preventDefault(); }
      else if (e.key === 'z' && e.ctrlKey) { e.preventDefault(); if (CONF.includes(D.mode)) { D.mode = 'priv'; D.ctx = null; print(el.prompt.textContent + '^Z'); after(); } }
    });
    pick('annale-r1');
  }
  function pick(id) {
    el.sel.value = id;
    if (id === 'blanc' || id === 'blanc-s') {
      const P = window.EXAM && window.EXAM.params ? window.EXAM.params() : ANNALE;
      const r = id === 'blanc';
      load(id, { title: 'Examen blanc – ' + (r ? 'R1' : 'S1') + ' (adresses de ta dernière génération)', type: r ? 'router' : 'switch', P,
        links: r ? ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'] : P.used, obj: r ? r1Mission : s1Mission, sol: r ? solR1 : solS1, dirty: !r,
        intro: 'Mêmes tâches que l’annale avec les valeurs générées dans l’onglet « Examen blanc ». Va voir l’énoncé là-bas !' });
      return;
    }
    load(id);
  }

  window.SIM = { init, pick, solR1, solS1, rangeOf, ANNALE, norm6, _t: { newDevice, execLine, handlePending, MISSIONS, promptOf } };
})();
