"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Section = "dashboard" | "players" | "formations" | "plays" | "games";

type Player = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  position: string | null;
  active: boolean;
};

type Formation = {
  id: string;
  user_id: string;
  name: string;
};

type Play = {
  id: string;
  user_id: string;
  name: string;
  play_type: string | null;
};

type Game = {
  id: string;
  user_id: string;
  week_label: string;
  opponent: string | null;
  game_date: string | null;
};

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  const [players, setPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");

  const [formationName, setFormationName] = useState("");

  const [playName, setPlayName] = useState("");
  const [playType, setPlayType] = useState("Run");

  const [weekLabel, setWeekLabel] = useState("");
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState("");

  const fullName = useMemo(() => {
    const first = user?.user_metadata?.first_name ?? "";
    const last = user?.user_metadata?.last_name ?? "";
    return `${first} ${last}`.trim() || user?.email || "Coach";
  }, [user]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    if (!user) return;

    const [playersRes, formationsRes, playsRes, gamesRes] = await Promise.all([
      supabase
        .from("coachboard_analytics_players")
        .select("*")
        .eq("user_id", user.id)
        .order("jersey_number", { ascending: true }),
      supabase
        .from("coachboard_analytics_formations")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("coachboard_analytics_plays")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("coachboard_analytics_games")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    setPlayers((playersRes.data ?? []) as Player[]);
    setFormations((formationsRes.data ?? []) as Formation[]);
    setPlays((playsRes.data ?? []) as Play[]);
    setGames((gamesRes.data ?? []) as Game[]);
  }

  async function addPlayer() {
    if (!user || !firstName.trim() || !lastName.trim()) return;
    setSaving(true);

    await supabase.from("coachboard_analytics_players").insert({
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      jersey_number: jerseyNumber.trim() || null,
      position: position.trim() || null,
      active: true,
    });

    setFirstName("");
    setLastName("");
    setJerseyNumber("");
    setPosition("");
    await loadAll();
    setSaving(false);
  }

  async function addFormation() {
    if (!user || !formationName.trim()) return;
    setSaving(true);

    await supabase.from("coachboard_analytics_formations").insert({
      user_id: user.id,
      name: formationName.trim(),
    });

    setFormationName("");
    await loadAll();
    setSaving(false);
  }

  async function addPlay() {
    if (!user || !playName.trim()) return;
    setSaving(true);

    await supabase.from("coachboard_analytics_plays").insert({
      user_id: user.id,
      name: playName.trim(),
      play_type: playType.trim() || null,
    });

    setPlayName("");
    setPlayType("Run");
    await loadAll();
    setSaving(false);
  }

  async function addGame() {
    if (!user || !weekLabel.trim()) return;
    setSaving(true);

    await supabase.from("coachboard_analytics_games").insert({
      user_id: user.id,
      week_label: weekLabel.trim(),
      opponent: opponent.trim() || null,
      game_date: gameDate || null,
    });

    setWeekLabel("");
    setOpponent("");
    setGameDate("");
    await loadAll();
    setSaving(false);
  }

  async function deleteRow(table: string, id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from(table).delete().eq("id", id);
    await loadAll();
  }

  if (loading) {
    return <main style={pageStyle}>Loading Analytics...</main>;
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <div style={heroCardStyle}>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={mutedStyle}>Please sign in through CoachBoard first.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={mutedStyle}>Built from your Excel stat system. Logged in as {fullName}.</p>
        </div>
        <Link href="/">Back to CoachBoard</Link>
      </header>

      <nav style={navStyle}>
        <NavButton label="Dashboard" active={activeSection === "dashboard"} onClick={() => setActiveSection("dashboard")} />
        <NavButton label="Players" active={activeSection === "players"} onClick={() => setActiveSection("players")} />
        <NavButton label="Formations" active={activeSection === "formations"} onClick={() => setActiveSection("formations")} />
        <NavButton label="Plays" active={activeSection === "plays"} onClick={() => setActiveSection("plays")} />
        <NavButton label="Games" active={activeSection === "games"} onClick={() => setActiveSection("games")} />
      </nav>

      {activeSection === "dashboard" && (
        <section style={gridStyle}>
          <DashboardCard title="Players" value={players.length} detail="Simple roster: name, number, position." onClick={() => setActiveSection("players")} />
          <DashboardCard title="Formations" value={formations.length} detail="Typed formations for stat entry only." onClick={() => setActiveSection("formations")} />
          <DashboardCard title="Plays" value={plays.length} detail="Run, pass, RPO, or custom play names." onClick={() => setActiveSection("plays")} />
          <DashboardCard title="Games" value={games.length} detail="Weeks/games from the Excel workflow." onClick={() => setActiveSection("games")} />
        </section>
      )}

      {activeSection === "players" && (
        <section style={cardStyle}>
          <SectionHeader title="Players" subtitle="Only the basics: first name, last name, jersey number, position." />
          <div style={formFourStyle}>
            <input style={inputStyle} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input style={inputStyle} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <input style={inputStyle} placeholder="Jersey #" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
            <input style={inputStyle} placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <button style={primaryButtonStyle} onClick={addPlayer} disabled={saving}>Add Player</button>

          <div style={tableStyle}>
            <div style={tableHeadStyle}>#</div>
            <div style={tableHeadStyle}>Name</div>
            <div style={tableHeadStyle}>Position</div>
            <div style={tableHeadStyle}>Action</div>
            {players.map((p) => (
              <React.Fragment key={p.id}>
                <div style={tableCellStyle}>{p.jersey_number || "-"}</div>
                <div style={tableCellStyle}>{p.first_name} {p.last_name}</div>
                <div style={tableCellStyle}>{p.position || "-"}</div>
                <div style={tableCellStyle}><button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_players", p.id)}>Delete</button></div>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {activeSection === "formations" && (
        <section style={cardStyle}>
          <SectionHeader title="Formations" subtitle="These are statistical labels only. They do not connect to drawn formations." />
          <div style={inlineFormStyle}>
            <input style={inputStyle} placeholder="Formation name" value={formationName} onChange={(e) => setFormationName(e.target.value)} />
            <button style={primaryButtonStyle} onClick={addFormation} disabled={saving}>Add Formation</button>
          </div>

          <div style={listStyle}>
            {formations.map((f) => (
              <div key={f.id} style={listRowStyle}>
                <span>{f.name}</span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_formations", f.id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "plays" && (
        <section style={cardStyle}>
          <SectionHeader title="Plays" subtitle="Typed play names from your system. No drawings attached." />
          <div style={formTwoStyle}>
            <input style={inputStyle} placeholder="Play name" value={playName} onChange={(e) => setPlayName(e.target.value)} />
            <select style={inputStyle} value={playType} onChange={(e) => setPlayType(e.target.value)}>
              <option>Run</option>
              <option>Pass</option>
              <option>RPO</option>
              <option>Screen</option>
              <option>Trick</option>
              <option>Other</option>
            </select>
          </div>
          <button style={primaryButtonStyle} onClick={addPlay} disabled={saving}>Add Play</button>

          <div style={listStyle}>
            {plays.map((p) => (
              <div key={p.id} style={listRowStyle}>
                <span>{p.name} <span style={tagStyle}>{p.play_type || "Other"}</span></span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_plays", p.id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "games" && (
        <section style={cardStyle}>
          <SectionHeader title="Games" subtitle="Start with the same Week 1, Week 2, Week 3 style as the Excel tabs." />
          <div style={formThreeStyle}>
            <input style={inputStyle} placeholder="Week 1" value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} />
            <input style={inputStyle} placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
            <input style={inputStyle} type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
          <button style={primaryButtonStyle} onClick={addGame} disabled={saving}>Add Game</button>

          <div style={listStyle}>
            {games.map((g) => (
              <div key={g.id} style={listRowStyle}>
                <span>{g.week_label}{g.opponent ? ` - ${g.opponent}` : ""}{g.game_date ? ` (${g.game_date})` : ""}</span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_games", g.id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...navButtonStyle, ...(active ? navButtonActiveStyle : {}) }}>
      {label}
    </button>
  );
}

function DashboardCard({ title, value, detail, onClick }: { title: string; value: number; detail: string; onClick: () => void }) {
  return (
    <button style={dashboardCardStyle} onClick={onClick}>
      <div style={dashboardTitleStyle}>{title}</div>
      <div style={dashboardValueStyle}>{value}</div>
      <div style={mutedStyle}>{detail}</div>
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
      <p style={mutedStyle}>{subtitle}</p>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(220,38,38,.22), transparent 30%), #020617",
  color: "white",
  padding: 24,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "8vh auto",
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 24px 70px rgba(0,0,0,.45)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: ".16em",
};

const titleStyle: React.CSSProperties = {
  fontSize: 42,
  lineHeight: 1,
  margin: "8px 0 10px",
  fontWeight: 950,
};

const mutedStyle: React.CSSProperties = {
  color: "#9ca3af",
  margin: "6px 0 0",
};

const backButtonStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(180deg, #1f2937, #020617)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 14,
  padding: "11px 14px",
  fontWeight: 900,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 20,
};

const navButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 14,
  padding: "11px 14px",
  background: "rgba(15,23,42,.85)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const navButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #ef4444, #991b1b)",
  border: "1px solid rgba(248,113,113,.9)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
};

const dashboardCardStyle: React.CSSProperties = {
  textAlign: "left",
  color: "white",
  background: "rgba(15,23,42,.92)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 22,
  padding: 20,
  cursor: "pointer",
  boxShadow: "0 18px 48px rgba(0,0,0,.35)",
};

const dashboardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 950,
  color: "#fca5a5",
};

const dashboardValueStyle: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 950,
  marginTop: 6,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 18px 48px rgba(0,0,0,.42)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#020617",
  color: "white",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "11px 15px",
  borderRadius: 13,
  border: "1px solid rgba(248,113,113,.9)",
  background: "linear-gradient(180deg, #ef4444, #991b1b)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,.4)",
  background: "rgba(127,29,29,.45)",
  color: "#fecaca",
  fontWeight: 850,
  cursor: "pointer",
};

const formFourStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const formThreeStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
};

const formTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const inlineFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 10,
  alignItems: "start",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 18,
};

const listRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 13px",
  borderRadius: 14,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.08)",
};

const tableStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1fr 140px 100px",
  marginTop: 18,
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHeadStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.08)",
  padding: "10px 12px",
  fontWeight: 950,
  color: "#fca5a5",
};

const tableCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid rgba(255,255,255,.08)",
};

const tagStyle: React.CSSProperties = {
  marginLeft: 8,
  color: "#fecaca",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};
