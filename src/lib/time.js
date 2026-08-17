const TZ = "Asia/Manila";

export const WINDOWS = [
  { key: "MORNING_IN", label: "Morning Time In", start: "07:30", end: "07:59" },
  { key: "MORNING_OUT", label: "Morning Time Out", start: "12:01", end: "12:29" },
  { key: "AFTERNOON_IN", label: "Afternoon Time In", start: "12:31", end: "12:59" },
  { key: "AFTERNOON_OUT", label: "Afternoon Time Out", start: "17:01", end: "17:59" }
];

export function phParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

export function phDate(date = new Date()) {
  const p = phParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function phClock(date = new Date()) {
  const p = phParts(date);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function phMinute(date = new Date()) {
  const p = phParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

export function getCurrentWindow(date = new Date()) {
  const minute = phMinute(date);
  return WINDOWS.find(w => {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    return minute >= sh * 60 + sm && minute <= eh * 60 + em;
  }) || null;
}

export function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
  }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ, year: "numeric", month: "long", day: "numeric"
  }).format(new Date(`${value}T00:00:00+08:00`));
}