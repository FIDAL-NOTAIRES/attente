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
// ⚠ Les sources externes (RSS, ESPN) sont NON CONTRACTUELLES : chacune peut
// tomber ou changer sans préavis. Règle : jamais de 500 pour une source en
// panne — on renvoie ce qu'on a, avec un champ `erreurs`, et le front CACHE
// les sections vides. L'écran d'attente est un confort, pas une dépendance.

const DUREES = {                       // s-maxage, stale-while-revalidate (s)
  actus:       { fraiche: 300,    rassise: 3600   },  // 5 min
  classements: { fraiche: 21600,  rassise: 86400  },  // 6 h
  culturel:    { fraiche: 86400,  rassise: 172800 },  // 24 h
  compteurs:   { fraiche: 604800, rassise: 604800 },  // 7 j (bases + taux)
};

// -- petit fetch avec délai de garde : une source lente ne doit pas bloquer --
async function chercher(url, ms = 6000) {
  const garde = new AbortController();
  const minuterie = setTimeout(() => garde.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: garde.signal,
      // ⚠ UA de navigateur : ESPN renvoie 403 aux user-agents maison
      // (constaté au premier déploiement, 31/08/2026). Les flux RSS s'en moquent.
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
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

// -- Classements : ESPN expose un JSON public sans clé. ⚠ Point à VALIDER au
// premier déploiement : l'identifiant Top 14 (repli sur la L1 seule sinon).
function lireClassementESPN(json, max = 8) {
  const racine = JSON.parse(json);
  const grappes = racine.children || [racine];
  for (const g of grappes) {
    const entrees = (g.standings && g.standings.entries) || g.entries;
    if (!entrees || !entrees.length) continue;
    return entrees.slice(0, max).map((e, i) => {
      const stat = (nom) => {
        const s = (e.stats || []).find((x) => x.name === nom || x.type === nom);
        return s ? (s.displayValue ?? s.value) : null;
      };
      return {
        rang: stat("rank") || i + 1,
        equipe: (e.team && (e.team.shortDisplayName || e.team.displayName)) || "?",
        joues: stat("gamesPlayed"),
        points: stat("points"),
      };
    });
  }
  return [];
}
async function classements(erreurs) {
  // EN PARALLÈLE : deux sources lentes en séquence (2 × 6 s de garde)
  // dépasseraient le délai de la fonction serverless.
  const [l1, t14] = await Promise.all([
    chercher("https://site.api.espn.com/apis/v2/sports/soccer/fra.1/standings")
      .then(lireClassementESPN)
      .catch((e) => { erreurs.push("classements/ligue1 : " + e.message); return []; }),
    chercher("https://site.api.espn.com/apis/v2/sports/rugby/270559/standings")
      .then(lireClassementESPN)
      .catch((e) => { erreurs.push("classements/top14 : " + e.message); return []; }),
  ]);
  return { ligue1: l1, top14: t14 };
}

// -- Culturel : premier flux qui répond, dans l'ordre. Cinéma, expos, livres
// vivent très bien à J+1, d'où les 24 h de cache.
async function culturel(erreurs) {
  const candidats = [
    { source: "Le Monde Culture",   url: "https://www.lemonde.fr/culture/rss_full.xml" },
    { source: "franceinfo Culture", url: "https://www.francetvinfo.fr/culture.rss" },
  ];
  for (const c of candidats) {
    try {
      const t = titresRSS(await chercher(c.url), 8);
      if (t.length) return { source: c.source, titres: t };
    } catch (e) { erreurs.push("culturel/" + c.source + " : " + e.message); }
  }
  return { source: null, titres: [] };
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
