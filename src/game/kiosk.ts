/** 무인 키오스크 운영용 도우미. 주소에 ?kiosk=1 이 있으면 켜진다(오프라인 설치판의 start.bat이 붙인다). */

export const CAMERA_KEY = "david-goliath-camera-id";

export function isKiosk(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("kiosk") === "1";
}

export function preferredCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
}

export function setPreferredCamera(id: string | null): void {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id);
    else localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* 저장이 막혀도 기본 카메라로 돈다 */
  }
}

export async function listCameras(): Promise<{ id: string; label: string }[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ id: d.deviceId, label: d.label || `카메라 ${i + 1}` }));
  } catch {
    return [];
  }
}

/** 화면 꺼짐 방지, 마우스 커서 숨김, 우클릭·확대 막기. 정리 함수를 돌려준다. */
export function setupKiosk(): () => void {
  const cleanups: (() => void)[] = [];

  // 화면 꺼짐 방지: 탭이 다시 보일 때마다 다시 잡는다
  type WakeLock = { release: () => Promise<void> };
  let lock: WakeLock | null = null;
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
  const grab = () => {
    if (!nav.wakeLock || document.visibilityState !== "visible") return;
    nav.wakeLock
      .request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
  };
  grab();
  document.addEventListener("visibilitychange", grab);
  cleanups.push(() => {
    document.removeEventListener("visibilitychange", grab);
    void lock?.release().catch(() => {});
  });

  // 3초 동안 마우스가 안 움직이면 커서를 숨긴다
  let timer = 0;
  const show = () => {
    document.documentElement.style.cursor = "";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.documentElement.style.cursor = "none";
    }, 3000);
  };
  show();
  window.addEventListener("pointermove", show);
  window.addEventListener("pointerdown", show);
  cleanups.push(() => {
    window.removeEventListener("pointermove", show);
    window.removeEventListener("pointerdown", show);
    window.clearTimeout(timer);
    document.documentElement.style.cursor = "";
  });

  // 우클릭 메뉴, Ctrl+휠 확대, 두 손가락 확대 막기
  const noMenu = (e: Event) => e.preventDefault();
  const noZoom = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  const noGesture = (e: Event) => e.preventDefault();
  window.addEventListener("contextmenu", noMenu);
  window.addEventListener("wheel", noZoom, { passive: false });
  document.addEventListener("gesturestart", noGesture);
  cleanups.push(() => {
    window.removeEventListener("contextmenu", noMenu);
    window.removeEventListener("wheel", noZoom);
    document.removeEventListener("gesturestart", noGesture);
  });

  return () => cleanups.forEach((f) => f());
}
