/* ATTENTE — écran d'attente riche des outils FIDAL Notaires. Module UNIQUE :
   un <script src="https://<projet-attente>.vercel.app/attente.js?v=1"></script>
   et l'outil appelle ATTENTE.demarrer(...) / ATTENTE.terminer().

   Héritier direct du « voile de production » de PAINT (01/08/2026) : même
   principe de suivi du sablier SANS instrumenter les boucles (on relit un
   message de progression toutes les 400 ms), même gestion de l'autoplay audio.
   Généralisé ici : bandeau d'actualités, classements L1/Top 14, rubrique
   culturelle, compteurs population/dette, 4 radios, trame parcellaire SVG qui
   se colorise au rythme de la génération.

   ⚠ Toutes les animations vivent sur le compositeur (transform/opacity) :
   coût nul sur le traitement qui tourne derrière. Un onglet qui joue de
   l'audio est exempté de l'étranglement des minuteries en arrière-plan par
   Chrome — la radio n'est pas qu'un agrément, elle protège la cadence des
   traitements longs (constat PAINT, 01/08).

   ⚠ Les données viennent de /api/veille?type=… sur le MÊME domaine que ce
   script (déduit de currentScript.src) : aucun domaine en dur, le module
   suit son déploiement. Chaque type a sa durée de cache côté CDN ; ici on ne
   rafraîchit que les actus (5 min), le reste vit le temps du voile.

   API :
     ATTENTE.demarrer({
       titre:    "Dossier complet",          // Georgia, gros
       sousTitre:"PAINT — extraits officiels",// facultatif
       source:   "#spinmsg",                  // sélecteur OU fonction () => texte
                                              // lu toutes les 400 ms ; « i sur N »
                                              // et « 43 % » y sont reconnus
       trame:    "<svg…>",                    // facultatif : parcellaire réel ;
                                              // sinon trame générique intégrée
     })
     ATTENTE.progression(pct, phase)          // pilotage manuel si pas de source
     ATTENTE.echec("message")                 // bandeau carmin PAR-DESSUS le
                                              // contenu qui continue de tourner
     ATTENTE.terminer()                       // barre verte, radio coupée, retrait
*/
(function () {
  "use strict";
  if (window.ATTENTE) return; // déjà chargé

  const SCRIPT = document.currentScript;
  const BASE = SCRIPT && SCRIPT.src ? new URL(SCRIPT.src).origin : "";

  /* ---------- charte FIDAL v2.2 ---------- */
  const C = {
    nuit: "#0F2238", canard: "#33838B", orange: "#FF982D",
    carmin: "#A01040", cyan: "#6DD5DC", jauneForme: "#FFE764",
    vert: "#4caf7d", encre: "#e8eef5", sourdine: "#8fa5bb", ligne: "rgba(255,255,255,.14)",
  };

  const CSS = `
#att-voile{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;align-items:center;
  background:${C.nuit};color:${C.encre};font:14px/1.45 "Segoe UI",system-ui,sans-serif;overflow:hidden}
#att-voile.on{display:flex}
#att-voile *{box-sizing:border-box}
#att-voile .att-haut{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 20px 6px;text-align:center}
#att-voile .att-logo{font-size:14px;letter-spacing:5px;color:${C.cyan};font-weight:600}
#att-voile .att-titre{font-family:Georgia,serif;font-size:32px;font-weight:700;letter-spacing:.5px}
#att-voile .att-sous{font-size:14px;color:${C.sourdine};margin-top:-6px}
#att-voile .att-phase{font-size:15px;min-height:22px;color:${C.encre}}
#att-voile .att-barre{width:min(520px,80vw);height:8px;border-radius:99px;background:${C.ligne};overflow:hidden}
#att-voile .att-barre>div{height:100%;width:0%;background:${C.canard};border-radius:99px;transition:width .6s ease}
#att-voile.fin .att-barre>div{background:${C.vert}}
#att-voile .att-compte{font-size:12.5px;color:${C.sourdine};min-height:16px}
#att-voile .att-trame{width:min(880px,92vw);flex:1 1 auto;min-height:120px;max-height:38vh;display:flex;align-items:center;justify-content:center}
#att-voile .att-trame svg{width:100%;height:100%}
#att-voile .att-parc{fill:${C.cyan};fill-opacity:0;stroke:${C.canard};stroke-opacity:.55;stroke-width:1.5;transition:fill-opacity .8s ease}
#att-voile .att-parc.faite{fill-opacity:.8}
#att-voile .att-cartes{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;padding:6px 18px;max-width:1100px}
#att-voile .att-carte{background:rgba(255,255,255,.05);border:1px solid ${C.ligne};border-radius:10px;
  padding:12px 16px;min-width:230px;max-width:330px;display:none}
#att-voile .att-carte.on{display:block}
#att-voile .att-carte h3{font-family:Georgia,serif;font-size:15px;font-weight:700;margin:0 0 8px;color:${C.cyan}}
#att-voile .att-carte table{border-collapse:collapse;width:100%;font-size:12.5px}
#att-voile .att-carte td{padding:1.5px 6px 1.5px 0;color:${C.encre};white-space:nowrap}
#att-voile .att-carte td.r{text-align:right;color:${C.sourdine}}
#att-voile .att-carte ul{margin:0;padding:0;list-style:none;font-size:12.5px}
#att-voile .att-carte li{padding:2.5px 0;border-bottom:1px dotted rgba(255,255,255,.12)}
#att-voile .att-carte li:last-child{border-bottom:0}
#att-voile .att-onglets{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
#att-voile .att-onglets button{background:none;border:1px solid ${C.ligne};color:${C.sourdine};border-radius:99px;
  padding:2px 10px;font:12px "Segoe UI",sans-serif;cursor:pointer}
#att-voile .att-onglets button.on{border-color:${C.canard};color:${C.encre};background:rgba(51,131,139,.25)}
#att-voile .att-od{display:flex;align-items:baseline;gap:8px;margin:4px 0}
#att-voile .att-od .att-od-lib{font-size:12px;color:${C.sourdine};width:82px}
#att-voile .att-od .att-od-val{display:flex;overflow:hidden;height:1.25em;font:600 17px/1.25 "Segoe UI",sans-serif;
  font-variant-numeric:tabular-nums;color:${C.jauneForme}}
#att-voile .att-od .att-od-val.dette{color:${C.orange}}
#att-voile .att-od-col{position:relative;width:.62em;height:1.25em}
#att-voile .att-od-strip{position:absolute;left:0;top:0;display:flex;flex-direction:column;
  transition:transform .55s cubic-bezier(.3,.7,.3,1);will-change:transform}
#att-voile .att-od-strip span{height:1.25em;text-align:center}
#att-voile .att-od-sep{width:.3em}
#att-voile .att-radio{display:flex;align-items:center;gap:8px;padding:4px 0 8px;flex-wrap:wrap;justify-content:center}
#att-voile .att-radio button{background:none;border:1px solid ${C.ligne};color:${C.sourdine};border-radius:99px;
  padding:3px 12px;font:12.5px "Segoe UI",sans-serif;cursor:pointer}
#att-voile .att-radio button.on{border-color:${C.orange};color:${C.orange}}
#att-voile .att-bandeau{width:100%;border-top:1px solid ${C.ligne};background:rgba(0,0,0,.25);
  overflow:hidden;white-space:nowrap;padding:8px 0;display:none}
#att-voile .att-bandeau.on{display:block}
#att-voile .att-bandeau-int{display:inline-block;padding-left:100vw;
  animation:att-defile var(--att-dur,90s) linear infinite;will-change:transform}
#att-voile .att-bandeau b{color:${C.cyan};font-weight:600;margin:0 10px 0 26px}
@keyframes att-defile{to{transform:translateX(-100%)}}
#att-echec{position:absolute;top:0;left:0;right:0;z-index:3;display:none;align-items:center;gap:14px;
  background:${C.carmin};color:#fff;padding:10px 18px;font-size:14px}
#att-echec.on{display:flex}
#att-echec button{margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);
  color:#fff;border-radius:6px;padding:4px 12px;cursor:pointer;font:13px "Segoe UI",sans-serif}
@media (prefers-reduced-motion: reduce){
  #att-voile .att-bandeau-int{animation:none}
  #att-voile .att-od-strip{transition:none}
  #att-voile .att-parc{transition:none}
}`;

  /* ---------- radios : adresses de flux EN DUR, aucun appel à /api/veille.
     ⚠ NON CONTRACTUELLES (constat PAINT sur Radio Classique) : un flux qui ne
     démarre pas en 6 s est réputé mort, le bouton s'éteint, on n'insiste pas. */
  const RADIOS = [
    { nom: "Radio Classique", url: "https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3" },
    { nom: "FIP",             url: "https://icecast.radiofrance.fr/fip-midfi.mp3" },
    { nom: "franceinfo",      url: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3" },
    { nom: "France Musique",  url: "https://icecast.radiofrance.fr/francemusique-midfi.mp3" },
  ];

  /* ---------- état du module ---------- */
  const E = {
    on: false, minuterie: null, actusMinuterie: null, compteursMinuterie: null,
    source: null, parcelles: [], faites: 0, audio: null, radioNom: null,
    compteurs: null, paysCourant: 0, odPop: null, odDette: null,
  };
  const $ = (id) => document.getElementById(id);

  /* ---------- construction du voile (une seule fois) ---------- */
  function construire() {
    if ($("att-voile")) return;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const v = document.createElement("div");
    v.id = "att-voile";
    v.innerHTML = `
  <div id="att-echec"><span id="att-echec-msg"></span><button id="att-echec-fermer">Masquer l'écran d'attente</button></div>
  <div class="att-haut">
    <div class="att-logo">FIDAL NOTAIRES</div>
    <div class="att-titre" id="att-titre">Génération en cours</div>
    <div class="att-sous" id="att-sous"></div>
    <div class="att-phase" id="att-phase">Préparation…</div>
    <div class="att-barre"><div id="att-barre-int"></div></div>
    <div class="att-compte" id="att-compte"></div>
  </div>
  <div class="att-trame" id="att-trame"></div>
  <div class="att-cartes">
    <div class="att-carte" id="att-c-classements"><h3 id="att-c-classements-t">Ligue 1</h3>
      <div class="att-onglets" id="att-c-classements-o"></div><table><tbody id="att-c-classements-b"></tbody></table></div>
    <div class="att-carte" id="att-c-culturel"><h3>Culture</h3><ul id="att-c-culturel-l"></ul></div>
    <div class="att-carte" id="att-c-compteurs"><h3>Pendant ce temps, dans le monde</h3>
      <div class="att-onglets" id="att-c-pays"></div>
      <div class="att-od"><span class="att-od-lib">Population</span><span class="att-od-val" id="att-od-pop"></span></div>
      <div class="att-od"><span class="att-od-lib">Dette publique</span><span class="att-od-val dette" id="att-od-dette"></span></div>
    </div>
  </div>
  <div class="att-radio" id="att-radio"><span style="color:${C.sourdine};font-size:12.5px">♪</span></div>
  <div class="att-bandeau" id="att-bandeau"><div class="att-bandeau-int" id="att-bandeau-int"></div></div>`;
    document.body.appendChild(v);
    $("att-echec-fermer").onclick = () => { $("att-echec").classList.remove("on"); v.classList.remove("on"); };
    construireRadios();
  }

  /* ---------- trame parcellaire : fournie par l'outil, ou générée. La
     générée est une grille 12×5 aux sommets chahutés par un pseudo-aléa
     DÉTERMINISTE (même dessin à chaque attente : c'est un décor, pas une
     loterie). Colorisation de gauche à droite au rythme de la barre. ---------- */
  function alea(graine) { return () => (graine = (graine * 16807) % 2147483647) / 2147483647; }
  function trameGenerique() {
    const r = alea(75008); // clin d'œil au code postal du cabinet
    const NX = 12, NY = 5, W = 1000, H = 320, mx = W / NX, my = H / NY;
    const px = [], sommets = [];
    for (let j = 0; j <= NY; j++) { sommets[j] = []; for (let i = 0; i <= NX; i++) {
      const bx = i === 0 || i === NX ? 0 : (r() - .5) * mx * .55;
      const by = j === 0 || j === NY ? 0 : (r() - .5) * my * .55;
      sommets[j][i] = [i * mx + bx, j * my + by];
    }}
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const p = [sommets[j][i], sommets[j][i + 1], sommets[j + 1][i + 1], sommets[j + 1][i]];
      px.push(`<polygon class="att-parc" points="${p.map((c) => c.map((n) => n.toFixed(1)).join(",")).join(" ")}"/>`);
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${px.join("")}</svg>`;
  }
  function poserTrame(svg) {
    const bloc = $("att-trame");
    bloc.innerHTML = svg || trameGenerique();
    const formes = bloc.querySelectorAll("path,polygon,rect,circle");
    formes.forEach((f) => f.classList.add("att-parc"));
    // tri gauche → droite par centre de boîte englobante
    E.parcelles = Array.from(formes).sort((a, b) => {
      const ra = a.getBBox(), rb = b.getBBox();
      return (ra.x + ra.width / 2) - (rb.x + rb.width / 2);
    });
    E.faites = 0;
  }
  function coloriser(pct) {
    const cible = Math.round((pct / 100) * E.parcelles.length);
    const teintes = [C.canard, C.cyan, C.orange, C.carmin, C.jauneForme];
    while (E.faites < cible && E.faites < E.parcelles.length) {
      const p = E.parcelles[E.faites];
      p.style.fill = teintes[E.faites % teintes.length];
      p.classList.add("faite");
      E.faites++;
    }
  }

  /* ---------- progression : suivi du sablier de l'outil hôte, motif PAINT.
     On relit la source toutes les 400 ms ; « 12 sur 30 », « 12/30 » et
     « 43 % » y sont reconnus. Zéro instrumentation des boucles : elles
     parlent déjà. ---------- */
  function lireSource() {
    let texte = "";
    try {
      if (typeof E.source === "function") texte = E.source() || "";
      else if (typeof E.source === "string") {
        const n = document.querySelector(E.source);
        texte = (n && n.textContent) || "";
      }
    } catch (e) { /* la source peut disparaître entre deux phases : silence */ }
    if (!texte) return;
    $("att-phase").textContent = texte;
    let m = texte.match(/(\d+)\s*(?:sur|\/)\s*(\d+)/i);
    if (m && +m[2] > 0) {
      appliquer((+m[1] / +m[2]) * 100, null);
      $("att-compte").textContent = m[1] + " sur " + m[2];
      return;
    }
    m = texte.match(/(\d{1,3})\s*%/);
    if (m) appliquer(+m[1], null);
  }
  function appliquer(pct, phase) {
    pct = Math.max(0, Math.min(100, pct));
    $("att-barre-int").style.width = pct + "%";
    if (phase) $("att-phase").textContent = phase;
    coloriser(pct);
  }

  /* ---------- données /api/veille : chaque type indépendant, une section
     sans donnée reste CACHÉE — l'écran d'attente ne montre jamais son échec.
     Seules les actus se rafraîchissent (5 min, aligné sur leur cache). ------ */
  function veille(type) {
    return fetch(BASE + "/api/veille?type=" + type)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function chargerActus() {
    veille("actus").then((d) => {
      if (!d.titres || !d.titres.length) return;
      const html = d.titres.map((x) => `<b>${x.s}</b>${echap(x.t)}`).join(" ");
      const int = $("att-bandeau-int");
      int.innerHTML = html;
      int.style.setProperty("--att-dur", Math.max(60, d.titres.length * 7) + "s");
      $("att-bandeau").classList.add("on");
    }).catch(() => {});
  }
  function chargerClassements() {
    veille("classements").then((d) => {
      const jeux = [["Ligue 1", d.ligue1 || []], ["Top 14", d.top14 || []]].filter((j) => j[1].length);
      if (!jeux.length) return;
      const ong = $("att-c-classements-o");
      ong.innerHTML = "";
      const montrer = (idx) => {
        $("att-c-classements-t").textContent = jeux[idx][0];
        $("att-c-classements-b").innerHTML = jeux[idx][1].map((l) =>
          `<tr><td class="r">${l.rang}</td><td>${echap(String(l.equipe))}</td><td class="r">${l.points ?? ""} pts</td></tr>`
        ).join("");
        Array.from(ong.children).forEach((b, i) => b.classList.toggle("on", i === idx));
      };
      jeux.forEach((j, i) => {
        const b = document.createElement("button");
        b.textContent = j[0]; b.onclick = () => montrer(i); ong.appendChild(b);
      });
      montrer(0);
      $("att-c-classements").classList.add("on");
    }).catch(() => {});
  }
  function chargerCulturel() {
    veille("culturel").then((d) => {
      if (!d.titres || !d.titres.length) return;
      $("att-c-culturel-l").innerHTML = d.titres.slice(0, 6).map((t) => `<li>${echap(t)}</li>`).join("");
      $("att-c-culturel").classList.add("on");
    }).catch(() => {});
  }
  function chargerCompteurs() {
    veille("compteurs").then((d) => {
      if (!d.pays || !d.pays.length) return;
      E.compteurs = d;
      const chips = $("att-c-pays");
      chips.innerHTML = "";
      d.pays.forEach((p, i) => {
        const b = document.createElement("button");
        b.textContent = p.nom;
        b.onclick = () => { E.paysCourant = i; majChips(); tictacCompteurs(true); };
        chips.appendChild(b);
      });
      const majChips = () => Array.from(chips.children).forEach((b, i) =>
        b.classList.toggle("on", i === E.paysCourant));
      majChips();
      E.odPop = odometre($("att-od-pop"));
      E.odDette = odometre($("att-od-dette"));
      $("att-c-compteurs").classList.add("on");
      tictacCompteurs(true);
      clearInterval(E.compteursMinuterie);
      E.compteursMinuterie = setInterval(() => tictacCompteurs(false), 1000);
    }).catch(() => {});
  }
  function tictacCompteurs(saut) {
    if (!E.compteurs) return;
    const p = E.compteurs.pays[E.paysCourant];
    const dt = (Date.now() - Date.parse(E.compteurs.reference)) / 1000;
    E.odPop.poser(Math.round(p.population + p.popParSec * dt), "", saut);
    E.odDette.poser(Math.round(p.dette + p.detteParSec * dt), " " + p.devise, saut);
  }

  /* ---------- odomètre : une colonne par chiffre, bande 0-9 translatée en
     transform (compositeur, pas de layout). Reconstruit si le nombre de
     chiffres change (rare : changement de pays). ---------- */
  function odometre(el) {
    let colonnes = [];
    function batir(n) {
      el.innerHTML = "";
      colonnes = [];
      const s = String(n);
      for (let i = 0; i < s.length; i++) {
        if (i && (s.length - i) % 3 === 0) {
          const sep = document.createElement("span"); sep.className = "att-od-sep"; el.appendChild(sep);
        }
        const col = document.createElement("span"); col.className = "att-od-col";
        const strip = document.createElement("span"); strip.className = "att-od-strip";
        for (let d = 0; d <= 9; d++) { const c = document.createElement("span"); c.textContent = d; strip.appendChild(c); }
        col.appendChild(strip); el.appendChild(col); colonnes.push(strip);
      }
    }
    let suffixe = null;
    return {
      poser(n, suf, saut) {
        const s = String(Math.max(0, n));
        if (colonnes.length !== s.length) batir(s);
        for (let i = 0; i < s.length; i++) {
          if (saut) colonnes[i].style.transition = "none";
          colonnes[i].style.transform = "translateY(-" + (+s[i] * 1.25) + "em)";
          if (saut) requestAnimationFrame(() => { colonnes[i].style.transition = ""; });
        }
        if (suf !== undefined && suf !== suffixe) {
          suffixe = suf;
          let n2 = el.nextSibling;
          if (!n2 || !n2.classList || !n2.classList.contains("att-od-suf")) {
            n2 = document.createElement("span"); n2.className = "att-od-suf";
            el.parentNode.appendChild(n2);
          }
          n2.textContent = suf;
        }
      },
    };
  }

  /* ---------- radio : motif PAINT. Autoplay interdit sans geste → boutons ;
     la préférence est retenue (localStorage) et RETENTÉE au voile suivant —
     si le navigateur refuse encore, le bouton reste éteint, un clic suffit.
     Un flux muet au-delà de 6 s = échec, bouton éteint. ---------- */
  function construireRadios() {
    const bloc = $("att-radio");
    RADIOS.forEach((r) => {
      const b = document.createElement("button");
      b.textContent = r.nom;
      b.onclick = () => {
        if (E.radioNom === r.nom) { radioArreter(); localStorage.setItem("attente_radio", ""); majRadios(); }
        else radioDemarrer(r).then((ok) => {
          if (ok) localStorage.setItem("attente_radio", r.nom);
          majRadios();
        });
      };
      b.dataset.nom = r.nom;
      bloc.appendChild(b);
    });
  }
  function majRadios() {
    document.querySelectorAll("#att-radio button").forEach((b) =>
      b.classList.toggle("on", b.dataset.nom === E.radioNom));
  }
  function radioDemarrer(r) {
    return new Promise((res) => {
      radioArreter();
      try {
        E.audio = new Audio(r.url);
        E.audio.volume = 0.35;
        let tranche = false;
        const echec = () => { if (!tranche) { tranche = true; radioArreter(); res(false); } };
        E.audio.addEventListener("error", echec, { once: true });
        E.audio.play().then(() => { if (!tranche) { tranche = true; E.radioNom = r.nom; res(true); } }).catch(echec);
        setTimeout(echec, 6000);
      } catch (e) { res(false); }
    });
  }
  function radioArreter() {
    if (E.audio) { try { E.audio.pause(); E.audio.src = ""; } catch (e) {} E.audio = null; }
    E.radioNom = null;
  }

  function echap(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- API publique ---------- */
  function demarrer(opts) {
    opts = opts || {};
    construire();
    const v = $("att-voile");
    if (E.on) return;
    E.on = true;
    v.classList.remove("fin");
    $("att-echec").classList.remove("on");
    $("att-titre").textContent = opts.titre || "Génération en cours";
    $("att-sous").textContent = opts.sousTitre || "";
    $("att-phase").textContent = "Préparation…";
    $("att-compte").textContent = "";
    $("att-barre-int").style.width = "0%";
    poserTrame(opts.trame || null);
    v.classList.add("on");

    E.source = opts.source || null;
    clearInterval(E.minuterie);
    if (E.source) E.minuterie = setInterval(lireSource, 400);

    chargerActus(); chargerClassements(); chargerCulturel(); chargerCompteurs();
    clearInterval(E.actusMinuterie);
    E.actusMinuterie = setInterval(chargerActus, 5 * 60 * 1000);

    const pref = localStorage.getItem("attente_radio");
    if (pref) {
      const r = RADIOS.find((x) => x.nom === pref);
      if (r) radioDemarrer(r).then(majRadios);
    }
  }

  function progression(pct, phase) { if (E.on) appliquer(pct, phase || null); }

  function terminer() {
    if (!E.on) return;
    const v = $("att-voile");
    appliquer(100, "Terminé");
    v.classList.add("fin");
    radioArreter(); majRadios();          // la radio se coupe TOUJOURS à la fin
    clearInterval(E.minuterie); clearInterval(E.actusMinuterie); clearInterval(E.compteursMinuterie);
    E.on = false;
    setTimeout(() => v.classList.remove("on"), 900);
  }

  /* Échec : un bandeau PAR-DESSUS le contenu qui continue de tourner — pas
     d'écran d'erreur plein (décision du 29/08). La radio continue : le
     traitement derrière n'est pas forcément mort, et l'onglet doit garder
     son exemption d'étranglement. */
  function echec(message) {
    construire();
    $("att-echec-msg").textContent = "La génération a rencontré un problème — " +
      (message || "voir l'outil derrière cet écran") + ". Le contenu continue de tourner.";
    $("att-echec").classList.add("on");
  }

  window.ATTENTE = { demarrer, progression, terminer, echec, version: "1.0" };
})();
