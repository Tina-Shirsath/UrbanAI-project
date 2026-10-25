import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import {
  Activity, AlertTriangle, ArrowUpRight, Clock3, FileText, LayoutDashboard,
  LogOut, MapPin, RefreshCw, ShieldCheck,
} from "lucide-react";
import useAdminAuth from "../context/useAdminAuth";
import { ApiError, getAdminIncidents, getAdminSession, logoutAdmin } from "../services/api";
import "./Admin.css";
import "./AdminHeatmap.css";

const STATUS_VALUES = ["reported", "investigating", "in_progress", "resolved"];
const labelFor = (value = "") => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const incidentMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapBounds({ incidents }) {
  const map = useMap();
  useEffect(() => {
    if (incidents.length === 1) {
      map.setView([incidents[0].latitude, incidents[0].longitude], 14);
    } else if (incidents.length > 1) {
      map.fitBounds(incidents.map(({ latitude, longitude }) => [latitude, longitude]), { padding: [28, 28], maxZoom: 14 });
    }
  }, [incidents, map]);
  return null;
}

function formatReportDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function AdminHeatmap() {
  const navigate = useNavigate();
  const { csrfToken, setCsrfToken } = useAdminAuth();
  const [incidents, setIncidents] = useState([]);
  const [adminName, setAdminName] = useState("");
  const [pageState, setPageState] = useState("checking");
  const [pageError, setPageError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!csrfToken) return undefined;
    let active = true;
    const load = async () => {
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
        setPageError(error.message || "Unable to load incident locations.");
        setPageState("error");
      }
    };
    load();
    return () => { active = false; };
  }, [csrfToken, reloadKey, setCsrfToken]);

  const categories = useMemo(() => [...new Set(incidents.map((incident) => incident.category).filter(Boolean))].sort(), [incidents]);
  const filteredIncidents = useMemo(() => incidents.filter((incident) => (
    (categoryFilter === "all" || incident.category === categoryFilter)
    && (statusFilter === "all" || incident.status === statusFilter)
  )), [incidents, categoryFilter, statusFilter]);
  const locations = useMemo(() => {
    const grouped = new Map();
    filteredIncidents.forEach((incident) => {
      const text = String(incident.location || "").trim() || "Location not provided";
      const current = grouped.get(text) || { label: text, count: 0, statuses: Object.fromEntries(STATUS_VALUES.map((status) => [status, 0])) };
      current.count += 1;
      if (Object.hasOwn(current.statuses, incident.status)) current.statuses[incident.status] += 1;
      grouped.set(text, current);
    });
    return [...grouped.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [filteredIncidents]);
  const incidentsWithLocation = filteredIncidents.filter((incident) => String(incident.location || "").trim()).length;
  const mappableIncidents = useMemo(() => filteredIncidents.filter((incident) => (
    typeof incident.latitude === "number"
    && Number.isFinite(incident.latitude)
    && incident.latitude >= -90
    && incident.latitude <= 90
    && typeof incident.longitude === "number"
    && Number.isFinite(incident.longitude)
    && incident.longitude >= -180
    && incident.longitude <= 180
  )), [filteredIncidents]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutAdmin(csrfToken);
      setCsrfToken("");
      navigate("/admin/login", { replace: true, state: { notice: "You have been signed out." } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCsrfToken("");
        setPageState("expired");
      } else {
        setPageError(error.message || "Unable to sign out. Please try again.");
      }
    } finally {
      setLoggingOut(false);
    }
  };

  if (!csrfToken) return <Navigate to="/admin/login" replace state={{ notice: "Sign in again to open a secure administrator session." }} />;
  if (pageState !== "ready") {
    return (
      <main className="admin-state-page">
        <section className="admin-state-card">
          {pageState === "checking" ? <div className="admin-loader" aria-label="Loading incident heatmap" /> : <div className="admin-state-icon"><AlertTriangle size={24} /></div>}
          <span className="admin-eyebrow">ADMINISTRATOR CONSOLE</span>
          <h1>{pageState === "checking" ? "Checking secure session" : pageState === "expired" ? "Your administrator session expired" : "Heatmap data unavailable"}</h1>
          <p>{pageState === "checking" ? "Verifying access and loading incident location summaries." : pageState === "expired" ? "Sign in again to continue viewing city incident records." : pageError}</p>
          {pageState === "expired" ? <Link className="admin-primary-button" to="/admin/login">Return to sign in</Link> : pageState === "error" && <button className="admin-primary-button" type="button" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={16} /> Try again</button>}
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand" aria-label="UrbanAI citizen portal"><span className="admin-brand-mark">U</span><span>Urban<span className="brand-accent">AI</span></span></Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          <Link className="side-nav-link" to="/admin/dashboard"><LayoutDashboard size={17} /> Overview</Link>
          <Link className="side-nav-link" to="/admin/dashboard#incident-records"><FileText size={17} /> Incident records</Link>
          <Link className="side-nav-link active" to="/admin/heatmap"><MapPin size={17} /> Incident heatmap</Link>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-secure"><ShieldCheck size={16} /><span>Protected workspace</span></div><Link className="citizen-portal-link" to="/report"><ArrowUpRight size={15} /> Citizen reporting site</Link></div>
      </aside>

      <div className="admin-main-column">
        <header className="admin-topbar">
          <div className="admin-breadcrumb"><span>UrbanAI</span><span>/</span><strong>Incident heatmap</strong></div>
          <div className="admin-topbar-actions"><span className="secure-session"><span className="secure-pulse" /> Secure session</span><div className="admin-user-chip"><span className="admin-avatar">{adminName.slice(0, 1).toUpperCase() || "A"}</span><span className="admin-user-name">{adminName}</span></div><button className="logout-button" type="button" onClick={handleLogout} disabled={loggingOut}><LogOut size={16} /><span>{loggingOut ? "Signing out…" : "Sign out"}</span></button></div>
        </header>

        <main className="admin-content">
          <section className="admin-page-heading">
            <div><div className="admin-eyebrow"><Activity size={14} /> CITY OPERATIONS</div><h1>Incident heatmap</h1><p>Explore reported locations and map points selected by citizens.</p></div>
            <div className="heatmap-heading-actions"><Link className="refresh-button" to="/admin/dashboard"><LayoutDashboard size={15} /> Overview</Link><button className="refresh-button" type="button" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={15} /> Refresh records</button></div>
          </section>

          {pageError && <div className="admin-inline-error" role="alert">{pageError}</div>}

          <section className="heatmap-filter-panel" aria-label="Incident filters">
            <div><label htmlFor="heatmap-category">Category</label><select id="heatmap-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option value={category} key={category}>{labelFor(category)}</option>)}</select></div>
            <div><label htmlFor="heatmap-status">Status</label><select id="heatmap-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUS_VALUES.map((status) => <option value={status} key={status}>{labelFor(status)}</option>)}</select></div>
            <span className="heatmap-filter-count">{filteredIncidents.length} matching incident{filteredIncidents.length === 1 ? "" : "s"}</span>
          </section>

          <section className="heatmap-stat-grid" aria-label="Filtered location totals">
            <article className="summary-card summary-total"><div className="summary-card-top"><span>Filtered incidents</span><span className="summary-icon"><Activity size={18} /></span></div><strong>{filteredIncidents.length}</strong><small>Matches selected category and status</small></article>
            <article className="summary-card"><div className="summary-card-top"><span>Location descriptions</span><span className="summary-icon blue"><MapPin size={18} /></span></div><strong>{locations.length}</strong><small>Distinct text entries in this view</small></article>
            <article className="summary-card"><div className="summary-card-top"><span>With location text</span><span className="summary-icon amber"><FileText size={18} /></span></div><strong>{incidentsWithLocation}</strong><small>Records with a non-empty location field</small></article>
          </section>

          <section className="heatmap-workspace">
            <article className="heatmap-map-panel">
              <div className="heatmap-panel-heading"><div><div className="admin-eyebrow">MAP VIEW</div><h2>Coordinate map</h2></div><span className="heatmap-mapped-tag"><MapPin size={13} /> {mappableIncidents.length} mapped</span></div>
              {mappableIncidents.length ? (
                <MapContainer className="heatmap-leaflet-map" center={[20, 0]} zoom={2} scrollWheelZoom>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBounds incidents={mappableIncidents} />
                  {mappableIncidents.map((incident, index) => (
                    <Marker
                      key={incident._id || `${incident.latitude}-${incident.longitude}-${index}`}
                      position={[incident.latitude, incident.longitude]}
                      icon={incidentMarkerIcon}
                    >
                      <Popup>
                        <div className="heatmap-marker-details">
                          <strong>{labelFor(incident.category || "Incident")}</strong>
                          <span><b>Status:</b> {labelFor(incident.status || "unknown")}</span>
                          <span><b>Severity:</b> {labelFor(incident.severity || "unknown")}</span>
                          <span><b>Priority:</b> {labelFor(incident.priority || "unknown")}</span>
                          <span><b>Reported:</b> {formatReportDate(incident.createdAt)}</span>
                          <span><b>Location:</b> {String(incident.location || "Location not provided")}</span>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <div className="heatmap-map-empty">
                  <div className="heatmap-map-grid" aria-hidden="true" />
                  <div className="heatmap-map-message"><span className="heatmap-map-icon"><MapPin size={22} /></span><strong>No mapped incidents in this view</strong><p>Citizens need to select a point on the map when reporting an incident. Existing text-only reports remain listed below but are not placed on this map.</p></div>
                </div>
              )}
              <p className="heatmap-map-caption"><ShieldCheck size={14} /> Map pins use citizen-selected coordinates; text locations are not geocoded.</p>
            </article>

            <article className="heatmap-location-panel">
              <div className="heatmap-panel-heading"><div><div className="admin-eyebrow">LOCATION DATA SUMMARY</div><h2>Reported locations <span>{locations.length}</span></h2></div><span className="heatmap-filter-count">{filteredIncidents.length} records</span></div>
              {locations.length ? <div className="heatmap-location-list">{locations.map((entry) => (
                <div className="heatmap-location-row" key={entry.label}><div className="heatmap-location-copy"><span className="heatmap-location-marker"><MapPin size={14} /></span><div><strong>{entry.label}</strong><small>{STATUS_VALUES.filter((status) => entry.statuses[status] > 0).map((status) => `${labelFor(status)} ${entry.statuses[status]}`).join(" · ")}</small></div></div><span className="heatmap-location-total">{entry.count}</span></div>
              ))}</div> : <div className="heatmap-empty"><Clock3 size={20} /><strong>No incidents match these filters</strong><span>Try another category or status.</span></div>}
            </article>
          </section>
          <footer className="admin-content-footer">UrbanAI City Intelligence <span>·</span> Location summaries are available to authorized administrators only.</footer>
        </main>
      </div>
    </div>
  );
}

export default AdminHeatmap;
