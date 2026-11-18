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
- **v1.18.0 행사 디자인(11/18 저녁):** 포스터 톤(검정 + 얼음빛 홀로그램) → **맞춤패션거리 톤**(남색 원단 + 초크빛 글자·시침 점선 + 줄자 노랑). 색은 `src/styles.css`의 `.f-root` 변수와 `core.ts`의 `TONE.gold`. 홈은 배경 그림을 빼고 원단 바탕(`.f-cloth`) + 줄자 띠(`.f-tape`) + 시침 선 칸(`.f-stitch`), 01 칸은 룩북 옷 세 벌. 체험 화면은 틀(판·버튼·거울·탭)과 바탕색만 바뀌고 무대 안의 벽 그림(`public/art/*.webp`, 홀로그램풍)은 그대로다. 다윗과 골리앗·꿈돌이 게임은 자기 디자인 그대로. 대전 중구·대전시 로고는 파일이 없어 넣지 않았다(행사 때·곳은 글자로 적음)
- 지금 배포된 버전: **v1.18.0** (그 전 v1.17.0 은 11/18 푸시, `src/game/constants.ts`의 `APP_VERSION`). 대표님 지시(11/18): 개발이 끝나면 승인 없이 바로 커밋·푸시한다
- **v1.17.0 약한 PC(HD 520) 인식 속도 (실기기 미검증 — 화면 왼쪽 아래 속도 표시로 확인할 것):**
  - 원인 정리: 무거운 것은 사람 관절을 읽는 신경망(초당 5~8번이 이 CPU의 한계에 가깝다)이고, 그 위에 (1) 인식이 화면 장면에 묶여 쉬는 시간, (2) GPU·CPU 고르기가 틀릴 수 있는 방식, (3) 매 장면 다시 그리는 고정 그림이 인식 몫의 CPU를 깎고 있었다
  - `src/game/pose.ts`: 결과가 오거나 카메라가 새 장면을 주면 바로 다음 인식(`pump`·`watchFrames`). 첫 실행 때 같은 그림(`/goliath-idle.png`)으로 GPU·CPU를 재서 고른다(`benchDelegates`, 저장 키 `weaveon-delegate-v2`). 주소에 `?delegate=cpu|gpu` 로 고정 가능
  - `src/fashion/core.ts`의 `stampLayer`: 약한 PC에서 고정 그림(가위질 매트·원단, 다리미 벽·다림판)을 한 번만 그려 찍는다. 화면 글자 갱신 0.1 → 0.2초, 대기 화면 빛줄기 끔
  - 잰 방법(임시 스크립트, 저장소 밖): 배포판과 같은 빌드 + 사람 영상을 가짜 카메라로 + 브라우저를 CPU 2개에 묶음. 가위질 초당 3~4 → 7번, 다리미 5 → 8번, 바느질 7번, 몽글 드럼 6~7번, 골리앗 5~6번. **진짜 HD 520 수치가 아니다**(그래픽을 CPU로 흉내 낸 값)
  - 아직 안 한 것: 오프라인 설치판 서버(`offline/kiosk/server.ps1`)가 캐시를 못 쓰게 해 체험을 바꿀 때마다 인식 준비가 몇 초 걸린다. 바느질·몽글 드럼·골리앗의 고정 그림은 그대로
- **v1.17.0 체험 손질:** 몽글 드럼 끝의 빈 6초 제거(판 47 → 43초, `?lag=250` 으로 박자 지연 조절), 골리앗 저절로 들어간 점검 모드 풀기·떠난 판의 창/피버 지우기·급소 조준 보정 110 → 150·결과 6 → 10초·약한 PC 던지기 속도 창 0.25 → 0.4초, 패션 결과 화면 양손 번쩍 게이지(숫자는 '처음으로'로), 다리미·가위질 "여기로!" 화살표가 맞는 플레이를 틀렸다고 하던 것, 가위질 정확도 판정 완화·조각 넘어가는 시간 1.15 → 0.8초, 바느질 0.9초, 카메라 끊기면 손·사람 지우기
- v1.16.0 에 `e60611a` 약한 PC(HD 520)용 카메라 15장/초 · 화면 70% 크기도 함께 나갔다(4스레드 이하 PC에서만 켜짐). 대표님은 i3-6006U(HD 520)에서 인식이 너무 느리다고 하심 → 계속 개선 중
- 구조
  - `src/app/Root.tsx`: 첫 화면 분기. `?game=goliath|iron|scissors|sewing|rhythm`
  - `src/fashion/StationPicker.tsx`: 홈(체험 고르기) 화면. 로고·고르는 법 3단계·하단 로고 띠
  - `src/fashion/stations.ts`: 체험 목록, 가상 착장 연결(studio.therumen.kr)
  - `src/fashion/core.ts`: 패션 게임 공통 엔진. 플레이어가 5초 안 보이면 결과 없이 홈으로(`ABSENT_END`)
  - `src/game/*`: 다윗과 골리앗, 공통 인식(`pose.ts`), 약한 PC 판별(`perf.ts`, `?lite=1|0`로 강제), 키오스크(`kiosk.ts`)
- **v1.16.0 의 화면 수정(11/18, 실기기 미검증):**
  - 체험 4종 대기 화면(`src/fashion/FashionApp.tsx`의 `AttractOverlay`): 제목·문구 카드를 한 장으로 합치고, 간판 7초(시범을 어둡게 덮음) ↔ 시범 7초(카드 숨김)로 번갈아 보인다
  - 홈(`src/fashion/StationPicker.tsx`): 칸을 화면 위 70%에만 두고 아래 30%(`REST`)는 버튼 없는 쉬는 자리. 칸은 손을 1.5초(`PICK_HOLD`) 올려야 고른다. 다른 버튼은 그대로 1초(`src/app/HandCursor.tsx`, 버튼에 `data-hold`를 적으면 그 버튼만 바뀜)
- 확인: `npx tsc --noEmit`, `npm test` (윈도우에서는 scripts 의 symlink 시험 2개가 원래 실패한다)
- 미리보기: `$env:VITE_EDITION='weaveon'; npm run dev` → http://localhost:8080/
- 커밋할 때 파일을 골라서 add. **`.vercel/output`, `src/routeTree.gen.ts`, `.claude/`는 올리지 않는다**

### 2) 가상 착장: `C:\Users\sunyo\weaveon\vton`
- 이 PC에서 돈다: `server\server.py`(FastAPI), Cloudflare 터널로 https://studio.therumen.kr, 화면은 `/app`
- 화면 `app\`은 빌드된 번들만 있음(소스 없음). 고칠 땐 node 스크립트로 정확한 문자열을 바꿔 **새 파일**로 쓰고 `index.html`이 그 파일을 가리키게 한다. 원본 `-b.js`는 건드리지 않음
- 현재(11/18 16시): `app\index.html` 이 번들을 골라 싣는다. 기본 `vton-DRvWkagp-b.js`(룩북 잡기) + 대기 중 **포즈 따라 하기**(index.html 안의 스크립트). 주소에 `wait=needle` 이면 `-d.js`(룩북 잡기 + 바늘 피하기). 되돌리기 백업 `index.html.bak1118pose`(바로 전), `index.html.bak1116needle`(원본), `index.html.bak1116needle2`. 자세한 내용은 `vton\CLAUDE.md` 의 11/18 줄
- 11/18: `server.py` 코덱스 제한 시간 버그 수정·모델 `gpt-6.1-terra` 고정(재시작해 적용함). 코덱스 계정은 therumen.edu@gmail.com(Plus). `gpt-6.2-sol` 은 더 느리고 `gpt-6-luna` 는 사진을 못 남겨 둘 다 쓰지 않는다
- 바늘 조절값: 나오는 비율 `.4`, 속도 `1.9`배. 실제 부스 시험 후 조절 필요
- 접속 PIN은 유료 AI 생성 보호용(한 번 입력하면 30일 유지). PIN·KEY·토큰은 `booth.ini`/`UNLOCK_URL.txt`에 있고 **절대 출력·공유하지 않는다**
- 이 저장소는 git push 하지 않음. 바꾸기 전에 `.bak날짜` 백업. 추가 유료 API 쓰지 않음. 룩북 사진은 로컬에만

### 3) 꿈돌이 운석 피하기 「대전 AX 2026」 사본: `games/daejeon-ax` (11/18 추가, v1.16.0 에 포함)
- 원본은 `C:\Users\sunyo\Desktop\꿈돌이 운석 피하기 시연용`(Vercel `daejeon-ax-2026`, 따로 배포). 여기는 **복사본**이라 원본을 고쳐도 자동으로 따라오지 않는다
- 따로 도는 Vite + Three.js 프로젝트(자기 `package.json`·`node_modules`). 이 저장소의 `tsc`·`npm test`·빌드와 섞이지 않는다
- 들어가는 법: 개발 서버를 켜고 http://localhost:8080/daejeon-ax/index.html (`/daejeon-ax/`만 치면 개발 서버에선 404). 11/18부터 홈(체험 고르기)의 **07 꿈돌이 운석 피하기** 칸과 체험 안 '다른 체험' 판에서 들어간다(`src/fashion/stations.ts`의 `METEOR`·`goMeteor`). 게임에는 `?home=주소`로 들어가고, 게임의 '체험 고르기로' 버튼·타이틀에서 30초 방치·Esc 가 그 주소로 돌아온다(같은 출처만). 게임 파일이 없는 설치판에서는 칸이 '준비 중'으로 꺼진다
- **현장 주의(미해결):** 꿈돌이 게임의 메뉴(시작·난이도·조종 방식)는 터치나 키보드로만 누를 수 있다. 손 커서가 없어서 터치가 안 되는 TV·미니 PC 에서는 시작할 수 없다. 태블릿에 두거나 손 커서를 넣어야 한다
- 홈 칸 그림 `public/art/meteor.jpg`는 게임 선택 화면을 찍어 자른 것
- 고친 뒤: `cd games/daejeon-ax` → `npx tsc --noEmit`, `npx vitest run`(70개), `npm run build:host` → 결과물이 `public/daejeon-ax/`에 다시 써진다(약 25MB, MediaPipe 모델·WASM 포함)
- `games/daejeon-ax/public/mediapipe`는 git에서 뺐다(빌드 결과물에 같은 파일이 있음). 새로 받은 PC에선 `npm ci` 뒤 `npm run setup:pose`
- 모션 인식 조절값은 `games/daejeon-ax/src/config.ts`의 `pose`: 예민함은 `rangeShoulders`(0.9, 올리면 둔해짐)·`deadzone`(0.1), 부하는 `maxLoad`(0.25)·`singlePoseMs`(12). 11/18에 원본 폴더에도 같은 세 파일(`src/config.ts`·`src/input/pose.ts`·`src/game/game.test.ts`)을 넣었다(원본 재배포는 안 함). 실제 카메라로는 아직 시험 안 함
- 11/18에 메뉴 화면(타이틀·난이도 카드·조종 방식 카드·뒤로 가기·결과 화면)을 새로 짰고 원본에도 같은 파일(`index.html`·`src/style.css`·`src/main.ts`·`README.md`)을 넣었다. 사본에만 있는 것: `package.json`의 `build:host`, `.gitignore`, 그리고 `?home=` 복귀(`index.html`·`src/main.ts`). 색은 `src/style.css` 맨 위 변수
- 배포판 포함: `scripts/build-offline.mjs`의 위브온판 목록에 `"daejeon-ax"`를 넣었다(11/18). **`games/`와 `public/daejeon-ax/`를 커밋해야** wvn.vercel.app·APK·zip에 들어가고, 그러면 APK·zip이 약 25MB 커진다. 오프라인 빌드와 APK 안에서의 동작은 아직 돌려 보지 않았다

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
