import { LEADERBOARD_KEEP, NAME_RANK_LIMIT, SCORES_KEY } from "./constants";
import { RULESET_VERSION } from "./rules";

export type InputVia = "webcam" | "pointer";

export type ScoreRecord = {
  score: number;
  /** 기록 시각(ms). 기록을 가리키는 키로도 쓴다. */
  at: number;
  via?: InputVia;
  ruleset?: number;
  /** 결과 화면에서 남긴 이름. 없으면 이름 없는 기록. */
  name?: string;
};

const byScore = (a: ScoreRecord, b: ScoreRecord) => b.score - a.score || a.at - b.at;

/** 저장된 기록 전체(최신 LEADERBOARD_KEEP개). 점수 높은 순. */
export function loadScores(): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rows = parsed
      .filter(
        (row): row is ScoreRecord =>
          !!row &&
          typeof row === "object" &&
          typeof (row as ScoreRecord).score === "number" &&
          typeof (row as ScoreRecord).at === "number",
      )
      .filter((row) => row.via !== "pointer")
      .map((row) => (typeof row.name === "string" ? { ...row, name: cleanName(row.name) || undefined } : row));
    if (rows.length !== (parsed as unknown[]).length) saveScores(rows);
    return rows.sort(byScore);
  } catch {
    return [];
  }
}

/** 오래된 기록부터 버린다. 지난달 1등이 새 기록에 밀려 사라지지 않게 점수가 아니라 시각으로 자른다. */
export function saveScores(rows: ScoreRecord[]): void {
  try {
    const keep = [...rows].sort((a, b) => b.at - a.at).slice(0, LEADERBOARD_KEEP);
    localStorage.setItem(SCORES_KEY, JSON.stringify(keep));
  } catch {
    /* storage full or blocked — the round still ends */
  }
}

export function addScore(score: number, via: InputVia): { list: ScoreRecord[]; rank: number; monthRank: number; at: number } {
  const at = Date.now();
  try {
    const all = [...loadScores(), { score, at, via, ruleset: RULESET_VERSION }];
    saveScores(all);
    const list = all.sort(byScore);
    const rank = list.findIndex((r) => r.at === at) + 1;
    const monthRank = monthlyRows(list, monthKey(at)).findIndex((r) => r.at === at) + 1;
    return { list, rank, monthRank, at };
  } catch {
    return { list: loadScores(), rank: 0, monthRank: 0, at };
  }
}

export function setScoreName(at: number, name: string): ScoreRecord[] {
  const clean = cleanName(name);
  const rows = loadScores().map((r) => (r.at === at ? { ...r, name: clean || undefined } : r));
  saveScores(rows);
  return rows.sort(byScore);
}

export function deleteScore(at: number): ScoreRecord[] {
  const rows = loadScores().filter((r) => r.at !== at);
  saveScores(rows);
  return rows;
}

export function clearScores(): ScoreRecord[] {
  saveScores([]);
  return [];
}

/** "2026-10" 같은 달 키. 키오스크 시계(한국 시간) 기준. */
export function monthKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d.getTime());
}

export function monthlyRows(rows: ScoreRecord[], key: string): ScoreRecord[] {
  return rows.filter((r) => monthKey(r.at) === key).sort(byScore);
}

/** 이 점수가 이달 이름을 남길 만한 순위인가. */
export function qualifiesForName(monthRank: number, score: number): boolean {
  return score > 0 && monthRank > 0 && monthRank <= NAME_RANK_LIMIT;
}

export function cleanName(name: string): string {
  return [...name]
    .filter((ch) => ch >= " " && ch !== "<" && ch !== ">")
    .join("")
    .trim()
    .slice(0, 8);
}

export function formatScoreDate(at: number): string {
  return new Date(at).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 시상용 명단. 엑셀에서 한글이 깨지지 않게 BOM을 붙인다. */
export function monthCsv(rows: ScoreRecord[], key: string): string {
  const lines = [["순위", "이름", "점수", "일시"].join(",")];
  monthlyRows(rows, key).forEach((r, i) => {
    const when = new Date(r.at).toLocaleString("ko-KR");
    const name = (r.name ?? "(이름 없음)").replace(/"/g, '""');
    lines.push([i + 1, `"${name}"`, r.score, `"${when}"`].join(","));
  });
  return "﻿" + lines.join("\r\n");
}
