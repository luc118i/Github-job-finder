import { useState } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

async function callClaude(messages, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await response.json();
  return data.content
    .map((i) => (i.type === "text" ? i.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function fetchGitHubProfile(username) {
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`),
    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=20`),
  ]);
  if (!userRes.ok) throw new Error("Usuário não encontrado no GitHub");
  const user = await userRes.json();
  const repos = reposRes.ok ? await reposRes.json() : [];
  return { user, repos };
}

function extractSkills(repos) {
  const langCount = {};
  for (const repo of repos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
    }
  }
  return Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

function JobCard({ job, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="job-card"
      style={{
        animationDelay: `${index * 80}ms`,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="job-header">
        <div className="job-meta">
          <span className="job-title">{job.title}</span>
          <span className="job-company">{job.company}</span>
        </div>
        <div className="job-badges">
          {job.remote && <span className="badge remote">Remote</span>}
          {job.level && <span className="badge level">{job.level}</span>}
          <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      <div className="job-skills">
        {(job.skills || []).map((s) => (
          <span key={s} className="skill-tag">{s}</span>
        ))}
      </div>
      {expanded && (
        <div className="job-details">
          <p>{job.description}</p>
          {job.salary && <p className="salary">💰 {job.salary}</p>}
          {job.link && (
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="apply-btn"
            >
              Ver vaga →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("idle"); // idle | profile | jobs
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function handleSearch() {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    setJobs([]);
    setProfile(null);
    setStep("profile");

    try {
      const { user, repos } = await fetchGitHubProfile(username.trim());
      const skills = extractSkills(repos);
      const topRepos = repos
        .filter((r) => !r.fork)
        .slice(0, 5)
        .map((r) => r.name)
        .join(", ");

      setProfile({ user, repos, skills });
      setStep("jobs");

      const profileSummary = `
GitHub: ${user.login}
Nome: ${user.name || user.login}
Bio: ${user.bio || "N/A"}
Linguagens principais: ${skills.slice(0, 6).join(", ")}
Repositórios em destaque: ${topRepos}
Seguidores: ${user.followers}
      `.trim();

      const jobsRaw = await callClaude(
        [
          {
            role: "user",
            content: `Analise este perfil do GitHub e encontre 6 vagas de emprego reais e relevantes para este desenvolvedor. Pesquise vagas atuais em sites como LinkedIn, Glassdoor, ou similar.

PERFIL:
${profileSummary}

Retorne APENAS um JSON válido (sem markdown), array com exatamente 6 objetos:
[{
  "title": "título da vaga",
  "company": "empresa",
  "level": "Junior|Pleno|Senior",
  "remote": true/false,
  "skills": ["skill1", "skill2"],
  "description": "descrição em 2 linhas",
  "salary": "faixa salarial ou null",
  "link": "url da vaga ou null"
}]`,
          },
        ],
        "Você é um especialista em recrutamento tech. Sempre responda APENAS com JSON válido, sem texto antes ou depois, sem markdown."
      );

      try {
        const clean = jobsRaw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setJobs(Array.isArray(parsed) ? parsed : []);
      } catch {
        setError("Não foi possível processar as vagas. Tente novamente.");
      }
    } catch (e) {
      setError(e.message || "Erro ao buscar perfil.");
    } finally {
      setLoading(false);
    }
  }

  const levels = ["all", "Junior", "Pleno", "Senior"];
  const filteredJobs =
    filter === "all" ? jobs : jobs.filter((j) => j.level === filter);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          color: #e8e4dc;
          font-family: 'DM Mono', monospace;
          min-height: 100vh;
        }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .bg-grid {
          position: fixed;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .bg-blob {
          position: fixed;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          opacity: 0.15;
        }
        .blob1 { background: #7c3aed; top: -200px; right: -100px; }
        .blob2 { background: #06b6d4; bottom: -200px; left: -100px; }

        header {
          padding: 48px 48px 32px;
          position: relative;
          z-index: 1;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .logo {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #7c3aed;
          margin-bottom: 4px;
        }

        .tagline {
          font-size: 11px;
          color: rgba(232,228,220,0.4);
          letter-spacing: 0.05em;
        }

        main {
          flex: 1;
          padding: 48px;
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
        }

        .hero {
          margin-bottom: 48px;
        }

        h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 5vw, 64px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }

        .accent { color: #7c3aed; }
        .accent2 { color: #06b6d4; }

        .subtitle {
          font-size: 13px;
          color: rgba(232,228,220,0.5);
          line-height: 1.6;
          max-width: 480px;
        }

        .search-wrapper {
          margin-top: 40px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .search-bar {
          display: flex;
          gap: 0;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          transition: border-color 0.2s;
        }

        .search-bar:focus-within {
          border-color: #7c3aed;
        }

        .prefix {
          padding: 16px 12px;
          font-size: 12px;
          color: rgba(232,228,220,0.3);
          border-right: 1px solid rgba(255,255,255,0.1);
          white-space: nowrap;
          display: flex;
          align-items: center;
        }

        .search-bar input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          padding: 16px 14px;
          font-family: 'DM Mono', monospace;
          font-size: 15px;
          color: #e8e4dc;
        }

        .search-bar input::placeholder { color: rgba(232,228,220,0.2); }

        .search-btn {
          background: #7c3aed;
          border: none;
          color: white;
          width: 100%;
          padding: 14px 28px;
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
          letter-spacing: 0.05em;
          border-radius: 4px;
        }

        .search-btn:hover:not(:disabled) { background: #6d28d9; }
        .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .error-msg {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 4px;
          font-size: 13px;
          color: #fca5a5;
        }

        .loading-bar {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .loading-step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: rgba(232,228,220,0.5);
          letter-spacing: 0.05em;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7c3aed;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }

        .profile-card {
          margin-top: 40px;
          padding: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 4px;
          background: rgba(255,255,255,0.02);
          display: flex;
          gap: 24px;
          align-items: flex-start;
          animation: fadeUp 0.4s ease forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid rgba(124,58,237,0.4);
          flex-shrink: 0;
        }

        .profile-info h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .profile-info .handle {
          font-size: 12px;
          color: rgba(232,228,220,0.4);
          margin-bottom: 12px;
        }

        .profile-info .bio {
          font-size: 12px;
          color: rgba(232,228,220,0.6);
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .skills-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .skill-chip {
          padding: 3px 10px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.3);
          border-radius: 2px;
          font-size: 11px;
          color: #c4b5fd;
          letter-spacing: 0.05em;
        }

        .jobs-section {
          margin-top: 48px;
          animation: fadeUp 0.4s ease forwards;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(232,228,220,0.4);
        }

        .filter-tabs {
          display: flex;
          gap: 4px;
        }

        .filter-tab {
          padding: 4px 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: rgba(232,228,220,0.4);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          border-radius: 2px;
          transition: all 0.15s;
          letter-spacing: 0.05em;
        }

        .filter-tab.active {
          background: rgba(124,58,237,0.2);
          border-color: #7c3aed;
          color: #c4b5fd;
        }

        .jobs-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .job-card {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 4px;
          padding: 20px 24px;
          background: rgba(255,255,255,0.02);
          transition: border-color 0.2s, background 0.2s;
          animation: fadeUp 0.4s ease both;
        }

        .job-card:hover {
          border-color: rgba(124,58,237,0.4);
          background: rgba(255,255,255,0.04);
        }

        .job-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 16px;
        }

        .job-meta { display: flex; flex-direction: column; gap: 4px; }

        .job-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #e8e4dc;
        }

        .job-company {
          font-size: 12px;
          color: rgba(232,228,220,0.4);
        }

        .job-badges {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-shrink: 0;
        }

        .badge {
          padding: 3px 8px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .badge.remote {
          background: rgba(6,182,212,0.15);
          border: 1px solid rgba(6,182,212,0.3);
          color: #67e8f9;
        }

        .badge.level {
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.3);
          color: #c4b5fd;
        }

        .expand-icon {
          font-size: 10px;
          color: rgba(232,228,220,0.3);
          padding: 4px;
        }

        .job-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 4px;
        }

        .skill-tag {
          padding: 2px 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2px;
          font-size: 11px;
          color: rgba(232,228,220,0.5);
        }

        .job-details {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          color: rgba(232,228,220,0.6);
          line-height: 1.6;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .salary {
          font-size: 12px;
          color: #86efac;
        }

        .apply-btn {
          align-self: flex-start;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid rgba(124,58,237,0.5);
          color: #c4b5fd;
          text-decoration: none;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          border-radius: 2px;
          transition: all 0.15s;
        }

        .apply-btn:hover {
          background: rgba(124,58,237,0.2);
          border-color: #7c3aed;
        }

        .empty {
          text-align: center;
          padding: 48px;
          color: rgba(232,228,220,0.3);
          font-size: 13px;
        }
      `}</style>

      <div className="app">
        <div className="bg-grid" />
        <div className="bg-blob blob1" />
        <div className="bg-blob blob2" />

        <header>
          <div className="logo">JobFinder</div>
          <div className="tagline">powered by github × claude ai</div>
        </header>

        <main>
          <div className="hero">
            <h1>
              Vagas feitas<br />
              para o seu <span className="accent">código</span>
            </h1>
            <p className="subtitle">
              Insira seu usuário do GitHub. A IA analisa seus repositórios, 
              linguagens e projetos — e encontra vagas que combinam com você.
            </p>

            <div className="search-wrapper">
              <div className="search-bar">
                <span className="prefix">github.com/</span>
                <input
                  type="text"
                  placeholder="seu-usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={loading}
                />
              </div>
              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={loading || !username.trim()}
              >
                {loading ? "buscando..." : "→ buscar vagas"}
              </button>
            </div>

            {error && <div className="error-msg">⚠ {error}</div>}

            {loading && (
              <div className="loading-bar">
                <div className="loading-step">
                  <div className="dot" />
                  analisando perfil do github
                </div>
                {step === "jobs" && (
                  <div className="loading-step" style={{ animationDelay: "0.3s" }}>
                    <div className="dot" style={{ animationDelay: "0.2s" }} />
                    buscando vagas compatíveis com ia
                  </div>
                )}
              </div>
            )}
          </div>

          {profile && (
            <div className="profile-card">
              <img
                className="avatar"
                src={profile.user.avatar_url}
                alt={profile.user.login}
              />
              <div className="profile-info">
                <h2>{profile.user.name || profile.user.login}</h2>
                <div className="handle">
                  @{profile.user.login} · {profile.user.followers} seguidores ·{" "}
                  {profile.repos.length} repositórios
                </div>
                {profile.user.bio && (
                  <div className="bio">{profile.user.bio}</div>
                )}
                <div className="skills-row">
                  {profile.skills.slice(0, 8).map((s) => (
                    <span key={s} className="skill-chip">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {jobs.length > 0 && (
            <div className="jobs-section">
              <div className="section-header">
                <span className="section-title">
                  {filteredJobs.length} vagas encontradas
                </span>
                <div className="filter-tabs">
                  {levels.map((l) => (
                    <button
                      key={l}
                      className={`filter-tab ${filter === l ? "active" : ""}`}
                      onClick={() => setFilter(l)}
                    >
                      {l === "all" ? "todos" : l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="jobs-grid">
                {filteredJobs.length === 0 ? (
                  <div className="empty">Nenhuma vaga para este filtro.</div>
                ) : (
                  filteredJobs.map((job, i) => (
                    <JobCard key={i} job={job} index={i} />
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
