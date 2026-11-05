/** 안드로이드 카메라로 안 잡히는 USB 웹캠. TV 앱(android/UvcCamera.java)이 읽은 JPEG를
 * 캔버스에 그려 일반 카메라 영상(MediaStream)처럼 게임에 넘긴다. TV 앱이 아니면 쓰이지 않는다. */

type Bridge = {
  devices(): string;
  open(id: string): void;
  close(): void;
  state(): string;
};

const PREFIX = "uvc:";
const FRAME_URL = "/__uvc/frame";
/** 처음엔 USB 허용 창을 리모컨으로 누를 시간을 준다. */
const FIRST_FRAME_MS = 45000;
/** 영상이 이만큼 끊기면 빠진 것으로 본다. */
const LOST_MS = 5000;

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { UvcBridge?: Bridge }).UvcBridge ?? null;
}

export function isUvcId(id: string | null): boolean {
  return !!id?.startsWith(PREFIX);
}

export function uvcDevices(): { id: string; label: string }[] {
  try {
    const list = JSON.parse(bridge()?.devices() ?? "[]") as { id: string; label: string }[];
    return list.map((d) => ({ id: PREFIX + d.id, label: d.label }));
  } catch {
    return [];
  }
}

/** 첫 프레임이 들어오면 스트림을 돌려준다. 스트림의 트랙을 멈추면 웹캠도 꺼진다. */
export async function openUvc(id: string | null): Promise<MediaStream> {
  const b = bridge();
  if (!b || uvcDevices().length === 0) {
    throw Object.assign(new Error("no usb camera"), { name: "NotFoundError" });
  }
  b.open(isUvcId(id) ? id!.slice(PREFIX.length) : "");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const draw = async (res: Response) => {
    const bmp = await createImageBitmap(await res.blob());
    if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
      canvas.width = bmp.width;
      canvas.height = bmp.height;
    }
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
  };

  const giveUp = performance.now() + FIRST_FRAME_MS;
  for (;;) {
    const res = await fetch(FRAME_URL, { cache: "no-store" });
    if (res.status === 200) {
      await draw(res);
      break;
    }
    const state = b.state();
    if (state === "denied" || state === "error" || state === "none" || performance.now() > giveUp) {
      b.close();
      throw Object.assign(new Error(`usb camera ${state}`), { name: "NotReadableError" });
    }
  }

  const stream = canvas.captureStream(30);
  const track = stream.getVideoTracks()[0];
  void (async () => {
    let lastFrame = performance.now();
    while (track.readyState === "live") {
      const res = await fetch(FRAME_URL, { cache: "no-store" }).catch(() => null);
      if (res?.status === 200) {
        await draw(res).catch(() => {});
        lastFrame = performance.now();
      } else if (performance.now() - lastFrame > LOST_MS) {
        track.stop();
      }
    }
    b.close();
  })();
  return stream;
}
