/**
 * UrbanAI Frontend API Service
 * Centralized client for communicating with UrbanAI-Backend (Express :5000)
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.message || "The request could not be completed", response.status);
  }
  return data;
}

/**
 * Fetch all incidents from the backend
 * @returns {Promise<{ success: boolean, count: number, incidents: Array }>}
 */
export async function getIncidents() {
  const response = await fetch(`${API_BASE_URL}/api/incidents`);
  return readResponse(response);
}

/**
 * Create a new incident with multipart form data
 * @param {FormData} formData
 * @returns {Promise<{ success: boolean, message: string, aiAnalysis: object, incident: object }>}
 */
export async function createIncident(formData) {
  const response = await fetch(`${API_BASE_URL}/api/incidents`, {
    method: "POST",
    body: formData,
  });

  return readResponse(response);
}

export async function trackIncident(reference) {
  const response = await fetch(`${API_BASE_URL}/api/incidents/track/${encodeURIComponent(reference)}`);
  return readResponse(response);
}

export async function loginAdmin(credentials) {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return readResponse(response);
}

export async function getAdminSession() {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/session`, {
    credentials: "include",
  });
  return readResponse(response);
}

export async function logoutAdmin(csrfToken) {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: "{}",
  });
  return readResponse(response);
}

export async function updateIncidentStatus(incidentId, status, csrfToken) {
  const response = await fetch(
    `${API_BASE_URL}/api/incidents/${encodeURIComponent(incidentId)}/status`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ status }),
    }
  );
  return readResponse(response);
}

export async function getAdminIncidents() {
  const response = await fetch(`${API_BASE_URL}/api/incidents`, {
    credentials: "include",
  });
  return readResponse(response);
}

/**
 * Build an administrator-authenticated URL for an incident's uploaded image.
 * @param {string|null} incidentId
 * @returns {string|null}
 */
export function getImageUrl(incidentId) {
  if (!incidentId) return null;
  return `${API_BASE_URL}/api/incidents/${encodeURIComponent(incidentId)}/image`;
}
