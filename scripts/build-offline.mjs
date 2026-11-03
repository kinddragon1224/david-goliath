#!/usr/bin/env node
/**
 * 오프라인 설치판 만들기
 *   npm run build:offline             → 모두애교회판 (--edition=church)
 *   npm run build:offline:general     → 행사장판, 교회·성경 말씀 없음 (--edition=general)
 *   npm run build:offline:weaveon     → 위브온페스티벌판 (--edition=weaveon)
 * 결과: dist-offline/DavidGoliath/ (그대로 복사해 쓰는 폴더)
 *       dist-offline/DavidGoliath-<판>-v<버전>.zip (전달용)
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist-offline");
const pkg = join(out, "DavidGoliath");
const app = join(pkg, "app");

const editionArg = process.argv.find((a) => a.startsWith("--edition="))?.split("=")[1] ?? "church";
const EDITIONS = {
  church: { title: "다윗과 골리앗 · 모두애침례교회", assets: ["logo-alllove.jpg"] },
  general: { title: "다윗과 골리앗 · 모션 돌 던지기", assets: [] },
  weaveon: { title: "다윗과 골리앗 · 위브온페스티벌", assets: [] },
};
const edition = EDITIONS[editionArg];
if (!edition) throw new Error(`알 수 없는 판: ${editionArg} (church | general | weaveon)`);

const version = /APP_VERSION = "([^"]+)"/.exec(readFileSync(join(root, "src/game/constants.ts"), "utf8"))?.[1];
if (!version) throw new Error("APP_VERSION not found in src/game/constants.ts");

// 이 판의 폴더만 지운다(다른 판의 압축 파일은 남긴다)
rmSync(pkg, { recursive: true, force: true });
execSync("npx vite build --config offline/vite.config.ts", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_EDITION: editionArg, VITE_APP_TITLE: edition.title },
});

// 게임이 쓰는 정적 파일만 (예전 스프라이트, 배포용 이미지는 뺀다)
// voice(안내 음성)·art(배경 그림)·brand(옷 사진)는 /voice/… 처럼 절대 경로로 불러서 꼭 같이 넣는다
for (const f of [
  "mediapipe",
  "therumen-logo.png",
  "favicon.svg",
  "voice",
  "art",
  "brand",
  ...edition.assets,
]) {
  cpSync(join(root, "public", f), join(app, f), { recursive: true });
}
writeFileSync(join(app, "version.txt"), `${version}\n`);

// 실행 파일과 안내서. 윈도우용이라 줄바꿈은 CRLF, 한글 안내서는 BOM을 붙인다.
const kiosk = join(root, "offline/kiosk");
for (const f of readdirSync(kiosk)) {
  const text = readFileSync(join(kiosk, f), "utf8")
    .replaceAll("{{APP_NAME}}", edition.title)
    .replace(/\r?\n/g, "\r\n");
  const bom = f.endsWith(".txt") ? "\ufeff" : "";
  writeFileSync(join(pkg, f), bom + text);
}
writeFileSync(join(pkg, "version.txt"), `${version} (${editionArg})\r\n`);

// 압축: 한글 파일 이름이 윈도우에서 깨지지 않게 UTF-8 표시를 켜는 python zipfile 사용
const zip = join(out, `DavidGoliath-${editionArg}-v${version}.zip`);
execSync(
  `python3 -c "import os,sys,zipfile
src, dst = sys.argv[1], sys.argv[2]
base = os.path.dirname(src)
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, base))
" "${pkg}" "${zip}"`,
  { stdio: "inherit" },
);
if (!existsSync(zip)) throw new Error("zip failed");
console.log(`\n오프라인 설치판 ${editionArg} v${version}\n  폴더: ${pkg}\n  압축: ${zip}`);
