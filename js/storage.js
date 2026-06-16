const DB_NAME = 'QuranMemDB';
const STORE_NAME = 'progress';

let isDbSupported = true;
const memoryStore = {};

const initDB = () => {
    if (!window.indexedDB) {
        isDbSupported = false;
        return Promise.reject("IndexedDB not supported");
    }
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => {
                isDbSupported = false;
                reject(request.error);
            };
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        } catch (e) {
            isDbSupported = false;
            reject(e);
        }
    });
};

const saveProgress = async (id, data) => {
    if (!isDbSupported) {
        memoryStore[id] = { id, ...data };
        return true;
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ id, ...data });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IndexedDB save failed, falling back to memory:", e);
        isDbSupported = false;
        memoryStore[id] = { id, ...data };
        return true;
    }
};

const getProgress = async (id) => {
    if (!isDbSupported) {
        return memoryStore[id] || null;
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IndexedDB get failed, falling back to memory:", e);
        isDbSupported = false;
        return memoryStore[id] || null;
    }
};

const getAllProgress = async () => {
    if (!isDbSupported) {
        return Object.values(memoryStore);
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IndexedDB getAll failed, falling back to memory:", e);
        isDbSupported = false;
        return Object.values(memoryStore);
    }
};

const deleteProgress = async (id) => {
    if (!isDbSupported) {
        delete memoryStore[id];
        return true;
    }
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("IndexedDB delete failed, falling back to memory:", e);
        isDbSupported = false;
        delete memoryStore[id];
        return true;
    }
};

window.qDataStorage = { saveProgress, getProgress, getAllProgress, deleteProgress };
