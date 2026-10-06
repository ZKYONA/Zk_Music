interface RecordingControlsProps {
  beatVolume: number;
  onBeatVolumeChange: (value: number) => void;
  metronome: boolean;
  onMetronomeChange: (enabled: boolean) => void;
  bpm: number;
  onBpmChange: (value: number) => void;
}

export function RecordingControls({
  beatVolume,
  onBeatVolumeChange,
  metronome,
  onMetronomeChange,
  bpm,
  onBpmChange,
}: RecordingControlsProps) {
  return (
    <div className="controls-grid recording-controls" aria-label="Controles de grabación">
      <label className="control">
        <span>
          <strong>Beat</strong>
          <output>{beatVolume}%</output>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={beatVolume}
          onChange={(event) => onBeatVolumeChange(Number(event.target.value))}
          aria-label="Volumen del beat"
        />
        <small>Ajusta el beat sin tocar la ganancia de tu voz.</small>
      </label>

      <label className="control">
        <span>
          <strong>Tempo</strong>
          <output>{bpm} BPM</output>
        </span>
        <input
          type="range"
          min="50"
          max="240"
          step="1"
          value={bpm}
          onChange={(event) => onBpmChange(Number(event.target.value))}
          aria-label="Tempo en BPM"
        />
        <small>El metrónomo sigue este tempo durante la grabación.</small>
      </label>

      <label className="control metronome-control">
        <span>
          <strong>Metrónomo</strong>
          <output>{metronome ? "ON" : "OFF"}</output>
        </span>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={metronome}
            onChange={(event) => onMetronomeChange(event.target.checked)}
          />
          <span>Escuchar clic</span>
        </label>
        <small>Suena en tus audífonos y no se graba en la toma.</small>
      </label>
    </div>
  );
}
