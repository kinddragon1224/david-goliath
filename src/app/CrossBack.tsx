/** 두 팔을 가슴 앞에서 X 로 엇갈려 잠깐 유지하면 체험 고르기로 돌아가는 동작(11/19).
 * 양옆 탭까지 팔을 쭉 뻗는 것이 불편하다는 지적으로 넣었다. 패션 체험과 다윗과 골리앗이 같이 쓴다.
 * (꿈돌이 게임과 가상 착장은 다른 프로그램이라 같은 판정을 각자 갖고 있다: games/daejeon-ax/src/input/pose.ts, vton/app/index.html) */

type Joint = { x: number; y: number; v: number };

/** 이만큼(초) 유지해야 돌아간다. 현장에서 잘못 눌리면 올린다. */
export const CROSS_SEC = 1.2;

/** skeleton = [코, 어깨 둘, 팔꿈치 둘, 손목 둘, 골반 둘](pose.ts 의 PoseFrame.skeleton).
 * 두 손목이 몸 가운데 선을 넘어 서로 반대쪽 어깨 앞(가슴 높이)에 있으면 X. */
export function armsCrossed(sk: Joint[] | null | undefined): boolean {
  if (!sk || sk.length < 7) return false;
  const [, ls, rs, , , lw, rw] = sk;
  const sw = Math.abs(ls.x - rs.x);
  const cx = (ls.x + rs.x) / 2;
  const side = Math.sign(ls.x - cx);
  const chest = (y: number, sy: number) => y > sy - sw * 0.5 && y < sy + sw * 1.2;
  return (
    lw.v > 0.5 &&
    rw.v > 0.5 &&
    sw > 0.03 &&
    Math.sign(lw.x - cx) === -side &&
    Math.sign(rw.x - cx) === side &&
    Math.abs(lw.x - rw.x) > sw * 0.2 &&
    chest(lw.y, ls.y) &&
    chest(rw.y, rs.y)
  );
}

/** 그리는 루프에서 매 장면 부르는 함수를 만든다. 유지 시간이 다 차면 true 를 한 번 돌려준다.
 * 화면의 안내 표(#x-hint)에 찬 정도(--k)도 넣는다. */
export function makeCrossBack(): (sk: Joint[] | null | undefined, active: boolean, now: number) => boolean {
  let t = 0;
  let at = 0;
  return (sk, active, now) => {
    t = active && armsCrossed(sk) ? t + Math.min(0.3, (now - at) / 1000) : 0;
    at = now;
    document.getElementById("x-hint")?.style.setProperty("--k", String(Math.min(1, t / CROSS_SEC)));
    if (t < CROSS_SEC) return false;
    t = 0;
    return true;
  };
}

/** 안내 표: 동작을 유지하면 주황이 왼쪽부터 찬다. */
export function CrossHint({ className = "" }: { className?: string }) {
  return (
    <p
      id="x-hint"
      className={`pointer-events-none rounded-full border-2 border-white/70 px-5 py-1.5 text-xl font-bold whitespace-nowrap text-white ${className}`}
      style={{
        background:
          "linear-gradient(90deg, #ff8822 calc(var(--k, 0) * 100%), rgba(6,33,54,0.88) calc(var(--k, 0) * 100%))",
      }}
    >
      두 팔로 X = 체험 고르기
    </p>
  );
}
