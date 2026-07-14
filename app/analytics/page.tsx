"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Section = "command" | "setup" | "games" | "reports";
type GameCenterSection = "offense" | "defense" | "specialTeams";
type PlayType = "Run" | "Pass" | "Punt" | "RPO" | "Screen" | "Other";
type Grade = "negative" | "normal" | "success" | "explosive";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  jersey: string;
  position: string;
};

type Formation = {
  id: string;
  name: string;
};

type PlayCall = {
  id: string;
  name: string;
  type: PlayType;
};

type Game = {
  id: string;
  week: string;
  opponent: string;
  date: string;
};

type Possession = {
  id: string;
  gameId: string;
  startQuarter: number;
  startClock: string;
  endQuarter: number | null;
  endClock: string;
  durationSeconds: number;
  result: string;
  createdAt: string;
};

type SpecialTeamsType =
  | "Punt"
  | "Field Goal"
  | "Kickoff"
  | "Kick Return"
  | "Punt Return"
  | "Extra Point";

type SpecialTeamsEvent = {
  id: string;
  gameId: string;
  type: SpecialTeamsType;
  player: string;
  yards: number | null;
  made: boolean | null;
  touchback: boolean;
  touchdown: boolean;
  quarter: string;
  clock: string;
  notes: string;
  createdAt: string;
};

type DefensiveEvent = {
  id: string;
  gameId: string;
  player: string;
  soloTackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptions: number;
  passBreakups: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  defensiveTouchdowns: number;
  createdAt: string;
};

type ChartPlay = {
  id: string;
  gameId: string;
  playNumber: number;
  quarter: string;
  down: number;
  distance: number;
  formation: string;
  play: string;
  playType: PlayType;
  yards: number;
  rusher: string;
  passer: string;
  receiver: string;
  result: string;
  touchdown: boolean;
  firstDown: boolean;
  seriesStart: boolean;
  turnover: boolean;
  penalty: boolean;
  penaltyType: string;
  createdAt: string;
};

type EntryState = {
  dd: string;
  formation: string;
  play: string;
  yards: string;
  rusher: string;
  passer: string;
  receiver: string;
  result: string;
  penalty: string;
  seriesStart: boolean;
  possessionStart: boolean;
  possessionEnd: boolean;
  possessionClock: string;
  qtr: string;
};

type SavedState = {
  players: Player[];
  formations: Formation[];
  plays: PlayCall[];
  games: Game[];
  chartPlays: ChartPlay[];
  possessions: Possession[];
  specialTeamsEvents: SpecialTeamsEvent[];
  defensiveEvents: DefensiveEvent[];
  selectedGameId: string;
  quarterLengthMinutes: number;
};

type ReportRow = {
  id: string;
  label: string;
  calls: number;
  yards: number;
  avg: number;
  successRate: number;
  explosiveRate: number;
};

const STORAGE_KEY = "coachboard_analytics_local_v1";

const RUN_SUCCESS = 4;
const PASS_SUCCESS = 12;
const RUN_EXPLOSIVE = 10;
const PASS_EXPLOSIVE = 25;

const defaultGames: Game[] = [
  {
    id: createId(),
    week: "1",
    opponent: "Live Game",
    date: "",
  },
];

export default function AnalyticsPage() {
  const [activeSection, setActiveSection] = useState<Section>("command");
  const [gameCenterSection, setGameCenterSection] = useState<GameCenterSection>("offense");
  const [reportScope, setReportScope] = useState<"game" | "season">("game");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [plays, setPlays] = useState<PlayCall[]>([]);
  const [games, setGames] = useState<Game[]>(defaultGames);
  const [chartPlays, setChartPlays] = useState<ChartPlay[]>([]);
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [specialTeamsEvents, setSpecialTeamsEvents] = useState<SpecialTeamsEvent[]>([]);
  const [defensiveEvents, setDefensiveEvents] = useState<DefensiveEvent[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(defaultGames[0].id);
  const [quarterLengthMinutes, setQuarterLengthMinutes] = useState(12);

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

  const [specialTeamsEntry, setSpecialTeamsEntry] = useState({
    type: "Punt" as SpecialTeamsType,
    player: "",
    yards: "",
    result: "",
    quarter: "1",
    clock: "",
    notes: "",
  });

  const [defenseEntry, setDefenseEntry] = useState({
    player: "",
    soloTackles: "",
    assistedTackles: "",
    tacklesForLoss: "",
    sacks: "",
    interceptions: "",
    passBreakups: "",
    forcedFumbles: "",
    fumbleRecoveries: "",
    defensiveTouchdowns: "",
  });

  const [entry, setEntry] = useState<EntryState>({
    dd: "1 and 10",
    formation: "",
    play: "",
    yards: "",
    rusher: "",
    passer: "",
    receiver: "",
    result: "",
    penalty: "",
    seriesStart: false,
    possessionStart: false,
    possessionEnd: false,
    possessionClock: "",
    qtr: "1",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as SavedState;

      const savedPlayers = saved.players ?? [];

      setPlayers(savedPlayers);
      setFormations(saved.formations ?? []);
      setPlays(saved.plays ?? []);

      const savedGames = saved.games?.length ? saved.games : defaultGames;
      const savedChartPlays = (saved.chartPlays ?? []).map((play) => ({
        ...play,
        rusher: resolvePlayerInput(play.rusher, savedPlayers),
        passer: resolvePlayerInput(play.passer, savedPlayers),
        receiver: resolvePlayerInput(play.receiver, savedPlayers),
        penaltyType: play.penaltyType ?? "",
        seriesStart: play.seriesStart ?? false,
      }));

      setGames(savedGames);
      setChartPlays(savedChartPlays);
      setPossessions(saved.possessions ?? []);
      setSpecialTeamsEvents(saved.specialTeamsEvents ?? []);
      setDefensiveEvents(saved.defensiveEvents ?? []);
      setQuarterLengthMinutes(saved.quarterLengthMinutes === 15 ? 15 : 12);
      setSelectedGameId(saved.selectedGameId || savedGames[0].id);
    } catch {
      setMessage("Could not load saved analytics data.");
    }
  }, []);

  useEffect(() => {
    const state: SavedState = {
      players,
      formations,
      plays,
      games,
      chartPlays,
      possessions,
      specialTeamsEvents,
      defensiveEvents,
      selectedGameId,
      quarterLengthMinutes,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setMessage("Could not save analytics data in this browser.");
    }
  }, [
    players,
    formations,
    plays,
    games,
    chartPlays,
    possessions,
    specialTeamsEvents,
    defensiveEvents,
    selectedGameId,
    quarterLengthMinutes,
  ]);

  const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0];

  const currentGamePlays = useMemo(
    () =>
      chartPlays
        .filter((play) => play.gameId === selectedGameId)
        .sort((a, b) => a.playNumber - b.playNumber),
    [chartPlays, selectedGameId],
  );

  const currentGamePossessions = useMemo(
    () =>
      possessions
        .filter((possession) => possession.gameId === selectedGameId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [possessions, selectedGameId],
  );

  const seasonPossessions = useMemo(
    () => possessions,
    [possessions],
  );

  const currentGameSpecialTeams = useMemo(
    () => specialTeamsEvents.filter((event) => event.gameId === selectedGameId),
    [specialTeamsEvents, selectedGameId],
  );

  const currentGameDefense = useMemo(
    () => defensiveEvents.filter((event) => event.gameId === selectedGameId),
    [defensiveEvents, selectedGameId],
  );

  const reportSpecialTeams =
    reportScope === "season" ? specialTeamsEvents : currentGameSpecialTeams;

  const reportDefense =
    reportScope === "season" ? defensiveEvents : currentGameDefense;

  const specialTeamsStats = useMemo(
    () => calculateSpecialTeamsStats(currentGameSpecialTeams),
    [currentGameSpecialTeams],
  );

  const defenseStats = useMemo(
    () => calculateDefenseStats(currentGameDefense),
    [currentGameDefense],
  );

  const seasonPlays = useMemo(
    () =>
      [...chartPlays].sort((a, b) => {
        const gameA = games.find((game) => game.id === a.gameId);
        const gameB = games.find((game) => game.id === b.gameId);
        const weekA = Number(gameA?.week ?? 0);
        const weekB = Number(gameB?.week ?? 0);

        if (weekA !== weekB) return weekA - weekB;
        return a.playNumber - b.playNumber;
      }),
    [chartPlays, games],
  );

  const reportPlays = reportScope === "season" ? seasonPlays : currentGamePlays;

  const stats = useMemo(() => calculateStats(currentGamePlays), [currentGamePlays]);
  const reportStats = useMemo(() => calculateStats(reportPlays), [reportPlays]);

  const gamePossessionStats = useMemo(
    () => calculatePossessionStats(currentGamePossessions),
    [currentGamePossessions],
  );

  const reportPossessions =
    reportScope === "season" ? seasonPossessions : currentGamePossessions;

  const reportPossessionStats = useMemo(
    () => calculatePossessionStats(reportPossessions),
    [reportPossessions],
  );

  const playReport = useMemo(
    () => makeReport(reportPlays, (row) => row.play),
    [reportPlays],
  );

  const formationReport = useMemo(
    () => makeReport(reportPlays, (row) => row.formation),
    [reportPlays],
  );

  const formationPlayReport = useMemo(
    () => makeReport(reportPlays, (row) => `${row.formation} — ${row.play}`),
    [reportPlays],
  );

  const playerReport = useMemo(
    () => makeGameCenterPlayerReport(currentGamePlays),
    [currentGamePlays],
  );

  const rushingReport = useMemo(
    () => makeRushingReport(reportPlays),
    [reportPlays],
  );

  const passingReport = useMemo(
    () => makePassingReport(reportPlays),
    [reportPlays],
  );

  const receivingReport = useMemo(
    () => makeReceivingReport(reportPlays),
    [reportPlays],
  );

  const matrix = useMemo(() => buildMatrix(currentGamePlays), [currentGamePlays]);

  const penaltyReport = useMemo(
    () => makePenaltyReport(reportPlays),
    [reportPlays],
  );

  const gameBreakdown = useMemo(
    () =>
      games
        .map((game) => {
          const rows = chartPlays.filter((play) => play.gameId === game.id);
          return {
            game,
            stats: calculateStats(rows),
          };
        })
        .filter((item) => item.stats.total > 0)
        .sort((a, b) => Number(a.game.week || 0) - Number(b.game.week || 0)),
    [games, chartPlays],
  );

  function updateEntry(key: keyof EntryState, value: string) {
    setEntry((current) => ({ ...current, [key]: value }));
  }

  function handleEnterSave(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      savePlay();
    }
  }

  function addFormation(name: string) {
    const clean = name.trim();
    if (!clean) return clean;

    const existing = formations.find(
      (formation) => formation.name.toLowerCase() === clean.toLowerCase(),
    );

    if (existing) return existing.name;

    const newFormation: Formation = {
      id: createId(),
      name: clean,
    };

    setFormations((current) =>
      [...current, newFormation].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return clean;
  }

  function addPlayCall(name: string, type: PlayType) {
    const clean = name.trim();
    if (!clean) return clean;

    const existing = plays.find(
      (play) => play.name.toLowerCase() === clean.toLowerCase(),
    );

    if (existing) return existing.name;

    const newPlay: PlayCall = {
      id: createId(),
      name: clean,
      type,
    };

    setPlays((current) =>
      [...current, newPlay].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return clean;
  }

  function savePlay() {
    setMessage("");

    if (!selectedGameId) {
      const newGame: Game = {
        id: createId(),
        week: `${games.length + 1}`,
        opponent: "Live Game",
        date: "",
      };

      setGames((current) => [...current, newGame]);
      setSelectedGameId(newGame.id);
    }

    const resultUpper = entry.result.trim().toUpperCase();
    const isPunt = resultUpper.includes("PUNT");
    const yards = entry.yards.trim() === "" && isPunt ? 0 : Number(entry.yards);

    if ((entry.possessionStart || entry.possessionEnd) && !entry.possessionClock.trim()) {
      setMessage("Enter the game clock for the possession action.");
      return;
    }

    if (entry.possessionClock.trim()) {
      const clockSeconds = parseClockToSeconds(entry.possessionClock);
      const quarterSeconds = quarterLengthMinutes * 60;

      if (clockSeconds === null || clockSeconds > quarterSeconds) {
        setMessage(
          `Enter a valid clock time between 0:00 and ${quarterLengthMinutes}:00.`,
        );
        return;
      }
    }

    if (Number.isNaN(yards) || (entry.yards.trim() === "" && !isPunt)) {
      setMessage("Type yards before saving. Punt yards may be left blank.");
      return;
    }

    const formationName = addFormation(entry.formation || "Base");
    const playType = detectPlayType(entry);
    const playName = addPlayCall(entry.play || "Unknown Play", playType);

    const parsed = parseDownDistance(entry.dd);
    const result = entry.result.trim().toUpperCase();
    const penaltyText = entry.penalty.trim();
    const penaltyCode = penaltyText.toUpperCase();
    const isInterception = result.includes("INT");
    const isFumble = result.includes("FUM");
    const isTurnover = isInterception || isFumble || result.includes("TO");
    const isTouchdown = result.includes("TD");
    const isPenalty = Boolean(penaltyText) || result.includes("PEN");

    const nextPlayNumber =
      currentGamePlays.length === 0
        ? 1
        : Math.max(...currentGamePlays.map((play) => play.playNumber)) + 1;

    const savedPlay: ChartPlay = {
      id: createId(),
      gameId: selectedGameId,
      playNumber: nextPlayNumber,
      quarter: entry.qtr || "1",
      down: parsed.down,
      distance: parsed.distance,
      formation: formationName,
      play: playName,
      playType,
      yards,
      rusher: resolvePlayerInput(entry.rusher, players),
      passer: resolvePlayerInput(entry.passer, players),
      receiver: resolvePlayerInput(entry.receiver, players),
      result:
        [
          isTouchdown ? "TD" : "",
          isInterception ? "INT" : "",
          isFumble ? "FUM" : "",
          !isTouchdown && !isTurnover && result ? result : "",
        ]
          .filter(Boolean)
          .join(" "),
      touchdown: isTouchdown,
      firstDown:
        !entry.seriesStart &&
        (result.includes("FD") || (!isPenalty && yards >= parsed.distance)),
      seriesStart: entry.seriesStart,
      turnover: isTurnover,
      penalty: isPenalty,
      penaltyType: penaltyText || (result.includes("PEN") ? "Penalty" : ""),
      createdAt: new Date().toISOString(),
    };

    setSaving(true);

    const quarterNumber = Number(entry.qtr) || 1;
    const normalizedPossessionClock = entry.possessionClock.trim()
      ? normalizeClock(entry.possessionClock)
      : "";

    if (entry.possessionStart) {
      const alreadyOpen = getOpenPossession(selectedGameId);

      if (alreadyOpen) {
        setMessage("A possession is already open. End it before starting another.");
        setSaving(false);
        return;
      }

      const openPossession: Possession = {
        id: createId(),
        gameId: selectedGameId,
        startQuarter: quarterNumber,
        startClock: normalizedPossessionClock,
        endQuarter: null,
        endClock: "",
        durationSeconds: 0,
        result: "",
        createdAt: new Date().toISOString(),
      };

      setPossessions((current) => [...current, openPossession]);
    }

    if (entry.possessionEnd) {
      const openPossession = getOpenPossession(selectedGameId);

      if (!openPossession) {
        setMessage("There is no open possession to end.");
        setSaving(false);
        return;
      }

      const durationSeconds = calculatePossessionDuration(
        openPossession.startQuarter,
        openPossession.startClock,
        quarterNumber,
        normalizedPossessionClock,
        quarterLengthMinutes,
      );

      if (durationSeconds === null || durationSeconds <= 0) {
        setMessage("The possession end must occur after the possession start.");
        setSaving(false);
        return;
      }

      setPossessions((current) =>
        current.map((possession) =>
          possession.id === openPossession.id
            ? {
                ...possession,
                endQuarter: quarterNumber,
                endClock: normalizedPossessionClock,
                durationSeconds,
                result: entry.result.trim() || "Drive End",
              }
            : possession,
        ),
      );
    }

    setChartPlays((current) => [...current, savedPlay]);

    if (isPunt) {
      const puntEvent: SpecialTeamsEvent = {
        id: createId(),
        gameId: selectedGameId,
        type: "Punt",
        player: "",
        yards: entry.yards.trim() === "" ? null : yards,
        made: null,
        touchback: false,
        touchdown: false,
        quarter: entry.qtr || "1",
        clock: entry.possessionClock.trim(),
        notes: "Recorded from offensive drive",
        createdAt: new Date().toISOString(),
      };

      setSpecialTeamsEvents((current) => [...current, puntEvent]);
    }

    setEntry((current) => ({
      ...current,
      formation: formationName,
      dd: nextDownDistance(current.dd, yards),
      play: "",
      yards: "",
      rusher: "",
      passer: "",
      receiver: "",
      result: "",
      penalty: "",
      seriesStart: false,
      possessionStart: false,
      possessionEnd: false,
      possessionClock: "",
    }));

    setMessage(`Saved play #${nextPlayNumber}.`);
    window.setTimeout(() => setSaving(false), 150);
  }

  function deletePossession(id: string) {
    setPossessions((current) =>
      current.filter((possession) => possession.id !== id),
    );
  }

  function getOpenPossession(gameId: string) {
    const gamePossessions = possessions
      .filter((possession) => possession.gameId === gameId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return gamePossessions.find((possession) => !possession.endClock) ?? null;
  }

  function saveSpecialTeamsEvent() {
    if (!selectedGameId) {
      setMessage("Select a game first.");
      return;
    }

    const yards =
      specialTeamsEntry.yards.trim() === ""
        ? null
        : Number(specialTeamsEntry.yards);

    if (yards !== null && Number.isNaN(yards)) {
      setMessage("Special teams yards must be a number or left blank.");
      return;
    }

    const result = specialTeamsEntry.result.trim().toUpperCase();
    const type = specialTeamsEntry.type;

    const event: SpecialTeamsEvent = {
      id: createId(),
      gameId: selectedGameId,
      type,
      player: resolvePlayerInput(specialTeamsEntry.player, players),
      yards,
      made:
        type === "Field Goal" || type === "Extra Point"
          ? result.includes("GOOD") || result.includes("MADE")
          : null,
      touchback: result.includes("TB") || result.includes("TOUCHBACK"),
      touchdown: result.includes("TD"),
      quarter: specialTeamsEntry.quarter || "1",
      clock: specialTeamsEntry.clock.trim(),
      notes:
        specialTeamsEntry.notes.trim() ||
        specialTeamsEntry.result.trim(),
      createdAt: new Date().toISOString(),
    };

    setSpecialTeamsEvents((current) => [...current, event]);
    setSpecialTeamsEntry((current) => ({
      ...current,
      player: "",
      yards: "",
      result: "",
      clock: "",
      notes: "",
    }));
    setMessage(`${type} recorded.`);
  }

  function deleteSpecialTeamsEvent(id: string) {
    setSpecialTeamsEvents((current) =>
      current.filter((event) => event.id !== id),
    );
  }

  function saveDefensiveEvent() {
    if (!selectedGameId) {
      setMessage("Select a game first.");
      return;
    }

    const player = resolvePlayerInput(defenseEntry.player, players);

    if (!player) {
      setMessage("Enter a defensive player's jersey number.");
      return;
    }

    const numberValue = (value: string) => {
      const parsed = Number(value || 0);
      return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    };

    const event: DefensiveEvent = {
      id: createId(),
      gameId: selectedGameId,
      player,
      soloTackles: numberValue(defenseEntry.soloTackles),
      assistedTackles: numberValue(defenseEntry.assistedTackles),
      tacklesForLoss: numberValue(defenseEntry.tacklesForLoss),
      sacks: numberValue(defenseEntry.sacks),
      interceptions: numberValue(defenseEntry.interceptions),
      passBreakups: numberValue(defenseEntry.passBreakups),
      forcedFumbles: numberValue(defenseEntry.forcedFumbles),
      fumbleRecoveries: numberValue(defenseEntry.fumbleRecoveries),
      defensiveTouchdowns: numberValue(defenseEntry.defensiveTouchdowns),
      createdAt: new Date().toISOString(),
    };

    setDefensiveEvents((current) => [...current, event]);
    setDefenseEntry({
      player: "",
      soloTackles: "",
      assistedTackles: "",
      tacklesForLoss: "",
      sacks: "",
      interceptions: "",
      passBreakups: "",
      forcedFumbles: "",
      fumbleRecoveries: "",
      defensiveTouchdowns: "",
    });
    setMessage("Defensive stats recorded.");
  }

  function deleteDefensiveEvent(id: string) {
    setDefensiveEvents((current) =>
      current.filter((event) => event.id !== id),
    );
  }

  function addGame() {
    if (!newOpponent.trim()) {
      setMessage("Type an opponent.");
      return;
    }

    const newGame: Game = {
      id: createId(),
      week: newWeek.trim() || `${games.length + 1}`,
      opponent: newOpponent.trim(),
      date: newGameDate,
    };

    setGames((current) => [...current, newGame]);
    setSelectedGameId(newGame.id);
    setNewWeek("");
    setNewOpponent("");
    setNewGameDate("");
    setActiveSection("command");
    setMessage("Game added.");
  }

  function addPlayer() {
    if (!playerFirst.trim() && !playerNumber.trim()) {
      setMessage("Type at least a first name or jersey number.");
      return;
    }

    const newPlayer: Player = {
      id: createId(),
      firstName: playerFirst.trim() || "Player",
      lastName: playerLast.trim(),
      jersey: playerNumber.trim(),
      position: playerPosition.trim(),
    };

    setPlayers((current) =>
      [...current, newPlayer].sort((a, b) =>
        Number(a.jersey || 999) - Number(b.jersey || 999),
      ),
    );

    setPlayerFirst("");
    setPlayerLast("");
    setPlayerNumber("");
    setPlayerPosition("");
    setMessage("Player added.");
  }

  function addSetupFormation() {
    if (!formationSetup.trim()) {
      setMessage("Type a formation.");
      return;
    }

    addFormation(formationSetup);
    setFormationSetup("");
    setMessage("Formation added.");
  }

  function addSetupPlay() {
    if (!playSetup.trim()) {
      setMessage("Type a play.");
      return;
    }

    addPlayCall(playSetup, playSetupType);
    setPlaySetup("");
    setPlaySetupType("Run");
    setMessage("Play added.");
  }

  function deletePlay(id: string) {
    setChartPlays((current) => current.filter((play) => play.id !== id));
  }

  function deleteGame(id: string) {
    const remaining = games.filter((game) => game.id !== id);
    const nextGames = remaining.length ? remaining : defaultGames;

    setGames(nextGames);
    setChartPlays((current) => current.filter((play) => play.gameId !== id));
    setPossessions((current) =>
      current.filter((possession) => possession.gameId !== id),
    );
    setSpecialTeamsEvents((current) =>
      current.filter((event) => event.gameId !== id),
    );
    setDefensiveEvents((current) =>
      current.filter((event) => event.gameId !== id),
    );
    setSelectedGameId(nextGames[0].id);
  }

  function deletePlayer(id: string) {
    setPlayers((current) => current.filter((player) => player.id !== id));
  }

  function deleteFormation(id: string) {
    const target = formations.find((formation) => formation.id === id);
    setFormations((current) => current.filter((formation) => formation.id !== id));

    if (target) {
      setChartPlays((current) =>
        current.map((play) =>
          play.formation === target.name ? { ...play, formation: "" } : play,
        ),
      );
    }
  }

  function deleteSetupPlay(id: string) {
    const target = plays.find((play) => play.id === id);
    setPlays((current) => current.filter((play) => play.id !== id));

    if (target) {
      setChartPlays((current) =>
        current.map((chartPlay) =>
          chartPlay.play === target.name ? { ...chartPlay, play: "" } : chartPlay,
        ),
      );
    }
  }

  function clearAllData() {
    if (!window.confirm("Clear all analytics data stored in this browser?")) return;

    setPlayers([]);
    setFormations([]);
    setPlays([]);
    setGames(defaultGames);
    setChartPlays([]);
    setPossessions([]);
    setSpecialTeamsEvents([]);
    setDefensiveEvents([]);
    setQuarterLengthMinutes(12);
    setSelectedGameId(defaultGames[0].id);
    setMessage("Analytics data cleared.");
  }

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={subTitleStyle}>
            {selectedGame
              ? `Week ${selectedGame.week} vs ${selectedGame.opponent}`
              : "Live Game"}
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
          active={activeSection === "command"}
          onClick={() => {
            setActiveSection("command");
            setGameCenterSection("offense");
          }}
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

      {activeSection === "command" && (
        <div style={gameCenterSubnavStyle}>
          <button
            style={{
              ...gameCenterSubnavButtonStyle,
              ...(gameCenterSection === "offense"
                ? gameCenterSubnavButtonActiveStyle
                : {}),
            }}
            onClick={() => setGameCenterSection("offense")}
          >
            Offense
          </button>

          <button
            style={{
              ...gameCenterSubnavButtonStyle,
              ...(gameCenterSection === "defense"
                ? gameCenterSubnavButtonActiveStyle
                : {}),
            }}
            onClick={() => setGameCenterSection("defense")}
          >
            Defense
          </button>

          <button
            style={{
              ...gameCenterSubnavButtonStyle,
              ...(gameCenterSection === "specialTeams"
                ? gameCenterSubnavButtonActiveStyle
                : {}),
            }}
            onClick={() => setGameCenterSection("specialTeams")}
          >
            Special Teams
          </button>
        </div>
      )}

      {activeSection === "command" && gameCenterSection === "offense" && (
        <>
          <section style={topMetricGridStyle}>
            <Metric label="Total Yards" value={stats.yards} />
            <Metric label="Rush" value={stats.rushYards} />
            <Metric label="Pass" value={stats.passYards} />
            <Metric label="Plays" value={stats.total} />
            <Metric label="TDs" value={stats.tds} />
            <Metric label="Turnovers" value={stats.turnovers} danger={stats.turnovers > 0} />
            <Metric label="Penalties" value={stats.penalties} danger={stats.penalties > 0} />
            <Metric label="1st Downs Earned" value={stats.firstDownsEarned} />
            <Metric label="Series Starts" value={stats.seriesStarts} />
            <Metric label="Success" value={`${stats.successRate}%`} />
            <Metric label="Explosive" value={`${stats.explosiveRate}%`} />
            <Metric label="Average" value={stats.averageYards} />
            <Metric label="Time of Possession" value={formatDuration(gamePossessionStats.totalSeconds)} />
          </section>

          <section style={mainGridStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderRowStyle}>
                <div>
                  <div style={smallRedStyle}>LIVE CHART</div>
                  <h2 style={panelTitleStyle}>Play Entry</h2>
                </div>

                <select
                  style={gameSelectStyle}
                  value={selectedGameId}
                  onChange={(event) => setSelectedGameId(event.target.value)}
                >
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      Week {game.week} vs {game.opponent}
                    </option>
                  ))}
                </select>
              </div>

              <div className="analytics-entry-grid" style={entryBarStyle}>
                <div style={downDistanceGroupStyle}>
                  <label style={seriesCheckboxStyle}>
                    <input
                      type="checkbox"
                      checked={entry.seriesStart}
                      onChange={(event) =>
                        setEntry((current) => ({
                          ...current,
                          seriesStart: event.target.checked,
                        }))
                      }
                    />
                    <span style={{ textAlign: "left" }}>Start of Series</span>
                  </label>

                  <SheetInput
                    label="D & Dist"
                    value={entry.dd}
                    onChange={(value) => updateEntry("dd", value)}
                    onKeyDown={handleEnterSave}
                  />
                </div>
                <SheetInput
                  label="Formation"
                  value={entry.formation}
                  onChange={(value) => updateEntry("formation", value)}
                  onKeyDown={handleEnterSave}
                  list="formation-options"
                  wide
                />
                <SheetInput
                  label="Play"
                  value={entry.play}
                  onChange={(value) => updateEntry("play", value)}
                  onKeyDown={handleEnterSave}
                  list="play-options"
                  wide
                />
                <SheetInput
                  label="Yards"
                  value={entry.yards}
                  onChange={(value) => updateEntry("yards", value)}
                  onKeyDown={handleEnterSave}
                />
                <SheetInput
                  label="Rusher"
                  value={entry.rusher}
                  onChange={(value) => updateEntry("rusher", value)}
                  onKeyDown={handleEnterSave}
                  list="player-options"
                  placeholder="#"
                />
                <SheetInput
                  label="Passer"
                  value={entry.passer}
                  onChange={(value) => updateEntry("passer", value)}
                  onKeyDown={handleEnterSave}
                  list="player-options"
                  placeholder="#"
                />
                <SheetInput
                  label="Receiver"
                  value={entry.receiver}
                  onChange={(value) => updateEntry("receiver", value)}
                  onKeyDown={handleEnterSave}
                  list="player-options"
                  placeholder="#"
                />
                <SheetInput
                  label="Result"
                  value={entry.result}
                  onChange={(value) => updateEntry("result", value)}
                  onKeyDown={handleEnterSave}
                  placeholder="TD / INT / FUM / Punt"
                  wide
                />
                <SheetInput
                  label="Penalty"
                  value={entry.penalty}
                  onChange={(value) => updateEntry("penalty", value)}
                  onKeyDown={handleEnterSave}
                  placeholder="Hold / False Start"
                  wide
                />

              </div>

              <datalist id="formation-options">
                {formations.map((formation) => (
                  <option key={formation.id} value={formation.name} />
                ))}
              </datalist>

              <datalist id="play-options">
                {plays.map((play) => (
                  <option key={play.id} value={play.name} />
                ))}
              </datalist>

              <datalist id="player-options">
                {players.map((player) => (
                  <option key={player.id} value={playerLabel(player)} />
                ))}
              </datalist>

              <div style={possessionInlinePanelStyle}>
                <div style={possessionInlineHeaderStyle}>
                  <span>Possession</span>

                  <div style={quarterLengthControlStyle}>
                    <span>Quarter Length</span>
                    <button
                      type="button"
                      style={{
                        ...quarterLengthButtonStyle,
                        ...(quarterLengthMinutes === 12
                          ? quarterLengthButtonActiveStyle
                          : {}),
                      }}
                      onClick={() => setQuarterLengthMinutes(12)}
                    >
                      12 Min
                    </button>
                    <button
                      type="button"
                      style={{
                        ...quarterLengthButtonStyle,
                        ...(quarterLengthMinutes === 15
                          ? quarterLengthButtonActiveStyle
                          : {}),
                      }}
                      onClick={() => setQuarterLengthMinutes(15)}
                    >
                      15 Min
                    </button>
                  </div>
                </div>

                <div className="analytics-possession-grid" style={possessionInlineGridStyle}>
                  <button
                    type="button"
                    style={{
                      ...possessionToggleStyle,
                      ...(entry.possessionStart
                        ? possessionStartActiveStyle
                        : {}),
                    }}
                    onClick={() =>
                      setEntry((current) => ({
                        ...current,
                        possessionStart: !current.possessionStart,
                        possessionEnd: false,
                      }))
                    }
                  >
                    {entry.possessionStart
                      ? "START POSSESSION ✓"
                      : "START POSSESSION"}
                  </button>

                  <button
                    type="button"
                    style={{
                      ...possessionToggleStyle,
                      ...(entry.possessionEnd ? possessionEndActiveStyle : {}),
                    }}
                    onClick={() =>
                      setEntry((current) => ({
                        ...current,
                        possessionEnd: !current.possessionEnd,
                        possessionStart: false,
                      }))
                    }
                  >
                    {entry.possessionEnd
                      ? "END POSSESSION ✓"
                      : "END POSSESSION"}
                  </button>

                  <label style={possessionFieldStyle}>
                    <span>Quarter</span>
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      max="4"
                      value={entry.qtr}
                      onChange={(event) =>
                        updateEntry("qtr", event.target.value)
                      }
                    />
                  </label>

                  <label style={possessionFieldStyle}>
                    <span>Game Clock</span>
                    <input
                      style={inputStyle}
                      placeholder={
                        quarterLengthMinutes === 12 ? "12:00" : "15:00"
                      }
                      value={entry.possessionClock}
                      onChange={(event) =>
                        updateEntry("possessionClock", event.target.value)
                      }
                    />
                  </label>

                </div>
              </div>

              <div style={saveRowStyle}>
                <button style={saveButtonStyle} onClick={savePlay} disabled={saving}>
                  {saving ? "SAVED" : "SAVE PLAY"}
                </button>
              </div>

              <div style={tableWrapStyle}>
                <table style={modernTableStyle}>
                  <thead>
                    <tr>
                      <th style={modernThStyle}>#</th>
                      <th style={modernThStyle}>D & Dist</th>
                      <th style={modernThStyle}>Formation</th>
                      <th style={modernThStyle}>Play</th>
                      <th style={modernThStyle}>Yards</th>
                      <th style={modernThStyle}>Rusher</th>
                      <th style={modernThStyle}>Passer</th>
                      <th style={modernThStyle}>Receiver</th>
                      <th style={modernThStyle}>Series</th>
                      <th style={modernThStyle}>1st Down</th>
                      <th style={modernThStyle}>Result</th>
                      <th style={modernThStyle}>Penalty</th>
                      <th style={modernThStyle}>Grade</th>
                      <th style={modernThStyle}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentGamePlays.length === 0 && (
                      <tr>
                        <td style={emptyTdStyle} colSpan={14}>
                          No plays entered yet. Type a play and press SAVE PLAY.
                        </td>
                      </tr>
                    )}

                    {currentGamePlays.map((row) => {
                      const grade = classify(row);

                      return (
                        <tr key={row.id} style={rowStyleForGrade(grade)}>
                          <td style={modernTdStyle}>{row.playNumber}</td>
                          <td style={modernTdStyle}>
                            {row.down} and {row.distance}
                          </td>
                          <td style={modernTdStyle}>{row.formation}</td>
                          <td style={modernTdStyle}>{row.play}</td>
                          <td style={modernTdStyle}>{row.yards}</td>
                          <td style={modernTdStyle}>{row.rusher}</td>
                          <td style={modernTdStyle}>{row.passer}</td>
                          <td style={modernTdStyle}>{row.receiver}</td>
                          <td style={modernTdStyle}>
                            {row.seriesStart ? (
                              <span style={seriesPillStyle}>START</span>
                            ) : (
                              ""
                            )}
                          </td>
                          <td style={modernTdStyle}>
                            {row.firstDown ? (
                              <span style={earnedFirstDownPillStyle}>EARNED</span>
                            ) : (
                              ""
                            )}
                          </td>
                          <td style={modernTdStyle}>
                            {row.playType === "Punt"
                              ? "PUNT"
                              : row.touchdown
                                ? "TD"
                              : row.result.includes("INT")
                                ? "INT"
                                : row.result.includes("FUM")
                                  ? "FUM"
                                  : row.result}
                          </td>
                          <td style={modernTdStyle}>{row.penaltyType}</td>
                          <td style={modernTdStyle}>
                            <span style={{ ...pillStyle, ...pillFor(grade) }}>
                              {gradeLabel(grade)}
                            </span>
                          </td>
                          <td style={modernTdStyle}>
                            <button
                              style={miniDeleteButtonStyle}
                              onClick={() => deletePlay(row.id)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside style={rightRailStyle}>
              <div style={panelStyle}>
                <div style={smallRedStyle}>CALL IT NOW</div>
                <Recommendation title="Best Play" row={playReport[0]} />
                <Recommendation title="Best Formation" row={formationReport[0]} />
                <Recommendation
                  title="Best Formation + Play"
                  row={formationPlayReport[0]}
                />
              </div>

              <div style={panelStyle}>
                <div style={smallRedStyle}>INDIVIDUAL STATS</div>
                {playerReport.length === 0 && (
                  <p style={mutedTextStyle}>Stats will appear after plays are entered.</p>
                )}

                {playerReport.slice(0, 10).map((player) => (
                  <div key={player.id} style={compactPlayerRowStyle}>
                    <strong>{player.label}</strong>

                    <div style={individualStatGridStyle}>
                      <div style={individualStatBoxStyle}>
                        <span>Rushing</span>
                        <b>{player.rushes} rushes</b>
                        <small>{player.rushingYards} yards</small>
                      </div>

                      <div style={individualStatBoxStyle}>
                        <span>Passing</span>
                        <b>{player.passAttempts} attempts</b>
                        <small>{player.passingYards} yards</small>
                      </div>

                      <div style={individualStatBoxStyle}>
                        <span>Receiving</span>
                        <b>{player.receptions} receptions</b>
                        <small>{player.receivingYards} yards</small>
                      </div>
                    </div>

                    <small style={individualStatDetailStyle}>
                      {player.totalYards} combined rushing/receiving yards • {player.tds} TD
                    </small>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderRowStyle}>
              <div>
                <div style={smallRedStyle}>POSSESSION TRACKER</div>
                <h2 style={panelTitleStyle}>Time of Possession</h2>
              </div>

              <div style={quarterLengthControlStyle}>
                <span>Quarter Length</span>
                <button
                  style={{
                    ...quarterLengthButtonStyle,
                    ...(quarterLengthMinutes === 12
                      ? quarterLengthButtonActiveStyle
                      : {}),
                  }}
                  onClick={() => setQuarterLengthMinutes(12)}
                >
                  12 Min
                </button>
                <button
                  style={{
                    ...quarterLengthButtonStyle,
                    ...(quarterLengthMinutes === 15
                      ? quarterLengthButtonActiveStyle
                      : {}),
                  }}
                  onClick={() => setQuarterLengthMinutes(15)}
                >
                  15 Min
                </button>
              </div>
            </div>

            <div style={possessionMetricGridStyle}>
              <Metric
                label="Total Possession"
                value={formatDuration(gamePossessionStats.totalSeconds)}
              />
              <Metric
                label="Possessions"
                value={gamePossessionStats.count}
              />
              <Metric
                label="Average Drive"
                value={formatDuration(gamePossessionStats.averageSeconds)}
              />
              <Metric
                label="Longest Drive"
                value={formatDuration(gamePossessionStats.longestSeconds)}
              />
            </div>

            <p style={mutedTextStyle}>
              Start and end possessions directly inside Play Entry. The completed
              drive will appear below automatically.
            </p>

            <div style={tableWrapStyle}>
              <table style={modernTableStyle}>
                <thead>
                  <tr>
                    <th style={modernThStyle}>#</th>
                    <th style={modernThStyle}>Start</th>
                    <th style={modernThStyle}>End</th>
                    <th style={modernThStyle}>Duration</th>
                    <th style={modernThStyle}>Result</th>
                    <th style={modernThStyle}></th>
                  </tr>
                </thead>

                <tbody>
                  {currentGamePossessions.length === 0 && (
                    <tr>
                      <td style={emptyTdStyle} colSpan={6}>
                        No possessions recorded yet.
                      </td>
                    </tr>
                  )}

                  {currentGamePossessions.map((possession, index) => (
                    <tr key={possession.id}>
                      <td style={modernTdStyle}>{index + 1}</td>
                      <td style={modernTdStyle}>
                        Q{possession.startQuarter} {possession.startClock}
                      </td>
                      <td style={modernTdStyle}>
                        {possession.endQuarter
                          ? `Q${possession.endQuarter} ${possession.endClock}`
                          : "OPEN"}
                      </td>
                      <td style={modernTdStyle}>
                        {possession.endClock
                          ? formatDuration(possession.durationSeconds)
                          : "In Progress"}
                      </td>
                      <td style={modernTdStyle}>{possession.result}</td>
                      <td style={modernTdStyle}>
                        <button
                          style={miniDeleteButtonStyle}
                          onClick={() => deletePossession(possession.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderRowStyle}>
              <div>
                <div style={smallRedStyle}>LIVE MATRIX</div>
                <h2 style={panelTitleStyle}>Formation / Play Results</h2>
              </div>
            </div>

            <div style={tableWrapStyle}>
              <table style={modernTableStyle}>
                <thead>
                  <tr>
                    <th style={modernThStyle}>Play</th>
                    {matrix.formations.map((formation) => (
                      <th key={formation} style={modernThStyle}>
                        {formation}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {matrix.plays.length === 0 && (
                    <tr>
                      <td style={emptyTdStyle} colSpan={2}>
                        Matrix will build automatically as you chart plays.
                      </td>
                    </tr>
                  )}

                  {matrix.plays.map((play) => (
                    <tr key={play}>
                      <td style={modernTdStyle}>{play}</td>
                      {matrix.formations.map((formation) => {
                        const cell = matrix.cells[`${play}|${formation}`];
                        return (
                          <td key={`${play}-${formation}`} style={modernTdStyle}>
                            {cell ? `${cell.calls} / ${cell.yards}` : ""}
                          </td>
                        );
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
        <section style={panelStyle}>
          <div style={smallRedStyle}>SCHEDULE</div>
          <h2 style={panelTitleStyle}>Games</h2>

          <div style={formThreeStyle}>
            <input
              style={inputStyle}
              placeholder="Week"
              value={newWeek}
              onChange={(event) => setNewWeek(event.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Opponent"
              value={newOpponent}
              onChange={(event) => setNewOpponent(event.target.value)}
            />
            <input
              style={inputStyle}
              type="date"
              value={newGameDate}
              onChange={(event) => setNewGameDate(event.target.value)}
            />
          </div>

          <button style={primaryButtonStyle} onClick={addGame}>
            Add Game
          </button>

          <List>
            {games.map((game) => (
              <Row key={game.id}>
                <span>
                  Week {game.week} vs {game.opponent}
                  {game.date ? ` • ${game.date}` : ""}
                </span>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={smallActionButtonStyle}
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setActiveSection("command");
                    }}
                  >
                    Open
                  </button>

                  <button style={dangerButtonStyle} onClick={() => deleteGame(game.id)}>
                    Delete
                  </button>
                </div>
              </Row>
            ))}
          </List>
        </section>
      )}

      {activeSection === "command" && gameCenterSection === "specialTeams" && (
        <section style={panelStyle}>
          <div style={panelHeaderRowStyle}>
            <div>
              <div style={smallRedStyle}>SPECIAL TEAMS</div>
              <h2 style={panelTitleStyle}>Special Teams Entry</h2>
            </div>

            <select
              style={gameSelectStyle}
              value={selectedGameId}
              onChange={(event) => setSelectedGameId(event.target.value)}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  Week {game.week} vs {game.opponent}
                </option>
              ))}
            </select>
          </div>

          <div style={specialTeamsMetricGridStyle}>
            <Metric label="Punts" value={specialTeamsStats.punts} />
            <Metric label="Punt Avg" value={specialTeamsStats.puntAverage} />
            <Metric label="FG" value={`${specialTeamsStats.fieldGoalsMade}/${specialTeamsStats.fieldGoalsAttempted}`} />
            <Metric label="Kickoffs" value={specialTeamsStats.kickoffs} />
            <Metric label="Touchbacks" value={specialTeamsStats.touchbacks} />
            <Metric label="Kick Return Avg" value={specialTeamsStats.kickReturnAverage} />
            <Metric label="Punt Return Avg" value={specialTeamsStats.puntReturnAverage} />
            <Metric label="ST Touchdowns" value={specialTeamsStats.touchdowns} />
          </div>

          <div style={specialTeamsEntryGridStyle}>
            <label style={possessionFieldStyle}>
              <span>Type</span>
              <select
                style={inputStyle}
                value={specialTeamsEntry.type}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    type: event.target.value as SpecialTeamsType,
                  }))
                }
              >
                <option value="Punt">Punt</option>
                <option value="Field Goal">Field Goal</option>
                <option value="Kickoff">Kickoff</option>
                <option value="Kick Return">Kick Return</option>
                <option value="Punt Return">Punt Return</option>
                <option value="Extra Point">Extra Point</option>
              </select>
            </label>

            <label style={possessionFieldStyle}>
              <span>Player #</span>
              <input
                style={inputStyle}
                placeholder="#"
                value={specialTeamsEntry.player}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    player: event.target.value,
                  }))
                }
              />
            </label>

            <label style={possessionFieldStyle}>
              <span>Yards Optional</span>
              <input
                style={inputStyle}
                placeholder="Optional"
                value={specialTeamsEntry.yards}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    yards: event.target.value,
                  }))
                }
              />
            </label>

            <label style={possessionFieldStyle}>
              <span>Result</span>
              <input
                style={inputStyle}
                placeholder="Good / Miss / TB / TD"
                value={specialTeamsEntry.result}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    result: event.target.value,
                  }))
                }
              />
            </label>

            <label style={possessionFieldStyle}>
              <span>Quarter</span>
              <input
                style={inputStyle}
                value={specialTeamsEntry.quarter}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    quarter: event.target.value,
                  }))
                }
              />
            </label>

            <label style={possessionFieldStyle}>
              <span>Clock</span>
              <input
                style={inputStyle}
                placeholder="8:34"
                value={specialTeamsEntry.clock}
                onChange={(event) =>
                  setSpecialTeamsEntry((current) => ({
                    ...current,
                    clock: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <button style={saveButtonStyle} onClick={saveSpecialTeamsEvent}>
            SAVE SPECIAL TEAMS EVENT
          </button>

          <div style={tableWrapStyle}>
            <table style={modernTableStyle}>
              <thead>
                <tr>
                  <th style={modernThStyle}>Type</th>
                  <th style={modernThStyle}>Player</th>
                  <th style={modernThStyle}>Yards</th>
                  <th style={modernThStyle}>Result</th>
                  <th style={modernThStyle}>Q / Clock</th>
                  <th style={modernThStyle}></th>
                </tr>
              </thead>
              <tbody>
                {currentGameSpecialTeams.length === 0 && (
                  <tr>
                    <td style={emptyTdStyle} colSpan={6}>
                      No special teams events recorded.
                    </td>
                  </tr>
                )}
                {currentGameSpecialTeams.map((event) => (
                  <tr key={event.id}>
                    <td style={modernTdStyle}>{event.type}</td>
                    <td style={modernTdStyle}>{event.player || "—"}</td>
                    <td style={modernTdStyle}>
                      {event.yards === null ? "—" : event.yards}
                    </td>
                    <td style={modernTdStyle}>
                      {event.made === true
                        ? "GOOD"
                        : event.made === false
                          ? "MISS"
                          : event.touchback
                            ? "TOUCHBACK"
                            : event.touchdown
                              ? "TD"
                              : event.notes}
                    </td>
                    <td style={modernTdStyle}>
                      Q{event.quarter} {event.clock}
                    </td>
                    <td style={modernTdStyle}>
                      <button
                        style={miniDeleteButtonStyle}
                        onClick={() => deleteSpecialTeamsEvent(event.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "command" && gameCenterSection === "defense" && (
        <section style={panelStyle}>
          <div style={panelHeaderRowStyle}>
            <div>
              <div style={smallRedStyle}>DEFENSE</div>
              <h2 style={panelTitleStyle}>Defensive Stat Entry</h2>
            </div>

            <select
              style={gameSelectStyle}
              value={selectedGameId}
              onChange={(event) => setSelectedGameId(event.target.value)}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  Week {game.week} vs {game.opponent}
                </option>
              ))}
            </select>
          </div>

          <div style={defenseMetricGridStyle}>
            <Metric label="Tackles" value={defenseStats.totalTackles} />
            <Metric label="TFL" value={defenseStats.tacklesForLoss} />
            <Metric label="Sacks" value={defenseStats.sacks} />
            <Metric label="INT" value={defenseStats.interceptions} />
            <Metric label="PBU" value={defenseStats.passBreakups} />
            <Metric label="Forced Fumbles" value={defenseStats.forcedFumbles} />
            <Metric label="Recoveries" value={defenseStats.fumbleRecoveries} />
            <Metric label="Defensive TD" value={defenseStats.defensiveTouchdowns} />
          </div>

          <div style={defenseEntryGridStyle}>
            <label style={possessionFieldStyle}>
              <span>Player #</span>
              <input
                style={inputStyle}
                placeholder="#"
                value={defenseEntry.player}
                onChange={(event) =>
                  setDefenseEntry((current) => ({
                    ...current,
                    player: event.target.value,
                  }))
                }
              />
            </label>

            {[
              ["Solo", "soloTackles"],
              ["Assists", "assistedTackles"],
              ["TFL", "tacklesForLoss"],
              ["Sacks", "sacks"],
              ["INT", "interceptions"],
              ["PBU", "passBreakups"],
              ["FF", "forcedFumbles"],
              ["FR", "fumbleRecoveries"],
              ["TD", "defensiveTouchdowns"],
            ].map(([label, key]) => (
              <label key={key} style={possessionFieldStyle}>
                <span>{label}</span>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={defenseEntry[key as keyof typeof defenseEntry]}
                  onChange={(event) =>
                    setDefenseEntry((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <button style={saveButtonStyle} onClick={saveDefensiveEvent}>
            SAVE DEFENSIVE STATS
          </button>

          <div style={tableWrapStyle}>
            <table style={modernTableStyle}>
              <thead>
                <tr>
                  <th style={modernThStyle}>Player</th>
                  <th style={modernThStyle}>Solo</th>
                  <th style={modernThStyle}>Ast</th>
                  <th style={modernThStyle}>TFL</th>
                  <th style={modernThStyle}>Sack</th>
                  <th style={modernThStyle}>INT</th>
                  <th style={modernThStyle}>PBU</th>
                  <th style={modernThStyle}>FF</th>
                  <th style={modernThStyle}>FR</th>
                  <th style={modernThStyle}>TD</th>
                  <th style={modernThStyle}></th>
                </tr>
              </thead>
              <tbody>
                {currentGameDefense.length === 0 && (
                  <tr>
                    <td style={emptyTdStyle} colSpan={11}>
                      No defensive stats recorded.
                    </td>
                  </tr>
                )}
                {aggregateDefense(currentGameDefense).map((row) => (
                  <tr key={row.player}>
                    <td style={modernTdStyle}>{row.player}</td>
                    <td style={modernTdStyle}>{row.soloTackles}</td>
                    <td style={modernTdStyle}>{row.assistedTackles}</td>
                    <td style={modernTdStyle}>{row.tacklesForLoss}</td>
                    <td style={modernTdStyle}>{row.sacks}</td>
                    <td style={modernTdStyle}>{row.interceptions}</td>
                    <td style={modernTdStyle}>{row.passBreakups}</td>
                    <td style={modernTdStyle}>{row.forcedFumbles}</td>
                    <td style={modernTdStyle}>{row.fumbleRecoveries}</td>
                    <td style={modernTdStyle}>{row.defensiveTouchdowns}</td>
                    <td style={modernTdStyle}>
                      <button
                        style={miniDeleteButtonStyle}
                        onClick={() => deleteDefensiveEvent(row.lastEventId)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "setup" && (
        <section style={setupGridStyle}>
          <div style={panelStyle}>
            <div style={smallRedStyle}>ROSTER</div>
            <h2 style={panelTitleStyle}>Players</h2>

            <div style={formFourStyle}>
              <input
                style={inputStyle}
                placeholder="First"
                value={playerFirst}
                onChange={(event) => setPlayerFirst(event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Last"
                value={playerLast}
                onChange={(event) => setPlayerLast(event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Number"
                value={playerNumber}
                onChange={(event) => setPlayerNumber(event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Position"
                value={playerPosition}
                onChange={(event) => setPlayerPosition(event.target.value)}
              />
            </div>

            <button style={primaryButtonStyle} onClick={addPlayer}>
              Add Player
            </button>

            <List>
              {players.map((player) => (
                <Row key={player.id}>
                  <span>{playerLabel(player)}</span>
                  <button
                    style={dangerButtonStyle}
                    onClick={() => deletePlayer(player.id)}
                  >
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>

          <div style={panelStyle}>
            <div style={smallRedStyle}>OFFENSE</div>
            <h2 style={panelTitleStyle}>Formations</h2>

            <div style={inlineFormStyle}>
              <input
                style={inputStyle}
                placeholder="Formation"
                value={formationSetup}
                onChange={(event) => setFormationSetup(event.target.value)}
              />
              <button style={primaryButtonStyleNoMargin} onClick={addSetupFormation}>
                Add
              </button>
            </div>

            <List>
              {formations.map((formation) => (
                <Row key={formation.id}>
                  <span>{formation.name}</span>
                  <button
                    style={dangerButtonStyle}
                    onClick={() => deleteFormation(formation.id)}
                  >
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>

          <div style={panelStyle}>
            <div style={smallRedStyle}>OFFENSE</div>
            <h2 style={panelTitleStyle}>Plays</h2>

            <div style={formTwoStyle}>
              <input
                style={inputStyle}
                placeholder="Play"
                value={playSetup}
                onChange={(event) => setPlaySetup(event.target.value)}
              />
              <select
                style={inputStyle}
                value={playSetupType}
                onChange={(event) => setPlaySetupType(event.target.value as PlayType)}
              >
                <option value="Run">Run</option>
                <option value="Pass">Pass</option>
                <option value="RPO">RPO</option>
                <option value="Screen">Screen</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button style={primaryButtonStyle} onClick={addSetupPlay}>
              Add Play
            </button>

            <List>
              {plays.map((play) => (
                <Row key={play.id}>
                  <span>
                    {play.name} <span style={tagStyle}>{play.type}</span>
                  </span>
                  <button
                    style={dangerButtonStyle}
                    onClick={() => deleteSetupPlay(play.id)}
                  >
                    Delete
                  </button>
                </Row>
              ))}
            </List>
          </div>

          <div style={panelStyle}>
            <div style={smallRedStyle}>TOOLS</div>
            <h2 style={panelTitleStyle}>Data</h2>
            <button style={dangerButtonStyle} onClick={clearAllData}>
              Clear All Analytics Data
            </button>
          </div>
        </section>
      )}

      {activeSection === "reports" && (
        <section id="analytics-print-area">
          <div className="no-print" style={reportToolbarStyle}>
            <div>
              <div style={smallRedStyle}>REPORT VIEW</div>
              <h2 style={panelTitleStyle}>
                {reportScope === "season" ? "Season Analytics" : "Current Game Analytics"}
              </h2>
            </div>

            <div style={reportToolbarActionsStyle}>
              <div style={scopeToggleStyle}>
                <button
                  style={{
                    ...scopeButtonStyle,
                    ...(reportScope === "game" ? scopeButtonActiveStyle : {}),
                  }}
                  onClick={() => setReportScope("game")}
                >
                  Current Game
                </button>

                <button
                  style={{
                    ...scopeButtonStyle,
                    ...(reportScope === "season" ? scopeButtonActiveStyle : {}),
                  }}
                  onClick={() => setReportScope("season")}
                >
                  Full Season
                </button>
              </div>

              <button style={printButtonStyle} onClick={() => window.print()}>
                Print Report
              </button>
            </div>
          </div>

          <div style={printHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>COACHBOARD ANALYTICS</div>
              <h1 style={{ ...titleStyle, fontSize: 30 }}>
                {reportScope === "season"
                  ? "Season Offensive Analytics Report"
                  : `Week ${selectedGame?.week ?? "-"} vs ${selectedGame?.opponent ?? "Opponent"}`}
              </h1>
            </div>

            <div style={printDateStyle}>
              {new Date().toLocaleDateString()}
            </div>
          </div>

          <section style={reportMetricGridStyle}>
            <Metric label="Total Yards" value={reportStats.yards} />
            <Metric label="Rush Yards" value={reportStats.rushYards} />
            <Metric label="Pass Yards" value={reportStats.passYards} />
            <Metric label="Plays" value={reportStats.total} />
            <Metric label="TDs" value={reportStats.tds} />
            <Metric label="Turnovers" value={reportStats.turnovers} danger={reportStats.turnovers > 0} />
            <Metric label="1st Downs" value={reportStats.firstDownsEarned} />
            <Metric label="Success" value={`${reportStats.successRate}%`} />
            <Metric label="Explosive" value={`${reportStats.explosiveRate}%`} />
            <Metric label="Average" value={reportStats.averageYards} />
            <Metric
              label="Time of Possession"
              value={formatDuration(reportPossessionStats.totalSeconds)}
            />
            <Metric
              label="Avg Possession"
              value={formatDuration(reportPossessionStats.averageSeconds)}
            />
          </section>

          <section style={reportsGridStyle}>
            <FormationPlaySuccessReport rows={formationPlayReport} />

            <PlayerAnalyticsReport
              rushing={rushingReport}
              passing={passingReport}
              receiving={receivingReport}
              scopeLabel={reportScope === "season" ? "Season" : "Current Game"}
            />

            <PenaltyAnalyticsReport rows={penaltyReport} />

            <SpecialTeamsReport events={reportSpecialTeams} />
            <DefenseReport events={reportDefense} />

            <PossessionAnalyticsReport
              possessions={reportPossessions}
              games={games}
              scopeLabel={reportScope === "season" ? "Season" : "Current Game"}
            />

            <Report title="Play Rankings" rows={playReport} />
            <Report title="Formation Rankings" rows={formationReport} />
            <Report title="Formation + Play Rankings" rows={formationPlayReport} />

            {reportScope === "season" && (
              <GameBreakdownReport rows={gameBreakdown} />
            )}
          </section>

          <style jsx global>{`
            @media print {
              body {
                background: white !important;
              }

              body * {
                visibility: hidden !important;
              }

              #analytics-print-area,
              #analytics-print-area * {
                visibility: visible !important;
              }

              #analytics-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 0;
              }

              .no-print {
                display: none !important;
              }

              @page {
                size: landscape;
                margin: 0.35in;
              }
            }
          `}</style>
        </section>
      )}
    </main>
  );
}

function calculateSpecialTeamsStats(events: SpecialTeamsEvent[]) {
  const punts = events.filter((event) => event.type === "Punt");
  const puntYards = punts
    .filter((event) => event.yards !== null)
    .reduce((sum, event) => sum + (event.yards ?? 0), 0);
  const puntWithDistance = punts.filter((event) => event.yards !== null);

  const fieldGoals = events.filter((event) => event.type === "Field Goal");
  const kickReturns = events.filter((event) => event.type === "Kick Return");
  const puntReturns = events.filter((event) => event.type === "Punt Return");

  const average = (rows: SpecialTeamsEvent[]) => {
    const withYards = rows.filter((event) => event.yards !== null);
    if (!withYards.length) return "0.0";
    return (
      withYards.reduce((sum, event) => sum + (event.yards ?? 0), 0) /
      withYards.length
    ).toFixed(1);
  };

  return {
    punts: punts.length,
    puntAverage: puntWithDistance.length
      ? (puntYards / puntWithDistance.length).toFixed(1)
      : "0.0",
    fieldGoalsAttempted: fieldGoals.length,
    fieldGoalsMade: fieldGoals.filter((event) => event.made).length,
    kickoffs: events.filter((event) => event.type === "Kickoff").length,
    touchbacks: events.filter((event) => event.touchback).length,
    kickReturnAverage: average(kickReturns),
    puntReturnAverage: average(puntReturns),
    touchdowns: events.filter((event) => event.touchdown).length,
  };
}

function aggregateDefense(events: DefensiveEvent[]) {
  const groups = new Map<string, DefensiveEvent & { lastEventId: string }>();

  events.forEach((event) => {
    const current = groups.get(event.player);

    if (!current) {
      groups.set(event.player, { ...event, lastEventId: event.id });
      return;
    }

    groups.set(event.player, {
      ...current,
      soloTackles: current.soloTackles + event.soloTackles,
      assistedTackles: current.assistedTackles + event.assistedTackles,
      tacklesForLoss: current.tacklesForLoss + event.tacklesForLoss,
      sacks: current.sacks + event.sacks,
      interceptions: current.interceptions + event.interceptions,
      passBreakups: current.passBreakups + event.passBreakups,
      forcedFumbles: current.forcedFumbles + event.forcedFumbles,
      fumbleRecoveries: current.fumbleRecoveries + event.fumbleRecoveries,
      defensiveTouchdowns:
        current.defensiveTouchdowns + event.defensiveTouchdowns,
      lastEventId: event.id,
    });
  });

  return Array.from(groups.values()).sort(
    (a, b) =>
      b.soloTackles +
      b.assistedTackles -
      (a.soloTackles + a.assistedTackles),
  );
}

function calculateDefenseStats(events: DefensiveEvent[]) {
  const players = aggregateDefense(events);

  return {
    totalTackles: players.reduce(
      (sum, row) => sum + row.soloTackles + row.assistedTackles,
      0,
    ),
    tacklesForLoss: players.reduce((sum, row) => sum + row.tacklesForLoss, 0),
    sacks: players.reduce((sum, row) => sum + row.sacks, 0),
    interceptions: players.reduce((sum, row) => sum + row.interceptions, 0),
    passBreakups: players.reduce((sum, row) => sum + row.passBreakups, 0),
    forcedFumbles: players.reduce((sum, row) => sum + row.forcedFumbles, 0),
    fumbleRecoveries: players.reduce(
      (sum, row) => sum + row.fumbleRecoveries,
      0,
    ),
    defensiveTouchdowns: players.reduce(
      (sum, row) => sum + row.defensiveTouchdowns,
      0,
    ),
  };
}

function parseClockToSeconds(value: string) {
  const clean = value.trim();
  const match = clean.match(/^(\d{1,2}):([0-5]\d)$/);

  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  return minutes * 60 + seconds;
}

function normalizeClock(value: string) {
  const seconds = parseClockToSeconds(value);

  if (seconds === null) return value.trim();

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function calculatePossessionDuration(
  startQuarter: number,
  startClock: string,
  endQuarter: number,
  endClock: string,
  quarterLengthMinutes: number,
) {
  const startSeconds = parseClockToSeconds(startClock);
  const endSeconds = parseClockToSeconds(endClock);
  const quarterSeconds = quarterLengthMinutes * 60;

  if (startSeconds === null || endSeconds === null) return null;
  if (startSeconds > quarterSeconds || endSeconds > quarterSeconds) return null;
  if (endQuarter < startQuarter) return null;

  if (startQuarter === endQuarter) {
    return startSeconds - endSeconds;
  }

  const remainingInStartQuarter = startSeconds;
  const fullQuartersBetween = Math.max(0, endQuarter - startQuarter - 1);
  const elapsedInEndQuarter = quarterSeconds - endSeconds;

  return (
    remainingInStartQuarter +
    fullQuartersBetween * quarterSeconds +
    elapsedInEndQuarter
  );
}

function calculatePossessionStats(possessions: Possession[]) {
  const completed = possessions.filter(
    (possession) => Boolean(possession.endClock) && possession.durationSeconds > 0,
  );

  const totalSeconds = completed.reduce(
    (sum, possession) => sum + possession.durationSeconds,
    0,
  );

  return {
    count: possessions.length,
    completedCount: completed.length,
    totalSeconds,
    averageSeconds: completed.length
      ? Math.round(totalSeconds / completed.length)
      : 0,
    longestSeconds: completed.length
      ? Math.max(...completed.map((possession) => possession.durationSeconds))
      : 0,
  };
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseDownDistance(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  return {
    down: numbers[0] || 1,
    distance: numbers[1] || 10,
  };
}

function nextDownDistance(current: string, yards: number) {
  const parsed = parseDownDistance(current);

  if (yards >= parsed.distance) return "1 and 10";

  const nextDown = parsed.down + 1;
  if (nextDown > 4) return "1 and 10";

  return `${nextDown} and ${Math.max(1, parsed.distance - yards)}`;
}

function detectPlayType(entry: EntryState): PlayType {
  const play = entry.play.toLowerCase();

  if (entry.passer.trim() || entry.receiver.trim()) return "Pass";
  if (
    play.includes("pass") ||
    play.includes("mesh") ||
    play.includes("screen") ||
    play.includes("slant") ||
    play.includes("verts") ||
    play.includes("y cross")
  ) {
    return "Pass";
  }

  return "Run";
}

function resolvePlayerInput(value: string, players: Player[]) {
  const clean = value.trim();
  if (!clean) return "";

  const numberMatch = clean.match(/\d+/);

  if (numberMatch) {
    const jerseyNumber = numberMatch[0];

    const rosterPlayer = players.find(
      (player) => player.jersey.trim() === jerseyNumber,
    );

    if (rosterPlayer) {
      return playerLabel(rosterPlayer);
    }
  }

  const lower = clean.toLowerCase();

  const rosterPlayer = players.find((player) => {
    const fullName = `${player.firstName} ${player.lastName}`.trim().toLowerCase();
    const fullLabel = playerLabel(player).toLowerCase();

    return fullName === lower || fullLabel === lower;
  });

  return rosterPlayer ? playerLabel(rosterPlayer) : clean;
}

function classify(play: ChartPlay): Grade {
  if (play.yards <= 0) return "negative";

  if (play.playType === "Run") {
    if (play.yards >= RUN_EXPLOSIVE) return "explosive";
    if (play.yards >= RUN_SUCCESS) return "success";
    return "normal";
  }

  if (play.yards >= PASS_EXPLOSIVE) return "explosive";
  if (play.yards >= PASS_SUCCESS) return "success";

  return "normal";
}

function isSuccess(play: ChartPlay) {
  const grade = classify(play);
  return grade === "success" || grade === "explosive";
}

function calculateStats(rows: ChartPlay[]) {
  const statisticalRows = rows.filter(
    (play) => !play.penalty && play.playType !== "Punt",
  );
  const total = statisticalRows.length;
  const yards = statisticalRows.reduce((sum, play) => sum + play.yards, 0);
  const rushRows = statisticalRows.filter((play) => play.playType === "Run");
  const passRows = statisticalRows.filter((play) => play.playType !== "Run");
  const successCount = statisticalRows.filter(isSuccess).length;
  const explosiveCount = statisticalRows.filter(
    (play) => classify(play) === "explosive",
  ).length;

  return {
    total,
    chartedPlays: rows.length,
    yards,
    rushYards: rushRows.reduce((sum, play) => sum + play.yards, 0),
    passYards: passRows.reduce((sum, play) => sum + play.yards, 0),
    tds: statisticalRows.filter((play) => play.touchdown).length,
    interceptions: statisticalRows.filter((play) =>
      play.result.toUpperCase().includes("INT"),
    ).length,
    fumbles: statisticalRows.filter((play) =>
      play.result.toUpperCase().includes("FUM"),
    ).length,
    turnovers: statisticalRows.filter((play) => play.turnover).length,
    penalties: rows.filter((play) => play.penalty).length,
    firstDownsEarned: statisticalRows.filter((play) => play.firstDown).length,
    seriesStarts: rows.filter((play) => play.seriesStart).length,
    successRate: total ? Math.round((successCount / total) * 100) : 0,
    explosiveRate: total ? Math.round((explosiveCount / total) * 100) : 0,
    averageYards: total ? (yards / total).toFixed(1) : "0.0",
  };
}

function makeReport(rows: ChartPlay[], keyGetter: (play: ChartPlay) => string): ReportRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows.filter((play) => !play.penalty).forEach((play) => {
    const key = keyGetter(play) || "Unknown";
    groups.set(key, [...(groups.get(key) ?? []), play]);
  });

  return Array.from(groups.entries())
    .map(([label, group]) => {
      const yards = group.reduce((sum, play) => sum + play.yards, 0);
      const successCount = group.filter(isSuccess).length;
      const explosiveCount = group.filter((play) => classify(play) === "explosive").length;

      return {
        id: label,
        label,
        calls: group.length,
        yards,
        avg: group.length ? yards / group.length : 0,
        successRate: group.length ? Math.round((successCount / group.length) * 100) : 0,
        explosiveRate: group.length ? Math.round((explosiveCount / group.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.successRate - a.successRate || b.avg - a.avg || b.calls - a.calls);
}

function makeGameCenterPlayerReport(rows: ChartPlay[]) {
  const players = new Map<
    string,
    {
      id: string;
      label: string;
      rushes: number;
      passAttempts: number;
      receptions: number;
      rushingYards: number;
      passingYards: number;
      receivingYards: number;
      totalYards: number;
      tds: number;
    }
  >();

  function getPlayer(label: string) {
    const clean = label.trim();
    if (!clean) return null;

    const existing = players.get(clean);
    if (existing) return existing;

    const created = {
      id: clean,
      label: clean,
      rushes: 0,
      passAttempts: 0,
      receptions: 0,
      rushingYards: 0,
      passingYards: 0,
      receivingYards: 0,
      totalYards: 0,
      tds: 0,
    };

    players.set(clean, created);
    return created;
  }

  rows.filter((play) => !play.penalty).forEach((play) => {
    if (play.rusher.trim()) {
      const player = getPlayer(play.rusher);

      if (player) {
        player.rushes += 1;
        player.rushingYards += play.yards;
        player.totalYards += play.yards;

        if (play.touchdown) {
          player.tds += 1;
        }
      }
    }

    if (play.passer.trim()) {
      const player = getPlayer(play.passer);

      if (player) {
        player.passAttempts += 1;
        player.passingYards += play.yards;

        if (play.touchdown) {
          player.tds += 1;
        }
      }
    }

    if (play.receiver.trim()) {
      const result = play.result.toUpperCase();
      const completed =
        !result.includes("INC") &&
        !result.includes("INT") &&
        !result.includes("DROP");

      const player = getPlayer(play.receiver);

      if (player && completed) {
        player.receptions += 1;
        player.receivingYards += play.yards;
        player.totalYards += play.yards;

        if (play.touchdown) {
          player.tds += 1;
        }
      }
    }
  });

  return Array.from(players.values()).sort((a, b) => {
    const involvementA = a.rushes + a.passAttempts + a.receptions;
    const involvementB = b.rushes + b.passAttempts + b.receptions;

    if (involvementB !== involvementA) {
      return involvementB - involvementA;
    }

    return b.totalYards - a.totalYards;
  });
}

function makePlayerReport(rows: ChartPlay[]) {
  const groups = new Map<string, ChartPlay[]>();

  rows.forEach((play) => {
    [play.rusher, play.receiver].forEach((name) => {
      if (!name) return;
      groups.set(name, [...(groups.get(name) ?? []), play]);
    });
  });

  return Array.from(groups.entries())
    .map(([label, plays]) => {
      const yards = plays.reduce((sum, play) => sum + play.yards, 0);

      return {
        id: label,
        label,
        touches: plays.length,
        yards,
        avg: plays.length ? yards / plays.length : 0,
        tds: plays.filter((play) => play.touchdown).length,
      };
    })
    .sort((a, b) => b.yards - a.yards);
}

function makePenaltyReport(rows: ChartPlay[]): PenaltyStatRow[] {
  const penalties = rows.filter((play) => play.penalty);
  const groups = new Map<string, number>();

  penalties.forEach((play) => {
    const label = play.penaltyType.trim() || "Penalty";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  });

  return Array.from(groups.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: penalties.length
        ? Math.round((count / penalties.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function makeRushingReport(rows: ChartPlay[]): RushingStatRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows.forEach((play) => {
    const player = play.rusher.trim();
    if (!player) return;
    groups.set(player, [...(groups.get(player) ?? []), play]);
  });

  return Array.from(groups.entries())
    .map(([player, plays]) => {
      const yards = plays.reduce((sum, play) => sum + play.yards, 0);
      const successes = plays.filter(isSuccess).length;
      const explosives = plays.filter((play) => classify(play) === "explosive").length;

      return {
        player,
        carries: plays.length,
        yards,
        average: plays.length ? yards / plays.length : 0,
        touchdowns: plays.filter((play) => play.touchdown).length,
        firstDowns: plays.filter((play) => play.firstDown).length,
        successes,
        successRate: plays.length ? Math.round((successes / plays.length) * 100) : 0,
        explosives,
        explosiveRate: plays.length ? Math.round((explosives / plays.length) * 100) : 0,
        longest: plays.length ? Math.max(...plays.map((play) => play.yards)) : 0,
      };
    })
    .sort((a, b) => b.yards - a.yards || b.average - a.average);
}

function makePassingReport(rows: ChartPlay[]): PassingStatRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows.forEach((play) => {
    const player = play.passer.trim();
    if (!player) return;
    groups.set(player, [...(groups.get(player) ?? []), play]);
  });

  return Array.from(groups.entries())
    .map(([player, plays]) => {
      const attempts = plays.length;
      const completions = plays.filter((play) => {
        const result = play.result.toUpperCase();
        return Boolean(play.receiver.trim()) && !result.includes("INC") && !result.includes("INT");
      }).length;
      const yards = plays.reduce((sum, play) => sum + play.yards, 0);
      const successes = plays.filter(isSuccess).length;
      const explosives = plays.filter((play) => classify(play) === "explosive").length;

      return {
        player,
        attempts,
        completions,
        completionRate: attempts ? Math.round((completions / attempts) * 100) : 0,
        yards,
        yardsPerAttempt: attempts ? yards / attempts : 0,
        touchdowns: plays.filter((play) => play.touchdown).length,
        interceptions: plays.filter((play) => play.result.toUpperCase().includes("INT")).length,
        successes,
        successRate: attempts ? Math.round((successes / attempts) * 100) : 0,
        explosives,
        longest: plays.length ? Math.max(...plays.map((play) => play.yards)) : 0,
      };
    })
    .sort((a, b) => b.yards - a.yards || b.yardsPerAttempt - a.yardsPerAttempt);
}

function makeReceivingReport(rows: ChartPlay[]): ReceivingStatRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows.forEach((play) => {
    const player = play.receiver.trim();
    if (!player) return;
    groups.set(player, [...(groups.get(player) ?? []), play]);
  });

  return Array.from(groups.entries())
    .map(([player, plays]) => {
      const targets = plays.length;
      const receptions = plays.filter((play) => {
        const result = play.result.toUpperCase();
        return !result.includes("INC") && !result.includes("INT");
      }).length;
      const completedPlays = plays.filter((play) => {
        const result = play.result.toUpperCase();
        return !result.includes("INC") && !result.includes("INT");
      });
      const yards = completedPlays.reduce((sum, play) => sum + play.yards, 0);
      const successes = completedPlays.filter(isSuccess).length;
      const explosives = completedPlays.filter((play) => classify(play) === "explosive").length;

      return {
        player,
        targets,
        receptions,
        catchRate: targets ? Math.round((receptions / targets) * 100) : 0,
        yards,
        average: receptions ? yards / receptions : 0,
        touchdowns: completedPlays.filter((play) => play.touchdown).length,
        firstDowns: completedPlays.filter((play) => play.firstDown).length,
        successes,
        successRate: receptions ? Math.round((successes / receptions) * 100) : 0,
        explosives,
        longest: completedPlays.length
          ? Math.max(...completedPlays.map((play) => play.yards))
          : 0,
      };
    })
    .sort((a, b) => b.yards - a.yards || b.average - a.average);
}

function buildMatrix(rows: ChartPlay[]) {
  const formations = Array.from(new Set(rows.map((play) => play.formation).filter(Boolean)));
  const plays = Array.from(new Set(rows.map((play) => play.play).filter(Boolean)));
  const cells: Record<string, { calls: number; yards: number }> = {};

  rows.forEach((play) => {
    const key = `${play.play}|${play.formation}`;
    cells[key] = cells[key] ?? { calls: 0, yards: 0 };
    cells[key].calls += 1;
    cells[key].yards += play.yards;
  });

  return { formations, plays, cells };
}

function playerLabel(player: Player) {
  const jersey = player.jersey ? `#${player.jersey}` : "#-";
  const name = `${player.firstName} ${player.lastName}`.trim();
  const position = player.position ? ` (${player.position})` : "";
  return `${jersey} ${name}${position}`;
}

function gradeLabel(grade: Grade) {
  if (grade === "negative") return "NEG";
  if (grade === "explosive") return "BIG";
  if (grade === "success") return "GOOD";
  return "";
}

function rowStyleForGrade(grade: Grade): React.CSSProperties {
  if (grade === "negative") return { background: "#fff1f2" };
  if (grade === "explosive") return { background: "#fef9c3" };
  if (grade === "success") return { background: "#f0fdf4" };
  return {};
}

function pillFor(grade: Grade): React.CSSProperties {
  if (grade === "negative") return { color: "#991b1b", borderColor: "#fecaca", background: "#fee2e2" };
  if (grade === "explosive") return { color: "#854d0e", borderColor: "#fde68a", background: "#fef3c7" };
  if (grade === "success") return { color: "#166534", borderColor: "#bbf7d0", background: "#dcfce7" };
  return { color: "#475569", borderColor: "#cbd5e1", background: "#f8fafc" };
}

type Decision = "call-more" | "neutral" | "stop";

function getDecision(row: ReportRow): Decision {
  // Recommendation is based only on average production.
  // The number of times a play has been called does not affect the grade.
  if (row.avg >= 4) return "call-more";
  if (row.avg >= 2) return "neutral";
  return "stop";
}

function decisionLabel(decision: Decision) {
  if (decision === "call-more") return "CALL MORE";
  if (decision === "stop") return "STOP CALLING";
  return "NEUTRAL";
}

function decisionPill(decision: Decision): React.CSSProperties {
  if (decision === "call-more") {
    return {
      color: "#166534",
      borderColor: "#86efac",
      background: "#dcfce7",
    };
  }

  if (decision === "stop") {
    return {
      color: "#991b1b",
      borderColor: "#fecaca",
      background: "#fee2e2",
    };
  }

  return {
    color: "#854d0e",
    borderColor: "#fde68a",
    background: "#fef3c7",
  };
}

function decisionColumnTone(
  tone: "green" | "yellow" | "red",
): React.CSSProperties {
  if (tone === "green") {
    return {
      borderColor: "#86efac",
      background: "#f0fdf4",
    };
  }

  if (tone === "red") {
    return {
      borderColor: "#fecaca",
      background: "#fff1f2",
    };
  }

  return {
    borderColor: "#fde68a",
    background: "#fffbeb",
  };
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...navButtonStyle, ...(active ? navButtonActiveStyle : {}) }}>
      {label}
    </button>
  );
}

function Metric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={{ ...metricValueStyle, color: danger ? "#dc2626" : "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function SheetInput({
  label,
  value,
  onChange,
  onKeyDown,
  placeholder,
  list,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  list?: string;
  wide?: boolean;
}) {
  return (
    <label
      style={{
        ...sheetInputWrapStyle,
        ...(wide ? { gridColumn: "span 2" } : {}),
      }}
    >
      <span>{label}</span>
      <input
        style={sheetInputStyle}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        list={list}
        autoComplete="off"
      />
    </label>
  );
}

function Recommendation({ title, row }: { title: string; row?: ReportRow }) {
  return (
    <div style={recommendationCardStyle}>
      <span>{title}</span>
      <strong>{row?.label ?? "-"}</strong>
      <small>
        {row
          ? `${row.calls} calls • ${row.avg.toFixed(1)} avg • ${row.successRate}% success`
          : "No data yet"}
      </small>
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={listStyle}>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={listRowStyle}>{children}</div>;
}

type RushingStatRow = {
  player: string;
  carries: number;
  yards: number;
  average: number;
  touchdowns: number;
  firstDowns: number;
  successes: number;
  successRate: number;
  explosives: number;
  explosiveRate: number;
  longest: number;
};

type PassingStatRow = {
  player: string;
  attempts: number;
  completions: number;
  completionRate: number;
  yards: number;
  yardsPerAttempt: number;
  touchdowns: number;
  interceptions: number;
  successes: number;
  successRate: number;
  explosives: number;
  longest: number;
};

type ReceivingStatRow = {
  player: string;
  targets: number;
  receptions: number;
  catchRate: number;
  yards: number;
  average: number;
  touchdowns: number;
  firstDowns: number;
  successes: number;
  successRate: number;
  explosives: number;
  longest: number;
};

type PenaltyStatRow = {
  label: string;
  count: number;
  percentage: number;
};

function SpecialTeamsReport({
  events,
}: {
  events: SpecialTeamsEvent[];
}) {
  const stats = calculateSpecialTeamsStats(events);

  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>SPECIAL TEAMS</div>
      <h2 style={panelTitleStyle}>Special Teams Analytics</h2>

      <div style={specialTeamsMetricGridStyle}>
        <Metric label="Punt Avg" value={stats.puntAverage} />
        <Metric label="FG" value={`${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`} />
        <Metric label="Kickoffs" value={stats.kickoffs} />
        <Metric label="Touchbacks" value={stats.touchbacks} />
        <Metric label="Kick Return Avg" value={stats.kickReturnAverage} />
        <Metric label="Punt Return Avg" value={stats.puntReturnAverage} />
        <Metric label="ST TD" value={stats.touchdowns} />
      </div>
    </div>
  );
}

function DefenseReport({
  events,
}: {
  events: DefensiveEvent[];
}) {
  const stats = calculateDefenseStats(events);
  const players = aggregateDefense(events);

  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>DEFENSE</div>
      <h2 style={panelTitleStyle}>Defensive Analytics</h2>

      <div style={defenseMetricGridStyle}>
        <Metric label="Tackles" value={stats.totalTackles} />
        <Metric label="TFL" value={stats.tacklesForLoss} />
        <Metric label="Sacks" value={stats.sacks} />
        <Metric label="INT" value={stats.interceptions} />
        <Metric label="PBU" value={stats.passBreakups} />
        <Metric label="FF" value={stats.forcedFumbles} />
        <Metric label="FR" value={stats.fumbleRecoveries} />
        <Metric label="Def TD" value={stats.defensiveTouchdowns} />
      </div>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Player</th>
              <th style={modernThStyle}>Total Tackles</th>
              <th style={modernThStyle}>TFL</th>
              <th style={modernThStyle}>Sacks</th>
              <th style={modernThStyle}>INT</th>
              <th style={modernThStyle}>PBU</th>
              <th style={modernThStyle}>FF</th>
              <th style={modernThStyle}>FR</th>
              <th style={modernThStyle}>TD</th>
            </tr>
          </thead>
          <tbody>
            {players.map((row) => (
              <tr key={row.player}>
                <td style={modernTdStyle}>{row.player}</td>
                <td style={modernTdStyle}>
                  {row.soloTackles + row.assistedTackles}
                </td>
                <td style={modernTdStyle}>{row.tacklesForLoss}</td>
                <td style={modernTdStyle}>{row.sacks}</td>
                <td style={modernTdStyle}>{row.interceptions}</td>
                <td style={modernTdStyle}>{row.passBreakups}</td>
                <td style={modernTdStyle}>{row.forcedFumbles}</td>
                <td style={modernTdStyle}>{row.fumbleRecoveries}</td>
                <td style={modernTdStyle}>{row.defensiveTouchdowns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PossessionAnalyticsReport({
  possessions,
  games,
  scopeLabel,
}: {
  possessions: Possession[];
  games: Game[];
  scopeLabel: string;
}) {
  const stats = calculatePossessionStats(possessions);

  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>CLOCK CONTROL</div>
      <h2 style={panelTitleStyle}>{scopeLabel} Time of Possession</h2>

      <div style={possessionMetricGridStyle}>
        <Metric label="Total Possession" value={formatDuration(stats.totalSeconds)} />
        <Metric label="Possessions" value={stats.count} />
        <Metric label="Average Drive" value={formatDuration(stats.averageSeconds)} />
        <Metric label="Longest Drive" value={formatDuration(stats.longestSeconds)} />
      </div>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Game</th>
              <th style={modernThStyle}>Start</th>
              <th style={modernThStyle}>End</th>
              <th style={modernThStyle}>Duration</th>
              <th style={modernThStyle}>Result</th>
            </tr>
          </thead>
          <tbody>
            {possessions.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={5}>
                  No possession data recorded.
                </td>
              </tr>
            )}

            {possessions.map((possession) => {
              const game = games.find((item) => item.id === possession.gameId);

              return (
                <tr key={possession.id}>
                  <td style={modernTdStyle}>
                    {game
                      ? `Week ${game.week} vs ${game.opponent}`
                      : "Unknown Game"}
                  </td>
                  <td style={modernTdStyle}>
                    Q{possession.startQuarter} {possession.startClock}
                  </td>
                  <td style={modernTdStyle}>
                    {possession.endQuarter
                      ? `Q${possession.endQuarter} ${possession.endClock}`
                      : "OPEN"}
                  </td>
                  <td style={modernTdStyle}>
                    {possession.endClock
                      ? formatDuration(possession.durationSeconds)
                      : "In Progress"}
                  </td>
                  <td style={modernTdStyle}>{possession.result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PenaltyAnalyticsReport({ rows }: { rows: PenaltyStatRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>DISCIPLINE</div>
      <h2 style={panelTitleStyle}>Penalty Analytics</h2>

      <div style={penaltySummaryStyle}>
        <Metric label="Total Penalties" value={total} danger={total > 0} />
      </div>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Penalty</th>
              <th style={modernThStyle}>Count</th>
              <th style={modernThStyle}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={3}>
                  No penalties recorded.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.label}>
                <td style={modernTdStyle}>{row.label}</td>
                <td style={modernTdStyle}>{row.count}</td>
                <td style={modernTdStyle}>{row.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerAnalyticsReport({
  rushing,
  passing,
  receiving,
  scopeLabel,
}: {
  rushing: RushingStatRow[];
  passing: PassingStatRow[];
  receiving: ReceivingStatRow[];
  scopeLabel: string;
}) {
  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>PLAYER PRODUCTION</div>
      <h2 style={panelTitleStyle}>{scopeLabel} Player Analytics</h2>

      <div style={playerReportGridStyle}>
        <PlayerStatTable
          title="Rushing"
          headers={[
            "Player",
            "Carries",
            "Yards",
            "Avg",
            "TD",
            "1st",
            "Success",
            "Big",
            "Long",
          ]}
          rows={rushing.map((row) => [
            row.player,
            row.carries,
            row.yards,
            row.average.toFixed(1),
            row.touchdowns,
            row.firstDowns,
            `${row.successRate}%`,
            `${row.explosiveRate}%`,
            row.longest,
          ])}
        />

        <PlayerStatTable
          title="Passing"
          headers={[
            "Player",
            "Comp/Att",
            "Comp %",
            "Yards",
            "Y/A",
            "TD",
            "INT",
            "Success",
            "Big",
            "Long",
          ]}
          rows={passing.map((row) => [
            row.player,
            `${row.completions}/${row.attempts}`,
            `${row.completionRate}%`,
            row.yards,
            row.yardsPerAttempt.toFixed(1),
            row.touchdowns,
            row.interceptions,
            `${row.successRate}%`,
            row.explosives,
            row.longest,
          ])}
        />

        <PlayerStatTable
          title="Receiving"
          headers={[
            "Player",
            "Rec/Tgt",
            "Catch %",
            "Yards",
            "Avg",
            "TD",
            "1st",
            "Success",
            "Big",
            "Long",
          ]}
          rows={receiving.map((row) => [
            row.player,
            `${row.receptions}/${row.targets}`,
            `${row.catchRate}%`,
            row.yards,
            row.average.toFixed(1),
            row.touchdowns,
            row.firstDowns,
            `${row.successRate}%`,
            row.explosives,
            row.longest,
          ])}
        />
      </div>
    </div>
  );
}

function PlayerStatTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div style={playerStatPanelStyle}>
      <h3 style={playerStatTitleStyle}>{title}</h3>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} style={modernThStyle}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={headers.length}>
                  No {title.toLowerCase()} data yet.
                </td>
              </tr>
            )}

            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} style={modernTdStyle}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GameBreakdownReport({
  rows,
}: {
  rows: Array<{
    game: Game;
    stats: ReturnType<typeof calculateStats>;
  }>;
}) {
  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>SEASON BY GAME</div>
      <h2 style={panelTitleStyle}>Game-by-Game Breakdown</h2>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Week</th>
              <th style={modernThStyle}>Opponent</th>
              <th style={modernThStyle}>Plays</th>
              <th style={modernThStyle}>Total Yards</th>
              <th style={modernThStyle}>Rush</th>
              <th style={modernThStyle}>Pass</th>
              <th style={modernThStyle}>Avg</th>
              <th style={modernThStyle}>Success</th>
              <th style={modernThStyle}>Explosive</th>
              <th style={modernThStyle}>1st Downs Earned</th>
              <th style={modernThStyle}>Series Starts</th>
              <th style={modernThStyle}>TDs</th>
              <th style={modernThStyle}>Turnovers</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={13}>
                  No season game data yet.
                </td>
              </tr>
            )}

            {rows.map(({ game, stats }) => (
              <tr key={game.id}>
                <td style={modernTdStyle}>{game.week}</td>
                <td style={modernTdStyle}>{game.opponent}</td>
                <td style={modernTdStyle}>{stats.total}</td>
                <td style={modernTdStyle}>{stats.yards}</td>
                <td style={modernTdStyle}>{stats.rushYards}</td>
                <td style={modernTdStyle}>{stats.passYards}</td>
                <td style={modernTdStyle}>{stats.averageYards}</td>
                <td style={modernTdStyle}>{stats.successRate}%</td>
                <td style={modernTdStyle}>{stats.explosiveRate}%</td>
                <td style={modernTdStyle}>{stats.firstDownsEarned}</td>
                <td style={modernTdStyle}>{stats.seriesStarts}</td>
                <td style={modernTdStyle}>{stats.tds}</td>
                <td style={modernTdStyle}>{stats.turnovers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormationPlaySuccessReport({ rows }: { rows: ReportRow[] }) {
  const callMore = rows.filter((row) => getDecision(row) === "call-more");
  const neutral = rows.filter((row) => getDecision(row) === "neutral");
  const stopCalling = rows.filter((row) => getDecision(row) === "stop");

  return (
    <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div style={smallRedStyle}>DECISION ENGINE</div>
      <h2 style={panelTitleStyle}>What Should I Call?</h2>

      <p style={reportDescriptionStyle}>
        CoachBoard grades each formation/play combination by average yards per call. Four or more yards is CALL MORE, two to 3.9 yards is NEUTRAL, and anything below two yards is STOP CALLING.
      </p>

      <div style={decisionGridStyle}>
        <DecisionColumn
          title="CALL MORE"
          subtitle="Averaging 4.0+ yards per call"
          tone="green"
          rows={callMore}
        />
        <DecisionColumn
          title="NEUTRAL"
          subtitle="Averaging 2.0–3.9 yards per call"
          tone="yellow"
          rows={neutral}
        />
        <DecisionColumn
          title="STOP CALLING"
          subtitle="Averaging under 2.0 yards per call"
          tone="red"
          rows={stopCalling}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={smallRedStyle}>FULL BREAKDOWN</div>
        <h2 style={{ ...panelTitleStyle, fontSize: 21 }}>Play Success by Formation</h2>
      </div>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Formation + Play</th>
              <th style={modernThStyle}>Calls</th>
              <th style={modernThStyle}>Success</th>
              <th style={modernThStyle}>Big Play</th>
              <th style={modernThStyle}>Yards</th>
              <th style={modernThStyle}>Avg</th>
              <th style={modernThStyle}>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={7}>
                  Chart plays first. This report will build automatically.
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const decision = getDecision(row);

              return (
                <tr key={row.id}>
                  <td style={modernTdStyle}>{row.label}</td>
                  <td style={modernTdStyle}>{row.calls}</td>
                  <td style={modernTdStyle}>
                    <div style={rateCellStyle}>
                      <strong>{row.successRate}%</strong>
                      <div style={barTrackStyle}>
                        <div
                          style={{
                            ...barFillStyle,
                            width: `${Math.min(100, Math.max(0, row.successRate))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td style={modernTdStyle}>{row.explosiveRate}%</td>
                  <td style={modernTdStyle}>{row.yards}</td>
                  <td style={modernTdStyle}>{row.avg.toFixed(1)}</td>
                  <td style={modernTdStyle}>
                    <span style={{ ...pillStyle, ...decisionPill(decision) }}>
                      {decisionLabel(decision)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionColumn({
  title,
  subtitle,
  tone,
  rows,
}: {
  title: string;
  subtitle: string;
  tone: "green" | "yellow" | "red";
  rows: ReportRow[];
}) {
  return (
    <div style={{ ...decisionColumnStyle, ...decisionColumnTone(tone) }}>
      <div style={decisionColumnHeaderStyle}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <div style={decisionListStyle}>
        {rows.length === 0 && (
          <div style={decisionEmptyStyle}>No calls in this category.</div>
        )}

        {rows.slice(0, 8).map((row) => (
          <div key={row.id} style={decisionCardStyle}>
            <strong>{row.label}</strong>
            <span>
              {row.calls} calls • {row.successRate}% success • {row.avg.toFixed(1)} avg
            </span>
            <small>{row.explosiveRate}% explosive</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Report({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <div style={panelStyle}>
      <div style={smallRedStyle}>REPORT</div>
      <h2 style={panelTitleStyle}>{title}</h2>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Name</th>
              <th style={modernThStyle}>Calls</th>
              <th style={modernThStyle}>Yards</th>
              <th style={modernThStyle}>Avg</th>
              <th style={modernThStyle}>Success</th>
              <th style={modernThStyle}>Big</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={6}>
                  No report data yet.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id}>
                <td style={modernTdStyle}>{row.label}</td>
                <td style={modernTdStyle}>{row.calls}</td>
                <td style={modernTdStyle}>{row.yards}</td>
                <td style={modernTdStyle}>{row.avg.toFixed(1)}</td>
                <td style={modernTdStyle}>{row.successRate}%</td>
                <td style={modernTdStyle}>{row.explosiveRate}%</td>
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
  background: "#f4f6f8",
  color: "#0f172a",
  padding: 12,
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 10,
  padding: "11px 14px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 30px rgba(15, 23, 42, .07)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  fontSize: 30,
  lineHeight: 1,
  margin: "7px 0 4px",
  fontWeight: 950,
  letterSpacing: "-.04em",
  color: "#0f172a",
};

const subTitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  marginTop: 4,
};

const backButtonStyle: React.CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 900,
};

const messageStyle: React.CSSProperties = {
  background: "#ecfdf5",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: 10,
  marginBottom: 12,
  fontWeight: 850,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginBottom: 10,
  padding: 4,
  width: "fit-content",
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const navButtonStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 9,
  padding: "7px 11px",
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

const gameCenterSubnavStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  width: "fit-content",
  marginBottom: 10,
  padding: 4,
  borderRadius: 12,
  background: "#e2e8f0",
  border: "1px solid #cbd5e1",
};

const gameCenterSubnavButtonStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 9,
  padding: "8px 14px",
  background: "transparent",
  color: "#475569",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
};

const gameCenterSubnavButtonActiveStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#dc2626",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15,23,42,.08)",
};

const topMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(13, minmax(92px, 1fr))",
  gap: 7,
  marginBottom: 10,
  overflowX: "auto",
};

const metricStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: "9px 10px",
  boxShadow: "0 8px 22px rgba(15,23,42,.06)",
};

const metricLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const metricValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 950,
  marginTop: 4,
  letterSpacing: "-.03em",
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.25fr) minmax(300px, .72fr)",
  gap: 10,
  marginBottom: 10,
};

const rightRailStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 15,
  padding: 12,
  boxShadow: "0 10px 30px rgba(15,23,42,.07)",
};

const panelHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  marginBottom: 8,
};

const smallRedStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 20,
  margin: "4px 0 0",
  fontWeight: 950,
  letterSpacing: "-.035em",
  color: "#0f172a",
};

const gameSelectStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 235,
  boxSizing: "border-box",
  padding: "10px 11px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 14,
  fontWeight: 800,
};

const entryBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 7,
  padding: 9,
  borderRadius: 13,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const downDistanceGroupStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr)",
  gap: 7,
  alignItems: "end",
};

const seriesCheckboxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  minHeight: 36,
  padding: "0 6px",
  borderRadius: 9,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#475569",
  fontSize: 9,
  fontWeight: 950,
  textTransform: "uppercase",
  lineHeight: 1.05,
  cursor: "pointer",
};

const sheetInputWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  color: "#475569",
  fontWeight: 950,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const sheetInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "8px 8px",
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
};

const quarterLengthControlStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const quarterLengthButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "7px 10px",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
};

const quarterLengthButtonActiveStyle: React.CSSProperties = {
  border: "1px solid #dc2626",
  background: "#fee2e2",
  color: "#991b1b",
};

const possessionMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(130px, 1fr))",
  gap: 8,
  marginTop: 12,
};



const possessionFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#475569",
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};



const possessionInlinePanelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const possessionInlineHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
  color: "#0f172a",
  fontWeight: 950,
};

const possessionInlineGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 7,
  alignItems: "end",
};

const possessionToggleStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#475569",
  fontWeight: 950,
  cursor: "pointer",
};

const possessionStartActiveStyle: React.CSSProperties = {
  border: "1px solid #16a34a",
  background: "#dcfce7",
  color: "#166534",
};

const possessionEndActiveStyle: React.CSSProperties = {
  border: "1px solid #dc2626",
  background: "#fee2e2",
  color: "#991b1b",
};

const saveRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 10,
};





const seriesPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "3px 8px",
  background: "#dbeafe",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 10,
  fontWeight: 950,
};

const earnedFirstDownPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "3px 8px",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  fontSize: 10,
  fontWeight: 950,
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "11px 14px",
  borderRadius: 11,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  fontSize: 16,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  marginTop: 12,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
};

const modernTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 900,
  background: "#ffffff",
};

const modernThStyle: React.CSSProperties = {
  padding: "10px 9px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 11,
  fontWeight: 950,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: ".07em",
  whiteSpace: "nowrap",
};

const modernTdStyle: React.CSSProperties = {
  padding: "9px 9px",
  borderBottom: "1px solid #edf2f7",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 700,
  textAlign: "left",
};

const emptyTdStyle: React.CSSProperties = {
  padding: 24,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 800,
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 950,
};

const miniDeleteButtonStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 950,
  cursor: "pointer",
};

const decisionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};

const decisionColumnStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 16,
  padding: 12,
};

const decisionColumnHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  marginBottom: 10,
};

const decisionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const decisionCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,.82)",
  border: "1px solid rgba(15,23,42,.08)",
};

const decisionEmptyStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 750,
  padding: 10,
  borderRadius: 10,
  background: "rgba(255,255,255,.55)",
};

const reportDescriptionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
  margin: "8px 0 0",
};

const rateCellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "50px minmax(90px, 1fr)",
  alignItems: "center",
  gap: 10,
};

const barTrackStyle: React.CSSProperties = {
  height: 9,
  borderRadius: 999,
  background: "#e5e7eb",
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #ef4444, #facc15, #22c55e)",
};

const recommendationCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  padding: 9,
  marginTop: 7,
  borderRadius: 11,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const mutedTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
};

const individualStatGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 4,
  marginTop: 4,
};

const individualStatBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 1,
  padding: "5px 6px",
  borderRadius: 8,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const individualStatDetailStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 750,
  marginTop: 3,
};

const compactPlayerRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "6px 0",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 11px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 14,
  fontWeight: 750,
};

const specialTeamsMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(105px, 1fr))",
  gap: 8,
  marginTop: 12,
  overflowX: "auto",
};

const specialTeamsEntryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const defenseMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(105px, 1fr))",
  gap: 8,
  marginTop: 12,
  overflowX: "auto",
};

const defenseEntryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(110px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const setupGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: 12,
};

const penaltySummaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(150px, 220px)",
  marginTop: 12,
};

const playerReportGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
  marginTop: 14,
};

const playerStatPanelStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const playerStatTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 950,
};

const reportToolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 14,
  padding: 14,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 22px rgba(15,23,42,.05)",
};

const reportToolbarActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const scopeToggleStyle: React.CSSProperties = {
  display: "flex",
  padding: 4,
  gap: 4,
  borderRadius: 12,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
};

const scopeButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 9,
  padding: "9px 12px",
  background: "transparent",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
};

const scopeButtonActiveStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 4px 12px rgba(15,23,42,.08)",
};

const printButtonStyle: React.CSSProperties = {
  border: "1px solid #991b1b",
  borderRadius: 11,
  padding: "10px 14px",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const printHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 12,
  padding: "16px 18px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
};

const printDateStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  fontSize: 13,
};

const reportMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(14, minmax(110px, 1fr))",
  gap: 8,
  marginBottom: 12,
  overflowX: "auto",
};

const reportsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 12,
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
  borderRadius: 12,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const primaryButtonStyleNoMargin: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #991b1b",
  background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 9,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const smallActionButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 9,
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
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
};

const tagStyle: React.CSSProperties = {
  marginLeft: 8,
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};
