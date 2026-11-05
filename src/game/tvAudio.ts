import { isTv } from "./kiosk";
import { tvToast } from "./uvc";

/** TV는 터치가 없어 '화면을 눌러 소리 켜기'를 기대할 수 없다. 켜자마자 소리를 깨우고 멈춰 있으면 계속 다시 깨운다.
 * 8초가 지나도 안 풀리면 원인을 볼 수 있게 화면에 상태를 띄운다. 정리 함수를 돌려준다. */
export function keepAudioAwake(unlock: () => void, state: () => string): () => void {
  if (!isTv()) return () => {};
  unlock();
  let ticks = 0;
  const id = window.setInterval(() => {
    unlock();
    ticks += 1;
    if (ticks === 8 && state() !== "running") tvToast(`소리 장치 상태: ${state()}`);
  }, 1000);
  return () => window.clearInterval(id);
}
