/**
 * duplicateDetection.js
 *
 * Provides duplicate complaint detection utilities:
 * 1. Category compatibility matching
 * 2. Text normalization and n-gram/token similarity (Jaccard / Sorensen-Dice similarity)
 * 3. Great-circle geographic proximity (Haversine formula) for valid coordinate pairs
 * 4. Multi-factor duplicate scoring and classification
 */

const DEFAULT_WINDOW_DAYS = 30;
const PROXIMITY_RADIUS_METERS = 300; // 300 meters threshold for geo match
const TEXT_SIMILARITY_THRESHOLD = 0.55; // Jaccard/Dice threshold for textual similarity
const COMBINED_CONFIDENCE_THRESHOLD = 0.60;

// Category grouping or compatibility map
// pothole and road_damage are highly related municipal road hazards.
// drainage and water_leakage are related water/sanitation hazards.
const CATEGORY_COMPATIBILITY_GROUPS = [
  new Set(["road_damage", "pothole"]),
  new Set(["water_leakage", "drainage"]),
];

function areCategoriesCompatible(catA, catB) {
  if (!catA || !catB) return false;
  if (catA === catB) return true;
  for (const group of CATEGORY_COMPATIBILITY_GROUPS) {
    if (group.has(catA) && group.has(catB)) {
      return true;
    }
  }
  return false;
}

// English stopwords to filter during text normalization for salient term comparison
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its",
  "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
  "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "should",
  "shouldn't", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
  "were", "weren't", "what", "when", "where", "which", "while", "who", "whom",
  "why", "with", "won't", "would", "wouldn't", "you", "your", "yours", "yourself",
  "yourselves", "please"
]);

/**
 * Normalizes text and produces a set of significant word tokens
 */
function tokenizeText(text) {
  if (typeof text !== "string") return new Set();
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return new Set();

  const words = cleaned.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) {
    const rawWords = cleaned.split(" ").filter((w) => w.length > 0);
    return new Set(rawWords);
  }
  return new Set(words);
}

/**
 * Generates character 3-grams for fuzzy sub-string matching
 */
function getTrigrams(text) {
  if (typeof text !== "string") return new Set();
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const trigrams = new Set();
  if (cleaned.length < 3) {
    if (cleaned.length > 0) trigrams.add(cleaned);
    return trigrams;
  }
  for (let i = 0; i <= cleaned.length - 3; i += 1) {
    trigrams.add(cleaned.substring(i, i + 3));
  }
  return trigrams;
}

/**
 * Computes Jaccard Similarity between two sets
 */
function setJaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount += 1;
    }
  }
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Computes normalized description similarity (token Jaccard + trigram Jaccard)
 */
function computeDescriptionSimilarity(textA, textB) {
  const normA = (textA || "").trim();
  const normB = (textB || "").trim();
  if (!normA || !normB) return 0;
  if (normA.toLowerCase() === normB.toLowerCase()) return 1.0;

  const tokensA = tokenizeText(normA);
  const tokensB = tokenizeText(normB);
  const tokenSim = setJaccardSimilarity(tokensA, tokensB);

  const triA = getTrigrams(normA);
  const triB = getTrigrams(normB);
  const triSim = setJaccardSimilarity(triA, triB);

  // Blend token similarity (50%) and character n-gram similarity (50%)
  return (tokenSim * 0.5) + (triSim * 0.5);
}

/**
 * Validates whether latitude and longitude are valid finite geographic coordinates
 */
function isValidCoordinates(lat, lng) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Calculates Haversine distance in meters between two coordinate pairs
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinates(lat1, lon1) || !isValidCoordinates(lat2, lon2)) {
    return null;
  }

  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates whether two complaints constitute a suspected duplicate
 * @param {Object} candidate - Newly submitted complaint properties
 * @param {Object} existing - Existing incident document
 * @returns {Object|null} - Duplicate match metadata or null if not a match
 */
function evaluateDuplicateMatch(candidate, existing) {
  // 1. Category check
  const catMatch = areCategoriesCompatible(candidate.category, existing.category);
  const exactCategory = candidate.category === existing.category;
  if (!catMatch) {
    return null;
  }

  // 2. Text description similarity
  const textSim = computeDescriptionSimilarity(candidate.description, existing.description);

  // 3. Location / Coordinate proximity
  const hasCandidateCoords = isValidCoordinates(candidate.latitude, candidate.longitude);
  const hasExistingCoords = isValidCoordinates(existing.latitude, existing.longitude);
  const bothHaveCoords = hasCandidateCoords && hasExistingCoords;

  let distanceMeters = null;
  let isProximityMatch = false;

  if (bothHaveCoords) {
    distanceMeters = calculateDistanceMeters(
      candidate.latitude,
      candidate.longitude,
      existing.latitude,
      existing.longitude
    );
    if (distanceMeters !== null && distanceMeters <= PROXIMITY_RADIUS_METERS) {
      isProximityMatch = true;
    }
  }

  // 4. Scoring logic
  let confidence = 0;
  let isDuplicate = false;
  let matchReason = "";

  if (bothHaveCoords && isProximityMatch) {
    // Distance score: 1.0 at 0m, scaling down to 0.5 at 300m
    const geoScore = Math.max(0, 1 - (distanceMeters / (PROXIMITY_RADIUS_METERS * 1.5)));
    confidence = (textSim * 0.5) + (geoScore * 0.4) + (exactCategory ? 0.1 : 0.05);

    if (distanceMeters <= 100 && textSim >= 0.20) {
      isDuplicate = true;
      matchReason = `High geographic proximity (${distanceMeters}m) with related incident description`;
    } else if (textSim >= 0.35) {
      isDuplicate = true;
      matchReason = `Nearby location (${distanceMeters}m) with ${(textSim * 100).toFixed(0)}% text similarity`;
    }
  } else if (!bothHaveCoords) {
    // Missing coordinates on one or both reports. Fallback to text similarity.
    confidence = textSim * (exactCategory ? 1.0 : 0.85);

    if (textSim >= 0.65) {
      isDuplicate = true;
      matchReason = `High description similarity (${(textSim * 100).toFixed(0)}%) in compatible category`;
    } else if (
      textSim >= 0.45 &&
      candidate.location &&
      existing.location &&
      candidate.location.trim().toLowerCase() === existing.location.trim().toLowerCase()
    ) {
      isDuplicate = true;
      confidence = Math.min(1.0, confidence + 0.2);
      matchReason = `Matching location text and ${(textSim * 100).toFixed(0)}% description similarity`;
    }
  } else if (bothHaveCoords && !isProximityMatch) {
    // Both have coordinates, but they are too far apart (> 300m).
    if (textSim >= 0.90 && distanceMeters <= 800) {
      confidence = 0.55;
      isDuplicate = true;
      matchReason = `Identical description despite ${distanceMeters}m separation`;
    }
  }

  if (!isDuplicate || confidence < 0.40) {
    return null;
  }

  return {
    matchedIncidentId: existing._id,
    matchedTrackingReference: existing.trackingReference,
    similarityScore: Math.round(confidence * 100) / 100,
    distanceMeters,
    matchReason,
  };
}

/**
 * Searches recent incidents within the window and finds any duplicate matches
 * @param {Object} candidate
 * @param {Model} IncidentModel
 * @param {Object} options
 */
async function findPotentialDuplicates(candidate, IncidentModel, { windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Retrieve active or recent incidents within windowDays
  let query = IncidentModel.find({
    createdAt: { $gte: windowStart },
  });

  if (query && typeof query.sort === "function") {
    query = query.sort({ createdAt: -1 });
  }
  if (query && typeof query.limit === "function") {
    query = query.limit(100);
  }

  const result = await query;
  const recentIncidents = Array.isArray(result) ? result : [];

  const matches = [];
  for (const existing of recentIncidents) {
    // Ignore self if candidate has an _id already
    if (candidate._id && String(candidate._id) === String(existing._id)) {
      continue;
    }

    const match = evaluateDuplicateMatch(candidate, existing);
    if (match) {
      matches.push(match);
    }
  }

  // Sort matches by highest similarity score
  matches.sort((a, b) => b.similarityScore - a.similarityScore);

  return matches;
}

module.exports = {
  areCategoriesCompatible,
  tokenizeText,
  computeDescriptionSimilarity,
  calculateDistanceMeters,
  isValidCoordinates,
  evaluateDuplicateMatch,
  findPotentialDuplicates,
  PROXIMITY_RADIUS_METERS,
  TEXT_SIMILARITY_THRESHOLD,
  DEFAULT_WINDOW_DAYS,
};
