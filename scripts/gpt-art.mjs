// 코덱스(GPT)로 만든 그림을 앱에서 쓰는 파일로 다듬는다:  node scripts/gpt-art.mjs <그림 폴더>
// (table.png = 나무 작업대 윗면도 같은 폴더에)
// 폴더에는 street.png(맞춤패션거리 풍경) · atelier.png(의상실 벽) · tailor.png(손 흔드는 재단사) · tailor2.png(양손 번쩍 재단사).
// 배경 둘은 크기만 줄이고, 캐릭터 둘은 흰 배경을 가장자리에서부터 지워 투명하게 만든다. 결과는 public/art/.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const dir = process.argv[2];
if (!dir) throw new Error("그림 폴더를 알려 주세요");
const JOBS = [
  ["street", "street", 1600, false],
  ["atelier", "atelier", 1600, false],
  ["tailor", "tailor-hi", 720, true],
  ["tailor2", "tailor-up", 720, true],
  // 나무 작업대 윗면: 원본은 주황이 너무 진해 놀잇감보다 튄다. 채도를 낮추고 조금 밝게
  ["table", "table", 1280, false, "saturate(0.5) brightness(1.06)"],
];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
for (const [src, out, width, cut, filter] of JOBS) {
  const url = `data:image/png;base64,${readFileSync(join(dir, `${src}.png`)).toString("base64")}`;
  const data = await page.evaluate(
    async ({ url, width, cut, filter }) => {
      const im = new Image();
      im.src = url;
      await im.decode();
      const w = width;
      const h = Math.round((im.naturalHeight * w) / im.naturalWidth);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      if (filter) x.filter = filter;
      x.drawImage(im, 0, 0, w, h);
      if (cut) {
        // 가장자리에서 이어진 흰 바탕만 지운다(셔츠처럼 안쪽의 밝은 색은 남는다)
        const d = x.getImageData(0, 0, w, h);
        const p = d.data;
        const white = (i) => p[i] > 238 && p[i + 1] > 238 && p[i + 2] > 238;
        const seen = new Uint8Array(w * h);
        const st = [];
        for (let i = 0; i < w; i++) st.push(i, (h - 1) * w + i);
        for (let j = 0; j < h; j++) st.push(j * w, j * w + w - 1);
        while (st.length) {
          const k = st.pop();
          if (seen[k] || !white(k * 4)) continue;
          seen[k] = 1;
          p[k * 4 + 3] = 0;
          const px = k % w;
          if (px > 0) st.push(k - 1);
          if (px < w - 1) st.push(k + 1);
          if (k >= w) st.push(k - w);
          if (k < w * (h - 1)) st.push(k + w);
        }
        // 지운 자리와 맞닿은 밝은 테두리는 반투명하게(흰 띠가 남지 않게)
        for (let k = 0; k < w * h; k++) {
          if (seen[k]) continue;
          const near = (k % w > 0 && seen[k - 1]) || (k % w < w - 1 && seen[k + 1]) || (k >= w && seen[k - w]) || (k < w * (h - 1) && seen[k + w]);
          if (near && p[k * 4] > 215 && p[k * 4 + 1] > 215 && p[k * 4 + 2] > 215) p[k * 4 + 3] = 90;
        }
        x.putImageData(d, 0, 0);
      }
      return c.toDataURL("image/webp", cut ? 0.9 : 0.82);
    },
    { url, width, cut, filter },
  );
  const buf = Buffer.from(data.split(",")[1], "base64");
  writeFileSync(`public/art/${out}.webp`, buf);
  console.log(out, buf.length);
}
await browser.close();
