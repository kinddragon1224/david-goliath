import { LEADERBOARD_KEEP, SCORES_KEY } from "./constants";

export type InputVia = "webcam" | "pointer";

export type ScoreRecord = {
  score: number;
  at: number;
  via?: InputVia;
};

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
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, LEADERBOARD_KEEP);
    if (rows.length !== (parsed as unknown[]).length) saveScores(rows);
    return rows;
  } catch {
    return [];
  }
}

export function saveScores(rows: ScoreRecord[]): void {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(rows.slice(0, LEADERBOARD_KEEP)));
  } catch {
    /* storage full or blocked — the round still ends */
  }
}

export function addScore(score: number, via: InputVia): { list: ScoreRecord[]; rank: number } {
  const at = Date.now();
  try {
    const all = [...loadScores(), { score, at, via }].sort((a, b) => b.score - a.score || b.at - a.at);
    const rank = all.findIndex((r) => r.at === at) + 1;
    const list = all.slice(0, LEADERBOARD_KEEP);
    saveScores(list);
    return { list, rank: rank > 0 && rank <= LEADERBOARD_KEEP ? rank : 0 };
  } catch {
    return { list: loadScores(), rank: 0 };
  }
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
