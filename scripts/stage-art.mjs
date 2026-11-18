// 체험 무대의 벽 그림(public/art/iron|scissors|sewing|rhythm.webp)을 룩북 사진으로 다시 만든다.
//   node scripts/stage-art.mjs <룩북 사진 폴더>
// 사진 폴더: 드라이브 "2026 청년마을 위브온중촌 룩북사진&퍼포먼스 필름 납품 / 룩북 이미지"의 사진을
// 가로 1600 으로 줄여 <브랜드><번호>.jpg 로 둔 것(eco1.jpg, seolbaek4.jpg …). 원본 사진은 저장소에 넣지 않는다.
// 그림: 광목 벽에 룩북 사진을 시침핀으로 꽂아 둔 모습. 사진은 쪽빛으로 물들여(가운데 게임 그림이 묻히지 않게) 양옆에만 둔다.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const dir = process.argv[2];
if (!dir) throw new Error("사진 폴더를 알려 주세요: node scripts/stage-art.mjs <폴더>");

// [사진, x, y, 너비, 높이, 기울기(도), 확대, 초점 x, 초점 y]
const L1 = [30, 36, 196, 286, -3];
const L2 = [64, 344, 178, 258, 4];
const R1 = [1054, 36, 196, 286, 3];
const R2 = [1038, 344, 178, 258, -4];
const WALLS = {
  iron: [["seolbaek4", ...L1, 1.2, 0.5, 0.55], ["restitch3", ...L2, 1.5, 0.5, 0.62], ["silua2", ...R1, 1.25, 0.5, 0.52], ["tailoring3", ...R2, 1.15, 0.5, 0.55]],
  scissors: [["tailoring6", ...L1, 1.3, 0.5, 0.55], ["eco3", ...L2, 1.05, 0.5, 0.5], ["lumino2", ...R1, 1.1, 0.5, 0.5], ["seolbaek2", ...R2, 1.3, 0.5, 0.55]],
  sewing: [["restitch5", ...L1, 1.45, 0.5, 0.58], ["silua6", ...L2, 1.4, 0.5, 0.6], ["seolbaek3", ...R1, 1.3, 0.5, 0.55], ["lumino6", ...R2, 1.15, 0.5, 0.55]],
  rhythm: ["eco3","lumino3", "seolbaek5", "tailoring4", "silua5", "restitch2"].map((n, i) => [n, 44 + i * 204, i % 2 ? 150 : 96, 172, 252, (i % 2 ? 1 : -1) * 3, 1.25, 0.5, 0.55]),
};

const data = {};
for (const wall of Object.values(WALLS))
  for (const [name] of wall) data[name] ??= `data:image/jpeg;base64,${readFileSync(join(dir, `${name}.jpg`)).toString("base64")}`;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const out = await page.evaluate(
  async ({ WALLS, data }) => {
    const W = 1280;
    const H = 720;
    const imgs = {};
    for (const [k, src] of Object.entries(data)) {
      const im = new Image();
      im.src = src;
      await im.decode();
      imgs[k] = im;
    }
    // 사진 한 장을 군청빛으로 물들인다: 밝기를 짙은 군청~옅은 하늘빛에 맞추고, 옷 색은 조금만 남긴다
    const tint = (im, w, h, zoom, fx, fy) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      const k = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom;
      const dw = im.naturalWidth * k;
      const dh = im.naturalHeight * k;
      x.drawImage(im, Math.min(0, Math.max(w - dw, w / 2 - dw * fx)), Math.min(0, Math.max(h - dh, h / 2 - dh * fy)), dw, dh);
      const d = x.getImageData(0, 0, w, h);
      const p = d.data;
      const lo = [6, 36, 59];
      const hi = [214, 226, 234];
      for (let i = 0; i < p.length; i += 4) {
        const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
        for (let j = 0; j < 3; j++) p[i + j] = (lo[j] + (hi[j] - lo[j]) * l) * 0.6 + p[i + j] * 0.4;
      }
      x.putImageData(d, 0, 0);
      return c;
    };
    const res = {};
    for (const [name, wall] of Object.entries(WALLS)) {
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      // 광목 벽(밝고 흐리게: 놀이판보다 눈에 덜 띄어야 한다). 색은 src/fashion/core.ts 의 WALL 과 같게
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#ebe4d4");
      g.addColorStop(1, "#ddd3bf");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // 광목의 올(아주 옅게)
      ctx.strokeStyle = "rgba(120,100,70,0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 6) ctx.strokeRect(x, -2, 0, H + 4);
      for (let y = 0; y < H; y += 6) ctx.strokeRect(-2, y, W + 4, 0);
      // 바닥 걸레받이 한 줄
      const fy = 640;
      ctx.fillStyle = "#cdbfa4";
      ctx.fillRect(0, fy, W, H - fy);
      ctx.fillStyle = "rgba(90,70,40,0.18)";
      ctx.fillRect(0, fy, W, 3);
      // 룩북 사진: 종이 테두리 + 그림자 + 주황 시침핀
      for (const [n, x, y, w, h, rot, zoom, fx, fy2] of wall) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.shadowColor = "rgba(70,50,20,0.3)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#f8f5ee";
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.shadowColor = "transparent";
        ctx.drawImage(tint(imgs[n], w - 14, h - 14, zoom, fx, fy2), -w / 2 + 7, -h / 2 + 7);
        ctx.fillStyle = "#ff8822";
        ctx.strokeStyle = "#7a3a08";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -h / 2 + 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      res[name] = cv.toDataURL("image/webp", 0.84);
    }
    return res;
  },
  { WALLS, data },
);
await browser.close();
for (const [name, url] of Object.entries(out)) {
  const buf = Buffer.from(url.split(",")[1], "base64");
  writeFileSync(`public/art/${name}.webp`, buf);
  console.log(name, buf.length);
}
