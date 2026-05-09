const DB_NAME = "quant-log-offline-voice";
const DB_VERSION = 1;
const STORE_NAME = "voiceLogs";

const micButton = document.querySelector("[data-mic-button]");
const statusEl = document.querySelector("[data-voice-status]");

let mediaRecorder = null;
let stream = null;
let chunks = [];
let isRecording = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("offline-voice-memo-sw.js").catch(() => {});
}

micButton?.addEventListener("click", async () => {
  if (isRecording) {
    stopRecording();
    return;
  }
  await startRecording();
});

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const mimeType = supportedMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    mediaRecorder.addEventListener("stop", saveRecording);
    mediaRecorder.start();
    isRecording = true;
    micButton.classList.add("is-recording");
    micButton.setAttribute("aria-label", "録音停止");
    setStatus("録音中");
  } catch {
    setStatus("エラー");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  stream?.getTracks().forEach((track) => track.stop());
  isRecording = false;
  micButton.classList.remove("is-recording");
  micButton.setAttribute("aria-label", "録音開始");
}

async function saveRecording() {
  const timestamp = new Date();
  const stamp = formatStamp(timestamp);
  const audioName = `voice-memo-${stamp}.webm`;
  const markdownName = `voice-log-${stamp}.md`;
  const audioBlob = new Blob(chunks, { type: "audio/webm" });

  setStatus("保存中");
  let transcript = "";

  try {
    setStatus("文字起こし中");
    transcript = await transcribeLocally(audioBlob);
  } catch {
    transcript = "文字起こしエンジンで処理できませんでした。音声ファイルは保存済みです。";
  }

  const markdown = buildMarkdown(timestamp, audioName, transcript);

  try {
    await saveLocalRecord({
      id: stamp,
      createdAt: timestamp.toISOString(),
      audioName,
      markdownName,
      audioBlob,
      markdown
    });
    setStatus("ログ保存完了");
  } catch {
    setStatus("エラー");
  }
}

async function transcribeLocally(audioBlob) {
  if (window.quantLogTranscriber?.transcribe) {
    return window.quantLogTranscriber.transcribe(audioBlob);
  }
  return "ローカル文字起こしエンジン未接続。音声ファイルは端末内に保存済みです。";
}

function buildMarkdown(date, audioName, transcript) {
  const humanTime = formatHumanTime(date);
  return `# オフライン音声ログ

## 日時
${humanTime}

## 音声ファイル
${audioName}

## 文字起こし
${transcript}
`;
}

async function saveLocalRecord(record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.addEventListener("complete", resolve);
    tx.addEventListener("error", () => reject(tx.error));
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function supportedMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function formatStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatHumanTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}
