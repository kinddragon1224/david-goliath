import { DAVID_FOOT_WORLD, DAVID_LOCAL, DAVID_SCALE, davidHandLocal, davidMotion, GOLIATH_LOCAL, shieldLocal, type DavidPose } from "./art";
import { BEAT_BPM, GRAVITY, WORLD_H, WORLD_W } from "./constants";
import { goliathAngle, stoneFlight } from "./rules";
import type { Floater, GameSim } from "./types";

/** 태고의 달인풍: 굵은 먹선, 평평한 원색, 회전하는 햇살, 튀어 오르는 판정 글자. */
export const INK = "#2a160c";
const FONT = "'Jua', 'Noto Sans KR', sans-serif";
const LINE = 10;

const C = {
  red: "#f24a2a",
  redDark: "#c22d1c",
  blue: "#3fb8d9",
  yellow: "#ffd23a",
  orange: "#ff8a1f",
  cream: "#fff4dc",
  white: "#ffffff",
  gold: "#ffcc22",
};

function beatPulse(time: number): number {
  const b = (time * BEAT_BPM) / 60;
  return Math.pow(1 - (b - Math.floor(b)), 3);
}

/* ───────── 경로 도우미 ───────── */

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 현재 경로를 칠하고 먹선을 두른다. */
function ink(ctx: CanvasRenderingContext2D, fill: string, lw = LINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** 먹선 → 흰 테 → 색 글자. 태고 판정 글자 방식. */
function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  inner: string | null = C.white,
): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.34;
  ctx.strokeText(text, x, y);
  if (inner) {
    ctx.strokeStyle = inner;
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.48;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 원 여러 개를 하나의 구름처럼: 먹선을 먼저 모두 긋고 그 위를 칠한다. */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string): void {
  const puffs: [number, number, number][] = [
    [-70, 10, 46],
    [-20, -16, 62],
    [44, -6, 54],
    [90, 16, 38],
    [10, 22, 50],
  ];
  ctx.lineWidth = 16 * s;
  ctx.strokeStyle = INK;
  for (const [px, py, r] of puffs) {
    circle(ctx, x + px * s, y + py * s, r * s);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const [px, py, r] of puffs) {
    circle(ctx, x + px * s, y + py * s, r * s);
    ctx.fill();
  }
  // 태고 구름 소용돌이 한 줄
  ctx.strokeStyle = "rgba(42,22,12,0.28)";
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.arc(x - 18 * s, y - 8 * s, 22 * s, Math.PI * 0.9, Math.PI * 2.2);
  ctx.stroke();
}

/* ───────── 배경 ───────── */

let bgCache: HTMLCanvasElement | null = null;

function staticBackground(): HTMLCanvasElement | null {
  if (bgCache) return bgCache;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = WORLD_W;
  cv.height = WORLD_H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 먼 산: 라벤더
  ctx.beginPath();
  ctx.moveTo(-20, 1290);
  const peaks = [
    [60, 1120],
    [180, 1210],
    [300, 1080],
    [440, 1190],
    [640, 1170],
    [780, 1060],
    [920, 1180],
    [1100, 1100],
  ];
  for (const [px, py] of peaks) ctx.lineTo(px, py);
  ctx.lineTo(1100, 1290);
  ctx.closePath();
  ink(ctx, "#a68be0", 9);
  // 산꼭대기 눈
  ctx.fillStyle = "#f3ecff";
  for (const [px, py] of [peaks[2], peaks[5]]) {
    ctx.beginPath();
    ctx.moveTo(px, py + 4);
    ctx.lineTo(px - 38, py + 46);
    ctx.lineTo(px - 12, py + 36);
    ctx.lineTo(px + 4, py + 52);
    ctx.lineTo(px + 22, py + 36);
    ctx.lineTo(px + 40, py + 46);
    ctx.closePath();
    ctx.fill();
  }

  // 가까운 언덕: 초록 둔덕
  ctx.beginPath();
  ctx.moveTo(-20, 1400);
  ctx.quadraticCurveTo(120, 1200, 300, 1290);
  ctx.quadraticCurveTo(420, 1340, 540, 1300);
  ctx.quadraticCurveTo(700, 1240, 820, 1300);
  ctx.quadraticCurveTo(960, 1210, 1100, 1330);
  ctx.lineTo(1100, 1420);
  ctx.lineTo(-20, 1420);
  ctx.closePath();
  ink(ctx, "#79cc52", 9);
  ctx.fillStyle = "#93dc69";
  for (const [hx, hy, r] of [
    [150, 1290, 40],
    [930, 1290, 44],
    [690, 1300, 30],
  ]) {
    ellipse(ctx, hx, hy, r, r * 0.5);
    ctx.fill();
  }

  // 땅
  ctx.beginPath();
  ctx.moveTo(-20, 1360);
  ctx.quadraticCurveTo(540, 1320, 1100, 1360);
  ctx.lineTo(1100, WORLD_H + 20);
  ctx.lineTo(-20, WORLD_H + 20);
  ctx.closePath();
  ink(ctx, "#f5c262", 9);

  // 골리앗에서 다윗까지 이어진 밝은 길
  ctx.beginPath();
  ctx.moveTo(430, 1350);
  ctx.quadraticCurveTo(300, 1560, 330, WORLD_H + 20);
  ctx.lineTo(750, WORLD_H + 20);
  ctx.quadraticCurveTo(780, 1560, 650, 1350);
  ctx.closePath();
  ctx.fillStyle = "#ffdc93";
  ctx.fill();

  // 땅 무늬 점
  ctx.fillStyle = "rgba(196,128,40,0.35)";
  for (let i = 0; i < 70; i++) {
    const x = (i * 197) % WORLD_W;
    const y = 1390 + ((i * 113) % 520);
    ellipse(ctx, x, y, 10 + (i % 3) * 4, 4 + (i % 2) * 2);
    ctx.fill();
  }

  // 풀 덤불
  const tufts: [number, number, number][] = [
    [90, 1470, 1],
    [980, 1500, 1.1],
    [200, 1760, 1.2],
    [880, 1780, 1.25],
    [60, 1880, 1],
    [1020, 1880, 0.9],
  ];
  for (const [tx, ty, s] of tufts) {
    ctx.beginPath();
    ctx.moveTo(tx - 40 * s, ty);
    ctx.quadraticCurveTo(tx - 44 * s, ty - 40 * s, tx - 22 * s, ty - 62 * s);
    ctx.quadraticCurveTo(tx - 16 * s, ty - 30 * s, tx - 4 * s, ty - 26 * s);
    ctx.quadraticCurveTo(tx, ty - 70 * s, tx + 18 * s, ty - 80 * s);
    ctx.quadraticCurveTo(tx + 16 * s, ty - 34 * s, tx + 26 * s, ty - 28 * s);
    ctx.quadraticCurveTo(tx + 44 * s, ty - 50 * s, tx + 56 * s, ty - 46 * s);
    ctx.quadraticCurveTo(tx + 42 * s, ty - 20 * s, tx + 42 * s, ty);
    ctx.closePath();
    ink(ctx, "#5fbf3c", 8);
  }

  // 조약돌
  const pebbles: [number, number, number][] = [
    [260, 1450, 18],
    [820, 1430, 14],
    [130, 1640, 22],
    [960, 1660, 20],
    [380, 1860, 16],
    [720, 1890, 18],
  ];
  for (const [px, py, r] of pebbles) {
    ellipse(ctx, px, py, r * 1.4, r);
    ink(ctx, "#b8b0a4", 6);
    ctx.fillStyle = "#e3ddd4";
    ellipse(ctx, px - r * 0.4, py - r * 0.35, r * 0.5, r * 0.28);
    ctx.fill();
  }

  // 작은 꽃
  for (const [fx, fy, col] of [
    [170, 1540, C.red],
    [930, 1590, C.yellow],
    [80, 1720, C.yellow],
    [1000, 1740, C.red],
  ] as [number, number, string][]) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      circle(ctx, fx + Math.cos(a) * 11, fy + Math.sin(a) * 11, 9);
      ink(ctx, col, 4);
    }
    circle(ctx, fx, fy, 7);
    ink(ctx, C.cream, 4);
  }

  bgCache = cv;
  return cv;
}

function drawSky(ctx: CanvasRenderingContext2D, time: number, calm: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 1350);
  sky.addColorStop(0, "#ff8a2a");
  sky.addColorStop(0.45, "#ffb640");
  sky.addColorStop(1, "#ffe7a0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, 1400);

  // 회전하는 햇살
  const cx = WORLD_W / 2;
  const cy = 760;
  const rot = calm ? 0 : time * 0.06;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = "rgba(255,240,180,0.42)";
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * 1800, Math.sin(a0) * 1800);
    ctx.lineTo(Math.cos(a1) * 1800, Math.sin(a1) * 1800);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 520);
  glow.addColorStop(0, "rgba(255,252,230,0.85)");
  glow.addColorStop(1, "rgba(255,252,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 200, WORLD_W, 1200);

  // 흘러가는 구름
  const drift = calm ? 0 : time;
  const clouds: [number, number, number, number][] = [
    [120, 300, 0.9, 14],
    [820, 420, 1.1, 10],
    [380, 560, 0.7, 18],
    [980, 860, 0.8, 12],
    [60, 980, 0.95, 9],
  ];
  for (const [x0, y, s, speed] of clouds) {
    const span = WORLD_W + 400;
    const x = ((x0 + drift * speed) % span) - 200;
    cloud(ctx, x, y, s, C.white);
  }

  // 반짝이는 색종이 점
  if (!calm) {
    const cols = [C.red, C.blue, C.yellow, C.white];
    for (let i = 0; i < 16; i++) {
      const x = (i * 211 + time * 30) % WORLD_W;
      const y = 200 + ((i * 97 + time * 46) % 1000);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 2 + i);
      ctx.fillStyle = cols[i % cols.length];
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-7, -4, 14, 8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/* ───────── 골리앗 ───────── */

type GoliathPalette = {
  skin: string;
  skinDark: string;
  bronze: string;
  bronzeDark: string;
  bronzeLight: string;
  red: string;
  beard: string;
  leather: string;
};

function goliathPalette(flash: number, frozen: boolean): GoliathPalette {
  if (flash > 0.45) {
    return {
      skin: "#ffffff",
      skinDark: "#fff2dc",
      bronze: "#fff8e8",
      bronzeDark: "#ffe9c4",
      bronzeLight: "#ffffff",
      red: "#ffd9cf",
      beard: "#ffe2c8",
      leather: "#ffe9c4",
    };
  }
  if (frozen) {
    return {
      skin: "#cfe9fb",
      skinDark: "#a9d2ef",
      bronze: "#9ccbea",
      bronzeDark: "#73a8d4",
      bronzeLight: "#e3f4ff",
      red: "#86aee0",
      beard: "#5a7fa8",
      leather: "#6d93bf",
    };
  }
  return {
    skin: "#f4b98c",
    skinDark: "#e0956a",
    bronze: "#eba73e",
    bronzeDark: "#c97d24",
    bronzeLight: "#ffd77a",
    red: "#e8402a",
    beard: "#5a3018",
    leather: "#a85a26",
  };
}

function drawGoliath(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  const gx = sim.goliathX;
  const gy = 70 + sim.goliathBob;
  const frozen = sim.freezeLeft > 0;
  const p = goliathPalette(sim.hitFlash, frozen);
  const pulse = frozen ? 0 : beatPulse(sim.time);
  const wobble = Math.sin(sim.time * 40) * sim.stagger * 0.05;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.translate(gx, gy + GOLIATH_LOCAL.foot.y);
  ctx.rotate(goliathAngle(sim.stagger, sim.downed, sim.shieldUp, sim.lean) + wobble);
  if (sim.downed) ctx.translate(40, 80);
  ctx.scale(1 + pulse * 0.012, 1 - pulse * 0.018);
  ctx.translate(-GOLIATH_LOCAL.foot.x, -GOLIATH_LOCAL.foot.y);

  // 그림자
  ctx.fillStyle = "rgba(90,40,10,0.25)";
  ellipse(ctx, 0, 1318, 270, 36);
  ctx.fill();

  // 창(몸 뒤)
  rrect(ctx, -272, 170, 26, 1130, 13);
  ink(ctx, "#b8763a");
  ctx.beginPath();
  ctx.moveTo(-259, 60);
  ctx.lineTo(-222, 190);
  ctx.lineTo(-296, 190);
  ctx.closePath();
  ink(ctx, "#d9dde6");
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(-262, 90);
  ctx.lineTo(-272, 180);
  ctx.lineTo(-262, 180);
  ctx.closePath();
  ctx.fill();

  // 다리와 신발
  rrect(ctx, -128, 1030, 100, 260, 40);
  ink(ctx, p.bronze);
  rrect(ctx, 28, 1030, 100, 260, 40);
  ink(ctx, p.bronze);
  ctx.fillStyle = p.bronzeLight;
  rrect(ctx, -110, 1060, 18, 150, 9);
  ctx.fill();
  rrect(ctx, 46, 1060, 18, 150, 9);
  ctx.fill();
  ellipse(ctx, -84, 1296, 82, 36);
  ink(ctx, "#7a4422");
  ellipse(ctx, 84, 1296, 82, 36);
  ink(ctx, "#7a4422");

  // 치마
  ctx.beginPath();
  ctx.moveTo(-190, 950);
  ctx.lineTo(190, 950);
  ctx.lineTo(215, 1110);
  ctx.lineTo(-215, 1110);
  ctx.closePath();
  ink(ctx, p.red);
  for (let i = 0; i < 7; i++) {
    const x = -180 + i * 60;
    rrect(ctx, x, 990, 34, 140 + (i % 2) * 14, 12);
    ink(ctx, p.leather, 7);
  }

  // 몸통 비늘 갑옷
  rrect(ctx, -215, 610, 430, 390, 160);
  ink(ctx, p.bronze);
  ctx.save();
  rrect(ctx, -215, 610, 430, 390, 160);
  ctx.clip();
  ctx.strokeStyle = "rgba(120,60,10,0.35)";
  ctx.lineWidth = 5;
  for (let row = 0; row < 8; row++) {
    const y = 650 + row * 44;
    for (let col = -5; col <= 5; col++) {
      const x = col * 44 + (row % 2) * 22;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.fillStyle = p.bronzeLight;
  ellipse(ctx, -110, 700, 60, 40, -0.5);
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  rrect(ctx, -215, 610, 430, 390, 160);
  ctx.lineWidth = LINE;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 허리띠
  rrect(ctx, -205, 930, 410, 54, 22);
  ink(ctx, p.leather);
  rrect(ctx, -34, 922, 68, 70, 14);
  ink(ctx, p.bronzeLight, 8);
  if (sim.damage >= 2) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(60, 660);
    ctx.lineTo(90, 720);
    ctx.lineTo(70, 760);
    ctx.lineTo(104, 820);
    ctx.stroke();
  }

  // 왼팔(화면 왼쪽): 창을 쥔다
  ctx.lineWidth = 92;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-190, 700);
  ctx.lineTo(-252, 880);
  ctx.stroke();
  ctx.lineWidth = 72;
  ctx.strokeStyle = p.skin;
  ctx.stroke();
  circle(ctx, -200, 680, 66);
  ink(ctx, p.bronze);
  circle(ctx, -258, 900, 50);
  ink(ctx, p.skin);
  rrect(ctx, -272, 870, 26, 64, 6);
  ink(ctx, "#b8763a", 6);

  const shield = shieldLocal(sim.shieldUp, sim.shieldWarn);
  const shieldInFront = sim.shieldUp;

  // 오른팔: 방패 쪽
  ctx.lineWidth = 92;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(190, 700);
  ctx.lineTo(shieldInFront ? 120 : shield.x - 10, shieldInFront ? 560 : shield.y);
  ctx.stroke();
  ctx.lineWidth = 72;
  ctx.strokeStyle = p.skin;
  ctx.stroke();
  circle(ctx, 200, 680, 66);
  ink(ctx, p.bronze);

  if (!shieldInFront) drawShield(ctx, shield.x, shield.y, shield.r, p, sim.shieldWarn);

  drawGoliathHead(ctx, sim, p);

  if (shieldInFront) drawShield(ctx, shield.x, shield.y, shield.r, p, false);

  // 경고 말풍선
  if (sim.shieldWarn && !frozen) {
    const bx = 280;
    const by = 330 - pulse * 12;
    circle(ctx, bx, by, 62);
    ink(ctx, C.white);
    outlinedText(ctx, "!", bx, by + 4, 92, C.red, null);
  }

  // 얼음
  if (frozen) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    rrect(ctx, -300, 120, 600, 1210, 60);
    ctx.fillStyle = "#bfe8ff";
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([26, 18]);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#5aa8dc";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    for (const [sx, sy] of [
      [-220, 260],
      [230, 520],
      [-180, 900],
      [200, 1120],
    ]) {
      star(ctx, sx, sy, 26, sim.time);
      ctx.fill();
    }
    ctx.restore();
  }

  // 열린 급소: 금빛 표적
  if (sim.critOpen && (sim.phase === "play" || sim.phase === "countdown" || sim.phase === "practice")) {
    const F = GOLIATH_LOCAL.forehead;
    const k = 1 + Math.sin(sim.time * 12) * 0.08;
    ctx.lineWidth = 22;
    ctx.strokeStyle = INK;
    ellipse(ctx, F.x, F.y, (F.rx + 14) * k, (F.ry + 12) * k);
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.strokeStyle = C.gold;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,220,60,0.28)";
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = sim.time * 3 + (i * Math.PI) / 2;
      star(ctx, F.x + Math.cos(a) * (F.rx + 46), F.y + Math.sin(a) * (F.ry + 34), 18, a);
      ink(ctx, C.gold, 5);
    }
  }

  ctx.restore();
}

function drawShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  p: GoliathPalette,
  warn: boolean,
): void {
  if (warn) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 12;
    circle(ctx, x, y, r + 22);
    ctx.stroke();
  }
  circle(ctx, x, y, r);
  ink(ctx, p.bronzeDark, 12);
  circle(ctx, x, y, r * 0.78);
  ink(ctx, p.bronze, 7);
  ctx.fillStyle = INK;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    circle(ctx, x + Math.cos(a) * r * 0.89, y + Math.sin(a) * r * 0.89, 7);
    ctx.fill();
  }
  circle(ctx, x, y, r * 0.26);
  ink(ctx, p.bronzeLight, 7);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ellipse(ctx, x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6);
  ctx.fill();
}

function drawGoliathHead(ctx: CanvasRenderingContext2D, sim: GameSim, p: GoliathPalette): void {
  const frozen = sim.freezeLeft > 0;
  const hurt = sim.goliathPose === "hit" && !frozen;
  const dizzy = hurt && sim.stagger > 0.4;
  const warn = sim.goliathPose === "warn";

  // 수염 뒷덩이
  ctx.beginPath();
  ctx.moveTo(-175, 470);
  ctx.quadraticCurveTo(-190, 640, -60, 700);
  ctx.quadraticCurveTo(0, 730, 60, 700);
  ctx.quadraticCurveTo(190, 640, 175, 470);
  ctx.closePath();
  ink(ctx, p.beard);

  // 귀
  circle(ctx, -176, 470, 36);
  ink(ctx, p.skin);
  circle(ctx, 176, 470, 36);
  ink(ctx, p.skin);

  // 얼굴
  circle(ctx, 0, 450, 175);
  ink(ctx, p.skin);

  // 볼
  ctx.fillStyle = "rgba(255,110,90,0.35)";
  ellipse(ctx, -108, 520, 34, 20);
  ctx.fill();
  ellipse(ctx, 108, 520, 34, 20);
  ctx.fill();

  // 눈썹
  ctx.strokeStyle = p.beard === "#ffe2c8" ? "#d9b89a" : "#3a1e0e";
  ctx.lineWidth = 26;
  ctx.beginPath();
  if (hurt) {
    ctx.moveTo(-125, 392);
    ctx.lineTo(-35, 380);
    ctx.moveTo(125, 392);
    ctx.lineTo(35, 380);
  } else {
    ctx.moveTo(-128, 380);
    ctx.lineTo(-34, 410);
    ctx.moveTo(128, 380);
    ctx.lineTo(34, 410);
  }
  ctx.stroke();

  // 눈
  const ey = 455;
  if (dizzy) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    for (const ex of [-72, 72]) {
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = i * 0.45 + sim.time * 10;
        const rr = i * 0.85;
        const px = ex + Math.cos(a) * rr;
        const py = ey + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (hurt) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-100, ey - 22);
    ctx.lineTo(-56, ey);
    ctx.lineTo(-100, ey + 22);
    ctx.moveTo(100, ey - 22);
    ctx.lineTo(56, ey);
    ctx.lineTo(100, ey + 22);
    ctx.stroke();
  } else if (frozen) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-104, ey);
    ctx.lineTo(-44, ey);
    ctx.moveTo(104, ey);
    ctx.lineTo(44, ey);
    ctx.stroke();
  } else {
    const squint = warn ? 0.55 : 1;
    for (const ex of [-72, 72]) {
      ellipse(ctx, ex, ey, 40, 32 * squint);
      ink(ctx, C.white, 8);
      const look = Math.max(-1, Math.min(1, sim.aimX)) * 10;
      circle(ctx, ex + look, ey + 8 * squint, 15 * Math.max(0.7, squint));
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, ex + look - 5, ey + 2, 5);
      ctx.fillStyle = C.white;
      ctx.fill();
    }
  }

  // 코
  ellipse(ctx, 0, 510, 36, 30);
  ink(ctx, p.skinDark, 8);

  // 콧수염 + 입
  ctx.beginPath();
  ctx.moveTo(-120, 560);
  ctx.quadraticCurveTo(-60, 520, 0, 548);
  ctx.quadraticCurveTo(60, 520, 120, 560);
  ctx.quadraticCurveTo(60, 580, 0, 566);
  ctx.quadraticCurveTo(-60, 580, -120, 560);
  ctx.closePath();
  ink(ctx, p.beard, 8);
  if (hurt) {
    ellipse(ctx, 0, 610, 34, 40);
    ink(ctx, "#7a1d14", 8);
  } else {
    ctx.beginPath();
    ctx.moveTo(-60, 590);
    ctx.quadraticCurveTo(0, 650, 60, 590);
    ctx.closePath();
    ink(ctx, "#7a1d14", 8);
    ctx.fillStyle = C.white;
    ctx.fillRect(-40, 592, 80, 16);
  }

  // 땀
  if (hurt || warn) {
    ctx.beginPath();
    ctx.moveTo(150, 360);
    ctx.quadraticCurveTo(178, 400, 166, 418);
    ctx.quadraticCurveTo(150, 430, 138, 412);
    ctx.quadraticCurveTo(132, 396, 150, 360);
    ctx.closePath();
    ink(ctx, "#8fd8f5", 6);
  }

  // 투구
  ctx.beginPath();
  ctx.arc(0, 318, 200, Math.PI, Math.PI * 2);
  ctx.closePath();
  ink(ctx, p.bronze);
  ctx.fillStyle = p.bronzeLight;
  ellipse(ctx, -90, 220, 40, 70, 0.6);
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;
  // 볼 가리개
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 200, 318);
    ctx.lineTo(side * 206, 470);
    ctx.quadraticCurveTo(side * 190, 520, side * 150, 500);
    ctx.lineTo(side * 150, 336);
    ctx.closePath();
    ink(ctx, p.bronzeDark);
  }
  rrect(ctx, -218, 292, 436, 46, 23);
  ink(ctx, p.bronzeDark);
  // 장식 깃
  rrect(ctx, -22, 96, 44, 36, 8);
  ink(ctx, p.bronzeDark, 8);
  ctx.beginPath();
  ctx.moveTo(-150, 120);
  ctx.quadraticCurveTo(0, 0, 150, 120);
  ctx.quadraticCurveTo(0, 80, -150, 120);
  ctx.closePath();
  ink(ctx, p.red);

  // 누적 피해 표시
  if (sim.damage >= 1) {
    ctx.save();
    ctx.translate(95, 200);
    ctx.rotate(0.6);
    rrect(ctx, -46, -14, 92, 28, 8);
    ink(ctx, C.cream, 6);
    ctx.rotate(-1.2);
    rrect(ctx, -46, -14, 92, 28, 8);
    ink(ctx, C.cream, 6);
    ctx.restore();
  }
  if (sim.damage >= 3) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-60, 140);
    ctx.lineTo(-40, 200);
    ctx.lineTo(-70, 240);
    ctx.lineTo(-48, 290);
    ctx.stroke();
  }

  // 어지러운 별
  if (dizzy) {
    for (let i = 0; i < 4; i++) {
      const a = sim.time * 6 + (i * Math.PI) / 2;
      star(ctx, Math.cos(a) * 190, 90 + Math.sin(a) * 40, 26, a);
      ink(ctx, C.yellow, 6);
    }
  }
}

/* ───────── 다윗 ───────── */

const DAVID_SKIN = "#ffcf9e";

function drawDavid(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  const pose: DavidPose = sim.davidPose;
  const motion = davidMotion(pose, sim.aimX, sim.charge, sim.time);
  const hand = davidHandLocal(pose, sim.charge, sim.time);
  const H = DAVID_LOCAL.head;
  const sh = DAVID_LOCAL.shoulder;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.translate(DAVID_FOOT_WORLD.x + motion.x, DAVID_FOOT_WORLD.y);
  // 그림자는 점프와 상관없이 땅에
  ctx.fillStyle = "rgba(90,40,10,0.28)";
  ellipse(ctx, 0, 8, 120, 18);
  ctx.fill();
  ctx.translate(0, motion.y);
  ctx.rotate(motion.rot);
  ctx.scale(DAVID_SCALE, DAVID_SCALE);

  // 힘 모으기 기운
  if (sim.charge > 0.3 || pose === "focus") {
    const k = pose === "focus" ? 1 : sim.charge;
    const col = pose === "focus" ? "rgba(110,200,255," : "rgba(255,200,40,";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + sim.time * 2;
      const r0 = 120;
      const r1 = 120 + 50 * k + Math.sin(sim.time * 20 + i) * 10;
      ctx.strokeStyle = `${col}${0.55 * k})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, -150 + Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, -150 + Math.sin(a) * r1);
      ctx.stroke();
    }
  }

  // 다리
  rrect(ctx, -40, -66, 30, 66, 14);
  ink(ctx, DAVID_SKIN, 7);
  rrect(ctx, 10, -66, 30, 66, 14);
  ink(ctx, DAVID_SKIN, 7);
  ellipse(ctx, -26, -4, 28, 13);
  ink(ctx, "#8a5026", 7);
  ellipse(ctx, 26, -4, 28, 13);
  ink(ctx, "#8a5026", 7);

  // 왼팔
  const focus = pose === "focus";
  const lhx = focus ? -6 : -84;
  const lhy = focus ? -128 : -88;
  ctx.lineWidth = 30;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-44, -128);
  ctx.lineTo(lhx, lhy);
  ctx.stroke();
  ctx.lineWidth = 18;
  ctx.strokeStyle = DAVID_SKIN;
  ctx.stroke();

  // 옷
  ctx.beginPath();
  ctx.moveTo(-58, -152);
  ctx.quadraticCurveTo(0, -164, 58, -152);
  ctx.lineTo(80, -52);
  ctx.quadraticCurveTo(0, -38, -80, -52);
  ctx.closePath();
  ink(ctx, C.cream, 7);
  ctx.strokeStyle = "#c9a26a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-30, -146);
  ctx.lineTo(-40, -60);
  ctx.moveTo(30, -146);
  ctx.lineTo(40, -60);
  ctx.stroke();
  rrect(ctx, -70, -106, 140, 18, 8);
  ink(ctx, "#8a5026", 6);
  // 목자 주머니
  ellipse(ctx, -62, -78, 22, 20);
  ink(ctx, "#b56a32", 6);

  // 머리
  circle(ctx, H.x, H.y, H.r);
  ink(ctx, DAVID_SKIN, 8);
  // 머리카락
  ctx.beginPath();
  ctx.arc(H.x, H.y - 6, H.r + 4, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(70, -230, 50, -228);
  ctx.quadraticCurveTo(30, -250, 10, -230);
  ctx.quadraticCurveTo(-10, -252, -30, -230);
  ctx.quadraticCurveTo(-60, -246, -80, -226);
  ctx.closePath();
  ink(ctx, "#5a3018", 8);
  // 머리띠
  ctx.strokeStyle = INK;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(H.x, H.y + 30, H.r - 4, Math.PI * 1.17, Math.PI * 1.83);
  ctx.stroke();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 12;
  ctx.stroke();
  const flap = Math.sin(sim.time * 8) * 8;
  ctx.beginPath();
  ctx.moveTo(-76, -250);
  ctx.quadraticCurveTo(-120, -260 + flap, -138, -230 + flap);
  ctx.moveTo(-76, -250);
  ctx.quadraticCurveTo(-118, -236 + flap, -128, -206 + flap);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 9;
  ctx.stroke();

  // 얼굴
  const ey = -196;
  if (focus) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(-32, ey, 14, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.moveTo(46, ey + 4);
    ctx.arc(32, ey, 14, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    for (const ex of [-32, 32]) {
      ellipse(ctx, ex, ey, 13, 18);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, ex - 4, ey - 7, 5);
      ctx.fillStyle = C.white;
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255,110,110,0.45)";
  ellipse(ctx, -58, -166, 16, 10);
  ctx.fill();
  ellipse(ctx, 58, -166, 16, 10);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  if (pose === "throw" || pose === "spin") {
    ellipse(ctx, 0, -156, 14, 12);
    ink(ctx, "#c4362a", 6);
  } else {
    ctx.beginPath();
    ctx.arc(0, -168, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // 오른팔과 물매
  ctx.lineWidth = 30;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y);
  ctx.lineTo(hand.x, hand.y);
  ctx.stroke();
  ctx.lineWidth = 18;
  ctx.strokeStyle = DAVID_SKIN;
  ctx.stroke();
  drawSling(ctx, pose, hand, sim);
  circle(ctx, hand.x, hand.y, 16);
  ink(ctx, DAVID_SKIN, 6);
  circle(ctx, lhx, lhy, 15);
  ink(ctx, DAVID_SKIN, 6);

  ctx.restore();
}

function drawSling(ctx: CanvasRenderingContext2D, pose: DavidPose, hand: { x: number; y: number }, sim: GameSim): void {
  let px = hand.x + 8;
  let py = hand.y + 54;
  let loaded = true;
  if (pose === "spin") {
    const a = sim.time * 18;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 70, a - 2.4, a);
    ctx.stroke();
    px = hand.x + Math.cos(a) * 70;
    py = hand.y + Math.sin(a) * 70;
  } else if (pose === "ready") {
    px = hand.x - 36;
    py = hand.y + 52;
  } else if (pose === "throw" || pose === "recover") {
    px = hand.x + 50;
    py = hand.y - 50;
    loaded = false;
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.strokeStyle = "#e8c48a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ellipse(ctx, px, py, 16, 11, Math.atan2(py - hand.y, px - hand.x));
  ink(ctx, "#8a5026", 5);
  if (loaded) {
    circle(ctx, px, py - 2, 10);
    ink(ctx, "#a9a29a", 4);
  }
}

/* ───────── 조준, 돌, 효과 ───────── */

function drawAim(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  if (sim.phase !== "play" && sim.phase !== "countdown" && sim.phase !== "practice") return;
  const power = sim.armed || sim.charge > 0.15 ? Math.max(0.7, sim.charge) : 0.78;
  const flight = stoneFlight(sim.aimX, sim.aimY, power, sim.davidPose, sim.charge, sim.time);
  const hot = sim.armed || sim.charge > 0.3;
  ctx.save();
  ctx.globalAlpha = hot ? 0.95 : 0.6;
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const ti = (flight.t * i) / steps;
    const x = flight.originX + flight.vx * ti;
    const y = flight.originY + flight.vy * ti + 0.5 * GRAVITY * ti * ti;
    circle(ctx, x, y, hot ? 9 : 7);
    ink(ctx, C.white, 4);
  }
  // 태고 음표 모양 표적
  const tx = flight.targetX;
  const ty = flight.targetY;
  const s = 1 + (hot ? Math.sin(sim.time * 14) * 0.06 : 0);
  ctx.globalAlpha = 1;
  circle(ctx, tx, ty, 46 * s);
  ink(ctx, C.white, 9);
  circle(ctx, tx, ty, 34 * s);
  ink(ctx, sim.critOpen ? C.gold : C.red, 5);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ellipse(ctx, tx - 10 * s, ty - 12 * s, 12 * s, 7 * s, -0.5);
  ctx.fill();
  ctx.restore();
}

function drawStones(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  for (const s of sim.stones) {
    // 꼬리
    const sp = Math.hypot(s.vx, s.vy) || 1;
    const tx = -s.vx / sp;
    const ty = -s.vy / sp;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 16 - i * 5;
      ctx.beginPath();
      ctx.moveTo(s.x + tx * 20, s.y + ty * 20);
      ctx.lineTo(s.x + tx * (70 + i * 30), s.y + ty * (70 + i * 30));
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ellipse(ctx, 0, 0, 22, 18);
    ink(ctx, "#a9a29a", 7);
    ctx.fillStyle = "#e6e1da";
    ellipse(ctx, -6, -6, 8, 5);
    ctx.fill();
    ctx.restore();
  }
}

function drawRings(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  for (const ring of sim.rings) {
    const k = 1 - ring.life / ring.maxLife;
    const r = ring.r + k * 140;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 22 * (1 - k) + 4;
    ctx.strokeStyle = INK;
    circle(ctx, ring.x, ring.y, r);
    ctx.stroke();
    ctx.lineWidth = 12 * (1 - k) + 2;
    ctx.strokeStyle = C.yellow;
    ctx.stroke();
    // 터지는 빛살
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ring.x + Math.cos(a) * r * 0.5, ring.y + Math.sin(a) * r * 0.5);
      ctx.lineTo(ring.x + Math.cos(a) * r * 0.85, ring.y + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  for (const p of sim.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.life * 12 + p.size);
    ctx.fillStyle = p.color;
    if (p.size > 5) {
      star(ctx, 0, 0, p.size * 2.4);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size * 1.6, -p.size, p.size * 3.2, p.size * 2);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const JUDGE_FILL: Record<NonNullable<Floater["kind"]>, string> = {
  crit: C.gold,
  good: C.red,
  ok: C.white,
  bad: C.blue,
  info: C.white,
};

function drawFloaters(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  for (const f of sim.floaters) {
    const k = 1 - f.life / f.maxLife;
    const pop = k < 0.12 ? 1.6 - (k / 0.12) * 0.6 : 1;
    const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const kind = f.kind ?? "info";
    const size = kind === "crit" ? 96 : kind === "info" ? 52 : 76;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(f.x, f.y);
    ctx.scale(pop, pop);
    if (kind === "crit") {
      ctx.save();
      ctx.rotate(sim.time * 2);
      star(ctx, 0, 0, 120);
      ctx.globalAlpha = Math.max(0, alpha) * 0.9;
      ink(ctx, C.orange, 8);
      ctx.restore();
    }
    outlinedText(ctx, f.text, 0, 0, size, kind === "info" ? f.color : JUDGE_FILL[kind]);
    if (f.sub) outlinedText(ctx, f.sub, 0, size * 0.85, size * 0.55, C.white, null);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** 크리티컬 순간에 화면 가장자리에서 집중선. */
function drawSpeedLines(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  if (sim.stagger < 0.4 || sim.goliathPose !== "hit") return;
  const k = Math.min(1, (sim.stagger - 0.4) / 0.3);
  const cx = sim.goliathX;
  const cy = 70 + GOLIATH_LOCAL.forehead.y;
  ctx.save();
  ctx.globalAlpha = 0.7 * k;
  ctx.fillStyle = INK;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + (i % 3) * 0.02;
    const w = 0.012 + (i % 4) * 0.004;
    const r0 = 620 + ((i * 53) % 160);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * 2400, cy + Math.sin(a - w) * 2400);
    ctx.lineTo(cx + Math.cos(a + w) * 2400, cy + Math.sin(a + w) * 2400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawWorld(ctx: CanvasRenderingContext2D, sim: GameSim, calm = false): void {
  ctx.save();
  ctx.translate(sim.shakeX, sim.shakeY);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  drawSky(ctx, sim.time, calm);
  const bg = staticBackground();
  if (bg) ctx.drawImage(bg, 0, 0);

  drawGoliath(ctx, sim);
  drawAim(ctx, sim);
  drawDavid(ctx, sim);
  drawRings(ctx, sim);
  drawParticles(ctx, sim);
  drawStones(ctx, sim);
  drawSpeedLines(ctx, sim);
  drawFloaters(ctx, sim);

  ctx.restore();
}

/** 내 모습 카드 위에 겹치는 표시. 영상은 그대로 보이고, 던질 손에만 표시를 단다.
 * 손 표시: 노란 원 = 손을 잡고 있음, 빨간 원 = 장전(던질 준비), 화면 번쩍 = 던짐 인식.
 */
export function drawPip(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  skeleton: { x: number; y: number; v: number }[] | null,
  present: boolean,
  armed = false,
  flash = 0,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // 영상이 object-cover로 잘린 만큼 같은 변환을 건다
  const vw = video?.videoWidth || 4;
  const vh = video?.videoHeight || 3;
  const k = Math.max(w / vw, h / vh);
  const ox = (w - vw * k) / 2;
  const oy = (h - vh * k) / 2;
  const P = (p: { x: number; y: number }) => ({ x: ox + p.x * vw * k, y: oy + p.y * vh * k });
  if (skeleton && present) {
    const lw = skeleton[5];
    const rw = skeleton[6];
    const hands = [lw, rw].filter((p) => p && p.v > 0.3);
    if (hands.length > 0) {
      const top = hands.reduce((a, b) => (a.y < b.y ? a : b));
      const p = P(top);
      const r = armed ? 26 + Math.sin(performance.now() / 70) * 4 : 20;
      circle(ctx, p.x, p.y, r);
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = armed ? C.red : C.yellow;
      ctx.stroke();
    }
  }
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash * 2);
    ctx.lineWidth = 18;
    ctx.strokeStyle = C.yellow;
    ctx.strokeRect(0, 0, w, h);
    outlinedText(ctx, "던짐!", w / 2, h / 2, 64, C.yellow, C.white);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
