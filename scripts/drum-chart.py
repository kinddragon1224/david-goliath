# 몽글 드럼 곡 분석: 박자 위치를 찾고, 박마다의 세기로 채보(왼/오/양손)를 만든다. librosa 필요.
#   python scripts/drum-chart.py <원본 mp3> <이름>
# 결과: public/audio/<이름>.mp3 (첫 박이 0초가 되게 앞을 자르고 끝을 줄인 것. 곡은 거의 전부 쓴다),
#       표준출력에 src/fashion/modes/rhythm.ts 의 SONGS 에 넣을 곡 정보(JSON)
# 박자: 곡의 빠르기가 조금씩 변할 수 있어(중촌 챌린지가 그렇다) 일정한 격자를 쓰지 않고, 박자 추적이 찾은 박 하나하나의 시각을 그대로 쓴다.
#       그래서 채보의 음표는 "몇 번째 박"이 아니라 "몇 초"로 적는다.
# 채보 규칙: 두 곡이 빨라(분당 130~150박) 게임의 한 박 = 음악 두 박(마디의 1·3박). 음악이 쉬는 곳은 쉬고,
#           곡 뒤쪽 절반의 뚜렷한 스네어(음악의 2·4박)에 반 박을 넣고, 여덟 박의 끝은 양손. 손 순서는 치기 좋은 틀.
import json, subprocess, sys
import numpy as np, librosa

src, name = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True)
dur = len(y) / sr
hop = 256
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tt = np.arange(len(env)) * hop / sr
_, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=hop, units="time", tightness=100, trim=False)
# 추적한 박을 가까운 소리 꼭대기에 살짝 당긴다(±45ms 안에서, 절반만): 추적이 프레임 단위(12ms)라 생기는 잔떨림을 줄인다
def snap(t):
    m = (tt >= t - 0.045) & (tt <= t + 0.045)
    return t + (tt[m][int(np.argmax(env[m]))] - t) * 0.5 if m.any() else t
beats = np.array([snap(t) for t in beats])
# 검증용: 박과 가장 가까운 소리 꼭대기의 어긋남
def peak_off(t):
    m = (tt >= t - 0.1) & (tt <= t + 0.1)
    return float(tt[m][int(np.argmax(env[m]))] - t) if m.any() else 0.0
offs = np.array([abs(peak_off(t)) for t in beats])
# 마디 첫 박: 4박 중 낮은 소리(킥)가 가장 센 자리
S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
low = S[freqs < 150].sum(axis=0)
fr = lambda t: int(np.clip(round(t * sr / hop), 0, S.shape[1] - 1))
def at(arr, t, w=2):
    f = fr(t)
    return float(arr[max(0, f - w): f + w + 1].max())
phase = int(np.argmax([np.mean([at(low, t, 3) for t in beats[p::4]]) for p in range(4)]))
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
loud = float(np.argmax(rms > rms.max() * 0.12)) * hop / sr
start = next(i for i in range(len(beats)) if i % 4 == phase and beats[i] >= loud - 0.05)
music = beats[start:]
music = music[music <= dur - 3.0]  # 곡이 잦아드는 끝 3초는 쓰지 않는다
G = music[::2]                      # 게임 박(음악의 1·3박)
H = music[1::2]                     # 그 사이(음악의 2·4박, 스네어 자리)
t0 = float(G[0])
n = len(G)
roll = n - 5                        # 끝 5박은 연타
env_n = env / (np.percentile(env, 98) + 1e-9)
PATTERN = [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0]
beat_s = [at(env_n, t) for t in G]
quiet = np.percentile(beat_s, 20) * 0.6
chart = []
for i in range(4, roll):            # 첫 네 박은 세기만 한다
    if beat_s[i] < quiet:
        continue
    t = round(float(G[i]) - t0, 3)
    if i % 8 == 7:
        chart.append([t, 2])
        continue
    lane = PATTERN[i % 16]
    chart.append([t, lane])
    if i >= roll * 0.5 and i % 4 in (1, 3) and i < len(H) and i + 1 < roll and at(env_n, H[i]) > 0.55:
        chart.append([round(float(H[i]) - t0, 3), 1 - lane])
end = float(G[-1]) - t0 + float(np.median(np.diff(G)))  # 연타가 끝나는 때
length = end + 2.5
out = f"public/audio/{name}.mp3"
# loudnorm: 두 곡의 크기를 맞춘다(한 곡만 작게 들리지 않게)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.4f}", "-t", f"{length:.3f}", "-i", src,
                "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st={length - 2.0:.3f}:d=2.0", "-ac", "2", "-ar", "44100", "-b:a", "128k", out], check=True)
gd = np.diff(G)
print(json.dumps({
    "name": name, "bpm": round(60.0 / float(np.mean(gd)), 3), "bpmRange": [round(60.0 / float(gd.max()), 1), round(60.0 / float(gd.min()), 1)],
    "firstBeat": round(t0, 3), "beats": n, "rollAt": round(float(G[roll]) - t0, 3), "endAt": round(end, 3), "seconds": round(length, 2),
    "notes": len(chart), "half": sum(1 for c in chart if c[1] != 2 and any(abs(c[0] - (float(h) - t0)) < 0.002 for h in H)),
    "peakOffMedianMs": int(np.median(offs) * 1000), "peakOffUnder60msPct": int((offs < 0.06).mean() * 100),
    "chart": chart}, ensure_ascii=False))
