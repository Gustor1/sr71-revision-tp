/* SR71 – Révision TP machine : données (commandes, énoncés, dépannage, exercices)
   Script classique (pas de module) pour que le site marche aussi en double-clic (file://). */

window.DATA = {};

/* ------------------------------------------------------------------
   1. COMMANDES PAR MACHINE
   freq : 3 = tombe à coup sûr (annale), 2 = vu en TP / très utile, 1 = bonus
   ------------------------------------------------------------------ */
DATA.machines = [
  {
    id: 'hote', name: 'PC hôte', os: 'Ubuntu', icon: '🖥️',
    role: "La vraie machine. Elle fait tourner les 2 VM (PC-A, PC-B) et te donne la console des équipements Cisco via PuTTY (câble console bleu → USB/série).",
    groups: [
      { title: 'Trouver le port série et lancer PuTTY', cmds: [
        { c: 'sudo dmesg | grep -i tty', d: "Trouver le nom du port série du câble console (souvent ttyUSB0 pour un adaptateur USB, ttyS0 pour un vrai port COM).", f: 3 },
        { c: 'ls /dev/ttyUSB* /dev/ttyS*', d: 'Lister les ports série présents.', f: 2 },
        { c: 'sudo putty', d: "Lancer PuTTY avec les droits sur le port série (sinon « Unable to open connection »).", f: 3 },
        { c: 'sudo usermod -aG dialout $USER', d: "Alternative : s'ajouter au groupe dialout (il faut se déconnecter/reconnecter). À faire seulement si tu as le temps.", f: 1 },
        { c: 'sudo screen /dev/ttyUSB0 9600', d: 'Plan B si PuTTY ne marche pas (quitter : Ctrl+A puis K).', f: 1 },
      ]},
      { title: 'Réglages PuTTY (pas des commandes, des clics)', cmds: [
        { c: 'Connection type : Serial', d: 'Tout en haut de la fenêtre PuTTY.', f: 3, plain: true },
        { c: 'Serial line : /dev/ttyUSB0', d: "Le nom trouvé avec dmesg. Sous Windows ce serait COM3, COM4…", f: 3, plain: true },
        { c: 'Speed : 9600', d: '9600 bauds, 8 bits, pas de parité, 1 bit de stop, pas de contrôle de flux (8N1).', f: 3, plain: true },
        { c: 'Open → appuyer sur Entrée', d: "La fenêtre est noire au début : c'est normal, tape Entrée pour réveiller la console.", f: 3, plain: true },
        { c: 'Copier = sélectionner · Coller = clic droit (ou clic milieu)', d: "Astuce gain de temps : prépare ta config dans gedit, copie-la, colle-la dans PuTTY en mode (config)#. Colle par petits blocs (la console à 9600 bauds peut perdre des caractères).", f: 2, plain: true },
      ]},
      { title: 'Réseau de l’hôte / VM', cmds: [
        { c: 'ip a', d: "Voir les cartes réseau de l'hôte (pour savoir laquelle est reliée à quelle VM).", f: 2 },
        { c: 'VirtualBox → VM → Configuration → Réseau → « Accès par pont »', d: "Chaque VM doit être en mode Accès par pont (bridge) sur la bonne carte physique, avec « Câble branché » coché. Sinon PC-A/PC-B ne voient jamais le switch/routeur.", f: 2, plain: true },
        { c: 'ssh admin@172.16.3.1', d: "L'hôte peut aussi faire du SSH s'il a une IP dans un des réseaux (sinon utilise PC-B).", f: 1 },
      ]},
    ]
  },
  {
    id: 'pca', name: 'PC-A', os: 'Windows 8 (VM)', icon: '🪟',
    role: "VM Windows. Dans l'annale : 172.16.2.10/24, passerelle 172.16.2.1, reliée à S1 F0/6. Pas de client SSH dessus.",
    groups: [
      { title: 'Configurer l’adresse IP', cmds: [
        { c: 'ncpa.cpl', d: "Win+R → ncpa.cpl → Entrée : ouvre directement les connexions réseau. Clic droit sur la carte → Propriétés → IPv4 → « Utiliser l'adresse IP suivante ».", f: 3 },
        { c: 'netsh interface show interface', d: 'Connaître le nom exact de la carte (ex. « Ethernet » ou « Connexion au réseau local »).', f: 2 },
        { c: 'netsh interface ipv4 set address name="Ethernet" static 172.16.2.10 255.255.255.0 172.16.2.1', d: 'IP + masque + passerelle en une ligne (cmd lancée en administrateur).', f: 3 },
        { c: 'netsh interface ipv4 set address name="Ethernet" dhcp', d: 'Repasser en DHCP.', f: 1 },
        { c: 'netsh interface ipv6 add address "Ethernet" 2001:db8:acad:a::3/64', d: 'Ajouter une IPv6 statique (si l’énoncé le demande).', f: 1 },
        { c: 'netsh advfirewall set allprofiles state off', d: "Couper le pare-feu Windows (sinon Windows NE RÉPOND PAS aux pings, ni IPv4 ni IPv6). cmd en administrateur.", f: 3 },
      ]},
      { title: 'Vérifier / lire les adresses', cmds: [
        { c: 'ipconfig', d: "IPv4, passerelle et IPv6. La GUA est la ligne « Adresse IPv6 » qui commence par le préfixe du routeur (2001:…) – pas l'« adresse IPv6 temporaire », pas fe80.", f: 3 },
        { c: 'ipconfig /all', d: 'En plus : adresse MAC (« Adresse physique »), DHCP, DNS.', f: 2 },
        { c: 'arp -a', d: 'Table ARP (IP ↔ MAC) du PC.', f: 2 },
        { c: 'route print', d: 'Table de routage du PC (vérifier la passerelle 0.0.0.0).', f: 1 },
        { c: 'ipconfig /release && ipconfig /renew', d: 'Redemander une adresse en DHCPv4 (TP DHCP). /renew6 pour DHCPv6.', f: 1 },
      ]},
      { title: 'Tester', cmds: [
        { c: 'ping 172.16.3.10', d: 'Ping IPv4 (4 paquets par défaut). « -t » = infini, Ctrl+C pour arrêter.', f: 3 },
        { c: 'ping 2001:fe:ab:3::1', d: 'Ping IPv6 GUA : Windows reconnaît tout seul une adresse IPv6 (ou ping -6).', f: 3 },
        { c: 'ping fe80::1%12', d: "Ping d'une adresse link-local : ajoute %N = numéro de ta carte (visible dans ipconfig, ex. fe80::…%12).", f: 3 },
        { c: 'tracert 172.16.3.10', d: 'Chemin + délai saut par saut (« tracert -d » = sans résolution DNS, plus rapide).', f: 3 },
      ]},
    ]
  },
  {
    id: 'pcb', name: 'PC-B', os: 'Linux (VM)', icon: '🐧',
    role: "VM Linux. Dans l'annale : 172.16.3.10/24, passerelle 172.16.3.1, reliée à R1 G0/0/1. C'est elle qui fait le SSH vers le routeur. Remplace enp0s3 par le nom vu dans « ip a ».",
    groups: [
      { title: 'Configurer l’adresse IP (toujours sudo)', cmds: [
        { c: 'ip a', d: "Nom de la carte (enp0s3, eth0…), adresses, MAC (link/ether).", f: 3 },
        { c: 'sudo ip link set enp0s3 up', d: 'Activer la carte si elle est DOWN.', f: 2 },
        { c: 'sudo ip addr add 172.16.3.10/24 dev enp0s3', d: 'Ajouter l’IPv4 avec son préfixe.', f: 3 },
        { c: 'sudo ip route add default via 172.16.3.1', d: 'Passerelle par défaut (= adresse du routeur sur ce LAN).', f: 3 },
        { c: 'sudo ip addr del 172.16.3.99/24 dev enp0s3', d: 'Supprimer une mauvaise adresse. (« sudo ip addr flush dev enp0s3 » = tout effacer.)', f: 2 },
        { c: 'sudo ip -6 addr add 2001:db8:acad:1::3/64 dev enp0s3', d: 'Ajouter une IPv6 statique.', f: 1 },
        { c: 'sudo ip -6 route add default via fe80::1 dev enp0s3', d: 'Passerelle IPv6 (souvent inutile : la SLAAC la donne toute seule).', f: 1 },
        { c: 'sudo ifconfig enp0s3 172.16.3.10/24 && sudo route add default gw 172.16.3.1', d: 'Ancienne syntaxe (si « ip » n’existe pas / vue en TP1).', f: 1 },
      ]},
      { title: 'Vérifier / lire les adresses', cmds: [
        { c: 'ip -6 addr show dev enp0s3', d: "La GUA est la ligne « inet6 2001:… scope global ». « scope link » = fe80 (link-local).", f: 3 },
        { c: 'ip route', d: 'Voir la route « default via … ».', f: 2 },
        { c: 'ip neigh', d: 'Table ARP / voisins IPv6 (équivalent de arp -a).', f: 1 },
        { c: 'sudo dhclient -v enp0s3', d: 'Demander une adresse en DHCPv4 (TP DHCP). « -6 » pour DHCPv6.', f: 1 },
      ]},
      { title: 'Tester + SSH', cmds: [
        { c: 'ping -c 4 172.16.2.10', d: 'Sous Linux ping ne s’arrête pas seul : « -c 4 » ou Ctrl+C.', f: 3 },
        { c: 'ping -c 4 2001:fe:ab:2::1', d: 'Ping IPv6 GUA (ping -6 sur les vieilles versions : ping6).', f: 3 },
        { c: 'ping -6 -c 4 -I enp0s3 fe80::1', d: "Ping link-local : il FAUT préciser la carte (-I enp0s3 ou fe80::1%enp0s3).", f: 3 },
        { c: 'traceroute 172.16.2.10', d: 'Délais et coupures sur le chemin (« tracepath » si traceroute n’est pas installé).', f: 3 },
        { c: 'ssh admin@172.16.3.1', d: "Connexion SSH au routeur (utilisateur admin de la base locale). Tape « yes » pour accepter la clé.", f: 3 },
        { c: 'ssh -o KexAlgorithms=+diffie-hellman-group14-sha1 -o HostKeyAlgorithms=+ssh-rsa admin@172.16.3.1', d: "Si « no matching key exchange method / host key type found » : le routeur utilise de vieux algorithmes, on les autorise.", f: 3 },
        { c: 'ssh -o KexAlgorithms=diffie-hellman-group1-sha1 -o Ciphers=aes256-cbc admin@172.16.3.1', d: 'Variante donnée dans le TP3-2 (copie l’algorithme proposé dans le message d’erreur).', f: 2 },
        { c: 'telnet 172.16.2.2', d: 'Telnet (TP1) : mot de passe des lignes vty. En clair → remplacé par SSH.', f: 1 },
      ]},
    ]
  },
  {
    id: 'switch', name: 'Switch', os: 'Cisco Catalyst 2960', icon: '🔀',
    role: "Couche 2. Son adresse IP n'existe que pour l'administrer à distance : elle se met sur l'interface virtuelle VLAN 1 (SVI), + ip default-gateway.",
    groups: [
      { title: 'Initialiser (début d’épreuve, -10 pts si oublié)', cmds: [
        { c: 'enable', d: 'Mode privilégié (Switch> → Switch#).', f: 3 },
        { c: 'erase startup-config', d: "Effacer la config sauvegardée (NVRAM). Entrée pour confirmer.", f: 3 },
        { c: 'delete vlan.dat', d: 'Effacer la base des VLAN (flash:vlan.dat). Entrée, Entrée.', f: 3 },
        { c: 'sdm prefer dual-ipv4-and-ipv6 default', d: "En (config)# : template qui active l'IPv6. Sur certains 2960 : « sdm prefer lanbase-routing ». Pris en compte après reload.", f: 3 },
        { c: 'show sdm prefer', d: 'Vérifier le template SDM actif.', f: 2 },
        { c: 'reload', d: "Redémarrer. « Save? » → no. Au redémarrage « initial configuration dialog? » → no.", f: 3 },
      ]},
      { title: 'Configuration de base (config)#', cmds: [
        { c: 'configure terminal', d: '« conf t » : passer en mode configuration globale.', f: 3 },
        { c: 'no ip domain-lookup', d: "Désactiver la recherche DNS (évite le « Translating… » quand tu fais une faute de frappe).", f: 3 },
        { c: 'hostname S1-Nom', d: 'Nom du switch (dans l’annale : S1-tonnom).', f: 3 },
        { c: 'enable secret class', d: 'Mot de passe chiffré du mode privilégié.', f: 2 },
        { c: 'line console 0\n password cisco\n login\n logging synchronous', d: 'Mot de passe console + login + messages qui ne coupent pas ta saisie.', f: 2 },
        { c: 'line vty 0 15\n password cisco\n login', d: 'Accès Telnet (TP1). Pour SSH : voir onglet Routeur (même chose, mais vty 0 15).', f: 1 },
        { c: 'service password-encryption', d: 'Chiffrer les mots de passe en clair (type 7).', f: 2 },
        { c: 'banner motd #Authorized Access Only!#', d: 'Bannière : le texte entre deux délimiteurs identiques.', f: 2 },
      ]},
      { title: 'Interfaces', cmds: [
        { c: 'interface range f0/1-4 , f0/7-24 , g0/1-2\n shutdown', d: "Éteindre TOUTES les interfaces inutilisées (annale : on garde F0/5 et F0/6). Vérifie les ports avec show ip interface brief.", f: 3 },
        { c: 'interface vlan 1\n description Management SVI\n ip address 172.16.2.2 255.255.255.0\n ipv6 address fe80::2 link-local\n no shutdown', d: "SVI de gestion : description + IPv4 + link-local + activation. (ipv6 refusé ? → SDM pas changé !)", f: 3 },
        { c: 'ip default-gateway 172.16.2.1', d: "En (config)# global (PAS dans l'interface) : passerelle du switch = IP du routeur.", f: 3 },
      ]},
      { title: 'Vérifier', cmds: [
        { c: 'show ip interface brief', d: 'Résumé : IP + état (up/up, administratively down…).', f: 3 },
        { c: 'show mac address-table', d: 'Adresses MAC apprises sur chaque port (annale partie 4).', f: 3 },
        { c: 'show ipv6 interface brief', d: 'Résumé des adresses IPv6.', f: 2 },
        { c: 'show running-config', d: '« show run » : config en cours (RAM).', f: 3 },
        { c: 'show interfaces vlan 1', d: "Détails de la SVI dont l'adresse MAC (bia).", f: 1 },
        { c: 'clear mac address-table dynamic', d: 'Vider les MAC apprises (TP2-1).', f: 1 },
        { c: 'show vlan brief', d: 'Les VLAN et leurs ports.', f: 1 },
        { c: 'copy running-config startup-config', d: 'Sauvegarder (RAM → NVRAM). Entrée pour confirmer le nom.', f: 3 },
      ]},
    ]
  },
  {
    id: 'routeur', name: 'Routeur', os: 'Cisco ISR 4321', icon: '📡',
    role: "Couche 3. Relie les deux LAN. Les interfaces sont ÉTEINTES par défaut (no shutdown obligatoire). C'est lui qu'on sécurise avec SSH.",
    groups: [
      { title: 'Initialiser', cmds: [
        { c: 'erase startup-config', d: 'Effacer la config sauvegardée.', f: 3 },
        { c: 'reload', d: 'Redémarrer (Save? → no ; initial configuration dialog? → no).', f: 3 },
      ]},
      { title: 'Base + sécurité (config)#', cmds: [
        { c: 'no ip domain-lookup', d: 'Désactiver la recherche DNS.', f: 3 },
        { c: 'hostname R1-Nom', d: 'Nom du routeur (OBLIGATOIRE avant la clé RSA).', f: 3 },
        { c: 'ip domain-name ccna-lab.com', d: 'Nom de domaine (OBLIGATOIRE avant la clé RSA).', f: 3 },
        { c: 'security passwords min-length 5', d: "Longueur minimale des mots de passe. À faire AVANT de taper les mots de passe.", f: 3 },
        { c: 'enable secret class', d: 'Mot de passe chiffré du mode privilégié.', f: 3 },
        { c: 'line console 0\n password cisco\n login\n logging synchronous', d: 'Mot de passe console.', f: 3 },
        { c: 'username admin secret admin1pass', d: 'Utilisateur dans la base locale (secret = chiffré).', f: 3 },
        { c: 'crypto key generate rsa general-keys modulus 1024', d: "Clé RSA 1024 bits (ou « crypto key generate rsa » puis répondre 1024). Active SSH.", f: 3 },
        { c: 'ip ssh version 2', d: 'Forcer SSH v2 (bonus, après la clé).', f: 1 },
        { c: 'line vty 0 4\n login local\n transport input ssh', d: "vty : authentification par la base locale + SSH uniquement. (« transport input telnet ssh » = les deux, TP3-2.)", f: 3 },
        { c: 'service password-encryption', d: 'Chiffrer les mots de passe en clair.', f: 3 },
        { c: 'banner motd #Authorized Access Only!#', d: 'Bannière MOTD.', f: 3 },
        { c: 'ipv6 unicast-routing', d: "Activer le routage IPv6 → le routeur envoie des RA → les PC obtiennent leur GUA par SLAAC.", f: 3 },
      ]},
      { title: 'Interfaces', cmds: [
        { c: 'interface g0/0/0\n description LAN S1 / PC-A\n ip address 172.16.2.1 255.255.255.0\n ipv6 address fe80::1 link-local\n ipv6 address 2001:fe:ab:2::1/64\n no shutdown', d: 'Description, IPv4, LLA, GUA, activation (8 pts dans l’annale).', f: 3 },
        { c: 'interface g0/0/1\n description LAN PC-B\n ip address 172.16.3.1 255.255.255.0\n ipv6 address fe80::1 link-local\n ipv6 address 2001:fe:ab:3::1/64\n no shutdown', d: 'Même chose sur l’autre LAN (même fe80::1 autorisé : link-local = local au lien).', f: 3 },
      ]},
      { title: 'Afficher (partie 4 de l’annale)', cmds: [
        { c: 'show ip interface brief', d: 'Résumé des interfaces IPv4.', f: 3 },
        { c: 'show ip route', d: 'Table de routage IPv4 (C = connecté, L = local, S = statique).', f: 3 },
        { c: 'show arp', d: 'Correspondance couche 2 ↔ couche 3 (MAC ↔ IP). (= show ip arp)', f: 3 },
        { c: 'show ip interface g0/0/0', d: "Infos IPv4 DÉTAILLÉES d'une interface. (≠ show interfaces g0/0/0 qui donne la couche 1/2.)", f: 3 },
        { c: 'show ipv6 route', d: 'Table de routage IPv6.', f: 3 },
        { c: 'show ipv6 interface brief', d: 'Résumé des adresses IPv6 + état.', f: 3 },
        { c: 'copy running-config startup-config', d: 'Sauvegarder pour le prochain démarrage (= write memory).', f: 3 },
        { c: 'show ipv6 interface g0/0/0', d: 'Détails IPv6 (groupes multicast FF02::1, FF02::2 si routage actif).', f: 1 },
        { c: 'show ip ssh', d: 'Vérifier que SSH est activé (version, délais).', f: 1 },
        { c: 'show version', d: 'Version IOS, uptime, modèle, registre.', f: 1 },
        { c: 'ssh -l admin 172.16.3.1', d: 'Client SSH intégré à l’IOS (depuis le switch par ex.). Ctrl+Maj+6 puis x = revenir sans fermer.', f: 1 },
      ]},
    ]
  },
  {
    id: 'bonus', name: 'TP avancés', os: 'VLAN · DHCP · routes', icon: '🧩',
    role: "Vu dans les labs Cisco (VLAN/trunk, inter-VLAN, DHCPv4/v6, routes statiques). Absent de l'annale mais peut tomber en variante : garde-les sous le coude.",
    groups: [
      { title: 'VLAN et trunk (switch)', cmds: [
        { c: 'vlan 10\n name Operations', d: 'Créer un VLAN et le nommer.', f: 2 },
        { c: 'interface f0/6\n switchport mode access\n switchport access vlan 10', d: 'Mettre un port dans un VLAN.', f: 2 },
        { c: 'interface f0/1\n switchport mode trunk\n switchport trunk native vlan 1000\n switchport trunk allowed vlan 10,20,30,1000', d: 'Trunk 802.1Q statique + VLAN natif + VLAN autorisés.', f: 2 },
        { c: 'show interfaces trunk', d: 'Vérifier les trunks.', f: 2 },
        { c: 'interface vlan 99\n ip address 192.168.1.11 255.255.255.0\n no shutdown', d: 'Déplacer la gestion sur un autre VLAN (penser à « no ip address » sur vlan 1).', f: 1 },
      ]},
      { title: 'Routage inter-VLAN « router-on-a-stick »', cmds: [
        { c: 'interface g0/0/1.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0', d: 'Une sous-interface par VLAN.', f: 2 },
        { c: 'interface g0/0/1.1000\n encapsulation dot1Q 1000 native', d: 'Sous-interface du VLAN natif (sans IP).', f: 1 },
        { c: 'interface g0/0/1\n no shutdown', d: "Activer l'interface physique (sinon toutes les sous-interfaces sont down).", f: 2 },
      ]},
      { title: 'Routes statiques', cmds: [
        { c: 'ip route 0.0.0.0 0.0.0.0 10.0.0.2', d: 'Route par défaut IPv4.', f: 2 },
        { c: 'ip route 192.168.2.0 255.255.255.0 10.0.0.2', d: 'Route statique vers un réseau.', f: 2 },
        { c: 'ip route 192.168.2.0 255.255.255.0 10.0.0.6 5', d: 'Route flottante (distance administrative 5 = secours).', f: 1 },
        { c: 'ipv6 route ::/0 2001:db8:acad:2::2', d: 'Route par défaut IPv6.', f: 2 },
      ]},
      { title: 'DHCPv4', cmds: [
        { c: 'ip dhcp excluded-address 192.168.1.1 192.168.1.5', d: 'Adresses que le DHCP ne distribue pas.', f: 2 },
        { c: 'ip dhcp pool LAN_A\n network 192.168.1.0 255.255.255.192\n default-router 192.168.1.1\n domain-name ccna-lab.com\n lease 2 12 30', d: 'Pool : réseau, passerelle, domaine, bail (j h m).', f: 2 },
        { c: 'interface g0/0/1\n ip helper-address 10.0.0.1', d: 'Relais DHCP (sur le routeur qui n’est pas serveur).', f: 2 },
        { c: 'show ip dhcp binding', d: 'Adresses distribuées.', f: 1 },
      ]},
      { title: 'DHCPv6', cmds: [
        { c: 'ipv6 dhcp pool R1-STATELESS\n dns-server 2001:db8:acad::254\n domain-name stateless.com', d: 'Pool sans état (adresse par SLAAC, DNS par DHCPv6).', f: 1 },
        { c: 'interface g0/0/1\n ipv6 nd other-config-flag\n ipv6 dhcp server R1-STATELESS', d: 'Flag O = « demande les autres infos au DHCPv6 ».', f: 1 },
        { c: 'interface g0/0/1\n ipv6 nd managed-config-flag\n ipv6 dhcp relay destination 2001:db8:acad:2::1 g0/0/0', d: 'Flag M = DHCPv6 avec état ; relais DHCPv6.', f: 1 },
      ]},
    ]
  },
];

/* ------------------------------------------------------------------
   2. TRADUCTEUR « ÉNONCÉ → COMMANDE »
   en : formulation de l'annale (en anglais), fr : traduction
   ans : réponses acceptées au quiz ({valeur} = doit être exacte)
   ------------------------------------------------------------------ */
DATA.phrases = [
  // --- Initialisation
  { cat: 'Initialiser', en: 'Erase the startup configuration', fr: 'Effacer la config de démarrage', dev: 'R/S', mode: '#', cmd: 'erase startup-config', ans: ['erase startup-config', 'write erase'] },
  { cat: 'Initialiser', en: 'Erase the VLANs from the switch', fr: 'Effacer les VLAN du switch', dev: 'S', mode: '#', cmd: 'delete vlan.dat', ans: ['delete vlan.dat', 'delete flash:vlan.dat'] },
  { cat: 'Initialiser', en: 'Reload the device', fr: 'Redémarrer', dev: 'R/S', mode: '#', cmd: 'reload', ans: ['reload'] },
  { cat: 'Initialiser', en: 'Change the SDM template to one that supports IPv6', fr: 'Changer le template SDM pour l’IPv6', dev: 'S', mode: '(config)#', cmd: 'sdm prefer dual-ipv4-and-ipv6 default', alt: 'ou sdm prefer lanbase-routing, puis reload', ans: ['sdm prefer dual-ipv4-and-ipv6 default', 'sdm prefer lanbase-routing'] },
  // --- Base
  { cat: 'Base', en: 'Disable DNS lookup', fr: 'Désactiver la résolution DNS', dev: 'R/S', mode: '(config)#', cmd: 'no ip domain-lookup', ans: ['no ip domain-lookup', 'no ip domain lookup'] },
  { cat: 'Base', en: 'Router name / Switch name', fr: 'Nommer l’équipement', dev: 'R/S', mode: '(config)#', cmd: 'hostname R1-Nom', ans: ['hostname {R1-Nom}'] },
  { cat: 'Base', en: 'Domain name : ccna-lab.com', fr: 'Nom de domaine', dev: 'R', mode: '(config)#', cmd: 'ip domain-name ccna-lab.com', ans: ['ip domain-name {ccna-lab.com}', 'ip domain name {ccna-lab.com}'] },
  { cat: 'Base', en: 'Configure an MOTD banner', fr: 'Bannière du jour', dev: 'R/S', mode: '(config)#', cmd: 'banner motd #Authorized Access Only!#', ans: ['banner motd *'] },
  { cat: 'Base', en: 'Prevent console messages from interrupting commands', fr: 'Messages console synchronisés', dev: 'R/S', mode: '(config-line)#', cmd: 'logging synchronous', ans: ['logging synchronous'] },
  // --- Sécurité
  { cat: 'Sécurité', en: 'Set the minimum length for passwords : 5 characters', fr: 'Longueur minimale des mots de passe', dev: 'R', mode: '(config)#', cmd: 'security passwords min-length 5', ans: ['security passwords min-length {5}'] },
  { cat: 'Sécurité', en: 'Encrypted privileged EXEC password : class', fr: 'Mot de passe chiffré du mode privilégié', dev: 'R/S', mode: '(config)#', cmd: 'enable secret class', ans: ['enable secret {class}'] },
  { cat: 'Sécurité', en: 'Console access password : cisco', fr: 'Mot de passe console', dev: 'R/S', mode: '(config)# puis (config-line)#', cmd: 'line console 0\n password cisco\n login', ans: ['password {cisco}'], q: 'Une fois dans « line console 0 », quelle ligne pose le mot de passe cisco ?' },
  { cat: 'Sécurité', en: 'Create an administrative user in the local database (admin / admin1pass)', fr: 'Créer un utilisateur local', dev: 'R', mode: '(config)#', cmd: 'username admin secret admin1pass', ans: ['username {admin} secret {admin1pass}', 'username {admin} password {admin1pass}'] },
  { cat: 'Sécurité', en: 'Generate an RSA crypto key : 1024 bits modulus', fr: 'Générer la clé RSA 1024', dev: 'R', mode: '(config)#', cmd: 'crypto key generate rsa general-keys modulus 1024', alt: 'ou « crypto key generate rsa » puis taper 1024', ans: ['crypto key generate rsa general-keys modulus {1024}', 'crypto key generate rsa modulus {1024}', 'crypto key generate rsa'] },
  { cat: 'Sécurité', en: 'Set login on vty lines to use local database', fr: 'Login vty via la base locale', dev: 'R', mode: '(config-line)#', cmd: 'line vty 0 4\n login local', ans: ['login local'], q: 'Dans « line vty 0 4 », quelle ligne utilise la base locale ?' },
  { cat: 'Sécurité', en: 'Set vty lines to accept SSH connections only', fr: 'vty : SSH uniquement', dev: 'R', mode: '(config-line)#', cmd: 'transport input ssh', ans: ['transport input ssh'] },
  { cat: 'Sécurité', en: 'Encrypt the clear text passwords', fr: 'Chiffrer les mots de passe en clair', dev: 'R/S', mode: '(config)#', cmd: 'service password-encryption', ans: ['service password-encryption'] },
  { cat: 'Sécurité', en: 'Enable remote access via Telnet (vty password)', fr: 'Accès Telnet (TP1)', dev: 'S', mode: '(config-line)#', cmd: 'line vty 0 15\n password class\n login', ans: ['line vty 0 15', 'line vty 0 4'], q: 'Quelle commande ouvre la configuration des lignes virtuelles du switch ?' },
  // --- Interfaces
  { cat: 'Interfaces', en: 'Enable IPv6 routing', fr: 'Activer le routage IPv6', dev: 'R', mode: '(config)#', cmd: 'ipv6 unicast-routing', ans: ['ipv6 unicast-routing'] },
  { cat: 'Interfaces', en: 'Set the description', fr: 'Description d’interface', dev: 'R/S', mode: '(config-if)#', cmd: 'description Link to S1', ans: ['description *'] },
  { cat: 'Interfaces', en: 'Set the Layer 3 IPv4 address (172.16.2.1/24)', fr: 'Adresse IPv4', dev: 'R/S', mode: '(config-if)#', cmd: 'ip address 172.16.2.1 255.255.255.0', ans: ['ip address {172.16.2.1} {255.255.255.0}'] },
  { cat: 'Interfaces', en: 'Set the IPv6 Link Local Address (fe80::1)', fr: 'Adresse IPv6 link-local', dev: 'R/S', mode: '(config-if)#', cmd: 'ipv6 address fe80::1 link-local', ans: ['ipv6 address {fe80::1} link-local'] },
  { cat: 'Interfaces', en: 'Set the Layer 3 IPv6 address (2001:fe:ab:2::1/64)', fr: 'Adresse IPv6 globale (GUA)', dev: 'R', mode: '(config-if)#', cmd: 'ipv6 address 2001:fe:ab:2::1/64', ans: ['ipv6 address {2001:fe:ab:2::1/64}'] },
  { cat: 'Interfaces', en: 'Activate interface', fr: 'Activer l’interface', dev: 'R/S', mode: '(config-if)#', cmd: 'no shutdown', ans: ['no shutdown'] },
  { cat: 'Interfaces', en: 'Shutdown all unused interfaces', fr: 'Éteindre les ports inutilisés', dev: 'S', mode: '(config)# puis (config-if-range)#', cmd: 'interface range f0/1-4 , f0/7-24 , g0/1-2\n shutdown', ans: ['shutdown'], q: 'Dans « interface range … », quelle commande éteint les ports ?' },
  { cat: 'Interfaces', en: 'Configure Management Interface (SVI) on VLAN1', fr: 'Interface de gestion du switch', dev: 'S', mode: '(config)#', cmd: 'interface vlan 1\n ip address 172.16.2.2 255.255.255.0\n no shutdown', ans: ['interface vlan {1}'], q: 'Quelle commande entre dans la SVI de gestion VLAN 1 ?' },
  { cat: 'Interfaces', en: 'Set the switch default gateway (172.16.2.1)', fr: 'Passerelle du switch', dev: 'S', mode: '(config)#', cmd: 'ip default-gateway 172.16.2.1', ans: ['ip default-gateway {172.16.2.1}'] },
  // --- PC
  { cat: 'PC', en: 'PCA : set IPv4 address and correct IPv4 gateway', fr: 'IP + passerelle sous Windows', dev: 'PC-A', mode: 'cmd admin', cmd: 'netsh interface ipv4 set address name="Ethernet" static 172.16.2.10 255.255.255.0 172.16.2.1', alt: 'ou interface graphique : Win+R → ncpa.cpl', ans: ['netsh interface ipv4 set address name="ethernet" static {172.16.2.10} {255.255.255.0} {172.16.2.1}', 'ncpa.cpl'] },
  { cat: 'PC', en: 'PCB : set IPv4 address (Linux)', fr: 'IP sous Linux', dev: 'PC-B', mode: 'terminal', cmd: 'sudo ip addr add 172.16.3.10/24 dev enp0s3', ans: ['sudo ip addr add {172.16.3.10/24} dev {enp0s3}', 'sudo ip a add {172.16.3.10/24} dev {enp0s3}', 'sudo ip address add {172.16.3.10/24} dev {enp0s3}'] },
  { cat: 'PC', en: 'PCB : set the correct IPv4 gateway (Linux)', fr: 'Passerelle sous Linux', dev: 'PC-B', mode: 'terminal', cmd: 'sudo ip route add default via 172.16.3.1', ans: ['sudo ip route add default via {172.16.3.1}', 'sudo ip r add default via {172.16.3.1}'] },
  { cat: 'PC', en: 'PCA : write down the IPv6 GUA', fr: 'Lire la GUA sous Windows', dev: 'PC-A', mode: 'cmd', cmd: 'ipconfig', alt: 'ligne « Adresse IPv6 » en 2001:fe:ab:2:…', ans: ['ipconfig', 'ipconfig /all'] },
  { cat: 'PC', en: 'PCB : write down the IPv6 GUA', fr: 'Lire la GUA sous Linux', dev: 'PC-B', mode: 'terminal', cmd: 'ip -6 addr', alt: 'ligne « inet6 2001:fe:ab:3:… scope global »', ans: ['ip -6 addr', 'ip -6 a', 'ip a', 'ip addr', 'ip -6 addr show', 'ip -6 addr show dev {enp0s3}', 'ifconfig'] },
  { cat: 'PC', en: 'Disable the Windows firewall (pings not answered)', fr: 'Couper le pare-feu Windows', dev: 'PC-A', mode: 'cmd admin', cmd: 'netsh advfirewall set allprofiles state off', ans: ['netsh advfirewall set allprofiles state off'] },
  // --- Tests
  { cat: 'Tests', en: 'Ping an IPv6 link-local address from Linux', fr: 'Ping LLA sous Linux', dev: 'PC-B', mode: 'terminal', cmd: 'ping -6 -I enp0s3 fe80::1', ans: ['ping -6 -i {enp0s3} {fe80::1}', 'ping {fe80::1%enp0s3}', 'ping6 -i {enp0s3} {fe80::1}', 'ping -i {enp0s3} {fe80::1}'] },
  { cat: 'Tests', en: 'Ping an IPv6 link-local address from Windows', fr: 'Ping LLA sous Windows', dev: 'PC-A', mode: 'cmd', cmd: 'ping fe80::1%12', alt: '%12 = index de la carte (lu dans ipconfig)', ans: ['ping fe80::1%*'] },
  { cat: 'Tests', en: 'What other command is useful in displaying network delay and breaks in the path?', fr: 'Délais et coupures sur le chemin', dev: 'PC', mode: 'cmd / terminal', cmd: 'traceroute (Linux) / tracert (Windows)', ans: ['traceroute', 'tracert', 'traceroute *', 'tracert *'] },
  { cat: 'Tests', en: 'Establish an SSH connection between a Linux workstation and the router', fr: 'SSH depuis Linux', dev: 'PC-B', mode: 'terminal', cmd: 'ssh admin@172.16.3.1', ans: ['ssh {admin@172.16.3.1}', 'ssh -l {admin} {172.16.3.1}', 'ssh *'] },
  // --- Show
  { cat: 'Afficher', en: 'Display a summary of important information about the IPv4 interfaces', fr: 'Résumé des interfaces IPv4', dev: 'R/S', mode: '#', cmd: 'show ip interface brief', ans: ['show ip interface brief'] },
  { cat: 'Afficher', en: 'Display the IPv4 routing table', fr: 'Table de routage IPv4', dev: 'R', mode: '#', cmd: 'show ip route', ans: ['show ip route'] },
  { cat: 'Afficher', en: 'Display the Layer 2 to Layer 3 mapping of addresses', fr: 'Correspondance MAC ↔ IP', dev: 'R', mode: '#', cmd: 'show arp', ans: ['show arp', 'show ip arp'] },
  { cat: 'Afficher', en: 'Display detailed IPv4 information about interface G0/0/0', fr: 'Infos IPv4 détaillées d’une interface', dev: 'R', mode: '#', cmd: 'show ip interface g0/0/0', ans: ['show ip interface {g0/0/0}', 'show ip interface {gigabitethernet0/0/0}', 'show ip interface {gigabitethernet} {0/0/0}', 'show ip interface {gi0/0/0}'] },
  { cat: 'Afficher', en: 'Display the IPv6 routing table', fr: 'Table de routage IPv6', dev: 'R', mode: '#', cmd: 'show ipv6 route', ans: ['show ipv6 route'] },
  { cat: 'Afficher', en: 'Display a summary of IPv6 interface addresses and status', fr: 'Résumé des interfaces IPv6', dev: 'R/S', mode: '#', cmd: 'show ipv6 interface brief', ans: ['show ipv6 interface brief'] },
  { cat: 'Afficher', en: 'Display on the switch the MAC address of the devices connected to the ports', fr: 'Table des adresses MAC du switch', dev: 'S', mode: '#', cmd: 'show mac address-table', ans: ['show mac address-table', 'show mac-address-table'] },
  { cat: 'Afficher', en: 'Save the current configuration so it will be used the next time the router is started', fr: 'Sauvegarder la configuration', dev: 'R/S', mode: '#', cmd: 'copy running-config startup-config', ans: ['copy running-config startup-config', 'write memory', 'write', 'wr'] },
  { cat: 'Afficher', en: 'Display the current configuration', fr: 'Config en cours', dev: 'R/S', mode: '#', cmd: 'show running-config', ans: ['show running-config'] },
  { cat: 'Afficher', en: 'Display the IOS version', fr: 'Version de l’IOS', dev: 'R/S', mode: '#', cmd: 'show version', ans: ['show version'] },
  { cat: 'Afficher', en: 'Display the VLANs and their ports', fr: 'Liste des VLAN', dev: 'S', mode: '#', cmd: 'show vlan brief', ans: ['show vlan brief'] },
  // --- TP avancés
  { cat: 'TP avancés', en: 'Create VLAN 10 named Operations', fr: 'Créer un VLAN', dev: 'S', mode: '(config)#', cmd: 'vlan 10\n name Operations', ans: ['vlan {10}'], q: 'Quelle commande crée le VLAN 10 ?' },
  { cat: 'TP avancés', en: 'Assign F0/6 to VLAN 10', fr: 'Port dans un VLAN', dev: 'S', mode: '(config-if)#', cmd: 'switchport mode access\n switchport access vlan 10', ans: ['switchport access vlan {10}'], q: 'Dans interface f0/6, quelle commande place le port dans le VLAN 10 ?' },
  { cat: 'TP avancés', en: 'Configure F0/1 as a static 802.1Q trunk', fr: 'Trunk statique', dev: 'S', mode: '(config-if)#', cmd: 'switchport mode trunk', ans: ['switchport mode trunk'] },
  { cat: 'TP avancés', en: 'Set the native VLAN to 1000', fr: 'VLAN natif', dev: 'S', mode: '(config-if)#', cmd: 'switchport trunk native vlan 1000', ans: ['switchport trunk native vlan {1000}'] },
  { cat: 'TP avancés', en: 'Configure a default route via 10.0.0.2', fr: 'Route par défaut', dev: 'R', mode: '(config)#', cmd: 'ip route 0.0.0.0 0.0.0.0 10.0.0.2', ans: ['ip route {0.0.0.0} {0.0.0.0} {10.0.0.2}'] },
  { cat: 'TP avancés', en: 'Configure the subinterface for VLAN 10 (802.1Q)', fr: 'Sous-interface inter-VLAN', dev: 'R', mode: '(config-subif)#', cmd: 'interface g0/0/1.10\n encapsulation dot1Q 10', ans: ['encapsulation dot1q {10}'], q: 'Dans interface g0/0/1.10, quelle commande associe le VLAN 10 ?' },
  { cat: 'TP avancés', en: 'Configure R2 as a DHCP relay towards 10.0.0.1', fr: 'Relais DHCP', dev: 'R', mode: '(config-if)#', cmd: 'ip helper-address 10.0.0.1', ans: ['ip helper-address {10.0.0.1}'] },
  { cat: 'TP avancés', en: 'Exclude the first 5 addresses from DHCP', fr: 'Exclusion DHCP', dev: 'R', mode: '(config)#', cmd: 'ip dhcp excluded-address 192.168.1.1 192.168.1.5', ans: ['ip dhcp excluded-address {192.168.1.1} {192.168.1.5}'] },
];

/* ------------------------------------------------------------------
   3. QUIZ « DANS QUEL MODE ? »
   ------------------------------------------------------------------ */
DATA.modes = [
  ['enable', '>'], ['configure terminal', '#'], ['show ip interface brief', '#'], ['copy running-config startup-config', '#'],
  ['erase startup-config', '#'], ['reload', '#'], ['show mac address-table', '#'], ['delete vlan.dat', '#'],
  ['hostname R1', '(config)#'], ['no ip domain-lookup', '(config)#'], ['enable secret class', '(config)#'],
  ['service password-encryption', '(config)#'], ['banner motd #x#', '(config)#'], ['ipv6 unicast-routing', '(config)#'],
  ['ip domain-name ccna-lab.com', '(config)#'], ['username admin secret admin1pass', '(config)#'], ['crypto key generate rsa', '(config)#'],
  ['security passwords min-length 5', '(config)#'], ['ip default-gateway 172.16.2.1', '(config)#'], ['sdm prefer lanbase-routing', '(config)#'],
  ['ip address 172.16.2.1 255.255.255.0', '(config-if)#'], ['no shutdown', '(config-if)#'], ['ipv6 address fe80::1 link-local', '(config-if)#'],
  ['description LAN', '(config-if)#'], ['switchport access vlan 10', '(config-if)#'],
  ['password cisco', '(config-line)#'], ['login local', '(config-line)#'], ['transport input ssh', '(config-line)#'], ['logging synchronous', '(config-line)#'],
];

/* ------------------------------------------------------------------
   4. DÉPANNAGE : symptôme → cause
   ------------------------------------------------------------------ */
DATA.troubles = [
  { s: "PC-B (Linux) ping PC-A (Windows) : « Délai d'attente dépassé ». Mais PC-A arrive à pinger PC-B.", ok: 1,
    o: ['La passerelle de PC-B est fausse', 'Le pare-feu Windows de PC-A bloque les pings entrants', 'ipv6 unicast-routing manque', 'Le câble PC-A est débranché'],
    e: "Si A → B marche, le chemin et les passerelles sont bons. Seul le retour vers Windows échoue : c'est le pare-feu. → netsh advfirewall set allprofiles state off." },
  { s: "PC-B n'a qu'une adresse fe80::… et aucune adresse 2001:… alors que le routeur a ses GUA.", ok: 2,
    o: ['Il faut redémarrer la VM', 'La carte est en DHCP', 'Le routeur n’a pas « ipv6 unicast-routing » : il n’envoie pas de RA', "Il faut « ipv6 enable » sur le PC"],
    e: "La GUA du PC vient de la SLAAC, qui a besoin des annonces de routeur (RA). Sans ipv6 unicast-routing, le routeur n'en envoie pas. Après l'avoir ajouté, attends quelques secondes (ou débranche/rebranche la carte)." },
  { s: "Sur le switch, « ipv6 address fe80::2 link-local » renvoie « % Invalid input detected ».", ok: 0,
    o: ['Le template SDM ne supporte pas l’IPv6 (sdm prefer … + reload)', 'Il faut ipv6 unicast-routing sur le switch', 'Il faut être en mode (config)#', 'Le switch n’a pas de VLAN 1'],
    e: "Le template par défaut du 2960 n'a pas l'IPv6. → (config)# sdm prefer dual-ipv4-and-ipv6 default (ou lanbase-routing) → end → reload. C'est pour ça que l'annale le demande dès le début." },
  { s: "« crypto key generate rsa » répond « % Please define a domain-name first. »", ok: 3,
    o: ['Il manque enable secret', 'Il faut d’abord ip ssh version 2', 'Il manque username admin', 'Il manque ip domain-name (et un hostname ≠ Router)'],
    e: "La clé RSA est nommée hostname.domaine : il faut hostname ET ip domain-name AVANT de générer la clé." },
  { s: "ssh admin@172.16.3.1 : « Unable to negotiate … no matching key exchange method found. Their offer: diffie-hellman-group14-sha1 »", ok: 0,
    o: ['Ajouter -o KexAlgorithms=+diffie-hellman-group14-sha1 (et -o HostKeyAlgorithms=+ssh-rsa)', 'Le mot de passe est faux', 'transport input ssh manque', 'La clé fait moins de 1024 bits'],
    e: "Le client Linux récent refuse les vieux algorithmes du routeur. On les réautorise avec -o … en recopiant le nom proposé dans le message (« Their offer »)." },
  { s: "Tu tapes « shwo run » et le routeur se bloque : « Translating «shwo»…domain server (255.255.255.255) ».", ok: 2,
    o: ['Le routeur a planté, il faut reload', 'Il faut taper exit', 'La recherche DNS est active : attendre ou Ctrl+Maj+6, puis « no ip domain-lookup »', 'Le câble console est mal branché'],
    e: "Un mot inconnu est pris pour un nom d'hôte à résoudre. C'est pour ça que « Disable DNS lookup » est la 1ʳᵉ tâche de l'annale." },
  { s: "PC-A ping 172.16.2.1 (routeur) OK, mais ping 172.16.2.2 (switch) depuis PC-B échoue.", ok: 1,
    o: ['Le switch n’a pas d’adresse MAC', "Le switch n'a pas d'« ip default-gateway » : il ne sait pas répondre hors de son réseau", 'Le port F0/5 est en trunk', 'Il manque ipv6 unicast-routing'],
    e: "Un switch se comporte comme un PC pour sa propre IP : pour répondre à un autre réseau (172.16.3.0), il lui faut une passerelle → ip default-gateway 172.16.2.1." },
  { s: "PuTTY s'ouvre, fenêtre noire, rien ne s'affiche même en tapant.", ok: 3,
    o: ['Le routeur est éteint forcément', 'Il faut taper enable', 'Il faut Telnet au lieu de Serial', 'Mauvais port (ttyUSB0 ?) / vitesse ≠ 9600 / câble sur le port AUX / appuyer sur Entrée'],
    e: "Vérifie dans l'ordre : câble bleu sur le port CONSOLE (pas AUX), port trouvé avec dmesg | grep tty, vitesse 9600, PuTTY lancé avec sudo, puis Entrée." },
  { s: "Dans Windows, la carte de la VM PC-A affiche « Câble réseau non connecté ».", ok: 0,
    o: ["VirtualBox : réseau de la VM pas en « Accès par pont » sur la bonne carte / « câble branché » décoché", 'Le switch n’a pas d’IP', 'Le pare-feu est actif', 'Il manque la passerelle'],
    e: "La VM ne voit le réseau physique que si sa carte virtuelle est pontée (bridge) sur la carte physique branchée au switch." },
  { s: "« show ip interface brief » : G0/0/1 est « administratively down / down ».", ok: 2,
    o: ['Câble débranché', 'Mauvais masque', 'Il manque « no shutdown » sur l’interface', 'Le PC est éteint'],
    e: "administratively down = éteinte par la config. Sur un routeur toutes les interfaces le sont par défaut. → interface g0/0/1 → no shutdown." },
  { s: "« show ip interface brief » : G0/0/1 est « down / down » (et PAS administratively).", ok: 1,
    o: ['Il manque no shutdown', 'Problème physique : câble, port, carte du PC en face éteinte/débranchée', 'Mauvaise IP', 'DNS actif'],
    e: "L'interface est activée mais ne voit pas de signal : vérifie le câble, le port utilisé, et que la carte d'en face (VM) est connectée." },
  { s: "« enable secret abc » répond « % Password too short - must be at least 5 characters ».", ok: 0,
    o: ['security passwords min-length 5 est actif : le mot de passe doit faire ≥ 5 caractères', 'Il faut service password-encryption avant', 'Il faut être en mode #', 'Il faut username avant'],
    e: "C'est voulu : la longueur minimale s'applique. class et cisco font 5 caractères → OK." },
  { s: "Ping Windows « ping fe80::1 » : « Échec de la transmission. Défaillance générale. »", ok: 3,
    o: ['Le routeur n’a pas de LLA', 'Il faut ipconfig /renew', 'Le pare-feu', 'Il manque l’index de la carte : ping fe80::1%12'],
    e: "Une link-local existe sur chaque lien : Windows doit savoir par quelle carte sortir → %N (index lu dans ipconfig)." },
  { s: "Le 1er ping affiche « .!!!! » (un point puis des !).", ok: 1,
    o: ['Le câble est défectueux', "C'est normal : le 1er paquet est perdu pendant la résolution ARP", 'Le routage IPv6 est désactivé', 'Le pare-feu filtre un paquet sur cinq'],
    e: "Le routeur doit d'abord trouver la MAC de la destination (ARP). Le 1er écho expire pendant ce temps. Relance : « !!!!! »." },
  { s: "ssh : « Connection refused » alors que le ping vers le routeur marche.", ok: 2,
    o: ['Mauvais mot de passe', 'Le pare-feu Linux', 'Pas de clé RSA générée (SSH désactivé) ou transport input sans ssh', 'Il faut ipv6 unicast-routing'],
    e: "Le routeur n'écoute en SSH qu'une fois la clé RSA générée et si les vty acceptent ssh. Vérifie avec show ip ssh." },
  { s: "ssh se connecte mais « % Login invalid » / « Access denied » avec admin / admin1pass.", ok: 0,
    o: ["Il manque « login local » sur les vty ou l'utilisateur est mal tapé (username admin secret admin1pass)", 'La clé RSA est trop courte', 'Le pare-feu Windows', 'Il manque ip domain-name'],
    e: "Sans login local, les vty utilisent le mot de passe de ligne (ou rien). Avec login local, ils demandent un utilisateur de la base locale." },
  { s: "Après reload du switch, ta configuration a disparu.", ok: 1,
    o: ['Le switch est en panne', "Tu n'as pas fait « copy running-config startup-config » avant (la running-config est en RAM)", 'Le SDM a effacé la config', "C'est le reload qui efface toujours tout"],
    e: "running-config = RAM (perdue au redémarrage). startup-config = NVRAM. Pour changer le SDM au début, c'est justement ce qu'on veut : partir d'une config vide." },
];

/* ------------------------------------------------------------------
   5. REMETTRE DANS L'ORDRE
   ------------------------------------------------------------------ */
DATA.orders = [
  { t: 'Activer SSH sur le routeur (ordre qui évite les erreurs)', steps: [
    'hostname R1-Nom', 'ip domain-name ccna-lab.com', 'username admin secret admin1pass',
    'crypto key generate rsa general-keys modulus 1024', 'line vty 0 4', 'login local', 'transport input ssh' ],
    note: "hostname + domaine AVANT la clé ; l'utilisateur avant « login local » (sinon tu peux te bloquer dehors)." },
  { t: 'Début d’épreuve : initialiser le switch', steps: [
    'enable', 'erase startup-config', 'delete vlan.dat', 'configure terminal', 'sdm prefer dual-ipv4-and-ipv6 default', 'end', 'reload' ],
    note: "Le SDM n'est appliqué qu'après reload : on fait tout avant un seul reload. Au redémarrage : « initial configuration dialog? » → no." },
  { t: 'Configurer une interface du routeur (annale)', steps: [
    'interface g0/0/0', 'description LAN S1', 'ip address 172.16.2.1 255.255.255.0', 'ipv6 address fe80::1 link-local', 'ipv6 address 2001:fe:ab:2::1/64', 'no shutdown' ],
    note: "L'ordre des lignes à l'intérieur de l'interface importe peu, mais commencer par entrer dans l'interface et finir par no shutdown est le réflexe." },
  { t: 'Les grandes étapes de l’épreuve', steps: [
    'Câbler (console + Ethernet)', 'Effacer / SDM / reload', 'Configurer S1', 'Configurer R1', 'Configurer PC-A et PC-B', 'Pings + traceroute', 'SSH depuis Linux (laisser ouvert)', 'Commandes show (partie 4)', 'Nettoyage après la correction' ],
    note: "Le nettoyage (erase + delete vlan.dat + ranger) seulement quand le prof a corrigé." },
  { t: 'Configurer la SVI du switch', steps: [
    'configure terminal', 'interface vlan 1', 'description Management', 'ip address 172.16.2.2 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 172.16.2.1' ],
    note: "ip default-gateway se tape en mode global : d'où le exit." },
];

/* ------------------------------------------------------------------
   6. QUESTIONS DES TP (réponses courtes)
   ------------------------------------------------------------------ */
DATA.tpQuestions = [
  { tp: 'TP1', q: 'Pourquoi configurer une adresse IP sur un switch alors qu’il marche sans ?', a: "Pour pouvoir l'administrer à distance (Telnet/SSH, ping de supervision). La commutation, elle, ne dépend que des MAC." },
  { tp: 'TP1', q: 'Pourquoi faut-il « no shutdown » sur l’interface vlan 1 ?', a: "Les interfaces virtuelles (et les interfaces routeur) sont désactivées par défaut." },
  { tp: 'TP1', q: 'enable secret vs enable password ?', a: "secret = chiffré (hash). password = en clair dans la config (sauf service password-encryption, chiffrement faible type 7). Si les deux existent, secret l'emporte." },
  { tp: 'TP1', q: 'Que fait « logging synchronous » ?', a: "Les messages système ne coupent plus la ligne en cours de saisie (ils réaffichent ta commande)." },
  { tp: 'TP2-1', q: 'Que signifie « bia » ?', a: "Burned-In Address : l'adresse MAC gravée en usine dans la carte." },
  { tp: 'TP2-1', q: 'Que sont les 6 premiers caractères hexa d’une MAC ?', a: "L'OUI (Organizationally Unique Identifier) : identifiant du fabricant attribué par l'IEEE. Les 6 derniers = numéro de série." },
  { tp: 'TP2-1', q: 'Adresse MAC de diffusion ?', a: 'FFFF.FFFF.FFFF (ff:ff:ff:ff:ff:ff).' },
  { tp: 'TP2-1', q: 'Comment le switch remplit-il sa table MAC ?', a: "En lisant la MAC SOURCE des trames reçues et en l'associant au port d'arrivée (entrées DYNAMIC, effacées après ~5 min)." },
  { tp: 'TP2-2', q: 'Pourquoi le ping PC-A → PC-B échoue avant la config du routeur ?', a: "Ils sont dans deux réseaux différents : il faut un routeur configuré (interfaces avec IP + no shutdown) et des passerelles sur les PC." },
  { tp: 'TP2-2', q: 'Code des réseaux directement connectés dans show ip route ?', a: "C (connected). L = local (l'adresse de l'interface elle-même, en /32)." },
  { tp: 'TP2-2', q: 'Si G0/0/1 est « administratively down » ?', a: 'interface g0/0/1 → no shutdown.' },
  { tp: 'TP2-2', q: 'Que se passe-t-il si G0/0/1 reçoit 192.168.1.2 (déjà utilisée par le switch) ?', a: "Conflit d'adresse IP : la passerelle des PC (192.168.1.1) n'existe plus, ils ne sortent plus de leur réseau ; message de doublon." },
  { tp: 'TP3-1', q: 'Pourquoi fe80::1 peut-il être sur deux interfaces du même routeur ?', a: "Une link-local n'est valable que sur son lien (jamais routée) : chaque interface est sur un lien différent, pas de conflit." },
  { tp: 'TP3-1', q: 'Pourquoi PC-B reçoit-il le préfixe configuré sur R1 ?', a: "Grâce à ipv6 unicast-routing, R1 rejoint FF02::2 et envoie des RA avec le préfixe : le PC construit sa GUA par SLAAC (préfixe + ID d'interface EUI-64 ou aléatoire)." },
  { tp: 'TP3-1', q: 'ID de sous-réseau de 2001:db8:acad::aaaa:1234/64 ?', a: "Le 4ᵉ hextet : 0000 (2001:db8:acad:0000::). Préfixe global = 2001:db8:acad (/48), subnet ID = 0." },
  { tp: 'TP3-1', q: 'Groupe multicast ajouté quand le routage IPv6 est activé ?', a: 'FF02::2 (tous les routeurs). FF02::1 = tous les nœuds, FF02::1:FFxx:xxxx = sollicited-node.' },
  { tp: 'TP3-2', q: 'Pourquoi SSH plutôt que Telnet ?', a: "Telnet envoie tout en clair (mots de passe compris). SSH chiffre la session et authentifie l'équipement." },
  { tp: 'TP3-2', q: 'Revenir au switch sans fermer la session SSH vers R1 ?', a: 'Ctrl+Maj+6, relâcher, puis x. Entrée sur une ligne vide pour y retourner ; exit pour fermer.' },
];

/* Expressions utiles en anglais dans les énoncés */
DATA.vocab = [
  ['Erase', 'effacer'], ['Reload', 'redémarrer'], ['Startup configuration', 'config de démarrage (NVRAM)'], ['Running configuration', 'config en cours (RAM)'],
  ['Disable DNS lookup', 'désactiver la résolution DNS'], ['Unused interfaces', 'interfaces inutilisées'], ['Management interface (SVI)', 'interface virtuelle de gestion'],
  ['Default gateway', 'passerelle par défaut'], ['Link Local Address (LLA)', 'adresse fe80::'], ['GUA (Global Unicast Address)', 'adresse IPv6 globale 2001:…'],
  ['Privileged EXEC password', 'mot de passe du mode enable (#)'], ['Local database', 'base locale (username)'], ['vty lines', 'lignes virtuelles (Telnet/SSH)'],
  ['Clear text passwords', 'mots de passe en clair'], ['MOTD banner', 'message du jour'], ['Write down', 'note (sur la copie)'],
  ['Take corrective action', 'corrige si ça ne marche pas'], ['Leave it open for the correction', 'laisse la session ouverte pour le prof'], ['Cleanup', 'nettoyage final'],
];
