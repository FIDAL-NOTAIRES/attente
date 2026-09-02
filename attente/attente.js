/* ATTENTE — écran d'attente riche des outils FIDAL Notaires. Module UNIQUE :
   un <script src="https://<projet-attente>.vercel.app/attente.js?v=2"></script>
   et l'outil appelle ATTENTE.demarrer(...) / ATTENTE.terminer().

   Héritier direct du « voile de production » de PAINT (01/08/2026) : même
   principe de suivi du sablier SANS instrumenter les boucles (on relit un
   message de progression toutes les 400 ms), même gestion de l'autoplay audio.

   ── v1.2 (01/09/2026) ────────────────────────────────────────────────────
   Chaque support épouse la forme de son sujet, au lieu de quatre cadrans
   identiques et tristes :
     • actus       → bande de dépêche d'agence, papier, bord déchiré, téléscripteur
     • classements → panneau lumineux de stade (matrice de points, chiffres ambre)
     • culturel    → bande de pellicule 35 mm, perforations carrées sur les
                     deux bords, une rubrique par photogramme
     • compteurs   → compteur électrique : cadran rond + tambours à chiffres,
                     les 9 pays en grille simultanée avec drapeau (plus de défilé)
     • radio       → cadran horizontal de vieux poste : aiguille sur échelle
                     graduée, grésillement au déplacement, silence par défaut
                     (aucune mémorisation de la dernière station)

   ⚠ Toutes les animations vivent sur le compositeur (transform/opacity) :
   coût nul sur le traitement qui tourne derrière. Un onglet qui joue de
   l'audio est exempté de l'étranglement des minuteries en arrière-plan par
   Chrome — la radio n'est pas qu'un agrément, elle protège la cadence des
   traitements longs (constat PAINT, 01/08).

   ⚠ Les tambours des compteurs ne font rouler QUE les trois derniers
   chiffres (les seuls qui bougent en une attente) : 9 pays × 2 valeurs, ça
   fait 54 bandes animées au lieu de 200.

   ⚠ Les données viennent de /api/veille?type=… sur le MÊME domaine que ce
   script (déduit de currentScript.src) : aucun domaine en dur, le module
   suit son déploiement.

   ⚠ Réservé pour la suite : #att-coin, coin bas-droit de la trame, où se
   grefferont l'icône canard et le stand de tir (portage v1.3).

   API — inchangée depuis v1.0 :
     ATTENTE.demarrer({ titre, sousTitre, source, trame })
     ATTENTE.progression(pct, phase)
     ATTENTE.echec("message")
     ATTENTE.terminer()
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
    vert: "#4caf7d", encre: "#e8eef5", sourdine: "#8fa5bb",
    ligne: "rgba(255,255,255,.14)",
    papier: "#F4EFE4", papierEncre: "#25313d",   // dépêche
    carminVif: "#E24A63",                        // carmin éclairci, lisible sur nuit
    laiton: "#8a6b3d", bakelite: "#1b2a3a",      // cadran radio
    led: "#FFB53D",                              // panneau de stade
  };

  const CSS = `
#att-voile{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;align-items:center;
  background:${C.nuit};color:${C.encre};font:14px/1.45 "Segoe UI",system-ui,sans-serif;overflow:hidden}
#att-voile.on{display:flex}
#att-voile *{box-sizing:border-box}
#att-voile button:focus-visible{outline:2px solid ${C.cyan};outline-offset:2px}

/* ---- entête et progression ---- */
#att-voile .att-haut{display:flex;flex-direction:column;align-items:center;gap:9px;padding:26px 20px 4px;text-align:center;flex:0 0 auto}
#att-voile .att-logo{font-size:14px;letter-spacing:5px;color:${C.cyan};font-weight:600}
#att-voile .att-titre{font-family:Georgia,serif;font-size:30px;font-weight:700;letter-spacing:.5px}
#att-voile .att-sous{font-size:14px;color:${C.sourdine};margin-top:-6px}
#att-voile .att-phase{font-size:15px;min-height:22px;color:${C.encre}}
#att-voile .att-barre{width:min(520px,80vw);height:8px;border-radius:99px;background:${C.ligne};overflow:hidden}
#att-voile .att-barre>div{height:100%;width:0%;background:${C.canard};border-radius:99px;transition:width .6s ease}
#att-voile.fin .att-barre>div{background:${C.vert}}
#att-voile .att-compte{font-size:12.5px;color:${C.sourdine};min-height:16px}

/* ---- cadre central : sa hauteur est celle qui reste, et le corps qu'il
       contient se MET À L'ÉCHELLE pour y entrer en entier (voir ajuster()).
       Rogner une carte au milieu d'un chiffre serait pire que la réduire. --- */
/* ⚠ align-items:flex-start est ESSENTIEL : sans lui, le corps — enfant flex du
   cadre — s'étire à la hauteur du cadre, sa hauteur mesurée vaut toujours la
   place disponible, ajuster() conclut « ça rentre » et le contenu réel déborde
   pour être rogné en silence. C'est exactement le bug du 02/09 (carte des
   compteurs invisible). */
#att-voile .att-cadre{flex:1 1 auto;min-height:0;width:100%;display:flex;
  justify-content:center;align-items:flex-start;overflow:hidden}
#att-voile .att-corps{display:flex;flex-direction:column;align-items:center;width:100%;flex:0 0 auto;
  transform-origin:top center;transform:scale(var(--att-z,1));transition:transform .3s ease}

/* ---- trame parcellaire = jauge de fond ---- */
#att-voile .att-trame{position:relative;width:min(1180px,94vw);flex:0 0 auto;height:17vh;
  display:flex;align-items:center;justify-content:center}
#att-voile .att-trame svg{width:100%;height:100%}
#att-voile .att-parc{fill:${C.cyan};fill-opacity:0;stroke:${C.canard};stroke-opacity:.55;stroke-width:1.5;transition:fill-opacity .8s ease}
#att-voile .att-parc.faite{fill-opacity:.8}
#att-coin{position:absolute;right:6px;bottom:6px;z-index:2}

/* ---- rangée de cartes : aucune carte n'est tronquée, c'est l'échelle du
       corps qui absorbe le manque de place. ---- */
#att-voile .att-cartes{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:flex-start;
  padding:10px 18px 4px;max-width:1560px;flex:0 0 auto}
#att-voile .att-carte{display:none;position:relative}
#att-voile .att-carte.on{display:block}

/* ---- CULTURE — bande de pellicule 35 mm. Un billet de cinéma est large et
       court ; cette carte est haute et étroite, donc elle ne se lira jamais
       comme un billet. La pellicule, elle, EST verticale, et son signe
       distinctif — les perforations sur les deux bords — tombe pile sur cette
       géométrie. Chaque rubrique occupe un photogramme. Les trous sont peints
       en couleur de fond : le voile étant un aplat uni, ils se lisent comme de
       vraies perforations, sans mask-composite. ---- */
#att-voile .att-pellicule{width:300px;background:#EDE2CB;color:#2a2318;border-radius:2px;
  padding:0 22px 0;box-shadow:0 8px 22px rgba(0,0,0,.45)}
#att-voile .att-pellicule::before,
#att-voile .att-pellicule::after{content:"";position:absolute;top:0;bottom:0;width:22px;
  background-color:#E0D2B4;
  background-image:linear-gradient(${C.nuit} 0 7px,transparent 7px);
  background-size:12px 15px;background-position:5px 7px;background-repeat:repeat-y}
#att-voile .att-pellicule::before{left:0;box-shadow:inset -1px 0 0 rgba(42,35,24,.16)}
#att-voile .att-pellicule::after{right:0;box-shadow:inset 1px 0 0 rgba(42,35,24,.16)}
#att-voile .att-photo{padding:11px 5px;border-top:1px solid rgba(42,35,24,.26)}
#att-voile .att-photo:first-child{border-top:0}
#att-voile .att-pellicule h3{font-family:Georgia,serif;font-size:16px;font-weight:700;margin:0;color:#2a2318}
#att-voile .att-rub-nom{font:600 11.5px/1 "Segoe UI",sans-serif;color:#A8722B;
  display:flex;align-items:center;gap:8px;margin-bottom:5px}
#att-voile .att-rub-nom::after{content:"";flex:1;height:1px;background:rgba(168,114,43,.3)}
#att-voile .att-pellicule ul{margin:0;padding:0;list-style:none;font-size:12.5px;line-height:1.42}
#att-voile .att-pellicule li{position:relative;padding:2px 0 2px 12px;color:#3a3226;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#att-voile .att-pellicule li::before{content:"";position:absolute;left:0;top:8.5px;width:5px;height:5px;
  border-radius:50%;background:#bda880}
#att-voile .att-bord{padding:7px 5px 9px;border-top:1px solid rgba(42,35,24,.26);
  font:9.5px/1 "Consolas","Courier New",monospace;letter-spacing:2.5px;color:#9a8a63}

/* ---- CLASSEMENTS — panneau lumineux de stade. Un tableau d'affichage est
       ALLUMÉ : caisson bleu vif, bandeau de titre en canard, témoin vert qui
       respire, écran encastré à matrice de points, points en ambre franc, et
       les rangs en pastilles (podium doré, places européennes en cyan) — le
       classement dit ainsi quelque chose au lieu d'aligner des chiffres. --- */
#att-voile .att-panneau{width:290px;background:linear-gradient(#18344c,#0e2133);
  border:1px solid #42627e;border-radius:8px;padding:0 0 12px;
  box-shadow:0 6px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.09)}
#att-voile .att-panneau-tete{display:flex;align-items:center;gap:9px;color:#fff;
  background:linear-gradient(${C.canard},#2a6a72);padding:8px 14px;border-radius:7px 7px 0 0}
#att-voile .att-panneau-tete h3{font:600 13px/1 "Segoe UI",sans-serif;letter-spacing:1.2px;margin:0}
#att-voile .att-led-vive{width:8px;height:8px;border-radius:50%;background:#8CFF6B;flex:0 0 auto;
  box-shadow:0 0 9px #8CFF6B;animation:att-pulse 2.6s ease-in-out infinite}
#att-voile .att-panneau-jour{margin-left:auto;font:11px/1 "Consolas","Courier New",monospace;
  background:rgba(0,0,0,.3);border-radius:3px;padding:3px 8px}
#att-voile .att-ecran{position:relative;margin:11px 12px 0;background:#08161f;border:1px solid #335066;
  border-radius:5px;padding:9px 11px;box-shadow:inset 0 0 24px rgba(0,0,0,.7)}
#att-voile .att-ecran::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:4px;
  background:radial-gradient(circle .6px at .6px .6px,rgba(255,255,255,.055) .6px,transparent .7px) 0 0/4px 4px}
#att-voile .att-ecran table{border-collapse:collapse;width:100%;position:relative}
#att-voile .att-ecran thead td{font:10.5px/1 "Segoe UI",sans-serif;letter-spacing:1px;color:#6f879c;padding:0 0 6px}
#att-voile .att-ecran tbody td{padding:3px 0;border-top:1px solid rgba(255,255,255,.055)}
#att-voile .att-ecran td.equipe{font-size:13.5px;color:#eaf3fb;padding:3px 8px}
#att-voile .att-ecran tbody tr:first-child td.equipe{color:#fff;font-weight:600}
#att-voile .att-ecran td.pts{text-align:right;font:700 15px/1 "Segoe UI",sans-serif;
  font-variant-numeric:tabular-nums;color:${C.led};text-shadow:0 0 10px rgba(255,181,61,.55)}
#att-voile .att-rang{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
  border-radius:3px;font:600 10.5px/1 "Segoe UI",sans-serif;background:rgba(255,255,255,.09);color:#b9cadb}
#att-voile .att-rang.podium{background:${C.jauneForme};color:${C.nuit}}
#att-voile .att-rang.euro{background:rgba(109,213,220,.2);color:${C.cyan}}
@keyframes att-pulse{0%,100%{opacity:1}50%{opacity:.28}}

/* ---- COMPTEURS — compteur électrique : cadran rond en tête, tambours à
       chiffres derrière une vitre, 9 pays en grille simultanée. ---- */
#att-voile .att-compteur{width:min(560px,92vw);background:linear-gradient(#1a2a3c,#132234);
  border:1px solid #33455a;border-radius:10px;padding:10px 14px 12px;
  box-shadow:0 4px 16px rgba(0,0,0,.4)}
#att-voile .att-compteur .att-comp-haut{display:flex;align-items:center;gap:11px;margin-bottom:10px}
#att-voile .att-compteur h3{font-family:Georgia,serif;font-size:15px;font-weight:700;margin:0;color:${C.cyan}}
#att-voile .att-compteur .att-comp-h-sous{font-size:11.5px;color:${C.sourdine}}
#att-voile .att-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(163px,1fr));gap:8px 13px}
#att-voile .att-pays{border-top:1px solid rgba(255,255,255,.09);padding-top:6px}
#att-voile .att-pays-tete{display:flex;align-items:center;gap:7px;margin-bottom:3px}
#att-voile .att-pays-tete svg{width:21px;height:14px;border-radius:1.5px;flex:0 0 auto;
  box-shadow:0 0 0 1px rgba(255,255,255,.22)}
#att-voile .att-pays-nom{font-size:12px;color:${C.encre};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#att-voile .att-pays-code{display:inline-flex;align-items:center;justify-content:center;width:21px;height:14px;
  border-radius:1.5px;background:${C.canard};color:#fff;font:600 8.5px/1 "Segoe UI",sans-serif;flex:0 0 auto}
#att-voile .att-ligne{display:flex;align-items:baseline;gap:6px}
#att-voile .att-ligne-lib{font-size:10.5px;color:${C.sourdine};width:26px;flex:0 0 auto}

/* tambours : vitre sombre, chiffre fixe en clair, chiffres roulants en jaune */
#att-voile .att-vitre{display:inline-flex;align-items:center;background:#08131e;border:1px solid #2a3b4c;
  border-radius:3px;padding:1px 4px;box-shadow:inset 0 1px 3px rgba(0,0,0,.8)}
#att-voile .att-od-val{display:flex;overflow:hidden;height:1.2em;font:600 14px/1.2 "Segoe UI",sans-serif;
  font-variant-numeric:tabular-nums;color:${C.encre}}
#att-voile .att-od-val.dette{font-size:11.5px;color:#cfdae6}
#att-voile .att-od-col{position:relative;width:.62em;height:1.2em}
#att-voile .att-od-strip{position:absolute;left:0;top:0;display:flex;flex-direction:column;
  transition:transform .55s cubic-bezier(.3,.7,.3,1);will-change:transform;color:${C.jauneForme}}
#att-voile .att-od-val.dette .att-od-strip{color:${C.orange}}
#att-voile .att-od-strip span{height:1.2em;text-align:center}
#att-voile .att-od-fixe{width:.62em;text-align:center}
#att-voile .att-od-sep{width:.26em}
#att-voile .att-od-suf{font-size:10.5px;color:${C.sourdine};margin-left:4px;align-self:center}

/* flèche de tendance : le VERT est toujours vers le haut et signifie « bonne
   nouvelle ». Pour la population, hausse = vert. Pour la dette, la lecture
   s'inverse : une dette qui gonfle est une flèche rouge vers le bas. */
#att-voile .att-fleche{width:9px;height:9px;flex:0 0 auto;margin-left:6px;align-self:center}
#att-voile .att-fleche path{fill:currentColor}
#att-voile .att-fleche.bon{color:${C.vert};filter:drop-shadow(0 0 4px rgba(76,175,125,.55))}
#att-voile .att-fleche.mauvais{color:${C.carminVif};filter:drop-shadow(0 0 4px rgba(226,74,99,.5))}
#att-voile .att-fleche.plat{color:${C.sourdine}}

/* cadran rond du compteur, aiguille qui suit la progression */
#att-voile .att-cadran{width:42px;height:42px;flex:0 0 auto}
#att-voile .att-cadran-aig{transform-origin:21px 21px;transition:transform .9s cubic-bezier(.3,.7,.3,1)}

/* ---- RADIO — cadran horizontal de vieux poste ---- */
#att-voile .att-poste{width:min(560px,92vw);flex:0 0 auto;margin:8px 0 6px;
  background:linear-gradient(${C.bakelite},#101c28);border:1px solid #2e4053;border-radius:9px;
  padding:9px 16px 11px;box-shadow:0 4px 14px rgba(0,0,0,.4)}
#att-voile .att-echelle{position:relative;height:46px;cursor:ew-resize;touch-action:none;
  background:linear-gradient(#22323f,#16242f);border:1px solid #3a5065;border-radius:5px;
  box-shadow:inset 0 2px 8px rgba(0,0,0,.6)}
#att-voile .att-echelle::after{content:"";position:absolute;inset:0;border-radius:5px;pointer-events:none;
  background:linear-gradient(105deg,rgba(255,255,255,.11) 0 18%,transparent 30%)}
#att-voile .att-grad{position:absolute;left:0;right:0;top:5px;height:8px;
  background:repeating-linear-gradient(to right,${C.laiton} 0 1px,transparent 1px 11px);opacity:.75}
#att-voile .att-crans{position:absolute;left:0;right:0;bottom:5px;height:26px}
#att-voile .att-cran{position:absolute;transform:translateX(-50%);text-align:center;
  font:11.5px/1 "Segoe UI",sans-serif;color:${C.sourdine};white-space:nowrap;
  background:none;border:0;padding:6px 4px 0;cursor:pointer}
#att-voile .att-cran::before{content:"";display:block;width:1px;height:9px;margin:0 auto 4px;background:${C.laiton}}
#att-voile .att-cran.on{color:${C.orange}}
#att-voile .att-cran.morte{color:#5b6d80;text-decoration:line-through}
#att-voile .att-aiguille{position:absolute;left:0;top:2px;bottom:2px;width:2px;background:${C.orange};
  box-shadow:0 0 9px rgba(255,152,45,.85);transition:transform .45s cubic-bezier(.3,.7,.3,1);
  will-change:transform;pointer-events:none}
#att-voile .att-aiguille.libre{transition:none}
#att-voile .att-aiguille::before{content:"";position:absolute;left:50%;top:-5px;width:11px;height:11px;
  margin-left:-5.5px;border-radius:50%;background:${C.orange};box-shadow:0 0 9px rgba(255,152,45,.9)}
#att-voile .att-poste-pied{display:flex;align-items:center;justify-content:space-between;
  margin-top:6px;font-size:11px;color:${C.sourdine}}
#att-voile .att-temoin{display:inline-block;width:7px;height:7px;border-radius:50%;background:#43596d;margin-right:6px}
#att-voile .att-poste.joue .att-temoin{background:${C.orange};box-shadow:0 0 8px ${C.orange}}

/* ---- ACTUS — bande de dépêche d'agence : papier, bord déchiré, téléscripteur ---- */
#att-voile .att-depeche{width:100%;flex:0 0 auto;position:relative;display:none;
  background:${C.papier};color:${C.papierEncre};padding:9px 0 8px;
  box-shadow:0 -6px 20px rgba(0,0,0,.45)}
#att-voile .att-depeche.on{display:block}
#att-voile .att-depeche::before{content:"";position:absolute;left:0;right:0;top:-7px;height:8px;
  background:
    linear-gradient(-45deg,${C.papier} 4px,transparent 0) 0 100%/13px 8px repeat-x,
    linear-gradient(45deg,${C.papier} 4px,transparent 0) 0 100%/13px 8px repeat-x}
#att-voile .att-depeche-int{display:inline-block;padding-left:100vw;white-space:nowrap;
  font:13px/1.3 "Consolas","Courier New",monospace;letter-spacing:.2px;
  animation:att-defile var(--att-dur,90s) linear infinite;will-change:transform}
#att-voile .att-depeche b{color:${C.carmin};font-weight:700;margin:0 9px 0 30px}
#att-voile .att-depeche i{font-style:normal;color:#9a8f7c;margin:0 6px}
@keyframes att-defile{to{transform:translateX(-100%)}}

/* ---- échec ---- */
#att-echec{position:absolute;top:0;left:0;right:0;z-index:4;display:none;align-items:center;gap:14px;
  background:${C.carmin};color:#fff;padding:10px 18px;font-size:14px}
#att-echec.on{display:flex}
#att-echec button{margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);
  color:#fff;border-radius:6px;padding:4px 12px;cursor:pointer;font:13px "Segoe UI",sans-serif}

@media (max-height:900px){
  #att-voile .att-haut{padding:14px 20px 2px;gap:6px}
  #att-voile .att-titre{font-size:24px}
  #att-voile .att-trame{height:13vh}
  #att-voile .att-poste{margin:4px 0 2px;padding:7px 16px 8px}
  #att-voile .att-echelle{height:38px}
  #att-voile .att-cartes{padding:6px 18px 2px;gap:12px}
}
@media (max-width:720px){
  #att-voile .att-titre{font-size:24px}
  #att-voile .att-trame{max-height:16vh}
}
@media (prefers-reduced-motion: reduce){
  #att-voile .att-depeche-int{animation:none}
  #att-voile .att-od-strip,#att-voile .att-parc,#att-voile .att-aiguille,#att-voile .att-cadran-aig{transition:none}
  #att-voile .att-led-vive{animation:none}
}`;

  /* ---------- radios : adresses de flux EN DUR, aucun appel à /api/veille.
     ⚠ NON CONTRACTUELLES (constat PAINT sur Radio Classique) : un flux qui ne
     démarre pas en 6 s est réputé mort, son cran est barré, on n'insiste pas.
     ⚠ v1.2 : plus AUCUNE mémorisation — l'aiguille part sur « silence ». */
  const RADIOS = [
    { nom: "Radio Classique", url: "https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3" },
    { nom: "FIP",             url: "https://icecast.radiofrance.fr/fip-midfi.mp3" },
    { nom: "franceinfo",      url: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3" },
    { nom: "France Musique",  url: "https://icecast.radiofrance.fr/francemusique-midfi.mp3" },
  ];
  const CRANS = [{ nom: "silence", url: null }].concat(RADIOS);

  /* ---------- état du module ---------- */
  const E = {
    on: false, minuterie: null, actusMinuterie: null, compteursMinuterie: null,
    source: null, parcelles: [], faites: 0, audio: null, radioNom: null,
    compteurs: null, roues: [], pct: 0,
    cran: 0, ratio: 0, glisse: false, mortes: {},
  };
  const $ = (id) => document.getElementById(id);
  const echap = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ================= DRAPEAUX =================
     Dessinés en SVG, sans dépendance : les émojis drapeaux ne s'affichent pas
     sous Windows (Chrome y montre « FR » à la place). Fallback : pastille au
     code à deux lettres. Repère commun : viewBox 0 0 30 20. ---------- */
  const vtri = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
  const htri = (a, b, c) => `<rect width="30" height="6.67" fill="${a}"/><rect y="6.67" width="30" height="6.66" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
  const croixN = (f, x) => `<rect width="30" height="20" fill="${f}"/><rect x="10.5" width="4" height="20" fill="${x}"/><rect y="8" width="30" height="4" fill="${x}"/>`;
  const bandes = (n, a, b) => {
    let s = "";
    for (let i = 0; i < n; i++) s += `<rect y="${(i * 20 / n).toFixed(2)}" width="30" height="${(20 / n).toFixed(2)}" fill="${i % 2 ? b : a}"/>`;
    return s;
  };
  const DRAPEAUX = {
    FR: () => vtri("#0055A4", "#fff", "#EF4135"),
    IT: () => vtri("#009246", "#fff", "#CE2B37"),
    BE: () => vtri("#000", "#FDDA24", "#EF3340"),
    IE: () => vtri("#169B62", "#fff", "#FF883E"),
    RO: () => vtri("#002B7F", "#FCD116", "#CE1126"),
    DE: () => htri("#000", "#DD0000", "#FFCE00"),
    NL: () => htri("#AE1C28", "#fff", "#21468B"),
    RU: () => htri("#fff", "#0039A6", "#D52B1E"),
    LU: () => htri("#EF3340", "#fff", "#00A1DE"),
    ES: () => `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`,
    PL: () => `<rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#DC143C"/>`,
    ID: () => `<rect width="30" height="20" fill="#fff"/><rect width="30" height="10" fill="#CE1126"/>`,
    UA: () => `<rect width="30" height="20" fill="#FFD500"/><rect width="30" height="10" fill="#005BBB"/>`,
    JP: () => `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.6" fill="#BC002D"/>`,
    BD: () => `<rect width="30" height="20" fill="#006A4E"/><circle cx="13.5" cy="10" r="5.2" fill="#F42A41"/>`,
    CH: () => `<rect width="30" height="20" fill="#DA291C"/><rect x="13" y="5" width="4" height="10" fill="#fff"/><rect x="10" y="8" width="10" height="4" fill="#fff"/>`,
    SE: () => croixN("#005293", "#FECB00"),
    NO: () => `<rect width="30" height="20" fill="#BA0C2F"/><rect x="9.5" width="6" height="20" fill="#fff"/><rect y="7" width="30" height="6" fill="#fff"/><rect x="11" width="3" height="20" fill="#00205B"/><rect y="8.5" width="30" height="3" fill="#00205B"/>`,
    DK: () => croixN("#C8102E", "#fff"),
    FI: () => croixN("#fff", "#003580"),
    GR: () => `<rect width="30" height="20" fill="#fff"/>${bandes(9, "#0D5EAF", "#fff")}<rect width="12" height="11.1" fill="#0D5EAF"/><rect x="4.6" width="2.8" height="11.1" fill="#fff"/><rect y="4.1" width="12" height="2.8" fill="#fff"/>`,
    AT: () => htri("#ED2939", "#fff", "#ED2939"),
    PT: () => `<rect width="30" height="20" fill="#DA291C"/><rect width="12" height="20" fill="#046A38"/><circle cx="12" cy="10" r="4.2" fill="#FFE900" stroke="#DA291C" stroke-width="1"/>`,
    CN: () => `<rect width="30" height="20" fill="#DE2910"/><circle cx="6" cy="6" r="3" fill="#FFDE00"/><circle cx="11.5" cy="2.6" r="1" fill="#FFDE00"/><circle cx="13.5" cy="5.2" r="1" fill="#FFDE00"/><circle cx="13.5" cy="8.6" r="1" fill="#FFDE00"/><circle cx="11.5" cy="11" r="1" fill="#FFDE00"/>`,
    VN: () => `<rect width="30" height="20" fill="#DA251D"/><circle cx="15" cy="10" r="4.4" fill="#FFFF00"/>`,
    KR: () => `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#CD2E3A"/><path d="M10.4 10a4.6 4.6 0 0 1 9.2 0 2.3 2.3 0 0 0-4.6 0 2.3 2.3 0 0 1-4.6 0z" fill="#0047A0"/>`,
    IN: () => `<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.67" fill="#FF9933"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.7" fill="none" stroke="#000080" stroke-width="1"/>`,
    NG: () => vtri("#008751", "#fff", "#008751"),
    PK: () => `<rect width="30" height="20" fill="#01411C"/><rect width="7.5" height="20" fill="#fff"/><circle cx="19" cy="10" r="4.4" fill="#fff"/><circle cx="20.7" cy="8.6" r="4.4" fill="#01411C"/>`,
    ET: () => `${htri("#078930", "#FCDD09", "#DA121A")}<circle cx="15" cy="10" r="4.4" fill="#0F47AF"/>`,
    EG: () => `${htri("#CE1126", "#fff", "#000")}<circle cx="15" cy="10" r="2.2" fill="#C09300"/>`,
    MA: () => `<rect width="30" height="20" fill="#C1272D"/><path d="M15 5.6l1.6 4.9-4.2-3h5.2l-4.2 3z" fill="none" stroke="#006233" stroke-width="1"/>`,
    DZ: () => `<rect width="30" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.4" fill="#D21034"/><circle cx="16.6" cy="10" r="3.6" fill="#fff"/>`,
    TN: () => `<rect width="30" height="20" fill="#E70013"/><circle cx="15" cy="10" r="5.4" fill="#fff"/><circle cx="15" cy="10" r="3.6" fill="#E70013"/><circle cx="16.4" cy="10" r="2.8" fill="#fff"/>`,
    TR: () => `<rect width="30" height="20" fill="#E30A17"/><circle cx="12" cy="10" r="4.4" fill="#fff"/><circle cx="13.6" cy="10" r="3.5" fill="#E30A17"/><circle cx="18.4" cy="10" r="1.5" fill="#fff"/>`,
    BR: () => `<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.4 27.6 10 15 17.6 2.4 10z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/>`,
    AR: () => `${htri("#74ACDF", "#fff", "#74ACDF")}<circle cx="15" cy="10" r="2.2" fill="#F6B40E"/>`,
    MX: () => `${vtri("#006847", "#fff", "#CE1126")}<circle cx="15" cy="10" r="2.2" fill="#8b5a2b"/>`,
    CA: () => `<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#D80621"/><rect x="22.5" width="7.5" height="20" fill="#D80621"/><path d="M15 4.4l1.2 3.4 2.6-1.2-1.2 3.6 3 .4-2.6 1.8 1 1.4-3.2-.5.4 3.3L15 15l-1.2 2.6.4-3.3-3.2.5 1-1.4-2.6-1.8 3-.4-1.2-3.6 2.6 1.2z" fill="#D80621"/>`,
    GB: () => `<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" stroke-width="2"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="4"/>`,
    US: () => `${bandes(13, "#B31942", "#fff")}<rect width="13" height="10.8" fill="#0A3161"/>` +
      [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) =>
        `<circle cx="${1.6 + c * 2.6 + (r % 2 ? 1.3 : 0)}" cy="${1.6 + r * 2.6}" r=".72" fill="#fff"/>`).join("")).join(""),
    AU: () => `<rect width="30" height="20" fill="#012169"/><path d="M0 0l15 10M15 0L0 10" stroke="#fff" stroke-width="2.6"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3.4"/><path d="M7.5 0v10M0 5h15" stroke="#C8102E" stroke-width="2"/><circle cx="7.5" cy="15.6" r="1.5" fill="#fff"/><circle cx="22" cy="6" r="1" fill="#fff"/><circle cx="25.6" cy="12" r="1" fill="#fff"/><circle cx="20.4" cy="14" r=".9" fill="#fff"/>`,
  };
  const CODES = {
    "france": "FR", "allemagne": "DE", "italie": "IT", "espagne": "ES", "royaume-uni": "GB",
    "royaume uni": "GB", "grande-bretagne": "GB", "angleterre": "GB",
    "etats-unis": "US", "états-unis": "US", "etats unis": "US", "usa": "US",
    "chine": "CN", "inde": "IN", "japon": "JP", "bresil": "BR", "brésil": "BR",
    "russie": "RU", "canada": "CA", "belgique": "BE", "pays-bas": "NL", "suisse": "CH",
    "portugal": "PT", "mexique": "MX", "nigeria": "NG", "nigéria": "NG",
    "indonesie": "ID", "indonésie": "ID", "turquie": "TR", "egypte": "EG", "égypte": "EG",
    "pakistan": "PK", "bangladesh": "BD", "ethiopie": "ET", "éthiopie": "ET",
    "vietnam": "VN", "viêt nam": "VN", "coree du sud": "KR", "corée du sud": "KR",
    "australie": "AU", "argentine": "AR", "pologne": "PL", "maroc": "MA",
    "algerie": "DZ", "algérie": "DZ", "tunisie": "TN", "senegal": "SN", "sénégal": "SN",
    "luxembourg": "LU", "irlande": "IE", "suede": "SE", "suède": "SE",
    "norvege": "NO", "norvège": "NO", "danemark": "DK", "finlande": "FI",
    "grece": "GR", "grèce": "GR", "autriche": "AT", "roumanie": "RO", "ukraine": "UA",
  };
  function drapeau(nom, code) {
    const c = (code || CODES[String(nom).toLowerCase().trim()] || "").toUpperCase();
    const f = DRAPEAUX[c];
    if (f) return `<svg viewBox="0 0 30 20" aria-hidden="true">${f()}</svg>`;
    const deux = c || String(nom).replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 2).toUpperCase();
    return `<span class="att-pays-code" aria-hidden="true">${echap(deux)}</span>`;
  }

  /* ================= CONSTRUCTION DU VOILE ================= */
  function construire() {
    if ($("att-voile")) return;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const v = document.createElement("div");
    v.id = "att-voile";
    v.setAttribute("role", "status");
    v.setAttribute("aria-live", "polite");
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

  <div class="att-cadre">
   <div class="att-corps" id="att-corps">
  <div class="att-trame" id="att-trame"><div id="att-coin"></div></div>

  <div class="att-cartes">
    <div class="att-carte att-panneau" id="att-c-classements">
      <div class="att-panneau-tete">
        <span class="att-led-vive"></span>
        <h3 id="att-c-classements-t">Ligue 1</h3>
        <span class="att-panneau-jour" id="att-c-classements-j"></span>
      </div>
      <div class="att-ecran">
        <table>
          <thead><tr><td></td><td>Équipe</td><td style="text-align:right">Pts</td></tr></thead>
          <tbody id="att-c-classements-b"></tbody>
        </table>
      </div>
    </div>

    <div class="att-carte att-pellicule" id="att-c-culturel">
      <div class="att-photo"><h3>Ce qui sort en ville</h3></div>
      <div id="att-c-culturel-corps"></div>
      <div class="att-bord">PROGRAMME 2026 · 24A · 25A</div>
    </div>

    <div class="att-carte att-compteur" id="att-c-compteurs">
      <div class="att-comp-haut">
        <svg class="att-cadran" viewBox="0 0 42 42" aria-hidden="true">
          <circle cx="21" cy="21" r="19.5" fill="#0b1622" stroke="#3d5568" stroke-width="1.4"/>
          <circle cx="21" cy="21" r="15" fill="none" stroke="#22323f" stroke-width=".8"/>
          <g stroke="${C.sourdine}" stroke-width="1.1">
            <path d="M21 4.5v3.4"/><path d="M37.5 21h-3.4"/><path d="M21 37.5v-3.4"/><path d="M4.5 21h3.4"/>
          </g>
          <path class="att-cadran-aig" id="att-cadran-aig" d="M21 21L21 8" stroke="${C.orange}" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="21" cy="21" r="2.3" fill="${C.laiton}"/>
        </svg>
        <div>
          <h3>Pendant ce temps, dans le monde</h3>
          <div class="att-comp-h-sous">Estimées seconde par seconde. La flèche verte marque la bonne tendance.</div>
        </div>
      </div>
      <div class="att-grille" id="att-grille"></div>
    </div>
  </div>
   </div>
  </div>

  <div class="att-poste" id="att-poste">
    <div class="att-echelle" id="att-echelle" role="slider" tabindex="0"
         aria-label="Choix de la station" aria-valuemin="0" aria-valuemax="${CRANS.length - 1}" aria-valuenow="0">
      <div class="att-grad"></div>
      <div class="att-crans" id="att-crans"></div>
      <div class="att-aiguille" id="att-aiguille"></div>
    </div>
    <div class="att-poste-pied">
      <span><span class="att-temoin"></span><span id="att-poste-etat">Silence</span></span>
      <span>Glissez l'aiguille ou cliquez une station</span>
    </div>
  </div>

  <div class="att-depeche" id="att-depeche"><div class="att-depeche-int" id="att-depeche-int"></div></div>`;
    document.body.appendChild(v);

    $("att-echec-fermer").onclick = () => { $("att-echec").classList.remove("on"); v.classList.remove("on"); };
    construireCadran();
    // le corps change de taille au fil des chargements : on re-mesure tout seul
    if (window.ResizeObserver) {
      try { new ResizeObserver(ajuster).observe($("att-corps")); } catch (e) {}
    }
  }

  /* ================= TRAME PARCELLAIRE =================
     Fournie par l'outil, ou générée : grille 12×5 aux sommets chahutés par un
     pseudo-aléa DÉTERMINISTE (même dessin à chaque attente : c'est un décor,
     pas une loterie). Colorisation de gauche à droite au rythme de la barre. */
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
    const coin = $("att-coin");
    bloc.innerHTML = "";
    const enveloppe = document.createElement("div");
    enveloppe.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center";
    enveloppe.innerHTML = svg || trameGenerique();
    bloc.appendChild(enveloppe);
    bloc.appendChild(coin); // le coin réservé au stand de tir survit au remplacement
    const formes = enveloppe.querySelectorAll("path,polygon,rect,circle");
    formes.forEach((f) => f.classList.add("att-parc"));
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

  /* ================= PROGRESSION =================
     Suivi du sablier de l'outil hôte, motif PAINT : on relit la source toutes
     les 400 ms ; « 12 sur 30 », « 12/30 » et « 43 % » y sont reconnus. Zéro
     instrumentation des boucles : elles parlent déjà. */
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
    E.pct = pct;
    $("att-barre-int").style.width = pct + "%";
    if (phase) $("att-phase").textContent = phase;
    coloriser(pct);
    const aig = $("att-cadran-aig");                 // le cadran rond suit aussi
    if (aig) aig.setAttribute("transform", "rotate(" + (-140 + pct * 2.8) + ")");
  }

  /* ================= DONNÉES /api/veille =================
     Chaque type est indépendant ; une section sans donnée reste CACHÉE —
     l'écran d'attente ne montre jamais son échec. Seules les actus se
     rafraîchissent (5 min, aligné sur leur cache CDN). */
  function veille(type) {
    return fetch(BASE + "/api/veille?type=" + type)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  function chargerActus() {
    veille("actus").then((d) => {
      if (!d.titres || !d.titres.length) return;
      const html = d.titres.map((x) => `<b>${echap(x.s)}</b>${echap(x.t)}<i>◆</i>`).join("");
      const int = $("att-depeche-int");
      int.innerHTML = html;
      int.style.setProperty("--att-dur", Math.max(60, d.titres.length * 7) + "s");
      $("att-depeche").classList.add("on");
    }).catch(() => {});
  }

  function chargerClassements() {
    veille("classements").then((d) => {
      const l = d.ligue1 || d.classement || [];
      if (!l.length) return;
      $("att-c-classements-t").textContent = d.competition || "Ligue 1";
      const j = d.journee || d.matchday;
      $("att-c-classements-j").textContent = j ? "J. " + j : "";
      $("att-c-classements-b").innerHTML = l.map((x, i) => {
        const r = +(x.rang ?? i + 1);
        const genre = r <= 3 ? " podium" : r <= 6 ? " euro" : "";
        return `<tr><td><span class="att-rang${genre}">${r}</span></td>` +
          `<td class="equipe">${echap(String(x.equipe ?? ""))}</td>` +
          `<td class="pts">${x.points ?? ""}</td></tr>`;
      }).join("");
      $("att-c-classements").classList.add("on");
      ajuster();
    }).catch(() => {});
  }

  /* Culturel : les TROIS rubriques ensemble à chaque session (décision du
     01/09). Si /api/veille renvoie encore un simple d.titres, on retombe sur
     une rubrique unique plutôt que de cacher la carte. */
  function chargerCulturel() {
    veille("culturel").then((d) => {
      const rubs = [
        ["Au cinéma", d.cinema || d.cinéma],
        ["Arts", d.expos || d.expositions],
        ["Livres", d.livres],
      ].filter((r) => Array.isArray(r[1]) && r[1].length);
      let html = "";
      if (rubs.length) {
        html = rubs.map(([nom, liste]) =>
          `<div class="att-photo"><div class="att-rub-nom">${nom}</div><ul>` +
          liste.slice(0, 2).map((t) => `<li>${echap(typeof t === "string" ? t : t.t)}</li>`).join("") +
          `</ul></div>`).join("");
      } else if (d.titres && d.titres.length) {
        html = `<div class="att-photo"><div class="att-rub-nom">À l'affiche</div><ul>` +
          d.titres.slice(0, 5).map((t) => `<li>${echap(typeof t === "string" ? t : t.t)}</li>`).join("") +
          `</ul></div>`;
      } else return;
      $("att-c-culturel-corps").innerHTML = html;
      $("att-c-culturel").classList.add("on");
      ajuster();
    }).catch(() => {});
  }

  /* Compteurs : les 9 pays en grille SIMULTANÉE, chacun avec son drapeau
     (décision du 01/09 — plus de défilé, plus d'onglets). */
  function chargerCompteurs() {
    veille("compteurs").then((d) => {
      if (!d.pays || !d.pays.length) return;
      E.compteurs = d;
      E.roues = [];
      const grille = $("att-grille");
      grille.innerHTML = "";
      d.pays.forEach((p) => {
        const cell = document.createElement("div");
        cell.className = "att-pays";
        cell.innerHTML =
          `<div class="att-pays-tete">${drapeau(p.nom, p.code)}<span class="att-pays-nom">${echap(p.nom)}</span></div>` +
          `<div class="att-ligne"><span class="att-ligne-lib">hab.</span>` +
          `<span class="att-vitre"><span class="att-od-val"></span></span>` +
          fleche(p.popParSec, "Population en hausse", "Population en baisse") + `</div>` +
          `<div class="att-ligne"><span class="att-ligne-lib">dette</span>` +
          `<span class="att-vitre"><span class="att-od-val dette"></span><span class="att-od-suf"></span></span>` +
          fleche(-p.detteParSec, "Dette qui reflue", "Dette qui s'aggrave") + `</div>`;
        grille.appendChild(cell);
        const vals = cell.querySelectorAll(".att-od-val");
        E.roues.push({
          pays: p,
          pop: roue(vals[0], 3),
          dette: roue(vals[1], 3),
          suf: cell.querySelector(".att-od-suf"),
        });
      });
      $("att-c-compteurs").classList.add("on");
      tictacCompteurs(true);
      ajuster();
      clearInterval(E.compteursMinuterie);
      E.compteursMinuterie = setInterval(() => tictacCompteurs(false), 1000);
    }).catch(() => {});
  }
  /* Flèche de tendance. On passe la grandeur DÉJÀ orientée « le positif est
     une bonne nouvelle » : pour la dette, l'appelant envoie donc -detteParSec.
     Le vert monte, le rouge descend, un tiret gris pour une valeur nulle ou
     absente. Le taux ne bouge pas pendant une attente : on dessine une fois. */
  function fleche(bon, titreBon, titreMauvais) {
    const n = Number(bon);
    let genre = "plat", d = "M1 4.1h8v1.8H1z", titre = "Tendance inconnue";
    if (isFinite(n) && n > 0) { genre = "bon"; d = "M5 1.1L9.2 8.5H.8z"; titre = titreBon; }
    else if (isFinite(n) && n < 0) { genre = "mauvais"; d = "M5 8.9L.8 1.5h8.4z"; titre = titreMauvais; }
    return `<svg class="att-fleche ${genre}" viewBox="0 0 10 10" role="img" aria-label="${titre}">` +
      `<title>${titre}</title><path d="${d}"/></svg>`;
  }

  /* ================= TENIR À L'ÉCRAN =================
     Exigence du 02/09 : tout visible, aucun défilement. Plutôt que de rogner
     une carte — un chiffre coupé en deux est pire qu'un chiffre plus petit —
     on mesure ce que le corps réclame et on le réduit juste ce qu'il faut.
     offsetHeight ignore les transformations, donc la mesure reste stable et
     l'échelle ne peut pas s'auto-entretenir. Plancher à 0,58 : en dessous ce
     serait illisible, et mieux vaut alors déborder discrètement. */
  function ajuster() {
    const cadre = document.querySelector("#att-voile .att-cadre");
    const corps = $("att-corps");
    if (!cadre || !corps) return;
    const besoin = corps.offsetHeight, dispo = cadre.clientHeight;
    if (!besoin || !dispo) return;
    const z = Math.min(1, Math.max(.58, dispo / besoin));
    corps.style.setProperty("--att-z", z.toFixed(3));
  }

  function tictacCompteurs(saut) {
    if (!E.compteurs) return;
    const dt = (Date.now() - Date.parse(E.compteurs.reference)) / 1000;
    E.roues.forEach((r) => {
      const p = r.pays;
      r.pop.poser(p.population + p.popParSec * dt, saut);
      r.dette.poser(p.dette + p.detteParSec * dt, saut);
      if (r.suf.textContent !== (p.devise || "")) r.suf.textContent = p.devise || "";
    });
  }

  /* ================= TAMBOUR À CHIFFRES =================
     Les chiffres de tête sont du texte fixe ; seuls les `nRoul` derniers sont
     des bandes 0-9 translatées en transform (compositeur, pas de layout).
     Reconstruction uniquement quand la partie fixe change — soit à chaque
     retenue, c'est-à-dire rarement. */
  function roue(el, nRoul) {
    let cols = [], fixe = null;
    function sep() { const s = document.createElement("span"); s.className = "att-od-sep"; return s; }
    function batir(s) {
      el.innerHTML = "";
      cols = [];
      const L = s.length;
      for (let i = 0; i < L; i++) {
        if (i && (L - i) % 3 === 0) el.appendChild(sep());
        if (L - i <= nRoul) {
          const col = document.createElement("span"); col.className = "att-od-col";
          const strip = document.createElement("span"); strip.className = "att-od-strip";
          for (let d = 0; d <= 9; d++) { const c = document.createElement("span"); c.textContent = d; strip.appendChild(c); }
          col.appendChild(strip); el.appendChild(col); cols.push(strip);
        } else {
          const st = document.createElement("span"); st.className = "att-od-fixe";
          st.textContent = s[i]; el.appendChild(st);
        }
      }
    }
    return {
      poser(n, saut) {
        const s = String(Math.max(0, Math.round(n)));
        const tete = s.slice(0, Math.max(0, s.length - nRoul));
        if (tete !== fixe) { batir(s); fixe = tete; saut = true; }
        const roul = s.slice(-nRoul);
        for (let i = 0; i < cols.length && i < roul.length; i++) {
          const c = cols[i];
          if (saut) c.style.transition = "none";
          c.style.transform = "translateY(-" + (+roul[i] * 1.2) + "em)";
          if (saut) requestAnimationFrame(() => { c.style.transition = ""; });
        }
      },
    };
  }

  /* ================= CADRAN RADIO =================
     Vieux poste horizontal : aiguille sur échelle graduée, cinq crans dont
     « silence » à gauche. Silence au lancement, sans mémorisation. Un
     grésillement de bande passante accompagne chaque déplacement — c'est le
     seul son que le module produise lui-même. */
  let ctxAudio = null, bruitSrc = null;
  function ctx() {
    if (!ctxAudio) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctxAudio = new A();
    }
    if (ctxAudio.state === "suspended") ctxAudio.resume().catch(() => {});
    return ctxAudio;
  }
  function bruitBuffer(a, secondes) {
    const n = Math.floor(a.sampleRate * secondes);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function chaineBruit(a, boucle) {
    const src = a.createBufferSource();
    src.buffer = bruitBuffer(a, boucle ? 1 : .45);
    src.loop = !!boucle;
    const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1750; bp.Q.value = .8;
    const g = a.createGain(); g.gain.value = 0.0001;
    src.connect(bp).connect(g).connect(a.destination);
    return { src, g };
  }
  function gresiller() {                       // souffle court : saut de cran
    const a = ctx(); if (!a) return;
    try {
      const { src, g } = chaineBruit(a, false);
      const t = a.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(.075, t + .05);
      g.gain.exponentialRampToValueAtTime(.0001, t + .42);
      src.start(); src.stop(t + .45);
    } catch (e) {}
  }
  function gresillerDebut() {                  // souffle tenu : aiguille tirée
    const a = ctx(); if (!a || bruitSrc) return;
    try {
      const { src, g } = chaineBruit(a, true);
      g.gain.linearRampToValueAtTime(.06, a.currentTime + .12);
      src.start();
      bruitSrc = { src, g };
    } catch (e) {}
  }
  function gresillerFin() {
    if (!bruitSrc || !ctxAudio) { bruitSrc = null; return; }
    try {
      const t = ctxAudio.currentTime;
      bruitSrc.g.gain.linearRampToValueAtTime(.0001, t + .1);
      bruitSrc.src.stop(t + .15);
    } catch (e) {}
    bruitSrc = null;
  }

  function construireCadran() {
    const crans = $("att-crans"), echelle = $("att-echelle");
    CRANS.forEach((r, i) => {
      const b = document.createElement("button");
      b.className = "att-cran";
      b.type = "button";
      b.textContent = i === 0 ? "—" : r.nom;
      b.style.left = posCran(i) + "%";
      b.dataset.i = i;
      b.title = i === 0 ? "Couper le son" : "Écouter " + r.nom;
      b.onclick = (ev) => { ev.stopPropagation(); allerAuCran(i); };
      crans.appendChild(b);
    });

    // glissement de l'aiguille : le geste du poste, pointeur ou doigt
    let actif = false;
    const ratioDe = (ev) => {
      const r = echelle.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    };
    echelle.addEventListener("pointerdown", (ev) => {
      actif = true;
      echelle.setPointerCapture(ev.pointerId);
      $("att-aiguille").classList.add("libre");
      radioArreter(); majEtat("Recherche…");
      gresillerDebut();
      poserAiguille(ratioDe(ev));
    });
    echelle.addEventListener("pointermove", (ev) => { if (actif) poserAiguille(ratioDe(ev)); });
    const relacher = (ev) => {
      if (!actif) return;
      actif = false;
      $("att-aiguille").classList.remove("libre");
      gresillerFin();
      allerAuCran(cranLePlusProche(E.ratio), true);
    };
    echelle.addEventListener("pointerup", relacher);
    echelle.addEventListener("pointercancel", relacher);
    echelle.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { allerAuCran(Math.min(CRANS.length - 1, E.cran + 1)); ev.preventDefault(); }
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { allerAuCran(Math.max(0, E.cran - 1)); ev.preventDefault(); }
      if (ev.key === "Home") { allerAuCran(0); ev.preventDefault(); }
    });

    poserAiguille(posCran(0) / 100);
  }
  function posCran(i) { return ((i + .5) / CRANS.length) * 100; }
  function cranLePlusProche(ratio) {
    let best = 0, d = 9;
    CRANS.forEach((_, i) => { const e = Math.abs(posCran(i) / 100 - ratio); if (e < d) { d = e; best = i; } });
    return best;
  }
  function poserAiguille(ratio) {
    E.ratio = ratio;
    const echelle = $("att-echelle");
    const px = ratio * echelle.clientWidth;
    $("att-aiguille").style.transform = "translateX(" + px.toFixed(1) + "px)";
  }
  function majEtat(txt) { const e = $("att-poste-etat"); if (e) e.textContent = txt; }
  function majCrans() {
    document.querySelectorAll("#att-crans .att-cran").forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle("on", i === E.cran);
      b.classList.toggle("morte", !!E.mortes[CRANS[i].nom]);
    });
    $("att-echelle").setAttribute("aria-valuenow", E.cran);
    $("att-poste").classList.toggle("joue", !!E.radioNom);
  }
  function allerAuCran(i, sansSouffle) {
    const r = CRANS[i];
    E.cran = i;
    poserAiguille(posCran(i) / 100);
    if (!sansSouffle) gresiller();
    if (!r.url) { radioArreter(); majEtat("Silence"); majCrans(); return; }
    majEtat("Recherche de " + r.nom + "…");
    majCrans();
    radioDemarrer(r).then((ok) => {
      if (ok) majEtat(r.nom);
      else {
        E.mortes[r.nom] = true;
        majEtat(r.nom + " ne répond pas");
        E.cran = 0; poserAiguille(posCran(0) / 100);
      }
      majCrans();
    });
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
    const p = $("att-poste"); if (p) p.classList.remove("joue");
  }

  /* ================= API PUBLIQUE ================= */
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
    appliquer(0, null);

    // l'aiguille repart au silence à chaque attente : aucune station retenue
    E.cran = 0; E.mortes = {};
    radioArreter(); majEtat("Silence"); majCrans();
    requestAnimationFrame(() => { poserAiguille(posCran(0) / 100); ajuster(); });

    E.source = opts.source || null;
    clearInterval(E.minuterie);
    if (E.source) E.minuterie = setInterval(lireSource, 400);

    chargerActus(); chargerClassements(); chargerCulturel(); chargerCompteurs();
    clearInterval(E.actusMinuterie);
    E.actusMinuterie = setInterval(chargerActus, 5 * 60 * 1000);
  }

  function progression(pct, phase) { if (E.on) appliquer(pct, phase || null); }

  function terminer() {
    if (!E.on) return;
    const v = $("att-voile");
    appliquer(100, "Terminé");
    v.classList.add("fin");
    gresillerFin();
    radioArreter(); E.cran = 0; majEtat("Silence"); majCrans();  // la radio se coupe TOUJOURS à la fin
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

  window.addEventListener("resize", () => { if (E.on) { poserAiguille(E.ratio); ajuster(); } });

  window.ATTENTE = { demarrer, progression, terminer, echec, version: "1.5-pleine-largeur" };
})();
