// ATTENTE — /api/veille : route UNIQUE du module d'écran d'attente.
// Un seul fichier, mais UNE ENTRÉE DE CACHE PAR TYPE : le CDN Vercel cache par
// URL complète (querystring incluse), donc /api/veille?type=actus et
// /api/veille?type=classements vivent chacun leur vie avec leur propre
// s-maxage. C'est ce qui permet « une durée de cache par type de contenu »
// (décision du 29/08/2026) sans multiplier les fonctions serverless.
//
// stale-while-revalidate PARTOUT : un écran d'attente ne doit JAMAIS payer
// l'attente d'un refetch — le CDN sert l'ancien contenu et se rafraîchit
// derrière. Les radios n'ont pas de type : leurs adresses de flux sont en dur
// dans attente.js, aucun appel serveur.
//
// ⚠ Les sources externes (RSS, API de scores) sont NON CONTRACTUELLES :
// chacune peut tomber ou changer sans préavis. Règle : jamais de 500 pour une
// source en panne — on renvoie ce qu'on a, avec un champ `erreurs`, et le
// front CACHE les sections vides. L'écran d'attente est un confort, pas une
// dépendance.
//
// ── v1.3 (02/09/2026) ────────────────────────────────────────────────────
// • culturel renvoie désormais TROIS rubriques séparées — `cinema`, `expos`,
//   `livres` — au lieu d'un `titres` global : la carte du front (bande de
//   pellicule) affiche un photogramme par rubrique, on distingue enfin les
//   sorties de films des sorties de livres. Repli conservé : si aucune des
//   trois ne répond, on retombe sur le flux Culture global en `titres`, que le
//   front sait afficher en une rubrique unique.
// • classements renvoie `journee` (season.currentMatchday) et `competition`,
//   affichés dans l'en-tête du panneau de stade.

const DUREES = {                       // s-maxage, stale-while-revalidate (s)
  actus:       { fraiche: 300,    rassise: 3600   },  // 5 min
  classements: { fraiche: 21600,  rassise: 86400  },  // 6 h
  culturel:    { fraiche: 86400,  rassise: 172800 },  // 24 h
  compteurs:   { fraiche: 604800, rassise: 604800 },  // 7 j (bases + taux)
};

// -- petit fetch avec délai de garde : une source lente ne doit pas bloquer --
async function chercher(url, ms = 6000, entetes = {}) {
  const garde = new AbortController();
  const minuterie = setTimeout(() => garde.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: garde.signal,
      // ⚠ UA de navigateur : ESPN renvoyait 403 aux user-agents maison
      // (constaté au premier déploiement, 31/08/2026). Les flux RSS s'en moquent.
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
        ...entetes,
      },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(minuterie);
  }
}

// -- entités HTML : les nommées courantes + TOUTES les numériques (&#xE0; /
// &#224;) — franceinfo encode ainsi chaque accent (constaté au premier
// déploiement). &amp; en DERNIER, sinon &amp;#233; se décode deux fois.
function decoderEntites(t) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&");
}

// -- RSS sans dépendance : extraction <item><title> à la regex, CDATA compris.
// Suffisant pour des titres ; on ne parse pas du XML arbitraire, on lit des
// flux de presse au format stable depuis vingt ans.
function titresRSS(xml, max = 12) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  const titres = [];
  for (const it of items.slice(0, max)) {
    const m = it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    if (m && m[1]) {
      titres.push(decoderEntites(m[1]).replace(/\s+/g, " ").trim());
    }
  }
  return titres;
}

// -- Actus : franceinfo + Le Monde, fusionnés en alternance pour le bandeau --
async function actus(erreurs) {
  const flux = [
    { source: "franceinfo", url: "https://www.francetvinfo.fr/titres.rss" },
    { source: "Le Monde",   url: "https://www.lemonde.fr/rss/une.xml" },
  ];
  const listes = await Promise.all(
    flux.map(async (f) => {
      try { return titresRSS(await chercher(f.url)).map((t) => ({ s: f.source, t })); }
      catch (e) { erreurs.push("actus/" + f.source + " : " + e.message); return []; }
    })
  );
  const alterne = [];
  for (let i = 0; i < Math.max(listes[0].length, listes[1].length); i++) {
    if (listes[0][i]) alterne.push(listes[0][i]);
    if (listes[1][i]) alterne.push(listes[1][i]);
  }
  return alterne.slice(0, 18);
}

// -- Classements : football-data.org (ESPN abandonné le 31/08/2026 : 403 sur
// les IP de datacenter, quel que soit l'habillage). Clé gratuite dans la
// variable d'environnement FOOTBALL_DATA_CLE (Secret Vercel, comme
// DATABASE_URL sur MATRICE). Offre gratuite : la Ligue 1 (FL1) y est ; le
// Top 14 attend un compte API-Sports, la carte du front n'affiche que ce qui
// existe. Quota 10 req/min : avec 6 h de cache CDN on fait ~4 appels/jour.
async function classements(erreurs) {
  const resultat = { competition: "Ligue 1", journee: null, ligue1: [], top14: [] };
  const cle = process.env.FOOTBALL_DATA_CLE;
  if (!cle) { erreurs.push("classements : FOOTBALL_DATA_CLE absente des variables d'environnement"); return resultat; }
  try {
    const brut = await chercher("https://api.football-data.org/v4/competitions/FL1/standings", 6000,
      { "X-Auth-Token": cle });
    const racine = JSON.parse(brut);
    if (racine.competition && racine.competition.name) resultat.competition = racine.competition.name;
    if (racine.season && racine.season.currentMatchday) resultat.journee = racine.season.currentMatchday;
    const table = ((racine.standings || []).find((s) => s.type === "TOTAL") || (racine.standings || [])[0] || {}).table || [];
    resultat.ligue1 = table.slice(0, 8).map((l) => ({
      rang: l.position,
      equipe: (l.team && (l.team.shortName || l.team.name)) || "?",
      joues: l.playedGames,
      points: l.points,
    }));
  } catch (e) { erreurs.push("classements/ligue1 : " + e.message); }
  return resultat;
}

/* -- Culturel : TROIS rubriques distinctes (v1.3). Le Monde expose un flux par
   rubrique sur le motif /<rubrique>/rss_full.xml ; franceinfo sert de doublure.
   Chaque rubrique essaie ses candidats DANS L'ORDRE et s'arrête au premier qui
   répond. Les trois rubriques partent en parallèle.

   ⚠ Délai de garde ramené à 3,5 s ici : trois rubriques × deux candidats en
   séquence, il faut rester sous la limite d'exécution de la fonction. Une
   rubrique qui expire est simplement absente — avec 24 h de cache et
   stale-while-revalidate, personne ne le voit.

   ⚠ Repli global : si AUCUNE des trois ne rapporte quoi que ce soit, on
   interroge le flux Culture généraliste et on le renvoie en `titres`. Le front
   sait afficher ce cas en une rubrique unique « À l'affiche » plutôt que de
   masquer la carte. */
const RUBRIQUES = [
  { clef: "cinema", candidats: [
    { source: "Le Monde Cinéma",   url: "https://www.lemonde.fr/cinema/rss_full.xml" },
    { source: "franceinfo Cinéma", url: "https://www.francetvinfo.fr/culture/cinema.rss" },
  ]},
  { clef: "expos", candidats: [
    { source: "Le Monde Arts",         url: "https://www.lemonde.fr/arts/rss_full.xml" },
    { source: "franceinfo Arts-expos", url: "https://www.francetvinfo.fr/culture/arts-expos.rss" },
  ]},
  { clef: "livres", candidats: [
    { source: "Le Monde Livres",   url: "https://www.lemonde.fr/livres/rss_full.xml" },
    { source: "franceinfo Livres", url: "https://www.francetvinfo.fr/culture/livres.rss" },
  ]},
];

async function culturel(erreurs) {
  const sorties = { cinema: [], expos: [], livres: [], sources: {} };

  await Promise.all(RUBRIQUES.map(async (r) => {
    for (const c of r.candidats) {
      try {
        const t = titresRSS(await chercher(c.url, 3500), 6);
        if (t.length) {
          sorties[r.clef] = t.slice(0, 4);
          sorties.sources[r.clef] = c.source;
          return;
        }
      } catch (e) {
        erreurs.push("culturel/" + r.clef + "/" + c.source + " : " + e.message);
      }
    }
  }));

  if (sorties.cinema.length || sorties.expos.length || sorties.livres.length) return sorties;

  // Repli : le flux Culture généraliste, comme en v1.2.
  const globaux = [
    { source: "Le Monde Culture",   url: "https://www.lemonde.fr/culture/rss_full.xml" },
    { source: "franceinfo Culture", url: "https://www.francetvinfo.fr/culture.rss" },
  ];
  for (const g of globaux) {
    try {
      const t = titresRSS(await chercher(g.url, 3500), 8);
      if (t.length) return { source: g.source, titres: t, cinema: [], expos: [], livres: [] };
    } catch (e) { erreurs.push("culturel/repli/" + g.source + " : " + e.message); }
  }
  return { source: null, titres: [], cinema: [], expos: [], livres: [] };
}

// -- Compteurs : bases + taux par seconde, fichier statique du dépôt. Le
// client extrapole (base + taux × secondes écoulées) : la base ne bouge qu'à
// chaque publication d'institut, d'où les 7 jours — et zéro source externe.
const COMPTEURS = require("../data/compteurs.json");

module.exports = async (req, res) => {
  // CORS ouvert : le module est consommé depuis PAINT et les autres outils,
  // chacun sur son propre domaine vercel.app.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const type = (req.query && req.query.type) || "";
  const duree = DUREES[type];
  if (!duree) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      erreur: "type inconnu",
      types: Object.keys(DUREES),
      note: "les radios sont en dur dans attente.js, sans appel serveur",
    });
  }

  const erreurs = [];
  let donnees;
  try {
    if (type === "actus")            donnees = { titres: await actus(erreurs) };
    else if (type === "classements") donnees = await classements(erreurs);
    else if (type === "culturel")    donnees = await culturel(erreurs);
    else if (type === "compteurs")   donnees = COMPTEURS;
  } catch (e) {
    erreurs.push(type + " : " + e.message);
    donnees = {};
  }

  // Une réponse partielle se cache quand même : mieux vaut resservir un
  // bandeau à une seule source pendant 5 min que marteler une source en panne.
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=" + duree.fraiche + ", stale-while-revalidate=" + duree.rassise
  );
  res.status(200).json({ type, maj: new Date().toISOString(), erreurs, ...donnees });
};
