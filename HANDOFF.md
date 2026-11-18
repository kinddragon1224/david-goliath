# 인수인계 (2026-11-18 기준)

새 세션은 이 파일을 먼저 읽고 이어서 작업한다. 대화 기록은 넘어오지 않는다.

## 프로젝트
- 위브온페스티벌(행정안전부 청년마을 사업 피날레) AX 체험 6종. 납품: 더루멘(THE RUMEN)
- **본 행사: 11/20(금) 14~18시**, 중촌동 맞춤패션 플랫폼
- 협력 로고: WEAVE ON 중촌 · 청년마을 · BARGIUM · THE RUMEN (`public/brand/logo-*.png`, `public/therumen-logo.png`)
- 체험: 01 가상 착장 · 02 다윗과 골리앗 · 03 다리미 · 04 가위질 · 05 바느질 · 06 몽글 드럼

## 현장 기기 (11/18 계획)
- 태블릿 3대 · 미니 PC 2대 · 노트북 1대. **모두 가로 화면.** 520 그래픽 PC는 안 쓰기로 함
- 무거운 게임(골리앗·몽글 드럼)은 노트북·미니 PC에, 태블릿엔 가상 착장·다리미·바느질 권장
- 태블릿은 아직 실기기 시험 안 함: 크롬으로 열기, 화면 꺼짐 끄기, 충전기 연결, 2~3m 떨어져 몸 전체가 잡히는지 확인
- PC 한 대에 TV 두 대(HDMI 두 개, "확장" 모드)도 가능:
  - 창마다 카메라: 주소에 `?cam=1` / `?cam=2`
  - 소리 나누기: 가장 확실한 건 **한 게임은 크롬, 다른 게임은 엣지**로 띄우고 윈도우 볼륨 믹서에서 앱별 출력 장치 지정
  - `?spk=TV이름`(코드로 출력 장치 고르기)은 실기기 미검증. 크롬이 마이크 권한 없이 스피커 이름을 안 줄 수 있음

## 두 저장소
### 1) 게임: `C:\Users\sunyo\Documents\david-goliath` (이 폴더)
- 사이트: https://wvn.vercel.app (`/version.txt`로 배포 버전 확인). **main에 push하면 Vercel 배포 + GitHub Actions로 APK·zip 빌드**
- 지금 배포된 버전: **v1.15.0** (`src/game/constants.ts`의 `APP_VERSION`)
- **배포 안 된 로컬 커밋:** `e60611a` 약한 PC(HD 520)용 카메라 15장/초 · 화면 70% 크기. 520을 안 쓰기로 해서 급하지 않음(4스레드 이하 PC에서만 켜짐)
- 구조
  - `src/app/Root.tsx`: 첫 화면 분기. `?game=goliath|iron|scissors|sewing|rhythm`
  - `src/fashion/StationPicker.tsx`: 홈(체험 고르기) 화면. 로고·고르는 법 3단계·하단 로고 띠
  - `src/fashion/stations.ts`: 체험 목록, 가상 착장 연결(studio.therumen.kr)
  - `src/fashion/core.ts`: 패션 게임 공통 엔진. 플레이어가 5초 안 보이면 결과 없이 홈으로(`ABSENT_END`)
  - `src/game/*`: 다윗과 골리앗, 공통 인식(`pose.ts`), 약한 PC 판별(`perf.ts`, `?lite=1|0`로 강제), 키오스크(`kiosk.ts`)
- **커밋 안 된 화면 수정(11/18, 실기기 미검증):**
  - 체험 4종 대기 화면(`src/fashion/FashionApp.tsx`의 `AttractOverlay`): 제목·문구 카드를 한 장으로 합치고, 간판 7초(시범을 어둡게 덮음) ↔ 시범 7초(카드 숨김)로 번갈아 보인다
  - 홈(`src/fashion/StationPicker.tsx`): 칸을 화면 위 70%에만 두고 아래 30%(`REST`)는 버튼 없는 쉬는 자리. 칸은 손을 1.5초(`PICK_HOLD`) 올려야 고른다. 다른 버튼은 그대로 1초(`src/app/HandCursor.tsx`, 버튼에 `data-hold`를 적으면 그 버튼만 바뀜)
- 확인: `npx tsc --noEmit`, `npm test` (윈도우에서는 scripts 의 symlink 시험 2개가 원래 실패한다)
- 미리보기: `$env:VITE_EDITION='weaveon'; npm run dev` → http://localhost:8080/
- 커밋할 때 파일을 골라서 add. **`.vercel/output`, `src/routeTree.gen.ts`, `.claude/`는 올리지 않는다**

### 2) 가상 착장: `C:\Users\sunyo\weaveon\vton`
- 이 PC에서 돈다: `server\server.py`(FastAPI), Cloudflare 터널로 https://studio.therumen.kr, 화면은 `/app`
- 화면 `app\`은 빌드된 번들만 있음(소스 없음). 고칠 땐 node 스크립트로 정확한 문자열을 바꿔 **새 파일**로 쓰고 `index.html`이 그 파일을 가리키게 한다. 원본 `-b.js`는 건드리지 않음
- 현재: `app\assets\vton-DRvWkagp-d.js` (대기 놀이: 룩북 잡기 + 몸을 노리는 바늘 피하기). 되돌리기용 백업 `index.html.bak1116needle`(원본), `index.html.bak1116needle2`
- 바늘 조절값: 나오는 비율 `.4`, 속도 `1.9`배. 실제 부스 시험 후 조절 필요
- 접속 PIN은 유료 AI 생성 보호용(한 번 입력하면 30일 유지). PIN·KEY·토큰은 `booth.ini`/`UNLOCK_URL.txt`에 있고 **절대 출력·공유하지 않는다**
- 이 저장소는 git push 하지 않음. 바꾸기 전에 `.bak날짜` 백업. 추가 유료 API 쓰지 않음. 룩북 사진은 로컬에만

### 3) 꿈돌이 운석 피하기 「대전 AX 2026」 사본: `games/daejeon-ax` (11/18 추가, 커밋·배포 전)
- 원본은 `C:\Users\sunyo\Desktop\꿈돌이 운석 피하기 시연용`(Vercel `daejeon-ax-2026`, 따로 배포). 여기는 **복사본**이라 원본을 고쳐도 자동으로 따라오지 않는다
- 따로 도는 Vite + Three.js 프로젝트(자기 `package.json`·`node_modules`). 이 저장소의 `tsc`·`npm test`·빌드와 섞이지 않는다
- 들어가는 법: 개발 서버를 켜고 http://localhost:8080/daejeon-ax/index.html (`/daejeon-ax/`만 치면 개발 서버에선 404). 홈(체험 고르기) 화면에는 아직 칸이 없다
- 고친 뒤: `cd games/daejeon-ax` → `npx tsc --noEmit`, `npx vitest run`(70개), `npm run build:host` → 결과물이 `public/daejeon-ax/`에 다시 써진다(약 25MB, MediaPipe 모델·WASM 포함)
- `games/daejeon-ax/public/mediapipe`는 git에서 뺐다(빌드 결과물에 같은 파일이 있음). 새로 받은 PC에선 `npm ci` 뒤 `npm run setup:pose`
- 모션 인식 조절값은 `games/daejeon-ax/src/config.ts`의 `pose`: 예민함은 `rangeShoulders`(0.9, 올리면 둔해짐)·`deadzone`(0.1), 부하는 `maxLoad`(0.25)·`singlePoseMs`(12). 11/18에 원본 폴더에도 같은 세 파일(`src/config.ts`·`src/input/pose.ts`·`src/game/game.test.ts`)을 넣었다(원본 재배포는 안 함). 실제 카메라로는 아직 시험 안 함
- 11/18에 메뉴 화면(타이틀·난이도 카드·조종 방식 카드·뒤로 가기·결과 화면)을 새로 짰고 원본에도 같은 파일(`index.html`·`src/style.css`·`src/main.ts`·`README.md`)을 넣었다. 지금 원본과 사본의 소스는 같다(사본만 `package.json`의 `build:host`와 `.gitignore`가 다름). 색은 `src/style.css` 맨 위 변수
- **wvn.vercel.app·APK·zip에는 아직 안 들어간다**: `scripts/build-offline.mjs`가 `public/`에서 고른 폴더만 복사한다. 넣으려면 그 목록에 `"daejeon-ax"` 한 줄(APK·zip도 약 25MB 커짐)

## 작업 규칙 (대표님 요청)
- 한국어로 답한다. 불필요한 질문 없이 직접 한다(gh·Vercel 로그인/설정도 직접)
- **"배포해"라고 할 때만 push.** 그 전엔 로컬 커밋까지
- 한글 파일을 PowerShell `Get-Content`/`Set-Content`로 고치지 않는다(CP949로 깨짐). Edit 도구나 utf-8 node 스크립트 사용
- 현장엔 마우스·키보드 없음: 손 동작이나 터치로만 조작
- **아이 사진은 절대 저장하지 않는다**
- Vercel MCP는 팀 권한 403 → Vercel CLI 사용(로그인돼 있음)

## 남은 일
1. 태블릿 3대 실기기 시험(인식 속도, 카메라 위치). 느리면 그 기기만 가볍게
2. 부스에서 홈 화면 단계 표시(사람 서면 1→2·3번 켜짐)와 바늘 피하기 난이도 확인
3. 몽글 드럼용 위브온중촌 Suno 곡(약 6곡) 받으면 곡 목록에 넣기 — 아직 파일 안 옴
4. (보류) 폰 QR 연동: 이번 행사엔 방식 변경 안 함. 끝난 뒤 점수·사진을 QR로 받아 가기 정도만 검토
