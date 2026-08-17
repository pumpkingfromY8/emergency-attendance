import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  WINDOWS,
  getCurrentWindow,
  phClock,
  phDate,
  formatDate,
  formatTime,
} from "./lib/time";
import { getLocation } from "./lib/geo";
import {
  startCamera,
  stopCamera,
  capturePhoto,
  dataUrlToBlob,
} from "./lib/camera";
import {
  ShieldCheck,
  MapPin,
  Camera,
  Clock3,
  LogIn,
  LogOut,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  Power,
  UserRound,
} from "lucide-react";
import Papa from "papaparse";

function App() {
  const [view, setView] = useState("attendance");
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setAdmin(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setAdmin(session?.user || null),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">LGU Emergency Attendance</div>
          <div className="subtitle">
            Backup attendance for biometric/DTR emergencies
          </div>
        </div>
        <nav>
          <button
            className={view === "attendance" ? "nav active" : "nav"}
            onClick={() => setView("attendance")}
          >
            Attendance
          </button>
          <button
            className={view === "admin" ? "nav active" : "nav"}
            onClick={() => setView("admin")}
          >
            Admin
          </button>
        </nav>
      </header>
      <main className="container">
        {view === "attendance" ? (
          <AttendancePage />
        ) : admin ? (
          <AdminDashboard user={admin} />
        ) : (
          <AdminLogin onLogin={setAdmin} />
        )}
      </main>
    </div>
  );
}

function AttendancePage() {
  const [event, setEvent] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [employee, setEmployee] = useState(null);
  const [currentWindow, setCurrentWindow] = useState(getCurrentWindow());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    loadEvent();
    const timer = setInterval(() => setCurrentWindow(getCurrentWindow()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadEvent() {
    const { data, error } = await supabase
      .from("emergency_events")
      .select("*")
      .eq("status", "ACTIVE")
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) setEvent(data);
  }

  async function findEmployee(e) {
    e.preventDefault();
    setMessage("");
    setEmployee(null);
    if (!employeeId.trim()) return setMessage("Enter your employee ID.");
    setBusy(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id,employee_no,full_name,department,status")
      .eq("employee_no", employeeId.trim())
      .eq("status", "ACTIVE")
      .maybeSingle();
    setBusy(false);
    if (error) return setMessage(error.message);
    if (!data) return setMessage("Employee ID was not found or is inactive.");
    setEmployee(data);
  }

  if (!event) {
    return (
      <EmptyState
        title="Emergency attendance is not active"
        text="Ask the authorized office personnel to activate Emergency Attendance Mode when the biometric/DTR system is unavailable."
        onRetry={loadEvent}
      />
    );
  }

  return (
    <section className="card hero">
      <div className="emergency-badge">
        <Power size={16} /> EMERGENCY MODE ACTIVE
      </div>
      <h1>Emergency Attendance</h1>
      <p className="muted">
        {event.reason || "Authorized emergency attendance event"} ·{" "}
        {formatDate(event.event_date)}
      </p>

      <div className="window-card">
        <Clock3 size={20} />
        <div>
          <strong>
            {currentWindow
              ? currentWindow.label
              : "No attendance window is currently open"}
          </strong>
          <span>
            {currentWindow
              ? `Allowed ${currentWindow.start}–${currentWindow.end}`
              : "Morning In 7:30–7:59 · Morning Out 12:01–12:29 · Afternoon In 12:31–12:59 · Afternoon Out 17:01–17:59"}
          </span>
        </div>
      </div>

      <div className="clock">{phClock()}</div>

      {!currentWindow ? (
        <div className="notice warning">
          Attendance can only be submitted during the configured LGU time
          windows.
        </div>
      ) : !employee ? (
        <form onSubmit={findEmployee} className="form">
          <label>Employee ID</label>
          <div className="input-row">
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP-0001"
              autoComplete="off"
            />
            <button className="primary" disabled={busy}>
              <UserRound size={18} />
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
          <small className="muted">
            Your employee ID is used only to identify the attendance record.
          </small>
        </form>
      ) : (
        <AttendanceCapture
          employee={employee}
          event={event}
          windowInfo={currentWindow}
          onCancel={() => setEmployee(null)}
          onSuccess={(record) => {
            setSubmitted(record);
            setEmployee(null);
          }}
          setMessage={setMessage}
        />
      )}

      {message && (
        <div className="notice error">
          <XCircle size={18} />
          {message}
        </div>
      )}
      {submitted && <SuccessRecord record={submitted} />}
    </section>
  );
}

function AttendanceCapture({
  employee,
  event,
  windowInfo,
  onCancel,
  onSuccess,
  setMessage,
}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);

  useEffect(() => () => stopCamera(stream), [stream]);

  async function openCamera() {
    try {
      setMessage("");
      const s = await startCamera(videoRef.current);
      setStream(s);
    } catch (e) {
      setMessage(e.message);
    }
  }

  async function locate() {
    try {
      setMessage("");
      setLocationBusy(true);
      const loc = await getLocation();
      setLocation(loc);
      setLocationBusy(false);
      if (!loc.inside)
        setMessage(
          `You are outside the office geofence (${Math.round(loc.distance)} m away).`,
        );
    } catch (e) {
      setLocationBusy(false);
      setMessage(e.message);
    }
  }

  async function submit() {
    if (!photo) return setMessage("Capture a live attendance photo first.");
    if (!location) return setMessage("Verify your GPS location first.");
    if (!location.inside)
      return setMessage(
        "Attendance cannot be submitted outside the configured office radius.",
      );
    setBusy(true);
    setMessage("");

    try {
      const now = new Date();
      const date = phDate(now);
      const clockWindow = getCurrentWindow(now);
      if (!clockWindow || clockWindow.key !== windowInfo.key)
        throw new Error(
          "The attendance window changed. Please refresh and try again.",
        );

      const { data: duplicate, error: duplicateError } = await supabase
        .from("attendance")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("attendance_date", date)
        .eq("attendance_type", windowInfo.key)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate)
        throw new Error(
          "You already have an attendance record for this period.",
        );

      const path = `${date}/${employee.employee_no}-${windowInfo.key}-${Date.now()}.jpg`;
      const blob = dataUrlToBlob(photo);
      const upload = await supabase.storage
        .from("attendance-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;

      const { data: inserted, error } = await supabase
        .from("attendance")
        .insert({
          employee_id: employee.id,
          emergency_event_id: event.id,
          attendance_date: date,
          attendance_type: windowInfo.key,
          attendance_time: now.toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          gps_accuracy: location.accuracy,
          gps_distance_meters: location.distance,
          photo_path: path,
          attendance_method: "EMERGENCY_WEB",
          verification_status: "PENDING",
        })
        .select("*")
        .single();

      if (error) {
        await supabase.storage.from("attendance-photos").remove([path]);
        throw error;
      }

      stopCamera(stream);
      onSuccess(inserted);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="capture">
      <div className="employee-strip">
        <strong>{employee.full_name}</strong>
        <span>
          {employee.employee_no} · {employee.department || "—"}
        </span>
      </div>
      <div className="capture-grid">
        <div>
          <div className="camera-box">
            <video
              ref={videoRef}
              playsInline
              muted
              className={stream ? "camera-video" : "camera-video hidden"}
            />
            {!stream && (
              <div className="camera-placeholder">
                <Camera size={40} />
                <span>Camera required</span>
              </div>
            )}
          </div>
          {stream ? (
            <button
              className="secondary full"
              onClick={() => setPhoto(capturePhoto(videoRef.current))}
            >
              Capture Photo
            </button>
          ) : (
            <button className="secondary full" onClick={openCamera}>
              <Camera size={18} /> Open Camera
            </button>
          )}
          {photo && (
            <img className="preview" src={photo} alt="Attendance preview" />
          )}
        </div>
        <div className="verification">
          <div className={`check ${location?.inside ? "ok" : ""}`}>
            <MapPin />
            <div>
              <strong>GPS / Office Location</strong>
              <span>
                {location
                  ? `${Math.round(location.distance)} m from office · ±${Math.round(location.accuracy)} m`
                  : "Not verified"}
              </span>
            </div>
          </div>
          <button
            className="secondary full"
            onClick={locate}
            disabled={locationBusy}
          >
            <MapPin size={18} />
            {locationBusy ? "Getting location…" : "Verify Location"}
          </button>
          <div className="check ok">
            <Clock3 />
            <div>
              <strong>{windowInfo.label}</strong>
              <span>
                {windowInfo.start}–{windowInfo.end} · Philippine Time
              </span>
            </div>
          </div>
          <div className="check">
            <ShieldCheck />
            <div>
              <strong>Emergency Event</strong>
              <span>{event.reason || "Authorized emergency"}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={submit}
          disabled={busy || !photo || !location?.inside}
        >
          <ShieldCheck size={18} />
          {busy ? "Submitting…" : "Submit Attendance"}
        </button>
      </div>
    </div>
  );
}

function SuccessRecord({ record }) {
  return (
    <div className="success">
      <CheckCircle2 size={28} />
      <div>
        <strong>Attendance recorded successfully</strong>
        <span>
          {record.attendance_type} · {formatTime(record.attendance_time)}
        </span>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    onLogin(data.user);
  }

  return (
    <section className="card narrow">
      <h2>Admin Login</h2>
      <p className="muted">Authorized personnel only.</p>
      <form className="form" onSubmit={login}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {message && <div className="notice error">{message}</div>}
        <button className="primary full" disabled={busy}>
          <LogIn size={18} />
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

function AdminDashboard({ user }) {
  const [tab, setTab] = useState("records");
  const [event, setEvent] = useState(null);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reason, setReason] = useState("Power outage");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(phDate());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [date]);

  async function load() {
    setMessage("");
    const [{ data: ev }, { data: emp }, { data: att, error }] =
      await Promise.all([
        supabase
          .from("emergency_events")
          .select("*")
          .eq("status", "ACTIVE")
          .order("activated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("employees").select("*").order("full_name"),
        supabase
          .from("attendance")
          .select("*, employees(employee_no,full_name,department)")
          .eq("attendance_date", date)
          .order("attendance_time"),
      ]);
    setEvent(ev || null);
    setEmployees(emp || []);
    if (error) setMessage(error.message);
    else setRecords(att || []);
  }

  async function activate() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("emergency_events")
      .insert({
        event_date: phDate(),
        reason,
        status: "ACTIVE",
        activated_by: user.id,
      });
    setBusy(false);
    if (error) setMessage(error.message);
    else await load();
  }

  async function deactivate() {
    if (!event) return;
    setBusy(true);
    const { error } = await supabase
      .from("emergency_events")
      .update({ status: "CLOSED", closed_at: new Date().toISOString() })
      .eq("id", event.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else await load();
  }

  async function verify(id, status) {
    const { error } = await supabase
      .from("attendance")
      .update({
        verification_status: status,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) setMessage(error.message);
    else await load();
  }

  async function exportCsv() {
    const rows = records.map((r) => ({
      employee_no: r.employees?.employee_no,
      employee_name: r.employees?.full_name,
      department: r.employees?.department,
      date: r.attendance_date,
      attendance_type: r.attendance_type,
      attendance_time: r.attendance_time,
      latitude: r.latitude,
      longitude: r.longitude,
      gps_accuracy: r.gps_accuracy,
      gps_distance_meters: r.gps_distance_meters,
      method: r.attendance_method,
      verification_status: r.verification_status,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emergency-attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function signOut() {
    await supabase.auth.signOut();
    location.reload();
  }

  return (
    <section>
      <div className="admin-head">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">Emergency attendance management</p>
        </div>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </div>

      {message && <div className="notice error">{message}</div>}

      <div className="admin-grid">
        <div className="card">
          <div className="section-head">
            <h3>Emergency Mode</h3>
            <Settings size={20} />
          </div>
          <div className={`status ${event ? "live" : ""}`}>
            {event ? "ACTIVE" : "INACTIVE"}
          </div>
          {event ? (
            <>
              <p>
                <strong>Reason:</strong> {event.reason}
              </p>
              <p className="muted">
                Activated {formatTime(event.activated_at)}
              </p>
              <button
                className="danger full"
                onClick={deactivate}
                disabled={busy}
              >
                <Power size={18} /> Close Emergency Mode
              </button>
            </>
          ) : (
            <>
              <label>Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option>Power outage</option>
                <option>Biometric machine unavailable</option>
                <option>Network failure</option>
                <option>Maintenance</option>
                <option>Other</option>
              </select>
              <button
                className="primary full"
                onClick={activate}
                disabled={busy}
              >
                <Power size={18} /> Activate Emergency Mode
              </button>
            </>
          )}
        </div>

        <div className="card">
          <div className="section-head">
            <h3>Attendance Windows</h3>
            <Clock3 size={20} />
          </div>
          {WINDOWS.map((w) => (
            <div className="mini-row" key={w.key}>
              <span>{w.label}</span>
              <strong>
                {w.start}–{w.end}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card table-card">
        <div className="section-head">
          <div>
            <h3>Emergency Attendance Records</h3>
            <p className="muted">
              Review records before using them as DTR supporting documentation.
            </p>
          </div>
          <div className="toolbar">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button className="secondary" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="secondary" onClick={exportCsv}>
              <Download size={16} /> CSV
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Time</th>
                <th>GPS</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.employees?.full_name || "—"}</strong>
                    <small>{r.employees?.employee_no}</small>
                  </td>
                  <td>{r.attendance_type}</td>
                  <td>{formatTime(r.attendance_time)}</td>
                  <td>{Math.round(r.gps_distance_meters || 0)} m</td>
                  <td>
                    <span
                      className={`pill ${r.verification_status.toLowerCase()}`}
                    >
                      {r.verification_status}
                    </span>
                  </td>
                  <td>
                    {r.verification_status === "PENDING" && (
                      <>
                        <button
                          className="tiny approve"
                          onClick={() => verify(r.id, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          className="tiny reject"
                          onClick={() => verify(r.id, "REJECTED")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan="6" className="empty">
                    No emergency records for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, text, onRetry }) {
  return (
    <section className="card empty-state">
      <ShieldCheck size={42} />
      <h2>{title}</h2>
      <p>{text}</p>
      {onRetry && (
        <button className="secondary" onClick={onRetry}>
          <RefreshCw size={17} /> Check again
        </button>
      )}
    </section>
  );
}

export default App;
