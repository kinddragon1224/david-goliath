import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-pxrZFmOq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GameAudio = class {
	ctx = null;
	master = null;
	muted = false;
	unlock = () => {
		if (!this.ctx) {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			this.ctx = new Ctx({ latencyHint: "interactive" });
			this.master = this.ctx.createGain();
			this.master.gain.value = .22;
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
	};
	setMuted(next) {
		this.muted = next;
		if (this.master && this.ctx) this.master.gain.setTargetAtTime(next ? 0 : .22, this.ctx.currentTime, .03);
	}
	play(name) {
		if (!this.ctx || !this.master || this.muted) return;
		const t = this.ctx.currentTime;
		switch (name) {
			case "throw":
				this.noiseSweep(t, .18, 900, 240, .35);
				break;
			case "hitSoft":
				this.thump(t, 90, .28);
				break;
			case "hitShield":
				this.clang(t);
				break;
			case "hitHead":
				this.chime(t, 740, .4);
				this.thump(t, 70, .22);
				break;
			case "stagger":
				this.chime(t, 520, .55);
				this.chime(t + .08, 780, .4);
				break;
			case "tick":
				this.chime(t, 880, .12);
				break;
			case "start":
				this.chime(t, 392, .2);
				this.chime(t + .1, 523, .24);
				break;
			case "end":
				this.chime(t, 523, .28);
				this.chime(t + .14, 392, .4);
				break;
			case "combo":
				this.chime(t, 660, .18);
				this.chime(t + .05, 880, .16);
		}
	}
	osc(freq, type, t, dur, gain, freqEnd) {
		if (!this.ctx || !this.master) return;
		const o = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .012);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		o.connect(g);
		g.connect(this.master);
		o.start(t);
		o.stop(t + dur + .02);
		o.onended = () => {
			o.disconnect();
			g.disconnect();
		};
	}
	thump(t, freq, gain) {
		this.osc(freq, "sine", t, .22, gain, freq * .4);
	}
	chime(t, freq, gain) {
		this.osc(freq, "triangle", t, .35, gain, freq * .92);
	}
	clang(t) {
		this.osc(620, "square", t, .12, .12, 280);
		this.osc(930, "triangle", t, .18, .1, 400);
	}
	noiseSweep(t, dur, from, to, gain) {
		if (!this.ctx || !this.master) return;
		const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const src = this.ctx.createBufferSource();
		src.buffer = buffer;
		const filter = this.ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.setValueAtTime(from, t);
		filter.frequency.exponentialRampToValueAtTime(to, t + dur);
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .02);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		src.connect(filter);
		filter.connect(g);
		g.connect(this.master);
		src.start(t);
		src.stop(t + dur);
		src.onended = () => {
			src.disconnect();
			filter.disconnect();
			g.disconnect();
		};
	}
};
var WORLD_W = 1080;
var WORLD_H = 1920;
var THROW_COOLDOWN = .62;
var GRAVITY = 1520;
var STONE_OY = 1568;
var SCORE_STAGGER_BONUS = 1e3;
var SCORES_KEY = "alllove-david-goliath-scores-v1";
var CHURCH_NAME = "모두애침례교회";
var CHURCH_NAME_EN = "ALL LOVE CHURCH";
var GAME_TITLE = "다윗과 골리앗";
function stoneFlight(goliathX, bob, aimX, power) {
	const steer = Math.max(-1, Math.min(1, aimX));
	const targetX = goliathX + 8 + steer * 170;
	const targetY = 70 + bob + 198;
	const t = .82 - Math.max(.25, Math.min(1, power)) * .18;
	return {
		vx: (targetX - 568) / t,
		vy: (targetY - STONE_OY) / t - .5 * GRAVITY * t,
		targetX,
		targetY,
		t,
		originX: 568,
		originY: STONE_OY
	};
}
function ellipse(ctx, x, y, rx, ry) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function drawWorld(ctx, sim, bg) {
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
		sky.addColorStop(.45, "#3a3a48");
		sky.addColorStop(1, "#c4a882");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, WORLD_W, WORLD_H);
	}
	const dusk = ctx.createLinearGradient(0, 0, 0, WORLD_H);
	dusk.addColorStop(0, "rgba(12,16,24,0.18)");
	dusk.addColorStop(.55, "rgba(12,16,24,0)");
	dusk.addColorStop(1, "rgba(18,14,10,0.28)");
	ctx.fillStyle = dusk;
	ctx.fillRect(0, 0, WORLD_W, WORLD_H);
	drawDust(ctx, sim.time);
	drawGoliath(ctx, sim);
	drawAim(ctx, sim);
	drawDavid(ctx, sim);
	for (const ring of sim.rings) {
		const k = 1 - ring.life / ring.maxLife;
		ctx.strokeStyle = `rgba(239,232,220,${.55 * (1 - k)})`;
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
		ctx.moveTo(s.x - s.vx * .055, s.y - s.vy * .055);
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
function drawDust(ctx, t) {
	ctx.fillStyle = "rgba(239,232,220,0.16)";
	for (let i = 0; i < 18; i++) {
		const x = (i * 137 + t * 12) % WORLD_W;
		const y = 220 + (i * 89 + t * 18) % 900;
		ctx.beginPath();
		ctx.arc(x, y, 1.4 + i % 3, 0, Math.PI * 2);
		ctx.fill();
	}
}
function drawGoliath(ctx, sim) {
	const gx = sim.goliathX;
	const gy = 70 + sim.goliathBob;
	const flash = sim.hitFlash;
	const down = sim.downed ? 1 : 0;
	ctx.save();
	ctx.translate(gx, gy);
	ctx.rotate((-.08 * Math.min(1, sim.stagger) - .12 * down) * (sim.stagger > 0 || down ? 1 : 0));
	if (down) ctx.translate(40, 80);
	ctx.fillStyle = "rgba(20,16,12,0.4)";
	ellipse(ctx, 0, 1320, 180, 32);
	ctx.fill();
	const metal = flash > .4 ? "#efe8dc" : "#8a6d42";
	const metalDark = flash > .4 ? "#d7d0c3" : "#4a3820";
	const cloth = sim.damage >= 2 ? "#4e2422" : "#6a2f2c";
	const skin = "#c4a07a";
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
	for (let i = 0; i < 7; i++) ctx.fillRect(-80 + i * 24, 972, 11, 74 + i % 2 * 18);
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
	ctx.globalAlpha = .18;
	ctx.fillRect(-120, 370, 18, 360);
	ctx.globalAlpha = 1;
	ctx.save();
	ctx.translate(158, 420);
	ctx.rotate(-.58);
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
	const shieldLift = sim.shieldUp ? 390 : sim.shieldWarn ? 470 : 560;
	ctx.save();
	ctx.translate(-150, shieldLift);
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
	if (sim.phase === "play" || sim.phase === "countdown") {
		const pulse = 16 + Math.sin(sim.time * 7) * 5;
		ctx.strokeStyle = `rgba(239,232,220,${.55 + Math.sin(sim.time * 7) * .3})`;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(8, 198, pulse + 10, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = "rgba(239,232,220,0.92)";
		ctx.beginPath();
		ctx.arc(8, 198, 12, 0, Math.PI * 2);
		ctx.fill();
		ctx.font = "700 28px 'Noto Sans KR', sans-serif";
		ctx.textAlign = "center";
		ctx.fillStyle = "#efe8dc";
		ctx.fillText("급소 x2", 8, 168);
	}
	ctx.restore();
}
function drawAim(ctx, sim) {
	if (sim.phase !== "play" && sim.phase !== "countdown") return;
	const power = sim.armed || sim.charge > .15 ? Math.max(.7, sim.charge) : .78;
	const flight = stoneFlight(sim.goliathX, sim.goliathBob, sim.aimX, power);
	ctx.save();
	ctx.setLineDash(sim.armed ? [14, 10] : [8, 14]);
	ctx.strokeStyle = sim.armed ? "rgba(239,232,220,0.78)" : "rgba(239,232,220,0.32)";
	ctx.lineWidth = sim.armed ? 5 : 3;
	ctx.beginPath();
	const steps = 18;
	for (let i = 0; i <= steps; i++) {
		const ti = flight.t * i / steps;
		const x = flight.originX + flight.vx * ti;
		const y = flight.originY + flight.vy * ti + .5 * GRAVITY * ti * ti;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.stroke();
	ctx.setLineDash([]);
	const hx = sim.goliathX + 8;
	const hy = 70 + sim.goliathBob + 198;
	ctx.strokeStyle = "rgba(239,232,220,0.9)";
	ctx.lineWidth = 3;
	ctx.strokeRect(flight.targetX - 26, hy - 26, 52, 52);
	ctx.beginPath();
	ctx.moveTo(hx, hy + 36);
	ctx.lineTo(flight.targetX, hy);
	ctx.stroke();
	ctx.fillStyle = "#efe8dc";
	ctx.beginPath();
	ctx.arc(flight.targetX, hy, 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}
function drawDavid(ctx, sim) {
	const x = WORLD_W / 2;
	const y = 1630;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(sim.aimX * .12);
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
	const swing = sim.throwAnim;
	const pull = sim.armed || sim.charge > .2 ? Math.max(sim.charge, sim.armed ? .85 : 0) : 0;
	ctx.save();
	ctx.translate(28, 22);
	ctx.rotate(-.35 - pull * 1.15 - swing * 2.5);
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
	if (pull > .08 && swing < .15) {
		ctx.fillStyle = "#6d6458";
		ellipse(ctx, 8, 90, 11, 8);
		ctx.fill();
	}
	ctx.restore();
	ctx.save();
	ctx.translate(-26, 24);
	ctx.rotate(.4 + pull * .5);
	ctx.fillStyle = "#c9a57a";
	ctx.fillRect(-6, 0, 12, 52);
	ctx.restore();
	ctx.restore();
}
function drawPip(ctx, _video, skeleton, present) {
	const w = ctx.canvas.width;
	const h = ctx.canvas.height;
	ctx.save();
	ctx.clearRect(0, 0, w, h);
	if (skeleton) {
		ctx.strokeStyle = present ? "rgba(239,232,220,0.9)" : "rgba(239,232,220,0.4)";
		ctx.fillStyle = ctx.strokeStyle;
		ctx.lineWidth = 2;
		const pt = (i) => ({
			x: skeleton[i].x * w,
			y: skeleton[i].y * h
		});
		for (const [a, b] of [
			[1, 2],
			[1, 3],
			[3, 5],
			[2, 4],
			[4, 6],
			[1, 7],
			[2, 8],
			[7, 8]
		]) {
			if (!skeleton[a] || !skeleton[b] || skeleton[a].v < .3 || skeleton[b].v < .3) continue;
			const pa = pt(a);
			const pb = pt(b);
			ctx.beginPath();
			ctx.moveTo(pa.x, pa.y);
			ctx.lineTo(pb.x, pb.y);
			ctx.stroke();
		}
		for (const s of skeleton) {
			if (s.v < .3) continue;
			ctx.beginPath();
			ctx.arc(s.x * w, s.y * h, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}
function loadScores() {
	try {
		const raw = localStorage.getItem(SCORES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((row) => !!row && typeof row === "object" && typeof row.score === "number" && typeof row.at === "number").sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 30);
	} catch {
		return [];
	}
}
function saveScores(rows) {
	localStorage.setItem(SCORES_KEY, JSON.stringify(rows.slice(0, 30)));
}
function addScore(score) {
	const at = Date.now();
	const list = [...loadScores(), {
		score,
		at
	}].sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 30);
	saveScores(list);
	const rank = list.findIndex((r) => r.at === at) + 1;
	return {
		list,
		rank: rank > 0 ? rank : list.length
	};
}
function clearScores() {
	saveScores([]);
	return [];
}
function formatScoreDate(at) {
	return new Date(at).toLocaleString("ko-KR", {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}
var VERSES = [
	{
		ref: "사무엘상 17:47",
		text: "여호와께서 구원하시는 것은 칼과 창에 있지 아니함을 이 무리에게 알게 하리라"
	},
	{
		ref: "사무엘상 17:45",
		text: "나는 만군의 여호와의 이름 곧 네가 모욕하는 이스라엘 군대의 하나님의 이름으로 네게 가노라"
	},
	{
		ref: "사무엘상 17:37",
		text: "여호와께서 나를 사자의 발톱과 곰의 발톱에서 건져내셨은즉 나를 이 블레셋 사람의 손에서도 건져내시리이다"
	},
	{
		ref: "여호수아 1:9",
		text: "강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라"
	},
	{
		ref: "신명기 31:6",
		text: "너희는 강하고 담대하라 두려워하지 말라 놀라지 말라 네 하나님 여호와 그가 너와 함께 가시며 결코 떠나지 아니하시고 버리지 아니하시리라"
	},
	{
		ref: "시편 27:1",
		text: "여호와는 나의 빛이요 나의 구원이시니 내가 누구를 두려워하리요"
	},
	{
		ref: "시편 18:2",
		text: "여호와는 나의 반석이시요 나의 요새시요 나를 건지시는 이시요 나의 하나님이시요 내가 그 안에 피할 나의 바위시요"
	},
	{
		ref: "빌립보서 4:13",
		text: "내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라"
	},
	{
		ref: "고린도후서 12:9",
		text: "내 은혜가 네게 족하도다 이는 내 능력이 약한 데서 온전하여짐이라"
	},
	{
		ref: "시편 23:4",
		text: "내가 사망의 음침한 골짜기로 다닐지라도 해를 두려워하지 않을 것은 주께서 나와 함께 하심이라"
	}
];
function randomVerse(except) {
	const pool = except ? VERSES.filter((v) => v.ref !== except) : VERSES;
	return pool[Math.floor(Math.random() * pool.length)] ?? VERSES[0];
}
var Game = class {
	audio;
	emit;
	phase = "boot";
	time = 0;
	score = 0;
	combo = 0;
	comboTimer = 0;
	timeLeft = 30;
	countdown = 3;
	verse = randomVerse();
	personPresent = false;
	cameraState = "off";
	lastHit = null;
	resultRank = 0;
	scores = [];
	confirmReset = false;
	banner = null;
	bannerLife = 0;
	poseReady = false;
	armed = false;
	cameraError = null;
	foreheadHits = 0;
	awardedStagger = false;
	maxCombo = 0;
	shieldWarn = false;
	downed = false;
	aimX = 0;
	damage = 0;
	rings = [];
	goliathX = WORLD_W / 2;
	goliathBob = 0;
	shieldUp = false;
	hitFlash = 0;
	stagger = 0;
	throwAnim = 0;
	charge = 0;
	shakeX = 0;
	shakeY = 0;
	stones = [];
	particles = [];
	floaters = [];
	throwCool = 0;
	demoAcc = 0;
	countdownAcc = 0;
	resultAcc = 0;
	handsHold = 0;
	personHold = 0;
	vacantHold = 0;
	charging = false;
	chargeX = 0;
	chargeY = 0;
	pointerId = null;
	lastUiKey = "";
	bg = null;
	hitStop = 0;
	trauma = 0;
	aiT = 0;
	aiMode = "open";
	lastUrgentTick = 11;
	downedLife = 0;
	constructor(audio, emit) {
		this.audio = audio;
		this.emit = emit;
		this.scores = loadScores();
		this.pushUi(true);
	}
	setBackground(img) {
		this.bg = img;
	}
	setCameraState(state, error = null) {
		this.cameraState = state;
		this.cameraError = state === "denied" ? error : null;
		this.pushUi(true);
	}
	setPoseReady(ready) {
		this.poseReady = ready;
		this.pushUi(true);
	}
	begin() {
		this.audio.unlock();
		this.phase = "attract";
		this.verse = randomVerse();
		this.pushUi(true);
	}
	uiAdvance() {
		if (this.phase === "boot") this.begin();
		else if (this.phase === "attract") this.goStart();
		else if (this.phase === "start") this.goCountdown();
		else if (this.phase === "result") this.goAttract();
	}
	setPerson(present) {
		this.personPresent = present;
	}
	notePose(frame) {
		this.personPresent = frame.present;
		this.armed = frame.armed;
		this.poseReady = true;
		if (frame.skeleton && frame.skeleton.length > 6) {
			const lw = frame.skeleton[5];
			const rw = frame.skeleton[6];
			const hand = lw && rw ? lw.y < rw.y ? lw : rw : lw ?? rw;
			if (hand) this.aimX += ((hand.x - .5) * 2 - this.aimX) * .28;
		}
		if (this.phase === "play" && frame.armed) this.charge = Math.max(this.charge, .82);
		if (this.phase === "attract") {
			if (frame.present) {
				this.personHold += 1;
				if (this.personHold > 10) this.goStart();
			} else this.personHold = 0;
		}
		if (this.phase === "start" && frame.handsUp) {
			this.handsHold += 1;
			if (this.handsHold > 8) this.goCountdown();
		} else if (this.phase === "start") this.handsHold = 0;
		if (this.phase === "play" && frame.throwEvent) {
			this.launch(frame.throwEvent);
			this.banner = "던짐!";
			this.bannerLife = .55;
		}
		if (this.phase === "result" && !frame.present) {
			this.vacantHold += 1;
			if (this.vacantHold > 45) this.goAttract();
		} else if (this.phase === "result" && frame.present) this.vacantHold = 0;
	}
	pointerDown(x, y, id) {
		this.pointerId = id;
		if (this.phase === "boot") {
			this.begin();
			return;
		}
		if (this.phase === "attract") {
			if (this.cameraState === "live") this.goStart();
			return;
		}
		if (this.phase === "result") this.goAttract();
	}
	pointerMove(_x, _y, _id) {}
	pointerUp(_x, _y, _id) {
		this.pointerId = null;
		this.charging = false;
		this.charge = 0;
	}
	throwStone(power = .78, aimX) {
		const x = aimX ?? Math.max(-1, Math.min(1, (this.goliathX - 540) / 220));
		this.launch({
			power,
			aimX: x
		});
	}
	nextPlayer() {
		this.goAttract();
	}
	toggleMute() {
		this.audio.setMuted(!this.audio.muted);
		this.pushUi(true);
	}
	askReset() {
		this.confirmReset = true;
		this.pushUi(true);
	}
	confirmClear() {
		this.scores = clearScores();
		this.confirmReset = false;
		this.pushUi(true);
	}
	cancelClear() {
		this.confirmReset = false;
		this.pushUi(true);
	}
	update(dt) {
		const raw = Math.min(dt, .1);
		if (this.hitStop > 0) {
			this.hitStop -= raw;
			this.stepFx(raw);
			this.hitFlash = Math.max(0, this.hitFlash - raw * 4);
			this.pushUi();
			return;
		}
		const capped = raw;
		this.time += capped;
		this.stepGoliath(capped);
		this.hitFlash = Math.max(0, this.hitFlash - capped * 4);
		this.stagger = Math.max(0, this.stagger - capped);
		this.throwAnim = Math.max(0, this.throwAnim - capped * 3.2);
		this.throwCool = Math.max(0, this.throwCool - capped);
		this.comboTimer = Math.max(0, this.comboTimer - capped);
		if (this.comboTimer <= 0) this.combo = 0;
		this.bannerLife = Math.max(0, this.bannerLife - capped);
		if (this.bannerLife <= 0) this.banner = null;
		this.trauma = Math.max(0, this.trauma - capped * 1.8);
		const shake = this.trauma * this.trauma;
		this.shakeX = (Math.random() - .5) * 22 * shake;
		this.shakeY = (Math.random() - .5) * 14 * shake;
		if (this.phase === "play" && this.armed) this.charge = Math.min(1, this.charge + capped * 2.4);
		else this.charge = Math.max(0, this.charge - capped * 2);
		if (this.phase === "attract") {
			this.demoAcc += capped;
			if (this.demoAcc > 2.05) {
				this.demoAcc = 0;
				const toHead = Math.random() > .28;
				this.launch({
					power: toHead ? .92 : .55 + Math.random() * .25,
					aimX: toHead ? (Math.random() - .5) * .2 : (Math.random() - .5) * .9
				}, true);
			}
		}
		if (this.phase === "countdown") {
			this.countdownAcc += capped;
			if (this.countdownAcc >= 1) {
				this.countdownAcc = 0;
				this.countdown -= 1;
				this.audio.play("tick");
				if (this.countdown <= 0) {
					this.phase = "play";
					this.timeLeft = 30;
					this.score = 0;
					this.combo = 0;
					this.maxCombo = 0;
					this.foreheadHits = 0;
					this.awardedStagger = false;
					this.downed = false;
					this.damage = 0;
					this.lastHit = null;
					this.aiMode = "open";
					this.aiT = 0;
					this.lastUrgentTick = 11;
					this.audio.play("start");
				}
				this.pushUi(true);
			}
		}
		if (this.phase === "play") {
			this.timeLeft -= capped;
			if (this.timeLeft <= 10 && this.timeLeft > 0) {
				const sec = Math.ceil(this.timeLeft);
				if (sec < this.lastUrgentTick) {
					this.lastUrgentTick = sec;
					this.audio.play("tick");
				}
			}
			if (this.timeLeft <= 0) {
				this.timeLeft = 0;
				this.finishRound();
			}
		}
		if (this.phase === "result") {
			this.resultAcc += capped;
			if (this.resultAcc > 16) this.goAttract();
		}
		this.stepStones(capped);
		this.stepFx(capped);
		this.pushUi();
	}
	render(ctx) {
		drawWorld(ctx, this.sim(), this.bg);
	}
	sim() {
		return {
			phase: this.phase,
			time: this.time,
			goliathX: this.goliathX,
			goliathBob: this.goliathBob,
			shieldUp: this.shieldUp,
			shieldWarn: this.shieldWarn,
			hitFlash: this.hitFlash,
			stagger: this.stagger,
			throwAnim: this.throwAnim,
			charge: this.charge,
			shakeX: this.shakeX,
			shakeY: this.shakeY,
			stones: this.stones,
			particles: this.particles,
			floaters: this.floaters,
			rings: this.rings,
			damage: this.damage,
			armed: this.armed,
			aimX: this.aimX,
			downed: this.downed,
			sightX: this.goliathX + 8 + Math.max(-1, Math.min(1, this.aimX)) * 170
		};
	}
	goStart() {
		if (this.phase === "start" || this.phase === "countdown" || this.phase === "play") return;
		this.phase = "start";
		this.verse = randomVerse(this.verse.ref);
		this.handsHold = 0;
		this.confirmReset = false;
		this.pushUi(true);
	}
	goCountdown() {
		if (this.cameraState !== "live") {
			this.banner = "카메라가 켜져야 시작할 수 있습니다";
			this.bannerLife = 2;
			this.pushUi(true);
			return;
		}
		this.phase = "countdown";
		this.countdown = 3;
		this.countdownAcc = 0;
		this.stones = [];
		this.audio.play("tick");
		this.pushUi(true);
	}
	goAttract() {
		this.phase = "attract";
		this.personHold = 0;
		this.vacantHold = 0;
		this.resultAcc = 0;
		this.confirmReset = false;
		this.banner = null;
		this.pushUi(true);
	}
	finishRound() {
		this.phase = "result";
		this.resultAcc = 0;
		this.vacantHold = 0;
		const saved = addScore(this.score);
		this.scores = saved.list;
		this.resultRank = saved.rank;
		this.audio.play("end");
		this.pushUi(true);
	}
	launch(ev, demo = false) {
		if (!demo && this.phase !== "play") return;
		if (!demo && this.throwCool > 0) return;
		if (this.stones.filter((s) => s.live).length >= 6) return;
		const power = ev.power;
		const flight = stoneFlight(this.goliathX, this.goliathBob, ev.aimX, power);
		this.stones.push({
			x: flight.originX,
			y: flight.originY,
			vx: flight.vx,
			vy: flight.vy,
			rot: 0,
			spin: (Math.random() - .5) * 10,
			live: true
		});
		this.aimX = ev.aimX;
		this.throwAnim = 1;
		this.charge = 0;
		this.throwCool = demo ? .2 : THROW_COOLDOWN;
		if (!demo) this.audio.play("throw");
	}
	stepStones(dt) {
		for (const s of this.stones) {
			if (!s.live) continue;
			s.vy += GRAVITY * dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.rot += s.spin * dt;
			if (s.y > 1960 || s.x < -80 || s.x > 1160 || s.y < -120) {
				s.live = false;
				continue;
			}
			this.collide(s);
		}
		this.stones = this.stones.filter((s) => s.live || s.y < 2e3);
	}
	collide(s) {
		const gx = this.goliathX;
		const gy = 70 + this.goliathBob;
		const shield = {
			x: gx - 150,
			y: gy + (this.shieldUp ? 390 : 560),
			r: 118
		};
		const forehead = {
			x: gx + 8,
			y: gy + 198,
			r: 78
		};
		const head = {
			x: gx + 8,
			y: gy + 278,
			r: 58
		};
		const torso = {
			x: gx,
			y: gy + 560,
			w: 240,
			h: 320
		};
		const legs = {
			x: gx,
			y: gy + 1080,
			w: 190,
			h: 260
		};
		const hitCirc = (c) => Math.hypot(s.x - c.x, s.y - c.y) < c.r + 16;
		const hitBox = (b) => s.x > b.x - b.w / 2 && s.x < b.x + b.w / 2 && s.y > b.y - b.h / 2 && s.y < b.y + b.h / 2;
		const rising = s.vy < 0;
		if (hitCirc(forehead)) {
			this.registerHit("이마", 800, s.x, s.y, "hitHead");
			s.live = false;
			return;
		}
		if (!rising && hitCirc(head)) {
			this.registerHit("투구", 300, s.x, s.y, "hitHead");
			s.live = false;
			return;
		}
		if (s.x < gx - 48 && hitCirc(shield)) {
			this.registerHit("방패", 40, s.x, s.y, "hitShield");
			s.live = false;
			return;
		}
		if (!rising && hitBox(torso)) {
			this.registerHit("갑옷", 120, s.x, s.y, "hitSoft");
			s.live = false;
			return;
		}
		if (!rising && hitBox(legs)) {
			this.registerHit("다리", 80, s.x, s.y, "hitSoft");
			s.live = false;
		}
	}
	registerHit(label, base, x, y, sfx) {
		if (this.phase !== "play") {
			this.burst(x, y, sfx === "hitHead" ? "#efe8dc" : "#c4b49a");
			this.hitFlash = .4;
			return;
		}
		if (this.comboTimer > 0) this.combo += 1;
		else this.combo = 1;
		this.comboTimer = 1.8;
		if (this.combo > this.maxCombo) this.maxCombo = this.combo;
		const crit = label === "이마";
		const mult = Math.min(3, 1 + (this.combo - 1) * .25) * (crit ? 2 : 1);
		const gained = Math.round(base * mult);
		this.score += gained;
		this.lastHit = label;
		this.hitFlash = 1;
		this.stagger = crit ? 1.15 : .35;
		this.trauma = Math.min(1, this.trauma + (crit ? .85 : label === "방패" ? .25 : .4));
		if (crit) this.hitStop = .08;
		this.rings.push({
			x,
			y,
			life: .45,
			maxLife: .45,
			r: 18
		});
		this.floaters.push({
			x,
			y,
			life: .95,
			maxLife: .95,
			text: crit ? `CRIT x2  ${gained}` : this.combo > 1 ? `${gained}  ×${this.combo}` : `${gained}`,
			color: crit ? "#efe8dc" : "#d7cbb8"
		});
		this.burst(x, y, crit ? "#efe8dc" : "#c4b49a");
		this.audio.play(sfx);
		if (this.combo > 1 && this.combo % 2 === 0) this.audio.play("combo");
		if (crit || label === "투구") this.damage = Math.min(3, this.damage + 1);
		if (crit) {
			this.foreheadHits += 1;
			this.banner = "크리티컬 x2";
			this.bannerLife = 1.15;
			this.audio.play("combo");
			if (this.foreheadHits > 0 && this.foreheadHits % 3 === 0) {
				this.downed = true;
				this.downedLife = 2.2;
				this.score += SCORE_STAGGER_BONUS;
				this.banner = "골리앗이 무릎을 꿇습니다";
				this.bannerLife = 1.8;
				this.hitStop = .12;
				this.trauma = 1;
				this.audio.play("stagger");
				this.floaters.push({
					x: this.goliathX,
					y: 360,
					life: 1.4,
					maxLife: 1.4,
					text: `+${SCORE_STAGGER_BONUS}`,
					color: "#efe8dc"
				});
			}
		}
	}
	burst(x, y, color) {
		const n = color === "#efe8dc" ? 22 : 14;
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const sp = 80 + Math.random() * 280;
			this.particles.push({
				x,
				y,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp,
				life: .45 + Math.random() * .3,
				maxLife: .7,
				size: 2 + Math.random() * 4,
				color
			});
		}
		if (this.particles.length > 90) this.particles.splice(0, this.particles.length - 90);
	}
	stepFx(dt) {
		for (const p of this.particles) {
			p.vy += 420 * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.life -= dt;
		}
		this.particles = this.particles.filter((p) => p.life > 0);
		for (const f of this.floaters) {
			f.y -= 50 * dt;
			f.life -= dt;
		}
		this.floaters = this.floaters.filter((f) => f.life > 0);
		for (const r of this.rings) r.life -= dt;
		this.rings = this.rings.filter((r) => r.life > 0);
	}
	stepGoliath(dt) {
		const haste = this.phase === "play" && this.timeLeft < 10 ? 1.35 : 1;
		const sway = this.downed ? 28 : 108;
		this.goliathX = WORLD_W / 2 + Math.sin(this.time * .55 * haste) * sway;
		this.goliathBob = Math.sin(this.time * (this.downed ? 2.4 : 1.7)) * (this.downed ? 14 : 8);
		if (this.downed) {
			this.downedLife = Math.max(0, this.downedLife - dt);
			if (this.downedLife <= 0) this.downed = false;
			this.shieldUp = false;
			this.shieldWarn = false;
			this.aiMode = "open";
			return;
		}
		if (this.phase !== "play") {
			this.shieldUp = Math.sin(this.time * .55) > .55;
			this.shieldWarn = false;
			return;
		}
		if (this.stagger > .55) {
			this.shieldUp = false;
			this.shieldWarn = false;
			this.aiMode = "open";
			return;
		}
		this.aiT += dt;
		if (this.aiMode === "open" && this.aiT > 1.55 / haste) {
			this.aiMode = "warn";
			this.aiT = 0;
		} else if (this.aiMode === "warn" && this.aiT > .42) {
			this.aiMode = "guard";
			this.aiT = 0;
		} else if (this.aiMode === "guard" && this.aiT > 1.15 / haste) {
			this.aiMode = "open";
			this.aiT = 0;
		}
		this.shieldWarn = this.aiMode === "warn";
		this.shieldUp = this.aiMode === "guard";
	}
	pushUi(force = false) {
		const snap = this.ui();
		const key = [
			snap.phase,
			snap.score,
			Math.ceil(snap.timeLeft),
			snap.countdown,
			snap.combo,
			snap.maxCombo,
			snap.foreheadHits,
			Math.round(snap.comboLeft * 10),
			snap.personPresent ? 1 : 0,
			snap.cameraState,
			snap.muted ? 1 : 0,
			snap.confirmReset ? 1 : 0,
			snap.banner ?? "",
			snap.motionHint,
			snap.poseReady ? 1 : 0,
			snap.armed ? 1 : 0,
			snap.cameraError ?? "",
			snap.verse.ref,
			snap.scores.length
		].join("|");
		if (!force && key === this.lastUiKey) return;
		this.lastUiKey = key;
		this.emit(snap);
	}
	ui() {
		return {
			phase: this.phase,
			score: this.score,
			combo: this.combo,
			maxCombo: this.maxCombo,
			timeLeft: this.timeLeft,
			countdown: this.countdown,
			verse: this.verse,
			personPresent: this.personPresent,
			cameraState: this.cameraState,
			lastHit: this.lastHit,
			resultRank: this.resultRank,
			scores: this.scores,
			muted: this.audio.muted,
			confirmReset: this.confirmReset,
			banner: this.banner,
			motionHint: this.motionHint(),
			poseReady: this.poseReady,
			armed: this.armed,
			cameraError: this.cameraError,
			foreheadHits: this.foreheadHits,
			comboLeft: this.comboTimer / 1.8,
			bestScore: this.scores[0]?.score ?? 0
		};
	}
	motionHint() {
		if (this.cameraState === "loading") return "카메라를 켜는 중";
		if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
		if (this.cameraState !== "live") return "카메라를 켜 주세요";
		if (!this.personPresent) return "카메라 앞에 상반신이 나오게 서 주세요";
		if (this.phase === "start") return "양손을 머리 위로 들어 시작";
		if (this.phase === "play") {
			if (this.downed) return "쓰러진 사이 계속 던지세요";
			if (this.shieldWarn) return "방패가 올라옵니다 · 지금 급소를 노리세요";
			if (this.shieldUp) return "방패가 가립니다 · 골리앗이 열리는 순간";
			const side = this.goliathX < 504 ? "왼쪽으로 휘두르세요" : this.goliathX > 576 ? "오른쪽으로 휘두르세요" : "정면으로 휘두르세요";
			return this.armed ? `장전 · ${side}` : `골리앗 쪽으로 휘두르세요 · ${side}`;
		}
		if (this.phase === "attract") return "카메라 앞에 서면 시작합니다";
		return "";
	}
};
function Overlays({ ui, onBegin, onStart, onNext, onMute, onAskReset, onConfirmReset, onCancelReset, onRetryCamera, onOpenWindow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 flex flex-col text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onMute,
				className: "pointer-events-auto absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-bg-elevated/80 text-fg",
				"aria-label": ui.muted ? "소리 켜기" : "소리 끄기",
				children: ui.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
			}),
			ui.phase === "boot" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Boot, { onBegin }),
			ui.phase === "attract" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Attract, {
				ui,
				onStart,
				onAskReset,
				onRetryCamera,
				onOpenWindow
			}),
			ui.phase === "start" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Start, {
				ui,
				onStart,
				onRetryCamera,
				onOpenWindow
			}),
			ui.phase === "countdown" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Countdown, { n: ui.countdown }),
			ui.phase === "play" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, { ui }),
			ui.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Result, {
				ui,
				onNext
			}),
			ui.confirmReset && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg/70 px-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-[0_24px_60px_rgb(0_0_0/0.35)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-xl text-fg",
							children: "기록을 모두 지울까요?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-fg-muted",
							children: "리셋 전까지 쌓인 점수가 사라집니다."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onCancelReset,
								className: "h-12 flex-1 rounded-md border border-border-strong text-sm font-medium",
								children: "취소"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onConfirmReset,
								className: "h-12 flex-1 rounded-md bg-fg text-sm font-medium text-accent-fg",
								children: "지우기"
							})]
						})
					]
				})
			})
		]
	});
}
function Boot({ onBegin }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onBegin,
		className: "pointer-events-auto flex h-full w-full flex-col items-center justify-center gap-8 bg-bg px-10 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: "/logo-alllove.jpg",
				alt: CHURCH_NAME,
				className: "h-44 w-44 object-contain"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm tracking-[0.18em] text-fg-muted",
					children: CHURCH_NAME
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-5xl leading-tight text-balance",
					children: GAME_TITLE
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-fg-muted",
					children: CHURCH_NAME_EN
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-full border border-border-strong px-5 py-3 text-sm tracking-wide",
				children: "화면을 눌러 시작"
			})
		]
	});
}
function Attract({ ui, onStart, onAskReset, onRetryCamera, onOpenWindow }) {
	const top = ui.scores.slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "pointer-events-none flex flex-col items-center pt-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: "/logo-alllove.jpg",
					alt: "",
					className: "h-16 w-16 object-contain"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-display text-4xl text-balance",
					children: GAME_TITLE
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs tracking-[0.2em] text-fg-muted",
					children: CHURCH_NAME
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-fg-muted",
					children: "30초 · 카메라 앞에서 팔을 휘두르세요"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "pointer-events-auto mx-5 mb-6 rounded-xl border border-border bg-bg/78 p-5 backdrop-blur-[2px]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onPointerDown: (e) => {
						e.currentTarget.dataset.t = String(performance.now());
					},
					onPointerUp: (e) => {
						const started = Number(e.currentTarget.dataset.t ?? 0);
						if (performance.now() - started > 1400) onAskReset();
					},
					className: "flex w-full items-baseline justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm tracking-[0.16em] text-fg-muted",
						children: "최고 기록"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-fg-subtle",
						children: "길게 눌러 초기화"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
					className: "mt-3 space-y-2",
					children: [top.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-fg-subtle",
						children: "아직 기록이 없습니다"
					}), top.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline justify-between gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums text-fg-subtle",
								children: i + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-1 tabular-nums font-medium",
								children: row.score.toLocaleString("ko-KR")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-fg-subtle",
								children: formatScoreDate(row.at)
							})
						]
					}, `${row.at}-${i}`))]
				}),
				ui.cameraState === "denied" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraHelp, {
					ui,
					onRetry: onRetryCamera,
					onOpenWindow
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onStart,
					className: "mt-5 h-14 w-full rounded-lg bg-fg text-base font-medium text-accent-fg",
					children: ui.personPresent ? "사람이 보입니다 · 양손을 드세요" : ui.cameraState === "loading" ? "카메라를 켜는 중…" : "카메라 앞에 서 주세요"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-center text-xs text-fg-subtle",
					children: ui.motionHint
				})] })
			]
		})
	] });
}
function Start({ ui, onRetryCamera, onOpenWindow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto flex h-full flex-col items-center justify-center bg-bg/55 px-8 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: "/logo-alllove.jpg",
				alt: CHURCH_NAME,
				className: "h-28 w-28 object-contain"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
				className: "mt-8 max-w-[22ch] font-display text-2xl leading-snug text-balance",
				children: ui.verse.text
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm tracking-wide text-fg-muted",
				children: ui.verse.ref
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandsUpMark, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-lg font-medium",
				children: "양손을 머리 위로 들어 시작"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-fg-muted",
				children: "시작 후 골리앗이 있는 쪽으로 팔을 휘두르세요. 흰 점이 크리티컬입니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-fg-muted",
				children: ui.motionHint
			}),
			ui.cameraState === "denied" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraHelp, {
				ui,
				onRetry: onRetryCamera,
				onOpenWindow
			})
		]
	});
}
function CameraHelp({ ui, onRetry, onOpenWindow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-5 rounded-lg border border-border-strong bg-bg-elevated p-4 text-left",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-medium",
				children: "카메라가 꺼져 있습니다"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-pretty text-fg-muted",
				children: ui.cameraError || "브라우저가 카메라를 막았습니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "mt-3 list-decimal space-y-1 pl-4 text-xs text-fg-subtle",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "주소창 왼쪽 자물쇠 또는 카메라 아이콘을 누릅니다" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						"카메라를 ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "허용"
						}),
						"으로 바꿉니다"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "아래 다시 시도를 누릅니다" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onRetry,
				className: "mt-4 h-12 w-full rounded-lg bg-fg text-sm font-medium text-accent-fg",
				children: "다시 시도"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onOpenWindow,
				className: "mt-2 h-12 w-full rounded-lg border border-border-strong text-sm font-medium",
				children: "새 창에서 열기"
			})
		]
	});
}
function HandsUpMark() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 120 140",
		className: "mt-8 h-28 w-24 text-fg",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "60",
				cy: "44",
				r: "12",
				fill: "currentColor",
				opacity: "0.9"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M60 56v34M60 70l-22 18M60 70l22 18M60 90l-14 28M60 90l14 28",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "6",
				strokeLinecap: "round"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M38 40V18M82 40V18",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "6",
				strokeLinecap: "round"
			})
		]
	});
}
function Countdown({ n }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-8xl tabular-nums",
				children: n
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-lg text-fg",
				children: "흰 점 = 크리티컬 x2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-[22ch] text-center text-sm text-fg-muted",
				children: "점선이 가는 곳으로 돌이 날아갑니다. 골리앗 쪽으로 팔을 휘두르세요."
			})
		]
	});
}
function Hud({ ui }) {
	const mm = Math.floor(ui.timeLeft);
	const frac = Math.floor(ui.timeLeft % 1 * 10);
	const urgent = ui.timeLeft <= 10;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-end gap-3 px-5 pt-5 pr-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-md border border-border bg-bg/70 px-3 py-2 text-right",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-[0.16em] text-fg-muted",
						children: "점수"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-3xl tabular-nums leading-none",
						children: ui.score.toLocaleString("ko-KR")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-fg-subtle",
						children: ["크리티컬 ", ui.foreheadHits]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `rounded-md border px-3 py-2 text-right ${urgent ? "border-danger bg-bg/80 text-danger" : "border-border bg-bg/70"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-[0.16em] text-fg-muted",
					children: "시간"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-display text-3xl tabular-nums leading-none",
					children: [mm, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-lg text-fg-muted",
						children: [".", frac]
					})]
				})]
			})]
		}),
		ui.combo > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto mt-3 w-40",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-center text-sm tracking-[0.2em] text-fg",
				children: ["COMBO ", ui.combo]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 h-1 overflow-hidden rounded-full bg-bg-subtle",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-fg",
					style: { width: `${Math.max(8, ui.comboLeft * 100)}%` }
				})
			})]
		}),
		ui.armed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-center text-sm tracking-[0.18em] text-fg",
			children: "장전 · 점선 방향으로 던짐"
		}),
		ui.banner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-center font-display text-2xl text-balance",
			children: ui.banner
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mb-8 px-6 text-center text-sm text-fg-muted",
			children: [ui.motionHint || "골리앗 쪽으로 팔을 휘두르세요", " · 흰 점 맞으면 x2"]
		})
	] });
}
function Result({ ui, onNext }) {
	const best = ui.bestScore;
	const isBest = ui.resultRank === 1 && ui.score > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto flex h-full flex-col items-center justify-center bg-bg/62 px-8 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm tracking-[0.2em] text-fg-muted",
				children: isBest ? "최고 기록" : "기록"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 font-display text-7xl tabular-nums leading-none",
				children: ui.score.toLocaleString("ko-KR")
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-fg-muted",
				children: ui.resultRank > 0 ? `${ui.resultRank}위 · ${formatScoreDate(Date.now())}` : CHURCH_NAME
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-8 grid w-full max-w-xs grid-cols-2 gap-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-md border border-border bg-bg/50 px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs text-fg-subtle",
						children: "크리티컬"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-1 font-display text-2xl tabular-nums",
						children: ui.foreheadHits
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-md border border-border bg-bg/50 px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-xs text-fg-subtle",
						children: "최대 콤보"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-1 font-display text-2xl tabular-nums",
						children: ui.maxCombo
					})]
				})]
			}),
			best > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 text-xs text-fg-subtle",
				children: ["최고 ", best.toLocaleString("ko-KR")]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
				className: "mt-8 max-w-[22ch] font-display text-xl leading-snug text-balance",
				children: ui.verse.text
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs tracking-wide text-fg-muted",
				children: ui.verse.ref
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onNext,
				className: "mt-10 h-14 min-w-52 rounded-lg bg-fg px-8 font-medium text-accent-fg",
				children: "다음 사람"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-fg-subtle",
				children: "자리를 비우면 대기 화면으로 돌아갑니다"
			})
		]
	});
}
var LS = 11;
var RS = 12;
var LW = 15;
var RW = 16;
var LH = 23;
var NOSE = 0;
var PoseController = class {
	video = null;
	status = "off";
	poseReady = false;
	error = null;
	landmarker = null;
	stream = null;
	history = [];
	throwCooldownUntil = 0;
	presentFrames = 0;
	absentFrames = 0;
	lastTs = 0;
	present = false;
	lastFrame = {
		present: false,
		handsUp: false,
		throwEvent: null,
		skeleton: null,
		armed: false
	};
	hasStream() {
		return Boolean(this.stream);
	}
	async start(video, onCamera) {
		this.video = video;
		this.status = "loading";
		this.error = null;
		try {
			await this.openCamera(video);
			this.status = "live";
			onCamera?.();
		} catch (err) {
			this.status = "denied";
			this.error = explainCameraError(err);
			return;
		}
		if (!this.landmarker) await this.ensureModel();
	}
	async openCamera(video) {
		this.stopStream();
		if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(/* @__PURE__ */ new Error("unsupported"), { name: "SecurityError" });
		video.setAttribute("playsinline", "true");
		video.setAttribute("autoplay", "true");
		video.muted = true;
		video.playsInline = true;
		const tries = [{
			audio: false,
			video: true
		}, {
			audio: false,
			video: { facingMode: { ideal: "user" } }
		}];
		let lastErr = null;
		for (const constraints of tries) try {
			const stream = await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 12e3);
			this.stream = stream;
			video.srcObject = stream;
			await playVideo(video);
			return;
		} catch (err) {
			lastErr = err;
			const name = errorName(err);
			if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") throw err;
		}
		throw lastErr ?? Object.assign(/* @__PURE__ */ new Error("camera"), { name: "NotFoundError" });
	}
	async ensureModel() {
		if (this.landmarker) {
			this.poseReady = true;
			return;
		}
		try {
			const vision = await import("../_libs/mediapipe__tasks-vision.mjs").then((n) => n.t);
			const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
			const opts = {
				baseOptions: {
					modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
					delegate: "GPU"
				},
				runningMode: "VIDEO",
				numPoses: 1,
				minPoseDetectionConfidence: .4,
				minPosePresenceConfidence: .4,
				minTrackingConfidence: .4
			};
			try {
				this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts);
			} catch {
				this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
					...opts,
					baseOptions: {
						...opts.baseOptions,
						delegate: "CPU"
					}
				});
			}
			this.poseReady = true;
		} catch {
			this.error = "카메라는 켜졌지만 모션 엔진을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.";
			this.poseReady = false;
		}
	}
	stopStream() {
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		if (this.video) this.video.srcObject = null;
	}
	stop() {
		this.landmarker?.close?.();
		this.landmarker = null;
		this.stopStream();
		this.status = "off";
		this.poseReady = false;
	}
	tick(now) {
		const empty = {
			present: false,
			handsUp: false,
			throwEvent: null,
			skeleton: null,
			armed: false
		};
		const video = this.video;
		if (!video || video.readyState < 2 || !this.landmarker) {
			this.lastFrame = {
				...empty,
				present: this.present
			};
			return this.lastFrame;
		}
		const ts = now <= this.lastTs ? this.lastTs + 1 : now;
		this.lastTs = ts;
		let pose;
		let world;
		try {
			const result = this.landmarker.detectForVideo(video, ts);
			pose = result.landmarks[0];
			world = result.worldLandmarks?.[0];
		} catch {
			this.lastFrame = empty;
			return empty;
		}
		if (!pose) {
			this.absentFrames += 1;
			this.presentFrames = 0;
			if (this.absentFrames > 12) this.present = false;
			this.lastFrame = {
				...empty,
				present: this.present
			};
			return this.lastFrame;
		}
		const vis = (i) => pose[i]?.visibility ?? 1;
		if (vis(LS) > .35 && vis(RS) > .35 && (vis(NOSE) > .25 || vis(LH) > .25)) {
			this.presentFrames += 1;
			this.absentFrames = 0;
			if (this.presentFrames > 4) this.present = true;
		} else {
			this.absentFrames += 1;
			this.presentFrames = 0;
			if (this.absentFrames > 12) this.present = false;
		}
		const mirror = (i) => ({
			x: 1 - pose[i].x,
			y: pose[i].y,
			v: vis(i)
		});
		const lShoulder = mirror(LS);
		const rShoulder = mirror(RS);
		const lWrist = mirror(LW);
		const rWrist = mirror(RW);
		const handsUp = lWrist.v > .35 && rWrist.v > .35 && lWrist.y < lShoulder.y - .05 && rWrist.y < rShoulder.y - .05;
		const zAt = (i) => world?.[i]?.z ?? pose[i]?.z ?? 0;
		this.history.push({
			t: now,
			lx: lWrist.x,
			ly: lWrist.y,
			lz: zAt(LW),
			rx: rWrist.x,
			ry: rWrist.y,
			rz: zAt(RW)
		});
		if (this.history.length > 22) this.history.shift();
		const armed = this.isArmed();
		let throwEvent = null;
		if (!handsUp && this.present && now > this.throwCooldownUntil) {
			throwEvent = this.detectThrow(now);
			if (throwEvent) this.throwCooldownUntil = now + 520;
		}
		const skeleton = [
			0,
			11,
			12,
			13,
			14,
			15,
			16,
			23,
			24
		].map((i) => mirror(i));
		this.lastFrame = {
			present: this.present,
			handsUp,
			throwEvent,
			skeleton,
			armed
		};
		return this.lastFrame;
	}
	isArmed() {
		const hist = this.history;
		if (hist.length < 4) return false;
		const cur = hist[hist.length - 1];
		const old = hist.find((s) => cur.t - s.t >= 140) ?? hist[0];
		const leftDown = old.ly + .04 < cur.ly;
		const rightDown = old.ry + .04 < cur.ry;
		return leftDown || rightDown;
	}
	detectThrow(now) {
		const hist = this.history;
		if (hist.length < 5) return null;
		const cur = hist[hist.length - 1];
		const prev = hist.find((s) => now - s.t >= 60) ?? hist[Math.max(0, hist.length - 4)];
		const wind = hist.find((s) => now - s.t >= 140) ?? hist[0];
		const dt = Math.max(.035, (cur.t - prev.t) / 1e3);
		const hands = [{
			vx: (cur.lx - prev.lx) / dt,
			vy: (cur.ly - prev.ly) / dt,
			vz: (cur.lz - prev.lz) / dt,
			x: cur.lx,
			y: cur.ly,
			dy: wind.ly - cur.ly,
			dx: Math.abs(cur.lx - wind.lx)
		}, {
			vx: (cur.rx - prev.rx) / dt,
			vy: (cur.ry - prev.ry) / dt,
			vz: (cur.rz - prev.rz) / dt,
			x: cur.rx,
			y: cur.ry,
			dy: wind.ry - cur.ry,
			dx: Math.abs(cur.rx - wind.rx)
		}];
		let best = null;
		let bestScore = 0;
		for (const hand of hands) {
			const speed = Math.hypot(hand.vx, hand.vy);
			const towardCamera = hand.vz < -.35;
			const upward = hand.vy < -.7;
			const across = Math.abs(hand.vx) > .9;
			const traveled = hand.dy > .045 || hand.dx > .06;
			if (!(speed > 1.45 || speed > .95 && (upward || towardCamera || across) && traveled)) continue;
			const score = speed + (upward ? .4 : 0) + (towardCamera ? .35 : 0);
			if (score > bestScore) {
				bestScore = score;
				best = {
					power: Math.max(.42, Math.min(1, (speed - .6) / 2.4)),
					aimX: Math.max(-1, Math.min(1, (hand.x - .5) * 1.8 + hand.vx * .12))
				};
			}
		}
		return best;
	}
};
function errorName(err) {
	if (err && typeof err === "object" && "name" in err) return String(err.name);
	return "";
}
function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const id = window.setTimeout(() => {
			reject(Object.assign(/* @__PURE__ */ new Error("timeout"), { name: "TimeoutError" }));
		}, ms);
		promise.then((value) => {
			window.clearTimeout(id);
			resolve(value);
		}, (err) => {
			window.clearTimeout(id);
			reject(err);
		});
	});
}
async function playVideo(video) {
	try {
		await video.play();
	} catch {
		await new Promise((r) => window.setTimeout(r, 120));
		await video.play();
	}
}
function isFramed() {
	try {
		return window.self !== window.top;
	} catch {
		return true;
	}
}
function explainCameraError(err) {
	const name = errorName(err);
	if (!navigator.mediaDevices?.getUserMedia) return "이 주소에서는 카메라를 쓸 수 없습니다. Chrome으로 열고, 주소가 https 또는 localhost인지 확인하세요.";
	if (name === "NotAllowedError" || name === "PermissionDeniedError") {
		if (isFramed()) return "이 미리보기 창은 카메라를 막습니다. 아래 ‘새 창에서 열기’를 누르세요.";
		return "브라우저가 카메라를 막았습니다. 주소창 왼쪽 자물쇠/카메라 아이콘에서 허용을 고른 뒤 다시 시도하세요.";
	}
	if (name === "NotFoundError" || name === "DevicesNotFoundError") return "연결된 웹캠이 없습니다. 카메라를 꽂고 다시 시도하세요.";
	if (name === "NotReadableError" || name === "TrackStartError") return "다른 프로그램이 카메라를 사용 중입니다. Zoom/Teams를 끄고 다시 시도하세요.";
	if (name === "TimeoutError") return "카메라 응답이 없습니다. 권한 창이 다른 창 뒤에 가려졌는지 확인하세요.";
	if (name === "SecurityError") return "보안 주소가 아니라 카메라를 켤 수 없습니다. Chrome에서 https로 여세요.";
	return "카메라를 켜지 못했습니다. 주소창에서 카메라 권한을 확인하세요.";
}
var initialUi = () => ({
	phase: "boot",
	score: 0,
	combo: 0,
	maxCombo: 0,
	timeLeft: 30,
	countdown: 3,
	verse: randomVerse(),
	personPresent: false,
	cameraState: "off",
	lastHit: null,
	resultRank: 0,
	scores: [],
	muted: false,
	confirmReset: false,
	banner: null,
	motionHint: "",
	poseReady: false,
	armed: false,
	cameraError: null,
	foreheadHits: 0,
	comboLeft: 0,
	bestScore: 0
});
function GameApp() {
	const wrapRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const pipRef = (0, import_react.useRef)(null);
	const videoRef = (0, import_react.useRef)(null);
	const gameRef = (0, import_react.useRef)(null);
	const poseRef = (0, import_react.useRef)(null);
	const startingRef = (0, import_react.useRef)(false);
	const [ui, setUi] = (0, import_react.useState)(initialUi);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const audio = new GameAudio();
		const game = new Game(audio, (snap) => setUi(snap));
		gameRef.current = game;
		window.__game = game;
		const pose = new PoseController();
		poseRef.current = pose;
		const bg = new Image();
		bg.src = "/valley.jpg";
		bg.onload = () => game.setBackground(bg);
		const resize = () => {
			const r = wrap.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.floor(r.width * dpr));
			canvas.height = Math.max(1, Math.floor(r.height * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.imageSmoothingEnabled = true;
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(wrap);
		let raf = 0;
		let last = performance.now();
		const loop = (now) => {
			raf = requestAnimationFrame(loop);
			const dt = Math.min(.05, (now - last) / 1e3);
			last = now;
			const video = videoRef.current;
			if (video && (pose.status === "live" || pose.hasStream())) {
				const frame = pose.status === "live" ? pose.tick(now) : pose.lastFrame;
				if (pose.poseReady) game.notePose(frame);
				const pip = pipRef.current;
				if (pip) {
					const pctx = pip.getContext("2d");
					if (pctx) drawPip(pctx, video, frame.skeleton, frame.present);
				}
			}
			game.update(dt);
			const r = wrap.getBoundingClientRect();
			ctx.setTransform(dprScale(canvas), 0, 0, dprScale(canvas), 0, 0);
			ctx.clearRect(0, 0, r.width, r.height);
			ctx.save();
			ctx.scale(r.width / WORLD_W, r.height / WORLD_H);
			game.render(ctx);
			ctx.restore();
		};
		raf = requestAnimationFrame(loop);
		const toWorld = (e) => {
			const r = wrap.getBoundingClientRect();
			return {
				x: (e.clientX - r.left) / Math.max(1, r.width) * WORLD_W,
				y: (e.clientY - r.top) / Math.max(1, r.height) * WORLD_H
			};
		};
		const isChrome = (t) => t instanceof HTMLElement && Boolean(t.closest("button"));
		const onDown = (e) => {
			if (isChrome(e.target)) return;
			e.preventDefault();
			try {
				wrap.setPointerCapture(e.pointerId);
			} catch {}
			const p = toWorld(e);
			game.pointerDown(p.x, p.y, e.pointerId);
		};
		const onMove = (e) => {
			const p = toWorld(e);
			game.pointerMove(p.x, p.y, e.pointerId);
		};
		const onUp = (e) => {
			const p = toWorld(e);
			game.pointerUp(p.x, p.y, e.pointerId);
		};
		wrap.addEventListener("pointerdown", onDown);
		wrap.addEventListener("pointermove", onMove);
		wrap.addEventListener("pointerup", onUp);
		wrap.addEventListener("pointercancel", onUp);
		const onVis = () => {
			if (document.visibilityState === "visible") audio.unlock();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			wrap.removeEventListener("pointerdown", onDown);
			wrap.removeEventListener("pointermove", onMove);
			wrap.removeEventListener("pointerup", onUp);
			wrap.removeEventListener("pointercancel", onUp);
			document.removeEventListener("visibilitychange", onVis);
			pose.stop();
		};
	}, []);
	const startCamera = async () => {
		const g = gameRef.current;
		const pose = poseRef.current;
		const video = videoRef.current;
		if (!pose || !video || startingRef.current) return;
		startingRef.current = true;
		g?.setCameraState("loading");
		try {
			await pose.start(video, () => {
				g?.setCameraState("live");
			});
			if (pose.status === "denied") g?.setCameraState("denied", pose.error);
			else {
				g?.setCameraState("live");
				g?.setPoseReady(pose.poseReady);
			}
		} catch {
			pose.status = "denied";
			g?.setCameraState("denied", "카메라를 켜지 못했습니다. 다시 시도해 주세요.");
		} finally {
			startingRef.current = false;
		}
	};
	const begin = () => {
		gameRef.current?.begin();
		startCamera();
	};
	const openNewWindow = () => {
		window.open(window.location.href, "_blank", "noopener,noreferrer");
	};
	const showPip = ui.cameraState === "live" || ui.cameraState === "loading" ? ui.phase === "attract" || ui.phase === "start" || ui.phase === "countdown" || ui.phase === "play" : false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-dvh w-full items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: wrapRef,
			className: "relative overflow-hidden bg-bg touch-none select-none",
			style: {
				width: "min(100dvw, calc(100dvh * 9 / 16))",
				height: "min(100dvh, calc(100dvw * 16 / 9))"
			},
			"data-phase": ui.phase,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "absolute inset-0 size-full"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `pointer-events-none absolute top-20 left-3 z-10 w-36 ${showPip ? "opacity-100" : "opacity-0"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-1 text-center text-xs tracking-[0.16em] text-fg-muted",
							children: "내 모습"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative h-28 w-36",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
								ref: videoRef,
								className: `absolute inset-0 size-full rounded-md border object-cover ${ui.personPresent ? "border-fg" : "border-border"}`,
								style: { transform: "scaleX(-1)" },
								playsInline: true,
								muted: true,
								autoPlay: true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: pipRef,
								width: 320,
								height: 240,
								className: "absolute inset-0 size-full rounded-md"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-center text-xs text-fg-subtle",
							children: ui.personPresent ? "인식됨" : "상반신을 보여 주세요"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlays, {
					ui,
					onBegin: begin,
					onStart: () => {
						if (ui.cameraState !== "live") startCamera();
						else gameRef.current?.uiAdvance();
					},
					onRetryCamera: () => void startCamera(),
					onOpenWindow: openNewWindow,
					onNext: () => gameRef.current?.nextPlayer(),
					onMute: () => gameRef.current?.toggleMute(),
					onAskReset: () => gameRef.current?.askReset(),
					onConfirmReset: () => gameRef.current?.confirmClear(),
					onCancelReset: () => gameRef.current?.cancelClear()
				})
			]
		})
	});
}
function dprScale(canvas) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const cssW = canvas.getBoundingClientRect().width;
	if (cssW <= 0) return dpr;
	return canvas.width / cssW;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameApp, {});
}
//#endregion
export { Home as component };
