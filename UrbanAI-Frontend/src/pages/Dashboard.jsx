import { useEffect, useState } from "react";
import {
  MapPin,
  AlertTriangle,
  Activity,
  Brain,
  TrendingUp,
  Clock,
} from "lucide-react";
import "./Dashboard.css";

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/incidents")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setIncidents(data.incidents);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch incidents:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // -----------------------------
  // Dashboard calculations
  // -----------------------------

  const totalReports = incidents.length;

  const urgentIncidents = incidents.filter(
    (incident) => incident.priority === "urgent"
  ).length;

  const activeHotspots = new Set(
    incidents.map((incident) => incident.location)
  ).size;

  const averageConfidence =
    incidents.length > 0
      ? (
          incidents.reduce(
            (total, incident) => total + (incident.aiConfidence || 0),
            0
          ) / incidents.length
        ).toFixed(2)
      : 0;

  // Category count for emerging problems
  const categoryCounts = {};

  for (let i = 0; i < incidents.length; i++) {
    const category = incidents[i].category;

    if (categoryCounts[category]) {
      categoryCounts[category]++;
    } else {
      categoryCounts[category] = 1;
    }
  }

  const getCategoryName = (category) => {
    const names = {
      road_damage: "Road Damage",
      pothole: "Pothole",
      garbage: "Garbage",
      streetlight: "Streetlight",
      water_leakage: "Water Leakage",
      drainage: "Drainage",
      other: "Other",
    };

    return names[category] || category;
  };

  const getSeverityClass = (severity) => {
    if (severity === "high") {
      return "severity-high";
    }

    if (severity === "medium") {
      return "severity-medium";
    }

    return "severity-low";
  };

  const getStatusClass = (status) => {
    if (
      status === "reported" ||
      status === "investigating" ||
      status === "in_progress"
    ) {
      return "status-active";
    }

    return "status-resolved";
  };

  const getStatusName = (status) => {
    const names = {
      reported: "Reported",
      investigating: "Investigating",
      in_progress: "In Progress",
      resolved: "Resolved",
    };

    return names[status] || status;
  };

  return (
    <div className="dashboard">

      {/* Header */}
      <header className="dashboard-header">
        <div>
          <div className="dashboard-logo">
            <div className="logo-icon">U</div>
            <span>
              Urban<span>AI</span>
            </span>
          </div>

          <p className="dashboard-subtitle">
            City Intelligence Dashboard
          </p>
        </div>

        <div className="dashboard-location">
          <MapPin size={17} />
          Smart City Monitoring
        </div>
      </header>

      {/* Overview */}
      <section className="dashboard-content">

        <div className="dashboard-title">
          <div>
            <span>LIVE CITY INTELLIGENCE</span>
            <h1>Urban Activity Overview</h1>

            <p>
              Monitor incidents, emerging problems and AI-generated
              city insights.
            </p>
          </div>

          <div className="live-status">
            <span></span>
            Live Monitoring
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">

          {/* Total Reports */}
          <div className="stat-card">
            <div className="stat-icon">
              <Activity />
            </div>

            <div>
              <p>Total Reports</p>

              <h2>
                {loading ? "..." : totalReports}
              </h2>

              <span className="stat-change">
                <TrendingUp size={14} />
                From MongoDB
              </span>
            </div>
          </div>

          {/* Urgent Incidents */}
          <div className="stat-card">
            <div className="stat-icon urgent">
              <AlertTriangle />
            </div>

            <div>
              <p>Urgent Incidents</p>

              <h2>
                {loading ? "..." : urgentIncidents}
              </h2>

              <span className="stat-change warning">
                Requires attention
              </span>
            </div>
          </div>

          {/* Active Hotspots */}
          <div className="stat-card">
            <div className="stat-icon">
              <MapPin />
            </div>

            <div>
              <p>Active Hotspots</p>

              <h2>
                {loading ? "..." : activeHotspots}
              </h2>

              <span className="stat-change">
                Unique reported locations
              </span>
            </div>
          </div>

          {/* AI Confidence */}
          <div className="stat-card">
            <div className="stat-icon">
              <Brain />
            </div>

            <div>
              <p>AI Confidence</p>

              <h2>
                {loading ? "..." : `${averageConfidence}%`}
              </h2>

              <span className="stat-change">
                Average model confidence
              </span>
            </div>
          </div>

        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">

          {/* Map */}
          <div className="dashboard-card map-dashboard">

            <div className="card-header">
              <div>
                <span>GEOSPATIAL INTELLIGENCE</span>
                <h2>Incident Hotspots</h2>
              </div>

              <button>
                View Map
              </button>
            </div>

            <div className="dashboard-map">

              <div className="map-grid"></div>

              <div className="map-road road-one"></div>
              <div className="map-road road-two"></div>
              <div className="map-road road-three"></div>

              <div className="hotspot hotspot-one"></div>
              <div className="hotspot hotspot-two"></div>
              <div className="hotspot hotspot-three"></div>

              <div className="map-location">
                <MapPin size={16} />

                {incidents.length > 0
                  ? incidents[0].location
                  : "No incidents yet"}

                <small>
                  {incidents.length} incident
                  {incidents.length !== 1 ? "s" : ""}
                </small>
              </div>

            </div>

          </div>

          {/* AI Insights */}
          <div className="dashboard-card">

            <div className="card-header">
              <div>
                <span>AI INTELLIGENCE</span>
                <h2>Emerging Problems</h2>
              </div>

              <Brain size={21} />
            </div>

            <div className="problem-list">

              {Object.keys(categoryCounts).length === 0 ? (
                <div className="problem-item">
                  <div>
                    <strong>No problems detected</strong>
                    <p>Waiting for incident reports</p>
                  </div>
                </div>
              ) : (
                Object.entries(categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([category, count]) => (
                    <div className="problem-item" key={category}>

                      <div>
                        <strong>
                          {getCategoryName(category)}
                        </strong>

                        <p>
                          {count} report
                          {count !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <span className="increase">
                        {count}
                      </span>

                    </div>
                  ))
              )}

            </div>

          </div>

        </div>

        {/* Recent Incidents */}
        <div className="dashboard-card incidents-card">

          <div className="card-header">
            <div>
              <span>INCIDENT MONITORING</span>
              <h2>Recent Reports</h2>
            </div>

            <Clock size={21} />
          </div>

          <div className="incident-table">

            <div className="table-header">
              <span>Incident</span>
              <span>Category</span>
              <span>Severity</span>
              <span>Status</span>
            </div>

            {loading ? (
              <div className="table-row">
                <strong>Loading incidents...</strong>
                <span>---</span>
                <span>---</span>
                <span>---</span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="table-row">
                <strong>No incidents reported yet</strong>
                <span>---</span>
                <span>---</span>
                <span>---</span>
              </div>
            ) : (
              incidents.slice(0, 5).map((incident) => (
                <div
                  className="table-row"
                  key={incident._id}
                >
                  <strong>
                    {incident.description}
                  </strong>

                  <span>
                    {getCategoryName(incident.category)}
                  </span>

                  <b
                    className={getSeverityClass(
                      incident.severity
                    )}
                  >
                    {incident.severity}
                  </b>

                  <span
                    className={getStatusClass(
                      incident.status
                    )}
                  >
                    {getStatusName(incident.status)}
                  </span>
                </div>
              ))
            )}

          </div>

        </div>

      </section>

    </div>
  );
}

export default Dashboard;