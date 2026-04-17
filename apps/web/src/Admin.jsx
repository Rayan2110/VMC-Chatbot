import { useState, useEffect } from "react";

// const API = import.meta.env.VITE_API_URL || "/api";
const API = window.location.hostname === "localhost"
  ? "/api"
  : "https://vmc-chatbot-api.onrender.com";
const MANAGER_CODE = "marques2026"; // mot de passe simple pour le POC

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Clé localStorage pour se souvenir de l'authentification pendant la session
const AUTH_KEY = "vmc_admin_auth";

// ═══ ROOT ADMIN PAGE ═════════════════════════════════════════
export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");

  if (!authed) {
    return <LoginScreen onOK={() => {
      sessionStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
    }} />;
  }

  return <AdminDashboard onLogout={() => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }} />;
}

// ═══ LOGIN ═════════════════════════════════════════════════════
function LoginScreen({ onOK }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    if (code === MANAGER_CODE) {
      onOK();
    } else {
      setErr("Code incorrect");
      setCode("");
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-icon">🔐</div>
        <h2>Accès Manager</h2>
        <p className="admin-login-sub">Entrez le code d'accès pour consulter le suivi des interventions.</p>
        <input
          type="password"
          className="admin-login-input"
          placeholder="Code d'accès…"
          value={code}
          onChange={(e) => { setCode(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {err && <div className="admin-login-err">{err}</div>}
        <button className="btn-primary-full" onClick={submit} disabled={!code}>
          Valider
        </button>
        <a href="/" className="admin-login-back">← Retour à l'application</a>
      </div>
    </div>
  );
}

// ═══ DASHBOARD ═════════════════════════════════════════════════
function AdminDashboard({ onLogout }) {
  const [stats, setStats] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [filters, setFilters] = useState({ statut: "", intervenantId: "", motif: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [intervenants, setIntervenants] = useState([]);

  useEffect(() => {
    loadData();
    api("/intervenants").then(setIntervenants);
  }, []);

  useEffect(() => {
    loadInterventions();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    const [s, list] = await Promise.all([
      api("/interventions-stats"),
      api("/interventions?pageSize=50"),
    ]);
    setStats(s);
    setInterventions(list.items);
    setLoading(false);
  }

  async function loadInterventions() {
    const params = new URLSearchParams();
    if (filters.statut) params.append("statut", filters.statut);
    if (filters.intervenantId) params.append("intervenantId", filters.intervenantId);
    if (filters.motif) params.append("motif", filters.motif);
    params.append("pageSize", "50");
    const list = await api(`/interventions?${params.toString()}`);
    setInterventions(list.items);
  }

  if (loading) return <div className="loading">Chargement du tableau de bord…</div>;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>Tableau de bord — Suivi des interventions</h1>
          <div className="admin-subtitle">Marques Confort · VMC Assistant</div>
        </div>
        <div className="admin-actions">
          <a href="/" className="admin-link">← Retour à l'application</a>
          <button className="admin-logout" onClick={onLogout}>Se déconnecter</button>
        </div>
      </header>

      {/* STATS */}
      <section className="admin-stats">
        <StatCard label="Total interventions" value={stats.total} color="blue" />
        <StatCard label="Terminées" value={stats.termine} color="green" />
        <StatCard label="Escaladées" value={stats.escalade} color="amber" />
        <StatCard label="En cours" value={stats.enCours} color="gray" />
        <StatCard label="Taux d'escalade" value={`${stats.tauxEscalade}%`} color="coral" />
      </section>

      <section className="admin-breakdown">
        <div className="admin-breakdown-card">
          <h3>Interventions par intervenant</h3>
          <ul>
            {stats.parIntervenant.map((p) => (
              <li key={p.intervenantId}>
                <span>{p.nom}</span>
                <strong>{p.count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="admin-breakdown-card">
          <h3>Interventions par motif</h3>
          <ul>
            {stats.parMotif.map((p) => (
              <li key={p.motif}>
                <span>{formatMotif(p.motif)}</span>
                <strong>{p.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FILTRES */}
      <section className="admin-filters">
        <h2>Interventions récentes</h2>
        <div className="admin-filters-row">
          <select value={filters.statut} onChange={(e) => setFilters({ ...filters, statut: e.target.value })}>
            <option value="">Tous statuts</option>
            <option value="EN_COURS">En cours</option>
            <option value="TERMINEE">Terminée</option>
            <option value="ESCALADEE">Escaladée</option>
          </select>
          <select value={filters.intervenantId} onChange={(e) => setFilters({ ...filters, intervenantId: e.target.value })}>
            <option value="">Tous intervenants</option>
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>
            ))}
          </select>
          <select value={filters.motif} onChange={(e) => setFilters({ ...filters, motif: e.target.value })}>
            <option value="">Tous motifs</option>
            <option value="ENTRETIEN">Entretien</option>
            <option value="DEPANNAGE">Dépannage</option>
            <option value="REMPLACEMENT">Remplacement</option>
            <option value="INSTALLATION">Installation</option>
          </select>
        </div>
      </section>

      {/* LISTE */}
      <section className="admin-list">
        <table className="admin-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Intervenant</th>
              <th>Client</th>
              <th>Motif</th>
              <th>Statut</th>
              <th>Données</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {interventions.length === 0 ? (
              <tr><td colSpan="8" className="admin-empty">Aucune intervention trouvée.</td></tr>
            ) : interventions.map((i) => (
              <tr key={i.id}>
                <td><strong>#{i.id}</strong></td>
                <td>{formatDate(i.dateCreation)}</td>
                <td>{i.intervenant.prenom} {i.intervenant.nom}</td>
                <td>{i.client.nom}</td>
                <td>{formatMotif(i.motif)}</td>
                <td><StatutBadge statut={i.statut} /></td>
                <td>
                  <span className="admin-count">
                    {i._count.reponses} 📝 · {i._count.captures} 📸 · {i._count.pieces} 🔧
                  </span>
                </td>
                <td>
                  <button className="admin-btn-detail" onClick={() => setSelectedId(i.id)}>
                    Voir détail →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* MODAL DÉTAIL */}
      {selectedId && <InterventionDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ═══ STAT CARD ═════════════════════════════════════════════════
function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ═══ STATUT BADGE ══════════════════════════════════════════════
function StatutBadge({ statut }) {
  const map = {
    EN_COURS: { label: "En cours", color: "gray" },
    TERMINEE: { label: "Terminée", color: "green" },
    ESCALADEE: { label: "Escaladée", color: "amber" },
    ANNULEE: { label: "Annulée", color: "red" },
  };
  const { label, color } = map[statut] || { label: statut, color: "gray" };
  return <span className={`statut-badge statut-${color}`}>{label}</span>;
}

// ═══ DÉTAIL INTERVENTION (Modal) ══════════════════════════════
function InterventionDetail({ id, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api(`/interventions/${id}`).then(setDetail);
  }, [id]);

  if (!detail) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="loading">Chargement…</div>
      </div>
    </div>
  );

  const duree = detail.dureeMinutes ||
    Math.round((new Date(detail.dateCloture || Date.now()).getTime() - new Date(detail.dateCreation).getTime()) / 60000);

  const reponsesAffichables = detail.reponses
    .filter((r) => !r.valeur.startsWith("[COMMENTAIRE]") && !r.valeur.startsWith("[ESCALADE]"));
  const commentaires = detail.reponses.filter((r) => r.valeur.startsWith("[COMMENTAIRE]"));
  const photos = detail.captures.filter((c) => c.type === "PHOTO");
  const mesures = detail.captures.filter((c) => c.type === "MESURE");
  const signatures = detail.captures.filter((c) => c.type === "SIGNATURE");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Intervention #{detail.id}</h2>
          <div className="modal-header-actions">
            <button className="modal-pdf-btn" onClick={() => window.print()} title="Exporter en PDF">
              📄 Exporter PDF
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-content" id="intervention-pdf-content">
          <div className="detail-section">
            <div className="detail-grid">
              <DetailItem label="Date" value={formatDate(detail.dateCreation)} />
              <DetailItem label="Intervenant" value={`${detail.intervenant.prenom} ${detail.intervenant.nom}`} />
              <DetailItem label="Client" value={detail.client.nom} />
              <DetailItem label="Adresse" value={detail.adresseSite} />
              <DetailItem label="Motif" value={formatMotif(detail.motif)} />
              <DetailItem label="Statut" value={<StatutBadge statut={detail.statut} />} />
              <DetailItem label="Durée" value={`${duree} min`} />
            </div>
          </div>

          {reponsesAffichables.length > 0 && (
            <div className="detail-section">
              <h3>📝 Diagnostic ({reponsesAffichables.length} étapes)</h3>
              <ul className="detail-list">
                {reponsesAffichables.map((r, i) => (
                  <li key={i}>
                    <span>{r.question?.libelle || `Question #${r.questionId}`}</span>
                    <strong>{formatValeur(r.valeur)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mesures.length > 0 && (
            <div className="detail-section">
              <h3>📏 Mesures ({mesures.length})</h3>
              <ul className="detail-list">
                {mesures.map((m, i) => (
                  <li key={i}>
                    <span>Mesure #{i + 1}</span>
                    <strong>{m.valeur} {m.unite}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {photos.length > 0 && (
            <div className="detail-section">
              <h3>📷 Photos ({photos.length})</h3>
              <div className="detail-photos">
                {photos.map((p, i) => (
                  <img key={i} src={p.valeur} alt={`Photo ${i + 1}`} className="detail-photo" />
                ))}
              </div>
            </div>
          )}

          {signatures.length > 0 && (
            <div className="detail-section">
              <h3>✍️ Signature</h3>
              <img src={signatures[0].valeur} alt="Signature" className="detail-signature" />
            </div>
          )}

          {commentaires.length > 0 && (
            <div className="detail-section">
              <h3>💬 Commentaires libres ({commentaires.length})</h3>
              {commentaires.map((c, i) => (
                <div key={i} className="detail-comment">
                  {c.valeur.replace("[COMMENTAIRE] ", "")}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <div className="detail-item-label">{label}</div>
      <div className="detail-item-value">{value}</div>
    </div>
  );
}

// ═══ FORMATTERS ════════════════════════════════════════════════
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMotif(m) {
  const map = {
    ENTRETIEN: "Entretien",
    DEPANNAGE: "Dépannage",
    REMPLACEMENT: "Remplacement",
    INSTALLATION: "Installation",
  };
  return map[m] || m;
}

function formatValeur(v) {
  const map = {
    oui: "Oui", non: "Non", saisi: "✓", signe: "✓",
    entretien: "Entretien", depannage: "Dépannage",
    remplacement: "Remplacement", installation: "Installation",
    ne_fonctionne_plus: "Ne fonctionne plus", bruit: "Bruit anormal",
    debit: "Débit insuffisant", humidite: "Humidité persistante",
    code_erreur: "Code erreur", vibration: "Vibration / claquement",
    sifflement: "Sifflement aérodynamique", grincement: "Grincement moteur",
    autre: "Autre", propres: "Propres", sales: "Sales", stub: "—",
  };
  return map[v] || v;
}