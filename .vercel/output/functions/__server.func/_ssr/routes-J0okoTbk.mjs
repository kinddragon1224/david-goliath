import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-J0okoTbk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WORLD_W = 1080;
var WORLD_H = 1920;
var GRAVITY = 1520;
var SCORES_KEY = "alllove-david-goliath-scores-v2";
var CHURCH_NAME = "모두애침례교회";
var GAME_TITLE = "다윗과 골리앗";
/** 제작사 표기. 첫 화면 아래와 대기 화면에 나온다. */
var PRODUCER = {
	logo: "/therumen-logo.png",
	name: "더루멘(THE RUMEN)",
	ceo: "김범수, 김선용",
	bizNo: "222-12-98053",
	address: "대전광역시 중구 중촌로28번길 6, 1층",
	phone: "010-5169-1596",
	email: "therumen.edu@gmail.com"
};
var GameAudio = class {
	ctx = null;
	master = null;
	muted = false;
	beatTimer = null;
	nextBeat = 0;
	beatStep = 0;
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
				this.don(t, .9);
				break;
			case "hitShield":
				this.ka(t, .7);
				this.clang(t);
				break;
			case "hitHead":
				this.don(t, 1);
				this.chime(t, 740, .4);
				this.chime(t + .06, 990, .3);
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
				break;
			case "freeze":
				this.chime(t, 311, .35);
				this.chime(t + .08, 247, .4);
		}
	}
	/** 경기 중 배경 북 장단. 쿵 . 딱 . 쿵 쿵 딱 . */
	startBeat() {
		if (!this.ctx || this.beatTimer) return;
		this.nextBeat = this.ctx.currentTime + .05;
		this.beatStep = 0;
		const pattern = [
			"don",
			null,
			"ka",
			null,
			"don",
			"don",
			"ka",
			null
		];
		const step = 60 / 132 / 2;
		this.beatTimer = setInterval(() => {
			if (!this.ctx) return;
			while (this.nextBeat < this.ctx.currentTime + .12) {
				const hit = pattern[this.beatStep % pattern.length];
				if (!this.muted) {
					if (hit === "don") this.don(this.nextBeat, .32);
					else if (hit === "ka") this.ka(this.nextBeat, .22);
				}
				this.nextBeat += step;
				this.beatStep += 1;
			}
		}, 40);
	}
	stopBeat() {
		if (this.beatTimer) clearInterval(this.beatTimer);
		this.beatTimer = null;
	}
	/** 북 가죽: 낮게 떨어지는 사인. */
	don(t, gain) {
		this.osc(170, "sine", t, .28, gain * .9, 62);
		this.osc(340, "triangle", t, .06, gain * .25, 160);
	}
	/** 북 테두리: 짧은 고음 딱. */
	ka(t, gain) {
		this.osc(1900, "square", t, .04, gain * .18, 1200);
		this.noiseSweep(t, .05, 3200, 2400, gain * .5);
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
/** 골리앗 로컬 좌표. 원점 (goliathX, 70+bob), 발은 y=1320.
* 머리가 몸만큼 큰 2등신이다. 머리 중심 (0,430) 반지름 190.
*/
var GOLIATH_LOCAL = {
	head: {
		x: 0,
		y: 430,
		r: 190
	},
	/** 투구 챙 아래로 드러난 이마 띠. 열렸을 때만 크리티컬. */
	forehead: {
		x: 0,
		y: 360,
		rx: 72,
		ry: 28
	},
	helmet: {
		x: 0,
		y: 410,
		r: 205
	},
	shieldX: 250,
	shieldOpenY: 850,
	shieldR: 140,
	torso: {
		x: 0,
		y: 820,
		w: 400,
		h: 360
	},
	legs: {
		x: 0,
		y: 1170,
		w: 270,
		h: 280
	},
	foot: {
		x: 0,
		y: 1320
	}
};
/** 방어 중에는 방패가 얼굴 앞으로 올라온다. 경고 중에는 가슴 높이까지 든다. */
function shieldLocal(up, warn) {
	if (up) return {
		x: 0,
		y: GOLIATH_LOCAL.forehead.y + 70,
		r: 215
	};
	if (warn) return {
		x: 170,
		y: 640,
		r: 150
	};
	return {
		x: GOLIATH_LOCAL.shieldX,
		y: GOLIATH_LOCAL.shieldOpenY,
		r: GOLIATH_LOCAL.shieldR
	};
}
/** 다윗 발 위치와 크기. 로컬 단위에 DAVID_SCALE을 곱해 월드에 놓는다. */
var DAVID_FOOT_WORLD = {
	x: WORLD_W / 2,
	y: 1720
};
var DAVID_SCALE = 1.3;
/** 다윗 로컬 좌표(축척 전). 발이 원점, 위가 음수. */
var DAVID_LOCAL = {
	head: {
		x: 0,
		y: -205,
		r: 92
	},
	shoulder: {
		x: 46,
		y: -118
	}
};
/** 자세별 물매 손 위치(로컬, 축척 전). */
function slingHand(pose, charge, time) {
	if (pose === "spin") {
		const a = time * 18;
		return {
			x: 70 + Math.cos(a) * 20,
			y: -300 + Math.sin(a) * 10
		};
	}
	if (pose === "ready") return {
		x: 92,
		y: -150 - charge * 90
	};
	if (pose === "throw") return {
		x: 40,
		y: -310
	};
	if (pose === "recover") return {
		x: 96,
		y: -200
	};
	if (pose === "focus") return {
		x: 30,
		y: -110
	};
	return {
		x: 98,
		y: -86
	};
}
function davidHandLocal(pose, charge, time) {
	return slingHand(pose, charge, time);
}
function davidMotion(pose, aimX, charge, time) {
	const aim = Math.max(-1, Math.min(1, aimX)) * .05;
	if (pose === "ready") return {
		x: 0,
		y: 0,
		rot: aim - .06 - charge * .05
	};
	if (pose === "spin") return {
		x: -4,
		y: 0,
		rot: aim - .1
	};
	if (pose === "throw") return {
		x: 10,
		y: -8,
		rot: aim + .1
	};
	if (pose === "recover") return {
		x: 4,
		y: 0,
		rot: aim + .04
	};
	if (pose === "focus") return {
		x: 0,
		y: 0,
		rot: 0
	};
	return {
		x: 0,
		y: -Math.abs(Math.sin(time * Math.PI * 2.2)) * 10,
		rot: aim
	};
}
/** 돌이 떠나는 월드 좌표. 물매 손 위치를 몸 회전과 축척에 맞춰 옮긴다. */
function davidSlingWorld(pose, aimX, charge, time) {
	const motion = davidMotion(pose, aimX, charge, time);
	const hand = slingHand(pose, charge, time);
	const lx = hand.x * DAVID_SCALE;
	const ly = hand.y * DAVID_SCALE;
	const c = Math.cos(motion.rot);
	const s = Math.sin(motion.rot);
	return {
		x: DAVID_FOOT_WORLD.x + motion.x + c * lx - s * ly,
		y: DAVID_FOOT_WORLD.y + motion.y + s * lx + c * ly
	};
}
var BASE = {
	이마: 1e3,
	투구: 250,
	몸통: 100,
	방패: 20
};
function comboMultiplier(combo) {
	if (combo >= 6) return 2;
	if (combo >= 3) return 1.5;
	return 1;
}
/** 이마는 열린 급소 명중 1,000점. 투구는 일반 머리 250점. */
function hitPoints(part, combo) {
	return Math.round(BASE[part] * comboMultiplier(combo));
}
function combatBand(elapsed) {
	if (elapsed < 8) return {
		idle: .45,
		guard: .35,
		dodge: .2,
		tell: .55,
		dodgeDist: 80,
		open: 1.2
	};
	if (elapsed < 20) return {
		idle: .25,
		guard: .4,
		dodge: .35,
		tell: .45,
		dodgeDist: 110,
		open: 1
	};
	return {
		idle: .15,
		guard: .4,
		dodge: .45,
		tell: .35,
		dodgeDist: 140,
		open: .9
	};
}
function goliathAngle(stagger, downed, guard = false, lean = 0) {
	const down = downed ? 1 : 0;
	return -.12 * Math.min(1, Math.max(0, stagger)) - .18 * down + (guard ? -.03 : 0) + lean;
}
var AIM_X_SPAN = 280;
function aimPoint(aimX, aimY) {
	const x = Math.max(-1, Math.min(1, aimX));
	const y = Math.max(-1, Math.min(1, aimY));
	return {
		x: WORLD_W / 2 + x * AIM_X_SPAN,
		y: 670 + y * 340
	};
}
/** 조준점은 플레이어가 정한 자리만 본다. 골리앗 위치는 넣지 않는다. */
function stoneFlight(aimX, aimY, power, pose = "idle", charge = 0, time = 0) {
	const target = aimPoint(aimX, aimY);
	const origin = davidSlingWorld(pose, aimX, charge, time);
	const t = .62 - Math.max(.25, Math.min(1, power)) * .08;
	return {
		vx: (target.x - origin.x) / t,
		vy: (target.y - origin.y) / t - .5 * GRAVITY * t,
		targetX: target.x,
		targetY: target.y,
		t,
		originX: origin.x,
		originY: origin.y
	};
}
function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const fx = x0 - cx;
	const fy = y0 - cy;
	const a = dx * dx + dy * dy;
	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - r * r;
	if (a < 1e-6) return c <= 0 ? 0 : null;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	const t1 = (-b - s) / (2 * a);
	if (t1 >= 0 && t1 <= 1) return t1;
	const t2 = (-b + s) / (2 * a);
	if (t2 >= 0 && t2 <= 1) return t2;
	return null;
}
function segmentHitsEllipse(x0, y0, x1, y1, cx, cy, rx, ry) {
	const sy = rx / Math.max(1, ry);
	return segmentHitsCircle(x0, y0 * sy, x1, y1 * sy, cx, cy * sy, rx);
}
function segmentHitsBox(x0, y0, x1, y1, cx, cy, w, h, padX, padY = padX) {
	const left = cx - w / 2 - padX;
	const right = cx + w / 2 + padX;
	const top = cy - h / 2 - padY;
	const bottom = cy + h / 2 + padY;
	const dx = x1 - x0;
	const dy = y1 - y0;
	let t0 = 0;
	let t1 = 1;
	const slabs = [
		[-dx, x0 - left],
		[dx, right - x0],
		[-dy, y0 - top],
		[dy, bottom - y0]
	];
	for (const [p, q] of slabs) {
		if (Math.abs(p) < 1e-8) {
			if (q < 0) return null;
			continue;
		}
		const t = q / p;
		if (p < 0) {
			if (t > t1) return null;
			if (t > t0) t0 = t;
		} else {
			if (t < t0) return null;
			if (t < t1) t1 = t;
		}
	}
	if (t0 > t1) return null;
	return t0;
}
/** 태고의 달인풍: 굵은 먹선, 평평한 원색, 회전하는 햇살, 튀어 오르는 판정 글자. */
var INK = "#2a160c";
var FONT = "'Jua', 'Noto Sans KR', sans-serif";
var LINE = 10;
var C = {
	red: "#f24a2a",
	redDark: "#c22d1c",
	blue: "#3fb8d9",
	yellow: "#ffd23a",
	orange: "#ff8a1f",
	cream: "#fff4dc",
	white: "#ffffff",
	gold: "#ffcc22"
};
function beatPulse(time) {
	const b = time * 132 / 60;
	return Math.pow(1 - (b - Math.floor(b)), 3);
}
function circle(ctx, x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function rrect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}
/** 현재 경로를 칠하고 먹선을 두른다. */
function ink(ctx, fill, lw = LINE) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = lw;
	ctx.strokeStyle = INK;
	ctx.stroke();
}
/** 먹선 → 흰 테 → 색 글자. 태고 판정 글자 방식. */
function outlinedText(ctx, text, x, y, size, fill, inner = C.white) {
	ctx.font = `${size}px ${FONT}`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineJoin = "round";
	ctx.strokeStyle = INK;
	ctx.lineWidth = size * .34;
	ctx.strokeText(text, x, y);
	if (inner) {
		ctx.strokeStyle = inner;
		ctx.lineWidth = size * .16;
		ctx.strokeText(text, x, y);
	}
	ctx.fillStyle = fill;
	ctx.fillText(text, x, y);
}
function star(ctx, x, y, r, rot = 0) {
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = rot + i * Math.PI / 5 - Math.PI / 2;
		const rr = i % 2 === 0 ? r : r * .48;
		const px = x + Math.cos(a) * rr;
		const py = y + Math.sin(a) * rr;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}
/** 원 여러 개를 하나의 구름처럼: 먹선을 먼저 모두 긋고 그 위를 칠한다. */
function cloud(ctx, x, y, s, fill) {
	const puffs = [
		[
			-70,
			10,
			46
		],
		[
			-20,
			-16,
			62
		],
		[
			44,
			-6,
			54
		],
		[
			90,
			16,
			38
		],
		[
			10,
			22,
			50
		]
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
	ctx.strokeStyle = "rgba(42,22,12,0.28)";
	ctx.lineWidth = 5 * s;
	ctx.beginPath();
	ctx.arc(x - 18 * s, y - 8 * s, 22 * s, Math.PI * .9, Math.PI * 2.2);
	ctx.stroke();
}
var bgCache = null;
function staticBackground() {
	if (bgCache) return bgCache;
	if (typeof document === "undefined") return null;
	const cv = document.createElement("canvas");
	cv.width = WORLD_W;
	cv.height = WORLD_H;
	const ctx = cv.getContext("2d");
	if (!ctx) return null;
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
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
		[1100, 1100]
	];
	for (const [px, py] of peaks) ctx.lineTo(px, py);
	ctx.lineTo(1100, 1290);
	ctx.closePath();
	ink(ctx, "#a68be0", 9);
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
		[
			150,
			1290,
			40
		],
		[
			930,
			1290,
			44
		],
		[
			690,
			1300,
			30
		]
	]) {
		ellipse(ctx, hx, hy, r, r * .5);
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-20, 1360);
	ctx.quadraticCurveTo(540, 1320, 1100, 1360);
	ctx.lineTo(1100, WORLD_H + 20);
	ctx.lineTo(-20, WORLD_H + 20);
	ctx.closePath();
	ink(ctx, "#f5c262", 9);
	ctx.beginPath();
	ctx.moveTo(430, 1350);
	ctx.quadraticCurveTo(300, 1560, 330, WORLD_H + 20);
	ctx.lineTo(750, WORLD_H + 20);
	ctx.quadraticCurveTo(780, 1560, 650, 1350);
	ctx.closePath();
	ctx.fillStyle = "#ffdc93";
	ctx.fill();
	ctx.fillStyle = "rgba(196,128,40,0.35)";
	for (let i = 0; i < 70; i++) {
		ellipse(ctx, i * 197 % WORLD_W, 1390 + i * 113 % 520, 10 + i % 3 * 4, 4 + i % 2 * 2);
		ctx.fill();
	}
	for (const [tx, ty, s] of [
		[
			90,
			1470,
			1
		],
		[
			980,
			1500,
			1.1
		],
		[
			200,
			1760,
			1.2
		],
		[
			880,
			1780,
			1.25
		],
		[
			60,
			1880,
			1
		],
		[
			1020,
			1880,
			.9
		]
	]) {
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
	for (const [px, py, r] of [
		[
			260,
			1450,
			18
		],
		[
			820,
			1430,
			14
		],
		[
			130,
			1640,
			22
		],
		[
			960,
			1660,
			20
		],
		[
			380,
			1860,
			16
		],
		[
			720,
			1890,
			18
		]
	]) {
		ellipse(ctx, px, py, r * 1.4, r);
		ink(ctx, "#b8b0a4", 6);
		ctx.fillStyle = "#e3ddd4";
		ellipse(ctx, px - r * .4, py - r * .35, r * .5, r * .28);
		ctx.fill();
	}
	for (const [fx, fy, col] of [
		[
			170,
			1540,
			C.red
		],
		[
			930,
			1590,
			C.yellow
		],
		[
			80,
			1720,
			C.yellow
		],
		[
			1e3,
			1740,
			C.red
		]
	]) {
		for (let k = 0; k < 5; k++) {
			const a = k / 5 * Math.PI * 2;
			circle(ctx, fx + Math.cos(a) * 11, fy + Math.sin(a) * 11, 9);
			ink(ctx, col, 4);
		}
		circle(ctx, fx, fy, 7);
		ink(ctx, C.cream, 4);
	}
	bgCache = cv;
	return cv;
}
function drawSky(ctx, time, calm) {
	const sky = ctx.createLinearGradient(0, 0, 0, 1350);
	sky.addColorStop(0, "#ff8a2a");
	sky.addColorStop(.45, "#ffb640");
	sky.addColorStop(1, "#ffe7a0");
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, WORLD_W, 1400);
	const cx = WORLD_W / 2;
	const cy = 760;
	const rot = calm ? 0 : time * .06;
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rot);
	ctx.fillStyle = "rgba(255,240,180,0.42)";
	const n = 20;
	for (let i = 0; i < n; i++) {
		const a0 = i / n * Math.PI * 2;
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
	const drift = calm ? 0 : time;
	for (const [x0, y, s, speed] of [
		[
			120,
			300,
			.9,
			14
		],
		[
			820,
			420,
			1.1,
			10
		],
		[
			380,
			560,
			.7,
			18
		],
		[
			980,
			860,
			.8,
			12
		],
		[
			60,
			980,
			.95,
			9
		]
	]) {
		const span = WORLD_W + 400;
		cloud(ctx, (x0 + drift * speed) % span - 200, y, s, C.white);
	}
	if (!calm) {
		const cols = [
			C.red,
			C.blue,
			C.yellow,
			C.white
		];
		for (let i = 0; i < 16; i++) {
			const x = (i * 211 + time * 30) % WORLD_W;
			const y = 200 + (i * 97 + time * 46) % 1e3;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(time * 2 + i);
			ctx.fillStyle = cols[i % cols.length];
			ctx.globalAlpha = .7;
			ctx.fillRect(-7, -4, 14, 8);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}
}
function goliathPalette(flash, frozen) {
	if (flash > .45) return {
		skin: "#ffffff",
		skinDark: "#fff2dc",
		bronze: "#fff8e8",
		bronzeDark: "#ffe9c4",
		bronzeLight: "#ffffff",
		red: "#ffd9cf",
		beard: "#ffe2c8",
		leather: "#ffe9c4"
	};
	if (frozen) return {
		skin: "#cfe9fb",
		skinDark: "#a9d2ef",
		bronze: "#9ccbea",
		bronzeDark: "#73a8d4",
		bronzeLight: "#e3f4ff",
		red: "#86aee0",
		beard: "#5a7fa8",
		leather: "#6d93bf"
	};
	return {
		skin: "#f4b98c",
		skinDark: "#e0956a",
		bronze: "#eba73e",
		bronzeDark: "#c97d24",
		bronzeLight: "#ffd77a",
		red: "#e8402a",
		beard: "#5a3018",
		leather: "#a85a26"
	};
}
function drawGoliath(ctx, sim) {
	const gx = sim.goliathX;
	const gy = 70 + sim.goliathBob;
	const frozen = sim.freezeLeft > 0;
	const p = goliathPalette(sim.hitFlash, frozen);
	const pulse = frozen ? 0 : beatPulse(sim.time);
	const wobble = Math.sin(sim.time * 40) * sim.stagger * .05;
	ctx.save();
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.translate(gx, gy + GOLIATH_LOCAL.foot.y);
	ctx.rotate(goliathAngle(sim.stagger, sim.downed, sim.shieldUp, sim.lean) + wobble);
	if (sim.downed) ctx.translate(40, 80);
	ctx.scale(1 + pulse * .012, 1 - pulse * .018);
	ctx.translate(-GOLIATH_LOCAL.foot.x, -GOLIATH_LOCAL.foot.y);
	ctx.fillStyle = "rgba(90,40,10,0.25)";
	ellipse(ctx, 0, 1318, 270, 36);
	ctx.fill();
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
	ctx.beginPath();
	ctx.moveTo(-190, 950);
	ctx.lineTo(190, 950);
	ctx.lineTo(215, 1110);
	ctx.lineTo(-215, 1110);
	ctx.closePath();
	ink(ctx, p.red);
	for (let i = 0; i < 7; i++) {
		rrect(ctx, -180 + i * 60, 990, 34, 140 + i % 2 * 14, 12);
		ink(ctx, p.leather, 7);
	}
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
			const x = col * 44 + row % 2 * 22;
			ctx.beginPath();
			ctx.arc(x, y, 22, .15 * Math.PI, .85 * Math.PI);
			ctx.stroke();
		}
	}
	ctx.fillStyle = p.bronzeLight;
	ellipse(ctx, -110, 700, 60, 40, -.5);
	ctx.globalAlpha = .7;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
	rrect(ctx, -215, 610, 430, 390, 160);
	ctx.lineWidth = LINE;
	ctx.strokeStyle = INK;
	ctx.stroke();
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
	if (sim.shieldWarn && !frozen) {
		const bx = 280;
		const by = 330 - pulse * 12;
		circle(ctx, bx, by, 62);
		ink(ctx, C.white);
		outlinedText(ctx, "!", bx, by + 4, 92, C.red, null);
	}
	if (frozen) {
		ctx.save();
		ctx.globalAlpha = .28;
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
			[200, 1120]
		]) {
			star(ctx, sx, sy, 26, sim.time);
			ctx.fill();
		}
		ctx.restore();
	}
	if (sim.critOpen && (sim.phase === "play" || sim.phase === "countdown" || sim.phase === "practice")) {
		const F = GOLIATH_LOCAL.forehead;
		const k = 1 + Math.sin(sim.time * 12) * .08;
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
			const a = sim.time * 3 + i * Math.PI / 2;
			star(ctx, F.x + Math.cos(a) * (F.rx + 46), F.y + Math.sin(a) * (F.ry + 34), 18, a);
			ink(ctx, C.gold, 5);
		}
	}
	ctx.restore();
}
function drawShield(ctx, x, y, r, p, warn) {
	if (warn) {
		ctx.strokeStyle = "rgba(255,255,255,0.8)";
		ctx.lineWidth = 12;
		circle(ctx, x, y, r + 22);
		ctx.stroke();
	}
	circle(ctx, x, y, r);
	ink(ctx, p.bronzeDark, 12);
	circle(ctx, x, y, r * .78);
	ink(ctx, p.bronze, 7);
	ctx.fillStyle = INK;
	for (let i = 0; i < 12; i++) {
		const a = i / 12 * Math.PI * 2;
		circle(ctx, x + Math.cos(a) * r * .89, y + Math.sin(a) * r * .89, 7);
		ctx.fill();
	}
	circle(ctx, x, y, r * .26);
	ink(ctx, p.bronzeLight, 7);
	ctx.fillStyle = "rgba(255,255,255,0.55)";
	ellipse(ctx, x - r * .35, y - r * .4, r * .22, r * .12, -.6);
	ctx.fill();
}
function drawGoliathHead(ctx, sim, p) {
	const frozen = sim.freezeLeft > 0;
	const hurt = sim.goliathPose === "hit" && !frozen;
	const dizzy = hurt && sim.stagger > .4;
	const warn = sim.goliathPose === "warn";
	ctx.beginPath();
	ctx.moveTo(-175, 470);
	ctx.quadraticCurveTo(-190, 640, -60, 700);
	ctx.quadraticCurveTo(0, 730, 60, 700);
	ctx.quadraticCurveTo(190, 640, 175, 470);
	ctx.closePath();
	ink(ctx, p.beard);
	circle(ctx, -176, 470, 36);
	ink(ctx, p.skin);
	circle(ctx, 176, 470, 36);
	ink(ctx, p.skin);
	circle(ctx, 0, 450, 175);
	ink(ctx, p.skin);
	ctx.fillStyle = "rgba(255,110,90,0.35)";
	ellipse(ctx, -108, 520, 34, 20);
	ctx.fill();
	ellipse(ctx, 108, 520, 34, 20);
	ctx.fill();
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
	const ey = 455;
	if (dizzy) {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 7;
		for (const ex of [-72, 72]) {
			ctx.beginPath();
			for (let i = 0; i < 40; i++) {
				const a = i * .45 + sim.time * 10;
				const rr = i * .85;
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
		ctx.moveTo(-100, 433);
		ctx.lineTo(-56, ey);
		ctx.lineTo(-100, 477);
		ctx.moveTo(100, 433);
		ctx.lineTo(56, ey);
		ctx.lineTo(100, 477);
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
		const squint = warn ? .55 : 1;
		for (const ex of [-72, 72]) {
			ellipse(ctx, ex, ey, 40, 32 * squint);
			ink(ctx, C.white, 8);
			const look = Math.max(-1, Math.min(1, sim.aimX)) * 10;
			circle(ctx, ex + look, ey + 8 * squint, 15 * Math.max(.7, squint));
			ctx.fillStyle = INK;
			ctx.fill();
			circle(ctx, ex + look - 5, 457, 5);
			ctx.fillStyle = C.white;
			ctx.fill();
		}
	}
	ellipse(ctx, 0, 510, 36, 30);
	ink(ctx, p.skinDark, 8);
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
	if (hurt || warn) {
		ctx.beginPath();
		ctx.moveTo(150, 360);
		ctx.quadraticCurveTo(178, 400, 166, 418);
		ctx.quadraticCurveTo(150, 430, 138, 412);
		ctx.quadraticCurveTo(132, 396, 150, 360);
		ctx.closePath();
		ink(ctx, "#8fd8f5", 6);
	}
	ctx.beginPath();
	ctx.arc(0, 318, 200, Math.PI, Math.PI * 2);
	ctx.closePath();
	ink(ctx, p.bronze);
	ctx.fillStyle = p.bronzeLight;
	ellipse(ctx, -90, 220, 40, 70, .6);
	ctx.globalAlpha = .8;
	ctx.fill();
	ctx.globalAlpha = 1;
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
	rrect(ctx, -22, 96, 44, 36, 8);
	ink(ctx, p.bronzeDark, 8);
	ctx.beginPath();
	ctx.moveTo(-150, 120);
	ctx.quadraticCurveTo(0, 0, 150, 120);
	ctx.quadraticCurveTo(0, 80, -150, 120);
	ctx.closePath();
	ink(ctx, p.red);
	if (sim.damage >= 1) {
		ctx.save();
		ctx.translate(95, 200);
		ctx.rotate(.6);
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
	if (dizzy) for (let i = 0; i < 4; i++) {
		const a = sim.time * 6 + i * Math.PI / 2;
		star(ctx, Math.cos(a) * 190, 90 + Math.sin(a) * 40, 26, a);
		ink(ctx, C.yellow, 6);
	}
}
var DAVID_SKIN = "#ffcf9e";
function drawDavid(ctx, sim) {
	const pose = sim.davidPose;
	const motion = davidMotion(pose, sim.aimX, sim.charge, sim.time);
	const hand = davidHandLocal(pose, sim.charge, sim.time);
	const H = DAVID_LOCAL.head;
	const sh = DAVID_LOCAL.shoulder;
	ctx.save();
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.translate(DAVID_FOOT_WORLD.x + motion.x, DAVID_FOOT_WORLD.y);
	ctx.fillStyle = "rgba(90,40,10,0.28)";
	ellipse(ctx, 0, 8, 120, 18);
	ctx.fill();
	ctx.translate(0, motion.y);
	ctx.rotate(motion.rot);
	ctx.scale(DAVID_SCALE, DAVID_SCALE);
	if (sim.charge > .3 || pose === "focus") {
		const k = pose === "focus" ? 1 : sim.charge;
		const col = pose === "focus" ? "rgba(110,200,255," : "rgba(255,200,40,";
		for (let i = 0; i < 10; i++) {
			const a = i / 10 * Math.PI * 2 + sim.time * 2;
			const r0 = 120;
			const r1 = 120 + 50 * k + Math.sin(sim.time * 20 + i) * 10;
			ctx.strokeStyle = `${col}${.55 * k})`;
			ctx.lineWidth = 10;
			ctx.beginPath();
			ctx.moveTo(Math.cos(a) * r0, -150 + Math.sin(a) * r0);
			ctx.lineTo(Math.cos(a) * r1, -150 + Math.sin(a) * r1);
			ctx.stroke();
		}
	}
	rrect(ctx, -40, -66, 30, 66, 14);
	ink(ctx, DAVID_SKIN, 7);
	rrect(ctx, 10, -66, 30, 66, 14);
	ink(ctx, DAVID_SKIN, 7);
	ellipse(ctx, -26, -4, 28, 13);
	ink(ctx, "#8a5026", 7);
	ellipse(ctx, 26, -4, 28, 13);
	ink(ctx, "#8a5026", 7);
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
	ellipse(ctx, -62, -78, 22, 20);
	ink(ctx, "#b56a32", 6);
	circle(ctx, H.x, H.y, H.r);
	ink(ctx, DAVID_SKIN, 8);
	ctx.beginPath();
	ctx.arc(H.x, H.y - 6, H.r + 4, Math.PI * 1.02, Math.PI * 1.98);
	ctx.quadraticCurveTo(70, -230, 50, -228);
	ctx.quadraticCurveTo(30, -250, 10, -230);
	ctx.quadraticCurveTo(-10, -252, -30, -230);
	ctx.quadraticCurveTo(-60, -246, -80, -226);
	ctx.closePath();
	ink(ctx, "#5a3018", 8);
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
	const ey = -196;
	if (focus) {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 7;
		ctx.beginPath();
		ctx.arc(-32, ey, 14, .1 * Math.PI, .9 * Math.PI);
		ctx.moveTo(46, -192);
		ctx.arc(32, ey, 14, .1 * Math.PI, .9 * Math.PI);
		ctx.stroke();
	} else for (const ex of [-32, 32]) {
		ellipse(ctx, ex, ey, 13, 18);
		ctx.fillStyle = INK;
		ctx.fill();
		circle(ctx, ex - 4, -203, 5);
		ctx.fillStyle = C.white;
		ctx.fill();
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
		ctx.arc(0, -168, 16, .15 * Math.PI, .85 * Math.PI);
		ctx.stroke();
	}
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
function drawSling(ctx, pose, hand, sim) {
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
function drawAim(ctx, sim) {
	if (sim.phase !== "play" && sim.phase !== "countdown" && sim.phase !== "practice") return;
	const power = sim.armed || sim.charge > .15 ? Math.max(.7, sim.charge) : .78;
	const flight = stoneFlight(sim.aimX, sim.aimY, power, sim.davidPose, sim.charge, sim.time);
	const hot = sim.armed || sim.charge > .3;
	ctx.save();
	ctx.globalAlpha = hot ? .95 : .6;
	const steps = 14;
	for (let i = 1; i < steps; i++) {
		const ti = flight.t * i / steps;
		circle(ctx, flight.originX + flight.vx * ti, flight.originY + flight.vy * ti + .5 * GRAVITY * ti * ti, hot ? 9 : 7);
		ink(ctx, C.white, 4);
	}
	const tx = flight.targetX;
	const ty = flight.targetY;
	const s = 1 + (hot ? Math.sin(sim.time * 14) * .06 : 0);
	ctx.globalAlpha = 1;
	circle(ctx, tx, ty, 46 * s);
	ink(ctx, C.white, 9);
	circle(ctx, tx, ty, 34 * s);
	ink(ctx, sim.critOpen ? C.gold : C.red, 5);
	ctx.fillStyle = "rgba(255,255,255,0.6)";
	ellipse(ctx, tx - 10 * s, ty - 12 * s, 12 * s, 7 * s, -.5);
	ctx.fill();
	ctx.restore();
}
function drawStones(ctx, sim) {
	for (const s of sim.stones) {
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
function drawRings(ctx, sim) {
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
		ctx.strokeStyle = C.white;
		ctx.lineWidth = 8;
		for (let i = 0; i < 8; i++) {
			const a = i / 8 * Math.PI * 2;
			ctx.beginPath();
			ctx.moveTo(ring.x + Math.cos(a) * r * .5, ring.y + Math.sin(a) * r * .5);
			ctx.lineTo(ring.x + Math.cos(a) * r * .85, ring.y + Math.sin(a) * r * .85);
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
}
function drawParticles(ctx, sim) {
	for (const p of sim.particles) {
		ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(p.life * 12 + p.size);
		ctx.fillStyle = p.color;
		if (p.size > 5) {
			star(ctx, 0, 0, p.size * 2.4);
			ctx.fill();
		} else ctx.fillRect(-p.size * 1.6, -p.size, p.size * 3.2, p.size * 2);
		ctx.restore();
	}
	ctx.globalAlpha = 1;
}
var JUDGE_FILL = {
	crit: C.gold,
	good: C.red,
	ok: C.white,
	bad: C.blue,
	info: C.white
};
function drawFloaters(ctx, sim) {
	for (const f of sim.floaters) {
		const k = 1 - f.life / f.maxLife;
		const pop = k < .12 ? 1.6 - k / .12 * .6 : 1;
		const alpha = k > .7 ? 1 - (k - .7) / .3 : 1;
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
			ctx.globalAlpha = Math.max(0, alpha) * .9;
			ink(ctx, C.orange, 8);
			ctx.restore();
		}
		outlinedText(ctx, f.text, 0, 0, size, kind === "info" ? f.color : JUDGE_FILL[kind]);
		if (f.sub) outlinedText(ctx, f.sub, 0, size * .85, size * .55, C.white, null);
		ctx.restore();
	}
	ctx.globalAlpha = 1;
}
/** 크리티컬 순간에 화면 가장자리에서 집중선. */
function drawSpeedLines(ctx, sim) {
	if (sim.stagger < .4 || sim.goliathPose !== "hit") return;
	const k = Math.min(1, (sim.stagger - .4) / .3);
	const cx = sim.goliathX;
	const cy = 70 + GOLIATH_LOCAL.forehead.y;
	ctx.save();
	ctx.globalAlpha = .7 * k;
	ctx.fillStyle = INK;
	for (let i = 0; i < 48; i++) {
		const a = i / 48 * Math.PI * 2 + i % 3 * .02;
		const w = .012 + i % 4 * .004;
		const r0 = 620 + i * 53 % 160;
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
		ctx.lineTo(cx + Math.cos(a - w) * 2400, cy + Math.sin(a - w) * 2400);
		ctx.lineTo(cx + Math.cos(a + w) * 2400, cy + Math.sin(a + w) * 2400);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}
function drawWorld(ctx, sim, calm = false) {
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
function drawPip(ctx, video, skeleton, present, armed = false, flash = 0) {
	const w = ctx.canvas.width;
	const h = ctx.canvas.height;
	ctx.save();
	ctx.clearRect(0, 0, w, h);
	const vw = video?.videoWidth || 4;
	const vh = video?.videoHeight || 3;
	const k = Math.max(w / vw, h / vh);
	const ox = (w - vw * k) / 2;
	const oy = (h - vh * k) / 2;
	const P = (p) => ({
		x: ox + p.x * vw * k,
		y: oy + p.y * vh * k
	});
	if (skeleton && present) {
		const hands = [skeleton[5], skeleton[6]].filter((p) => p && p.v > .3);
		if (hands.length > 0) {
			const p = P(hands.reduce((a, b) => a.y < b.y ? a : b));
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
function loadScores() {
	try {
		const raw = localStorage.getItem(SCORES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const rows = parsed.filter((row) => !!row && typeof row === "object" && typeof row.score === "number" && typeof row.at === "number").filter((row) => row.via !== "pointer").sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 30);
		if (rows.length !== parsed.length) saveScores(rows);
		return rows;
	} catch {
		return [];
	}
}
function saveScores(rows) {
	try {
		localStorage.setItem(SCORES_KEY, JSON.stringify(rows.slice(0, 30)));
	} catch {}
}
function addScore(score, via) {
	const at = Date.now();
	try {
		const all = [...loadScores(), {
			score,
			at,
			via,
			ruleset: 2
		}].sort((a, b) => b.score - a.score || b.at - a.at);
		const rank = all.findIndex((r) => r.at === at) + 1;
		const list = all.slice(0, 30);
		saveScores(list);
		return {
			list,
			rank: rank > 0 && rank <= 30 ? rank : 0
		};
	} catch {
		return {
			list: loadScores(),
			rank: 0
		};
	}
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
var HANDS_UP_SECONDS = 1;
var PRACTICE_THROWS = 2;
var PRACTICE_MAX_SECONDS = 15;
var AIM_ASSIST_PX = 110;
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
	verse = VERSES[0];
	personPresent = false;
	cameraState = "off";
	lastHit = null;
	resultRank = 0;
	scores = [];
	confirmReset = false;
	banner = null;
	bannerLife = 0;
	poseReady = false;
	modelState = "off";
	modelError = null;
	armed = false;
	cameraError = null;
	foreheadHits = 0;
	awardedStagger = false;
	maxCombo = 0;
	shieldWarn = false;
	downed = false;
	aimX = 0;
	aimY = .15;
	lean = 0;
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
	/** 양손 번쩍을 유지한 시간(초). 잠깐 놓쳐도 바로 0이 되지 않는다. */
	handsHold = 0;
	handsLost = 0;
	handsUpProgress = 0;
	tooFar = false;
	offCenter = false;
	practiceThrows = 0;
	practiceIdle = 0;
	vacantHold = 0;
	charging = false;
	chargeX = 0;
	chargeY = 0;
	pointerId = null;
	lastUiKey = "";
	hitStop = 0;
	trauma = 0;
	aiT = 0;
	aiPhase = "rest";
	aiAct = "idle";
	rngState = 20903;
	aiPhaseName = "rest";
	aiActName = "idle";
	interruptStreak = 0;
	lastInterrupt = null;
	dodgeFrom = WORLD_W / 2;
	dodgeTo = WORLD_W / 2;
	restFrom = WORLD_W / 2;
	openCritUsed = false;
	freezeCritUsed = false;
	wasFrozen = false;
	releaseLeft = 0;
	followLeft = 0;
	recoverLeft = 0;
	lastUrgentTick = 11;
	downedLife = 0;
	playStart = 0;
	lastNow = 0;
	roundOpen = false;
	practiceLeft = 0;
	freezeLeft = 0;
	freezeCd = 0;
	freezeHold = 0;
	freezeFound = false;
	chestStill = false;
	inputVia = "webcam";
	pointerHolding = false;
	pointerHold = 0;
	pointerX = 0;
	pointerY = 0;
	pointerX0 = 0;
	pointerY0 = 0;
	calm = false;
	checkMode = false;
	absentHold = 0;
	motionTime = 0;
	queued = null;
	combatAcc = 0;
	stoneAcc = 0;
	hitLog = [];
	constructor(audio, emit) {
		this.audio = audio;
		this.emit = emit;
		this.scores = loadScores();
		this.calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
		this.pushUi(true);
	}
	setCameraState(state, error = null) {
		this.cameraState = state;
		this.cameraError = state === "denied" ? error : null;
		if (state !== "live") {
			this.poseReady = false;
			this.modelState = "off";
			this.modelError = null;
		}
		this.pushUi(true);
	}
	setReadiness(camera, cameraError, model, modelError) {
		this.cameraState = camera;
		this.cameraError = camera === "denied" ? cameraError : null;
		this.modelState = model;
		this.modelError = model === "failed" ? modelError : null;
		this.poseReady = model === "ready";
		if ((this.phase === "play" || this.phase === "countdown" || this.phase === "practice") && !this.checkMode && (camera !== "live" || model === "failed")) {
			const why = camera !== "live" ? "카메라가 끊겨" : "모션이 멈춰";
			this.abortRound(`${why} 이번 경기는 기록하지 않습니다`);
			return;
		}
		this.pushUi(true);
	}
	begin() {
		this.audio.unlock();
		this.phase = "attract";
		this.verse = randomVerse();
		this.pushUi(true);
	}
	/** 첫 화면·대기·준비 화면의 아무 곳이나 누르면 다음으로 간다. */
	pressStart() {
		this.audio.unlock();
		if (this.phase === "boot") {
			this.begin();
			return;
		}
		if (this.phase === "result") {
			this.goAttract();
			return;
		}
		if (this.phase !== "attract" && this.phase !== "start") return;
		const cameraReady = this.poseReady && this.cameraState === "live";
		if (!this.checkMode && !cameraReady) {
			this.checkMode = true;
			this.inputVia = "pointer";
		}
		if (this.phase === "attract") {
			this.goStart();
			if (!cameraReady) this.goPractice();
			return;
		}
		this.goPractice();
	}
	uiAdvance() {
		if (this.phase === "boot") this.begin();
		else if (this.phase === "attract") this.goStart();
		else if (this.phase === "start") this.goPractice();
		else if (this.phase === "result") this.goAttract();
	}
	setPerson(present) {
		this.personPresent = present;
	}
	enterCheckMode() {
		this.checkMode = true;
		this.inputVia = "pointer";
		this.banner = "점검 모드";
		this.bannerLife = 2.2;
		if (this.phase === "boot") this.begin();
		if (this.phase === "attract") this.goStart();
		else this.pushUi(true);
	}
	notePose(frame) {
		this.personPresent = frame.present;
		this.tooFar = frame.present && frame.tooFar;
		this.offCenter = frame.present && frame.offCenter;
		if (!frame.present) {
			this.armed = false;
			this.chestStill = false;
			this.freezeHold = 0;
			if ((this.phase === "play" || this.phase === "countdown" || this.phase === "practice") && !this.checkMode && this.cameraState === "live") {
				const t = performance.now();
				if (this.absentHold === 0) this.absentHold = t;
				if (t - this.absentHold > 1500) {
					this.abortRound("사람이 화면에서 벗어나 이번 경기는 기록하지 않습니다");
					return;
				}
			}
			if (this.phase === "result") {
				const now = performance.now();
				if (this.vacantHold === 0) this.vacantHold = now;
				if (now - this.vacantHold > 2500) this.goAttract();
			}
			return;
		}
		this.absentHold = 0;
		this.armed = frame.armed;
		this.chestStill = frame.chestStill;
		if (frame.aim && !this.queued && !this.pointerHolding) {
			this.aimX = frame.aim.aimX;
			this.aimY = frame.aim.aimY;
		}
		if ((this.phase === "play" || this.phase === "practice") && frame.armed) this.charge = Math.max(this.charge, .6);
		this.handsUpSeen = frame.handsUp && !frame.tooFar;
		if ((this.phase === "play" || this.phase === "practice") && frame.throwEvent) {
			if (!this.checkMode) this.inputVia = "webcam";
			this.launch(frame.throwEvent);
		}
		if (this.phase === "result") this.vacantHold = 0;
	}
	handsUpSeen = false;
	/** 시작 동작: 양손을 머리 위로 1초 유지. 0.25초 이내로 놓친 것은 봐준다. */
	stepHandsUp(dt) {
		if (!(this.phase === "attract" || this.phase === "start") || !this.poseReady || this.cameraState !== "live") {
			this.handsHold = 0;
			this.handsLost = 0;
			this.handsUpProgress = 0;
			return;
		}
		if (this.handsUpSeen && this.personPresent) {
			this.handsHold += dt;
			this.handsLost = 0;
		} else {
			this.handsLost += dt;
			if (this.handsLost > .25) this.handsHold = Math.max(0, this.handsHold - dt * 2);
		}
		this.handsUpProgress = Math.min(1, this.handsHold / HANDS_UP_SECONDS);
		if (this.handsHold >= HANDS_UP_SECONDS) {
			this.handsHold = 0;
			this.handsUpProgress = 0;
			this.audio.play("start");
			if (this.phase === "attract") this.goStart();
			this.goPractice();
		}
	}
	pointerDown(x, y, id) {
		this.pointerId = id;
		this.pointerHolding = true;
		this.pointerHold = 0;
		this.pointerX = x;
		this.pointerY = y;
		this.pointerX0 = x;
		this.pointerY0 = y;
		if (this.phase === "boot" || this.phase === "attract" || this.phase === "start") {
			this.pointerHolding = false;
			this.pressStart();
			return;
		}
		if (this.phase === "result") this.goAttract();
	}
	pointerMove(x, y, id) {
		if (id !== this.pointerId) return;
		if (Math.hypot(x - this.pointerX0, y - this.pointerY0) > 36) this.pointerHolding = false;
		this.pointerX = x;
		this.pointerY = y;
		if (this.pointerHolding && (this.phase === "play" || this.phase === "practice")) {
			this.aimX = Math.max(-1, Math.min(1, (x - WORLD_W / 2) / 280));
			this.aimY = Math.max(-1, Math.min(1, (y - 670) / 340));
		}
	}
	pointerUp(x, y, id) {
		if (id !== this.pointerId && this.pointerId !== null) return;
		const dy = this.pointerY0 - y;
		const dx = x - this.pointerX0;
		this.pointerId = null;
		this.pointerHolding = false;
		this.pointerHold = 0;
		this.charging = false;
		this.charge = 0;
		if ((this.phase === "play" || this.phase === "practice") && dy > 90 && Math.abs(dx) < 460) {
			this.inputVia = "pointer";
			const aimX = Math.max(-1, Math.min(1, (x - WORLD_W / 2) / 280));
			const aimY = Math.max(-1, Math.min(1, (y - 670) / 340));
			this.launch({
				power: Math.max(.45, Math.min(1, dy / 520)),
				aimX,
				aimY
			});
		}
	}
	throwStone(power = .78, aimX = 0, aimY = .2) {
		return this.launch({
			power,
			aimX,
			aimY
		}, false, true);
	}
	startPractice() {
		this.goPractice();
	}
	skipPractice() {
		if (this.phase === "practice") this.goCountdown();
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
	update(now) {
		const real = this.lastNow ? Math.min(.25, (now - this.lastNow) / 1e3) : .016;
		this.lastNow = now;
		if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - real);
		this.time += real;
		if (this.phase === "play" && this.playStart > 0) {
			this.timeLeft = Math.max(0, 30 - (now - this.playStart) / 1e3);
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
				this.pushUi(true);
				return;
			}
		}
		if (this.freezeLeft > 0) this.freezeLeft = Math.max(0, this.freezeLeft - real);
		else this.motionTime += real;
		if (this.freezeCd > 0) this.freezeCd = Math.max(0, this.freezeCd - real);
		if (this.phase === "play" && this.freezeCd <= 0 && this.freezeLeft <= 0 && (this.chestStill || this.pointerHolding)) {
			this.freezeHold += real;
			if (this.freezeHold >= 1.2) this.triggerFreeze();
		} else if (!this.pointerHolding) this.freezeHold = 0;
		const STEP = 1 / 60;
		this.combatAcc = Math.min(.25, this.combatAcc + real);
		this.stoneAcc = Math.min(.25, this.stoneAcc + (this.hitStop > 0 ? 0 : real));
		while (this.combatAcc >= STEP || this.stoneAcc >= STEP) {
			if (this.combatAcc >= STEP) {
				this.stepGoliath(STEP);
				this.decayThrow(STEP);
				this.releaseQueued(STEP);
				this.combatAcc -= STEP;
			}
			if (this.stoneAcc >= STEP) {
				this.stepStones(STEP);
				this.stoneAcc -= STEP;
			}
		}
		this.hitFlash = Math.max(0, this.hitFlash - real * 4);
		this.stagger = Math.max(0, this.stagger - real);
		this.throwAnim = 0;
		this.comboTimer = Math.max(0, this.comboTimer - real);
		if (this.comboTimer <= 0) this.combo = 0;
		this.bannerLife = Math.max(0, this.bannerLife - real);
		if (this.bannerLife <= 0) this.banner = null;
		this.trauma = Math.max(0, this.trauma - real * 1.8);
		const amp = this.calm ? 0 : this.trauma * this.trauma;
		this.shakeX = (Math.random() - .5) * 10 * amp;
		this.shakeY = (Math.random() - .5) * 6 * amp;
		if ((this.phase === "play" || this.phase === "practice") && (this.armed || this.pointerHolding)) this.charge = Math.min(1, this.charge + real * 2.4);
		else this.charge = Math.max(0, this.charge - real * 2);
		if (this.phase === "attract") {
			this.demoAcc += real;
			if (this.demoAcc > 2.05) {
				this.demoAcc = 0;
				this.launch({
					power: Math.random() > .28 ? .92 : .55 + Math.random() * .25,
					aimX: (Math.random() - .5) * .4,
					aimY: .25
				}, true);
			}
		}
		if (this.phase === "countdown") {
			this.countdownAcc += real;
			if (this.countdownAcc >= 1) {
				this.countdownAcc = 0;
				this.countdown -= 1;
				this.audio.play("tick");
				if (this.countdown <= 0) this.beginPlay(now);
				this.pushUi(true);
			}
		}
		this.stepHandsUp(real);
		if (this.phase === "practice") {
			this.practiceIdle += real;
			if (this.practiceLeft > 0) {
				this.practiceLeft -= real;
				if (this.practiceLeft <= 0) this.goCountdown();
			} else if (this.practiceIdle > PRACTICE_MAX_SECONDS) this.goCountdown();
		}
		if (this.phase === "result") {
			this.resultAcc += real;
			if (this.resultAcc > 18) this.goAttract();
		}
		this.stepFx(real);
		this.pushUi();
	}
	render(ctx) {
		drawWorld(ctx, this.sim(), this.calm);
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
			aimY: this.aimY,
			lean: this.lean,
			critOpen: this.critOpen(),
			downed: this.downed,
			sightX: this.aimX * 300 + WORLD_W / 2,
			freezeLeft: this.freezeLeft,
			goliathPose: this.goliathPose(),
			davidPose: this.davidPose()
		};
	}
	goStart() {
		if (this.phase === "start" || this.phase === "practice" || this.phase === "countdown" || this.phase === "play") return;
		if (!this.readyToStart()) return;
		this.phase = "start";
		this.verse = randomVerse(this.verse.ref);
		this.handsHold = 0;
		this.confirmReset = false;
		this.queued = null;
		this.pushUi(true);
	}
	goPractice() {
		if (this.phase === "practice" || this.phase === "countdown" || this.phase === "play") return;
		if (!this.readyToStart()) return;
		this.phase = "practice";
		this.stones = [];
		this.queued = null;
		this.practiceLeft = 0;
		this.practiceThrows = 0;
		this.practiceIdle = 0;
		this.absentHold = 0;
		this.score = 0;
		this.combo = 0;
		this.banner = "한 번 던져 보세요";
		this.bannerLife = 2;
		this.pushUi(true);
	}
	goCountdown() {
		if (this.phase === "countdown" || this.phase === "play") return;
		if (!this.readyToStart()) return;
		this.phase = "countdown";
		this.countdown = 3;
		this.countdownAcc = 0;
		this.stones = [];
		this.queued = null;
		this.practiceLeft = 0;
		this.audio.play("tick");
		this.pushUi(true);
	}
	beginPlay(now) {
		this.phase = "play";
		this.playStart = now;
		this.roundOpen = true;
		this.timeLeft = 30;
		this.score = 0;
		this.combo = 0;
		this.comboTimer = 0;
		this.maxCombo = 0;
		this.foreheadHits = 0;
		this.downed = false;
		this.downedLife = 0;
		this.damage = 0;
		this.lastHit = null;
		this.aiPhase = "rest";
		this.aiAct = "idle";
		this.aiPhaseName = "rest";
		this.aiActName = "idle";
		this.aiT = 0;
		this.rngState = 20903;
		this.interruptStreak = 0;
		this.lastInterrupt = null;
		this.openCritUsed = false;
		this.freezeCritUsed = false;
		this.wasFrozen = false;
		this.goliathX = WORLD_W / 2;
		this.dodgeFrom = WORLD_W / 2;
		this.dodgeTo = WORLD_W / 2;
		this.restFrom = WORLD_W / 2;
		this.lean = 0;
		this.releaseLeft = 0;
		this.followLeft = 0;
		this.recoverLeft = 0;
		this.aimX = 0;
		this.aimY = .15;
		this.lastUrgentTick = 11;
		this.freezeLeft = 0;
		this.freezeCd = 0;
		this.freezeHold = 0;
		this.freezeFound = false;
		this.inputVia = this.checkMode ? "pointer" : "webcam";
		this.stones = [];
		this.hitLog = [];
		this.queued = null;
		this.throwCool = 0;
		this.hitStop = 0;
		this.absentHold = 0;
		this.audio.play("start");
		this.audio.startBeat();
	}
	abortRound(message) {
		this.audio.stopBeat();
		this.roundOpen = false;
		this.playStart = 0;
		this.phase = "attract";
		this.stones = [];
		this.combo = 0;
		this.comboTimer = 0;
		this.freezeLeft = 0;
		this.freezeHold = 0;
		this.freezeCd = 0;
		this.absentHold = 0;
		this.handsHold = 0;
		this.handsHold = 0;
		this.throwCool = 0;
		this.hitStop = 0;
		this.armed = false;
		this.queued = null;
		this.banner = message;
		this.bannerLife = 3.2;
		this.pushUi(true);
	}
	triggerFreeze() {
		if (this.phase !== "play" || this.freezeCd > 0 || this.freezeLeft > 0) return;
		this.freezeLeft = 2;
		this.freezeCd = 8;
		this.freezeHold = 0;
		this.freezeCritUsed = false;
		this.pointerHold = 0;
		this.shieldUp = false;
		this.shieldWarn = false;
		const first = !this.freezeFound;
		this.freezeFound = true;
		this.banner = first ? "다윗의 프리징" : "집중";
		this.bannerLife = 1.3;
		this.audio.play("freeze");
	}
	readyToStart() {
		if (this.checkMode) return true;
		if (this.cameraState === "live" && this.poseReady) return true;
		this.banner = this.readinessHint();
		this.bannerLife = 2.4;
		this.pushUi(true);
		return false;
	}
	readinessHint() {
		if (this.cameraState === "loading") return "카메라를 켜는 중입니다";
		if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
		if (this.cameraState !== "live") return "카메라를 켜 주세요";
		if (this.modelState === "loading") return "모션을 준비하는 중입니다";
		if (this.modelState === "failed") return this.modelError || "모션을 다시 준비해 주세요";
		return "모션이 준비되면 시작할 수 있습니다";
	}
	goAttract() {
		this.audio.stopBeat();
		this.phase = "attract";
		this.handsHold = 0;
		this.vacantHold = 0;
		this.resultAcc = 0;
		this.confirmReset = false;
		this.stones = [];
		this.roundOpen = false;
		this.playStart = 0;
		this.practiceLeft = 0;
		this.throwCool = 0;
		this.combo = 0;
		this.comboTimer = 0;
		this.absentHold = 0;
		this.banner = null;
		this.queued = null;
		this.pushUi(true);
	}
	finishRound() {
		if (this.phase === "result") return;
		this.audio.stopBeat();
		this.phase = "result";
		this.resultAcc = 0;
		this.vacantHold = 0;
		this.stones = [];
		this.queued = null;
		this.timeLeft = 0;
		if (this.roundOpen) {
			this.roundOpen = false;
			if (this.checkMode) this.resultRank = 0;
			else {
				const saved = addScore(this.score, "webcam");
				this.scores = saved.list;
				this.resultRank = saved.rank;
			}
		}
		this.audio.play("end");
		this.pushUi(true);
	}
	launch(ev, demo = false, immediate = false) {
		const live = this.phase === "play" || this.phase === "practice";
		if (!demo && !live) return false;
		if (!demo && (this.throwCool > 0 || this.queued || this.followLeft > 0)) return false;
		if (this.stones.length >= 6) return false;
		if (!demo) ev = this.assistAim(ev);
		this.aimX = ev.aimX;
		this.aimY = ev.aimY;
		this.charge = 0;
		this.throwCool = demo ? .35 : .36;
		this.queued = {
			ev,
			demo
		};
		this.releaseLeft = demo || immediate ? 0 : .08;
		if (this.releaseLeft <= 0) this.releaseQueued(0);
		if (!demo && this.phase === "practice") {
			this.practiceThrows += 1;
			if (this.practiceThrows >= PRACTICE_THROWS) this.practiceLeft = 1.4;
		}
		return true;
	}
	/** 아이용 보정: 급소가 열렸을 때 이마 근처를 노리면 이마로 붙인다. */
	assistAim(ev) {
		if (!this.critOpen()) return ev;
		const F = GOLIATH_LOCAL.forehead;
		const fx = this.goliathX + F.x;
		const fy = 70 + this.goliathBob + F.y;
		const p = aimPoint(ev.aimX, ev.aimY);
		if (Math.hypot(p.x - fx, (p.y - fy) * 1.3) > AIM_ASSIST_PX) return ev;
		return {
			...ev,
			aimX: Math.max(-1, Math.min(1, (fx - WORLD_W / 2) / 280)),
			aimY: Math.max(-1, Math.min(1, (fy - 670) / 340))
		};
	}
	decayThrow(dt) {
		if (this.followLeft > 0) {
			this.followLeft = Math.max(0, this.followLeft - dt);
			if (this.followLeft === 0) this.recoverLeft = .18;
		} else if (this.recoverLeft > 0) this.recoverLeft = Math.max(0, this.recoverLeft - dt);
		this.throwCool = Math.max(0, this.throwCool - dt);
	}
	releaseQueued(dt) {
		if (!this.queued) return;
		this.releaseLeft -= dt;
		if (this.releaseLeft > 0) return;
		const { ev, demo } = this.queued;
		this.queued = null;
		const flight = stoneFlight(ev.aimX, ev.aimY, ev.power, "throw", 0, this.time);
		this.stones.push({
			x: flight.originX,
			y: flight.originY,
			vx: flight.vx,
			vy: flight.vy,
			rot: 0,
			spin: (Math.random() - .5) * 10,
			live: true,
			age: 0,
			flightT: flight.t,
			aimX: ev.aimX,
			aimY: ev.aimY
		});
		this.followLeft = .15;
		this.recoverLeft = 0;
		if (!demo) this.audio.play("throw");
	}
	breakCombo() {
		this.combo = 0;
		this.comboTimer = 0;
	}
	stepStones(dt) {
		for (const s of this.stones) {
			if (!s.live) continue;
			const x0 = s.x;
			const y0 = s.y;
			const vy0 = s.vy;
			s.vy = vy0 + GRAVITY * dt;
			s.x = x0 + s.vx * dt;
			s.y = y0 + vy0 * dt + .5 * GRAVITY * dt * dt;
			s.age += dt;
			s.rot += s.spin * dt;
			if (s.y > 1960 || s.x < -80 || s.x > 1160 || s.y < -120) {
				s.live = false;
				if (this.phase === "play") this.breakCombo();
				continue;
			}
			this.collide(s, x0, y0, dt);
		}
		this.stones = this.stones.filter((s) => s.live);
	}
	/** 화면 좌표를 골리앗 그림과 같은 로컬 좌표로 되돌린다. */
	worldToLocal(wx, wy) {
		const angle = goliathAngle(this.stagger, this.downed, this.shieldUp, this.lean);
		const fy = GOLIATH_LOCAL.foot.y;
		const gy = 70 + this.goliathBob;
		const vx = wx - this.goliathX;
		const vy = wy - (gy + fy);
		const ca = Math.cos(angle);
		const sa = Math.sin(angle);
		const px = ca * vx + sa * vy;
		const py = -sa * vx + ca * vy;
		return {
			x: px - (this.downed ? 40 : 0),
			y: py + fy - (this.downed ? 80 : 0)
		};
	}
	collide(s, x0, y0, dt) {
		const a0 = this.worldToLocal(x0, y0);
		const a1 = this.worldToLocal(s.x, s.y);
		const aimW = aimPoint(s.aimX, s.aimY);
		const aim = this.worldToLocal(aimW.x, aimW.y);
		const F = GOLIATH_LOCAL.forehead;
		const H = GOLIATH_LOCAL.helmet;
		const sh = shieldLocal(this.shieldUp, this.shieldWarn);
		const T = GOLIATH_LOCAL.torso;
		const L = GOLIATH_LOCAL.legs;
		const age0 = s.age - dt;
		const inEll = (x, y, cx, cy, erx, ery) => {
			const nx = (x - cx) / erx;
			const ny = (y - cy) / ery;
			return nx * nx + ny * ny <= 1;
		};
		const aimedFore = inEll(aim.x, aim.y, F.x, F.y, F.rx + 16, F.ry + 12);
		const aimedHead = Math.hypot(aim.x - H.x, aim.y - H.y) <= H.r;
		const aimedTorso = Math.abs(aim.x - T.x) <= T.w / 2 && Math.abs(aim.y - T.y) <= T.h / 2;
		const aimedLegs = Math.abs(aim.x - L.x) <= L.w / 2 && Math.abs(aim.y - L.y) <= L.h / 2;
		const aimedShield = Math.hypot(aim.x - sh.x, aim.y - sh.y) <= sh.r + 14;
		const falling = s.vy > 80 && s.age > s.flightT;
		const hits = [];
		const add = (t, part, aimed) => {
			if (t === null) return;
			const hitAge = age0 + t * dt;
			if (!(part === "방패" && this.shieldUp)) {
				if (!aimed && !falling) return;
				if (!falling && hitAge < s.flightT * .55) return;
			}
			hits.push({
				t,
				part
			});
		};
		add(segmentHitsCircle(a0.x, a0.y, a1.x, a1.y, sh.x, sh.y, sh.r + 14), "방패", aimedShield);
		add(segmentHitsEllipse(a0.x, a0.y, a1.x, a1.y, F.x, F.y, F.rx + 16, F.ry + 12), "이마", aimedFore || aimedHead);
		add(segmentHitsCircle(a0.x, a0.y, a1.x, a1.y, H.x, H.y, H.r + 14), "투구", aimedFore || aimedHead);
		add(segmentHitsBox(a0.x, a0.y, a1.x, a1.y, T.x, T.y, T.w, T.h, 16, 12), "몸통", aimedTorso);
		add(segmentHitsBox(a0.x, a0.y, a1.x, a1.y, L.x, L.y, L.w, L.h, 16, 12), "몸통", aimedLegs);
		if (hits.length === 0) return;
		hits.sort((a, b) => a.t - b.t);
		const hit = hits[0];
		let part = hit.part;
		if ((part === "투구" || part === "이마") && aimedFore) part = this.critOpen() ? "이마" : "투구";
		else if (part === "이마") part = this.critOpen() ? "이마" : "투구";
		if (part === "이마") {
			if (this.freezeLeft > 0) this.freezeCritUsed = true;
			else this.openCritUsed = true;
		}
		const wx = x0 + (s.x - x0) * hit.t;
		const wy = y0 + (s.y - y0) * hit.t;
		const sfx = part === "방패" ? "hitShield" : part === "몸통" ? "hitSoft" : "hitHead";
		this.registerHit(part, wx, wy, sfx);
		s.live = false;
	}
	registerHit(part, x, y, sfx) {
		const kind = part === "이마" ? "crit" : part === "투구" ? "good" : part === "방패" ? "bad" : "ok";
		const label = part === "이마" ? "크리티컬!" : part === "투구" ? "좋아!" : part === "방패" ? "막힘" : "명중";
		if (this.phase === "practice") {
			this.hitFlash = .45;
			this.hitLog.push({
				part,
				gained: 0
			});
			this.floaters.push({
				x,
				y,
				life: .8,
				maxLife: .8,
				text: label,
				color: "#fff4dc",
				kind
			});
			this.audio.play(sfx);
			return;
		}
		if (this.phase !== "play") {
			this.hitFlash = .35;
			return;
		}
		const blocked = part === "방패";
		if (blocked) this.breakCombo();
		else {
			this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
			this.comboTimer = 2;
			if (this.combo > this.maxCombo) this.maxCombo = this.combo;
		}
		const gained = hitPoints(part, blocked ? 1 : this.combo);
		this.score += gained;
		this.hitLog.push({
			part,
			gained
		});
		this.lastHit = part;
		this.hitFlash = .65;
		const crit = part === "이마";
		this.stagger = crit ? .7 : .25;
		this.trauma = Math.min(.7, this.trauma + (crit ? .45 : blocked ? .15 : .28));
		if (crit) this.hitStop = .045;
		this.rings.push({
			x,
			y,
			life: crit ? .45 : .32,
			maxLife: crit ? .45 : .32,
			r: crit ? 30 : 16
		});
		this.floaters.push({
			x,
			y: y - 30,
			life: crit ? 1.1 : .9,
			maxLife: crit ? 1.1 : .9,
			text: label,
			sub: `+${gained.toLocaleString("ko-KR")}`,
			color: "#fff4dc",
			kind
		});
		this.burst(x, y, crit);
		this.audio.play(sfx);
		if (!blocked && this.combo >= 3) this.audio.play("combo");
		if (crit || part === "투구") this.damage = Math.min(3, this.damage + 1);
		if (crit) this.foreheadHits += 1;
	}
	burst(x, y, big) {
		const n = big ? 28 : 14;
		const colors = big ? [
			"#ffd23a",
			"#f24a2a",
			"#ffffff",
			"#3fb8d9"
		] : [
			"#ffd23a",
			"#ffffff",
			"#ff8a1f"
		];
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
				size: big && i % 4 === 0 ? 6 + Math.random() * 3 : 2 + Math.random() * 3,
				color: colors[i % colors.length]
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
		this.goliathBob = Math.sin(this.time * 1.7) * 6;
		if (this.freezeLeft > 0) {
			this.wasFrozen = true;
			this.shieldUp = false;
			this.shieldWarn = false;
			this.lean = 0;
			return;
		}
		if (this.wasFrozen) {
			this.wasFrozen = false;
			this.aiPhase = "rest";
			this.aiT = 0;
			this.restFrom = this.goliathX;
			this.shieldUp = false;
			this.shieldWarn = false;
			this.openCritUsed = true;
		}
		if (this.downed) {
			this.downedLife = Math.max(0, this.downedLife - dt);
			if (this.downedLife <= 0) this.downed = false;
			this.shieldUp = false;
			this.shieldWarn = false;
			return;
		}
		if (this.phase !== "play" && this.phase !== "practice") {
			this.shieldUp = false;
			this.shieldWarn = false;
			this.lean = Math.sin(this.time * .6) * .02;
			return;
		}
		const elapsed = this.phase === "practice" ? 4 : Math.max(0, 30 - this.timeLeft);
		let left = dt;
		let guard = 0;
		while (left > 1e-4 && guard < 6) {
			guard += 1;
			const need = Math.max(1e-4, this.phaseSeconds(elapsed) - this.aiT);
			const step = Math.min(left, need);
			this.aiT += step;
			left -= step;
			if (this.aiT >= this.phaseSeconds(elapsed) - 1e-4) {
				this.advanceAct(elapsed);
				this.aiT = 0;
			}
		}
		this.applyActPose(elapsed);
		this.aiPhaseName = this.aiPhase;
		this.aiActName = this.aiAct;
	}
	phaseSeconds(elapsed) {
		const band = combatBand(elapsed);
		if (this.aiPhase === "rest") return .35;
		if (this.aiPhase === "tell") return band.tell;
		if (this.aiPhase === "act") {
			if (this.aiAct === "guard") return .85;
			if (this.aiAct === "left" || this.aiAct === "right") return .35;
			return .75;
		}
		return band.open;
	}
	advanceAct(elapsed) {
		if (this.aiPhase === "rest") {
			this.aiAct = this.pickAct(elapsed);
			this.aiPhase = "tell";
			this.dodgeFrom = this.goliathX;
			const band = combatBand(elapsed);
			const dir = this.aiAct === "left" ? -1 : this.aiAct === "right" ? 1 : 0;
			this.dodgeTo = Math.max(180, Math.min(WORLD_W - 180, this.goliathX + dir * band.dodgeDist));
			return;
		}
		if (this.aiPhase === "tell") {
			this.aiPhase = "act";
			return;
		}
		if (this.aiPhase === "act") {
			if (this.aiAct === "left" || this.aiAct === "right") this.goliathX = this.dodgeTo;
			if (this.aiAct === "idle") {
				this.aiPhase = "rest";
				this.restFrom = this.goliathX;
				return;
			}
			this.aiPhase = "open";
			this.openCritUsed = false;
			return;
		}
		this.aiPhase = "rest";
		this.restFrom = this.goliathX;
		this.shieldUp = false;
		this.shieldWarn = false;
	}
	pickAct(elapsed) {
		if (this.phase === "play" && elapsed < 2) return "idle";
		const band = combatBand(elapsed);
		let idle = band.idle;
		let guard = band.guard;
		let left = band.dodge / 2;
		let right = band.dodge / 2;
		if (this.goliathX - band.dodgeDist < 180) {
			idle += left;
			left = 0;
		}
		if (this.goliathX + band.dodgeDist > 900) {
			idle += right;
			right = 0;
		}
		if (this.interruptStreak >= 2 && this.lastInterrupt === "guard") {
			idle += guard;
			guard = 0;
		}
		if (this.interruptStreak >= 2 && this.lastInterrupt === "left") {
			idle += left;
			left = 0;
		}
		if (this.interruptStreak >= 2 && this.lastInterrupt === "right") {
			idle += right;
			right = 0;
		}
		const bag = [
			["idle", idle],
			["guard", guard],
			["left", left],
			["right", right]
		];
		const sum = bag.reduce((acc, [, w]) => acc + Math.max(0, w), 0);
		let r = this.nextRand() * Math.max(1e-4, sum);
		let act = "idle";
		for (const [name, w] of bag) {
			if (w <= 0) continue;
			r -= w;
			if (r < 0) {
				act = name;
				break;
			}
		}
		if (act === "idle") this.interruptStreak = 0;
		else if (act === this.lastInterrupt) this.interruptStreak += 1;
		else this.interruptStreak = 1;
		if (act !== "idle") this.lastInterrupt = act;
		return act;
	}
	applyActPose(elapsed) {
		const u = Math.max(0, Math.min(1, this.aiT / Math.max(.01, this.phaseSeconds(elapsed))));
		this.shieldUp = false;
		this.shieldWarn = false;
		this.lean = 0;
		if (this.aiAct === "guard" && this.aiPhase === "tell") {
			this.shieldWarn = true;
			this.lean = -.03 * u;
		}
		if (this.aiAct === "guard" && this.aiPhase === "act") {
			this.shieldUp = true;
			this.lean = -.04;
		}
		if (this.aiAct === "left" || this.aiAct === "right") {
			const dir = this.aiAct === "left" ? -1 : 1;
			if (this.aiPhase === "tell") {
				this.lean = dir * .045 * u;
				this.goliathX = this.dodgeFrom + dir * 18 * u;
			} else if (this.aiPhase === "act") {
				this.lean = dir * .03;
				this.goliathX = this.dodgeFrom + (this.dodgeTo - this.dodgeFrom) * u;
			} else if (this.aiPhase === "open") {
				this.lean = dir * .015;
				this.goliathX = this.dodgeTo;
			}
		}
		if (this.aiPhase === "rest") this.goliathX = this.restFrom + (WORLD_W / 2 - this.restFrom) * u;
		if (this.aiPhase === "open") this.shieldUp = false;
	}
	nextRand() {
		let s = this.rngState | 0;
		s = s + 1831565813 | 0;
		let t = Math.imul(s ^ s >>> 15, 1 | s);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		this.rngState = s;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
	critOpen() {
		if (this.freezeLeft > 0) return !this.freezeCritUsed;
		return this.aiPhase === "open" && !this.openCritUsed;
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
			snap.modelState,
			snap.modelError ?? "",
			snap.armed ? 1 : 0,
			snap.cameraError ?? "",
			snap.freezeFound ? 1 : 0,
			snap.checkMode ? 1 : 0,
			Math.ceil(snap.freezeLeft * 5),
			snap.inputVia,
			snap.verse.ref,
			snap.scores.length,
			Math.round(snap.handsUpProgress * 20)
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
			modelState: this.modelState,
			modelError: this.modelError,
			armed: this.armed,
			cameraError: this.cameraError,
			foreheadHits: this.foreheadHits,
			comboLeft: this.comboTimer / 1.8,
			bestScore: this.scores[0]?.score ?? 0,
			freezeLeft: this.freezeLeft,
			freezeCd: this.freezeCd,
			freezeFound: this.freezeFound,
			inputVia: this.inputVia,
			checkMode: this.checkMode,
			handsUpProgress: this.handsUpProgress
		};
	}
	goliathPose() {
		if (this.hitFlash > .05 || this.stagger > .15) return "hit";
		if (this.shieldUp) return "guard";
		if (this.shieldWarn) return "warn";
		return "idle";
	}
	davidPose() {
		if (this.freezeLeft > 0 && (this.phase === "play" || this.phase === "practice")) return "focus";
		if (this.followLeft > 0 || this.queued) return "throw";
		if (this.recoverLeft > 0) return "recover";
		if ((this.armed || this.pointerHolding) && this.charge > .55) return "spin";
		if (this.armed || this.pointerHolding || this.charge > .18) return "ready";
		return "idle";
	}
	motionHint() {
		if (this.checkMode && this.cameraState !== "live") {
			if (this.phase === "practice") return "화면을 위로 밀어 던지세요";
			if (this.phase === "play") {
				if (this.freezeLeft > 0) return "골리앗이 멈췄습니다";
				return "위로 밀어 던지고, 길게 누르면 집중";
			}
			if (this.phase === "start") return "연습 던지기를 누르세요";
			if (this.phase === "countdown") return "";
		}
		if (this.cameraState === "loading") return "카메라를 켜는 중";
		if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
		if (this.cameraState !== "live") return "카메라를 켜 주세요";
		if (this.modelState === "loading") return "카메라는 켜졌습니다. 모션을 준비하는 중";
		if (this.modelState === "failed") return this.modelError || "모션을 다시 준비해 주세요";
		if (!this.poseReady) return "모션이 준비되면 시작할 수 있습니다";
		if (!this.personPresent) return "카메라 앞에 상반신이 나오게 서 주세요";
		if (this.tooFar) return "조금 더 앞으로 와 주세요";
		if (this.offCenter && this.phase !== "play") return "화면 가운데로 와 주세요";
		if (this.phase === "start" || this.phase === "attract") return "양손을 머리 위로 번쩍! 1초 유지하면 시작";
		if (this.phase === "practice") {
			if (this.armed) return "좋아요! 이제 앞으로 힘껏 던지세요";
			return `손을 머리 위로 들었다가 앞으로 던지세요 (${this.practiceThrows}/${PRACTICE_THROWS})`;
		}
		if (this.phase === "play") {
			if (this.freezeLeft > 0) return "골리앗이 멈췄습니다";
			if (this.critOpen()) return "금빛이 보일 때 이마를 노려요";
			if (this.shieldWarn) return "방패가 올라옵니다";
			if (this.shieldUp) return "방패를 피하세요";
			if (this.aiAct === "left") return "왼쪽으로 피합니다";
			if (this.aiAct === "right") return "오른쪽으로 피합니다";
			if (this.armed) return "던지세요!";
			return "손을 든 높이로 돌이 날아갑니다";
		}
		return "";
	}
};
function Overlays({ ui, onBegin, onStart, onNext, onMute, onAskReset, onConfirmReset, onCancelReset, onRetryCamera, onRetryMotion, onOpenWindow, onSkipPractice }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 flex flex-col text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onMute,
				className: "t-btn pointer-events-auto absolute top-3 right-3 z-20 flex size-12 items-center justify-center bg-cream text-ink",
				"aria-label": ui.muted ? "소리 켜기" : "소리 끄기",
				children: ui.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {
					className: "size-5",
					strokeWidth: 3
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {
					className: "size-5",
					strokeWidth: 3
				})
			}),
			ui.phase === "boot" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Boot, {
				ui,
				onBegin
			}),
			ui.phase === "attract" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Attract, {
				ui,
				onStart,
				onAskReset,
				onRetryCamera,
				onRetryMotion
			}),
			ui.phase === "start" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Start, {
				ui,
				onStart,
				onRetryCamera,
				onRetryMotion,
				onOpenWindow
			}),
			ui.phase === "practice" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Practice, {
				ui,
				onSkip: onSkipPractice
			}),
			ui.phase === "countdown" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Countdown, { n: ui.countdown }),
			ui.phase === "play" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, { ui }),
			ui.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Result, {
				ui,
				onNext
			}),
			ui.confirmReset && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/60 px-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "t-panel w-full max-w-sm p-6 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-2xl",
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
								className: "t-btn h-14 flex-1 bg-cream text-lg",
								children: "취소"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onConfirmReset,
								className: "t-btn h-14 flex-1 bg-don text-lg text-cream",
								children: "지우기"
							})]
						})
					]
				})
			})
		]
	});
}
function stop(e) {
	e.preventDefault();
	e.stopPropagation();
}
function Ribbon({ children, tone = "don" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `inline-block rounded-full border-4 border-ink px-5 py-1 font-display text-lg leading-tight ${tone === "ka" ? "bg-ka" : tone === "sun" ? "bg-sun" : "bg-don"} ${tone === "sun" ? "text-ink" : "text-cream"}`,
		children
	});
}
function Title({ size = "lg" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
		className: `t-outline font-display leading-none whitespace-nowrap text-cream drop-shadow-[0_6px_0_var(--color-ink)] ${size === "lg" ? "text-5xl" : size === "md" ? "text-4xl" : "text-3xl"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sun",
				children: "다윗"
			}),
			"과 ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-don",
				children: "골리앗"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: GAME_TITLE
			})
		]
	});
}
function LogoBadge({ size = 96 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center overflow-hidden rounded-full border-[5px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]",
		style: {
			width: size,
			height: size
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: "/logo-alllove.jpg",
			alt: CHURCH_NAME,
			className: "size-full scale-125 object-cover"
		})
	});
}
function VerseBlock({ ui, large, compact }) {
	const words = ui.verse.text.trim().split(/\s+/);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "t-panel relative w-full px-5 pt-7 pb-4 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute -top-5 left-1/2 -translate-x-1/2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ribbon, {
					tone: "ka",
					children: "오늘의 말씀"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
				className: `font-display leading-snug text-ink ${large ? "text-2xl" : compact ? "text-lg" : "text-xl"}`,
				style: {
					wordBreak: "keep-all",
					lineBreak: "strict"
				},
				children: words.map((word, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [i > 0 ? " " : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "whitespace-nowrap",
					children: word
				})] }, `${i}-${word}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm font-bold text-fg-muted",
				children: ui.verse.ref
			})
		]
	});
}
function HintPill({ children }) {
	if (!children) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mx-auto w-fit max-w-[92%] rounded-full border-4 border-ink bg-cream px-4 py-1.5 text-center text-sm font-bold text-ink text-pretty",
		children
	});
}
/** 제작사 표기. full이면 사업자 정보까지. */
function Credit({ full }) {
	if (!full) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-center gap-2 text-[11px] font-bold text-fg-muted",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "제작" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: PRODUCER.logo,
			alt: PRODUCER.name,
			className: "h-3.5 w-auto"
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full rounded-2xl border-4 border-ink bg-paper/95 px-4 py-2.5 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-sm text-fg-muted",
				children: "제작"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: PRODUCER.logo,
				alt: PRODUCER.name,
				className: "h-5 w-auto"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1.5 text-[10px] leading-relaxed text-fg-muted text-pretty",
			style: { wordBreak: "keep-all" },
			children: [
				"상호 ",
				PRODUCER.name,
				" · 대표 ",
				PRODUCER.ceo,
				" · 사업자등록번호 ",
				PRODUCER.bizNo,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
				PRODUCER.address,
				" · ",
				PRODUCER.phone,
				" · ",
				PRODUCER.email
			]
		})]
	});
}
function Boot({ ui, onBegin }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onPointerUp: (e) => {
			stop(e);
			onBegin();
		},
		onClick: (e) => {
			stop(e);
			onBegin();
		},
		className: "pointer-events-auto relative flex h-full w-full touch-manipulation flex-col items-center justify-center gap-6 bg-ink/40 px-7 pb-28 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogoBadge, { size: 104 }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "t-outline-sm font-display text-lg tracking-wide text-cream",
					children: CHURCH_NAME
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerseBlock, {
				ui,
				large: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "t-btn animate-throb bg-don px-9 py-4 text-2xl text-cream",
				children: "화면을 눌러 시작"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-4 bottom-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Credit, { full: true })
			})
		]
	});
}
var MEDAL = [
	"bg-sun",
	"bg-[#d9dde6]",
	"bg-[#e0955a]"
];
function Attract({ ui, onStart, onAskReset, onRetryCamera, onRetryMotion }) {
	const top = ui.scores.slice(0, 5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "pointer-events-none flex flex-col items-center gap-2 px-4 pt-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 pr-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogoBadge, { size: 46 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title, { size: "sm" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerseBlock, {
					ui,
					compact: true
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-1 items-center justify-end pr-5",
			children: !ui.checkMode && ui.cameraState === "live" && ui.modelState === "ready" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandsUpPrompt, {
				progress: ui.handsUpProgress,
				small: true
			})
		}),
		ui.banner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-3 px-5",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintPill, { children: ui.banner })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "t-panel pointer-events-auto mx-4 mb-4 shrink-0 p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onPointerUp: (e) => {
						stop(e);
						onStart();
					},
					onClick: (e) => {
						stop(e);
						onStart();
					},
					className: "t-btn h-14 w-full touch-manipulation bg-don text-2xl text-cream",
					children: "시작하기"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2.5 text-center text-sm font-bold text-fg-muted",
					children: ui.motionHint
				}),
				ui.checkMode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-center text-xs text-fg-muted",
					children: "화면을 밀어 던집니다. 점검 점수는 기록되지 않습니다."
				}) : ui.cameraState === "denied" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-center text-xs text-fg-muted",
					children: "웹캠이 없어도 화면을 밀어 던질 수 있습니다."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onPointerDown: (e) => {
						e.currentTarget.dataset.t = String(performance.now());
					},
					onPointerUp: (e) => {
						const started = Number(e.currentTarget.dataset.t ?? 0);
						if (performance.now() - started > 1400) onAskReset();
					},
					className: "mt-3 flex w-full items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ribbon, {
						tone: "sun",
						children: "명예의 전당"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-fg-muted",
						children: "길게 눌러 초기화"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
					className: "mt-1.5 space-y-1",
					children: [top.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "py-2 text-center font-display text-lg text-fg-muted",
						children: "첫 번째 용사를 기다립니다"
					}), top.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `flex size-7 shrink-0 items-center justify-center rounded-full border-[3px] border-ink font-display text-base ${MEDAL[i] ?? "bg-cream"}`,
								children: i + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-1 font-display text-lg tabular-nums",
								children: row.score.toLocaleString("ko-KR")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-fg-muted",
								children: formatScoreDate(row.at)
							})
						]
					}, `${row.at}-${i}`))]
				}),
				!ui.checkMode && ui.cameraState === "denied" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onRetryCamera,
					className: "mt-3 h-10 w-full text-sm font-bold text-fg-muted underline",
					children: "카메라 다시 시도"
				}),
				ui.modelState === "failed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onRetryMotion,
					className: "mt-2 h-10 w-full text-sm font-bold text-fg-muted underline",
					children: "모션 다시 준비"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2.5 border-t-2 border-dashed border-ink/20 pt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Credit, {})
				})
			]
		})
	] });
}
function Start({ ui, onStart, onRetryCamera, onRetryMotion, onOpenWindow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-ink/45 px-6 py-8 text-center",
		onPointerUp: (e) => {
			if (e.target?.closest("[data-keep-click]")) return;
			onStart();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogoBadge, { size: 88 }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerseBlock, { ui })
			}),
			!ui.checkMode && ui.cameraState === "live" && ui.modelState === "ready" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HandsUpPrompt, { progress: ui.handsUpProgress }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onPointerUp: (e) => {
					stop(e);
					onStart();
				},
				onClick: (e) => {
					stop(e);
					onStart();
				},
				className: "t-btn h-16 w-full max-w-xs touch-manipulation bg-don text-2xl text-cream",
				children: "연습 던지기"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintPill, { children: ui.checkMode ? "화면을 밀어 던지는 중입니다" : ui.motionHint }),
			!ui.checkMode && ui.cameraState === "denied" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraHelp, {
				ui,
				onRetry: onRetryCamera,
				onOpenWindow
			}),
			!ui.checkMode && ui.cameraState === "live" && ui.modelState === "failed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelHelp, {
				ui,
				onRetry: onRetryMotion
			})
		]
	});
}
function CameraHelp({ ui, onRetry, onOpenWindow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-keep-click": true,
		className: "t-panel w-full p-4 text-left",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl",
				children: "카메라가 꺼져 있습니다"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-pretty text-fg-muted",
				children: ui.cameraError || "브라우저가 카메라를 막았습니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "mt-3 list-decimal space-y-1 pl-5 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "주소창 왼쪽 자물쇠 또는 카메라 아이콘을 누릅니다" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						"카메라를 ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "허용" }),
						"으로 바꿉니다"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "아래 다시 시도를 누릅니다" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onRetry,
				className: "t-btn mt-4 h-14 w-full bg-don text-lg text-cream",
				children: "다시 시도"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onOpenWindow,
				className: "t-btn mt-3 h-14 w-full bg-cream text-lg",
				children: "새 창에서 열기"
			})
		]
	});
}
function ModelHelp({ ui, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-keep-click": true,
		className: "t-panel w-full p-4 text-left",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-xl",
				children: "모션을 준비하지 못했습니다"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-pretty text-fg-muted",
				children: ui.modelError || "카메라는 켜져 있지만 동작 인식을 불러오지 못했습니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-fg-muted",
				children: "카메라는 그대로 두고, 모션만 다시 불러옵니다."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onRetry,
				className: "t-btn mt-4 h-14 w-full bg-don text-lg text-cream",
				children: "모션 다시 준비"
			})
		]
	});
}
/** 양손 번쩍 그림과 유지 게이지. 다 차면 연습이 시작된다. */
function HandsUpPrompt({ progress, label = true, small }) {
	const R = 56;
	const len = 2 * Math.PI * R;
	const holding = progress > .02;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 140 140",
			className: `${small ? "size-28" : "size-36"} ${holding ? "" : "animate-bob"}`,
			"aria-hidden": "true",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "70",
					cy: "70",
					r: R,
					fill: "var(--color-paper)",
					stroke: "var(--color-ink)",
					strokeWidth: "18"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "70",
					cy: "70",
					r: R,
					fill: "none",
					stroke: "var(--color-cream)",
					strokeWidth: "9"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "70",
					cy: "70",
					r: R,
					fill: "none",
					stroke: "var(--color-don)",
					strokeWidth: "9",
					strokeLinecap: "round",
					strokeDasharray: `${len * progress} ${len}`,
					transform: "rotate(-90 70 70)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
					transform: "translate(10 6)",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
							fill: "none",
							stroke: "var(--color-ink)",
							strokeWidth: "16",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
							fill: "none",
							stroke: "var(--color-orange)",
							strokeWidth: "8",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "60",
							cy: "46",
							r: "14",
							fill: "var(--color-sun)",
							stroke: "var(--color-ink)",
							strokeWidth: "5"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "35",
							cy: "40",
							r: "8",
							fill: "var(--color-don)",
							stroke: "var(--color-ink)",
							strokeWidth: "4"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "85",
							cy: "40",
							r: "8",
							fill: "var(--color-don)",
							stroke: "var(--color-ink)",
							strokeWidth: "4"
						})
					]
				})
			]
		}), label && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: `animate-pop t-outline font-display text-cream ${small ? "text-2xl" : "text-3xl"}`,
			children: holding ? "그대로 유지!" : "양손 번쩍!"
		}, holding ? "hold" : "idle")]
	});
}
function Practice({ ui, onSkip }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none flex h-full flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex justify-center pt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "t-outline font-display text-6xl text-ka drop-shadow-[0_5px_0_var(--color-ink)]",
					children: "연습"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "t-panel pointer-events-auto mx-4 mb-6 px-5 py-4 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xl",
						children: "점수는 오르지 않아요. 금빛 표적이 뜨면 이마를 노려요!"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm font-bold text-fg-muted",
						children: ui.motionHint
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onSkip,
						className: "t-btn mt-4 h-14 bg-sun px-7 text-xl",
						children: "바로 시작!"
					})
				]
			})
		]
	});
}
function Countdown({ n }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col items-center justify-center gap-6 bg-ink/25",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "animate-pop t-outline font-display text-[11rem] leading-none tabular-nums text-sun drop-shadow-[0_8px_0_var(--color-ink)]",
			children: n > 0 ? n : "시작!"
		}, n), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "t-panel max-w-[80%] px-5 py-3 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-display text-xl",
				style: { wordBreak: "keep-all" },
				children: ["금빛 표적이 뜨면 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "whitespace-nowrap",
					children: "이마 = 크리티컬!"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-fg-muted",
				children: "손을 든 높이로 돌이 날아갑니다"
			})]
		})]
	});
}
/** 태고 북 모양 시계. */
function DrumTimer({ timeLeft }) {
	const sec = Math.ceil(timeLeft);
	const urgent = timeLeft <= 10;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative flex size-24 shrink-0 items-center justify-center rounded-full border-[5px] border-ink shadow-[0_5px_0_var(--color-ink)] ${urgent ? "animate-throb bg-don" : "bg-don"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-[9px] rounded-full border-[4px] border-ink bg-cream" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-[22px] rounded-full bg-[#f6e2bf]" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `relative font-display text-4xl leading-none tabular-nums ${urgent ? "animate-pop text-don" : "text-ink"}`,
				children: sec
			}, urgent ? sec : void 0)
		]
	});
}
function Hud({ ui }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-2 px-3 pt-3 pr-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DrumTimer, { timeLeft: ui.timeLeft }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex-1 rounded-2xl border-[5px] border-ink bg-gradient-to-b from-don to-don-dark px-4 py-1.5 text-right shadow-[0_5px_0_var(--color-ink)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-display text-sm leading-tight text-cream/90",
					children: ["점수 · 크리티컬 ", ui.foreheadHits]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "t-outline-sm font-display text-4xl leading-none tabular-nums text-cream",
					children: ui.score.toLocaleString("ko-KR")
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative h-24",
			children: [
				ui.combo > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "animate-pop absolute top-2 left-4 flex flex-col items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "t-outline font-display text-5xl leading-none tabular-nums text-sun",
						children: ui.combo
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "t-outline-sm font-display text-lg leading-none text-cream",
						children: "콤보"
					})]
				}, ui.combo),
				ui.banner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "animate-pop t-outline absolute inset-x-0 top-3 text-center font-display text-5xl text-cream drop-shadow-[0_5px_0_var(--color-ink)]",
					children: ui.banner
				}, ui.banner),
				ui.freezeLeft > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "absolute inset-x-0 top-20 text-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-full border-4 border-ink bg-ka px-4 py-1 font-display text-lg text-cream",
						children: ["집중 ", ui.freezeLeft.toFixed(1)]
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-5 px-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintPill, { children: ui.motionHint })
		})
	] });
}
function Result({ ui, onNext }) {
	const best = ui.bestScore;
	const isBest = ui.resultRank === 1 && ui.score > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto flex h-full flex-col items-center justify-center overflow-y-auto bg-ink/55 px-5 pt-20 pb-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "t-panel relative w-full px-5 pt-9 pb-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute -top-6 left-1/2 -translate-x-1/2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "inline-block rounded-full border-[5px] border-ink bg-don px-7 py-1.5 font-display text-2xl whitespace-nowrap text-cream",
							children: isBest ? "최고 기록!" : "결과 발표"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "animate-pop t-outline font-display text-7xl leading-none tabular-nums text-sun drop-shadow-[0_6px_0_var(--color-ink)]",
						children: ui.score.toLocaleString("ko-KR")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 font-display text-lg text-fg-muted",
						children: ui.checkMode ? "점검은 기록되지 않습니다" : ui.resultRank > 0 ? `전체 ${ui.resultRank}위` : "순위권 밖"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-4 grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border-4 border-ink bg-sun px-3 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-display text-sm",
								children: "크리티컬"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "font-display text-3xl tabular-nums",
								children: ui.foreheadHits
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border-4 border-ink bg-ka px-3 py-2 text-cream",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "font-display text-sm",
								children: "최대 콤보"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "t-outline-sm font-display text-3xl tabular-nums",
								children: ui.maxCombo
							})]
						})]
					}),
					best > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm font-bold text-fg-muted",
						children: ["역대 최고 ", best.toLocaleString("ko-KR")]
					}),
					ui.freezeFound && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 font-display text-lg text-ka-dark",
						children: "다윗의 프리징을 발견했습니다!"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 w-full",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerseBlock, { ui })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onNext,
				className: "t-btn mt-6 h-16 min-w-56 bg-don px-8 text-2xl text-cream",
				children: "다음 사람"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "t-outline-sm mt-3 text-sm font-bold text-cream",
				children: "자리를 비우면 대기 화면으로 돌아갑니다"
			})
		]
	});
}
var NOSE = 0;
var SHOULDER = [11, 12];
var ELBOW = [13, 14];
var WRIST = [15, 16];
var PINKY = [17, 18];
var INDEX = [19, 20];
var MOTION = {
	/** 이 높이(어깨선 위)부터 장전. */
	cockHeight: -.25,
	/** 손이 몸 뒤로 이만큼(미터) 젖혀져도 장전. */
	cockBackZ: .15,
	/** 장전 후 이 시간 안에 던지지 않으면 풀린다. */
	cockHoldMs: 700,
	/** 투척: 아래로 내리는 속도(s/초)와 꼭대기에서 내려온 거리. */
	releaseDownSpeed: 4,
	releaseDrop: .7,
	/** 투척: 카메라 쪽으로 미는 속도(m/초). */
	releaseForwardSpeed: 1.6,
	/** 장전 없이 크게 휘두른 경우(옆던지기·아래던지기). */
	swingSpeed: 7.5,
	swingTravel: 1.3,
	throwCooldownMs: 420,
	/** 시작 동작: 두 손을 어깨선 위 이만큼(머리 위). */
	handsUpHeight: -.9,
	/** 너무 멀다고 보는 어깨너비(화면 높이 대비). */
	nearScale: .09,
	minScale: .055,
	centerSlack: .28
};
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** 떨림은 줄이고 빠른 움직임은 늦추지 않는 필터. */
var OneEuro = class {
	x = null;
	dx = 0;
	t = 0;
	minCutoff;
	beta;
	dCutoff;
	constructor(minCutoff = 1.4, beta = .7, dCutoff = 1) {
		this.minCutoff = minCutoff;
		this.beta = beta;
		this.dCutoff = dCutoff;
	}
	reset() {
		this.x = null;
		this.dx = 0;
	}
	filter(v, tMs) {
		if (this.x === null) {
			this.x = v;
			this.t = tMs;
			return v;
		}
		const dt = Math.max(.001, (tMs - this.t) / 1e3);
		this.t = tMs;
		const a = (cut) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
		const dv = (v - this.x) / dt;
		this.dx += a(this.dCutoff) * (dv - this.dx);
		const cut = this.minCutoff + this.beta * Math.abs(this.dx);
		this.x += a(cut) * (v - this.x);
		return this.x;
	}
};
var newHand = () => ({
	hist: [],
	ready: false,
	readyT: 0,
	cocked: false,
	lastCockT: 0,
	peakHy: 0,
	peakAim: {
		aimX: 0,
		aimY: 0
	}
});
/** 몸 좌표의 손 위치 → 조준. 손을 든 높이가 세로, 몸이 선 자리와 손의 좌우가 가로. */
function aimFromHand(hxs, hy, bodyX) {
	return {
		aimX: clamp(hxs * .6 + (bodyX - .5) * 2.2, -1, 1),
		aimY: clamp((hy + .35) / .95, -1, 1)
	};
}
var MotionTracker = class {
	hands = [newHand(), newHand()];
	scale = 0;
	presentFrames = 0;
	absentFrames = 0;
	present = false;
	cooldownUntil = 0;
	activeSide = 1;
	fx = new OneEuro();
	fy = new OneEuro();
	reset() {
		this.hands = [newHand(), newHand()];
		this.cooldownUntil = 0;
		this.fx.reset();
		this.fy.reset();
	}
	update(body, t) {
		const none = {
			present: this.present,
			tooFar: false,
			offCenter: false,
			handsUp: false,
			armed: false,
			chestStill: false,
			aim: null,
			throwEvent: null
		};
		if (!body) {
			this.markAbsent();
			none.present = this.present;
			return none;
		}
		const { img, aspect } = body;
		const P = (i) => img[i] ?? {
			x: 0,
			y: 0,
			v: 0
		};
		const ls = P(SHOULDER[0]);
		const rs = P(SHOULDER[1]);
		const rawScale = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
		if (!(ls.v > .4 && rs.v > .4 && rawScale > MOTION.minScale && (P(NOSE).v > .3 || P(23).v > .3))) {
			this.markAbsent();
			none.present = this.present;
			return none;
		}
		this.absentFrames = 0;
		this.presentFrames += 1;
		if (this.presentFrames >= 3) this.present = true;
		this.scale = this.scale > 0 ? this.scale + (rawScale - this.scale) * .25 : rawScale;
		const s = this.scale;
		const cxN = (ls.x + rs.x) / 2;
		const cx = cxN * aspect;
		const cy = (ls.y + rs.y) / 2;
		const z = (i) => body.worldZ?.[i] ?? 0;
		const samples = [0, 1].map((side) => {
			const sh = P(SHOULDER[side]);
			const pt = handPoint(body, side);
			if (!pt) return null;
			return {
				t,
				hx: (pt.X - cx) / s,
				hy: (pt.Y - cy) / s,
				hxs: (pt.X - sh.x * aspect) / s,
				dz: body.worldZ ? pt.z - z(SHOULDER[side]) : 0,
				conf: pt.conf,
				fromWrist: pt.fromWrist
			};
		});
		let throwEvent = null;
		let bestPower = 0;
		for (const side of [0, 1]) {
			const sample = samples[side];
			const hand = this.hands[side];
			if (!sample || sample.conf < .3) {
				if (hand.cocked && t - hand.lastCockT > MOTION.cockHoldMs) hand.cocked = false;
				continue;
			}
			hand.hist.push(sample);
			while (hand.hist.length > 0 && t - hand.hist[0].t > 600) hand.hist.shift();
			const ev = this.stepHand(hand, sample, cxN, t);
			if (ev && ev.power > bestPower) {
				bestPower = ev.power;
				throwEvent = ev;
				this.activeSide = side;
			}
		}
		const [L, R] = samples;
		const handsUp = !!L && !!R && L.fromWrist && R.fromWrist && L.conf > .45 && R.conf > .45 && L.hy < MOTION.handsUpHeight && R.hy < MOTION.handsUpHeight;
		if (handsUp) {
			throwEvent = null;
			for (const h of this.hands) {
				h.cocked = false;
				h.ready = false;
			}
		}
		if (throwEvent) {
			this.cooldownUntil = t + MOTION.throwCooldownMs;
			for (const h of this.hands) h.cocked = false;
		}
		const chestStill = !!L && !!R && L.conf > .5 && R.conf > .5 && Math.abs(L.hx - R.hx) < .55 && Math.abs(L.hy - R.hy) < .45 && L.hy > .1 && L.hy < 1.8 && R.hy > .1 && R.hy < 1.8 && speedOf(this.hands[0].hist) < 1.2 && speedOf(this.hands[1].hist) < 1.2;
		const armed = !handsUp && this.hands.some((h) => h.cocked);
		let side = this.activeSide;
		const cockedSide = this.hands.findIndex((h) => h.cocked);
		if (cockedSide >= 0) side = cockedSide;
		else if (L && R) side = L.hy < R.hy ? 0 : 1;
		else if (L) side = 0;
		else if (R) side = 1;
		this.activeSide = side;
		const h = samples[side];
		let aim = null;
		if (h && h.conf >= .3) {
			const raw = aimFromHand(h.hxs, h.hy, cxN);
			aim = {
				aimX: this.fx.filter(raw.aimX, t),
				aimY: this.fy.filter(raw.aimY, t)
			};
		}
		return {
			present: this.present,
			tooFar: s < MOTION.nearScale,
			offCenter: Math.abs(cxN - .5) > MOTION.centerSlack,
			handsUp,
			armed,
			chestStill,
			aim,
			throwEvent
		};
	}
	markAbsent() {
		this.presentFrames = 0;
		this.absentFrames += 1;
		if (this.absentFrames > 10) {
			this.present = false;
			this.hands = [newHand(), newHand()];
			this.scale = 0;
		}
	}
	stepHand(hand, cur, bodyX, t) {
		if (!hand.ready) {
			if (cur.hy > 0) {
				hand.ready = true;
				hand.readyT = t;
			}
			return null;
		}
		const isCock = cur.hy < MOTION.cockHeight || cur.dz > MOTION.cockBackZ;
		const aimNow = aimFromHand(cur.hxs, cur.hy, bodyX);
		if (isCock) {
			if (!hand.cocked) {
				hand.cocked = true;
				hand.peakHy = cur.hy;
				hand.peakAim = aimNow;
			}
			hand.lastCockT = t;
			if (cur.hy <= hand.peakHy) {
				hand.peakHy = cur.hy;
				hand.peakAim = aimNow;
			}
		} else if (hand.cocked && t - hand.lastCockT > MOTION.cockHoldMs) hand.cocked = false;
		if (t < this.cooldownUntil) return null;
		const v = velocity(hand.hist, .05);
		if (!v) return null;
		if (hand.cocked) {
			const drop = cur.hy - hand.peakHy;
			const down = v.vy > MOTION.releaseDownSpeed && drop > MOTION.releaseDrop;
			const forward = v.vdz < -MOTION.releaseForwardSpeed && drop > .3;
			if (down || forward) {
				const strength = Math.max(v.vy / 10, -v.vdz / 4, Math.hypot(v.vx, v.vy) / 11);
				hand.cocked = false;
				return {
					...hand.peakAim,
					power: clamp(.45 + strength * .55, .45, 1)
				};
			}
			return null;
		}
		const speed = Math.hypot(v.vx, v.vy);
		const settled = t - hand.readyT > 400;
		const notUpward = v.vy > -2;
		if (settled && notUpward && speed > MOTION.swingSpeed && travelOf(hand.hist, .25) > MOTION.swingTravel) return {
			...aimNow,
			power: clamp(.45 + speed / 12 * .55, .45, 1)
		};
		return null;
	}
};
/** 손 위치: 손목·새끼·검지 평균. 너무 빨라 손이 번지면 팔꿈치 방향으로 짐작한다. */
function handPoint(body, side) {
	const { img, aspect } = body;
	const z = (i) => body.worldZ?.[i] ?? 0;
	let sw = 0;
	let sx = 0;
	let sy = 0;
	let sz = 0;
	let best = 0;
	for (const i of [
		WRIST[side],
		PINKY[side],
		INDEX[side]
	]) {
		const p = img[i];
		if (!p || p.v < .3) continue;
		const w = i === WRIST[side] ? p.v * 1.5 : p.v;
		sw += w;
		sx += p.x * aspect * w;
		sy += p.y * w;
		sz += z(i) * w;
		best = Math.max(best, p.v);
	}
	if (sw >= .45) return {
		X: sx / sw,
		Y: sy / sw,
		z: sz / sw,
		conf: best,
		fromWrist: true
	};
	const e = img[ELBOW[side]];
	const sh = img[SHOULDER[side]];
	if (!e || !sh || e.v < .4 || sh.v < .4) return null;
	const k = .85;
	return {
		X: (e.x + (e.x - sh.x) * k) * aspect,
		Y: e.y + (e.y - sh.y) * k,
		z: z(ELBOW[side]) + (z(ELBOW[side]) - z(SHOULDER[side])) * k,
		conf: e.v * .6,
		fromWrist: false
	};
}
/** 최근 window초 사이 속도(s/초, m/초). */
function velocity(hist, window) {
	if (hist.length < 2) return null;
	const cur = hist[hist.length - 1];
	let ref = null;
	for (let i = hist.length - 2; i >= 0; i--) if (cur.t - hist[i].t >= window * 1e3) {
		ref = hist[i];
		break;
	}
	if (!ref) return null;
	const dt = (cur.t - ref.t) / 1e3;
	if (dt > .25) return null;
	return {
		vx: (cur.hx - ref.hx) / dt,
		vy: (cur.hy - ref.hy) / dt,
		vdz: (cur.dz - ref.dz) / dt
	};
}
function speedOf(hist) {
	const v = velocity(hist, .1);
	return v ? Math.hypot(v.vx, v.vy) : 0;
}
function travelOf(hist, window) {
	if (hist.length < 2) return 0;
	const cur = hist[hist.length - 1];
	let d = 0;
	for (let i = hist.length - 1; i > 0; i--) {
		if (cur.t - hist[i - 1].t > window * 1e3) break;
		d += Math.hypot(hist[i].hx - hist[i - 1].hx, hist[i].hy - hist[i - 1].hy);
	}
	return d;
}
var EMPTY = {
	present: false,
	handsUp: false,
	throwEvent: null,
	skeleton: null,
	armed: false,
	chestStill: false,
	aim: null,
	tooFar: false,
	offCenter: false
};
/** 초당 추론 횟수 상한. 빠른 팔 동작을 놓치지 않을 만큼. */
var INFER_MS = 30;
/** 추론용으로 줄인 영상의 긴 변. 멀리 선 아이의 손목까지 보이게. */
var INFER_LONG = 480;
var PoseController = class {
	video = null;
	status = "off";
	poseReady = false;
	modelError = null;
	error = null;
	landmarker = null;
	stream = null;
	disconnected = false;
	motion = new MotionTracker();
	lastTs = 0;
	lastInfer = 0;
	inferCanvas = null;
	present = false;
	lastFrame = EMPTY;
	resetMotion() {
		this.motion.reset();
	}
	hasStream() {
		return Boolean(this.stream);
	}
	trackLive() {
		const track = this.stream?.getVideoTracks()[0];
		return Boolean(track && track.readyState === "live");
	}
	takeDisconnect() {
		const track = this.stream?.getVideoTracks()[0];
		if (this.status === "live" && track && track.readyState === "ended") this.disconnected = true;
		if (!this.disconnected) return false;
		this.disconnected = false;
		this.status = "off";
		this.poseReady = false;
		this.present = false;
		this.motion.reset();
		this.lastFrame = EMPTY;
		return true;
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
			this.poseReady = false;
			this.modelError = null;
			return;
		}
		await this.loadModel();
	}
	async loadModel() {
		if (this.status !== "live") return;
		this.poseReady = false;
		this.modelError = null;
		this.landmarker?.close?.();
		this.landmarker = null;
		try {
			const vision = await import("../_libs/mediapipe__tasks-vision.mjs").then((n) => n.t);
			const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
			const opts = {
				baseOptions: {
					modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
					delegate: "GPU"
				},
				runningMode: "VIDEO",
				numPoses: 2,
				minPoseDetectionConfidence: .5,
				minPosePresenceConfidence: .5,
				minTrackingConfidence: .5
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
			this.modelError = null;
		} catch {
			this.landmarker = null;
			this.poseReady = false;
			this.modelError = "카메라는 켜졌지만 모션을 준비하지 못했습니다. 아래 다시 시도를 눌러 주세요.";
		}
	}
	async openCamera(video) {
		this.stopStream();
		if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(/* @__PURE__ */ new Error("unsupported"), { name: "SecurityError" });
		video.setAttribute("playsinline", "true");
		video.setAttribute("autoplay", "true");
		video.muted = true;
		video.playsInline = true;
		const tries = [
			{
				audio: false,
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					frameRate: { ideal: 30 },
					facingMode: "user"
				}
			},
			{
				audio: false,
				video: true
			},
			{
				audio: false,
				video: { facingMode: { ideal: "user" } }
			}
		];
		let lastErr = null;
		for (const constraints of tries) try {
			const stream = await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 12e3);
			this.stream = stream;
			video.srcObject = stream;
			stream.getVideoTracks().forEach((track) => {
				track.onended = () => {
					this.disconnected = true;
				};
			});
			await playVideo(video);
			return;
		} catch (err) {
			lastErr = err;
			const name = errorName(err);
			if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") throw err;
		}
		throw lastErr ?? Object.assign(/* @__PURE__ */ new Error("camera"), { name: "NotFoundError" });
	}
	stopStream() {
		this.stream?.getTracks().forEach((t) => {
			t.onended = null;
			t.stop();
		});
		this.stream = null;
		if (this.video) this.video.srcObject = null;
	}
	stop() {
		this.landmarker?.close?.();
		this.landmarker = null;
		this.stopStream();
		this.status = "off";
		this.poseReady = false;
		this.modelError = null;
	}
	tick(now) {
		const video = this.video;
		if (!video || video.readyState < 2 || !this.landmarker) {
			this.motion.reset();
			this.present = false;
			this.lastFrame = EMPTY;
			return this.lastFrame;
		}
		if (now - this.lastInfer < INFER_MS && this.lastFrame.skeleton) return {
			...this.lastFrame,
			throwEvent: null
		};
		this.lastInfer = now;
		const ts = now <= this.lastTs ? this.lastTs + 1 : now;
		this.lastTs = ts;
		const source = this.inferSource(video);
		const aspect = source.width && source.height ? source.width / source.height : 4 / 3;
		let poses = [];
		let worlds = [];
		try {
			const result = this.landmarker.detectForVideo(source, ts);
			poses = result.landmarks ?? [];
			worlds = result.worldLandmarks ?? [];
		} catch {
			this.lastFrame = {
				...EMPTY,
				present: this.present
			};
			return this.lastFrame;
		}
		const pick = pickMain(poses, aspect);
		if (pick < 0) {
			const m = this.motion.update(null, now);
			this.present = m.present;
			this.lastFrame = {
				...EMPTY,
				present: m.present
			};
			return this.lastFrame;
		}
		const raw = poses[pick];
		const world = worlds[pick];
		const img = raw.map((p) => ({
			x: 1 - p.x,
			y: p.y,
			v: p.visibility ?? 1
		}));
		const input = {
			t: now,
			aspect,
			img,
			worldZ: world ? world.map((p) => p.z) : null
		};
		const m = this.motion.update(input, now);
		this.present = m.present;
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
		].map((i) => img[i]);
		this.lastFrame = {
			present: m.present,
			handsUp: m.handsUp,
			throwEvent: m.throwEvent,
			skeleton,
			armed: m.armed,
			chestStill: m.chestStill,
			aim: m.aim,
			tooFar: m.tooFar,
			offCenter: m.offCenter
		};
		return this.lastFrame;
	}
	/** 영상 비율을 그대로 둔 채 줄인다. 찌그러진 영상은 관절을 틀리게 읽는다. */
	inferSource(video) {
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (vw < 2 || vh < 2) return video;
		const k = Math.min(1, INFER_LONG / Math.max(vw, vh));
		const w = Math.round(vw * k);
		const h = Math.round(vh * k);
		if (!this.inferCanvas) this.inferCanvas = document.createElement("canvas");
		if (this.inferCanvas.width !== w || this.inferCanvas.height !== h) {
			this.inferCanvas.width = w;
			this.inferCanvas.height = h;
		}
		const ctx = this.inferCanvas.getContext("2d");
		if (!ctx) return video;
		ctx.drawImage(video, 0, 0, w, h);
		return this.inferCanvas;
	}
};
/** 여러 명이 잡히면 어깨가 가장 넓은(가장 가까운) 사람, 비슷하면 가운데 사람. */
function pickMain(poses, aspect) {
	let best = -1;
	let bestScore = 0;
	poses.forEach((p, i) => {
		const ls = p[11];
		const rs = p[12];
		if (!ls || !rs || (ls.visibility ?? 1) < .4 || (rs.visibility ?? 1) < .4) return;
		const score = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y) - Math.abs((ls.x + rs.x) / 2 - .5) * .08;
		if (score > bestScore) {
			bestScore = score;
			best = i;
		}
	});
	return best;
}
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
function syncPose(g, pose) {
	if (!g) return;
	if (pose.status === "denied") {
		g.setReadiness("denied", pose.error, "off", null);
		return;
	}
	if (pose.status !== "live") {
		g.setReadiness(pose.status === "loading" ? "loading" : "off", null, "off", null);
		return;
	}
	if (pose.poseReady) g.setReadiness("live", null, "ready", null);
	else if (pose.modelError) g.setReadiness("live", null, "failed", pose.modelError);
	else g.setReadiness("live", null, "loading", null);
}
var initialUi = () => ({
	phase: "boot",
	score: 0,
	combo: 0,
	maxCombo: 0,
	timeLeft: 30,
	countdown: 3,
	verse: VERSES[0],
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
	modelState: "off",
	modelError: null,
	armed: false,
	cameraError: null,
	foreheadHits: 0,
	comboLeft: 0,
	bestScore: 0,
	freezeLeft: 0,
	freezeCd: 0,
	freezeFound: false,
	inputVia: "webcam",
	checkMode: false,
	handsUpProgress: 0
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
	const [showVideo, setShowVideo] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		setShowVideo(new URLSearchParams(window.location.search).get("camera") !== "0");
	}, []);
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
		let lastPhase = game.phase;
		let throwFlashUntil = 0;
		const loop = (now) => {
			raf = requestAnimationFrame(loop);
			const video = videoRef.current;
			if (pose.takeDisconnect()) game.setReadiness("off", null, "off", null);
			if (video && (pose.status === "live" || pose.hasStream())) {
				const frame = pose.status === "live" ? pose.tick(now) : pose.lastFrame;
				if (pose.poseReady) game.notePose(frame);
				const pip = pipRef.current;
				if (pip) {
					const pctx = pip.getContext("2d");
					if (frame.throwEvent) throwFlashUntil = now + 450;
					const flash = Math.max(0, (throwFlashUntil - now) / 450);
					if (pctx) drawPip(pctx, video, frame.skeleton, frame.present, frame.armed, flash);
				}
			}
			if (game.phase !== lastPhase) {
				if (game.phase === "practice" || game.phase === "attract") pose.resetMotion();
				lastPhase = game.phase;
			}
			game.update(now);
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
		const onDown = (e) => {
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
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);
		const onVis = () => {
			if (document.visibilityState === "visible") audio.unlock();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
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
		g?.setReadiness("loading", null, "off", null);
		try {
			await pose.start(video, () => {
				g?.setReadiness("live", null, "loading", null);
			});
			syncPose(g, pose);
		} catch {
			pose.status = "denied";
			g?.setReadiness("denied", "카메라를 켜지 못했습니다. 다시 시도해 주세요.", "off", null);
		} finally {
			startingRef.current = false;
		}
	};
	const retryMotion = async () => {
		const g = gameRef.current;
		const pose = poseRef.current;
		if (!pose || pose.status !== "live") {
			await startCamera();
			return;
		}
		if (startingRef.current) return;
		startingRef.current = true;
		g?.setReadiness("live", null, "loading", null);
		try {
			await pose.loadModel();
			syncPose(g, pose);
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
	const pipLow = ui.phase === "play" || ui.phase === "practice" || ui.phase === "countdown";
	const pipLabel = ui.modelState === "failed" ? "모션 실패" : ui.modelState === "loading" || ui.cameraState === "loading" ? "준비 중" : !ui.personPresent ? "어디 있나요?" : ui.armed && pipLow ? "던질 준비!" : "인식됨";
	const showPip = ui.cameraState === "live" || ui.cameraState === "loading" ? ui.phase === "attract" || ui.phase === "start" || ui.phase === "practice" || ui.phase === "countdown" || ui.phase === "play" : false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-dvh w-full items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: wrapRef,
			className: "relative overflow-hidden bg-bg touch-manipulation select-none",
			style: {
				width: "min(100dvw, calc(100dvh * 9 / 16))",
				height: "min(100dvh, calc(100dvw * 16 / 9))"
			},
			"data-phase": ui.phase,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "absolute inset-0 size-full touch-none"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `pointer-events-none absolute z-10 transition-opacity ${pipLow ? "top-[34%] left-3" : "top-[40%] left-3"} ${showPip ? "opacity-100" : "opacity-0"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative h-28 w-36 overflow-hidden rounded-2xl border-[5px] border-ink bg-ink shadow-[0_5px_0_var(--color-ink)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
							ref: videoRef,
							className: "absolute inset-0 size-full object-cover",
							style: {
								transform: "scaleX(-1)",
								opacity: showVideo ? 1 : 0
							},
							playsInline: true,
							muted: true,
							autoPlay: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: pipRef,
							width: 288,
							height: 224,
							className: "absolute inset-0 size-full"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `relative mx-auto -mt-3 w-fit rounded-full border-[3px] border-ink px-2.5 py-0.5 text-center font-display text-xs whitespace-nowrap ${ui.armed && pipLow ? "bg-don text-cream" : ui.personPresent ? "bg-sun text-ink" : "bg-cream text-ink"}`,
						children: pipLabel
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlays, {
					ui,
					onBegin: begin,
					onStart: () => {
						const g = gameRef.current;
						if (!g) return;
						if (g.cameraState !== "live") startCamera();
						g.pressStart();
					},
					onRetryCamera: () => void startCamera(),
					onRetryMotion: () => void retryMotion(),
					onOpenWindow: openNewWindow,
					onSkipPractice: () => gameRef.current?.skipPractice(),
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
