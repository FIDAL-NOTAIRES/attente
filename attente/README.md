# ATTENTE — écran d'attente riche (FIDAL Notaires)

Module partagé pour les attentes de plusieurs minutes (PAINT et les autres
outils). Héritier du « voile de production » de PAINT (01/08/2026), généralisé
en dépôt autonome (décisions du 29/08/2026, réalisation du 31/08/2026).

## Structure

- `attente.js` — LE module. Un seul script à charger depuis l'outil hôte ;
  il injecte son CSS, construit le voile, et trouve son API tout seul
  (même domaine que le script, rien en dur).
- `api/veille.js` — route unique `?type=actus|classements|culturel|compteurs`,
  **une durée de cache CDN par type** (5 min / 6 h / 24 h / 7 j), toutes avec
  `stale-while-revalidate` : l'écran ne paie jamais un refetch.
- `data/compteurs.json` — bases et taux des compteurs population/dette
  (9 pays). Le client extrapole ; mettre à jour bases + `reference` à chaque
  publication d'institut.
- `index.html` — démonstration/test : simule une génération « i sur 30 ».

## Déploiement

Habitude cabinet : téléverser ces fichiers à la racine du dépôt GitHub
`FIDAL-NOTAIRES/attente` → New Project sur Vercel → Deploy. Aucune dépendance
npm (fetch natif Node 18+).

## Intégration (PAINT et autres)

```html
<script src="https://ATTENTE_DOMAINE/attente.js?v=1"></script>
<script>
  ATTENTE.demarrer({ titre: "Dossier complet", source: "#spinmsg" });
  // …traitement… puis :
  ATTENTE.terminer();      // barre verte, radio coupée, retrait
  // ou, sur incident :
  ATTENTE.echec("message"); // bandeau carmin PAR-DESSUS, le contenu continue
</script>
```

`source` : sélecteur (ou fonction) relu toutes les 400 ms ; « 12 sur 30 »,
« 12/30 » et « 43 % » sont reconnus (motif PAINT, zéro instrumentation des
boucles). Sans source : piloter avec `ATTENTE.progression(pct, phase)`.
`trame` : SVG du parcellaire réel à coloriser ; sinon trame générique.
Seule l'URL du SCRIPT est versionnée (`?v=1`) — les données, elles, vivent
par leurs durées de cache (décision du 29/08/2026).

## À VALIDER au premier déploiement (sources non contractuelles)

1. **Top 14** : l'identifiant ESPN (`rugby/270559`) est à confirmer — en cas
   d'échec la carte n'affiche que la Ligue 1, sans erreur visible.
2. **Flux RSS** (franceinfo `titres.rss`, Le Monde `une.xml` et
   `culture/rss_full.xml`) : vérifier `/api/veille?type=actus` et `=culturel`
   dans le navigateur — le champ `erreurs` dit ce qui n'a pas répondu.
3. **Radios** : Radio Classique (Infomaniak) est éprouvée dans PAINT ; les
   trois flux Radio France (icecast) sont à essayer d'un clic. Un flux muet
   6 s = bouton éteint, rien de cassé.
4. **Compteurs** : chiffres indicatifs mi-2026 dans `data/compteurs.json`,
   à rafraîchir de temps en temps.
