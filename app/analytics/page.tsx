"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Player = {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  position: string | null;
  active: boolean;
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
  const [playType, setPlayType] = useState("");

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

    if (playersRes.data) setPlayers(playersRes.data);
    if (formationsRes.data) setFormations(formationsRes.data);
    if (playsRes.data) setPlays(playsRes.data);
    if (gamesRes.data) setGames(gamesRes.data);
  }

  async function addPlayer() {
    if (!user || !firstName.trim() || !lastName.trim()) return;

    await supabase.from("coachboard_analytics_players").insert({
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      jersey_number: jerseyNumber.trim() || null,
      position: position.trim() || null,
    });

    setFirstName("");
    setLastName("");
    setJerseyNumber("");
    setPosition("");
    loadAll();
  }

  async function addFormation() {
    if (!user || !formationName.trim()) return;

    await supabase.from("coachboard_analytics_formations").insert({
      user_id: user.id,
      name: formationName.trim(),
    });

    setFormationName("");
    loadAll();
  }

  async function addPlay() {
    if (!user || !playName.trim()) return;

    await supabase.from("coachboard_analytics_plays").insert({
      user_id: user.id,
      name: playName.trim(),
      play_type: playType.trim() || null,
    });

    setPlayName("");
    setPlayType("");
    loadAll();
  }

  async function addGame() {
    if (!user || !weekLabel.trim()) return;

    await supabase.from("coachboard_analytics_games").insert({
      user_id: user.id,
      week_label: weekLabel.trim(),
      opponent: opponent.trim() || null,
      game_date: gameDate || null,
    });

    setWeekLabel("");
    setOpponent("");
    setGameDate("");
    loadAll();
  }

  if (!user) {
    return (
      <main style={pageStyle}>
        <h1>CoachBoard Analytics</h1>
        <p>Please sign in through CoachBoard first.</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ marginBottom: 4 }}>CoachBoard Analytics</h1>
      <p style={{ color: "#9ca3af", marginTop: 0 }}>
        Built from your Excel stat system.
      </p>

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2>Players</h2>

          <div style={formGridStyle}>
            <input style={inputStyle} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input style={inputStyle} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <input style={inputStyle} placeholder="Jersey #" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
            <input style={inputStyle} placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>

          <button style={buttonStyle} onClick={addPlayer}>Add Player</button>

          <div style={listStyle}>
            {players.map((p) => (
              <div key={p.id} style={rowStyle}>
                #{p.jersey_number || "-"} {p.first_name} {p.last_name} {p.position ? `- ${p.position}` : ""}
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h2>Formations</h2>

          <input style={inputStyle} placeholder="Formation name" value={formationName} onChange={(e) => setFormationName(e.target.value)} />
          <button style={buttonStyle} onClick={addFormation}>Add Formation</button>

          <div style={listStyle}>
            {formations.map((f) => (
              <div key={f.id} style={rowStyle}>{f.name}</div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h2>Plays</h2>

          <div style={formGridStyle}>
            <input style={inputStyle} placeholder="Play name" value={playName} onChange={(e) => setPlayName(e.target.value)} />
            <input style={inputStyle} placeholder="Run / Pass / RPO" value={playType} onChange={(e) => setPlayType(e.target.value)} />
          </div>

          <button style={buttonStyle} onClick={addPlay}>Add Play</button>

          <div style={listStyle}>
            {plays.map((p) => (
              <div key={p.id} style={rowStyle}>
                {p.name} {p.play_type ? `- ${p.play_type}` : ""}
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h2>Games</h2>

          <div style={formGridStyle}>
            <input style={inputStyle} placeholder="Week 1" value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} />
            <input style={inputStyle} placeholder="Opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
            <input style={inputStyle} type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>

          <button style={buttonStyle} onClick={addGame}>Add Game</button>

          <div style={listStyle}>
            {games.map((g) => (
              <div key={g.id} style={rowStyle}>
                {g.week_label} {g.opponent ? `- ${g.opponent}` : ""}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  marginTop: 24,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  padding: 18,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#020617",
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const listStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 8,
};

const rowStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  fontSize: 14,
};
