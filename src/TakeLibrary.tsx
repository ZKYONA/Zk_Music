export interface RecordedTake {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: number;
}

interface TakeLibraryProps {
  takes: RecordedTake[];
  onRename: (id: string, name: string) => void;
  onDownload: (take: RecordedTake) => void;
  onDelete: (id: string) => void;
}

function formatTakeTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function TakeLibrary({
  takes,
  onRename,
  onDownload,
  onDelete,
}: TakeLibraryProps) {
  if (takes.length === 0) return null;

  return (
    <section className="take-library" aria-label="Tomas grabadas">
      <div className="take-library-heading">
        <div>
          <p className="eyebrow">TOMAS</p>
          <strong>{takes.length} guardada{takes.length === 1 ? "" : "s"} en esta sesión</strong>
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

            <audio controls preload="metadata" src={take.url} />

            <div className="take-actions">
              <button
                className="primary-button"
                onClick={() => onDownload(take)}
              >
                Exportar
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
