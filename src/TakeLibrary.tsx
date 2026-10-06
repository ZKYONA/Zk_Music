export interface RecordedTake {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: number;
  duration: number;
  peaks: number[];
  blob: Blob;
}

interface TakeLibraryProps {
  takes: RecordedTake[];
  onRename: (id: string, name: string) => void;
  onDownload: (take: RecordedTake) => void;
  onDownloadWav: (take: RecordedTake) => void;
  onDelete: (id: string) => void;
}

function formatTakeTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function TakeLibrary({
  takes,
  onRename,
  onDownload,
  onDownloadWav,
  onDelete,
}: TakeLibraryProps) {
  if (takes.length === 0) return null;

  return (
    <section className="take-library" aria-label="Tomas grabadas">
      <div className="take-library-heading">
        <div>
          <p className="eyebrow">TOMAS</p>
          <strong>{takes.length} guardada{takes.length === 1 ? "" : "s"} en este dispositivo</strong>
        </div>
        <span className="chip">Local</span>
      </div>

      <div className="take-list">
        {takes.map((take, index) => (
          <article className="take-card take-card-library" key={take.id}>
            <div className="take-meta">
              <span className="take-number">#{takes.length - index}</span>
              <input
                className="take-name-input"
                value={take.name}
                onChange={(event) => onRename(take.id, event.target.value)}
                aria-label={`Nombre de ${take.name}`}
              />
              <small>{formatTakeTime(take.createdAt)}</small>
            </div>

            <div className="take-preview">
              <div
                className="waveform"
                role="img"
                aria-label={`Forma de onda de ${take.name}`}
              >
                {take.peaks.map((peak, peakIndex) => (
                  <span
                    className="waveform-bar"
                    key={peakIndex}
                    style={{ height: `${Math.max(8, peak * 100)}%` }}
                  />
                ))}
              </div>
              <div className="take-preview-footer">
                <audio controls preload="metadata" src={take.url} />
                <span>{formatDuration(take.duration)}</span>
              </div>
            </div>

            <div className="take-actions">
              <button
                className="primary-button"
                onClick={() => onDownloadWav(take)}
              >
                WAV
              </button>
              <button
                className="ghost-button"
                onClick={() => onDownload(take)}
              >
                Original
              </button>
              <button
                className="ghost-button danger-button"
                onClick={() => onDelete(take.id)}
                aria-label={`Eliminar ${take.name}`}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
