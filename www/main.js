import { setupQrScanner } from "/modules/qrscanner.js";
import { renderMessageList } from "/modules/ui.js";
import { openDB } from "/modules/storage.js";

document.addEventListener("DOMContentLoaded", () => {
  setupQrScanner();
  renderMessageList();

  // hidden button to clear all messages and shares
  const title = document.querySelector("h1");
  if (title) {
    title.style.cursor = "pointer";
    title.title = "Click to clear all messages and shares";
    title.onclick = async () => {
      const confirmed = confirm(
        "Are you sure you want to clear all messages and shares?",
      );
      if (!confirmed) return;
      const db = await openDB();
      const tx1 = db.transaction("encryptedMessages", "readwrite");
      tx1.objectStore("encryptedMessages").clear();
      const tx2 = db.transaction("shares", "readwrite");
      tx2.objectStore("shares").clear();
      await Promise.all([
        new Promise((resolve) => (tx1.oncomplete = resolve)),
        new Promise((resolve) => (tx2.oncomplete = resolve)),
      ]);
      if (window.notyf) window.notyf.success("Database cleared!");
      renderMessageList();
    };
  }
});
