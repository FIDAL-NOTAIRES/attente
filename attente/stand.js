/* ============================================================
   ATTENTE — stand de tir  (v9.2, canards peints)
   Module autonome, zéro dépendance, aucun fichier externe : les
   images des canards sont embarquées dans ce fichier (section 8).

   ── v9.0 (24/11/2026) — CANARDS PEINTS ─────────────────────────
   Les canards en pixels sont remplacés par quatre illustrations
   naturalistes (colvert, souchet, sarcelle d'hiver, mandarin),
   générées à part puis détourées. Chaque espèce tient dans UNE
   bande de cinq poses, de l'aile levée à l'aile abaissée ; le
   battement est un simple déplacement de l'image de fond, en CSS.
   Les poses « aile basse » sont fabriquées par retournement de
   l'aile levée : celles du mandarin sont médiocres, il ne bat donc
   que sur les trois premières (il passe en éclair, on n'y voit rien).
   Le décor et le chien restent en pixels pour l'instant.

   ── v9.1 (24/11/2026) — CHUTE RALENTIE ─────────────────────────
   Le canard touché tombe un peu moins vite, en se balançant.

   ── v9.2 (24/11/2026) — TOURBILLON VERS LE BAS, PAS DE SALTO ───
   La v9.1 faisait tourner l'oiseau À PLAT, dans le plan de l'écran :
   il enchaînait les saltos. Ici il bascule tête en bas puis tourne
   autour de la VERTICALE (rotateY), comme une vrille d'avion ou une
   feuille qui tombe ; le balancement gauche-droite est calé sur la
   même rotation, ce qui dessine une hélice.
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

   Conséquences techniques (valent toujours pour le chien et le décor) :
     • sprites = cartes de caractères, une lettre par pixel, converties
       en <rect>. Les pixels contigus d'une même ligne sont FUSIONNÉS.
     • échelles ENTIÈRES uniquement, shape-rendering="crispEdges" et
       image-rendering:pixelated : à l'échelle 2,5 un sprite bave.
   ============================================================ */
(function () {
  'use strict';

  var C = {
    nuit: '#0F2238', canard: '#33838B', cyan: '#6DD5DC',
    jauneForme: '#FFE764', jauneTexte: '#FFC900'
  };

  /* ⚠ DÉCLARÉ ICI, avant tout le reste. ECH est utilisé dès la définition des
     espèces (section 2) ; laissé avec le reste de l'état du jeu en section 6,
     il valait `undefined` au moment de cette définition — les canards auraient
     été dessinés à une échelle indéfinie. Le piège classique du var hoisté :
     le nom existe, la valeur pas encore. */
  var ECH = 3, SCENE_L = 188, SCENE_H = 100;

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
     2. CANARDS — illustrations peintes, vol vers la DROITE.
        l, h : taille d'affichage d'une pose, en points d'écran
        (les images sont embarquées au double pour les écrans fins).
        poses : nombre de poses utilisées pour le battement (5 ou 3).
        Les bandes d'images sont en section 8, à la fin du fichier.
     ============================================================ */
  var ESPECES = {
    colvert: { nom: 'Colvert', points: 1, vitesse: 1.00, poids: 50,
      teinte: '#1D7A3E', l: 96, h: 76, poses: 5 },
    souchet: { nom: 'Souchet', points: 2, vitesse: 1.18, poids: 30,
      teinte: '#A8531F', l: 94, h: 73, poses: 5 },
    sarcelle: { nom: 'Sarcelle', points: 3, vitesse: 1.45, poids: 20,
      teinte: '#7A3B22', l: 82, h: 62, poses: 5 },
    mandarin: { nom: 'Mandarin', points: 5, vitesse: 3.40, poids: 0,
      teinte: '#D9772B', l: 86, h: 57, poses: 3 }
  };
  for (var cleEsp in ESPECES) ESPECES[cleEsp].cle = cleEsp;

  /* Une pose = la bande entière en image de fond, agrandie à 500 % de la
     largeur ; la pose n (0 à 4) est à la position n x 25 %.
     `ech` réduit le canard (icône du bouton). */
  function oiseau(e, cls, ech) {
    var k = ech || 1;
    return '<div class="att-oiseau ' + (cls || '') + '" style="width:' + Math.round(e.l * k)
      + 'px;height:' + Math.round(e.h * k) + 'px;background-image:url(' + BANDES[e.cle] + ')"></div>';
  }
  function canardVol(e) {
    return oiseau(e, 'att-vol' + e.poses).replace('style="',
      'style="animation-delay:-' + (Math.random() * .4).toFixed(2) + 's;');
  }
  function canardFixe(e, ech) { return oiseau(e, '', ech); }

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
  /* Points d'accroche des canards brandis, dans les unités du sprite :
     la gueule d'abord, puis la patte gauche, puis la droite. Les ordonnées
     sont volontairement HAUTES — au premier essai, celui de la gueule tombait
     pile sur la ligne d'herbe et le premier plan l'avalait. */
  var ANCRES = [[12, 8], [-1, 8], [27, 8]];
  var L_PRISE = 15;                       // largeur d'un canard brandi, en unités du sprite
  /* v9.0 — canard brandi = la pose 2 (aile presque refermée) de sa bande,
     découpée par un <svg> imbriqué. ⚠ image-rendering:auto : le chien est en
     pixels (pixelated), l'illustration ne doit pas en hériter. */
  function priseSVG(e, x, y) {
    var hh = L_PRISE * e.h / e.l;
    return '<svg x="' + x + '" y="' + (y + 2 - hh / 2).toFixed(2) + '" width="' + L_PRISE
      + '" height="' + hh.toFixed(2) + '" viewBox="' + (2 * e.l) + ' 0 ' + e.l + ' ' + e.h + '">'
      + '<image href="' + BANDES[e.cle] + '" width="' + (5 * e.l) + '" height="' + e.h
      + '" preserveAspectRatio="none" style="image-rendering:auto"/></svg>';
  }
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
  /* Bande d'herbe redessinée EN PREMIER PLAN, par-dessus le chien : c'est elle
     qui le masque à mi-corps quand il jaillit. Les canards tombés, eux, passent
     au-dessus d'elle — sinon ils disparaîtraient dans l'herbe. */
  function herbeAvant(W, H) {
    var yT = H - 8;
    var s = rect(0, 0, W, yT, PAL_DEC.herbe) + rect(0, yT, W, H - yT, PAL_DEC.terre);
    for (var t = 0; t < 26; t++) {
      s += rect((t * 19) % W, yT + 2 + ((t * 5) % 5), 2, 1, PAL_DEC.terreO);
    }
    s += brins(W, 3);
    for (var g = 0; g < 22; g++) {
      s += rect((g * 27) % W, -2 - ((g * 7) % 4), 1, 4 + ((g * 5) % 4), PAL_DEC.brin);
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
  var PAL_DEC = {
    ciel:'#58B8F8',
    herbe:'#4CB038', brin:'#C8F0A0', brinF:'#78C848',
    terre:'#A0601C', terreO:'#7C4814',
    tronc:'#A02820', troncO:'#78201A',
    feuille:'#38A038', feuilleC:'#78D848'
  };
  
  /* Relevé sur une capture nette du jeu (03/09) : l'herbe n'est pas crénelée
     mais hérissée de longs brins fins et irréguliers, presque blancs ; sous
     elle court une bande de TERRE brune ; et l'arbre porte de vraies branches
     montantes coiffées de bouquets séparés, chacun ombré par le bas.

     ⚠ ÉCHELLE : l'écran de Duck Hunt fait 256 pixels de large, notre carte 564,
     donc ~2 points d'écran par pixel. La scène fait 188 x 100 unités à 3
     points — à 6, elle n'en faisait que 94 et c'était le jeu vu à la loupe. */
  /* Brins IRRÉGULIERS et groupés en touffes. À pas constant et hauteur peu
     variable, ils faisaient un peigne : c'est la variation qui fait l'herbe. */
  function brins(W, y) {
    var s = '', x = 0, i = 0;
    while (x < W) {
      var n = 2 + ((i * 7) % 4);                 // touffe de 2 à 5 brins
      for (var k = 0; k < n && x < W; k++, x++) {
        var h = 2 + ((x * 13 + i * 5) % 8);
        s += rect(x, y - h, 1, h, ((x + i) % 3) ? PAL_DEC.brin : PAL_DEC.brinF);
        x++;                                     // un vide entre deux brins
      }
      x += 1 + ((i * 3) % 3);                    // vide entre deux touffes
      i++;
    }
    return s;
  }
  /* bouquet : une pastille claire, doublée d'une ombre décalée vers le bas */
  function bouquet(cx, cy, rx, ry) {
    return blob(cx, cy + 2, rx, ry, PAL_DEC.feuille)
         + blob(cx, cy - 1, rx - 2, ry - 1, PAL_DEC.feuilleC);
  }
  function decor(W, H) {
    var s = rect(0, 0, W, H, PAL_DEC.ciel);
    var yH = H - 24, yT = H - 8;               // herbe puis terre
    s += rect(0, yH, W, yT - yH, PAL_DEC.herbe);
    s += rect(0, yT, W, H - yT, PAL_DEC.terre);
    for (var t = 0; t < 26; t++) {             // cailloux dans la terre
      s += rect((t * 19) % W, yT + 2 + ((t * 5) % 5), 2, 1, PAL_DEC.terreO);
    }
    s += brins(W, yH + 3);
    for (var g = 0; g < 22; g++) {             // touffes plus hautes, semées
      s += rect((t = (g * 27) % W), yH - 2 - ((g * 7) % 4), 1, 4 + ((g * 5) % 4), PAL_DEC.brin);
    }
    // l'arbre : tronc texturé, deux branches montantes, cinq bouquets
    var ax = Math.round(W * 0.17), sol = yH + 6;
    s += rect(ax - 3, sol - 46, 7, 46, PAL_DEC.tronc);
    s += rect(ax + 2, sol - 46, 2, 46, PAL_DEC.troncO);
    for (var k = 0; k < 7; k++) s += rect(ax - 1 + ((k * 3) % 4), sol - 40 + k * 6, 1, 2, PAL_DEC.troncO);
    s += rect(ax - 12, sol - 34, 10, 4, PAL_DEC.tronc) + rect(ax - 12, sol - 31, 10, 1, PAL_DEC.troncO);
    s += rect(ax + 3, sol - 40, 11, 4, PAL_DEC.tronc) + rect(ax + 3, sol - 37, 11, 1, PAL_DEC.troncO);
    s += bouquet(ax - 2, sol - 52, 12, 9);
    s += bouquet(ax - 16, sol - 38, 9, 7);
    s += bouquet(ax + 15, sol - 44, 10, 8);
    s += bouquet(ax - 13, sol - 24, 8, 6);
    s += bouquet(ax + 12, sol - 28, 8, 6);
    // buissons
    s += bouquet(Math.round(W * 0.72), yH + 2, 11, 8);
    s += bouquet(Math.round(W * 0.90), yH + 3, 8, 6);
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
      /* v8.5 — largeur au contenu : l'hôte est un point sans dimension. */
      + 'width:max-content;box-sizing:border-box;'
      + 'border-radius:10px;background:' + C.nuit + ';border:1.5px solid ' + C.cyan + ';'
      + 'cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);'
      + 'font:600 11.5px/1 "Segoe UI",sans-serif;letter-spacing:.6px;color:' + C.cyan + '}'
    + '.att-stand-icone .att-oiseau{flex:0 0 auto}'
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
    /* v8.4 — croix de sortie, en haut à droite de la carte. Le titre pousse
       le score et la croix à droite (margin-right:auto) ; la croix se centre
       seule, sans suivre l'alignement sur la ligne de base du titre. */
    + '.att-stand-tete h4{margin-right:auto}'
    + '.att-stand-croix{align-self:center;flex:0 0 auto;width:26px;height:26px;padding:0;'
      + 'display:flex;align-items:center;justify-content:center;border-radius:6px;'
      + 'background:transparent;border:1.5px solid rgba(109,213,220,.45);'
      + 'color:' + C.cyan + ';cursor:pointer}'
    + '.att-stand-croix svg{display:block}'
    + '.att-stand-croix:hover{border-color:' + C.jauneForme + ';color:' + C.jauneForme + ';'
      + 'background:rgba(255,231,100,.12)}'
    + '.att-stand-croix:focus-visible{outline:2px solid ' + C.jauneForme + ';outline-offset:2px}'

    + '.att-ciel{position:relative;overflow:hidden;cursor:crosshair;line-height:0;height:300px}'
    + '.att-fond{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
      + 'image-rendering:pixelated}'

    + '.att-canard{position:absolute;left:0;top:0;will-change:transform;cursor:crosshair;line-height:0}'
    /* v9.0 — une bande de cinq poses en image de fond ; le battement déplace
       le fond pose par pose (steps), rien à calculer en JS à chaque image.
       Aller-retour 0-1-2-3-4-3-2-1 ; le mandarin s'arrête à la pose 2. */
    + '.att-oiseau{display:block;background-repeat:no-repeat;background-size:500% 100%;'
      + 'background-position:0 0;transform-origin:50% 55%}'
    + '.att-vol5{animation:att-vol5 .44s steps(1,end) infinite}'
    + '.att-vol3{animation:att-vol3 .26s steps(1,end) infinite}'
    + '@keyframes att-vol5{0%{background-position:0 0}12.5%{background-position:25% 0}'
      + '25%{background-position:50% 0}37.5%{background-position:75% 0}'
      + '50%{background-position:100% 0}62.5%{background-position:75% 0}'
      + '75%{background-position:50% 0}87.5%{background-position:25% 0}}'
    + '@keyframes att-vol3{0%{background-position:0 0}25%{background-position:25% 0}'
      + '50%{background-position:50% 0}75%{background-position:25% 0}}'
    /* v9.2 — touché : ailes levées figées ; la vrille elle-même est posée par
       le moteur à chaque image (voir boucle), pour rester calée sur le
       balancement. */
    + '.att-touche .att-oiseau{animation:none;background-position:0 0}'
    /* au sol : aile refermée, sur le dos */
    + '.att-gisant .att-oiseau{animation:none;background-position:50% 0;'
      + 'transform:rotate(180deg);transition:none}'

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

    /* croix d'impact en pixels, comme le décor */
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
      + '.att-vol5,.att-vol3{animation-duration:1.2s}'
      + '.att-chien .att-f0,.att-chien .att-f1{animation-duration:.9s}}';

  /* ============================================================
     6. MOTEUR DE JEU
     ============================================================ */
  var hote = null, racine = null, carte = null, ciel = null, elScore = null;
  var canards = [], gisants = [];
  var score = 0, p = 0, ouvert = false, raf = null;
  var dernier = 0, prochainTir = 0, dernierRare = -1e9, horloge = 0;
  var MAX_PRISES = 3, SOL = 24 * ECH;   // hauteur de la bande d'herbe, en px
  var GISANT = 0.58;                    // part de la pose au-dessus de l'herbe, canard au sol
  var VRILLE_T = 0.55;                  // durée d'un tour de vrille, en secondes
  var CALME = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches);

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
      +   /* v8.5 — petit canard (40 px) : plus grand, le bouton dépassait la
             hauteur du plan cadastral. v9.0 : même largeur, canard peint. */
          canardFixe(ESPECES.colvert, 40 / ESPECES.colvert.l) + '<span>Stand de tir</span></button>';

    carte = document.createElement('div');
    carte.className = 'att-stand-carte';
    carte.setAttribute('role', 'group');
    carte.setAttribute('aria-label', 'Stand de tir');
    carte.innerHTML = ''
      + '<div class="att-stand-tete"><h4>Stand de tir</h4>'
      +   '<div class="att-stand-score">0<span>points</span></div>'
      +   '<button class="att-stand-croix" type="button" title="Quitter le jeu"'
      +     ' aria-label="Quitter le stand de tir">'
      +     '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">'
      +     '<path d="M1.5 1.5l9 9M10.5 1.5l-9 9" fill="none" stroke="currentColor"'
      +     ' stroke-width="2" stroke-linecap="square"/></svg></button></div>'
      + '<div class="att-ciel">'
      +   '<svg class="att-fond" viewBox="0 0 188 100" preserveAspectRatio="none"'
      +     ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"></svg>'
      +   '<svg class="att-avant" viewBox="0 0 188 24" preserveAspectRatio="none"'
      +     ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"></svg>'
      + '</div>'
      + '<div class="att-bareme">' + puce('colvert') + puce('souchet')
      +   puce('sarcelle') + puce('mandarin') + '</div>';

    ciel = carte.querySelector('.att-ciel');
    elScore = carte.querySelector('.att-stand-score');
    ciel.querySelector('.att-fond').innerHTML = decor(SCENE_L, SCENE_H);
    ciel.querySelector('.att-avant').innerHTML = herbeAvant(SCENE_L, 24);
    ciel.querySelector('.att-avant').style.height = (24 * ECH) + 'px';

    racine.querySelector('.att-stand-icone')
      .addEventListener('click', function () { ouvert ? replier() : deplier(); });
    /* v8.4 — la croix replie le stand, exactement comme le bouton « Replier » :
       partie gelée, score conservé tant que la génération tourne. */
    carte.querySelector('.att-stand-croix').addEventListener('click', replier);
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
    var l = e.l, h = e.h;
    var base = alea(H * .05, Math.max(0, H - SOL - h));
    var el = document.createElement('div');
    el.className = 'att-canard';
    el.innerHTML = canardVol(e);
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
  /* positions ARRONDIES : une image posée sur un demi-pixel bave */
  function poser(c) {
    c.el.style.transform = 'translate3d(' + Math.round(c.x) + 'px,' + Math.round(c.y)
      + 'px,0) scaleX(' + (c.dir === 1 ? 1 : -1) + ')';
  }

  function toucher(c, ev) {
    if (c.touche) return;
    c.touche = true;
    c.vy = 40;
    c.el.classList.add('att-touche');     // ailes figées ; la vrille est dans la boucle
    c.tChute = 0; c.xChute = c.x; c.oiseau = c.el.firstChild;
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
    var W = ciel.clientWidth, larg = 38 * ECH;
    var el = document.createElement('div');
    el.className = 'att-chien';
    el.innerHTML = chienSVG(ECH);
    ciel.appendChild(el);
    var h = '';
    for (var k = 0; k < pris.length; k++) {
      var a = ANCRES[k];
      h += priseSVG(pris[k].esp, a[0], a[1]);
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
    var cache = solY + 8 * ECH, montre = solY - 14 * ECH;
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
        /* v9.1 — chute en tourbillon : pesanteur adoucie (780 -> 520) et
           vitesse plafonnée pour laisser voir la vrille ; l'oiseau se balance
           de part et d'autre de sa verticale, qui dérive un peu dans le sens du vol. */
        c.tChute += dt;
        c.vy = Math.min(c.vy + 520 * dt, 300);
        c.y += c.vy * dt;
        c.xChute += c.dir * 22 * dt;
        /* v9.2 — tête en bas (bascule en 0,2 s), puis rotation autour de la
           verticale : un tour en VRILLE_T secondes. Le balancement suit le même
           angle, d'où la trajectoire en hélice. Mouvement réduit : pas de vrille. */
        var tour = CALME ? 0 : c.tChute / VRILLE_T * 360;
        c.x = c.xChute + (CALME ? 0 : Math.sin(tour * Math.PI / 180) * 10);
        c.oiseau.style.transform = 'rotateY(' + Math.round(tour % 360) + 'deg) rotate('
          + Math.round(Math.min(1, c.tChute / .2) * 82) + 'deg)';
        /* v9.0 — le corps occupe le milieu de la pose : on arrête la chute
           quand ce milieu atteint l'herbe, pas le bas du cadre. */
        if (c.y >= solY - c.h * GISANT) {
          c.y = solY - c.h * GISANT;
          c.oiseau.style.transform = '';           // rend la main à la feuille de style
          c.gisant = true;                         // aile refermée, sur le dos (CSS)
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
    version: '9.2-vrille-vers-le-bas'
  };

  /* ============================================================
     8. IMAGES — une bande de cinq poses par espèce (WebP, fond
        transparent), embarquée pour que le module reste un seul
        fichier. ⚠ Lignes très longues : ne pas retoucher à la main.
        `var` est hissé, et aucune fonction ne lit BANDES avant
        l'appel à monter() : la déclaration peut rester en fin de fichier.
     ============================================================ */
  var BANDES = {
    colvert: 'data:image/webp;base64,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',
    souchet: 'data:image/webp;base64,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',
    sarcelle: 'data:image/webp;base64,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',
    mandarin: 'data:image/webp;base64,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'
  };
})();
