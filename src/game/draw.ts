import { DAVID_CHEST_PX, DAVID_FOOT_WORLD, DAVID_SLING_PX, davidMotion, davidSprite, davidWorld, drawSprite, GOLIATH_LOCAL, GOLIATH_SPRITES, shieldLocal } from "./art";
import { GRAVITY, WORLD_H, WORLD_W } from "./constants";
import { goliathAngle, stoneFlight } from "./rules";
import type { GameSim } from "./types";

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export function drawWorld(ctx: CanvasRenderingContext2D, sim: GameSim, bg: HTMLImageElement | null): void {
  ctx.save();
  ctx.translate(sim.shakeX, sim.shakeY);

  if (bg && bg.complete && bg.naturalWidth > 0) {
    const scale = Math.max(WORLD_W / bg.naturalWidth, WORLD_H / bg.naturalHeight);
    const dw = bg.naturalWidth * scale;
    const dh = bg.naturalHeight * scale;
    ctx.drawImage(bg, (WORLD_W - dw) / 2, (WORLD_H - dh) / 2, dw, dh);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    sky.addColorStop(0, "#1a2740");
    sky.addColorStop(0.45, "#3a3a48");
    sky.addColorStop(1, "#c4a882");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  const dusk = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  dusk.addColorStop(0, "rgba(12,16,24,0.18)");
  dusk.addColorStop(0.55, "rgba(12,16,24,0)");
  dusk.addColorStop(1, "rgba(18,14,10,0.28)");
  ctx.fillStyle = dusk;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  drawDust(ctx, sim.time);
  drawGoliath(ctx, sim);
  drawAim(ctx, sim);
  drawDavid(ctx, sim);

  for (const ring of sim.rings) {
    const k = 1 - ring.life / ring.maxLife;
    ctx.strokeStyle = `rgba(239,232,220,${0.55 * (1 - k)})`;
    ctx.lineWidth = 4 - k * 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r + k * 70, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of sim.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const s of sim.stones) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = "#6d6458";
    ellipse(ctx, 0, 0, 16, 12);
    ctx.fill();
    ctx.fillStyle = "#b7aea0";
    ellipse(ctx, -4, -3, 6, 4);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(239,232,220,0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * 0.055, s.y - s.vy * 0.055);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }

  for (const f of sim.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.font = "700 42px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDust(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = "rgba(239,232,220,0.16)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 137 + t * 12) % WORLD_W);
    const y = 220 + ((i * 89 + t * 18) % 900);
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoliath(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  const gx = sim.goliathX;
  const gy = 70 + sim.goliathBob;
  const flash = sim.hitFlash;
  const down = sim.downed ? 1 : 0;
  ctx.save();
  ctx.translate(gx, gy + GOLIATH_LOCAL.foot.y);
  ctx.rotate(goliathAngle(sim.stagger, sim.downed, sim.shieldUp, sim.lean));
  if (down) ctx.translate(40, 80);
  ctx.translate(-GOLIATH_LOCAL.foot.x, -GOLIATH_LOCAL.foot.y);

  ctx.fillStyle = "rgba(20,16,12,0.4)";
  ellipse(ctx, 0, 1320, 250, 28);
  ctx.fill();

  const metal = flash > 0.4 ? "#efe8dc" : "#8a6d42";
  const metalDark = flash > 0.4 ? "#d7d0c3" : "#4a3820";
  const cloth = sim.damage >= 2 ? "#4e2422" : "#6a2f2c";
  const skin = "#c4a07a";
  const frozen = sim.freezeLeft > 0;
  if (frozen) ctx.filter = "saturate(0.42) brightness(0.94)";
  const slot = GOLIATH_SPRITES[sim.goliathPose];
  const posed = drawSprite(ctx, slot, GOLIATH_LOCAL.foot.x, GOLIATH_LOCAL.foot.y);
  if (!posed && !slot.src) {

  ctx.fillStyle = metalDark;
  ctx.fillRect(-74, 980, 54, 320);
  ctx.fillRect(24, 980, 54, 320);
  ctx.fillStyle = "#3a2c1c";
  ellipse(ctx, -46, 1310, 48, 18);
  ctx.fill();
  ellipse(ctx, 50, 1310, 48, 18);
  ctx.fill();

  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-118, 710);
  ctx.lineTo(126, 710);
  ctx.lineTo(102, 1008);
  ctx.lineTo(-92, 1008);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = metalDark;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(-80 + i * 24, 972, 11, 74 + (i % 2) * 18);
  }
  if (sim.damage >= 1) {
    ctx.strokeStyle = "rgba(18,14,10,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 760);
    ctx.lineTo(30, 900);
    ctx.stroke();
  }

  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(-132, 350);
  ctx.lineTo(140, 350);
  ctx.lineTo(112, 760);
  ctx.lineTo(-102, 760);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = metalDark;
  ctx.fillRect(-42, 390, 90, 310);
  ctx.fillStyle = "#efe8dc";
  ctx.globalAlpha = 0.18;
  ctx.fillRect(-120, 370, 18, 360);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(158, 420);
  ctx.rotate(-0.58);
  ctx.fillStyle = metalDark;
  ctx.fillRect(-18, 0, 30, 640);
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(-32, -16);
  ctx.lineTo(34, -16);
  ctx.lineTo(8, 78);
  ctx.lineTo(-10, 78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const sh = shieldLocal(sim.shieldUp, sim.shieldWarn);
  ctx.save();
  ctx.translate(sh.x, sh.y);
  if (sim.shieldWarn) {
    ctx.strokeStyle = "rgba(239,232,220,0.45)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 142, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = metalDark;
  ctx.beginPath();
  ctx.arc(0, 0, 132, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe8dc";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(18,16,12,0.5)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = skin;
  ellipse(ctx, 8, 268, 64, 76);
  ctx.fill();
  ctx.fillStyle = "#2a1c16";
  ellipse(ctx, -14, 250, 7, 5);
  ctx.fill();
  ellipse(ctx, 28, 250, 7, 5);
  ctx.fill();
  ctx.fillStyle = "#3a2a22";
  ctx.beginPath();
  ctx.moveTo(-42, 302);
  ctx.quadraticCurveTo(10, 368, 64, 302);
  ctx.lineTo(56, 250);
  ctx.lineTo(-34, 250);
  ctx.fill();

  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.ellipse(8, 208, 90, 82, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = metalDark;
  ctx.beginPath();
  ctx.moveTo(-82, 208);
  ctx.quadraticCurveTo(8, 304, 98, 208);
  ctx.lineTo(80, 238);
  ctx.quadraticCurveTo(8, 274, -64, 238);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a140e";
  ctx.fillRect(-30, 212, 76, 16);
  ctx.fillStyle = "#d8c4a0";
  ctx.beginPath();
  ctx.moveTo(-8, 112);
  ctx.lineTo(24, 112);
  ctx.lineTo(12, 210);
  ctx.closePath();
  ctx.fill();

  if (sim.damage >= 1) {
    ctx.strokeStyle = "rgba(18,14,10,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 170);
    ctx.lineTo(-8, 208);
    ctx.lineTo(20, 168);
    ctx.stroke();
  }
  if (sim.damage >= 2) {
    ctx.beginPath();
    ctx.moveTo(40, 150);
    ctx.lineTo(70, 200);
    ctx.stroke();
  }
  if (sim.damage >= 3) {
    ctx.fillStyle = "rgba(18,14,10,0.35)";
    ctx.fillRect(-20, 150, 50, 8);
  }
  }

  if (posed && flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, flash);
    ctx.filter = "brightness(2.6)";
    drawSprite(ctx, slot, GOLIATH_LOCAL.foot.x, GOLIATH_LOCAL.foot.y);
    ctx.restore();
  }

  ctx.filter = "none";
  if (posed && (sim.shieldWarn || sim.shieldUp)) {
    const sh = shieldLocal(sim.shieldUp, sim.shieldWarn);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    if (sim.shieldUp) {
      ctx.fillStyle = "#8a6a3e";
      ctx.beginPath();
      ctx.ellipse(0, 0, sh.r, sh.r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2c18";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = "#d7c48a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, sh.r * 0.72, sh.r * 0.84, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(232,196,120,0.9)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, sh.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (frozen) {
    ctx.strokeStyle = "rgba(186,214,228,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(32, 780, 300, 430, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (sim.critOpen && (sim.phase === "play" || sim.phase === "countdown" || sim.phase === "practice")) {
    ctx.strokeStyle = "rgba(232,196,120,0.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(GOLIATH_LOCAL.forehead.x, GOLIATH_LOCAL.forehead.y, GOLIATH_LOCAL.forehead.rx + 8, GOLIATH_LOCAL.forehead.ry + 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  if (sim.phase !== "play" && sim.phase !== "countdown") return;
  const power = sim.armed || sim.charge > 0.15 ? Math.max(0.7, sim.charge) : 0.78;
  const flight = stoneFlight(sim.aimX, sim.aimY, power, sim.davidPose, sim.charge, sim.time);
  ctx.save();
  ctx.setLineDash(sim.armed ? [14, 10] : [8, 14]);
  ctx.strokeStyle = sim.armed ? "rgba(239,232,220,0.78)" : "rgba(239,232,220,0.32)";
  ctx.lineWidth = sim.armed ? 5 : 3;
  ctx.beginPath();
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const ti = (flight.t * i) / steps;
    const x = flight.originX + flight.vx * ti;
    const y = flight.originY + flight.vy * ti + 0.5 * GRAVITY * ti * ti;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(239,232,220,0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(flight.targetX - 26, flight.targetY - 26, 52, 52);
  ctx.beginPath();
  ctx.arc(flight.targetX, flight.targetY, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#efe8dc";
  ctx.fill();
  ctx.restore();
}

function drawDavid(ctx: CanvasRenderingContext2D, sim: GameSim): void {
  const pose = sim.davidPose;
  const slot = davidSprite(pose);
  const motion = davidMotion(pose, sim.aimX, sim.charge, sim.time);
  const sling = davidWorld(DAVID_SLING_PX.x, DAVID_SLING_PX.y);
  const slingX = sling.x - DAVID_FOOT_WORLD.x;
  const slingY = sling.y - DAVID_FOOT_WORLD.y;
  ctx.save();
  ctx.translate(DAVID_FOOT_WORLD.x + motion.x, DAVID_FOOT_WORLD.y + motion.y);
  ctx.rotate(motion.rot);
  ctx.fillStyle = "rgba(20,16,12,0.35)";
  ellipse(ctx, 0, 8, 120, 16);
  ctx.fill();
  if (pose === "spin" || pose === "throw") {
    ctx.strokeStyle = pose === "throw" ? "rgba(239,232,220,0.8)" : "rgba(239,232,220,0.35)";
    ctx.lineWidth = pose === "throw" ? 4 : 2;
    ctx.beginPath();
    ctx.arc(slingX, slingY, pose === "throw" ? 46 : 28, -0.8, 0.9);
    ctx.stroke();
  }
  if (drawSprite(ctx, slot, 0, 0)) {
    if (pose === "focus") {
      const chest = davidWorld(DAVID_CHEST_PX.x, DAVID_CHEST_PX.y);
      ctx.strokeStyle = "rgba(186,214,228,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(chest.x - DAVID_FOOT_WORLD.x, chest.y - DAVID_FOOT_WORLD.y, 54, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.restore();

  const x = WORLD_W / 2;
  const y = 1630;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sim.aimX * 0.12);
  ctx.scale(1.18, 1.18);

  ctx.fillStyle = "rgba(20,16,12,0.32)";
  ellipse(ctx, 0, 214, 78, 18);
  ctx.fill();

  ctx.fillStyle = "#c9a57a";
  ctx.fillRect(-16, 70, 14, 90);
  ctx.fillRect(6, 70, 14, 90);
  ctx.fillStyle = "#3a2c1c";
  ellipse(ctx, -10, 164, 18, 8);
  ctx.fill();
  ellipse(ctx, 14, 164, 18, 8);
  ctx.fill();

  ctx.fillStyle = "#efe8dc";
  ctx.beginPath();
  ctx.moveTo(-40, 6);
  ctx.lineTo(42, 6);
  ctx.lineTo(30, 94);
  ctx.lineTo(-28, 94);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6a4a2c";
  ctx.fillRect(-28, 70, 58, 11);
  ctx.fillStyle = "#7a3a2c";
  ctx.fillRect(-8, 22, 18, 48);

  ctx.fillStyle = "#c9a57a";
  ellipse(ctx, 0, -18, 22, 26);
  ctx.fill();
  ctx.fillStyle = "#2a2218";
  ctx.beginPath();
  ctx.ellipse(0, -28, 22, 16, 0, Math.PI, 0);
  ctx.fill();

  const poseArm = sim.davidPose;
  const swing = poseArm === "spin" ? 1 : poseArm === "throw" ? 0.45 : poseArm === "recover" ? 0.2 : sim.throwAnim;
  const pull = poseArm === "ready" || poseArm === "spin" ? 0.9 : poseArm === "focus" ? 0.15 : sim.charge;
  ctx.save();
  ctx.translate(28, 22);
  ctx.rotate(poseArm === "throw" ? 0.85 : poseArm === "focus" ? 0.95 : -0.35 - pull * 1.15 - swing * 2.2);
  ctx.strokeStyle = "#3a2c1c";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(20, 50);
  ctx.stroke();
  ctx.strokeStyle = "#d7cbb8";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(20, 50);
  ctx.quadraticCurveTo(48 + pull * 50, 78 + pull * 70, 6, 92);
  ctx.stroke();
  if (pull > 0.08 && swing < 0.15) {
    ctx.fillStyle = "#6d6458";
    ellipse(ctx, 8, 90, 11, 8);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-26, 24);
  ctx.rotate(poseArm === "focus" ? -0.95 : 0.4 + pull * 0.5);
  ctx.fillStyle = "#c9a57a";
  ctx.fillRect(-6, 0, 12, 52);
  ctx.restore();

  if (poseArm === "focus") {
    ctx.strokeStyle = "rgba(186,214,228,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(4, 28, 36, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPip(
  ctx: CanvasRenderingContext2D,
  _video: HTMLVideoElement | null,
  skeleton: { x: number; y: number; v: number }[] | null,
  present: boolean,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (skeleton) {
    ctx.strokeStyle = present ? "rgba(239,232,220,0.9)" : "rgba(239,232,220,0.4)";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    const pt = (i: number) => ({ x: skeleton[i].x * w, y: skeleton[i].y * h });
    const pairs = [
      [1, 2],
      [1, 3],
      [3, 5],
      [2, 4],
      [4, 6],
      [1, 7],
      [2, 8],
      [7, 8],
    ];
    for (const [a, b] of pairs) {
      if (!skeleton[a] || !skeleton[b] || skeleton[a].v < 0.3 || skeleton[b].v < 0.3) continue;
      const pa = pt(a);
      const pb = pt(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    for (const s of skeleton) {
      if (s.v < 0.3) continue;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
