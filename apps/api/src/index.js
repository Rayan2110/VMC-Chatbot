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

// Mettre à jour le motif d'une intervention (appelé quand l'utilisateur choisit le motif réel)
app.patch("/interventions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { motif } = req.body;
  if (!motif) return res.status(400).json({ error: "motif requis" });
  const intervention = await prisma.intervention.update({
    where: { id },
    data: { motif: motif.toUpperCase() },
  });
  res.json(intervention);
});

// Liste paginée d'interventions avec filtres (pour admin)
app.get("/interventions", async (req, res) => {
  const { statut, intervenantId, motif, page = 1, pageSize = 20 } = req.query;
  const where = {};
  if (statut) where.statut = statut;
  if (intervenantId) where.intervenantId = parseInt(intervenantId, 10);
  if (motif) where.motif = motif;

  const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
  const take = parseInt(pageSize, 10);

  const [items, total] = await Promise.all([
    prisma.intervention.findMany({
      where,
      orderBy: { dateCreation: "desc" },
      skip,
      take,
      include: {
        intervenant: true,
        client: true,
        _count: { select: { reponses: true, captures: true, pieces: true } },
      },
    }),
    prisma.intervention.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page, 10), pageSize: take });
});

// Statistiques agrégées (pour admin dashboard)
app.get("/interventions-stats", async (req, res) => {
  const [total, termine, escalade, enCours, parIntervenant, parMotif] = await Promise.all([
    prisma.intervention.count(),
    prisma.intervention.count({ where: { statut: "TERMINEE" } }),
    prisma.intervention.count({ where: { statut: "ESCALADEE" } }),
    prisma.intervention.count({ where: { statut: "EN_COURS" } }),
    prisma.intervention.groupBy({
      by: ["intervenantId"],
      _count: true,
    }),
    prisma.intervention.groupBy({
      by: ["motif"],
      _count: true,
    }),
  ]);

  // Enrichir avec les noms
  const intervenants = await prisma.intervenant.findMany();
  const parIntervenantEnrichi = parIntervenant.map((p) => {
    const i = intervenants.find((x) => x.id === p.intervenantId);
    return {
      intervenantId: p.intervenantId,
      nom: i ? `${i.prenom} ${i.nom}` : `#${p.intervenantId}`,
      count: p._count,
    };
  });

  res.json({
    total,
    termine,
    escalade,
    enCours,
    tauxEscalade: total > 0 ? Math.round((escalade / total) * 100) : 0,
    parIntervenant: parIntervenantEnrichi,
    parMotif: parMotif.map((m) => ({ motif: m.motif, count: m._count })),
  });
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

// ─── Analyse photo par IA (Claude API) ─────────────────────────
app.post("/analyze-photo", async (req, res) => {
  const { image, questionContext, aideTexte } = req.body;
  if (!image) return res.status(400).json({ error: "image (base64) requise" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API Anthropic non configurée" });

  try {
    // Extraire le type MIME et les données base64
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Format image invalide" });

    const mediaType = match[1];
    const base64Data = match[2];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Data },
              },
              {
                type: "text",
                text: `Tu es un assistant technique spécialisé en VMC (Ventilation Mécanique Contrôlée) pour une entreprise de génie climatique au Luxembourg. Un intervenant terrain vient de prendre cette photo pendant une intervention.

Contexte de la question en cours : "${questionContext || "Diagnostic VMC"}"
${aideTexte ? `Aide technique associée : "${aideTexte}"` : ""}

Analyse cette photo en 2-3 phrases maximum. Sois concret et technique :
- Décris ce que tu vois de pertinent pour le diagnostic
- Si tu détectes un problème visible, signale-le clairement
- Si tu peux lire des informations (références, valeurs, marques), indique-les
- Si la photo est floue ou mal cadrée, dis-le pour que l'intervenant la reprenne

Réponds en français, de manière directe et professionnelle.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur Claude API:", response.status, errText);
      return res.status(500).json({ error: "Erreur lors de l'analyse IA" });
    }

    const data = await response.json();
    const analysisText = data.content?.[0]?.text || "Analyse non disponible.";
    res.json({ analysis: analysisText });
  } catch (err) {
    console.error("Erreur analyse photo:", err.message);
    res.status(500).json({ error: "Erreur de connexion au service IA" });
  }
});

// ─── Démarrage ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API VMC en écoute sur http://localhost:${PORT}`);
});