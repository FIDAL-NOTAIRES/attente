/* ============================================================
   ATTENTE — stand de tir  (v2.0, pixel art)
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
        de couleurs. Le souchet a en plus son bec en spatule.
     ============================================================ */
  var CORPS = [
    '........KKKKKKK.......',
    '.....KKKBBBBBBBKKK....',
    '...KKBBBBBBBBBMMMKKK..',
    '..KWBBBBBBBBBBMMGGGK..',
    '.KWWKBBBBBBBBBMGNKGKYY',
    '..KWKKbbbbbbbbKGGGKYYY',
    '....KKKKKKKKKKKKGGKKY.',
    '................KKK...'
  ];
  var CORPS_SPATULE = [
    '........KKKKKKK.......',
    '.....KKKBBBBBBBKKK....',
    '...KKBBBBBBBBBMMMKKK..',
    '..KWBBBBBBBBBBMMGGGKK.',
    '.KWWKBBBBBBBBBMGNKGKYY',
    '..KWKKbbbbbbbbKGGGKYYY',
    '....KKKKKKKKKKKKGGKYYY',
    '................KKKKY.'
  ];
  var AILE_HAUTE = [
    '........KK............',
    '.......KWK............',
    '.......KWWK...........',
    '......KWWWK...........',
    '......KWWaK...........',
    '.....KWWaaK...........',
    '.....KWaaK............',
    '....KKWaK.............'
  ];
  var AILE_MI = [
    '......................',
    '......................',
    '..........KK..........',
    '.........KWWK.........',
    '........KWWaK.........',
    '.......KWWaaK.........',
    '.....KKWWaaK..........',
    '....KWWWaK............'
  ];
  var AILE_BASSE = [
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '......................',
    '.....KKKKK............'
  ];
  /* l'aile basse passe SOUS le corps : elle se dessine après lui */
  var AILE_BASSE_BAS = [
    '....KWWaK.............',
    '.....KWWaaK...........',
    '......KWaaK...........',
    '.......KWaK...........',
    '........KK............'
  ];
  /* Canard MORT, au sol : le corps SANS ses ailes (elles sont closes), tête
     posée à hauteur du corps, œil clos. 22 x 9.

     ⚠ Premier jet à jeter : la tête pendait à la verticale, ce qui dessinait
     exactement la silhouette d'une crosse — le sprite se lisait comme un
     pistolet. Sur une grille de vingt pixels, une tête basse ne dit pas
     « mort », elle dit « autre objet ». Couché à plat, en revanche, c'est le
     même corps que le canard en vol, donc reconnaissable sans ambiguïté. */
  var MORT = [
    '........KKKKKKK.......',
    '.....KKKBBBBBBBKKK....',
    '...KKBBBBBBBBBMMMKKK..',
    '..KWBBBBBBBBBBMMGGGK..',
    '.KWWKBBBBBBBBBMGKKGKYY',
    '..KWKKbbbbbbbbKGGGKYYY',
    '....KKKKKKKKKKKKGGKKY.',
    '................KKK...',
    '......................'
  ];

  var ESPECES = {
    colvert: { nom: 'Colvert', points: 1, ech: 3, vitesse: 1.00, poids: 50,
      teinte: '#1D7A3E', spatule: false,
      pal: { K:'#181818', W:'#F4F4EC', N:'#FFFFFF', a:'#9AA3AE', b:'#5E6874',
             B:'#98A1AC', M:'#7A4526', G:'#1D7A3E', Y:'#E8A62C' } },
    souchet: { nom: 'Souchet', points: 2, ech: 3, vitesse: 1.18, poids: 30,
      teinte: '#A8531F', spatule: true,
      pal: { K:'#181818', W:'#F4F4EC', N:'#FFFFFF', a:'#7E8F98', b:'#4A585F',
             B:'#A8531F', M:'#F0EADA', G:'#14573A', Y:'#2B2F35' } },
    sarcelle: { nom: 'Sarcelle', points: 3, ech: 3, vitesse: 1.45, poids: 20,
      teinte: '#7A3B22', spatule: false,
      pal: { K:'#181818', W:'#F4F4EC', N:'#FFFFFF', a:'#98988F', b:'#63635C',
             B:'#B9BCB8', M:'#E6DCC4', G:'#7A3B22', Y:'#2A2E33' } },
    mandarin: { nom: 'Mandarin', points: 5, ech: 3, vitesse: 3.40, poids: 0,
      teinte: '#D9772B', spatule: false,
      pal: { K:'#181818', W:'#F0A24E', N:'#FFFFFF', a:'#7A6E8C', b:'#4A4458',
             B:'#D3B36A', M:'#4A2E5C', G:'#1B5E3A', Y:'#C6362F' } }
  };

  function canardSVG(e) {
    var corps = runs(e.spatule ? CORPS_SPATULE : CORPS, e.pal, 0, 7);
    return svgPx(22, 20, ''
      + '<g class="att-f0">' + runs(AILE_HAUTE, e.pal) + corps + '</g>'
      + '<g class="att-f1">' + runs(AILE_MI, e.pal) + corps + '</g>'
      + '<g class="att-f2">' + runs(AILE_BASSE, e.pal) + corps
        + runs(AILE_BASSE_BAS, e.pal, 0, 15) + '</g>', e.ech);
  }
  function canardFixe(e, ech) {
    return svgPx(22, 20, runs(AILE_HAUTE, e.pal)
      + runs(e.spatule ? CORPS_SPATULE : CORPS, e.pal, 0, 7), ech || e.ech);
  }
  function canardMortSVG(e, ech) {
    return svgPx(22, 9, runs(MORT, e.pal), ech || e.ech);
  }

  /* ============================================================
     3. LE CHIEN — 34 x 24, profil vers la droite, sol à y=23.
        Deux poses de trot, alternées par la même mécanique
        d'opacité que les ailes. Gueule autour de (24,13).
     ============================================================ */
  var PAL_CHIEN = { K:'#181818', W:'#F4F4EC', N:'#FFFFFF', F:'#8A5A2E', f:'#5E3A18' };
  var CHIEN_HAUT = [
    '..................................',
    '.KK...............................',
    'KWWK..............................',
    'KWWK..............KKKKKK..........',
    '.KWWK............KWWWWWWKK........',
    '..KWWK..........KWFFFFFWWWK.......',
    '...KWWKKKKKKKKKKKWFFFFFFFWWK......',
    '....KWWWWWWWWWWWWWFFNKFFFFWK......',
    '....KWWWWWWWWWWWWWFFKKFFFFWWKK....',
    '....KWWWWWWWWWWWWWFFFFFFFWWWWWKK..',
    '....KWWWWWWWWWWWWWFFFFFFWWWWWWKK..',
    '....KWWWWWWWWWWWWWWFFFFFWWWKKKK...',
    '.....KWWWWWWWWWWWWWWFFFFWWKK......',
    '.....KWWWWWWWWWWWWWWWffFWWK.......',
    '.....KKWWWWWWWWWWWWWKffFWK........',
    '......KKWWWWKKKKKWWWKffFK.........'
  ];
  var PATTES_A = [
    '.......KffWK....KWfFK.KffWK.......',
    '.......KffWK....KWfFK.KffK........',
    '.......KffWK....KWfFK.KffK........',
    '.......KffWK....KWfFK.KffK........',
    '.......KffWK....KWfFK.KffK........',
    '.......KffWK....KWfFK.KffK........',
    '......KfffWK...KWffFK.KfffK.......',
    '......KKKKKK...KKKKKK.KKKKK.......'
  ];
  var PATTES_B = [
    '......KWfFK.....KffWK..KffWK......',
    '......KWfFK.....KffWK..KffK.......',
    '.......KWfFK....KffWK.KffK........',
    '.......KWfFK....KffWK.KffK........',
    '........KWfFK...KffWK.KffK........',
    '........KWfFK..KffWK..KffK........',
    '.......KWWfFK..KfffWK.KfffK.......',
    '.......KKKKKK..KKKKKK.KKKKK.......'
  ];
  function chienSVG(ech) {
    var haut = runs(CHIEN_HAUT, PAL_CHIEN);
    return svgPx(34, 24, ''
      + '<g class="att-f0">' + haut + runs(PATTES_A, PAL_CHIEN, 0, 16) + '</g>'
      + '<g class="att-f1">' + haut + runs(PATTES_B, PAL_CHIEN, 0, 16) + '</g>'
      + '<g class="att-prise"></g>', ech);
  }

  /* ============================================================
     4. DÉCOR — en pixels, mais GÉNÉRÉ : une carte de caractères
        pour un ciel entier ferait mille lignes pour un résultat
        qu'on ne peut plus retoucher.
     ============================================================ */
  var ARBRE = [
    '.....KKKK.......',
    '...KKVVVVKK.....',
    '..KVVVVVVVVK....',
    '.KVVVVVVVVVVK...',
    '.KVVVVVVVVVVK...',
    '..KVVVVVVVVK.KK.',
    '...KKVVVVKKKVVK.',
    '.....KTTK.KVVVK.',
    '.KK..KTTK.KVVVK.',
    'KVVK.KTTK..KVK..',
    'KVVVKKTTKKKKKK..',
    '.KVVVKTTTTVVVK..',
    '..KKKKTTKKKKK...',
    '.....KTTK.......',
    '.....KTTK.......',
    '.....KTTK.......',
    '....KTTTTK......',
    '....KTTTTK......',
    '...KTTTTTTK.....',
    '...KTTTTTTK.....',
    '..KTTTTTTTTK....',
    '..KKKKKKKKKK....'
  ];
  var PAL_ARBRE = { K:'#123024', V:'#2E7A4A', T:'#6B4423' };

  function decor(W, H) {
    var D = { ciel1:'#5FA8D6', ciel2:'#7FC0E4', nuage:'#F2F7FA',
      bois:'#1E4B3A', bois2:'#2F6650', herbe:'#4E8C3A', herbe2:'#3A6B2A',
      eau:'#3E7FA8', eau2:'#5B9BC0' };
    function r(x, y, w, h, f) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
        + '" fill="' + f + '"/>';
    }
    /* Conifère : un triangle bâti en rectangles empilés de largeur croissante.
       Au premier jet la lisière n'était qu'une rangée de rectangles verticaux —
       ça faisait une haie de béton, pas une forêt. */
    function sapin(x, sol, h, f) {
      var o = '';
      for (var i = 0; i < h; i++) {
        var w = 1 + Math.floor(i * 4 / h);
        o += r(x - Math.floor(w / 2), sol - h + i, w, 1, f);
      }
      return o;
    }
    var s = r(0, 0, W, H, D.ciel1);
    s += r(0, Math.round(H * .24), W, Math.round(H * .36), D.ciel2);
    var nu = [[8,5,14],[13,8,8],[46,4,16],[53,7,9],[86,6,13],[92,9,7],[112,4,12]];
    for (var i = 0; i < nu.length; i++) s += r(nu[i][0], nu[i][1], nu[i][2], 3, D.nuage);

    var yBois = Math.round(H * .56);
    for (var x = 0; x < W + 4; x += 4) s += sapin(x, yBois, 5 + ((x * 7) % 4), D.bois2);
    for (var x2 = 2; x2 < W + 6; x2 += 6) s += sapin(x2, yBois + 2, 7 + ((x2 * 11) % 5), D.bois);

    var yEau = yBois + 2;
    s += r(0, yEau, W, H - yEau, D.eau);
    for (var k = 0; k < 10; k++) {
      s += r((k * 19) % W, yEau + 2 + k, 6 + (k % 4) * 5, 1, D.eau2);
    }
    var yHerbe = H - 7;
    s += r(0, yHerbe, W, 7, D.herbe2);
    for (var g = 0; g < W; g += 2) s += r(g, yHerbe - (3 + ((g * 5) % 5)), 1, 3 + ((g * 5) % 5), D.herbe);

    /* l'arbre part à DROITE : à gauche, le chien entre en scène et le masquait */
    s += runs(ARBRE, PAL_ARBRE, W - 20, yHerbe - 22);
    return s;
  }

  /* ============================================================
     5. STYLES
     ============================================================ */
  var CSS = ''
    + '.att-stand{position:absolute;inset:auto auto 12px 12px;z-index:40;'
      + 'font-family:"Segoe UI",system-ui,sans-serif}'
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

    /* ⚠ position FIXE, pas absolue. Ancrée sur l'icône — donc dans le coin de
       la trame —, la carte grandissait vers le haut et recouvrait la trame,
       qui doit rester visible comme jauge de progression. Détachée, elle se
       place dans la bande libre entre les cartes et le cadran de radio. */
    + '.att-stand-carte{position:fixed;left:50%;transform:translateX(-50%);bottom:118px;'
      + 'z-index:60;width:min(568px,calc(100vw - 32px));'
      + 'border-radius:12px;overflow:hidden;background:' + C.nuit + ';'
      + 'border:1.5px solid ' + C.canard + ';box-shadow:0 18px 44px rgba(0,0,0,.55);display:none}'
    + '.att-stand[data-ouvert="1"] .att-stand-carte{display:block}'
    + '.att-stand-tete{display:flex;align-items:baseline;justify-content:space-between;'
      + 'gap:12px;padding:7px 12px 5px;border-bottom:1px solid rgba(109,213,220,.25)}'
    + '.att-stand-tete h4{margin:0;font-family:Georgia,serif;font-size:15px;'
      + 'font-weight:600;color:#EAF2F3}'
    + '.att-stand-score{font-family:Georgia,serif;font-size:22px;color:' + C.jauneTexte + ';'
      + 'font-variant-numeric:tabular-nums;line-height:1}'
    + '.att-stand-score span{font-size:11px;font-family:"Segoe UI",sans-serif;'
      + 'color:' + C.cyan + ';margin-left:4px}'

    + '.att-ciel{position:relative;overflow:hidden;cursor:crosshair;line-height:0;height:296px}'
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

    + '.att-chien{position:absolute;left:0;bottom:0;will-change:transform;'
      + 'pointer-events:none;z-index:3;line-height:0}'
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
  var hote = null, racine = null, ciel = null, elScore = null;
  var canards = [], gisants = [], chiens = [];
  var score = 0, p = 0, ouvert = false, raf = null;
  var dernier = 0, prochainTir = 0, dernierRare = -1e9, horloge = 0;
  var MAX_CHIENS = 2, MAX_PRISES = 3, SOL = 26;   // hauteur de la berge, en px

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
      + '<div class="att-stand-carte" role="group" aria-label="Stand de tir">'
      +   '<div class="att-stand-tete"><h4>Stand de tir</h4>'
      +     '<div class="att-stand-score">0<span>points</span></div></div>'
      +   '<div class="att-ciel">'
      +     '<svg class="att-fond" viewBox="0 0 189 99" preserveAspectRatio="none"'
      +       ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"></svg>'
      +   '</div>'
      +   '<div class="att-bareme">' + puce('colvert') + puce('souchet')
      +     puce('sarcelle') + puce('mandarin') + '</div>'
      + '</div>'
      + '<button class="att-stand-icone" type="button" aria-label="Ouvrir le stand de tir">'
      +   canardFixe(ESPECES.colvert, 2) + '<span>Stand de tir</span></button>';

    ciel = racine.querySelector('.att-ciel');
    elScore = racine.querySelector('.att-stand-score');
    ciel.querySelector('.att-fond').innerHTML = decor(189, 99);

    racine.querySelector('.att-stand-icone')
      .addEventListener('click', function () { ouvert ? replier() : deplier(); });
    ciel.addEventListener('pointerdown', tir);
    hote.appendChild(racine);
  }

  function deplier() {
    ouvert = true;
    racine.setAttribute('data-ouvert', '1');
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
    var l = 22 * e.ech, h = 20 * e.ech;
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

  /* ---------- chiens rapporteurs ----------
     Un chien ramasse jusqu'à TROIS canards par tournée, et un second
     n'entre qu'en rafale, par le bord opposé — jamais en file. */
  function libre() {
    for (var i = 0; i < gisants.length; i++) if (!gisants[i].reserve) return gisants[i];
    return null;
  }
  function plusProche(x) {
    var best = null, d = 1e9;
    for (var i = 0; i < gisants.length; i++) {
      var g = gisants[i];
      if (g.reserve) continue;
      var e = Math.abs(g.x - x);
      if (e < d) { d = e; best = g; }
    }
    return best;
  }
  function creerChien(W) {
    var cible = libre();
    if (!cible) return;
    var dir = chiens.length === 0 ? (cible.x < W / 2 ? 1 : -1) : -chiens[0].dir;
    var el = document.createElement('div');
    el.className = 'att-chien';
    el.innerHTML = chienSVG(3);
    ciel.appendChild(el);
    cible.reserve = true;
    chiens.push({ el: el, prise: el.querySelector('.att-prise'),
      x: dir === 1 ? -120 : W + 120, dir: dir, etat: 'aller',
      cible: cible, pause: 0, charges: [] });
  }
  /* Le rapport est dimensionné dans les UNITÉS DU SPRITE DU CHIEN (34 de
     large), pas en pixels d'écran : en pixels, il couvrait toute sa tête. */
  function dessinerPrise(d) {
    if (!d.charges.length) { d.prise.innerHTML = ''; return; }
    var h = '';
    for (var i = 0; i < d.charges.length; i++) {
      h += '<g transform="translate(' + (21 + i * 2) + ',' + (12 + i * 4)
        + ') scale(.6)">' + runs(MORT, d.charges[i].esp.pal) + '</g>';
    }
    d.prise.innerHTML = h;
  }
  function retirer(g) {
    var i = gisants.indexOf(g); if (i >= 0) gisants.splice(i, 1);
    var j = canards.indexOf(g); if (j >= 0) canards.splice(j, 1);
    if (g.el) g.el.remove();
  }
  function majChiens(dt) {
    var W = ciel.clientWidth, vitesse = 200;
    if (libre() && chiens.length < MAX_CHIENS) {
      if (chiens.length === 0 || gisants.length >= 3) creerChien(W);
    }
    for (var i = chiens.length - 1; i >= 0; i--) {
      var d = chiens[i];
      if (d.etat === 'aller') {
        if (!d.cible || !d.cible.el.isConnected) { d.cible = null; d.etat = 'retour'; }
        else {
          var but = d.cible.x + d.cible.l * .3;
          d.x += d.dir * vitesse * dt;
          if ((d.dir === 1 && d.x >= but) || (d.dir === -1 && d.x <= but)) {
            d.x = but; d.etat = 'ramasse'; d.pause = .36;
            d.el.classList.add('att-arret');
          }
        }
      } else if (d.etat === 'ramasse') {
        d.pause -= dt;
        if (d.pause <= 0) {
          if (d.cible) { d.charges.push(d.cible); retirer(d.cible); d.cible = null; dessinerPrise(d); }
          var suite = d.charges.length < MAX_PRISES ? plusProche(d.x) : null;
          if (suite) {
            suite.reserve = true; d.cible = suite;
            d.dir = suite.x > d.x ? 1 : -1;
            d.etat = 'aller';
          } else {
            d.etat = 'retour';
            d.dir = d.x < W / 2 ? -1 : 1;
          }
          d.el.classList.remove('att-arret');
        }
      } else {
        d.x += d.dir * vitesse * dt;
        if (d.dir === 1 ? d.x > W + 150 : d.x < -150) {
          d.el.remove(); chiens.splice(i, 1); continue;
        }
      }
      d.el.style.transform = 'translate3d(' + Math.round(d.x) + 'px,0,0) scaleX(' + d.dir + ')';
    }
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
        if (c.y >= solY - 9 * c.esp.ech) {
          c.y = solY - 9 * c.esp.ech;
          c.el.innerHTML = canardMortSVG(c.esp);   // ailes closes, tête pendante
          c.l = 22 * c.esp.ech;
          c.gisant = true;
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
    majChiens(dt);
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
      chiens.forEach(function (d) { d.el.remove(); });
      chiens.length = 0;
      if (racine) { racine.remove(); racine = null; }
      score = 0;
      return this;
    },
    /* Remise à zéro entre deux générations : le score ne survit pas au
       dossier terminé (décision du 01/09). On vide aussi la scène, sinon les
       canards de la génération précédente réapparaîtraient au dépliage. */
    remiseAZero: function () {
      this.arreter();
      canards.forEach(function (c) { c.el.remove(); });
      chiens.forEach(function (d) { d.el.remove(); });
      canards.length = 0; gisants.length = 0; chiens.length = 0;
      score = 0; horloge = 0; dernierRare = -1e9;
      if (elScore) elScore.innerHTML = '0<span>points</span>';
      return this;
    },
    score: function () { return score; },
    version: '2.3-pixel'
  };
})();
