"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

type Side = "offense" | "defense";
type RouteType =
  | "Go"
  | "Slant"
  | "Out"
  | "In"
  | "Post"
  | "Corner"
  | "Curl"
  | "Comeback";
type DefensePreset =
  | "4-3 Over"
  | "4-3 Under"
  | "3-4 Base"
  | "4-2-5"
  | "3-3 Stack"
  | "Goal Line"
  | "Bear"
  | "3-5"
  | "Nickel"
  | "Dime";
type DrawLineStyle = "solid" | "dotted" | "block";
type DrawLineMode = "curve" | "straight";
type Technique =
  | "0"
  | "1"
  | "2i"
  | "2"
  | "3"
  | "4i"
  | "4"
  | "5"
  | "6i"
  | "6"
  | "7"
  | "9";
type PanelTab = "player" | "routes" | "formations" | "defense" | "plays";

type FieldPoint = { x: number; y: number };

type Player = {
  id: string;
  position: string;
  side: Side;
  x: number;
  yardsFromGoal: number;
  onLOS?: boolean;
  color?: string;
};

type RouteModel = {
  playerId: string;
  routeType: RouteType;
  breakDepth: number;
  finishDepth: number;
  color?: string;
};

type DrawLine = {
  id: string;
  style: DrawLineStyle;
  mode?: DrawLineMode;
  points: FieldPoint[];
  // When a drawing starts on/near a player, it stays tied to that player's color.
  playerId?: string;
  color?: string;
};

type CustomOffensePreset = {
  id: string;
  name: string;
  players: Player[];
  isMain?: boolean;
  isSystem?: boolean;
};

type SavedPlay = {
  id: string;
  name: string;
  formationId?: string;
  offensePlayers: Player[];
  defensePlayers: Player[];
  routes: RouteModel[];
  drawnLines: DrawLine[];
  preloadOnOpen?: boolean;
};

type Playbook = {
  id: string;
  name: string;
  formationIds: string[];
  formationConcepts?: Record<string, string[]>;
};

type ConceptAssignment = {
  playerLabel: string;
  type: "route" | "run" | "block" | "draw";
  routeType?: RouteType;
  breakDepth?: number;
  finishDepth?: number;
  lineStyle?: DrawLineStyle;
  relativePoints?: FieldPoint[];
};

type PlayConcept = {
  id: string;
  name: string;
  assignments: ConceptAssignment[];
};

type GamePlan = {
  id: string;
  name: string;
  playIds: string[];
};

type DefensivePackage = {
  id: string;
  name: string;
  front: DefensePreset;
  coverage?: DefensiveCoveragePreset;
  pressure?: DefensivePressurePreset;
  defensePlayers: Player[];
  drawnLines: DrawLine[];
  manAssignments?: Record<string, string>;
  zoneAssignments?: CustomZoneAssignment[];
};

type ZoneCoverageBubble = {
  id: string;
  label: string;
  owner: string;
  ownerId?: string;
  x: number;
  yardsFromGoal: number;
  width: number;
  height: number;
};

type CustomZoneAssignment = {
  id: string;
  defenderId: string;
  x: number;
  y: number;
  radius: number;
};

type SelectedFieldItem =
  | { type: "drawnLine"; id: string }
  | { type: "route"; id: string }
  | { type: "zone"; id: string }
  | { type: "man"; id: string }
  | null;

type UndoSnapshot = {
  drawnLines: DrawLine[];
  routes: RouteModel[];
  zoneAssignments: CustomZoneAssignment[];
  manAssignments: Record<string, string>;
};

type TeamBranding = {
  schoolName: string;
  mascot: string;
  primaryColor: string;
  secondaryColor: string;
  endzoneTextColor: string;
};

type FieldTemplate = "highschool" | "college" | "nfl";
type FootballTeamSize = "11man" | "9man" | "8man" | "6man";
type CoachFocus = "offense" | "defense";
type DefensiveCoveragePreset =
  | "Cover 0"
  | "Cover 1"
  | "Cover 2"
  | "Cover 3"
  | "Cover 3 Match"
  | "Cover 4"
  | "Quarters Match"
  | "Palms"
  | "Rip/Liz Match"
  | "Man Free";
type DefensivePressurePreset =
  | "None"
  | "Mike A"
  | "Sam Edge"
  | "Will Edge"
  | "Double A"
  | "Nickel Cat"
  | "Fire Zone";

type FieldHashPreset = {
  label: string;
  left: number;
  right: number;
  description: string;
};

const DEFAULT_TEAM_BRANDING: TeamBranding = {
  schoolName: "",
  mascot: "COACHBOARD",
  primaryColor: "#166534",
  secondaryColor: "#15803d",
  endzoneTextColor: "#ffffff",
};

const FIELD_VISIBLE_YARDS = 60;
const END_ZONE_YARDS = 10;
const PLAYABLE_YARDS = 50;
const LOS_YARDS = 30;
const OFFENSE_LOS_OFFSET_YARDS = 0;
const OFFENSE_ON_LOS_YARDS = LOS_YARDS;

const OFFENSE_SIZE = 22;
const DEFENSE_SIZE = 18;
const DEFAULT_FIELD_TEMPLATE: FieldTemplate = "highschool";
const DEFAULT_FOOTBALL_TEAM_SIZE: FootballTeamSize = "11man";
const DEFAULT_COACH_FOCUS: CoachFocus = "offense";

const COACH_FOCUS_OPTIONS: Record<
  CoachFocus,
  { label: string; description: string }
> = {
  offense: {
    label: "Offense Focus",
    description:
      "Starts CoachBoard on offensive players, routes, formations, and offensive play creation.",
  },
  defense: {
    label: "Defense Focus",
    description:
      "Starts CoachBoard on defensive players, fronts, techniques, coverage drawings, and defensive play planning.",
  },
};

const FOOTBALL_TEAM_SIZE_OPTIONS: Record<
  FootballTeamSize,
  { label: string; description: string }
> = {
  "11man": {
    label: "11-Man",
    description:
      "Full 11-player football with CoachBoard system offensive and defensive presets.",
  },
  "9man": {
    label: "9-Man",
    description:
      "Nine-player football. Offense uses two guards and a center. System formation presets are hidden.",
  },
  "8man": {
    label: "8-Man",
    description:
      "Eight-player football. Offense uses two guards and a center. System formation presets are hidden.",
  },
  "6man": {
    label: "6-Man",
    description:
      "Six-player football. Offense uses a center as the required lineman. System formation presets are hidden.",
  },
};

const DEFENSIVE_FRONTS_11: DefensePreset[] = [
  "4-3 Over",
  "4-3 Under",
  "3-4 Base",
  "4-2-5",
  "3-3 Stack",
  "Goal Line",
  "Bear",
  "3-5",
  "Nickel",
  "Dime",
];
const DEFENSIVE_COVERAGES: DefensiveCoveragePreset[] = [];
const DEFENSIVE_PRESSURES: DefensivePressurePreset[] = [];
const DEFENSIVE_PACKAGE_LINE_PREFIX = "defpkg-";

const FIELD_HASH_PRESETS: Record<FieldTemplate, FieldHashPreset> = {
  highschool: {
    label: "High School",
    left: 33.3,
    right: 66.7,
    description: "Wider hashes for NFHS-style high school spacing.",
  },
  college: {
    label: "College",
    left: 40,
    right: 60,
    description: "Medium hash spacing for NCAA-style boards.",
  },
  nfl: {
    label: "NFL",
    left: 45,
    right: 55,
    description: "Tighter hashes for pro-style boards.",
  },
};

const OL_IDS = ["lt", "lg", "g1", "c", "g2", "rg", "rt"];
const OL_SPACING = [46, 50, 54, 58, 62];

// Offense alignment rules
const REQUIRED_OFFENSE_ON_LOS = 7;
const MAX_OFFENSE_BACKFIELD = 4;
const LOS_SNAP_TOLERANCE_YARDS = 1.5;
const BACKFIELD_MIN_DEPTH = 1.75;
const OFFENSE_CAN_ALIGN_ON_LOS = [
  "lt",
  "lg",
  "g1",
  "c",
  "g2",
  "rg",
  "rt",
  "x",
  "y",
  "z",
  "h",
  "hb",
];
const OFFENSE_ALWAYS_ON_LOS = ["lt", "lg", "g1", "c", "g2", "rg", "rt"];

function offenseCanBeOnLOS(player: Player) {
  return OFFENSE_CAN_ALIGN_ON_LOS.includes(player.id);
}

function offenseMustBeOnLOS(player: Player) {
  return OFFENSE_ALWAYS_ON_LOS.includes(player.id);
}

const TECHNIQUE_SPOTS: Record<"left" | "right", Record<Technique, number>> = {
  left: {
    "0": 54,
    "1": 52.5,
    "2i": 51,
    "2": 50,
    "3": 48.5,
    "4i": 47,
    "4": 46,
    "5": 44,
    "6i": 43,
    "6": 42,
    "7": 40,
    "9": 36,
  },
  right: {
    "0": 54,
    "1": 55.5,
    "2i": 57,
    "2": 58,
    "3": 60,
    "4i": 61,
    "4": 62,
    "5": 64,
    "6i": 65,
    "6": 66,
    "7": 68,
    "9": 72,
  },
};

const offenseSeed: Player[] = [
  {
    id: "x",
    position: "X",
    side: "offense",
    x: 14,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "y",
    position: "Y",
    side: "offense",
    x: 36,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "z",
    position: "Z",
    side: "offense",
    x: 86,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "lt",
    position: "LT",
    side: "offense",
    x: 46,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "lg",
    position: "LG",
    side: "offense",
    x: 50,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "c",
    position: "C",
    side: "offense",
    x: 54,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "rg",
    position: "RG",
    side: "offense",
    x: 58,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "rt",
    position: "RT",
    side: "offense",
    x: 62,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "h",
    position: "H",
    side: "offense",
    x: 72,
    yardsFromGoal: LOS_YARDS + 2,
  },
  {
    id: "qb",
    position: "QB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 4,
  },
  {
    id: "hb",
    position: "HB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 8,
  },
];

const defenseSeed: Player[] = [
  {
    id: "d1",
    position: "CB",
    side: "defense",
    x: 10,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d2",
    position: "FS",
    side: "defense",
    x: 50,
    yardsFromGoal: LOS_YARDS - 12,
  },
  {
    id: "d3",
    position: "SS",
    side: "defense",
    x: 74,
    yardsFromGoal: LOS_YARDS - 8,
  },
  {
    id: "d4",
    position: "CB",
    side: "defense",
    x: 90,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d5",
    position: "S",
    side: "defense",
    x: 34,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d6",
    position: "M",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d7",
    position: "W",
    side: "defense",
    x: 70,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d8",
    position: "DE",
    side: "defense",
    x: 45,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d9",
    position: "DT",
    side: "defense",
    x: 50,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d10",
    position: "DT",
    side: "defense",
    x: 58,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d11",
    position: "DE",
    side: "defense",
    x: 63,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
];

const offenseSeed9Man: Player[] = [
  {
    id: "x",
    position: "X",
    side: "offense",
    x: 14,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "y",
    position: "Y",
    side: "offense",
    x: 34,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "g1",
    position: "LG",
    side: "offense",
    x: 48,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "c",
    position: "C",
    side: "offense",
    x: 54,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "g2",
    position: "RG",
    side: "offense",
    x: 60,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "z",
    position: "Z",
    side: "offense",
    x: 86,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "h",
    position: "H",
    side: "offense",
    x: 72,
    yardsFromGoal: LOS_YARDS + 2,
  },
  {
    id: "qb",
    position: "QB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 4,
  },
  {
    id: "hb",
    position: "HB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 8,
  },
];

const defenseSeed9Man: Player[] = [
  {
    id: "d1",
    position: "CB",
    side: "defense",
    x: 12,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d2",
    position: "FS",
    side: "defense",
    x: 50,
    yardsFromGoal: LOS_YARDS - 11,
  },
  {
    id: "d3",
    position: "CB",
    side: "defense",
    x: 88,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d4",
    position: "OLB",
    side: "defense",
    x: 36,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d5",
    position: "M",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d6",
    position: "OLB",
    side: "defense",
    x: 72,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d7",
    position: "DE",
    side: "defense",
    x: 47,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d8",
    position: "N",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d9",
    position: "DE",
    side: "defense",
    x: 61,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
];

const offenseSeed8Man: Player[] = [
  {
    id: "x",
    position: "X",
    side: "offense",
    x: 14,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "y",
    position: "Y",
    side: "offense",
    x: 36,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "g1",
    position: "LG",
    side: "offense",
    x: 48,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "c",
    position: "C",
    side: "offense",
    x: 54,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "g2",
    position: "RG",
    side: "offense",
    x: 60,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "z",
    position: "Z",
    side: "offense",
    x: 86,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "qb",
    position: "QB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 4,
  },
  {
    id: "hb",
    position: "HB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 8,
  },
];

const defenseSeed8Man: Player[] = [
  {
    id: "d1",
    position: "CB",
    side: "defense",
    x: 12,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d2",
    position: "FS",
    side: "defense",
    x: 50,
    yardsFromGoal: LOS_YARDS - 11,
  },
  {
    id: "d3",
    position: "CB",
    side: "defense",
    x: 88,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d4",
    position: "LB",
    side: "defense",
    x: 42,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d5",
    position: "LB",
    side: "defense",
    x: 66,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d6",
    position: "DE",
    side: "defense",
    x: 47,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d7",
    position: "N",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d8",
    position: "DE",
    side: "defense",
    x: 61,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
];

const offenseSeed6Man: Player[] = [
  {
    id: "x",
    position: "X",
    side: "offense",
    x: 16,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "c",
    position: "C",
    side: "offense",
    x: 54,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "z",
    position: "Z",
    side: "offense",
    x: 84,
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  },
  {
    id: "qb",
    position: "QB",
    side: "offense",
    x: 54,
    yardsFromGoal: LOS_YARDS + 4,
  },
  {
    id: "h",
    position: "H",
    side: "offense",
    x: 38,
    yardsFromGoal: LOS_YARDS + 6,
  },
  {
    id: "hb",
    position: "HB",
    side: "offense",
    x: 70,
    yardsFromGoal: LOS_YARDS + 6,
  },
];

const defenseSeed6Man: Player[] = [
  {
    id: "d1",
    position: "CB",
    side: "defense",
    x: 16,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d2",
    position: "S",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 10,
  },
  {
    id: "d3",
    position: "CB",
    side: "defense",
    x: 84,
    yardsFromGoal: LOS_YARDS - 7,
  },
  {
    id: "d4",
    position: "LB",
    side: "defense",
    x: 54,
    yardsFromGoal: LOS_YARDS - 4.5,
  },
  {
    id: "d5",
    position: "DL",
    side: "defense",
    x: 49,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
  {
    id: "d6",
    position: "DL",
    side: "defense",
    x: 59,
    yardsFromGoal: LOS_YARDS - 1,
    onLOS: true,
  },
];

function getDefaultOffensePlayers(teamSize: FootballTeamSize) {
  if (teamSize === "9man") return autoSpaceOffensiveLine(offenseSeed9Man);
  if (teamSize === "8man") return autoSpaceOffensiveLine(offenseSeed8Man);
  if (teamSize === "6man") return autoSpaceOffensiveLine(offenseSeed6Man);
  return autoSpaceOffensiveLine(offenseSeed);
}

function getDefaultDefensePlayers(teamSize: FootballTeamSize) {
  if (teamSize === "9man") return defenseSeed9Man.map((p) => ({ ...p }));
  if (teamSize === "8man") return defenseSeed8Man.map((p) => ({ ...p }));
  if (teamSize === "6man") return defenseSeed6Man.map((p) => ({ ...p }));
  return defenseSeed.map((p) => ({ ...p }));
}

function fieldYFromYards(yardsFromGoal: number) {
  const endZonePct = (END_ZONE_YARDS / FIELD_VISIBLE_YARDS) * 100;
  const playablePct = (PLAYABLE_YARDS / FIELD_VISIBLE_YARDS) * 100;
  return endZonePct + (yardsFromGoal / PLAYABLE_YARDS) * playablePct;
}

function yardsFromPercentY(percentY: number) {
  const endZonePct = (END_ZONE_YARDS / FIELD_VISIBLE_YARDS) * 100;
  const playablePct = (PLAYABLE_YARDS / FIELD_VISIBLE_YARDS) * 100;
  const playableY = Math.max(
    endZonePct,
    Math.min(endZonePct + playablePct, percentY)
  );
  return ((playableY - endZonePct) / playablePct) * PLAYABLE_YARDS;
}

function autoSpaceOffensiveLine(players: Player[]) {
  const LINE_SPACING_GAP = 4;
  const NEAR_OL_DISTANCE = 8;
  const ATTACHED_ELIGIBLE_IDS = ["x", "y", "z", "h", "hb"];

  const coreOL = players.filter((p) => OL_IDS.includes(p.id));
  if (coreOL.length === 0) return players;

  const minOLX = Math.min(...coreOL.map((p) => p.x));
  const maxOLX = Math.max(...coreOL.map((p) => p.x));

  const lineGroup = players
    .filter((p) => {
      const isCoreOL = OL_IDS.includes(p.id);
      const isAttachedEligible = ATTACHED_ELIGIBLE_IDS.includes(p.id);
      const isNearLineDepth =
        p.onLOS || Math.abs(p.yardsFromGoal - OFFENSE_ON_LOS_YARDS) <= 1.25;
      const isNearOLWidth =
        p.x >= minOLX - NEAR_OL_DISTANCE && p.x <= maxOLX + NEAR_OL_DISTANCE;

      return (
        isCoreOL || (isAttachedEligible && isNearLineDepth && isNearOLWidth)
      );
    })
    .sort((a, b) => a.x - b.x);

  if (lineGroup.length === 0) return players;

  const currentCenter =
    lineGroup.reduce((sum, p) => sum + p.x, 0) / lineGroup.length;
  const middleIndex = (lineGroup.length - 1) / 2;

  const spacedGroup = lineGroup.map((p, index) => ({
    ...p,
    x: Math.max(
      4,
      Math.min(96, currentCenter + (index - middleIndex) * LINE_SPACING_GAP)
    ),
    yardsFromGoal: OFFENSE_ON_LOS_YARDS,
    onLOS: true,
  }));

  return players.map((p) => {
    const updated = spacedGroup.find((item) => item.id === p.id);
    return updated ?? p;
  });
}

function normalizeOffenseOnLOS(players: Player[]) {
  return players.map((p) => {
    // Keep unbalanced/custom line spacing exactly where the coach saved it.
    // This only normalizes depth for players marked as being on the LOS.
    return p.side === "offense" && p.onLOS
      ? { ...p, yardsFromGoal: OFFENSE_ON_LOS_YARDS }
      : p;
  });
}

function techniqueSideFromX(x: number): "left" | "right" {
  return x < 54 ? "left" : "right";
}

function getTechniqueX(tech: Technique, currentX: number) {
  if (tech === "0") return TECHNIQUE_SPOTS.left["0"];
  return TECHNIQUE_SPOTS[techniqueSideFromX(currentX)][tech];
}

function makeDefaultOffensePresets(
  teamSize: FootballTeamSize = DEFAULT_FOOTBALL_TEAM_SIZE
): CustomOffensePreset[] {
  if (teamSize !== "11man") return [];

  const base = autoSpaceOffensiveLine(offenseSeed);
  const makePreset = (
    id: string,
    name: string,
    changes: Partial<Record<string, [number, number, boolean?]>>,
    isMain = true
  ): CustomOffensePreset => ({
    id,
    name,
    isMain,
    isSystem: true,
    players: base.map((p) => {
      const spot = changes[p.id];
      return spot
        ? {
            ...p,
            x: spot[0],
            yardsFromGoal: spot[2] ? OFFENSE_ON_LOS_YARDS : spot[1],
            onLOS: !!spot[2],
          }
        : p;
    }),
  });

  return [
    makePreset("default-2x2", "2x2", {
      x: [14, LOS_YARDS, true],
      y: [34, LOS_YARDS, true],
      h: [72, LOS_YARDS, true],
      z: [86, LOS_YARDS, true],
      qb: [54, LOS_YARDS + 4],
      hb: [54, LOS_YARDS + 8],
    }),
    makePreset("default-trips-r", "Trips R", {
      x: [14, LOS_YARDS, true],
      y: [64, LOS_YARDS, true],
      h: [74, LOS_YARDS + 2],
      z: [86, LOS_YARDS, true],
      qb: [54, LOS_YARDS + 4],
      hb: [54, LOS_YARDS + 8],
    }),
    makePreset("default-trips-l", "Trips L", {
      x: [14, LOS_YARDS, true],
      y: [26, LOS_YARDS + 2],
      h: [36, LOS_YARDS, true],
      z: [86, LOS_YARDS, true],
      qb: [54, LOS_YARDS + 4],
      hb: [54, LOS_YARDS + 8],
    }),
    makePreset("default-empty", "Empty", {
      x: [10, LOS_YARDS, true],
      y: [26, LOS_YARDS, true],
      h: [40, LOS_YARDS + 2],
      z: [90, LOS_YARDS, true],
      qb: [54, LOS_YARDS + 4],
      hb: [74, LOS_YARDS, true],
    }),
    makePreset("default-tight", "Tight", {
      x: [30, LOS_YARDS, true],
      y: [38, LOS_YARDS, true],
      h: [70, LOS_YARDS, true],
      z: [78, LOS_YARDS, true],
      qb: [54, LOS_YARDS + 4],
      hb: [54, LOS_YARDS + 8],
    }),
  ];
}

function getRoutePoints(
  player: Player,
  route: RouteModel,
  qbPoint?: FieldPoint
) {
  // Routes start from the player's actual saved field location.
  // Fullscreen may resize icons, but it must never move spacing/alignments.
  const routeStartYards = player.yardsFromGoal;
  const start = { x: player.x, y: fieldYFromYards(routeStartYards) };
  const breakYards = Math.max(0, routeStartYards - route.breakDepth);
  const finishYards = Math.max(0, routeStartYards - route.finishDepth);
  const breakPoint = { x: player.x, y: fieldYFromYards(breakYards) };
  const towardMiddle = player.x > 50 ? -1 : 1;
  const towardOutside = player.x > 50 ? 1 : -1;
  let finishX = player.x;
  let finishY = fieldYFromYards(finishYards);

  switch (route.routeType) {
    case "Go":
      finishX = player.x;
      break;
    case "Slant":
      finishX = player.x + towardMiddle * 10;
      break;
    case "Out":
      finishX = player.x + towardOutside * 10;
      finishY = breakPoint.y;
      break;
    case "In":
      finishX = player.x + towardMiddle * 10;
      finishY = breakPoint.y;
      break;
    case "Post":
      finishX = player.x + towardMiddle * 10;
      break;
    case "Corner":
      finishX = player.x + towardOutside * 10;
      break;
    case "Curl": {
      const target = qbPoint ?? { x: 54, y: fieldYFromYards(LOS_YARDS + 4) };
      const dx = target.x - breakPoint.x;
      const dy = target.y - breakPoint.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      finishX = breakPoint.x + (dx / dist) * 4;
      finishY = breakPoint.y + (dy / dist) * 4;
      break;
    }
    case "Comeback":
      finishX = player.x + towardOutside * -6;
      break;
  }

  finishX = Math.max(5, Math.min(95, finishX));
  if (route.routeType === "Go")
    return { polyline: [start, { x: finishX, y: finishY }], breakPoint };
  return {
    polyline: [start, breakPoint, { x: finishX, y: finishY }],
    breakPoint,
  };
}

function routeArrow(polyline: FieldPoint[], size = 2.4) {
  const last = polyline[polyline.length - 1];
  const prev = polyline[polyline.length - 2] ?? last;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  return {
    last,
    a: {
      x: last.x - size * Math.cos(angle - Math.PI / 6),
      y: last.y - size * Math.sin(angle - Math.PI / 6),
    },
    b: {
      x: last.x - size * Math.cos(angle + Math.PI / 6),
      y: last.y - size * Math.sin(angle + Math.PI / 6),
    },
  };
}

function drawLineArrow(points: FieldPoint[], size = 1.6) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2] ?? last;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  return {
    last,
    a: {
      x: last.x - size * Math.cos(angle - Math.PI / 6),
      y: last.y - size * Math.sin(angle - Math.PI / 6),
    },
    b: {
      x: last.x - size * Math.cos(angle + Math.PI / 6),
      y: last.y - size * Math.sin(angle + Math.PI / 6),
    },
  };
}

function blockTCap(points: FieldPoint[], capSize = 1.1) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2] ?? last;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const perp = angle + Math.PI / 2;
  return {
    a: {
      x: last.x + capSize * Math.cos(perp),
      y: last.y + capSize * Math.sin(perp),
    },
    b: {
      x: last.x - capSize * Math.cos(perp),
      y: last.y - capSize * Math.sin(perp),
    },
  };
}

function distancePointToLine(
  point: FieldPoint,
  start: FieldPoint,
  end: FieldPoint
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function turnAngleDegrees(a: FieldPoint, b: FieldPoint, c: FieldPoint) {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const len1 = Math.max(0.001, Math.hypot(v1x, v1y));
  const len2 = Math.max(0.001, Math.hypot(v2x, v2y));
  const cosine = Math.max(
    -1,
    Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2))
  );
  const insideAngle = Math.acos(cosine) * (180 / Math.PI);

  // 0 = almost straight through, 90 = out/in style break, 180 = reversal.
  return Math.abs(180 - insideAngle);
}

function averageTwoSegmentDeviation(points: FieldPoint[], corner: FieldPoint) {
  const start = points[0];
  const end = points[points.length - 1];
  let total = 0;

  points.forEach((point) => {
    const firstDistance = distancePointToLine(point, start, corner);
    const secondDistance = distancePointToLine(point, corner, end);
    total += Math.min(firstDistance, secondDistance);
  });

  return total / points.length;
}

function findSharpBreakPoint(points: FieldPoint[]) {
  if (points.length < 5) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const totalLength = Math.max(
    0.001,
    Math.hypot(end.x - start.x, end.y - start.y)
  );
  let best: { point: FieldPoint; error: number; turn: number } | null = null;

  // Skip the very beginning/end so a tiny hook does not become a fake route break.
  for (let i = 2; i < points.length - 2; i++) {
    const point = points[i];
    const firstLength = Math.hypot(point.x - start.x, point.y - start.y);
    const secondLength = Math.hypot(end.x - point.x, end.y - point.y);

    if (firstLength < Math.max(3, totalLength * 0.18)) continue;
    if (secondLength < Math.max(3, totalLength * 0.18)) continue;

    const turn = turnAngleDegrees(start, point, end);
    if (turn < 24 || turn > 150) continue;

    const error = averageTwoSegmentDeviation(points, point);
    if (!best || error < best.error) best = { point, error, turn };
  }

  if (!best) return null;

  // If the drawn shape closely fits two straight segments, treat it as a straight break.
  // If not, keep it as a rounded/curved freehand route.
  const allowedError = Math.max(1.15, totalLength * 0.065);
  return best.error <= allowedError ? best.point : null;
}

function cleanDrawnPoints(points: FieldPoint[]) {
  if (points.length <= 2) return points;

  const start = points[0];
  const end = points[points.length - 1];
  const lineLength = Math.max(
    0.001,
    Math.hypot(end.x - start.x, end.y - start.y)
  );
  const averageDeviation =
    points.reduce(
      (sum, point) => sum + distancePointToLine(point, start, end),
      0
    ) / points.length;

  // 1) Mostly straight = snap into a perfect straight line.
  if (averageDeviation < Math.max(0.6, lineLength * 0.035)) {
    return [start, end];
  }

  // 2) Mostly two straight segments = snap into a straight route break.
  // This is what makes freehand outs/ins/corners/posts look like playbook routes,
  // not rounded corners.
  const sharpBreakPoint = findSharpBreakPoint(points);
  if (sharpBreakPoint) {
    return [start, sharpBreakPoint, end];
  }

  // 3) True curve/rounded path = simplify shaky hand movement but keep the curve.
  const cleaned: FieldPoint[] = [start];

  for (let i = 1; i < points.length - 1; i++) {
    const last = cleaned[cleaned.length - 1];
    const current = points[i];

    if (Math.hypot(current.x - last.x, current.y - last.y) >= 1.5) {
      cleaned.push(current);
    }
  }

  cleaned.push(end);
  return cleaned;
}

function cleanCurvedDrawnPoints(points: FieldPoint[]) {
  if (points.length <= 2) return points;

  const cleaned: FieldPoint[] = [points[0]];

  // Curve mode should feel easy/freehand, so it does not auto-snap into sharp breaks.
  // It only removes tiny jitter while preserving the rounded shape the coach drew.
  for (let i = 1; i < points.length - 1; i++) {
    const last = cleaned[cleaned.length - 1];
    const current = points[i];

    if (Math.hypot(current.x - last.x, current.y - last.y) >= 1.1) {
      cleaned.push(current);
    }
  }

  cleaned.push(points[points.length - 1]);
  return cleaned;
}

function smoothPath(points: FieldPoint[]) {
  if (points.length < 2) return "";
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  // Three-point cleaned drawings are intentional sharp route breaks.
  // Render them as straight line segments instead of a quadratic curve.
  if (points.length === 3) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`;
  }

  // More than three points means the coach drew a true rounded/curved path.
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    d += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${
      (current.y + next.y) / 2
    }`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

function straightPath(points: FieldPoint[]) {
  if (points.length < 2) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function packagePoint(x: number, yardsFromGoal: number): FieldPoint {
  return { x, y: fieldYFromYards(Math.max(0, Math.min(50, yardsFromGoal))) };
}

function packageLine(
  id: string,
  style: DrawLineStyle,
  mode: DrawLineMode,
  points: FieldPoint[]
): DrawLine {
  return { id: `${DEFENSIVE_PACKAGE_LINE_PREFIX}${id}`, style, mode, points };
}

function removeDefensivePackageLines(lines: DrawLine[]) {
  return lines.filter(
    (line) => !line.id.startsWith(DEFENSIVE_PACKAGE_LINE_PREFIX)
  );
}

function zoneBubble(
  id: string,
  owner: string,
  label: string,
  x: number,
  yardsFromGoal: number,
  width: number,
  height: number,
  ownerId?: string
): ZoneCoverageBubble {
  return { id, owner, ownerId, label, x, yardsFromGoal, width, height };
}

function buildCoverageBubbles(
  coverage: DefensiveCoveragePreset
): ZoneCoverageBubble[] {
  const deep = LOS_YARDS - 15;
  const curl = LOS_YARDS - 8;
  const flat = LOS_YARDS - 5;

  if (coverage === "Cover 2") {
    return [
      zoneBubble("cov2-left-half", "FS", "DEEP 1/2", 30, deep, 36, 17),
      zoneBubble("cov2-right-half", "SS", "DEEP 1/2", 70, deep, 36, 17),
      zoneBubble("cov2-left-flat", "CB", "FLAT", 17, flat, 18, 10),
      zoneBubble("cov2-right-flat", "CB", "FLAT", 83, flat, 18, 10),
      zoneBubble("cov2-hook-l", "W", "HOOK", 43, curl, 18, 10),
      zoneBubble("cov2-hook-r", "M", "HOOK", 57, curl, 18, 10),
    ];
  }

  if (coverage === "Cover 3") {
    return [
      zoneBubble("cov3-left-third", "CB", "DEEP 1/3", 22, deep, 28, 18),
      zoneBubble("cov3-middle-third", "FS", "DEEP 1/3", 50, deep, 28, 18),
      zoneBubble("cov3-right-third", "CB", "DEEP 1/3", 78, deep, 28, 18),
      zoneBubble("cov3-left-flat", "S", "FLAT", 20, flat, 20, 10),
      zoneBubble("cov3-curl-l", "W", "CURL", 40, curl, 18, 10),
      zoneBubble("cov3-curl-r", "M", "CURL", 60, curl, 18, 10),
      zoneBubble("cov3-right-flat", "SS", "FLAT", 80, flat, 20, 10),
    ];
  }

  if (coverage === "Cover 4") {
    return [
      zoneBubble("cov4-q1", "CB", "DEEP 1/4", 18, deep, 22, 18),
      zoneBubble("cov4-q2", "FS", "DEEP 1/4", 40, deep, 22, 18),
      zoneBubble("cov4-q3", "SS", "DEEP 1/4", 60, deep, 22, 18),
      zoneBubble("cov4-q4", "CB", "DEEP 1/4", 82, deep, 22, 18),
      zoneBubble("cov4-flat-l", "S", "FLAT", 20, flat, 20, 10),
      zoneBubble("cov4-hook-l", "W", "HOOK", 42, curl, 18, 10),
      zoneBubble("cov4-hook-r", "M", "HOOK", 58, curl, 18, 10),
      zoneBubble("cov4-flat-r", "SS", "FLAT", 80, flat, 20, 10),
    ];
  }

  // Cover 1 / Man Free keep a realistic free safety zone bubble.
  if (coverage === "Cover 1" || coverage === "Man Free") {
    return [
      zoneBubble("cov1-free", "FS", "FREE / POST", 50, LOS_YARDS - 16, 34, 17),
    ];
  }

  // Cover 0 is pure man pressure, so it intentionally has no zone bubbles.
  return [];
}

function coverageAssignmentsForDisplay(coverage: DefensiveCoveragePreset) {
  const bubbles = buildCoverageBubbles(coverage);
  const assignments = bubbles.map(
    (bubble) => `${bubble.owner}: ${bubble.label}`
  );
  if (coverage === "Cover 0")
    return ["No deep help — all eligible receivers are man matched."];
  if (coverage === "Cover 1" || coverage === "Man Free")
    return [
      "FS: FREE / POST",
      "Corners/LBs/Safeties: man matched by assignment",
      ...assignments.filter((item) => !item.startsWith("FS:")),
    ];
  return assignments;
}

function buildCoverageLines(coverage: DefensiveCoveragePreset): DrawLine[] {
  // Zone coverage is now shown with translucent bubbles instead of dotted route-style lines.
  // Man coverage is shown with defender-to-receiver assignment lines created in the UI.
  return [];
}

function buildPressureLines(pressure: DefensivePressurePreset): DrawLine[] {
  if (pressure === "None") return [];
  const targetA = packagePoint(53, LOS_YARDS + 1.5);
  const targetB = packagePoint(55, LOS_YARDS + 1.5);
  const edgeLeft = packagePoint(44, LOS_YARDS + 1.5);
  const edgeRight = packagePoint(64, LOS_YARDS + 1.5);

  if (pressure === "Mike A")
    return [
      packageLine("press-mike-a", "solid", "straight", [
        packagePoint(54, LOS_YARDS - 4.5),
        targetA,
      ]),
    ];
  if (pressure === "Sam Edge")
    return [
      packageLine("press-sam-edge", "solid", "straight", [
        packagePoint(34, LOS_YARDS - 4.5),
        edgeLeft,
      ]),
    ];
  if (pressure === "Will Edge")
    return [
      packageLine("press-will-edge", "solid", "straight", [
        packagePoint(70, LOS_YARDS - 4.5),
        edgeRight,
      ]),
    ];
  if (pressure === "Double A")
    return [
      packageLine("press-a-left", "solid", "straight", [
        packagePoint(48, LOS_YARDS - 4.5),
        targetA,
      ]),
      packageLine("press-a-right", "solid", "straight", [
        packagePoint(60, LOS_YARDS - 4.5),
        targetB,
      ]),
    ];
  if (pressure === "Nickel Cat")
    return [
      packageLine("press-nickel-cat", "solid", "straight", [
        packagePoint(80, LOS_YARDS - 6),
        edgeRight,
      ]),
    ];

  return [
    packageLine("press-fire-sam", "solid", "straight", [
      packagePoint(34, LOS_YARDS - 4.5),
      edgeLeft,
    ]),
    packageLine("press-fire-mike", "solid", "straight", [
      packagePoint(54, LOS_YARDS - 4.5),
      targetA,
    ]),
    packageLine("press-fire-drop", "dotted", "curve", [
      packagePoint(63, LOS_YARDS - 1),
      packagePoint(66, LOS_YARDS - 4),
      packagePoint(70, LOS_YARDS - 7),
    ]),
  ];
}

function buildDefensivePackageLines(
  coverage: DefensiveCoveragePreset,
  pressure: DefensivePressurePreset
): DrawLine[] {
  return [...buildCoverageLines(coverage), ...buildPressureLines(pressure)];
}

const cardStyle: React.CSSProperties = {
  background: "rgba(2, 8, 23, 0.78)",
backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: 22,
  boxShadow:
    "0 18px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
};

const panelHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#f87171",
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const COACHBOARD_COLOR_OPTIONS = [
  { name: "White", value: "#f3f4f6" },
  { name: "Gold", value: "#facc15" },
  { name: "Blue", value: "#38bdf8" },
  { name: "Red", value: "#dc2626" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
];

function readableTextColor(background: string) {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "white";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "black" : "white";
}

function ColorSwatches({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}
    >
      {COACHBOARD_COLOR_OPTIONS.map((color) => (
        <button
          key={color.value}
          title={color.name}
          aria-label={color.name}
          onClick={() => onSelect(color.value)}
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            minHeight: 28,
            borderRadius: 999,
            background: color.value,
            border:
              selectedColor === color.value
                ? "3px solid #ffffff"
                : "2px solid rgba(0,0,0,.65)",
            boxShadow:
              selectedColor === color.value
                ? "0 0 0 2px rgba(250,204,21,.75), 0 8px 18px rgba(0,0,0,.35)"
                : "0 5px 12px rgba(0,0,0,.28)",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

const buttonBase: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  transition:
    "background .15s ease, transform .15s ease, border .15s ease, box-shadow .15s ease",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 8px 18px rgba(0,0,0,.22)",
};

function SmallButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...buttonBase,
        background: active
          ? "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)"
          : "linear-gradient(180deg, rgba(31,41,55,.92) 0%, rgba(12,16,23,.95) 100%)",
        color: "white",
        border: active
          ? "1px solid rgba(248,113,113,.9)"
          : "1px solid rgba(255,255,255,.10)",
        boxShadow: active
          ? "0 0 0 1px rgba(255,255,255,.12) inset, 0 12px 24px rgba(220,38,38,.28)"
          : "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.25)",
      }}
    >
      {label}
    </button>
  );
}

function CoachBoardWebApp() {
  const [teamCode, setTeamCode] = useState("");
  const [teamCodeInput, setTeamCodeInput] = useState("");
  const [user, setUser] = useState<User | null>(null);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [showGamedayRoom, setShowGamedayRoom] = useState(false);

const [coachName, setCoachName] = useState(
  localStorage.getItem("coachboard_coach_name") || ""
);

const [roomMembers, setRoomMembers] = useState<string[]>([]);

  const ROOM_ID = user
  ? teamCode
    ? `coachboard-team-${teamCode}`
    : `coachboard-user-${user.id}`
  : "";
  const [footballTeamSize, setFootballTeamSize] = useState<FootballTeamSize>(
    DEFAULT_FOOTBALL_TEAM_SIZE
  );
  const [coachFocus, setCoachFocus] = useState<CoachFocus>(DEFAULT_COACH_FOCUS);
  const [offensePlayers, setOffensePlayers] = useState<Player[]>(() =>
    getDefaultOffensePlayers(DEFAULT_FOOTBALL_TEAM_SIZE)
  );
  const [defensePlayers, setDefensePlayers] = useState<Player[]>(() =>
    getDefaultDefensePlayers(DEFAULT_FOOTBALL_TEAM_SIZE)
  );
  const [selectedDefenseFront, setSelectedDefenseFront] =
    useState<DefensePreset>("4-3 Over");
  const [selectedDefensiveCoverage, setSelectedDefensiveCoverage] =
    useState<DefensiveCoveragePreset>("Cover 3");
  const [selectedDefensivePressure, setSelectedDefensivePressure] =
    useState<DefensivePressurePreset>("None");
  const [showCoverageOverlay, setShowCoverageOverlay] = useState(false);
  const [showPressureOverlay, setShowPressureOverlay] = useState(false);
  const [manAssignments, setManAssignments] = useState<Record<string, string>>(
    {}
  );
  const [zoneAssignments, setZoneAssignments] = useState<
    CustomZoneAssignment[]
  >([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneDraftId, setZoneDraftId] = useState<string | null>(null);
  const [zoneDrag, setZoneDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [selectedFieldItem, setSelectedFieldItem] =
    useState<SelectedFieldItem>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [manAssignDefenderId, setManAssignDefenderId] = useState("d1");
  const [manAssignOffenseId, setManAssignOffenseId] = useState("x");
  const [defensivePackageName, setDefensivePackageName] = useState("");
  const [savedDefensivePackages, setSavedDefensivePackages] = useState<
    DefensivePackage[]
  >([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("z");
  const [selectedSide, setSelectedSide] = useState<Side>("offense");
  const [routes, setRoutes] = useState<RouteModel[]>([]);
  const [routeType, setRouteType] = useState<RouteType>("Corner");
  const [breakDepth, setBreakDepth] = useState(10);
  const [finishDepth, setFinishDepth] = useState(18);
  const [routeColor, setRouteColor] = useState("#facc15");
  const [defensiveReadPlayerIds, setDefensiveReadPlayerIds] = useState<string[]>([]);
  const [tool, setTool] = useState("Select");
  const [drawingStyle, setDrawingStyle] = useState<DrawLineStyle>("solid");
  const [drawingMode, setDrawingMode] = useState<DrawLineMode>("curve");
  const [drawnLines, setDrawnLines] = useState<DrawLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingSide, setDraggingSide] = useState<Side | null>(null);
const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const [customPresetName, setCustomPresetName] = useState("");
  const [customOffensePresets, setCustomOffensePresets] = useState<
    CustomOffensePreset[]
  >([]);
  const [showCreateOffenseSet, setShowCreateOffenseSet] = useState(false);
  const [showManageOffenseSets, setShowManageOffenseSets] = useState(false);
  const [showCreatePlay, setShowCreatePlay] = useState(false);
  const [showManagePlays, setShowManagePlays] = useState(false);
  const [showPlaybooks, setShowPlaybooks] = useState(false);
  const [showCreateConcept, setShowCreateConcept] = useState(false);
  const [showManageConcepts, setShowManageConcepts] = useState(false);
  const [selectedPresetDropdownId, setSelectedPresetDropdownId] = useState("");
  const [savedPlayName, setSavedPlayName] = useState("");
  const [savedPlays, setSavedPlays] = useState<SavedPlay[]>([]);
  const [selectedPlayId, setSelectedPlayId] = useState("");
  const [selectedPlayFormationId, setSelectedPlayFormationId] = useState("");
  const [playbookName, setPlaybookName] = useState("");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState("");
  const [conceptName, setConceptName] = useState("");
  const [playConcepts, setPlayConcepts] = useState<PlayConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [showGamePlan, setShowGamePlan] = useState(false);
  const [gamePlanName, setGamePlanName] = useState("");
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [selectedGamePlanId, setSelectedGamePlanId] = useState("");
  const [currentGamePlanIndex, setCurrentGamePlanIndex] = useState(0);
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>("player");
  const [draggedTopPresetId, setDraggedTopPresetId] = useState<string | null>(
    null
  );
  const [fieldFullscreen, setFieldFullscreen] = useState(false);
  const [showFullscreenPlayerPanel, setShowFullscreenPlayerPanel] =
    useState(false);
  const [showFullscreenToolsPanel, setShowFullscreenToolsPanel] =
    useState(false);
  const [showFullscreenQuickToolbar, setShowFullscreenQuickToolbar] =
    useState(true);
  const [fieldPixelHeight, setFieldPixelHeight] = useState(0);
  const [fieldPixelWidth, setFieldPixelWidth] = useState(0);
  const [showTeamSetup, setShowTeamSetup] = useState(false);
  const [teamBranding, setTeamBranding] = useState<TeamBranding>(
    DEFAULT_TEAM_BRANDING
  );
  const [fieldTemplate, setFieldTemplate] = useState<FieldTemplate>(
    DEFAULT_FIELD_TEMPLATE
  );
  const fieldRef = useRef<HTMLDivElement | null>(null);

  // ===============================
  // ===============================
  // PLAYER + UI SCALING SYSTEM
  // ===============================

  // IMPORTANT:
  // playerPx controls the actual field geometry/LOS anchor math.
  // It stays the same in fullscreen so OL/DL/QB spacing never changes.
  const playerPx = Math.max(18, fieldPixelHeight * 0.025);

  // Fullscreen only visually scales the icons after they are positioned.
  // This makes them easier to see without moving their field locations.
  const visualPlayerScale = fieldFullscreen ? 1.4 : 1;
  const visualPlayerPx = playerPx * visualPlayerScale;

  // Keep mini-screen lettering exactly like the original.
  // In fullscreen, the whole icon scales visually through CSS transform.
  const playerFontPx = Math.max(8, playerPx * 0.38);
  const playerBorderPx = Math.max(1.5, playerPx * 0.065);
  const selectedPlayerBorderPx = Math.max(2, playerPx * 0.09);

  // Unified line sizing system.
  // Routes, solid draw, dotted draw, block lines, arrows, and T-caps now share
  // the same visual stroke size so no tool looks thicker than another.
const lineStroke = Math.max(0.35, playerPx * 0.018);
  const lineOutlineStroke = lineStroke + Math.max(0.14, visualPlayerPx * 0.008);

  const routeStroke = lineStroke;
  const routeOutlineStroke = lineOutlineStroke;

  const blockStroke = lineStroke;
  const blockOutlineStroke = lineOutlineStroke;

  const blockCapStroke = lineStroke;
  const blockCapOutlineStroke = lineOutlineStroke;

  const arrowSize = Math.max(0.9, playerPx * 0.075);
  const blockCapSize = visualPlayerPx * 0.045;

  // Tight, clean dotted pattern. The round caps in the SVG make this look like
  // true dots instead of long thick dashes.
  const dashPattern = `${Math.max(0.18, lineStroke * 0.65)} ${Math.max(
    1.15,
    lineStroke * 2.35
  )}`;

  const endzoneFontPx = fieldFullscreen
    ? Math.max(40, Math.min(100, fieldPixelHeight * 0.08))
    : Math.max(18, Math.min(42, fieldPixelHeight * 0.045));

  const endzoneLetterSpacing = fieldFullscreen ? "0.08em" : "0.16em";

  const selectedPlayer =
    selectedSide === "offense"
      ? offensePlayers.find((p) => p.id === selectedPlayerId) ??
        offensePlayers[0]
      : defensePlayers.find((p) => p.id === selectedPlayerId) ??
        defensePlayers[0];

  const activeRoute = useMemo(
    () => routes.find((r) => r.playerId === selectedPlayer.id),
    [routes, selectedPlayer]
  );

  useEffect(() => {
    if (selectedSide === "offense") {
      setRouteColor(activeRoute?.color ?? selectedPlayer.color ?? "#facc15");
    }
  }, [
    activeRoute?.color,
    selectedPlayer.color,
    selectedPlayer.id,
    selectedSide,
  ]);

  // This must be declared before playerPanelContent because that JSX uses it immediately during render.
  const sortedOffensePresets = [...customOffensePresets].sort(
    (a, b) => Number(!!a.isSystem) - Number(!!b.isSystem)
  );
useEffect(() => {
  if (!ROOM_ID) return;

const channel = supabase.channel(ROOM_ID);

  realtimeChannelRef.current = channel;

  channel.on("broadcast", { event: "board-event" }, ({ payload }) => {
    if (payload.type === "SET_DRAWN_LINES") {
      setDrawnLines(payload.drawnLines);
    }

    if (payload.type === "SET_MAN_ASSIGNMENTS") {
  setManAssignments(payload.manAssignments);
}

if (payload.type === "SET_COACH_FOCUS") {
  setCoachFocus(payload.coachFocus);
}
    
    if (payload.type === "SET_READ_KEYS") {
  setDefensiveReadPlayerIds(payload.defensiveReadPlayerIds);
}

if (payload.type === "SET_SELECTED_SIDE") {
  setSelectedSide(payload.selectedSide);
}
    if (payload.type === "SET_BOARD_STATE") {
  setDrawnLines(payload.drawnLines);
  setRoutes(payload.routes);
  setZoneAssignments(payload.zoneAssignments);
      setManAssignments(payload.manAssignments);
}
    
    if (payload.type === "SET_ROUTES") {
      setRoutes(payload.routes);
    }

    if (payload.type === "SET_OFFENSE_PLAYERS") {
      setOffensePlayers(payload.offensePlayers);
    }

    if (payload.type === "SET_DEFENSE_PLAYERS") {
      setDefensePlayers(payload.defensePlayers);
    }

    if (payload.type === "SET_ZONES") {
      setZoneAssignments(payload.zoneAssignments);
    }

    if (payload.type === "SET_TEAM_SETUP") {
  setFootballTeamSize(payload.footballTeamSize);
  setOffensePlayers(payload.offensePlayers);
  setDefensePlayers(payload.defensePlayers);
  setSelectedPlayerId(payload.selectedPlayerId);
  setSelectedSide(payload.selectedSide);
  setActivePanelTab(payload.activePanelTab);
  setRoutes(payload.routes);
  setDrawnLines(payload.drawnLines);
}
  });

  channel.on("broadcast", { event: "board-event" }, (event) => {
  console.log("BOARD EVENT RECEIVED:", event);
});
  channel.subscribe((status) => {
    console.log("REALTIME STATUS:", status);
  });

  return () => {
    realtimeChannelRef.current = null;
    supabase.removeChannel(channel);
  };
}, [ROOM_ID]);
  useEffect(() => {
  const saved = localStorage.getItem("coachboard_team_code");

  if (saved) {
    setTeamCode(saved);
  }
}, []);
  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (data.user) {
      setUser(data.user);
    }
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
  const selectedZone = selectedZoneId
    ? zoneAssignments.find((zone) => zone.id === selectedZoneId) ?? null
    : null;

  function updateSelectedZoneRadius(nextRadius: number) {
  if (!selectedZoneId) return;

  const clampedRadius = Math.max(2.5, Math.min(18, nextRadius));

  const nextZones = zoneAssignments.map((zone) =>
    zone.id === selectedZoneId
      ? { ...zone, radius: clampedRadius }
      : zone
  );

  setZoneAssignments(nextZones);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_ZONES",
      zoneAssignments: nextZones,
    },
  });
}

  const activeToolLabel = (() => {
    if (tool === "Draw")
      return `${drawingStyle.toUpperCase()} · ${drawingMode.toUpperCase()}`;
    if (tool === "Zone") return "ZONE CIRCLE";
    if (tool === "Man") return "MAN ASSIGNMENT";
    if (tool === "Move") return "MOVE PLAYERS";
    if (selectedFieldItem?.type === "drawnLine") return "DRAWING SELECTED";
    if (selectedFieldItem?.type === "route") return "ROUTE SELECTED";
    if (selectedFieldItem?.type === "zone") return "ZONE SELECTED";
    return "NONE";
  })();

  function cloneDrawnLinesForHistory(lines: DrawLine[]) {
    return lines.map((line) => ({
      ...line,
      points: line.points.map((point) => ({ ...point })),
    }));
  }

  function cloneRoutesForHistory(routeList: RouteModel[]) {
    return routeList.map((route) => ({ ...route }));
  }

  function cloneZonesForHistory(zones: CustomZoneAssignment[]) {
    return zones.map((zone) => ({ ...zone }));
  }

  function pushUndoSnapshot() {
    setUndoStack((current) => [
      ...current.slice(-24),
      {
        drawnLines: cloneDrawnLinesForHistory(drawnLines),
        routes: cloneRoutesForHistory(routes),
        zoneAssignments: cloneZonesForHistory(zoneAssignments),
        manAssignments: { ...manAssignments },
      },
    ]);
  }

  function undoLastAction() {
  setUndoStack((current) => {
    const snapshot = current[current.length - 1];
    if (!snapshot) return current;

    const nextLines = cloneDrawnLinesForHistory(snapshot.drawnLines);
    const nextRoutes = cloneRoutesForHistory(snapshot.routes);
    const nextZones = cloneZonesForHistory(snapshot.zoneAssignments);

    setDrawnLines(nextLines);
    setRoutes(nextRoutes);
    setZoneAssignments(nextZones);
    setManAssignments({ ...snapshot.manAssignments });

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_BOARD_STATE",
        drawnLines: nextLines,
        routes: nextRoutes,
        zoneAssignments: nextZones,
        manAssignments: { ...snapshot.manAssignments },
      },
    });

    setSelectedFieldItem(null);
    setSelectedZoneId(null);
    setActiveLineId(null);
    setZoneDraftId(null);
    setZoneDrag(null);

    return current.slice(0, -1);
  });
}
  function selectFieldItem(item: SelectedFieldItem) {
    setSelectedFieldItem(item);
    if (item?.type === "zone") setSelectedZoneId(item.id);
    else setSelectedZoneId(null);
    setActiveLineId(null);
  }

  function deleteSelectedFieldItem() {
    if (!selectedFieldItem) return;
    pushUndoSnapshot();

   if (selectedFieldItem.type === "drawnLine") {
  const nextLines = drawnLines.filter(
    (line) => line.id !== selectedFieldItem.id
  );

  setDrawnLines(nextLines);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DRAWN_LINES",
      drawnLines: nextLines,
    },
  });
}

    if (selectedFieldItem.type === "route") {
      setRoutes((current) =>
        current.filter((route) => route.playerId !== selectedFieldItem.id)
      );
    }

    if (selectedFieldItem.type === "zone") {
      setZoneAssignments((current) =>
        current.filter((zone) => zone.id !== selectedFieldItem.id)
      );
      setSelectedZoneId(null);
    }
if (selectedFieldItem.type === "man") {
  const nextAssignments = { ...manAssignments };

  delete nextAssignments[selectedFieldItem.id];

  setManAssignments(nextAssignments);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_MAN_ASSIGNMENTS",
      manAssignments: nextAssignments,
    },
  });
    setSelectedFieldItem(null);
  }

}
  function clearActiveTool() {
    setTool("Select");
    setActiveLineId(null);
    setDraggingId(null);
    setDraggingSide(null);
    setSelectedFieldItem(null);
  }

  function toggleMoveTool() {
    setTool((current) => (current === "Move" ? "Select" : "Move"));
    setActiveLineId(null);
  }

  function toggleDrawTool(style: DrawLineStyle) {
    setTool((current) =>
      current === "Draw" && drawingStyle === style ? "Select" : "Draw"
    );
    setDrawingStyle(style);
    setActiveLineId(null);
  }

  function toggleDrawMode(mode: DrawLineMode) {
    setTool("Draw");
    setDrawingMode(mode);
    setActiveLineId(null);
  }

  function toggleZoneTool() {
    setTool((current) => (current === "Zone" ? "Select" : "Zone"));
    setActiveLineId(null);
    if (selectedSide !== "defense") {
      setSelectedSide("defense");
      const firstDefender = defensePlayers[0];
      if (firstDefender) setSelectedPlayerId(firstDefender.id);
    }
  }

  function toggleManTool() {
    setTool((current) => (current === "Man" ? "Select" : "Man"));
    setActiveLineId(null);
  }

  function fieldCursor() {
    if (tool === "Draw") return "crosshair";
    if (tool === "Zone") return "cell";
    if (tool === "Man") return "copy";
    if (tool === "Move") return draggingId ? "grabbing" : "grab";
    return "default";
  }
  function clampCoverageX(x: number, min = 10, max = 90) {
    return Math.max(min, Math.min(max, x));
  }

  function eligibleOffensivePlayers() {
    return offensePlayers
      .filter(
        (player) =>
          player.side === "offense" &&
          !OL_IDS.includes(player.id) &&
          player.id !== "qb"
      )
      .slice()
      .sort((a, b) => a.x - b.x);
  }

  function offensiveFormationTargets() {
    const eligible = eligibleOffensivePlayers();
    const left = eligible.filter((player) => player.x < 50);
    const right = eligible.filter((player) => player.x >= 50);
    const allXs = eligible.map((player) => player.x).sort((a, b) => a - b);
    const leftWide = left[0]?.x ?? 16;
    const leftInside = left[left.length - 1]?.x ?? 40;
    const rightInside = right[0]?.x ?? 60;
    const rightWide = right[right.length - 1]?.x ?? 84;
    const strength: "left" | "right" | "balanced" =
      left.length > right.length
        ? "left"
        : right.length > left.length
        ? "right"
        : "balanced";
    const isTripsLeft = left.length >= 3;
    const isTripsRight = right.length >= 3;

    return {
      eligible,
      left,
      right,
      allXs,
      strength,
      isTripsLeft,
      isTripsRight,
      leftWide: clampCoverageX(leftWide, 10, 36),
      leftInside: clampCoverageX(leftInside, 26, 48),
      rightInside: clampCoverageX(rightInside, 52, 74),
      rightWide: clampCoverageX(rightWide, 64, 90),
      weakFlatX: clampCoverageX(
        strength === "right" ? leftWide : rightWide,
        12,
        88
      ),
      strongFlatX: clampCoverageX(
        strength === "left" ? leftWide : rightWide,
        12,
        88
      ),
      leftFlat: clampCoverageX(leftWide, 12, 30),
      rightFlat: clampCoverageX(rightWide, 70, 88),
      leftCurl: clampCoverageX(
        left.length >= 2 ? (leftInside + 50) / 2 : 38,
        32,
        46
      ),
      rightCurl: clampCoverageX(
        right.length >= 2 ? (rightInside + 50) / 2 : 62,
        54,
        68
      ),
      leftSeam: clampCoverageX(left.length >= 2 ? leftInside : 40, 36, 47),
      rightSeam: clampCoverageX(right.length >= 2 ? rightInside : 60, 53, 64),
    };
  }

  function defenderLabel(player: Player) {
    return player.position.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function isCoverageEligibleDefender(player: Player) {
    const label = defenderLabel(player);
    const isDownLineman =
      player.onLOS ||
      ["DE", "DT", "NT", "N", "NOSE"].some(
        (tag) => label === tag || label.includes(tag)
      );
    return player.side === "defense" && !isDownLineman;
  }

  function labelMatches(player: Player, labels: string[]) {
    const position = defenderLabel(player);
    return labels.some((label) => {
      const clean = label.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return position === clean || position.includes(clean);
    });
  }

  function coverageDepthScore(player: Player, targetYards = LOS_YARDS - 8) {
    return Math.abs(player.yardsFromGoal - targetYards) * 0.35;
  }

  function pickDefenderForCoverage(
    labels: string[],
    targetX: number,
    usedIds: Set<string>,
    side?: "left" | "right" | "middle",
    targetYards = LOS_YARDS - 8
  ) {
    const available = defensePlayers.filter(
      (player) => isCoverageEligibleDefender(player) && !usedIds.has(player.id)
    );
    const sideFiltered =
      side === "left"
        ? available.filter((player) => player.x <= 54)
        : side === "right"
        ? available.filter((player) => player.x >= 46)
        : side === "middle"
        ? available.filter((player) => player.x >= 30 && player.x <= 72)
        : available;

    const matching = sideFiltered.filter((player) =>
      labelMatches(player, labels)
    );
    const pool =
      matching.length > 0
        ? matching
        : sideFiltered.length > 0
        ? sideFiltered
        : available;
    const selected = pool.slice().sort((a, b) => {
      const aRoleBonus = labelMatches(a, labels) ? -9 : 0;
      const bRoleBonus = labelMatches(b, labels) ? -9 : 0;
      const aScore =
        Math.abs(a.x - targetX) +
        coverageDepthScore(a, targetYards) +
        aRoleBonus;
      const bScore =
        Math.abs(b.x - targetX) +
        coverageDepthScore(b, targetYards) +
        bRoleBonus;
      return aScore - bScore;
    })[0];

    if (selected) usedIds.add(selected.id);
    return selected;
  }

  function findDeepCorner(side: "left" | "right", usedIds: Set<string>) {
    return pickDefenderForCoverage(
      ["CB", "C"],
      side === "left" ? 18 : 82,
      usedIds,
      side,
      LOS_YARDS - 12
    );
  }

  function findFreeSafety(usedIds: Set<string>, targetX = 50) {
    return pickDefenderForCoverage(
      ["FS", "F", "S"],
      targetX,
      usedIds,
      "middle",
      LOS_YARDS - 13
    );
  }

  function findStrongSafety(
    usedIds: Set<string>,
    targetX = 60,
    side?: "left" | "right"
  ) {
    return pickDefenderForCoverage(
      ["SS", "ROV", "ROVER", "S"],
      targetX,
      usedIds,
      side ?? (targetX < 50 ? "left" : "right"),
      LOS_YARDS - 11
    );
  }

  function findNickelOrApex(
    side: "left" | "right",
    usedIds: Set<string>,
    targetX: number
  ) {
    return pickDefenderForCoverage(
      ["NICK", "NB", "STAR", "APEX", "OLB", "SAM", "WILL", "S", "W", "M"],
      targetX,
      usedIds,
      side,
      LOS_YARDS - 6
    );
  }

  function findLinebacker(
    labels: string[],
    targetX: number,
    usedIds: Set<string>,
    side?: "left" | "right" | "middle"
  ) {
    return pickDefenderForCoverage(
      labels,
      targetX,
      usedIds,
      side,
      LOS_YARDS - 5.5
    );
  }

  function deepCoverageTargets() {
    const targets = offensiveFormationTargets();
    const tripsBump = targets.isTripsLeft ? -4 : targets.isTripsRight ? 4 : 0;

    return {
      ...targets,
      // Deep zones are field-structure landmarks first, then nudged slightly by formation strength.
      c3Left: clampCoverageX(20 + Math.min(0, tripsBump), 16, 28),
      c3Middle: clampCoverageX(50 + tripsBump, 43, 57),
      c3Right: clampCoverageX(80 + Math.max(0, tripsBump), 72, 84),
      q1: clampCoverageX(
        targets.leftWide <= 18 ? 18 : (12 + targets.leftWide) / 2,
        14,
        27
      ),
      q2: clampCoverageX(
        targets.left.length >= 2 ? targets.leftInside : 40,
        34,
        47
      ),
      q3: clampCoverageX(
        targets.right.length >= 2 ? targets.rightInside : 60,
        53,
        66
      ),
      q4: clampCoverageX(
        targets.rightWide >= 82 ? 82 : (88 + targets.rightWide) / 2,
        73,
        86
      ),
    };
  }

  function offensiveThreatsBySide(side: "left" | "right") {
    const eligible = eligibleOffensivePlayers();
    const sidePlayers =
      side === "left"
        ? eligible.filter((player) => player.x < 50).sort((a, b) => a.x - b.x)
        : eligible.filter((player) => player.x >= 50).sort((a, b) => b.x - a.x);

    return sidePlayers.map((player, index) => ({
      player,
      number: index + 1,
      x: player.x,
      label: `#${index + 1}`,
    }));
  }

  function threatX(side: "left" | "right", number: number, fallback: number) {
    const threat = offensiveThreatsBySide(side).find(
      (item) => item.number === number
    );
    return clampCoverageX(
      threat?.x ?? fallback,
      side === "left" ? 8 : 50,
      side === "left" ? 50 : 92
    );
  }

  function patternMatchTargets() {
    const base = offensiveFormationTargets();
    const leftThreats = offensiveThreatsBySide("left");
    const rightThreats = offensiveThreatsBySide("right");
    const tripsSide: "left" | "right" | null =
      leftThreats.length >= 3
        ? "left"
        : rightThreats.length >= 3
        ? "right"
        : null;
    const strength: "left" | "right" =
      base.strength === "balanced"
        ? rightThreats.length >= leftThreats.length
          ? "right"
          : "left"
        : base.strength;
    const weakSide: "left" | "right" = strength === "right" ? "left" : "right";

    return {
      ...base,
      leftThreats,
      rightThreats,
      tripsSide,
      strength,
      weakSide,
      left1: threatX("left", 1, base.leftWide),
      left2: threatX("left", 2, base.leftInside),
      left3: threatX("left", 3, 42),
      right1: threatX("right", 1, base.rightWide),
      right2: threatX("right", 2, base.rightInside),
      right3: threatX("right", 3, 58),
    };
  }

  function sideQuarterX(side: "left" | "right", number: 1 | 2) {
    const targets = patternMatchTargets();
    if (side === "left" && number === 1)
      return clampCoverageX((targets.left1 + 8) / 2, 14, 28);
    if (side === "left" && number === 2)
      return clampCoverageX(targets.left2, 34, 47);
    if (side === "right" && number === 2)
      return clampCoverageX(targets.right2, 53, 66);
    return clampCoverageX((targets.right1 + 92) / 2, 72, 86);
  }

  function matchLabel(side: "left" | "right", label: string) {
    return `${side === "left" ? "L" : "R"} ${label}`;
  }

  function buildSmartCoverageBubbles(
    coverage: DefensiveCoveragePreset
  ): ZoneCoverageBubble[] {
    if (!showCoverageOverlay) return [];

    const targets = offensiveFormationTargets();
    const deepTargets = deepCoverageTargets();
    const usedIds = new Set<string>();
    const deep = LOS_YARDS - 16;
    const quarterDeep = LOS_YARDS - 15.5;
    const halfDeep = LOS_YARDS - 16;
    const curl = LOS_YARDS - 8.25;
    const flat = LOS_YARDS - 5.25;
    const hook = LOS_YARDS - 7.25;
    const strongSide =
      targets.strength === "balanced"
        ? targets.right.length >= targets.left.length
          ? "right"
          : "left"
        : targets.strength;
    const weakSide = strongSide === "right" ? "left" : "right";
    const frontIsFourThree =
      selectedDefenseFront === "4-3 Over" ||
      selectedDefenseFront === "4-3 Under";
    const frontIsThreeFive = selectedDefenseFront === "3-5";
    const frontIsSub =
      selectedDefenseFront === "Nickel" ||
      selectedDefenseFront === "Dime" ||
      selectedDefenseFront === "4-2-5";

    const makeZone = (
      id: string,
      owner: Player | undefined,
      label: string,
      x: number,
      yardsFromGoal: number,
      width: number,
      height: number
    ) =>
      zoneBubble(
        id,
        owner?.position ?? "DEF",
        label,
        clampCoverageX(x),
        yardsFromGoal,
        width,
        height,
        owner?.id
      );

    const pm = patternMatchTargets();
    const matchDeep = LOS_YARDS - 16.25;
    const matchSeam = LOS_YARDS - 11.5;
    const matchFlat = LOS_YARDS - 5.5;
    const matchHook = LOS_YARDS - 8.25;

    const leftCB = () => findDeepCorner("left", usedIds);
    const rightCB = () => findDeepCorner("right", usedIds);
    const fs = (x = 50) => findFreeSafety(usedIds, x);
    const ss = (x = 60, side?: "left" | "right") =>
      findStrongSafety(usedIds, x, side);
    const sam = () =>
      findLinebacker(["SAM", "S", "OLB"], targets.leftCurl, usedIds, "left");
    const will = () =>
      findLinebacker(["WILL", "W", "OLB"], targets.rightCurl, usedIds, "right");
    const mike = () =>
      findLinebacker(["MIKE", "M", "MLB", "LB", "ILB"], 50, usedIds, "middle");
    const leftApex = () =>
      frontIsSub
        ? findNickelOrApex("left", usedIds, targets.leftFlat)
        : findLinebacker(
            ["SAM", "S", "WILL", "W", "OLB", "SS"],
            targets.leftFlat,
            usedIds,
            "left"
          );
    const rightApex = () =>
      frontIsSub
        ? findNickelOrApex("right", usedIds, targets.rightFlat)
        : findLinebacker(
            ["WILL", "W", "SAM", "S", "OLB", "SS"],
            targets.rightFlat,
            usedIds,
            "right"
          );

    if (coverage === "Quarters Match") {
      // Pattern-match quarters: CBs MEG #1, safeties read #2 vertical, apex players relate to #2/#3.
      // Trips gets a weak-safety poach tag instead of forcing static quarter bubbles.
      const leftSafety =
        fs(sideQuarterX("left", 2)) ?? ss(sideQuarterX("left", 2), "left");
      const rightSafety =
        ss(sideQuarterX("right", 2), "right") ?? fs(sideQuarterX("right", 2));
      const leftApexOwner = leftApex();
      const rightApexOwner = rightApex();
      const middleOwner = mike();

      if (pm.tripsSide === "left") {
        return [
          makeZone(
            "qm-l-cb",
            leftCB(),
            matchLabel("left", "CB MEG #1"),
            sideQuarterX("left", 1),
            matchDeep,
            20,
            16
          ),
          makeZone(
            "qm-l-safety",
            leftSafety,
            matchLabel("left", "SAFETY READ #2"),
            sideQuarterX("left", 2),
            matchDeep,
            22,
            16
          ),
          makeZone(
            "qm-l-apex",
            leftApexOwner,
            matchLabel("left", "APEX MATCH #2 OUT"),
            pm.left2,
            matchFlat,
            17,
            9
          ),
          makeZone(
            "qm-l-mike",
            middleOwner,
            "MIKE WALL #3",
            clampCoverageX(pm.left3, 40, 52),
            matchHook,
            16,
            9
          ),
          makeZone(
            "qm-r-safety",
            rightSafety,
            matchLabel("right", "POACH #3"),
            clampCoverageX(pm.left3 + 8, 48, 62),
            matchDeep,
            22,
            16
          ),
          makeZone(
            "qm-r-cb",
            rightCB(),
            matchLabel("right", "CB MEG #1"),
            sideQuarterX("right", 1),
            matchDeep,
            20,
            16
          ),
          makeZone(
            "qm-r-apex",
            rightApexOwner,
            matchLabel("right", "WEAK HOOK"),
            pm.right2,
            matchHook,
            16,
            9
          ),
        ];
      }

      if (pm.tripsSide === "right") {
        return [
          makeZone(
            "qm-l-cb",
            leftCB(),
            matchLabel("left", "CB MEG #1"),
            sideQuarterX("left", 1),
            matchDeep,
            20,
            16
          ),
          makeZone(
            "qm-l-safety",
            leftSafety,
            matchLabel("left", "POACH #3"),
            clampCoverageX(pm.right3 - 8, 38, 52),
            matchDeep,
            22,
            16
          ),
          makeZone(
            "qm-l-apex",
            leftApexOwner,
            matchLabel("left", "WEAK HOOK"),
            pm.left2,
            matchHook,
            16,
            9
          ),
          makeZone(
            "qm-r-safety",
            rightSafety,
            matchLabel("right", "SAFETY READ #2"),
            sideQuarterX("right", 2),
            matchDeep,
            22,
            16
          ),
          makeZone(
            "qm-r-cb",
            rightCB(),
            matchLabel("right", "CB MEG #1"),
            sideQuarterX("right", 1),
            matchDeep,
            20,
            16
          ),
          makeZone(
            "qm-r-apex",
            rightApexOwner,
            matchLabel("right", "APEX MATCH #2 OUT"),
            pm.right2,
            matchFlat,
            17,
            9
          ),
          makeZone(
            "qm-mike",
            middleOwner,
            "MIKE WALL #3",
            clampCoverageX(pm.right3, 48, 60),
            matchHook,
            16,
            9
          ),
        ];
      }

      return [
        makeZone(
          "qm-l-cb",
          leftCB(),
          matchLabel("left", "CB MEG #1"),
          sideQuarterX("left", 1),
          matchDeep,
          20,
          16
        ),
        makeZone(
          "qm-l-safety",
          leftSafety,
          matchLabel("left", "SAFETY READ #2"),
          sideQuarterX("left", 2),
          matchDeep,
          22,
          16
        ),
        makeZone(
          "qm-l-apex",
          leftApexOwner,
          matchLabel("left", "APEX #2 FLAT"),
          pm.left2,
          matchFlat,
          17,
          9
        ),
        makeZone("qm-mike", middleOwner, "MIKE WALL #3", 50, matchHook, 16, 9),
        makeZone(
          "qm-r-apex",
          rightApexOwner,
          matchLabel("right", "APEX #2 FLAT"),
          pm.right2,
          matchFlat,
          17,
          9
        ),
        makeZone(
          "qm-r-safety",
          rightSafety,
          matchLabel("right", "SAFETY READ #2"),
          sideQuarterX("right", 2),
          matchDeep,
          22,
          16
        ),
        makeZone(
          "qm-r-cb",
          rightCB(),
          matchLabel("right", "CB MEG #1"),
          sideQuarterX("right", 1),
          matchDeep,
          20,
          16
        ),
      ];
    }

    if (coverage === "Palms") {
      // Palms / 2-read: corner and safety read #2. If #2 goes out, corner traps flat and safety carries over top.
      const leftSafety = fs(pm.left2) ?? ss(pm.left2, "left");
      const rightSafety = ss(pm.right2, "right") ?? fs(pm.right2);
      return [
        makeZone(
          "palms-l-cb",
          leftCB(),
          matchLabel("left", "CB TRAP #1/#2 OUT"),
          clampCoverageX(pm.left1, 12, 26),
          matchFlat,
          18,
          9
        ),
        makeZone(
          "palms-l-safety",
          leftSafety,
          matchLabel("left", "SAFETY OVER #2"),
          sideQuarterX("left", 2),
          matchDeep,
          24,
          16
        ),
        makeZone(
          "palms-l-apex",
          leftApex(),
          matchLabel("left", "APEX WALL #2"),
          pm.left2,
          matchHook,
          17,
          9
        ),
        makeZone("palms-mike", mike(), "MIKE LOW HOLE", 50, matchHook, 15, 9),
        makeZone(
          "palms-r-apex",
          rightApex(),
          matchLabel("right", "APEX WALL #2"),
          pm.right2,
          matchHook,
          17,
          9
        ),
        makeZone(
          "palms-r-safety",
          rightSafety,
          matchLabel("right", "SAFETY OVER #2"),
          sideQuarterX("right", 2),
          matchDeep,
          24,
          16
        ),
        makeZone(
          "palms-r-cb",
          rightCB(),
          matchLabel("right", "CB TRAP #1/#2 OUT"),
          clampCoverageX(pm.right1, 74, 88),
          matchFlat,
          18,
          9
        ),
      ];
    }

    if (coverage === "Cover 3 Match" || coverage === "Rip/Liz Match") {
      // Match 3: still 3 deep, but seams and #3 are matched instead of spot-dropped.
      const rotateSide = coverage === "Rip/Liz Match" ? pm.strength : null;
      const seamLeftOwner =
        rotateSide === "left" ? ss(pm.left2, "left") ?? leftApex() : leftApex();
      const seamRightOwner =
        rotateSide === "right"
          ? ss(pm.right2, "right") ?? rightApex()
          : rightApex();
      const weakHookOwner =
        pm.weakSide === "left"
          ? findLinebacker(
              ["WILL", "W", "OLB", "LB"],
              pm.left2,
              usedIds,
              "left"
            )
          : findLinebacker(
              ["SAM", "S", "OLB", "LB"],
              pm.right2,
              usedIds,
              "right"
            );
      return [
        makeZone(
          "c3m-l-third",
          leftCB(),
          "CB DEEP 1/3",
          deepTargets.c3Left,
          deep,
          29,
          18
        ),
        makeZone(
          "c3m-post",
          fs(deepTargets.c3Middle),
          coverage === "Rip/Liz Match" ? "POST SAFETY RIP/LIZ" : "POST SAFETY",
          deepTargets.c3Middle,
          deep,
          34,
          18
        ),
        makeZone(
          "c3m-r-third",
          rightCB(),
          "CB DEEP 1/3",
          deepTargets.c3Right,
          deep,
          29,
          18
        ),
        makeZone(
          "c3m-l-seam",
          seamLeftOwner,
          matchLabel("left", "SEAM MATCH #2"),
          pm.left2,
          matchSeam,
          17,
          10
        ),
        makeZone(
          "c3m-mike",
          mike(),
          pm.tripsSide ? "MIKE WALL #3" : "MIKE MATCH #3",
          pm.tripsSide === "left"
            ? clampCoverageX(pm.left3, 40, 54)
            : pm.tripsSide === "right"
            ? clampCoverageX(pm.right3, 46, 60)
            : 50,
          matchHook,
          16,
          9
        ),
        makeZone(
          "c3m-r-seam",
          seamRightOwner,
          matchLabel("right", "SEAM MATCH #2"),
          pm.right2,
          matchSeam,
          17,
          10
        ),
        makeZone(
          "c3m-l-flat",
          pm.weakSide === "left" ? weakHookOwner : leftApex(),
          matchLabel("left", "FLAT / OUT #2"),
          pm.left1,
          matchFlat,
          17,
          9
        ),
        makeZone(
          "c3m-r-flat",
          pm.weakSide === "right" ? weakHookOwner : rightApex(),
          matchLabel("right", "FLAT / OUT #2"),
          pm.right1,
          matchFlat,
          17,
          9
        ),
      ];
    }

    if (coverage === "Cover 2") {
      // True 2-high: safeties own halves, corners are force/flat, backers own hooks.
      const leftSafety = fs(34) ?? ss(34, "left");
      const rightSafety = ss(66, "right") ?? fs(66);
      return [
        makeZone(
          "cov2-left-half",
          leftSafety,
          "DEEP 1/2",
          targets.isTripsLeft ? 34 : 30,
          halfDeep,
          targets.isTripsLeft ? 44 : 38,
          18
        ),
        makeZone(
          "cov2-right-half",
          rightSafety,
          "DEEP 1/2",
          targets.isTripsRight ? 66 : 70,
          halfDeep,
          targets.isTripsRight ? 44 : 38,
          18
        ),
        makeZone(
          "cov2-left-flat",
          leftCB(),
          "CLOUD/FLAT",
          targets.leftFlat,
          flat,
          17,
          9.5
        ),
        makeZone(
          "cov2-right-flat",
          rightCB(),
          "CLOUD/FLAT",
          targets.rightFlat,
          flat,
          17,
          9.5
        ),
        makeZone(
          "cov2-left-hook",
          sam() ?? leftApex(),
          "HOOK/CURL",
          targets.leftCurl,
          curl,
          17,
          10
        ),
        makeZone("cov2-mid-hook", mike(), "MID HOOK", 50, hook, 15, 9),
        makeZone(
          "cov2-right-hook",
          will() ?? rightApex(),
          "HOOK/CURL",
          targets.rightCurl,
          curl,
          17,
          10
        ),
      ];
    }

    if (coverage === "Cover 3") {
      // True spot-drop Cover 3: corners + post safety own deep thirds.
      // Underneath is force/flat + curl/hook + middle hook. 4-3 gets Sam/Mike/Will structure.
      const leftFlatOwner = frontIsFourThree ? sam() : leftApex();
      const rightFlatOwner = frontIsFourThree ? will() : rightApex();
      const middleOwner = mike();
      const strongCurlX =
        strongSide === "left" ? targets.leftSeam : targets.rightSeam;
      const weakCurlX =
        weakSide === "left" ? targets.leftCurl : targets.rightCurl;
      const strongCurlOwner =
        strongSide === "left"
          ? ss(strongCurlX, "left") ?? leftApex()
          : ss(strongCurlX, "right") ?? rightApex();
      const weakCurlOwner =
        weakSide === "left"
          ? findLinebacker(
              ["WILL", "W", "OLB", "LB"],
              weakCurlX,
              usedIds,
              "left"
            )
          : findLinebacker(
              ["SAM", "S", "OLB", "LB"],
              weakCurlX,
              usedIds,
              "right"
            );

      const zones = [
        makeZone(
          "cov3-left-third",
          leftCB(),
          "DEEP 1/3",
          deepTargets.c3Left,
          deep,
          29,
          18
        ),
        makeZone(
          "cov3-middle-third",
          fs(deepTargets.c3Middle),
          "POST 1/3",
          deepTargets.c3Middle,
          deep,
          34,
          18
        ),
        makeZone(
          "cov3-right-third",
          rightCB(),
          "DEEP 1/3",
          deepTargets.c3Right,
          deep,
          29,
          18
        ),
        makeZone(
          "cov3-left-flat",
          leftFlatOwner,
          strongSide === "left" ? "STRONG FLAT" : "WEAK FLAT",
          targets.leftFlat,
          flat,
          16.5,
          9.5
        ),
        makeZone(
          "cov3-left-curl",
          strongSide === "left" ? strongCurlOwner : weakCurlOwner,
          targets.isTripsLeft ? "SEAM/CURL" : "CURL/HASH",
          targets.leftCurl,
          curl,
          17,
          10
        ),
        makeZone("cov3-mid-hook", middleOwner, "MID HOOK", 50, hook, 15, 9),
        makeZone(
          "cov3-right-curl",
          strongSide === "right" ? strongCurlOwner : weakCurlOwner,
          targets.isTripsRight ? "SEAM/CURL" : "CURL/HASH",
          targets.rightCurl,
          curl,
          17,
          10
        ),
        makeZone(
          "cov3-right-flat",
          rightFlatOwner,
          strongSide === "right" ? "STRONG FLAT" : "WEAK FLAT",
          targets.rightFlat,
          flat,
          16.5,
          9.5
        ),
      ];

      // 3-5 has five second-level defenders; show the extra overhang as an honest seam/apex zone.
      if (frontIsThreeFive) {
        const extraApex =
          strongSide === "left"
            ? pickDefenderForCoverage(
                ["OLB", "ILB", "LB"],
                targets.leftSeam,
                usedIds,
                "left"
              )
            : pickDefenderForCoverage(
                ["OLB", "ILB", "LB"],
                targets.rightSeam,
                usedIds,
                "right"
              );
        zones.push(
          makeZone(
            "cov3-extra-apex",
            extraApex,
            "MATCH SEAM",
            strongSide === "left" ? targets.leftSeam : targets.rightSeam,
            LOS_YARDS - 9.5,
            15,
            10
          )
        );
      }

      return zones;
    }

    if (coverage === "Cover 4") {
      // Quarters: CBs own outside quarters, safeties own inside quarters.
      // Underneath defenders relate to No. 2/No. 3, so the bubbles are tied to the formation distribution.
      const leftSafety = fs(deepTargets.q2) ?? ss(deepTargets.q2, "left");
      const rightSafety = ss(deepTargets.q3, "right") ?? fs(deepTargets.q3);
      const leftFlatOwner = leftApex();
      const rightFlatOwner = rightApex();
      const middleOwner = mike();

      return [
        makeZone(
          "cov4-q1",
          leftCB(),
          "OUTSIDE 1/4",
          deepTargets.q1,
          quarterDeep,
          21,
          17
        ),
        makeZone(
          "cov4-q2",
          leftSafety,
          targets.left.length >= 2 ? "READ #2 / 1/4" : "INSIDE 1/4",
          deepTargets.q2,
          quarterDeep,
          22,
          17
        ),
        makeZone(
          "cov4-q3",
          rightSafety,
          targets.right.length >= 2 ? "READ #2 / 1/4" : "INSIDE 1/4",
          deepTargets.q3,
          quarterDeep,
          22,
          17
        ),
        makeZone(
          "cov4-q4",
          rightCB(),
          "OUTSIDE 1/4",
          deepTargets.q4,
          quarterDeep,
          21,
          17
        ),
        makeZone(
          "cov4-flat-l",
          leftFlatOwner,
          targets.left.length >= 2 ? "APEX #2" : "FLAT",
          targets.leftFlat,
          flat,
          17,
          9.5
        ),
        makeZone(
          "cov4-hook-l",
          frontIsFourThree
            ? sam()
            : findLinebacker(
                ["ILB", "LB", "OLB", "S", "W"],
                targets.leftCurl,
                usedIds,
                "left"
              ),
          "HOOK/CURL",
          targets.leftCurl,
          curl,
          16,
          9.5
        ),
        makeZone("cov4-mid-hook", middleOwner, "MID HOOK", 50, hook, 15, 9),
        makeZone(
          "cov4-hook-r",
          frontIsFourThree
            ? will()
            : findLinebacker(
                ["ILB", "LB", "OLB", "M", "S"],
                targets.rightCurl,
                usedIds,
                "right"
              ),
          "HOOK/CURL",
          targets.rightCurl,
          curl,
          16,
          9.5
        ),
        makeZone(
          "cov4-flat-r",
          rightFlatOwner,
          targets.right.length >= 2 ? "APEX #2" : "FLAT",
          targets.rightFlat,
          flat,
          17,
          9.5
        ),
      ];
    }

    if (coverage === "Cover 1" || coverage === "Man Free") {
      return [
        makeZone(
          "cov1-free",
          fs(50),
          "FREE / POST",
          50,
          LOS_YARDS - 16,
          34,
          17
        ),
      ];
    }

    return [];
  }

  const showManCoverageTools = true;
  const coverageBubbles = useMemo<ZoneCoverageBubble[]>(() => [], []);
  const coverageAssignments = useMemo<string[]>(() => [], []);

  // Defensive focus keeps the field artwork/orientation normal, moves the LOS
  // to the 10-yard line, and mirrors only the PLAYER/ROUTE coordinates around
  // that LOS so defensive coaches see defense on the bottom without rotating
  // or stretching the field itself.
  const activeLosYards = coachFocus === "defense" ? 10 : LOS_YARDS;
  const isDefensiveFocusView = coachFocus === "defense";
  const losYardOffset = activeLosYards - LOS_YARDS;
  const clampPlayableYards = (yards: number) =>
    Math.max(0, Math.min(50, yards));

  function displayYardsFromCanonical(canonicalYards: number) {
    return clampPlayableYards(
      isDefensiveFocusView
        ? activeLosYards - (canonicalYards - LOS_YARDS)
        : canonicalYards + losYardOffset
    );
  }

  function canonicalYardsFromDisplay(displayYards: number) {
    return clampPlayableYards(
      isDefensiveFocusView
        ? LOS_YARDS + (activeLosYards - displayYards)
        : displayYards - losYardOffset
    );
  }

  const fieldDisplayYFromYards = (yardsFromGoal: number) =>
    fieldYFromYards(displayYardsFromCanonical(yardsFromGoal));

  const displayPoint = (point: FieldPoint): FieldPoint => ({
    ...point,
    y: fieldYFromYards(displayYardsFromCanonical(yardsFromPercentY(point.y))),
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearActiveTool();
        setShowCoverageOverlay(false);
        setShowPressureOverlay(false);
        setDrawnLines((current) => removeDefensivePackageLines(current));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!fieldFullscreen) {
      setShowFullscreenPlayerPanel(false);
      setShowFullscreenToolsPanel(false);
    }
  }, [fieldFullscreen]);

  const playerPanelContent = (
    <>
      <div>
        <div style={panelHeaderStyle}>Player Panel</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
          {selectedPlayer.position}
        </div>
        <div style={{ color: "#9ca3af", fontSize: 13 }}>
          Edit alignment, responsibilities, and installs.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
        }}
      >
        <SmallButton
          label="Player"
          active={activePanelTab === "player"}
          onClick={() => setActivePanelTab("player")}
        />
        <SmallButton
          label="Routes"
          active={activePanelTab === "routes"}
          onClick={() => setActivePanelTab("routes")}
        />
        <SmallButton
          label="Forms"
          active={activePanelTab === "formations"}
          onClick={() => setActivePanelTab("formations")}
        />
        <SmallButton
          label="Def"
          active={activePanelTab === "defense"}
          onClick={() => setActivePanelTab("defense")}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
        }}
      >
        <SmallButton
          label="Plays"
          active={activePanelTab === "plays"}
          onClick={() => setActivePanelTab("plays")}
        />
      </div>

      {activePanelTab === "player" && (
        <>
          <button
            style={{ ...buttonBase, background: "#dc2626", color: "white" }}
            onClick={() => setOffensePlayers((p) => autoSpaceOffensiveLine(p))}
          >
            Auto Space OL
          </button>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              PLAYER LABEL
            </div>
            <input
              value={selectedPlayer.position}
              onChange={(e) => updateSelectedPlayerLabel(e.target.value)}
              style={{
                width: "100%",
                background: "#090b10",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 16,
                color: "white",
                padding: "12px 14px",
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              PLAYER COLOR
            </div>
            <ColorSwatches
              selectedColor={
                selectedPlayer.color ??
                (selectedSide === "defense" ? "#dc2626" : "#f3f4f6")
              }
              onSelect={updateSelectedPlayerColor}
            />
          </div>
          {selectedSide === "defense" && (
            <button
              style={{
                ...buttonBase,
                background:
                  defensiveReadPlayerIds.includes(selectedPlayer.id)
                    ? "linear-gradient(180deg, #a855f7 0%, #6d28d9 100%)"
                    : "#111827",
                color: "white",
              }}
             onClick={() => {
  const nextReadPlayerIds = defensiveReadPlayerIds.includes(selectedPlayer.id)
  ? defensiveReadPlayerIds.filter((id) => id !== selectedPlayer.id)
  : [...defensiveReadPlayerIds, selectedPlayer.id];

  setDefensiveReadPlayerIds(nextReadPlayerIds);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_READ_KEY",
      defensiveReadPlayerIds: nextReadPlayerIds,
    },
  });
}}
              
            >
              {defensiveReadPlayerIds.includes(selectedPlayer.id)
  ? "Read Key Selected"
  : "Mark as Read Key"}
            </button>
          )}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              MODE
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}
            >
              <SmallButton
                label="Move"
                active={tool === "Move"}
                onClick={toggleMoveTool}
              />
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              DRAW TOOLS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <SmallButton
                label="Solid"
                active={tool === "Draw" && drawingStyle === "solid"}
                onClick={() => toggleDrawTool("solid")}
              />
              <SmallButton
                label="Dotted"
                active={tool === "Draw" && drawingStyle === "dotted"}
                onClick={() => toggleDrawTool("dotted")}
              />
              <SmallButton
                label="Block"
                active={tool === "Draw" && drawingStyle === "block"}
                onClick={() => toggleDrawTool("block")}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                disabled={undoStack.length === 0}
                style={{
                  ...buttonBase,
                  background: undoStack.length ? "#374151" : "#111827",
                  color: "white",
                  padding: "8px 10px",
                  opacity: undoStack.length ? 1 : 0.45,
                }}
                onClick={undoLastAction}
              >
                Undo
              </button>
              <button
                disabled={!selectedFieldItem}
                style={{
                  ...buttonBase,
                  background: selectedFieldItem ? "#7f1111" : "#111827",
                  color: "white",
                  padding: "8px 10px",
                  opacity: selectedFieldItem ? 1 : 0.45,
                }}
                onClick={deleteSelectedFieldItem}
              >
                Delete
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginTop: 10,
                marginBottom: 8,
              }}
            >
              DRAW FEEL
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <SmallButton
                label="Curve"
                active={tool === "Draw" && drawingMode === "curve"}
                onClick={() => toggleDrawMode("curve")}
              />
              <SmallButton
                label="Straight"
                active={tool === "Draw" && drawingMode === "straight"}
                onClick={() => toggleDrawMode("straight")}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginTop: 10,
                marginBottom: 8,
              }}
            >
              COVERAGE DRAW
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <SmallButton
                label="Zone Circle"
                active={tool === "Zone"}
                onClick={toggleZoneTool}
              />
              <SmallButton
                label="Man"
                active={tool === "Man"}
                onClick={toggleManTool}
              />
            </div>
            {tool === "Zone" && selectedSide !== "defense" && (
              <div
                style={{
                  color: "#fca5a5",
                  fontSize: 12,
                  lineHeight: 1.4,
                  marginTop: 8,
                }}
              >
                Select a defender first, then click the field to place that
                defender’s zone circle.
              </div>
            )}
            {(tool === "Zone" || selectedZone) && (
              <div
                style={{
                  marginTop: 10,
                  background: "rgba(255,255,255,.045)",
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 14,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: "#f87171",
                      letterSpacing: ".08em",
                    }}
                  >
                    ZONE SIZE
                  </div>
                  <div
                    style={{ color: "#d1d5db", fontSize: 12, fontWeight: 800 }}
                  >
                    {selectedZone
                      ? `${selectedZone.radius.toFixed(1)}%`
                      : "Select a zone"}
                  </div>
                </div>
                <input
                  type="range"
                  min={2.5}
                  max={18}
                  step={0.5}
                  disabled={!selectedZone}
                  value={selectedZone?.radius ?? 5.8}
                  onChange={(e) =>
                    updateSelectedZoneRadius(Number(e.target.value))
                  }
                  style={{ width: "100%", opacity: selectedZone ? 1 : 0.45 }}
                />
                <div
                  style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.35 }}
                >
                  Click a zone circle to select it. Use the slider or mouse
                  wheel while selected to resize it. Use Delete Selected below
                  if you want to remove the selected zone.
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "center",
              background: "rgba(255,255,255,.045)",
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 14,
              padding: "8px 10px",
            }}
          >
            <div style={{ color: "#d1d5db", fontSize: 12, fontWeight: 800 }}>
              Active Tool:{" "}
              <span
                style={{ color: tool === "Select" ? "#9ca3af" : "#f87171" }}
              >
                {activeToolLabel}
              </span>
            </div>
            <button
              style={{
                ...buttonBase,
                background: "#090b10",
                color: "white",
                padding: "6px 9px",
                fontSize: 12,
              }}
              onClick={clearActiveTool}
            >
              Clear
            </button>
          </div>
          <button
            style={{ ...buttonBase, background: "#7f1111", color: "white" }}
            onClick={() => {
              pushUndoSnapshot();
              setDrawnLines([]);
              setSelectedFieldItem(null);
            }}
          >
            Clear Drawings
          </button>
        </>
      )}

      {activePanelTab === "routes" && (
        <>
          {selectedSide !== "offense" ? (
            <div
              style={{
                color: "#d1d5db",
                background: "#090b10",
                borderRadius: 14,
                padding: 12,
              }}
            >
              Select an offensive player to add or edit a route.
            </div>
          ) : (
            <>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#9ca3af",
                    marginBottom: 8,
                  }}
                >
                  ROUTE TYPE
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      "Go",
                      "Slant",
                      "Out",
                      "In",
                      "Post",
                      "Corner",
                      "Curl",
                      "Comeback",
                    ] as RouteType[]
                  ).map((type) => (
                    <SmallButton
                      key={type}
                      label={type}
                      active={routeType === type}
                      onClick={() => setRouteType(type)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Break Depth</span>
                  <strong>{breakDepth} yds</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={breakDepth}
                  onChange={(e) => setBreakDepth(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Finish Depth</span>
                  <strong>{finishDepth} yds</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={finishDepth}
                  onChange={(e) => setFinishDepth(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,.045)",
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 14,
                  padding: "9px 10px",
                  color: "#d1d5db",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.35,
                }}
              >
                Route color follows the selected player&apos;s icon color.
                Change the player color to change this route color.
              </div>
              <button
                style={{ ...buttonBase, background: "#dc2626", color: "white" }}
                onClick={applyRoute}
              >
                Apply Route
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <button
                  style={{
                    ...buttonBase,
                    background: undoStack.length
                      ? "linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,16,23,.95))"
                      : "rgba(15,23,42,.45)",
                    color: undoStack.length ? "white" : "rgba(255,255,255,.42)",
                    padding: "8px 8px",
                    fontSize: 12,
                    cursor: undoStack.length ? "pointer" : "not-allowed",
                  }}
                  onClick={undoLastAction}
                  disabled={!undoStack.length}
                  title="Undo last route change"
                >
                  Undo
                </button>

                <button
                  style={{
                    ...buttonBase,
                    background:
                      selectedFieldItem?.type === "route"
                        ? "linear-gradient(180deg, #ef4444, #7f1d1d)"
                        : "rgba(127,29,29,.38)",
                    color:
                      selectedFieldItem?.type === "route"
                        ? "white"
                        : "rgba(255,255,255,.45)",
                    padding: "8px 8px",
                    fontSize: 12,
                    cursor:
                      selectedFieldItem?.type === "route"
                        ? "pointer"
                        : "not-allowed",
                  }}
                  onClick={deleteSelectedFieldItem}
                  disabled={selectedFieldItem?.type !== "route"}
                  title="Delete selected route"
                >
                  Delete
                </button>

                <button
                  style={{
                    ...buttonBase,
                    background: routes.length
                      ? "linear-gradient(180deg, #b91c1c, #7f1d1d)"
                      : "rgba(127,29,29,.38)",
                    color: routes.length ? "white" : "rgba(255,255,255,.45)",
                    padding: "8px 8px",
                    fontSize: 12,
                    cursor: routes.length ? "pointer" : "not-allowed",
                  }}
                  onClick={() => {
                    if (!routes.length) return;
                    pushUndoSnapshot();
                    setRoutes([]);
                    if (selectedFieldItem?.type === "route")
                      setSelectedFieldItem(null);
                  }}
                  disabled={!routes.length}
                  title="Clear all routes"
                >
                  Clear Routes
                </button>
              </div>
            </>
          )}
        </>
      )}

      {activePanelTab === "formations" && (
        <>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              OFFENSIVE FORMATIONS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
              }}
            >
              {sortedOffensePresets
                .filter((p) => p.isMain)
                .slice(0, 5)
                .map((preset, index) => (
                  <SmallButton
                    key={preset.id}
                    label={`${index + 1}. ${preset.name}`}
                    onClick={() => loadCustomOffensePreset(preset.id)}
                  />
                ))}
              <select
                value={selectedPresetDropdownId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedPresetDropdownId(id);
                  if (id) loadCustomOffensePreset(id);
                }}
                style={{
                  background: "#090b10",
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "10px 8px",
                  fontWeight: 700,
                }}
              >
                <option value="">More...</option>
                {sortedOffensePresets
                  .filter((p) => !p.isMain)
                  .map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              DEFENSIVE SETS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {footballTeamSize === "11man" ? (
                DEFENSIVE_FRONTS_11.map((front) => (
                  <SmallButton
                    key={front}
                    label={front}
                    active={selectedDefenseFront === front}
                    onClick={() => loadDefensePreset(front)}
                  />
                ))
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>
                  Defensive formation presets are currently built for 11-man.
                  You can still move defenders manually and save packages.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activePanelTab === "defense" && (
        <>
          {footballTeamSize === "11man" ? (
            <>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#9ca3af",
                    marginBottom: 8,
                  }}
                >
                  DEFENSIVE FRONTS
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {DEFENSIVE_FRONTS_11.map((p) => (
                    <SmallButton
                      key={p}
                      label={p}
                      active={selectedDefenseFront === p}
                      onClick={() => loadDefensePreset(p)}
                    />
                  ))}
                </div>
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}
              >
                <button
                  style={{
                    ...buttonBase,
                    background: "#090b10",
                    color: "white",
                    padding: "8px 10px",
                  }}
                  onClick={() => {
                    setManAssignments({});
                    setZoneAssignments([]);
                  }}
                >
                  Clear Coverage
                </button>
              </div>
              <div
                style={{
                  background: "rgba(220,38,38,.08)",
                  border: "1px solid rgba(248,113,113,.18)",
                  borderRadius: 14,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#f87171",
                    letterSpacing: ".08em",
                  }}
                >
                  DEFENSIVE PACKAGE
                </div>
                <div style={{ color: "#d1d5db", fontSize: 12 }}>
                  Current front:{" "}
                  <strong style={{ color: "white" }}>
                    {selectedDefenseFront}
                  </strong>{" "}
                  · Coverage/blitzes are coach-built from drawings and matchups.
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                  }}
                >
                  <input
                    value={defensivePackageName}
                    onChange={(e) => setDefensivePackageName(e.target.value)}
                    placeholder="Example: Bear Strong Roll / Friday 3rd Down"
                    style={{
                      width: "100%",
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                      color: "white",
                      padding: "10px 12px",
                    }}
                  />
                  <button
                    style={{
                      ...buttonBase,
                      background: "#dc2626",
                      color: "white",
                    }}
                    onClick={saveDefensivePackage}
                  >
                    Save
                  </button>
                </div>
                {savedDefensivePackages.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    {savedDefensivePackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <button
                          style={{
                            ...buttonBase,
                            background: "#090b10",
                            color: "white",
                            textAlign: "left",
                            padding: "8px 10px",
                          }}
                          onClick={() => loadDefensivePackage(pkg.id)}
                        >
                          {pkg.name}
                        </button>
                        <button
                          style={{
                            ...buttonBase,
                            background: "#374151",
                            color: "white",
                            padding: "8px",
                          }}
                          onClick={() => overwriteDefensivePackage(pkg.id)}
                        >
                          Update
                        </button>
                        <button
                          style={{
                            ...buttonBase,
                            background: "#7f1111",
                            color: "white",
                            padding: "8px",
                          }}
                          onClick={() => deleteDefensivePackage(pkg.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                color: "#d1d5db",
                background: "#090b10",
                borderRadius: 14,
                padding: 12,
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              System defensive fronts and packages are hidden for{" "}
              {FOOTBALL_TEAM_SIZE_OPTIONS[footballTeamSize].label}. Build and
              save your own defensive looks for this team size.
            </div>
          )}
          {selectedSide === "defense" ? (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#9ca3af",
                  marginBottom: 8,
                }}
              >
                DEFENDER TECHNIQUE
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 8,
                }}
              >
                {(
                  [
                    "0",
                    "1",
                    "2i",
                    "2",
                    "3",
                    "4i",
                    "4",
                    "5",
                    "6i",
                    "6",
                    "7",
                    "9",
                  ] as Technique[]
                ).map((tech) => (
                  <SmallButton
                    key={tech}
                    label={tech}
                    onClick={() => applyTechnique(tech)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "#d1d5db",
                background: "#090b10",
                borderRadius: 14,
                padding: 12,
              }}
            >
              Select a defender to apply technique alignment.
            </div>
          )}
        </>
      )}

      {activePanelTab === "plays" && (
        <>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              PLAYS
            </div>
            <select
              value={selectedPlayId}
              onChange={(e) => loadPlay(e.target.value)}
              style={{
                width: "100%",
                background: "#090b10",
                color: "white",
                border: "none",
                borderRadius: 14,
                padding: "10px 8px",
                fontWeight: 700,
              }}
            >
              <option value="">No saved play / formations only</option>
              {savedPlays.map((play) => (
                <option key={play.id} value={play.id}>
                  {play.preloadOnOpen ? "★ " : ""}
                  {play.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Create or manage saved plays from the Tools section.
          </div>
        </>
      )}
    </>
  );

  useEffect(() => {
    function updateFieldSize() {
      if (fieldRef.current) {
        setFieldPixelHeight(fieldRef.current.offsetHeight);
        setFieldPixelWidth(fieldRef.current.offsetWidth);
      }
    }

    updateFieldSize();
    window.addEventListener("resize", updateFieldSize);
    return () => window.removeEventListener("resize", updateFieldSize);
  }, [fieldFullscreen]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "coachboard_custom_offense_presets"
    );
    if (!saved) {
      setCustomOffensePresets(makeDefaultOffensePresets(footballTeamSize));
      return;
    }
    try {
      const parsed = JSON.parse(saved) as CustomOffensePreset[];
      const systemPresets = makeDefaultOffensePresets(footballTeamSize);
      const userPresets = Array.isArray(parsed)
        ? parsed
            .filter((p) => !p.id.startsWith("default-"))
            .map((p) => ({
              ...p,
              isSystem: false,
              players: normalizeOffenseOnLOS(p.players),
            }))
        : [];
      setCustomOffensePresets([...systemPresets, ...userPresets]);
    } catch {
      setCustomOffensePresets(makeDefaultOffensePresets(footballTeamSize));
    }
  }, [footballTeamSize]);

  useEffect(() => {
    const userOnly = customOffensePresets.filter((preset) => !preset.isSystem);
    window.localStorage.setItem(
      "coachboard_custom_offense_presets",
      JSON.stringify(userOnly)
    );
  }, [customOffensePresets]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_saved_plays");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as SavedPlay[];
      if (!Array.isArray(parsed)) return;
      setSavedPlays(parsed);

      const preload = parsed.find((play) => play.preloadOnOpen);
      if (preload) {
        setOffensePlayers(normalizeOffenseOnLOS(preload.offensePlayers));
        applyDefensePlayers(preload.defensePlayers.map((p) => ({ ...p })));
        setRoutes(preload.routes.map((r) => ({ ...r })));
        setDrawnLines(
          preload.drawnLines.map((line) => ({
            ...line,
            points: line.points.map((point) => ({ ...point })),
          }))
        );
        setSelectedPlayId(preload.id);
        setSelectedPlayFormationId(preload.formationId ?? "");
      }
    } catch {
      setSavedPlays([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_saved_plays",
      JSON.stringify(savedPlays)
    );
  }, [savedPlays]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_playbooks");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Playbook[];
      if (Array.isArray(parsed)) setPlaybooks(parsed);
    } catch {
      setPlaybooks([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_playbooks",
      JSON.stringify(playbooks)
    );
  }, [playbooks]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_play_concepts");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as PlayConcept[];
      if (Array.isArray(parsed)) setPlayConcepts(parsed);
    } catch {
      setPlayConcepts([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_play_concepts",
      JSON.stringify(playConcepts)
    );
  }, [playConcepts]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_game_plans");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as GamePlan[];
      if (Array.isArray(parsed)) setGamePlans(parsed);
    } catch {
      setGamePlans([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_game_plans",
      JSON.stringify(gamePlans)
    );
  }, [gamePlans]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_defensive_packages");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as DefensivePackage[];
      if (Array.isArray(parsed)) setSavedDefensivePackages(parsed);
    } catch {
      setSavedDefensivePackages([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_defensive_packages",
      JSON.stringify(savedDefensivePackages)
    );
  }, [savedDefensivePackages]);

  useEffect(() => {
    const saved = window.localStorage.getItem("coachboard_team_branding");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as TeamBranding;
      const savedSchool = (parsed.schoolName ?? "").toUpperCase();
      const savedMascot = (parsed.mascot ?? "").toUpperCase();

      // This clears the old built-in Hershey/Panthers default from earlier test versions.
      // Coaches can still customize their own team later in Team Setup.
      if (savedSchool === "HERSHEY" || savedMascot === "PANTHERS") {
        window.localStorage.removeItem("coachboard_team_branding");
        setTeamBranding(DEFAULT_TEAM_BRANDING);
        return;
      }

      setTeamBranding({
        ...DEFAULT_TEAM_BRANDING,
        ...parsed,
      });
    } catch {
      setTeamBranding(DEFAULT_TEAM_BRANDING);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_team_branding",
      JSON.stringify(teamBranding)
    );
  }, [teamBranding]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "coachboard_field_template"
    ) as FieldTemplate | null;

    if (saved && FIELD_HASH_PRESETS[saved]) {
      setFieldTemplate(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("coachboard_field_template", fieldTemplate);
  }, [fieldTemplate]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "coachboard_coach_focus"
    ) as CoachFocus | null;

    if (saved && COACH_FOCUS_OPTIONS[saved]) {
      applyCoachFocus(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("coachboard_coach_focus", coachFocus);
  }, [coachFocus]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      "coachboard_football_team_size"
    ) as FootballTeamSize | null;

    if (saved && FOOTBALL_TEAM_SIZE_OPTIONS[saved]) {
      setFootballTeamSize(saved);
      setOffensePlayers(getDefaultOffensePlayers(saved));
      applyDefensePlayers(getDefaultDefensePlayers(saved));
      setSelectedPlayerId(getDefaultOffensePlayers(saved)[0]?.id ?? "x");
      setSelectedSide("offense");
      setSelectedPlayId("");
      setSelectedPlayFormationId("");
      setRoutes([]);
      setDrawnLines([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "coachboard_football_team_size",
      footballTeamSize
    );
  }, [footballTeamSize]);

  function applyCoachFocus(nextFocus: CoachFocus) {
    setCoachFocus(nextFocus);

    realtimeChannelRef.current?.send({
  type: "broadcast",
  event: "board-event",
  payload: {
    type: "SET_COACH_FOCUS",
    coachFocus: nextFocus,
  },
});
    
    if (nextFocus === "defense") {
      const firstDefender =
        defensePlayers[0]?.id ??
        getDefaultDefensePlayers(footballTeamSize)[0]?.id ??
        "d1";
      setSelectedSide("defense");
      setSelectedPlayerId(firstDefender);
      setActivePanelTab("defense");
    } else if (nextFocus === "offense") {
      const firstOffender =
        offensePlayers[0]?.id ??
        getDefaultOffensePlayers(footballTeamSize)[0]?.id ??
        "x";
      setSelectedSide("offense");
      setSelectedPlayerId(firstOffender);
      setActivePanelTab("player");
    } else {
      setActivePanelTab("player");
    }
  }

  function applyFootballTeamSize(nextSize: FootballTeamSize) {
  const nextOffense = getDefaultOffensePlayers(nextSize);
  const nextDefense = getDefaultDefensePlayers(nextSize);
  const nextSelectedPlayerId =
    coachFocus === "defense"
      ? nextDefense[0]?.id ?? "d1"
      : nextOffense[0]?.id ?? "x";
  const nextSelectedSide = coachFocus === "defense" ? "defense" : "offense";
  const nextActivePanelTab = coachFocus === "defense" ? "defense" : "player";

  setFootballTeamSize(nextSize);
  setOffensePlayers(nextOffense);
  setDefensePlayers(nextDefense);
  setSelectedPlayerId(nextSelectedPlayerId);
  setSelectedSide(nextSelectedSide);
  setActivePanelTab(nextActivePanelTab);
  setSelectedPlayId("");
  setSelectedPlayFormationId("");
  setRoutes([]);
  setDrawnLines([]);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_TEAM_SETUP",
      footballTeamSize: nextSize,
      offensePlayers: nextOffense,
      defensePlayers: nextDefense,
      selectedPlayerId: nextSelectedPlayerId,
      selectedSide: nextSelectedSide,
      activePanelTab: nextActivePanelTab,
      routes: [],
      drawnLines: [],
    },
  });
}

  const losTop = `${fieldYFromYards(activeLosYards)}%`;

  // Field orientation stays normal. In Defensive Focus, only the players flip
  // around the active LOS: offense is above the LOS, defense is below it.
  const offenseOnLOSTop = isDefensiveFocusView
    ? `calc(${fieldYFromYards(activeLosYards)}% - ${playerPx / 2}px)`
    : `calc(${fieldYFromYards(activeLosYards)}% + ${playerPx / 2}px)`;

  const defenseOnLOSTop = isDefensiveFocusView
    ? `calc(${fieldYFromYards(clampPlayableYards(activeLosYards + 1))}% + ${
        playerPx / 2
      }px)`
    : `calc(${fieldYFromYards(clampPlayableYards(activeLosYards - 1))}% - ${
        playerPx / 2
      }px)`;

  const playerHalfPct =
    fieldPixelHeight > 0 ? (playerPx / 2 / fieldPixelHeight) * 100 : 0;

  function fieldPointFromClient(
    clientX: number,
    clientY: number
  ): FieldPoint | null {
    if (!fieldRef.current) return null;
    const rect = fieldRef.current.getBoundingClientRect();
    const screenY = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100)
    );
    const screenYards = yardsFromPercentY(screenY);
    const canonicalYards = canonicalYardsFromDisplay(screenYards);
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: fieldYFromYards(canonicalYards),
    };
  }

  function screenPointFromClient(
    clientX: number,
    clientY: number
  ): FieldPoint | null {
    if (!fieldRef.current) return null;
    const rect = fieldRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function visiblePlayerPoint(player: Player): FieldPoint {
    if (player.onLOS && player.side === "offense") {
      return {
        x: player.x,
        y: isDefensiveFocusView
          ? fieldYFromYards(activeLosYards) - playerHalfPct
          : fieldYFromYards(activeLosYards) + playerHalfPct,
      };
    }

    if (player.onLOS && player.side === "defense") {
      return {
        x: player.x,
        y: isDefensiveFocusView
          ? fieldYFromYards(clampPlayableYards(activeLosYards + 1)) +
            playerHalfPct
          : fieldYFromYards(clampPlayableYards(activeLosYards - 1)) -
            playerHalfPct,
      };
    }

    return {
      x: player.x,
      y: fieldDisplayYFromYards(player.yardsFromGoal),
    };
  }

  function playerTop(player: Player) {
    if (player.onLOS && player.side === "offense") return offenseOnLOSTop;
    if (player.onLOS && player.side === "defense") return defenseOnLOSTop;
    return `${fieldDisplayYFromYards(player.yardsFromGoal)}%`;
  }

  function closestPlayerTo(
    point: FieldPoint,
    max = 5.5
  ): { point: FieldPoint; distance: number; player: Player } | null {
    let closest: {
      point: FieldPoint;
      distance: number;
      player: Player;
    } | null = null;

    for (const player of [...offensePlayers, ...defensePlayers]) {
      const playerPoint = visiblePlayerPoint(player);
      const distance = Math.hypot(
        playerPoint.x - point.x,
        playerPoint.y - point.y
      );

      if (distance <= max && (!closest || distance < closest.distance)) {
        closest = { point: playerPoint, distance, player };
      }
    }

    return closest;
  }

  function startDrawing(clientX: number, clientY: number) {
    const point = fieldPointFromClient(clientX, clientY);
    if (!point) return;

    // Snap the start of every drawn line to the closest player when the coach
    // begins drawing near a player. This works for solid, dotted, and block lines.
    const closestPlayerMatch = closestPlayerTo(point, 5.5);
    const snappedStart = closestPlayerMatch ? closestPlayerMatch.point : point;
    const drawingPlayer = closestPlayerMatch
      ? closestPlayerMatch.player
      : selectedPlayer;
    const drawingColor =
      drawingPlayer?.color ??
      (drawingPlayer?.side === "defense" ? "#dc2626" : "#f3f4f6");

    pushUndoSnapshot();
    setSelectedFieldItem(null);

    const id = crypto.randomUUID();
    setDrawnLines((lines) => [
      ...lines,
      {
        id,
        style: drawingStyle,
        mode: drawingMode,
        points: [snappedStart],
        playerId: drawingPlayer?.id,
        color: drawingColor,
      },
    ]);
    setActiveLineId(id);
  }

  function startZoneCircle(clientX: number, clientY: number) {
    const point = screenPointFromClient(clientX, clientY);
    if (!point) return;

    const selectedDefender =
      selectedSide === "defense"
        ? defensePlayers.find((player) => player.id === selectedPlayerId)
        : defensePlayers.find((player) => player.id === manAssignDefenderId) ??
          defensePlayers[0];

    if (!selectedDefender) return;

    pushUndoSnapshot();

    const zoneId = crypto.randomUUID();
    setSelectedFieldItem({ type: "zone", id: zoneId });
    const nextZones = [
  ...zoneAssignments,
  {
    id: zoneId,
    defenderId: selectedDefender.id,
    x: point.x,
    y: point.y,
    radius: 1.2,
  },
];

setZoneAssignments(nextZones);

realtimeChannelRef.current?.send({
  type: "broadcast",
  event: "board-event",
  payload: {
    type: "SET_ZONES",
    zoneAssignments: nextZones,
  },
});
    setSelectedZoneId(zoneId);
    setZoneDraftId(zoneId);
  }

  function updateZoneDraft(clientX: number, clientY: number) {
    if (!zoneDraftId) return;
    const point = screenPointFromClient(clientX, clientY);
    if (!point) return;

    const nextZones = zoneAssignments.map((zone) => {
  if (zone.id !== zoneDraftId) return zone;

  const nextRadius = Math.hypot(point.x - zone.x, point.y - zone.y);

  return {
    ...zone,
    radius: Math.max(2.5, Math.min(22, nextRadius)),
  };
});

setZoneAssignments(nextZones);

realtimeChannelRef.current?.send({
  type: "broadcast",
  event: "board-event",
  payload: {
    type: "SET_ZONES",
    zoneAssignments: nextZones,
  },
});
  }

  function finalizeZoneDraft() {
    if (!zoneDraftId) return;
    setZoneDraftId(null);
  }

  function startZoneDrag(
    zone: CustomZoneAssignment,
    clientX: number,
    clientY: number
  ) {
    const point = screenPointFromClient(clientX, clientY);
    if (!point) return;

    pushUndoSnapshot();
    setSelectedZoneId(zone.id);
    setSelectedFieldItem({ type: "zone", id: zone.id });
    setZoneDraftId(null);
    setZoneDrag({
      id: zone.id,
      offsetX: zone.x - point.x,
      offsetY: zone.y - point.y,
    });
  }

  function updateZoneDrag(clientX: number, clientY: number) {
    if (!zoneDrag) return;
    const point = screenPointFromClient(clientX, clientY);
    if (!point) return;

    setZoneAssignments((current) =>
      current.map((zone) => {
        if (zone.id !== zoneDrag.id) return zone;
        return {
          ...zone,
          x: Math.max(0, Math.min(100, point.x + zoneDrag.offsetX)),
          y: Math.max(0, Math.min(100, point.y + zoneDrag.offsetY)),
        };
      })
    );
  }

  function finalizeZoneDrag() {
    if (!zoneDrag) return;
    setZoneDrag(null);
  }

  function updateDrawing(clientX: number, clientY: number) {
    if (!activeLineId) return;
    const point = fieldPointFromClient(clientX, clientY);
    if (!point) return;

    setDrawnLines((lines) =>
      lines.map((line) => {
        if (line.id !== activeLineId) return line;

        const last = line.points[line.points.length - 1];

        // Block lines need extra control because the T-cap can feel jumpy.
        // Very small movement increments let the coach aim the T-end more precisely.
        const minPointDistance = 0.65;

        if (Math.hypot(point.x - last.x, point.y - last.y) < minPointDistance)
          return line;

        return { ...line, points: [...line.points, point] };
      })
    );
  }

function finalizeDrawing() {
  if (!activeLineId) return;

  const lineToFinish = drawnLines.find((line) => line.id === activeLineId);
  if (!lineToFinish) return;

  const cleanup =
    lineToFinish.mode === "curve" ? cleanCurvedDrawnPoints : cleanDrawnPoints;

  const finishedLine: DrawLine = {
    ...lineToFinish,
    points: cleanup(lineToFinish.points),
  };

  const nextLines = drawnLines.map((line) =>
    line.id === activeLineId ? finishedLine : line
  );

  setDrawnLines(nextLines);

  if (realtimeChannelRef.current) {
    realtimeChannelRef.current.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_DRAWN_LINES",
        drawnLines: nextLines,
      },
    });
  }

  setActiveLineId(null);
}

  function enforceLegalOffenseFormation(players: Player[]) {
    let updated = players.map((p) => ({ ...p }));

    // 1) Offensive line must stay on the LOS.
    updated = updated.map((p) =>
      offenseMustBeOnLOS(p)
        ? { ...p, yardsFromGoal: OFFENSE_ON_LOS_YARDS, onLOS: true }
        : p
    );

    // 2) Nobody on offense can cross onto the defensive side of the LOS.
    updated = updated.map((p) => {
      if (p.onLOS) return { ...p, yardsFromGoal: OFFENSE_ON_LOS_YARDS };
      return {
        ...p,
        yardsFromGoal: Math.max(
          p.yardsFromGoal,
          OFFENSE_ON_LOS_YARDS + BACKFIELD_MIN_DEPTH
        ),
      };
    });

    // 3) Full formation legality: at least 7 on the LOS = no more than 4 in the backfield.
    // If there are too many in the backfield, move the closest eligible players onto the LOS.
    const backfieldPlayers = updated.filter((p) => !p.onLOS);
    if (backfieldPlayers.length > MAX_OFFENSE_BACKFIELD) {
      const needToMoveOnLOS = backfieldPlayers.length - MAX_OFFENSE_BACKFIELD;
      const candidates = backfieldPlayers
        .filter((p) => offenseCanBeOnLOS(p))
        .sort(
          (a, b) =>
            Math.abs(a.yardsFromGoal - OFFENSE_ON_LOS_YARDS) -
            Math.abs(b.yardsFromGoal - OFFENSE_ON_LOS_YARDS)
        )
        .slice(0, needToMoveOnLOS)
        .map((p) => p.id);

      updated = updated.map((p) =>
        candidates.includes(p.id)
          ? { ...p, yardsFromGoal: OFFENSE_ON_LOS_YARDS, onLOS: true }
          : p
      );
    }

    return updated;
  }

  function updateDraggedPlayer(clientX: number, clientY: number) {
    if (!fieldRef.current || !draggingId || !draggingSide) return;

    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(
      4,
      Math.min(96, ((clientX - rect.left) / rect.width) * 100)
    );
    const screenPercentY = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100)
    );
    const rawYards = canonicalYardsFromDisplay(
      yardsFromPercentY(screenPercentY)
    );

    if (draggingSide === "offense") {
      setOffensePlayers((players) => {
  const moved = players.map((p) => {
    if (p.id !== draggingId) return p;

    const canAlignOnLOS = offenseCanBeOnLOS(p);
    const nextOnLOS =
      canAlignOnLOS && Math.abs(rawYards - LOS_YARDS) < 2.6;

    const nextYards = nextOnLOS ? OFFENSE_ON_LOS_YARDS : rawYards;

    return { ...p, x, yardsFromGoal: nextYards, onLOS: nextOnLOS };
  });

  const nextPlayers = enforceLegalOffenseFormation(moved);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_OFFENSE_PLAYERS",
      offensePlayers: nextPlayers,
    },
  });

  return nextPlayers;
});
    }

    if (draggingSide === "defense") {
setDefensePlayers((players) => {
      const nextPlayers = players.map((p) =>
    p.id === draggingId
      ? {
          ...p,
          x,
          yardsFromGoal: rawYards,
          onLOS: Math.abs(rawYards - LOS_YARDS) < 2.2,
        }
      : p
  );

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DEFENSE_PLAYERS",
      defensePlayers: nextPlayers,
    },
  });

  return nextPlayers;
});
    }
  }

  function applyRoute() {
    if (selectedSide !== "offense") return;
    pushUndoSnapshot();
    setSelectedFieldItem({ type: "route", id: selectedPlayer.id });
   const nextRoutes = [
  ...routes.filter((r) => r.playerId !== selectedPlayer.id),
  {
    playerId: selectedPlayer.id,
    routeType,
    breakDepth,
    finishDepth,
    color: selectedPlayer.color ?? "#facc15",
  },
];

setRoutes(nextRoutes);

realtimeChannelRef.current?.send({
  type: "broadcast",
  event: "board-event",
  payload: {
    type: "SET_ROUTES",
    routes: nextRoutes,
  },
});
  }

  function updateSelectedPlayerLabel(value: string) {
    const label = value.toUpperCase();
    if (selectedSide === "offense")
      setOffensePlayers((players) =>
        players.map((p) =>
          p.id === selectedPlayerId ? { ...p, position: label } : p
        )
      );
    else
      setDefensePlayers((players) =>
        players.map((p) =>
          p.id === selectedPlayerId ? { ...p, position: label } : p
        )
      );
  }

  function updateSelectedPlayerColor(color: string) {
  if (selectedSide === "offense") {
    const nextPlayers = offensePlayers.map((p) =>
      p.id === selectedPlayerId ? { ...p, color } : p
    );

    setOffensePlayers(nextPlayers);

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_OFFENSE_PLAYERS",
        offensePlayers: nextPlayers,
      },
    });
  } else {
    const nextPlayers = defensePlayers.map((p) =>
      p.id === selectedPlayerId ? { ...p, color } : p
    );

    applyDefensePlayers(nextPlayers);

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_DEFENSE_PLAYERS",
        defensePlayers: nextPlayers,
      },
    });
  }
}

  function applyTechnique(tech: Technique) {
  if (selectedSide !== "defense") return;

  const nextPlayers = defensePlayers.map((p) =>
    p.id === selectedPlayerId
      ? {
          ...p,
          x: getTechniqueX(tech, p.x),
          yardsFromGoal: LOS_YARDS - 1,
          onLOS: true,
        }
      : p
  );

  setDefensePlayers(nextPlayers);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DEFENSE_PLAYERS",
      defensePlayers: nextPlayers,
    },
  });
}

  function makeD(
    id: string,
    position: string,
    x: number,
    y: number,
    onLOS = false
  ): Player {
    return {
      id,
      position,
      side: "defense",
      x,
      yardsFromGoal: Math.max(0, Math.min(50, y)),
      onLOS,
    };
  }

  function applyDefensePlayers(nextPlayers: Player[]) {
  setDefensePlayers(nextPlayers);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DEFENSE_PLAYERS",
      defensePlayers: nextPlayers,
    },
  });
}
  
  function loadDefensePreset(preset: DefensePreset) {
    if (footballTeamSize !== "11man") return;
    setSelectedDefenseFront(preset);
    if (preset === "4-3 Over")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "SS", 74, LOS_YARDS - 8),
        makeD("d4", "CB", 90, LOS_YARDS - 7),
        makeD("d5", "S", 34, LOS_YARDS - 4.5),
        makeD("d6", "M", 54, LOS_YARDS - 4.5),
        makeD("d7", "W", 70, LOS_YARDS - 4.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
    if (preset === "4-3 Under")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "SS", 30, LOS_YARDS - 8),
        makeD("d4", "CB", 90, LOS_YARDS - 7),
        makeD("d5", "S", 70, LOS_YARDS - 4.5),
        makeD("d6", "M", 54, LOS_YARDS - 4.5),
        makeD("d7", "W", 34, LOS_YARDS - 4.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
    if (preset === "3-4 Base")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "SS", 74, LOS_YARDS - 8),
        makeD("d4", "CB", 90, LOS_YARDS - 7),
        makeD("d5", "OLB", 36, LOS_YARDS - 4),
        makeD("d6", "ILB", 48, LOS_YARDS - 4.5),
        makeD("d7", "ILB", 60, LOS_YARDS - 4.5),
        makeD("d8", "OLB", 72, LOS_YARDS - 4),
        makeD("d9", "DE", 47, LOS_YARDS - 1, true),
        makeD("d10", "N", 54, LOS_YARDS - 1, true),
        makeD("d11", "DE", 61, LOS_YARDS - 1, true),
      ]);
    if (preset === "4-2-5")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "SS", 66, LOS_YARDS - 8),
        makeD("d4", "NICK", 80, LOS_YARDS - 6),
        makeD("d5", "CB", 90, LOS_YARDS - 7),
        makeD("d6", "LB", 48, LOS_YARDS - 4.5),
        makeD("d7", "LB", 60, LOS_YARDS - 4.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
    if (preset === "3-3 Stack")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "SS", 74, LOS_YARDS - 8),
        makeD("d4", "CB", 90, LOS_YARDS - 7),
        makeD("d5", "OLB", 47, LOS_YARDS - 4.5),
        makeD("d6", "M", 54, LOS_YARDS - 4.5),
        makeD("d7", "OLB", 61, LOS_YARDS - 4.5),
        makeD("d8", "DE", 47, LOS_YARDS - 1, true),
        makeD("d9", "N", 54, LOS_YARDS - 1, true),
        makeD("d10", "DE", 61, LOS_YARDS - 1, true),
        makeD("d11", "ROV", 30, LOS_YARDS - 6),
      ]);
    if (preset === "Bear")
      applyDefensePlayers([
        // Bear = 5-man front + 3 linebackers + 3 defensive backs.
        // This keeps both edges on the LOS instead of accidentally leaving the front short.
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "CB", 90, LOS_YARDS - 7),
        makeD("d4", "DE", 65, LOS_YARDS - 1, true),
        makeD("d5", "S", 38, LOS_YARDS - 4.5),
        makeD("d6", "M", 54, LOS_YARDS - 5),
        makeD("d7", "W", 70, LOS_YARDS - 4.5),
        makeD("d8", "DE", 43, LOS_YARDS - 1, true),
        makeD("d9", "DT", 49, LOS_YARDS - 1, true),
        makeD("d10", "N", 54, LOS_YARDS - 1, true),
        makeD("d11", "DT", 59, LOS_YARDS - 1, true),
      ]);
    if (preset === "3-5")
      applyDefensePlayers([
        // 3-5 = 3 down linemen + 5 linebackers + 3 defensive backs.
        // The previous version only had two true down linemen; this restores the full 3-man front.
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 50, LOS_YARDS - 12),
        makeD("d3", "CB", 90, LOS_YARDS - 7),
        makeD("d4", "OLB", 34, LOS_YARDS - 4.5),
        makeD("d5", "ILB", 44, LOS_YARDS - 4.5),
        makeD("d6", "M", 54, LOS_YARDS - 5),
        makeD("d7", "ILB", 64, LOS_YARDS - 4.5),
        makeD("d8", "OLB", 74, LOS_YARDS - 4.5),
        makeD("d9", "DE", 47, LOS_YARDS - 1, true),
        makeD("d10", "N", 54, LOS_YARDS - 1, true),
        makeD("d11", "DE", 61, LOS_YARDS - 1, true),
      ]);
    if (preset === "Nickel")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 42, LOS_YARDS - 12),
        makeD("d3", "SS", 62, LOS_YARDS - 12),
        makeD("d4", "NICK", 78, LOS_YARDS - 6),
        makeD("d5", "CB", 90, LOS_YARDS - 7),
        makeD("d6", "LB", 48, LOS_YARDS - 4.5),
        makeD("d7", "LB", 60, LOS_YARDS - 4.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
    if (preset === "Dime")
      applyDefensePlayers([
        makeD("d1", "CB", 10, LOS_YARDS - 7),
        makeD("d2", "FS", 42, LOS_YARDS - 12),
        makeD("d3", "SS", 62, LOS_YARDS - 12),
        makeD("d4", "NB", 32, LOS_YARDS - 7),
        makeD("d5", "NB", 76, LOS_YARDS - 7),
        makeD("d6", "CB", 90, LOS_YARDS - 7),
        makeD("d7", "LB", 54, LOS_YARDS - 4.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
    if (preset === "Goal Line")
      applyDefensePlayers([
        makeD("d1", "CB", 20, LOS_YARDS - 4),
        makeD("d2", "S", 50, LOS_YARDS - 7),
        makeD("d3", "CB", 80, LOS_YARDS - 4),
        makeD("d4", "LB", 40, LOS_YARDS - 3.5),
        makeD("d5", "LB", 48, LOS_YARDS - 3.5),
        makeD("d6", "LB", 60, LOS_YARDS - 3.5),
        makeD("d7", "LB", 68, LOS_YARDS - 3.5),
        makeD("d8", "DE", 45, LOS_YARDS - 1, true),
        makeD("d9", "DT", 50, LOS_YARDS - 1, true),
        makeD("d10", "DT", 58, LOS_YARDS - 1, true),
        makeD("d11", "DE", 63, LOS_YARDS - 1, true),
      ]);
  }

  function attachManCoverage() {
  if (!manAssignDefenderId || !manAssignOffenseId) return;

  pushUndoSnapshot();

  const nextAssignments = {
    ...manAssignments,
    [manAssignDefenderId]: manAssignOffenseId,
  };

  setManAssignments(nextAssignments);
   console.log("SENDING MAN ASSIGNMENT:", nextAssignments); 
  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_MAN_ASSIGNMENTS",
      manAssignments: nextAssignments,
    },
  });
}

  function clearManCoverage(defenderId: string) {
  pushUndoSnapshot();

  const nextAssignments = { ...manAssignments };

  delete nextAssignments[defenderId];

  setManAssignments(nextAssignments);

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_MAN_ASSIGNMENTS",
      manAssignments: nextAssignments,
    },
  });
}

  function applyDefensiveCoverage(coverage: DefensiveCoveragePreset) {
    const isSameVisibleCoverage =
      showCoverageOverlay && selectedDefensiveCoverage === coverage;
    if (isSameVisibleCoverage) {
      setShowCoverageOverlay(false);
      if (
        coverage === "Cover 0" ||
        coverage === "Cover 1" ||
        coverage === "Man Free"
      ) {
        setManAssignments({});
      }
      return;
    }

    setSelectedDefensiveCoverage(coverage);
    setShowCoverageOverlay(true);
    if (
      !(
        coverage === "Cover 0" ||
        coverage === "Cover 1" ||
        coverage === "Man Free"
      )
    ) {
      setManAssignments({});
    }
    const packageLines = showPressureOverlay
      ? buildPressureLines(selectedDefensivePressure)
      : [];
    setDrawnLines((current) => [
      ...removeDefensivePackageLines(current),
      ...packageLines,
    ]);
  }

  function applyDefensivePressure(pressure: DefensivePressurePreset) {
    const isSameVisiblePressure =
      showPressureOverlay && selectedDefensivePressure === pressure;
    if (isSameVisiblePressure || pressure === "None") {
      setSelectedDefensivePressure("None");
      setShowPressureOverlay(false);
      setDrawnLines((current) => removeDefensivePackageLines(current));
      return;
    }

    setSelectedDefensivePressure(pressure);
    setShowPressureOverlay(true);
    const packageLines = buildPressureLines(pressure);
    setDrawnLines((current) => [
      ...removeDefensivePackageLines(current),
      ...packageLines,
    ]);
  }

  function saveDefensivePackage() {
    const name = defensivePackageName.trim();
    if (!name || footballTeamSize !== "11man") return;
    const pkg: DefensivePackage = {
      id: crypto.randomUUID(),
      name,
      front: selectedDefenseFront,
      defensePlayers: defensePlayers.map((p) => ({ ...p })),
      drawnLines: drawnLines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      })),
      manAssignments: { ...manAssignments },
      zoneAssignments: zoneAssignments.map((zone) => ({ ...zone })),
    };
    setSavedDefensivePackages((current) => [...current, pkg]);
    setDefensivePackageName("");
  }

  function loadDefensivePackage(id: string) {
  const pkg = savedDefensivePackages.find((item) => item.id === id);
  if (!pkg) return;

  const nextManAssignments = pkg.manAssignments ?? {};
  const nextZones = (pkg.zoneAssignments ?? []).map((zone) => ({ ...zone }));
  const nextDefensePlayers = pkg.defensePlayers.map((p) => ({ ...p }));
  const nextDrawnLines = pkg.drawnLines.map((line) => ({
    ...line,
    points: line.points.map((point) => ({ ...point })),
  }));

  setSelectedDefenseFront(pkg.front);
  setShowCoverageOverlay(false);
  setShowPressureOverlay(false);
  setManAssignments(nextManAssignments);
  setZoneAssignments(nextZones);
  applyDefensePlayers(nextDefensePlayers);
  setDrawnLines(nextDrawnLines);
  setSelectedSide("defense");
  setActivePanelTab("defense");

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DEFENSE_PLAYERS",
      defensePlayers: nextDefensePlayers,
    },
  });

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_MAN_ASSIGNMENTS",
      manAssignments: nextManAssignments,
    },
  });

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_ZONES",
      zoneAssignments: nextZones,
    },
  });

  realtimeChannelRef.current?.send({
    type: "broadcast",
    event: "board-event",
    payload: {
      type: "SET_DRAWN_LINES",
      drawnLines: nextDrawnLines,
    },
  });
}

  function overwriteDefensivePackage(id: string) {
    setSavedDefensivePackages((current) =>
      current.map((pkg) =>
        pkg.id === id
          ? {
              ...pkg,
              front: selectedDefenseFront,
              coverage: undefined,
              pressure: undefined,
              defensePlayers: defensePlayers.map((p) => ({ ...p })),
              drawnLines: drawnLines.map((line) => ({
                ...line,
                points: line.points.map((point) => ({ ...point })),
              })),
              manAssignments: { ...manAssignments },
              zoneAssignments: zoneAssignments.map((zone) => ({ ...zone })),
            }
          : pkg
      )
    );
  }

  function deleteDefensivePackage(id: string) {
    setSavedDefensivePackages((current) =>
      current.filter((pkg) => pkg.id !== id)
    );
  }

  function saveCustomOffensePreset() {
    const name = customPresetName.trim();
    if (!name) return;
    const mainCount = sortedOffensePresets.filter((p) => p.isMain).length;
    setCustomOffensePresets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        isMain: mainCount < 5,
        isSystem: false,
        players: normalizeOffenseOnLOS(offensePlayers),
      },
    ]);
    setCustomPresetName("");
  }

  function resetToSystemPresets() {
    const systemPresets = makeDefaultOffensePresets(footballTeamSize);
    setCustomOffensePresets(systemPresets);
    window.localStorage.removeItem("coachboard_custom_offense_presets");
  }

  function savePlay() {
    const name = savedPlayName.trim();
    if (!name) return;

    if (!selectedPlayFormationId) {
      alert("Load or select a formation before saving this play.");
      return;
    }

    const play: SavedPlay = {
      id: crypto.randomUUID(),
      name,
      formationId: selectedPlayFormationId,
      offensePlayers: normalizeOffenseOnLOS(offensePlayers),
      defensePlayers: defensePlayers.map((p) => ({ ...p })),
      routes: routes.map((r) => ({ ...r })),
      drawnLines: drawnLines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      })),
      preloadOnOpen: false,
    };

    setSavedPlays((current) => [...current, play]);
    setSavedPlayName("");
  }

  function loadPlay(id: string) {
    if (!id) {
      clearLoadedPlay();
      return;
    }

    const play = savedPlays.find((p) => p.id === id);
    if (!play) return;

    setOffensePlayers(normalizeOffenseOnLOS(play.offensePlayers));
    applyDefensePlayers(play.defensePlayers.map((p) => ({ ...p })));
    setRoutes(play.routes.map((r) => ({ ...r })));
    setDrawnLines(
      play.drawnLines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      }))
    );
    setSelectedPlayId(id);
    setSelectedPlayFormationId(play.formationId ?? "");
  }

  function overwritePlay(id: string) {
    setSavedPlays((current) =>
      current.map((play) =>
        play.id === id
          ? {
              ...play,
              offensePlayers: normalizeOffenseOnLOS(offensePlayers),
              defensePlayers: defensePlayers.map((p) => ({ ...p })),
              routes: routes.map((r) => ({ ...r })),
              drawnLines: drawnLines.map((line) => ({
                ...line,
                points: line.points.map((point) => ({ ...point })),
              })),
            }
          : play
      )
    );
  }

  function renamePlay(id: string, name: string) {
    setSavedPlays((current) =>
      current.map((play) => (play.id === id ? { ...play, name } : play))
    );
  }

  function deletePlay(id: string) {
    setSavedPlays((current) => current.filter((play) => play.id !== id));
    if (selectedPlayId === id) setSelectedPlayId("");
  }

  function setPlayPreload(id: string) {
    setSavedPlays((current) =>
      current.map((play) => ({
        ...play,
        preloadOnOpen: play.id === id ? !play.preloadOnOpen : false,
      }))
    );
  }

  function clearLoadedPlay() {
    setSelectedPlayId("");
    setSelectedPlayFormationId("");
    setRoutes([]);
    setDrawnLines([]);
  }

  function loadCustomOffensePreset(id: string) {
  const preset = customOffensePresets.find((p) => p.id === id);

  if (preset) {
    const nextPlayers = normalizeOffenseOnLOS(preset.players);

    setOffensePlayers(nextPlayers);
    setSelectedPlayFormationId(id);
    setSelectedPresetDropdownId(id);
    setSelectedPlayId("");
    setRoutes([]);
    setDrawnLines([]);

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_OFFENSE_PLAYERS",
        offensePlayers: nextPlayers,
      },
    });

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_ROUTES",
        routes: [],
      },
    });

    realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "board-event",
      payload: {
        type: "SET_DRAWN_LINES",
        drawnLines: [],
      },
    });
  }
}

  function overwriteCustomOffensePreset(id: string) {
    setCustomOffensePresets((current) =>
      current.map((preset) => {
        if (preset.id !== id) return preset;
        if (preset.isSystem) return preset;
        return { ...preset, players: normalizeOffenseOnLOS(offensePlayers) };
      })
    );
  }

  function deleteCustomOffensePreset(id: string) {
    setCustomOffensePresets((current) =>
      current.filter((preset) => preset.id !== id || preset.isSystem)
    );
  }

  function renameCustomOffensePreset(id: string, name: string) {
    setCustomOffensePresets((current) =>
      current.map((preset) => {
        if (preset.id !== id) return preset;
        if (preset.isSystem) return preset;
        return { ...preset, name };
      })
    );
  }

  function toggleMainOffensePreset(id: string) {
    setCustomOffensePresets((current) => {
      const selected = current.find((p) => p.id === id);
      if (!selected) return current;

      const mainPresets = current.filter((p) => p.isMain);

      // If already Top 5, remove it from the Top 5 group.
      if (selected.isMain) {
        return current.map((p) => (p.id === id ? { ...p, isMain: false } : p));
      }

      // If fewer than 5 are selected, simply add it.
      if (mainPresets.length < 5) {
        return current.map((p) => (p.id === id ? { ...p, isMain: true } : p));
      }

      // If already full, replace the current 5th Top 5 preset with this one.
      const fifthMainId = mainPresets[4]?.id;
      return current.map((p) => {
        if (p.id === fifthMainId) return { ...p, isMain: false };
        if (p.id === id) return { ...p, isMain: true };
        return p;
      });
    });
  }

  function reorderTopFive(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    setCustomOffensePresets((current) => {
      const topFive = current.filter((p) => p.isMain).slice(0, 5);
      const others = current.filter((p) => !p.isMain);

      const fromIndex = topFive.findIndex((p) => p.id === draggedId);
      const toIndex = topFive.findIndex((p) => p.id === targetId);

      if (fromIndex === -1 || toIndex === -1) return current;

      const reordered = [...topFive];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      return [...reordered, ...others];
    });
  }

  function closestOffensivePlayerToPoint(point: FieldPoint): Player | null {
    let closestPlayer: Player | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    offensePlayers.forEach((player) => {
      const playerPoint = visiblePlayerPoint(player);
      const distance = Math.hypot(
        playerPoint.x - point.x,
        playerPoint.y - point.y
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });

    return closestPlayer;
  }

  function saveConcept() {
    const name = conceptName.trim();
    if (!name) return;

    const routeAssignments: ConceptAssignment[] = routes
      .map((route) => {
        const player = offensePlayers.find((p) => p.id === route.playerId);
        return player
          ? {
              playerLabel: player.position.toUpperCase(),
              type: "route",
              routeType: route.routeType,
              breakDepth: route.breakDepth,
              finishDepth: route.finishDepth,
            }
          : null;
      })
      .filter(Boolean) as ConceptAssignment[];

    const drawingAssignments: ConceptAssignment[] = drawnLines
      .map((line) => {
        const firstPoint = line.points[0];
        const anchorPlayer = firstPoint
          ? closestOffensivePlayerToPoint(firstPoint)
          : null;
        if (!anchorPlayer || line.points.length < 2) return null;

        const anchorPoint = visiblePlayerPoint(anchorPlayer);
        const relativePoints = line.points.map((point) => ({
          x: point.x - anchorPoint.x,
          y: point.y - anchorPoint.y,
        }));

        return {
          playerLabel: anchorPlayer.position.toUpperCase(),
          type: line.style === "block" ? "block" : "run",
          lineStyle: line.style,
          relativePoints,
        };
      })
      .filter(Boolean) as ConceptAssignment[];

    const assignments = [...routeAssignments, ...drawingAssignments];

    if (assignments.length === 0) {
      alert(
        "Add at least one route, run path, or block line before saving a concept."
      );
      return;
    }

    setPlayConcepts((current) => [
      ...current,
      { id: crypto.randomUUID(), name, assignments },
    ]);
    setConceptName("");
  }

  function applyConcept(id: string) {
    const concept = playConcepts.find((c) => c.id === id);
    if (!concept) return;

    const mappedRoutes: RouteModel[] = concept.assignments
      .filter((assignment) => assignment.type === "route")
      .map((assignment) => {
        const player = offensePlayers.find(
          (p) =>
            p.position.toUpperCase() === assignment.playerLabel.toUpperCase()
        );
        if (
          !player ||
          !assignment.routeType ||
          assignment.breakDepth === undefined ||
          assignment.finishDepth === undefined
        )
          return null;
        return {
          playerId: player.id,
          routeType: assignment.routeType,
          breakDepth: assignment.breakDepth,
          finishDepth: assignment.finishDepth,
        };
      })
      .filter(Boolean) as RouteModel[];

    const mappedDrawings: DrawLine[] = concept.assignments
      .filter((assignment) => assignment.type !== "route")
      .map((assignment) => {
        const player = offensePlayers.find(
          (p) =>
            p.position.toUpperCase() === assignment.playerLabel.toUpperCase()
        );
        if (!player || !assignment.relativePoints || !assignment.lineStyle)
          return null;

        const anchorPoint = visiblePlayerPoint(player);
        return {
          id: crypto.randomUUID(),
          style: assignment.lineStyle,
          points: assignment.relativePoints.map((point) => ({
            x: anchorPoint.x + point.x,
            y: anchorPoint.y + point.y,
          })),
        };
      })
      .filter(Boolean) as DrawLine[];

    setRoutes(mappedRoutes);
    setDrawnLines(mappedDrawings);
    setSelectedConceptId(id);
  }

  function renameConcept(id: string, name: string) {
    setPlayConcepts((current) =>
      current.map((concept) =>
        concept.id === id ? { ...concept, name } : concept
      )
    );
  }

  function deleteConcept(id: string) {
    setPlayConcepts((current) =>
      current.filter((concept) => concept.id !== id)
    );
    if (selectedConceptId === id) setSelectedConceptId("");
  }

  function resetTeamBranding() {
    setTeamBranding(DEFAULT_TEAM_BRANDING);
    setFieldTemplate(DEFAULT_FIELD_TEMPLATE);
    applyCoachFocus(DEFAULT_COACH_FOCUS);
    applyFootballTeamSize(DEFAULT_FOOTBALL_TEAM_SIZE);
    window.localStorage.removeItem("coachboard_team_branding");
    window.localStorage.removeItem("coachboard_field_template");
    window.localStorage.removeItem("coachboard_football_team_size");
    window.localStorage.removeItem("coachboard_coach_focus");
  }

  function createGamePlan() {
    const name = gamePlanName.trim();
    if (!name) return;

    const plan: GamePlan = {
      id: crypto.randomUUID(),
      name,
      playIds: [],
    };

    setGamePlans((current) => [...current, plan]);
    setSelectedGamePlanId(plan.id);
    setCurrentGamePlanIndex(0);
    setGamePlanName("");
  }

  function renameGamePlan(id: string, name: string) {
    setGamePlans((current) =>
      current.map((plan) => (plan.id === id ? { ...plan, name } : plan))
    );
  }

  function deleteGamePlan(id: string) {
    setGamePlans((current) => current.filter((plan) => plan.id !== id));
    if (selectedGamePlanId === id) {
      setSelectedGamePlanId("");
      setCurrentGamePlanIndex(0);
    }
  }

  function togglePlayInGamePlan(planId: string, playId: string) {
    setGamePlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const exists = plan.playIds.includes(playId);
        return {
          ...plan,
          playIds: exists
            ? plan.playIds.filter((id) => id !== playId)
            : [...plan.playIds, playId],
        };
      })
    );
  }

  function moveGamePlanPlay(
    planId: string,
    playId: string,
    direction: "up" | "down"
  ) {
    setGamePlans((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const index = plan.playIds.indexOf(playId);
        if (index === -1) return plan;
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= plan.playIds.length) return plan;
        const nextPlayIds = [...plan.playIds];
        [nextPlayIds[index], nextPlayIds[swapIndex]] = [
          nextPlayIds[swapIndex],
          nextPlayIds[index],
        ];
        return { ...plan, playIds: nextPlayIds };
      })
    );
  }

  function loadGamePlanPlay(index: number) {
    const plan = gamePlans.find((item) => item.id === selectedGamePlanId);
    if (!plan) return;
    const playId = plan.playIds[index];
    if (!playId) return;
    setCurrentGamePlanIndex(index);
    loadPlay(playId);
  }

  function nextGamePlanPlay() {
    const plan = gamePlans.find((item) => item.id === selectedGamePlanId);
    if (!plan || plan.playIds.length === 0) return;
    const nextIndex = Math.min(
      currentGamePlanIndex + 1,
      plan.playIds.length - 1
    );
    loadGamePlanPlay(nextIndex);
  }

  function previousGamePlanPlay() {
    const plan = gamePlans.find((item) => item.id === selectedGamePlanId);
    if (!plan || plan.playIds.length === 0) return;
    const previousIndex = Math.max(currentGamePlanIndex - 1, 0);
    loadGamePlanPlay(previousIndex);
  }

  function createPlaybook() {
    const name = playbookName.trim();
    if (!name) return;

    const playbook: Playbook = {
      id: crypto.randomUUID(),
      name,
      formationIds: [],
      formationConcepts: {},
    };

    setPlaybooks((current) => [...current, playbook]);
    setSelectedPlaybookId(playbook.id);
    setPlaybookName("");
  }

  function renamePlaybook(id: string, name: string) {
    setPlaybooks((current) =>
      current.map((book) => (book.id === id ? { ...book, name } : book))
    );
  }

  function deletePlaybook(id: string) {
    setPlaybooks((current) => current.filter((book) => book.id !== id));
    if (selectedPlaybookId === id) setSelectedPlaybookId("");
  }

  function toggleFormationInPlaybook(playbookId: string, formationId: string) {
    setPlaybooks((current) =>
      current.map((book) => {
        if (book.id !== playbookId) return book;
        const exists = book.formationIds.includes(formationId);
        return {
          ...book,
          formationIds: exists
            ? book.formationIds.filter((id) => id !== formationId)
            : [...book.formationIds, formationId],
          formationConcepts: book.formationConcepts ?? {},
        };
      })
    );
  }

  function toggleConceptInFormation(
    playbookId: string,
    formationId: string,
    conceptId: string
  ) {
    setPlaybooks((current) =>
      current.map((book) => {
        if (book.id !== playbookId) return book;
        const formationConcepts = book.formationConcepts ?? {};
        const currentConcepts = formationConcepts[formationId] ?? [];
        const exists = currentConcepts.includes(conceptId);

        return {
          ...book,
          formationConcepts: {
            ...formationConcepts,
            [formationId]: exists
              ? currentConcepts.filter((id) => id !== conceptId)
              : [...currentConcepts, conceptId],
          },
        };
      })
    );
  }

  function buildConceptForFormation(formationId: string, conceptId: string) {
    const formation = customOffensePresets.find(
      (preset) => preset.id === formationId
    );
    const concept = playConcepts.find((item) => item.id === conceptId);
    if (!formation || !concept) return null;

    const mappedRoutes: RouteModel[] = concept.assignments
      .filter((assignment) => assignment.type === "route")
      .map((assignment) => {
        const player = formation.players.find(
          (p) =>
            p.position.toUpperCase() === assignment.playerLabel.toUpperCase()
        );
        if (
          !player ||
          !assignment.routeType ||
          assignment.breakDepth === undefined ||
          assignment.finishDepth === undefined
        )
          return null;
        return {
          playerId: player.id,
          routeType: assignment.routeType,
          breakDepth: assignment.breakDepth,
          finishDepth: assignment.finishDepth,
        };
      })
      .filter(Boolean) as RouteModel[];

    const mappedDrawings: DrawLine[] = concept.assignments
      .filter((assignment) => assignment.type !== "route")
      .map((assignment) => {
        const player = formation.players.find(
          (p) =>
            p.position.toUpperCase() === assignment.playerLabel.toUpperCase()
        );
        if (!player || !assignment.relativePoints || !assignment.lineStyle)
          return null;
        const anchorPoint = visiblePlayerPoint(player);
        return {
          id: crypto.randomUUID(),
          style: assignment.lineStyle,
          points: assignment.relativePoints.map((point) => ({
            x: anchorPoint.x + point.x,
            y: anchorPoint.y + point.y,
          })),
        };
      })
      .filter(Boolean) as DrawLine[];

    return {
      id: crypto.randomUUID(),
      name: `${formation.name} - ${concept.name}`,
      formationId,
      offensePlayers: normalizeOffenseOnLOS(formation.players),
      defensePlayers: defensePlayers.map((p) => ({ ...p })),
      routes: mappedRoutes,
      drawnLines: mappedDrawings,
      preloadOnOpen: false,
    } as SavedPlay;
  }

  function generatePlayFromConcept(formationId: string, conceptId: string) {
    const play = buildConceptForFormation(formationId, conceptId);
    if (!play) return;

    setSavedPlays((current) => {
      const alreadyExists = current.some(
        (existing) =>
          existing.formationId === formationId && existing.name === play.name
      );
      return alreadyExists ? current : [...current, play];
    });

    setSelectedPlayId(play.id);
    setOffensePlayers(normalizeOffenseOnLOS(play.offensePlayers));
    setRoutes(play.routes.map((r) => ({ ...r })));
    setDrawnLines(
      play.drawnLines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      }))
    );
  }

  function autoGeneratePlaybookPlays(playbookId: string) {
    const playbook = playbooks.find((book) => book.id === playbookId);
    if (!playbook) return;

    const playsToAdd: SavedPlay[] = [];
    playbook.formationIds.forEach((formationId) => {
      const conceptIds = playbook.formationConcepts?.[formationId] ?? [];
      conceptIds.forEach((conceptId) => {
        const play = buildConceptForFormation(formationId, conceptId);
        if (play) playsToAdd.push(play);
      });
    });

    setSavedPlays((current) => {
      const existingKeys = new Set(
        current.map((play) => `${play.formationId}|${play.name}`)
      );
      const uniqueNew = playsToAdd.filter(
        (play) => !existingKeys.has(`${play.formationId}|${play.name}`)
      );
      return [...current, ...uniqueNew];
    });
  }

  const selectedPlaybook = playbooks.find(
    (book) => book.id === selectedPlaybookId
  );
  const activeFormation = customOffensePresets.find(
    (formation) => formation.id === selectedPlayFormationId
  );
  const activeFieldHash =
    FIELD_HASH_PRESETS[fieldTemplate] ??
    FIELD_HASH_PRESETS[DEFAULT_FIELD_TEMPLATE];
async function handleLogout() {
  await supabase.auth.signOut();

  localStorage.removeItem("coachboard_team_code");

  setTeamCode("");
  setTeamCodeInput("");
  setUser(null);
  setEmail("");
  setPassword("");
  setAuthMode("login");

  window.location.reload();
}
if (!user) {
  return (
    <div className="coachboard-login-page">
      <div className="coachboard-login-bg" />

      <div className="coachboard-login-shell">
        <section className="coachboard-brand-side">
          <img
            src="/coachboard-logo.png"
            alt="CoachBoard"
            className="coachboard-logo"
          />

          <h1>
            The Ultimate Coaching
            <br />
            <span>Whiteboard</span> Platform
            <br />
            for Winners.
          </h1>

          <div className="coachboard-features">
            <div className="coachboard-feature">
              <div className="feature-icon">
  <img
    src="/clipboard.svg"
    alt="Draw"
    width="28"
    height="28"
  />
</div>
              <div>
                <h3>Draw it.</h3>
                <p>Create plays and strategies with our easy-to-use tools.</p>
              </div>
            </div>

            <div className="coachboard-feature">
              <div className="feature-icon">
  <img
    src="/share.svg"
    alt="Share"
    width="28"
    height="28"
  />
</div>
              <div>
                <h3>Share it.</h3>
                <p>Share your boards instantly with your team.</p>
              </div>
            </div>

            <div className="coachboard-feature">
              <div className="feature-icon">
  <img
    src="/trophy.svg"
    alt="Win"
    width="28"
    height="28"
  />
</div>
              <div>
                <h3>Win it.</h3>
                <p>Execute your game plan and achieve victory.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="coachboard-login-card">
          <h2>
            Welcome <span>Back</span>
          </h2>

          <p className="coachboard-subtitle">
            Log in to your CoachBoard account
          </p>

          <div className="coachboard-divider">
            <div />
            <span>★</span>
            <div />
          </div>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />

          <div className="coachboard-login-options">
  <button
    type="button"
    onClick={async () => {
      if (!email) {
        alert("Enter your email first.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://coach-board-online1.vercel.app",
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Password reset email sent.");
    }}
    style={{
      background: "none",
      border: "none",
      color: "#ef4444",
      cursor: "pointer",
      fontWeight: 700,
      padding: 0,
    }}
  >
    Forgot password?
  </button>
</div>

          <button
            className="coachboard-login-button"
            onClick={async () => {
              if (authMode === "signup") {
                const { error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo:
                      "https://coach-board-online1.vercel.app",
                  },
                });

                if (error) {
                  alert(error.message);
                  return;
                }

                alert("Check your email to confirm your account.");
              } else {
                const { data, error } =
                  await supabase.auth.signInWithPassword({
                    email,
                    password,
                  });

                if (error) {
                  alert(error.message);
                  return;
                }

                setUser(data.user);
              }
            }}
          >
            {authMode === "login" ? "Log In →" : "Create Account →"}
          </button>

          <div className="coachboard-or">
            <div />
            <span>or</span>
            <div />
          </div>

          <button
            className="coachboard-create-button"
            onClick={() =>
              setAuthMode(authMode === "login" ? "signup" : "login")
            }
          >
            {authMode === "login"
              ? "Create your CoachBoard account"
              : "Already have an account? Login"}
          </button>

          <p className="coachboard-footer">
            Built for coaches. Designed for <span>champions.</span>
          </p>
        </section>
      </div>
    </div>
  );
}

  return (
   <div
  className="coachboard-app-background"
  style={{
    color: "white",
    padding: 18,
    fontFamily: "Arial",
  }}
      onPointerMove={(e) => {
        updateDraggedPlayer(e.clientX, e.clientY);
        updateDrawing(e.clientX, e.clientY);
        updateZoneDraft(e.clientX, e.clientY);
        updateZoneDrag(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        finalizeDrawing();
        finalizeZoneDraft();
        finalizeZoneDrag();
        setDraggingId(null);
        setDraggingSide(null);
        setActiveLineId(null);
      }}
      onPointerCancel={() => {
        finalizeDrawing();
        finalizeZoneDraft();
        finalizeZoneDrag();
        setDraggingId(null);
        setDraggingSide(null);
        setActiveLineId(null);
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "150px minmax(0,1fr) 380px",
          gap: 18,
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <div style={panelHeaderStyle}>Coach Tools</div>
          <div
            style={{
              display: "grid",
              gap: 6,
              padding: "8px",
              background: "rgba(255,255,255,.045)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 14,
            }}
          >
            <div
              style={{ ...panelHeaderStyle, color: "#d1d5db", fontSize: 10 }}
            >
              View
            </div>
            <button
              style={{
                ...buttonBase,
                width: "100%",
                background: coachFocus === "offense" ? "#dc2626" : "#090b10",
                color: "white",
                padding: "8px",
              }}
              onClick={() => applyCoachFocus("offense")}
            >
              Offense View
            </button>
            <button
              style={{
                ...buttonBase,
                width: "100%",
                background: coachFocus === "defense" ? "#dc2626" : "#090b10",
                color: "white",
                padding: "8px",
              }}
              onClick={() => applyCoachFocus("defense")}
            >
              Defense View
            </button>
          </div>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background:
                showCreateOffenseSet || showManageOffenseSets
                  ? "#dc2626"
                  : "#090b10",
              color: "white",
              padding: "8px",
            }}
            onClick={() => {
              const next = !(showCreateOffenseSet || showManageOffenseSets);
              setShowCreateOffenseSet(next);
              setShowManageOffenseSets(next);
              setShowCreatePlay(false);
              setShowManagePlays(false);
              setShowCreateConcept(false);
              setShowManageConcepts(false);
              setShowPlaybooks(false);
              setShowGamePlan(false);
            }}
          >
            Formations
          </button>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background:
                showCreatePlay || showManagePlays ? "#dc2626" : "#090b10",
              color: "white",
              padding: "8px",
            }}
            onClick={() => {
              const next = !(showCreatePlay || showManagePlays);
              setShowCreatePlay(next);
              setShowManagePlays(next);
              setShowCreateOffenseSet(false);
              setShowManageOffenseSets(false);
              setShowCreateConcept(false);
              setShowManageConcepts(false);
              setShowPlaybooks(false);
              setShowGamePlan(false);
            }}
          >
            Plays
          </button>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background:
                showCreateConcept || showManageConcepts ? "#dc2626" : "#090b10",
              color: "white",
              padding: "8px",
            }}
            onClick={() => {
              const next = !(showCreateConcept || showManageConcepts);
              setShowCreateConcept(next);
              setShowManageConcepts(next);
              setShowCreateOffenseSet(false);
              setShowManageOffenseSets(false);
              setShowCreatePlay(false);
              setShowManagePlays(false);
              setShowPlaybooks(false);
              setShowGamePlan(false);
            }}
          >
            Concepts
          </button>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background: showPlaybooks ? "#dc2626" : "#090b10",
              color: "white",
              padding: "8px",
            }}
            onClick={() => {
              const next = !showPlaybooks;
              setShowPlaybooks(next);
              setShowCreateOffenseSet(false);
              setShowManageOffenseSets(false);
              setShowCreatePlay(false);
              setShowManagePlays(false);
              setShowCreateConcept(false);
              setShowManageConcepts(false);
              setShowGamePlan(false);
            }}
          >
            Playbooks
          </button>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background: showGamePlan ? "#dc2626" : "#090b10",
              color: "white",
              padding: "8px",
            }}
            onClick={() => {
              const next = !showGamePlan;
              setShowGamePlan(next);
              setShowCreateOffenseSet(false);
              setShowManageOffenseSets(false);
              setShowCreatePlay(false);
              setShowManagePlays(false);
              setShowCreateConcept(false);
              setShowManageConcepts(false);
              setShowPlaybooks(false);
              setShowTeamSetup(false);
            }}
          >
            Game Plan
          </button>
          <div style={{ marginTop: 14 }}>
  <div
    style={{
      fontSize: 12,
      fontWeight: 900,
      color: "#f87171",
      letterSpacing: ".12em",
      textTransform: "uppercase",
      marginBottom: 8,
    }}
  >
   <button
  style={{
    ...buttonBase,
    width: "100%",
    background: teamCode ? "#dc2626" : "#090b10",
    color: "white",
    padding: "8px",
  }}
  onClick={() => setShowGamedayRoom(true)}
>
  Gameday Room
</button>
          <button
            style={{
              ...buttonBase,
              width: "100%",
              background: showTeamSetup ? "#dc2626" : "#090b10",
              color: "white",
              padding: "8px",
            }}
            
            onClick={() => {
              const next = !showTeamSetup;
              setShowTeamSetup(next);
              setShowCreateOffenseSet(false);
              setShowManageOffenseSets(false);
              setShowCreatePlay(false);
              setShowManagePlays(false);
              setShowCreateConcept(false);
              setShowManageConcepts(false);
              setShowPlaybooks(false);
              setShowGamePlan(false);
            }}
          >
            
            Team Setup
          </button>
          <div
            style={{
              marginTop: "auto",
              color: "#9ca3af",
              fontSize: 11,
              lineHeight: 1.7,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ color: "#ef4444", fontWeight: 900 }}>CoachBoard</div>
            <div>Draw it.</div>
            <div>Share it.</div>
            <div>Win it.</div>
          </div>
      <div style={{ marginTop: 14 }}>
  <button
  type="button"
  onClick={handleLogout}
    style={{
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      background: "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)",
      color: "white",
      border: "1px solid rgba(248,113,113,.55)",
      fontWeight: 900,
      cursor: "pointer",
      marginTop: 12,
    }}
  >
    Logout
  </button>
</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              ...cardStyle,
              minHeight: 94,
              padding: "10px 20px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, #050505 0%, #090b10 100%)",
              border: "1px solid rgba(239,68,68,0.42)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 0%, rgba(239,68,68,.18), transparent 42%)",
                pointerEvents: "none",
              }}
            />

            {/* CENTER: CoachBoard text + motto only */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                pointerEvents: "none",
                gap: 4,
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: fieldFullscreen ? 42 : 34,
                  fontWeight: 950,
                  letterSpacing: "-0.035em",
                  lineHeight: 0.95,
                  textShadow:
                    "0 0 14px rgba(239,68,68,.32), 0 2px 0 rgba(0,0,0,.7)",
                }}
              >
                CoachBoard
              </div>
              <div
                style={{
                  color: "#d1d5db",
                  fontSize: fieldFullscreen ? 16 : 13,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  textShadow: "0 0 10px rgba(239,68,68,.20)",
                }}
              >
                Draw it. <span style={{ color: "#ffffff" }}>Share it.</span>{" "}
                <span style={{ color: "#ef4444" }}>Win it.</span>
              </div>
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              padding: fieldFullscreen ? 18 : 12,
              position: fieldFullscreen ? "fixed" : "relative",
              inset: fieldFullscreen ? 0 : undefined,
              zIndex: fieldFullscreen ? 5000 : undefined,
              background: fieldFullscreen
                ? "radial-gradient(circle at center, rgba(20,20,24,1) 0%, rgba(3,7,18,1) 72%)"
                : cardStyle.background,
              borderRadius: fieldFullscreen ? 0 : cardStyle.borderRadius,
              border: fieldFullscreen ? "none" : cardStyle.border,
            }}
          >
            <button
              style={{
                ...buttonBase,
                position: "absolute",
                top: fieldFullscreen ? 28 : 18,
                right: fieldFullscreen ? 28 : 18,
                zIndex: 6000,
                background: fieldFullscreen ? "rgba(15,23,42,.86)" : "#090b10",
                color: "white",
                padding: "8px 10px",
                backdropFilter: fieldFullscreen ? "blur(8px)" : undefined,
              }}
              onClick={() => {
                setShowFullscreenQuickToolbar(true);
                setShowFullscreenPlayerPanel(false);
                setShowFullscreenToolsPanel(false);
                setFieldFullscreen((v) => !v);
              }}
            >
              {fieldFullscreen ? "Exit Full Screen" : "Full Screen"}
            </button>
            {fieldFullscreen && (
              <>
                <button
                  style={{
                    ...buttonBase,
                    position: "fixed",
                    top: 28,
                    left: 28,
                    zIndex: 2147483647,
                    background: showFullscreenQuickToolbar
                      ? "#dc2626"
                      : "rgba(15,23,42,.86)",
                    color: "white",
                    padding: "8px 10px",
                    minWidth: 44,
                    backdropFilter: "blur(8px)",
                  }}
                  onClick={() =>
                    setShowFullscreenQuickToolbar((current) => !current)
                  }
                  title={
                    showFullscreenQuickToolbar
                      ? "Hide quick tools"
                      : "Show quick tools"
                  }
                >
                  {showFullscreenQuickToolbar ? "×" : "☰"}
                </button>

                {showFullscreenQuickToolbar && (
                  <div
                    style={{
                      position: "fixed",
                      top: 76,
                      left: 28,
                      zIndex: 2147483646,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: 10,
                      width: 96,
                      borderRadius: 18,
                      background: "rgba(15,23,42,.82)",
                      border: "1px solid rgba(255,255,255,.16)",
                      boxShadow: "0 20px 50px rgba(0,0,0,.42)",
                      backdropFilter: "blur(12px)",
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                  >
                    <button
                      style={{
                        ...buttonBase,
                        background: tool === "Move" ? "#dc2626" : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={toggleMoveTool}
                      title="Move players"
                    >
                      Move
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background:
                          tool === "Draw" && drawingStyle === "solid"
                            ? "#dc2626"
                            : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={() => toggleDrawTool("solid")}
                      title="Solid draw"
                    >
                      Solid
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background:
                          tool === "Draw" && drawingStyle === "dotted"
                            ? "#dc2626"
                            : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={() => toggleDrawTool("dotted")}
                      title="Dotted draw"
                    >
                      Dot
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background:
                          tool === "Draw" && drawingStyle === "block"
                            ? "#dc2626"
                            : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={() => toggleDrawTool("block")}
                      title="Block draw"
                    >
                      T Block
                    </button>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <button
                        style={{
                          ...buttonBase,
                          background:
                            drawingMode === "curve" ? "#dc2626" : "#090b10",
                          color: "white",
                          padding: "7px 4px",
                          fontSize: 10,
                        }}
                        onClick={() => toggleDrawMode("curve")}
                        title="Curve feel"
                      >
                        S
                      </button>
                      <button
                        style={{
                          ...buttonBase,
                          background:
                            drawingMode === "straight" ? "#dc2626" : "#090b10",
                          color: "white",
                          padding: "7px 4px",
                          fontSize: 10,
                        }}
                        onClick={() => toggleDrawMode("straight")}
                        title="Straight feel"
                      >
                        /
                      </button>
                    </div>
                    <button
                      style={{
                        ...buttonBase,
                        background: tool === "Zone" ? "#dc2626" : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={toggleZoneTool}
                      title="Draw or move zone circle"
                    >
                      Zone
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background: tool === "Man" ? "#dc2626" : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={toggleManTool}
                      title="Man assignment"
                    >
                      Man
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background: undoStack.length
                          ? "#090b10"
                          : "rgba(15,23,42,.45)",
                        color: undoStack.length
                          ? "white"
                          : "rgba(255,255,255,.42)",
                        padding: "8px 6px",
                        fontSize: 11,
                        cursor: undoStack.length ? "pointer" : "not-allowed",
                      }}
                      onClick={undoLastAction}
                      disabled={!undoStack.length}
                      title="Undo last drawing action"
                    >
                      Undo
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background: selectedFieldItem
                          ? "#7f1d1d"
                          : "rgba(127,29,29,.38)",
                        color: selectedFieldItem
                          ? "white"
                          : "rgba(255,255,255,.45)",
                        padding: "8px 6px",
                        fontSize: 11,
                        cursor: selectedFieldItem ? "pointer" : "not-allowed",
                      }}
                      onClick={deleteSelectedFieldItem}
                      disabled={!selectedFieldItem}
                      title="Delete selected route, drawing, or zone"
                    >
                      Delete
                    </button>
                    <div
                      style={{
                        height: 1,
                        background: "rgba(255,255,255,.12)",
                        margin: "2px 0",
                      }}
                    />
                    <button
                      style={{
                        ...buttonBase,
                        background: showFullscreenPlayerPanel
                          ? "#dc2626"
                          : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setShowFullscreenPlayerPanel((current) => {
                          const next = !current;
                          if (next) setShowFullscreenToolsPanel(false);
                          return next;
                        });
                      }}
                      title="Open full player panel"
                    >
                      Player Panel
                    </button>
                    <button
                      style={{
                        ...buttonBase,
                        background: showFullscreenToolsPanel
                          ? "#dc2626"
                          : "#090b10",
                        color: "white",
                        padding: "8px 6px",
                        fontSize: 11,
                      }}
                      onClick={() => {
                        setShowFullscreenToolsPanel((current) => {
                          const next = !current;
                          if (next) setShowFullscreenPlayerPanel(false);
                          return next;
                        });
                      }}
                      title="Open coach menus"
                    >
                      Menus
                    </button>
                  </div>
                )}
              </>
            )}
            {fieldFullscreen && showFullscreenPlayerPanel && (
              <div
                style={{
                  ...cardStyle,
                  position: "fixed",
                  top: 28,
                  left: 126,
                  bottom: 28,
                  width: 360,
                  zIndex: 2147483645,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  overflowY: "auto",
                  background: "rgba(15,23,42,.94)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.16)",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                {playerPanelContent}
              </div>
            )}
            {fieldFullscreen && showFullscreenToolsPanel && (
              <div
                style={{
                  ...cardStyle,
                  position: "fixed",
                  top: 28,
                  left: 126,
                  bottom: 28,
                  width: 240,
                  zIndex: 2147483645,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  overflowY: "auto",
                  background: "rgba(15,23,42,.94)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.16)",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                <div style={panelHeaderStyle}>Coach Tools</div>
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: "8px",
                    background: "rgba(255,255,255,.045)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      ...panelHeaderStyle,
                      color: "#d1d5db",
                      fontSize: 10,
                    }}
                  >
                    View
                  </div>
                  <button
                    style={{
                      ...buttonBase,
                      width: "100%",
                      background:
                        coachFocus === "offense" ? "#dc2626" : "#090b10",
                      color: "white",
                      padding: "8px",
                    }}
                    onClick={() => applyCoachFocus("offense")}
                  >
                    Offense View
                  </button>
                  <button
                    style={{
                      ...buttonBase,
                      width: "100%",
                      background:
                        coachFocus === "defense" ? "#dc2626" : "#090b10",
                      color: "white",
                      padding: "8px",
                    }}
                    onClick={() => applyCoachFocus("defense")}
                  >
                    Defense View
                  </button>
                </div>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background:
                      showCreateOffenseSet || showManageOffenseSets
                        ? "#dc2626"
                        : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !(
                      showCreateOffenseSet || showManageOffenseSets
                    );
                    setShowCreateOffenseSet(next);
                    setShowManageOffenseSets(next);
                    setShowCreatePlay(false);
                    setShowManagePlays(false);
                    setShowCreateConcept(false);
                    setShowManageConcepts(false);
                    setShowPlaybooks(false);
                    setShowGamePlan(false);
                  }}
                >
                  Formations
                </button>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background:
                      showCreatePlay || showManagePlays ? "#dc2626" : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !(showCreatePlay || showManagePlays);
                    setShowCreatePlay(next);
                    setShowManagePlays(next);
                    setShowCreateOffenseSet(false);
                    setShowManageOffenseSets(false);
                    setShowCreateConcept(false);
                    setShowManageConcepts(false);
                    setShowPlaybooks(false);
                    setShowGamePlan(false);
                  }}
                >
                  Plays
                </button>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background:
                      showCreateConcept || showManageConcepts
                        ? "#dc2626"
                        : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !(showCreateConcept || showManageConcepts);
                    setShowCreateConcept(next);
                    setShowManageConcepts(next);
                    setShowCreateOffenseSet(false);
                    setShowManageOffenseSets(false);
                    setShowCreatePlay(false);
                    setShowManagePlays(false);
                    setShowPlaybooks(false);
                    setShowGamePlan(false);
                  }}
                >
                  Concepts
                </button>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background: showPlaybooks ? "#dc2626" : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !showPlaybooks;
                    setShowPlaybooks(next);
                    setShowCreateOffenseSet(false);
                    setShowManageOffenseSets(false);
                    setShowCreatePlay(false);
                    setShowManagePlays(false);
                    setShowCreateConcept(false);
                    setShowManageConcepts(false);
                    setShowGamePlan(false);
                  }}
                >
                  Playbooks
                </button>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background: showGamePlan ? "#dc2626" : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !showGamePlan;
                    setShowGamePlan(next);
                    setShowCreateOffenseSet(false);
                    setShowManageOffenseSets(false);
                    setShowCreatePlay(false);
                    setShowManagePlays(false);
                    setShowCreateConcept(false);
                    setShowManageConcepts(false);
                    setShowPlaybooks(false);
                    setShowTeamSetup(false);
                  }}
                >
                  Game Plan
                </button>
                <button
                  style={{
                    ...buttonBase,
                    width: "100%",
                    background: showTeamSetup ? "#dc2626" : "#090b10",
                    color: "white",
                    padding: "8px",
                  }}
                  onClick={() => {
                    const next = !showTeamSetup;
                    setShowTeamSetup(next);
                    setShowCreateOffenseSet(false);
                    setShowManageOffenseSets(false);
                    setShowCreatePlay(false);
                    setShowManagePlays(false);
                    setShowCreateConcept(false);
                    setShowManageConcepts(false);
                    setShowPlaybooks(false);
                    setShowGamePlan(false);
                  }}
                >
                  Team Setup
                </button>
              </div>
            )}
            <div
              ref={fieldRef}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                if (tool === "Draw") startDrawing(e.clientX, e.clientY);
                if (tool === "Zone") startZoneCircle(e.clientX, e.clientY);
                if (tool === "Select") clearActiveTool();
              }}
              onWheel={(e) => {
                if (!selectedZoneId) return;
                e.preventDefault();
                updateSelectedZoneRadius(
                  (selectedZone?.radius ?? 5.8) + (e.deltaY > 0 ? -0.75 : 0.75)
                );
              }}
              style={{
                position: "relative",
                width: fieldFullscreen
                  ? "min(calc(100vw - 36px), calc((100vh - 36px) * (15 / 10)))"
                  : "100%",
                height: fieldFullscreen ? "calc(100vh - 36px)" : undefined,
                aspectRatio: fieldFullscreen ? undefined : "10 / 11",
                maxHeight: fieldFullscreen ? undefined : "78vh",
                margin: fieldFullscreen ? "0 auto" : undefined,
                borderRadius: fieldFullscreen ? 24 : 28,
                overflow: "hidden",
                background:
                  teamBranding.secondaryColor ||
                  DEFAULT_TEAM_BRANDING.secondaryColor,
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                cursor: fieldCursor(),
                boxShadow: fieldFullscreen
                  ? "0 24px 80px rgba(0,0,0,.65), inset 0 0 0 1px rgba(255,255,255,.14)"
                  : undefined,
              }}
            >
              {tool !== "Select" && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom:
                      fieldFullscreen && showGamePlan && selectedGamePlanId
                        ? 72
                        : fieldFullscreen
                        ? 18
                        : 12,
                    transform: "translateX(-50%)",
                    zIndex: 7000,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(3,7,18,.82)",
                    border: "1px solid rgba(248,113,113,.35)",
                    borderRadius: 999,
                    padding: "6px 10px",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: ".06em",
                    pointerEvents: "auto",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span style={{ color: "#f87171" }}>{activeToolLabel}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearActiveTool();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {fieldFullscreen && showGamePlan && selectedGamePlanId && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 18,
                    transform: "translateX(-50%)",
                    zIndex: 7000,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    background: "rgba(3,7,18,.82)",
                    border: "1px solid rgba(255,255,255,.16)",
                    borderRadius: 16,
                    padding: "5px 8px",
                  }}
                >
                  <button
                    style={{
                      ...buttonBase,
                      background: "#090b10",
                      color: "white",
                    }}
                    onClick={previousGamePlanPlay}
                  >
                    ◀
                  </button>
                  <div
                    style={{
                      color: "white",
                      fontWeight: 800,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    {currentGamePlanIndex + 1} /{" "}
                    {gamePlans.find((p) => p.id === selectedGamePlanId)?.playIds
                      .length || 0}
                  </div>
                  <button
                    style={{
                      ...buttonBase,
                      background: "#dc2626",
                      color: "white",
                    }}
                    onClick={nextGamePlanPlay}
                  >
                    ▶
                  </button>
                </div>
              )}
              {fieldFullscreen && showGamePlan && selectedGamePlanId && (
                <div
                  style={{
                    position: "absolute",
                    left: 18,
                    top: 18,
                    zIndex: 7000,
                    background: "rgba(3,7,18,.82)",
                    border: "1px solid rgba(255,255,255,.16)",
                    borderRadius: 14,
                    padding: "8px 12px",
                    color: "white",
                    fontWeight: 900,
                  }}
                >
                  Game Plan Mode
                </div>
              )}
              {/* SIDELINES */}
              {/* REAL FIELD BOUNDARY: thick sidelines + end lines */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "10px",
                  background: "white",
                  zIndex: 100,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: "10px",
                  background: "white",
                  zIndex: 100,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "10px",
                  background: "white",
                  zIndex: 100,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "10px",
                  background: "white",
                  zIndex: 100,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  insetInline: 0,
                  top: 0,
                  height: "16.666%",
                  background: teamBranding.primaryColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: endzoneFontPx,
                  letterSpacing: endzoneLetterSpacing,
                  color: teamBranding.endzoneTextColor,
                  textShadow: "0 2px 8px rgba(0,0,0,.35)",
                  zIndex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  paddingInline: fieldFullscreen ? 48 : 20,
                }}
              >
                {(teamBranding.mascot || "COACHBOARD").toUpperCase()}
              </div>
              {/* Goal line: same thickness as regular yard marker */}
              <div
                style={{
                  position: "absolute",
                  left: "0%",
                  right: "0%",
                  height: 2,
                  background: "rgba(255,255,255,.9)",
                  top: "16.666%",
                  zIndex: 998,
                  pointerEvents: "none",
                }}
              />
              {/* Major yard lines every 5 yards */}
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "0%",
                    right: "0%",
                    height: 2,
                    background: "rgba(255,255,255,.78)",
                    top: `${16.666 + i * (83.333 / 10)}%`,
                    zIndex: 3,
                  }}
                />
              ))}
              {/* Real field-style hash marks: sideline ticks + inside hashes every yard */}
              {Array.from({ length: 51 }).map((_, i) => {
                const y = 16.666 + i * (83.333 / 50);
                const isFive = i % 5 === 0;
                return (
                  <React.Fragment key={i}>
                    <div
                      style={{
                        position: "absolute",
                        left: "10px",
                        width: isFive ? 18 : 10,
                        height: 1,
                        background: "rgba(255,255,255,.9)",
                        top: `${y}%`,
                        zIndex: 4,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "10px",
                        width: isFive ? 18 : 10,
                        height: 1,
                        background: "rgba(255,255,255,.9)",
                        top: `${y}%`,
                        zIndex: 4,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${activeFieldHash.left}%`,
                        width: isFive ? 16 : 11,
                        height: 1,
                        background: "rgba(255,255,255,.92)",
                        top: `${y}%`,
                        transform: "translateX(-50%)",
                        zIndex: 4,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${activeFieldHash.right}%`,
                        width: isFive ? 16 : 11,
                        height: 1,
                        background: "rgba(255,255,255,.92)",
                        top: `${y}%`,
                        transform: "translateX(-50%)",
                        zIndex: 4,
                      }}
                    />
                  </React.Fragment>
                );
              })}
              {/* Yard numbers */}
              {[10, 20, 30, 40, 50].map((yard) => (
                <React.Fragment key={yard}>
                  <div
                    style={{
                      position: "absolute",
                      left: "14%",
                      top: `${fieldYFromYards(yard)}%`,
                      transform: "translate(-50%,-50%) rotate(90deg)",
                      fontWeight: 900,
                      fontSize: fieldFullscreen ? 34 : 24,
                      color: "rgba(255,255,255,.88)",
                      zIndex: 5,
                    }}
                  >
                    {yard}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: "14%",
                      top: `${fieldYFromYards(yard)}%`,
                      transform: "translate(50%,-50%) rotate(-90deg)",
                      fontWeight: 900,
                      fontSize: fieldFullscreen ? 34 : 24,
                      color: "rgba(255,255,255,.88)",
                      zIndex: 5,
                    }}
                  >
                    {yard}
                  </div>
                </React.Fragment>
              ))}
              <div
                style={{
                  position: "absolute",
                  left: "1%",
                  right: "1%",
                  height: 3,
                  background: "#38bdf8",
                  top: losTop,
                  zIndex: 1000,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  top: losTop,
                  transform: "translateY(-50%)",
                  background: "#ef4444",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  padding: "4px 8px",
                  zIndex: 1001,
                  pointerEvents: "none",
                }}
              >
                LOS
              </div>

              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: tool === "Select" ? "auto" : "none",
                  zIndex: 1500,
                  shapeRendering: "geometricPrecision",
                  filter: fieldFullscreen
                    ? "drop-shadow(0 0.7px 1px rgba(0,0,0,.45))"
                    : undefined,
                }}
              >
                {footballTeamSize === "11man" &&
                  coverageBubbles.map((bubble) => {
                    const center = displayPoint(
                      packagePoint(bubble.x, bubble.yardsFromGoal)
                    );
                    const ownerPlayer = bubble.ownerId
                      ? defensePlayers.find(
                          (player) => player.id === bubble.ownerId
                        )
                      : undefined;
                    const ownerPoint = ownerPlayer
                      ? visiblePlayerPoint(ownerPlayer)
                      : null;
                    return (
                      <g key={bubble.id}>
                        {ownerPoint && (
                          <line
                            x1={ownerPoint.x}
                            y1={ownerPoint.y}
                            x2={center.x}
                            y2={center.y}
                            stroke="rgba(147,197,253,.78)"
                            strokeWidth={Math.max(0.18, lineStroke * 0.48)}
                            strokeDasharray={`${Math.max(
                              0.55,
                              lineStroke * 1.05
                            )} ${Math.max(0.55, lineStroke * 0.95)}`}
                            strokeLinecap="round"
                          />
                        )}
                        <ellipse
                          cx={center.x}
                          cy={center.y}
                          rx={bubble.width / 2}
                          ry={bubble.height / 2}
                          fill="rgba(59,130,246,.18)"
                          stroke="rgba(147,197,253,.82)"
                          strokeWidth={Math.max(0.18, lineStroke * 0.45)}
                          strokeDasharray={`${Math.max(
                            0.7,
                            lineStroke * 1.6
                          )} ${Math.max(0.7, lineStroke * 1.25)}`}
                        />
                        <text
                          x={center.x}
                          y={center.y - (fieldFullscreen ? 0.9 : 0.7)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={fieldFullscreen ? 1.9 : 1.45}
                          fontWeight={950}
                          style={{
                            letterSpacing: ".04em",
                            pointerEvents: "none",
                          }}
                        >
                          {bubble.owner}
                        </text>
                        <text
                          x={center.x}
                          y={center.y + (fieldFullscreen ? 1.25 : 0.95)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(219,234,254,.92)"
                          fontSize={fieldFullscreen ? 1.55 : 1.15}
                          fontWeight={850}
                          style={{ letterSpacing: ".03em" }}
                        >
                          {bubble.label}
                        </text>
                      </g>
                    );
                  })}

                {zoneAssignments.map((zone) => {
                  const defender = defensePlayers.find(
                    (p) => p.id === zone.defenderId
                  );
                  if (!defender) return null;
                  const defenderPoint = visiblePlayerPoint(defender);
                  const isSelectedZone = selectedZoneId === zone.id;
                  return (
                    <g key={`zone-${zone.id}`}>
                      <line
                        x1={defenderPoint.x}
                        y1={defenderPoint.y}
                        x2={zone.x}
                        y2={zone.y}
                        stroke="rgba(147,197,253,.82)"
                        strokeWidth={Math.max(0.18, lineStroke * 0.5)}
                        strokeDasharray={`${Math.max(
                          0.55,
                          lineStroke * 1.05
                        )} ${Math.max(0.55, lineStroke * 0.95)}`}
                        strokeLinecap="round"
                      />
                      const isReadKey = defensiveReadPlayerIds.includes(player.id);
const isCenter = player.position === &quot;something&quot;;
                      <circle
                        cx={zone.x}
                        cy={zone.y}
                        r={zone.radius}
                        fill={
                          isSelectedZone
                            ? "rgba(59,130,246,.30)"
                            : "rgba(59,130,246,.18)"
                        }
                        stroke={
                          isSelectedZone
                            ? "rgba(255,255,255,.95)"
                            : "rgba(147,197,253,.86)"
                        }
                        strokeWidth={
                          isSelectedZone
                            ? Math.max(0.28, lineStroke * 0.7)
                            : Math.max(0.18, lineStroke * 0.45)
                        }
                        strokeDasharray={`${Math.max(
                          0.7,
                          lineStroke * 1.6
                        )} ${Math.max(0.7, lineStroke * 1.25)}`}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          startZoneDrag(zone, e.clientX, e.clientY);
                        }}
                        style={{
                          pointerEvents: "auto",
                          cursor:
                            zoneDrag?.id === zone.id ? "grabbing" : "grab",
                        }}
                      />
                      <text
                        x={zone.x}
                        y={zone.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        stroke="rgba(0,0,0,.65)"
                        strokeWidth={0.14}
                        paintOrder="stroke"
                        fontSize={fieldFullscreen ? 1.55 : 1.15}
                        fontWeight={950}
                        style={{
                          letterSpacing: ".04em",
                          pointerEvents: "none",
                        }}
                      >
                        {defender.position}
                      </text>
                    </g>
                  );
                })}

                {Object.entries(manAssignments).map(
                    ([defenderId, offensiveId]) => {
                      const defender = defensePlayers.find(
                        (p) => p.id === defenderId
                      );
                      const offensive = offensePlayers.find(
                        (p) => p.id === offensiveId
                      );
                      if (!defender || !offensive) return null;
                      const a = visiblePlayerPoint(defender);
                      const b = visiblePlayerPoint(offensive);
                      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                      return (
                        <g key={`man-${defenderId}-${offensiveId}`}>
                          <line
                           onPointerDown={(e) => {
  e.preventDefault();
  e.stopPropagation();
  selectFieldItem({ type: "man", id: defenderId });
}}
style={{ cursor: "pointer" }}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke={
  selectedFieldItem?.type === "man" &&
  selectedFieldItem.id === defenderId
    ? "#facc15"
    : "rgba(239,68,68,.95)"
}
                            strokeWidth={Math.max(0.35, lineStroke * 0.95)}
                            strokeDasharray={`${Math.max(
                              0.8,
                              lineStroke * 1.7
                            )} ${Math.max(0.8, lineStroke * 1.4)}`}
                            strokeLinecap="round"
                          />
                          <line
  x1={a.x}
  y1={a.y}
  x2={b.x}
  y2={b.y}
  stroke="transparent"
  strokeWidth={6}
  pointerEvents="stroke"
  onPointerDown={(e) => {
    e.preventDefault();
    e.stopPropagation();
    selectFieldItem({ type: "man", id: defenderId });
  }}
  style={{ cursor: "pointer" }}
/>
                        </g>
                      );
                    }
                  )}

                {drawnLines.map((line) => {
                  const isBlock = line.style === "block";

                  // Block lines now follow the exact same drawing rules as the other draw tools:
                  // free-draw while moving, auto-straighten on release if mostly straight,
                  // and keep curves when the coach clearly draws a curve.
                  // Render from cleaned points even while drawing.
                  // This prevents freehand outs/ins/corners from showing rounded quadratic breaks.
                  // If the stroke fits one straight line, it renders straight.
                  // If it fits two straight segments, it renders as a straight polyline break.
                  // Only true curves keep the smoothed path rendering.
                  const cleanup =
                    line.mode === "curve"
                      ? cleanCurvedDrawnPoints
                      : cleanDrawnPoints;
                  const canonicalPoints =
                    line.points.length > 2 ? cleanup(line.points) : line.points;
                  const renderedPoints = canonicalPoints.map(displayPoint);
                  const cap =
                    isBlock && renderedPoints.length > 1
                      ? blockTCap(renderedPoints, blockCapSize)
                      : null;
                  const arrow =
                    !isBlock && renderedPoints.length > 1
                      ? drawLineArrow(renderedPoints, arrowSize * 0.8)
                      : null;
                  const path =
                    line.mode === "curve"
                      ? smoothPath(renderedPoints)
                      : straightPath(renderedPoints);
                  const isDotted = line.style === "dotted";
                  const isSelectedDrawing =
                    selectedFieldItem?.type === "drawnLine" &&
                    selectedFieldItem.id === line.id;
                  const linePlayer = line.playerId
                    ? [...offensePlayers, ...defensePlayers].find(
                        (p) => p.id === line.playerId
                      )
                    : null;
                  const drawingColorForDisplay =
                    linePlayer?.color ??
                    line.color ??
                    (isBlock ? "#090b10" : "#facc15");

                  return (
                    <g key={line.id}>
                      {/* dark outline keeps every drawn line sharp on bright field markings */}
                      <path
                        d={path}
                        fill="none"
                        stroke="rgba(0,0,0,.72)"
                        strokeWidth={
                          isBlock ? blockOutlineStroke : routeOutlineStroke
                        }
                        strokeLinecap={isDotted ? "round" : "butt"}
                        strokeLinejoin="miter"
                        strokeDasharray={isDotted ? dashPattern : undefined}
                        shapeRendering="geometricPrecision"
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={
                          isSelectedDrawing ? "#38bdf8" : drawingColorForDisplay
                        }
                        strokeWidth={
                          isSelectedDrawing
                            ? Math.max(
                                isBlock ? blockStroke : routeStroke,
                                lineStroke * 1.55
                              )
                            : isBlock
                            ? blockStroke
                            : routeStroke
                        }
                        strokeLinecap={isDotted ? "round" : "butt"}
                        strokeLinejoin="miter"
                        strokeDasharray={isDotted ? dashPattern : undefined}
                        shapeRendering="geometricPrecision"
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(2, lineStroke)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="stroke"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectFieldItem({ type: "drawnLine", id: line.id });
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      {cap && (
                        <>
                          <line
                            x1={cap.a.x}
                            y1={cap.a.y}
                            x2={cap.b.x}
                            y2={cap.b.y}
                            stroke="rgba(0,0,0,.75)"
                            strokeWidth={blockCapOutlineStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                          <line
                            x1={cap.a.x}
                            y1={cap.a.y}
                            x2={cap.b.x}
                            y2={cap.b.y}
                            stroke={drawingColorForDisplay}
                            strokeWidth={blockCapStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                        </>
                      )}
                      {arrow && (
                        <>
                          <line
                            x1={arrow.a.x}
                            y1={arrow.a.y}
                            x2={arrow.last.x}
                            y2={arrow.last.y}
                            stroke="rgba(0,0,0,.72)"
                            strokeWidth={routeOutlineStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                          <line
                            x1={arrow.b.x}
                            y1={arrow.b.y}
                            x2={arrow.last.x}
                            y2={arrow.last.y}
                            stroke="rgba(0,0,0,.72)"
                            strokeWidth={routeOutlineStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                          <line
                            x1={arrow.a.x}
                            y1={arrow.a.y}
                            x2={arrow.last.x}
                            y2={arrow.last.y}
                            stroke={drawingColorForDisplay}
                            strokeWidth={routeStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                          <line
                            x1={arrow.b.x}
                            y1={arrow.b.y}
                            x2={arrow.last.x}
                            y2={arrow.last.y}
                            stroke={drawingColorForDisplay}
                            strokeWidth={routeStroke}
                            strokeLinecap="butt"
                            shapeRendering="geometricPrecision"
                          />
                        </>
                      )}
                    </g>
                  );
                })}
                {routes.map((route) => {
                  const player = offensePlayers.find(
                    (p) => p.id === route.playerId
                  );
                  const qb = offensePlayers.find(
                    (p) => p.id === "qb" || p.position === "QB"
                  );
                  if (!player) return null;
                  const qbPoint = qb
                    ? { x: qb.x, y: fieldYFromYards(qb.yardsFromGoal) }
                    : undefined;
                  const { polyline } = getRoutePoints(player, route, qbPoint);
                  const displayPolyline = polyline.map(displayPoint);
                  const arrow = routeArrow(displayPolyline, arrowSize);
                  const routePoints = displayPolyline
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ");
                  const isSelectedRoute =
                    selectedFieldItem?.type === "route" &&
                    selectedFieldItem.id === route.playerId;
                  const routeColorForDisplay =
                    player.color ?? route.color ?? "#facc15";

                  return (
                    <g key={route.playerId}>
                      {/* Clean straight routes: polyline keeps hard route breaks while geometricPrecision keeps edges anti-aliased instead of pixelated. */}
                      <polyline
                        points={routePoints}
                        fill="none"
                        stroke="rgba(0,0,0,.72)"
                        strokeWidth={routeOutlineStroke}
                        strokeLinecap="butt"
                        strokeLinejoin="miter"
                        strokeMiterlimit={10}
                        shapeRendering="geometricPrecision"
                      />
                      <polyline
                        points={routePoints}
                        fill="none"
                        stroke={
                          isSelectedRoute ? "#38bdf8" : routeColorForDisplay
                        }
                        strokeWidth={
                          isSelectedRoute
                            ? Math.max(routeStroke, lineStroke * 1.55)
                            : routeStroke
                        }
                        strokeLinecap="butt"
                        strokeLinejoin="miter"
                        strokeMiterlimit={10}
                        shapeRendering="geometricPrecision"
                      />
                      <polyline
                        points={routePoints}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(2, lineStroke)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="stroke"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectFieldItem({
                            type: "route",
                            id: route.playerId,
                          });
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <line
                        x1={arrow.a.x}
                        y1={arrow.a.y}
                        x2={arrow.last.x}
                        y2={arrow.last.y}
                        stroke="rgba(0,0,0,.72)"
                        strokeWidth={routeOutlineStroke}
                        strokeLinecap="butt"
                        shapeRendering="geometricPrecision"
                      />
                      <line
                        x1={arrow.b.x}
                        y1={arrow.b.y}
                        x2={arrow.last.x}
                        y2={arrow.last.y}
                        stroke="rgba(0,0,0,.72)"
                        strokeWidth={routeOutlineStroke}
                        strokeLinecap="butt"
                        shapeRendering="geometricPrecision"
                      />
                      <line
                        x1={arrow.a.x}
                        y1={arrow.a.y}
                        x2={arrow.last.x}
                        y2={arrow.last.y}
                        stroke={routeColorForDisplay}
                        strokeWidth={routeStroke}
                        strokeLinecap="butt"
                        shapeRendering="geometricPrecision"
                      />
                      <line
                        x1={arrow.b.x}
                        y1={arrow.b.y}
                        x2={arrow.last.x}
                        y2={arrow.last.y}
                        stroke={routeColorForDisplay}
                        strokeWidth={routeStroke}
                        strokeLinecap="butt"
                        shapeRendering="geometricPrecision"
                      />
                    </g>
                  );
                })}
              </svg>

              {defensePlayers.map((player) => (
                <button
                  key={player.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    if (tool === "Move") {
                      setDraggingId(player.id);
                      setDraggingSide("defense");
                    }
                    if (tool === "Draw") startDrawing(e.clientX, e.clientY);
                  }}
                  onClick={() => {
                    setSelectedFieldItem(null);
                    setSelectedPlayerId(player.id);
                    setSelectedSide("defense");
                    setManAssignDefenderId(player.id);
                  }}
                  style={{
                    position: "absolute",
                    width: playerPx,
                    height: playerPx,
                    borderRadius:
  defensiveReadPlayerIds.includes(player.id)
    ? 0
    : player.position === "C"
    ? "4px"
    : "50%",

clipPath:
  defensiveReadPlayerIds.includes(player.id)
    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
    : "none",
                    background: player.color ?? "#dc2626",
                    color: readableTextColor(player.color ?? "#dc2626"),
                    fontWeight: 900,
                    fontSize: playerFontPx,
                    left: `${player.x}%`,
                    top: playerTop(player),
                    transform: `translate(-50%,-50%) scale(${visualPlayerScale})`,
                    transformOrigin: "center center",
                    border:
                      defensiveReadPlayerIds.includes(player.id)
                        ? `${selectedPlayerBorderPx}px solid #a855f7`
                        : selectedSide === "defense" &&
                          selectedPlayerId === player.id
                        ? `${selectedPlayerBorderPx}px solid #facc15`
                        : `${playerBorderPx}px solid black`,
                    cursor:
                      tool === "Move"
                        ? "grab"
                        : tool === "Draw"
                        ? "crosshair"
                        : "pointer",
                    zIndex:
                      selectedSide === "defense" &&
                      selectedPlayerId === player.id
                        ? 2500
                        : 2000,
                    boxShadow: `0 ${playerPx * 0.12}px ${
                      playerPx * 0.38
                    }px rgba(0,0,0,.6)`,
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                >
                  {defensiveReadPlayerIds.includes(player.id) && (
                    <span
                      style={{
                        position: "absolute",
                        top: -playerPx * 0.62,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#a855f7",
                        color: "white",
                        borderRadius: 999,
                        padding: "1px 5px",
                        fontSize: Math.max(6, playerFontPx * 0.68),
                        fontWeight: 950,
                        letterSpacing: ".04em",
                        pointerEvents: "none",
                        boxShadow: "0 4px 10px rgba(0,0,0,.45)",
                      }}
                    >
                      READ
                    </span>
                  )}
                  {player.position}
                </button>
              ))}
              {offensePlayers.map((player) => (
                <button
                  key={player.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    if (tool === "Move") {
                      setDraggingId(player.id);
                      setDraggingSide("offense");
                    }
                    if (tool === "Draw") startDrawing(e.clientX, e.clientY);
                  }}
                  onClick={() => {
                    if (tool === "Man") {
                      setManAssignOffenseId(player.id);
                     const nextAssignments = {
  ...manAssignments,
  [manAssignDefenderId]: player.id,
};

setManAssignments(nextAssignments);

realtimeChannelRef.current?.send({
  type: "broadcast",
  event: "board-event",
  payload: {
    type: "SET_MAN_ASSIGNMENTS",
    manAssignments: nextAssignments,
  },
});
                      return;
                    }
                    setSelectedFieldItem(null);
                    setSelectedPlayerId(player.id);
                    setSelectedSide("offense");
                    const existing = routes.find(
                      (r) => r.playerId === player.id
                    );
                    if (existing) {
                      setRouteType(existing.routeType);
                      setBreakDepth(existing.breakDepth);
                      setFinishDepth(existing.finishDepth);
                      setRouteColor(
                        existing.color ?? player.color ?? "#facc15"
                      );
                    } else {
                      setRouteColor(player.color ?? "#facc15");
                    }
                  }}
                  style={{
                    position: "absolute",
                    width: playerPx,
                    height: playerPx,
                    borderRadius: "50%",
                    background: player.color ?? "#f3f4f6",
                    color: readableTextColor(player.color ?? "#f3f4f6"),
                    fontWeight: 900,
                    fontSize: playerFontPx,
                    left: `${player.x}%`,
                    top:
  fieldFullscreen && player.side === "offense" && player.onLOS
    ? `calc(${playerTop(player)} + ${visualPlayerPx / 4}px)`
    : playerTop(player),
                    transform: `translate(-50%,-50%) scale(${visualPlayerScale})`,
                    transformOrigin: "center center",
                    border:
                      selectedSide === "offense" &&
                      selectedPlayerId === player.id
                        ? `${selectedPlayerBorderPx}px solid #facc15`
                        : `${playerBorderPx}px solid black`,
                    cursor:
                      tool === "Move"
                        ? "grab"
                        : tool === "Draw"
                        ? "crosshair"
                        : "pointer",
                    zIndex:
                      selectedSide === "offense" &&
                      selectedPlayerId === player.id
                        ? 2500
                        : 2000,
                    boxShadow: `0 ${playerPx * 0.12}px ${
                      playerPx * 0.38
                    }px rgba(0,0,0,.6)`,
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                >
                  {player.position}
                </button>
              ))}
            </div>
          </div>

          {showCreateOffenseSet && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Create Offensive Set
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Move the offensive players, name the set, then save it. This
                panel stays open so you can create sets back-to-back.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 6,
                }}
              >
                <input
                  value={customPresetName}
                  onChange={(e) => setCustomPresetName(e.target.value)}
                  placeholder="Example: Gun Trips Bunch"
                  style={{
                    width: "100%",
                    background: "#090b10",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    color: "white",
                    padding: "10px 12px",
                  }}
                />
                <button
                  style={{
                    ...buttonBase,
                    background: "#dc2626",
                    color: "white",
                  }}
                  onClick={saveCustomOffensePreset}
                >
                  Save Set
                </button>
              </div>
            </div>
          )}

          {showManageOffenseSets && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Manage Offensive Sets
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                System presets always reload for new users. Your custom presets
                save only in your browser. Drag Top 5 cards to reorder them.
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div style={{ color: "#d1d5db", fontSize: 12 }}>
                  SYSTEM = base app preset · MY = coach-created preset
                </div>
                <button
                  style={{
                    ...buttonBase,
                    background: "#7f1111",
                    color: "white",
                    padding: "8px 10px",
                  }}
                  onClick={resetToSystemPresets}
                >
                  Reset to System
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {sortedOffensePresets.map((preset) => (
                  <div
                    key={preset.id}
                    draggable={!!preset.isMain}
                    onDragStart={() => setDraggedTopPresetId(preset.id)}
                    onDragOver={(e) => {
                      if (preset.isMain) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (draggedTopPresetId && preset.isMain)
                        reorderTopFive(draggedTopPresetId, preset.id);
                      setDraggedTopPresetId(null);
                    }}
                    onDragEnd={() => setDraggedTopPresetId(null)}
                    style={{
                      background: "#090b10",
                      borderRadius: 12,
                      padding: 8,
                      display: "grid",
                      gap: 6,
                      opacity: draggedTopPresetId === preset.id ? 0.55 : 1,
                      border: preset.isMain
                        ? "1px solid rgba(37,99,235,.7)"
                        : "1px solid rgba(255,255,255,.08)",
                      cursor: preset.isMain ? "grab" : "default",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <input
                        disabled={preset.isSystem}
                        value={preset.name}
                        onChange={(e) =>
                          renameCustomOffensePreset(preset.id, e.target.value)
                        }
                        style={{
                          width: "100%",
                          background: "#090b10",
                          border: "1px solid rgba(255,255,255,.12)",
                          borderRadius: 8,
                          color: "white",
                          padding: "8px 10px",
                          opacity: preset.isSystem ? 0.7 : 1,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          background: preset.isSystem ? "#ef4444" : "#b91c1c",
                          color: "white",
                          borderRadius: 999,
                          padding: "4px 7px",
                          fontWeight: 800,
                        }}
                      >
                        {preset.isSystem ? "SYSTEM" : "MY"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: preset.isMain ? "#dc2626" : "#2a303b",
                          color: "white",
                        }}
                        onClick={() => toggleMainOffensePreset(preset.id)}
                      >
                        {preset.isMain ? "Remove Top 5" : "Add Top 5"}
                      </button>
                      <button
                        disabled={preset.isSystem}
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: preset.isSystem ? "#1f242e" : "#2a303b",
                          color: "white",
                          opacity: preset.isSystem ? 0.55 : 1,
                        }}
                        onClick={() => overwriteCustomOffensePreset(preset.id)}
                      >
                        Update
                      </button>
                      <button
                        disabled={preset.isSystem}
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: preset.isSystem ? "#1f242e" : "#7f1111",
                          color: "white",
                          opacity: preset.isSystem ? 0.55 : 1,
                        }}
                        onClick={() => deleteCustomOffensePreset(preset.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showCreatePlay && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Create Play</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Save the whole board: offense, defense, routes, blocking, and
                drawing lines.
              </div>
              <div
                style={{
                  background: "#090b10",
                  borderRadius: 12,
                  padding: "10px 12px",
                  color: "#d1d5db",
                  fontSize: 13,
                }}
              >
                Saving under formation:{" "}
                <strong style={{ color: "white" }}>
                  {activeFormation?.name ?? "No formation selected"}
                </strong>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 6,
                }}
              >
                <input
                  value={savedPlayName}
                  onChange={(e) => setSavedPlayName(e.target.value)}
                  placeholder="Example: Y Corner"
                  style={{
                    width: "100%",
                    background: "#090b10",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    color: "white",
                    padding: "10px 12px",
                  }}
                />
                <button
                  style={{
                    ...buttonBase,
                    background: "#dc2626",
                    color: "white",
                  }}
                  onClick={savePlay}
                >
                  Save Play
                </button>
              </div>
            </div>
          )}

          {showManagePlays && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Manage Plays</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                No system play presets are included. Coaches only see plays they
                create. Assign each play to a formation so it appears correctly
                inside playbooks.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {savedPlays.map((play) => (
                  <div
                    key={play.id}
                    style={{
                      background: "#090b10",
                      borderRadius: 12,
                      padding: 8,
                      display: "grid",
                      gap: 6,
                      border: play.preloadOnOpen
                        ? "1px solid rgba(34,197,94,.8)"
                        : "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <input
                      value={play.name}
                      onChange={(e) => renamePlay(play.id, e.target.value)}
                      style={{
                        width: "100%",
                        background: "#090b10",
                        border: "1px solid rgba(255,255,255,.12)",
                        borderRadius: 8,
                        color: "white",
                        padding: "8px 10px",
                      }}
                    />
                    <select
                      value={play.formationId ?? ""}
                      onChange={(e) =>
                        setSavedPlays((current) =>
                          current.map((p) =>
                            p.id === play.id
                              ? {
                                  ...p,
                                  formationId: e.target.value || undefined,
                                }
                              : p
                          )
                        )
                      }
                      style={{
                        width: "100%",
                        background: "#090b10",
                        border: "1px solid rgba(255,255,255,.12)",
                        borderRadius: 8,
                        color: "white",
                        padding: "8px 10px",
                      }}
                    >
                      <option value="">No Formation</option>
                      {sortedOffensePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: play.preloadOnOpen
                            ? "#b91c1c"
                            : "#2a303b",
                          color: "white",
                        }}
                        onClick={() => setPlayPreload(play.id)}
                      >
                        {play.preloadOnOpen ? "Preload" : "Set Preload"}
                      </button>
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: "#dc2626",
                          color: "white",
                        }}
                        onClick={() => loadPlay(play.id)}
                      >
                        Load
                      </button>
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: "#2a303b",
                          color: "white",
                        }}
                        onClick={() => overwritePlay(play.id)}
                      >
                        Update
                      </button>
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: "#7f1111",
                          color: "white",
                        }}
                        onClick={() => deletePlay(play.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showCreateConcept && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Create Play Concept
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Draw routes on the current formation, then save the
                responsibilities by player label. Example: X always runs Go, Y
                always runs Corner, no matter where they line up.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 6,
                }}
              >
                <input
                  value={conceptName}
                  onChange={(e) => setConceptName(e.target.value)}
                  placeholder="Example: Y Corner Concept"
                  style={{
                    width: "100%",
                    background: "#090b10",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    color: "white",
                    padding: "10px 12px",
                  }}
                />
                <button
                  style={{
                    ...buttonBase,
                    background: "#dc2626",
                    color: "white",
                  }}
                  onClick={saveConcept}
                >
                  Save Concept
                </button>
              </div>
            </div>
          )}

          {showManageConcepts && (
            <div style={{ ...cardStyle, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Manage Concepts
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Apply a concept to any loaded formation. The app matches
                responsibilities by player label.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {playConcepts.map((concept) => (
                  <div
                    key={concept.id}
                    style={{
                      background: "#090b10",
                      borderRadius: 12,
                      padding: 8,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <input
                      value={concept.name}
                      onChange={(e) =>
                        renameConcept(concept.id, e.target.value)
                      }
                      style={{
                        width: "100%",
                        background: "#090b10",
                        border: "1px solid rgba(255,255,255,.12)",
                        borderRadius: 8,
                        color: "white",
                        padding: "8px 10px",
                      }}
                    />
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      {concept.assignments
                        .map(
                          (a) =>
                            `${a.playerLabel}: ${
                              a.type === "route"
                                ? a.routeType
                                : a.type.toUpperCase()
                            }`
                        )
                        .join(" · ")}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: "#dc2626",
                          color: "white",
                        }}
                        onClick={() => applyConcept(concept.id)}
                      >
                        Apply
                      </button>
                      <button
                        style={{
                          ...buttonBase,
                          padding: "8px",
                          background: "#7f1111",
                          color: "white",
                        }}
                        onClick={() => deleteConcept(concept.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showTeamSetup && (
            <div
              style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>Team Setup</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Customize team identity, field template, and team size. View
                switching is now under Coach Tools.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  School Name
                  <input
                    value={teamBranding.schoolName}
                    onChange={(e) =>
                      setTeamBranding((current) => ({
                        ...current,
                        schoolName: e.target.value.toUpperCase(),
                      }))
                    }
                    style={{
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                      color: "white",
                      padding: "10px 12px",
                    }}
                  />
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  Mascot / End Zone Text
                  <input
                    value={teamBranding.mascot}
                    onChange={(e) =>
                      setTeamBranding((current) => ({
                        ...current,
                        mascot: e.target.value.toUpperCase(),
                      }))
                    }
                    style={{
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                      color: "white",
                      padding: "10px 12px",
                    }}
                  />
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  Primary / End Zone Color
                  <input
                    type="color"
                    value={teamBranding.primaryColor}
                    onChange={(e) =>
                      setTeamBranding((current) => ({
                        ...current,
                        primaryColor: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: 42,
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                    }}
                  />
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  Field Color
                  <input
                    type="color"
                    value={teamBranding.secondaryColor}
                    onChange={(e) =>
                      setTeamBranding((current) => ({
                        ...current,
                        secondaryColor: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: 42,
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                    }}
                  />
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  End Zone Text Color
                  <input
                    type="color"
                    value={teamBranding.endzoneTextColor}
                    onChange={(e) =>
                      setTeamBranding((current) => ({
                        ...current,
                        endzoneTextColor: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      height: 42,
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                    }}
                  />
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  Field Template
                  <select
                    value={fieldTemplate}
                    onChange={(e) =>
                      setFieldTemplate(e.target.value as FieldTemplate)
                    }
                    style={{
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                      color: "white",
                      padding: "10px 12px",
                      height: 42,
                    }}
                  >
                    {Object.entries(FIELD_HASH_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  style={{
                    display: "grid",
                    gap: 6,
                    color: "#d1d5db",
                    fontSize: 13,
                  }}
                >
                  Team Size
                  <select
                    value={footballTeamSize}
                    onChange={(e) =>
                      applyFootballTeamSize(e.target.value as FootballTeamSize)
                    }
                    style={{
                      background: "#090b10",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                      color: "white",
                      padding: "10px 12px",
                      height: 42,
                    }}
                  >
                    {Object.entries(FOOTBALL_TEAM_SIZE_OPTIONS).map(
                      ([key, option]) => (
                        <option key={key} value={key}>
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "#d1d5db",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  Current field:{" "}
                  <strong style={{ color: "white" }}>
                    {activeFieldHash.label}
                  </strong>{" "}
                  — {activeFieldHash.description}
                </div>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "rgba(220,38,38,.10)",
                    border: "1px solid rgba(248,113,113,.20)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    color: "#d1d5db",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  Current team size:{" "}
                  <strong style={{ color: "white" }}>
                    {FOOTBALL_TEAM_SIZE_OPTIONS[footballTeamSize].label}
                  </strong>{" "}
                  — {FOOTBALL_TEAM_SIZE_OPTIONS[footballTeamSize].description}
                </div>
              </div>
              <button
                onClick={resetTeamBranding}
                style={{
                  ...buttonBase,
                  background: "#090b10",
                  color: "white",
                  width: "fit-content",
                }}
              >
                Reset to CoachBoard Default
              </button>
            </div>
          )}

          {showGamePlan && (
            <div
              style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Game Plan Mode
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Build a call sheet/script from saved plays, then load them in
                order.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 6,
                }}
              >
                <input
                  value={gamePlanName}
                  onChange={(e) => setGamePlanName(e.target.value)}
                  placeholder="Example: Friday Night Script"
                  style={{
                    width: "100%",
                    background: "#090b10",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    color: "white",
                    padding: "10px 12px",
                  }}
                />
                <button
                  style={{
                    ...buttonBase,
                    background: "#dc2626",
                    color: "white",
                  }}
                  onClick={createGamePlan}
                >
                  Create
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  {gamePlans.map((plan) => (
                    <button
                      key={plan.id}
                      style={{
                        ...buttonBase,
                        background:
                          selectedGamePlanId === plan.id
                            ? "#dc2626"
                            : "#090b10",
                        color: "white",
                        textAlign: "left",
                      }}
                      onClick={() => {
                        setSelectedGamePlanId(plan.id);
                        setCurrentGamePlanIndex(0);
                      }}
                    >
                      📋 {plan.name}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    background: "#090b10",
                    borderRadius: 16,
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  {(() => {
                    const selectedPlan = gamePlans.find(
                      (plan) => plan.id === selectedGamePlanId
                    );
                    if (!selectedPlan)
                      return (
                        <div style={{ color: "#9ca3af" }}>
                          Select or create a game plan.
                        </div>
                      );
                    const currentPlay = savedPlays.find(
                      (play) =>
                        play.id === selectedPlan.playIds[currentGamePlanIndex]
                    );

                    return (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 8,
                          }}
                        >
                          <input
                            value={selectedPlan.name}
                            onChange={(e) =>
                              renameGamePlan(selectedPlan.id, e.target.value)
                            }
                            style={{
                              width: "100%",
                              background: "#090b10",
                              border: "1px solid rgba(255,255,255,.12)",
                              borderRadius: 10,
                              color: "white",
                              padding: "8px 10px",
                              fontWeight: 800,
                            }}
                          />
                          <button
                            style={{
                              ...buttonBase,
                              background: "#7f1111",
                              color: "white",
                              padding: "8px 10px",
                            }}
                            onClick={() => deleteGamePlan(selectedPlan.id)}
                          >
                            Delete
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr auto",
                            gap: 8,
                            alignItems: "center",
                            background: "#090b10",
                            borderRadius: 14,
                            padding: "5px 8px",
                          }}
                        >
                          <button
                            style={{
                              ...buttonBase,
                              background: "#1f242e",
                              color: "white",
                            }}
                            onClick={previousGamePlanPlay}
                          >
                            ◀
                          </button>
                          <div style={{ textAlign: "center", fontWeight: 800 }}>
                            {currentPlay
                              ? `${currentGamePlanIndex + 1}. ${
                                  currentPlay.name
                                }`
                              : "No play loaded"}
                          </div>
                          <button
                            style={{
                              ...buttonBase,
                              background: "#1f242e",
                              color: "white",
                            }}
                            onClick={nextGamePlanPlay}
                          >
                            ▶
                          </button>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            fontWeight: 800,
                          }}
                        >
                          ADD SAVED PLAYS
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 6,
                          }}
                        >
                          {savedPlays.map((play) => {
                            const added = selectedPlan.playIds.includes(
                              play.id
                            );
                            return (
                              <button
                                key={play.id}
                                style={{
                                  ...buttonBase,
                                  background: added ? "#dc2626" : "#1f242e",
                                  color: "white",
                                  textAlign: "left",
                                  padding: "8px",
                                }}
                                onClick={() =>
                                  togglePlayInGamePlan(selectedPlan.id, play.id)
                                }
                              >
                                {added ? "✓ " : "+ "}
                                {play.name}
                              </button>
                            );
                          })}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            fontWeight: 800,
                          }}
                        >
                          SCRIPT ORDER
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {selectedPlan.playIds.map((playId, index) => {
                            const play = savedPlays.find(
                              (item) => item.id === playId
                            );
                            if (!play) return null;
                            return (
                              <div
                                key={playId}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto auto auto",
                                  gap: 6,
                                  alignItems: "center",
                                  background:
                                    currentGamePlanIndex === index
                                      ? "#0f172a"
                                      : "#090b10",
                                  borderRadius: 10,
                                  padding: 6,
                                }}
                              >
                                <button
                                  style={{
                                    ...buttonBase,
                                    background:
                                      currentGamePlanIndex === index
                                        ? "#dc2626"
                                        : "#090b10",
                                    color: "white",
                                    textAlign: "left",
                                  }}
                                  onClick={() => loadGamePlanPlay(index)}
                                >
                                  {index + 1}. {play.name}
                                </button>
                                <button
                                  style={{
                                    ...buttonBase,
                                    background: "#1f242e",
                                    color: "white",
                                    padding: "8px",
                                  }}
                                  onClick={() =>
                                    moveGamePlanPlay(
                                      selectedPlan.id,
                                      playId,
                                      "up"
                                    )
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  style={{
                                    ...buttonBase,
                                    background: "#1f242e",
                                    color: "white",
                                    padding: "8px",
                                  }}
                                  onClick={() =>
                                    moveGamePlanPlay(
                                      selectedPlan.id,
                                      playId,
                                      "down"
                                    )
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  style={{
                                    ...buttonBase,
                                    background: "#7f1111",
                                    color: "white",
                                    padding: "8px",
                                  }}
                                  onClick={() =>
                                    togglePlayInGamePlan(
                                      selectedPlan.id,
                                      playId
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {showPlaybooks && (
            <div
              style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}
            >
              <div style={{ fontSize: 18, fontWeight: 800 }}>Playbooks</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Open a playbook folder, view formations inside it, then load
                plays under each formation.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 6,
                }}
              >
                <input
                  value={playbookName}
                  onChange={(e) => setPlaybookName(e.target.value)}
                  placeholder="Example: Varsity Offense"
                  style={{
                    width: "100%",
                    background: "#090b10",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    color: "white",
                    padding: "10px 12px",
                  }}
                />
                <button
                  style={{
                    ...buttonBase,
                    background: "#dc2626",
                    color: "white",
                  }}
                  onClick={createPlaybook}
                >
                  Create Playbook
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  {playbooks.map((book) => (
                    <button
                      key={book.id}
                      style={{
                        ...buttonBase,
                        background:
                          selectedPlaybookId === book.id
                            ? "#dc2626"
                            : "#090b10",
                        color: "white",
                        textAlign: "left",
                      }}
                      onClick={() => setSelectedPlaybookId(book.id)}
                    >
                      📁 {book.name}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    background: "#090b10",
                    borderRadius: 16,
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  {!selectedPlaybook ? (
                    <div style={{ color: "#9ca3af" }}>
                      Select or create a playbook folder.
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: 8,
                        }}
                      >
                        <input
                          value={selectedPlaybook.name}
                          onChange={(e) =>
                            renamePlaybook(selectedPlaybook.id, e.target.value)
                          }
                          style={{
                            width: "100%",
                            background: "#090b10",
                            border: "1px solid rgba(255,255,255,.12)",
                            borderRadius: 10,
                            color: "white",
                            padding: "8px 10px",
                            fontWeight: 800,
                          }}
                        />
                        <button
                          style={{
                            ...buttonBase,
                            background: "#b91c1c",
                            color: "white",
                            padding: "8px 10px",
                          }}
                          onClick={() =>
                            autoGeneratePlaybookPlays(selectedPlaybook.id)
                          }
                        >
                          Auto Generate Plays
                        </button>
                        <button
                          style={{
                            ...buttonBase,
                            background: "#7f1111",
                            color: "white",
                            padding: "8px 10px",
                          }}
                          onClick={() => deletePlaybook(selectedPlaybook.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          fontWeight: 800,
                        }}
                      >
                        ADD FORMATIONS TO THIS PLAYBOOK
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 6,
                        }}
                      >
                        {sortedOffensePresets.map((formation) => {
                          const added = selectedPlaybook.formationIds.includes(
                            formation.id
                          );
                        useEffect(() => {
  const channel = supabase.channel("test-room");

  channel.on("broadcast", { event: "test" }, (payload) => {
    console.log("SUPABASE MESSAGE:", payload);
  });

  channel.subscribe((status) => {
    console.log("SUPABASE STATUS:", status);

    if (status === "SUBSCRIBED") {
      channel.send({
        type: "broadcast",
        event: "test",
        payload: {
          message: "hello from coachboard",
        },
      });
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
                          return (
                            <button
                              key={formation.id}
                              style={{
                                ...buttonBase,
                                padding: "8px",
                                background: added ? "#dc2626" : "#1f242e",
                                color: "white",
                              }}
                              onClick={() =>
                                toggleFormationInPlaybook(
                                  selectedPlaybook.id,
                                  formation.id
                                )
                              }
                            >
                              {added ? "✓ " : "+ "}
                              {formation.name}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          fontWeight: 800,
                        }}
                      >
                        PLAYBOOK CONTENTS
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {selectedPlaybook.formationIds.map((formationId) => {
                          const formation = customOffensePresets.find(
                            (p) => p.id === formationId
                          );
                          const formationPlays = savedPlays.filter(
                            (play) => play.formationId === formationId
                          );
                          if (!formation) return null;

                          return (
                            <div
                              key={formationId}
                              style={{
                                background: "#090b10",
                                borderRadius: 14,
                                padding: "5px 8px",
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto",
                                  gap: 6,
                                }}
                              >
                                <button
                                  style={{
                                    ...buttonBase,
                                    background:
                                      selectedPlayFormationId === formationId
                                        ? "#dc2626"
                                        : "#2a303b",
                                    color: "white",
                                    textAlign: "left",
                                  }}
                                  onClick={() =>
                                    loadCustomOffensePreset(formationId)
                                  }
                                >
                                  🏈 {formation.name}
                                </button>
                                <button
                                  style={{
                                    ...buttonBase,
                                    background: "#b91c1c",
                                    color: "white",
                                    padding: "8px 10px",
                                  }}
                                  onClick={() => {
                                    loadCustomOffensePreset(formationId);
                                    setShowCreatePlay(true);
                                  }}
                                >
                                  + Play
                                </button>
                                <button
                                  style={{
                                    ...buttonBase,
                                    background: "#ef4444",
                                    color: "white",
                                    padding: "8px 10px",
                                  }}
                                  onClick={() => {
                                    loadCustomOffensePreset(formationId);
                                    setShowManageConcepts(true);
                                  }}
                                >
                                  + Concept
                                </button>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#9ca3af",
                                  fontWeight: 800,
                                }}
                              >
                                CONCEPTS
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: 6,
                                }}
                              >
                                {playConcepts.map((concept) => {
                                  const conceptIds =
                                    selectedPlaybook.formationConcepts?.[
                                      formationId
                                    ] ?? [];
                                  const added = conceptIds.includes(concept.id);
                                  return (
                                    <button
                                      key={concept.id}
                                      style={{
                                        ...buttonBase,
                                        background: added
                                          ? "#991b1b"
                                          : "#1f242e",
                                        color: "white",
                                        textAlign: "left",
                                        padding: "8px",
                                      }}
                                      onClick={() =>
                                        toggleConceptInFormation(
                                          selectedPlaybook.id,
                                          formationId,
                                          concept.id
                                        )
                                      }
                                    >
                                      {added ? "✓ " : "+ "}
                                      {concept.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {(
                                selectedPlaybook.formationConcepts?.[
                                  formationId
                                ] ?? []
                              ).length > 0 && (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, 1fr)",
                                    gap: 6,
                                  }}
                                >
                                  {(
                                    selectedPlaybook.formationConcepts?.[
                                      formationId
                                    ] ?? []
                                  ).map((conceptId) => {
                                    const concept = playConcepts.find(
                                      (c) => c.id === conceptId
                                    );
                                    if (!concept) return null;
                                    return (
                                      <button
                                        key={concept.id}
                                        style={{
                                          ...buttonBase,
                                          background: "#7f1d1d",
                                          color: "white",
                                          textAlign: "left",
                                          padding: "8px",
                                        }}
                                        onClick={() => {
                                          loadCustomOffensePreset(formationId);
                                          applyConcept(concept.id);
                                        }}
                                      >
                                        🧠 {concept.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: 6,
                                }}
                              >
                                {(
                                  selectedPlaybook.formationConcepts?.[
                                    formationId
                                  ] ?? []
                                ).map((conceptId) => {
                                  const concept = playConcepts.find(
                                    (c) => c.id === conceptId
                                  );
                                  if (!concept) return null;
                            
                                  return (
                                    <button
                                      key={`${concept.id}-generate`}
                                      style={{
                                        ...buttonBase,
                                        background: "#b91c1c",
                                        color: "white",
                                        textAlign: "left",
                                        padding: "8px",
                                      }}
                                      onClick={() =>
                                        generatePlayFromConcept(
                                          formationId,
                                          concept.id
                                        )
                                      }
                                    >
                                      Generate: {concept.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {formationPlays.length === 0 ? (
                                <div style={{ color: "#9ca3af", fontSize: 13 }}>
                                  No saved plays under this formation yet.
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, 1fr)",
                                    gap: 6,
                                  }}
                                >
                                  {formationPlays.map((play) => (
                                    <button
                                      key={play.id}
                                      style={{
                                        ...buttonBase,
                                        background: "#090b10",
                                        color: "white",
                                        textAlign: "left",
                                      }}
                                      onClick={() => loadPlay(play.id)}
                                    >
                                      ↳ {play.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {!fieldFullscreen && (
          <div
            style={{
              ...cardStyle,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {playerPanelContent}
          </div>
        )}
      </div>
        </div>        
             {showGamedayRoom && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.65)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        width: 420,
        background: "rgba(2,8,23,.95)",
        border: "1px solid rgba(255,255,255,.14)",
        borderRadius: 22,
        padding: 24,
        color: "white",
      }}
    >
      <h2>Gameday Room</h2>

      <input
        value={coachName}
        onChange={(e) => setCoachName(e.target.value)}
        placeholder="Coach name"
        style={{ width: "100%", padding: 12, marginBottom: 10, color: "black" }}
      />

      <input
        value={teamCodeInput}
        onChange={(e) => setTeamCodeInput(e.target.value)}
        placeholder="Room code"
        style={{ width: "100%", padding: 12, marginBottom: 12, color: "black" }}
      />

      <button
        onClick={() => {
          const cleaned = teamCodeInput.trim().toLowerCase().replace(/\s+/g, "-");
          if (!cleaned || !coachName.trim()) return;

          localStorage.setItem("coachboard_team_code", cleaned);
          localStorage.setItem("coachboard_coach_name", coachName.trim());

          setTeamCode(cleaned);
          setRoomMembers((current) => [...new Set([...current, coachName.trim()])]);
          setShowGamedayRoom(false);
        }}
        style={{ width: "100%", padding: 12, marginBottom: 10 }}
      >
        Enter Room
      </button>

      <button
        onClick={() => setShowGamedayRoom(false)}
        style={{ width: "100%", padding: 12 }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
      </>
  );
}  

export default CoachBoardWebApp;
