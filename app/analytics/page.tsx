"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

type Section = "command" | "setup" | "games" | "reports";
type GameCenterSection = "offense" | "defense" | "specialTeams";
type ReportSection = "offense" | "defense" | "specialTeams";
type ReportScope = "game" | "season" | "allTime";
type PlayType = "Run" | "Pass" | "Punt" | "RPO" | "Screen" | "Other";
type Grade = "negative" | "normal" | "success" | "explosive";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  jersey: string;
  position: string;
  seasonId?: string;
};

type RosterImportRow = {
  firstName: string;
  lastName: string;
  jersey: string;
  position: string;
  rosterYear: string;
  graduationYear?: number;
  currentSeasonEligible: boolean;
};

type SpreadsheetCell = string | number | boolean | null | undefined;

type SpreadsheetRow = Record<string, SpreadsheetCell>;

type XlsxWorkbookLike = {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
};

type XlsxLibraryLike = {
  read: (
    data: ArrayBuffer,
    options: { type: "array" },
  ) => XlsxWorkbookLike;
  utils: {
    sheet_to_json: (
      sheet: unknown,
      options: { defval: string },
    ) => SpreadsheetRow[];
  };
};

type WindowWithXlsx = Window & {
  XLSX?: XlsxLibraryLike;
};

type Season = {
  id: string;
  name: string;
  year: number;
  archived: boolean;
  createdAt: string;
};

type Formation = {
  id: string;
  name: string;
};

type Motion = {
  id: string;
  name: string;
};

type PlayTag = {
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
  seasonId?: string;
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
  assistedTacklesForLoss?: number;
  sacks: number;
  assistedSacks?: number;
  interceptions: number;
  passBreakups: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  defensiveTouchdowns: number;
  createdAt: string;
};

type DefensiveCallEvent = {
  id: string;
  gameId: string;
  down: number;
  distance: number;
  front: string;
  pressure: string;
  coverage: string;
  yardsAllowed: number;
  result: string;
  quarter: string;
  clock: string;
  goalToGo?: boolean;
  penalty?: boolean;
  penaltyType?: string;
  penaltyYards?: number;
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  repeatDown?: boolean;
  opponentPunt?: boolean;
  seriesStart?: boolean;
  opponentPossessionStart?: boolean;
  opponentPossessionEnd?: boolean;
  tacklers?: string[];
  assistTacklers?: string[];
  sackPlayers?: string[];
  sackAssistPlayers?: string[];
  tflPlayers?: string[];
  tflAssistPlayers?: string[];
  interceptionPlayers?: string[];
  passBreakupPlayers?: string[];
  forcedFumblePlayers?: string[];
  fumbleRecoveryPlayers?: string[];
  defensiveTouchdownPlayers?: string[];
  createdAt: string;
};

type DefensiveCallReportRow = {
  id: string;
  label: string;
  calls: number;
  yardsAllowed: number;
  averageAllowed: number;
  stopRate: number;
  explosiveAllowedRate: number;
};

type ChartPlay = {
  id: string;
  gameId: string;
  playNumber: number;
  quarter: string;
  down: number;
  distance: number;
  formation: string;
  motion: string;
  play: string;
  tags: string[];
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
  motion: string;
  play: string;
  tags: string[];
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

type EditPlayDraft = {
  dd: string;
  formation: string;
  motion: string;
  play: string;
  tags: string;
  yards: string;
  rusher: string;
  passer: string;
  receiver: string;
  seriesStart: boolean;
  firstDown: boolean;
  result: string;
  penalty: string;
};

type SavedState = {
  seasons?: Season[];
  selectedSeasonId?: string;
  players: Player[];
  formations: Formation[];
  motions: Motion[];
  plays: PlayCall[];
  tags: PlayTag[];
  games: Game[];
  chartPlays: ChartPlay[];
  possessions: Possession[];
  specialTeamsEvents: SpecialTeamsEvent[];
  defensiveEvents: DefensiveEvent[];
  defensiveCallEvents?: DefensiveCallEvent[];
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
const SHARED_STATE_TABLE = "coachboard_analytics_shared_state";

const RUN_SUCCESS = 4;
const PASS_SUCCESS = 12;
const RUN_EXPLOSIVE = 10;
const PASS_EXPLOSIVE = 25;

const defaultGames: Game[] = [];

export default function AnalyticsPage() {
  const [activeSection, setActiveSection] = useState<Section>("command");
  const [gameCenterSection, setGameCenterSection] = useState<GameCenterSection>("offense");
  const [reportScope, setReportScope] = useState<ReportScope>("game");
  const [reportSection, setReportSection] = useState<ReportSection>("offense");
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printSelections, setPrintSelections] = useState<Record<string, boolean>>({
    summary: true,
    decisionEngine: true,
    playerAnalytics: true,
    penalties: true,
    possessions: true,
    playRankings: true,
    formationRankings: true,
    motionRankings: true,
    tagRankings: true,
    formationMotion: true,
    formationPlay: true,
    playTag: true,
    formationPlayTag: true,
    gameBreakdown: true,
    yearOverYear: true,
    defense: true,
    specialTeams: true,
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTeamId, setActiveTeamId] = useState("");
  const [activeTeamName, setActiveTeamName] = useState("");
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [syncingAnalytics, setSyncingAnalytics] = useState(false);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonYear, setNewSeasonYear] = useState(
    String(new Date().getFullYear()),
  );
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingSeasonName, setEditingSeasonName] = useState("");
  const [editingSeasonYear, setEditingSeasonYear] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [motions, setMotions] = useState<Motion[]>([]);
  const [plays, setPlays] = useState<PlayCall[]>([]);
  const [tags, setTags] = useState<PlayTag[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [chartPlays, setChartPlays] = useState<ChartPlay[]>([]);
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [specialTeamsEvents, setSpecialTeamsEvents] = useState<SpecialTeamsEvent[]>([]);
  const [defensiveEvents, setDefensiveEvents] = useState<DefensiveEvent[]>([]);
  const [defensiveCallEvents, setDefensiveCallEvents] = useState<DefensiveCallEvent[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [quarterLengthMinutes, setQuarterLengthMinutes] = useState(12);

  const [newWeek, setNewWeek] = useState("");
  const [newOpponent, setNewOpponent] = useState("");
  const [newGameDate, setNewGameDate] = useState("");

  const [playerFirst, setPlayerFirst] = useState("");
  const [playerLast, setPlayerLast] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerPosition, setPlayerPosition] = useState("");
  const [editingRosterPlayerId, setEditingRosterPlayerId] = useState<string | null>(null);
  const [editingRosterPlayer, setEditingRosterPlayer] = useState({
    firstName: "",
    lastName: "",
    jersey: "",
    position: "",
  });

  const [rosterImportRows, setRosterImportRows] = useState<RosterImportRow[]>([]);
  const [rosterImportExcludedCount, setRosterImportExcludedCount] = useState(0);
  const [rosterImportFileName, setRosterImportFileName] = useState("");
  const [rosterImportLoading, setRosterImportLoading] = useState(false);

  const [formationSetup, setFormationSetup] = useState("");
  const [motionSetup, setMotionSetup] = useState("");
  const [playSetup, setPlaySetup] = useState("");
  const [playSetupType, setPlaySetupType] = useState<PlayType>("Run");
  const [tagSetup, setTagSetup] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const [specialTeamsEntry, setSpecialTeamsEntry] = useState({
    type: "Punt" as SpecialTeamsType,
    player: "",
    yards: "",
    result: "",
    quarter: "1",
    clock: "",
    notes: "",
  });

  const [defensiveCallEntry, setDefensiveCallEntry] = useState({
    dd: "1 and 10",
    front: "",
    pressure: "",
    coverage: "",
    yardsAllowed: "",
    result: "",
    quarter: "1",
    clock: "",
    goalToGo: false,
    penalty: false,
    penaltyType: "",
    penaltyYards: "",
    automaticFirstDown: false,
    lossOfDown: false,
    repeatDown: false,
    opponentPunt: false,
    seriesStart: false,
    opponentPossessionStart: false,
    opponentPossessionEnd: false,
    tacklers: "",
    assistTacklers: "",
    sackPlayers: "",
    sackAssistPlayers: "",
    tflPlayers: "",
    tflAssistPlayers: "",
    interceptionPlayers: "",
    passBreakupPlayers: "",
    forcedFumblePlayers: "",
    fumbleRecoveryPlayers: "",
    defensiveTouchdownPlayers: "",
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
    motion: "",
    play: "",
    tags: [],
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

  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [editPlayDraft, setEditPlayDraft] = useState<EditPlayDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeSharedAnalytics() {
      setMessage("");
      setAnalyticsLoaded(false);

      const {
        data: { user: signedInUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !signedInUser) {
        setMessage("Sign in to load your program's shared analytics.");
        setAnalyticsLoaded(true);
        return;
      }

      setUser(signedInUser);

      const { data: membership, error: membershipError } = await supabase
        .from("coachboard_analytics_team_members")
        .select(`
          team_id,
          role,
          coachboard_analytics_teams (
            id,
            team_name,
            season
          )
        `)
        .eq("user_id", signedInUser.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (membershipError) {
        setMessage(`Could not load team membership: ${membershipError.message}`);
        setAnalyticsLoaded(true);
        return;
      }

      if (!membership?.team_id) {
        setMessage("Your account has not been added to an analytics team.");
        setAnalyticsLoaded(true);
        return;
      }

      const teamRelation = Array.isArray(membership.coachboard_analytics_teams)
        ? membership.coachboard_analytics_teams[0]
        : membership.coachboard_analytics_teams;

      setActiveTeamId(membership.team_id);
      setActiveTeamName(
        teamRelation?.team_name
          ? `${teamRelation.team_name}${teamRelation.season ? ` ${teamRelation.season}` : ""}`
          : "Shared Program Analytics",
      );

      const { data: sharedRow, error: sharedError } = await supabase
        .from(SHARED_STATE_TABLE)
        .select("state")
        .eq("team_id", membership.team_id)
        .maybeSingle();

      if (cancelled) return;

      if (sharedError) {
        setMessage(`Could not load shared analytics: ${sharedError.message}`);
        setAnalyticsLoaded(true);
        return;
      }

      let saved: SavedState | null = null;

      if (sharedRow?.state) {
        saved = sharedRow.state as SavedState;
      } else {
        // One-time migration: if this browser has the previous local version,
        // upload it as the team's first shared analytics state.
        try {
          const localRaw = window.localStorage.getItem(STORAGE_KEY);
          if (localRaw) {
            saved = JSON.parse(localRaw) as SavedState;

            const { error: migrationError } = await supabase
              .from(SHARED_STATE_TABLE)
              .upsert(
                {
                  team_id: membership.team_id,
                  state: saved,
                  updated_by: signedInUser.id,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "team_id" },
              );

            if (migrationError) {
              setMessage(
                `Loaded local analytics, but could not upload them: ${migrationError.message}`,
              );
            } else {
              setMessage("Your browser analytics were moved into shared team analytics.");
            }
          }
        } catch {
          setMessage("Could not migrate the analytics stored in this browser.");
        }
      }

      if (saved) {
        applySavedAnalyticsState(saved);
      }

      setAnalyticsLoaded(true);
    }

    void initializeSharedAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!analyticsLoaded || !activeTeamId || !user) return;

    const state: SavedState = {
      seasons,
      selectedSeasonId,
      players,
      formations,
      motions,
      plays,
      tags,
      games,
      chartPlays,
      possessions,
      specialTeamsEvents,
      defensiveEvents,
      defensiveCallEvents,
      selectedGameId,
      quarterLengthMinutes,
    };

    const timeout = window.setTimeout(async () => {
      setSyncingAnalytics(true);

      const { error } = await supabase
        .from(SHARED_STATE_TABLE)
        .upsert(
          {
            team_id: activeTeamId,
            state,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "team_id" },
        );

      setSyncingAnalytics(false);

      if (error) {
        setMessage(`Could not sync shared analytics: ${error.message}`);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    analyticsLoaded,
    activeTeamId,
    user,
    seasons,
    selectedSeasonId,
    players,
    formations,
    motions,
    plays,
    tags,
    games,
    chartPlays,
    possessions,
    specialTeamsEvents,
    defensiveEvents,
    defensiveCallEvents,
    selectedGameId,
    quarterLengthMinutes,
  ]);

  useEffect(() => {
    if (!activeTeamId) return;

    const channel: RealtimeChannel = supabase
      .channel(`analytics-team-${activeTeamId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: SHARED_STATE_TABLE,
          filter: `team_id=eq.${activeTeamId}`,
        },
        (payload) => {
          const row = payload.new as { state?: SavedState; updated_by?: string };

          // Ignore our own save; state is already current on this browser.
          if (!row.state || row.updated_by === user?.id) return;

          applySavedAnalyticsState(row.state);
          setMessage("Shared analytics updated by another coach.");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeTeamId, user?.id]);

  function applySavedAnalyticsState(saved: SavedState) {
    const rawPlayers = saved.players ?? [];
    const rawGames = saved.games ?? [];

    const inferredLegacyYear = (() => {
      const datedGame = rawGames.find((game) => {
        if (!game.date) return false;
        const year = new Date(`${game.date}T12:00:00`).getFullYear();
        return Number.isFinite(year) && year > 2000;
      });

      if (datedGame?.date) {
        return new Date(`${datedGame.date}T12:00:00`).getFullYear();
      }

      return new Date().getFullYear();
    })();

    let normalizedSeasons = Array.isArray(saved.seasons)
      ? saved.seasons.map((season) => ({
          ...season,
          archived: season.archived ?? false,
          createdAt: season.createdAt ?? new Date().toISOString(),
        }))
      : [];

    let legacySeasonId = normalizedSeasons[0]?.id ?? "";

    if (normalizedSeasons.length === 0) {
      legacySeasonId = createId();
      normalizedSeasons = [
        {
          id: legacySeasonId,
          name: String(inferredLegacyYear),
          year: inferredLegacyYear,
          archived: false,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const seasonIds = new Set(normalizedSeasons.map((season) => season.id));

    const normalizedGames = rawGames.map((game) => ({
      ...game,
      seasonId:
        game.seasonId && seasonIds.has(game.seasonId)
          ? game.seasonId
          : legacySeasonId,
    }));

    const normalizedPlayers = rawPlayers.map((player) => ({
      ...player,
      seasonId:
        player.seasonId && seasonIds.has(player.seasonId)
          ? player.seasonId
          : legacySeasonId,
    }));

    const savedChartPlays = (saved.chartPlays ?? []).map((play) => {
      const normalizedTouchdown =
        play.touchdown === true ||
        (play.result ?? "").toUpperCase().includes("TD");

      return {
        ...play,
        motion: play.motion ?? "",
        tags: Array.isArray(play.tags) ? play.tags : [],
        rusher: resolvePlayerInput(play.rusher, normalizedPlayers),
        passer: resolvePlayerInput(play.passer, normalizedPlayers),
        receiver: resolvePlayerInput(play.receiver, normalizedPlayers),
        penaltyType: play.penaltyType ?? "",
        seriesStart: play.seriesStart ?? false,
        touchdown: normalizedTouchdown,
        firstDown: normalizedTouchdown ? false : (play.firstDown ?? false),
      };
    });

    const requestedSeasonIsValid = normalizedSeasons.some(
      (season) => season.id === saved.selectedSeasonId,
    );

    const defaultSeason =
      [...normalizedSeasons]
        .filter((season) => !season.archived)
        .sort((a, b) => b.year - a.year)[0] ??
      [...normalizedSeasons].sort((a, b) => b.year - a.year)[0];

    const nextSeasonId = requestedSeasonIsValid
      ? saved.selectedSeasonId!
      : defaultSeason?.id ?? legacySeasonId;

    const seasonGames = normalizedGames.filter(
      (game) => game.seasonId === nextSeasonId,
    );

    const savedSelectionIsValid = seasonGames.some(
      (game) => game.id === saved.selectedGameId,
    );

    setSeasons(normalizedSeasons);
    setSelectedSeasonId(nextSeasonId);
    setPlayers(normalizedPlayers);
    setFormations(saved.formations ?? []);
    setMotions(saved.motions ?? []);
    setPlays(saved.plays ?? []);
    setTags(saved.tags ?? []);
    setGames(normalizedGames);
    setChartPlays(savedChartPlays);
    setPossessions(saved.possessions ?? []);
    setSpecialTeamsEvents(saved.specialTeamsEvents ?? []);
    setDefensiveEvents(saved.defensiveEvents ?? []);
    setDefensiveCallEvents(saved.defensiveCallEvents ?? []);
    setQuarterLengthMinutes(saved.quarterLengthMinutes === 15 ? 15 : 12);

    setSelectedGameId(
      savedSelectionIsValid
        ? saved.selectedGameId
        : seasonGames[0]?.id ?? "",
    );
  }

  const selectedSeason =
    seasons.find((season) => season.id === selectedSeasonId) ??
    seasons[0];

  const seasonGames = useMemo(
    () =>
      games
        .filter((game) => game.seasonId === selectedSeasonId)
        .sort((a, b) => Number(a.week || 0) - Number(b.week || 0)),
    [games, selectedSeasonId],
  );

  const seasonPlayers = useMemo(
    () => players.filter((player) => player.seasonId === selectedSeasonId),
    [players, selectedSeasonId],
  );

  useEffect(() => {
    if (!selectedSeasonId) return;
    if (seasonGames.some((game) => game.id === selectedGameId)) return;
    setSelectedGameId(seasonGames[0]?.id ?? "");
  }, [selectedSeasonId, seasonGames, selectedGameId]);


  const selectedGame =
    games.find((game) => game.id === selectedGameId) ??
    seasonGames[0];

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

  const seasonGameIdSet = useMemo(
    () => new Set(seasonGames.map((game) => game.id)),
    [seasonGames],
  );

  const seasonPossessions = useMemo(
    () =>
      possessions.filter((possession) =>
        seasonGameIdSet.has(possession.gameId),
      ),
    [possessions, seasonGameIdSet],
  );

  const currentGameSpecialTeams = useMemo(
    () => specialTeamsEvents.filter((event) => event.gameId === selectedGameId),
    [specialTeamsEvents, selectedGameId],
  );

  const currentGameDefense = useMemo(
    () => defensiveEvents.filter((event) => event.gameId === selectedGameId),
    [defensiveEvents, selectedGameId],
  );

  const currentGameDefensiveCalls = useMemo(
    () =>
      defensiveCallEvents
        .filter((event) => event.gameId === selectedGameId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [defensiveCallEvents, selectedGameId],
  );

  const seasonSpecialTeams = useMemo(
    () =>
      specialTeamsEvents.filter((event) =>
        seasonGameIdSet.has(event.gameId),
      ),
    [specialTeamsEvents, seasonGameIdSet],
  );

  const seasonDefense = useMemo(
    () =>
      defensiveEvents.filter((event) =>
        seasonGameIdSet.has(event.gameId),
      ),
    [defensiveEvents, seasonGameIdSet],
  );

  const seasonDefensiveCalls = useMemo(
    () =>
      defensiveCallEvents.filter((event) =>
        seasonGameIdSet.has(event.gameId),
      ),
    [defensiveCallEvents, seasonGameIdSet],
  );

  const reportSpecialTeams =
    reportScope === "game"
      ? currentGameSpecialTeams
      : reportScope === "season"
        ? seasonSpecialTeams
        : specialTeamsEvents;

  const reportDefense =
    reportScope === "game"
      ? currentGameDefense
      : reportScope === "season"
        ? seasonDefense
        : defensiveEvents;

  const reportDefensiveCalls =
    reportScope === "game"
      ? currentGameDefensiveCalls
      : reportScope === "season"
        ? seasonDefensiveCalls
        : defensiveCallEvents;

  const specialTeamsStats = useMemo(
    () => calculateSpecialTeamsStats(currentGameSpecialTeams),
    [currentGameSpecialTeams],
  );

  const defenseStats = useMemo(
    () => calculateDefenseStats(currentGameDefense),
    [currentGameDefense],
  );

  const defensiveCallStats = useMemo(
    () => calculateDefensiveCallStats(currentGameDefensiveCalls),
    [currentGameDefensiveCalls],
  );

  const opponentPossessionStats = useMemo(
    () =>
      calculateOpponentPossessionStats(
        currentGameDefensiveCalls,
        quarterLengthMinutes,
      ),
    [currentGameDefensiveCalls, quarterLengthMinutes],
  );

  const reportOpponentPossessionStats = useMemo(
    () =>
      calculateOpponentPossessionStats(
        reportDefensiveCalls,
        quarterLengthMinutes,
      ),
    [reportDefensiveCalls, quarterLengthMinutes],
  );

  const defensiveFrontReport = useMemo(
    () => makeDefensiveCallReport(reportDefensiveCalls, (event) => event.front),
    [reportDefensiveCalls],
  );

  const defensivePressureReport = useMemo(
    () =>
      makeDefensiveCallReport(
        reportDefensiveCalls.filter((event) => event.pressure),
        (event) => event.pressure,
      ),
    [reportDefensiveCalls],
  );

  const defensiveCoverageReport = useMemo(
    () => makeDefensiveCallReport(reportDefensiveCalls, (event) => event.coverage),
    [reportDefensiveCalls],
  );

  const defensiveCallCombinationReport = useMemo(
    () =>
      makeDefensiveCallReport(
        reportDefensiveCalls,
        (event) =>
          `${event.front || "No Front"} — ${event.pressure || "No Pressure"} — ${
            event.coverage || "No Coverage"
          }`,
      ),
    [reportDefensiveCalls],
  );

  const defensiveFrontOptions = useMemo(
    () =>
      Array.from(
        new Set(defensiveCallEvents.map((event) => event.front).filter(Boolean)),
      ).sort(),
    [defensiveCallEvents],
  );

  const defensivePressureOptions = useMemo(
    () =>
      Array.from(
        new Set(defensiveCallEvents.map((event) => event.pressure).filter(Boolean)),
      ).sort(),
    [defensiveCallEvents],
  );

  const defensiveCoverageOptions = useMemo(
    () =>
      Array.from(
        new Set(defensiveCallEvents.map((event) => event.coverage).filter(Boolean)),
      ).sort(),
    [defensiveCallEvents],
  );

  const seasonPlays = useMemo(
    () =>
      chartPlays
        .filter((play) => seasonGameIdSet.has(play.gameId))
        .sort((a, b) => {
          const gameA = games.find((game) => game.id === a.gameId);
          const gameB = games.find((game) => game.id === b.gameId);
          const weekA = Number(gameA?.week ?? 0);
          const weekB = Number(gameB?.week ?? 0);

          if (weekA !== weekB) return weekA - weekB;
          return a.playNumber - b.playNumber;
        }),
    [chartPlays, games, seasonGameIdSet],
  );

  const allTimePlays = useMemo(
    () =>
      [...chartPlays].sort((a, b) => {
        const gameA = games.find((game) => game.id === a.gameId);
        const gameB = games.find((game) => game.id === b.gameId);
        const seasonA = seasons.find((season) => season.id === gameA?.seasonId);
        const seasonB = seasons.find((season) => season.id === gameB?.seasonId);

        if ((seasonA?.year ?? 0) !== (seasonB?.year ?? 0)) {
          return (seasonA?.year ?? 0) - (seasonB?.year ?? 0);
        }

        return Number(gameA?.week ?? 0) - Number(gameB?.week ?? 0);
      }),
    [chartPlays, games, seasons],
  );

  const reportPlays =
    reportScope === "game"
      ? currentGamePlays
      : reportScope === "season"
        ? seasonPlays
        : allTimePlays;

  const stats = useMemo(() => calculateStats(currentGamePlays), [currentGamePlays]);
  const reportStats = useMemo(() => calculateStats(reportPlays), [reportPlays]);

  const gamePossessionStats = useMemo(
    () => calculatePossessionStats(currentGamePossessions),
    [currentGamePossessions],
  );

  const reportPossessions =
    reportScope === "game"
      ? currentGamePossessions
      : reportScope === "season"
        ? seasonPossessions
        : possessions;

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

  const motionReport = useMemo(
    () => makeReport(reportPlays.filter((row) => row.motion), (row) => row.motion),
    [reportPlays],
  );

  const tagReport = useMemo(
    () => makeMultiReport(reportPlays, (row) => row.tags),
    [reportPlays],
  );

  const formationMotionReport = useMemo(
    () =>
      makeReport(
        reportPlays.filter((row) => row.motion),
        (row) => `${row.formation} — ${row.motion}`,
      ),
    [reportPlays],
  );

  const formationPlayReport = useMemo(
    () => makeReport(reportPlays, (row) => `${row.formation} — ${row.play}`),
    [reportPlays],
  );

  const playTagReport = useMemo(
    () =>
      makeMultiReport(
        reportPlays,
        (row) => row.tags.map((tag) => `${row.play} — ${tag}`),
      ),
    [reportPlays],
  );

  const formationPlayTagReport = useMemo(
    () =>
      makeMultiReport(
        reportPlays,
        (row) =>
          row.tags.map((tag) => `${row.formation} — ${row.play} — ${tag}`),
      ),
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
      seasonGames
        .map((game) => {
          const rows = chartPlays.filter((play) => play.gameId === game.id);
          return {
            game,
            stats: calculateStats(rows),
          };
        })
        .filter((item) => item.stats.total > 0),
    [seasonGames, chartPlays],
  );

  const yearOverYear = useMemo(
    () =>
      [...seasons]
        .sort((a, b) => a.year - b.year)
        .map((season) => {
          const seasonGameIds = new Set(
            games
              .filter((game) => game.seasonId === season.id)
              .map((game) => game.id),
          );

          const rows = chartPlays.filter((play) =>
            seasonGameIds.has(play.gameId),
          );

          return {
            season,
            games: seasonGameIds.size,
            stats: calculateStats(rows),
          };
        })
        .filter((row) => row.games > 0 || row.stats.chartedPlays > 0),
    [seasons, games, chartPlays],
  );

  const reportScopeLabel =
    reportScope === "game"
      ? "Current Game"
      : reportScope === "season"
        ? selectedSeason?.name ?? "Season"
        : "All-Time";


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

  function addMotion(name: string) {
    const clean = name.trim();
    if (!clean) return clean;

    const existing = motions.find(
      (motion) => motion.name.toLowerCase() === clean.toLowerCase(),
    );

    if (existing) return existing.name;

    const newMotion: Motion = {
      id: createId(),
      name: clean,
    };

    setMotions((current) =>
      [...current, newMotion].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return clean;
  }

  function addTag(name: string) {
    const clean = name.trim();
    if (!clean) return clean;

    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === clean.toLowerCase(),
    );

    if (existing) return existing.name;

    const newTag: PlayTag = {
      id: createId(),
      name: clean,
    };

    setTags((current) =>
      [...current, newTag].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return clean;
  }

  function addEntryTags(values: string[]) {
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    if (!cleaned.length) return;

    const savedNames = cleaned.map((value) => addTag(value));

    setEntry((current) => {
      const nextTags = [...current.tags];

      savedNames.forEach((savedName) => {
        const alreadySelected = nextTags.some(
          (tag) => tag.toLowerCase() === savedName.toLowerCase(),
        );

        if (!alreadySelected) nextTags.push(savedName);
      });

      return { ...current, tags: nextTags };
    });
  }

  function handleTagDraftChange(value: string) {
    if (!value.includes(",")) {
      setTagDraft(value);
      return;
    }

    const parts = value.split(",");
    const unfinishedPart = parts.pop() ?? "";

    addEntryTags(parts);
    setTagDraft(unfinishedPart.replace(/^\s+/, ""));
  }

  function commitTagDraft() {
    const clean = tagDraft.trim();
    if (!clean) return;

    addEntryTags([clean]);
    setTagDraft("");
  }

  function removeEntryTag(tagToRemove: string) {
    setEntry((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
    }));
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
      setMessage("Add and open a game before entering plays.");
      return;
    }

    const resultUpper = entry.result.trim().toUpperCase();
    const isPunt = resultUpper.includes("PUNT");
    const isTwoPointAttempt =
      resultUpper.includes("2PT") ||
      resultUpper.includes("2 PT") ||
      resultUpper.includes("TWO POINT");
    const optionalYardagePlay = isPunt || isTwoPointAttempt;
    const yards =
      entry.yards.trim() === "" && optionalYardagePlay
        ? 0
        : Number(entry.yards);

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

    if (
      Number.isNaN(yards) ||
      (entry.yards.trim() === "" && !optionalYardagePlay)
    ) {
      setMessage(
        "Type yards before saving. Punt and 2-point conversion yards may be left blank.",
      );
      return;
    }

    const detectedPlayType = detectPlayType(entry);
    const playType: PlayType = isPunt ? "Punt" : detectedPlayType;
    const formationName = isPunt
      ? "Special Teams"
      : addFormation(entry.formation || "Base");
    const motionName = isPunt
      ? ""
      : entry.motion.trim()
        ? addMotion(entry.motion)
        : "";
    const playName = isPunt
      ? "Punt"
      : addPlayCall(entry.play || "Unknown Play", playType);
    const draftTags = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const allTagNames = [...entry.tags, ...draftTags].filter(
      (tag, index, array) =>
        array.findIndex(
          (candidate) => candidate.toLowerCase() === tag.toLowerCase(),
        ) === index,
    );

    const savedTags = isPunt ? [] : allTagNames.map((tag) => addTag(tag));

    const parsed = parseDownDistance(entry.dd);
    const result = entry.result.trim().toUpperCase();
    const penaltyText = entry.penalty.trim();
    const penaltyCode = penaltyText.toUpperCase();
    const isIncomplete =
      result.includes("INC") || result.includes("INCOMPLETE");
    const isTwoPointGood =
      isTwoPointAttempt &&
      (result.includes("GOOD") ||
        result.includes("MADE") ||
        result.includes("SUCCESS"));
    const isInterception = result.includes("INT");
    const isFumble = result.includes("FUM");
    const isTurnover = isInterception || isFumble || result.includes("TO");
    const isTouchdown = result.includes("TD") && !isTwoPointAttempt;
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
      motion: motionName,
      play: playName,
      tags: savedTags,
      playType,
      yards,
      rusher: isPunt ? "" : resolvePlayerInput(entry.rusher, seasonPlayers),
      passer: isPunt ? "" : resolvePlayerInput(entry.passer, seasonPlayers),
      receiver: isPunt ? "" : resolvePlayerInput(entry.receiver, seasonPlayers),
      result:
        [
          isTouchdown ? "TD" : "",
          isIncomplete ? "INC" : "",
          isInterception ? "INT" : "",
          isFumble ? "FUM" : "",
          isPunt ? "PUNT" : "",
          isTwoPointAttempt ? (isTwoPointGood ? "2PT GOOD" : "2PT NO") : "",
          !isTouchdown &&
          !isIncomplete &&
          !isTurnover &&
          !isPunt &&
          !isTwoPointAttempt &&
          result
            ? result
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      touchdown: isTouchdown,
      firstDown:
        !isTouchdown &&
        !isPunt &&
        !isTwoPointAttempt &&
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

    setEntry((current) => ({
      ...current,
      formation: "",
      motion: "",
      dd: isPunt ? "1 and 10" : nextDownDistance(current.dd, yards),
      play: "",
      tags: [],
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
    setTagDraft("");

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
      player: resolvePlayerInput(specialTeamsEntry.player, seasonPlayers),
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

  function resolveDefensivePlayerList(value: string) {
    const seen = new Set<string>();

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => resolvePlayerInput(item, seasonPlayers))
      .filter((player): player is string => Boolean(player))
      .filter((player) => {
        const key = player.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function addDefensiveProductionFromCall({
    tacklers,
    assistTacklers,
    sackPlayers,
    sackAssistPlayers,
    tflPlayers,
    tflAssistPlayers,
    interceptionPlayers,
    passBreakupPlayers,
    forcedFumblePlayers,
    fumbleRecoveryPlayers,
    defensiveTouchdownPlayers,
  }: {
    tacklers: string[];
    assistTacklers: string[];
    sackPlayers: string[];
    sackAssistPlayers: string[];
    tflPlayers: string[];
    tflAssistPlayers: string[];
    interceptionPlayers: string[];
    passBreakupPlayers: string[];
    forcedFumblePlayers: string[];
    fumbleRecoveryPlayers: string[];
    defensiveTouchdownPlayers: string[];
  }) {
    const involved = new Set([
      ...tacklers,
      ...assistTacklers,
      ...sackPlayers,
      ...sackAssistPlayers,
      ...tflPlayers,
      ...tflAssistPlayers,
      ...interceptionPlayers,
      ...passBreakupPlayers,
      ...forcedFumblePlayers,
      ...fumbleRecoveryPlayers,
      ...defensiveTouchdownPlayers,
    ]);

    if (involved.size === 0) return;

    const timestamp = new Date().toISOString();

    const events: DefensiveEvent[] = Array.from(involved).map((player) => ({
      id: createId(),
      gameId: selectedGameId,
      player,
      soloTackles: tacklers.includes(player) ? 1 : 0,
      assistedTackles: assistTacklers.includes(player) ? 1 : 0,
      tacklesForLoss: tflPlayers.includes(player) ? 1 : 0,
      assistedTacklesForLoss: tflAssistPlayers.includes(player) ? 1 : 0,
      sacks: sackPlayers.includes(player) ? 1 : 0,
      assistedSacks: sackAssistPlayers.includes(player) ? 1 : 0,
      interceptions: interceptionPlayers.includes(player) ? 1 : 0,
      passBreakups: passBreakupPlayers.includes(player) ? 1 : 0,
      forcedFumbles: forcedFumblePlayers.includes(player) ? 1 : 0,
      fumbleRecoveries: fumbleRecoveryPlayers.includes(player) ? 1 : 0,
      defensiveTouchdowns: defensiveTouchdownPlayers.includes(player) ? 1 : 0,
      createdAt: timestamp,
    }));

    setDefensiveEvents((current) => [...current, ...events]);
  }

  function inferDefensiveResult({
    yardsAllowed,
    opponentPunt,
    interceptionPlayers,
    forcedFumblePlayers,
    fumbleRecoveryPlayers,
    defensiveTouchdownPlayers,
    sackPlayers,
    sackAssistPlayers,
    tflPlayers,
    tflAssistPlayers,
    passBreakupPlayers,
    penalty,
  }: {
    yardsAllowed: number;
    opponentPunt: boolean;
    interceptionPlayers: string[];
    forcedFumblePlayers: string[];
    fumbleRecoveryPlayers: string[];
    defensiveTouchdownPlayers: string[];
    sackPlayers: string[];
    sackAssistPlayers: string[];
    tflPlayers: string[];
    tflAssistPlayers: string[];
    passBreakupPlayers: string[];
    penalty: boolean;
  }) {
    const results: string[] = [];

    if (opponentPunt) results.push("PUNT");
    if (interceptionPlayers.length > 0) results.push("INT");
    if (fumbleRecoveryPlayers.length > 0) results.push("FUMBLE RECOVERY");
    else if (forcedFumblePlayers.length > 0) results.push("FORCED FUMBLE");
    if (defensiveTouchdownPlayers.length > 0) results.push("DEF TD");
    if (sackPlayers.length > 0 || sackAssistPlayers.length > 0) {
      results.push("SACK");
    } else if (tflPlayers.length > 0 || tflAssistPlayers.length > 0) {
      results.push("TFL");
    }
    if (passBreakupPlayers.length > 0) results.push("PBU");
    if (penalty) results.push("PENALTY");

    if (results.length === 0) {
      if (yardsAllowed < 0) return "LOSS";
      if (yardsAllowed === 0) return "NO GAIN";
      return "NORMAL PLAY";
    }

    return results.join(" • ");
  }

  function saveDefensiveCallEvent() {
    if (!selectedGameId) {
      setMessage("Select a game first.");
      return;
    }

    const parsed = parseDownDistance(defensiveCallEntry.dd);
    const yardsAllowed = Number(defensiveCallEntry.yardsAllowed.trim());
    const penaltyYards =
      defensiveCallEntry.penaltyYards.trim() === ""
        ? 0
        : Number(defensiveCallEntry.penaltyYards.trim());

    if (
      defensiveCallEntry.yardsAllowed.trim() === "" ||
      Number.isNaN(yardsAllowed)
    ) {
      setMessage("Enter yards allowed for the defensive play.");
      return;
    }

    if (Number.isNaN(penaltyYards)) {
      setMessage("Penalty yards must be a number or left blank.");
      return;
    }

    if (!defensiveCallEntry.front.trim()) {
      setMessage("Enter the defensive front.");
      return;
    }

    if (!defensiveCallEntry.coverage.trim()) {
      setMessage("Enter the coverage call.");
      return;
    }

    if (defensiveCallEntry.clock.trim()) {
      const clockSeconds = parseClockToSeconds(defensiveCallEntry.clock);
      const quarterSeconds = quarterLengthMinutes * 60;

      if (clockSeconds === null || clockSeconds > quarterSeconds) {
        setMessage(
          `Enter a valid clock time between 0:00 and ${quarterLengthMinutes}:00.`,
        );
        return;
      }
    }

    const tacklers = resolveDefensivePlayerList(defensiveCallEntry.tacklers);
    const assistTacklers = resolveDefensivePlayerList(
      defensiveCallEntry.assistTacklers,
    );
    const sackPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.sackPlayers,
    );
    const sackAssistPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.sackAssistPlayers,
    );
    const tflPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.tflPlayers,
    );
    const tflAssistPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.tflAssistPlayers,
    );
    const interceptionPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.interceptionPlayers,
    );
    const passBreakupPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.passBreakupPlayers,
    );
    const forcedFumblePlayers = resolveDefensivePlayerList(
      defensiveCallEntry.forcedFumblePlayers,
    );
    const fumbleRecoveryPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.fumbleRecoveryPlayers,
    );
    const defensiveTouchdownPlayers = resolveDefensivePlayerList(
      defensiveCallEntry.defensiveTouchdownPlayers,
    );

    if (tacklers.length > 1) {
      setMessage(
        "A play can have only one solo tackler. Use Assists when multiple defenders share the tackle.",
      );
      return;
    }

    if (tacklers.length > 0 && assistTacklers.length > 0) {
      setMessage(
        "A tackle cannot be both solo and assisted on the same play. Use either one Solo Tackler or one/more Assists.",
      );
      return;
    }

    if (tflPlayers.length > 1) {
      setMessage(
        "A TFL can have only one solo TFL player. Use TFL Assists when multiple defenders share the TFL.",
      );
      return;
    }

    if (tflPlayers.length > 0 && tflAssistPlayers.length > 0) {
      setMessage(
        "A TFL cannot be both solo and assisted on the same play. Use either one Solo TFL or one/more TFL Assists.",
      );
      return;
    }

    if (sackPlayers.length > 1) {
      setMessage(
        "A sack can have only one solo sack player. Use Sack Assists when multiple defenders share the sack.",
      );
      return;
    }

    if (sackPlayers.length > 0 && sackAssistPlayers.length > 0) {
      setMessage(
        "A sack cannot be both solo and assisted on the same play. Use either one Solo Sack or one/more Sack Assists.",
      );
      return;
    }

    const inferredResult = inferDefensiveResult({
      yardsAllowed,
      opponentPunt: defensiveCallEntry.opponentPunt,
      interceptionPlayers,
      forcedFumblePlayers,
      fumbleRecoveryPlayers,
      defensiveTouchdownPlayers,
      sackPlayers,
      sackAssistPlayers,
      tflPlayers,
      tflAssistPlayers,
      passBreakupPlayers,
      penalty: defensiveCallEntry.penalty,
    });

    const event: DefensiveCallEvent = {
      id: createId(),
      gameId: selectedGameId,
      down: parsed.down,
      distance: parsed.distance,
      front: defensiveCallEntry.front.trim(),
      pressure: defensiveCallEntry.pressure.trim(),
      coverage: defensiveCallEntry.coverage.trim(),
      yardsAllowed,
      result: inferredResult,
      quarter: defensiveCallEntry.quarter || "1",
      clock: defensiveCallEntry.clock.trim()
        ? normalizeClock(defensiveCallEntry.clock)
        : "",
      goalToGo: defensiveCallEntry.goalToGo,
      penalty: defensiveCallEntry.penalty,
      penaltyType: defensiveCallEntry.penaltyType.trim(),
      penaltyYards,
      automaticFirstDown: defensiveCallEntry.automaticFirstDown,
      lossOfDown: defensiveCallEntry.lossOfDown,
      repeatDown: defensiveCallEntry.repeatDown,
      opponentPunt: defensiveCallEntry.opponentPunt,
      seriesStart: defensiveCallEntry.seriesStart,
      opponentPossessionStart: defensiveCallEntry.opponentPossessionStart,
      opponentPossessionEnd:
        defensiveCallEntry.opponentPossessionEnd ||
        defensiveCallEntry.opponentPunt,
      tacklers,
      assistTacklers,
      sackPlayers,
      sackAssistPlayers,
      tflPlayers,
      tflAssistPlayers,
      interceptionPlayers,
      passBreakupPlayers,
      forcedFumblePlayers,
      fumbleRecoveryPlayers,
      defensiveTouchdownPlayers,
      createdAt: new Date().toISOString(),
    };

    setDefensiveCallEvents((current) => [...current, event]);

    addDefensiveProductionFromCall({
      tacklers,
      assistTacklers,
      sackPlayers,
      sackAssistPlayers,
      tflPlayers,
      tflAssistPlayers,
      interceptionPlayers,
      passBreakupPlayers,
      forcedFumblePlayers,
      fumbleRecoveryPlayers,
      defensiveTouchdownPlayers,
    });

    setDefensiveCallEntry((current) => ({
      ...current,
      dd: nextDefensiveDownDistance(
        current.dd,
        yardsAllowed,
        event.result,
        {
          goalToGo: current.goalToGo,
          penalty: current.penalty,
          penaltyYards,
          automaticFirstDown: current.automaticFirstDown,
          lossOfDown: current.lossOfDown,
          repeatDown: current.repeatDown,
          opponentPunt: current.opponentPunt,
        },
      ),
      yardsAllowed: "",
      result: "",
      clock: "",
      penalty: false,
      penaltyType: "",
      penaltyYards: "",
      automaticFirstDown: false,
      lossOfDown: false,
      repeatDown: false,
      opponentPunt: false,
      seriesStart: false,
      opponentPossessionStart: false,
      opponentPossessionEnd: false,
      tacklers: "",
      assistTacklers: "",
      sackPlayers: "",
      sackAssistPlayers: "",
      tflPlayers: "",
      tflAssistPlayers: "",
      interceptionPlayers: "",
      passBreakupPlayers: "",
      forcedFumblePlayers: "",
      fumbleRecoveryPlayers: "",
      defensiveTouchdownPlayers: "",
    }));

    setMessage("Defensive call charted.");
  }

  function deleteDefensiveCallEvent(id: string) {
    setDefensiveCallEvents((current) =>
      current.filter((event) => event.id !== id),
    );
  }

  function saveDefensiveEvent() {
    if (!selectedGameId) {
      setMessage("Select a game first.");
      return;
    }

    const player = resolvePlayerInput(defenseEntry.player, seasonPlayers);

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
      assistedTacklesForLoss: 0,
      sacks: numberValue(defenseEntry.sacks),
      assistedSacks: 0,
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

  function createSeason() {
    const year = Number(newSeasonYear.trim());
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setMessage("Enter a valid season year.");
      return;
    }

    const name = newSeasonName.trim() || String(year);

    if (
      seasons.some(
        (season) =>
          season.name.toLowerCase() === name.toLowerCase() ||
          season.year === year,
      )
    ) {
      setMessage("That season already exists.");
      return;
    }

    const season: Season = {
      id: createId(),
      name,
      year,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    setSeasons((current) =>
      [...current, season].sort((a, b) => b.year - a.year),
    );
    setSelectedSeasonId(season.id);
    setSelectedGameId("");
    setNewSeasonName("");
    setNewSeasonYear(String(year + 1));
    setMessage(`${name} season created.`);
  }

  function toggleArchiveSeason(id: string) {
    setSeasons((current) =>
      current.map((season) =>
        season.id === id
          ? { ...season, archived: !season.archived }
          : season,
      ),
    );
  }

  function startEditingSeason(season: Season) {
    setEditingSeasonId(season.id);
    setEditingSeasonName(season.name);
    setEditingSeasonYear(String(season.year));
    setMessage("");
  }

  function cancelEditingSeason() {
    setEditingSeasonId(null);
    setEditingSeasonName("");
    setEditingSeasonYear("");
  }

  function saveEditedSeason(id: string) {
    const year = Number(editingSeasonYear.trim());
    const name = editingSeasonName.trim() || String(year);

    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setMessage("Enter a valid season year.");
      return;
    }

    const duplicate = seasons.some(
      (season) =>
        season.id !== id &&
        (season.year === year ||
          season.name.toLowerCase() === name.toLowerCase()),
    );

    if (duplicate) {
      setMessage("Another season already uses that year or name.");
      return;
    }

    setSeasons((current) =>
      current
        .map((season) =>
          season.id === id
            ? {
                ...season,
                year,
                name,
              }
            : season,
        )
        .sort((a, b) => b.year - a.year),
    );

    setEditingSeasonId(null);
    setEditingSeasonName("");
    setEditingSeasonYear("");
    setMessage(`${name} season updated.`);
  }

  function deleteSeason(id: string) {
    const season = seasons.find((item) => item.id === id);
    if (!season) return;

    const seasonGameIds = new Set(
      games
        .filter((game) => game.seasonId === id)
        .map((game) => game.id),
    );

    const gameCount = seasonGameIds.size;
    const playCount = chartPlays.filter((play) =>
      seasonGameIds.has(play.gameId),
    ).length;

    const confirmed = window.confirm(
      `Delete ${season.name}? This permanently deletes ${gameCount} game${
        gameCount === 1 ? "" : "s"
      }, ${playCount} charted play${
        playCount === 1 ? "" : "s"
      }, the season roster, possessions, defensive calls/stats, and special teams data for this season. This cannot be undone.`,
    );

    if (!confirmed) return;

    const remainingSeasons = seasons
      .filter((item) => item.id !== id)
      .sort((a, b) => b.year - a.year);

    setSeasons(remainingSeasons);
    setGames((current) =>
      current.filter((game) => game.seasonId !== id),
    );
    setChartPlays((current) =>
      current.filter((play) => !seasonGameIds.has(play.gameId)),
    );
    setPossessions((current) =>
      current.filter(
        (possession) => !seasonGameIds.has(possession.gameId),
      ),
    );
    setSpecialTeamsEvents((current) =>
      current.filter(
        (event) => !seasonGameIds.has(event.gameId),
      ),
    );
    setDefensiveEvents((current) =>
      current.filter(
        (event) => !seasonGameIds.has(event.gameId),
      ),
    );
    setDefensiveCallEvents((current) =>
      current.filter(
        (event) => !seasonGameIds.has(event.gameId),
      ),
    );
    setPlayers((current) =>
      current.filter((player) => player.seasonId !== id),
    );

    if (selectedSeasonId === id) {
      const nextSeason =
        remainingSeasons.find((item) => !item.archived) ??
        remainingSeasons[0];

      setSelectedSeasonId(nextSeason?.id ?? "");
      setSelectedGameId("");
    }

    if (editingSeasonId === id) {
      cancelEditingSeason();
    }

    setMessage(`${season.name} season deleted.`);
  }

  function addGame() {
    if (!newOpponent.trim()) {
      setMessage("Type an opponent.");
      return;
    }

    if (!selectedSeasonId) {
      setMessage("Create or select a season before adding a game.");
      return;
    }

    if (selectedSeason?.archived) {
      setMessage("Unarchive this season before adding a game.");
      return;
    }

    const newGame: Game = {
      id: createId(),
      seasonId: selectedSeasonId,
      week: newWeek.trim() || `${seasonGames.length + 1}`,
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

  function normalizeRosterHeader(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function spreadsheetCellText(value: SpreadsheetCell) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function getSpreadsheetValue(
    row: SpreadsheetRow,
    aliases: string[],
  ) {
    const normalizedAliases = new Set(
      aliases.map((alias) => normalizeRosterHeader(alias)),
    );

    for (const [key, value] of Object.entries(row)) {
      if (normalizedAliases.has(normalizeRosterHeader(key))) {
        return spreadsheetCellText(value);
      }
    }

    return "";
  }

  function splitRosterName(fullName: string) {
    const clean = fullName.trim();
    if (!clean) return { firstName: "", lastName: "" };

    if (clean.includes(",")) {
      const [lastName, ...firstParts] = clean
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      return {
        firstName: firstParts.join(" "),
        lastName: lastName ?? "",
      };
    }

    const parts = clean.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }

    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.at(-1) ?? "",
    };
  }

  function normalizeHudlClassYear(value: string) {
    const normalized = value.trim().toLowerCase();

    if (!normalized) return null;

    if (
      ["sr", "senior", "12", "12th", "grade12", "12thgrade"].includes(
        normalizeRosterHeader(normalized),
      )
    ) {
      return 12;
    }

    if (
      ["jr", "junior", "11", "11th", "grade11", "11thgrade"].includes(
        normalizeRosterHeader(normalized),
      )
    ) {
      return 11;
    }

    if (
      ["so", "sophomore", "10", "10th", "grade10", "10thgrade"].includes(
        normalizeRosterHeader(normalized),
      )
    ) {
      return 10;
    }

    if (
      ["fr", "freshman", "9", "9th", "grade9", "9thgrade"].includes(
        normalizeRosterHeader(normalized),
      )
    ) {
      return 9;
    }

    return null;
  }

  function getHudlGraduationYear(
    row: SpreadsheetRow,
    seasonYear: number,
  ) {
    const explicitGraduationYear = getSpreadsheetValue(row, [
      "Graduation Year",
      "Grad Year",
      "Graduation",
      "Class Year",
      "Class Of",
      "Class",
    ]);

    const genericYear = getSpreadsheetValue(row, [
      "Year",
      "School Year",
      "Player Year",
    ]);

    const grade = getSpreadsheetValue(row, [
      "Grade",
      "Grade Level",
      "Yr",
    ]);

    const explicitYearNumber = Number(
      explicitGraduationYear.match(/\b20\d{2}\b/)?.[0] ?? "",
    );

    if (
      Number.isInteger(explicitYearNumber) &&
      explicitYearNumber >= 2000
    ) {
      return {
        rosterYear: explicitGraduationYear,
        graduationYear: explicitYearNumber,
      };
    }

    const genericYearNumber = Number(
      genericYear.match(/\b20\d{2}\b/)?.[0] ?? "",
    );

    if (
      Number.isInteger(genericYearNumber) &&
      genericYearNumber >= 2000
    ) {
      return {
        rosterYear: genericYear,
        graduationYear: genericYearNumber,
      };
    }

    const classGrade =
      normalizeHudlClassYear(grade) ??
      normalizeHudlClassYear(explicitGraduationYear) ??
      normalizeHudlClassYear(genericYear);

    if (classGrade) {
      // In a fall football season, a senior graduates the following calendar
      // year, a junior in +2, sophomore in +3, and freshman in +4.
      return {
        rosterYear: grade || explicitGraduationYear || genericYear,
        graduationYear: seasonYear + (13 - classGrade),
      };
    }

    return {
      rosterYear: explicitGraduationYear || genericYear || grade,
      graduationYear: undefined,
    };
  }

  function normalizeRosterRows(
    rows: SpreadsheetRow[],
    seasonYear: number,
  ) {
    const currentGraduationStart = seasonYear + 1;
    const currentGraduationEnd = seasonYear + 4;

    return rows
      .map((row): RosterImportRow => {
        let firstName = getSpreadsheetValue(row, [
          "First",
          "First Name",
          "Firstname",
          "Player First Name",
        ]);

        let lastName = getSpreadsheetValue(row, [
          "Last",
          "Last Name",
          "Lastname",
          "Player Last Name",
        ]);

        if (!firstName && !lastName) {
          const fullName = getSpreadsheetValue(row, [
            "Name",
            "Player",
            "Player Name",
            "Athlete",
            "Athlete Name",
            "Full Name",
          ]);

          const splitName = splitRosterName(fullName);
          firstName = splitName.firstName;
          lastName = splitName.lastName;
        }

        const jersey = getSpreadsheetValue(row, [
          "Number",
          "No",
          "No.",
          "#",
          "Jersey",
          "Jersey Number",
          "Jersey #",
          "Player Number",
          "Uniform Number",
        ]).replace(/^#/, "");

        const position = getSpreadsheetValue(row, [
          "Position",
          "Pos",
          "Primary Position",
          "Position 1",
        ]);

        const { rosterYear, graduationYear } = getHudlGraduationYear(
          row,
          seasonYear,
        );

        const currentSeasonEligible =
          graduationYear === undefined ||
          (graduationYear >= currentGraduationStart &&
            graduationYear <= currentGraduationEnd);

        return {
          firstName,
          lastName,
          jersey,
          position,
          rosterYear,
          graduationYear,
          currentSeasonEligible,
        };
      })
      .filter(
        (row) =>
          Boolean(row.firstName || row.lastName || row.jersey) &&
          ![
            "first",
            "firstname",
            "name",
            "player",
            "number",
            "jersey",
          ].includes(row.firstName.toLowerCase()),
      );
  }

  async function loadXlsxLibrary() {
    const browserWindow = window as WindowWithXlsx;

    if (browserWindow.XLSX) return browserWindow.XLSX;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-coachboard-xlsx="true"]',
    );

    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        if (browserWindow.XLSX) {
          resolve();
          return;
        }

        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Could not load Excel reader.")),
          { once: true },
        );
      });

      if (!browserWindow.XLSX) {
        throw new Error("Excel reader loaded but was unavailable.");
      }

      return browserWindow.XLSX;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.dataset.coachboardXlsx = "true";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Could not load the Excel roster reader."));
      document.head.appendChild(script);
    });

    if (!browserWindow.XLSX) {
      throw new Error("Excel roster reader is unavailable.");
    }

    return browserWindow.XLSX;
  }

  async function handleRosterFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!selectedSeasonId || !selectedSeason) {
      setMessage("Create or select a season before importing a roster.");
      event.target.value = "";
      return;
    }

    setRosterImportLoading(true);
    setRosterImportRows([]);
    setRosterImportExcludedCount(0);
    setRosterImportFileName(file.name);
    setMessage("");

    try {
      const lowerName = file.name.toLowerCase();
      let importedRows: RosterImportRow[] = [];

      if (
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls")
      ) {
        const xlsx = await loadXlsxLibrary();
        const workbook = xlsx.read(await file.arrayBuffer(), {
          type: "array",
        });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error("The workbook does not contain a worksheet.");
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const sheetRows = xlsx.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        importedRows = normalizeRosterRows(
          sheetRows,
          selectedSeason.year,
        );
      } else {
        throw new Error("Choose an Excel roster file (.xlsx or .xls).");
      }

      if (importedRows.length === 0) {
        throw new Error(
          "No players were detected. CoachBoard looks for name, jersey/number, position, and class/year columns.",
        );
      }

      const currentPlayers = importedRows.filter(
        (row) => row.currentSeasonEligible,
      );
      const excludedPlayers = importedRows.length - currentPlayers.length;

      if (currentPlayers.length === 0) {
        throw new Error(
          `No current players matched the ${selectedSeason.year} season. Hudl graduation years should normally be ${
            selectedSeason.year + 1
          }-${selectedSeason.year + 4}.`,
        );
      }

      setRosterImportRows(currentPlayers);
      setRosterImportExcludedCount(excludedPlayers);
      setMessage(
        `Found ${currentPlayers.length} current player${
          currentPlayers.length === 1 ? "" : "s"
        } for the ${selectedSeason.year} season${
          excludedPlayers
            ? ` and filtered out ${excludedPlayers} past player${
                excludedPlayers === 1 ? "" : "s"
              }`
            : ""
        }. Review the preview, then import.`,
      );
    } catch (error) {
      setRosterImportFileName("");
      setRosterImportRows([]);
      setRosterImportExcludedCount(0);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not read that roster file.",
      );
    } finally {
      setRosterImportLoading(false);
      event.target.value = "";
    }
  }

  function importRosterRows() {
    if (!selectedSeasonId) {
      setMessage("Create or select a season before importing a roster.");
      return;
    }

    if (rosterImportRows.length === 0) {
      setMessage("Choose a roster file first.");
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    setPlayers((current) => {
      const next = [...current];
      const seasonRoster = next.filter(
        (player) => player.seasonId === selectedSeasonId,
      );

      rosterImportRows.forEach((row) => {
        const cleanFirst = row.firstName.trim();
        const cleanLast = row.lastName.trim();
        const cleanJersey = row.jersey.trim().replace(/^#/, "");
        const cleanPosition = row.position.trim();

        const duplicate = seasonRoster.some((player) => {
          const sameJersey =
            cleanJersey &&
            player.jersey.trim().replace(/^#/, "") === cleanJersey;

          const sameName =
            cleanFirst &&
            cleanLast &&
            player.firstName.trim().toLowerCase() ===
              cleanFirst.toLowerCase() &&
            player.lastName.trim().toLowerCase() ===
              cleanLast.toLowerCase();

          return Boolean(sameJersey || sameName);
        });

        if (duplicate) {
          skippedCount += 1;
          return;
        }

        const newPlayer: Player = {
          id: createId(),
          firstName: cleanFirst || "Player",
          lastName: cleanLast,
          jersey: cleanJersey,
          position: cleanPosition,
          seasonId: selectedSeasonId,
        };

        next.push(newPlayer);
        seasonRoster.push(newPlayer);
        addedCount += 1;
      });

      return next.sort(
        (a, b) =>
          Number(a.jersey || 9999) - Number(b.jersey || 9999) ||
          a.lastName.localeCompare(b.lastName),
      );
    });

    setRosterImportRows([]);
    setRosterImportExcludedCount(0);
    setRosterImportFileName("");
    setMessage(
      `Roster import complete: ${addedCount} added${
        skippedCount ? `, ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} skipped` : ""
      }.`,
    );
  }

  function cancelRosterImport() {
    setRosterImportRows([]);
    setRosterImportExcludedCount(0);
    setRosterImportFileName("");
    setMessage("");
  }

  function addPlayer() {
    if (!playerFirst.trim() && !playerNumber.trim()) {
      setMessage("Type at least a first name or jersey number.");
      return;
    }

    if (!selectedSeasonId) {
      setMessage("Create or select a season before adding players.");
      return;
    }

    const newPlayer: Player = {
      id: createId(),
      firstName: playerFirst.trim() || "Player",
      lastName: playerLast.trim(),
      jersey: playerNumber.trim(),
      position: playerPosition.trim(),
      seasonId: selectedSeasonId,
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

  function addSetupMotion() {
    if (!motionSetup.trim()) {
      setMessage("Type a motion.");
      return;
    }

    addMotion(motionSetup);
    setMotionSetup("");
    setMessage("Motion added.");
  }

  function addSetupTag() {
    if (!tagSetup.trim()) {
      setMessage("Type a tag.");
      return;
    }

    addTag(tagSetup);
    setTagSetup("");
    setMessage("Tag added.");
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

  function startEditingPlay(playToEdit: ChartPlay) {
    setEditingPlayId(playToEdit.id);
    setEditPlayDraft({
      dd: `${playToEdit.down} and ${playToEdit.distance}`,
      formation: playToEdit.formation ?? "",
      motion: playToEdit.motion ?? "",
      play: playToEdit.play ?? "",
      tags: (playToEdit.tags ?? []).join(", "),
      yards: String(playToEdit.yards),
      rusher: playToEdit.rusher ?? "",
      passer: playToEdit.passer ?? "",
      receiver: playToEdit.receiver ?? "",
      seriesStart: playToEdit.seriesStart ?? false,
      firstDown: playToEdit.firstDown ?? false,
      result: playToEdit.result ?? "",
      penalty: playToEdit.penaltyType ?? "",
    });
    setMessage(`Editing play #${playToEdit.playNumber}.`);
  }

  function cancelEditingPlay() {
    setEditingPlayId(null);
    setEditPlayDraft(null);
    setMessage("");
  }

  function updateEditPlayDraft<K extends keyof EditPlayDraft>(
    key: K,
    value: EditPlayDraft[K],
  ) {
    setEditPlayDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  function saveEditedPlay(playToEdit: ChartPlay) {
    if (!editPlayDraft) return;

    const parsed = parseDownDistance(editPlayDraft.dd);
    const yards = Number(editPlayDraft.yards.trim());

    if (Number.isNaN(yards)) {
      setMessage("Yards must be a number before saving the edit.");
      return;
    }

    const resultUpper = editPlayDraft.result.trim().toUpperCase();
    const penaltyText = editPlayDraft.penalty.trim();

    const isPunt = resultUpper.includes("PUNT");
    const isTwoPointAttempt =
      resultUpper.includes("2PT") ||
      resultUpper.includes("2 PT") ||
      resultUpper.includes("TWO POINT");
    const isInterception = resultUpper.includes("INT");
    const isFumble = resultUpper.includes("FUM");
    const isTurnover =
      isInterception || isFumble || resultUpper.includes("TO");
    const isTouchdown =
      resultUpper.includes("TD") && !isTwoPointAttempt;
    const isPenalty = Boolean(penaltyText) || resultUpper.includes("PEN");

    const editEntryForType: EntryState = {
      dd: editPlayDraft.dd,
      formation: editPlayDraft.formation,
      motion: editPlayDraft.motion,
      play: editPlayDraft.play,
      tags: [],
      yards: editPlayDraft.yards,
      rusher: editPlayDraft.rusher,
      passer: editPlayDraft.passer,
      receiver: editPlayDraft.receiver,
      result: editPlayDraft.result,
      penalty: editPlayDraft.penalty,
      seriesStart: editPlayDraft.seriesStart,
      possessionStart: false,
      possessionEnd: false,
      possessionClock: "",
      qtr: playToEdit.quarter || "1",
    };

    const playType: PlayType = isPunt
      ? "Punt"
      : detectPlayType(editEntryForType);

    const formationName = isPunt
      ? "Special Teams"
      : addFormation(editPlayDraft.formation.trim() || "Base");

    const motionName = isPunt
      ? ""
      : editPlayDraft.motion.trim()
        ? addMotion(editPlayDraft.motion)
        : "";

    const playName = isPunt
      ? "Punt"
      : addPlayCall(editPlayDraft.play.trim() || "Unknown Play", playType);

    const savedTags = isPunt
      ? []
      : editPlayDraft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .filter(
            (tag, index, array) =>
              array.findIndex(
                (candidate) =>
                  candidate.toLowerCase() === tag.toLowerCase(),
              ) === index,
          )
          .map((tag) => addTag(tag));

    setChartPlays((current) =>
      current.map((play) =>
        play.id === playToEdit.id
          ? {
              ...play,
              down: parsed.down,
              distance: parsed.distance,
              formation: formationName,
              motion: motionName,
              play: playName,
              tags: savedTags,
              playType,
              yards,
              rusher: isPunt
                ? ""
                : resolvePlayerInput(editPlayDraft.rusher, seasonPlayers),
              passer: isPunt
                ? ""
                : resolvePlayerInput(editPlayDraft.passer, seasonPlayers),
              receiver: isPunt
                ? ""
                : resolvePlayerInput(editPlayDraft.receiver, seasonPlayers),
              result: resultUpper,
              touchdown: isTouchdown,
              firstDown: isTouchdown ? false : editPlayDraft.firstDown,
              seriesStart: editPlayDraft.seriesStart,
              turnover: isTurnover,
              penalty: isPenalty,
              penaltyType:
                penaltyText ||
                (resultUpper.includes("PEN") ? "Penalty" : ""),
            }
          : play,
      ),
    );

    setEditingPlayId(null);
    setEditPlayDraft(null);
    setMessage(
      `Updated play #${playToEdit.playNumber}. Stats and reports recalculated automatically.`,
    );
  }

  function deletePlay(id: string) {
    setChartPlays((current) => current.filter((play) => play.id !== id));
  }

  function deleteGame(id: string) {
    const remaining = games.filter((game) => game.id !== id);

    setGames(remaining);
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
    setDefensiveCallEvents((current) =>
      current.filter((event) => event.gameId !== id),
    );

    setSelectedGameId((current) => {
      if (current !== id) return current;
      return remaining[0]?.id ?? "";
    });

    setMessage("Game deleted.");
  }

  function beginEditRosterPlayer(player: Player) {
    setEditingRosterPlayerId(player.id);
    setEditingRosterPlayer({
      firstName: player.firstName,
      lastName: player.lastName,
      jersey: player.jersey,
      position: player.position,
    });
    setMessage("");
  }

  function cancelEditRosterPlayer() {
    setEditingRosterPlayerId(null);
    setEditingRosterPlayer({
      firstName: "",
      lastName: "",
      jersey: "",
      position: "",
    });
  }

  function saveRosterPlayerEdit() {
    if (!editingRosterPlayerId) return;

    const firstName = editingRosterPlayer.firstName.trim();
    const lastName = editingRosterPlayer.lastName.trim();
    const jersey = editingRosterPlayer.jersey.trim().replace(/^#/, "");
    const position = editingRosterPlayer.position.trim();

    if (!firstName && !lastName) {
      setMessage("Enter a player name before saving.");
      return;
    }

    const duplicateNumber = players.some(
      (player) =>
        player.id !== editingRosterPlayerId &&
        player.seasonId === selectedSeasonId &&
        jersey &&
        player.jersey.trim().replace(/^#/, "") === jersey,
    );

    if (duplicateNumber) {
      setMessage(`Jersey #${jersey} is already assigned to another player.`);
      return;
    }

    setPlayers((current) =>
      current
        .map((player) =>
          player.id === editingRosterPlayerId
            ? {
                ...player,
                firstName,
                lastName,
                jersey,
                position,
              }
            : player,
        )
        .sort(
          (a, b) =>
            Number(a.jersey || 9999) - Number(b.jersey || 9999) ||
            a.lastName.localeCompare(b.lastName),
        ),
    );

    setMessage(
      `${[firstName, lastName].filter(Boolean).join(" ")} updated successfully.`,
    );
    cancelEditRosterPlayer();
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

  function deleteMotion(id: string) {
    setMotions((current) => current.filter((motion) => motion.id !== id));
  }

  function deleteTag(id: string) {
    setTags((current) => current.filter((tag) => tag.id !== id));
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
    if (!window.confirm("Clear all shared analytics data for this team? This affects every coach in the program.")) return;

    setSeasons([]);
    setSelectedSeasonId("");
    setPlayers([]);
    setFormations([]);
    setMotions([]);
    setPlays([]);
    setTags([]);
    setGames([]);
    setChartPlays([]);
    setPossessions([]);
    setSpecialTeamsEvents([]);
    setDefensiveEvents([]);
    setQuarterLengthMinutes(12);
    setSelectedGameId("");
    setMessage("Analytics data cleared.");
  }

  function togglePrintSelection(key: string) {
    setPrintSelections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function setVisiblePrintSelections(value: boolean) {
    const keys =
      reportSection === "offense"
        ? [
            "summary",
            "decisionEngine",
            "playerAnalytics",
            "penalties",
            "possessions",
            "playRankings",
            "formationRankings",
            "motionRankings",
            "tagRankings",
            "formationMotion",
            "formationPlay",
            "playTag",
            "formationPlayTag",
            ...(reportScope === "season" ? ["gameBreakdown"] : []),
            ...(reportScope === "allTime" ? ["yearOverYear"] : []),
          ]
        : reportSection === "defense"
          ? ["defense"]
          : ["specialTeams"];

    setPrintSelections((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        next[key] = value;
      });
      return next;
    });
  }

  const visiblePrintOptions =
    reportSection === "offense"
      ? [
          ["summary", "Summary Metrics"],
          ["decisionEngine", "Decision Engine / Play Success"],
          ["playerAnalytics", "Player Analytics"],
          ["penalties", "Penalty Analytics"],
          ["possessions", "Possession Analytics"],
          ["playRankings", "Play Rankings"],
          ["formationRankings", "Formation Rankings"],
          ["motionRankings", "Motion Rankings"],
          ["tagRankings", "Tag Rankings"],
          ["formationMotion", "Formation + Motion Rankings"],
          ["formationPlay", "Formation + Play Rankings"],
          ["playTag", "Play + Tag Rankings"],
          ["formationPlayTag", "Formation + Play + Tag Rankings"],
          ...(reportScope === "season"
            ? [["gameBreakdown", "Game-by-Game Breakdown"]]
            : []),
          ...(reportScope === "allTime"
            ? [["yearOverYear", "Year-over-Year Comparison"]]
            : []),
        ]
      : reportSection === "defense"
        ? [["defense", "Defense Report"]]
        : [["specialTeams", "Special Teams Report"]];

  return (
    <main className="analytics-page" style={pageStyle}>
      <style>{`
        .analytics-page,
        .analytics-page * {
          box-sizing: border-box;
        }

        @media (max-width: 1180px) {
          .analytics-page {
            padding: 12px !important;
          }

          .analytics-topbar {
            gap: 12px !important;
            padding: 16px !important;
            align-items: center !important;
          }

          .analytics-main-nav,
          .analytics-subnav {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            scrollbar-width: thin;
            max-width: 100%;
          }

          .analytics-main-nav button,
          .analytics-subnav button {
            flex: 0 0 auto !important;
            min-height: 44px;
          }

          .analytics-metric-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .analytics-entry-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .analytics-possession-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .analytics-below-play-insights {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .analytics-season-create-grid {
            grid-template-columns: 120px minmax(0, 1fr) auto !important;
          }

          .analytics-game-create-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .print-reports-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .analytics-page input,
          .analytics-page select,
          .analytics-page button {
            min-height: 42px;
          }
        }

        @media (max-width: 820px) {
          .analytics-page {
            padding: 8px !important;
          }

          .analytics-topbar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            padding: 12px !important;
          }

          .analytics-topbar > div:last-child {
            justify-content: flex-start !important;
            width: 100%;
          }

          .analytics-topbar select {
            flex: 1 1 160px;
            min-width: 0 !important;
          }

          .analytics-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .analytics-entry-grid,
          .analytics-possession-grid,
          .analytics-game-create-grid,
          .analytics-season-create-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .analytics-page input,
          .analytics-page select,
          .analytics-page button {
            min-height: 44px;
            font-size: 16px;
          }

          .analytics-page table {
            font-size: 12px;
          }
        }
      `}</style>
      <header className="analytics-topbar" style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>COACHBOARD</div>
          <h1 style={titleStyle}>Analytics</h1>
          <p style={subTitleStyle}>
            {activeTeamName ? `${activeTeamName} • ` : ""}
            {selectedSeason ? `${selectedSeason.name} • ` : ""}
            {selectedGame
              ? `Week ${selectedGame.week} vs ${selectedGame.opponent}`
              : "No game selected"}
            {syncingAnalytics ? " • Syncing..." : ""}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <select
            value={selectedSeasonId}
            onChange={(event) => {
              setSelectedSeasonId(event.target.value);
              setReportScope("season");
            }}
            style={{
              ...gameSelectStyle,
              minWidth: 150,
            }}
            title="Active analytics season"
          >
            {seasons.length === 0 && <option value="">No season</option>}
            {[...seasons]
              .sort((a, b) => b.year - a.year)
              .map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}{season.archived ? " (Archived)" : ""}
                </option>
              ))}
          </select>

          <Link href="/" style={backButtonStyle}>
            Back to CoachBoard
          </Link>
        </div>
      </header>

      {message && <div style={messageStyle}>{message}</div>}

      <nav className="analytics-main-nav" style={navStyle}>
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
        <div className="analytics-subnav" style={gameCenterSubnavStyle}>
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
          <section className="analytics-metric-grid" style={topMetricGridStyle}>
            <Metric label="Total Yards" value={stats.yards} />
            <Metric label="Rush" value={stats.rushYards} />
            <Metric label="Pass" value={stats.passYards} />
            <Metric label="Plays" value={stats.total} />
            <Metric label="TDs" value={stats.tds} />
            <Metric label="Punts" value={stats.punts} />
            <Metric
              label="2PT"
              value={`${stats.twoPointMade}/${stats.twoPointAttempts}`}
            />
            <Metric label="Turnovers" value={stats.turnovers} danger={stats.turnovers > 0} />
            <Metric label="Penalties" value={stats.penalties} danger={stats.penalties > 0} />
            <Metric label="1st Downs Earned" value={stats.firstDownsEarned} />
            <Metric
              label="3rd Down Conversion"
              value={`${stats.thirdDownConversions}/${stats.thirdDownAttempts} • ${stats.thirdDownConversionRate}%`}
            />
            <Metric
              label="4th Down Conversion"
              value={`${stats.fourthDownConversions}/${stats.fourthDownAttempts} • ${stats.fourthDownConversionRate}%`}
            />
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
                  {seasonGames.length === 0 && (
                    <option value="">Add a game first</option>
                  )}
                  {seasonGames.map((game) => (
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
                />
                <SheetInput
                  label="Motion"
                  value={entry.motion}
                  onChange={(value) => updateEntry("motion", value)}
                  onKeyDown={handleEnterSave}
                  list="motion-options"
                />
                <SheetInput
                  label="Play"
                  value={entry.play}
                  onChange={(value) => updateEntry("play", value)}
                  onKeyDown={handleEnterSave}
                  list="play-options"
                />
                <div style={tagEntryFieldStyle}>
                  <span style={tagEntryLabelStyle}>Tags</span>
                  <div style={tagPickerStyle}>
                    {entry.tags.length > 0 && (
                      <div style={selectedTagsStyle}>
                        {entry.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            style={selectedTagPillStyle}
                            onClick={() => removeEntryTag(tag)}
                            title={`Remove ${tag}`}
                          >
                            {tag} ×
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={tagInputRowStyle}>
                      <input
                        style={tagPickerInputStyle}
                        list="tag-options"
                        placeholder="Tag, Tag, Tag"
                        value={tagDraft}
                        onChange={(event) => handleTagDraftChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitTagDraft();
                          }
                        }}
                        onBlur={commitTagDraft}
                      />
                    </div>
                  </div>
                </div>
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
                  placeholder=""
                />
                <SheetInput
                  label="Penalty"
                  value={entry.penalty}
                  onChange={(value) => updateEntry("penalty", value)}
                  onKeyDown={handleEnterSave}
                  placeholder=""
                />

              </div>

              <datalist id="formation-options">
                {formations.map((formation) => (
                  <option key={formation.id} value={formation.name} />
                ))}
              </datalist>

              <datalist id="motion-options">
                {motions.map((motion) => (
                  <option key={motion.id} value={motion.name} />
                ))}
              </datalist>

              <datalist id="play-options">
                {plays.map((play) => (
                  <option key={play.id} value={play.name} />
                ))}
              </datalist>

              <datalist id="tag-options">
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>

              <datalist id="player-options">
                {seasonPlayers.map((player) => (
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
                      <th style={modernThStyle}>Motion</th>
                      <th style={modernThStyle}>Play</th>
                      <th style={modernThStyle}>Tags</th>
                      <th style={modernThStyle}>Yards</th>
                      <th style={modernThStyle}>Rusher</th>
                      <th style={modernThStyle}>Passer</th>
                      <th style={modernThStyle}>Receiver</th>
                      <th style={modernThStyle}>Series</th>
                      <th style={modernThStyle}>1st Down</th>
                      <th style={modernThStyle}>Result</th>
                      <th style={modernThStyle}>Penalty</th>
                      <th style={modernThStyle}>Grade</th>
                      <th style={modernThStyle}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentGamePlays.length === 0 && (
                      <tr>
                        <td style={emptyTdStyle} colSpan={17}>
                          No plays entered yet. Type a play and press SAVE PLAY.
                        </td>
                      </tr>
                    )}

                    {currentGamePlays.map((row) => {
                      const isEditing =
                        editingPlayId === row.id && Boolean(editPlayDraft);

                      if (isEditing && editPlayDraft) {
                        return (
                          <tr key={row.id} style={editingRowStyle}>
                            <td style={modernTdStyle}>{row.playNumber}</td>

                            <td style={modernTdStyle}>
                              <input
                                style={inlineEditInputStyle}
                                value={editPlayDraft.dd}
                                onChange={(event) =>
                                  updateEditPlayDraft("dd", event.target.value)
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={inlineEditInputStyle}
                                list="formation-options"
                                value={editPlayDraft.formation}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "formation",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={inlineEditInputStyle}
                                list="motion-options"
                                value={editPlayDraft.motion}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "motion",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={inlineEditInputStyle}
                                list="play-options"
                                value={editPlayDraft.play}
                                onChange={(event) =>
                                  updateEditPlayDraft("play", event.target.value)
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 150 }}
                                list="tag-options"
                                placeholder="Tag, Tag, Tag"
                                value={editPlayDraft.tags}
                                onChange={(event) =>
                                  updateEditPlayDraft("tags", event.target.value)
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, width: 70 }}
                                inputMode="numeric"
                                value={editPlayDraft.yards}
                                onChange={(event) =>
                                  updateEditPlayDraft("yards", event.target.value)
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 130 }}
                                list="player-options"
                                value={editPlayDraft.rusher}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "rusher",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 130 }}
                                list="player-options"
                                value={editPlayDraft.passer}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "passer",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 130 }}
                                list="player-options"
                                value={editPlayDraft.receiver}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "receiver",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <label style={inlineCheckboxLabelStyle}>
                                <input
                                  type="checkbox"
                                  checked={editPlayDraft.seriesStart}
                                  onChange={(event) =>
                                    updateEditPlayDraft(
                                      "seriesStart",
                                      event.target.checked,
                                    )
                                  }
                                />
                                Start
                              </label>
                            </td>

                            <td style={modernTdStyle}>
                              <label style={inlineCheckboxLabelStyle}>
                                <input
                                  type="checkbox"
                                  checked={
                                    !editPlayDraft.result
                                      .trim()
                                      .toUpperCase()
                                      .includes("TD") &&
                                    editPlayDraft.firstDown
                                  }
                                  disabled={editPlayDraft.result
                                    .trim()
                                    .toUpperCase()
                                    .includes("TD")}
                                  onChange={(event) =>
                                    updateEditPlayDraft(
                                      "firstDown",
                                      event.target.checked,
                                    )
                                  }
                                />
                                {editPlayDraft.result
                                  .trim()
                                  .toUpperCase()
                                  .includes("TD")
                                  ? "TD"
                                  : "Earned"}
                              </label>
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 100 }}
                                placeholder="TD, INC, INT..."
                                value={editPlayDraft.result}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "result",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <input
                                style={{ ...inlineEditInputStyle, minWidth: 120 }}
                                value={editPlayDraft.penalty}
                                onChange={(event) =>
                                  updateEditPlayDraft(
                                    "penalty",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>

                            <td style={modernTdStyle}>
                              <span style={editGradeHintStyle}>Auto</span>
                            </td>

                            <td style={modernTdStyle}>
                              <div style={playActionButtonsStyle}>
                                <button
                                  type="button"
                                  style={miniSaveEditButtonStyle}
                                  onClick={() => saveEditedPlay(row)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  style={miniCancelEditButtonStyle}
                                  onClick={cancelEditingPlay}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const grade = classify(row);

                      return (
                        <tr key={row.id} style={rowStyleForGrade(grade)}>
                          <td style={modernTdStyle}>{row.playNumber}</td>
                          <td style={modernTdStyle}>
                            {row.down} and {row.distance}
                          </td>
                          <td style={modernTdStyle}>{row.formation}</td>
                          <td style={modernTdStyle}>{row.motion}</td>
                          <td style={modernTdStyle}>{row.play}</td>
                          <td style={modernTdStyle}>
                            <div style={tableTagWrapStyle}>
                              {row.tags.map((tag) => (
                                <span key={tag} style={tableTagPillStyle}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
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
                            <div style={playActionButtonsStyle}>
                              <button
                                type="button"
                                style={miniEditButtonStyle}
                                onClick={() => startEditingPlay(row)}
                                disabled={Boolean(editingPlayId)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={miniDeleteButtonStyle}
                                onClick={() => deletePlay(row.id)}
                                title="Delete play"
                                disabled={Boolean(editingPlayId)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>


          </section>

          <section className="analytics-below-play-insights" style={belowPlayInsightsGridStyle}>
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
                        <b>
                          {player.completions}/{player.passAttempts}
                        </b>
                        <small>{player.passingYards} yards</small>
                      </div>

                      <div style={individualStatBoxStyle}>
                        <span>Receiving</span>
                        <b>
                          {player.receptions}/{player.targets}
                        </b>
                        <small>{player.receivingYards} yards</small>
                      </div>
                    </div>

                    <small style={individualStatDetailStyle}>
                      {player.totalYards} combined rushing/receiving yards • {player.tds} TD
                    </small>
                  </div>
                ))}
              </div>
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
        <div style={{ display: "grid", gap: 14 }}>
          <section style={panelStyle}>
            <div style={smallRedStyle}>SEASONS</div>
            <h2 style={panelTitleStyle}>Season Manager</h2>

            <div
              className="analytics-season-create-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "150px minmax(180px, 1fr) auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                style={inputStyle}
                placeholder="Year"
                value={newSeasonYear}
                onChange={(event) => setNewSeasonYear(event.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="Season name (optional)"
                value={newSeasonName}
                onChange={(event) => setNewSeasonName(event.target.value)}
              />
              <button style={primaryButtonStyle} onClick={createSeason}>
                Create Season
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 8,
                marginTop: 12,
              }}
            >
              {[...seasons]
                .sort((a, b) => b.year - a.year)
                .map((season) => (
                  <div
                    key={season.id}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border:
                        selectedSeasonId === season.id
                          ? "2px solid #dc2626"
                          : "1px solid rgba(15,23,42,.10)",
                      background: "#f8fafc",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {editingSeasonId === season.id ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "110px minmax(0, 1fr)",
                            gap: 7,
                          }}
                        >
                          <input
                            style={inputStyle}
                            value={editingSeasonYear}
                            onChange={(event) =>
                              setEditingSeasonYear(event.target.value)
                            }
                            placeholder="Year"
                          />
                          <input
                            style={inputStyle}
                            value={editingSeasonName}
                            onChange={(event) =>
                              setEditingSeasonName(event.target.value)
                            }
                            placeholder="Season name"
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 7,
                          }}
                        >
                          <button
                            style={smallActionButtonStyle}
                            onClick={() => saveEditedSeason(season.id)}
                          >
                            Save Changes
                          </button>
                          <button
                            style={dangerButtonStyle}
                            onClick={cancelEditingSeason}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          style={{
                            ...smallActionButtonStyle,
                            width: "100%",
                            fontWeight: 900,
                          }}
                          onClick={() => {
                            setSelectedSeasonId(season.id);
                            setReportScope("season");
                          }}
                        >
                          {season.name}
                        </button>

                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          {season.archived ? "Archived" : "Active"} •{" "}
                          {
                            games.filter(
                              (game) => game.seasonId === season.id,
                            ).length
                          }{" "}
                          games
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 7,
                          }}
                        >
                          <button
                            style={smallActionButtonStyle}
                            onClick={() => startEditingSeason(season)}
                          >
                            Edit
                          </button>

                          <button
                            style={
                              season.archived
                                ? smallActionButtonStyle
                                : dangerButtonStyle
                            }
                            onClick={() => toggleArchiveSeason(season.id)}
                          >
                            {season.archived ? "Unarchive" : "Archive"}
                          </button>

                          <button
                            style={dangerButtonStyle}
                            onClick={() => deleteSeason(season.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </section>

          <section style={panelStyle}>
            <div style={smallRedStyle}>SCHEDULE</div>
            <h2 style={panelTitleStyle}>
              {selectedSeason?.name ?? "Season"} Games
            </h2>

            <div className="analytics-game-create-grid" style={formThreeStyle}>
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

            <button
              style={primaryButtonStyle}
              onClick={addGame}
              disabled={!selectedSeasonId || selectedSeason?.archived}
            >
              Add Game
            </button>

            <List>
              {seasonGames.length === 0 && (
                <Row>
                  <span>No games have been added to this season yet.</span>
                </Row>
              )}

              {seasonGames.map((game) => (
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

                    <button
                      style={dangerButtonStyle}
                      onClick={() => deleteGame(game.id)}
                    >
                      Delete
                    </button>
                  </div>
                </Row>
              ))}
            </List>
          </section>
        </div>
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
        <div style={{ display: "grid", gap: 14 }}>
          <section style={panelStyle}>
            <div style={panelHeaderRowStyle}>
              <div>
                <div style={smallRedStyle}>DEFENSE</div>
                <h2 style={panelTitleStyle}>Defensive Call Charting</h2>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                  Chart the front, stunt/blitz, coverage, and result on every defensive snap.
                </div>
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
              <Metric label="Snaps Charted" value={defensiveCallStats.snaps} />
              <Metric
                label="Opponent Punts"
                value={currentGameDefensiveCalls.filter(
                  (event) => event.opponentPunt,
                ).length}
              />
              <Metric
                label="Opponent Series Starts"
                value={currentGameDefensiveCalls.filter(
                  (event) => event.seriesStart,
                ).length}
              />
              <Metric
                label="Opponent TOP"
                value={formatDuration(opponentPossessionStats.totalSeconds)}
              />
              <Metric label="Yards Allowed" value={defensiveCallStats.yardsAllowed} />
              <Metric label="Avg Allowed" value={defensiveCallStats.averageAllowed} />
              <Metric label="Stop Rate" value={`${defensiveCallStats.stopRate}%`} />
              <Metric
                label="Explosive Allowed"
                value={`${defensiveCallStats.explosiveAllowedRate}%`}
              />
              <Metric label="Tackles" value={defenseStats.totalTackles} />
              <Metric label="Solo TFL" value={defenseStats.tacklesForLoss} />
              <Metric
                label="TFL Assists"
                value={defenseStats.assistedTacklesForLoss}
              />
              <Metric label="Solo Sacks" value={defenseStats.sacks} />
              <Metric
                label="Sack Assists"
                value={defenseStats.assistedSacks}
              />
              <Metric label="INT" value={defenseStats.interceptions} />
              <Metric label="PBU" value={defenseStats.passBreakups} />
              <Metric label="Forced Fumbles" value={defenseStats.forcedFumbles} />
              <Metric label="Recoveries" value={defenseStats.fumbleRecoveries} />
            </div>

            <div
              className="analytics-defense-call-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
                alignItems: "end",
                marginTop: 12,
              }}
            >
              <label style={possessionFieldStyle}>
                <span>Down / Distance</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.dd}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      dd: event.target.value,
                    }))
                  }
                  placeholder="1 and 10"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Front</span>
                <input
                  style={inputStyle}
                  list="coachboard-defense-fronts"
                  value={defensiveCallEntry.front}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      front: event.target.value,
                    }))
                  }
                  placeholder="Odd, Even, Bear..."
                />
                <datalist id="coachboard-defense-fronts">
                  {defensiveFrontOptions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>

              <label style={possessionFieldStyle}>
                <span>Stunt / Blitz</span>
                <input
                  style={inputStyle}
                  list="coachboard-defense-pressures"
                  value={defensiveCallEntry.pressure}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      pressure: event.target.value,
                    }))
                  }
                  placeholder="None, Tex, Mike Blitz..."
                />
                <datalist id="coachboard-defense-pressures">
                  {defensivePressureOptions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>

              <label style={possessionFieldStyle}>
                <span>Coverage</span>
                <input
                  style={inputStyle}
                  list="coachboard-defense-coverages"
                  value={defensiveCallEntry.coverage}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      coverage: event.target.value,
                    }))
                  }
                  placeholder="Cover 3, Quarters..."
                />
                <datalist id="coachboard-defense-coverages">
                  {defensiveCoverageOptions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>

              <label style={possessionFieldStyle}>
                <span>Yards Allowed</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={defensiveCallEntry.yardsAllowed}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      yardsAllowed: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Opponent Punt</span>
                <select
                  style={inputStyle}
                  value={defensiveCallEntry.opponentPunt ? "yes" : "no"}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      opponentPunt: event.target.value === "yes",
                      opponentPossessionEnd:
                        event.target.value === "yes"
                          ? true
                          : current.opponentPossessionEnd,
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>

              <label style={possessionFieldStyle}>
                <span>Goal-to-Go</span>
                <select
                  style={inputStyle}
                  value={defensiveCallEntry.goalToGo ? "yes" : "no"}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      goalToGo: event.target.value === "yes",
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>

              <label style={possessionFieldStyle}>
                <span>Penalty</span>
                <select
                  style={inputStyle}
                  value={defensiveCallEntry.penalty ? "yes" : "no"}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      penalty: event.target.value === "yes",
                    }))
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>

              {defensiveCallEntry.penalty && (
                <>
                  <label style={possessionFieldStyle}>
                    <span>Penalty Type</span>
                    <input
                      style={inputStyle}
                      value={defensiveCallEntry.penaltyType}
                      onChange={(event) =>
                        setDefensiveCallEntry((current) => ({
                          ...current,
                          penaltyType: event.target.value,
                        }))
                      }
                      placeholder="Holding, DPI..."
                    />
                  </label>

                  <label style={possessionFieldStyle}>
                    <span>Penalty Yards</span>
                    <input
                      style={inputStyle}
                      type="number"
                      value={defensiveCallEntry.penaltyYards}
                      onChange={(event) =>
                        setDefensiveCallEntry((current) => ({
                          ...current,
                          penaltyYards: event.target.value,
                        }))
                      }
                      placeholder="10 or -5"
                    />
                  </label>

                  <label style={possessionFieldStyle}>
                    <span>Penalty Effect</span>
                    <select
                      style={inputStyle}
                      value={
                        defensiveCallEntry.automaticFirstDown
                          ? "auto-first"
                          : defensiveCallEntry.lossOfDown
                            ? "loss-down"
                            : defensiveCallEntry.repeatDown
                              ? "repeat-down"
                              : "normal"
                      }
                      onChange={(event) =>
                        setDefensiveCallEntry((current) => ({
                          ...current,
                          automaticFirstDown:
                            event.target.value === "auto-first",
                          lossOfDown: event.target.value === "loss-down",
                          repeatDown: event.target.value === "repeat-down",
                        }))
                      }
                    >
                      <option value="normal">Normal Enforcement</option>
                      <option value="auto-first">Automatic 1st Down</option>
                      <option value="loss-down">Loss of Down</option>
                      <option value="repeat-down">Repeat Down</option>
                    </select>
                  </label>
                </>
              )}

              <label style={possessionFieldStyle}>
                <span>Solo Tackler</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.tacklers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      tacklers: event.target.value,
                    }))
                  }
                  placeholder="#3"
                  title="Only one solo tackler may be credited on a play."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Assist(s)</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.assistTacklers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      assistTacklers: event.target.value,
                    }))
                  }
                  placeholder="#5, #44"
                  title="Use commas for multiple assisting tacklers."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Solo TFL</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.tflPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      tflPlayers: event.target.value,
                    }))
                  }
                  placeholder="#44"
                  title="Only one solo TFL player may be credited on a play."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>TFL Assist(s)</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.tflAssistPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      tflAssistPlayers: event.target.value,
                    }))
                  }
                  placeholder="#44, #55"
                  title="Use commas for multiple players sharing the TFL."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Solo Sack</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.sackPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      sackPlayers: event.target.value,
                    }))
                  }
                  placeholder="#9"
                  title="Only one solo sack player may be credited on a play."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Sack Assist(s)</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.sackAssistPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      sackAssistPlayers: event.target.value,
                    }))
                  }
                  placeholder="#9, #44"
                  title="Use commas for multiple players sharing the sack."
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>INT Player</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.interceptionPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      interceptionPlayers: event.target.value,
                    }))
                  }
                  placeholder="#2"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>PBU Player(s)</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.passBreakupPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      passBreakupPlayers: event.target.value,
                    }))
                  }
                  placeholder="#7, #12"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Forced Fumble</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.forcedFumblePlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      forcedFumblePlayers: event.target.value,
                    }))
                  }
                  placeholder="#44"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Fumble Recovery</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.fumbleRecoveryPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      fumbleRecoveryPlayers: event.target.value,
                    }))
                  }
                  placeholder="#5"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Defensive TD</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.defensiveTouchdownPlayers}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      defensiveTouchdownPlayers: event.target.value,
                    }))
                  }
                  placeholder="#2"
                />
              </label>

              <label style={possessionFieldStyle}>
                <span>Qtr</span>
                <select
                  style={inputStyle}
                  value={defensiveCallEntry.quarter}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      quarter: event.target.value,
                    }))
                  }
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="OT">OT</option>
                </select>
              </label>

              <label style={possessionFieldStyle}>
                <span>Clock</span>
                <input
                  style={inputStyle}
                  value={defensiveCallEntry.clock}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      clock: event.target.value,
                    }))
                  }
                  placeholder="8:42"
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 10,
                alignItems: "center",
              }}
            >
              <label style={{ ...checkboxLabelStyle, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={defensiveCallEntry.seriesStart}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      seriesStart: event.target.checked,
                    }))
                  }
                />
                Start of Series
              </label>

              <label style={{ ...checkboxLabelStyle, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={defensiveCallEntry.opponentPossessionStart}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      opponentPossessionStart: event.target.checked,
                    }))
                  }
                />
                Opponent Possession Start
              </label>

              <label style={{ ...checkboxLabelStyle, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={defensiveCallEntry.opponentPossessionEnd}
                  onChange={(event) =>
                    setDefensiveCallEntry((current) => ({
                      ...current,
                      opponentPossessionEnd: event.target.checked,
                    }))
                  }
                />
                Opponent Possession End
              </label>

              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                Quarter + clock are used to calculate opponent time of possession.
              </span>
            </div>

            <button style={saveButtonStyle} onClick={saveDefensiveCallEvent}>
              SAVE DEFENSIVE PLAY
            </button>

            <div style={tableWrapStyle}>
              <table style={{ ...modernTableStyle, minWidth: 1680 }}>
                <thead>
                  <tr>
                    <th style={modernThStyle}>#</th>
                    <th style={modernThStyle}>D / D</th>
                    <th style={modernThStyle}>Front</th>
                    <th style={modernThStyle}>Stunt / Blitz</th>
                    <th style={modernThStyle}>Coverage</th>
                    <th style={modernThStyle}>Yds</th>
                    <th style={modernThStyle}>Result</th>
                    <th style={modernThStyle}>Solo</th>
                    <th style={modernThStyle}>Assist(s)</th>
                    <th style={modernThStyle}>Solo TFL</th>
                    <th style={modernThStyle}>TFL Ast</th>
                    <th style={modernThStyle}>Solo Sack</th>
                    <th style={modernThStyle}>Sack Ast</th>
                    <th style={modernThStyle}>Other Player Stats</th>
                    <th style={modernThStyle}>Q / Clock</th>
                    <th style={modernThStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentGameDefensiveCalls.length === 0 && (
                    <tr>
                      <td style={emptyTdStyle} colSpan={16}>
                        No defensive calls charted yet.
                      </td>
                    </tr>
                  )}

                  {currentGameDefensiveCalls.map((event, index) => (
                    <tr key={event.id}>
                      <td style={modernTdStyle}>{index + 1}</td>
                      <td style={modernTdStyle}>
                        {event.down} & {event.distance}
                      </td>
                      <td style={modernTdStyle}>{event.front || "—"}</td>
                      <td style={modernTdStyle}>{event.pressure || "—"}</td>
                      <td style={modernTdStyle}>{event.coverage || "—"}</td>
                      <td style={modernTdStyle}>{event.yardsAllowed}</td>
                      <td style={modernTdStyle}>
                        {[
                          event.result || "",
                          event.goalToGo ? "GOAL-TO-GO" : "",
                          event.penalty
                            ? `PEN${event.penaltyType ? `: ${event.penaltyType}` : ""}${
                                event.penaltyYards ? ` (${event.penaltyYards})` : ""
                              }`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.tacklers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.assistTacklers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.tflPlayers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.tflAssistPlayers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.sackPlayers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {(event.sackAssistPlayers ?? []).join(", ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        {[
                          (event.interceptionPlayers ?? []).length
                            ? `INT: ${(event.interceptionPlayers ?? []).join(", ")}`
                            : "",
                          (event.passBreakupPlayers ?? []).length
                            ? `PBU: ${(event.passBreakupPlayers ?? []).join(", ")}`
                            : "",
                          (event.forcedFumblePlayers ?? []).length
                            ? `FF: ${(event.forcedFumblePlayers ?? []).join(", ")}`
                            : "",
                          (event.fumbleRecoveryPlayers ?? []).length
                            ? `FR: ${(event.fumbleRecoveryPlayers ?? []).join(", ")}`
                            : "",
                          (event.defensiveTouchdownPlayers ?? []).length
                            ? `TD: ${(event.defensiveTouchdownPlayers ?? []).join(", ")}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </td>
                      <td style={modernTdStyle}>
                        Q{event.quarter} {event.clock}
                        {event.seriesStart ? " • SERIES" : ""}
                        {event.opponentPossessionStart ? " • START" : ""}
                        {event.opponentPossessionEnd ? " • END" : ""}
                      </td>
                      <td style={modernTdStyle}>
                        <button
                          style={miniDeleteButtonStyle}
                          onClick={() => deleteDefensiveCallEvent(event.id)}
                          title="Delete defensive play"
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
            <div>
              <div style={smallRedStyle}>PLAYER PRODUCTION</div>
              <h2 style={panelTitleStyle}>Defensive Player Totals</h2>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                Player stats are generated directly from the defensive play charting above.
              </div>
            </div>

            <div style={tableWrapStyle}>
              <table style={modernTableStyle}>
                <thead>
                  <tr>
                    <th style={modernThStyle}>Player</th>
                    <th style={modernThStyle}>Solo</th>
                    <th style={modernThStyle}>Ast</th>
                    <th style={modernThStyle}>Solo TFL</th>
                    <th style={modernThStyle}>TFL Ast</th>
                    <th style={modernThStyle}>Solo Sack</th>
                    <th style={modernThStyle}>Sack Ast</th>
                    <th style={modernThStyle}>INT</th>
                    <th style={modernThStyle}>PBU</th>
                    <th style={modernThStyle}>FF</th>
                    <th style={modernThStyle}>FR</th>
                    <th style={modernThStyle}>TD</th>
                  </tr>
                </thead>
                <tbody>
                  {currentGameDefense.length === 0 && (
                    <tr>
                      <td style={emptyTdStyle} colSpan={12}>
                        Player totals will build automatically as defensive plays are charted.
                      </td>
                    </tr>
                  )}
                  {aggregateDefense(currentGameDefense).map((row) => (
                    <tr key={row.player}>
                      <td style={modernTdStyle}>{row.player}</td>
                      <td style={modernTdStyle}>{row.soloTackles}</td>
                      <td style={modernTdStyle}>{row.assistedTackles}</td>
                      <td style={modernTdStyle}>{row.tacklesForLoss ?? 0}</td>
                      <td style={modernTdStyle}>
                        {row.assistedTacklesForLoss ?? 0}
                      </td>
                      <td style={modernTdStyle}>{row.sacks ?? 0}</td>
                      <td style={modernTdStyle}>{row.assistedSacks ?? 0}</td>
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
          </section>
        </div>
      )}

      {activeSection === "setup" && (
        <section style={setupGridStyle}>
          <div style={panelStyle}>
            <div style={smallRedStyle}>ROSTER</div>
            <h2 style={panelTitleStyle}>
              {selectedSeason?.name ?? "Season"} Players
            </h2>

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

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid rgba(148,163,184,.18)",
              }}
            >
              <div style={smallRedStyle}>ROSTER IMPORT</div>
              <h3
                style={{
                  margin: "3px 0 6px",
                  color: "#f8fafc",
                  fontSize: 16,
                }}
              >
                Upload Hudl / Excel Roster
              </h3>
              <p
                style={{
                  margin: "0 0 10px",
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                Upload an Excel roster (.xlsx or .xls). CoachBoard identifies
                jersey numbers, player names, positions, and class/year data,
                then keeps only players who belong on the selected season
                roster. Past players are filtered out automatically.
              </p>

              <label
                style={{
                  ...primaryButtonStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: rosterImportLoading ? "wait" : "pointer",
                }}
              >
                {rosterImportLoading
                  ? "Reading Roster..."
                  : "Choose Excel Roster"}
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleRosterFileUpload}
                  disabled={rosterImportLoading || !selectedSeasonId}
                  style={{ display: "none" }}
                />
              </label>

              {rosterImportRows.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,.18)",
                    background: "rgba(15,23,42,.55)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#f8fafc",
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        {rosterImportFileName}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {rosterImportRows.length} current players detected
                        {rosterImportExcludedCount > 0
                          ? ` • ${rosterImportExcludedCount} past player${
                              rosterImportExcludedCount === 1 ? "" : "s"
                            } filtered out`
                          : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        style={smallActionButtonStyle}
                        onClick={cancelRosterImport}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        style={primaryButtonStyleNoMargin}
                        onClick={importRosterRows}
                      >
                        Import Roster
                      </button>
                    </div>
                  </div>

                  <div style={tableWrapStyle}>
                    <table style={{ ...modernTableStyle, minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th style={modernThStyle}>#</th>
                          <th style={modernThStyle}>First</th>
                          <th style={modernThStyle}>Last</th>
                          <th style={modernThStyle}>Position</th>
                          <th style={modernThStyle}>Class / Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterImportRows.slice(0, 10).map((row, index) => (
                          <tr
                            key={`${row.jersey}-${row.firstName}-${row.lastName}-${index}`}
                          >
                            <td style={modernTdStyle}>{row.jersey || "—"}</td>
                            <td style={modernTdStyle}>{row.firstName || "—"}</td>
                            <td style={modernTdStyle}>{row.lastName || "—"}</td>
                            <td style={modernTdStyle}>{row.position || "—"}</td>
                            <td style={modernTdStyle}>
                              {row.rosterYear ||
                                (row.graduationYear
                                  ? String(row.graduationYear)
                                  : "No year supplied")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rosterImportRows.length > 10 && (
                    <div
                      style={{
                        marginTop: 7,
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Previewing first 10 of {rosterImportRows.length} players.
                    </div>
                  )}
                </div>
              )}
            </div>

            <List>
              {seasonPlayers.map((player) => {
                const isEditing = editingRosterPlayerId === player.id;

                return (
                  <Row key={player.id}>
                    {isEditing ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(110px, 1fr) minmax(110px, 1fr) 90px minmax(100px, .8fr)",
                          gap: 8,
                          width: "100%",
                          alignItems: "center",
                        }}
                      >
                        <input
                          style={inputStyle}
                          value={editingRosterPlayer.firstName}
                          onChange={(event) =>
                            setEditingRosterPlayer((current) => ({
                              ...current,
                              firstName: event.target.value,
                            }))
                          }
                          aria-label="Player first name"
                        />
                        <input
                          style={inputStyle}
                          value={editingRosterPlayer.lastName}
                          onChange={(event) =>
                            setEditingRosterPlayer((current) => ({
                              ...current,
                              lastName: event.target.value,
                            }))
                          }
                          aria-label="Player last name"
                        />
                        <input
                          style={inputStyle}
                          value={editingRosterPlayer.jersey}
                          onChange={(event) =>
                            setEditingRosterPlayer((current) => ({
                              ...current,
                              jersey: event.target.value,
                            }))
                          }
                          aria-label="Player jersey number"
                        />
                        <input
                          style={inputStyle}
                          value={editingRosterPlayer.position}
                          onChange={(event) =>
                            setEditingRosterPlayer((current) => ({
                              ...current,
                              position: event.target.value,
                            }))
                          }
                          aria-label="Player position"
                        />
                      </div>
                    ) : (
                      <span
                        style={{
                          flex: "1 1 auto",
                          minWidth: 0,
                          paddingRight: 12,
                          lineHeight: 1.35,
                        }}
                      >
                        {playerLabel(player)}
                      </span>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 100px",
                        gap: 8,
                        alignItems: "center",
                        flex: "0 0 180px",
                        marginLeft: "auto",
                      }}
                    >
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            style={{
                              ...primaryButtonStyleNoMargin,
                              width: "72px",
                              minWidth: "72px",
                            }}
                            onClick={saveRosterPlayerEdit}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={{
                              ...smallActionButtonStyle,
                              width: "100px",
                              minWidth: "100px",
                            }}
                            onClick={cancelEditRosterPlayer}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          style={{
                            ...smallActionButtonStyle,
                            width: "72px",
                            minWidth: "72px",
                          }}
                          onClick={() => beginEditRosterPlayer(player)}
                        >
                          Edit
                        </button>
                      )}

                      <button
                        type="button"
                        style={{
                          ...dangerButtonStyle,
                          width: "100px",
                          minWidth: "100px",
                        }}
                        onClick={() => deletePlayer(player.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </Row>
                );
              })}
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
            <h2 style={panelTitleStyle}>Motions</h2>

            <div style={inlineFormStyle}>
              <input
                style={inputStyle}
                placeholder="Motion"
                value={motionSetup}
                onChange={(event) => setMotionSetup(event.target.value)}
              />
              <button style={primaryButtonStyleNoMargin} onClick={addSetupMotion}>
                Add
              </button>
            </div>

            <List>
              {motions.map((motion) => (
                <Row key={motion.id}>
                  <span>{motion.name}</span>
                  <button
                    style={dangerButtonStyle}
                    onClick={() => deleteMotion(motion.id)}
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
            <div style={smallRedStyle}>OFFENSE</div>
            <h2 style={panelTitleStyle}>Tags</h2>

            <div style={inlineFormStyle}>
              <input
                style={inputStyle}
                placeholder="Tag"
                value={tagSetup}
                onChange={(event) => setTagSetup(event.target.value)}
              />
              <button style={primaryButtonStyleNoMargin} onClick={addSetupTag}>
                Add
              </button>
            </div>

            <List>
              {tags.map((tag) => (
                <Row key={tag.id}>
                  <span>{tag.name}</span>
                  <button
                    style={dangerButtonStyle}
                    onClick={() => deleteTag(tag.id)}
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
                {reportScope === "game"
                  ? "Current Game Analytics"
                  : reportScope === "season"
                    ? `${selectedSeason?.name ?? "Season"} Analytics`
                    : "All-Time Program Analytics"}
              </h2>
              {reportSection === "offense" && (
                <div style={reportDefinitionStyle}>
                  <strong>Big / Explosive Play:</strong> Run of 10+ yards or pass of 25+ yards.
                  CoachBoard uses “Big” and “Explosive” for the same play classification.
                </div>
              )}
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
                  Selected Season
                </button>

                <button
                  style={{
                    ...scopeButtonStyle,
                    ...(reportScope === "allTime" ? scopeButtonActiveStyle : {}),
                  }}
                  onClick={() => setReportScope("allTime")}
                >
                  All-Time
                </button>
              </div>

              <div style={printMenuWrapStyle}>
                <button
                  style={printButtonStyle}
                  onClick={() => setShowPrintOptions((current) => !current)}
                >
                  Print Report
                </button>

                {showPrintOptions && (
                  <div style={printOptionsPanelStyle}>
                    <div style={printOptionsHeaderStyle}>
                      <div>
                        <strong>Choose What to Print</strong>
                        <small>Only checked report sections will print.</small>
                      </div>
                      <button
                        type="button"
                        style={printOptionsCloseStyle}
                        onClick={() => setShowPrintOptions(false)}
                      >
                        ×
                      </button>
                    </div>

                    <div style={printQuickActionsStyle}>
                      <button
                        type="button"
                        style={printQuickButtonStyle}
                        onClick={() => setVisiblePrintSelections(true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        style={printQuickButtonStyle}
                        onClick={() => setVisiblePrintSelections(false)}
                      >
                        Clear All
                      </button>
                    </div>

                    <div style={printOptionListStyle}>
                      {visiblePrintOptions.map(([key, label]) => (
                        <label key={key} style={printOptionRowStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(printSelections[key])}
                            onChange={() => togglePrintSelection(key)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      style={{ ...printButtonStyle, width: "100%" }}
                      onClick={() => {
                        setShowPrintOptions(false);
                        window.setTimeout(() => window.print(), 50);
                      }}
                    >
                      Print Selected
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="no-print" style={reportCategoryBarStyle}>
            <button
              style={{
                ...reportCategoryButtonStyle,
                ...(reportSection === "offense"
                  ? reportCategoryButtonActiveStyle
                  : {}),
              }}
              onClick={() => setReportSection("offense")}
            >
              Offense
            </button>

            <button
              style={{
                ...reportCategoryButtonStyle,
                ...(reportSection === "defense"
                  ? reportCategoryButtonActiveStyle
                  : {}),
              }}
              onClick={() => setReportSection("defense")}
            >
              Defense
            </button>

            <button
              style={{
                ...reportCategoryButtonStyle,
                ...(reportSection === "specialTeams"
                  ? reportCategoryButtonActiveStyle
                  : {}),
              }}
              onClick={() => setReportSection("specialTeams")}
            >
              Special Teams
            </button>
          </div>

          <div style={printHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>COACHBOARD ANALYTICS</div>
              <h1 style={{ ...titleStyle, fontSize: 30 }}>
                {reportScope === "game"
                  ? `Week ${selectedGame?.week ?? "-"} vs ${selectedGame?.opponent ?? "Opponent"} — ${
                      reportSection === "offense"
                        ? "Offense"
                        : reportSection === "defense"
                          ? "Defense"
                          : "Special Teams"
                    }`
                  : reportScope === "season"
                    ? `${selectedSeason?.name ?? "Season"} ${
                        reportSection === "offense"
                          ? "Offensive"
                          : reportSection === "defense"
                            ? "Defensive"
                            : "Special Teams"
                      } Analytics Report`
                    : `All-Time ${
                        reportSection === "offense"
                          ? "Offensive"
                          : reportSection === "defense"
                            ? "Defensive"
                            : "Special Teams"
                      } Analytics Report`}
              </h1>
              {reportSection === "offense" && (
                <div style={printDefinitionStyle}>
                  <strong>Big / Explosive Play:</strong> Run of 10+ yards or pass of 25+ yards.
                  “Big” and “Explosive” mean the same thing in CoachBoard.
                  <br />
                  <strong>3rd / 4th Down Conversion:</strong> A conversion is credited when the offense
                  earns a first down or scores a touchdown on that down.
                </div>
              )}
            </div>

            <div style={printDateStyle}>
              {new Date().toLocaleDateString()}
            </div>
          </div>

          {reportSection === "offense" && (
            <>
              <section
                className={
                  printSelections.summary
                    ? "print-report-page print-summary-metrics"
                    : "print-excluded"
                }
                style={reportMetricGridStyle}
              >
                <Metric label="Total Yards" value={reportStats.yards} />
                <Metric label="Rush Yards" value={reportStats.rushYards} />
                <Metric label="Pass Yards" value={reportStats.passYards} />
                <Metric label="Plays" value={reportStats.total} />
                <Metric label="TDs" value={reportStats.tds} />
                <Metric label="Punts" value={reportStats.punts} />
                <Metric
                  label="2PT"
                  value={`${reportStats.twoPointMade}/${reportStats.twoPointAttempts}`}
                />
                <Metric label="Turnovers" value={reportStats.turnovers} danger={reportStats.turnovers > 0} />
                <Metric label="Interceptions" value={reportStats.interceptions} danger={reportStats.interceptions > 0} />
                <Metric label="Fumbles" value={reportStats.fumbles} danger={reportStats.fumbles > 0} />
                <Metric label="Penalties" value={reportStats.penalties} danger={reportStats.penalties > 0} />
                <Metric label="1st Downs" value={reportStats.firstDownsEarned} />
                <Metric
                  label="3rd Down Conversion"
                  value={`${reportStats.thirdDownConversions}/${reportStats.thirdDownAttempts} • ${reportStats.thirdDownConversionRate}%`}
                />
                <Metric
                  label="4th Down Conversion"
                  value={`${reportStats.fourthDownConversions}/${reportStats.fourthDownAttempts} • ${reportStats.fourthDownConversionRate}%`}
                />
                <Metric label="Series Starts" value={reportStats.seriesStarts} />
                <Metric label="Success" value={`${reportStats.successRate}%`} />
                <Metric label="Explosive" value={`${reportStats.explosiveRate}%`} />
                <Metric label="Average" value={reportStats.averageYards} />
                <Metric
                  label="Time of Possession"
                  value={formatDuration(reportPossessionStats.totalSeconds)}
                />
                <Metric label="Possessions" value={reportPossessionStats.count} />
                <Metric
                  label="Avg Possession"
                  value={formatDuration(reportPossessionStats.averageSeconds)}
                />
                <Metric
                  label="Longest Drive"
                  value={formatDuration(reportPossessionStats.longestSeconds)}
                />
              </section>

              <section className="print-reports-grid" style={reportsGridStyle}>
                <PrintableExpandableReport
                  title="Decision Engine / Play Success"
                  printSelected={printSelections.decisionEngine}
                  fullWidth
                >
                  <FormationPlaySuccessReport rows={formationPlayReport} />
                </PrintableExpandableReport>

                <PrintableExpandableReport
                  title="Player Analytics"
                  printSelected={printSelections.playerAnalytics}
                  fullWidth
                >
                  <PlayerAnalyticsReport
                    rushing={rushingReport}
                    passing={passingReport}
                    receiving={receivingReport}
                    scopeLabel={reportScopeLabel}
                  />
                </PrintableExpandableReport>

                <PrintableExpandableReport
                  title="Penalty Analytics"
                  printSelected={printSelections.penalties}
                >
                  <PenaltyAnalyticsReport rows={penaltyReport} />
                </PrintableExpandableReport>

                <PrintableExpandableReport
                  title="Possession Analytics"
                  printSelected={printSelections.possessions}
                >
                  <PossessionAnalyticsReport
                    possessions={reportPossessions}
                    games={games}
                    scopeLabel={reportScopeLabel}
                  />
                </PrintableExpandableReport>

                <PrintableExpandableReport title="Play Rankings" printSelected={printSelections.playRankings}>
                  <Report title="Play Rankings" rows={playReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Formation Rankings" printSelected={printSelections.formationRankings}>
                  <Report title="Formation Rankings" rows={formationReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Motion Rankings" printSelected={printSelections.motionRankings}>
                  <Report title="Motion Rankings" rows={motionReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Tag Rankings" printSelected={printSelections.tagRankings}>
                  <Report title="Tag Rankings" rows={tagReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Formation + Motion Rankings" printSelected={printSelections.formationMotion}>
                  <Report title="Formation + Motion Rankings" rows={formationMotionReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Formation + Play Rankings" printSelected={printSelections.formationPlay}>
                  <Report title="Formation + Play Rankings" rows={formationPlayReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Play + Tag Rankings" printSelected={printSelections.playTag}>
                  <Report title="Play + Tag Rankings" rows={playTagReport} />
                </PrintableExpandableReport>
                <PrintableExpandableReport title="Formation + Play + Tag Rankings" printSelected={printSelections.formationPlayTag}>
                  <Report title="Formation + Play + Tag Rankings" rows={formationPlayTagReport} />
                </PrintableExpandableReport>

                {reportScope === "season" && (
                  <PrintableExpandableReport
                    title="Game-by-Game Breakdown"
                    printSelected={printSelections.gameBreakdown}
                    fullWidth
                  >
                    <GameBreakdownReport rows={gameBreakdown} />
                  </PrintableExpandableReport>
                )}

                {reportScope === "allTime" && (
                  <PrintableExpandableReport
                    title="Year-over-Year Comparison"
                    printSelected={printSelections.yearOverYear}
                    fullWidth
                  >
                    <YearOverYearReport rows={yearOverYear} />
                  </PrintableExpandableReport>
                )}
              </section>
            </>
          )}

          {reportSection === "defense" && (
            <section className="print-reports-grid" style={reportsGridStyle}>
              <PrintableExpandableReport
                title="Defense Report"
                printSelected={printSelections.defense}
                fullWidth
              >
                <DefenseReport
                  events={reportDefense}
                  calls={reportDefensiveCalls}
                  frontReport={defensiveFrontReport}
                  pressureReport={defensivePressureReport}
                  coverageReport={defensiveCoverageReport}
                  combinationReport={defensiveCallCombinationReport}
                  opponentPossessionSeconds={
                    reportOpponentPossessionStats.totalSeconds
                  }
                />
              </PrintableExpandableReport>
            </section>
          )}

          {reportSection === "specialTeams" && (
            <section className="print-reports-grid" style={reportsGridStyle}>
              <PrintableExpandableReport
                title="Special Teams Report"
                printSelected={printSelections.specialTeams}
                fullWidth
              >
                <SpecialTeamsReport events={reportSpecialTeams} />
              </PrintableExpandableReport>
            </section>
          )}

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

              .print-excluded {
                display: none !important;
              }

              .print-reports-grid {
                display: block !important;
                width: 100% !important;
              }

              .print-report-page {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                break-after: page;
                page-break-after: always;
                break-inside: avoid;
                page-break-inside: avoid;
              }

              .print-summary-metrics {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 10px !important;
                overflow: visible !important;
                width: 100% !important;
                margin-bottom: 0 !important;
              }

              .print-summary-metrics > * {
                min-width: 0 !important;
                width: auto !important;
              }

              .print-report-page table {
                width: 100% !important;
              }

              .print-report-page > div,
              .print-report-page section {
                max-width: 100% !important;
                overflow: visible !important;
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

function calculateOpponentPossessionStats(
  events: DefensiveCallEvent[],
  quarterLengthMinutes: number,
) {
  const sorted = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  let openStart: DefensiveCallEvent | null = null;
  let totalSeconds = 0;
  let completedPossessions = 0;

  sorted.forEach((event) => {
    if (!event.clock) return;

    if (event.opponentPossessionStart) {
      openStart = event;
    }

    if (!openStart) {
      openStart = event;
    }

    if (event.opponentPossessionEnd && openStart) {
      const startQuarter = Number(openStart.quarter);
      const endQuarter = Number(event.quarter);

      if (
        Number.isFinite(startQuarter) &&
        Number.isFinite(endQuarter) &&
        startQuarter >= 1 &&
        endQuarter >= startQuarter
      ) {
        const duration = calculatePossessionDuration(
          startQuarter,
          openStart.clock,
          endQuarter,
          event.clock,
          quarterLengthMinutes,
        );

        if (duration !== null && duration >= 0) {
          totalSeconds += duration;
          completedPossessions += 1;
        }
      }

      openStart = null;
    }
  });

  return {
    totalSeconds,
    completedPossessions,
    hasOpenPossession: Boolean(openStart),
  };
}

function calculateDefensiveCallStats(events: DefensiveCallEvent[]) {
  const snaps = events.length;
  const yardsAllowed = events.reduce(
    (sum, event) => sum + event.yardsAllowed,
    0,
  );

  const stops = events.filter((event) => {
    const result = event.result.toUpperCase();

    if (
      result.includes("TFL") ||
      result.includes("SACK") ||
      result.includes("INT") ||
      result.includes("FUM") ||
      result.includes("TURNOVER") ||
      result.includes("4TH DOWN")
    ) {
      return true;
    }

    return event.yardsAllowed < event.distance;
  }).length;

  const explosiveAllowed = events.filter(
    (event) => event.yardsAllowed >= 20,
  ).length;

  return {
    snaps,
    yardsAllowed,
    averageAllowed: snaps ? (yardsAllowed / snaps).toFixed(1) : "0.0",
    stopRate: snaps ? Math.round((stops / snaps) * 100) : 0,
    explosiveAllowedRate: snaps
      ? Math.round((explosiveAllowed / snaps) * 100)
      : 0,
  };
}

function makeDefensiveCallReport(
  events: DefensiveCallEvent[],
  selector: (event: DefensiveCallEvent) => string,
): DefensiveCallReportRow[] {
  const groups = new Map<string, DefensiveCallEvent[]>();

  events.forEach((event) => {
    const label = selector(event).trim();
    if (!label) return;

    const rows = groups.get(label) ?? [];
    rows.push(event);
    groups.set(label, rows);
  });

  return Array.from(groups.entries())
    .map(([label, rows]) => {
      const stats = calculateDefensiveCallStats(rows);

      return {
        id: label,
        label,
        calls: stats.snaps,
        yardsAllowed: stats.yardsAllowed,
        averageAllowed: Number(stats.averageAllowed),
        stopRate: stats.stopRate,
        explosiveAllowedRate: stats.explosiveAllowedRate,
      };
    })
    .sort(
      (a, b) =>
        b.stopRate - a.stopRate ||
        a.averageAllowed - b.averageAllowed ||
        b.calls - a.calls,
    );
}

function nextDefensiveDownDistance(
  current: string,
  yardsAllowed: number,
  result: string,
  options?: {
    goalToGo?: boolean;
    penalty?: boolean;
    penaltyYards?: number;
    automaticFirstDown?: boolean;
    lossOfDown?: boolean;
    repeatDown?: boolean;
    opponentPunt?: boolean;
  },
) {
  const parsed = parseDownDistance(current);
  const normalizedResult = result.toUpperCase();
  const goalToGo = options?.goalToGo === true;
  const penalty = options?.penalty === true;
  const penaltyYards = Number(options?.penaltyYards ?? 0);
  const automaticFirstDown = options?.automaticFirstDown === true;
  const lossOfDown = options?.lossOfDown === true;
  const repeatDown = options?.repeatDown === true;
  const opponentPunt = options?.opponentPunt === true;

  if (
    opponentPunt ||
    normalizedResult.includes("PUNT") ||
    normalizedResult.includes("TURNOVER") ||
    normalizedResult.includes("INT") ||
    normalizedResult.includes("FUM REC") ||
    normalizedResult.includes("FUMBLE REC") ||
    normalizedResult.includes("4TH DOWN")
  ) {
    return "1 and 10";
  }

  if (penalty) {
    if (automaticFirstDown) {
      return goalToGo ? "1 and Goal" : "1 and 10";
    }

    if (repeatDown) {
      const adjustedDistance = Math.max(
        1,
        parsed.distance - penaltyYards,
      );
      return `${parsed.down} and ${goalToGo ? "Goal" : adjustedDistance}`;
    }

    const adjustedDown = lossOfDown
      ? Math.min(4, parsed.down + 1)
      : parsed.down;

    const adjustedDistance = Math.max(
      1,
      parsed.distance - penaltyYards,
    );

    return `${adjustedDown} and ${goalToGo ? "Goal" : adjustedDistance}`;
  }

  if (goalToGo) {
    const nextDown = Math.min(4, parsed.down + 1);

    if (normalizedResult.includes("TD")) {
      return "1 and 10";
    }

    return `${nextDown} and Goal`;
  }

  if (yardsAllowed >= parsed.distance) {
    return "1 and 10";
  }

  const nextDown = Math.min(4, parsed.down + 1);
  const nextDistance = Math.max(1, parsed.distance - yardsAllowed);

  return `${nextDown} and ${nextDistance}`;
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
      tacklesForLoss:
        (current.tacklesForLoss ?? 0) + (event.tacklesForLoss ?? 0),
      assistedTacklesForLoss:
        (current.assistedTacklesForLoss ?? 0) +
        (event.assistedTacklesForLoss ?? 0),
      sacks: (current.sacks ?? 0) + (event.sacks ?? 0),
      assistedSacks:
        (current.assistedSacks ?? 0) + (event.assistedSacks ?? 0),
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
    tacklesForLoss: players.reduce(
      (sum, row) => sum + (row.tacklesForLoss ?? 0),
      0,
    ),
    assistedTacklesForLoss: players.reduce(
      (sum, row) => sum + (row.assistedTacklesForLoss ?? 0),
      0,
    ),
    sacks: players.reduce((sum, row) => sum + (row.sacks ?? 0), 0),
    assistedSacks: players.reduce(
      (sum, row) => sum + (row.assistedSacks ?? 0),
      0,
    ),
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
  const twoPointAttempts = rows.filter((play) =>
    play.result.toUpperCase().includes("2PT"),
  );
  const twoPointMade = twoPointAttempts.filter((play) =>
    play.result.toUpperCase().includes("2PT GOOD"),
  );

  const statisticalRows = rows.filter(
    (play) =>
      !play.penalty &&
      play.playType !== "Punt" &&
      !play.result.toUpperCase().includes("2PT"),
  );
  const total = statisticalRows.length;
  const yards = statisticalRows.reduce((sum, play) => sum + play.yards, 0);
  const rushRows = statisticalRows.filter((play) => play.playType === "Run");
  const passRows = statisticalRows.filter((play) => play.playType !== "Run");
  const successCount = statisticalRows.filter(isSuccess).length;
  const explosiveCount = statisticalRows.filter(
    (play) => classify(play) === "explosive",
  ).length;

  // Third- and fourth-down conversions are calculated directly from the
  // charted down plus the final outcome of the play. A touchdown counts as a
  // successful conversion even though CoachBoard intentionally does not also
  // credit that play as an earned first down.
  const thirdDownAttempts = statisticalRows.filter(
    (play) => play.down === 3,
  );
  const thirdDownConversions = thirdDownAttempts.filter(
    (play) => play.firstDown || play.touchdown,
  );

  const fourthDownAttempts = statisticalRows.filter(
    (play) => play.down === 4,
  );
  const fourthDownConversions = fourthDownAttempts.filter(
    (play) => play.firstDown || play.touchdown,
  );

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
    punts: rows.filter(
      (play) =>
        play.playType === "Punt" ||
        play.result.toUpperCase().includes("PUNT"),
    ).length,
    twoPointAttempts: twoPointAttempts.length,
    twoPointMade: twoPointMade.length,
    penalties: rows.filter((play) => play.penalty).length,
    firstDownsEarned: statisticalRows.filter((play) => play.firstDown).length,
    seriesStarts: rows.filter((play) => play.seriesStart).length,

    thirdDownAttempts: thirdDownAttempts.length,
    thirdDownConversions: thirdDownConversions.length,
    thirdDownConversionRate: thirdDownAttempts.length
      ? Math.round(
          (thirdDownConversions.length / thirdDownAttempts.length) * 100,
        )
      : 0,

    fourthDownAttempts: fourthDownAttempts.length,
    fourthDownConversions: fourthDownConversions.length,
    fourthDownConversionRate: fourthDownAttempts.length
      ? Math.round(
          (fourthDownConversions.length / fourthDownAttempts.length) * 100,
        )
      : 0,

    successRate: total ? Math.round((successCount / total) * 100) : 0,
    explosiveRate: total ? Math.round((explosiveCount / total) * 100) : 0,
    averageYards: total ? (yards / total).toFixed(1) : "0.0",
  };
}

function makeReport(rows: ChartPlay[], keyGetter: (play: ChartPlay) => string): ReportRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows
    .filter(
      (play) =>
        !play.penalty &&
        play.playType !== "Punt" &&
        !play.result.toUpperCase().includes("2PT"),
    )
    .forEach((play) => {
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

function makeMultiReport(
  rows: ChartPlay[],
  keyGetter: (play: ChartPlay) => string[],
): ReportRow[] {
  const groups = new Map<string, ChartPlay[]>();

  rows
    .filter(
      (play) =>
        !play.penalty &&
        play.playType !== "Punt" &&
        !play.result.toUpperCase().includes("2PT"),
    )
    .forEach((play) => {
      const keys = keyGetter(play)
        .map((key) => key.trim())
        .filter(Boolean);

      const uniqueKeys = [...new Set(keys)];

      uniqueKeys.forEach((key) => {
        groups.set(key, [...(groups.get(key) ?? []), play]);
      });
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
      completions: number;
      targets: number;
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
      completions: 0,
      targets: 0,
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
      const result = play.result.toUpperCase();
      const completed =
        Boolean(play.receiver.trim()) &&
        !result.includes("INC") &&
        !result.includes("INT");

      if (player) {
        player.passAttempts += 1;

        if (completed) {
          player.completions += 1;
          if (!result.includes("2PT")) {
            player.passingYards += play.yards;
          }
        }

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

      if (player) {
        player.targets += 1;

        if (completed) {
          player.receptions += 1;

          if (!result.includes("2PT")) {
            player.receivingYards += play.yards;
            player.totalYards += play.yards;
          }

          if (play.touchdown) {
            player.tds += 1;
          }
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
      const yards = plays
        .filter((play) => !play.result.toUpperCase().includes("2PT"))
        .reduce((sum, play) => sum + play.yards, 0);

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
        return (
          Boolean(play.receiver.trim()) &&
          !result.includes("INC") &&
          !result.includes("INCOMPLETE") &&
          !result.includes("INT")
        );
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
        return (
          !result.includes("INC") &&
          !result.includes("INCOMPLETE") &&
          !result.includes("INT")
        );
      }).length;
      const completedPlays = plays.filter((play) => {
        const result = play.result.toUpperCase();
        return (
          !result.includes("INC") &&
          !result.includes("INCOMPLETE") &&
          !result.includes("INT")
        );
      });
      const yards = completedPlays
        .filter((play) => !play.result.toUpperCase().includes("2PT"))
        .reduce((sum, play) => sum + play.yards, 0);
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
  return "OK";
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
    <div style={panelStyle}>
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

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Type</th>
              <th style={modernThStyle}>Player</th>
              <th style={modernThStyle}>Yards</th>
              <th style={modernThStyle}>Result</th>
              <th style={modernThStyle}>Quarter</th>
              <th style={modernThStyle}>Clock</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={6}>
                  No special teams data recorded.
                </td>
              </tr>
            )}

            {events.map((event) => (
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
                          : event.notes || "—"}
                </td>
                <td style={modernTdStyle}>{event.quarter}</td>
                <td style={modernTdStyle}>{event.clock || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefensiveCallReportTable({
  title,
  rows,
}: {
  title: string;
  rows: DefensiveCallReportRow[];
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={smallRedStyle}>{title.toUpperCase()}</div>
      <div style={tableWrapStyle}>
        <table style={{ ...modernTableStyle, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={modernThStyle}>Call</th>
              <th style={modernThStyle}>Snaps</th>
              <th style={modernThStyle}>Yards Allowed</th>
              <th style={modernThStyle}>Avg Allowed</th>
              <th style={modernThStyle}>Stop Rate</th>
              <th style={modernThStyle}>Explosive Allowed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={6}>
                  No {title.toLowerCase()} data charted.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={modernTdStyle}>{row.label}</td>
                <td style={modernTdStyle}>{row.calls}</td>
                <td style={modernTdStyle}>{row.yardsAllowed}</td>
                <td style={modernTdStyle}>{row.averageAllowed.toFixed(1)}</td>
                <td style={modernTdStyle}>{row.stopRate}%</td>
                <td style={modernTdStyle}>{row.explosiveAllowedRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefenseReport({
  events,
  calls,
  frontReport,
  pressureReport,
  coverageReport,
  combinationReport,
  opponentPossessionSeconds,
}: {
  events: DefensiveEvent[];
  calls: DefensiveCallEvent[];
  frontReport: DefensiveCallReportRow[];
  pressureReport: DefensiveCallReportRow[];
  coverageReport: DefensiveCallReportRow[];
  combinationReport: DefensiveCallReportRow[];
  opponentPossessionSeconds: number;
}) {
  const stats = calculateDefenseStats(events);
  const callStats = calculateDefensiveCallStats(calls);
  const players = aggregateDefense(events);

  return (
    <div style={panelStyle}>
      <div style={smallRedStyle}>DEFENSE</div>
      <h2 style={panelTitleStyle}>Defensive Analytics</h2>

      <div style={defenseMetricGridStyle}>
        <Metric label="Snaps Charted" value={callStats.snaps} />
        <Metric
          label="Opponent Punts"
          value={calls.filter((event) => event.opponentPunt).length}
        />
        <Metric
          label="Opponent Series Starts"
          value={calls.filter((event) => event.seriesStart).length}
        />
        <Metric
          label="Opponent TOP"
          value={formatDuration(opponentPossessionSeconds)}
        />
        <Metric label="Yards Allowed" value={callStats.yardsAllowed} />
        <Metric label="Avg Allowed" value={callStats.averageAllowed} />
        <Metric label="Stop Rate" value={`${callStats.stopRate}%`} />
        <Metric
          label="Explosive Allowed"
          value={`${callStats.explosiveAllowedRate}%`}
        />
        <Metric label="Tackles" value={stats.totalTackles} />
        <Metric label="Solo TFL" value={stats.tacklesForLoss} />
        <Metric
          label="TFL Assists"
          value={stats.assistedTacklesForLoss}
        />
        <Metric label="Solo Sacks" value={stats.sacks} />
        <Metric
          label="Sack Assists"
          value={stats.assistedSacks}
        />
        <Metric label="INT" value={stats.interceptions} />
        <Metric label="PBU" value={stats.passBreakups} />
        <Metric label="FF" value={stats.forcedFumbles} />
        <Metric label="FR" value={stats.fumbleRecoveries} />
        <Metric label="Def TD" value={stats.defensiveTouchdowns} />
      </div>

      <DefensiveCallReportTable title="Front Performance" rows={frontReport} />
      <DefensiveCallReportTable
        title="Stunt / Blitz Performance"
        rows={pressureReport}
      />
      <DefensiveCallReportTable
        title="Coverage Performance"
        rows={coverageReport}
      />
      <DefensiveCallReportTable
        title="Front + Pressure + Coverage"
        rows={combinationReport}
      />

      <div style={{ marginTop: 18 }}>
        <div style={smallRedStyle}>PLAYER PRODUCTION</div>
        <div style={tableWrapStyle}>
          <table style={modernTableStyle}>
            <thead>
              <tr>
                <th style={modernThStyle}>Player</th>
                <th style={modernThStyle}>Total Tackles</th>
                <th style={modernThStyle}>Solo TFL</th>
                <th style={modernThStyle}>TFL Ast</th>
                <th style={modernThStyle}>Solo Sack</th>
                <th style={modernThStyle}>Sack Ast</th>
                <th style={modernThStyle}>INT</th>
                <th style={modernThStyle}>PBU</th>
                <th style={modernThStyle}>FF</th>
                <th style={modernThStyle}>FR</th>
                <th style={modernThStyle}>TD</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 && (
                <tr>
                  <td style={emptyTdStyle} colSpan={11}>
                    No player defensive stats recorded.
                  </td>
                </tr>
              )}
              {players.map((row) => (
                <tr key={row.player}>
                  <td style={modernTdStyle}>{row.player}</td>
                  <td style={modernTdStyle}>
                    {row.soloTackles + row.assistedTackles}
                  </td>
                  <td style={modernTdStyle}>{row.tacklesForLoss ?? 0}</td>
                  <td style={modernTdStyle}>
                    {row.assistedTacklesForLoss ?? 0}
                  </td>
                  <td style={modernTdStyle}>{row.sacks ?? 0}</td>
                  <td style={modernTdStyle}>{row.assistedSacks ?? 0}</td>
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
    <div style={panelStyle}>
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
    <div style={panelStyle}>
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
    <div style={panelStyle}>
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

function YearOverYearReport({
  rows,
}: {
  rows: Array<{
    season: Season;
    games: number;
    stats: ReturnType<typeof calculateStats>;
  }>;
}) {
  return (
    <div style={panelStyle}>
      <div style={smallRedStyle}>PROGRAM HISTORY</div>
      <h2 style={panelTitleStyle}>Year-over-Year Comparison</h2>

      <div style={tableWrapStyle}>
        <table style={modernTableStyle}>
          <thead>
            <tr>
              <th style={modernThStyle}>Season</th>
              <th style={modernThStyle}>Games</th>
              <th style={modernThStyle}>Plays</th>
              <th style={modernThStyle}>Yards</th>
              <th style={modernThStyle}>Yards/Game</th>
              <th style={modernThStyle}>Rush</th>
              <th style={modernThStyle}>Pass</th>
              <th style={modernThStyle}>TDs</th>
              <th style={modernThStyle}>Success</th>
              <th style={modernThStyle}>Explosive</th>
              <th style={modernThStyle}>3rd Down Conversion</th>
              <th style={modernThStyle}>4th Down Conversion</th>
              <th style={modernThStyle}>Turnovers</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={13}>
                  Season comparisons will appear after games are charted.
                </td>
              </tr>
            )}

            {rows.map(({ season, games, stats }) => (
              <tr key={season.id}>
                <td style={modernTdStyle}>
                  {season.name}{season.archived ? " (Archived)" : ""}
                </td>
                <td style={modernTdStyle}>{games}</td>
                <td style={modernTdStyle}>{stats.total}</td>
                <td style={modernTdStyle}>{stats.yards}</td>
                <td style={modernTdStyle}>
                  {games ? (stats.yards / games).toFixed(1) : "0.0"}
                </td>
                <td style={modernTdStyle}>{stats.rushYards}</td>
                <td style={modernTdStyle}>{stats.passYards}</td>
                <td style={modernTdStyle}>{stats.tds}</td>
                <td style={modernTdStyle}>{stats.successRate}%</td>
                <td style={modernTdStyle}>{stats.explosiveRate}%</td>
                <td style={modernTdStyle}>
                  {stats.thirdDownConversions}/{stats.thirdDownAttempts} •{" "}
                  {stats.thirdDownConversionRate}%
                </td>
                <td style={modernTdStyle}>
                  {stats.fourthDownConversions}/{stats.fourthDownAttempts} •{" "}
                  {stats.fourthDownConversionRate}%
                </td>
                <td style={modernTdStyle}>{stats.turnovers}</td>
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
    <div style={panelStyle}>
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
              <th style={modernThStyle}>3rd Down Conversion</th>
              <th style={modernThStyle}>4th Down Conversion</th>
              <th style={modernThStyle}>Series Starts</th>
              <th style={modernThStyle}>TDs</th>
              <th style={modernThStyle}>Punts</th>
              <th style={modernThStyle}>2PT</th>
              <th style={modernThStyle}>Turnovers</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={emptyTdStyle} colSpan={16}>
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
                <td style={modernTdStyle}>
                  {stats.thirdDownConversions}/{stats.thirdDownAttempts} •{" "}
                  {stats.thirdDownConversionRate}%
                </td>
                <td style={modernTdStyle}>
                  {stats.fourthDownConversions}/{stats.fourthDownAttempts} •{" "}
                  {stats.fourthDownConversionRate}%
                </td>
                <td style={modernTdStyle}>{stats.seriesStarts}</td>
                <td style={modernTdStyle}>{stats.tds}</td>
                <td style={modernTdStyle}>{stats.punts}</td>
                <td style={modernTdStyle}>
                  {stats.twoPointMade}/{stats.twoPointAttempts}
                </td>
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
    <div style={panelStyle}>
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
                    <strong>{row.successRate}%</strong>
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

function PrintableExpandableReport({
  title,
  printSelected,
  fullWidth = false,
  children,
}: {
  title: string;
  printSelected: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={printSelected ? "print-report-page" : "print-excluded"}
      style={{
        position: "relative",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        ...(fullWidth ? { gridColumn: "1 / -1" } : {}),
      }}
    >
      <button
        type="button"
        className="no-print"
        style={expandReportButtonStyle}
        onClick={() => setExpanded(true)}
      >
        Expand
      </button>

      {children}

      {expanded && (
        <div
          className="no-print"
          style={expandedReportBackdropStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpanded(false);
          }}
        >
          <div style={expandedReportModalStyle}>
            <div style={expandedReportHeaderStyle}>
              <div>
                <div style={smallRedStyle}>EXPANDED REPORT</div>
                <h2 style={{ ...panelTitleStyle, marginBottom: 0 }}>{title}</h2>
              </div>
              <button
                type="button"
                style={expandedReportCloseStyle}
                onClick={() => setExpanded(false)}
              >
                Close ×
              </button>
            </div>

            <div style={expandedReportBodyStyle}>{children}</div>
          </div>
        </div>
      )}
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
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 7,
  marginBottom: 10,
  width: "100%",
  overflow: "visible",
};

const metricStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: "9px 10px",
  boxShadow: "0 8px 22px rgba(15,23,42,.06)",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
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
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 10,
  marginBottom: 10,
};

const belowPlayInsightsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, .8fr) minmax(0, 1.7fr)",
  gap: 10,
  marginBottom: 10,
  alignItems: "start",
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
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
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
  gap: 6,
  padding: 8,
  borderRadius: 13,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const tagEntryFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
  color: "#475569",
};

const tagEntryLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".02em",
};

const tagPickerStyle: React.CSSProperties = {
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  background: "#ffffff",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 5,
  boxSizing: "border-box",
};

const selectedTagsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};

const selectedTagPillStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "3px 7px",
  background: "#f1f5f9",
  color: "#0f172a",
  fontSize: 10,
  fontWeight: 900,
  cursor: "pointer",
};

const tagInputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const tagPickerInputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  minWidth: 0,
};


const tableTagWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 3,
};

const tableTagPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#0f172a",
  fontSize: 10,
  fontWeight: 850,
  whiteSpace: "nowrap",
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
  padding: "7px 8px",
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



const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 800,
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
  overflowY: "hidden",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
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

const editingRowStyle: React.CSSProperties = {
  background: "#eff6ff",
  outline: "2px solid #bfdbfe",
  outlineOffset: "-2px",
};

const inlineEditInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 90,
  height: 34,
  border: "1px solid #94a3b8",
  borderRadius: 8,
  background: "#ffffff",
  color: "#0f172a",
  padding: "5px 7px",
  fontSize: 12,
  fontWeight: 800,
  outline: "none",
  boxSizing: "border-box",
};

const inlineCheckboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const editGradeHintStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "4px 8px",
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 10,
  fontWeight: 900,
};

const miniSaveEditButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 950,
  cursor: "pointer",
};

const miniCancelEditButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#475569",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  cursor: "pointer",
};

const playActionButtonsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const miniEditButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 8,
  padding: "6px 9px",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  cursor: "pointer",
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
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};

const playerStatTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 950,
};

const reportCategoryBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  width: "fit-content",
  marginBottom: 12,
  padding: 4,
  borderRadius: 12,
  background: "#e2e8f0",
  border: "1px solid #cbd5e1",
};

const reportCategoryButtonStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 9,
  padding: "9px 14px",
  background: "transparent",
  color: "#475569",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
};

const reportCategoryButtonActiveStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#dc2626",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(15,23,42,.08)",
};

const printMenuWrapStyle: React.CSSProperties = {
  position: "relative",
};

const printOptionsPanelStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  zIndex: 120,
  width: 340,
  maxWidth: "88vw",
  padding: 14,
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  boxShadow: "0 18px 45px rgba(15, 23, 42, .20)",
};

const printOptionsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const printOptionsCloseStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
  color: "#64748b",
};

const printQuickActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  marginBottom: 10,
};

const printQuickButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "6px 9px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
};

const printOptionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  maxHeight: 340,
  overflowY: "auto",
  marginBottom: 12,
  paddingRight: 4,
};

const printOptionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "7px 4px",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
};

const expandReportButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: 12,
  zIndex: 5,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "6px 9px",
  background: "#ffffff",
  color: "#334155",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 3px 8px rgba(15,23,42,.06)",
};

const expandedReportBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  background: "rgba(15, 23, 42, .58)",
};

const expandedReportModalStyle: React.CSSProperties = {
  width: "min(1500px, 97vw)",
  maxHeight: "94vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  boxShadow: "0 30px 80px rgba(15, 23, 42, .35)",
  overflow: "hidden",
};

const expandedReportHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #e2e8f0",
};

const expandedReportCloseStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "8px 10px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const expandedReportBodyStyle: React.CSSProperties = {
  overflow: "auto",
  padding: 12,
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

const reportDefinitionStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
};

const printDefinitionStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 500px), 1fr))",
  gap: 12,
  alignItems: "start",
  minWidth: 0,
  width: "100%",
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
