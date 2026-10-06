import type { PitchCorrectionSettings } from "./audio/AudioEngine";

interface PitchCorrectionControlsProps {
  settings: PitchCorrectionSettings;
  onChange: (next: PitchCorrectionSettings) => void;
  targetCents: number | null;
  confidence: number;
}

export function PitchCorrectionControls({
  settings,
  onChange,
  targetCents,
  confidence,
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
          checked={settings.enabled}
          onChange={(event) => update("enabled", event.target.checked)}
        />
        <span>Activar corrección audible</span>
      </label>

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
            disabled={!settings.enabled}
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
            disabled={!settings.enabled}
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
        Prototipo: puede introducir latencia o artefactos. No está marcado como AutoTune final.
      </p>
    </section>
  );
}
