const DB_NAME = "secure-messages";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("encryptedMessages")) {
        db.createObjectStore("encryptedMessages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("shares")) {
        const store = db.createObjectStore("shares", {
          keyPath: ["messageId", "x"],
        });
        store.createIndex("messageId", "messageId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveEncryptedMessage(msg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("encryptedMessages", "readwrite");
    tx.objectStore("encryptedMessages").put(msg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveShare(share) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("shares", "readwrite");
    tx.objectStore("shares").put(share);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getEncryptedMessage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("encryptedMessages", "readonly");
    const req = tx.objectStore("encryptedMessages").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getSharesForMessage(messageId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("shares", "readonly");
    const index = tx.objectStore("shares").index("messageId");
    const req = index.getAll(messageId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getAllEncryptedMessages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("encryptedMessages", "readonly");
    const req = tx.objectStore("encryptedMessages").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getAllShares() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("shares", "readonly");
    const req = tx.objectStore("shares").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Export helpers for use elsewhere
export {
  openDB,
  saveEncryptedMessage,
  saveShare,
  getEncryptedMessage,
  getSharesForMessage,
  getAllEncryptedMessages,
  getAllShares,
};
