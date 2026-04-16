// VMC Chatbot API
// Expose les endpoints nécessaires pour faire tourner le moteur de parcours côté front.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { prisma } = require("@vmc/db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // 10mb pour accepter les photos en base64 dans le POC

const PORT = process.env.PORT || 4000;

// ─── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

// ─── Référentiels ──────────────────────────────────────────────
app.get("/intervenants", async (req, res) => {
  const list = await prisma.intervenant.findMany({
    where: { actif: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  res.json(list);
});

app.get("/clients", async (req, res) => {
  const list = await prisma.client.findMany({ orderBy: { nom: "asc" } });
  res.json(list);
});

// ─── Arbre de décision : récupération des questions ────────────

// Première question de l'arbre VMC (point d'entrée)
app.get("/questions/first", async (req, res) => {
  const q = await prisma.question.findUnique({
    where: { code: "VMC_ENTREE_MOTIF" },
    include: { reponsesPossibles: { orderBy: { ordre: "asc" } } },
  });
  if (!q) return res.status(404).json({ error: "Question d'entrée introuvable" });
  res.json(q);
});

// Question par id (pour avancer dans l'arbre)
app.get("/questions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const q = await prisma.question.findUnique({
    where: { id },
    include: { reponsesPossibles: { orderBy: { ordre: "asc" } } },
  });
  if (!q) return res.status(404).json({ error: "Question introuvable" });
  res.json(q);
});

// ─── Interventions : création et suivi ─────────────────────────

// Démarrer une nouvelle intervention
app.post("/interventions", async (req, res) => {
  const { intervenantId, clientId, adresseSite, motif } = req.body;
  if (!intervenantId || !clientId || !adresseSite || !motif) {
    return res.status(400).json({ error: "intervenantId, clientId, adresseSite, motif requis" });
  }
  const intervention = await prisma.intervention.create({
    data: { intervenantId, clientId, adresseSite, motif: motif.toUpperCase() },
  });
  res.status(201).json(intervention);
});

// Récupérer une intervention complète (réponses + captures + pièces)
app.get("/interventions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const intervention = await prisma.intervention.findUnique({
    where: { id },
    include: {
      intervenant: true,
      client: true,
      reponses: { include: { question: true } },
      captures: true,
      pieces: true,
    },
  });
  if (!intervention) return res.status(404).json({ error: "Intervention introuvable" });
  res.json(intervention);
});

// Enregistrer une réponse à une question + déterminer la suite
app.post("/interventions/:id/reponses", async (req, res) => {
  const interventionId = parseInt(req.params.id, 10);
  const { questionId, valeur, reponsePossibleId } = req.body;

  if (!questionId || valeur === undefined) {
    return res.status(400).json({ error: "questionId et valeur requis" });
  }

  // Enregistre la réponse
  await prisma.reponseDonnee.create({
    data: { interventionId, questionId, valeur: String(valeur) },
  });

  // Détermine la suite : soit via reponsePossibleId (choix unique/multiple), soit via la
  // réponse "saisi"/"signe" générique pour les types non-choix.
  let next;
  if (reponsePossibleId) {
    next = await prisma.reponsePossible.findUnique({
      where: { id: reponsePossibleId },
      include: { questionSuivante: { include: { reponsesPossibles: { orderBy: { ordre: "asc" } } } } },
    });
  } else {
    // Pour les questions numériques, texte, photo, signature : une seule transition possible.
    next = await prisma.reponsePossible.findFirst({
      where: { questionId },
      include: { questionSuivante: { include: { reponsesPossibles: { orderBy: { ordre: "asc" } } } } },
    });
  }

  if (!next) {
    return res.json({ done: true, action: "CLOTURE", question: null });
  }

  if (next.actionSuivante === "CLOTURE") {
    // Marquer l'intervention comme terminée
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { statut: "TERMINEE", dateCloture: new Date() },
    });
    return res.json({ done: true, action: "CLOTURE", question: null });
  }

  if (next.actionSuivante === "ESCALADE") {
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { statut: "ESCALADEE" },
    });
    return res.json({ done: true, action: "ESCALADE", question: null });
  }

  res.json({ done: false, action: "QUESTION_SUIVANTE", question: next.questionSuivante });
});

// Ajouter une capture (photo, mesure, etc.)
app.post("/interventions/:id/captures", async (req, res) => {
  const interventionId = parseInt(req.params.id, 10);
  const { questionId, type, valeur, unite } = req.body;

  if (!type || valeur === undefined) {
    return res.status(400).json({ error: "type et valeur requis" });
  }
  const capture = await prisma.capture.create({
    data: { interventionId, questionId, type: type.toUpperCase(), valeur: String(valeur), unite },
  });
  res.status(201).json(capture);
});

// ─── Démarrage ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API VMC en écoute sur http://localhost:${PORT}`);
});
