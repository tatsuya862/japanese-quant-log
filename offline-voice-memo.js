const DB_NAME = "quant-log-offline-voice";
const DB_VERSION = 1;
const STORE_NAME = "voiceLogs";

const micButton = document.querySelector("[data-mic-button]");
const statusEl = document.querySelector("[data-voice-status]");
const transcriptEl = document.querySelector("[data-voice-transcript]");

let mediaRecorder = null;
let stream = null;
let chunks = [];
let isRecording = false;
let recognition = null;
let finalTranscript = "";
let liveTranscript = "";

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
    resetTranscript();
    mediaRecorder.start();
    startSpeechRecognition();
    isRecording = true;
    micButton.classList.add("is-recording");
    micButton.setAttribute("aria-label", "録音停止");
    setStatus("録音中");
  } catch {
    setStatus("エラー");
  }
}

function stopRecording() {
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  stopSpeechRecognition();
  stream?.getTracks().forEach((track) => track.stop());
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
  showTranscript(transcript);

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
  const browserTranscript = cleanTranscript(finalTranscript || liveTranscript);
  if (browserTranscript) return browserTranscript;
  if (window.quantLogTranscriber?.transcribe) {
    return window.quantLogTranscriber.transcribe(audioBlob);
  }
  return "文字起こし結果なし。音声ファイルは端末内に保存済みです。";
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.addEventListener("result", (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) {
        finalTranscript = cleanTranscript(`${finalTranscript} ${text}`);
      } else {
        interim = `${interim} ${text}`;
      }
    }
    liveTranscript = cleanTranscript(`${finalTranscript} ${interim}`);
    showTranscript(liveTranscript);
  });
  recognition.addEventListener("end", () => {
    if (isRecording) {
      try {
        recognition.start();
      } catch {}
    }
  });
  try {
    recognition.start();
  } catch {}
}

function stopSpeechRecognition() {
  if (!recognition) return;
  recognition.onend = null;
  recognition.stop();
  recognition = null;
}

function resetTranscript() {
  finalTranscript = "";
  liveTranscript = "";
  showTranscript("");
}

function showTranscript(text) {
  if (!transcriptEl) return;
  transcriptEl.textContent = text;
  transcriptEl.hidden = !text;
}

function cleanTranscript(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
