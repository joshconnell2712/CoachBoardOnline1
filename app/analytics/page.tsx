"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Section = "command" | "setup" | "games" | "reports";
type PlayType = "Run" | "Pass" | "RPO" | "Screen" | "Other";
type Grade = "negative" | "normal" | "success" | "explosive";

type Team = { id: string; user_id: string; team_name: string; season: number };
type Player = { id: string; team_id: string | null; first_name: string; last_name: string; jersey_number: number | null; position: string | null; active: boolean | null };
type Formation = { id: string; team_id: string | null; name: string };
type Play = { id: string; team_id: string | null; name: string; play_type: string | null };
type Game = { id: string; team_id: string | null; opponent: string; week: number | null; game_date: string | null; home_game: boolean | null };
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

type ReportRow = {
  id: string;
  label: string;
  calls: number;
  yards: number;
  avg: number;
  success: number;
  explosive: number;
  successRate: number;
  explosiveRate: number;
};

const RUN_SUCCESS = 4;
const PASS_SUCCESS = 12;
const RUN_EXPLOSIVE = 10;
const PASS_EXPLOSIVE = 25;

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("command");
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
  const [selectedGameId, setSelectedGameId] = useState("");

  const [newWeek, setNewWeek] = useState("");
  const [newOpponent, setNewOpponent] = useState("");
  const [newGameDate, setNewGameDate] = useState("");

  const [playerFirst, setPlayerFirst] = useState("");
  const [playerLast, setPlayerLast] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("");
  const [formationSetup, setFormationSetup] = useState("");
  const [playSetup, setPlaySetup] = useState("");
  const [playSetupType, setPlaySetupType] = useState<PlayType>("Run");

  const [entry, setEntry] = useState({
    dd: "1 and 10",
    formation: "",
    play: "",
    yards: "",
    rusher: "",
    passer: "",
    receiver: "",
    result: "",
    qtr: "1",
    ball: "35",
    hash: "",
    notes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadAll(user.id);
  }, [user]);

  useEffect(() => {
    if (games.length && !selectedGameId) setSelectedGameId(games[0].id);
  }, [games, selectedGameId]);

  useEffect(() => {
    if (selectedGameId) loadChart(selectedGameId);
  }, [selectedGameId]);

  async function loadAll(userId: string) {
    setLoading(true);
    setMessage("");

    let activeTeam: Team | null = null;

    const teamRes = await supabase
      .from("coachboard_analytics_teams")
      .select("id,user_id,team_name,season")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (teamRes.error) {
      setMessage(teamRes.error.message);
      setLoading(false);
      return;
    }

    if (teamRes.data && teamRes.data.length) {
      activeTeam = teamRes.data[0] as Team;
    } else {
      const created = await supabase
        .from("coachboard_analytics_teams")
        .insert({ user_id: userId, team_name: "My Team", season: new Date().getFullYear() })
        .select("id,user_id,team_name,season")
        .single();

      if (created.error) {
        setMessage(created.error.message);
        setLoading(false);
        return;
      }

      activeTeam = created.data as Team;
    }

    setTeam(activeTeam);
    setTeamName(activeTeam.team_name);
    setSeason(activeTeam.season);

    const [pRes, fRes, plRes, gRes] = await Promise.all([
      supabase.from("coachboard_analytics_players").select("id,team_id,first_name,last_name,jersey_number,position,active").eq("team_id", activeTeam.id).order("jersey_number", { ascending: true }),
      supabase.from("coachboard_analytics_formations").select("id,team_id,name").eq("team_id", activeTeam.id).order("name", { ascending: true }),
      supabase.from("coachboard_analytics_plays").select("id,team_id,name,play_type").eq("team_id", activeTeam.id).order("name", { ascending: true }),
      supabase.from("coachboard_analytics_games").select("id,team_id,opponent,week,game_date,home_game").eq("team_id", activeTeam.id).order("week", { ascending: true }),
    ]);

    if (pRes.error) setMessage(pRes.error.message);
    if (fRes.error) setMessage(fRes.error.message);
    if (plRes.error) setMessage(plRes.error.message);
    if (gRes.error) setMessage(gRes.error.message);

    setPlayers((pRes.data ?? []) as Player[]);
    setFormations((fRes.data ?? []) as Formation[]);
    setPlays((plRes.data ?? []) as Play[]);
    setGames((gRes.data ?? []) as Game[]);

    const firstGame = (gRes.data ?? [])[0] as Game | undefined;
    if (firstGame) {
      setSelectedGameId(firstGame.id);
      await loadChart(firstGame.id);
    }

    setLoading(false);
  }

  async function refresh() {
    if (!user) return;
    await loadAll(user.id);
  }

  async function loadChart(gameId: string) {
    const res = await supabase
      .from("coachboard_analytics_play_chart")
      .select("*")
      .eq("game_id", gameId)
      .order("play_number", { ascending: true })
      .order("created_at", { ascending: true });

    if (res.error) {
      setMessage(res.error.message);
      return;
    }

    setChartPlays((res.data ?? []) as ChartPlay[]);
  }

  async function findOrCreateFormation(name: string) {
    if (!team) return null;
    const clean = name.trim();
    if (!clean) return null;

    const existing = formations.find((item) => item.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;

    const res = await supabase
      .from("coachboard_analytics_formations")
      .insert({ team_id: team.id, name: clean })
      .select("id,team_id,name")
      .single();

    if (res.error) {
      setMessage(res.error.message);
      return null;
    }

    const created = res.data as Formation;
    setFormations((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created.id;
  }

  async function findOrCreatePlay(name: string, type: PlayType) {
    if (!team) return null;
    const clean = name.trim();
    if (!clean) return null;

    const existing = plays.find((item) => item.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;

    const res = await supabase
      .from("coachboard_analytics_plays")
      .insert({ team_id: team.id, name: clean, play_type: type })
      .select("id,team_id,name,play_type")
      .single();

    if (res.error) {
      setMessage(res.error.message);
      return null;
    }

    const created = res.data as Play;
    setPlays((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created.id;
  }

  function findPlayerId(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean) return null;

    const num = clean.match(/\d+/);
    if (num) {
      const player = players.find((item) => item.jersey_number === Number(num[0]));
      if (player) return player.id;
    }

    const player = players.find((item) => {
      const full = `${item.first_name} ${item.last_name}`.toLowerCase();
      const label = playerLabel(item).toLowerCase();
      return full.includes(clean) || label.includes(clean);
    });

    return player?.id ?? null;
  }

  async function savePlay() {
    if (!team || !selectedGameId) {
      setMessage("Create/select a game first.");
      return;
    }

    if (!entry.formation.trim() || !entry.play.trim()) {
      setMessage("Type formation and play.");
      return;
    }

    const yards = Number(entry.yards);
    if (Number.isNaN(yards) || entry.yards.trim() === "") {
      setMessage("Type yards.");
      return;
    }

    setSaving(true);
    setMessage("");

    const formationId = await findOrCreateFormation(entry.formation);
    const playType = detectType(entry);
    const playId = await findOrCreatePlay(entry.play, playType);

    if (!formationId || !playId) {
      setSaving(false);
      return;
    }

    const parsedDD = parseDownDistance(entry.dd);
    const result = entry.result.toUpperCase();
    const nextNumber = chartPlays.length ? Math.max(...chartPlays.map((row) => row.play_number ?? 0)) + 1 : 1;

    const res = await supabase.from("coachboard_analytics_play_chart").insert({
      team_id: team.id,
      game_id: selectedGameId,
      play_number: nextNumber,
      quarter: Number(entry.qtr) || 1,
      down: parsedDD.down,
      distance: parsedDD.distance,
      yard_line: Number(entry.ball) || null,
      hash: entry.hash.trim() || null,
      formation_id: formationId,
      play_id: playId,
      play_type: playType,
      ball_carrier_id: findPlayerId(entry.rusher),
      passer_id: findPlayerId(entry.passer),
      receiver_id: findPlayerId(entry.receiver),
      yards,
      touchdown: result.includes("TD"),
      first_down: result.includes("FD") || yards >= parsedDD.distance,
      turnover: result.includes("INT") || result.includes("FUM") || result.includes("TO"),
      penalty: result.includes("PEN"),
      notes: entry.notes.trim() || null,
    });

    if (res.error) {
      setMessage(res.error.message);
    } else {
      await loadChart(selectedGameId);
      setEntry((current) => ({
        ...current,
        dd: nextDownDistance(current.dd, yards),
        play: "",
        yards: "",
        rusher: "",
        passer: "",
        receiver: "",
        result: "",
        notes: "",
      }));
    }

    setSaving(false);
  }

  async function saveTeam() {
    if (!team) return;
    setSaving(true);
    const res = await supabase.from("coachboard_analytics_teams").update({ team_name: teamName.trim() || "My Team", season }).eq("id", team.id);
    if (res.error) setMessage(res.error.message);
    else await refresh();
    setSaving(false);
  }

  async function addGame() {
    if (!team || !newOpponent.trim()) return;
    setSaving(true);

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

    if (res.error) setMessage(res.error.message);
    else {
      setNewWeek("");
      setNewOpponent("");
      setNewGameDate("");
      await refresh();
      if (res.data?.id) {
        setSelectedGameId(res.data.id as string);
        setActiveSection("command");
      }
    }

    setSaving(false);
  }

  async function addPlayer() {
    if (!team || !playerFirst.trim() || !playerLast.trim()) return;
    setSaving(true);

    const res = await supabase.from("coachboard_analytics_players").insert({
      team_id: team.id,
      first_name: playerFirst.trim(),
      last_name: playerLast.trim(),
      jersey_number: playerNumber.trim() ? Number(playerNumber) : null,
      position: playerPosition.trim() || null,
      active: true,
    });

    if (res.error) setMessage(res.error.message);
    else {
      setPlayerFirst("");
      setPlayerLast("");
      setPlayerNumber("");
      setPlayerPosition("");
      await refresh();
    }

    setSaving(false);
  }

  async function addFormation() {
    if (!team || !formationSetup.trim()) return;
    await findOrCreateFormation(formationSetup);
    setFormationSetup("");
  }

  async function addPlay() {
    if (!team || !playSetup.trim()) return;
    await findOrCreatePlay(playSetup, playSetupType);
    setPlaySetup("");
    setPlaySetupType("Run");
  }

  async function deleteRow(table: string, id: string) {
    setSaving(true);
    const res = await supabase.from(table).delete().eq("id", id);
    if (res.error) setMessage(res.error.message);
    else if (table === "coachboard_analytics_play_chart" && selectedGameId) await loadChart(selectedGameId);
    else await refresh();
    setSaving(false);
  }

  function updateEntry(key: keyof typeof entry, value: string) {
    setEntry((current) => ({ ...current, [key]: value }));
  }

  function keySave(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      savePlay();
    }
  }

  const selectedGame = useMemo(() => games.find((game) => game.id === selectedGameId) ?? null, [games, selectedGameId]);
  const stats = useMemo(() => calculateStats(chartPlays), [chartPlays]);

  const playReport = useMemo(() => makeReport(chartPlays, (row) => row.play_id, (id) => plays.find((item) => item.id === id)?.name ?? "Unknown"), [chartPlays, plays]);
  const formationReport = useMemo(() => makeReport(chartPlays, (row) => row.formation_id, (id) => formations.find((item) => item.id === id)?.name ?? "Unknown"), [chartPlays, formations]);
  const formationPlayReport = useMemo(
    () =>
      makeReport(
        chartPlays,
        (row) => `${row.formation_id ?? "none"}|${row.play_id ?? "none"}`,
        (id) => {
          const [formationId, playId] = id.split("|");
          const formation = formations.find((item) => item.id === formationId)?.name ?? "Unknown";
          const play = plays.find((item) => item.id === playId)?.name ?? "Unknown";
          return `${formation} — ${play}`;
        },
      ),
    [chartPlays, formations, plays],
  );

  const topPlayers = useMemo(() => makePlayerReport(chartPlays, players), [chartPlays, players]);
  const matrix = useMemo(() => buildMatrix(chartPlays, formations, plays), [chartPlays, formations, plays]);

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
        <Link href="/" style={backButtonStyle}>Back to CoachBoard</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={subTitleStyle}>{selectedGame ? `Week ${selectedGame.week ?? "-"} vs ${selectedGame.opponent}` : "Create a game to start charting."}</p>
        </div>
        <Link href="/" style={backButtonStyle}>Back to CoachBoard</Link>
      </header>

      {message && <div style={messageStyle}>{message}</div>}

      <nav style={navStyle}>
        <NavButton label="Live Sheet" active={activeSection === "command"} onClick={() => setActiveSection("command")} />
        <NavButton label="Setup" active={activeSection === "setup"} onClick={() => setActiveSection("setup")} />
        <NavButton label="Games" active={activeSection === "games"} onClick={() => setActiveSection("games")} />
        <NavButton label="Reports" active={activeSection === "reports"} onClick={() => setActiveSection("reports")} />
      </nav>

      {activeSection === "command" && (
        <>
          <section style={scoreboardStyle}>
            <Stat title="Total Yards" value={stats.yards} />
            <Stat title="Rush Yards" value={stats.rushYards} />
            <Stat title="Pass Yards" value={stats.passYards} />
            <Stat title="Total Plays" value={stats.total} />
            <Stat title="TDs" value={stats.tds} />
            <Stat title="Turnovers" value={stats.turnovers} bad={stats.turnovers > 0} />
            <Stat title="1st Downs" value={stats.firstDowns} />
            <Stat title="Sacks" value={stats.sacks} />
            <Stat title="Penalties" value={stats.penalties} />
            <Stat title="Success" value={`${stats.successRate}%`} />
            <Stat title="Explosive" value={`${stats.explosiveRate}%`} />
            <Stat title="Avg" value={stats.averageYards} />
          </section>

          <section style={commandGridStyle}>
            <div style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Play Entry</h2>
                <select style={{ ...inputStyle, maxWidth: 280 }} value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}>
                  <option value="">Select Game</option>
                  {games.map((game) => <option key={game.id} value={game.id}>Week {game.week ?? "-"} vs {game.opponent}</option>)}
                </select>
              </div>

              <div style={entrySheetStyle}>
                <SheetInput label="D & Dist" value={entry.dd} onChange={(value) => updateEntry("dd", value)} onKeyDown={keySave} />
                <SheetInput label="Formation" value={entry.formation} onChange={(value) => updateEntry("formation", value)} onKeyDown={keySave} list="formations" />
                <SheetInput label="Play" value={entry.play} onChange={(value) => updateEntry("play", value)} onKeyDown={keySave} list="plays" />
                <SheetInput label="Yardage" value={entry.yards} onChange={(value) => updateEntry("yards", value)} onKeyDown={keySave} />
                <SheetInput label="Rusher" value={entry.rusher} onChange={(value) => updateEntry("rusher", value)} onKeyDown={keySave} list="players" />
                <SheetInput label="Passer" value={entry.passer} onChange={(value) => updateEntry("passer", value)} onKeyDown={keySave} list="players" />
                <SheetInput label="Receiver" value={entry.receiver} onChange={(value) => updateEntry("receiver", value)} onKeyDown={keySave} list="players" />
                <SheetInput label="Result" value={entry.result} onChange={(value) => updateEntry("result", value)} onKeyDown={keySave} placeholder="TD / INT / FUM" />
                <SheetInput label="Q" value={entry.qtr} onChange={(value) => updateEntry("qtr", value)} onKeyDown={keySave} />
                <SheetInput label="Ball" value={entry.ball} onChange={(value) => updateEntry("ball", value)} onKeyDown={keySave} />
                <SheetInput label="Hash" value={entry.hash} onChange={(value) => updateEntry("hash", value)} onKeyDown={keySave} />
              </div>

              <datalist id="formations">{formations.map((item) => <option key={item.id} value={item.name} />)}</datalist>
              <datalist id="plays">{plays.map((item) => <option key={item.id} value={item.name} />)}</datalist>
              <datalist id="players">{players.map((item) => <option key={item.id} value={playerLabel(item)} />)}</datalist>

              <button style={saveButtonStyle} onClick={savePlay} disabled={saving}>SAVE PLAY</button>

              <div style={tableWrapStyle}>
                <table style={sheetTableStyle}>
                  <thead>
                    <tr>
                      <th style={sheetThStyle}>#</th>
                      <th style={sheetThStyle}>D & Dist</th>
                      <th style={sheetThStyle}>Formation</th>
                      <th style={sheetThStyle}>Play</th>
                      <th style={sheetThStyle}>Yardage</th>
                      <th style={sheetThStyle}>Rusher</th>
                      <th style={sheetThStyle}>Passer</th>
                      <th style={sheetThStyle}>Receiver</th>
                      <th style={sheetThStyle}>Result</th>
                      <th style={sheetThStyle}>Grade</th>
                      <th style={sheetThStyle}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartPlays.map((row) => {
                      const grade = classify(row);
                      return (
                        <tr key={row.id} style={rowStyleForGrade(grade)}>
                          <td style={sheetTdStyle}>{row.play_number}</td>
                          <td style={sheetTdStyle}>{row.down} and {row.distance}</td>
                          <td style={sheetTdStyle}>{formationNameById(formations, row.formation_id)}</td>
                          <td style={sheetTdStyle}>{playNameById(plays, row.play_id)}</td>
                          <td style={sheetTdStyle}>{row.yards}</td>
                          <td style={sheetTdStyle}>{playerShort(players, row.ball_carrier_id)}</td>
                          <td style={sheetTdStyle}>{playerShort(players, row.passer_id)}</td>
                          <td style={sheetTdStyle}>{playerShort(players, row.receiver_id)}</td>
                          <td style={sheetTdStyle}>{row.touchdown ? "TD" : row.turnover ? "TO" : row.penalty ? "PEN" : ""}</td>
                          <td style={sheetTdStyle}><span style={{ ...badgeStyle, ...badgeFor(grade) }}>{gradeLabel(grade)}</span></td>
                          <td style={sheetTdStyle}><button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_play_chart", row.id)}>Delete</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside style={sideGridStyle}>
              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>Recommendations</h2>
                <Rec title="Best Play" row={playReport[0]} />
                <Rec title="Best Formation" row={formationReport[0]} />
                <Rec title="Best Formation + Play" row={formationPlayReport[0]} />
              </div>

              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>Individual Stats</h2>
                {topPlayers.slice(0, 8).map((item) => (
                  <div key={item.id} style={playerStatRowStyle}>
                    <strong>{item.label}</strong>
                    <span>{item.touches} touches • {item.yards} yds • {item.avg.toFixed(1)} avg • {item.tds} TD</span>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Formation / Play Matrix</h2>
            <div style={tableWrapStyle}>
              <table style={sheetTableStyle}>
                <thead>
                  <tr>
                    <th style={sheetThStyle}>Play</th>
                    {matrix.formations.map((formation) => <th key={formation} style={sheetThStyle}>{formation}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.plays.map((play) => (
                    <tr key={play}>
                      <td style={sheetTdStyle}>{play}</td>
                      {matrix.formations.map((formation) => {
                        const cell = matrix.cells[`${play}|${formation}`];
                        return <td key={`${play}-${formation}`} style={sheetTdStyle}>{cell ? `${cell.calls} / ${cell.yards}` : ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeSection === "games" && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Games</h2>
          <div style={formThreeStyle}>
            <input style={inputStyle} placeholder="Week" value={newWeek} onChange={(event) => setNewWeek(event.target.value)} />
            <input style={inputStyle} placeholder="Opponent" value={newOpponent} onChange={(event) => setNewOpponent(event.target.value)} />
            <input style={inputStyle} type="date" value={newGameDate} onChange={(event) => setNewGameDate(event.target.value)} />
          </div>
          <button style={primaryButtonStyle} onClick={addGame} disabled={saving}>Add Game</button>
          <List>
            {games.map((game) => (
              <Row key={game.id}>
                <span>Week {game.week ?? "-"} vs {game.opponent}{game.game_date ? ` • ${game.game_date}` : ""}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={smallActionButtonStyle} onClick={() => { setSelectedGameId(game.id); setActiveSection("command"); }}>Open</button>
                  <button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_games", game.id)}>Delete</button>
                </div>
              </Row>
            ))}
          </List>
        </section>
      )}

      {activeSection === "setup" && (
        <section style={setupGridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Team</h2>
            <div style={formTwoStyle}>
              <input style={inputStyle} value={teamName} onChange={(event) => setTeamName(event.target.value)} />
              <input style={inputStyle} type="number" value={season} onChange={(event) => setSeason(Number(event.target.value))} />
            </div>
            <button style={primaryButtonStyle} onClick={saveTeam} disabled={saving}>Save Team</button>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Players</h2>
            <div style={formFourStyle}>
              <input style={inputStyle} placeholder="First" value={playerFirst} onChange={(event) => setPlayerFirst(event.target.value)} />
              <input style={inputStyle} placeholder="Last" value={playerLast} onChange={(event) => setPlayerLast(event.target.value)} />
              <input style={inputStyle} placeholder="Number" value={playerNumber} onChange={(event) => setPlayerNumber(event.target.value)} />
              <input style={inputStyle} placeholder="Position" value={playerPosition} onChange={(event) => setPlayerPosition(event.target.value)} />
            </div>
            <button style={primaryButtonStyle} onClick={addPlayer} disabled={saving}>Add Player</button>
            <List>{players.map((item) => <Row key={item.id}><span>{playerLabel(item)}</span><button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_players", item.id)}>Delete</button></Row>)}</List>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Formations</h2>
            <div style={inlineFormStyle}>
              <input style={inputStyle} placeholder="Formation" value={formationSetup} onChange={(event) => setFormationSetup(event.target.value)} />
              <button style={primaryButtonStyleNoMargin} onClick={addFormation} disabled={saving}>Add</button>
            </div>
            <List>{formations.map((item) => <Row key={item.id}><span>{item.name}</span><button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_formations", item.id)}>Delete</button></Row>)}</List>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Plays</h2>
            <div style={formTwoStyle}>
              <input style={inputStyle} placeholder="Play" value={playSetup} onChange={(event) => setPlaySetup(event.target.value)} />
              <select style={inputStyle} value={playSetupType} onChange={(event) => setPlaySetupType(event.target.value as PlayType)}>
                <option value="Run">Run</option>
                <option value="Pass">Pass</option>
                <option value="RPO">RPO</option>
                <option value="Screen">Screen</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button style={primaryButtonStyle} onClick={addPlay} disabled={saving}>Add Play</button>
            <List>{plays.map((item) => <Row key={item.id}><span>{item.name} <span style={tagStyle}>{item.play_type}</span></span><button style={dangerButtonStyle} onClick={() => deleteRow("coachboard_analytics_plays", item.id)}>Delete</button></Row>)}</List>
          </div>
        </section>
      )}

      {activeSection === "reports" && (
        <section style={reportsGridStyle}>
          <Report title="Best Plays" rows={playReport} />
          <Report title="Best Formations" rows={formationReport} />
          <Report title="Best Formation + Play" rows={formationPlayReport} />
        </section>
      )}
    </main>
  );
}

function parseDownDistance(value: string) {
  const nums = value.match(/\d+/g)?.map(Number) ?? [];
  return { down: nums[0] || 1, distance: nums[1] || 10 };
}

function nextDownDistance(current: string, yards: number) {
  const { down, distance } = parseDownDistance(current);
  if (yards >= distance) return "1 and 10";
  const nextDown = down + 1;
  if (nextDown > 4) return "1 and 10";
  return `${nextDown} and ${Math.max(1, distance - yards)}`;
}

function detectType(entry: { rusher: string; passer: string; receiver: string; play: string }) {
  const play = entry.play.toLowerCase();
  if (entry.passer.trim() || entry.receiver.trim()) return "Pass";
  if (play.includes("pass") || play.includes("mesh") || play.includes("screen") || play.includes("verts") || play.includes("slant")) return "Pass";
  return "Run";
}

function normalizeType(value: string | null | undefined): PlayType {
  if (value === "Run" || value === "Pass" || value === "RPO" || value === "Screen" || value === "Other") return value;
  return "Run";
}

function classify(row: Pick<ChartPlay, "play_type" | "yards">): Grade {
  const yards = row.yards ?? 0;
  const type = normalizeType(row.play_type);
  if (yards <= 0) return "negative";
  if (type === "Run") {
    if (yards >= RUN_EXPLOSIVE) return "explosive";
    if (yards >= RUN_SUCCESS) return "success";
    return "normal";
  }
  if (yards >= PASS_EXPLOSIVE) return "explosive";
  if (yards >= PASS_SUCCESS) return "success";
  return "normal";
}

function calculateStats(rows: ChartPlay[]) {
  const total = rows.length;
  const success = rows.filter((row) => ["success", "explosive"].includes(classify(row))).length;
  const explosive = rows.filter((row) => classify(row) === "explosive").length;
  const yards = rows.reduce((sum, row) => sum + (row.yards ?? 0), 0);
  const rushRows = rows.filter((row) => normalizeType(row.play_type) === "Run");
  const passRows = rows.filter((row) => normalizeType(row.play_type) !== "Run");

  return {
    total,
    yards,
    rushYards: rushRows.reduce((sum, row) => sum + (row.yards ?? 0), 0),
    passYards: passRows.reduce((sum, row) => sum + (row.yards ?? 0), 0),
    tds: rows.filter((row) => row.touchdown).length,
    turnovers: rows.filter((row) => row.turnover).length,
    firstDowns: rows.filter((row) => row.first_down).length,
    sacks: rows.filter((row) => (row.notes ?? "").toLowerCase().includes("sack")).length,
    penalties: rows.filter((row) => row.penalty).length,
    successRate: total ? Math.round((success / total) * 100) : 0,
    explosiveRate: total ? Math.round((explosive / total) * 100) : 0,
    averageYards: total ? (yards / total).toFixed(1) : "0.0",
  };
}

function makeReport(rows: ChartPlay[], keyGetter: (row: ChartPlay) => string | null | undefined, labelGetter: (id: string) => string): ReportRow[] {
  const groups = new Map<string, ChartPlay[]>();
  rows.forEach((row) => {
    const key = keyGetter(row);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries()).map(([id, items]) => {
    const yards = items.reduce((sum, item) => sum + (item.yards ?? 0), 0);
    const success = items.filter((item) => ["success", "explosive"].includes(classify(item))).length;
    const explosive = items.filter((item) => classify(item) === "explosive").length;
    return {
      id,
      label: labelGetter(id),
      calls: items.length,
      yards,
      avg: items.length ? yards / items.length : 0,
      success,
      explosive,
      successRate: items.length ? Math.round((success / items.length) * 100) : 0,
      explosiveRate: items.length ? Math.round((explosive / items.length) * 100) : 0,
    };
  }).sort((a, b) => b.successRate - a.successRate || b.avg - a.avg || b.calls - a.calls);
}

function makePlayerReport(rows: ChartPlay[], players: Player[]) {
  return players.map((player) => {
    const touches = rows.filter((row) => row.ball_carrier_id === player.id || row.receiver_id === player.id);
    const yards = touches.reduce((sum, row) => sum + (row.yards ?? 0), 0);
    return {
      id: player.id,
      label: playerLabel(player),
      touches: touches.length,
      yards,
      avg: touches.length ? yards / touches.length : 0,
      tds: touches.filter((row) => row.touchdown).length,
    };
  }).filter((item) => item.touches > 0).sort((a, b) => b.yards - a.yards);
}

function buildMatrix(rows: ChartPlay[], formations: Formation[], plays: Play[]) {
  const formationNames = Array.from(new Set(rows.map((row) => formationNameById(formations, row.formation_id)).filter(Boolean)));
  const playNames = Array.from(new Set(rows.map((row) => playNameById(plays, row.play_id)).filter(Boolean)));
  const cells: Record<string, { calls: number; yards: number }> = {};

  rows.forEach((row) => {
    const play = playNameById(plays, row.play_id);
    const formation = formationNameById(formations, row.formation_id);
    const key = `${play}|${formation}`;
    cells[key] = cells[key] ?? { calls: 0, yards: 0 };
    cells[key].calls += 1;
    cells[key].yards += row.yards ?? 0;
  });

  return { formations: formationNames, plays: playNames, cells };
}

function playerLabel(player: Player) {
  const num = player.jersey_number ?? "-";
  return `#${num} ${player.first_name} ${player.last_name}${player.position ? ` (${player.position})` : ""}`;
}

function playerShort(players: Player[], id: string | null) {
  const player = players.find((item) => item.id === id);
  return player ? `${player.first_name[0]}. ${player.last_name} (${player.jersey_number ?? "-"})` : "";
}

function formationNameById(formations: Formation[], id: string | null) {
  return formations.find((item) => item.id === id)?.name ?? "";
}

function playNameById(plays: Play[], id: string | null) {
  return plays.find((item) => item.id === id)?.name ?? "";
}

function gradeLabel(grade: Grade) {
  if (grade === "negative") return "NEG";
  if (grade === "explosive") return "BIG";
  if (grade === "success") return "OK";
  return "";
}

function badgeFor(grade: Grade): React.CSSProperties {
  if (grade === "negative") return { color: "#fecaca", borderColor: "#ef4444", background: "rgba(239,68,68,.18)" };
  if (grade === "explosive") return { color: "#fde68a", borderColor: "#facc15", background: "rgba(250,204,21,.18)" };
  if (grade === "success") return { color: "#bbf7d0", borderColor: "#22c55e", background: "rgba(34,197,94,.18)" };
  return { color: "#e5e7eb", borderColor: "rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)" };
}

function rowStyleForGrade(grade: Grade): React.CSSProperties {
  if (grade === "negative") return { background: "rgba(239,68,68,.10)" };
  if (grade === "explosive") return { background: "rgba(250,204,21,.14)" };
  if (grade === "success") return { background: "rgba(34,197,94,.10)" };
  return {};
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...navButtonStyle, ...(active ? navButtonActiveStyle : {}) }}>{label}</button>;
}

function Stat({ title, value, bad }: { title: string; value: string | number; bad?: boolean }) {
  return <div style={statStyle}><div style={statTitleStyle}>{title}</div><div style={{ ...statValueStyle, color: bad ? "#ef4444" : "white" }}>{value}</div></div>;
}

function SheetInput({ label, value, onChange, onKeyDown, placeholder, list }: { label: string; value: string; onChange: (value: string) => void; onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void; placeholder?: string; list?: string }) {
  return (
    <label style={sheetInputWrapStyle}>
      <span style={sheetInputWrapHeaderStyle}>{label}</span>
      <input style={sheetInputStyle} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} list={list} autoComplete="off" />
    </label>
  );
}

function Rec({ title, row }: { title: string; row?: ReportRow }) {
  return <div style={recStyle}><div style={eyebrowStyle}>{title}</div><strong>{row?.label ?? "-"}</strong><span>{row ? `${row.calls} calls • ${row.avg.toFixed(1)} avg • ${row.successRate}% success • ${row.explosiveRate}% big` : "No data yet"}</span></div>;
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={listStyle}>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={listRowStyle}>{children}</div>;
}

function Report({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <div style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div style={tableWrapStyle}>
        <table style={sheetTableStyle}>
          <thead><tr><th style={sheetThStyle}>Name</th><th style={sheetThStyle}>Calls</th><th style={sheetThStyle}>Yards</th><th style={sheetThStyle}>Avg</th><th style={sheetThStyle}>Success</th><th style={sheetThStyle}>Big</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td style={sheetTdStyle}>{row.label}</td><td style={sheetTdStyle}>{row.calls}</td><td style={sheetTdStyle}>{row.yards}</td><td style={sheetTdStyle}>{row.avg.toFixed(1)}</td><td style={sheetTdStyle}>{row.successRate}%</td><td style={sheetTdStyle}>{row.explosiveRate}%</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  color: "#0f172a",
  padding: 14,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #d7dce5",
  boxShadow: "0 10px 28px rgba(15,23,42,.08)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  fontSize: 36,
  lineHeight: 1,
  margin: "6px 0 4px",
  fontWeight: 950,
  letterSpacing: "-.04em",
  color: "#111827",
};

const subTitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  marginTop: 4,
};

const backButtonStyle: React.CSSProperties = {
  color: "#111827",
  textDecoration: "none",
  background: "#f8fafc",
  border: "1px solid #d7dce5",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 900,
};

const messageStyle: React.CSSProperties = {
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  borderRadius: 12,
  padding: 10,
  marginBottom: 12,
  fontWeight: 850,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 12,
  padding: 6,
  width: "fit-content",
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #d7dce5",
  boxShadow: "0 8px 22px rgba(15,23,42,.06)",
};

const navButtonStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "9px 13px",
  background: "transparent",
  color: "#475569",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 13,
};

const navButtonActiveStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "white",
  border: "1px solid #b91c1c",
};

const scoreboardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(92px, 1fr))",
  gap: 0,
  marginBottom: 10,
  overflowX: "auto",
  border: "2px solid #1f2937",
  background: "#1f2937",
};

const statStyle: React.CSSProperties = {
  background: "#fff200",
  color: "#111827",
  borderRight: "2px solid #1f2937",
  padding: "7px 8px",
  textAlign: "center",
  minHeight: 58,
};

const statTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 950,
  color: "#111827",
  whiteSpace: "nowrap",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 21,
  fontWeight: 950,
  marginTop: 2,
  color: "#111827",
};

const commandGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(340px, .55fr)",
  gap: 10,
  marginBottom: 10,
};

const sideGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 10px 28px rgba(15,23,42,.08)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 21,
  margin: 0,
  fontWeight: 950,
  letterSpacing: "-.025em",
  color: "#111827",
};

const entrySheetStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "110px 145px 150px 90px 78px 78px 88px 96px 54px 68px 68px",
  gap: 0,
  overflowX: "auto",
  border: "2px solid #111827",
  background: "#111827",
};

const sheetInputWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  color: "#111827",
  fontWeight: 950,
  fontSize: 12,
  minWidth: 60,
};

const sheetInputWrapHeaderStyle: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#111827",
  borderRight: "2px solid #111827",
  borderBottom: "2px solid #111827",
  padding: "6px 6px",
  textAlign: "center",
  fontWeight: 950,
};

const sheetInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "0",
  borderRight: "2px solid #111827",
  borderRadius: 0,
  padding: "8px 7px",
  fontSize: 15,
  fontWeight: 800,
  color: "#111827",
  background: "#ffffff",
  outline: "2px solid transparent",
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: "13px 16px",
  borderRadius: 12,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 16,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  marginTop: 10,
  border: "2px solid #111827",
  background: "#111827",
};

const sheetTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
  background: "#ffffff",
  color: "#111827",
};

const sheetThStyle: React.CSSProperties = {
  padding: "7px 6px",
  background: "#e5e7eb",
  border: "2px solid #111827",
  fontSize: 12,
  fontWeight: 950,
  color: "#111827",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const sheetTdStyle: React.CSSProperties = {
  padding: "6px 6px",
  border: "2px solid #111827",
  fontSize: 13,
  fontWeight: 700,
  textAlign: "center",
  color: "#111827",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 7px",
  fontSize: 10,
  fontWeight: 950,
};

const recStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 10,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #d7dce5",
  marginTop: 10,
};

const playerStatRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "8px 0",
  borderBottom: "1px solid #e5e7eb",
  color: "#111827",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 11px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
  fontSize: 14,
  fontWeight: 750,
};

const setupGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: 10,
};

const reportsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 10,
};

const formFourStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8,
};

const formThreeStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 8,
};

const formTwoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 8,
};

const inlineFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 8,
  alignItems: "stretch",
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const primaryButtonStyleNoMargin: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const smallActionButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 8,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  cursor: "pointer",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 12,
};

const listRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 11px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #d7dce5",
  color: "#111827",
};

const tagStyle: React.CSSProperties = {
  marginLeft: 8,
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};
