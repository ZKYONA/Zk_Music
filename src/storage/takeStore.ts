export interface StoredTake {
  id: string;
  name: string;
  type: string;
  createdAt: number;
  duration: number;
  peaks: number[];
  blob: Blob;
}

const DB_NAME = "zk-music";
const DB_VERSION = 1;
const STORE_NAME = "takes";

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB no está disponible en este navegador."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Falló el almacenamiento local."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Se canceló el almacenamiento local."));
  });
}

export async function listStoredTakes(): Promise<StoredTake[]> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const items = await new Promise<StoredTake[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as StoredTake[]);
      request.onerror = () =>
        reject(request.error ?? new Error("No se pudieron cargar las tomas."));
    });

    await waitForTransaction(transaction);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}

export async function putStoredTake(take: StoredTake): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(take);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function deleteStoredTake(id: string): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function clearStoredTakes(): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}
