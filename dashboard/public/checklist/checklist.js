const tasks = Array.from(document.querySelectorAll("[data-task]"));
const fullscreen = document.getElementById("fullscreen");
const fullscreenStatus = document.getElementById("fullscreen-status");
const progressRing = document.getElementById("progress-ring");
const progressPercent = document.getElementById("progress-percent");
const progressLabel = document.getElementById("progress-label");
const allDone = document.getElementById("all-done");
const storageStatus = document.getElementById("storage-status");
const routine = new URLSearchParams(location.search).get("routine");
const storageKey = routine === "evening" ? "beth-checklist-evening-v1" : "beth-checklist-v1";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const taskIds = new Set(tasks.map(button => button.dataset.task));
const celebrationTimers = new Map();
const completed = new Set();

let audio;

if (routine === "morning" || routine === "evening") {
  const title = routine === "morning" ? "Morning Checklist" : "Evening Checklist";
  document.title = title;
  document.querySelector("h1").textContent = title;
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved?.changes)) {
    // Older saves recorded every toggle for Undo. Replay them to recover current progress.
    for (const id of saved.changes) {
      if (taskIds.has(id) && !completed.delete(id)) completed.add(id);
    }
  }
} catch {
  storageStatus.textContent = "Could not load saved progress.";
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ changes: Array.from(completed) }));
    storageStatus.textContent = "";
  } catch {
    storageStatus.textContent = "Progress could not be saved on this device.";
  }
}

function render() {
  for (const button of tasks) {
    button.setAttribute("aria-pressed", completed.has(button.dataset.task));
  }
  const percent = Math.round(completed.size * 100 / tasks.length);
  progressRing.style.setProperty("--sweep", `${percent}%`);
  progressRing.dataset.level = percent === 100 ? "done" : percent >= 50 ? "half" : "start";
  progressPercent.textContent = `${percent}%`;
  progressLabel.textContent = `${completed.size} of ${tasks.length} complete`;
  allDone.hidden = completed.size !== tasks.length;
}

function stopCelebration(button) {
  clearTimeout(celebrationTimers.get(button));
  celebrationTimers.delete(button);
  button.classList.remove("is-celebrating");
  button.querySelectorAll(".particle").forEach(particle => particle.remove());
}

function celebrate(button, finished) {
  if (reducedMotion.matches) return;
  stopCelebration(button);
  const colors = ["--celebration-purple", "--celebration-pink", "--celebration-teal", "--celebration-gold"];
  const count = finished ? 16 : 8;

  for (let i = 0; i < count; i++) {
    const angle = i * 2 * Math.PI / count;
    const distance = i % 2 ? 32 : 52;
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.setAttribute("aria-hidden", "true");
    particle.style.setProperty("--particle-color", `var(${colors[i % colors.length]})`);
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    button.append(particle);
  }
  button.classList.add("is-celebrating");
  celebrationTimers.set(button, setTimeout(() => stopCelebration(button), 600));
}

async function playChime(finished) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;

  try {
    audio ||= new Audio();
    if (audio.state === "suspended") await audio.resume();
    if (audio.state !== "running") return;

    const notes = finished ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    notes.forEach((frequency, index) => {
      const start = audio.currentTime + index * .085;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(.001, start);
      volume.gain.exponentialRampToValueAtTime(.11, start + .015);
      volume.gain.exponentialRampToValueAtTime(.001, start + .17);
      tone.connect(volume).connect(audio.destination);
      tone.start(start);
      tone.stop(start + .18);
    });
  } catch {
    // Audio can be unavailable in a kiosk or browser. The checklist still works.
  }
}

for (const button of tasks) {
  button.addEventListener("click", () => {
    const id = button.dataset.task;
    const checked = !completed.delete(id);
    if (checked) completed.add(id);
    render();
    save();
    if (checked) {
      const finished = !allDone.hidden;
      celebrate(button, finished);
      void playChime(finished);
    } else {
      stopCelebration(button);
    }
  });
}

fullscreen.addEventListener("click", async () => {
  fullscreenStatus.textContent = "";
  if (!document.fullscreenEnabled) {
    fullscreenStatus.textContent = "Full screen is unavailable in this view. Try opening the checklist directly in Chrome.";
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    fullscreenStatus.textContent = "The browser couldn’t switch to full screen.";
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
});

render();
