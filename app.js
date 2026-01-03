/* Deadline Radar – 0€ Web-App
   - Speichert lokal (localStorage)
   - Sortiert Deadlines
   - Exportiert alle Einträge als ICS-Kalenderdatei
   - Editieren von Einträgen (NEU)
*/

const STORAGE_KEY = "deadline_radar_v1";

const form = document.getElementById("deadlineForm");
const submitBtn = form.querySelector('button[type="submit"]');
const formTitleEl = document.getElementById("formTitle");

const titleEl = document.getElementById("title");
const categoryEl = document.getElementById("category");
const dueDateEl = document.getElementById("dueDate");
const leadDaysEl = document.getElementById("leadDays");
const noteEl = document.getElementById("note");

const listEl = document.getElementById("list");
const statsEl = document.getElementById("stats");

const exportIcsBtn = document.getElementById("exportIcsBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const demoBtn = document.getElementById("demoBtn");

// Edit state
let editingId = null;

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function toISODate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysUntil(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfTarget - startOfToday;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function sortItems(items) {
  return items.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function render() {
  const items = sortItems(loadItems());
  listEl.innerHTML = "";

  if (items.length === 0) {
    statsEl.textContent = "Noch keine Fristen gespeichert.";
    listEl.innerHTML = `<div class="hint">Füge links eine Frist hinzu. Danach kannst du alles als Kalenderdatei (ICS) exportieren.</div>`;
    return;
  }

  const dueSoon = items.filter((it) => daysUntil(parseISODate(it.dueDate)) <= 7).length;
  statsEl.textContent = `${items.length} Frist(en) gespeichert • ${dueSoon} innerhalb der nächsten 7 Tage`;

  for (const it of items) {
    const due = parseISODate(it.dueDate);
    const lead = Number(it.leadDays || 0);
    const remindDate = addDays(due, -lead);
    const dLeft = daysUntil(due);
    const rLeft = daysUntil(remindDate);

    const warn = dLeft <= 7;
    const item = document.createElement("div");
    item.className = "item";

    item.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="title">${escapeHtml(it.title)}</div>
        </div>
        <div class="badge">${escapeHtml(it.category)}</div>
      </div>

      <div class="meta">
        <div class="kv"><span class="dot ${warn ? "warn" : ""}"></span><span><b>Stichtag:</b> ${escapeHtml(it.dueDate)} (${formatCountdown(dLeft)})</span></div>
        <div class="kv"><span class="dot"></span><span><b>Erinnerung:</b> ${toISODate(remindDate)} (${formatCountdown(rLeft)})</span></div>
      </div>

      ${it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : ""}

      <div class="itemActions">
        <button type="button" class="secondary" data-action="edit" data-id="${it.id}">Bearbeiten</button>
        <button type="button" class="secondary" data-action="ics" data-id="${it.id}">ICS</button>
        <button type="button" class="danger" data-action="del" data-id="${it.id}">Löschen</button>
      </div>
    `;

    listEl.appendChild(item);
  }
}

function formatCountdown(n) {
  if (n === 0) return "heute";
  if (n === 1) return "in 1 Tag";
  if (n > 1) return `in ${n} Tagen`;
  if (n === -1) return "gestern";
  return `vor ${Math.abs(n)} Tagen`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Edit UI helpers ----------

function enterEditMode(item) {
  editingId = item.id;

  formTitleEl.textContent = "Frist bearbeiten";
  titleEl.value = item.title;
  categoryEl.value = item.category;
  dueDateEl.value = item.dueDate;
  leadDaysEl.value = String(item.leadDays ?? 7);
  noteEl.value = item.note ?? "";

  // Add/ensure cancel button
  ensureCancelButton();

  // Scroll form into view nicely
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitEditMode() {
  editingId = null;
  formTitleEl.textContent = "Neue Frist";
  form.reset();
  leadDaysEl.value = "7";
  removeCancelButton();
}

function ensureCancelButton() {
  // Add a cancel button next to existing submit + demo buttons
  const actions = form.querySelector(".actions");
  if (!actions) return;

  let cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) return;

  cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.id = "cancelEditBtn";
  cancelBtn.className = "secondary";
  cancelBtn.textContent = "Abbrechen";

  cancelBtn.addEventListener("click", () => exitEditMode());

  actions.appendChild(cancelBtn);
}

function removeCancelButton() {
  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.remove();
}

// ---------- Form submit (add or update) ----------

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = titleEl.value.trim();
  const category = categoryEl.value;
  const dueDate = dueDateEl.value;
  const leadDays = Math.max(0, Math.min(365, Number(leadDaysEl.value || 0)));
  const note = noteEl.value.trim();

  if (!title || !dueDate) return;

  const items = loadItems();

  if (editingId) {
    const idx = items.findIndex((x) => x.id === editingId);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        title,
        category,
        dueDate,
        leadDays,
        note
      };
      saveItems(items);
      exitEditMode();
      render();
      return;
    }
    // Fallback: if ID not found, exit edit mode and add new
    exitEditMode();
  }

  items.push({
    id: uid(),
    title,
    category,
    dueDate,
    leadDays,
    note
  });

  saveItems(items);
  form.reset();
  leadDaysEl.value = "7";
  render();
});

// ---------- List actions ----------

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;

  const items = loadItems();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return;

  if (action === "del") {
    if (!confirm("Diese Frist wirklich löschen?")) return;

    const wasEditingThis = editingId === id;

    items.splice(idx, 1);
    saveItems(items);

    if (wasEditingThis) exitEditMode();

    render();
    return;
  }

  if (action === "edit") {
    enterEditMode(items[idx]);
    return;
  }

  if (action === "ics") {
    downloadICS([items[idx]], "deadline-radar-single.ics");
    return;
  }
});

// ---------- Export / Clear / Demo ----------

exportIcsBtn.addEventListener("click", () => {
  const items = sortItems(loadItems());
  if (items.length === 0) {
    alert("Keine Fristen zum Exportieren.");
    return;
  }
  downloadICS(items, "deadline-radar.ics");
});

clearAllBtn.addEventListener("click", () => {
  const items = loadItems();
  if (items.length === 0) return;
  if (!confirm("Wirklich ALLES löschen? (Kann nicht rückgängig gemacht werden)")) return;
  localStorage.removeItem(STORAGE_KEY);
  exitEditMode();
  render();
});

demoBtn.addEventListener("click", () => {
  const today = new Date();
  const demo = [
    {
      id: uid(),
      title: "Internetvertrag kündigen",
      category: "Vertrag",
      dueDate: toISODate(addDays(today, 21)),
      leadDays: 10,
      note: "Kundennummer in E-Mail suchen"
    },
    {
      id: uid(),
      title: "Rückgabefrist Kopfhörer",
      category: "Geld",
      dueDate: toISODate(addDays(today, 7)),
      leadDays: 3,
      note: "Originalverpackung aufheben"
    },
    {
      id: uid(),
      title: "Bewerbungsfrist Programm X",
      category: "Job",
      dueDate: toISODate(addDays(today, 14)),
      leadDays: 5,
      note: "CV + Anschreiben finalisieren"
    }
  ];
  saveItems(demo);
  exitEditMode();
  render();
});

// ---------- ICS Export ----------

function downloadICS(items, filename) {
  const ics = buildICS(items);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function buildICS(items) {
  const now = new Date();
  const dtstamp = toICSDateTime(now);

  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Deadline Radar//DE");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const it of items) {
    const due = parseISODate(it.dueDate);
    const lead = Number(it.leadDays || 0);
    const remind = addDays(due, -lead);

    const dueDate = toICSDate(due);
    const remindDate = toICSDate(remind);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${sanitizeICS(`${it.id}-remind@deadline-radar`)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${sanitizeICS(`Erinnerung: ${it.title}`)}`);
    lines.push(`DESCRIPTION:${sanitizeICS(buildDescription(it, true))}`);
    lines.push(`DTSTART;VALUE=DATE:${remindDate}`);
    lines.push(`DTEND;VALUE=DATE:${remindDate}`);
    lines.push("END:VEVENT");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${sanitizeICS(`${it.id}-due@deadline-radar`)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${sanitizeICS(`Stichtag: ${it.title}`)}`);
    lines.push(`DESCRIPTION:${sanitizeICS(buildDescription(it, false))}`);
    lines.push(`DTSTART;VALUE=DATE:${dueDate}`);
    lines.push(`DTEND;VALUE=DATE:${dueDate}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function buildDescription(it, isReminder) {
  const parts = [];
  parts.push(`Kategorie: ${it.category}`);
  parts.push(`Stichtag: ${it.dueDate}`);
  parts.push(`Erinnerung: ${it.leadDays} Tage vorher`);
  if (it.note) parts.push(`Notiz: ${it.note}`);
  if (isReminder) parts.push("Heute ist die Erinnerung. Prüfe, ob du handeln musst.");
  return parts.join("\\n");
}

function toICSDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function toICSDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function sanitizeICS(s) {
  return String(s)
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

// Initial render
render();
