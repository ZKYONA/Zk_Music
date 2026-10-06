import { useEffect, useMemo, useRef, useState } from "react";
import { RecordingControls } from "./RecordingControls";
import { TakeLibrary, type RecordedTake } from "./TakeLibrary";
import { loadStudioPreferences, saveStudioPreferences } from "./preferences";
import {
  AudioEngine,
  type AmbienceSettings,
  type VocalFxSettings,
} from "./audio/AudioEngine";
import {
  PERFORMANCE_PROFILES,
  detectDefaultProfile,
  type PerformanceProfile,
} from "./audio/performance";
import { VOCAL_PRESETS } from "./audio/presets";
import {
  VOICE_ENHANCEMENT_PROFILES,
  type VoiceEnhancementMode,
} from "./audio/enhancement";
import {
  VOICE_CHARACTER_PROFILES,
  type VoiceCharacterMode,
} from "./audio/characters";

const INITIAL_FX: VocalFxSettings = {
  highPass: 80,
  low: 0,
  mid: 1,
  high: 1.5,
  compression: 35,
  output: -1,
};

const INITIAL_AMBIENCE: AmbienceSettings = {
  reverb: 12,
  delay: 7,
  delayMs: 145,
  feedback: 18,
};

function formatDb(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
}

function formatPeakDb(peak: number): string {
  const db = 20 * Math.log10(Math.max(peak, 0.0001));
  return `${db.toFixed(1)} dBFS`;
}

function formatRecordingTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export default function App() {
  const savedPreferences = useMemo(() => loadStudioPreferences(), []);
  const initialProfile = useMemo(
    () => savedPreferences.profile ?? detectDefaultProfile(),
    [savedPreferences],
  );
  const engineRef = useRef<AudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new AudioEngine(initialProfile);
  }

  const [profile, setProfile] = useState<PerformanceProfile>(
    savedPreferences.profile ?? initialProfile,
  );
  const [fx, setFx] = useState<VocalFxSettings>(
    savedPreferences.fx ?? INITIAL_FX,
  );
  const [enhancement, setEnhancement] = useState<VoiceEnhancementMode>(
    savedPreferences.enhancement ?? "flagship",
  );
  const [voiceCharacter, setVoiceCharacter] = useState<VoiceCharacterMode>(
    savedPreferences.voiceCharacter ?? "natural",
  );
  const [ambience, setAmbience] = useState<AmbienceSettings>(
    savedPreferences.ambience ?? INITIAL_AMBIENCE,
  );
  const [micReady, setMicReady] = useState(false);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState(
    savedPreferences.inputDeviceId ?? "",
  );
  const [beatName, setBeatName] = useState("");
  const [beatVolume, setBeatVolume] = useState(savedPreferences.beatVolume ?? 85);
  const [metronome, setMetronome] = useState(savedPreferences.metronome ?? false);
  const [bpm, setBpm] = useState(savedPreferences.bpm ?? 120);
  const [recording, setRecording] = useState(false);
  const [monitor, setMonitor] = useState(savedPreferences.monitor ?? false);
  const [calibrating, setCalibrating] = useState(false);
  const [takes, setTakes] = useState<RecordedTake[]>([]);
  const takeUrlsRef = useRef(new Set<string>());
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [clipping, setClipping] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [status, setStatus] = useState("Listo para crear.");
  const [error, setError] = useState("");

  useEffect(() => {
    engineRef.current?.setProfile(profile);
  }, [profile]);

  useEffect(() => {
    engineRef.current?.applyFx(fx);
  }, [fx]);

  useEffect(() => {
    engineRef.current?.setAmbience(ambience);
  }, [ambience]);

  useEffect(() => {
    engineRef.current?.setMonitor(monitor);
  }, [monitor]);

  useEffect(() => {
    engineRef.current?.setBeatVolume(beatVolume / 100);
  }, [beatVolume]);

  useEffect(() => {
    engineRef.current?.setMetronome(metronome, bpm);
  }, [metronome, bpm]);

  useEffect(() => {
    saveStudioPreferences({
      profile,
      fx,
      enhancement,
      voiceCharacter,
      ambience,
      beatVolume,
      metronome,
      bpm,
      monitor,
      inputDeviceId,
    });
  }, [
    profile,
    fx,
    enhancement,
    voiceCharacter,
    ambience,
    beatVolume,
    metronome,
    bpm,
    monitor,
    inputDeviceId,
  ]);

  useEffect(() => {
    void refreshInputDevices();

    const mediaDevices = navigator.mediaDevices;
    const handleDeviceChange = () => {
      void refreshInputDevices();
    };

    mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const metrics = engineRef.current?.getInputMetrics();
      setLevel(metrics?.level ?? 0);
      setPeak(metrics?.peak ?? 0);
      setClipping(metrics?.clipping ?? false);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!recording) return;

    const startedAt = performance.now();
    setRecordingSeconds(0);

    const timer = window.setInterval(() => {
      setRecordingSeconds((performance.now() - startedAt) / 1000);
    }, 100);

    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      takeUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      takeUrlsRef.current.clear();
    };
  }, []);

  function setFxValue<K extends keyof VocalFxSettings>(
    key: K,
    value: VocalFxSettings[K],
  ) {
    setFx((current) => ({ ...current, [key]: value }));
  }

  function setAmbienceValue<K extends keyof AmbienceSettings>(
    key: K,
    value: AmbienceSettings[K],
  ) {
    setAmbience((current) => ({ ...current, [key]: value }));
  }

  function selectVoiceCharacter(mode: VoiceCharacterMode) {
    engineRef.current?.setVoiceCharacter(mode);
    setVoiceCharacter(mode);
    setStatus("Carácter de voz: " + VOICE_CHARACTER_PROFILES[mode].name + ".");
  }

  async function refreshInputDevices() {
    try {
      const devices = await engineRef.current?.listInputDevices();
      const nextDevices = devices ?? [];
      setInputDevices(nextDevices);

      const savedDevice =
        inputDeviceId &&
        nextDevices.find((device) => device.deviceId === inputDeviceId);

      if (savedDevice) {
        await engineRef.current?.setInputDevice(savedDevice.deviceId);
        return;
      }

      if (nextDevices.length > 0) {
        const preferred =
          nextDevices.find((device) => device.deviceId === "default") ??
          nextDevices[0];
        setInputDeviceId(preferred.deviceId);
      }
    } catch {
      setInputDevices([]);
    }
  }

  async function changeInputDevice(deviceId: string) {
    setError("");
    try {
      await engineRef.current?.setInputDevice(deviceId);
      setInputDeviceId(deviceId);
      const selected = inputDevices.find((device) => device.deviceId === deviceId);
      setStatus("Entrada activa: " + (selected?.label || "micrófono seleccionado") + ".");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el micrófono.");
    }
  }

  async function enableMic() {
    setError("");
    try {
      await engineRef.current?.enableMicrophone();
      setMicReady(true);
      await refreshInputDevices();
      setStatus("Micrófono conectado. El audio sigue local.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir el micrófono.");
    }
  }

  async function importBeat(file: File | undefined) {
    if (!file) return;
    setError("");
    setStatus("Cargando beat…");

    try {
      await engineRef.current?.loadBeat(file);
      setBeatName(file.name);
      setStatus("Beat cargado. Puedes grabar encima.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer el beat.");
      setStatus("Error al cargar el beat.");
    }
  }

  async function previewBeat() {
    setError("");
    try {
      await engineRef.current?.playBeat();
      setStatus("Reproduciendo beat.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo reproducir.");
    }
  }

  function stopBeat() {
    engineRef.current?.stopBeat();
    setStatus("Beat detenido.");
  }

  async function startRecording() {
    setError("");
    try {
      await engineRef.current?.startTake(true);
      setMicReady(true);
      setRecording(true);
      setStatus(beatName ? "Grabando voz + beat localmente…" : "Grabando voz localmente…");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la grabación.");
    }
  }

  async function stopRecording() {
    setError("");
    try {
      const blob = await engineRef.current!.stopTake();
      const analysis = await engineRef.current!.analyzeTake(blob);
      const url = URL.createObjectURL(blob);
      takeUrlsRef.current.add(url);

      const createdAt = Date.now();
      const take: RecordedTake = {
        id: crypto.randomUUID(),
        name: `Toma ${takes.length + 1}`,
        url,
        type: blob.type || "audio/webm",
        createdAt,
        duration: analysis.duration,
        peaks: analysis.peaks,
        blob,
      };

      setTakes((current) => [take, ...current]);
      setRecording(false);
      setStatus("Toma guardada en la sesión.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cerrar la toma.");
    }
  }

  async function selectEnhancement(mode: VoiceEnhancementMode) {
    setError("");
    try {
      await engineRef.current?.setEnhancementMode(mode);
      setEnhancement(mode);
      setStatus("Mejora de voz: " + VOICE_ENHANCEMENT_PROFILES[mode].name + ".");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar la mejora de voz.");
    }
  }

  async function calibrateRoom() {
    setError("");
    setCalibrating(true);
    setStatus("Calibrando ruido ambiente…");

    try {
      const threshold = await engineRef.current?.calibrateRoom();
      setMicReady(true);
      setStatus(
        "Sala calibrada. Umbral de ruido: " +
          (threshold?.toFixed(1) ?? "—") +
          " dB.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo calibrar el ruido ambiente.",
      );
    } finally {
      setCalibrating(false);
    }
  }

  function applyPreset(id: string) {
    const preset = VOCAL_PRESETS.find((item) => item.id === id);
    if (!preset) return;

    setFx({
      highPass: preset.highPass,
      low: preset.low,
      mid: preset.mid,
      high: preset.high,
      compression: preset.compression,
      output: preset.output,
    });
    setStatus(`Preset “${preset.name}” aplicado.`);
  }

  function renameTake(id: string, name: string) {
    setTakes((current) =>
      current.map((take) => (take.id === id ? { ...take, name } : take)),
    );
  }

  function deleteTake(id: string) {
    setTakes((current) => {
      const target = current.find((take) => take.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        takeUrlsRef.current.delete(target.url);
      }
      return current.filter((take) => take.id !== id);
    });
    setStatus("Toma eliminada de esta sesión.");
  }

  function downloadTake(take: RecordedTake) {
    const extension = take.type.includes("mp4") ? "m4a" : "webm";
    const anchor = document.createElement("a");
    anchor.href = take.url;
    anchor.download = `${take.name.trim() || "zk-music-take"}.${extension}`;
    anchor.click();
  }

  async function downloadWavTake(take: RecordedTake) {
    setError("");
    setStatus("Preparando WAV localmente…");

    try {
      const wav = await engineRef.current!.convertToWav(take.blob);
      const url = URL.createObjectURL(wav);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${take.name.trim() || "zk-music-take"}.wav`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("WAV exportado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar a WAV.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ZK</div>
          <div>
            <strong>ZK Music</strong>
            <span>Local Studio</span>
          </div>
        </div>

        <nav>
          <button className="nav-item active" aria-current="page">Estudio</button>
          <button className="nav-item" disabled>Instrumentos <small>pronto</small></button>
          <button className="nav-item" disabled>Master IA <small>pronto</small></button>
          <button className="nav-item" disabled>Proyectos <small>pronto</small></button>
        </nav>

        <section className="privacy-card">
          <span className="status-dot" />
          <div>
            <strong>Local-first</strong>
            <p>Tu audio no se sube a ningún servidor en este MVP.</p>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">PROYECTO NUEVO</p>
            <h1>Tu estudio, sin el laberinto.</h1>
          </div>
          <div className="engine-state">
            <span className={micReady ? "status-dot live" : "status-dot"} />
            {micReady ? "Micrófono listo" : "Motor local"}
          </div>
        </header>

        <section className="hero-grid">
          <article className="panel recorder-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">01 · GRABAR</p>
                <h2>Beat + voz</h2>
              </div>
              <div className="recording-meter-block">
                <div className="recording-meter-meta">
                  <span className={clipping ? "clip-warning active" : "clip-warning"}>
                    {clipping ? "CLIP" : formatPeakDb(peak)}
                  </span>
                  <span>{recording ? formatRecordingTime(recordingSeconds) : "Listo"}</span>
                </div>
                <div
                  className={clipping ? "meter clipping" : "meter"}
                  role="progressbar"
                  aria-label="Nivel de entrada del micrófono"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(level * 100)}
                >
                  <div className="meter-fill" style={{ width: `${Math.max(2, level * 100)}%` }} />
                </div>
              </div>
            </div>

            <label className="drop-zone">
              <input
                type="file"
                accept="audio/*"
                onChange={(event) => void importBeat(event.target.files?.[0])}
              />
              <span className="drop-icon">＋</span>
              <strong>{beatName || "Importa tu beat"}</strong>
              <small>{beatName ? "Archivo cargado localmente" : "MP3, WAV, M4A y formatos compatibles"}</small>
            </label>

            <RecordingControls
              beatVolume={beatVolume}
              onBeatVolumeChange={setBeatVolume}
              metronome={metronome}
              onMetronomeChange={setMetronome}
              bpm={bpm}
              onBpmChange={setBpm}
              inputDevices={inputDevices}
              selectedInputDeviceId={inputDeviceId}
              onInputDeviceChange={(deviceId) => void changeInputDevice(deviceId)}
              inputDeviceDisabled={recording}
            />

            <div className="transport">
              <button className="ghost-button" onClick={enableMic}>
                {micReady ? "Mic listo" : "Activar mic"}
              </button>
              <button className="ghost-button" onClick={previewBeat} disabled={!beatName || recording}>
                ▶ Beat
              </button>
              <button
                className="ghost-button"
                onClick={stopBeat}
                disabled={!beatName}
                aria-label="Detener beat"
              >
                ■
              </button>

              {!recording ? (
                <button className="record-button" onClick={startRecording}>
                  <span /> Grabar
                </button>
              ) : (
                <button className="record-button recording" onClick={stopRecording}>
                  <span /> Detener
                </button>
              )}
            </div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={monitor}
                onChange={(event) => setMonitor(event.target.checked)}
              />
              <span>Monitorear mi voz</span>
              <small>Usa audífonos para evitar feedback.</small>
            </label>

            <TakeLibrary
              takes={takes}
              onRename={renameTake}
              onDownload={downloadTake}
              onDownloadWav={(take) => void downloadWavTake(take)}
              onDelete={deleteTake}
            />
          </article>

          <article className="panel profile-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">MOTOR</p>
                <h2>Rendimiento</h2>
              </div>
              <span className="chip">{PERFORMANCE_PROFILES[profile].sampleRate / 1000} kHz</span>
            </div>

            <div className="profile-list">
              {(Object.keys(PERFORMANCE_PROFILES) as PerformanceProfile[]).map((id) => (
                <button
                  key={id}
                  className={`profile-option ${profile === id ? "selected" : ""}`}
                  onClick={() => setProfile(id)}
                  disabled={recording}
                >
                  <div>
                    <strong>{PERFORMANCE_PROFILES[id].label}</strong>
                    <span>{PERFORMANCE_PROFILES[id].description}</span>
                  </div>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="panel enhancement-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 · CALIDAD DE MICRÓFONO</p>
              <h2>Mejora de voz local</h2>
            </div>
            <span className="chip">Sin nube</span>
          </div>

          <div className="preset-row">
            {(Object.keys(VOICE_ENHANCEMENT_PROFILES) as VoiceEnhancementMode[]).map((mode) => {
              const item = VOICE_ENHANCEMENT_PROFILES[mode];
              return (
                <button
                  key={mode}
                  className={"preset-button " + (enhancement === mode ? "selected-preset" : "")}
                  onClick={() => void selectEnhancement(mode)}
                  disabled={recording}
                >
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </button>
              );
            })}
          </div>

          <div className="quality-actions">
            <button
              className="primary-button"
              onClick={() => void calibrateRoom()}
              disabled={recording || calibrating}
            >
              {calibrating ? "Calibrando…" : "Calibrar sala"}
            </button>
            <p className="quality-note">
              Flagship Studio usa reducción de ruido del dispositivo cuando está disponible,
              puerta de ruido local, ecualización de claridad, control de sibilancia,
              compresión y limitador. “Calibrar sala” mide el ruido real de tu entorno y
              ajusta el filtro automáticamente.
            </p>
          </div>
        </section>

        <section className="panel character-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">03 · CARÁCTER Y AMBIENTE</p>
              <h2>Color de voz y espacio</h2>
            </div>
            <span className="chip">Tiempo real</span>
          </div>

          <div className="preset-row character-presets">
            {(Object.keys(VOICE_CHARACTER_PROFILES) as VoiceCharacterMode[]).map((mode) => {
              const item = VOICE_CHARACTER_PROFILES[mode];
              return (
                <button
                  key={mode}
                  className={"preset-button " + (voiceCharacter === mode ? "selected-preset" : "")}
                  onClick={() => selectVoiceCharacter(mode)}
                  aria-pressed={voiceCharacter === mode}
                >
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </button>
              );
            })}
          </div>

          <div className="controls-grid ambience-grid">
            <label className="control">
              <span><strong>Reverb</strong><output>{Math.round(ambience.reverb)}%</output></span>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={ambience.reverb}
                onChange={(event) => setAmbienceValue("reverb", Number(event.target.value))}
              />
              <small>Espacio y profundidad sin subir tu audio a la nube.</small>
            </label>

            <label className="control">
              <span><strong>Delay</strong><output>{Math.round(ambience.delay)}%</output></span>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={ambience.delay}
                onChange={(event) => setAmbienceValue("delay", Number(event.target.value))}
              />
              <small>Eco paralelo para melodías, ad-libs y finales de frase.</small>
            </label>

            <label className="control">
              <span><strong>Tiempo</strong><output>{Math.round(ambience.delayMs)} ms</output></span>
              <input
                type="range"
                min="60"
                max="650"
                step="5"
                value={ambience.delayMs}
                onChange={(event) => setAmbienceValue("delayMs", Number(event.target.value))}
              />
              <small>Separación temporal de cada repetición.</small>
            </label>

            <label className="control">
              <span><strong>Feedback</strong><output>{Math.round(ambience.feedback)}%</output></span>
              <input
                type="range"
                min="0"
                max="65"
                step="1"
                value={ambience.feedback}
                onChange={(event) => setAmbienceValue("feedback", Number(event.target.value))}
              />
              <small>Cuánto se repite el delay antes de apagarse.</small>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">04 · SONIDO</p>
              <h2>Cadena vocal simple</h2>
            </div>
            <span className="chip">Tiempo real</span>
          </div>

          <div className="preset-row">
            {VOCAL_PRESETS.map((preset) => (
              <button key={preset.id} className="preset-button" onClick={() => applyPreset(preset.id)}>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
            <button className="preset-button locked" disabled>
              <strong>AutoTune</strong>
              <small>Pitch correction real — siguiente etapa.</small>
            </button>
          </div>

          <div className="controls-grid">
            <label className="control">
              <span><strong>Filtro</strong><output>{fx.highPass} Hz</output></span>
              <input type="range" min="40" max="180" step="1" value={fx.highPass}
                onChange={(event) => setFxValue("highPass", Number(event.target.value))} />
              <small>Limpia graves innecesarios.</small>
            </label>

            <label className="control">
              <span><strong>Graves</strong><output>{formatDb(fx.low)}</output></span>
              <input type="range" min="-8" max="8" step="0.5" value={fx.low}
                onChange={(event) => setFxValue("low", Number(event.target.value))} />
              <small>Cuerpo de la voz.</small>
            </label>

            <label className="control">
              <span><strong>Presencia</strong><output>{formatDb(fx.mid)}</output></span>
              <input type="range" min="-8" max="8" step="0.5" value={fx.mid}
                onChange={(event) => setFxValue("mid", Number(event.target.value))} />
              <small>Hace que la voz corte la mezcla.</small>
            </label>

            <label className="control">
              <span><strong>Brillo</strong><output>{formatDb(fx.high)}</output></span>
              <input type="range" min="-8" max="8" step="0.5" value={fx.high}
                onChange={(event) => setFxValue("high", Number(event.target.value))} />
              <small>Aire y definición.</small>
            </label>

            <label className="control">
              <span><strong>Compresión</strong><output>{Math.round(fx.compression)}%</output></span>
              <input type="range" min="0" max="100" step="1" value={fx.compression}
                onChange={(event) => setFxValue("compression", Number(event.target.value))} />
              <small>Nivela la interpretación.</small>
            </label>

            <label className="control">
              <span><strong>Salida</strong><output>{formatDb(fx.output)}</output></span>
              <input type="range" min="-12" max="3" step="0.5" value={fx.output}
                onChange={(event) => setFxValue("output", Number(event.target.value))} />
              <small>Ganancia final de la voz.</small>
            </label>
          </div>
        </section>

        <footer className="footer">
          <div role={error ? "alert" : "status"} aria-live="polite">
            <span className={error ? "status-dot error-dot" : "status-dot live"} />
            <span>{error || status}</span>
          </div>
          <span>ZK Music MVP · procesamiento local</span>
        </footer>
      </section>
    </main>
  );
}
