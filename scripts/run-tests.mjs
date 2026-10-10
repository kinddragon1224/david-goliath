#!/usr/bin/env node
/**
 * npm test 진입점. 윈도우·맥·리눅스 어디서나 같은 결과가 나오게 node로 돌린다.
 *
 * grok-pwa-plugin.test.mjs는 앱 빌더 템플릿 기본값("Wild Race")을 기준으로 쓰였고,
 * 따로 지정하지 않으면 현재 폴더의 src/lib/og/site.json·public/og.jpg를 읽는다.
 * 프로젝트 폴더에서 돌리면 이 게임의 실제 공유 카드 설정을 읽어 8개가 실패하므로,
 * 그 파일만 빈 임시 폴더에서 돌린다. 플랫폼 파일 자체는 고치지 않는다.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ISOLATED = "grok-pwa-plugin.test.mjs";
const scriptTests = readdirSync(join(root, "scripts"))
  .filter((f) => f.endsWith(".test.mjs") && f !== ISOLATED)
  .map((f) => join(root, "scripts", f));

const runs = [
  { name: "scripts", cwd: root, args: ["--test", ...scriptTests] },
  { name: "grok-pwa (빈 폴더)", cwd: null, args: ["--test", join(root, "scripts", ISOLATED)] },
  {
    name: "app",
    cwd: root,
    args: [
      "--experimental-strip-types",
      "--test",
      "src/lib/app-data/app-data.test.ts",
      "src/lib/app-data/readiness-schedule.test.ts",
      "src/lib/auth/gate-identity.test.ts",
      "src/lib/auth/sign-in-gate.test.ts",
      "src/game/motion.test.ts",
      "src/game/hangul.test.ts",
    ],
  },
];

let failed = 0;
for (const run of runs) {
  const cwd = run.cwd ?? mkdtempSync(join(tmpdir(), "dg-test-"));
  const r = spawnSync(process.execPath, run.args, { cwd, stdio: "inherit" });
  if (!run.cwd) rmSync(cwd, { recursive: true, force: true });
  if (r.status !== 0) {
    failed += 1;
    console.error(`\n✖ ${run.name} 시험 실패`);
  }
}
process.exit(failed ? 1 : 0);
