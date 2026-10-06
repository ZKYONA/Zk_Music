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
    <div className="recording-tools" aria-label="Controles de grabación">
      <label className="tool-field">
        <span>
          Beat <output>{beatVolume}%</output>
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
      </label>

      <div className="tool-field">
        <span>Tempo</span>
        <div className="tempo-row">
          <label className="metronome-toggle">
            <input
              type="checkbox"
              checked={metronome}
              onChange={(event) => onMetronomeChange(event.target.checked)}
            />
            <span>Metrónomo</span>
          </label>

          <label className="bpm-field">
            <input
              type="number"
              min="50"
              max="240"
              step="1"
              value={bpm}
              onChange={(event) => onBpmChange(Number(event.target.value))}
              aria-label="Tempo en BPM"
            />
            <span>BPM</span>
          </label>
        </div>
      </div>
    </div>
  );
}
