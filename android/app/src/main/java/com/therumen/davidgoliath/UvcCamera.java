package com.therumen.davidgoliath;

import android.app.Activity;
import android.content.Context;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceResponse;
import android.widget.Toast;

import com.herohan.uvcapp.CameraException;
import com.herohan.uvcapp.CameraHelper;
import com.herohan.uvcapp.ICameraHelper;
import com.serenegiant.usb.Size;
import com.serenegiant.usb.UVCCamera;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.List;

/**
 * 웹캠을 안드로이드 카메라로 못 잡는 TV용. USB로 직접 읽어 JPEG로 게임(WebView)에 넘긴다.
 * 게임은 UvcBridge로 켜고 끄며, FRAME_PATH 를 요청하면 다음 프레임을 받는다.
 * adb가 없는 현장에서 원인을 볼 수 있게 단계마다 화면에 짧게 알린다.
 */
public class UvcCamera implements ICameraHelper.StateCallback {
    static final String FRAME_PATH = "/__uvc/frame";
    private static final int WANT_WIDTH = 640;
    private static final int JPEG_QUALITY = 70;
    private static final long FRAME_WAIT_MS = 1000;

    private final Activity activity;
    private ICameraHelper helper;
    private boolean wanted;
    private String wantId = "";
    private String selected;
    private volatile String state = "off";

    private final Object lock = new Object();
    private volatile int frameW;
    private volatile int frameH;
    private boolean asked;
    private byte[] jpeg;

    UvcCamera(Activity activity) {
        this.activity = activity;
    }

    private void tell(String text) {
        activity.runOnUiThread(() -> Toast.makeText(activity, text, Toast.LENGTH_LONG).show());
    }

    private static boolean isVideo(UsbDevice d) {
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) return true;
        }
        return false;
    }

    private Iterable<UsbDevice> usbDevices() {
        UsbManager usb = (UsbManager) activity.getSystemService(Context.USB_SERVICE);
        return usb == null ? Collections.emptyList() : usb.getDeviceList().values();
    }

    private UsbDevice pick() {
        UsbDevice first = null;
        for (UsbDevice d : usbDevices()) {
            if (!isVideo(d)) continue;
            if (d.getDeviceName().equals(wantId)) return d;
            if (first == null) first = d;
        }
        return first;
    }

    private void select(UsbDevice d) {
        if (selected != null) return;
        selected = d.getDeviceName();
        state = "waiting";
        helper.selectDevice(d);
    }

    /** [{id, label}] 꽂혀 있는 USB 웹캠. */
    @JavascriptInterface
    public String devices() {
        JSONArray out = new JSONArray();
        try {
            for (UsbDevice d : usbDevices()) {
                if (!isVideo(d)) continue;
                String name = d.getProductName();
                out.put(new JSONObject()
                        .put("id", d.getDeviceName())
                        .put("label", name == null ? "USB 웹캠" : name));
            }
        } catch (Exception e) {
            tell("웹캠 목록 오류: " + e);
        }
        return out.toString();
    }

    @JavascriptInterface
    public String state() {
        return state;
    }

    @JavascriptInterface
    public void open(String id) {
        activity.runOnUiThread(() -> {
            wanted = true;
            wantId = id == null ? "" : id;
            if (helper == null) {
                helper = new CameraHelper();
                helper.setStateCallback(this);
            }
            UsbDevice d = pick();
            if (d == null) {
                state = "none";
                tell("USB 웹캠을 찾지 못했어요. 다시 꽂아 보세요");
                return;
            }
            select(d);
        });
    }

    @JavascriptInterface
    public void close() {
        activity.runOnUiThread(this::release);
    }

    void release() {
        wanted = false;
        selected = null;
        state = "off";
        if (helper != null) {
            helper.release();
            helper = null;
        }
    }

    @Override
    public void onAttach(UsbDevice device) {
        if (wanted && helper != null && isVideo(device)) select(device);
    }

    @Override
    public void onDeviceOpen(UsbDevice device, boolean isFirstOpen) {
        if (helper != null) helper.openCamera();
    }

    /** 인식은 작은 영상이면 충분하다. 폭이 가장 가깝고, 같으면 4:3(위아래가 덜 잘린다)을 고른다. */
    private static Size bestSize(List<Size> sizes) {
        Size best = null;
        int bestScore = Integer.MAX_VALUE;
        if (sizes == null) return null;
        for (Size s : sizes) {
            int score = Math.abs(s.width - WANT_WIDTH)
                    + (s.width * 3 == s.height * 4 ? 0 : 50)
                    + (s.type == UVCCamera.UVC_VS_FRAME_MJPEG ? 0 : 10);
            if (score < bestScore) {
                bestScore = score;
                best = s;
            }
        }
        return best;
    }

    @Override
    public void onCameraOpen(UsbDevice device) {
        if (helper == null) return;
        Size size = bestSize(helper.getSupportedSizeList());
        if (size != null) helper.setPreviewSize(size);
        else size = helper.getPreviewSize();
        if (size != null) {
            frameW = size.width;
            frameH = size.height;
        }
        helper.startPreview();
        helper.setFrameCallback(this::onFrame, UVCCamera.PIXEL_FORMAT_NV21);
        state = "live";
        tell("USB 웹캠 연결 " + frameW + "x" + frameH);
    }

    private void onFrame(ByteBuffer frame) {
        synchronized (lock) {
            if (!asked) return;
        }
        byte[] nv21 = new byte[frame.remaining()];
        frame.get(nv21);
        int w = frameW;
        int h = frameH;
        if (w <= 0 || h <= 0 || nv21.length != w * h * 3 / 2) {
            Size now = helper == null ? null : helper.getPreviewSize();
            if (now == null) return;
            frameW = w = now.width;
            frameH = h = now.height;
            if (nv21.length != w * h * 3 / 2) return;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(nv21.length / 8);
        new YuvImage(nv21, ImageFormat.NV21, w, h, null)
                .compressToJpeg(new Rect(0, 0, w, h), JPEG_QUALITY, out);
        synchronized (lock) {
            jpeg = out.toByteArray();
            asked = false;
            lock.notifyAll();
        }
    }

    /** 게임이 프레임을 달라고 할 때만 JPEG로 만든다. 다음 프레임이 나올 때까지 기다렸다 돌려준다. */
    WebResourceResponse frameResponse() {
        byte[] data;
        synchronized (lock) {
            jpeg = null;
            asked = true;
            long end = SystemClock.elapsedRealtime() + FRAME_WAIT_MS;
            try {
                long left;
                while (jpeg == null && (left = end - SystemClock.elapsedRealtime()) > 0) {
                    lock.wait(left);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            data = jpeg;
            jpeg = null;
        }
        boolean got = data != null;
        return new WebResourceResponse(
                "image/jpeg",
                null,
                got ? 200 : 204,
                got ? "OK" : "No Content",
                Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(got ? data : new byte[0]));
    }

    @Override
    public void onCameraClose(UsbDevice device) {
    }

    @Override
    public void onDeviceClose(UsbDevice device) {
    }

    @Override
    public void onDetach(UsbDevice device) {
        if (device.getDeviceName().equals(selected)) {
            selected = null;
            state = "gone";
            tell("USB 웹캠이 빠졌어요");
        }
    }

    @Override
    public void onCancel(UsbDevice device) {
        selected = null;
        state = "denied";
        tell("USB 웹캠 사용을 허용해 주세요");
    }

    @Override
    public void onError(UsbDevice device, CameraException e) {
        selected = null;
        state = "error";
        tell("USB 웹캠을 열지 못했어요(" + e.getCode() + "). 다시 꽂아 보세요");
    }
}
