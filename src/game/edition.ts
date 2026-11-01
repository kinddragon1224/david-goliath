/** 납품처별 판(에디션). 게임은 같고, 행사장 이름·로고·성경 말씀만 다르다.
 *
 * 빌드할 때 VITE_EDITION 으로 고른다(기본은 church).
 *   npm run build:offline            → 모두애교회판
 *   npm run build:offline:general    → 행사장판(교회·말씀 없음)
 * 새 납품처가 생기면 아래에 한 판을 추가하면 된다.
 */

export type EditionId = "church" | "general";

export type Edition = {
  id: EditionId;
  /** 브라우저 제목·설치 안내 첫 줄. */
  appName: string;
  /** 제목 아래 표시할 행사장·기관 이름. 없으면 안내 문구를 쓴다. */
  venueName: string | null;
  /** 둥근 로고 배지 그림(public 기준). 없으면 배지를 빼고 제목만. */
  venueLogo: string | null;
  /** 대기·결과 화면에 성경 말씀을 보일지. 아니면 "게임 방법"을 보인다. */
  showVerses: boolean;
  /** 점수 기록 저장 이름. 판마다 따로 저장해 기록이 섞이지 않게. */
  scoresKey: string;
  /** 순위판 옆 짧은 문구와 이름 입력 화면 문구. 시상이 없는 행사장은 도전 문구로. */
  boardTag: string;
  nameTag: string;
};

/** 빌드할 때 글자 그대로 바뀌어, 고르지 않은 판의 내용(교회 이름·로고·말씀)은 결과물에 아예 안 들어간다. */
export const EDITION_ID: EditionId = import.meta.env.VITE_EDITION === "general" ? "general" : "church";

/** 성경 말씀을 보일지. 상수라서 행사장판에서는 말씀 본문이 빌드에서 빠진다. */
export const SHOW_VERSES = EDITION_ID === "church";

export const EDITION: Edition =
  EDITION_ID === "general"
    ? {
        id: "general",
        appName: "다윗과 골리앗 · 모션 돌 던지기",
        venueName: null,
        venueLogo: null,
        showVerses: false,
        scoresKey: "david-goliath-scores-general-v1",
        boardTag: "최고 점수에 도전!",
        nameTag: "이달의 용사로 이름을 올려 보세요!",
      }
    : {
        id: "church",
        appName: "다윗과 골리앗 · 모두애침례교회",
        venueName: "모두애침례교회",
        venueLogo: "/logo-alllove.jpg",
        showVerses: true,
        // 예전부터 쓰던 이름 그대로: 현장의 기존 기록을 이어 쓴다
        scoresKey: "alllove-david-goliath-scores-v2",
        boardTag: "매달 1등에게 선물!",
        nameTag: "매달 1등에게 선물이 있어요!",
      };
