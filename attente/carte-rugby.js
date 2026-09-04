/* ATTENTE — SECOND ÉCRAN DU CAISSON DE CLASSEMENTS (Top 14)
   Fichier : attente/carte-rugby.js
   Chargé à la volée par attente.js, sur le même domaine.

   ── v2 (04/09/2026) ────────────────────────────────────────────────────────
   Ce fichier NE CRÉE PLUS DE CARTE. La v1 ajoutait un second caisson à côté
   de la Ligue 1 : écartée avant tout déploiement, elle coûtait 306 px de
   largeur à une rangée qui en occupait déjà 1 720 et faisait passer les
   cartes à la ligne.

   Le gabarit du second écran vit désormais dans attente.js
   (#att-bloc-rugby, dans le caisson #att-c-classements). Ici on ne fait que
   le remplir et l'allumer.

   ── Pourquoi ce fichier existe quand même ──────────────────────────────────
   Même raison que stand.js : le Top 14 a sa propre source et son propre cycle
   de saison. Inutile de rouvrir attente.js chaque fois que l'un des deux
   bouge.

   ⚠ Les données viennent de /api/rugby, PAS de /api/veille : cette route lit
   fr.wikipedia.org via l'API MediaWiki — ni clé, ni quota, ni échéance.
   API-Sports a été ouvert le 03/09 puis écarté le même jour (palier gratuit
   limité aux saisons 2022 à 2024).

   ⚠ AUCUN style propre : .att-bloc / .att-ecran / .att-rang sont définis dans
   attente.js. Ne rien dupliquer ici, sinon les deux écrans divergeront.

   ⚠ 8 rangs au maximum. Les rangs 7 et 8 sont masqués par CSS tant que le
   caisson n'est pas déplié ; en renvoyer davantage ferait apparaître au
   dépliage des lignes que personne n'a demandées.

   API :
     ATT_RUGBY.monter()    charge et remplit le second écran
     ATT_RUGBY.charger()   recharge les données
*/
(function () {
  "use strict";
  if (window.ATT_RUGBY) return;

  var SCRIPT = document.currentScript;
  var BASE = SCRIPT && SCRIPT.src ? new URL(SCRIPT.src).origin : "";

  var RANGS = 8;

  var echap = function (t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  var $ = function (id) { return document.getElementById(id); };

  /* « 2025-2026 » → « 25-26 ». L'intitulé complet renvoyé par la route
     (« Top 14 2025-2026 — classement final ») ne tient pas dans la pastille
     de journée : on garde le nom court à gauche, la saison abrégée à droite. */
  function saisonCourte(s) {
    return String(s || "").replace(/^\d{2}(\d{2})-\d{2}(\d{2})$/, "$1-$2");
  }

  function charger() {
    var corps = $("att-c-rugby-b");
    if (!corps || !BASE) return;   /* gabarit absent : attente.js trop ancien */

    fetch(BASE + "/api/rugby")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var l = (d && d.classement) || [];
        if (!l.length) return;

        $("att-c-rugby-t").textContent = d.competition || "Top 14";

        /* Hors saison, la route renvoie le classement final de l'année passée
           et le signale : la pastille le dit, plutôt que d'afficher quatorze
           clubs à égalité à zéro. Vaut aussi pour l'intersaison de juin à
           septembre, soit trois mois par an. */
        $("att-c-rugby-j").textContent = d.classementFinal
          ? "Final " + saisonCourte(d.saison)
          : (d.journee ? "J. " + d.journee : "");

        corps.innerHTML = l.slice(0, RANGS).map(function (x, i) {
          var rang = +(x.rang != null ? x.rang : i + 1);
          /* Structure du Top 14, et non celle du football : les DEUX premiers
             filent en demi-finales, les rangs 3 à 6 passent par les barrages.
             On réutilise les pastilles « podium » et « euro », seuls les
             seuils changent. */
          var genre = rang <= 2 ? " podium" : rang <= 6 ? " euro" : "";
          return '<tr><td><span class="att-rang' + genre + '">' + rang + '</span></td>' +
            '<td class="equipe">' + echap(x.equipe == null ? "" : x.equipe) + '</td>' +
            '<td class="pts">' + (x.points == null ? "" : x.points) + '</td></tr>';
        }).join("");

        $("att-bloc-rugby").classList.add("on");
        /* le caisson s'allume aussi : si la Ligue 1 est muette, le Top 14
           s'affiche seul plutôt que de rester invisible */
        $("att-c-classements").classList.add("on");
      })
      .catch(function () {
        /* Une source muette laisse un écran en moins, jamais un cadre vide :
           l'écran d'attente ne montre pas ses échecs. */
      });
  }

  window.ATT_RUGBY = {
    monter: function () { charger(); return this; },
    charger: charger
  };
})();
