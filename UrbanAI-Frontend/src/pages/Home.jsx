import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  Layers,
  MapPin,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Flame,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  FileText,
  Activity,
  Menu,
  X
} from "lucide-react";

import "../App.css";

function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="urban-app">
      {/* NAVBAR */}
      <header className="urban-navbar-wrap">
        <nav className="urban-navbar" aria-label="Main Navigation">
          <Link to="/" className="urban-brand">
            <div className="urban-brand-mark">
              <span className="brand-char">U</span>
            </div>
            <div className="brand-text">
              Urban<span className="brand-accent">AI</span>
            </div>
            <span className="brand-pill">MUNICIPAL INTELLIGENCE</span>
          </Link>

          <div className={`urban-nav-menu ${mobileMenuOpen ? "is-open" : ""}`}>
            <a href="#home" onClick={() => setMobileMenuOpen(false)}>Overview</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <Link to="/report" onClick={() => setMobileMenuOpen(false)}>Report Problem</Link>
            <Link to="/track" onClick={() => setMobileMenuOpen(false)}>Track Status</Link>
          </div>

          <div className="urban-nav-actions">
            <Link to="/admin/login" className="urban-admin-btn">
              <ShieldCheck size={16} className="btn-icon" />
              <span>Government Portal</span>
            </Link>
            <button
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="urban-hero" id="home">
          <div className="urban-hero-inner">
            <div className="hero-left">
              <div className="hero-pill-badge">
                <span className="badge-bullet"></span>
                <span>AI-Powered Urban Governance &amp; Resolution Engine</span>
              </div>

              <h1 className="hero-headline">
                Understand your city.
                <br />
                <span className="headline-accent">Improve your city.</span>
              </h1>

              <p className="hero-subtext">
                UrbanAI transforms chaotic citizen complaints into structured municipal intelligence.
                With automated classification, duplicate clustering, and real-time density heatmaps,
                city administrators pinpoint critical issues and resolve infrastructure bottlenecks faster.
              </p>

              {/* ACTION BUTTONS */}
              <div className="hero-cta-cluster">
                <Link to="/report" className="cta-btn cta-primary">
                  <span>Report a Problem</span>
                  <ArrowRight size={17} />
                </Link>

                <Link to="/track" className="cta-btn cta-secondary">
                  <Search size={17} />
                  <span>Track a Complaint</span>
                </Link>
              </div>

              {/* VALUE PROPOSITIONS */}
              <div className="hero-trust-bar">
                <div className="trust-item">
                  <div className="trust-icon-wrap">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <strong>Civic Transparency</strong>
                    <span>Citizen complaint tracking</span>
                  </div>
                </div>

                <div className="trust-divider"></div>

                <div className="trust-item">
                  <div className="trust-icon-wrap">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <strong>NLP Prioritization</strong>
                    <span>Deep classification pipeline</span>
                  </div>
                </div>

                <div className="trust-divider"></div>

                <div className="trust-item">
                  <div className="trust-icon-wrap">
                    <Flame size={16} />
                  </div>
                  <div>
                    <strong>Spatial Hotspots</strong>
                    <span>Incident density mapping</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HERO VISUAL - REDESIGNED SMART CITY DASHBOARD (LIGHT THEME) */}
            <div className="hero-right">
              <div className="dashboard-window-card">
                {/* WINDOW HEADER */}
                <div className="window-chrome">
                  <div className="traffic-lights">
                    <span className="dot dot-close"></span>
                    <span className="dot dot-min"></span>
                    <span className="dot dot-max"></span>
                  </div>
                  <div className="chrome-address">
                    <ShieldCheck size={12} className="chrome-lock" />
                    <span>urbanai.gov/operations-center</span>
                  </div>
                  <div className="chrome-status-live">
                    <span className="live-beacon"></span>
                    Active Telemetry
                  </div>
                </div>

                {/* DASHBOARD BODY */}
                <div className="dash-body">
                  {/* METRIC ROW */}
                  <div className="dash-grid-top">
                    <div className="micro-stat">
                      <div className="stat-label">AI Incident Classifier</div>
                      <div className="stat-val stat-blue">Active • Real-time</div>
                    </div>
                    <div className="micro-stat">
                      <div className="stat-label">Clustering Pipeline</div>
                      <div className="stat-val stat-slate">Geo &amp; Semantic Filter</div>
                    </div>
                    <div className="micro-stat">
                      <div className="stat-label">Heatmap Aggregation</div>
                      <div className="stat-val stat-blue">Weighted Density</div>
                    </div>
                  </div>

                  {/* LIGHT MAP & INCIDENT RADAR */}
                  <div className="simulated-map-zone">
                    <div className="map-base-pattern"></div>

                    {/* MUNICIPAL ROAD GRID SVG */}
                    <svg className="map-vector-routes" viewBox="0 0 500 240" fill="none">
                      <path d="M-10,50 Q160,90 280,40 T510,75" stroke="#DDE5EE" strokeWidth="20" strokeLinecap="round" />
                      <path d="M30,240 Q180,140 270,130 T480,180" stroke="#E3EAF2" strokeWidth="16" strokeLinecap="round" />
                      <path d="M220,-20 L270,260" stroke="#E6EEF7" strokeWidth="22" />
                      <path d="M110,-10 L400,250" stroke="#CBD8E6" strokeWidth="2" strokeDasharray="5 5" />
                    </svg>

                    {/* CLEAN BLUE & NEUTRAL MAP MARKERS */}
                    <div className="map-marker-pin pin-primary" style={{ top: "36%", left: "46%" }}>
                      <span className="marker-ring"></span>
                      <span className="marker-dot"></span>
                    </div>

                    <div className="map-marker-pin pin-secondary" style={{ top: "64%", left: "26%" }}>
                      <span className="marker-dot"></span>
                    </div>

                    <div className="map-marker-pin pin-secondary" style={{ top: "26%", left: "76%" }}>
                      <span className="marker-dot"></span>
                    </div>

                    {/* CLEAN FLOATING INCIDENT CARD 1 */}
                    <div className="hud-floating-card hud-top-left">
                      <div className="hud-icon alert-bg">
                        <AlertTriangle size={15} />
                      </div>
                      <div className="hud-details">
                        <div className="hud-header">
                          <span className="hud-tag critical-tag">Urgent Triage</span>
                          <span className="hud-time">2m ago</span>
                        </div>
                        <div className="hud-title">Water Main Leak &amp; Pavement Crack</div>
                        <div className="hud-meta">
                          <MapPin size={11} />
                          <span>Sector 9 Commercial Ring</span>
                          <span className="meta-sep">•</span>
                          <span className="duplicate-badge">3 Merged</span>
                        </div>
                      </div>
                    </div>

                    {/* CLEAN FLOATING INCIDENT CARD 2 */}
                    <div className="hud-floating-card hud-bottom-right">
                      <div className="hud-icon ai-bg">
                        <Brain size={15} />
                      </div>
                      <div className="hud-details">
                        <div className="hud-header">
                          <span className="hud-tag ai-tag">NLP Routing</span>
                          <span className="hud-score">Category: Sanitation</span>
                        </div>
                        <div className="hud-title">Priority Rank: High (Urgent Dispatch)</div>
                        <div className="hud-meta">
                          <Activity size={11} />
                          <span>Auto-assigned to Public Works Dept</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM TELEMETRY BAR */}
                  <div className="dash-telemetry-bar">
                    <div className="tele-item">
                      <span className="dot-indicator dot-active"></span>
                      <span>Automated Pipeline</span>
                    </div>
                    <div className="tele-item">
                      <span className="tele-dim">Duplicate Detection:</span>
                      <span className="tele-val">Semantic Match</span>
                    </div>
                    <div className="tele-item">
                      <span className="tele-dim">Geocoding:</span>
                      <span className="tele-val">Interactive Leaflet</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOUR ATTRACTIVE FEATURE CARDS (CLEAN SOFT THEME) */}
        <section className="urban-features-section" id="features">
          <div className="section-container">
            <div className="section-head text-center">
              <div className="section-kicker">CORE PLATFORM CAPABILITIES</div>
              <h2 className="section-title">
                Engineered for High-Density Municipal Operations
              </h2>
              <p className="section-description">
                From real-time citizen input to prioritized administrative resolution, UrbanAI
                combines machine learning with spatial visualization to automate urban care.
              </p>
            </div>

            <div className="features-four-grid">
              {/* CARD 1: AI Complaint Classification */}
              <div className="capability-card">
                <div className="card-top">
                  <div className="feature-icon-badge">
                    <Brain size={22} />
                  </div>
                  <span className="card-index">01</span>
                </div>
                <h3 className="card-heading">AI Complaint Classification</h3>
                <p className="card-copy">
                  Automated categorization pipeline powered by AI natural language processing.
                  Incoming citizen descriptions are parsed to extract category, severity levels,
                  and resolution urgency without manual triage.
                </p>
                <div className="card-spec-list">
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Automatic department routing</span>
                  </div>
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Severity &amp; priority scoring</span>
                  </div>
                </div>
              </div>

              {/* CARD 2: Duplicate Detection */}
              <div className="capability-card">
                <div className="card-top">
                  <div className="feature-icon-badge">
                    <Layers size={22} />
                  </div>
                  <span className="card-index">02</span>
                </div>
                <h3 className="card-heading">Duplicate Detection</h3>
                <p className="card-copy">
                  Smart similarity algorithms cluster multiple citizen reports referencing the
                  same incident or pothole. Prevents ticket clutter and aggregates crowd feedback
                  into single unified actionable cases.
                </p>
                <div className="card-spec-list">
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Semantic &amp; geospatial cross-check</span>
                  </div>
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Unified incident thread bundling</span>
                  </div>
                </div>
              </div>

              {/* CARD 3: Incident Heatmaps */}
              <div className="capability-card">
                <div className="card-top">
                  <div className="feature-icon-badge">
                    <MapPin size={22} />
                  </div>
                  <span className="card-index">03</span>
                </div>
                <h3 className="card-heading">Incident Heatmaps</h3>
                <p className="card-copy">
                  Dynamic geospatial mapping highlights problem density hotspots across city
                  coordinates. Enables municipality leaders to deploy maintenance teams
                  proactively rather than reacting after infrastructure failures.
                </p>
                <div className="card-spec-list">
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Interactive Leaflet map visualization</span>
                  </div>
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Filter by category &amp; severity density</span>
                  </div>
                </div>
              </div>

              {/* CARD 4: Complaint Tracking */}
              <div className="capability-card">
                <div className="card-top">
                  <div className="feature-icon-badge">
                    <Search size={22} />
                  </div>
                  <span className="card-index">04</span>
                </div>
                <h3 className="card-heading">Complaint Tracking</h3>
                <p className="card-copy">
                  End-to-end transparent accountability for every submission. Citizens query
                  their unique complaint ID anytime to inspect real-time review stages,
                  administrator feedback, and confirmed resolution status.
                </p>
                <div className="card-spec-list">
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Transparent status lifecycle tracking</span>
                  </div>
                  <div className="spec-item">
                    <CheckCircle2 size={14} className="spec-check" />
                    <span>Direct lookup with instant feedback</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="urban-workflow-section" id="workflow">
          <div className="section-container">
            <div className="section-head text-center">
              <div className="section-kicker">MUNICIPAL WORKFLOW LIFECYCLE</div>
              <h2 className="section-title">
                How UrbanAI Orchestrates City Improvement
              </h2>
              <p className="section-description">
                A seamless 4-step pipeline bridging civic awareness with automated intelligence
                and administrative execution.
              </p>
            </div>

            <div className="workflow-steps-track">
              {/* STEP 1 */}
              <div className="workflow-step-node">
                <div className="step-badge-num">1</div>
                <div className="step-card">
                  <div className="step-card-icon">
                    <FileText size={20} />
                  </div>
                  <h4 className="step-title">Citizen Reporting</h4>
                  <p className="step-summary">
                    A resident spots an urban issue, selects a location on the interactive map,
                    and submits details with photo evidence in under 60 seconds.
                  </p>
                  <div className="step-pill">Civic Submission</div>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="workflow-step-node">
                <div className="step-badge-num">2</div>
                <div className="step-card">
                  <div className="step-card-icon">
                    <Brain size={20} />
                  </div>
                  <h4 className="step-title">AI Analysis</h4>
                  <p className="step-summary">
                    UrbanAI algorithms evaluate the report: determining classification, calculating
                    severity priority, and scanning vicinity coordinates for existing duplicates.
                  </p>
                  <div className="step-pill">Automated Triage</div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="workflow-step-node">
                <div className="step-badge-num">3</div>
                <div className="step-card">
                  <div className="step-card-icon">
                    <Building2 size={20} />
                  </div>
                  <h4 className="step-title">Administrator Review</h4>
                  <p className="step-summary">
                    Municipal teams view ranked incidents, inspect heatmaps, assign field technicians,
                    and update progress from the secure Government Admin dashboard.
                  </p>
                  <div className="step-pill">Municipal Action</div>
                </div>
              </div>

              {/* STEP 4 */}
              <div className="workflow-step-node">
                <div className="step-badge-num">4</div>
                <div className="step-card">
                  <div className="step-card-icon">
                    <Clock size={20} />
                  </div>
                  <h4 className="step-title">Status Tracking</h4>
                  <p className="step-summary">
                    Citizens monitor their complaint lifecycle from &lsquo;Under Review&rsquo; to &lsquo;Resolved&rsquo;,
                    establishing trust through clear institutional transparency.
                  </p>
                  <div className="step-pill">Civic Transparency</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION / BANNER */}
        <section className="urban-action-banner">
          <div className="banner-content">
            <div className="banner-tag">
              <Sparkles size={14} />
              <span>TRANSFORMING URBAN LIVING</span>
            </div>
            <h2 className="banner-headline">
              Ready to report an issue or review city intelligence?
            </h2>
            <p className="banner-subtext">
              Join proactive residents and municipal planners making neighborhood streets safer,
              cleaner, and better connected.
            </p>
            <div className="banner-actions">
              <Link to="/report" className="cta-btn cta-primary">
                <span>Submit a Citizen Report</span>
                <ArrowRight size={17} />
              </Link>
              <Link to="/track" className="cta-btn cta-secondary">
                <span>Check Complaint Status</span>
              </Link>
              <Link to="/admin/login" className="cta-btn cta-outline">
                <ShieldCheck size={16} />
                <span>Admin Login</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="urban-footer" id="about">
        <div className="footer-inner">
          <div className="footer-primary-col">
            <div className="footer-brand">
              <div className="urban-brand-mark small">
                <span>U</span>
              </div>
              <span className="brand-text">Urban<span className="brand-accent">AI</span></span>
            </div>
            <p className="footer-bio">
              Next-generation smart city intelligence platform combining citizen crowdsourcing,
              machine learning classification, and spatial analytics for proactive municipal governance.
            </p>
          </div>

          <div className="footer-nav-group">
            <div className="footer-heading">Navigation</div>
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#workflow">How It Works</a>
            <a href="#about">About UrbanAI</a>
          </div>

          <div className="footer-nav-group">
            <div className="footer-heading">Citizen Tools</div>
            <Link to="/report">Report a Problem</Link>
            <Link to="/track">Track a Complaint</Link>
          </div>

          <div className="footer-nav-group">
            <div className="footer-heading">Administration</div>
            <Link to="/admin/login">Government Portal</Link>
            <Link to="/admin/heatmap">Incident Heatmaps</Link>
            <Link to="/admin/dashboard">Operations Dashboard</Link>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-copy">
            &copy; {new Date().getFullYear()} UrbanAI. Empowering Smarter Cities Through Intelligence.
          </div>
          <div className="footer-tags">
            <span>AI Incident Management</span>
            <span>Spatial Telemetry</span>
            <span>Municipal Governance</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
