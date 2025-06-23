import { getAllEncryptedMessages, getAllShares } from "./storage.js";
import { reconstructSecret } from "./crypto.js";

export async function renderMessageList() {
  if (document.readyState === "loading") {
    console.log("reset");
    document.addEventListener("DOMContentLoaded", renderMessageList, {
      once: true,
    });
    return;
  }

  const messages = await getAllEncryptedMessages();
  const shares = await getAllShares();
  const list = document.getElementById("message-list");
  if (!messages.length) {
    list.innerHTML =
      '<div class="text-gray-400">No messages collected yet.</div>';
    return;
  }

  list.innerHTML = "";

  for (const msg of messages) {
    const msgShares = shares.filter((s) => s.messageId === msg.id);
    const shareCount = msgShares.length;

    let threshold = msg.threshold;
    const progress = Math.min(100, Math.round((shareCount / threshold) * 100));

    const msgDiv = document.createElement("div");
    msgDiv.className =
      "border border-gray-300 rounded-xl p-4 flex flex-col gap-4 cursor-pointer transition mb-3";
    msgDiv.innerHTML = `
      <div class="flex justify-between items-end mb-1">
        <div class="text-sm font-medium text-gray-700">
          ${msg.id}
        </div>
        <div class="text-sm text-gray-500">
          ${shareCount}/${threshold}
        </div>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div class="bg-blue-600 h-3 rounded-full" style="width: ${progress}%"></div>
      </div>
    `;
    msgDiv.addEventListener("click", () => showMessageOverlay(msg, msgShares));
    list.appendChild(msgDiv);
  }
}

function showMessageOverlay(msg, shares) {
  const overlay = document.getElementById("progress-overlay");
  const content = document.getElementById("progress-overlay-content");
  if (!overlay || !content) return;

  shares = shares
    .slice()
    .sort((a, b) => (a.scannedAt || 0) - (b.scannedAt || 0));

  // UI for reconstructing secret
  let canReconstruct = shares.length >= msg.threshold;
  let reconstructBtn = canReconstruct
    ? `<button id="reconstruct-secret-btn" class="mt-4 px-4 py-2 rounded bg-green-600 text-white font-semibold">Reconstruct Secret</button>`
    : "";

  content.innerHTML = `
   <div class="mb-2 text-gray-700 break-all space-y-1">
     <div>
       <b>ID:</b>
       <span class="font-mono text-sm bg-gray-50 rounded px-2 py-1 truncate overflow-x-auto">${msg.id}</span>
     </div>
     <div>
       <b >Created:</b>
       <span>${new Date(msg.createdAt * 1000).toLocaleString()}</span>
     </div>
     <div>
       <b>Shares collected:</b>
       <span>${shares.length}/${msg.threshold}</span>
     </div>
     <div class="mt-2 mb-2 flex items-center gap-2">
       <b class="shrink-0">Sender Public Key:</b>
       <span class="font-mono text-sm bg-gray-50 rounded px-2 py-1 truncate overflow-x-auto">${Array.from(
         msg.senderPublicKey,
       )
         .map((x) => x.toString(16).padStart(2, "0"))
         .join("")}</span>
     </div>
     <div class="mt-2 mb-2 flex items-center gap-2">
       <b class="shrink-0">Ciphertext:</b>
       <span class="font-mono text-sm bg-gray-50 rounded px-2 py-1 truncate overflow-x-auto">${Array.from(
         msg.ciphertext,
       )
         .map((x) => x.toString(16).padStart(2, "0"))
         .join("")}</span>
     </div>
     <div>
       <b>Nonce:</b>
       <span class="font-mono text-sm bg-gray-50 rounded px-2 py-1 truncate overflow-x-auto">${Array.from(
         msg.nonce,
       )
         .map((x) => x.toString(16).padStart(2, "0"))
         .join("")}</span>
     </div>
   </div>
   <div class="mb-2">
     <b>Shares:</b>
     <div class="flex flex-wrap gap-2 mt-2">
       ${
         shares.length
           ? shares
               .map(
                 (s) =>
                   `<span class="inline-block bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-xs font-mono">${s.x}</span>`,
               )
               .join("")
           : `<span class="text-gray-400">No shares</span>`
       }
     </div>
   </div>
   <div id="reconstruct-secret-result" class="my-2"></div>
   ${reconstructBtn}
 `;
  overlay.classList.remove("hidden");

  // attach reconstruct button handler
  if (canReconstruct) {
    const btn = document.getElementById("reconstruct-secret-btn");
    if (btn) {
      btn.onclick = async () => {
        const resultDiv = document.getElementById("reconstruct-secret-result");
        resultDiv.textContent = "Reconstructing...";
        try {
          const PRIME =
            "0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff";
          const secret = await reconstructSecret(
            shares.slice(0, msg.threshold),
            PRIME,
            msg.senderPublicKey,
          );
          let secretStr = secret.toString();
          resultDiv.innerHTML = `
            <div class="mt-2 mb-2 flex items-center gap-2">
              <b class="shrink-0">Secret:</b>
              <span class="font-mono text-sm bg-gray-50 rounded px-2 py-1 truncate overflow-x-auto" title="${secretStr}">
                ${secretStr}
              </span>
            </div>
          `;

          // decrypt the message using AES-GCM
          if (msg.ciphertext && msg.nonce) {
            try {
              // convert secret from BigInt to Uint8Array (32 bytes)
              let secretHex = secret.toString(16).padStart(64, "0");
              let secretBytes = new Uint8Array(32);
              for (let i = 0; i < 32; ++i) {
                secretBytes[i] = parseInt(
                  secretHex.slice(i * 2, i * 2 + 2),
                  16,
                );
              }

              const subtle = window.crypto.subtle;
              const key = await subtle.importKey(
                "raw",
                secretBytes,
                { name: "AES-GCM" },
                false,
                ["decrypt"],
              );
              const plaintextBuf = await subtle.decrypt(
                {
                  name: "AES-GCM",
                  iv: msg.nonce,
                },
                key,
                msg.ciphertext,
              );

              // Try to decode as UTF-8 string
              let plaintext;
              try {
                plaintext = new TextDecoder().decode(
                  new Uint8Array(plaintextBuf),
                );
              } catch {
                plaintext = "";
              }
              if (plaintext && plaintext.trim()) {
                resultDiv.innerHTML += `
                  <div class="mt-4">
                    <b>Message:</b>
                    <div class="font-mono text-sm bg-gray-50 rounded px-2 py-2 break-words whitespace-pre-wrap max-h-40 overflow-auto border border-gray-200 mt-1">${plaintext.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                  </div>
                `;
              } else {
                resultDiv.innerHTML += `
                  <div class="mt-4 text-red-500 font-mono">Decryption succeeded, but message is empty or not valid UTF-8.</div>
                `;
              }
            } catch (e) {
              resultDiv.innerHTML += `<div class="mt-4 text-red-500 font-mono">Decryption failed: ${e && e.message ? e.message : e}</div>`;
            }
          }
        } catch (err) {
          resultDiv.textContent =
            "Failed to reconstruct secret: " +
            (err && err.message ? err.message : err);
        }
      };
    }
  }
}

// attach close handler
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("progress-overlay");
  const closeBtn = document.getElementById("close-overlay-btn");
  if (closeBtn && overlay) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      overlay.classList.add("hidden");
    };
  }
  if (overlay) {
    overlay.onclick = function (e) {
      if (e.target === overlay) overlay.classList.add("hidden");
    };
  }
});
