import type { PitchReading } from "./audio/AudioEngine";
import {
  ROOT_NAMES,
  SCALE_LABELS,
  findNearestScaleTarget,
  getScaleNotes,
  type ScaleMode,
  type TuningSettings,
} from "./audio/tuning";

interface TuningControlsProps {
  reading: PitchReading | null;
  settings: TuningSettings;
  onRootChange: (root: number) => void;
  onScaleChange: (scale: ScaleMode) => void;
}

function formatSignedCents(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} cents`;
}

export function TuningControls({
  reading,
  settings,
  onRootChange,
  onScaleChange,
}: TuningControlsProps) {
  const target = findNearestScaleTarget(reading, settings);
  const scaleNotes = getScaleNotes(settings);

  return (
    <section className="tuning-controls" aria-label="Tonalidad objetivo">
      <div className="tuning-controls-heading">
        <div>
          <p className="eyebrow">OBJETIVO DE AFINACIÓN</p>
          <strong>Tonalidad y escala</strong>
        </div>
        <span className="chip">Base AutoTune</span>
      </div>

      <div className="tuning-selects">
        <label>
          <span>Tónica</span>
          <select
            value={settings.root}
            onChange={(event) => onRootChange(Number(event.target.value))}
          >
            {ROOT_NAMES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Escala</span>
          <select
            value={settings.scale}
            onChange={(event) => onScaleChange(event.target.value as ScaleMode)}
          >
            {(Object.keys(SCALE_LABELS) as ScaleMode[]).map((scale) => (
              <option key={scale} value={scale}>
                {SCALE_LABELS[scale]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scale-note-row" aria-label="Notas permitidas">
        {scaleNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>

      <div className="pitch-target-card">
        <div>
          <small>Nota objetivo</small>
          <strong>
            {target ? (
              <>
                {target.note}
                <span>{target.octave}</span>
              </>
            ) : (
              "—"
            )}
          </strong>
        </div>
        <div>
          <small>Corrección necesaria</small>
          <strong>
            {target ? formatSignedCents(-target.centsToTarget) : "—"}
          </strong>
        </div>
        <div>
          <small>Frecuencia objetivo</small>
          <strong>{target ? `${target.frequency.toFixed(1)} Hz` : "—"}</strong>
        </div>
      </div>

      <small className="pitch-note-help">
        El motor ya calcula a qué nota debería moverse la voz; la corrección audible todavía no está activada.
      </small>
    </section>
  );
}
