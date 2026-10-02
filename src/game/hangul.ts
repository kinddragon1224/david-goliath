/** 화면 자판용 한글 조합. 두벌식처럼 자모를 하나씩 넣으면 글자로 묶는다.
 * 키오스크에 실제 키보드가 없어도 이름을 쓸 수 있게 한다.
 */

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
const BASE = 0xac00;

const VOWEL_PAIR: Record<string, string> = {
  ㅗㅏ: "ㅘ",
  ㅗㅐ: "ㅙ",
  ㅗㅣ: "ㅚ",
  ㅜㅓ: "ㅝ",
  ㅜㅔ: "ㅞ",
  ㅜㅣ: "ㅟ",
  ㅡㅣ: "ㅢ",
};
const JONG_PAIR: Record<string, string> = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};
const split = (table: Record<string, string>, v: string): [string, string] | null => {
  const hit = Object.entries(table).find(([, c]) => c === v);
  return hit ? [hit[0][0], hit[0][1]] : null;
};

const isVowel = (j: string) => JUNG.includes(j);
const isConsonant = (j: string) => CHO.includes(j) || JONG.includes(j);

type Syl = { cho: string; jung: string; jong: string };

function decompose(ch: string | undefined): Syl | null {
  if (!ch) return null;
  const code = ch.charCodeAt(0) - BASE;
  if (code < 0 || code > 11171) return null;
  return {
    cho: CHO[Math.floor(code / 588)],
    jung: JUNG[Math.floor((code % 588) / 28)],
    jong: JONG[code % 28],
  };
}

function compose({ cho, jung, jong }: Syl): string {
  return String.fromCharCode(BASE + CHO.indexOf(cho) * 588 + JUNG.indexOf(jung) * 28 + JONG.indexOf(jong));
}

/** 글자 끝에 자모 하나를 넣는다. */
export function typeJamo(text: string, j: string): string {
  const head = text.slice(0, -1);
  const lastCh = text.slice(-1);
  const last = decompose(lastCh);

  if (isVowel(j)) {
    if (last) {
      if (last.jong) {
        // 받침이 다음 글자 첫소리로 넘어간다: 각 + ㅏ → 가가
        const pair = split(JONG_PAIR, last.jong);
        const keep = pair ? pair[0] : "";
        const move = pair ? pair[1] : last.jong;
        if (CHO.includes(move)) return head + compose({ ...last, jong: keep }) + compose({ cho: move, jung: j, jong: "" });
        return text + j;
      }
      const both = VOWEL_PAIR[last.jung + j];
      if (both) return head + compose({ ...last, jung: both });
      return text + j;
    }
    if (lastCh && CHO.includes(lastCh)) return head + compose({ cho: lastCh, jung: j, jong: "" });
    if (lastCh && VOWEL_PAIR[lastCh + j]) return head + VOWEL_PAIR[lastCh + j];
    return text + j;
  }

  if (isConsonant(j)) {
    if (last) {
      if (!last.jong) {
        if (JONG.includes(j)) return head + compose({ ...last, jong: j });
        return text + j;
      }
      const both = JONG_PAIR[last.jong + j];
      if (both) return head + compose({ ...last, jong: both });
    }
    return text + j;
  }
  return text + j;
}

/** 자모 하나만 지운다: 감 → 가 → ㄱ → (없음). */
export function backspaceJamo(text: string): string {
  const head = text.slice(0, -1);
  const last = decompose(text.slice(-1));
  if (!last) return head;
  if (last.jong) {
    const pair = split(JONG_PAIR, last.jong);
    return head + compose({ ...last, jong: pair ? pair[0] : "" });
  }
  const vp = split(VOWEL_PAIR, last.jung);
  if (vp) return head + compose({ ...last, jung: vp[0] });
  return head + last.cho;
}

/** 화면 자판 배치. 쌍자음·ㅒㅖ는 ⇧로. */
export const KEY_ROWS = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
];

export const SHIFTED: Record<string, string> = {
  ㅂ: "ㅃ",
  ㅈ: "ㅉ",
  ㄷ: "ㄸ",
  ㄱ: "ㄲ",
  ㅅ: "ㅆ",
  ㅐ: "ㅒ",
  ㅔ: "ㅖ",
};
