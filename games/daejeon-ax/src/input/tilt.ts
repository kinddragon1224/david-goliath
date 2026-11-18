import { CONFIG } from '../config';
import { clamp1, type InputSource } from './index';

/** 기기 기울이기. iOS는 사용자 제스처 안에서 enable()을 불러야 권한 창이 뜬다. */
export class TiltInput implements InputSource {
  readonly state = { x: 0, shield: false };
  readonly relative = false;
  activeAt = 0;
  private listening = false;
  private ref?: number;

  async enable(): Promise<void> {
    const DOE = (window as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    if (!DOE || this.listening) return;
    try {
      if (typeof DOE.requestPermission === 'function' && (await DOE.requestPermission()) !== 'granted') return;
    } catch {
      return; // 거부·미지원이면 드래그만 쓴다
    }
    this.listening = true;
    addEventListener('deviceorientation', this.onTilt);
  }

  private onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    // 화면 방향에 따라 "좌우 기울기"에 해당하는 축이 달라진다
    // 구형 iOS 는 screen.orientation 이 없고 window.orientation(-90/0/90)만 있다
    const raw = screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
    const angle = (raw + 360) % 360;
    const deg = angle === 90 ? e.beta : angle === 270 ? -e.beta : e.gamma;
    this.state.x = clamp1(deg / CONFIG.tilt.maxDeg);
    if (this.ref === undefined) this.ref = deg; // 놓여 있는 폰이 다른 입력을 덮지 않게, 움직였을 때만 활성
    else if (Math.abs(deg - this.ref) > CONFIG.tilt.wakeDeg) {
      this.ref = deg;
      this.activeAt = performance.now();
    }
  };
}
