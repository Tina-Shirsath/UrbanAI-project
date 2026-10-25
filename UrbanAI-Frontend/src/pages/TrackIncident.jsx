import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Clock,
  Activity,
  FileCheck,
  Check,
  Calendar,
  Tag,
  Hash,
  Menu,
  X,
  PlusCircle,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { trackIncident } from "../services/api";
import "./TrackIncident.css";

const STATUS_CONFIG = {
  reported: {
    label: "Reported",
    stepIndex: 1,
    badgeClass: "badge-reported",
    description: "Your complaint has been logged and received by our intake system.",
  },
  investigating: {
    label: "Investigating",
    stepIndex: 2,
    badgeClass: "badge-investigating",
    description: "Municipal engineers are reviewing the complaint location and severity.",
  },
  in_progress: {
    label: "In Progress",
    stepIndex: 3,
    badgeClass: "badge-progress",
    description: "A field operations team has been dispatched to address the issue.",
  },
  resolved: {
    label: "Resolved",
    stepIndex: 4,
    badgeClass: "badge-resolved",
    description: "Corrective work has been completed and verified by city administration.",
  },
};

const LIFECYCLE_STEPS = [
  { key: "reported", label: "Reported", desc: "Intake & AI Categorization" },
  { key: "investigating", label: "Investigating", desc: "Municipal Assessment" },
  { key: "in_progress", label: "In Progress", desc: "Field Team Dispatched" },
  { key: "resolved", label: "Resolved", desc: "Verified & Closed" },
];

function TrackIncident() {
  const [reference, setReference] = useState("");
  const [incident, setIncident] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanRef = reference.trim();
    if (!cleanRef) return;

    setError("");
    setIncident(null);
    setLoading(true);
    setHasSearched(true);

    try {
      const result = await trackIncident(cleanRef);
      setIncident(result.incident);
    } catch (err) {
      setError(err.message || "Unable to look up this complaint. Please verify the tracking ID.");
    } finally {
      setLoading(false);
    }
  };

  const currentStatusKey = incident?.status?.toLowerCase() || "";
  const currentConfig = STATUS_CONFIG[currentStatusKey] || {
    label: incident?.status || "Unknown",
    stepIndex: 1,
    badgeClass: "badge-reported",
    description: "Current stage status reported by city administration.",
  };

  return (
    <div className="tracking-app">
      {/* NAVBAR (Consistent with Homepage and Report Page) */}
      <header className="tracking-navbar-wrap">
        <nav className="tracking-navbar" aria-label="Main Navigation">
          <Link to="/" className="tracking-brand">
            <div className="tracking-brand-mark">
              <span className="brand-char">U</span>
            </div>
            <div className="brand-text">
              Urban<span className="brand-accent">AI</span>
            </div>
            <span className="brand-pill">MUNICIPAL INTELLIGENCE</span>
          </Link>

          <div className={`tracking-nav-menu ${mobileMenuOpen ? "is-open" : ""}`}>
            <Link to="/" onClick={() => setMobileMenuOpen(false)}>Overview</Link>
            <Link to="/#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link to="/#workflow" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link to="/report" onClick={() => setMobileMenuOpen(false)}>Report Problem</Link>
            <Link to="/track" className="nav-active" onClick={() => setMobileMenuOpen(false)}>Track Status</Link>
          </div>

          <div className="tracking-nav-actions">
            <Link to="/" className="back-home-link">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <Link to="/admin/login" className="tracking-admin-btn">
              <ShieldCheck size={16} className="btn-icon" />
              <span>Government Portal</span>
            </Link>
            <button
              className="tracking-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="tracking-container">
        {/* PAGE HEADING */}
        <div className="tracking-heading">
          <div className="tracking-pill-badge">
            <span className="badge-bullet"></span>
            <span>PUBLIC COMPLAINT TRACKER</span>
          </div>

          <h1>Track Your Complaint</h1>

          <p className="tracking-description">
            Monitor the real-time resolution lifecycle of your reported infrastructure issue. Enter the
            unique tracking reference generated during submission.
          </p>
        </div>

        {/* SEARCH CARD */}
        <div className="tracking-search-card">
          <form className="tracking-form" onSubmit={handleSubmit} noValidate={false}>
            <label htmlFor="tracking-reference" className="tracking-input-label">
              Tracking Reference Number
            </label>

            <div className="tracking-input-row">
              <div className="tracking-field-wrap">
                <Hash size={18} className="tracking-prefix-icon" />
                <input
                  id="tracking-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="e.g. UAI-0123ABCDEF456789012345"
                  autoComplete="off"
                  required
                  maxLength={32}
                  className="tracking-text-input"
                  aria-describedby="tracking-reference-hint"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !reference.trim()}
                className="tracking-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="tracking-spin-icon" />
                    <span>Searching…</span>
                  </>
                ) : (
                  <>
                    <Search size={17} />
                    <span>Track Status</span>
                  </>
                )}
              </button>
            </div>

            <p id="tracking-reference-hint" className="tracking-field-hint">
              Use the reference shown on your submission receipt or confirmation message (format starts with <code>UAI-</code>).
            </p>
          </form>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="tracking-loading-card" role="status" aria-live="polite">
            <Loader2 size={32} className="tracking-spin-icon spinner-accent" />
            <h3>Checking municipal database…</h3>
            <p>Retrieving real-time status and telemetry for {reference}…</p>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !loading && (
          <div className="tracking-alert-card error-card" role="alert">
            <div className="alert-icon-wrap error-icon-bg">
              <AlertCircle size={22} />
            </div>
            <div className="alert-content">
              <h3>Complaint Lookup Failed</h3>
              <p>{error}</p>
              <div className="alert-suggestions">
                <span>Please ensure:</span>
                <ul>
                  <li>The tracking ID includes the &lsquo;UAI-&rsquo; prefix followed by 24 alphanumeric characters.</li>
                  <li>No spaces or extra punctuation were added.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESSFUL RESULT CARD & PROGRESS TRACKER */}
        {incident && !loading && (
          <section className="tracking-result-panel" aria-live="polite">
            {/* CARD HEADER */}
            <div className="result-panel-top">
              <div className="result-header-left">
                <div className="result-status-tag">
                  <CheckCircle2 size={16} />
                  <span>COMPLAINT FOUND</span>
                </div>
                <h2 className="result-title">
                  Incident Status Overview
                </h2>
              </div>

              <div className={`status-pill ${currentConfig.badgeClass}`}>
                <span className="status-live-dot"></span>
                <span>{currentConfig.label}</span>
              </div>
            </div>

            {/* REAL-TIME PROGRESS TRACKER */}
            <div className="lifecycle-tracker-wrap">
              <div className="lifecycle-progress-bar-bg">
                <div
                  className="lifecycle-progress-bar-fill"
                  style={{
                    width: `${((currentConfig.stepIndex - 1) / (LIFECYCLE_STEPS.length - 1)) * 100}%`,
                  }}
                ></div>
              </div>

              <div className="lifecycle-steps-grid">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const stepNumber = idx + 1;
                  const isDone = stepNumber < currentConfig.stepIndex;
                  const isCurrent = stepNumber === currentConfig.stepIndex;
                  const isUpcoming = stepNumber > currentConfig.stepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`step-item ${isDone ? "step-done" : ""} ${isCurrent ? "step-current" : ""} ${isUpcoming ? "step-upcoming" : ""}`}
                    >
                      <div className="step-marker-node">
                        {isDone ? (
                          <Check size={14} className="node-check" />
                        ) : (
                          <span className="node-num">{stepNumber}</span>
                        )}
                      </div>
                      <div className="step-copy">
                        <strong className="step-name">{step.label}</strong>
                        <span className="step-sub">{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STATUS EXPLANATION BANNER */}
            <div className="status-explanation-box">
              <div className="explanation-icon">
                <Activity size={18} />
              </div>
              <div className="explanation-body">
                <strong>Current Stage: {currentConfig.label}</strong>
                <p>{currentConfig.description}</p>
              </div>
            </div>

            {/* INCIDENT DETAILS METRICS GRID */}
            <div className="result-details-grid">
              <div className="detail-data-cell">
                <div className="cell-header">
                  <Hash size={14} className="cell-icon" />
                  <span className="cell-title">Tracking Reference</span>
                </div>
                <code className="cell-data-value tracking-ref-value">
                  {incident.trackingReference}
                </code>
              </div>

              <div className="detail-data-cell">
                <div className="cell-header">
                  <Tag size={14} className="cell-icon" />
                  <span className="cell-title">Category</span>
                </div>
                <strong className="cell-data-value text-capitalize">
                  {(incident.category || "General").replaceAll("_", " ")}
                </strong>
              </div>

              <div className="detail-data-cell">
                <div className="cell-header">
                  <Calendar size={14} className="cell-icon" />
                  <span className="cell-title">Submitted Date</span>
                </div>
                <strong className="cell-data-value">
                  {incident.submittedAt
                    ? new Date(incident.submittedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </strong>
              </div>

              <div className="detail-data-cell">
                <div className="cell-header">
                  <Clock size={14} className="cell-icon" />
                  <span className="cell-title">Current Status</span>
                </div>
                <strong className={`cell-data-value status-text-colored ${currentConfig.badgeClass}`}>
                  {currentConfig.label}
                </strong>
              </div>
            </div>

            {/* CARD FOOTER ACTIONS */}
            <div className="result-footer-row">
              <Link to="/report" className="result-action-link primary-action">
                <PlusCircle size={15} />
                <span>Report Another Issue</span>
              </Link>
              <Link to="/" className="result-action-link secondary-action">
                <span>Return to Overview</span>
              </Link>
            </div>
          </section>
        )}

        {/* DEFAULT EMPTY STATE GUIDE */}
        {!incident && !error && !loading && (
          <div className="tracking-guide-card">
            <div className="guide-icon-wrap">
              <HelpCircle size={22} />
            </div>
            <div className="guide-content">
              <h3>Where do I find my Tracking Reference?</h3>
              <p>
                When you submit an infrastructure issue on the <strong>Report a Problem</strong> page,
                UrbanAI automatically issues a unique 24-character code (such as <code>UAI-9F3B...</code>).
                If you recently submitted a report, check your downloaded receipt or the submission confirmation screen.
              </p>
              <div className="guide-action-row">
                <Link to="/report" className="guide-action-btn">
                  <span>Submit a New Report</span>
                  <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* PRIVACY / SECURITY NOTE */}
        <p className="tracking-security-note">
          To protect citizen privacy, public lookup records display verified municipal progress,
          classification, and timestamp data without exposing personal identifying information.
        </p>
      </main>
    </div>
  );
}

export default TrackIncident;
