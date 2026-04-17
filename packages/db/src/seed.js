// Seed complet — arbre de décision VMC avec les 4 branches opérationnelles :
//   - ENTRETIEN préventif (7 étapes)
//   - DEPANNAGE (5 sous-arbres : Ne fonctionne plus, Bruit, Débit, Humidité, Code erreur)
//   - REMPLACEMENT (9 étapes)
//   - INSTALLATION neuve (10 étapes)

const { prisma } = require("./index");

// Liste générique de marques (Remplacement ancien + nouveau + Installation)
const MARQUES = [
  { valeur: "aldes", libelle: "Aldes" },
  { valeur: "atlantic", libelle: "Atlantic" },
  { valeur: "unelvent", libelle: "Unelvent" },
  { valeur: "autogyre", libelle: "Autogyre" },
  { valeur: "brink", libelle: "Brink" },
  { valeur: "helios", libelle: "Helios" },
  { valeur: "zehnder", libelle: "Zehnder" },
  { valeur: "autre", libelle: "Autre (préciser en commentaire)" },
];

async function main() {
  console.log("🧹 Nettoyage des tables...");
  await prisma.capture.deleteMany();
  await prisma.pieceUtilisee.deleteMany();
  await prisma.reponseDonnee.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.reponsePossible.deleteMany();
  await prisma.question.deleteMany();
  await prisma.intervenant.deleteMany();
  await prisma.client.deleteMany();

  console.log("👷 Création des intervenants...");
  await prisma.intervenant.createMany({
    data: [
      { nom: "Pereira", prenom: "Jean", specialite: "VMC" },
      { nom: "Schmitt", prenom: "Marc", specialite: "VMC" },
      { nom: "Dupont", prenom: "Sophie", specialite: "VMC" },
    ],
  });

  console.log("🏠 Création des clients...");
  await prisma.client.createMany({
    data: [
      { nom: "Famille Weber", adressePrincipale: "12 rue de Hollerich, 1740 Luxembourg", type: "particulier" },
      { nom: "Résidence Belair", adressePrincipale: "8 av. du X Septembre, 2550 Luxembourg", type: "professionnel" },
      { nom: "Famille Hoffmann", adressePrincipale: "3 rue Albert Wehrer, 2723 Luxembourg", type: "particulier" },
    ],
  });

  console.log("🌳 Construction de l'arbre de décision...");

  const Q = {};
  async function makeQuestion(code, libelle, typeReponse, opts = {}) {
    Q[code] = await prisma.question.create({
      data: {
        code,
        libelle,
        typeReponse,
        contexteMetier: "VMC",
        ordre: opts.ordre || 0,
        captureObligatoire: opts.captureObligatoire || null,
        uniteAttendue: opts.uniteAttendue || null,
        aideTexte: opts.aideTexte || null,
      },
    });
    return Q[code];
  }

  // ═══ NIVEAU 0 : ENTRÉE — choix du motif ══════════════════════════
  await makeQuestion("VMC_ENTREE_MOTIF", "Quel est le motif de l'intervention ?", "CHOIX_UNIQUE", { ordre: 1 });

  // ═══ AIGUILLAGE PAR MOTIF ═════════════════════════════════════════
  await makeQuestion("VMC_DEP_SYMPT", "Quel symptôme est signalé ?", "CHOIX_UNIQUE", { ordre: 2 });
  await makeQuestion("VMC_ENT_TYPE", "Quel type de VMC à entretenir ?", "CHOIX_UNIQUE", { ordre: 3 });
  await makeQuestion("VMC_REM_MARQUE_ANCIENNE", "Quelle est la marque de la VMC à déposer ?", "CHOIX_UNIQUE", { ordre: 4 });
  await makeQuestion("VMC_INS_TYPE", "Type de VMC à installer ?", "CHOIX_UNIQUE", { ordre: 5 });

  // ═══ CLÔTURE COMMUNE : signature ══════════════════════════════════
  await makeQuestion(
    "VMC_CLOTURE_SIGNATURE",
    "Signature du client pour validation",
    "SIGNATURE",
    { ordre: 100, captureObligatoire: "SIGNATURE", aideTexte: "Faire signer sur la tablette" }
  );

  // ═══════════════════════════════════════════════════════════════════
  // SOUS-ARBRE 1 : DÉPANNAGE — Ne fonctionne plus
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_DEP_NF_ALIM", "L'alimentation électrique est-elle présente ?", "CHOIX_UNIQUE",
    { ordre: 30, captureObligatoire: "PHOTO", aideTexte: "Photographier le tableau électrique. Vérifier : présence de tension au testeur, position du disjoncteur dédié VMC (souvent 2A ou 6A), traces de chauffe ou noircissement" });
  await makeQuestion("VMC_DEP_NF_DISJ", "Le disjoncteur dédié est-il enclenché (non déclenché) ?", "CHOIX_UNIQUE",
    { ordre: 31, captureObligatoire: "PHOTO", aideTexte: "Le disjoncteur dédié VMC est généralement un 2A en tête de rangée. S'il a déclenché : le réarmer et observer s'il retient. S'il redisjoncte immédiatement → court-circuit probable dans le moteur ou le câblage" });
  await makeQuestion("VMC_DEP_NF_TURBINE", "La mototurbine tourne-t-elle quand on la lance manuellement ?", "CHOIX_UNIQUE",
    { ordre: 32, captureObligatoire: "PHOTO", aideTexte: "Couper le courant avant manipulation. Démonter les conduits du caisson. Lancer la turbine à la main : elle doit tourner librement sans point dur. Si elle accroche ou grince → roulements HS. Photographier l'état du moteur et de l'axe" });
  await makeQuestion("VMC_DEP_NF_CONDO", "Capacité du condensateur de démarrage (µF mesurés au testeur)", "NUMERIQUE",
    { ordre: 33, captureObligatoire: "MESURE", uniteAttendue: "µF",
      aideTexte: "Débrancher le condensateur avant mesure. La valeur nominale est gravée sur le boîtier (ex: 4µF ±5%). Tolérance acceptable : ±10% de la valeur nominale. En dessous → le moteur peine à démarrer ou ne démarre plus. Condensateur typique VMC : 2 à 8 µF selon modèle" });
  await makeQuestion("VMC_DEP_NF_DEBIT_FINAL", "Mesure de débit après remise en service", "NUMERIQUE",
    { ordre: 34, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre à la bouche de SDB. Conforme si ≥ 30 m³/h" });

  // ═══════════════════════════════════════════════════════════════════
  // SOUS-ARBRE 2 : DÉPANNAGE — Bruit anormal
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_DEP_BRUIT_TYPE", "Quel type de bruit entendez-vous ?", "CHOIX_UNIQUE",
    { ordre: 40, aideTexte: "Écouter à proximité du caisson et des bouches" });
  await makeQuestion("VMC_DEP_BRUIT_CAISSON", "Le caisson VMC est-il correctement suspendu (silent-blocs OK) ?", "CHOIX_UNIQUE",
    { ordre: 41, captureObligatoire: "PHOTO", aideTexte: "Photo de la fixation du caisson" });
  await makeQuestion("VMC_DEP_BRUIT_GAINES", "Les gaines sont-elles non pincées et non obstruées ?", "CHOIX_UNIQUE",
    { ordre: 42, captureObligatoire: "PHOTO", aideTexte: "Photo du parcours des gaines visibles" });
  await makeQuestion("VMC_DEP_BRUIT_MOTEUR", "État du moteur (roulements, axe) — tourne sans accroc ?", "CHOIX_UNIQUE",
    { ordre: 43, captureObligatoire: "PHOTO", aideTexte: "Démonter et inspecter le moteur" });

  // ═══════════════════════════════════════════════════════════════════
  // SOUS-ARBRE 3 : DÉPANNAGE — Débit insuffisant
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_DEP_DEBIT_MESURE_INIT", "Mesure débit à la bouche principale (avant intervention)", "NUMERIQUE",
    { ordre: 50, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Placer l'anémomètre bien centré sur la bouche d'extraction. Attendre 10 secondes de stabilisation avant lecture. Normes arrêté du 24/03/1982 : SDB ≥ 30 m³/h, WC ≥ 15 m³/h, cuisine ≥ 45 m³/h (ouverte). Si bouche hygroréglable : mesurer en mode manuel forcé" });
  await makeQuestion("VMC_DEP_DEBIT_BOUCHES", "Les bouches d'extraction sont-elles propres ?", "CHOIX_UNIQUE",
    { ordre: 51, captureObligatoire: "PHOTO", aideTexte: "Photographier chaque bouche AVANT nettoyage (preuve d'encrassement). Nettoyer à l'eau tiède savonneuse pour les bouches autoréglables. ATTENTION : ne PAS mouiller les bouches hygroréglables (la bandelette hygrosensible serait détruite). Les sécher à l'air ou les essuyer délicatement" });
  await makeQuestion("VMC_DEP_DEBIT_FILTRES", "État des filtres (double flux uniquement) ?", "CHOIX_UNIQUE",
    { ordre: 52, captureObligatoire: "PHOTO", aideTexte: "Double flux uniquement. Filtres extraction : G3 ou G4 (gris, côté air vicié). Filtres insufflation : F7 (blanc, côté air neuf). Changer si visiblement gris/noir ou si > 6 mois d'utilisation. Noter la référence pour commande : format + dimensions (ex: 300x200 G4)" });
  await makeQuestion("VMC_DEP_DEBIT_GAINES", "Gaines obstruées ou percées ?", "CHOIX_UNIQUE",
    { ordre: 53, captureObligatoire: "PHOTO", aideTexte: "Inspecter les gaines accessibles dans les combles, faux-plafonds et placards. Vérifier : pas d'écrasement, pas de coude à 90° trop serré (perte de charge), pas de déconnexion aux jonctions, pas de perforation. Les gaines souples doivent être tendues, pas affaissées" });
  await makeQuestion("VMC_DEP_DEBIT_MESURE_FIN", "Mesure débit après intervention (vérification finale)", "NUMERIQUE",
    { ordre: 54, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Remesure pour confirmer le rétablissement du débit" });

  // ═══════════════════════════════════════════════════════════════════
  // SOUS-ARBRE 4 : DÉPANNAGE — Humidité persistante
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_DEP_HUM_FLUX", "Sens du flux correct (test fumée ou papier) ?", "CHOIX_UNIQUE",
    { ordre: 60, captureObligatoire: "PHOTO", aideTexte: "Test fumée : allumer un bâton d'encens ou une cigarette et l'approcher à 5 cm de la bouche d'extraction. La fumée doit être aspirée vers la bouche. Si elle est repoussée → flux inversé (câblage moteur inversé ou entrée d'air extérieur par le caisson). Si elle stagne → débit nul" });
  await makeQuestion("VMC_DEP_HUM_DEBIT", "Mesure débit aux bouches humides (SDB, cuisine)", "NUMERIQUE",
    { ordre: 61, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Conforme si SDB ≥ 30 m³/h, cuisine selon norme" });
  await makeQuestion("VMC_DEP_HUM_GAINES", "Condensation dans les gaines (combles non isolés) ?", "CHOIX_UNIQUE",
    { ordre: 62, captureObligatoire: "PHOTO", aideTexte: "Dans les combles non isolés, les gaines subissent de fortes variations de température qui provoquent de la condensation. Vérifier : présence de gouttes d'eau dans les gaines, traces d'humidité aux raccords, isolation des gaines (calorifugeage). Si condensation → isoler les gaines avec de la laine minérale ou des manchons isolants" });
  await makeQuestion("VMC_DEP_HUM_EXTERNE", "Signes d'infiltration ou ponts thermiques dans le logement ?", "CHOIX_UNIQUE",
    { ordre: 63, captureObligatoire: "PHOTO", aideTexte: "Rechercher les signes d'infiltration extérieure : taches d'eau sur murs/plafonds, moisissures en angle de murs (= pont thermique), peinture qui cloque, odeur de moisi localisée. Si ces signes existent SANS lien avec la VMC → cause externe (défaut d'étanchéité, fissure, pont thermique). Hors périmètre VMC, signaler au client" });

  // ═══════════════════════════════════════════════════════════════════
  // SOUS-ARBRE 5 : DÉPANNAGE — Code erreur (double flux)
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_DEP_CODE_SAISIE", "Saisir le code erreur affiché sur la centrale", "TEXTE_LIBRE",
    { ordre: 70, captureObligatoire: "PHOTO", aideTexte: "Photographier l'afficheur de la centrale double flux avec le code visible. Saisir le code exactement comme affiché (ex: E03, ERR1, F2). Les codes courants : E01/E02 = défaut sonde température, E03 = surchauffe échangeur, E04 = défaut moteur, ERR = défaut général. Consulter la notice constructeur si disponible sur place" });
  await makeQuestion("VMC_DEP_CODE_ACTION", "Action corrective effectuée (réarmement, nettoyage, remplacement sonde...) ?", "CHOIX_UNIQUE",
    { ordre: 71, captureObligatoire: "PHOTO", aideTexte: "Documenter l'action corrective effectuée avec une photo. Actions courantes par code : surchauffe → nettoyer l'échangeur et vérifier le bypass, défaut sonde → vérifier le branchement ou remplacer, défaut moteur → vérifier condensateur et câblage. Après action, attendre 30 secondes avant de revérifier le code" });
  await makeQuestion("VMC_DEP_CODE_VERIF", "Le code erreur a-t-il disparu après l'action ?", "CHOIX_UNIQUE",
    { ordre: 72, captureObligatoire: "PHOTO", aideTexte: "Photo de l'afficheur après intervention" });

  // ═══════════════════════════════════════════════════════════════════
  // ENTRETIEN PRÉVENTIF (7 étapes)
  // ═══════════════════════════════════════════════════════════════════
  await makeQuestion("VMC_ENT_CAISSON", "État général du caisson (encrassement, fixation) ?", "CHOIX_UNIQUE",
    { ordre: 80, captureObligatoire: "PHOTO", aideTexte: "Photographier le caisson dans son ensemble : fixation (silent-blocs OK ?), état général (rouille, poussière excessive), branchements électriques, état des gaines raccordées. Aspirer la poussière extérieure du caisson et vérifier que les ouïes de ventilation ne sont pas obstruées" });
  await makeQuestion("VMC_ENT_BOUCHES", "Nettoyage des bouches d'extraction effectué ?", "CHOIX_UNIQUE",
    { ordre: 81, captureObligatoire: "PHOTO", aideTexte: "Photographier les bouches APRÈS nettoyage pour preuve de travail effectué. Vérifier que les bouches sont correctement remontées et que le débit n'est pas obstrué. Pour les bouches hygroréglables : vérifier que la bandelette bouge librement (souffler dessus, elle doit réagir)" });
  await makeQuestion("VMC_ENT_FILTRES", "État des filtres (si double flux) ?", "CHOIX_UNIQUE",
    { ordre: 82, captureObligatoire: "PHOTO", aideTexte: "Double flux : vérifier l'état des filtres extraction (G3/G4) et insufflation (F7). Un filtre colmaté réduit fortement le débit et fatigue le moteur. Fréquence de remplacement recommandée : tous les 6 mois (G4) à 1 an (F7). Simple flux : pas de filtre, choisir N/A" });
  await makeQuestion("VMC_ENT_GAINES", "Inspection visuelle des gaines accessibles ?", "CHOIX_UNIQUE",
    { ordre: 83, captureObligatoire: "PHOTO", aideTexte: "Contrôle visuel des gaines accessibles. Points de vigilance : écrasement sous du matériel stocké, coudes trop serrés (perte de charge), déconnexions, gaines percées par des rongeurs, gaines non isolées en combles froids (risque condensation). Signaler tout défaut constaté" });
  await makeQuestion("VMC_ENT_DEBIT", "Mesure de débit de contrôle à la bouche SDB", "NUMERIQUE",
    { ordre: 84, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre. Conforme si ≥ 30 m³/h en SDB" });

  // ═══════════════════════════════════════════════════════════════════
  // REMPLACEMENT (9 étapes)
  // ═══════════════════════════════════════════════════════════════════
  // Étape 1 déjà créée : VMC_REM_MARQUE_ANCIENNE (marque ancienne)
  await makeQuestion("VMC_REM_PHOTO_ANCIEN", "Photo de l'ancien caisson avant dépose", "CHOIX_UNIQUE",
    { ordre: 90, captureObligatoire: "PHOTO", aideTexte: "Photo obligatoire AVANT dépose : caisson en place, branchements visibles, étiquette signalétique lisible (marque, modèle, puissance, date). Cette photo servira de référence en cas de litige ou de retour SAV" });
  await makeQuestion("VMC_REM_MARQUE_NEUVE", "Quelle est la marque de la nouvelle VMC installée ?", "CHOIX_UNIQUE",
    { ordre: 91 });
  await makeQuestion("VMC_REM_GAINES", "Les gaines existantes sont-elles conservées ou remplacées ?", "CHOIX_UNIQUE",
    { ordre: 92, captureObligatoire: "PHOTO", aideTexte: "Photographier les gaines après raccordement au nouveau caisson. Vérifier : bonne étanchéité aux raccords (colliers de serrage), gaines non pincées, parcours optimisé (minimum de coudes). Si gaines existantes conservées : vérifier leur état et signaler toute dégradation" });
  await makeQuestion("VMC_REM_NB_BOUCHES", "Nombre de bouches installées", "NUMERIQUE",
    { ordre: 93, uniteAttendue: "unités", aideTexte: "Compter toutes les bouches d'extraction posées" });
  await makeQuestion("VMC_REM_DEBIT_SDB", "Mesure de débit à la bouche SDB après mise en service", "NUMERIQUE",
    { ordre: 94, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre. Conforme si ≥ 30 m³/h en SDB" });
  await makeQuestion("VMC_REM_DEBIT_WC", "Mesure de débit à la bouche WC après mise en service", "NUMERIQUE",
    { ordre: 95, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Conforme si ≥ 15 m³/h en WC" });
  await makeQuestion("VMC_REM_PHOTO_FINAL", "Photo de l'installation finalisée", "CHOIX_UNIQUE",
    { ordre: 96, captureObligatoire: "PHOTO", aideTexte: "Vue d'ensemble de l'installation terminée" });

  // ═══════════════════════════════════════════════════════════════════
  // INSTALLATION NEUVE (10 étapes)
  // ═══════════════════════════════════════════════════════════════════
  // Étape 1 déjà créée : VMC_INS_TYPE (type de VMC à installer)
  await makeQuestion("VMC_INS_MARQUE", "Quelle est la marque du kit VMC installé ?", "CHOIX_UNIQUE",
    { ordre: 110 });
  await makeQuestion("VMC_INS_NB_PIECES", "Nombre de pièces raccordées au réseau", "NUMERIQUE",
    { ordre: 111, uniteAttendue: "pièces", aideTexte: "Compter toutes les pièces raccordées au réseau VMC. Minimum réglementaire : SDB + WC + cuisine. Pièces supplémentaires possibles : buanderie, cellier, 2e SDB. Chaque pièce = une bouche d'extraction = une gaine. Le caisson doit être dimensionné pour le débit cumulé de toutes les bouches" });
  await makeQuestion("VMC_INS_GAINES_ML", "Linéaire total de gaines posées", "NUMERIQUE",
    { ordre: 112, uniteAttendue: "m", aideTexte: "Mesurer ou estimer le linéaire total des gaines posées. Important pour le dimensionnement : au-delà de 30m de gaine, les pertes de charge augmentent significativement et le moteur doit être plus puissant. Diamètre standard : 80mm pour WC, 125mm pour SDB et cuisine. Privilégier les parcours courts et droits" });
  await makeQuestion("VMC_INS_PHOTO_CAISSON", "Photo du caisson installé", "CHOIX_UNIQUE",
    { ordre: 113, captureObligatoire: "PHOTO", aideTexte: "Photographier le caisson installé : fixation (suspension par silent-blocs obligatoire pour éviter les vibrations), raccordements gaines, branchement électrique. Le caisson ne doit PAS être posé directement sur une surface dure (transmission des vibrations)" });
  await makeQuestion("VMC_INS_PHOTO_GAINES", "Photo du parcours des gaines", "CHOIX_UNIQUE",
    { ordre: 114, captureObligatoire: "PHOTO", aideTexte: "Photographier le parcours complet des gaines : du caisson jusqu'aux bouches. Points de contrôle : pente régulière (éviter les points bas = accumulation de condensation), isolation en zone froide (combles), fixation correcte (pas de gaine qui pend), coudes progressifs (pas de 90° brutal)" });
  await makeQuestion("VMC_INS_ELEC", "Le raccordement électrique est-il conforme ?", "CHOIX_UNIQUE",
    { ordre: 115, captureObligatoire: "PHOTO", aideTexte: "Le raccordement électrique VMC doit être conforme NF C 15-100 : disjoncteur dédié 2A (simple flux) ou 6A (double flux), alimentation en 230V directe (pas de prise), câble en 1.5mm². Photographier le tableau avec le disjoncteur identifié et le câblage au caisson" });
  await makeQuestion("VMC_INS_DEBIT_SDB", "Mesure de débit à la bouche SDB", "NUMERIQUE",
    { ordre: 116, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre. Conforme si ≥ 30 m³/h en SDB" });
  await makeQuestion("VMC_INS_DEBIT_CUISINE", "Mesure de débit à la bouche cuisine", "NUMERIQUE",
    { ordre: 117, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Mesurer le débit à la bouche cuisine avec l'anémomètre. Normes : cuisine ouverte ≥ 45 m³/h (grand débit), cuisine fermée ≥ 30 m³/h. Si la VMC a un mode grand débit (bouton boost), tester dans les deux modes et noter les valeurs" });

  // ═══════════════════════════════════════════════════════════════════
  // TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log("🔗 Création des transitions...");

  // ── Niveau 0 : motif → 4 branches ─────────────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "entretien", libelle: "Entretien préventif", ordre: 1, questionSuivanteId: Q.VMC_ENT_TYPE.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "depannage", libelle: "Dépannage (panne signalée)", ordre: 2, questionSuivanteId: Q.VMC_DEP_SYMPT.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "remplacement", libelle: "Remplacement (fin de vie)", ordre: 3, questionSuivanteId: Q.VMC_REM_MARQUE_ANCIENNE.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "installation", libelle: "Installation / mise en service", ordre: 4, questionSuivanteId: Q.VMC_INS_TYPE.id },
    ],
  });

  // ── DÉPANNAGE : symptôme → 5 sous-arbres ──────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "ne_fonctionne_plus", libelle: "Ne fonctionne plus (silencieuse)", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_ALIM.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "bruit", libelle: "Bruit anormal", ordre: 2, questionSuivanteId: Q.VMC_DEP_BRUIT_TYPE.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "debit", libelle: "Débit insuffisant", ordre: 3, questionSuivanteId: Q.VMC_DEP_DEBIT_MESURE_INIT.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "humidite", libelle: "Humidité persistante", ordre: 4, questionSuivanteId: Q.VMC_DEP_HUM_FLUX.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "code_erreur", libelle: "Code erreur (double flux)", ordre: 5, questionSuivanteId: Q.VMC_DEP_CODE_SAISIE.id },
    ],
  });

  // ── Dépannage SA 1 : Ne fonctionne plus ──────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_NF_ALIM.id, valeur: "oui", libelle: "Oui, présente", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_DISJ.id },
      { questionId: Q.VMC_DEP_NF_ALIM.id, valeur: "non", libelle: "Non, absente", ordre: 2, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_DEP_NF_DISJ.id, valeur: "oui", libelle: "Oui, enclenché", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_TURBINE.id },
      { questionId: Q.VMC_DEP_NF_DISJ.id, valeur: "non", libelle: "Non, déclenché — réarmé", ordre: 2, questionSuivanteId: Q.VMC_DEP_NF_TURBINE.id },

      { questionId: Q.VMC_DEP_NF_TURBINE.id, valeur: "oui", libelle: "Oui, tourne librement", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_CONDO.id },
      { questionId: Q.VMC_DEP_NF_TURBINE.id, valeur: "non", libelle: "Non, bloquée — moteur HS", ordre: 2, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_DEP_NF_CONDO.id, valeur: "saisi", libelle: "Valeur saisie", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_DEBIT_FINAL.id },
      { questionId: Q.VMC_DEP_NF_DEBIT_FINAL.id, valeur: "saisi", libelle: "Mesure validée", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
    ],
  });

  // ── Dépannage SA 2 : Bruit anormal ───────────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_BRUIT_TYPE.id, valeur: "vibration", libelle: "Vibration / claquement", ordre: 1, questionSuivanteId: Q.VMC_DEP_BRUIT_CAISSON.id },
      { questionId: Q.VMC_DEP_BRUIT_TYPE.id, valeur: "sifflement", libelle: "Sifflement aérodynamique", ordre: 2, questionSuivanteId: Q.VMC_DEP_BRUIT_GAINES.id },
      { questionId: Q.VMC_DEP_BRUIT_TYPE.id, valeur: "grincement", libelle: "Grincement / frottement moteur", ordre: 3, questionSuivanteId: Q.VMC_DEP_BRUIT_MOTEUR.id },
      { questionId: Q.VMC_DEP_BRUIT_TYPE.id, valeur: "autre", libelle: "Autre (décrire en commentaire)", ordre: 4, questionSuivanteId: Q.VMC_DEP_BRUIT_MOTEUR.id },

      { questionId: Q.VMC_DEP_BRUIT_CAISSON.id, valeur: "oui", libelle: "Oui, correctement suspendu", ordre: 1, questionSuivanteId: Q.VMC_DEP_BRUIT_GAINES.id },
      { questionId: Q.VMC_DEP_BRUIT_CAISSON.id, valeur: "non", libelle: "Non, à resuspendre avec silent-blocs", ordre: 2, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },

      { questionId: Q.VMC_DEP_BRUIT_GAINES.id, valeur: "oui", libelle: "Oui, gaines OK", ordre: 1, questionSuivanteId: Q.VMC_DEP_BRUIT_MOTEUR.id },
      { questionId: Q.VMC_DEP_BRUIT_GAINES.id, valeur: "non", libelle: "Non, gaine à dégager ou remplacer", ordre: 2, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },

      { questionId: Q.VMC_DEP_BRUIT_MOTEUR.id, valeur: "oui", libelle: "Moteur OK (roulements bons)", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
      { questionId: Q.VMC_DEP_BRUIT_MOTEUR.id, valeur: "non", libelle: "Moteur usé — remplacement nécessaire", ordre: 2, actionSuivante: "ESCALADE" },
    ],
  });

  // ── Dépannage SA 3 : Débit insuffisant ───────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_DEBIT_MESURE_INIT.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_DEP_DEBIT_BOUCHES.id },

      { questionId: Q.VMC_DEP_DEBIT_BOUCHES.id, valeur: "oui", libelle: "Oui, bouches propres", ordre: 1, questionSuivanteId: Q.VMC_DEP_DEBIT_FILTRES.id },
      { questionId: Q.VMC_DEP_DEBIT_BOUCHES.id, valeur: "non", libelle: "Non, sales — à nettoyer à l'eau", ordre: 2, questionSuivanteId: Q.VMC_DEP_DEBIT_FILTRES.id },

      { questionId: Q.VMC_DEP_DEBIT_FILTRES.id, valeur: "propres", libelle: "Propres ou simple flux (non concerné)", ordre: 1, questionSuivanteId: Q.VMC_DEP_DEBIT_GAINES.id },
      { questionId: Q.VMC_DEP_DEBIT_FILTRES.id, valeur: "sales", libelle: "Sales — à remplacer", ordre: 2, questionSuivanteId: Q.VMC_DEP_DEBIT_GAINES.id },

      { questionId: Q.VMC_DEP_DEBIT_GAINES.id, valeur: "non", libelle: "Non, gaines OK", ordre: 1, questionSuivanteId: Q.VMC_DEP_DEBIT_MESURE_FIN.id },
      { questionId: Q.VMC_DEP_DEBIT_GAINES.id, valeur: "oui", libelle: "Oui — désencrasser ou remplacer", ordre: 2, questionSuivanteId: Q.VMC_DEP_DEBIT_MESURE_FIN.id },

      { questionId: Q.VMC_DEP_DEBIT_MESURE_FIN.id, valeur: "saisi", libelle: "Mesure finale saisie", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
    ],
  });

  // ── Dépannage SA 4 : Humidité persistante ────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_HUM_FLUX.id, valeur: "oui", libelle: "Oui, flux correct (aspiration)", ordre: 1, questionSuivanteId: Q.VMC_DEP_HUM_DEBIT.id },
      { questionId: Q.VMC_DEP_HUM_FLUX.id, valeur: "non", libelle: "Non, flux inversé — recâbler", ordre: 2, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },

      { questionId: Q.VMC_DEP_HUM_DEBIT.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_DEP_HUM_GAINES.id },

      { questionId: Q.VMC_DEP_HUM_GAINES.id, valeur: "non", libelle: "Non, gaines OK", ordre: 1, questionSuivanteId: Q.VMC_DEP_HUM_EXTERNE.id },
      { questionId: Q.VMC_DEP_HUM_GAINES.id, valeur: "oui", libelle: "Oui — isolation des gaines requise", ordre: 2, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },

      { questionId: Q.VMC_DEP_HUM_EXTERNE.id, valeur: "oui", libelle: "Oui — cause externe (hors VMC)", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
      { questionId: Q.VMC_DEP_HUM_EXTERNE.id, valeur: "non", libelle: "Non — escalade diagnostic avancé", ordre: 2, actionSuivante: "ESCALADE" },
    ],
  });

  // ── Dépannage SA 5 : Code erreur ─────────────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_CODE_SAISIE.id, valeur: "saisi", libelle: "Code saisi", ordre: 1, questionSuivanteId: Q.VMC_DEP_CODE_ACTION.id },
      { questionId: Q.VMC_DEP_CODE_ACTION.id, valeur: "oui", libelle: "Oui, action effectuée", ordre: 1, questionSuivanteId: Q.VMC_DEP_CODE_VERIF.id },
      { questionId: Q.VMC_DEP_CODE_ACTION.id, valeur: "non", libelle: "Non — escalade constructeur", ordre: 2, actionSuivante: "ESCALADE" },
      { questionId: Q.VMC_DEP_CODE_VERIF.id, valeur: "oui", libelle: "Oui, code disparu — résolu", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
      { questionId: Q.VMC_DEP_CODE_VERIF.id, valeur: "non", libelle: "Non, code persistant — escalade", ordre: 2, actionSuivante: "ESCALADE" },
    ],
  });

  // ── ENTRETIEN : type → caisson → bouches → filtres → gaines → débit ──
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_ENT_TYPE.id, valeur: "simple_flux", libelle: "Simple flux autoréglable", ordre: 1, questionSuivanteId: Q.VMC_ENT_CAISSON.id },
      { questionId: Q.VMC_ENT_TYPE.id, valeur: "hygro", libelle: "Simple flux hygroréglable", ordre: 2, questionSuivanteId: Q.VMC_ENT_CAISSON.id },
      { questionId: Q.VMC_ENT_TYPE.id, valeur: "double_flux", libelle: "Double flux", ordre: 3, questionSuivanteId: Q.VMC_ENT_CAISSON.id },

      { questionId: Q.VMC_ENT_CAISSON.id, valeur: "ok", libelle: "Caisson en bon état", ordre: 1, questionSuivanteId: Q.VMC_ENT_BOUCHES.id },
      { questionId: Q.VMC_ENT_CAISSON.id, valeur: "encrasse", libelle: "Encrassé — à nettoyer", ordre: 2, questionSuivanteId: Q.VMC_ENT_BOUCHES.id },
      { questionId: Q.VMC_ENT_CAISSON.id, valeur: "degrade", libelle: "Dégradé — remplacement recommandé", ordre: 3, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_ENT_BOUCHES.id, valeur: "fait", libelle: "Oui, nettoyage effectué", ordre: 1, questionSuivanteId: Q.VMC_ENT_FILTRES.id },
      { questionId: Q.VMC_ENT_BOUCHES.id, valeur: "non", libelle: "Non — bouches à remplacer", ordre: 2, questionSuivanteId: Q.VMC_ENT_FILTRES.id },

      { questionId: Q.VMC_ENT_FILTRES.id, valeur: "propres", libelle: "Propres, conservés", ordre: 1, questionSuivanteId: Q.VMC_ENT_GAINES.id },
      { questionId: Q.VMC_ENT_FILTRES.id, valeur: "remplaces", libelle: "Sales — remplacés", ordre: 2, questionSuivanteId: Q.VMC_ENT_GAINES.id },
      { questionId: Q.VMC_ENT_FILTRES.id, valeur: "na", libelle: "N/A (simple flux)", ordre: 3, questionSuivanteId: Q.VMC_ENT_GAINES.id },

      { questionId: Q.VMC_ENT_GAINES.id, valeur: "ok", libelle: "Gaines en bon état", ordre: 1, questionSuivanteId: Q.VMC_ENT_DEBIT.id },
      { questionId: Q.VMC_ENT_GAINES.id, valeur: "degrade", libelle: "Dégradées — à reprendre", ordre: 2, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_ENT_DEBIT.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
    ],
  });

  // ── REMPLACEMENT : marque ancienne → photo → marque neuve → gaines → bouches → débits → photo finale ──
  const marquesRemAnc = MARQUES.map((m, i) => ({
    questionId: Q.VMC_REM_MARQUE_ANCIENNE.id, valeur: m.valeur, libelle: m.libelle, ordre: i + 1,
    questionSuivanteId: Q.VMC_REM_PHOTO_ANCIEN.id,
  }));
  const marquesRemNeuv = MARQUES.map((m, i) => ({
    questionId: Q.VMC_REM_MARQUE_NEUVE.id, valeur: m.valeur, libelle: m.libelle, ordre: i + 1,
    questionSuivanteId: Q.VMC_REM_GAINES.id,
  }));
  await prisma.reponsePossible.createMany({ data: [...marquesRemAnc, ...marquesRemNeuv] });

  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_REM_PHOTO_ANCIEN.id, valeur: "fait", libelle: "Photo prise", ordre: 1, questionSuivanteId: Q.VMC_REM_MARQUE_NEUVE.id },

      { questionId: Q.VMC_REM_GAINES.id, valeur: "conservees", libelle: "Conservées telles quelles", ordre: 1, questionSuivanteId: Q.VMC_REM_NB_BOUCHES.id },
      { questionId: Q.VMC_REM_GAINES.id, valeur: "partielles", libelle: "Remplacées partiellement", ordre: 2, questionSuivanteId: Q.VMC_REM_NB_BOUCHES.id },
      { questionId: Q.VMC_REM_GAINES.id, valeur: "completes", libelle: "Remplacées complètement", ordre: 3, questionSuivanteId: Q.VMC_REM_NB_BOUCHES.id },

      { questionId: Q.VMC_REM_NB_BOUCHES.id, valeur: "saisi", libelle: "Nombre saisi", ordre: 1, questionSuivanteId: Q.VMC_REM_DEBIT_SDB.id },
      { questionId: Q.VMC_REM_DEBIT_SDB.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_REM_DEBIT_WC.id },
      { questionId: Q.VMC_REM_DEBIT_WC.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_REM_PHOTO_FINAL.id },
      { questionId: Q.VMC_REM_PHOTO_FINAL.id, valeur: "fait", libelle: "Photo prise", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
    ],
  });

  // ── INSTALLATION : type → marque → nb pièces → gaines ml → photos → élec → débits ──
  const marquesIns = MARQUES.map((m, i) => ({
    questionId: Q.VMC_INS_MARQUE.id, valeur: m.valeur, libelle: m.libelle, ordre: i + 1,
    questionSuivanteId: Q.VMC_INS_NB_PIECES.id,
  }));
  await prisma.reponsePossible.createMany({ data: marquesIns });

  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_INS_TYPE.id, valeur: "simple_auto", libelle: "Simple flux autoréglable", ordre: 1, questionSuivanteId: Q.VMC_INS_MARQUE.id },
      { questionId: Q.VMC_INS_TYPE.id, valeur: "simple_hygro", libelle: "Simple flux hygroréglable", ordre: 2, questionSuivanteId: Q.VMC_INS_MARQUE.id },
      { questionId: Q.VMC_INS_TYPE.id, valeur: "double_flux", libelle: "Double flux", ordre: 3, questionSuivanteId: Q.VMC_INS_MARQUE.id },

      { questionId: Q.VMC_INS_NB_PIECES.id, valeur: "saisi", libelle: "Nombre saisi", ordre: 1, questionSuivanteId: Q.VMC_INS_GAINES_ML.id },
      { questionId: Q.VMC_INS_GAINES_ML.id, valeur: "saisi", libelle: "Linéaire saisi", ordre: 1, questionSuivanteId: Q.VMC_INS_PHOTO_CAISSON.id },
      { questionId: Q.VMC_INS_PHOTO_CAISSON.id, valeur: "fait", libelle: "Photo prise", ordre: 1, questionSuivanteId: Q.VMC_INS_PHOTO_GAINES.id },
      { questionId: Q.VMC_INS_PHOTO_GAINES.id, valeur: "fait", libelle: "Photo prise", ordre: 1, questionSuivanteId: Q.VMC_INS_ELEC.id },

      { questionId: Q.VMC_INS_ELEC.id, valeur: "oui", libelle: "Oui, conforme", ordre: 1, questionSuivanteId: Q.VMC_INS_DEBIT_SDB.id },
      { questionId: Q.VMC_INS_ELEC.id, valeur: "non", libelle: "Non — escalade électricien", ordre: 2, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_INS_DEBIT_SDB.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_INS_DEBIT_CUISINE.id },
      { questionId: Q.VMC_INS_DEBIT_CUISINE.id, valeur: "saisi", libelle: "Mesure saisie", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
    ],
  });

  // ── Clôture : signature → fin ────────────────────────────────
  await prisma.reponsePossible.create({
    data: { questionId: Q.VMC_CLOTURE_SIGNATURE.id, valeur: "signe", libelle: "Signature recueillie", ordre: 1, actionSuivante: "CLOTURE" },
  });

  console.log("");
  console.log("✅ Seed terminé.");
  console.log(`   Questions créées : ${await prisma.question.count()}`);
  console.log(`   Transitions     : ${await prisma.reponsePossible.count()}`);
  console.log(`   Intervenants    : ${await prisma.intervenant.count()}`);
  console.log(`   Clients         : ${await prisma.client.count()}`);
  console.log("");
  console.log("🌳 Parcours complets :");
  console.log("   ✓ ENTRETIEN préventif (5 étapes)");
  console.log("   ✓ DÉPANNAGE (5 sous-arbres)");
  console.log("   ✓ REMPLACEMENT (8 étapes)");
  console.log("   ✓ INSTALLATION neuve (9 étapes)");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });