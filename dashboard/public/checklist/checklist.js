const routine = new URLSearchParams(location.search).get("routine");
let celebrationDocument = document;
const morningSections = [
  {
    name: "Toilet",
    key: "toilet",
    accent: "water",
    tasks: [
      ["toilet", "Go to the toilet"],
      ["wipe", "Wipe myself"],
      ["wash-hands", "Wash my hands"],
      ["dry-hands", "Dry my hands"],
    ],
  },
  {
    name: "Teeth and face",
    key: "care",
    accent: "teeth",
    tasks: [
      ["clean-teeth", "Clean my teeth"],
      ["wash-face", "Wash my face"],
    ],
  },
  {
    name: "Getting dressed",
    key: "dressed",
    accent: "bag",
    tasks: [
      ["pants", "Put pants on"],
      ["socks", "Put socks on"],
      ["dress-leggings", "Put dress or leggings on"],
      ["top", "Put top on"],
      ["cardigan", "Put cardigan on"],
    ],
  },
  {
    name: "Hair",
    key: "hair",
    accent: "teeth",
    tasks: [["hair", "Get Mummy or Daddy to brush my hair"]],
  },
];

const eveningSections = [
  morningSections[0],
  morningSections[1],
  { name: "Ready for bed", key: "bedtime", accent: "bag", tasks: [["pyjamas", "Put on pyjamas"]] },
  { name: "Clean", key: "clean", accent: "teeth", tasks: [["clean-something", "Clean something"]] },
];
const isEvening = routine === "evening";
const isGrouped = routine === "morning" || isEvening;
const sections = isEvening ? eveningSections : morningSections;

if (isGrouped) {
  document.documentElement.dataset.routine = routine;
  document.documentElement.dataset.grouped = "true";
  const fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href =
    "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Instrument+Serif:ital@0;1&display=swap";
  document.head.append(fonts);
  document.getElementById("fullscreen").remove();
  document.getElementById("fullscreen-status").remove();
  try {
    if (window.parent.location.origin === location.origin)
      celebrationDocument = window.parent.document;
  } catch {
    // A standalone checklist can celebrate within its own document.
  }
  if (!celebrationDocument.getElementById("routine-celebration-styles")) {
    const styles = celebrationDocument.createElement("link");
    styles.id = "routine-celebration-styles";
    styles.rel = "stylesheet";
    styles.href = new URL("celebration.css?v=1", location.href).href;
    celebrationDocument.head.append(styles);
  }
  const groups = document.createElement("div");
  groups.className = "morning-groups";
  document.querySelector(".tasks").replaceWith(groups);
  sections.forEach((group) => {
    const section = document.createElement("section");
    section.className = "morning-group morning-group--" + group.key;
    const heading = document.createElement("h2");
    heading.id = routine + "-" + group.key;
    heading.textContent = group.name;
    section.setAttribute("aria-labelledby", heading.id);
    const list = document.createElement("ol");
    list.className = "tasks";
    group.tasks.forEach(([id, title]) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "task " + group.accent;
      button.dataset.task = id;
      button.setAttribute("aria-pressed", "false");
      const check = document.createElement("span");
      check.className = "check";
      check.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = title;
      button.append(check, label);
      item.append(button);
      list.append(item);
    });
    section.append(heading, list);
    groups.append(section);
  });
}

const tasks = Array.from(document.querySelectorAll("[data-task]"));
const fullscreen = document.getElementById("fullscreen");
const fullscreenStatus = document.getElementById("fullscreen-status");
const progressRing = document.getElementById("progress-ring");
const progressPercent = document.getElementById("progress-percent");
const progressLabel = document.getElementById("progress-label");
const allDone = document.getElementById("all-done");
const moneyStatus = document.getElementById("money-earned");
const storageStatus = document.getElementById("storage-status");
const storageKey =
  routine === "morning"
    ? "beth-checklist-morning-v2"
    : routine === "evening"
      ? "beth-checklist-evening-v2"
      : "beth-checklist-v1";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const taskIds = new Set(tasks.map((button) => button.dataset.task));
const celebrationTimers = new Map();
const completed = new Set();
let progressDate = isGrouped ? RoutinePoints.dayKey() : null;

let audio;

if (routine === "morning" || routine === "evening") {
  const title =
    routine === "morning" ? "Morning Checklist" : "Evening Checklist";
  document.title = title;
  document.querySelector("h1").textContent = title;
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved?.changes) && (!isGrouped || !saved.date || saved.date === progressDate)) {
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
    localStorage.setItem(
      storageKey,
      JSON.stringify({ changes: Array.from(completed), ...(isGrouped && { date: progressDate }) }),
    );
    storageStatus.textContent = "";
  } catch {
    storageStatus.textContent = "Progress could not be saved on this device.";
  }
}

function render() {
  for (const button of tasks) {
    button.setAttribute("aria-pressed", completed.has(button.dataset.task));
  }
  const percent = Math.round((completed.size * 100) / tasks.length);
  progressRing.style.setProperty("--sweep", `${percent}%`);
  progressRing.dataset.level =
    percent === 100 ? "done" : percent >= 50 ? "half" : "start";
  progressPercent.textContent = `${percent}%`;
  progressLabel.textContent = `${completed.size} of ${tasks.length} complete`;
  allDone.hidden = completed.size !== tasks.length;

}

function stopCelebration(button) {
  clearTimeout(celebrationTimers.get(button));
  celebrationTimers.delete(button);
  button.classList.remove("is-celebrating");
  button.querySelectorAll(".particle").forEach((particle) => particle.remove());
}

function celebrate(button, finished, pence) {
  if (isGrouped && finished) {
    clearTimeout(finishStartTimer);
    finishStartTimer = setTimeout(() => {
      if (completed.size === tasks.length) celebrateFinish(pence);
    }, 900);
  }
  if (reducedMotion.matches) return;
  if (isEvening) {
    stopCelebration(button);
    button.classList.add("is-celebrating");
    celebrationTimers.set(button, setTimeout(() => stopCelebration(button), 800));
    return;
  }
  stopCelebration(button);
  const colors = [
    "--celebration-purple",
    "--celebration-pink",
    "--celebration-teal",
    "--celebration-gold",
  ];
  const count =
    routine === "morning" ? (finished ? 32 : 18) : finished ? 16 : 8;

  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const distance =
      routine === "morning" ? (i % 2 ? 55 : 90) : i % 2 ? 32 : 52;
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.setAttribute("aria-hidden", "true");
    particle.style.setProperty(
      "--particle-color",
      `var(${colors[i % colors.length]})`,
    );
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    button.append(particle);
  }
  button.classList.add("is-celebrating");
  celebrationTimers.set(
    button,
    setTimeout(
      () => stopCelebration(button),
      routine === "morning" ? 1000 : 600,
    ),
  );
}

let finishCelebration;
let finishTimer;
let finishStartTimer;
const finishAudio =
  routine === "morning"
    ? new Audio(new URL("audio/celebration-cheering.mp3", location.href).href)
    : null;
if (finishAudio) finishAudio.preload = "auto";

function closeFinishCelebration() {
  clearTimeout(finishStartTimer);
  clearTimeout(finishTimer);
  finishCelebration?.remove();
  finishCelebration = null;
  if (finishAudio) {
    finishAudio.pause();
    finishAudio.currentTime = 0;
  }
}

function celebrateFinish(pence) {
  closeFinishCelebration();
  clearTimeout(sectionCelebrationTimer);
  sectionCelebration?.remove();
  sectionCelebration = null;
  finishCelebration = celebrationDocument.createElement("div");
  finishCelebration.className = "routine-celebration";
  finishCelebration.dataset.routine = routine;
  const message = celebrationDocument.createElement("div");
  message.className = "routine-celebration-copy";
  const emoji = celebrationDocument.createElement("div");
  emoji.className = "routine-celebration-emoji";
  emoji.textContent = isEvening ? "🌙" : "🎉";
  emoji.setAttribute("aria-hidden", "true");
  const title = celebrationDocument.createElement("h2");
  title.setAttribute("role", "status");
  title.textContent = "WELL DONE, BETH!";
  const cheer = celebrationDocument.createElement("p");
  cheer.textContent = isEvening ? "Ready for a cosy night" : "You smashed it!";
  if (pence) cheer.textContent += " · +" + RoutinePoints.formatReward(pence);
  const dismiss = celebrationDocument.createElement("button");
  dismiss.type = "button";
  dismiss.className = "routine-celebration-dismiss";
  dismiss.setAttribute("aria-label", "Back to Today");
  dismiss.title = "Back to Today";
  const homeIcon = celebrationDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  homeIcon.setAttribute("viewBox", "0 0 24 24");
  homeIcon.setAttribute("width", "26");
  homeIcon.setAttribute("height", "26");
  homeIcon.setAttribute("fill", "none");
  homeIcon.setAttribute("stroke", "currentColor");
  homeIcon.setAttribute("stroke-width", "2");
  homeIcon.setAttribute("stroke-linecap", "round");
  homeIcon.setAttribute("stroke-linejoin", "round");
  homeIcon.setAttribute("aria-hidden", "true");
  for (const d of ["M3 11l9-7 9 7", "M5 10v10h14V10"]) {
    const path = celebrationDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    homeIcon.append(path);
  }
  dismiss.append(homeIcon);
  dismiss.addEventListener("click", () => {
    closeFinishCelebration();
    celebrationDocument.defaultView.location.hash = "home";
    if (celebrationDocument === document) location.href = "/#home";
  });
  message.append(emoji, title, cheer);
  finishCelebration.append(message, dismiss);
  if (!reducedMotion.matches) {
    const colors = [
      "--celebration-purple",
      "--celebration-pink",
      "--celebration-teal",
      "--celebration-gold",
    ];
    const positions = [
      [15, 20],
      [85, 20],
      [25, 75],
      [75, 75],
      [12, 50],
      [88, 50],
      [45, 12],
      [55, 88],
    ];
    (isEvening ? [] : positions).forEach(([left, top], index) => {
      const burst = celebrationDocument.createElement("div");
      burst.className = "routine-firework";
      burst.setAttribute("aria-hidden", "true");
      burst.style.left = left + "%";
      burst.style.top = top + "%";
      burst.style.setProperty("--delay", index * 220 + "ms");
      for (let i = 0; i < 28; i++) {
        const spark = celebrationDocument.createElement("span");
        const angle = (i * 2 * Math.PI) / 28;
        spark.className = "routine-spark";
        spark.style.color = "var(" + colors[i % colors.length] + ")";
        spark.style.setProperty("--x", Math.cos(angle) * 200 + "px");
        spark.style.setProperty("--y", Math.sin(angle) * 200 + "px");
        burst.append(spark);
      }
      finishCelebration.append(burst);
    });
    for (let i = 0; i < (isEvening ? 24 : 90); i++) {
      const confetti = celebrationDocument.createElement("span");
      confetti.className = "routine-confetti";
      confetti.setAttribute("aria-hidden", "true");
      confetti.style.background = "var(" + colors[i % colors.length] + ")";
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.setProperty("--delay", Math.random() * 2200 + "ms");
      confetti.style.setProperty("--drift", (Math.random() - 0.5) * 250 + "px");
      finishCelebration.append(confetti);
    }
  }
  celebrationDocument.body.append(finishCelebration);
  void playCelebrationAudio();
  finishTimer = setTimeout(closeFinishCelebration, 8500);
}

async function playCelebrationAudio() {
  if (!finishAudio) return;
  try {
    finishAudio.currentTime = 0;
    await finishAudio.play();
  } catch {
    // Visual celebrations still work when audio is unavailable.
  }
}

window.addEventListener("pagehide", closeFinishCelebration);

let sectionCelebration;
let sectionCelebrationTimer;

function celebrateSection(group) {
  clearTimeout(sectionCelebrationTimer);
  sectionCelebration?.remove();
  sectionCelebration = document.createElement("div");
  sectionCelebration.className = "section-celebration";
  if (isEvening) {
    const panel = group && document.getElementById(routine + "-" + group.key)?.closest("section");
    if (panel && !reducedMotion.matches) {
      panel.animate([{ opacity: 0.7 }, { opacity: 1 }], { duration: 1200 });
    }
    return;
  }

  if (!reducedMotion.matches) {
    const colors = [
      "--celebration-purple",
      "--celebration-pink",
      "--celebration-teal",
      "--celebration-gold",
    ];
    const positions = [
      [24, 30],
      [76, 32],
      [50, 68],
    ];
    positions.forEach(([left, top], burst) => {
      const firework = document.createElement("div");
      firework.className = "section-firework";
      firework.setAttribute("aria-hidden", "true");
      firework.style.left = left + "%";
      firework.style.top = top + "%";
      firework.style.setProperty("--delay", burst * 240 + "ms");
      firework.style.color = "var(" + colors[burst] + ")";
      for (let i = 0; i < 32; i++) {
        const angle = (i * 2 * Math.PI) / 32;
        const distance = i % 2 ? 110 : 175;
        const spark = document.createElement("span");
        spark.className = "section-spark";
        spark.style.color = "var(" + colors[i % colors.length] + ")";
        spark.style.setProperty("--x", Math.cos(angle) * distance + "px");
        spark.style.setProperty("--y", Math.sin(angle) * distance + 45 + "px");
        firework.append(spark);
      }
      sectionCelebration.append(firework);
    });
  }
  document.body.append(sectionCelebration);
  sectionCelebrationTimer = setTimeout(() => {
    sectionCelebration.remove();
    sectionCelebration = null;
  }, 2400);
}

async function playChime(finished) {
  if (isEvening) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;

  try {
    audio ||= new Audio();
    if (audio.state === "suspended") await audio.resume();
    if (audio.state !== "running") return;

    const notes = finished ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    notes.forEach((frequency, index) => {
      const start = audio.currentTime + index * 0.085;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.001, start);
      volume.gain.exponentialRampToValueAtTime(0.11, start + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
      tone.connect(volume).connect(audio.destination);
      tone.start(start);
      tone.stop(start + 0.18);
    });
  } catch {
    // Audio can be unavailable in a kiosk or browser. The checklist still works.
  }
}

function resetOnNewDay() {
  const today = RoutinePoints.dayKey();
  if (today === progressDate) return;
  progressDate = today;
  completed.clear();
  moneyStatus.hidden = true;
  closeFinishCelebration();
  sectionCelebration?.remove();
  for (const button of tasks) stopCelebration(button);
  render();
  save();
}

if (isGrouped) {
  window.addEventListener("focus", resetOnNewDay);
  document.addEventListener("visibilitychange", resetOnNewDay);
  setInterval(resetOnNewDay, 15_000);
}

for (const button of tasks) {
  button.addEventListener("click", () => {
    if (isGrouped) resetOnNewDay();
    const id = button.dataset.task;
    const checked = !completed.delete(id);
    if (checked) completed.add(id);
    render();
    save();
    if (checked) {
      const finished = !allDone.hidden;
      const section =
        isGrouped &&
        sections.find((group) =>
          group.tasks.some(([taskId]) => taskId === id),
        );
      const sectionFinished =
        section && section.tasks.every(([taskId]) => completed.has(taskId));
      let pence = 0;
      if (sectionFinished) {
        try {
          pence = RoutinePoints.grantSection(progressDate, routine, section.key);
          if (pence) {
            moneyStatus.hidden = false;
            moneyStatus.textContent = RoutinePoints.formatReward(pence) + " earned!";
          }
        } catch {
          storageStatus.textContent = "Pocket money could not be saved on this device.";
        }
      }
      celebrate(button, finished, pence);
      if (sectionFinished && !finished) celebrateSection(section);
      if (!finished || routine !== "morning")
        void playChime(finished || sectionFinished);
    } else {
      if (isGrouped) closeFinishCelebration();
      stopCelebration(button);
    }
  });
}

fullscreen?.addEventListener("click", async () => {
  fullscreenStatus.textContent = "";
  if (!document.fullscreenEnabled) {
    fullscreenStatus.textContent =
      "Full screen is unavailable in this view. Try opening the checklist directly in Chrome.";
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
  } catch {
    fullscreenStatus.textContent =
      "The browser couldn’t switch to full screen.";
  }
});

document.addEventListener("fullscreenchange", () => {
  if (fullscreen)
    fullscreen.textContent = document.fullscreenElement
      ? "Exit full screen"
      : "Full screen";
});

render();
