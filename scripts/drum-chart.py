# 몽글 드럼 곡 분석: 빠르기·박자 위치를 찾고, 박마다의 세기와 음색으로 채보(왼/오/양손)를 만든다.
#   python scripts/drum-chart.py <원본 mp3> <이름> [게임 길이(초), 기본 46]
# 결과: public/audio/<이름>.mp3 (첫 박이 0초가 되게 자르고 끝을 줄인 것), 표준출력에 rhythm.ts 에 넣을 곡 정보(JSON)
# 채보 규칙: 정박은 소리가 뚜렷하면 치고, 반 박은 뒤쪽 절반에서 아주 뚜렷할 때만. 낮은 소리(킥)는 왼쪽, 높은 소리(스네어·하이햇)는 오른쪽.
import json, subprocess, sys
import numpy as np, librosa

src, name = sys.argv[1], sys.argv[2]
want = float(sys.argv[3]) if len(sys.argv) > 3 else 46.0
# 넷째 인자: 이 초부터 쓴다(앞부분의 빠르기가 흔들리는 곡은 안정된 뒷부분을 쓴다). 기본 0
from_t = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
y, sr = librosa.load(src, sr=22050, mono=True)
hop = 256
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=hop, units="time", tightness=120)
tempo = float(np.atleast_1d(tempo)[0])
# 박 간격이 일정한 곡이라고 보고(만든 음악), 찾은 박들에 직선을 맞춰 빠르기와 첫 박을 다시 구한다
idx = np.arange(len(beats))
period, t_first = np.polyfit(idx, beats, 1)
# 찾은 박들은 조금씩 흔들린다. 박 간격이 일정한 곡(만든 음악)이라고 보고, 곡 전체에서 소리 세기가 격자에 가장 잘 얹히는 빠르기·첫 박을 촘촘히 다시 찾는다
tt = np.arange(len(env)) * hop / sr
def score(per, first):
    g = np.arange(first, tt[-1], per)
    g = g[(g >= from_t) & (g <= from_t + want + 8)]  # 쓸 구간에서만 맞춘다
    return float(np.interp(g, tt, env).mean())
best = max(((score(60.0 / b, f), b, f) for b in np.arange(60.0 / period - 1.5, 60.0 / period + 1.5, 0.01)
            for f in np.arange(0, 60.0 / b, 0.01)), key=lambda x: x[0])
bpm, t_first = best[1], best[2]
period = 60.0 / bpm
drift = float(np.max(np.abs(beats - (t_first + np.round((beats - t_first) / period) * period))))
n_all = int((tt[-1] - t_first) / period)
# 마디 첫 박 찾기: 4박 중 낮은 소리(킥)가 가장 센 자리
S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
low = S[freqs < 150].sum(axis=0)
high = S[freqs > 2500].sum(axis=0)
fr = lambda t: int(np.clip(round(t * sr / hop), 0, S.shape[1] - 1))
def at(arr, t, w=3):
    f = fr(t)
    return float(arr[max(0, f - w): f + w + 1].max())
grid_low = np.array([at(low, t_first + i * period) if from_t <= t_first + i * period <= from_t + want + 8 else np.nan for i in range(n_all)])
phase = int(np.nanargmax([np.nanmean(grid_low[p::4]) for p in range(4)]))
# 소리가 시작되는 곳(조용한 도입부는 건너뛴다) 이후의 첫 마디 첫 박에서 시작
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
loud = float(np.argmax(rms > rms.max() * 0.12)) * hop / sr
start_i = next(i for i in range(n_all) if i % 4 == phase and t_first + i * period >= max(loud - 0.05, from_t))
t0 = t_first + start_i * period
# 곡이 빨라(분당 130~150박) 박마다 치면 아이들 팔이 못 따라간다. 게임의 한 박 = 음악 두 박(마디의 1·3박)으로 잡는다
music_bpm = bpm
period = period * 2
bpm = bpm / 2
n_beats = int(round(want / period / 8)) * 8  # 8박 단위로
roll = n_beats - 5  # 끝 5박은 연타
env_n = env / (np.percentile(env, 98) + 1e-9)
PATTERN = [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0]  # 손 순서는 치기 좋은 틀(예전 곡과 같다)
beat_s = [at(env_n, t0 + i * period, 2) for i in range(n_beats)]
quiet = np.percentile(beat_s, 20) * 0.6
notes = []
for i in range(4, roll):  # 첫 네 박은 세기만 한다
    if beat_s[i] < quiet:
        continue  # 음악이 쉬는 곳은 같이 쉰다
    if i % 8 == 7:
        notes.append({"beat": i, "lane": 2})  # 여덟 박의 끝은 양손
        continue
    lane = PATTERN[i % 16]
    notes.append({"beat": i, "lane": lane})
    # 반 박(음악의 2·4박, 스네어 자리): 뒤쪽 절반에서 소리가 뚜렷할 때만 다른 손으로 받는다. 연달아 넣지 않는다
    half_s = at(env_n, t0 + (i + 0.5) * period, 2)
    if i >= roll * 0.45 and i % 4 in (1, 3) and half_s > 0.55 and i + 1 < roll:
        notes.append({"beat": i + 0.5, "lane": 1 - lane})
length = (n_beats + 1) * period + 2.5
out = f"public/audio/{name}.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.4f}", "-t", f"{length:.3f}", "-i", src,
                "-af", f"afade=t=out:st={length - 2.0:.3f}:d=2.0", "-ac", "2", "-ar", "44100", "-b:a", "128k", out], check=True)
chart = [[n["beat"], n["lane"]] for n in notes]
print(json.dumps({"name": name, "bpm": round(bpm, 3), "musicBpm": round(music_bpm, 3), "librosaTempo": round(tempo, 2), "drift": round(drift, 3), "firstBeat": round(t0, 3),
                  "phase": phase, "beats": n_beats, "roll": roll, "seconds": round(length, 2), "notes": len(chart),
                  "half": sum(1 for c in chart if c[0] % 1), "left": sum(1 for c in chart if c[1] == 0), "right": sum(1 for c in chart if c[1] == 1),
                  "chart": chart}, ensure_ascii=False))
