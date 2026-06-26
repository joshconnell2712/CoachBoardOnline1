"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Section = "gamecenter" | "setup" | "games" | "reports";
type PlayType = "Run" | "Pass" | "RPO" | "Screen" | "Other";

type Team = {
  id: string;
  user_id: string;
  team_name: string;
  season: number;
};

type Player = {
  id: string;
  team_id: string | null;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: string | null;
  active: boolean | null;
};

type Formation = {
  id: string;
  team_id: string | null;
  name: string;
};

type Play = {
  id: string;
  team_id: string | null;
  name: string;
  play_type: string | null;
};

type Game = {
  id: string;
  team_id: string | null;
  opponent: string;
  week: number | null;
  game_date: string | null;
  home_game: boolean | null;
};

type ChartPlay = {
  id: string;
  team_id: string | null;
  game_id: string | null;
  play_number: number | null;
  quarter: number | null;
  down: number | null;
  distance: number | null;
  yard_line: number | null;
  hash: string | null;
  formation_id: string | null;
  play_id: string | null;
  play_type: string | null;
  ball_carrier_id: string | null;
  passer_id: string | null;
  receiver_id: string | null;
  yards: number | null;
  touchdown: boolean | null;
  first_down: boolean | null;
  turnover: boolean | null;
  penalty: boolean | null;
  notes: string | null;
  created_at: string | null;
};

type PlayGrade = "negative" | "normal" | "success" | "explosive";

type GroupReportRow = {
  id: string;
  label: string;
  calls: number;
  yards: number;
  average: number;
  successes: number;
  explosives: number;
  successRate: number;
  explosiveRate: number;
};

const RUN_SUCCESS_YARDS = 4;
const PASS_SUCCESS_YARDS = 12;
const RUN_EXPLOSIVE_YARDS = 10;
const PASS_EXPLOSIVE_YARDS = 25;

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("gamecenter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [chartPlays, setChartPlays] = useState<ChartPlay[]>([]);

  const [teamName, setTeamName] = useState("My Team");
  const [season, setSeason] = useState(new Date().getFullYear());

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");

  const [formationName, setFormationName] = useState("");
  const [playName, setPlayName] = useState("");
  const [playType, setPlayType] = useState<PlayType>("Run");

  const [newOpponent, setNewOpponent] = useState("");
  const [newWeek, setNewWeek] = useState("");
  const [newGameDate, setNewGameDate] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");

  const [quarter, setQuarter] = useState("1");
  const [down, setDown] = useState("1");
  const [distance, setDistance] = useState("10");
  const [yardLine, setYardLine] = useState("35");
  const [hash, setHash] = useState("");
  const [selectedFormationId, setSelectedFormationId] = useState("");
  const [selectedPlayId, setSelectedPlayId] = useState("");
  const [entryPlayType, setEntryPlayType] = useState<PlayType>("Run");
  const [ballCarrierId, setBallCarrierId] = useState("");
  const [passerId, setPasserId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [yards, setYards] = useState("");
  const [touchdown, setTouchdown] = useState(false);
  const [firstDown, setFirstDown] = useState(false);
  const [turnover, setTurnover] = useState(false);
  const [penalty, setPenalty] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadEverything(user.id);
  }, [user]);

  useEffect(() => {
    if (games.length > 0 && !selectedGameId) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  useEffect(() => {
    if (selectedPlayId) {
      const selected = plays.find((play) => play.id === selectedPlayId);
      const type = normalizePlayType(selected?.play_type);
      setEntryPlayType(type);
    }
  }, [selectedPlayId, plays]);

  useEffect(() => {
    if (!team || !selectedGameId) {
      setChartPlays([]);
      return;
    }

    loadChartPlays(selectedGameId);
  }, [team, selectedGameId]);

  async function loadEverything(userId: string) {
    setLoading(true);
    setMessage("");

    let activeTeam: Team | null = null;

    const teamsRes = await supabase
      .from("coachboard_analytics_teams")
      .select("id, user_id, team_name, season")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (teamsRes.error) {
      setMessage(`Database error: ${teamsRes.error.message}`);
      setLoading(false);
      return;
    }

    if (teamsRes.data && teamsRes.data.length > 0) {
      activeTeam = teamsRes.data[0] as Team;
    } else {
      const created = await supabase
        .from("coachboard_analytics_teams")
        .insert({
          user_id: userId,
          team_name: "My Team",
          season: new Date().getFullYear(),
        })
        .select("id, user_id, team_name, season")
        .single();

      if (created.error) {
        setMessage(`Could not create team: ${created.error.message}`);
        setLoading(false);
        return;
      }

      activeTeam = created.data as Team;
    }

    setTeam(activeTeam);
    setTeamName(activeTeam.team_name);
    setSeason(activeTeam.season);

    const [playersRes, formationsRes, playsRes, gamesRes] = await Promise.all([
      supabase
        .from("coachboard_analytics_players")
        .select("id, team_id, first_name, last_name, jersey_number, position, active")
        .eq("team_id", activeTeam.id)
        .order("jersey_number", { ascending: true }),

      supabase
        .from("coachboard_analytics_formations")
        .select("id, team_id, name")
        .eq("team_id", activeTeam.id)
        .order("name", { ascending: true }),

      supabase
        .from("coachboard_analytics_plays")
        .select("id, team_id, name, play_type")
        .eq("team_id", activeTeam.id)
        .order("name", { ascending: true }),

      supabase
        .from("coachboard_analytics_games")
        .select("id, team_id, opponent, week, game_date, home_game")
        .eq("team_id", activeTeam.id)
        .order("week", { ascending: true }),
    ]);

    if (playersRes.error) setMessage(playersRes.error.message);
    if (formationsRes.error) setMessage(formationsRes.error.message);
    if (playsRes.error) setMessage(playsRes.error.message);
    if (gamesRes.error) setMessage(gamesRes.error.message);

    setPlayers((playersRes.data ?? []) as Player[]);
    setFormations((formationsRes.data ?? []) as Formation[]);
    setPlays((playsRes.data ?? []) as Play[]);
    setGames((gamesRes.data ?? []) as Game[]);

    if (gamesRes.data && gamesRes.data.length > 0) {
      const firstGame = gamesRes.data[0] as Game;
      setSelectedGameId(firstGame.id);
      await loadChartPlays(firstGame.id);
    }

    setLoading(false);
  }

  async function refreshTeamData() {
    if (!user) return;
    await loadEverything(user.id);
  }

  async function loadChartPlays(gameId: string) {
    const res = await supabase
      .from("coachboard_analytics_play_chart")
      .select("*")
      .eq("game_id", gameId)
      .order("play_number", { ascending: true })
      .order("created_at", { ascending: true });

    if (res.error) {
      setMessage(`Play chart error: ${res.error.message}`);
      return;
    }

    setChartPlays((res.data ?? []) as ChartPlay[]);
  }

  async function saveTeam() {
    if (!team) return;
    setSaving(true);
    setMessage("");

    const res = await supabase
      .from("coachboard_analytics_teams")
      .update({
        team_name: teamName.trim() || "My Team",
        season: Number(season) || new Date().getFullYear(),
      })
      .eq("id", team.id);

    if (res.error) {
      setMessage(res.error.message);
    } else {
      await refreshTeamData();
      setMessage("Team saved.");
    }

    setSaving(false);
  }

  async function addPlayer() {
    if (!team || !firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await supabase.from("coachboard_analytics_players").insert({
      team_id: team.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      jersey_number: jerseyNumber.trim() ? Number(jerseyNumber) : null,
      position: position.trim() || null,
      active: true,
    });

    if (res.error) {
      setMessage(res.error.message);
    } else {
      setFirstName("");
      setLastName("");
      setJerseyNumber("");
      setPosition("");
      await refreshTeamData();
    }

    setSaving(false);
  }

  async function addFormation() {
    if (!team || !formationName.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await supabase.from("coachboard_analytics_formations").insert({
      team_id: team.id,
      name: formationName.trim(),
    });

    if (res.error) {
      setMessage(res.error.message);
    } else {
      setFormationName("");
      await refreshTeamData();
    }

    setSaving(false);
  }

  async function addPlay() {
    if (!team || !playName.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await supabase.from("coachboard_analytics_plays").insert({
      team_id: team.id,
      name: playName.trim(),
      play_type: playType,
    });

    if (res.error) {
      setMessage(res.error.message);
    } else {
      setPlayName("");
      setPlayType("Run");
      await refreshTeamData();
    }

    setSaving(false);
  }

  async function addGame() {
    if (!team || !newOpponent.trim()) return;
    setSaving(true);
    setMessage("");

    const res = await supabase
      .from("coachboard_analytics_games")
      .insert({
        team_id: team.id,
        opponent: newOpponent.trim(),
        week: newWeek.trim() ? Number(newWeek) : games.length + 1,
        game_date: newGameDate || null,
        home_game: true,
      })
      .select("id")
      .single();

    if (res.error) {
      setMessage(res.error.message);
    } else {
      setNewOpponent("");
      setNewWeek("");
      setNewGameDate("");
      await refreshTeamData();
      if (res.data?.id) {
        setSelectedGameId(res.data.id as string);
        setActiveSection("gamecenter");
      }
    }

    setSaving(false);
  }

  async function savePlayEntry() {
    if (!team || !selectedGameId) {
      setMessage("Create/select a game first.");
      return;
    }

    if (!selectedFormationId || !selectedPlayId) {
      setMessage("Select a formation and play.");
      return;
    }

    const yardsNumber = Number(yards);
    if (Number.isNaN(yardsNumber)) {
      setMessage("Enter yards gained/lost.");
      return;
    }

    setSaving(true);
    setMessage("");

    const nextPlayNumber =
      chartPlays.length === 0
        ? 1
        : Math.max(...chartPlays.map((play) => play.play_number ?? 0)) + 1;

    const res = await supabase.from("coachboard_analytics_play_chart").insert({
      team_id: team.id,
      game_id: selectedGameId,
      play_number: nextPlayNumber,
      quarter: Number(quarter) || 1,
      down: Number(down) || 1,
      distance: Number(distance) || 0,
      yard_line: Number(yardLine) || null,
      hash: hash.trim() || null,
      formation_id: selectedFormationId,
      play_id: selectedPlayId,
      play_type: entryPlayType,
      ball_carrier_id: ballCarrierId || null,
      passer_id: passerId || null,
      receiver_id: receiverId || null,
      yards: yardsNumber,
      touchdown,
      first_down: firstDown,
      turnover,
      penalty,
      notes: notes.trim() || null,
    });

    if (res.error) {
      setMessage(res.error.message);
    } else {
      await loadChartPlays(selectedGameId);
      setYards("");
      setTouchdown(false);
      setFirstDown(false);
      setTurnover(false);
      setPenalty(false);
      setNotes("");
    }

    setSaving(false);
  }

  async function deleteRow(table: string, id: string) {
    setSaving(true);
    const res = await supabase.from(table).delete().eq("id", id);

    if (res.error) {
      setMessage(res.error.message);
    } else if (table === "coachboard_analytics_play_chart" && selectedGameId) {
      await loadChartPlays(selectedGameId);
    } else {
      await refreshTeamData();
    }

    setSaving(false);
  }

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId],
  );

  const liveStats = useMemo(() => calculateStats(chartPlays), [chartPlays]);

  const playReport = useMemo(
    () =>
      makeGroupReport(
        chartPlays,
        (row) => row.play_id,
        (id) => plays.find((play) => play.id === id)?.name ?? "Unknown Play",
      ),
    [chartPlays, plays],
  );

  const formationReport = useMemo(
    () =>
      makeGroupReport(
        chartPlays,
        (row) => row.formation_id,
        (id) => formations.find((formation) => formation.id === id)?.name ?? "Unknown Formation",
      ),
    [chartPlays, formations],
  );

  const formationPlayReport = useMemo(
    () =>
      makeGroupReport(
        chartPlays,
        (row) => `${row.formation_id ?? "none"}|${row.play_id ?? "none"}`,
        (id) => {
          const [formationId, playId] = id.split("|");
          const formationName =
            formations.find((formation) => formation.id === formationId)?.name ??
            "Unknown Formation";
          const playName = plays.find((play) => play.id === playId)?.name ?? "Unknown Play";
          return `${formationName} — ${playName}`;
        },
      ),
    [chartPlays, formations, plays],
  );

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Analytics</h1>
        <p style={subTitleStyle}>Loading...</p>
      </main>
    );
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
          <p style={subTitleStyle}>
            Real-time Game Center • Success Rate • Explosive Plays • Tendencies
          </p>
        </div>

        <Link href="/" style={backButtonStyle}>
          Back to CoachBoard
        </Link>
      </header>

      {message && <div style={messageStyle}>{message}</div>}

      <nav style={navStyle}>
        <NavButton
          label="Game Center"
          active={activeSection === "gamecenter"}
          onClick={() => setActiveSection("gamecenter")}
        />
        <NavButton
          label="Setup"
          active={activeSection === "setup"}
          onClick={() => setActiveSection("setup")}
        />
        <NavButton
          label="Games"
          active={activeSection === "games"}
          onClick={() => setActiveSection("games")}
        />
        <NavButton
          label="Reports"
          active={activeSection === "reports"}
          onClick={() => setActiveSection("reports")}
        />
      </nav>

      {activeSection === "gamecenter" && (
        <section style={gameCenterGridStyle}>
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Game Center</h2>
                <p style={mutedStyle}>
                  {selectedGame
                    ? `Week ${selectedGame.week ?? "-"} vs ${selectedGame.opponent}`
                    : "Create a game to begin charting."}
                </p>
              </div>

              <select
                style={{ ...inputStyle, maxWidth: 280 }}
                value={selectedGameId}
                onChange={(event) => setSelectedGameId(event.target.value)}
              >
                <option value="">Select Game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    Week {game.week ?? "-"} vs {game.opponent}
                  </option>
                ))}
              </select>
            </div>

            <div style={entryGridStyle}>
              <Field label="Quarter">
                <input
                  style={inputStyle}
                  type="number"
                  value={quarter}
                  onChange={(event) => setQuarter(event.target.value)}
                />
              </Field>

              <Field label="Down">
                <input
                  style={inputStyle}
                  type="number"
                  value={down}
                  onChange={(event) => setDown(event.target.value)}
                />
              </Field>

              <Field label="Distance">
                <input
                  style={inputStyle}
                  type="number"
                  value={distance}
                  onChange={(event) => setDistance(event.target.value)}
                />
              </Field>

              <Field label="Ball On">
                <input
                  style={inputStyle}
                  type="number"
                  value={yardLine}
                  onChange={(event) => setYardLine(event.target.value)}
                />
              </Field>

              <Field label="Hash">
                <select style={inputStyle} value={hash} onChange={(event) => setHash(event.target.value)}>
                  <option value="">Hash</option>
                  <option value="Left">Left</option>
                  <option value="Middle">Middle</option>
                  <option value="Right">Right</option>
                </select>
              </Field>

              <Field label="Formation">
                <select
                  style={inputStyle}
                  value={selectedFormationId}
                  onChange={(event) => setSelectedFormationId(event.target.value)}
                >
                  <option value="">Select Formation</option>
                  {formations.map((formation) => (
                    <option key={formation.id} value={formation.id}>
                      {formation.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Play">
                <select
                  style={inputStyle}
                  value={selectedPlayId}
                  onChange={(event) => setSelectedPlayId(event.target.value)}
                >
                  <option value="">Select Play</option>
                  {plays.map((play) => (
                    <option key={play.id} value={play.id}>
                      {play.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Type">
                <select
                  style={inputStyle}
                  value={entryPlayType}
                  onChange={(event) => setEntryPlayType(event.target.value as PlayType)}
                >
                  <option value="Run">Run</option>
                  <option value="Pass">Pass</option>
                  <option value="RPO">RPO</option>
                  <option value="Screen">Screen</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Ball Carrier">
                <select
                  style={inputStyle}
                  value={ballCarrierId}
                  onChange={(event) => setBallCarrierId(event.target.value)}
                >
                  <option value="">None</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerLabel(player)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Passer">
                <select
                  style={inputStyle}
                  value={passerId}
                  onChange={(event) => setPasserId(event.target.value)}
                >
                  <option value="">None</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerLabel(player)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Receiver">
                <select
                  style={inputStyle}
                  value={receiverId}
                  onChange={(event) => setReceiverId(event.target.value)}
                >
                  <option value="">None</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerLabel(player)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Yards">
                <input
                  style={inputStyle}
                  type="number"
                  value={yards}
                  onChange={(event) => setYards(event.target.value)}
                />
              </Field>
            </div>

            <div style={checkGridStyle}>
              <Check label="TD" checked={touchdown} onChange={setTouchdown} />
              <Check label="First Down" checked={firstDown} onChange={setFirstDown} />
              <Check label="Turnover" checked={turnover} onChange={setTurnover} />
              <Check label="Penalty" checked={penalty} onChange={setPenalty} />
            </div>

            <textarea
              style={{ ...inputStyle, minHeight: 70, marginTop: 14 }}
              placeholder="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />

            <button style={primaryButtonStyle} onClick={savePlayEntry} disabled={saving}>
              SAVE PLAY
            </button>
          </div>

          <aside style={cardStyle}>
            <h2 style={sectionTitleStyle}>Live Analytics</h2>

            <div style={metricGridStyle}>
              <Metric label="Plays" value={`${chartPlays.length}`} />
              <Metric label="Success" value={`${liveStats.successRate}%`} />
              <Metric label="Explosive" value={`${liveStats.explosiveRate}%`} />
              <Metric label="Avg Yards" value={`${liveStats.averageYards}`} />
            </div>

            <div style={recommendationStyle}>
              <div style={eyebrowStyle}>BEST RIGHT NOW</div>
              <strong>{playReport[0]?.label ?? "-"}</strong>
              <span>
                {playReport[0]
                  ? `${playReport[0].successRate}% success • ${playReport[0].average.toFixed(1)} avg`
                  : "Start charting to generate recommendations."}
              </span>
            </div>

            <div style={recommendationStyle}>
              <div style={eyebrowStyle}>BEST FORMATION</div>
              <strong>{formationReport[0]?.label ?? "-"}</strong>
              <span>
                {formationReport[0]
                  ? `${formationReport[0].successRate}% success • ${formationReport[0].calls} calls`
                  : "No formation data yet."}
              </span>
            </div>
          </aside>

          <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <h2 style={sectionTitleStyle}>Live Play Feed</h2>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Q</th>
                    <th style={thStyle}>D&D</th>
                    <th style={thStyle}>Formation</th>
                    <th style={thStyle}>Play</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Yards</th>
                    <th style={thStyle}>Result</th>
                    <th style={thStyle}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {chartPlays.map((row) => {
                    const grade = classifyPlay(row);
                    return (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.play_number}</td>
                        <td style={tdStyle}>{row.quarter}</td>
                        <td style={tdStyle}>
                          {row.down} & {row.distance}
                        </td>
                        <td style={tdStyle}>{formationNameById(formations, row.formation_id)}</td>
                        <td style={tdStyle}>{playNameById(plays, row.play_id)}</td>
                        <td style={tdStyle}>{row.play_type}</td>
                        <td style={tdStyle}>{row.yards}</td>
                        <td style={tdStyle}>
                          <span style={{ ...badgeStyle, ...badgeStyleForGrade(grade) }}>
                            {gradeLabel(grade)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <button
                            style={dangerButtonStyle}
                            onClick={() => deleteRow("coachboard_analytics_play_chart", row.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeSection === "setup" && (
        <section style={setupGridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Team</h2>
            <div style={formTwoStyle}>
              <Field label="Team Name">
                <input style={inputStyle} value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              </Field>
              <Field label="Season">
                <input
                  style={inputStyle}
                  type="number"
                  value={season}
                  onChange={(event) => setSeason(Number(event.target.value))}
                />
              </Field>
            </div>
            <button style={primaryButtonStyle} onClick={saveTeam} disabled={saving}>
              Save Team
            </button>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Players</h2>
            <div style={formFourStyle}>
              <input style={inputStyle} placeholder="First" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              <input style={inputStyle} placeholder="Last" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              <input style={inputStyle} placeholder="Number" value={jerseyNumber} onChange={(event) => setJerseyNumber(event.target.value)} />
              <input style={inputStyle} placeholder="Position" value={position} onChange={(event) => setPosition(event.target.value)} />
            </div>
            <button style={primaryButtonStyle} onClick={addPlayer} disabled={saving}>
              Add Player
            </button>
            <List>
              {players.map((player) => (
                <Row key={player.id}>
                  <span>{playerLabel(player)}</span>
                  <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_players", player.id)}>
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Formations</h2>
            <div style={inlineFormStyle}>
              <input
                style={inputStyle}
                placeholder="Formation"
                value={formationName}
                onChange={(event) => setFormationName(event.target.value)}
              />
              <button style={primaryButtonStyleNoMargin} onClick={addFormation} disabled={saving}>
                Add
              </button>
            </div>
            <List>
              {formations.map((formation) => (
                <Row key={formation.id}>
                  <span>{formation.name}</span>
                  <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_formations", formation.id)}>
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Plays</h2>
            <div style={formTwoStyle}>
              <input style={inputStyle} placeholder="Play" value={playName} onChange={(event) => setPlayName(event.target.value)} />
              <select style={inputStyle} value={playType} onChange={(event) => setPlayType(event.target.value as PlayType)}>
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
            <List>
              {plays.map((play) => (
                <Row key={play.id}>
                  <span>
                    {play.name} <span style={tagStyle}>{play.play_type}</span>
                  </span>
                  <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_plays", play.id)}>
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>
        </section>
      )}

      {activeSection === "games" && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Games</h2>
          <div style={formThreeStyle}>
            <input style={inputStyle} placeholder="Week" value={newWeek} onChange={(event) => setNewWeek(event.target.value)} />
            <input style={inputStyle} placeholder="Opponent" value={newOpponent} onChange={(event) => setNewOpponent(event.target.value)} />
            <input style={inputStyle} type="date" value={newGameDate} onChange={(event) => setNewGameDate(event.target.value)} />
          </div>
          <button style={primaryButtonStyle} onClick={addGame} disabled={saving}>
            Add Game
          </button>

          <List>
            {games.map((game) => (
              <Row key={game.id}>
                <span>
                  Week {game.week ?? "-"} vs {game.opponent}
                  {game.game_date ? ` • ${game.game_date}` : ""}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={smallActionButtonStyle}
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setActiveSection("gamecenter");
                    }}
                  >
                    Open
                  </button>
                  <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_games", game.id)}>
                    Delete
                  </button>
                </div>
              </Row>
            ))}
          </List>
        </section>
      )}

      {activeSection === "reports" && (
        <section style={reportsGridStyle}>
          <ReportCard title="Best Plays" rows={playReport} />
          <ReportCard title="Best Formations" rows={formationReport} />
          <ReportCard title="Best Formation + Play" rows={formationPlayReport} />
        </section>
      )}
    </main>
  );
}

function normalizePlayType(value: string | null | undefined): PlayType {
  if (value === "Run" || value === "Pass" || value === "RPO" || value === "Screen" || value === "Other") {
    return value;
  }
  return "Run";
}

function classifyPlay(play: Pick<ChartPlay, "play_type" | "yards">): PlayGrade {
  const yards = play.yards ?? 0;
  const type = normalizePlayType(play.play_type);

  if (yards <= 0) return "negative";

  if (type === "Run") {
    if (yards >= RUN_EXPLOSIVE_YARDS) return "explosive";
    if (yards >= RUN_SUCCESS_YARDS) return "success";
    return "normal";
  }

  if (yards >= PASS_EXPLOSIVE_YARDS) return "explosive";
  if (yards >= PASS_SUCCESS_YARDS) return "success";
  return "normal";
}

function isSuccessful(play: ChartPlay) {
  const grade = classifyPlay(play);
  return grade === "success" || grade === "explosive";
}

function isExplosive(play: ChartPlay) {
  return classifyPlay(play) === "explosive";
}

function calculateStats(rows: ChartPlay[]) {
  const total = rows.length;
  const successes = rows.filter(isSuccessful).length;
  const explosives = rows.filter(isExplosive).length;
  const yards = rows.reduce((sum, row) => sum + (row.yards ?? 0), 0);

  return {
    total,
    successes,
    explosives,
    yards,
    successRate: total === 0 ? 0 : Math.round((successes / total) * 100),
    explosiveRate: total === 0 ? 0 : Math.round((explosives / total) * 100),
    averageYards: total === 0 ? "0.0" : (yards / total).toFixed(1),
  };
}

function makeGroupReport(
  rows: ChartPlay[],
  keyGetter: (row: ChartPlay) => string | null | undefined,
  labelGetter: (id: string) => string,
): GroupReportRow[] {
  const map = new Map<string, ChartPlay[]>();

  rows.forEach((row) => {
    const key = keyGetter(row);
    if (!key) return;
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  });

  return Array.from(map.entries())
    .map(([id, groupRows]) => {
      const stats = calculateStats(groupRows);
      const yards = groupRows.reduce((sum, row) => sum + (row.yards ?? 0), 0);

      return {
        id,
        label: labelGetter(id),
        calls: groupRows.length,
        yards,
        average: groupRows.length === 0 ? 0 : yards / groupRows.length,
        successes: stats.successes,
        explosives: stats.explosives,
        successRate: stats.successRate,
        explosiveRate: stats.explosiveRate,
      };
    })
    .sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      if (b.average !== a.average) return b.average - a.average;
      return b.calls - a.calls;
    });
}

function playerLabel(player: Player) {
  const number = player.jersey_number === null || player.jersey_number === undefined ? "-" : player.jersey_number;
  return `#${number} ${player.first_name} ${player.last_name}${player.position ? ` • ${player.position}` : ""}`;
}

function formationNameById(formations: Formation[], id: string | null) {
  return formations.find((formation) => formation.id === id)?.name ?? "-";
}

function playNameById(plays: Play[], id: string | null) {
  return plays.find((play) => play.id === id)?.name ?? "-";
}

function gradeLabel(grade: PlayGrade) {
  if (grade === "negative") return "NEGATIVE";
  if (grade === "explosive") return "EXPLOSIVE";
  if (grade === "success") return "SUCCESS";
  return "NORMAL";
}

function badgeStyleForGrade(grade: PlayGrade): React.CSSProperties {
  if (grade === "negative") return { background: "rgba(220,38,38,.18)", color: "#fecaca", borderColor: "rgba(248,113,113,.65)" };
  if (grade === "explosive") return { background: "rgba(250,204,21,.18)", color: "#facc15", borderColor: "rgba(250,204,21,.75)" };
  if (grade === "success") return { background: "rgba(34,197,94,.18)", color: "#86efac", borderColor: "rgba(34,197,94,.65)" };
  return { background: "rgba(255,255,255,.08)", color: "#ffffff", borderColor: "rgba(255,255,255,.18)" };
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...navButtonStyle, ...(active ? navButtonActiveStyle : {}) }}>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={checkStyle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={listStyle}>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={listRowStyle}>{children}</div>;
}

function ReportCard({ title, rows }: { title: string; rows: GroupReportRow[] }) {
  return (
    <div style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Call</th>
              <th style={thStyle}>Calls</th>
              <th style={thStyle}>Avg</th>
              <th style={thStyle}>Success</th>
              <th style={thStyle}>Explosive</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{row.label}</td>
                <td style={tdStyle}>{row.calls}</td>
                <td style={tdStyle}>{row.average.toFixed(1)}</td>
                <td style={tdStyle}>{row.successRate}%</td>
                <td style={tdStyle}>{row.explosiveRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

const messageStyle: React.CSSProperties = {
  background: "rgba(250,204,21,.12)",
  color: "#fde68a",
  border: "1px solid rgba(250,204,21,.35)",
  borderRadius: 14,
  padding: 12,
  marginBottom: 18,
  fontWeight: 800,
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

const cardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,.13)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 48px rgba(0,0,0,.42)",
};

const gameCenterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.2fr) minmax(320px, .9fr)",
  gap: 18,
};

const setupGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: 18,
};

const reportsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 26,
  margin: 0,
  fontWeight: 950,
};

const mutedStyle: React.CSSProperties = {
  color: "#94a3b8",
  marginTop: 6,
};

const entryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const checkGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 14,
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

const smallActionButtonStyle: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid rgba(34,197,94,.45)",
  background: "rgba(22,101,52,.55)",
  color: "#bbf7d0",
  fontWeight: 900,
  cursor: "pointer",
};

const formFourStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 12,
};

const formThreeStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const formTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#cbd5e1",
  fontWeight: 900,
  fontSize: 13,
};

const checkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.10)",
  fontWeight: 900,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};

const metricCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: 16,
  padding: 14,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const metricValueStyle: React.CSSProperties = {
  color: "white",
  fontSize: 32,
  fontWeight: 950,
  marginTop: 4,
};

const recommendationStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  marginTop: 16,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 760,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  color: "#fca5a5",
  fontSize: 12,
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(255,255,255,.12)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  color: "#e5e7eb",
  fontWeight: 700,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 950,
};
