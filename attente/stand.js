/* ============================================================
   ATTENTE — stand de tir  (v4.0, pixel art façon Duck Hunt)
   Module autonome, zéro dépendance, aucune image externe.
   API :
     ATT_STAND.monter(hote) / progression(0..1) / arreter() / demonter()
   Aucun son : la radio reste seule source audio.

   ── v2.0 (02/09/2026) — CHANGEMENT DE TECHNIQUE ────────────────
   Abandon du dessin vectoriel « réaliste » après quatre tentatives.
   Le constat : un canard tracé à la main en courbes de Bézier ne
   ressemblera jamais à un canard photographié, et chaque version se
   jugeait donc à l'aune d'un objectif inatteignable. Le pixel art
   règle le problème par le haut — il assume ce qu'il est, personne
   n'attend d'un sprite qu'il ressemble à une photo — et le registre
   colle au module : ATTENTE est déjà peuplé d'objets (poste de radio
   à cadran, bande de pellicule, compteur à tambours), un jeu
   d'arcade de 1985 appartient à cette famille.

   Conséquences techniques :
     • sprites = cartes de caractères, une lettre par pixel, converties
       en <rect>. Les pixels contigus d'une même ligne sont FUSIONNÉS :
       un canard fait ~45 nœuds, pas 330.
     • l'animation ne passe plus par des rotations CSS mais par
       CHANGEMENT DE POSE : les trois poses d'aile coexistent dans le
       SVG, une animation d'opacité en steps() les alterne. Rien à
       calculer en JS à chaque image.
     • échelles ENTIÈRES uniquement, shape-rendering="crispEdges" et
       image-rendering:pixelated : à l'échelle 2,5 un sprite bave.
   ============================================================ */
(function () {
  'use strict';

  var C = {
    nuit: '#0F2238', canard: '#33838B', cyan: '#6DD5DC',
    jauneForme: '#FFE764', jauneTexte: '#FFC900'
  };

  /* ============================================================
     1. MOTEUR DE SPRITES
     ============================================================ */
  function runs(carte, pal, dx, dy) {
    var r = '', X = dx || 0, Y = dy || 0;
    for (var y = 0; y < carte.length; y++) {
      var L = carte[y], x = 0;
      while (x < L.length) {
        var c = L.charAt(x);
        if (c === '.') { x++; continue; }
        var n = 1;
        while (x + n < L.length && L.charAt(x + n) === c) n++;
        r += '<rect x="' + (x + X) + '" y="' + (y + Y) + '" width="' + n
           + '" height="1" fill="' + pal[c] + '"/>';
        x += n;
      }
    }
    return r;
  }
  /* ⚠ UNE SEULE TAILLE DE PIXEL dans toute la scène. Le décor et les sprites
     doivent partager la même grille, sinon l'oiseau a un grain plus fin que le
     paysage et l'illusion tombe. Ici : 3 pixels d'écran par pixel de sprite,
     donc un décor de 189 x 99 pour un ciel de 568 x 296, et TOUTES les espèces
     à l'échelle 3 — en pixel art on ne réduit pas le pixel pour faire un
     canard plus petit, on lui dessine un sprite plus petit. */
  function svgPx(W, H, corps, ech) {
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + (W * ech)
      + '" height="' + (H * ech) + '" shape-rendering="crispEdges"'
      + ' xmlns="http://www.w3.org/2000/svg">' + corps + '</svg>';
  }

  /* ============================================================
     2. CANARDS — 22 x 20, vol vers la DROITE.
        Géométrie commune, palette par espèce : c'est ainsi que
        procédait Duck Hunt, qui n'avait qu'un canard et trois jeux
        de couleurs. Le bec du souchet est noir, celui du colvert jaune :
        à trois pixels par unité, la forme du bec ne se lirait pas, la couleur si.
     ============================================================ */
  /* Corps : poitrail rond à l'avant, queue effilée à l'arrière, tête et bec
     agrandis, et le collier blanc du colvert entre poitrail et tête. 24 x 9,
     posé à l'ordonnée 9 du sprite — les rangs 0 à 8 sont réservés à l'aile. */
  /* Corps : silhouette très CONTRASTÉE, à la Duck Hunt — corps sombre ou
     saturé, ventre blanc, tête verte, bec orange. Mes canards gris se
     perdaient sur le ciel ; ici chaque espèce se reconnaît d'un coup d'œil.
     26 x 9, posé à l'ordonnée 9 — les rangs 0 à 8 sont pour l'aile. */
  /* ⚠ BASSE RÉSOLUTION, c'était la clef. Un canard de 16 pixels de large
     affiché à 6 px par pixel, pas de 26 pixels à 3 px : c'est la grosseur du
     pixel qui fait la NES, pas la quantité de détail. À chaque itération
     j'ajoutais du détail, donc je m'éloignais de la référence.
     16 x 18 : aile rangs 0-5, corps rangs 6-12, aile basse rangs 13-17. */
  var CORPS = [
    '..KKKKKKK.......',
    '.KKBBBBBBKKK....',
    'KAABBBBBBBTTTK..',
    'KAAKBBBBBBTNTKYY',
    '.KKKVVVVVBTTTKYY',
    '..KKVVVVVKTTTK..',
    '....KKKKKKKKK...'
  ];
  var AILE_HAUTE = [
    '....KK..........',
    '...KAAK.........',
    '...KAAK.........',
    '..KAAAK.........',
    '..KAAoK.........',
    '..KAAoK.........'
  ];
  var AILE_MI = [
    '................',
    '.KKK............',
    'KAAAK...........',
    'KAAoAK..........',
    '.KAAoAK.........',
    '..KKAAoK........'
  ];
  var AILE_BASSE = [
    '................','................','................',
    '................','................','................'
  ];
  var AILE_BASSE_BAS = [
    '..KKAAoK........',
    '.KAAoAK.........',
    'KAAoAK..........',
    'KAAAK...........',
    '.KKK............'
  ];
  var MORT = [
    '..KKKKKKK.......',
    '.KKBBAAABBKKK...',
    'KAABAAAAABTTTK..',
    'KAAKAAAAABTKTKYY',
    '.KKKVVVVVBTTTKYY',
    '..KKVVVVVKTTTK..',
    '....KKKKKKKKK...'
  ];

  var ESPECES = {
    colvert: { nom: 'Colvert', points: 1, ech: 6, vitesse: 1.00, poids: 50,
      teinte: '#1D7A3E',
      pal: { K:'#000000', B:'#181818', V:'#FCFCFC', A:'#FCFCFC', o:'#BCBCBC',
             T:'#00A844', N:'#FCFCFC', Y:'#FC9838' } },
    souchet: { nom: 'Souchet', points: 2, ech: 6, vitesse: 1.18, poids: 30,
      teinte: '#A8531F',
      pal: { K:'#000000', B:'#0058F8', V:'#FCFCFC', A:'#FCFCFC', o:'#A4C8FC',
             T:'#00A844', N:'#FCFCFC', Y:'#FC9838' } },
    sarcelle: { nom: 'Sarcelle', points: 3, ech: 6, vitesse: 1.45, poids: 20,
      teinte: '#7A3B22',
      pal: { K:'#000000', B:'#A81000', V:'#FCFCFC', A:'#FCFCFC', o:'#F0A0A0',
             T:'#503000', N:'#FCFCFC', Y:'#FC9838' } },
    mandarin: { nom: 'Mandarin', points: 5, ech: 6, vitesse: 3.40, poids: 0,
      teinte: '#D9772B',
      pal: { K:'#000000', B:'#F87800', V:'#FCFCFC', A:'#FCE0A0', o:'#D89020',
             T:'#00A844', N:'#FCFCFC', Y:'#F83800' } }
  };

  function canardSVG(e) {
    var corps = runs(CORPS, e.pal, 0, 6);
    return svgPx(16, 18, ''
      + '<g class="att-f0">' + runs(AILE_HAUTE, e.pal) + corps + '</g>'
      + '<g class="att-f1">' + runs(AILE_MI, e.pal) + corps + '</g>'
      + '<g class="att-f2">' + runs(AILE_BASSE, e.pal) + corps
        + runs(AILE_BASSE_BAS, e.pal, 0, 13) + '</g>', e.ech);
  }
  function canardFixe(e, ech) {
    return svgPx(16, 18, runs(AILE_HAUTE, e.pal) + runs(CORPS, e.pal, 0, 6), ech || e.ech);
  }
  function canardMortSVG(e, ech) {
    return svgPx(16, 7, runs(MORT, e.pal), ech || e.ech);
  }

  /* ============================================================
     3. LE CHIEN — 34 x 24, profil vers la droite, sol à y=23.
        Deux poses de trot, alternées par la même mécanique
        d'opacité que les ailes. Gueule autour de (24,13).
     ============================================================ */
  /* Chien de Duck Hunt : orange, oreille noire tombante, gros œil, museau
     blanc à truffe noire, queue dressée. 32 x 22, sol à y=21, gueule vers
     (28,12). Mon springer réaliste jurait avec le reste de la scène. */
  /* Chien DE FACE, qui JAILLIT des herbes en brandissant ses canards, puis y
     replonge. C'est l'image mentale de Duck Hunt, et je l'avais manquée : mon
     chien traversait la scène de profil comme dans un jeu de plateforme,
     alors que celui du jeu surgit et se présente au joueur.
     38 x 18. Trois points d'accroche pour les canards : la gueule d'abord,
     puis les deux pattes. */
  var PAL_CHIEN = { K:'#000000', O:'#E45C10', o:'#A83800', W:'#FCFCFC', R:'#C43B2E' };
  var CHIEN_FACE = [
    '...........KK..........KK.............',
    '..........KooK........KooK............',
    '..........KoooKKKKKKKKoooK............',
    '..........KoooOOOOOOOOoooK............',
    '..........KoooOOOOOOOOoooK............',
    '..........KooOWKOOOOKWOooK............',
    '..........KooOKWOOOOWKOooK............',
    '...........KoOOOOOOOOOOoK.............',
    '...KKK.....KOOOOWWWWOOOOK.....KKK.....',
    '..KOOOK....KOOOWWWWWWOOOK....KOOOK....',
    '..KOOOOK....KOWWWKKWWWOK....KOOOOK....',
    '..KOOOOOKKKKKOWWWKKWWWOKKKKKOOOOOK....',
    '..KoOOOOOOOOOOKWWWWWWWWKOOOOOOOOoK....',
    '...KoooOOOOOOOKKWWRRWWKKOOOOOOooK.....',
    '.....KKKoooOOOOKKKKKKOOOOoooKKK.......',
    '........KKKKoooOOOOOOoooKKKK..........',
    '............KKKKKKKKKKKK..............',
    '......................................'
  ];
  var ANCRES = [[13, 11], [-2, 7], [24, 7]];
  function chienSVG(ech) {
    return svgPx(38, 18, runs(CHIEN_FACE, PAL_CHIEN)
      + '<g class="att-prise"></g>', ech);
  }

  /* ============================================================
     4. DÉCOR — en pixels, mais GÉNÉRÉ : une carte de caractères
        pour un ciel entier ferait mille lignes pour un résultat
        qu'on ne peut plus retoucher.
     ============================================================ */
  /* Décor : ciel bleu UNI, large bande d'herbe à touffes, un arbre au tronc
     rouge-brun coiffé de bouquets ronds, deux buissons. 94 x 50 unités pour
     564 x 300 px, soit 6 px par pixel comme les sprites.
     Les ronds sont des pastilles de pixels et non des cercles SVG : sur une
     grille, un cercle lissé trahit immédiatement. */
  /* Bande d'herbe redessinée EN PREMIER PLAN, par-dessus le chien : c'est
     elle qui le masque à mi-corps quand il jaillit. Les canards tombés, eux,
     passent au-dessus d'elle — sinon ils disparaîtraient dans l'herbe. */
  function herbeAvant(W, H) {
    var s = rect(0, 0, W, H, PAL_DEC.herbe) + rect(0, H - 3, W, 3, PAL_DEC.herbeF);
    for (var x = 0; x < W; x += 3) {
      var h = 2 + ((x * 7) % 3);
      s += rect(x, -h, 2, h, PAL_DEC.herbe) + rect(x + 1, -h + 1, 1, h - 1, PAL_DEC.herbeF);
    }
    for (var t = 0; t < 16; t++) {
      s += rect((t * 11) % W, 2 + ((t * 5) % 8), 2, 1, PAL_DEC.herbeF);
    }
    return s;
  }

  function rect(x, y, w, h, f) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
      + '" fill="' + f + '"/>';
  }
  /* Pastille de pixels : une ellipse rendue en rangées de rectangles. Un
     <circle> SVG serait lissé, et un bord lissé trahit la grille aussitôt. */
  function blob(cx, cy, rx, ry, f) {
    var s = '';
    for (var dy = -ry; dy <= ry; dy++) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      if (w > 0) s += rect(cx - w, cy + dy, w * 2, 1, f);
    }
    return s;
  }
  var PAL_DEC = {ciel:'#6BC0F0',herbe:'#58D858',herbeF:'#00A844',herbeO:'#007828',
   tronc:'#B53120',troncO:'#7C1C10',feuille:'#58D858',feuilleF:'#00A844'};
  
  /* Scene BASSE RESOLUTION : 94 x 50 unites pour 564 x 300 px, soit 6 px par
     pixel. C'etait la clef : mes 189 x 99 donnaient des pixels de 3 px, un
     dessin fin, et donc du pixel art moderne au lieu de la NES. */
  function decor(W,H){
    var s=rect(0,0,W,H,PAL_DEC.ciel);
    var yH=H-14;
    s+=rect(0,yH,W,H-yH,PAL_DEC.herbe);
    s+=rect(0,H-3,W,3,PAL_DEC.herbeF);
    for(var x=0;x<W;x+=3){var h=2+((x*7)%3);s+=rect(x,yH-h,2,h,PAL_DEC.herbe)+rect(x+1,yH-h+1,1,h-1,PAL_DEC.herbeF);}
    for(var t=0;t<16;t++){var tx=(t*11)%W;s+=rect(tx,yH+2+((t*5)%8),2,1,PAL_DEC.herbeF);}
    var ax=Math.round(W*0.28),sol=yH+2;
    s+=rect(ax-2,sol-14,4,14,PAL_DEC.tronc)+rect(ax+1,sol-14,1,14,PAL_DEC.troncO);
    s+=rect(ax-5,sol-12,3,2,PAL_DEC.tronc)+rect(ax+2,sol-13,3,2,PAL_DEC.tronc);
    s+=blob(ax,sol-20,11,6,PAL_DEC.feuilleF);
    s+=blob(ax-9,sol-16,6,4,PAL_DEC.feuilleF);
    s+=blob(ax+9,sol-17,7,4,PAL_DEC.feuilleF);
    s+=blob(ax-2,sol-23,8,4,PAL_DEC.feuille);
    s+=blob(ax+7,sol-18,5,3,PAL_DEC.feuille);
    [[Math.round(W*0.62),5,3],[Math.round(W*0.86),4,2]].forEach(function(b){
      s+=blob(b[0],yH+1,b[1],b[2],PAL_DEC.herbeF);});
    return s;
  }

  /* ============================================================
     5. STYLES
     ============================================================ */
  var CSS = ''
    /* ⚠ ancrage par la DROITE (inset: auto 12px 12px auto). L'hôte #att-coin
       est un point sans dimension posé dans le coin bas-droit de la trame :
       ancrée par la gauche, l'icône s'étendait vers l'extérieur et sortait du
       cadre. Par la droite, elle rentre. */
    + '.att-stand{position:absolute;inset:auto 12px 12px auto;z-index:40;'
      + 'font-family:"Segoe UI",system-ui,sans-serif;white-space:nowrap}'
    /* ⚠ L'icône ne bouge PAS et ne rétrécit PAS à l'ouverture. Réduite et
       glissée sous la carte, elle devenait introuvable — et c'est le seul
       moyen de replier le stand. Elle porte donc aussi son intitulé. */
    + '.att-stand-icone{display:flex;align-items:center;gap:8px;padding:5px 11px 5px 7px;'
      + 'border-radius:10px;background:' + C.nuit + ';border:1.5px solid ' + C.cyan + ';'
      + 'cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);'
      + 'font:600 11.5px/1 "Segoe UI",sans-serif;letter-spacing:.6px;color:' + C.cyan + '}'
    + '.att-stand-icone svg{display:block;image-rendering:pixelated;flex:0 0 auto}'
    + '.att-stand-icone:hover{border-color:' + C.jauneForme + '}'
    + '.att-stand-icone:focus-visible{outline:2px solid ' + C.jauneForme + ';outline-offset:2px}'
    + '.att-stand[data-ouvert="1"] .att-stand-icone{border-color:' + C.jauneForme + ';'
      + 'color:' + C.jauneForme + '}'

    /* ⚠ La carte est accrochée au CORPS DU DOCUMENT, pas à l'icône.
       Deux raisons, et la seconde est un piège :
       1. ancrée sur l'icône — donc dans le coin de la trame —, elle grandissait
          vers le haut et recouvrait la trame, qui doit rester visible comme
          jauge de progression ;
       2. surtout, un position:fixed cesse de se référer à la FENÊTRE dès qu'un
          ancêtre porte un transform. Or attente.js met son bloc central à
          l'échelle avec un scale() : la carte se plaçait par rapport à ce bloc
          et atterrissait n'importe où. Hors de cet arbre, plus de problème. */
    + '.att-stand-carte{position:fixed;left:50%;transform:translateX(-50%);bottom:118px;'
      /* ⚠ AU-DESSUS du voile d'ATTENTE, qui est en z-index 99999 avec un fond
         opaque. Accrochée au corps du document, la carte passait dessous et
         devenait invisible alors qu'elle était bien là. */
      + 'z-index:100050;width:min(567px,calc(100vw - 32px));'
      + 'border-radius:12px;overflow:hidden;background:' + C.nuit + ';'
      + 'border:1.5px solid ' + C.canard + ';box-shadow:0 18px 44px rgba(0,0,0,.55);display:none}'
    + '.att-stand-carte.att-on{display:block}'
    + '.att-stand[data-ouvert="1"] .att-stand-carte{display:block}'
    + '.att-stand-tete{display:flex;align-items:baseline;justify-content:space-between;'
      + 'gap:12px;padding:7px 12px 5px;border-bottom:1px solid rgba(109,213,220,.25)}'
    + '.att-stand-tete h4{margin:0;font-family:Georgia,serif;font-size:15px;'
      + 'font-weight:600;color:#EAF2F3}'
    + '.att-stand-score{font-family:Georgia,serif;font-size:22px;color:' + C.jauneTexte + ';'
      + 'font-variant-numeric:tabular-nums;line-height:1}'
    + '.att-stand-score span{font-size:11px;font-family:"Segoe UI",sans-serif;'
      + 'color:' + C.cyan + ';margin-left:4px}'

    + '.att-ciel{position:relative;overflow:hidden;cursor:crosshair;line-height:0;height:300px}'
    + '.att-fond{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
      + 'image-rendering:pixelated}'

    + '.att-canard{position:absolute;left:0;top:0;will-change:transform;cursor:crosshair;line-height:0}'
    + '.att-canard svg{display:block;image-rendering:pixelated}'
    /* changement de pose par opacité en steps : les trois poses sont dans le
       même SVG, rien à calculer en JS à chaque image */
    + '.att-f0{animation:att-p0 .27s steps(1,end) infinite}'
    + '.att-f1{animation:att-p1 .27s steps(1,end) infinite}'
    + '.att-f2{animation:att-p2 .27s steps(1,end) infinite}'
    + '@keyframes att-p0{0%,33.3%{opacity:1}33.4%,100%{opacity:0}}'
    + '@keyframes att-p1{0%,33.3%{opacity:0}33.4%,66.6%{opacity:1}66.7%,100%{opacity:0}}'
    + '@keyframes att-p2{0%,66.6%{opacity:0}66.7%,100%{opacity:1}}'

    + '.att-chien{position:absolute;left:0;top:0;will-change:transform;'
      + 'pointer-events:none;z-index:3;line-height:0}'
    + '.att-avant{position:absolute;left:0;right:0;bottom:0;z-index:5;'
      + 'pointer-events:none;image-rendering:pixelated}'
    + '.att-canard.att-gisant{z-index:6}'
    + '.att-chien svg{display:block;image-rendering:pixelated}'
    + '.att-chien .att-f0{animation:att-c0 .3s steps(1,end) infinite}'
    + '.att-chien .att-f1{animation:att-c1 .3s steps(1,end) infinite}'
    + '@keyframes att-c0{0%,50%{opacity:1}50.1%,100%{opacity:0}}'
    + '@keyframes att-c1{0%,50%{opacity:0}50.1%,100%{opacity:1}}'
    + '.att-chien.att-arret .att-f0{animation:none;opacity:1}'
    + '.att-chien.att-arret .att-f1{animation:none;opacity:0}'

    /* croix d'impact en pixels, pas un cercle : on est en pixel art */
    + '.att-impact{position:absolute;width:15px;height:15px;margin:-7px 0 0 -7px;'
      + 'pointer-events:none;background:' + C.jauneForme + ';'
      + 'animation:att-impact .3s steps(3,end) forwards;'
      + 'clip-path:polygon(40% 0,60% 0,60% 40%,100% 40%,100% 60%,60% 60%,'
      + '60% 100%,40% 100%,40% 60%,0 60%,0 40%,40% 40%)}'
    + '@keyframes att-impact{from{transform:scale(.5);opacity:1}to{transform:scale(1.6);opacity:0}}'
    + '.att-gain{position:absolute;font-family:Georgia,serif;font-size:17px;font-weight:700;'
      + 'color:' + C.jauneTexte + ';text-shadow:0 2px 0 rgba(0,0,0,.75);pointer-events:none;'
      + 'animation:att-gain .8s steps(8,end) forwards}'
    + '@keyframes att-gain{from{transform:translateY(0);opacity:1}to{transform:translateY(-26px);opacity:0}}'

    + '.att-bareme{display:flex;gap:14px;flex-wrap:wrap;padding:6px 12px 7px 58px;'
      + 'border-top:1px solid rgba(109,213,220,.25);font-size:11.5px;color:#BFD4D7}'
    + '.att-bareme b{color:#EAF2F3;font-weight:600}'
    + '.att-bareme i{width:9px;height:9px;display:inline-block;margin-right:5px}'

    + '@media (prefers-reduced-motion:reduce){'
      + '.att-f0,.att-f1,.att-f2{animation-duration:.9s}'
      + '.att-chien .att-f0,.att-chien .att-f1{animation-duration:.9s}}';

  /* ============================================================
     6. MOTEUR DE JEU
     ============================================================ */
  var hote = null, racine = null, carte = null, ciel = null, elScore = null;
  var canards = [], gisants = [];
  var score = 0, p = 0, ouvert = false, raf = null;
  var dernier = 0, prochainTir = 0, dernierRare = -1e9, horloge = 0;
  var MAX_PRISES = 3, SOL = 80;   // hauteur de la bande d'herbe, en px

  function lerp(a, b, t) { return a + (b - a) * t; }
  function alea(a, b) { return a + Math.random() * (b - a); }

  function styles() {
    if (document.getElementById('att-stand-css')) return;
    var s = document.createElement('style');
    s.id = 'att-stand-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function construire() {
    styles();
    racine = document.createElement('div');
    racine.className = 'att-stand';
    racine.setAttribute('data-ouvert', '0');
    var puce = function (k) {
      return '<span><i style="background:' + ESPECES[k].teinte + '"></i>'
        + ESPECES[k].nom + ' <b>' + ESPECES[k].points + '</b></span>';
    };
    racine.innerHTML = ''
      + '<button class="att-stand-icone" type="button" aria-label="Ouvrir le stand de tir">'
      +   canardFixe(ESPECES.colvert, 3) + '<span>Stand de tir</span></button>';

    carte = document.createElement('div');
    carte.className = 'att-stand-carte';
    carte.setAttribute('role', 'group');
    carte.setAttribute('aria-label', 'Stand de tir');
    carte.innerHTML = ''
      + '<div class="att-stand-tete"><h4>Stand de tir</h4>'
      +   '<div class="att-stand-score">0<span>points</span></div></div>'
      + '<div class="att-ciel">'
      +   '<svg class="att-fond" viewBox="0 0 94 50" preserveAspectRatio="none"'
      +     ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"></svg>'
      +   '<svg class="att-avant" viewBox="0 0 94 14" preserveAspectRatio="none"'
      +     ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"></svg>'
      + '</div>'
      + '<div class="att-bareme">' + puce('colvert') + puce('souchet')
      +   puce('sarcelle') + puce('mandarin') + '</div>';

    ciel = carte.querySelector('.att-ciel');
    elScore = carte.querySelector('.att-stand-score');
    ciel.querySelector('.att-fond').innerHTML = decor(94, 50);
    ciel.querySelector('.att-avant').innerHTML = herbeAvant(94, 14);
    ciel.querySelector('.att-avant').style.height = (14 * 6) + 'px';

    racine.querySelector('.att-stand-icone')
      .addEventListener('click', function () { ouvert ? replier() : deplier(); });
    ciel.addEventListener('pointerdown', tir);
    hote.appendChild(racine);
    document.body.appendChild(carte);
  }

  function deplier() {
    ouvert = true;
    racine.setAttribute('data-ouvert', '1');
    carte.classList.add('att-on');
    var b = racine.querySelector('.att-stand-icone');
    b.querySelector('span').textContent = 'Replier';
    b.setAttribute('aria-label', 'Replier le stand de tir');
    dernier = performance.now();
    prochainTir = 0.8;
    if (!raf) boucle();
  }
  function replier() {
    /* le score est conservé tant que la génération tourne : on gèle la
       partie, on ne la remet pas à zéro */
    ouvert = false;
    racine.setAttribute('data-ouvert', '0');
    carte.classList.remove('att-on');
    var b = racine.querySelector('.att-stand-icone');
    b.querySelector('span').textContent = 'Stand de tir';
    b.setAttribute('aria-label', 'Ouvrir le stand de tir');
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function lacher(rare) {
    var W = ciel.clientWidth, H = ciel.clientHeight;
    if (!W || !H) return;
    var cle;
    if (rare) cle = 'mandarin';
    else {
      var total = 0, k;
      for (k in ESPECES) total += ESPECES[k].poids;
      var d = Math.random() * total;
      for (k in ESPECES) { d -= ESPECES[k].poids; if (d <= 0) { cle = k; break; } }
    }
    var e = ESPECES[cle];
    var dir = Math.random() < .62 ? 1 : -1;
    var l = 16 * e.ech, h = 18 * e.ech;
    var base = alea(H * .05, Math.max(0, H - SOL - h));
    var el = document.createElement('div');
    el.className = 'att-canard';
    el.innerHTML = canardSVG(e);
    ciel.appendChild(el);
    var c = { el: el, esp: e, dir: dir, l: l, h: h,
      x: dir === 1 ? -l - 8 : W + 8, y: base, base: base,
      v: e.vitesse * lerp(96, 178, p) * (rare ? 1 : alea(.9, 1.1)), vy: 0,
      amp: rare ? alea(5, 11) : alea(11, 24), per: alea(1.5, 2.6),
      ph: Math.random() * 6.28, touche: false, gisant: false, reserve: false };
    el.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); toucher(c, ev); });
    canards.push(c);
    poser(c);
  }
  /* positions ARRONDIES : un sprite posé sur un demi-pixel bave */
  function poser(c) {
    c.el.style.transform = 'translate3d(' + Math.round(c.x) + 'px,' + Math.round(c.y)
      + 'px,0) scaleX(' + (c.dir === 1 ? 1 : -1) + ')';
  }

  function toucher(c, ev) {
    if (c.touche) return;
    c.touche = true;
    c.vy = 40;
    c.el.innerHTML = canardFixe(c.esp);   // ailes hautes figées, comme dans Duck Hunt
    score += c.esp.points;
    elScore.innerHTML = score + '<span>points</span>';
    marque(ev, '+' + c.esp.points);
  }
  function pastille(ev, cls, txt, duree) {
    var r = ciel.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = cls;
    if (txt) d.textContent = txt;
    d.style.left = (ev.clientX - r.left - (txt ? 8 : 0)) + 'px';
    d.style.top = (ev.clientY - r.top - (txt ? 14 : 0)) + 'px';
    ciel.appendChild(d);
    setTimeout(function () { d.remove(); }, duree);
  }
  function tir(ev) { pastille(ev, 'att-impact', '', 320); }
  function marque(ev, txt) { pastille(ev, 'att-gain', txt, 820); }

  /* ---------- le chien ----------
     Il attend caché derrière l'herbe. Dès qu'un canard gît, il JAILLIT à
     l'endroit de la chute en brandissant jusqu'à TROIS oiseaux, les montre
     une seconde et demie, puis replonge dans les herbes.

     Cette mise en scène remplace l'ancienne, où le chien traversait la scène
     de profil et rentrait par un bord. Elle rend caduque la règle des deux
     chiens simultanés décidée pour l'ancienne : en rafale, le même chien
     enchaîne simplement un second bond dès qu'il est redescendu. */
  var chien = null;

  function retirer(g) {
    var i = gisants.indexOf(g); if (i >= 0) gisants.splice(i, 1);
    var j = canards.indexOf(g); if (j >= 0) canards.splice(j, 1);
    if (g.el) g.el.remove();
  }

  function creerChien() {
    var pris = gisants.slice(0, MAX_PRISES);
    if (!pris.length) return;
    var sx = 0;
    for (var i = 0; i < pris.length; i++) sx += pris[i].x + pris[i].l / 2;
    sx /= pris.length;
    var W = ciel.clientWidth, larg = 38 * 6;
    var el = document.createElement('div');
    el.className = 'att-chien';
    el.innerHTML = chienSVG(6);
    ciel.appendChild(el);
    var h = '';
    for (var k = 0; k < pris.length; k++) {
      var a = ANCRES[k];
      h += '<g transform="translate(' + a[0] + ',' + a[1] + ') scale(.55)">'
        + runs(MORT, pris[k].esp.pal) + '</g>';
      retirer(pris[k]);
    }
    el.querySelector('.att-prise').innerHTML = h;
    chien = {
      el: el, t: 0, etat: 'monte',
      x: Math.max(2, Math.min(W - larg - 2, sx - larg / 2)), y: 0
    };
  }

  function majChien(dt) {
    if (!chien) { if (gisants.length) creerChien(); return; }
    var H = ciel.clientHeight, solY = H - SOL;
    // hors champ / sorti : 14 des 18 rangs du sprite passent au-dessus de
    // l'herbe, soit la tête, les épaules et les canards brandis
    var cache = solY + 24, montre = solY - 84;
    var d = chien;
    d.t += dt;
    if (d.etat === 'monte') {
      var k = Math.min(1, d.t / 0.32);
      d.y = cache + (montre - cache) * k;
      if (k >= 1) { d.etat = 'montre'; d.t = 0; }
    } else if (d.etat === 'montre') {
      d.y = montre;
      if (d.t > 1.6) { d.etat = 'plonge'; d.t = 0; }
    } else {
      var k2 = Math.min(1, d.t / 0.32);
      d.y = montre + (cache - montre) * k2;
      if (k2 >= 1) { d.el.remove(); chien = null; return; }
    }
    d.el.style.transform = 'translate3d(' + Math.round(d.x) + 'px,' + Math.round(d.y) + 'px,0)';
  }

  function boucle() {
    raf = requestAnimationFrame(boucle);
    var t = performance.now();
    var dt = Math.min((t - dernier) / 1000, .05);
    dernier = t;
    if (!ouvert) return;
    horloge += dt;

    var W = ciel.clientWidth, H = ciel.clientHeight, solY = H - SOL;
    var maxSim = Math.min(3, 1 + Math.floor(p * 3)), enVol = 0;
    for (var i = 0; i < canards.length; i++) if (!canards[i].touche) enVol++;
    prochainTir -= dt;
    if (prochainTir <= 0 && enVol < maxSim) {
      var rare = (horloge - dernierRare > 12) && Math.random() < (.04 + .05 * p);
      if (rare) dernierRare = horloge;
      lacher(rare);
      prochainTir = lerp(3.5, .9, p) * alea(.85, 1.15);
    }

    for (var j = canards.length - 1; j >= 0; j--) {
      var c = canards[j];
      if (c.gisant) continue;
      if (!c.touche) {
        c.x += c.dir * c.v * dt;
        c.ph += dt * (6.28 / c.per);
        c.y = c.base + Math.sin(c.ph) * c.amp;
        if ((c.dir === 1 && c.x > W + c.l + 16) || (c.dir === -1 && c.x < -c.l - 16)) {
          c.el.remove(); canards.splice(j, 1); continue;
        }
      } else {
        c.vy += 780 * dt;
        c.y += c.vy * dt;
        c.x += c.dir * 22 * dt;
        if (c.y >= solY - 7 * c.esp.ech) {
          c.y = solY - 7 * c.esp.ech;
          c.el.innerHTML = canardMortSVG(c.esp);   // ailes closes, tête pendante
          c.l = 16 * c.esp.ech;
          c.gisant = true;
          c.el.classList.add('att-gisant');
          gisants.push(c);
          while (gisants.length > 8) {   /* le chien ne suit plus : on désencombre */
            var vieux = gisants.shift();
            vieux.el.remove();
            var k = canards.indexOf(vieux); if (k >= 0) canards.splice(k, 1);
          }
        }
      }
      poser(c);
    }
    majChien(dt);
  }

  /* ============================================================
     7. API
     ============================================================ */
  window.ATT_STAND = {
    monter: function (cible) {
      hote = (typeof cible === 'string' ? document.querySelector(cible) : cible)
        || document.getElementById('att-coin');
      if (!hote) { console.warn('[stand] hôte introuvable'); return; }
      if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
      if (!racine) construire();
      return this;
    },
    progression: function (v) { p = Math.max(0, Math.min(1, Number(v) || 0)); return this; },
    arreter: function () {
      ouvert = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (carte) carte.classList.remove('att-on');
      if (racine) {
        racine.setAttribute('data-ouvert', '0');
        var b = racine.querySelector('.att-stand-icone');
        if (b && b.querySelector('span')) b.querySelector('span').textContent = 'Stand de tir';
      }
      return this;
    },
    demonter: function () {
      this.arreter();
      canards.length = 0; gisants.length = 0;
      if (chien) { chien.el.remove(); chien = null; }
      if (racine) { racine.remove(); racine = null; }
      if (carte) { carte.remove(); carte = null; }
      score = 0;
      return this;
    },
    /* Remise à zéro entre deux générations : le score ne survit pas au
       dossier terminé (décision du 01/09). On vide aussi la scène, sinon les
       canards de la génération précédente réapparaîtraient au dépliage. */
    remiseAZero: function () {
      this.arreter();
      canards.forEach(function (c) { c.el.remove(); });
      if (chien) { chien.el.remove(); chien = null; }
      canards.length = 0; gisants.length = 0;
      score = 0; horloge = 0; dernierRare = -1e9;
      if (elScore) elScore.innerHTML = '0<span>points</span>';
      return this;
    },
    score: function () { return score; },
    version: '6.0-chien-de-face'
  };
})();
