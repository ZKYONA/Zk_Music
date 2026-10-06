import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioEngine,
  type SpaceFxSettings,
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

const INITIAL_SPACE_FX: SpaceFxSettings = {
  reverb: 18,
  delay: 10,
  feedback: 22,
  bpm: 120,
};

function formatDb(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
}

export default function App() {
  const initialProfile = useMemo(() => detectDefaultProfile(), []);
  const engineRef = useRef<AudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new AudioEngine(initialProfile);
  }

  const [profile, setProfile] = useState<PerformanceProfile>(initialProfile);
  const [fx, setFx] = useState<VocalFxSettings>(INITIAL_FX);
  const [spaceFx, setSpaceFx] = useState<SpaceFxSettings>(INITIAL_SPACE_FX);
  const [enhancement, setEnhancement] = useState<VoiceEnhancementMode>("flagship");
  const [character, setCharacter] = useState<VoiceCharacterMode>("natural");
  const [micReady, setMicReady] = useState(false);
  const [beatName, setBeatName] = useState("");
  const [recording, setRecording] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [takeUrl, setTakeUrl] = useState("");
  const [takeType, setTakeType] = useState("audio/webm");
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState("Listo para crear.");
  const [error, setError] = useState("");

  useEffect(() => {
    engineRef.current?.setProfile(profile);
  }, [profile]);

  useEffect(() => {
    engineRef.current?.applyFx(fx);
  }, [fx]);

  useEffect(() => {
    engineRef.current?.applySpaceFx(spaceFx);
  }, [spaceFx]);

  useEffect(() => {
    engineRef.current?.setVoiceCharacterMode(character);
  }, [character]);

  useEffect(() => {
    engineRef.current?.setMonitor(monitor);
  }, [monitor]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setLevel(engineRef.current?.getInputLevel() ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  function setFxValue<K extends keyof VocalFxSettings>(
    key: K,
    value: VocalFxSettings[K],
  ) {
    setFx((current) => ({ ...current, [key]: value }));
  }

  function setSpaceFxValue<K extends keyof SpaceFxSettings>(
    key: K,
    value: SpaceFxSettings[K],
  ) {
    setSpaceFx((current) => ({ ...current, [key]: value }));
  }

  async function enableMic() {
    setError("");
    try {
      await engineRef.current?.enableMicrophone();
      setMicReady(true);
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
      if (takeUrl) URL.revokeObjectURL(takeUrl);
      const url = URL.createObjectURL(blob);
      setTakeUrl(url);
      setTakeType(blob.type || "audio/webm");
      setRecording(false);
      setStatus("Toma lista. Revisa y exporta.");
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

  function selectCharacter(mode: VoiceCharacterMode) {
    setError("");
    engineRef.current?.setVoiceCharacterMode(mode);
    setCharacter(mode);
    setStatus("Carácter vocal: " + VOICE_CHARACTER_PROFILES[mode].name + ".");
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

  function downloadTake() {
    if (!takeUrl) return;
    const extension = takeType.includes("mp4") ? "m4a" : "webm";
    const anchor = document.createElement("a");
    anchor.href = takeUrl;
    anchor.download = `zk-music-take-${Date.now()}.${extension}`;
    anchor.click();
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
          <button className="nav-item active">Estudio</button>
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
              <div
                className="meter"
                role="progressbar"
                aria-label="Nivel de entrada"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(level * 100)}
              >
                <div className="meter-fill" style={{ width: `${Math.max(2, level * 100)}%` }} />
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

            <div className="transport">
              <button className="ghost-button" onClick={enableMic}>
                {micReady ? "Mic listo" : "Activar mic"}
              </button>
              <button className="ghost-button" onClick={previewBeat} disabled={!beatName || recording}>
                ▶ Beat
              </button>
              <button className="ghost-button" onClick={stopBeat} disabled={!beatName}>
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

            {takeUrl && (
              <div className="take-card">
                <div>
                  <p className="eyebrow">ÚLTIMA TOMA</p>
                  <strong>Lista para revisar</strong>
                </div>
                <audio controls src={takeUrl} />
                <button className="primary-button" onClick={downloadTake}>Exportar</button>
              </div>
            )}
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
                  aria-pressed={profile === id}
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
                  aria-pressed={enhancement === mode}
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

        <section className="creative-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">03 · CARÁCTER</p>
                <h2>Color vocal</h2>
              </div>
              <span className="chip">Live FX</span>
            </div>

            <div className="character-grid">
              {(Object.keys(VOICE_CHARACTER_PROFILES) as VoiceCharacterMode[]).map((mode) => {
                const item = VOICE_CHARACTER_PROFILES[mode];
                return (
                  <button
                    key={mode}
                    className={"character-button " + (character === mode ? "selected-character" : "")}
                    onClick={() => selectCharacter(mode)}
                    disabled={recording}
                    aria-pressed={character === mode}
                  >
                    <span className="character-orb" aria-hidden="true" />
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">04 · ESPACIO</p>
                <h2>Reverb + delay</h2>
              </div>
              <span className="chip">1/8 sync</span>
            </div>

            <div className="tempo-card">
              <div>
                <strong>Tempo</strong>
                <small>Sincroniza el delay en corcheas.</small>
              </div>
              <label className="tempo-input">
                <span className="sr-only">Tempo en BPM</span>
                <input
                  type="number"
                  min="50"
                  max="220"
                  value={spaceFx.bpm}
                  onChange={(event) => setSpaceFxValue("bpm", Number(event.target.value))}
                />
                <span>BPM</span>
              </label>
            </div>

            <div className="space-controls">
              <label className="control compact-control">
                <span><strong>Reverb</strong><output>{Math.round(spaceFx.reverb)}%</output></span>
                <input type="range" min="0" max="100" step="1" value={spaceFx.reverb}
                  onChange={(event) => setSpaceFxValue("reverb", Number(event.target.value))} />
                <small>Ambiente estéreo generado localmente.</small>
              </label>

              <label className="control compact-control">
                <span><strong>Delay</strong><output>{Math.round(spaceFx.delay)}%</output></span>
                <input type="range" min="0" max="100" step="1" value={spaceFx.delay}
                  onChange={(event) => setSpaceFxValue("delay", Number(event.target.value))} />
                <small>Eco sincronizado al tempo.</small>
              </label>

              <label className="control compact-control">
                <span><strong>Feedback</strong><output>{Math.round(spaceFx.feedback)}%</output></span>
                <input type="range" min="0" max="100" step="1" value={spaceFx.feedback}
                  onChange={(event) => setSpaceFxValue("feedback", Number(event.target.value))} />
                <small>Controla cuánto se repite el eco.</small>
              </label>
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">05 · SONIDO</p>
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
          <div role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
            <span className={error ? "status-dot error-dot" : "status-dot live"} />
            <span>{error || status}</span>
          </div>
          <span>ZK Music MVP · procesamiento local</span>
        </footer>
      </section>
    </main>
  );
}
