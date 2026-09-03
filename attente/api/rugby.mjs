/* ============================================================
   ATTENTE — classement Top 14
   Fichier : attente/api/rugby.mjs
   Route    : /api/rugby

   Source : fr.wikipedia.org, API MediaWiki (action=parse).
   Ni clé, ni quota, ni palier payant. API-Sports est abandonné
   pour cet usage : son palier gratuit n'ouvre que 2022 à 2024.

   Paramètres :
     /api/rugby            classement normalisé
     /api/rugby?n=8        limite le nombre de rangs
     /api/rugby?brut=1     entête détecté + lignes crues, pour inspection

   Extension .mjs volontaire : garantit le mode module ES.
   Aucune dépendance npm. fetch natif.
   ============================================================ */

const API = 'https://fr.wikipedia.org/w/api.php';

/* Wikimedia exige un User-Agent descriptif : sans lui, les requêtes
   peuvent être refusées. */
const UA = 'FIDAL-Notaires-ATTENTE/1.0 (outil interne de cabinet notarial)';

const CACHE_MS = 6 * 3600 * 1000;
let cache = null;   /* { charge, expire } */

/* ---------- saison ---------- */
/* Le Top 14 démarre en septembre : avant août, on est encore sur
   la saison ouverte l'année précédente. */
function saisonCourante(d = new Date()) {
  const a = d.getFullYear();
  return d.getMonth() >= 7 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

function saisonPrecedente(s) {
  const [a] = s.split('-').map(Number);
  return `${a - 1}-${a}`;
}

function titrePage(saison) {
  return `Championnat de France de rugby à XV ${saison}`;
}

/* ---------- extraction HTML sans dépendance ---------- */
function decoder(s) {
  return s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

/* les <sup> portent les appels de note et le « T » du tenant du titre */
function texte(html) {
  return decoder(
    html
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

/* scanner conscient de l'imbrication : un tableau wiki peut en contenir un autre */
function tableaux(html) {
  const res = [];
  const re = /<table\b[^>]*>|<\/table\s*>/gi;
  let m, prof = 0, debut = -1;
  while ((m = re.exec(html))) {
    if (m[0][1] !== '/') {
      if (prof === 0) debut = m.index;
      prof++;
    } else {
      prof--;
      if (prof === 0 && debut >= 0) {
        res.push(html.slice(debut, m.index + m[0].length));
        debut = -1;
      }
    }
  }
  return res;
}

function lignes(tableHtml) {
  const trs = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr\s*>/gi) || [];
  return trs.map(tr =>
    (tr.match(/<(t[hd])\b[^>]*>[\s\S]*?<\/\1\s*>/gi) || []).map(texte)
  );
}

/* Repérage par signature d'entête plutôt que par position : l'ordre des
   tableaux dans la page bouge au fil des mises à jour, l'entête non. */
function trouverClassement(htmlPage) {
  for (const tb of tableaux(htmlPage)) {
    const rows = lignes(tb);
    const iEntete = rows.findIndex(r =>
      r.includes('Rang') && r.includes('Club') && r.includes('Pts')
    );
    if (iEntete >= 0) return { entete: rows[iEntete], corps: rows.slice(iEntete + 1) };
  }
  return null;
}

function entier(v) {
  const n = parseInt(String(v).replace(/[^\d+-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function normaliser(entete, corps, combien) {
  const col = nom => entete.indexOf(nom);
  const iClub = col('Club'), iPts = col('Pts');
  const iJ = col('J'), iV = col('V'), iN = col('N'), iD = col('D'), iDiff = col('Diff');

  const out = [];
  for (const c of corps) {
    if (c.length <= iPts || !c[iClub]) continue;
    const rang = entier(c[0]);
    if (rang === null) continue;             /* ligne de légende ou de séparation */
    out.push({
      rang,
      equipe: c[iClub],
      joues: iJ >= 0 ? entier(c[iJ]) : null,
      gagnes: iV >= 0 ? entier(c[iV]) : null,
      nuls: iN >= 0 ? entier(c[iN]) : null,
      perdus: iD >= 0 ? entier(c[iD]) : null,
      difference: iDiff >= 0 ? entier(c[iDiff]) : null,
      points: entier(c[iPts])
    });
  }
  return combien ? out.slice(0, combien) : out;
}

async function pageWiki(saison) {
  const u = API
    + '?action=parse&format=json&formatversion=2&prop=text&redirects=1&page='
    + encodeURIComponent(titrePage(saison));

  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('MediaWiki : HTTP ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('MediaWiki : ' + (j.error.info || j.error.code));
  return (j.parse && j.parse.text) || '';
}

/* ---------- route ---------- */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const brut = url.searchParams.get('brut') === '1';
  const combien = url.searchParams.get('n') ? Number(url.searchParams.get('n')) : null;

  try {
    if (!brut && cache && cache.expire > Date.now()) {
      res.setHeader('X-Att-Cache', 'hit');
      res.status(200).json(cache.charge);
      return;
    }

    /* si la page de la saison en cours n'est pas encore montée,
       on retombe sur la précédente plutôt que de ne rien afficher */
    let saison = saisonCourante();
    let trouve = trouverClassement(await pageWiki(saison));
    let repli = false;

    if (!trouve) {
      saison = saisonPrecedente(saison);
      trouve = trouverClassement(await pageWiki(saison));
      repli = true;
    }
    if (!trouve) throw new Error('Tableau de classement introuvable dans la page');

    if (brut) {
      res.status(200).json({ saison, repli, entete: trouve.entete, lignes: trouve.corps.slice(0, 4) });
      return;
    }

    const classement = normaliser(trouve.entete, trouve.corps, combien);
    const journee = classement.reduce((m, l) => Math.max(m, l.joues || 0), 0);

    const charge = {
      competition: 'Top 14',
      saison,
      journee,
      demarree: journee > 0,
      saisonDeRepli: repli,
      source: 'fr.wikipedia.org',
      classement,
      maj: new Date().toISOString()
    };

    cache = { charge, expire: Date.now() + CACHE_MS };

    res.setHeader('X-Att-Cache', 'miss');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json(charge);

  } catch (e) {
    res.status(502).json({ erreur: String(e.message || e) });
  }
}
