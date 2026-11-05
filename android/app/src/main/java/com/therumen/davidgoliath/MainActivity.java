package com.therumen.davidgoliath;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

/**
 * 구글 TV용 껍데기 앱. 게임 웹 파일(assets)을 앱 안에서 띄우고, USB 웹캠 권한을 넘겨준다.
 * 인터넷이 없어도 돈다. 점수 기록은 WebView 저장소(앱 데이터)에 남는다.
 */
public class MainActivity extends Activity {
    private static final String HOST = WebViewAssetLoader.DEFAULT_DOMAIN;
    /** https 주소라야 브라우저가 카메라를 허락한다. kiosk=1 자동 시작, tv=1 가로 TV 배치. */
    private static final String START_URL = "https://" + HOST + "/index.html?kiosk=1&tv=1";
    private static final int REQ_CAMERA = 1;
    private static final String PREF_ROTATION = "rotation";
    /** 리모컨 방향 버튼을 이 시간(ms) 안에 3번 눌러야 화면이 돈다. 한두 번은 평소 조작. */
    private static final long TURN_WINDOW_MS = 1500;

    private FrameLayout root;
    private WebView web;
    private WebViewAssetLoader loader;
    private PermissionRequest pendingWebPermission;
    private long lastBackAt;
    private boolean askingCamera;
    private int rotation;
    private int turnKey;
    private int turnPresses;
    private long turnStartedAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        rotation = getPreferences(MODE_PRIVATE).getInt(PREF_ROTATION, 0);
        web = buildWebView();
        root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
        root.addOnLayoutChangeListener((v, l, t, r, b, oldL, oldT, oldR, oldB) -> {
            if (r - l != oldR - oldL || b - t != oldB - oldT) v.post(this::applyRotation);
        });
        setContentView(root);
        hideSystemUi();

        // 처음 켤 때 카메라 권한을 먼저 묻는다(리모컨으로 '허용')
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) askCamera();
        web.loadUrl(START_URL);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView buildWebView() {
        WebView w = new WebView(this);
        w.setBackgroundColor(0xff3a1a0e);
        w.setFocusable(true);
        w.setFocusableInTouchMode(true);
        w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);

        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        // TV 글자 크기 설정이 크면 화면이 깨지므로 고정
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse res = loader.shouldInterceptRequest(request.getUrl());
                if (res != null) {
                    String path = request.getUrl().getPath();
                    if (path != null && path.endsWith(".wasm")) res.setMimeType("application/wasm");
                }
                return res;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // 게임 밖 주소로는 나가지 않는다
                return !HOST.equals(request.getUrl().getHost());
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // 메모리 부족 등으로 화면 엔진이 죽으면 앱을 다시 띄운다
                recreate();
                return true;
            }
        });

        w.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }
        });
        return w;
    }

    private void handleWebPermission(PermissionRequest request) {
        boolean wantsVideo = false;
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsVideo = true;
        }
        if (!wantsVideo || !HOST.equals(request.getOrigin().getHost())) {
            request.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            if (pendingWebPermission != null) pendingWebPermission.deny();
            pendingWebPermission = request;
            askCamera();
        }
    }

    /** 권한 창은 한 번에 하나만 띄운다. 게임이 먼저 카메라를 찾아도 결과는 같은 창에서 받는다. */
    private void askCamera() {
        if (askingCamera) return;
        askingCamera = true;
        requestPermissions(new String[] {Manifest.permission.CAMERA}, REQ_CAMERA);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA) return;
        askingCamera = false;
        boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (pendingWebPermission != null) {
            if (ok) pendingWebPermission.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
        if (!ok) {
            Toast.makeText(this, "카메라 권한이 없으면 화면을 눌러서만 던질 수 있어요", Toast.LENGTH_LONG).show();
        }
    }

    /** 구글 TV는 세워도 화면을 가로로 내보낸다. WebView째 돌려서 게임이 세로 화면으로 알게 한다. */
    private void applyRotation() {
        if (web == null) return;
        boolean sideways = rotation % 180 != 0;
        int w = root.getWidth();
        int h = root.getHeight();
        web.setLayoutParams(new FrameLayout.LayoutParams(sideways ? h : w, sideways ? w : h, Gravity.CENTER));
        web.setRotation(rotation);
    }

    /** 오른쪽 3번: 시계 방향으로 90도, 왼쪽 3번: 반대로 90도. 기기에 저장돼 다음에 켜도 유지된다. */
    private void countTurnKey(int keyCode) {
        long now = SystemClock.elapsedRealtime();
        if (keyCode != turnKey || now - turnStartedAt > TURN_WINDOW_MS) {
            turnKey = keyCode;
            turnPresses = 0;
            turnStartedAt = now;
        }
        if (++turnPresses < 3) return;
        turnPresses = 0;
        rotation = (rotation + (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ? 90 : 270)) % 360;
        getPreferences(MODE_PRIVATE).edit().putInt(PREF_ROTATION, rotation).apply();
        applyRotation();
    }

    /** 뒤로 버튼은 2초 안에 두 번 눌러야 종료(아이들이 실수로 끄지 않게). */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int key = event.getKeyCode();
        if ((key == KeyEvent.KEYCODE_DPAD_RIGHT || key == KeyEvent.KEYCODE_DPAD_LEFT)
                && event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            countTurnKey(key);
        }
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                long now = SystemClock.elapsedRealtime();
                if (now - lastBackAt < 2000) {
                    finish();
                } else {
                    lastBackAt = now;
                    Toast.makeText(this, "한 번 더 누르면 게임을 끕니다", Toast.LENGTH_SHORT).show();
                }
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
            web.requestFocus();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
