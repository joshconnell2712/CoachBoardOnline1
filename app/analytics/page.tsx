"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Section = "home" | "players" | "formations" | "plays" | "games";

type Player = {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  position: string | null;
};

type Formation = {
  id: string;
  name: string;
};

type Play = {
  id: string;
  name: string;
  play_type: string | null;
};

type Game = {
  id: string;
  week_label: string;
  opponent: string | null;
  game_date: string | null;
};

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
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
        .select("id, first_name, last_name, jersey_number, position")
        .eq("user_id", user.id)
        .order("jersey_number", { ascending: true }),

      supabase
        .from("coachboard_analytics_formations")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      supabase
        .from("coachboard_analytics_plays")
        .select("id, name, play_type")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      supabase
        .from("coachboard_analytics_games")
        .select("id, week_label, opponent, game_date")
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
    await supabase.from(table).delete().eq("id", id);
    await loadAll();
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <div style={eyebrowStyle}>COACHBOARD</div>
        <h1 style={titleStyle}>Analytics</h1>
        <p style={subTitleStyle}>Please sign in through CoachBoard first.</p>
        <Link href="/" style={backButtonStyle}>
          Back to CoachBoard
        </Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={subTitleStyle}>Game Analysis • Team Statistics • Tendencies</p>
        </div>

        <Link href="/" style={backButtonStyle}>
          Back to CoachBoard
        </Link>
      </header>

      <nav style={navStyle}>
        <NavButton label="Home" active={activeSection === "home"} onClick={() => setActiveSection("home")} />
        <NavButton label="Players" active={activeSection === "players"} onClick={() => setActiveSection("players")} />
        <NavButton label="Formations" active={activeSection === "formations"} onClick={() => setActiveSection("formations")} />
        <NavButton label="Plays" active={activeSection === "plays"} onClick={() => setActiveSection("plays")} />
        <NavButton label="Games" active={activeSection === "games"} onClick={() => setActiveSection("games")} />
      </nav>

      {activeSection === "home" && (
        <section style={gridStyle}>
          <HomeCard title="Players" count={`${players.length} Players`} onClick={() => setActiveSection("players")} />
          <HomeCard title="Formations" count={`${formations.length} Formations`} onClick={() => setActiveSection("formations")} />
          <HomeCard title="Plays" count={`${plays.length} Plays`} onClick={() => setActiveSection("plays")} />
          <HomeCard title="Games" count={`${games.length} Games`} onClick={() => setActiveSection("games")} />
        </section>
      )}

      {activeSection === "players" && (
        <section style={cardStyle}>
          <h2>Players</h2>

          <div style={formFourStyle}>
            <input style={inputStyle} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input style={inputStyle} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <input style={inputStyle} placeholder="Jersey #" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
            <input style={inputStyle} placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>

          <button style={primaryButtonStyle} onClick={addPlayer} disabled={saving}>
            Add Player
          </button>

          <div style={listStyle}>
            {players.map((p) => (
              <div key={p.id} style={listRowStyle}>
                <span>
                  #{p.jersey_number || "-"} {p.first_name} {p.last_name} {p.position ? `- ${p.position}` : ""}
                </span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_players", p.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "formations" && (
        <section style={cardStyle}>
          <h2>Formations</h2>

          <div style={inlineFormStyle}>
            <input style={inputStyle} placeholder="Formation name" value={formationName} onChange={(e) => setFormationName(e.target.value)} />
            <button style={primaryButtonStyleNoMargin} onClick={addFormation} disabled={saving}>
              Add Formation
            </button>
          </div>

          <div style={listStyle}>
            {formations.map((f) => (
              <div key={f.id} style={listRowStyle}>
                <span>{f.name}</span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_formations", f.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "plays" && (
        <section style={cardStyle}>
          <h2>Plays</h2>

          <div style={formTwoStyle}>
            <input style={inputStyle} placeholder="Play name" value={playName} onChange={(e) => setPlayName(e.target.value)} />
            <select style={inputStyle} value={playType} onChange={(e) => setPlayType(e.target.value)}>
              <option value="Run">Run</option>
              <option value="Pass">Pass</option>
              <option value="RPO">RPO</option>
              <option value="Screen">Screen</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button style={primaryButtonStyle} onClick={addPlay} disabled={saving}>
            Add Play
          </button>

          <div style={listStyle}>
            {plays.map((p) => (
              <div key={p.id} style={listRowStyle}>
                <span>
                  {p.name} <span style={tagStyle}>{p.play_type || "Other"}</span>
                </span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_plays", p.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === "games" && (
        <section style={cardStyle}>
          <h2>Games</h2>

          <div style={formThreeStyle}>
            <input style={inputStyle} placeholder="Week 1" value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} />
            <input style={inputStyle} placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
            <input style={inputStyle} type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>

          <button style={primaryButtonStyle} onClick={addGame} disabled={saving}>
            Add Game
          </button>

          <div style={listStyle}>
            {games.map((g) => (
              <div key={g.id} style={listRowStyle}>
                <span>
                  {g.week_label}
                  {g.opponent ? ` - ${g.opponent}` : ""}
                  {g.game_date ? ` (${g.game_date})` : ""}
                </span>
                <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_games", g.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ ...navButtonStyle, ...(active ? navButtonActiveStyle : {}) }}>
      {label}
    </button>
  );
}

function HomeCard({
  title,
  count,
  onClick,
}: {
  title: string;
  count: string;
  onClick: () => void;
}) {
  return (
    <button style={homeCardStyle} onClick={onClick}>
      <div style={homeCardTitleStyle}>{title}</div>
      <div style={homeCardCountStyle}>{count}</div>
    </button>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(220,38,38,.22), transparent 32%), #020617",
  color: "white",
  padding: 28,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 22,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: ".18em",
};

const titleStyle: React.CSSProperties = {
  fontSize: 52,
  lineHeight: 1,
  margin: "10px 0 8px",
  fontWeight: 950,
};

const subTitleStyle: React.CSSProperties = {
  color: "#a8b3cf",
  fontSize: 18,
  marginTop: 6,
};

const backButtonStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(180deg, #1f2937, #020617)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 14,
  padding: "12px 15px",
  fontWeight: 900,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 24,
};

const navButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 14,
  padding: "12px 16px",
  background: "rgba(15,23,42,.86)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 16,
};

const navButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #ef4444, #991b1b)",
  border: "1px solid rgba(248,113,113,.95)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
};

const homeCardStyle: React.CSSProperties = {
  textAlign: "left",
  color: "white",
  background: "rgba(15,23,42,.94)",
  border: "1px solid rgba(255,255,255,.13)",
  borderRadius: 22,
  padding: 24,
  cursor: "pointer",
  boxShadow: "0 18px 48px rgba(0,0,0,.35)",
};

const homeCardTitleStyle: React.CSSProperties = {
  color: "#fca5a5",
  fontSize: 18,
  fontWeight: 950,
  marginBottom: 18,
};

const homeCardCountStyle: React.CSSProperties = {
  color: "white",
  fontSize: 34,
  fontWeight: 950,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,.13)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 48px rgba(0,0,0,.42)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "#ffffff",
  color: "#020617",
  outline: "none",
  fontSize: 16,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 16px",
  borderRadius: 13,
  border: "1px solid rgba(248,113,113,.95)",
  background: "linear-gradient(180deg, #ef4444, #991b1b)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const primaryButtonStyleNoMargin: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 13,
  border: "1px solid rgba(248,113,113,.95)",
  background: "linear-gradient(180deg, #ef4444, #991b1b)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,.45)",
  background: "rgba(127,29,29,.45)",
  color: "#fecaca",
  fontWeight: 900,
  cursor: "pointer",
};

const formFourStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
};

const formThreeStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const formTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const inlineFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 12,
  alignItems: "stretch",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 20,
};

const listRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "13px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.09)",
};

const tagStyle: React.CSSProperties = {
  marginLeft: 8,
  color: "#fecaca",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};
