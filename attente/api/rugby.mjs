/* ============================================================
   ATTENTE — classement Top 14 via API-Sports
   Fichier : attente/api/rugby.mjs
   Route    : /api/rugby

   Extension .mjs volontaire : elle garantit le mode module ES
   quel que soit le contenu de package.json.

   Variable d'environnement : API_SPORTS_CLE
   Palier Free : 100 requêtes/jour — le cache 6 h en consomme 4 à 8.

   Paramètres :
     /api/rugby            classement normalisé, 8 rangs
     /api/rugby?n=6        6 rangs
     /api/rugby?brut=1     réponse API telle quelle, pour inspection
     /api/rugby?ligue=1    résultat de la résolution de ligue seule

   Aucune dépendance npm. fetch natif.
   ============================================================ */

const HOTE = 'https://v1.rugby.api-sports.io';
const CACHE_MS = 6 * 3600 * 1000;        /* 6 h, aligné sur les classements Ligue 1 */
const LIGUE_CACHE_MS = 24 * 3600 * 1000;

let cacheLigue = null;      /* { id, nom, saison, expire } */
let cacheClass = null;      /* { charge, expire } */
let quota = null;           /* dernier reste de quota vu */

async function appel(chemin, cle) {
  const r = await fetch(HOTE + chemin, { headers: { 'x-apisports-key': cle } });

  const reste = r.headers.get('x-ratelimit-requests-remaining');
  if (reste !== null) quota = Number(reste);

  if (!r.ok) throw new Error('API-Sports rugby : HTTP ' + r.status);

  const j = await r.json();
  const err = j && j.errors;
  const aErreur = Array.isArray(err)
    ? err.length > 0
    : (err && typeof err === 'object') ? Object.keys(err).length > 0 : false;
  if (aErreur) throw new Error('API-Sports rugby : ' + JSON.stringify(err));

  return j.response || [];
}

/* La ligue et la saison sont résolues à l'exécution plutôt que codées en
   dur : un identifiant deviné serait une source de panne silencieuse. */
async function resoudreTop14(cle) {
  if (cacheLigue && cacheLigue.expire > Date.now()) return cacheLigue;

  const rep = await appel('/leagues?search=' + encodeURIComponent('Top 14'), cle);

  const ligue = rep.find(l =>
      l && l.name && /top\s*14/i.test(l.name) &&
      (!l.country || !l.country.name || /france/i.test(l.country.name))
    ) || rep[0];

  if (!ligue) throw new Error('Top 14 introuvable dans /leagues');

  const saisons = ligue.seasons || [];
  const courante = saisons.find(s => s && s.current) || saisons[saisons.length - 1];
  const saison = courante
    ? (courante.season !== undefined ? courante.season : courante.year)
    : new Date().getFullYear();

  cacheLigue = {
    id: ligue.id,
    nom: ligue.name || 'Top 14',
    saison,
    expire: Date.now() + LIGUE_CACHE_MS
  };
  return cacheLigue;
}

/* Le format exact des lignes n'a pas pu être vérifié dans la documentation :
   la normalisation essaie plusieurs noms de champs au lieu d'en supposer un.
   Le mode brut permet de figer la bonne variante en une seule requête. */
function premierNombre(...vals) {
  for (const v of vals) if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return null;
}

function normaliser(l, i) {
  const g = l.games || l.all || {};
  const tot = x => (x && typeof x === 'object' ? x.total : x);

  return {
    rang: premierNombre(l.position, l.rank, i + 1),
    equipe: (l.team && (l.team.name || l.team.nom)) || l.name || '—',
    logo: (l.team && l.team.logo) || null,
    points: premierNombre(l.points, l.points && l.points.total, l.pts, l.point),
    joues: premierNombre(tot(g.played), l.played),
    gagnes: premierNombre(tot(g.win)),
    nuls: premierNombre(tot(g.draw), tot(g.drawn)),
    perdus: premierNombre(tot(g.lose), tot(g.lost)),
    difference: premierNombre(
      l.pointsDiff, l.goalsDiff, l.diff,
      l.points && typeof l.points === 'object' ? l.points.for - l.points.against : undefined
    )
  };
}

export default async function handler(req, res) {
  const cle = process.env.API_SPORTS_CLE;

  if (!cle) {
    res.status(500).json({
      erreur: 'API_SPORTS_CLE absente des variables d’environnement Vercel',
      indice: 'Settings → Environment Variables sur le projet attente, puis redéployer'
    });
    return;
  }

  const url = new URL(req.url, 'http://x');
  const brut = url.searchParams.get('brut') === '1';
  const ligueSeule = url.searchParams.get('ligue') === '1';
  const combien = Math.min(20, Math.max(1, Number(url.searchParams.get('n')) || 8));

  try {
    if (ligueSeule) {
      const l = await resoudreTop14(cle);
      res.status(200).json({ ligue: l.id, nom: l.nom, saison: l.saison, quota });
      return;
    }

    if (brut) {
      const { id, saison } = await resoudreTop14(cle);
      const rep = await appel('/standings?league=' + id + '&season=' + saison, cle);
      res.status(200).json({ ligue: id, saison, quota, reponse: rep });
      return;
    }

    if (cacheClass && cacheClass.expire > Date.now()) {
      res.setHeader('X-Att-Cache', 'hit');
      res.status(200).json(cacheClass.charge);
      return;
    }

    const { id, saison, nom } = await resoudreTop14(cle);
    const rep = await appel('/standings?league=' + id + '&season=' + saison, cle);

    /* l'API renvoie généralement un tableau de groupes : [[ligne, ligne, …]] */
    const table = Array.isArray(rep[0]) ? rep[0] : rep;

    const charge = {
      competition: nom,
      saison,
      journee: null,          /* /standings ne porte pas la journée */
      classement: table.map(normaliser).slice(0, combien),
      maj: new Date().toISOString()
    };

    cacheClass = { charge, expire: Date.now() + CACHE_MS };

    res.setHeader('X-Att-Cache', 'miss');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json(charge);

  } catch (e) {
    res.status(502).json({ erreur: String(e.message || e), quota });
  }
}
