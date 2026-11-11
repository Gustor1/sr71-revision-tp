# SR71 · Révision TP machine

Site de révision pour l'évaluation de TP réseaux SR71 (Cisco CCNA 1) sur machine :
PC hôte Ubuntu (PuTTY → console), PC-A VM Windows 8, PC-B VM Linux, switch Catalyst 2960, routeur ISR 4321.

**En ligne :** https://gustor1.github.io/sr71-revision-tp/

## Contenu

| Onglet | À quoi ça sert |
|---|---|
| Annale corrigée | Le sujet tâche par tâche : commande exacte, mode, pièges. Mode « masquer les réponses ». |
| Fiche A4 | Recto-verso imprimable (séquence de l'annale + énoncé → commande, dépannage, bonus). |
| Commandes | Commandes par machine : hôte, PC-A, PC-B, switch, routeur, TP avancés. |
| Énoncé → commande | Traduction des formulations anglaises de l'énoncé en commandes. |
| Simulateur IOS | Console pédagogique (abréviations, `?`, Tab, erreurs réalistes) avec missions auto-corrigées. |
| Câblage | Câbler les topologies des TP (droit / croisé / console, bons ports). |
| Exercices | Énoncé → commande, modes, dépannage, ordre des commandes, sous-réseaux, questions des TP. |
| Examen blanc | Sujet aléatoire au format de l'annale + chrono + correction complète. |

## Utilisation locale

Aucun build : ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python -m http.server 8731
```

Les scores et la checklist sont stockés uniquement dans le navigateur (localStorage).

Le simulateur est pédagogique : il couvre les commandes des TP, pas tout Cisco IOS.
