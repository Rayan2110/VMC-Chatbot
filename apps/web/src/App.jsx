import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

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
      "urgent", "urgence", "danger", "dangereux",
      "brûlé", "brulé", "brule",
      "fumée", "fumee", "fuite gaz", "odeur gaz", "court-circuit", "court circuit",
      "électrocution", "electrocution", "choc électrique", "choc electrique",
      "feu", "flamme", "étincelle", "etincelle",
      "danger immédiat", "danger immediat", "risque sécurité", "risque securite",
      "ça sent", "ca sent", "odeur bizarre",
      "carbonisé", "carbonise", "ça chauffe trop", "ca chauffe trop",
      "brûlant au toucher", "brulant au toucher",
    ],
  },
  {
    code: "ESCALADE",
    motsCles: [
      "escalader", "escalade", "remonter", "manager", "responsable", "chef",
      "litige", "conflit", "refus", "refuse", "bloqué", "bloque", "impossible",
      "je ne peux pas", "ne peux pas", "pas possible", "besoin aide",
      "besoin d'aide", "problème client", "probleme client", "mécontent",
      "mecontent", "plainte", "réclamation", "reclamation",
    ],
  },
  {
    code: "CLIENT_ABSENT",
    motsCles: [
      "client absent", "pas de client", "personne", "pas sur place", "pas là",
      "pas la", "absent", "vide", "fermé", "ferme", "injoignable",
      "ne répond pas", "ne repond pas", "porte fermée", "porte fermee",
    ],
  },
  {
    code: "ACCES",
    motsCles: [
      "accès", "acces", "inaccessible", "pas d'accès", "pas acces", "trappe",
      "clé", "cle", "code", "syndic", "gardien", "digicode", "interphone",
      "portail", "condamné", "condamne", "coincé", "coince", "bloquée",
      "bloquee", "ouvrir", "ouverture",
    ],
  },
  {
    code: "PIECE",
    motsCles: [
      "pièce", "piece", "pieces", "pièces", "commander", "commande",
      "référence", "reference", "ref ", "pas en stock", "rupture",
      "approvisionnement", "appro", "fournisseur", "matériel", "materiel",
      "moteur", "condensateur", "filtre", "courroie", "gaine", "bouche",
      "à remplacer", "a remplacer", "remplacement", "neuf",
      "grillé", "grille", "grillée",
      "hs", "h.s.", "hors service",
      "cramé", "crame", "cassé", "casse",
      "défectueux", "defectueux", "défectueuse", "defectueuse",
      "mort", "morte", "foutu", "foutue",
    ],
  },
  {
    code: "SUITES",
    motsCles: [
      "revenir", "repasser", "retour", "reviens", "revienne", "à prévoir",
      "a prevoir", "à faire", "a faire", "pas fini", "incomplet", "partiel",
      "suites", "suite", "reste à faire", "reste a faire", "terminer",
      "finir", "à finaliser", "a finaliser", "plus tard", "deuxième passage",
      "deuxieme passage", "2e passage", "re-intervention", "réintervention",
      "reintervention",
    ],
  },
  {
    code: "DEVIS",
    motsCles: [
      "devis", "chiffrer", "chiffrage", "estimation", "estimer", "prix",
      "budget", "coût", "cout", "facture", "tarif", "proposition commerciale",
      "proposition", "offre",
    ],
  },
  {
    code: "RDV",
    motsCles: [
      "rendez-vous", "rendez vous", "rdv", "demain", "après-demain",
      "apres-demain", "apres demain", "semaine prochaine", "la semaine pro",
      "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
      "planifier", "reprogrammer", "reporter", "autre jour", "autre date",
      "caler", "recaler",
    ],
  },
  {
    code: "DIAGNOSTIC",
    motsCles: [
      "diagnostic", "diagnostique", "analyse", "analyser", "tester", "test",
      "vérifier", "verifier", "vérifie", "verifie", "vérifié", "verifie",
      "contrôler", "controler", "contrôle", "controle",
      "inspection", "inspecter", "inspecte", "mesurer", "mesure",
      "observer", "observe", "constat", "constater", "constate",
      "anomalie", "défaut", "defaut", "dysfonctionnement", "panne",
      "symptôme", "symptome",
    ],
  },
  {
    code: "POSITIF",
    motsCles: [
      "ok", "bien", "bon", "parfait", "nickel", "top", "correct", "conforme",
      "opérationnel", "operationnel", "fonctionne", "marche", "en ordre",
      "résolu", "resolu", "réglé", "regle", "terminé", "termine", "fini",
      "rien à signaler", "rien a signaler", "ras",
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
// Chaque question numérique peut avoir des seuils : { min, max, normeMin, normeMax }
// Les interprétations génèrent des messages contextualisés (OK / alerte / hors norme).
const SEUILS_MESURES = {
  VMC_DEP_NF_DEBIT_FINAL: {
    normeMin: 30,
    messageOK: (v) => `✅ Débit ${v} m³/h conforme (norme : ≥ 30 m³/h en SDB).`,
    messageBas: (v) => `⚠️ Débit ${v} m³/h en dessous de la norme (≥ 30 m³/h requis). Vérifier bouches et gaines.`,
  },
  VMC_DEP_DEBIT_MESURE_INIT: {
    normeMin: 30,
    messageOK: (v) => `✅ Débit ${v} m³/h déjà conforme (≥ 30 m³/h). Vérifier tout de même l'installation.`,
    messageBas: (v) => `⚠️ Débit ${v} m³/h insuffisant. Cause probable : bouches encrassées ou gaines obstruées.`,
  },
  VMC_DEP_DEBIT_MESURE_FIN: {
    normeMin: 30,
    messageOK: (v) => `✅ Débit final ${v} m³/h : intervention efficace, norme respectée.`,
    messageBas: (v) => `⚠️ Débit final ${v} m³/h toujours insuffisant. Escalade possible si pas d'amélioration.`,
  },
  VMC_DEP_HUM_DEBIT: {
    normeMin: 30,
    messageOK: (v) => `✅ Débit ${v} m³/h correct en pièce humide.`,
    messageBas: (v) => `⚠️ Débit ${v} m³/h trop faible pour une pièce humide (≥ 30 m³/h requis).`,
  },
  VMC_DEP_NF_CONDO: {
    min: 2, max: 10,
    messageOK: (v) => `✅ ${v} µF : valeur dans la plage normale (2 à 10 µF typique).`,
    messageBas: (v) => `⚠️ ${v} µF : valeur faible, condensateur probablement HS. Remplacement recommandé.`,
    messageHaut: (v) => `⚠️ ${v} µF : valeur anormalement élevée. Vérifier la référence du condensateur.`,
  },
};

function interpreterMesure(questionCode, valeur) {
  const seuils = SEUILS_MESURES[questionCode];
  if (!seuils) return null;
  const v = parseFloat(valeur);
  if (isNaN(v)) return null;

  if (seuils.normeMin !== undefined) {
    return v >= seuils.normeMin ? seuils.messageOK(v) : seuils.messageBas(v);
  }
  if (seuils.min !== undefined && seuils.max !== undefined) {
    if (v < seuils.min) return seuils.messageBas(v);
    if (v > seuils.max) return seuils.messageHaut(v);
    return seuils.messageOK(v);
  }
  return null;
}

// ═══ ROOT ═════════════════════════════════════════════════════
export default function App() {
  const [intervenants, setIntervenants] = useState([]);
  const [clients, setClients] = useState([]);
  const [intervenantId, setIntervenantId] = useState(null);

  useEffect(() => {
    api("/intervenants").then(setIntervenants);
    api("/clients").then(setClients);
  }, []);

  if (!intervenants.length) return <div className="loading">Chargement…</div>;

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
    addBot(`Bonjour ${intervenant.prenom} 👋 On va démarrer une nouvelle intervention.`);
    setTimeout(() => addBot("Pour quel client ?"), 400);
  }, []);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  function addBot(content, opts = {}) {
    setMessages((m) => [...m, { id: Date.now() + Math.random(), side: "bot", content, ...opts }]);
  }
  function addUser(content, opts = {}) {
    setMessages((m) => [...m, { id: Date.now() + Math.random(), side: "user", content, ...opts }]);
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
    const firstQ = await api("/questions/first");
    const interv = await api("/interventions", {
      method: "POST",
      body: {
        intervenantId: intervenant.id,
        clientId,
        adresseSite: adresseFinale,
        motif: "DEPANNAGE",
      },
    });
    setIntervention(interv);
    setTimeout(() => {
      afficheQuestion(firstQ);
      setPhase("parcours");
    }, 500);
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
    addBot("Récap validé. Dernière étape : signature du client.");
    addBot(currentQuestion.libelle, {
      aideTexte: currentQuestion.aideTexte,
      captureObligatoire: currentQuestion.captureObligatoire,
    });
  }

  async function repondreChoix(reponse) {
    addUser(reponse.libelle);
    const result = await api(`/interventions/${intervention.id}/reponses`, {
      method: "POST",
      body: { questionId: currentQuestion.id, valeur: reponse.valeur, reponsePossibleId: reponse.id },
    });
    gereSuite(result);
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
    setTimeout(() => addBot("Photo reçue ✓ Vous pouvez répondre à la question maintenant."), 300);
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
        addBot("🚨 Attention, votre commentaire signale une urgence ou un risque sécurité. Je recommande :");
        addBot("• Couper l'alimentation électrique et gaz si applicable\n• Mettre la zone en sécurité\n• Contacter immédiatement le manager avant de poursuivre");
        actions = [
          { label: "🚨 Escalader immédiatement", onClick: () => escaladerIntervention("Urgence sécurité signalée") },
          { label: "📸 Prendre photo de la zone", onClick: () => forcerPhoto() },
          { label: "↩ Continuer le parcours", onClick: () => clearActions() },
        ];
        break;

      case "ESCALADE":
        addBot("⚠️ Situation à remonter au manager. Que souhaitez-vous faire ?");
        actions = [
          { label: "📢 Escalader maintenant", onClick: () => escaladerIntervention("Escalade demandée par l'intervenant") },
          { label: "📝 Noter et continuer", onClick: () => clearActions() },
        ];
        break;

      case "SUITES":
        addBot("📌 Noté, cette intervention a des suites à donner. Pensez à préciser le reste à faire et l'échéance.");
        actions = [
          { label: "📅 Planifier un retour", onClick: () => demanderDetails("Détaillez la date/semaine du retour prévu") },
          { label: "📝 Noter le reste à faire", onClick: () => demanderDetails("Détaillez ce qui reste à faire") },
          { label: "↩ Continuer le parcours", onClick: () => clearActions() },
        ];
        break;

      case "PIECE":
        addBot("🔧 Pièce ou matériel à prévoir. Quelle action ?");
        actions = [
          { label: "📝 Noter la référence", onClick: () => demanderDetails("Indiquez référence, quantité et délai") },
          { label: "📞 Vérifier stock Fetz", onClick: () => demanderDetails("Notez la demande de vérif stock au dépôt Fetz") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "RDV":
        addBot("📅 Un rendez-vous ultérieur est mentionné. Pensez à le caler avec le client et à me donner la date en clôture.");
        actions = [
          { label: "📆 Détailler le RDV proposé", onClick: () => demanderDetails("Indiquez la date et l'horaire du RDV proposé") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "CLIENT_ABSENT":
        addBot("👤 Client non disponible sur place. Que faites-vous ?");
        actions = [
          { label: "▶ Poursuivre l'intervention", onClick: () => clearActions() },
          { label: "🔄 Reprogrammer la visite", onClick: () => escaladerIntervention("Client absent - reprogrammation requise") },
        ];
        break;

      case "ACCES":
        addBot("🚪 Problème d'accès signalé. Quelle suite donner ?");
        actions = [
          { label: "📝 Noter la cause", onClick: () => demanderDetails("Détaillez la cause (trappe condamnée, clé manquante...)") },
          { label: "📞 Contacter syndic/gardien", onClick: () => demanderDetails("Notez la démarche à faire auprès du syndic ou gardien") },
          { label: "🔄 Reprogrammer", onClick: () => escaladerIntervention("Accès impossible - reprogrammation") },
        ];
        break;

      case "DIAGNOSTIC":
        addBot("🔍 Diagnostic technique en cours. Continuez à documenter les constats, photos et mesures au fur et à mesure.");
        actions = [
          { label: "📸 Ajouter une photo", onClick: () => forcerPhoto() },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "DEVIS":
        addBot("💶 Devis mentionné. Pensez à détailler les travaux à chiffrer.");
        actions = [
          { label: "📝 Détailler les travaux", onClick: () => demanderDetails("Listez les travaux à chiffrer dans le devis") },
          { label: "↩ Continuer", onClick: () => clearActions() },
        ];
        break;

      case "POSITIF":
        addBot("👍 Noté. Continuez l'intervention quand vous êtes prêt.");
        break;

      default:
        addBot("✓ Commentaire enregistré avec l'intervention. Vous pouvez continuer.");
    }

    setActionsContextuelles(actions);
  }

  function clearActions() {
    setActionsContextuelles(null);
    addBot("Reprenons le parcours.");
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
      await fetch(`/api/interventions/${intervention.id}/escalader`, { method: "POST" }).catch(() => {});
    }
    addBot(`⚠️ Intervention escaladée au manager. Motif : "${motif}". Notification envoyée.`);
    setPhase("termine");
  }

  function gereSuite(result) {
    setTimeout(() => {
      if (result.done) {
        if (result.action === "CLOTURE") {
          addBot("✅ Intervention clôturée. Merci, toutes les données ont été enregistrées.");
        } else if (result.action === "ESCALADE") {
          addBot("⚠️ Cette intervention nécessite une remontée manager. Notification envoyée.");
        }
        setPhase("termine");
      } else {
        afficheQuestion(result.question);
      }
    }, 500);
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
      addBot(`Bonjour ${intervenant.prenom} 👋 On démarre une nouvelle intervention.`);
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
            addBot("Vous revenez au parcours. Cliquez ci-dessous pour passer à la signature quand vous êtes prêt.");
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
function Bubble({ side, children, captureObligatoire, aideTexte, photoUrl, signatureUrl }) {
  return (
    <div className={`bubble-row ${side}`}>
      {side === "bot" && <div className="bubble-avatar">VM</div>}
      <div className={`bubble ${side}`}>
        {children && <div className="bubble-text">{children}</div>}
        {aideTexte && <div className="bubble-help">💡 {aideTexte}</div>}
        {captureObligatoire && (
          <div className="bubble-capture-note">
            {captureLabels[captureObligatoire]?.icon} {captureLabels[captureObligatoire]?.label}
          </div>
        )}
        {photoUrl && <img src={photoUrl} alt="capture" className="bubble-photo" />}
        {signatureUrl && <img src={signatureUrl} alt="signature" className="bubble-signature" />}
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