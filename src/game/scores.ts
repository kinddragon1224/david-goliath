import { LEADERBOARD_KEEP, SCORES_KEY } from "./constants";

export type ScoreRecord = {
  score: number;
  at: number;
};

export function loadScores(): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is ScoreRecord =>
          !!row &&
          typeof row === "object" &&
          typeof (row as ScoreRecord).score === "number" &&
          typeof (row as ScoreRecord).at === "number",
      )
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, LEADERBOARD_KEEP);
  } catch {
    return [];
  }
}

export function saveScores(rows: ScoreRecord[]): void {
  localStorage.setItem(SCORES_KEY, JSON.stringify(rows.slice(0, LEADERBOARD_KEEP)));
}

export function addScore(score: number): { list: ScoreRecord[]; rank: number } {
  const at = Date.now();
  const list = [...loadScores(), { score, at }]
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, LEADERBOARD_KEEP);
  saveScores(list);
  const rank = list.findIndex((r) => r.at === at) + 1;
  return { list, rank: rank > 0 ? rank : list.length };
}

export function clearScores(): ScoreRecord[] {
  saveScores([]);
  return [];
}

export function formatScoreDate(at: number): string {
  return new Date(at).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
