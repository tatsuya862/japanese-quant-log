const focusDuration = 25 * 60;
const breakDuration = 5 * 60;
let remainingSeconds = focusDuration;
let currentMode = "focus"; // focus or break
let cycleCount = 0;
let timerId = null;

const minuteEl = document.querySelector("[data-minute]");
const secondsEl = document.querySelector("[data-seconds]");
const modeEl = document.querySelector("[data-mode]");
const cycleEl = document.querySelector("[data-cycle]");
const nextEl = document.querySelector("[data-next]");
const startPauseBtn = document.getElementById("start-pause");
const resetBtn = document.getElementById("reset");

const modeLabels = {
  focus: "集中モード",
  break: "休憩モード",
};

const nextLabels = {
  focus: `休憩 ${formatTime(breakDuration)}`,
  break: `集中 ${formatTime(focusDuration)}`,
};

startPauseBtn.addEventListener("click", () => {
  if (timerId) {
    pauseTimer();
    startPauseBtn.textContent = "再開";
  } else {
    startTimer();
    startPauseBtn.textContent = "停止";
  }
});

resetBtn.addEventListener("click", () => {
  pauseTimer();
  currentMode = "focus";
  remainingSeconds = focusDuration;
  cycleCount = 0;
  updateNextLabel();
  updateDisplay();
  startPauseBtn.textContent = "開始";
});

function startTimer() {
  if (timerId) {
    return;
  }
  timerId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!timerId) {
    return;
  }
  clearInterval(timerId);
  timerId = null;
}

function tick() {
  if (remainingSeconds <= 0) {
    handleCompletion();
    return;
  }
  remainingSeconds -= 1;
  updateDisplay();
}

function handleCompletion() {
  if (currentMode === "focus") {
    cycleCount += 1;
  }
  switchMode(currentMode === "focus" ? "break" : "focus");
}

function switchMode(nextMode) {
  currentMode = nextMode;
  remainingSeconds = nextMode === "focus" ? focusDuration : breakDuration;
  updateDisplay();
  updateNextLabel();
}

function updateDisplay() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  minuteEl.textContent = String(minutes).padStart(2, "0");
  secondsEl.textContent = `:${String(seconds).padStart(2, "0")}`;
  modeEl.textContent = modeLabels[currentMode];
  cycleEl.textContent = String(cycleCount);
}

function updateNextLabel() {
  const label = currentMode === "focus" ? nextLabels.focus : nextLabels.break;
  nextEl.textContent = label;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

updateDisplay();
updateNextLabel();
