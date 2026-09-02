/* ============================================================
   ATTENTE — stand de tir  (v1.3)
   Module autonome, zéro dépendance.
   API publique :
     ATT_STAND.monter(hote)      -> place l'icône canard dans le coin
     ATT_STAND.progression(p)    -> p entre 0 et 1, pilote la difficulté
     ATT_STAND.arreter()         -> stoppe tout (fin de génération)
     ATT_STAND.demonter()        -> retire le module du DOM
   Aucun son : la radio reste seule source audio.

   ── v1.3 (02/09/2026) ─────────────────────────────────────────
   Fusion des deux pistes essayées le 02/09. On garde de la v1.2 le
   corps des quatre espèces (fuselé, poitrail bien lisible, queue
   juste), le moteur, le chien, la roselière et les retours de tir.
   On change les AILES, qui étaient grêles et se superposaient si
   exactement qu'on n'en lisait qu'une :
     • aile plus large, à trois nervures de rémiges et miroir en base
     • aile lointaine nettement décalée derrière la proche, pour le volume
     • viewBox ASSAINI : l'ancienne aile montait en y négatif et ne
       tenait que par overflow:visible, donc elle se faisait rogner dès
       qu'on imbriquait le canard dans le SVG du chien. Tout le dessin
       vit maintenant dans 0 0 112 102, le corps décalé de +22 en y.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- charte FIDAL v2.2 ---------- */
  var C = {
    nuit: '#0F2238',
    canard: '#33838B',
    orange: '#FF982D',
    carmin: '#A01040',
    cyan: '#6DD5DC',
    jauneForme: '#FFE764',
    jauneTexte: '#FFC900'
  };

  /* ============================================================
     1. CANARDS — corps espèce par espèce, vol vers la droite.
        Repère : viewBox 0 0 112 102. Le corps est dessiné dans
        l'ancien repère (origine en haut du corps) puis décalé de
        +22 en y ; les ailes, elles, sont déjà écrites dans le
        repère final. Épaule à (52,56).
     ============================================================ */

  var CERNE = 'stroke="rgba(8,14,20,.32)" stroke-width="1" stroke-linejoin="round"';

  /* Aile déployée. Lame longue et pointue articulée à l'épaule, avec
     trois nervures de rémiges et le miroir à la base. */
  function aile(dessus, dessous, speculum, loin) {
    var s = '';
    if (loin) {
      // aile lointaine : même lame, décalée derrière et assombrie
      s += '<path d="M46,51 C40,40 34,25 31,13 C30,8 35,6 38,11 '
         + 'C45,26 55,42 59,50 C61,55 52,57 46,51 Z" fill="' + dessus + '" ' + CERNE + '/>';
      s += '<path d="M38,26 L46,40" stroke="rgba(8,14,20,.22)" stroke-width="1.1" fill="none"/>';
      return s;
    }
    // Lame effilée du poignet vers la pointe. Les nervures sont des traits
    // SOMBRES et fins : en clair, elles se lisaient comme des estafilades.
    s += '<path d="M52,56 C46,45 40,29 37,17 C36,12 41,10 44,15 '
       + 'C51,31 61,47 65,55 C67,60 58,62 52,56 Z" fill="' + dessus + '" ' + CERNE + '/>';
    s += '<path d="M41,21 L50,36 M44,17 L54,33" stroke="rgba(8,14,20,.20)" '
       + 'stroke-width="1.1" fill="none"/>';
    s += '<path d="M39,19 C38,15 38,13 37,17 C39,22 42,28 44,32 Z" fill="' + dessous + '" opacity=".55"/>';
    if (speculum) {
      s += '<path d="M58,53 C56,49 54,46 53,45 C57,48 62,52 64,54 '
         + 'C63,57 60,56 58,53 Z" fill="' + speculum + '"/>';
    }
    return s;
  }

  function assembler(parts, largeur) {
    var haut = Math.round(largeur * 102 / 112);
    return '<svg viewBox="0 0 112 102" width="' + largeur + '" height="' + haut + '" '
      + 'xmlns="http://www.w3.org/2000/svg">'
      + '<g class="att-bob">'
      + '<g class="att-aile att-aile-loin">' + parts.aileLoin + '</g>'
      + '<g transform="translate(0,22)">' + parts.corps + '</g>'
      + '<g class="att-aile att-aile-pres">' + parts.ailePres + '</g>'
      + '</g></svg>';
  }

  /* --- Colvert : tête vert bouteille, collier blanc, poitrail marron --- */
  function colvert(l) {
    var corps = ''
      + '<path d="M24,40 C16,38 10,40 6,44 C12,45 18,46 24,47 Z" fill="#F2F2EE" ' + CERNE + '/>'
      + '<path d="M14,39 C9,36 6,37 5,40 C8,40 11,40 14,41 Z" fill="#2A2A28"/>'
      + '<path d="M24,47 C26,54 36,58 48,57 C60,56 70,50 74,42 '
        + 'C76,37 74,33 70,32 C58,30 40,31 30,35 C25,37 23,42 24,47 Z" fill="#C6C8C2" ' + CERNE + '/>'
      + '<path d="M28,36 C40,31 58,30 70,32 C73,33 75,35 74,38 '
        + 'C62,33 44,33 30,38 Z" fill="#6E6A62"/>'
      + '<path d="M64,32 C72,31 78,34 80,40 C81,46 76,52 68,54 '
        + 'C62,55 58,52 58,46 C58,39 60,34 64,32 Z" fill="#6B3A22"/>'
      + '<path d="M72,32 C74,24 80,18 87,17 C94,16 99,21 98,27 '
        + 'C97,33 91,36 85,35 C79,34 75,34 72,32 Z" fill="#17683B" ' + CERNE + '/>'
      + '<path d="M84,19 C90,18 95,21 96,25 C92,22 88,21 84,22 Z" fill="#2E9457"/>'
      + '<path d="M74,31 C78,34 82,35 86,35 C85,37 82,38 78,37 '
        + 'C76,36 74,34 74,31 Z" fill="#FFFFFF"/>'
      + '<path d="M97,24 C103,23 109,25 110,27 C109,30 103,31 97,29 Z" fill="#E2A33C" ' + CERNE + '/>'
      + '<circle cx="92" cy="24" r="1.9" fill="#111"/>'
      + '<circle cx="92.6" cy="23.4" r=".6" fill="#fff" opacity=".8"/>';
    return assembler({
      corps: corps,
      aileLoin: aile('#4E4B45', '#6E6A62', '#1E3A6B', true),
      ailePres: aile('#9A968D', '#C6C8C2', '#2B4C8C', false)
    }, l);
  }

  /* --- Souchet : bec noir en spatule, flancs roux, poitrail blanc --- */
  function souchet(l) {
    var corps = ''
      + '<path d="M24,40 C16,38 10,40 6,44 C12,45 18,46 24,47 Z" fill="#23262B" ' + CERNE + '/>'
      + '<path d="M22,41 C17,40 13,41 10,43 C14,44 18,44 22,45 Z" fill="#F4F1E8"/>'
      + '<path d="M24,47 C26,54 36,58 48,57 C60,56 70,50 74,42 '
        + 'C76,37 74,33 70,32 C58,30 40,31 30,35 C25,37 23,42 24,47 Z" fill="#A8531F" ' + CERNE + '/>'
      + '<path d="M28,36 C40,31 58,30 70,32 C73,33 75,35 74,38 '
        + 'C62,33 44,33 30,38 Z" fill="#3A3D3F"/>'
      + '<path d="M34,36 L48,33 M40,38 L54,34" stroke="#E7E3D8" '
        + 'stroke-width="1.3" fill="none" opacity=".9"/>'
      + '<path d="M64,32 C72,31 78,34 80,40 C81,46 76,52 68,54 '
        + 'C62,55 58,52 58,46 C58,39 60,34 64,32 Z" fill="#F4F1E8"/>'
      + '<path d="M72,32 C74,24 80,18 87,17 C94,16 99,21 98,27 '
        + 'C97,33 91,36 85,35 C79,34 75,34 72,32 Z" fill="#14573A" ' + CERNE + '/>'
      + '<path d="M83,19 C89,18 94,20 96,24 C92,22 87,21 83,22 Z" fill="#237A4C"/>'
      + '<path d="M96,23 C102,22 108,24 111,29 C110,33 104,33 98,30 '
        + 'C96,29 95,26 96,23 Z" fill="#23262B" ' + CERNE + '/>'
      + '<path d="M99,26 C104,26 108,28 110,30" stroke="#4A4F55" '
        + 'stroke-width=".9" fill="none"/>'
      + '<circle cx="91" cy="24" r="1.9" fill="#F5D142"/>'
      + '<circle cx="91" cy="24" r=".9" fill="#111"/>';
    return assembler({
      corps: corps,
      aileLoin: aile('#3F4A4E', '#5D6E74', '#1F5A3A', true),
      ailePres: aile('#6C7F86', '#9FB2B8', '#2E7A4A', false)
    }, l);
  }

  /* --- Sarcelle d'hiver : petite, tête châtaigne, bandeau vert --- */
  function sarcelle(l) {
    var corps = ''
      + '<path d="M24,40 C16,38 10,40 6,44 C12,45 18,46 24,47 Z" fill="#F0D98A" ' + CERNE + '/>'
      + '<path d="M14,39 C10,38 7,39 5,41 C9,42 11,42 14,42 Z" fill="#2A2E33"/>'
      + '<path d="M24,47 C26,54 36,58 48,57 C60,56 70,50 74,42 '
        + 'C76,37 74,33 70,32 C58,30 40,31 30,35 C25,37 23,42 24,47 Z" fill="#B9BCB8" ' + CERNE + '/>'
      + '<path d="M32,42 L58,38 M34,46 L60,42 M36,50 L58,47" stroke="#8B8F8B" '
        + 'stroke-width=".9" fill="none" opacity=".8"/>'
      + '<path d="M28,38 C42,33 60,32 72,34 C60,36 44,37 30,41 Z" fill="#FFFFFF"/>'
      + '<path d="M64,32 C72,31 78,34 80,40 C81,46 76,52 68,54 '
        + 'C62,55 58,52 58,46 C58,39 60,34 64,32 Z" fill="#E6DCC4"/>'
      + '<circle cx="68" cy="40" r=".9" fill="#7A6A50"/>'
      + '<circle cx="73" cy="45" r=".9" fill="#7A6A50"/>'
      + '<circle cx="65" cy="47" r=".9" fill="#7A6A50"/>'
      + '<path d="M72,32 C74,24 80,18 87,17 C94,16 99,21 98,27 '
        + 'C97,33 91,36 85,35 C79,34 75,34 72,32 Z" fill="#7A3B22" ' + CERNE + '/>'
      + '<path d="M88,18 C94,18 98,22 97,27 C95,29 91,29 89,26 '
        + 'C87,23 87,20 88,18 Z" fill="#2E7A4A"/>'
      + '<path d="M87,18 C93,17 98,21 97,27" stroke="#E9D9A8" '
        + 'stroke-width="1.4" fill="none"/>'
      + '<path d="M97,24 C102,23 107,25 108,27 C107,29 102,30 97,28 Z" fill="#2A2E33" ' + CERNE + '/>'
      + '<circle cx="91" cy="23" r="1.7" fill="#111"/>'
      + '<circle cx="91.6" cy="22.5" r=".5" fill="#fff" opacity=".8"/>';
    return assembler({
      corps: corps,
      aileLoin: aile('#6E7069', '#8E9089', '#1F5A3A', true),
      ailePres: aile('#8E9089', '#B9BCB8', '#2E7A4A', false)
    }, l);
  }

  /* --- Mandarin : le rare. Voilure orange, bec rouge, favoris. --- */
  function mandarin(l) {
    var corps = ''
      + '<path d="M24,40 C16,38 10,40 6,44 C12,45 18,46 24,47 Z" fill="#3A2B44" ' + CERNE + '/>'
      + '<path d="M24,47 C26,54 36,58 48,57 C60,56 70,50 74,42 '
        + 'C76,37 74,33 70,32 C58,30 40,31 30,35 C25,37 23,42 24,47 Z" fill="#D3B36A" ' + CERNE + '/>'
      + '<path d="M28,36 C40,31 58,30 70,32 C73,33 75,35 74,38 '
        + 'C62,33 44,33 30,38 Z" fill="#2E2A3A"/>'
      + '<path d="M40,34 C44,22 50,16 56,15 C57,22 54,30 48,36 Z" fill="#D9772B" ' + CERNE + '/>'
      + '<path d="M42,33 C46,24 51,19 55,18" stroke="#F0A24E" '
        + 'stroke-width="1.4" fill="none"/>'
      + '<path d="M64,32 C72,31 78,34 80,40 C81,46 76,52 68,54 '
        + 'C62,55 58,52 58,46 C58,39 60,34 64,32 Z" fill="#4A2E5C"/>'
      + '<path d="M62,35 L64,52 M67,33 L69,53" stroke="#F4F1E8" '
        + 'stroke-width="1.7" fill="none"/>'
      + '<path d="M72,32 C74,24 80,18 87,17 C94,16 99,21 98,27 '
        + 'C97,33 91,36 85,35 C79,34 75,34 72,32 Z" fill="#1B5E3A" ' + CERNE + '/>'
      + '<path d="M86,26 C91,26 95,29 96,33 C91,34 86,32 84,29 Z" fill="#C87A2E"/>'
      + '<path d="M86,20 C91,19 96,22 97,25" stroke="#E8DFC6" '
        + 'stroke-width="1.8" fill="none"/>'
      + '<path d="M97,24 C103,23 108,25 109,27 C108,30 103,31 97,29 Z" fill="#C6362F" ' + CERNE + '/>'
      + '<circle cx="92" cy="23" r="1.8" fill="#111"/>'
      + '<circle cx="92.6" cy="22.4" r=".6" fill="#fff" opacity=".85"/>';
    return assembler({
      corps: corps,
      aileLoin: aile('#2E2A3A', '#4A4458', '#1E3A6B', true),
      ailePres: aile('#4A4458', '#7A6E8C', '#2B4C8C', false)
    }, l);
  }

  var ESPECES = {
    colvert:  { nom: 'Colvert',  points: 1, larg: 78, vitesse: 1.00, poids: 50, svg: colvert,  teinte: '#17683B' },
    souchet:  { nom: 'Souchet',  points: 2, larg: 72, vitesse: 1.18, poids: 30, svg: souchet,  teinte: '#A8531F' },
    sarcelle: { nom: 'Sarcelle', points: 3, larg: 56, vitesse: 1.45, poids: 20, svg: sarcelle, teinte: '#7A3B22' },
    mandarin: { nom: 'Mandarin', points: 5, larg: 62, vitesse: 3.40, poids: 0,  svg: mandarin, teinte: '#D9772B' }
  };

  /* ============================================================
     2. LE CHIEN — springer liver-and-white, trot de profil
     ============================================================ */
  function chienSVG() {
    var patte = function (haut, bas, cls) {
      return '<g class="att-patte ' + cls + '">'
        + '<path d="M0,0 C2,8 1,14 -1,19" stroke="' + haut + '" stroke-width="6.5" '
          + 'stroke-linecap="round" fill="none"/>'
        + '<path d="M-1,17 C-2,22 -1,25 2,27" stroke="' + bas + '" stroke-width="5" '
          + 'stroke-linecap="round" fill="none"/>'
        + '<path d="M2,27 C5,28 7,28 8,27" stroke="' + bas + '" stroke-width="4.5" '
          + 'stroke-linecap="round" fill="none"/>'
        + '</g>';
    };
    return '<svg viewBox="0 0 132 78" width="108" height="64" '
      + 'xmlns="http://www.w3.org/2000/svg" overflow="visible">'
      + '<g transform="translate(34,42)">' + patte('#5E3419', '#C9BFB0', 'att-p2') + '</g>'
      + '<g transform="translate(84,42)">' + patte('#5E3419', '#C9BFB0', 'att-p3') + '</g>'
      + '<g class="att-queue"><path d="M26,40 C16,34 10,32 4,34 C10,38 16,42 24,45 Z" fill="#F2EEE6"/>'
      + '<path d="M22,39 C15,35 10,34 6,35" stroke="#7A4526" stroke-width="2.4" fill="none"/></g>'
      + '<path d="M28,44 C26,34 34,27 48,26 C62,25 78,27 88,31 '
        + 'C96,34 98,40 96,46 C93,53 80,57 62,57 C44,57 30,53 28,44 Z" fill="#F2EEE6"/>'
      + '<path d="M34,32 C44,26 60,25 72,28 C64,33 48,35 36,40 Z" fill="#7A4526"/>'
      + '<path d="M78,48 C86,46 93,47 96,50 C92,55 84,56 78,54 Z" fill="#7A4526" opacity=".85"/>'
      + '<path d="M88,31 C96,32 102,36 103,42 C104,49 99,54 92,55 '
        + 'C86,55 84,50 85,44 C86,37 86,33 88,31 Z" fill="#F2EEE6"/>'
      + '<path d="M92,34 C96,26 104,21 111,22 C118,23 120,29 117,34 '
        + 'C114,39 106,41 99,40 C95,39 92,37 92,34 Z" fill="#F2EEE6"/>'
      + '<path d="M114,27 C120,26 125,28 126,31 C125,34 120,36 114,34 Z" fill="#EDE7DC"/>'
      + '<ellipse cx="125" cy="30.5" rx="2.2" ry="1.8" fill="#2A2320"/>'
      + '<g class="att-oreille"><path d="M104,26 C110,26 113,31 112,38 '
        + 'C111,45 106,48 101,45 C98,42 99,32 104,26 Z" fill="#7A4526"/></g>'
      + '<path d="M107,23 C113,23 117,26 118,30 C113,28 109,27 105,28 Z" fill="#7A4526"/>'
      + '<circle cx="110" cy="29" r="1.8" fill="#2A2320"/>'
      + '<g transform="translate(40,46)">' + patte('#7A4526', '#F2EEE6', 'att-p1') + '</g>'
      + '<g transform="translate(90,46)">' + patte('#7A4526', '#F2EEE6', 'att-p4') + '</g>'
      + '<g class="att-prise" transform="translate(112,30)"></g>'
      + '</svg>';
  }

  /* ============================================================
     3. STYLES
     ============================================================ */
  var CSS = ''
    + '.att-stand{position:absolute;inset:auto auto 12px 12px;z-index:40;'
      + 'font-family:"Segoe UI",system-ui,sans-serif}'
    + '.att-stand-icone{width:52px;height:52px;padding:4px;border-radius:10px;'
      + 'background:' + C.nuit + ';border:1.5px solid ' + C.cyan + ';cursor:pointer;'
      + 'display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.35);'
      + 'transition:none}'
    + '.att-stand-icone svg{width:40px;height:auto;display:block}'
    + '.att-stand-icone:focus-visible{outline:2px solid ' + C.jauneForme + ';outline-offset:2px}'
    + '.att-stand[data-ouvert="1"] .att-stand-icone{border-color:' + C.jauneForme + '}'

    + '.att-stand-carte{position:absolute;bottom:0;left:0;width:min(540px,calc(100vw - 32px));'
      + 'height:min(348px,calc(100vh - 96px));border-radius:12px;overflow:hidden;'
      + 'background:' + C.nuit + ';border:1.5px solid ' + C.canard + ';'
      + 'box-shadow:0 18px 44px rgba(0,0,0,.5);display:none;'
      + 'grid-template-rows:auto 1fr auto}'
    + '.att-stand[data-ouvert="1"] .att-stand-carte{display:grid}'
    + '.att-stand[data-ouvert="1"] .att-stand-icone{position:absolute;bottom:0;left:0;'
      + 'transform:translate(-6px,6px);width:40px;height:40px}'

    + '.att-stand-tete{display:flex;align-items:baseline;justify-content:space-between;'
      + 'gap:12px;padding:8px 12px 6px;border-bottom:1px solid rgba(109,213,220,.25)}'
    + '.att-stand-tete h4{margin:0;font-family:Georgia,"Times New Roman",serif;'
      + 'font-size:15px;font-weight:600;color:#EAF2F3;letter-spacing:.2px}'
    + '.att-stand-score{font-family:Georgia,serif;font-size:22px;color:' + C.jauneTexte + ';'
      + 'font-variant-numeric:tabular-nums;line-height:1}'
    + '.att-stand-score span{font-size:11px;font-family:"Segoe UI",sans-serif;'
      + 'color:' + C.cyan + ';margin-left:4px}'

    + '.att-ciel{position:relative;overflow:hidden;cursor:crosshair;'
      + 'background:linear-gradient(180deg,' + C.nuit + ' 0%,#1C4A5C 45%,' + C.canard + ' 78%,#3F9AA0 100%)}'
    + '.att-soleil{position:absolute;right:14%;bottom:26%;width:46px;height:46px;'
      + 'border-radius:50%;background:radial-gradient(circle,' + C.jauneForme + ' 40%,rgba(255,231,100,0) 72%);'
      + 'opacity:.7;pointer-events:none}'
    + '.att-roseliere{position:absolute;inset:auto 0 0 0;height:44px;pointer-events:none}'

    + '.att-canard{position:absolute;left:0;top:0;will-change:transform;'
      + 'transform-origin:50% 50%;cursor:crosshair}'
    + '.att-canard svg{display:block}'
    /* épaule à (52,56) dans le viewBox assaini ; l'aile lointaine à (46,51) */
    + '.att-aile-pres{transform-box:view-box;transform-origin:52px 56px;'
      + 'animation:att-battement .40s ease-in-out infinite}'
    + '.att-aile-loin{transform-box:view-box;transform-origin:46px 51px;'
      + 'animation:att-battement .42s ease-in-out infinite;animation-delay:.06s}'
    + '.att-bob{transform-box:view-box;transform-origin:50% 50%;'
      + 'animation:att-bob .40s ease-in-out infinite}'
    + '@keyframes att-battement{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-34deg)}}'
    + '@keyframes att-bob{0%,100%{transform:translateY(1.6px)}50%{transform:translateY(-1.6px)}}'
    + '.att-canard.att-touche .att-aile{animation:none;transform:rotate(44deg)}'
    + '.att-canard.att-touche .att-bob{animation:none}'
    + '.att-canard.att-gisant{cursor:default}'

    + '.att-chien{position:absolute;left:0;bottom:2px;will-change:transform;pointer-events:none}'
    + '.att-chien svg{display:block;overflow:visible}'
    + '.att-patte{transform-box:view-box;transform-origin:0 0;'
      + 'animation:att-trot .34s ease-in-out infinite}'
    + '.att-p2,.att-p4{animation-delay:.17s}'
    + '.att-queue{transform-box:view-box;transform-origin:26px 42px;'
      + 'animation:att-remue .28s ease-in-out infinite}'
    + '.att-oreille{transform-box:view-box;transform-origin:104px 27px;'
      + 'animation:att-oreille .34s ease-in-out infinite}'
    + '@keyframes att-trot{0%,100%{transform:rotate(20deg)}50%{transform:rotate(-22deg)}}'
    + '@keyframes att-remue{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(11deg)}}'
    + '@keyframes att-oreille{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}'
    + '.att-chien.att-arret .att-patte,.att-chien.att-arret .att-oreille{animation:none}'

    + '.att-impact{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;'
      + 'border:2px solid ' + C.jauneForme + ';border-radius:50%;pointer-events:none;'
      + 'animation:att-impact .34s ease-out forwards}'
    + '@keyframes att-impact{from{transform:scale(.3);opacity:.95}to{transform:scale(1.6);opacity:0}}'
    + '.att-gain{position:absolute;font-family:Georgia,serif;font-size:17px;font-weight:700;'
      + 'color:' + C.jauneTexte + ';text-shadow:0 1px 3px rgba(0,0,0,.7);pointer-events:none;'
      + 'animation:att-gain .8s ease-out forwards}'
    + '@keyframes att-gain{from{transform:translateY(0);opacity:1}to{transform:translateY(-26px);opacity:0}}'

    + '.att-bareme{display:flex;gap:14px;flex-wrap:wrap;padding:7px 12px;'
      + 'border-top:1px solid rgba(109,213,220,.25);font-size:11.5px;color:#BFD4D7}'
    + '.att-bareme b{color:#EAF2F3;font-weight:600}'
    + '.att-bareme i{width:9px;height:9px;border-radius:50%;display:inline-block;'
      + 'margin-right:5px;vertical-align:baseline}'

    + '@media (prefers-reduced-motion:reduce){'
      + '.att-bob,.att-queue,.att-oreille{animation:none}'
      + '.att-aile-pres,.att-aile-loin{animation-duration:.7s}}';

  /* ============================================================
     4. MOTEUR
     ============================================================ */
  var hote = null, racine = null, carte = null, ciel = null,
      elScore = null, chien = null, prise = null;

  var canards = [];      // en vol ou en chute
  var gisants = [];      // tombés, attendent le chien
  var score = 0, p = 0, ouvert = false, vivant = false;
  var raf = null, dernier = 0, prochainTir = 0, dernierRare = -1e9, horloge = 0;

  var etatChien = 'coulisse';  // coulisse | aller | ramasse | retour
  var chienX = 0, chienDir = 1, chienCible = null, chienPause = 0;

  var SOL_MARGE = 26;   // hauteur de la roselière où reposent les canards
  var RAPPORT = 102 / 112;   // hauteur/largeur du dessin de canard

  function lerp(a, b, t) { return a + (b - a) * t; }
  function alea(a, b) { return a + Math.random() * (b - a); }

  function styles() {
    if (document.getElementById('att-stand-css')) return;
    var s = document.createElement('style');
    s.id = 'att-stand-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function roseliere() {
    var s = '<svg viewBox="0 0 540 44" preserveAspectRatio="none" width="100%" height="100%" '
      + 'xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M0,20 C60,12 120,22 190,16 C260,10 320,20 400,14 C460,10 510,18 540,14 L540,44 L0,44 Z" '
        + 'fill="#14414B"/>'
      + '<path d="M0,28 C80,22 150,30 230,24 C310,18 380,28 460,22 C500,19 520,24 540,22 L540,44 L0,44 Z" '
        + 'fill="#0D2E36"/>';
    for (var i = 0; i < 22; i++) {
      var x = 8 + i * 25 + (i % 3) * 5, h = 16 + (i % 4) * 7;
      s += '<path d="M' + x + ',44 C' + (x - 1) + ',' + (44 - h * .6) + ' '
        + (x + 2) + ',' + (44 - h * .8) + ' ' + (x + 1) + ',' + (44 - h) + '" '
        + 'stroke="#0A2429" stroke-width="1.6" fill="none"/>';
      if (i % 3 === 0) {
        s += '<ellipse cx="' + (x + 1) + '" cy="' + (44 - h - 3) + '" rx="1.7" ry="4" fill="#7A4526"/>';
      }
    }
    return s + '</svg>';
  }

  function construire() {
    styles();
    racine = document.createElement('div');
    racine.className = 'att-stand';
    racine.setAttribute('data-ouvert', '0');
    racine.innerHTML = ''
      + '<div class="att-stand-carte" role="group" aria-label="Stand de tir">'
      +   '<div class="att-stand-tete">'
      +     '<h4>Stand de tir</h4>'
      +     '<div class="att-stand-score">0<span>points</span></div>'
      +   '</div>'
      +   '<div class="att-ciel">'
      +     '<div class="att-soleil"></div>'
      +     '<div class="att-roseliere">' + roseliere() + '</div>'
      +   '</div>'
      +   '<div class="att-bareme">'
      +     '<span><i style="background:' + ESPECES.colvert.teinte + '"></i>Colvert <b>1</b></span>'
      +     '<span><i style="background:' + ESPECES.souchet.teinte + '"></i>Souchet <b>2</b></span>'
      +     '<span><i style="background:' + ESPECES.sarcelle.teinte + '"></i>Sarcelle <b>3</b></span>'
      +     '<span><i style="background:' + ESPECES.mandarin.teinte + '"></i>Mandarin <b>5</b></span>'
      +   '</div>'
      + '</div>'
      + '<button class="att-stand-icone" type="button" aria-label="Ouvrir le stand de tir">'
      +   colvert(40)
      + '</button>';

    carte = racine.querySelector('.att-stand-carte');
    ciel = racine.querySelector('.att-ciel');
    elScore = racine.querySelector('.att-stand-score');

    racine.querySelector('.att-stand-icone')
      .addEventListener('click', function () { ouvert ? replier() : deplier(); });
    ciel.addEventListener('pointerdown', tir);

    chien = document.createElement('div');
    chien.className = 'att-chien att-arret';
    chien.innerHTML = chienSVG();
    chien.style.transform = 'translate3d(-160px,0,0)';
    ciel.appendChild(chien);
    prise = chien.querySelector('.att-prise');

    hote.appendChild(racine);
  }

  function deplier() {
    ouvert = true;
    racine.setAttribute('data-ouvert', '1');
    racine.querySelector('.att-stand-icone')
      .setAttribute('aria-label', 'Replier le stand de tir');
    if (!vivant) { vivant = true; dernier = performance.now(); prochainTir = 0.8; boucle(); }
  }

  function replier() {
    ouvert = false;
    racine.setAttribute('data-ouvert', '0');
    racine.querySelector('.att-stand-icone')
      .setAttribute('aria-label', 'Ouvrir le stand de tir');
    /* le score est conservé tant que la génération tourne :
       on gèle la partie, on ne la remet pas à zéro */
    vivant = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  /* ---------- apparitions ---------- */
  function lacher(rare) {
    var W = ciel.clientWidth, H = ciel.clientHeight;
    if (!W || !H) return;

    var cle;
    if (rare) {
      cle = 'mandarin';
    } else {
      var total = 0, k;
      for (k in ESPECES) total += ESPECES[k].poids;
      var d = Math.random() * total;
      for (k in ESPECES) { d -= ESPECES[k].poids; if (d <= 0) { cle = k; break; } }
    }
    var e = ESPECES[cle];
    var dir = Math.random() < 0.62 ? 1 : -1;
    var l = e.larg, hh = l * RAPPORT;
    var base = alea(H * 0.06, H - SOL_MARGE - hh - H * 0.04);
    if (base < 0) base = 0;
    var v = e.vitesse * lerp(96, 178, p) * (rare ? 1 : alea(0.9, 1.1));

    var el = document.createElement('div');
    el.className = 'att-canard';
    el.innerHTML = e.svg(l);
    el.style.width = l + 'px';
    ciel.insertBefore(el, chien);

    var c = {
      el: el, esp: e, dir: dir, l: l, h: hh,
      x: dir === 1 ? -l - 10 : W + 10,
      y: base, base: base,
      v: v, vy: 0,
      amp: rare ? alea(6, 12) : alea(12, 26),
      per: alea(1.5, 2.6),
      ph: Math.random() * 6.28,
      rot: 0, touche: false, gisant: false
    };
    el.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      toucher(c, ev);
    });
    canards.push(c);
    poser(c);
  }

  function poser(c) {
    c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0) '
      + 'rotate(' + c.rot.toFixed(1) + 'deg) scaleX(' + (c.dir === 1 ? 1 : -1) + ')';
  }

  /* ---------- tir ---------- */
  function toucher(c, ev) {
    if (c.touche) return;
    c.touche = true;
    c.el.classList.add('att-touche');
    c.vy = 40;
    score += c.esp.points;
    elScore.innerHTML = score + '<span>points</span>';
    marque(ev, '+' + c.esp.points);
  }

  function tir(ev) {
    /* clic dans le vide : simple anneau, aucun son */
    var r = ciel.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'att-impact';
    d.style.left = (ev.clientX - r.left) + 'px';
    d.style.top = (ev.clientY - r.top) + 'px';
    ciel.appendChild(d);
    setTimeout(function () { d.remove(); }, 360);
  }

  function marque(ev, txt) {
    var r = ciel.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'att-gain';
    d.textContent = txt;
    d.style.left = (ev.clientX - r.left - 8) + 'px';
    d.style.top = (ev.clientY - r.top - 14) + 'px';
    ciel.appendChild(d);
    setTimeout(function () { d.remove(); }, 820);
  }

  /* ---------- chien rapporteur ---------- */
  function majChien(dt) {
    var W = ciel.clientWidth;
    var vitesse = 210;

    if (etatChien === 'coulisse') {
      if (!gisants.length) return;
      chienCible = gisants[0];
      chienDir = chienCible.x < W / 2 ? 1 : -1;
      chienX = chienDir === 1 ? -130 : W + 130;
      etatChien = 'aller';
      chien.classList.remove('att-arret');
    }

    if (etatChien === 'aller') {
      if (!chienCible || !chienCible.el.isConnected) { etatChien = 'retour'; }
      else {
        var but = chienCible.x + chienCible.l * 0.35;
        chienX += chienDir * vitesse * dt;
        if ((chienDir === 1 && chienX >= but) || (chienDir === -1 && chienX <= but)) {
          chienX = but;
          etatChien = 'ramasse';
          chienPause = 0.45;
          chien.classList.add('att-arret');
        }
      }
    } else if (etatChien === 'ramasse') {
      chienPause -= dt;
      if (chienPause <= 0) {
        if (chienCible) {
          /* le canard passe dans la gueule. Le viewBox assaini rend cette
             imbrication propre : plus rien ne dépasse du cadre du dessin. */
          var lm = Math.round(chienCible.l * 0.52);
          prise.innerHTML = '<g transform="rotate(16) translate(' + (-lm * 0.42)
            + ',' + (-lm * 0.22) + ')">'
            + chienCible.esp.svg(lm) + '</g>';
          var i = gisants.indexOf(chienCible);
          if (i >= 0) gisants.splice(i, 1);
          chienCible.el.remove();
          var k0 = canards.indexOf(chienCible);
          if (k0 >= 0) canards.splice(k0, 1);
          chienCible = null;
        }
        etatChien = 'retour';
        chien.classList.remove('att-arret');
      }
    } else if (etatChien === 'retour') {
      chienX -= chienDir * vitesse * dt;
      var sorti = chienDir === 1 ? chienX < -150 : chienX > W + 150;
      if (sorti) {
        prise.innerHTML = '';
        etatChien = 'coulisse';
        chien.classList.add('att-arret');
        chienX = -160;
      }
    }

    /* en retour le chien fait demi-tour : il repart d'où il vient */
    var mir = (etatChien === 'retour') ? -chienDir : chienDir;
    chien.style.transform = 'translate3d(' + chienX.toFixed(1) + 'px,0,0) scaleX(' + mir + ')';
  }

  /* ---------- boucle ---------- */
  function boucle() {
    raf = requestAnimationFrame(boucle);
    var t = performance.now();
    var dt = Math.min((t - dernier) / 1000, 0.05);
    dernier = t;
    if (!ouvert) return;
    horloge += dt;

    var W = ciel.clientWidth, H = ciel.clientHeight;
    var solY = H - SOL_MARGE;

    /* apparitions : 3,5 s au départ, jusqu'à 0,9 s en fin de génération */
    var maxSim = Math.min(3, 1 + Math.floor(p * 3));
    var enVol = 0;
    for (var i = 0; i < canards.length; i++) if (!canards[i].touche) enVol++;
    prochainTir -= dt;
    if (prochainTir <= 0 && enVol < maxSim) {
      var rare = (horloge - dernierRare > 12) && Math.random() < (0.04 + 0.05 * p);
      if (rare) dernierRare = horloge;
      lacher(rare);
      prochainTir = lerp(3.5, 0.9, p) * alea(0.85, 1.15);
    }

    for (var j = canards.length - 1; j >= 0; j--) {
      var c = canards[j];

      if (c.gisant) continue;

      if (!c.touche) {
        c.x += c.dir * c.v * dt;
        c.ph += dt * (6.28 / c.per);
        c.y = c.base + Math.sin(c.ph) * c.amp;
        if ((c.dir === 1 && c.x > W + c.l + 20) || (c.dir === -1 && c.x < -c.l - 20)) {
          c.el.remove(); canards.splice(j, 1); continue;
        }
      } else {
        /* chute libre jusqu'au bas de la carte */
        c.vy += 780 * dt;
        c.y += c.vy * dt;
        c.x += c.dir * 26 * dt;
        c.rot += (c.dir === 1 ? 190 : -190) * dt;
        if (c.y >= solY - c.h * 0.55) {
          c.y = solY - c.h * 0.55;
          c.rot = c.dir === 1 ? 172 : 188;
          c.gisant = true;
          c.el.classList.add('att-gisant');
          gisants.push(c);
          while (gisants.length > 8) {          /* le chien ne suit plus : on désencombre */
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
     5. API
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
    progression: function (v) {
      p = Math.max(0, Math.min(1, Number(v) || 0));
      return this;
    },
    arreter: function () {
      /* fin de génération : bascule immédiate, pas d'écran de score */
      vivant = false; ouvert = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (racine) racine.setAttribute('data-ouvert', '0');
      return this;
    },
    demonter: function () {
      this.arreter();
      canards.length = 0; gisants.length = 0;
      if (racine) { racine.remove(); racine = null; }
      score = 0;
      return this;
    },
    score: function () { return score; },
    version: '1.3'
  };
})();
