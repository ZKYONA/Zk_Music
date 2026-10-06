import type { PitchReading } from "./audio/AudioEngine";

interface PitchMonitorProps {
  reading: PitchReading | null;
  active: boolean;
}

function formatSignedCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? "+" : ""}${rounded} cents`;
}

export function PitchMonitor({ reading, active }: PitchMonitorProps) {
  const cents = reading?.cents ?? 0;
  const pointer = Math.max(0, Math.min(100, 50 + cents));
  const tuned = reading ? Math.abs(reading.cents) <= 8 : false;

  return (
    <section className="pitch-monitor" aria-label="Detector de afinación">
      <div className="pitch-monitor-heading">
        <div>
          <p className="eyebrow">PITCH EN VIVO</p>
          <strong>Detector de nota</strong>
        </div>
        <span className={active ? "chip" : "chip muted-chip"}>
          {active ? "Analizando" : "Activa el mic"}
        </span>
      </div>

      <div className="pitch-readout" aria-live="polite">
        <div className={tuned ? "pitch-note tuned" : "pitch-note"}>
          {reading ? (
            <>
              <strong>{reading.note}</strong>
              <span>{reading.octave}</span>
            </>
          ) : (
            <strong>—</strong>
          )}
        </div>

        <div className="pitch-stats">
          <span>
            <strong>{reading ? `${reading.frequency.toFixed(1)} Hz` : "Sin señal"}</strong>
            <small>Frecuencia</small>
          </span>
          <span>
            <strong>{reading ? formatSignedCents(reading.cents) : "—"}</strong>
            <small>Desviación</small>
          </span>
          <span>
            <strong>
              {reading ? `${Math.round(reading.confidence * 100)}%` : "—"}
            </strong>
            <small>Confianza</small>
          </span>
        </div>
      </div>

      <div
        className="tuning-track"
        role="meter"
        aria-label="Desviación de afinación"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={reading ? Math.round(reading.cents) : 0}
      >
        <span className="tuning-center" />
        <span
          className={tuned ? "tuning-pointer tuned" : "tuning-pointer"}
          style={{ left: `${pointer}%` }}
        />
      </div>

      <div className="tuning-labels" aria-hidden="true">
        <span>−50</span>
        <span>0</span>
        <span>+50</span>
      </div>

      <small className="pitch-note-help">
        Esto solo mide la afinación; todavía no modifica el pitch de la voz.
      </small>
    </section>
  );
}
