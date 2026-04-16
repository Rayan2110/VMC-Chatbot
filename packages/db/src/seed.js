// Seed complet — alimente la base avec :
//   - 3 intervenants et 3 clients de démo
//   - L'arbre de décision : entrée + 4 branches (Entretien, Dépannage, Remplacement, Installation)
//   - Les 5 sous-arbres complets de Dépannage :
//       * Ne fonctionne plus
//       * Bruit anormal
//       * Débit insuffisant
//       * Humidité persistante
//       * Code erreur (double flux)
//   - Les autres branches (Entretien, Remplacement, Installation) en stubs → clôture directe

const { prisma } = require("./index");

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

  // ═══ Niveau 0 : entrée ═══════════════════════════════════════════
  await makeQuestion("VMC_ENTREE_MOTIF", "Quel est le motif de l'intervention ?", "CHOIX_UNIQUE", { ordre: 1 });

  // ═══ Niveau 1 : aiguillage par motif ═════════════════════════════
  await makeQuestion("VMC_DEP_SYMPT", "Quel symptôme est signalé ?", "CHOIX_UNIQUE", { ordre: 2 });
  await makeQuestion("VMC_ENT_TYPE", "Quel type de VMC ?", "CHOIX_UNIQUE", { ordre: 3 });
  await makeQuestion("VMC_REM_CONFIRM", "Confirmer le remplacement pour vétusté ?", "CHOIX_UNIQUE", { ordre: 4 });
  await makeQuestion("VMC_INS_DEBUT", "Démarrer la mise en service ?", "CHOIX_UNIQUE", { ordre: 5 });

  // ═══ Clôture commune ═════════════════════════════════════════════
  await makeQuestion(
    "VMC_CLOTURE_SIGNATURE",
    "Signature du client pour validation",
    "SIGNATURE",
    { ordre: 100, captureObligatoire: "SIGNATURE", aideTexte: "Faire signer sur la tablette" }
  );

  // ═══ SOUS-ARBRE 1 : Ne fonctionne plus ═══════════════════════════
  await makeQuestion("VMC_DEP_NF_ALIM", "L'alimentation électrique est-elle présente ?", "CHOIX_UNIQUE",
    { ordre: 30, captureObligatoire: "PHOTO", aideTexte: "Photo du tableau électrique avant intervention" });
  await makeQuestion("VMC_DEP_NF_DISJ", "Le disjoncteur dédié est-il enclenché (non déclenché) ?", "CHOIX_UNIQUE",
    { ordre: 31, captureObligatoire: "PHOTO", aideTexte: "Photo du disjoncteur dédié VMC" });
  await makeQuestion("VMC_DEP_NF_TURBINE", "La mototurbine tourne-t-elle quand on la lance manuellement ?", "CHOIX_UNIQUE",
    { ordre: 32, captureObligatoire: "PHOTO", aideTexte: "Démonter conduits, lancer turbine à la main, photo du moteur" });
  await makeQuestion("VMC_DEP_NF_CONDO", "Capacité du condensateur de démarrage (µF mesurés au testeur)", "NUMERIQUE",
    { ordre: 33, captureObligatoire: "MESURE", uniteAttendue: "µF",
      aideTexte: "Tester avec un capacimètre, valeur nominale gravée sur le condensateur" });
  await makeQuestion("VMC_DEP_NF_DEBIT_FINAL", "Mesure de débit après remise en service", "NUMERIQUE",
    { ordre: 34, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre à la bouche de SDB. Conforme si ≥ 30 m³/h" });

  // ═══ SOUS-ARBRE 2 : Bruit anormal ════════════════════════════════
  await makeQuestion("VMC_DEP_BRUIT_TYPE", "Quel type de bruit entendez-vous ?", "CHOIX_UNIQUE",
    { ordre: 40, aideTexte: "Écouter à proximité du caisson et des bouches" });
  await makeQuestion("VMC_DEP_BRUIT_CAISSON", "Le caisson VMC est-il correctement suspendu (silent-blocs OK) ?", "CHOIX_UNIQUE",
    { ordre: 41, captureObligatoire: "PHOTO", aideTexte: "Photo de la fixation du caisson" });
  await makeQuestion("VMC_DEP_BRUIT_GAINES", "Les gaines sont-elles non pincées et non obstruées ?", "CHOIX_UNIQUE",
    { ordre: 42, captureObligatoire: "PHOTO", aideTexte: "Photo du parcours des gaines visibles" });
  await makeQuestion("VMC_DEP_BRUIT_MOTEUR", "État du moteur (roulements, axe) — tourne sans accroc ?", "CHOIX_UNIQUE",
    { ordre: 43, captureObligatoire: "PHOTO", aideTexte: "Démonter et inspecter le moteur" });

  // ═══ SOUS-ARBRE 3 : Débit insuffisant ════════════════════════════
  await makeQuestion("VMC_DEP_DEBIT_MESURE_INIT", "Mesure débit à la bouche principale (avant intervention)", "NUMERIQUE",
    { ordre: 50, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Anémomètre. Conforme si SDB ≥ 30, WC ≥ 15 m³/h" });
  await makeQuestion("VMC_DEP_DEBIT_BOUCHES", "Les bouches d'extraction sont-elles propres ?", "CHOIX_UNIQUE",
    { ordre: 51, captureObligatoire: "PHOTO", aideTexte: "Photo avant nettoyage éventuel" });
  await makeQuestion("VMC_DEP_DEBIT_FILTRES", "État des filtres (double flux uniquement) ?", "CHOIX_UNIQUE",
    { ordre: 52, captureObligatoire: "PHOTO", aideTexte: "G3/G4 extraction, F7 insufflation" });
  await makeQuestion("VMC_DEP_DEBIT_GAINES", "Gaines obstruées ou percées ?", "CHOIX_UNIQUE",
    { ordre: 53, captureObligatoire: "PHOTO", aideTexte: "Inspection visuelle des gaines accessibles" });
  await makeQuestion("VMC_DEP_DEBIT_MESURE_FIN", "Mesure débit après intervention (vérification finale)", "NUMERIQUE",
    { ordre: 54, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Remesure pour confirmer le rétablissement du débit" });

  // ═══ SOUS-ARBRE 4 : Humidité persistante ═════════════════════════
  await makeQuestion("VMC_DEP_HUM_FLUX", "Sens du flux correct (test fumée ou papier) ?", "CHOIX_UNIQUE",
    { ordre: 60, captureObligatoire: "PHOTO", aideTexte: "Approcher une fumée d'encens près de la bouche, elle doit être aspirée" });
  await makeQuestion("VMC_DEP_HUM_DEBIT", "Mesure débit aux bouches humides (SDB, cuisine)", "NUMERIQUE",
    { ordre: 61, captureObligatoire: "MESURE", uniteAttendue: "m³/h",
      aideTexte: "Conforme si SDB ≥ 30 m³/h, cuisine selon norme" });
  await makeQuestion("VMC_DEP_HUM_GAINES", "Condensation dans les gaines (combles non isolés) ?", "CHOIX_UNIQUE",
    { ordre: 62, captureObligatoire: "PHOTO", aideTexte: "Inspection des gaines dans les combles" });
  await makeQuestion("VMC_DEP_HUM_EXTERNE", "Signes d'infiltration ou ponts thermiques dans le logement ?", "CHOIX_UNIQUE",
    { ordre: 63, captureObligatoire: "PHOTO", aideTexte: "Observer les zones humides, murs, plafonds" });

  // ═══ SOUS-ARBRE 5 : Code erreur (double flux) ════════════════════
  await makeQuestion("VMC_DEP_CODE_SAISIE", "Saisir le code erreur affiché sur la centrale", "TEXTE_LIBRE",
    { ordre: 70, captureObligatoire: "PHOTO", aideTexte: "Photo de l'afficheur + saisie du code (ex: E03, ERR1...)" });
  await makeQuestion("VMC_DEP_CODE_ACTION", "Action corrective effectuée (réarmement, nettoyage, remplacement sonde...) ?", "CHOIX_UNIQUE",
    { ordre: 71, captureObligatoire: "PHOTO", aideTexte: "Photo après action (moteur, sonde, échangeur...)" });
  await makeQuestion("VMC_DEP_CODE_VERIF", "Le code erreur a-t-il disparu après l'action ?", "CHOIX_UNIQUE",
    { ordre: 72, captureObligatoire: "PHOTO", aideTexte: "Photo de l'afficheur après intervention" });

  // ═══ TRANSITIONS ═══════════════════════════════════════════════════
  console.log("🔗 Création des transitions entre questions...");

  // ── Niveau 0 : motif → 4 branches ─────────────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "entretien", libelle: "Entretien préventif", ordre: 1, questionSuivanteId: Q.VMC_ENT_TYPE.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "depannage", libelle: "Dépannage (panne signalée)", ordre: 2, questionSuivanteId: Q.VMC_DEP_SYMPT.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "remplacement", libelle: "Remplacement (fin de vie)", ordre: 3, questionSuivanteId: Q.VMC_REM_CONFIRM.id },
      { questionId: Q.VMC_ENTREE_MOTIF.id, valeur: "installation", libelle: "Installation / mise en service", ordre: 4, questionSuivanteId: Q.VMC_INS_DEBUT.id },
    ],
  });

  // ── Niveau 1 : symptôme → 5 sous-arbres ──────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "ne_fonctionne_plus", libelle: "Ne fonctionne plus (silencieuse)", ordre: 1, questionSuivanteId: Q.VMC_DEP_NF_ALIM.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "bruit", libelle: "Bruit anormal", ordre: 2, questionSuivanteId: Q.VMC_DEP_BRUIT_TYPE.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "debit", libelle: "Débit insuffisant", ordre: 3, questionSuivanteId: Q.VMC_DEP_DEBIT_MESURE_INIT.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "humidite", libelle: "Humidité persistante", ordre: 4, questionSuivanteId: Q.VMC_DEP_HUM_FLUX.id },
      { questionId: Q.VMC_DEP_SYMPT.id, valeur: "code_erreur", libelle: "Code erreur (double flux)", ordre: 5, questionSuivanteId: Q.VMC_DEP_CODE_SAISIE.id },
    ],
  });

  // ── Sous-arbre 1 : Ne fonctionne plus ────────────────────────
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

  // ── Sous-arbre 2 : Bruit anormal ─────────────────────────────
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

  // ── Sous-arbre 3 : Débit insuffisant ─────────────────────────
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

  // ── Sous-arbre 4 : Humidité persistante ──────────────────────
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

  // ── Sous-arbre 5 : Code erreur ───────────────────────────────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_DEP_CODE_SAISIE.id, valeur: "saisi", libelle: "Code saisi", ordre: 1, questionSuivanteId: Q.VMC_DEP_CODE_ACTION.id },

      { questionId: Q.VMC_DEP_CODE_ACTION.id, valeur: "oui", libelle: "Oui, action effectuée", ordre: 1, questionSuivanteId: Q.VMC_DEP_CODE_VERIF.id },
      { questionId: Q.VMC_DEP_CODE_ACTION.id, valeur: "non", libelle: "Non — escalade constructeur", ordre: 2, actionSuivante: "ESCALADE" },

      { questionId: Q.VMC_DEP_CODE_VERIF.id, valeur: "oui", libelle: "Oui, code disparu — résolu", ordre: 1, questionSuivanteId: Q.VMC_CLOTURE_SIGNATURE.id },
      { questionId: Q.VMC_DEP_CODE_VERIF.id, valeur: "non", libelle: "Non, code persistant — escalade", ordre: 2, actionSuivante: "ESCALADE" },
    ],
  });

  // ── Clôture : signature → fin ────────────────────────────────
  await prisma.reponsePossible.create({
    data: { questionId: Q.VMC_CLOTURE_SIGNATURE.id, valeur: "signe", libelle: "Signature recueillie", ordre: 1, actionSuivante: "CLOTURE" },
  });

  // ── Stubs des branches non-dépannage (clôture directe) ───────
  await prisma.reponsePossible.createMany({
    data: [
      { questionId: Q.VMC_ENT_TYPE.id, valeur: "stub", libelle: "À détailler en phase 2", ordre: 1, actionSuivante: "CLOTURE" },
      { questionId: Q.VMC_REM_CONFIRM.id, valeur: "stub", libelle: "À détailler en phase 2", ordre: 1, actionSuivante: "CLOTURE" },
      { questionId: Q.VMC_INS_DEBUT.id, valeur: "stub", libelle: "À détailler en phase 2", ordre: 1, actionSuivante: "CLOTURE" },
    ],
  });

  console.log("✅ Seed terminé.");
  console.log(`   Questions créées : ${await prisma.question.count()}`);
  console.log(`   Transitions     : ${await prisma.reponsePossible.count()}`);
  console.log(`   Intervenants    : ${await prisma.intervenant.count()}`);
  console.log(`   Clients         : ${await prisma.client.count()}`);
  console.log("");
  console.log("🌳 Sous-arbres Dépannage complets :");
  console.log("   ✓ Ne fonctionne plus (5 étapes)");
  console.log("   ✓ Bruit anormal (4 étapes)");
  console.log("   ✓ Débit insuffisant (5 étapes)");
  console.log("   ✓ Humidité persistante (4 étapes)");
  console.log("   ✓ Code erreur double flux (3 étapes)");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });