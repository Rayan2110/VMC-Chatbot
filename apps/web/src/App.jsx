import { useState, useEffect, useRef } from "react";

// const API = "/api";
const API = window.location.hostname === "localhost"
  ? "/api"
  : "https://vmc-chatbot-api.onrender.com";

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const captureLabels = {
  PHOTO:     { icon: "📷", label: "Photo obligatoire" },
  MESURE:    { icon: "📏", label: "Mesure obligatoire" },
  SIGNATURE: { icon: "✍️", label: "Signature obligatoire" },
};

// ═══ DÉTECTEUR D'INTENTION DES COMMENTAIRES LIBRES ════════════
// Basé sur mots-clés. Ordre important : intentions critiques d'abord.
const INTENTIONS = [
  {
    code: "URGENCE",
    motsCles: [
      "urgent", "urgence", "urgences", "danger", "dangereux", "dangereuse",
      "risque grave", "risque sécurité", "risque securite", "risque électrique", "risque electrique",
      "danger immédiat", "danger immediat", "mise en sécurité", "mise en securite",
      "à sécuriser", "a securiser", "sécuriser immédiatement", "securiser immediatement",
      "brûlé", "brulé", "brule", "brûle",
      "ça brûle", "ca brule", "ça brule",
      "fumée", "fumee", "ça fume", "ca fume",
      "feu", "flamme", "flammes", "étincelle", "etincelle", "étincelles", "etincelles",
      "incendie", "départ de feu", "depart de feu",
      "ça sent le brûlé", "ca sent le brule", "ça sent le brulé",
      "odeur de brûlé", "odeur de brulé", "odeur de brule",
      "odeur forte", "odeur chimique", "odeur bizarre", "odeur suspecte",
      "fuite gaz", "fuite de gaz", "odeur gaz", "odeur de gaz", "gaz qui sent",
      "soupçon gaz", "soupcon gaz", "je sens le gaz",
      "court-circuit", "court circuit", "cc électrique", "cc electrique",
      "électrocution", "electrocution", "électrocuté", "electrocute",
      "choc électrique", "choc electrique", "pris le jus",
      "disjoncte sans arrêt", "disjoncte sans arret", "saute tout le temps",
      "carbonisé", "carbonise", "carbonisée", "fondu", "fondue",
      "ça chauffe trop", "ca chauffe trop", "anormalement chaud", "vraiment chaud",
      "brûlant au toucher", "brulant au toucher", "trop chaud au toucher",
      "surchauffe", "emballe", "s'emballe", "emballé", "emballee",
      "attention danger", "appelle les secours", "appeler secours", "pompiers",
      "j'évacue", "j evacue", "on évacue", "on evacue",
    ],
  },
  {
    code: "ESCALADE",
    motsCles: [
      "escalader", "escalade", "escaladé", "escalade immédiate", "escalade immediate",
      "remonter", "remonter au manager", "remonter au chef", "remonter en interne",
      "manager", "responsable", "chef d'équipe", "chef d equipe", "chef de chantier",
      "hiérarchie", "hierarchie", "direction", "patron",
      "litige", "litigieux", "conflit", "conflictuel", "désaccord", "desaccord",
      "refus client", "refuse de payer", "refuse payer", "refuse de signer", "refuse signer",
      "refuse l'intervention", "refuse l intervention", "refuse les travaux",
      "client mécontent", "client pas content", "client remonté", "client remonte",
      "mécontent", "mecontent", "énervé", "enerve", "agacé", "agace",
      "plainte", "réclamation", "reclamation", "se plaint", "se plaint de",
      "menace", "menacé", "m'agresse", "agresse",
      "bloqué", "bloque", "bloquée", "bloquee", "je bloque",
      "impossible", "pas possible de", "ne peux pas", "je n'arrive pas", "j arrive pas",
      "besoin aide", "besoin d'aide", "besoin d aide", "j'ai besoin d'aide",
      "trop compliqué", "trop complique", "au-dessus de", "dépasse mes", "depasse mes",
      "pas dans mes compétences", "pas dans mes competences", "pas mon domaine",
      "je ne sais pas quoi faire", "je sais pas quoi faire",
      "hors contrat", "hors devis", "hors garantie", "pas couvert",
      "pas prévu", "pas prevu", "pas dans le devis",
    ],
  },
  {
    code: "CLIENT_ABSENT",
    motsCles: [
      "client absent", "client pas là", "client pas la", "pas de client",
      "pas sur place", "pas présent", "pas present", "absent du logement",
      "ne répond pas à la porte", "ne repond pas a la porte", "personne pour ouvrir",
      "personne ne répond", "personne ne repond", "injoignable",
      "porte fermée à clé", "porte fermee a cle", "logement fermé", "logement ferme",
      "pas de réponse", "pas de reponse", "personne chez lui", "personne chez elle",
      "en déplacement", "en deplacement", "en vacances", "en voyage",
      "parti au travail", "au boulot", "pas rentré", "pas rentre",
      "rendez-vous manqué", "rdv manqué", "rdv manque",
      "a oublié", "a oublie", "il a oublié", "elle a oublié",
    ],
  },
  {
    code: "ACCES",
    motsCles: [
      "inaccessible", "pas d'accès", "pas d acces", "accès bloqué", "acces bloque",
      "accès impossible", "acces impossible", "pas moyen d'accéder", "pas moyen d acceder",
      "trappe", "trappe condamnée", "trappe condamnee", "trappe bloquée", "trappe bloquee",
      "trappe ne s'ouvre pas", "trappe ne s ouvre pas",
      "comble inaccessible", "combles inaccessibles", "passage trop petit",
      "trop étroit", "trop etroit", "je ne passe pas", "passe pas",
      "caisson enfermé", "caisson enferme", "caisson encastré", "caisson encastre",
      "pas de clé", "pas de cle", "clé manquante", "cle manquante",
      "clé perdue", "cle perdue", "code inconnu", "code erroné", "code errone",
      "digicode ne fonctionne pas", "interphone en panne", "interphone HS",
      "syndic pas joignable", "gardien absent", "gardien pas là", "gardien pas la",
      "attente du syndic", "attente syndic",
      "encombré", "encombre", "encombrement", "obstrué", "obstrue", "obstruée", "obstruee",
      "meubles devant", "meuble devant", "armoire devant", "rien accessible",
    ],
  },
  {
    code: "PIECE",
    motsCles: [
      "pièce", "piece", "pieces", "pièces", "pièce détachée", "piece detachee",
      "pièces détachées", "pieces detachees", "composant", "composants",
      "matériel", "materiel", "équipement", "equipement",
      "commander", "commande", "à commander", "a commander",
      "passer commande", "faire la commande",
      "référence", "reference", "ref ", "ref:", "numéro de pièce", "numero de piece",
      "pas en stock", "rupture", "rupture de stock", "plus de stock", "stock vide",
      "stock épuisé", "stock epuise", "indisponible", "non disponible",
      "vérifier stock", "verifier stock", "voir si en stock",
      "approvisionnement", "appro", "fournisseur", "délai fournisseur", "delai fournisseur",
      "moteur", "mototurbine", "turbine", "ventilateur",
      "condensateur", "condo", "capa", "capacité", "capacite",
      "filtre", "filtres", "filtre G3", "filtre G4", "filtre F7",
      "courroie", "courroies", "roulement", "roulements",
      "gaine", "gaines", "bouche", "bouches", "bouche d'extraction", "bouche d extraction",
      "manchette", "té", "te de jonction", "raccord",
      "sonde", "sondes", "afficheur", "écran", "ecran", "carte électronique", "carte electronique",
      "variateur", "transformateur", "relais",
      "à remplacer", "a remplacer", "remplacement", "remplacer le",
      "neuf", "changer", "à changer", "a changer", "changement",
      "grillé", "grille", "grillée", "grillee", "grillés", "grilles",
      "hs", "h.s.", "hors service", "hors d'usage", "hors d usage",
      "cramé", "crame", "cramée", "cramee", "cramés",
      "cassé", "casse", "cassée", "cassee", "en morceaux",
      "défectueux", "defectueux", "défectueuse", "defectueuse", "défaillant", "defaillant",
      "mort", "morte", "foutu", "foutue", "fichu", "fichue",
      "en panne", "déglingué", "deglingue",
      "usé", "use", "usée", "usee", "usure", "vétuste", "vetuste",
      "vieilli", "fatigué", "fatigue", "en fin de vie", "fin de vie",
    ],
  },
  {
    code: "SUITES",
    motsCles: [
      "revenir", "repasser", "retour", "à revenir", "a revenir",
      "je reviens", "il faut revenir", "faut repasser", "devoir repasser",
      "2e passage", "deuxième passage", "deuxieme passage",
      "re-intervention", "réintervention", "reintervention",
      "nouvelle intervention", "nouvelle visite", "prochaine intervention",
      "pas fini", "pas terminé", "pas termine", "incomplet", "incomplète", "incomplete",
      "partiel", "partiellement", "à moitié fait", "a moitie fait",
      "reste à faire", "reste a faire", "il reste", "il reste à",
      "à finaliser", "a finaliser", "à compléter", "a completer",
      "à terminer", "a terminer", "finir plus tard", "finaliser plus tard",
      "suites", "suite à donner", "suite a donner", "suite d'intervention",
      "à suivre", "a suivre", "suivi nécessaire", "suivi necessaire",
      "plus tard", "ultérieur", "ulterieur", "ultérieurement", "ulterieurement",
      "dans quelques jours", "prochainement", "bientôt", "bientot",
    ],
  },
  {
    code: "DEVIS",
    motsCles: [
      "devis", "devis à faire", "devis a faire", "faire un devis", "établir devis",
      "proposition commerciale", "offre commerciale", "offre",
      "chiffrer", "chiffrage", "à chiffrer", "a chiffrer",
      "estimation", "estimer", "estimer le coût", "estimer le cout",
      "prix", "tarif", "tarification", "tarifs", "coût", "cout", "coût des travaux", "cout des travaux",
      "budget", "enveloppe budgétaire", "enveloppe budgetaire",
      "combien ça coûte", "combien ca coute", "c'est combien", "c est combien",
      "combien pour",
      "facture", "à facturer", "a facturer", "facturation",
      "travaux supplémentaires", "travaux supplementaires", "travaux complémentaires",
      "rajout", "ajout de travaux", "extension", "sup à prévoir", "sup a prevoir",
    ],
  },
  {
    code: "RDV",
    motsCles: [
      "rendez-vous", "rendez vous", "rdv", "r.d.v", "un rdv",
      "caler un rdv", "fixer rdv", "prendre rdv", "donner rdv",
      "planifier", "planification", "programmer", "reprogrammer",
      "reporter", "repousser", "décaler", "decaler", "recaler",
      "re-caler", "autre jour", "autre date", "autre créneau", "autre creneau",
      "changer la date", "changer l'heure", "changer l heure",
      "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
      "demain", "après-demain", "apres-demain", "apres demain",
      "dans 2 jours", "dans deux jours", "dans 3 jours",
      "semaine prochaine", "la semaine pro", "semaine qui vient",
      "mois prochain", "dans 15 jours", "dans quinze jours",
      "prochaine fois", "la prochaine fois",
      "matinée", "matinee", "après-midi", "apres-midi", "apres midi",
      "en fin de journée", "en fin de journee", "tôt le matin", "tot le matin",
    ],
  },
  {
    code: "DIAGNOSTIC",
    motsCles: [
      "diagnostic", "diagnostique", "diag", "pré-diag", "pre-diag",
      "analyse", "analyser", "j'analyse", "j analyse", "on analyse",
      "tester", "test", "je teste", "on teste", "testé", "teste",
      "vérifier", "verifier", "je vérifie", "je verifie", "vérifie", "verifie",
      "vérifié", "à vérifier", "a verifier",
      "contrôler", "controler", "je contrôle", "je controle", "contrôle", "controle",
      "inspection", "inspecter", "inspecte", "j'inspecte", "j inspecte",
      "examiner", "examen", "j'examine", "j examine",
      "mesurer", "mesure", "je mesure", "prise de mesure",
      "relever", "je relève", "je releve", "relevé", "releve",
      "anémomètre", "anemometre", "multimètre", "multimetre", "capacimètre", "capacimetre",
      "observer", "observe", "j'observe", "j observe", "observation",
      "constat", "constater", "constate", "je constate", "constatation",
      "regarder", "je regarde", "jetter un oeil", "jeter un oeil",
      "anomalie", "anomalies", "défaut", "defaut", "défauts", "defauts",
      "dysfonctionnement", "dysfonctionne", "problème", "probleme", "problèmes", "problemes",
      "panne", "pannes", "en panne",
      "symptôme", "symptome", "symptômes", "symptomes",
      "bizarre", "étrange", "etrange", "anormal", "anormale",
      "pas normal", "ne marche pas bien",
    ],
  },
  {
    code: "POSITIF",
    motsCles: [
      "ok", "okay", "bien", "très bien", "tres bien", "bon", "très bon", "tres bon",
      "parfait", "parfaitement", "nickel", "nickelle", "top", "au top",
      "correct", "correcte", "conforme", "aux normes", "aux règles", "aux regles",
      "opérationnel", "operationnel", "opérationnelle", "operationnelle",
      "fonctionne bien", "ça fonctionne", "ca fonctionne", "ça marche", "ca marche",
      "marche bien", "tourne bien", "en ordre", "en ordre de marche",
      "résolu", "resolu", "résolue", "resolue", "problème résolu", "probleme resolu",
      "réglé", "regle", "réglée", "reglee", "c'est réglé", "c est regle",
      "terminé", "termine", "terminée", "terminee", "c'est terminé", "c est termine",
      "fini", "finie", "c'est fini", "c est fini", "tout bon",
      "rien à signaler", "rien a signaler", "ras", "r.a.s.", "r.a.s",
      "tout va bien", "tout est ok", "tout est bon",
      "intervention réussie", "intervention reussie", "réussi", "reussi",
    ],
  },
];

function detecterIntention(texte) {
  const t = texte.toLowerCase();
  // Ordre de priorité respecté : premier match gagne
  for (const intent of INTENTIONS) {
    for (const mot of intent.motsCles) {
      if (t.includes(mot.toLowerCase())) {
        return intent.code;
      }
    }
  }
  return null;
}

// ═══ INTERPRÉTATION DES MESURES NUMÉRIQUES ════════════════════
// Plages multiples pour donner un conseil métier précis selon la valeur saisie.
// Chaque mesure peut avoir jusqu'à 5 niveaux : très bas / bas / OK / haut / très haut
const SEUILS_MESURES = {
  // ─── Débit à la bouche de SDB (norme arrêté 24/03/1982) ──────────────
  // Norme : ≥ 30 m³/h en SDB, ≥ 15 m³/h en WC
  VMC_DEP_NF_DEBIT_FINAL: {
    plages: [
      { max: 10, message: (v) => `❌ Débit ${v} m³/h critique (quasi nul). Cause probable : mototurbine HS, courroie cassée, ou gaine complètement obstruée. Escalade recommandée.` },
      { max: 20, message: (v) => `⚠️ Débit ${v} m³/h très insuffisant (norme ≥ 30 m³/h SDB). Vérifier état moteur, bouches, filtres et gaines.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h en dessous de la norme (≥ 30 m³/h requis). Nettoyer bouches et vérifier gaines.` },
      { max: 45, message: (v) => `✅ Débit ${v} m³/h conforme à la norme SDB (≥ 30 m³/h). Intervention efficace.` },
      { max: 999, message: (v) => `⚠️ Débit ${v} m³/h anormalement élevé. Vérifier le réglage du variateur ou la présence d'une fuite dans les gaines.` },
    ],
  },
  VMC_DEP_DEBIT_MESURE_INIT: {
    plages: [
      { max: 10, message: (v) => `❌ Débit ${v} m³/h quasi nul. Panne majeure probable : moteur, courroie, ou obstruction totale.` },
      { max: 20, message: (v) => `⚠️ Débit ${v} m³/h très insuffisant. Cause probable : bouches très encrassées, filtres saturés ou gaines partiellement obstruées.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h insuffisant. Causes probables : bouches encrassées (première chose à vérifier), puis filtres et gaines.` },
      { max: 45, message: (v) => `ℹ️ Débit ${v} m³/h déjà conforme (≥ 30 m³/h). Vérifier quand même l'installation pour détecter une cause latente.` },
      { max: 999, message: (v) => `⚠️ Débit ${v} m³/h très élevé pour un symptôme "débit insuffisant". Revérifier la mesure à un autre endroit.` },
    ],
  },
  VMC_DEP_DEBIT_MESURE_FIN: {
    plages: [
      { max: 20, message: (v) => `❌ Débit final ${v} m³/h toujours critique. Intervention non concluante, escalade fortement recommandée.` },
      { max: 29, message: (v) => `⚠️ Débit final ${v} m³/h toujours sous norme (≥ 30 m³/h requis). Vérifier s'il reste un élément non diagnostiqué (moteur, condensateur).` },
      { max: 45, message: (v) => `✅ Débit final ${v} m³/h conforme. Intervention efficace, norme respectée.` },
      { max: 999, message: (v) => `✅ Débit final ${v} m³/h excellent. Attention à ne pas surdimensionner si le logement est petit (sur-ventilation = pertes énergétiques).` },
    ],
  },
  VMC_DEP_HUM_DEBIT: {
    plages: [
      { max: 10, message: (v) => `❌ Débit ${v} m³/h quasi inexistant en pièce humide. L'humidité ne peut pas être évacuée. Panne majeure VMC.` },
      { max: 20, message: (v) => `⚠️ Débit ${v} m³/h très insuffisant en pièce humide. Insuffisant pour évacuer l'humidité d'une SDB ou cuisine.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h en dessous de la norme. Probable cause de l'humidité persistante. Nettoyer bouches et vérifier filtres.` },
      { max: 45, message: (v) => `✅ Débit ${v} m³/h correct en pièce humide. La ventilation fait bien son travail, l'humidité doit venir d'ailleurs (infiltration, ponts thermiques).` },
      { max: 999, message: (v) => `✅ Débit ${v} m³/h excellent. La ventilation n'est pas en cause, vérifier cause externe.` },
    ],
  },
  // ─── Capacité condensateur démarrage VMC (plage typique 2-10 µF) ─────
  VMC_DEP_NF_CONDO: {
    plages: [
      { max: 0.5, message: (v) => `❌ ${v} µF : condensateur complètement HS (claqué). À remplacer impérativement, le moteur ne démarre pas sans lui.` },
      { max: 1.5, message: (v) => `❌ ${v} µF : condensateur très affaibli. Remplacement immédiat requis.` },
      { max: 2, message: (v) => `⚠️ ${v} µF : valeur basse. Si valeur nominale > 2 µF (voir étiquette), condensateur à remplacer.` },
      { max: 10, message: (v) => `✅ ${v} µF : valeur dans la plage normale (2 à 10 µF typique). Comparer avec la valeur nominale gravée sur le composant (tolérance ±10%).` },
      { max: 20, message: (v) => `⚠️ ${v} µF : valeur élevée. Vérifier la référence du condensateur — cette valeur est atypique pour une VMC résidentielle.` },
      { max: 999, message: (v) => `⚠️ ${v} µF : valeur très anormale, probablement une erreur de mesure ou un condensateur inadapté.` },
    ],
  },
  // ─── ENTRETIEN : débit contrôle SDB (≥ 30 m³/h) ──────────────────
  VMC_ENT_DEBIT: {
    plages: [
      { max: 10, message: (v) => `❌ Débit ${v} m³/h critique. L'installation ne ventile quasiment plus, bascule recommandée vers un diagnostic Dépannage.` },
      { max: 20, message: (v) => `⚠️ Débit ${v} m³/h très insuffisant. Nettoyage des bouches et filtres insuffisant — vérifier gaines et moteur.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h sous norme (≥ 30 m³/h requis). L'entretien doit se prolonger par un contrôle des gaines.` },
      { max: 45, message: (v) => `✅ Débit ${v} m³/h conforme. Entretien validé, installation fonctionnelle.` },
      { max: 999, message: (v) => `✅ Débit ${v} m³/h excellent. Attention à ne pas sur-ventiler (pertes énergétiques accrues en hiver).` },
    ],
  },
  // ─── REMPLACEMENT : débit SDB après pose (≥ 30 m³/h) ─────────────
  VMC_REM_DEBIT_SDB: {
    plages: [
      { max: 15, message: (v) => `❌ Débit ${v} m³/h critique après remplacement. Vérifier le branchement du nouveau moteur et l'étanchéité des gaines.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h sous norme après pose. Revérifier raccordement gaines et mode de fonctionnement de la nouvelle VMC.` },
      { max: 45, message: (v) => `✅ Débit ${v} m³/h conforme (≥ 30 m³/h en SDB). Remplacement validé.` },
      { max: 70, message: (v) => `✅ Débit ${v} m³/h excellent. Nouvelle VMC performante.` },
      { max: 999, message: (v) => `⚠️ Débit ${v} m³/h anormalement élevé. Vérifier mode "grand débit" actif ou réglage du variateur.` },
    ],
  },
  // ─── REMPLACEMENT : débit WC après pose (≥ 15 m³/h) ──────────────
  VMC_REM_DEBIT_WC: {
    plages: [
      { max: 5, message: (v) => `❌ Débit ${v} m³/h critique en WC. Vérifier obstruction bouche ou branchement.` },
      { max: 14, message: (v) => `⚠️ Débit ${v} m³/h sous norme WC (≥ 15 m³/h requis). Ajuster bouche ou vérifier le T de raccordement.` },
      { max: 30, message: (v) => `✅ Débit ${v} m³/h conforme en WC (≥ 15 m³/h). Pose validée.` },
      { max: 999, message: (v) => `✅ Débit ${v} m³/h excellent en WC. Bon dimensionnement.` },
    ],
  },
  // ─── REMPLACEMENT : nombre de bouches (typique 2-8 pour résidentiel) ──
  VMC_REM_NB_BOUCHES: {
    plages: [
      { max: 1, message: (v) => `⚠️ ${v} bouche : très faible. Vérifier si toutes les pièces humides sont bien équipées (SDB, WC, cuisine).` },
      { max: 4, message: (v) => `✅ ${v} bouches : dimensionnement classique pour un T2-T3.` },
      { max: 8, message: (v) => `✅ ${v} bouches : dimensionnement cohérent pour un T4-T5 ou maison.` },
      { max: 15, message: (v) => `ℹ️ ${v} bouches : grand logement. Vérifier que le caisson est dimensionné pour ce débit total.` },
      { max: 999, message: (v) => `⚠️ ${v} bouches : très élevé pour une installation résidentielle. Vérifier que ce n'est pas un local tertiaire.` },
    ],
  },
  // ─── INSTALLATION : nombre de pièces raccordées ──────────────────
  VMC_INS_NB_PIECES: {
    plages: [
      { max: 1, message: (v) => `⚠️ ${v} pièce raccordée : très peu. Vérifier que toutes les pièces humides sont bien reliées (SDB + WC + cuisine minimum requis).` },
      { max: 3, message: (v) => `✅ ${v} pièces raccordées : dimensionnement standard pour un logement compact.` },
      { max: 6, message: (v) => `✅ ${v} pièces raccordées : configuration classique logement familial.` },
      { max: 10, message: (v) => `ℹ️ ${v} pièces raccordées : grand logement. S'assurer que le caisson supporte le débit cumulé.` },
      { max: 999, message: (v) => `⚠️ ${v} pièces raccordées : dimensionnement très important. Vérifier cohérence avec la puissance du caisson.` },
    ],
  },
  // ─── INSTALLATION : linéaire de gaines (m) ───────────────────────
  VMC_INS_GAINES_ML: {
    plages: [
      { max: 5, message: (v) => `ℹ️ ${v} m de gaines : installation très compacte. Vérifier que toutes les bouches sont raccordées.` },
      { max: 20, message: (v) => `✅ ${v} m de gaines : installation standard pour un appartement ou une petite maison.` },
      { max: 40, message: (v) => `✅ ${v} m de gaines : installation moyenne (maison individuelle classique).` },
      { max: 60, message: (v) => `ℹ️ ${v} m de gaines : installation étendue. Vérifier pertes de charge et puissance aspiration.` },
      { max: 999, message: (v) => `⚠️ ${v} m de gaines : installation très longue. Risque de pertes de charge importantes, dimensionnement moteur à vérifier.` },
    ],
  },
  // ─── INSTALLATION : débit SDB post-pose (≥ 30 m³/h) ─────────────
  VMC_INS_DEBIT_SDB: {
    plages: [
      { max: 15, message: (v) => `❌ Débit ${v} m³/h critique après installation. Vérifier raccordement gaines, sens moteur, réglage bouches.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h sous norme après installation neuve. Ajuster réglage bouches ou mode variateur.` },
      { max: 45, message: (v) => `✅ Débit ${v} m³/h conforme (≥ 30 m³/h). Installation validée pour SDB.` },
      { max: 70, message: (v) => `✅ Débit ${v} m³/h excellent. Installation bien dimensionnée.` },
      { max: 999, message: (v) => `⚠️ Débit ${v} m³/h très élevé. Ajuster réglage pour éviter sur-ventilation.` },
    ],
  },
  // ─── INSTALLATION : débit cuisine (≥ 45 m³/h ouverte) ────────────
  VMC_INS_DEBIT_CUISINE: {
    plages: [
      { max: 20, message: (v) => `❌ Débit ${v} m³/h très insuffisant en cuisine. Diagnostic nécessaire avant mise en service.` },
      { max: 29, message: (v) => `⚠️ Débit ${v} m³/h sous norme cuisine (≥ 30 m³/h minimum en cuisine fermée).` },
      { max: 44, message: (v) => `⚠️ Débit ${v} m³/h OK pour cuisine fermée, mais sous norme cuisine ouverte (≥ 45 m³/h requis).` },
      { max: 80, message: (v) => `✅ Débit ${v} m³/h conforme cuisine ouverte (≥ 45 m³/h). Installation validée.` },
      { max: 135, message: (v) => `✅ Débit ${v} m³/h élevé : mode grand débit probablement actif, parfait pour cuisson.` },
      { max: 999, message: (v) => `ℹ️ Débit ${v} m³/h très élevé. Confirmer que c'est bien le mode "grand débit" cuisine et pas une anomalie.` },
    ],
  },
};

function interpreterMesure(questionCode, valeur) {
  const seuils = SEUILS_MESURES[questionCode];
  if (!seuils || !seuils.plages) return null;
  const v = parseFloat(valeur);
  if (isNaN(v)) return null;
  // Parcourt les plages dans l'ordre, retourne le premier match
  for (const plage of seuils.plages) {
    if (v <= plage.max) return plage.message(v);
  }
  return null;
}

// ═══ ROOT ═════════════════════════════════════════════════════
export default function App() {
  const [intervenants, setIntervenants] = useState([]);
  const [clients, setClients] = useState([]);
  const [intervenantId, setIntervenantId] = useState(null);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api("/intervenants").then(setIntervenants).catch(() => setLoadError(true));
    api("/clients").then(setClients).catch(() => setLoadError(true));
  }, []);

  if (!intervenants.length) return (
    <div className="loading-screen">
      <div className="loading-avatar">VM</div>
      {loadError ? (
        <>
          <div className="loading-title">Connexion impossible</div>
          <div className="loading-sub">Le serveur ne répond pas. Il est peut-être en train de se réveiller (30-50 sec sur le plan gratuit).</div>
          <button className="loading-retry" onClick={() => window.location.reload()}>🔄 Réessayer</button>
        </>
      ) : (
        <>
          <div className="loading-title">VMC Assistant</div>
          <div className="loading-sub">Connexion au serveur en cours…</div>
          <div className="loading-dots"><span></span><span></span><span></span></div>
        </>
      )}
    </div>
  );

  const intervenantActif = intervenants.find((i) => i.id === intervenantId);

  return (
    <div className="app">
      <header className="chat-header">
        <div className="chat-header-title">
          <div className="chat-avatar">VM</div>
          <div>
            <div className="chat-header-name">VMC Assistant</div>
            <div className="chat-header-sub">Marques Confort</div>
          </div>
        </div>
        <div className="chat-header-right">
          <a href="/admin" className="chat-header-admin-link" title="Espace manager">
            📊 Suivi
          </a>
          <select
            className="intervenant-select"
            value={intervenantId || ""}
            onChange={(e) => setIntervenantId(parseInt(e.target.value, 10))}
          >
            <option value="">Je suis…</option>
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>
            ))}
          </select>
        </div>
      </header>

      {!intervenantActif ? (
        <WelcomeScreen />
      ) : (
        <ChatFlow key={intervenantActif.id} intervenant={intervenantActif} clients={clients} />
      )}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="chat-thread">
      <Bubble side="bot">
        Bonjour 👋 Je suis l'assistant d'intervention. Sélectionnez votre nom en haut à droite pour démarrer.
      </Bubble>
    </div>
  );
}

// ═══ CHAT FLOW ════════════════════════════════════════════════
function ChatFlow({ intervenant, clients }) {
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [clientId, setClientId] = useState(null);
  const [adresse, setAdresse] = useState("");
  const [captureFaite, setCaptureFaite] = useState(false);
  const [actionsContextuelles, setActionsContextuelles] = useState(null);
  const threadRef = useRef(null);
  const welcomedRef = useRef(false);

  useEffect(() => {
    // Garde contre le double-mount de React StrictMode en dev
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    addBot(`Bonjour ${intervenant.prenom} 👋 Prêt pour une nouvelle intervention.`);
    setTimeout(() => addBot("Pour quel client ?"), 400);
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  function addBot(content, opts = {}) {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    // Affiche d'abord l'indicateur de saisie puis le vrai message
    const typingId = Date.now() + Math.random();
    setMessages((m) => [...m, { id: typingId, side: "bot", typing: true }]);
    setTimeout(() => {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === typingId ? { ...msg, typing: false, content, time: ts, ...opts } : msg
        )
      );
    }, 600 + Math.random() * 400); // délai réaliste 600-1000ms
  }
  function addUser(content, opts = {}) {
    const ts = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { id: Date.now() + Math.random(), side: "user", content, time: ts, ...opts }]);
  }

  // ─── Client ────────────────────────────────────────────────
  function handleClient(c) {
    setClientId(c.id);
    setAdresse(c.adressePrincipale);
    addUser(c.nom);
    setTimeout(() => {
      addBot(`Adresse d'intervention : ${c.adressePrincipale}. Est-ce la bonne ?`);
      setPhase("adresse");
    }, 300);
  }

  // ─── Adresse ───────────────────────────────────────────────
  async function handleAdresseOK() {
    addUser("Oui, c'est la bonne adresse");
    await startParcours();
  }
  async function handleAdresseNouvelle(nouvelle) {
    setAdresse(nouvelle);
    addUser(nouvelle);
    await startParcours(nouvelle);
  }

  async function startParcours(adresseFinale = adresse) {
    try {
    const firstQ = await api("/questions/first");
    const interv = await api("/interventions", {
      method: "POST",
      body: {
        intervenantId: intervenant.id,
        clientId,
        adresseSite: adresseFinale,
        motif: "EN_ATTENTE", // provisoire, sera mis à jour à la première réponse
      },
    });
    setIntervention(interv);
    setTimeout(() => {
      afficheQuestion(firstQ);
      setPhase("parcours");
    }, 500);
    } catch (err) {
      addBot("\u274c Erreur de connexion au serveur. V\u00e9rifiez votre connexion internet. Si le probl\u00e8me persiste, le serveur est peut-\u00eatre en cours de r\u00e9veil (30-50 sec).");
    }
  }

  function afficheQuestion(q) {
    setCurrentQuestion(q);
    setCaptureFaite(false);

    // Interception : avant la signature de clôture, afficher le récap
    if (q.code === "VMC_CLOTURE_SIGNATURE" && phase !== "recap") {
      setPhase("recap");
      return;
    }

    addBot(q.libelle, {
      aideTexte: q.aideTexte,
      captureObligatoire: q.captureObligatoire,
      uniteAttendue: q.uniteAttendue,
    });
  }

  function validerRecapEtSigner() {
    // Sortir de la phase recap pour afficher la question signature normalement
    setPhase("parcours");
    addBot("Récapitulatif validé ✓ Dernière étape : recueillez la signature du client sur la tablette.");
    addBot(currentQuestion.libelle, {
      aideTexte: currentQuestion.aideTexte,
      captureObligatoire: currentQuestion.captureObligatoire,
    });
  }

  async function repondreChoix(reponse) {
    addUser(reponse.libelle);
    try {
    // Si c'est la première question (motif), on met à jour l'intervention avec le vrai motif
    if (currentQuestion.code === "VMC_ENTREE_MOTIF") {
      await api(`/interventions/${intervention.id}`, {
        method: "PATCH",
        body: { motif: reponse.valeur },
      }).catch(() => {}); // silent fail si endpoint pas encore déployé
    }
    const result = await api(`/interventions/${intervention.id}/reponses`, {
      method: "POST",
      body: { questionId: currentQuestion.id, valeur: reponse.valeur, reponsePossibleId: reponse.id },
    });
    gereSuite(result);
    } catch (err) {
      addBot("\u274c Probl\u00e8me de connexion. Votre r\u00e9ponse n'a pas \u00e9t\u00e9 enregistr\u00e9e. V\u00e9rifiez le r\u00e9seau et r\u00e9essayez.");
    }
  }

  async function repondreNumerique(valeur) {
    addUser(`${valeur} ${currentQuestion.uniteAttendue || ""}`.trim());
    await api(`/interventions/${intervention.id}/captures`, {
      method: "POST",
      body: { questionId: currentQuestion.id, type: "MESURE", valeur: String(valeur), unite: currentQuestion.uniteAttendue },
    });
    // Interprétation contextuelle de la valeur saisie
    const interpretation = interpreterMesure(currentQuestion.code, valeur);
    if (interpretation) {
      setTimeout(() => addBot(interpretation), 300);
    }
    const result = await api(`/interventions/${intervention.id}/reponses`, {
      method: "POST",
      body: { questionId: currentQuestion.id, valeur: String(valeur) },
    });
    gereSuite(result);
  }

  async function repondreTexteLibre(valeur) {
    addUser(valeur);
    const result = await api(`/interventions/${intervention.id}/reponses`, {
      method: "POST",
      body: { questionId: currentQuestion.id, valeur: String(valeur) },
    });
    gereSuite(result);
  }

  async function repondreSignature(dataUrl) {
    addUser(null, { signatureUrl: dataUrl });
    await api(`/interventions/${intervention.id}/captures`, {
      method: "POST",
      body: { questionId: currentQuestion.id, type: "SIGNATURE", valeur: dataUrl },
    });
    const result = await api(`/interventions/${intervention.id}/reponses`, {
      method: "POST",
      body: { questionId: currentQuestion.id, valeur: "signe" },
    });
    gereSuite(result);
  }

  async function envoyerPhoto(dataUrl) {
    addUser(null, { photoUrl: dataUrl });
    await api(`/interventions/${intervention.id}/captures`, {
      method: "POST",
      body: { questionId: currentQuestion.id, type: "PHOTO", valeur: dataUrl },
    });
    setCaptureFaite(true);

    // Analyse IA de la photo (si le service est disponible)
    try {
      addBot("📸 Photo enregistrée. Analyse IA en cours…");
      const result = await api("/analyze-photo", {
        method: "POST",
        body: {
          image: dataUrl,
          questionContext: currentQuestion.libelle,
          aideTexte: currentQuestion.aideTexte,
        },
      });
      if (result.analysis) {
        addBot(result.analysis, { isAiAnalysis: true });
        // Si Claude recommande de reprendre la photo, proposer le bouton
        const texteLC = result.analysis.toLowerCase();
        if (texteLC.includes("reprendre") || texteLC.includes("floue") || texteLC.includes("nette") || texteLC.includes("illisible") || texteLC.includes("mal cadr")) {
          setActionsContextuelles([
            { label: "📸 Reprendre la photo", onClick: () => { setActionsContextuelles(null); setCaptureFaite(false); } },
            { label: "✓ Photo suffisante, continuer", onClick: () => setActionsContextuelles(null) },
          ]);
        }
      }
    } catch (err) {
      // IA non dispo → on continue normalement, la photo est enregistrée
      addBot("Photo enregistrée ✓ Vous pouvez répondre à la question.");
    }
  }

  // ─── Commentaire libre (tapé dans la barre) ───────────────
  async function envoyerCommentaire(texte) {
    if (!texte.trim()) return;
    addUser(texte);

    if (intervention && currentQuestion) {
      await api(`/interventions/${intervention.id}/reponses`, {
        method: "POST",
        body: { questionId: currentQuestion.id, valeur: `[COMMENTAIRE] ${texte}` },
      });
    }

    // Analyse du commentaire pour déclencher une réaction contextuelle
    const intention = detecterIntention(texte);
    setTimeout(() => reagirAuCommentaire(intention, texte), 400);
  }

  function reagirAuCommentaire(intention, texte) {
    let actions = null;

    switch (intention) {
      case "URGENCE":
        addBot("🚨 ALERTE SÉCURITÉ DÉTECTÉE — Votre commentaire signale un risque potentiel. Actions immédiates recommandées :");
        addBot("1️⃣ Couper l'alimentation électrique au disjoncteur dédié VMC\n2️⃣ Si odeur de gaz : ne pas actionner d'interrupteur, aérer et évacuer\n3️⃣ Mettre la zone en sécurité (balisage si nécessaire)\n4️⃣ Contacter le manager AVANT de poursuivre toute manipulation");
        actions = [
          { label: "🚨 Escalader immédiatement", onClick: () => escaladerIntervention("Urgence sécurité signalée par l'intervenant") },
          { label: "📸 Documenter la zone (photo)", onClick: () => forcerPhoto() },
          { label: "↩ Fausse alerte, continuer", onClick: () => clearActions() },
        ];
        break;

      case "ESCALADE":
        addBot("⚠️ Situation nécessitant un avis supérieur. Avant d'escalader, pensez à documenter :");
        addBot("• La raison précise de l'escalade (technique ? relationnelle ? contractuelle ?)\n• Ce que vous avez déjà tenté\n• Les photos/mesures qui appuient votre constat\nCela aidera le manager à prendre une décision rapide.");
        actions = [
          { label: "📢 Escalader maintenant", onClick: () => escaladerIntervention("Escalade demandée par l'intervenant") },
          { label: "📝 Documenter d'abord puis escalader", onClick: () => demanderDetails("Décrivez la situation en détail pour le manager") },
          { label: "↩ Finalement non, continuer", onClick: () => clearActions() },
        ];
        break;

      case "SUITES":
        addBot("📌 Intervention avec suites à donner. Points importants à ne pas oublier :");
        addBot("• Préciser exactement ce qui reste à faire (pièce à commander, action à planifier)\n• Estimer le délai nécessaire avant le retour\n• Informer le client du planning prévu\n• Vérifier si le matériel nécessaire est disponible au dépôt");
        actions = [
          { label: "📅 Planifier un retour", onClick: () => demanderDetails("Indiquez la date ou semaine du retour prévu, et ce qui motive ce délai") },
          { label: "📝 Lister le reste à faire", onClick: () => demanderDetails("Détaillez précisément ce qui reste à faire lors du prochain passage") },
          { label: "↩ Continuer le parcours", onClick: () => clearActions() },
        ];
        break;

      case "PIECE":
        addBot("🔧 Pièce ou matériel à prévoir. Pour faciliter la commande, notez :");
        addBot("• La référence exacte (gravée sur la pièce ou sur la plaque signalétique du caisson)\n• La marque et le modèle de la VMC (important pour la compatibilité)\n• La quantité nécessaire\n• L'urgence : le client peut-il attendre 48h ou faut-il dépanner en provisoire ?");
        actions = [
          { label: "📝 Noter la référence complète", onClick: () => demanderDetails("Indiquez : marque VMC, référence pièce, quantité, délai souhaité") },
          { label: "📞 Vérifier disponibilité au dépôt", onClick: () => demanderDetails("Notez la demande de vérification stock au dépôt Fetz : quelle pièce, quelle quantité ?") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "RDV":
        addBot("📅 Rendez-vous à prévoir. Quelques points à vérifier :");
        addBot("• Le client est-il disponible à la date proposée ?\n• Le matériel nécessaire sera-t-il livré d'ici là ?\n• Faut-il prévoir un créneau long (remplacement) ou court (vérification) ?\n• Pensez à confirmer le RDV par SMS ou appel 24h avant");
        actions = [
          { label: "📆 Détailler le RDV", onClick: () => demanderDetails("Indiquez la date, l'horaire et la durée estimée du prochain passage") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "CLIENT_ABSENT":
        addBot("👤 Client absent du domicile. Options possibles :");
        addBot("• Si l'accès technique est possible (clé sous le paillasson, gardien) : poursuivre l'intervention\n• Si l'accès est impossible : prendre une photo de la porte fermée et reprogrammer\n• Pensez à appeler le client pour confirmer son absence et convenir d'un nouveau créneau");
        actions = [
          { label: "▶ Accès OK, je poursuis", onClick: () => clearActions() },
          { label: "📞 Appeler le client", onClick: () => { clearActions(); addBot("Essayez de joindre le client. S'il ne répond pas, escaladez pour reprogrammer."); } },
          { label: "🔄 Reprogrammer la visite", onClick: () => escaladerIntervention("Client absent — reprogrammation nécessaire") },
        ];
        break;

      case "ACCES":
        addBot("🚪 Problème d'accès signalé. Causes fréquentes et solutions :");
        addBot("• Trappe de visite condamnée → demander au propriétaire de la libérer\n• Combles encombrés → signaler au client, hors périmètre intervenant\n• Digicode/interphone en panne → contacter le syndic ou le gardien\n• Caisson encastré dans un faux-plafond → prévoir outillage adapté au prochain passage");
        actions = [
          { label: "📝 Documenter l'obstacle", onClick: () => demanderDetails("Décrivez l'obstacle d'accès et ce qui serait nécessaire pour le lever") },
          { label: "📞 Contacter syndic/gardien", onClick: () => demanderDetails("Notez les coordonnées du syndic/gardien et la demande à formuler") },
          { label: "🔄 Reprogrammer", onClick: () => escaladerIntervention("Accès impossible — reprogrammation nécessaire") },
        ];
        break;

      case "DIAGNOSTIC":
        addBot("🔍 Phase de diagnostic en cours. Conseils pour un diagnostic efficace :");
        addBot("• Procédez par élimination : alimentation → moteur → gaines → bouches\n• Prenez une photo à chaque étape (avant/après)\n• Notez les valeurs mesurées même si elles semblent normales\n• Comparez avec les valeurs de référence sur la plaque signalétique du caisson");
        actions = [
          { label: "📸 Ajouter une photo de constat", onClick: () => forcerPhoto() },
          { label: "📏 Noter une mesure", onClick: () => demanderDetails("Indiquez la mesure relevée, sa valeur et l'endroit du relevé") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "DEVIS":
        addBot("💶 Devis à établir. Pour que le chiffrage soit précis, pensez à noter :");
        addBot("• Les travaux exacts à réaliser (remplacement moteur, reprise de gaines, ajout de bouches...)\n• Le matériel nécessaire avec références\n• La main d'œuvre estimée (nombre d'heures, nombre d'intervenants)\n• Si le client a exprimé un budget ou une urgence particulière");
        actions = [
          { label: "📝 Détailler les travaux", onClick: () => demanderDetails("Listez les travaux à chiffrer : matériel + main d'œuvre + délai estimé") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "POSITIF":
        addBot("👍 Parfait, RAS. Continuez quand vous êtes prêt.");
        break;

      default:
        addBot("✓ Noté. Votre commentaire est enregistré avec l'intervention.");
    }

    setActionsContextuelles(actions);
  }

  function clearActions() {
    setActionsContextuelles(null);
  }

  function demanderDetails(prompt) {
    setActionsContextuelles(null);
    addBot(prompt + " — tapez-les dans la barre de commentaire ci-dessous.");
  }

  async function forcerPhoto() {
    setActionsContextuelles(null);
    addBot("📷 Prenez une photo via la caméra ou la galerie, puis tapez un commentaire pour la décrire.");
    // On ne force pas techniquement ici, mais on invite. Une évolution future
    // pourrait ouvrir directement le sélecteur photo.
  }

  async function escaladerIntervention(motif) {
    setActionsContextuelles(null);
    if (intervention) {
      await api(`/interventions/${intervention.id}/reponses`, {
        method: "POST",
        body: {
          questionId: currentQuestion?.id || 0,
          valeur: `[ESCALADE] ${motif}`,
        },
      });
      // Escalade enregistrée via la réponse [ESCALADE] ci-dessus
    }
    addBot(`⚠️ Intervention escaladée au manager.\nMotif : "${motif}"\nLes données collectées jusqu'ici sont enregistrées et accessibles dans le suivi.`);
    setPhase("termine");
  }

  function gereSuite(result) {
    setTimeout(() => {
      if (result.done) {
        if (result.action === "CLOTURE") {
          addBot("✅ Intervention terminée ! Toutes vos réponses, photos et mesures ont été enregistrées. Le récapitulatif est accessible dans le suivi. Merci et bonne continuation 👍");
          setPhase("termine");
        } else if (result.action === "ESCALADE") {
          addBot("⚠️ Le diagnostic indique qu'une remontée manager est nécessaire. Confirmez-vous l'escalade ?");
          setActionsContextuelles([
            { label: "⚠️ Oui, escalader au manager", onClick: () => confirmerEscalade() },
            { label: "↩ Non, je gère sur place", onClick: () => { clearActions(); addBot("Compris. Ajoutez un commentaire pour expliquer votre solution, puis vous pourrez passer à la signature."); } },
          ]);
        }
      } else {
        afficheQuestion(result.question);
      }
    }, 500);
  }

  async function confirmerEscalade() {
    setActionsContextuelles(null);
    if (intervention) {
      await api(`/interventions/${intervention.id}/reponses`, {
        method: "POST",
        body: { questionId: currentQuestion?.id || 0, valeur: "[ESCALADE] Confirmée par l'intervenant suite au diagnostic" },
      }).catch(() => {});
    }
    addBot("⚠️ Intervention escaladée au manager. Notification envoyée. Toutes les données collectées sont enregistrées et accessibles dans le suivi.");
    setPhase("termine");
  }

  function reset() {
    setMessages([]);
    setCurrentQuestion(null);
    setIntervention(null);
    setClientId(null);
    setAdresse("");
    setPhase("setup");
    setCaptureFaite(false);
    setTimeout(() => {
      addBot(`Bonjour ${intervenant.prenom} 👋 Prêt pour une nouvelle intervention.`);
      setTimeout(() => addBot("Pour quel client ?"), 400);
    }, 100);
  }

  return (
    <>
      {phase === "recap" ? (
        <RecapScreen
          intervention={intervention}
          intervenant={intervenant}
          clients={clients}
          onValider={validerRecapEtSigner}
          onRetour={() => {
            setPhase("parcours");
            addBot("Retour au fil de discussion. Quand vous êtes prêt, passez à la signature du client.");
          }}
        />
      ) : (
        <div className="chat-thread" ref={threadRef}>
          {messages.map((m) => (
            <Bubble key={m.id} side={m.side} {...m}>{m.content}</Bubble>
          ))}
        </div>
      )}

      {phase !== "recap" && (
        <div className="chat-input-zone">
          {phase === "setup" && (
            <QuickReplies options={clients.map((c) => ({ label: c.nom, onClick: () => handleClient(c) }))} />
          )}

          {phase === "adresse" && (
            <AdresseInput adresseInitiale={adresse} onOK={handleAdresseOK} onChange={handleAdresseNouvelle} />
          )}

          {phase === "parcours" && currentQuestion && (
            <ParcoursInput
              question={currentQuestion}
              captureFaite={captureFaite}
              actionsContextuelles={actionsContextuelles}
              onChoix={repondreChoix}
              onNumerique={repondreNumerique}
              onTexteLibre={repondreTexteLibre}
              onSignature={repondreSignature}
              onPhoto={envoyerPhoto}
              onCommentaire={envoyerCommentaire}
            />
          )}

          {phase === "termine" && (
            <div className="quick-replies">
              <button className="quick-reply btn-primary-full" onClick={reset}>
                🔄 Nouvelle intervention
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═══ BULLE ═════════════════════════════════════════════════════
function Bubble({ side, children, captureObligatoire, aideTexte, photoUrl, signatureUrl, typing, time, isAiAnalysis }) {
  if (typing) {
    return (
      <div className={`bubble-row bot`}>
        <div className="bubble-avatar">VM</div>
        <div className="bubble bot">
          <div className="typing-indicator"><span></span><span></span><span></span></div>
        </div>
      </div>
    );
  }
  return (
    <div className={`bubble-row ${side}`}>
      {side === "bot" && <div className="bubble-avatar">{isAiAnalysis ? "🤖" : "VM"}</div>}
      <div className={`bubble ${side} ${isAiAnalysis ? "ai-analysis" : ""}`}>
        {isAiAnalysis && <div className="ai-analysis-header">🤖 Analyse IA</div>}
        {children && <div className="bubble-text">{children}</div>}
        {aideTexte && <div className="bubble-help">💡 {aideTexte}</div>}
        {captureObligatoire && (
          <div className="bubble-capture-note">
            {captureLabels[captureObligatoire]?.icon} {captureLabels[captureObligatoire]?.label}
          </div>
        )}
        {photoUrl && <img src={photoUrl} alt="capture" className="bubble-photo" />}
        {signatureUrl && <img src={signatureUrl} alt="signature" className="bubble-signature" />}
        {time && <div className="bubble-time">{time}</div>}
      </div>
    </div>
  );
}

// ═══ QUICK REPLIES ═════════════════════════════════════════════
function QuickReplies({ options }) {
  return (
    <div className="quick-replies">
      {options.map((o, i) => (
        <button key={i} className="quick-reply" onClick={o.onClick}>{o.label}</button>
      ))}
    </div>
  );
}

// ═══ ADRESSE ═══════════════════════════════════════════════════
function AdresseInput({ adresseInitiale, onOK, onChange }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(adresseInitiale);

  if (!edit) {
    return (
      <div className="quick-replies">
        <button className="quick-reply" onClick={onOK}>Oui, c'est la bonne</button>
        <button className="quick-reply" onClick={() => setEdit(true)}>Non, changer</button>
      </div>
    );
  }
  return (
    <div className="text-input-row">
      <input
        className="text-input"
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Nouvelle adresse…"
      />
      <button className="btn-send" onClick={() => val && onChange(val)}>→</button>
    </div>
  );
}

// ═══ RECAP SCREEN — avant signature de clôture ════════════════
function RecapScreen({ intervention, intervenant, clients, onValider, onRetour }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    // Récupère l'intervention complète (réponses + captures + pièces)
    api(`/interventions/${intervention.id}`).then(setDetail);
  }, [intervention.id]);

  if (!detail) return <div className="loading">Chargement du récap…</div>;

  const client = clients.find((c) => c.id === detail.clientId);
  const duree = Math.round((Date.now() - new Date(detail.dateCreation).getTime()) / 60000);

  // Groupement des réponses par question
  const reponsesAffichables = detail.reponses
    .filter((r) => !r.valeur.startsWith("[COMMENTAIRE]"))
    .map((r) => ({
      question: r.question.libelle,
      valeur: r.valeur,
      timestamp: r.timestamp,
    }));

  const commentaires = detail.reponses
    .filter((r) => r.valeur.startsWith("[COMMENTAIRE]"))
    .map((r) => ({
      texte: r.valeur.replace("[COMMENTAIRE] ", ""),
      timestamp: r.timestamp,
    }));

  const photos = detail.captures.filter((c) => c.type === "PHOTO");
  const mesures = detail.captures.filter((c) => c.type === "MESURE");

  return (
    <div className="recap-screen">
      <div className="recap-header">
        <h1>Récap d'intervention</h1>
        <div className="recap-subtitle">Vérifiez avant de faire signer le client</div>
      </div>

      <div className="recap-section">
        <div className="recap-section-title">📋 Informations générales</div>
        <div className="recap-grid">
          <RecapItem label="Intervention n°" value={`#${detail.id}`} />
          <RecapItem label="Intervenant" value={`${intervenant.prenom} ${intervenant.nom}`} />
          <RecapItem label="Client" value={client?.nom || "—"} />
          <RecapItem label="Adresse" value={detail.adresseSite} />
          <RecapItem label="Motif" value={detail.motif} />
          <RecapItem label="Durée" value={`${duree} min`} />
        </div>
      </div>

      <div className="recap-section">
        <div className="recap-section-title">📝 Diagnostic ({reponsesAffichables.length} étapes)</div>
        <ul className="recap-list">
          {reponsesAffichables.map((r, i) => (
            <li key={i} className="recap-list-item">
              <span className="recap-question">{r.question}</span>
              <span className="recap-valeur">{formatValeur(r.valeur)}</span>
            </li>
          ))}
        </ul>
      </div>

      {mesures.length > 0 && (
        <div className="recap-section">
          <div className="recap-section-title">📏 Mesures ({mesures.length})</div>
          <ul className="recap-list">
            {mesures.map((m, i) => (
              <li key={i} className="recap-list-item">
                <span className="recap-question">Mesure #{i + 1}</span>
                <span className="recap-valeur">{m.valeur} {m.unite}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {photos.length > 0 && (
        <div className="recap-section">
          <div className="recap-section-title">📷 Photos ({photos.length})</div>
          <div className="recap-photos">
            {photos.map((p, i) => (
              <img key={i} src={p.valeur} alt={`Photo ${i + 1}`} className="recap-photo" />
            ))}
          </div>
        </div>
      )}

      {commentaires.length > 0 && (
        <div className="recap-section">
          <div className="recap-section-title">💬 Commentaires libres ({commentaires.length})</div>
          <ul className="recap-list">
            {commentaires.map((c, i) => (
              <li key={i} className="recap-comment">{c.texte}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="recap-actions">
        <button className="btn-secondary" onClick={onRetour}>← Retour au parcours</button>
        <button className="btn-primary-full" onClick={onValider}>
          Valider et faire signer ✓
        </button>
      </div>
    </div>
  );
}

function RecapItem({ label, value }) {
  return (
    <div className="recap-item">
      <div className="recap-item-label">{label}</div>
      <div className="recap-item-value">{value}</div>
    </div>
  );
}

function formatValeur(v) {
  // Mapper quelques valeurs techniques en libellés lisibles
  const map = {
    oui: "Oui",
    non: "Non",
    saisi: "Saisie validée",
    signe: "Signature recueillie",
    entretien: "Entretien préventif",
    depannage: "Dépannage",
    remplacement: "Remplacement",
    installation: "Installation",
    ne_fonctionne_plus: "Ne fonctionne plus",
    bruit: "Bruit anormal",
    debit: "Débit insuffisant",
    humidite: "Humidité persistante",
    code_erreur: "Code erreur",
    vibration: "Vibration / claquement",
    sifflement: "Sifflement aérodynamique",
    grincement: "Grincement moteur",
    autre: "Autre",
    propres: "Propres",
    sales: "Sales",
  };
  return map[v] || v;
}

// ═══ PARCOURS — QUICK REPLIES + BARRE D'ÉCRITURE PERMANENTE ═══
function ParcoursInput({ question, captureFaite, actionsContextuelles, onChoix, onNumerique, onSignature, onPhoto, onCommentaire, onTexteLibre }) {
  const [commentaire, setCommentaire] = useState("");
  const captureOblig = question.captureObligatoire;
  const besoinCapturePhoto = captureOblig === "PHOTO" && !captureFaite;

  function envoyerCommentaire() {
    if (!commentaire.trim()) return;
    onCommentaire(commentaire);
    setCommentaire("");
  }

  // Zone haute : si actions contextuelles actives, elles prennent le dessus.
  // Sinon, input normal selon type de question.
  let zoneReponse = null;

  if (actionsContextuelles && actionsContextuelles.length > 0) {
    zoneReponse = (
      <div className="actions-contextuelles">
        <div className="actions-label">Actions suggérées :</div>
        <QuickReplies options={actionsContextuelles} />
      </div>
    );
  } else if (besoinCapturePhoto) {
    zoneReponse = <PhotoCapture onPhoto={onPhoto} />;
  } else if (question.typeReponse === "CHOIX_UNIQUE") {
    zoneReponse = (
      <QuickReplies
        options={question.reponsesPossibles.map((r) => ({
          label: r.libelle,
          onClick: () => onChoix(r),
        }))}
      />
    );
  } else if (question.typeReponse === "NUMERIQUE") {
    zoneReponse = <NumericInput unite={question.uniteAttendue} onSubmit={onNumerique} />;
  } else if (question.typeReponse === "TEXTE_LIBRE") {
    zoneReponse = <TexteLibreInput onSubmit={onTexteLibre} />;
  } else if (question.typeReponse === "SIGNATURE") {
    zoneReponse = <SignaturePad onSubmit={onSignature} />;
  }

  return (
    <div className="parcours-input">
      {zoneReponse && <div className="parcours-input-main">{zoneReponse}</div>}

      {/* Barre d'écriture permanente pour commentaires libres */}
      <div className="text-input-row commentaire-row">
        <input
          className="text-input"
          type="text"
          placeholder="Ajouter un commentaire…"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && envoyerCommentaire()}
        />
        <button
          className="btn-send"
          disabled={!commentaire.trim()}
          onClick={envoyerCommentaire}
          title="Envoyer le commentaire"
        >
          →
        </button>
      </div>
    </div>
  );
}

// ═══ NUMERIC ═══════════════════════════════════════════════════
function NumericInput({ unite, onSubmit }) {
  const [val, setVal] = useState("");
  function submit() {
    if (!val) return;
    onSubmit(val);
    setVal("");
  }
  return (
    <div className="text-input-row">
      <input
        className="text-input numeric"
        type="number"
        inputMode="decimal"
        value={val}
        placeholder="Valeur…"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      {unite && <span className="text-input-unite">{unite}</span>}
      <button className="btn-send" disabled={!val} onClick={submit}>→</button>
    </div>
  );
}

// ═══ INPUT TEXTE LIBRE ═════════════════════════════════════════
function TexteLibreInput({ onSubmit }) {
  const [val, setVal] = useState("");
  function submit() {
    if (!val.trim()) return;
    onSubmit(val.trim());
    setVal("");
  }
  return (
    <div className="text-input-row">
      <input
        className="text-input"
        type="text"
        value={val}
        placeholder="Saisir la réponse…"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <button className="btn-send" disabled={!val.trim()} onClick={submit}>→</button>
    </div>
  );
}

// ═══ PHOTO ═════════════════════════════════════════════════════
function PhotoCapture({ onPhoto }) {
  const [stream, setStream] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  async function tryOpenCamera(constraints) {
    return await navigator.mediaDevices.getUserMedia({ video: constraints });
  }

  async function openCamera() {
    setErrorMsg(null);
    // Tentatives dans l'ordre : arrière → frontale → n'importe quelle caméra
    const attempts = [
      { facingMode: { ideal: "environment" } },
      { facingMode: "user" },
      true,
    ];
    let s = null;
    let lastErr;
    for (const c of attempts) {
      try {
        s = await tryOpenCamera(c);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!s) {
      setErrorMsg(
        lastErr?.name === "NotAllowedError"
          ? "Accès caméra refusé. Vérifiez les permissions dans votre navigateur (🔒 à gauche de l'URL)."
          : "Caméra indisponible. Peut-être utilisée par une autre appli. Essayez la galerie."
      );
      return;
    }
    setStream(s);
    if (videoRef.current) {
      videoRef.current.srcObject = s;
      try { await videoRef.current.play(); } catch {}
    }
  }

  function snap() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    setPreview(dataUrl);
    stopCamera();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }

  function uploadFromGallery(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function valider() {
    onPhoto(preview);
    setPreview(null);
  }

  if (preview) {
    return (
      <div className="photo-preview-zone">
        <img src={preview} alt="preview" className="photo-preview" />
        <div className="photo-actions">
          <button className="btn-secondary" onClick={() => setPreview(null)}>Reprendre</button>
          <button className="btn-primary-full" onClick={valider}>Envoyer ✓</button>
        </div>
      </div>
    );
  }

  if (stream) {
    return (
      <div className="photo-capture-zone">
        <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div className="photo-actions">
          <button className="btn-secondary" onClick={stopCamera}>Annuler</button>
          <button className="btn-primary-full" onClick={snap}>📸 Prendre</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quick-replies">
      <button className="quick-reply" onClick={openCamera}>📷 Ouvrir la caméra</button>
      <button className="quick-reply" onClick={() => fileRef.current.click()}>🖼️ Depuis la galerie</button>
      {errorMsg && <div className="camera-error">{errorMsg}</div>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={uploadFromGallery}
      />
    </div>
  );
}

// ═══ SIGNATURE ═════════════════════════════════════════════════
function SignaturePad({ onSubmit }) {
  const canvasRef = useRef(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef(null);

  useEffect(() => {
    if (signing && canvasRef.current) {
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      c.width = c.offsetWidth * dpr;
      c.height = c.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0C447C";
    }
  }, [signing]);

  function getPoint(e) {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPoint(e);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const p = getPoint(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    setHasSignature(true);
  }
  function stop() { drawing.current = false; }
  function clear() {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  }
  function submit() {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSubmit(dataUrl);
  }

  if (!signing) {
    return (
      <div className="quick-replies">
        <button className="quick-reply" onClick={() => setSigning(true)}>✍️ Faire signer le client</button>
      </div>
    );
  }

  return (
    <div className="signature-zone">
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={stop}
      />
      <div className="signature-label">Signer dans la zone ci-dessus</div>
      <div className="photo-actions">
        <button className="btn-secondary" onClick={clear}>Effacer</button>
        <button className="btn-primary-full" disabled={!hasSignature} onClick={submit}>Valider ✓</button>
      </div>
    </div>
  );
}