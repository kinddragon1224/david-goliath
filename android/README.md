# 구글 TV 설치판

구글 TV(안드로이드 TV)에 USB 웹캠을 꽂아 TV 한 대로 돌리는 설치 파일입니다. 인터넷이 없어도 됩니다.

## 설치 파일 받기

GitHub 저장소 → **Releases** → `tv-weaveon` → `DavidGoliath-weaveon-tv-v….apk`

main 에 게임이 바뀌면 자동으로 새로 만들어집니다. 다른 판은 Actions → *Android TV APK* → *Run workflow* 에서 판을 골라 만듭니다.

## TV에 설치하기 (처음 한 번)

1. TV 설정 → 시스템 → 정보 → **Android TV OS 빌드**를 7번 눌러 개발자 모드를 켭니다.
2. Play 스토어에서 **Downloader**(AFTVnews) 또는 **Send Files to TV** 앱을 설치합니다.
3. 설정 → 앱 → 보안 및 제한 → **출처를 알 수 없는 앱**에서 2번 앱을 허용합니다.
4. 2번 앱으로 apk 를 받아 설치합니다. (USB 메모리에 담아 파일 관리자 앱으로 열어도 됩니다.)
5. 홈 화면 앱 목록에서 **다윗과 골리앗**을 열고, 카메라 권한을 **허용**합니다.

업데이트는 새 apk 를 같은 방법으로 설치하면 됩니다. 점수 기록은 그대로 남습니다(앱을 삭제하면 지워집니다).

## 행사 전에 꼭 확인할 것

- **웹캠 인식**: 앱을 열었을 때 왼쪽 "내 모습"에 카메라 화면이 나와야 합니다. 안 나오면 이 TV가 USB 웹캠을 지원하지 않는 것입니다(기종마다 다름). 이 경우 미니 PC나 노트북을 HDMI로 연결해 윈도우 설치판을 쓰세요.
- **인식 속도**: 손을 들었다 던질 때 화면의 손 표시가 늦게 따라오면 TV 성능이 부족한 것입니다.
- **카메라 고르기**: 순위표 제목("○월의 용사")을 리모컨 확인 버튼으로 1.5초 길게 누르면 운영자 화면이 열립니다.
- **끄기**: 리모컨 뒤로 버튼을 2초 안에 두 번 누릅니다.

## 개발 메모

- `MainActivity` 가 WebView 로 `https://appassets.androidplatform.net/index.html?kiosk=1&tv=1` 을 엽니다. 게임 파일은 빌드 때 `dist-offline/DavidGoliath/app` 에서 `app/src/main/assets` 로 복사합니다.
- `app/kiosk.keystore` 는 사이드로드 전용 고정 서명 키입니다. 키가 바뀌면 업데이트 설치가 막히고 기존 앱을 지워야 하므로(점수도 지워짐) 바꾸지 마세요.
- 로컬 빌드: `node scripts/build-offline.mjs --edition=weaveon` 후 assets 복사, `gradle -p android assembleRelease -Pedition=weaveon` (안드로이드 SDK 필요).
