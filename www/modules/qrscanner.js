import {
  saveEncryptedMessage,
  saveShare,
  getEncryptedMessage,
} from "./storage.js";
import { renderMessageList } from "./ui.js";
import { verifyEd25519Signature } from "./crypto.js";

let stream = null;
let scanning = false;
let switching = false;
let facingMode = "environment";
let fps = 5;
let detector = null;
let scanLoopTimeout = null;

const video = document.getElementById("camera-video");
const placeholder = document.getElementById("placeholder");
const startBtn = document.getElementById("start-scan-btn");
const stopBtn = document.getElementById("stop-scan-btn");
const switchBtn = document.getElementById("switch-camera-btn");

function updateScanControls(scanningNow) {
  if (scanningNow) {
    startBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    switchBtn.classList.remove("hidden");
  } else {
    startBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    switchBtn.classList.add("hidden");
  }
}

async function startScan() {
  if (scanning) return;
  try {
    await startCamera();
    detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    scanning = true;
    updateScanControls(true);
    scanLoop();
  } catch (err) {
    placeholder.textContent = "Camera access denied";
    placeholder.classList.remove("text-gray-400");
    placeholder.classList.add("text-red-500");
    placeholder.classList.remove("hidden");
    video.classList.add("hidden");
    updateScanControls(false);
  }
}

function stopScan() {
  scanning = false;
  if (scanLoopTimeout) clearTimeout(scanLoopTimeout);
  stopCameraStream();
  updateScanControls(false);
}

async function switchCamera() {
  if (switching) return;
  switching = true;
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
  if (scanning) {
    if (scanLoopTimeout) clearTimeout(scanLoopTimeout);
    updateScanControls(true);
    scanLoop();
  }
  switching = false;
}

function stopCameraStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.add("hidden");
  }
}

async function startCamera() {
  stopCameraStream();
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
  });
  if (video) {
    video.srcObject = stream;
    video.classList.remove("hidden");
    video.play();
  }
  placeholder.classList.add("hidden");
}

const seenQRCodes = new Set();

async function scanLoop() {
  if (!scanning) return;
  if (!detector) return;
  if (video.readyState < 2) {
    scanLoopTimeout = setTimeout(scanLoop, 1000 / fps);
    return;
  }
  try {
    const barcodes = await detector.detect(video);
    if (barcodes.length > 0) {
      const qrValue = barcodes[0].rawValue;
      if (!seenQRCodes.has(qrValue)) {
        await handleQrPayload(qrValue);
      }
    }
  } catch (err) {
    console.error(
      "QR detection error: " + (err && err.message ? err.message : err),
    );
  }
  scanLoopTimeout = setTimeout(scanLoop, 1000 / fps);
}

async function handleQrPayload(qrText) {
  function base64ToBytes(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  let obj, objRaw, signature;
  try {
    // qrText is formatted as base64(json payload)+"."+base64(signature) in case of shares
    const parts = qrText.split(".");
    obj = JSON.parse(atob(parts[0]));
    if (parts.length > 1) {
      objRaw = atob(parts[0]);
      signature = base64ToBytes(parts[1]);
    }
    console.log("Parsed QR code:", qrText);
  } catch {
    notyf.error("Invalid QR code: not valid JSON");
    return;
  }

  if (obj.type === "encryptedMessage") {
    obj.ciphertext = base64ToBytes(obj.ciphertext);
    obj.nonce = base64ToBytes(obj.nonce);
    obj.senderPublicKey = base64ToBytes(obj.senderPublicKey);
    await saveEncryptedMessage(obj);
    seenQRCodes.add(qrText);
    notyf.success("Encrypted message saved!");
    renderMessageList();
  } else if (obj.type === "share") {
    if (!obj.messageId || !obj.x || !obj.y) {
      notyf.error("Invalid share QR code: missing required fields");
      return;
    } else if (!signature) {
      notyf.error("Invalid share QR code: missing signature");
      return;
    }

    // verify share signature
    const msg = await getEncryptedMessage(obj.messageId);
    if (!msg || !msg.senderPublicKey) {
      notyf.error("Cannot verify share: corresponding message not found.");
      return;
    }
    const valid = await verifyEd25519Signature(
      msg.senderPublicKey,
      objRaw,
      signature,
    );
    if (!valid) {
      notyf.error("Invalid share signature. Share not saved.");
      return;
    }
    console.log("Share signature verified successfully");

    // parse x and y values
    const xBytes = base64ToBytes(obj.x);
    obj.x = "0x" + bytesToHex(xBytes);

    const yBytes = base64ToBytes(obj.y);
    obj.y = "0x" + bytesToHex(yBytes);

    await saveShare({
      messageId: obj.messageId,
      x: obj.x,
      y: obj.y,
      scannedAt: Date.now(),
    });
    notyf.success("Share saved!");
    seenQRCodes.add(qrText);
    renderMessageList();
  } else {
    notyf.error("Unknown QR code type");
  }
}

export function setupQrScanner() {
  startBtn.addEventListener("click", startScan);
  stopBtn.addEventListener("click", () => {
    stopScan();
    video.classList.add("hidden");
    placeholder.textContent = "[ Camera input ]";
    placeholder.classList.remove("text-red-500");
    placeholder.classList.add("text-gray-400");
    placeholder.classList.remove("hidden");
  });
  switchBtn.addEventListener("click", async () => {
    try {
      await switchCamera();
    } catch (err) {
      placeholder.textContent = "Camera access denied";
      placeholder.classList.remove("text-gray-400");
      placeholder.classList.add("text-red-500");
      placeholder.classList.remove("hidden");
      video.classList.add("hidden");
      stopScan();
    }
  });

  // Initial UI state
  updateScanControls(false);
  video.classList.add("hidden");
}
