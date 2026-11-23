import { mountEarningsReview } from "./earnings-review.js";
import { mountMediaEditor } from "./media-editor.js";
import { mountRoutineEditor } from "./routine-editor.js";
import {
  avatarUrl,
  avatars,
  paintNavPortrait,
  parentAvatarKey,
} from "./profile-portraits.js";

const timeout = 5 * 60_000;

function mountNotes(panel) {
  const routines = window.DashboardRoutines;
  panel.innerHTML =
    '<form class="parent-notes"><label>Date <input name="date" type="date" required></label>' +
    '<label>School plan <textarea name="school" maxlength="300" rows="2"></textarea></label>' +
    '<label>Home plan <textarea name="home" maxlength="300" rows="2"></textarea></label>' +
    '<p>These notes appear on Today on the date you choose.</p><div class="parent-actions"><button type="submit">Save notes</button></div>' +
    '<p class="parent-status" role="status"></p></form>';
  const form = panel.querySelector("form");
  const fields = form.elements;
  const status = panel.querySelector(".parent-status");
  fields.date.value = window.RoutinePoints.dayKey();
  function load() {
    const note = routines.notes(fields.date.value);
    fields.school.value = note.school || "";
    fields.home.value = note.home || "";
    status.textContent = "";
  }
  fields.date.addEventListener("change", load);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      routines.saveNotes(fields.date.value, {
        school: fields.school.value.trim(),
        home: fields.home.value.trim(),
      });
      status.textContent = "Notes saved.";
    } catch (error) {
      status.textContent = error.message;
    }
  });
  load();
}

function mountParentAvatar(panel) {
  panel.innerHTML =
    '<div class="profile-avatar-grid">' +
    avatars
      .map(
        ([label, id]) =>
          '<button type="button" data-parent-avatar="' +
          id +
          '"><img alt="" src="' +
          avatarUrl(id) +
          '">' +
          label +
          "</button>",
      )
      .join("") +
    '</div><p class="profile-credit">Artwork by OpenMoji · CC BY-SA 4.0</p>' +
    '<p class="parent-status" role="status"></p>';
  const buttons = [...panel.querySelectorAll("[data-parent-avatar]")];
  const status = panel.querySelector(".parent-status");
  function render() {
    const saved = localStorage.getItem(parentAvatarKey);
    buttons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.parentAvatar === saved),
      ),
    );
    paintNavPortrait(true);
  }
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-parent-avatar]");
    if (!button) return;
    try {
      localStorage.setItem(parentAvatarKey, button.dataset.parentAvatar);
      render();
      status.textContent = "Dad’s avatar saved.";
    } catch {
      status.textContent = "Could not save your avatar.";
    }
  });
  try {
    render();
  } catch {
    status.textContent = "Could not load your avatar.";
  }
}

export function mountParentMode(container, child, onLock) {
  let unlocked = false;
  let timer;
  let unmountMedia;
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(lock, timeout);
  };

  function lock() {
    if (!unlocked) return;
    unlocked = false;
    clearTimeout(timer);
    unmountMedia?.();
    unmountMedia = undefined;
    container.hidden = true;
    container.replaceChildren();
    child.hidden = false;
    paintNavPortrait();
    onLock();
  }

  function open() {
    if (unlocked) return;
    unlocked = true;
    container.innerHTML =
      "<header><div><h1>Dad</h1><p>Parent settings</p></div>" +
      '<button type="button" data-lock-parent>Lock &amp; return to Beth</button></header>' +
      '<nav class="parent-tools" aria-label="Parent settings">' +
      '<button type="button" data-tool="notes">Today’s notes</button>' +
      '<button type="button" data-tool="checklists" disabled>Edit Checklists</button>' +
      '<button type="button" data-tool="earnings">Pocket money</button>' +
      '<button type="button" data-tool="media">Media</button>' +
      '<button type="button" data-tool="avatar">Dad’s avatar</button></nav>' +
      '<section class="parent-tool" data-panel="notes"></section><section class="parent-tool" data-panel="checklists" hidden></section>' +
      '<section class="parent-tool" data-panel="earnings" hidden></section><section class="parent-tool" data-panel="media" hidden></section>' +
      '<section class="parent-tool" data-panel="avatar" hidden></section>';
    const mount = {
      notes: mountNotes,
      checklists: mountRoutineEditor,
      earnings: mountEarningsReview,
      media: (panel) => { unmountMedia = mountMediaEditor(panel); },
      avatar: mountParentAvatar,
    };
    const renderTool = (key) => {
      for (const button of container.querySelectorAll("[data-tool]")) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.tool === key),
        );
      }
      for (const panel of container.querySelectorAll("[data-panel]")) {
        panel.hidden = panel.dataset.panel !== key;
        if (!panel.hidden && (!panel.firstChild || key === "earnings"))
          mount[key](panel);
      }
    };
    container
      .querySelector(".parent-tools")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-tool]");
        if (button) renderTool(button.dataset.tool);
      });
    container
      .querySelector("[data-lock-parent]")
      .addEventListener("click", lock);
    child.hidden = true;
    container.hidden = false;
    paintNavPortrait(true);
    renderTool("notes");
    resetTimer();
    container.querySelector("[data-lock-parent]").focus();
  }

  container.addEventListener("pointerdown", () => {
    if (unlocked) resetTimer();
  });
  container.addEventListener("keydown", () => {
    if (unlocked) resetTimer();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lock();
  });
  return { open, lock };
}
