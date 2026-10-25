import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  GitCompare,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  ExternalLink,
  Flame,
  Check,
  Inbox,
  Filter
} from "lucide-react";
import useAdminAuth from "../context/useAdminAuth";
import {
  ApiError,
  getAdminIncidents,
  getAdminSession,
  getImageUrl,
  logoutAdmin,
  updateIncidentStatus,
} from "../services/api";
import "./Admin.css";

const STATUS_VALUES = ["reported", "investigating", "in_progress", "resolved"];
const PRIORITY_VALUES = ["urgent", "normal", "low"];

const labelFor = (value = "") => value
  .split("_")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function IncidentImage({ incident, onPreview }) {
  const [failed, setFailed] = useState(false);
  if (!incident.image || failed) {
    return (
      <span className="incident-no-image" title={incident.image ? "Image unavailable" : "No image attached"}>
        <ImageIcon size={16} />
      </span>
    );
  }

  return (
    <button
      className="incident-image-button"
      type="button"
      onClick={() => onPreview(incident)}
      aria-label={`Preview attached image for ${incident.category} incident`}
    >
      <img
        src={getImageUrl(incident._id)}
        crossOrigin="use-credentials"
        referrerPolicy="no-referrer"
        loading="lazy"
        alt="Incident evidence"
        onError={() => setFailed(true)}
      />
      <span className="image-open-indicator"><ArrowUpRight size={13} /></span>
    </button>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { csrfToken, setCsrfToken } = useAdminAuth();
  const [incidents, setIncidents] = useState([]);
  const [adminName, setAdminName] = useState("");
  const [pageState, setPageState] = useState("checking");
  const [reloadKey, setReloadKey] = useState(0);
  const [pageError, setPageError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingIncidentId, setUpdatingIncidentId] = useState("");
  const [statusFeedback, setStatusFeedback] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [duplicateFilter, setDuplicateFilter] = useState("all");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [duplicateComparisonIncident, setDuplicateComparisonIncident] = useState(null);

  useEffect(() => {
    if (!csrfToken) return undefined;
    let active = true;

    const loadDashboard = async () => {
      setPageState("checking");
      setPageError("");
      try {
        const session = await getAdminSession();
        if (!active) return;
        setAdminName(session.admin?.username || "Administrator");

        const data = await getAdminIncidents();
        if (!active) return;
        setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
        setPageState("ready");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setCsrfToken("");
          setPageState("expired");
          return;
        }
        setPageError(error.message || "Unable to load the incident records.");
        setPageState("error");
      }
    };

    loadDashboard();
    return () => { active = false; };
  }, [csrfToken, reloadKey, setCsrfToken]);

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(STATUS_VALUES.map((status) => [status, 0]));
    const byPriority = Object.fromEntries(PRIORITY_VALUES.map((priority) => [priority, 0]));
    let duplicates = 0;
    incidents.forEach((incident) => {
      if (Object.hasOwn(byStatus, incident.status)) byStatus[incident.status] += 1;
      if (Object.hasOwn(byPriority, incident.priority)) byPriority[incident.priority] += 1;
      if (incident.isPotentialDuplicate) duplicates += 1;
    });
    return { byStatus, byPriority, duplicates };
  }, [incidents]);

  const visibleIncidents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return incidents
      .filter((incident) => statusFilter === "all" || incident.status === statusFilter)
      .filter((incident) => priorityFilter === "all" || incident.priority === priorityFilter)
      .filter((incident) => {
        if (duplicateFilter === "duplicates") return Boolean(incident.isPotentialDuplicate);
        if (duplicateFilter === "unique") return !incident.isPotentialDuplicate;
        return true;
      })
      .filter((incident) => !query || [
        incident.description,
        incident.category,
        incident.location,
        incident.department,
        incident.trackingReference,
      ].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime();
        const rightTime = new Date(right.createdAt || 0).getTime();
        return sortNewestFirst ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [duplicateFilter, incidents, priorityFilter, search, sortNewestFirst, statusFilter]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logoutAdmin(csrfToken);
      setCsrfToken("");
      navigate("/admin/login", { replace: true, state: { notice: "You have been signed out." } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCsrfToken("");
        setPageState("expired");
      } else {
        setLogoutError(error.message || "Unable to sign out. Please try again.");
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const handleStatusSave = async (incident) => {
    const incidentId = incident._id;
    const nextStatus = statusDrafts[incidentId] ?? incident.status;
    if (!incidentId || !STATUS_VALUES.includes(nextStatus) || nextStatus === incident.status) return;

    setUpdatingIncidentId(incidentId);
    setStatusFeedback((current) => ({ ...current, [incidentId]: null }));
    try {
      const result = await updateIncidentStatus(incidentId, nextStatus, csrfToken);
      const savedStatus = result.incident?.status || nextStatus;
      setIncidents((current) => current.map((item) => (
        item._id === incidentId ? { ...item, status: savedStatus } : item
      )));
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[incidentId];
        return next;
      });
      setStatusFeedback((current) => ({
        ...current,
        [incidentId]: { type: "success", message: "Status saved" },
      }));

      try {
        const refreshed = await getAdminIncidents();
        setIncidents(Array.isArray(refreshed.incidents) ? refreshed.incidents : []);
      } catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          setCsrfToken("");
          setPageState("expired");
          return;
        }
        setStatusFeedback((current) => ({
          ...current,
          [incidentId]: {
            type: "warning",
            message: "Saved, but list could not refresh automatically.",
          },
        }));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCsrfToken("");
        setPageState("expired");
      } else {
        const message = error instanceof ApiError && error.status === 403
          ? "Security check failed. Sign in again and retry."
          : error.message || "Could not update status. Try again.";
        setStatusFeedback((current) => ({
          ...current,
          [incidentId]: { type: "error", message },
        }));
      }
    } finally {
      setUpdatingIncidentId("");
    }
  };

  if (pageState === "expired") {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          <div className="admin-state-icon expired"><Clock3 size={24} /></div>
          <span className="admin-eyebrow">SESSION ENDED</span>
          <h1>Your administrator session expired</h1>
          <p>Sign in again to continue viewing city incident records.</p>
          <Link className="admin-primary-button" to="/admin/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  if (!csrfToken) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ notice: "Sign in again to open a secure administrator session." }}
      />
    );
  }

  if (pageState === "checking" || pageState === "error") {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          {pageState === "checking" ? (
            <div className="admin-loader" aria-label="Loading admin dashboard" />
          ) : (
            <div className="admin-state-icon"><AlertTriangle size={24} /></div>
          )}
          <span className="admin-eyebrow">ADMINISTRATOR CONSOLE</span>
          <h1>{pageState === "checking" ? "Checking secure session" : "Dashboard unavailable"}</h1>
          <p>{pageState === "checking" ? "Verifying access and loading current incident records." : pageError}</p>
          {pageState === "error" && (
            <button className="admin-primary-button" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw size={16} /> Try again
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand" aria-label="UrbanAI citizen portal">
          <span className="admin-brand-mark">U</span>
          <span>Urban<span className="brand-accent">AI</span></span>
          <span className="brand-pill">GOV</span>
        </Link>

        <div className="sidebar-section-label">MUNICIPAL CONSOLE</div>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          <a className="side-nav-link active" href="#overview"><LayoutDashboard size={17} /> Overview</a>
          <a className="side-nav-link" href="#incident-records"><FileText size={17} /> Incident records</a>
          <Link className="side-nav-link" to="/admin/heatmap"><MapPin size={17} /> Incident heatmap</Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-secure">
            <ShieldCheck size={16} />
            <span>Protected workspace</span>
          </div>
          <Link className="citizen-portal-link" to="/report">
            <ArrowUpRight size={15} /> Citizen reporting site
          </Link>
        </div>
      </aside>

      {/* MAIN ADMIN COLUMN */}
      <div className="admin-main-column">
        {/* TOPBAR */}
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <Link to="/">UrbanAI</Link>
            <span>/</span>
            <strong>Government Operations</strong>
          </div>

          <div className="admin-topbar-actions">
            <span className="secure-session">
              <span className="secure-pulse" /> Live Telemetry
            </span>
            <div className="admin-user-chip">
              <span className="admin-avatar">{adminName.slice(0, 1).toUpperCase() || "A"}</span>
              <span className="admin-user-name">{adminName}</span>
            </div>
            <button className="logout-button" type="button" onClick={handleLogout} disabled={loggingOut}>
              <LogOut size={15} />
              <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </header>

        {/* CONTENT VIEW */}
        <main className="admin-content">
          {/* HEADER SECTION */}
          <section className="admin-page-heading" id="overview">
            <div>
              <div className="admin-eyebrow">
                <span className="badge-bullet"></span>
                <span>CITY OPERATIONS REGISTER</span>
              </div>
              <h1>Incident Overview &amp; Triage</h1>
              <p>Review incoming citizen reports, monitor priority resolution, and manage department dispatches.</p>
            </div>

            <div className="admin-heading-actions">
              <button className="refresh-button" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                <RefreshCw size={15} /> Refresh Records
              </button>
              <Link className="refresh-button heatmap-shortcut" to="/admin/heatmap">
                <MapPin size={15} /> Incident Heatmap
              </Link>
            </div>
          </section>

          {logoutError && <div className="admin-inline-error" role="alert">{logoutError}</div>}

          {/* COMPLAINT STATISTICS GRID */}
          <section className="admin-summary-grid" aria-label="Incident summary">
            <article className="summary-card summary-total">
              <div className="summary-card-top">
                <span>Total Incidents</span>
                <span className="summary-icon total-icon"><Activity size={18} /></span>
              </div>
              <strong>{incidents.length}</strong>
              <small>All logged municipal complaints</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>Reported</span>
                <span className="summary-icon blue-icon"><Inbox size={18} /></span>
              </div>
              <strong>{counts.byStatus.reported}</strong>
              <small>Awaiting initial inspection</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>Investigating</span>
                <span className="summary-icon amber-icon"><Search size={18} /></span>
              </div>
              <strong>{counts.byStatus.investigating}</strong>
              <small>Under engineering review</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>In Progress</span>
                <span className="summary-icon purple-icon"><Clock3 size={18} /></span>
              </div>
              <strong>{counts.byStatus.in_progress}</strong>
              <small>Field technicians deployed</small>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <span>Resolved</span>
                <span className="summary-icon green-icon"><CheckCircle2 size={18} /></span>
              </div>
              <strong>{counts.byStatus.resolved}</strong>
              <small>Verified and closed</small>
            </article>

            <article className="summary-card summary-urgent">
              <div className="summary-card-top">
                <span>Urgent Priority</span>
                <span className="summary-icon red-icon"><AlertTriangle size={18} /></span>
              </div>
              <strong>{counts.byPriority.urgent}</strong>
              <small>High severity immediate hazards</small>
            </article>

            <article className="summary-card summary-duplicate">
              <div className="summary-card-top">
                <span>Suspected Duplicates</span>
                <span className="summary-icon duplicate-icon"><GitCompare size={18} /></span>
              </div>
              <strong>{counts.duplicates}</strong>
              <small>Flagged by duplicate clustering</small>
            </article>
          </section>

          {/* PRIORITY STRIP BREAKDOWN */}
          <section className="priority-strip" aria-label="Priority breakdown">
            <span className="priority-strip-title">PRIORITY MIX:</span>
            {PRIORITY_VALUES.map((priority) => (
              <span className={`priority-metric priority-${priority}`} key={priority}>
                <span className="priority-dot" /> {labelFor(priority)}: <strong>{counts.byPriority[priority]}</strong>
              </span>
            ))}
            <span className="priority-strip-note">Based on active AI classification &amp; admin triage</span>
          </section>

          {/* INCIDENT RECORDS DATA TABLE PANEL */}
          <section className="incident-panel" id="incident-records">
            <div className="incident-panel-heading">
              <div>
                <div className="panel-kicker">MUNICIPAL INCIDENT LOG</div>
                <h2>Recent Complaints <span>{incidents.length}</span></h2>
              </div>
              <div className="incident-panel-caption">
                <ShieldCheck size={15} /> Authorized Government View
              </div>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="incident-toolbar">
              <div className="incident-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search description, category, location, tracking reference…"
                  aria-label="Search incidents"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="incident-filters-cluster">
                <label className="filter-select">
                  <SlidersHorizontal size={14} />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
                    <option value="all">All statuses</option>
                    {STATUS_VALUES.map((status) => <option value={status} key={status}>{labelFor(status)}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>

                <label className="filter-select">
                  <AlertTriangle size={14} />
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority">
                    <option value="all">All priorities</option>
                    {PRIORITY_VALUES.map((priority) => <option value={priority} key={priority}>{labelFor(priority)}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>

                <label className="filter-select">
                  <GitCompare size={14} />
                  <select value={duplicateFilter} onChange={(event) => setDuplicateFilter(event.target.value)} aria-label="Filter by duplicates">
                    <option value="all">All reports</option>
                    <option value="duplicates">Duplicates only ({counts.duplicates})</option>
                    <option value="unique">Unique only</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
            </div>

            {/* TABLE SCROLL CONTAINER */}
            <div className="table-scroll-region">
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th>Complaint / Description</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Priority</th>
                    <th>Location</th>
                    <th>Status Management</th>
                    <th>
                      <button className="date-sort-button" type="button" onClick={() => setSortNewestFirst((value) => !value)}>
                        <span>Submitted</span>
                        <ArrowDownUp size={13} />
                      </button>
                    </th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIncidents.map((incident) => (
                    <tr key={incident._id}>
                      <td className="incident-description-cell">
                        <strong className="desc-text">{incident.description || "Untitled incident"}</strong>
                        <div className="desc-meta">
                          <span className="ref-tag">Ref: {incident.trackingReference || String(incident._id || "").slice(-8)}</span>
                          {incident.department && <span className="dept-tag">• {incident.department}</span>}
                        </div>
                        {incident.isPotentialDuplicate && (
                          <button
                            type="button"
                            className="duplicate-badge"
                            onClick={() => setDuplicateComparisonIncident(incident)}
                            title="Flagged by duplicate detection. Click to compare."
                          >
                            <GitCompare size={12} />
                            <span>Potential Duplicate ({incident.duplicateMatches?.length || 1})</span>
                          </button>
                        )}
                      </td>
                      <td>
                        <span className="category-cell-pill">{labelFor(incident.category || "other")}</span>
                      </td>
                      <td>
                        <span className={`severity-tag severity-${incident.severity || "medium"}`}>
                          {labelFor(incident.severity || "medium")}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-tag priority-${incident.priority || "normal"}`}>
                          {labelFor(incident.priority || "normal")}
                        </span>
                      </td>
                      <td className="location-cell">
                        <MapPin size={14} />
                        <span title={incident.location || "Location not provided"}>
                          {incident.location || "—"}
                        </span>
                      </td>
                      <td className="status-editor-cell">
                        <div className="status-editor-controls">
                          <select
                            aria-label={`Status for incident ${String(incident._id).slice(-8)}`}
                            value={statusDrafts[incident._id] ?? incident.status ?? "reported"}
                            disabled={Boolean(updatingIncidentId)}
                            onChange={(event) => {
                              const value = event.target.value;
                              setStatusDrafts((current) => ({ ...current, [incident._id]: value }));
                              setStatusFeedback((current) => ({ ...current, [incident._id]: null }));
                            }}
                          >
                            {STATUS_VALUES.map((status) => (
                              <option value={status} key={status}>{labelFor(status)}</option>
                            ))}
                          </select>
                          <button
                            className="status-save-button"
                            type="button"
                            disabled={
                              Boolean(updatingIncidentId) ||
                              (statusDrafts[incident._id] ?? incident.status) === incident.status
                            }
                            onClick={() => handleStatusSave(incident)}
                          >
                            {updatingIncidentId === incident._id ? "Saving…" : "Save"}
                          </button>
                        </div>
                        {statusFeedback[incident._id] && (
                          <span className={`status-feedback feedback-${statusFeedback[incident._id].type}`} role="status">
                            {statusFeedback[incident._id].message}
                          </span>
                        )}
                      </td>
                      <td className="date-cell">{formatDate(incident.createdAt)}</td>
                      <td><IncidentImage incident={incident} onPreview={setSelectedIncident} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {visibleIncidents.length === 0 && (
                <div className="table-empty-state">
                  <div className="empty-state-icon"><FileText size={22} /></div>
                  <strong>{incidents.length === 0 ? "No incidents logged yet" : "No matching complaints found"}</strong>
                  <p>{incidents.length === 0 ? "Citizen reports will appear here in real time as they are submitted." : "Try adjusting your search terms or filters."}</p>
                  {incidents.length > 0 && (search || statusFilter !== "all" || priorityFilter !== "all" || duplicateFilter !== "all") && (
                    <button
                      type="button"
                      className="clear-filters-btn"
                      onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setDuplicateFilter("all"); }}
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="incident-panel-footer">
              <span>Showing <strong>{visibleIncidents.length}</strong> of <strong>{incidents.length}</strong> complaint records</span>
              <span><ShieldCheck size={14} /> City incident data is strictly restricted to authenticated administrators</span>
            </div>
          </section>

          <footer className="admin-content-footer">
            <span>UrbanAI Municipal Operations Console</span>
            <span className="footer-dot">·</span>
            <span>Empowering Smart Governance with Spatial Intelligence</span>
          </footer>
        </main>
      </div>

      {/* EVIDENCE PHOTO MODAL */}
      {selectedIncident && (
        <div className="image-modal-backdrop" role="presentation" onClick={() => setSelectedIncident(null)}>
          <section className="image-modal" role="dialog" aria-modal="true" aria-labelledby="image-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="image-modal-header">
              <div>
                <span className="modal-kicker">INCIDENT EVIDENCE</span>
                <h2 id="image-modal-title">{labelFor(selectedIncident.category || "incident")}</h2>
              </div>
              <button type="button" onClick={() => setSelectedIncident(null)} aria-label="Close image preview">
                <X size={18} />
              </button>
            </div>
            <div className="image-modal-content">
              <img
                src={getImageUrl(selectedIncident._id)}
                crossOrigin="use-credentials"
                referrerPolicy="no-referrer"
                alt={`Submitted photo for ${selectedIncident.description || "incident"}`}
              />
            </div>
            <p className="image-modal-caption">
              <MapPin size={13} /> {selectedIncident.location || "Location not provided"}
            </p>
          </section>
        </div>
      )}

      {/* SUSPECTED DUPLICATE REVIEW MODAL */}
      {duplicateComparisonIncident && (() => {
        const topMatch = duplicateComparisonIncident.duplicateMatches?.[0] || null;
        const matchedIncident = topMatch?.matchedIncidentId
          ? (typeof topMatch.matchedIncidentId === "object"
              ? topMatch.matchedIncidentId
              : incidents.find((i) => String(i._id) === String(topMatch.matchedIncidentId)))
          : (topMatch?.matchedTrackingReference
              ? incidents.find((i) => i.trackingReference === topMatch.matchedTrackingReference)
              : null);

        return (
          <div className="image-modal-backdrop" role="presentation" onClick={() => setDuplicateComparisonIncident(null)}>
            <section
              className="duplicate-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="duplicate-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="duplicate-modal-header">
                <div className="duplicate-modal-title">
                  <div className="duplicate-modal-icon-wrap">
                    <GitCompare size={18} />
                  </div>
                  <div>
                    <span className="admin-eyebrow" style={{ color: "#D97706" }}>DUPLICATE RESOLUTION</span>
                    <h2 id="duplicate-modal-title">Compare Suspected Duplicate Incident</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateComparisonIncident(null)}
                  aria-label="Close duplicate comparison modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="duplicate-banner">
                <AlertTriangle size={18} />
                <div>
                  <strong>Potential duplicate detected automatically.</strong>{" "}
                  {topMatch?.matchReason || "This complaint closely matches an existing recent incident in category, text, or location."}{" "}
                  UrbanAI preserves all reports and citizen tracking codes for administrative review.
                </div>
              </div>

              <div className="duplicate-comparison-grid">
                <div className="duplicate-side-card candidate-side">
                  <div className="duplicate-side-header">
                    <div>
                      <span className="tag new-report">Incoming Complaint</span>
                    </div>
                    <small className="ref-amber">
                      Ref: {duplicateComparisonIncident.trackingReference || String(duplicateComparisonIncident._id).slice(-8)}
                    </small>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Category</span>
                    <div className="duplicate-meta-value">
                      <strong>{labelFor(duplicateComparisonIncident.category)}</strong>
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Description</span>
                    <div className="duplicate-meta-value">
                      {duplicateComparisonIncident.description}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Location</span>
                    <div className="duplicate-meta-value">
                      <MapPin size={13} style={{ verticalAlign: "middle", marginRight: 4, color: "#D97706" }} />
                      {duplicateComparisonIncident.location || "—"}
                      {duplicateComparisonIncident.latitude !== undefined && duplicateComparisonIncident.longitude !== undefined && (
                        <div className="coords-subtext">
                          Coords: {duplicateComparisonIncident.latitude.toFixed(5)}, {duplicateComparisonIncident.longitude.toFixed(5)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Submission Date</span>
                    <div className="duplicate-meta-value">
                      {formatDate(duplicateComparisonIncident.createdAt)}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Current Status</span>
                    <div className="duplicate-meta-value">
                      <span className={`status-tag status-${duplicateComparisonIncident.status}`}>
                        <i /> {labelFor(duplicateComparisonIncident.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="duplicate-side-card existing-side">
                  <div className="duplicate-side-header">
                    <div>
                      <span className="tag existing-report">Matched Prior Report</span>
                    </div>
                    <small className="ref-blue">
                      Ref: {matchedIncident?.trackingReference || topMatch?.matchedTrackingReference || (topMatch?.matchedIncidentId ? String(topMatch.matchedIncidentId).slice(-8) : "—")}
                    </small>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Category</span>
                    <div className="duplicate-meta-value">
                      <strong>{labelFor(matchedIncident?.category || duplicateComparisonIncident.category)}</strong>
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Description</span>
                    <div className="duplicate-meta-value">
                      {matchedIncident?.description || "Previous report matching this incident."}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Location</span>
                    <div className="duplicate-meta-value">
                      <MapPin size={13} style={{ verticalAlign: "middle", marginRight: 4, color: "#4776B8" }} />
                      {matchedIncident?.location || "Earlier recorded location"}
                      {matchedIncident?.latitude !== undefined && matchedIncident?.longitude !== undefined && (
                        <div className="coords-subtext">
                          Coords: {matchedIncident.latitude.toFixed(5)}, {matchedIncident.longitude.toFixed(5)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Submission Date</span>
                    <div className="duplicate-meta-value">
                      {formatDate(matchedIncident?.createdAt)}
                    </div>
                  </div>

                  <div className="duplicate-meta-row">
                    <span className="duplicate-meta-label">Status</span>
                    <div className="duplicate-meta-value">
                      <span className={`status-tag status-${matchedIncident?.status || "reported"}`}>
                        <i /> {labelFor(matchedIncident?.status || "reported")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="duplicate-metrics-bar">
                <div className="duplicate-metric-pill">
                  <GitCompare size={14} />
                  <span>Match Confidence: <strong>{topMatch?.similarityScore ? `${Math.round(topMatch.similarityScore * 100)}%` : "High"}</strong></span>
                </div>
                <div className="duplicate-metric-pill">
                  <MapPin size={14} />
                  <span>
                    Distance Between Reports:{" "}
                    <strong>
                      {topMatch?.distanceMeters !== null && topMatch?.distanceMeters !== undefined
                        ? `${topMatch.distanceMeters} meters`
                        : "Coordinates not available on one or both reports"}
                    </strong>
                  </span>
                </div>
                <div className="duplicate-metric-pill">
                  <Clock3 size={14} />
                  <span>Detection Window: <strong>Past 30 Days</strong></span>
                </div>
              </div>

              <div className="duplicate-modal-footer">
                <button
                  type="button"
                  className="duplicate-modal-close-btn"
                  onClick={() => setDuplicateComparisonIncident(null)}
                >
                  Close Comparison
                </button>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
}

export default AdminDashboard;
