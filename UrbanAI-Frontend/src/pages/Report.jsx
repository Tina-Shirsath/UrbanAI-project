import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  Upload,
  Brain,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Copy,
  Download,
  FileText,
  Camera,
  Navigation,
  Loader2,
  Check,
  Building2,
  Search,
  Menu
} from "lucide-react";
import { createIncident } from "../services/api";
import "./Report.css";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const incidentMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function MapRecenter({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 15));
  }, [map, point]);
  return null;
}

function Report() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [locationPickerMessage, setLocationPickerMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [submittedIncident, setSubmittedIncident] = useState(null);
  const [serverMessage, setServerMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [trackingActionMessage, setTrackingActionMessage] = useState("");

  const fileInputRef = useRef(null);

  // Clean up the preview URL when the image changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Handle image selection and validation.
  const handleImageChange = (e) => {
    setFileError("");

    const file = e.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setFileError("Only JPEG and PNG images are supported.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("File size exceeds 5MB limit. Please choose a smaller photo.");
      e.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Remove the selected image.
  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(null);
    setImagePreview(null);
    setFileError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Reset the form so another incident can be reported.
  const handleResetForm = () => {
    setDescription("");
    setCategory("");
    setLocation("");
    setCoordinates(null);
    setLocationPickerMessage("");

    handleRemoveImage();

    setAiResult(null);
    setImageAnalysis(null);
    setSubmittedIncident(null);
    setServerMessage("");
    setErrorMessage("");
    setTrackingActionMessage("");
  };

  const handleCopyTrackingReference = async () => {
    const reference = submittedIncident?.trackingReference;
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setTrackingActionMessage("Tracking reference copied.");
    } catch {
      setTrackingActionMessage("Could not copy automatically. Select and copy the reference above.");
    }
  };

  const handleDownloadReceipt = () => {
    if (!submittedIncident?.trackingReference) return;
    try {
      const submittedDate = submittedIncident.createdAt
        ? new Date(submittedIncident.createdAt).toLocaleString()
        : new Date().toLocaleString();
      const receipt = [
        "UrbanAI Complaint Receipt",
        `Tracking reference: ${submittedIncident.trackingReference}`,
        `Category: ${(submittedIncident.category || aiResult?.category || category).replace(/_/g, " ")}`,
        `Submission date: ${submittedDate}`,
        "",
        "Save this reference. To check your complaint later, visit the UrbanAI tracking page and enter this reference.",
        "Tracking page: /track",
      ].join("\n");
      const blobUrl = URL.createObjectURL(new Blob([receipt], { type: "text/plain;charset=utf-8" }));
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = `urbanai-receipt-${submittedIncident.trackingReference}.txt`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(blobUrl);
      setTrackingActionMessage("Receipt downloaded.");
    } catch {
      setTrackingActionMessage("Could not create the receipt. Please save the reference shown above.");
    }
  };

  // Submit the incident to the backend and receive AI results.
  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setServerMessage("");
    setErrorMessage("");
    setAiResult(null);
    setImageAnalysis(null);
    setSubmittedIncident(null);
    setTrackingActionMessage("");

    try {
      const formData = new FormData();

      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("location", location.trim());

      if (coordinates) {
        formData.append("latitude", String(coordinates.latitude));
        formData.append("longitude", String(coordinates.longitude));
      }

      if (image) {
        formData.append("image", image);
      }

      const data = await createIncident(formData);

      // Text-based AI analysis.
      setAiResult(data.aiAnalysis || null);

      // Computer-vision analysis from the uploaded image.
      setImageAnalysis(data.imageAnalysis || null);

      // Saved incident returned by the backend.
      setSubmittedIncident(data.incident || null);

      setServerMessage(
        data.message || "Report successfully analyzed and submitted to city services."
      );
    } catch (err) {
      console.error("Submission error:", err);

      setErrorMessage(
        err.message || "Something went wrong while submitting the report."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    setLocationPickerMessage("");
    if (!navigator.geolocation) {
      setLocationPickerMessage("Your browser does not support location access. You can select the point on the map instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: currentPosition }) => {
        setCoordinates({ latitude: currentPosition.latitude, longitude: currentPosition.longitude });
        setLocationPickerMessage("Your current location is selected. Adjust the marker on the map if needed.");
        setLocating(false);
      },
      (error) => {
        const messages = {
          1: "Location permission was denied. You can select the incident point directly on the map.",
          2: "Your location is unavailable right now. Check your device location settings or select the point on the map.",
          3: "Finding your location timed out. Try again or select the point on the map.",
        };
        setLocationPickerMessage(messages[error.code] || "Could not get your location. Select the incident point on the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleMapPointSelect = (point) => {
    setCoordinates(point);
    setLocationPickerMessage("Map point selected.");
  };

  // Format uploaded image size.
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="report-page">
      {/* NAVBAR (Consistent with Homepage Brand & Nav) */}
      <header className="report-navbar-wrap">
        <nav className="report-navbar" aria-label="Main Navigation">
          <Link to="/" className="report-brand">
            <div className="report-brand-mark">
              <span className="brand-char">U</span>
            </div>
            <div className="brand-text">
              Urban<span className="brand-accent">AI</span>
            </div>
            <span className="brand-pill">MUNICIPAL INTELLIGENCE</span>
          </Link>

          <div className={`report-nav-menu ${mobileMenuOpen ? "is-open" : ""}`}>
            <Link to="/" onClick={() => setMobileMenuOpen(false)}>Overview</Link>
            <Link to="/#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link to="/#workflow" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link to="/report" className="nav-active" onClick={() => setMobileMenuOpen(false)}>Report Problem</Link>
            <Link to="/track" onClick={() => setMobileMenuOpen(false)}>Track Status</Link>
          </div>

          <div className="report-nav-actions">
            <Link to="/" className="back-home-link">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <Link to="/admin/login" className="report-admin-btn">
              <ShieldCheck size={16} className="btn-icon" />
              <span>Government Portal</span>
            </Link>
            <button
              className="report-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </header>

      {/* MAIN CONTAINER */}
      <main className="report-container">
        {/* PAGE HEADING */}
        <div className="report-heading">
          <div className="report-badge">
            <span className="badge-bullet"></span>
            <span>AI-POWERED CIVIC INTAKE</span>
          </div>

          <h1>Report a Problem</h1>

          <p className="report-description">
            Submit an infrastructure issue in your neighborhood. UrbanAI will automatically evaluate
            the category, severity, and routing department using machine intelligence.
          </p>
        </div>

        {/* REPORT FORM CARD */}
        <div className="report-card">
          <form onSubmit={handleSubmit} className="report-form" noValidate={false}>
            {/* SECTION 1: COMPLAINT DETAILS */}
            <div className="form-card-section">
              <div className="section-header-row">
                <div className="section-icon-wrap">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="section-subtitle">Complaint Details</h2>
                  <p className="section-hint">Provide clear specifics so AI algorithms can classify and prioritize appropriately.</p>
                </div>
              </div>

              {/* PROBLEM DESCRIPTION */}
              <div className="form-field-group">
                <label htmlFor="incident-description" className="field-label">
                  Problem Description <span className="required-star">*</span>
                </label>
                <textarea
                  id="incident-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail (e.g., Deep pothole in right lane on College Road causing traffic hazard)..."
                  required
                  rows={4}
                  className="form-textarea"
                />
                <span className="field-hint">
                  Provide specific details such as hazards, size, or duration of the problem.
                </span>
              </div>

              {/* REPORTED CATEGORY */}
              <div className="form-field-group">
                <label htmlFor="incident-category" className="field-label">
                  Reported Category <span className="required-star">*</span>
                </label>
                <select
                  id="incident-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="form-select"
                >
                  <option value="">Select issue category</option>
                  <option value="pothole">Pothole</option>
                  <option value="road_damage">Road Damage</option>
                  <option value="garbage">Garbage / Waste Accumulation</option>
                  <option value="streetlight">Broken Streetlight</option>
                  <option value="water_leakage">Water Leakage / Pipe Burst</option>
                  <option value="drainage">Blocked / Overflowing Drainage</option>
                  <option value="other">Other Infrastructure Issue</option>
                </select>
                <span className="field-hint">
                  Our AI model will verify and refine this category automatically.
                </span>
              </div>
            </div>

            {/* SECTION 2: LOCATION */}
            <div className="form-card-section">
              <div className="section-header-row">
                <div className="section-icon-wrap">
                  <MapPin size={18} />
                </div>
                <div>
                  <h2 className="section-subtitle">Incident Location</h2>
                  <p className="section-hint">Help municipal response teams locate the precise site for inspection.</p>
                </div>
              </div>

              {/* STREET / LANDMARK INPUT */}
              <div className="form-field-group">
                <label htmlFor="incident-location" className="field-label">
                  Location Details <span className="required-star">*</span>
                </label>
                <div className="location-input-wrapper">
                  <MapPin size={17} className="location-pin-icon" />
                  <input
                    id="incident-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Street name, landmark, or area (e.g., College Road near Bus Stop)"
                    required
                    className="location-text-input"
                  />
                </div>
                <span className="field-hint">
                  Include nearby landmarks to help municipal teams pinpoint the site.
                </span>
              </div>

              {/* INTERACTIVE MAP PIN (OPTIONAL) */}
              <div className="form-field-group">
                <div className="map-label-row">
                  <label htmlFor="incident-map" className="field-label">
                    Pin the incident on the map <span className="optional-tag">(Optional)</span>
                  </label>
                  <button
                    type="button"
                    className="current-location-btn"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                  >
                    <Navigation size={14} className={locating ? "spin-icon" : ""} />
                    <span>{locating ? "Locating…" : "Use my current location"}</span>
                  </button>
                </div>
                <p className="field-hint map-hint-text">
                  Click on the map to place an exact coordinate pin. The text location above remains required.
                </p>

                <div className="map-container-frame">
                  <MapContainer
                    id="incident-map"
                    className="incident-location-map"
                    center={[20, 0]}
                    zoom={2}
                    scrollWheelZoom
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onSelect={handleMapPointSelect} />
                    <MapRecenter point={coordinates} />
                    {coordinates && (
                      <Marker
                        position={[coordinates.latitude, coordinates.longitude]}
                        icon={incidentMarkerIcon}
                      />
                    )}
                  </MapContainer>
                </div>

                {coordinates ? (
                  <div className="selected-coordinates-box" aria-live="polite">
                    <CheckCircle2 size={15} className="coord-check" />
                    <span>
                      Selected coordinate: <strong>Latitude {coordinates.latitude.toFixed(6)}, Longitude {coordinates.longitude.toFixed(6)}</strong>
                    </span>
                  </div>
                ) : (
                  <p className="field-hint subtle-note">No map point selected. Your report will use the text location only.</p>
                )}

                {locationPickerMessage && (
                  <p className="map-picker-message" role="status">
                    {locationPickerMessage}
                  </p>
                )}
              </div>
            </div>

            {/* SECTION 3: SUPPORTING EVIDENCE */}
            <div className="form-card-section">
              <div className="section-header-row">
                <div className="section-icon-wrap">
                  <Camera size={18} />
                </div>
                <div>
                  <h2 className="section-subtitle">Supporting Evidence</h2>
                  <p className="section-hint">Attach high-clarity photos to aid road-damage computer vision analysis.</p>
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="incident-image" className="field-label">
                  Attach Photo <span className="optional-tag">(Optional — JPG, PNG up to 5MB)</span>
                </label>

                {!imagePreview ? (
                  <div className="upload-dropzone">
                    <div className="upload-icon-circle">
                      <Upload size={22} />
                    </div>
                    <strong className="upload-lead-text">Click or drag a photo here to upload</strong>
                    <p className="upload-sub-text">
                      Clear photos help our computer vision algorithms assess structural damage.
                    </p>
                    <input
                      id="incident-image"
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleImageChange}
                      className="upload-file-input"
                    />
                  </div>
                ) : (
                  <div className="image-preview-card">
                    <img
                      src={imagePreview}
                      alt="Incident preview"
                      className="image-preview-thumbnail"
                    />
                    <div className="image-preview-info">
                      <div className="image-preview-name">{image?.name}</div>
                      <div className="image-preview-size">
                        {image ? formatFileSize(image.size) : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="remove-image-button"
                      title="Remove selected image"
                    >
                      <X size={15} />
                      <span>Remove</span>
                    </button>
                  </div>
                )}

                {fileError && (
                  <div className="status-banner error-banner mt-3">
                    <AlertCircle size={16} />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI PIPELINE NOTICE CARD */}
            <div className="ai-pipeline-card">
              <div className="ai-pipeline-icon">
                <Brain size={20} />
              </div>
              <div className="ai-pipeline-content">
                <strong>Automatic Machine Intelligence Pipeline</strong>
                <p>
                  Upon submission, our AI models infer severity, compute priority, check vicinity duplicates,
                  and route this ticket to the appropriate city municipal department in real time.
                </p>
              </div>
            </div>

            {/* FORM ACTIONS / SUBMIT BUTTON */}
            <div className="form-action-row">
              <button
                type="submit"
                disabled={loading}
                className="submit-report-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin-icon" />
                    <span>Analyzing &amp; Submitting Report…</span>
                  </>
                ) : (
                  <>
                    <Brain size={17} />
                    <span>Submit &amp; Analyze Report</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* SERVER SUCCESS MESSAGE */}
          {serverMessage && !errorMessage && (
            <div className="status-banner success-banner">
              <CheckCircle2 size={18} />
              <span>{serverMessage}</span>
            </div>
          )}

          {/* SERVER ERROR MESSAGE */}
          {errorMessage && (
            <div className="status-banner error-banner">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TEXT-BASED AI RESULT DISPLAY */}
          {aiResult && (
            <div className="ai-result-panel">
              <div className="ai-result-header">
                <div>
                  <div className="ai-result-label">
                    <Sparkles size={14} />
                    <span>AI ASSESSMENT RESULTS</span>
                  </div>
                  <h2 className="ai-panel-title">Intelligence Report Generated</h2>
                </div>

                <div className="ai-confidence-pill">
                  <span className="conf-caption">CONFIDENCE</span>
                  <strong className="conf-value">{aiResult.confidence || 0}%</strong>
                </div>
              </div>

              <div className="ai-result-grid">
                <div className="ai-result-cell">
                  <span className="cell-label">Assigned Category</span>
                  <strong className="cell-value">
                    {aiResult.category
                      ? aiResult.category.replace(/_/g, " ").toUpperCase()
                      : "PENDING"}
                  </strong>
                </div>

                <div className="ai-result-cell">
                  <span className="cell-label">Estimated Severity</span>
                  <strong className="cell-value severity-badge">
                    {String(aiResult.severity || "MEDIUM").toUpperCase()}
                  </strong>
                </div>

                <div className="ai-result-cell">
                  <span className="cell-label">Computed Priority</span>
                  <strong className="cell-value priority-badge">
                    {String(aiResult.priority || "NORMAL").toUpperCase()}
                  </strong>
                </div>

                <div className="ai-result-cell">
                  <span className="cell-label">Target Department</span>
                  <strong className="cell-value">
                    {aiResult.department || "General Department"}
                  </strong>
                </div>
              </div>

              <div className="ai-rationale-box">
                <strong className="rationale-heading">Municipal Dispatch Rationale</strong>
                <p className="rationale-text">
                  Based on semantic complaint modeling, this incident has been cataloged under{" "}
                  <b>{aiResult.department || "General Department"}</b> with{" "}
                  <b>{aiResult.priority || "normal"}</b> priority.
                  {submittedIncident?.trackingReference && (
                    <span>
                      {" "}Tracking reference: <code>{submittedIncident.trackingReference}</code>.
                    </span>
                  )}
                </p>
              </div>

              {submittedIncident?.trackingReference && (
                <div className="tracking-receipt-card">
                  <div className="receipt-kicker">YOUR COMPLAINT TRACKING REFERENCE</div>
                  <code className="receipt-reference-code">{submittedIncident.trackingReference}</code>
                  <p className="receipt-instructions">
                    Save this reference number. You can use it anytime on our tracking portal to check real-time resolution status.
                  </p>
                  <div className="receipt-actions">
                    <button type="button" className="receipt-action-btn" onClick={handleCopyTrackingReference}>
                      <Copy size={15} />
                      <span>Copy Tracking ID</span>
                    </button>
                    <button type="button" className="receipt-action-btn" onClick={handleDownloadReceipt}>
                      <Download size={15} />
                      <span>Download Receipt</span>
                    </button>
                    <Link to="/track" className="receipt-action-btn track-portal-btn">
                      <Search size={15} />
                      <span>Go to Tracker</span>
                    </Link>
                  </div>
                  {trackingActionMessage && (
                    <p className="receipt-feedback" role="status">
                      <Check size={14} />
                      <span>{trackingActionMessage}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="result-footer-actions">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="result-secondary-btn"
                >
                  <RotateCcw size={15} />
                  <span>Report Another Problem</span>
                </button>

                <Link to="/admin/login" className="result-secondary-btn">
                  <ShieldCheck size={15} />
                  <span>Government Admin Portal</span>
                </Link>
              </div>
            </div>
          )}

          {/* AI IMAGE DETECTION RESULTS */}
          {imageAnalysis && (
            <div className="ai-result-panel mt-4">
              <div className="ai-result-label">
                <Sparkles size={14} />
                <span>AI IMAGE DETECTION</span>
              </div>

              <h2 className="ai-panel-title">Road Damage Analysis</h2>

              {imageAnalysis.success ? (
                <>
                  <p className="detection-count-text">
                    Detected objects:{" "}
                    <strong>
                      {imageAnalysis.detection_count ??
                        imageAnalysis.detections?.length ??
                        0}
                    </strong>
                  </p>

                  {imageAnalysis.detections?.length > 0 ? (
                    <div className="ai-result-grid mt-3">
                      {imageAnalysis.detections.map((detection, index) => (
                        <div
                          className="ai-result-cell"
                          key={`${detection.class_id ?? "object"}-${index}`}
                        >
                          <span className="cell-label">Detection {index + 1}</span>
                          <strong className="cell-value">
                            {String(detection.class_name || "Unknown").replace(/_/g, " ")}
                          </strong>
                          <span className="cell-sub-detail">
                            Confidence: {Number(detection.confidence ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint mt-2">
                      No road-damage objects were detected in this image.
                    </p>
                  )}

                  <p className="field-hint mt-3">
                    Note: This is an experimental computer-vision model. Predictions may be inaccurate and are reviewed by city administrators.
                  </p>
                </>
              ) : (
                <p className="field-hint mt-2">
                  {imageAnalysis.message || "Image analysis was not available for this report."}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Report;
