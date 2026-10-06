import type { PitchCorrectionSettings } from "./audio/AudioEngine";

interface PitchCorrectionControlsProps {
  settings: PitchCorrectionSettings;
  onChange: (next: PitchCorrectionSettings) => void;
  targetCents: number | null;
  confidence: number;
  supported: boolean;
}

export function PitchCorrectionControls({
  settings,
  onChange,
  targetCents,
  confidence,
  supported,
}: PitchCorrectionControlsProps) {
  const active =
    settings.enabled &&
    targetCents !== null &&
    confidence >= 0.62;

  const update = <K extends keyof PitchCorrectionSettings>(
    key: K,
    value: PitchCorrectionSettings[K],
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <section className="pitch-correction-card" aria-label="Corrección de pitch experimental">
      <div className="pitch-correction-heading">
        <div>
          <p className="eyebrow">CORRECCIÓN EXPERIMENTAL</p>
          <strong>Pitch correction en vivo</strong>
        </div>
        <span className={active ? "chip live-correction-chip" : "chip muted-chip"}>
          {settings.enabled ? (active ? "Corrigiendo" : "Esperando nota") : "Apagado"}
        </span>
      </div>

      <label className="toggle-row correction-toggle">
        <input
          type="checkbox"
          checked={settings.enabled && supported}
          onChange={(event) => update("enabled", event.target.checked)}
          disabled={!supported}
        />
        <span>Activar corrección audible</span>
      </label>

      <div className="correction-presets" aria-label="Presets de corrección">
        <button
          type="button"
          className="ghost-button"
          disabled={!supported}
          onClick={() =>
            onChange({ enabled: true, strength: 50, retuneMs: 140 })
          }
        >
          Natural
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!supported}
          onClick={() =>
            onChange({ enabled: true, strength: 78, retuneMs: 70 })
          }
        >
          Tight
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!supported}
          onClick={() =>
            onChange({ enabled: true, strength: 100, retuneMs: 25 })
          }
        >
          Hard Tune
        </button>
      </div>

      <div className="controls-grid correction-controls-grid">
        <label className="control">
          <span>
            <strong>Fuerza</strong>
            <output>{Math.round(settings.strength)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={settings.strength}
            onChange={(event) => update("strength", Number(event.target.value))}
            disabled={!settings.enabled || !supported}
          />
          <small>Cuánto se acerca la voz a la nota objetivo.</small>
        </label>

        <label className="control">
          <span>
            <strong>Retune</strong>
            <output>{Math.round(settings.retuneMs)} ms</output>
          </span>
          <input
            type="range"
            min="20"
            max="260"
            step="5"
            value={settings.retuneMs}
            onChange={(event) => update("retuneMs", Number(event.target.value))}
            disabled={!settings.enabled || !supported}
          />
          <small>Más bajo = efecto más rápido y artificial.</small>
        </label>

        <div className="control correction-readout">
          <span>
            <strong>Movimiento</strong>
            <output>
              {targetCents === null ? "—" : `${Math.round(targetCents)} cents`}
            </output>
          </span>
          <small>
            Solo corrige cuando la detección de pitch tiene suficiente confianza.
          </small>
        </div>
      </div>

      <p className="prototype-warning">
        {supported
          ? "Prototipo: puede introducir latencia o artefactos. No está marcado como AutoTune final."
          : "Este navegador no cargó el AudioWorklet de corrección; el detector de pitch seguirá funcionando sin modificar la voz."}
      </p>
    </section>
  );
}
