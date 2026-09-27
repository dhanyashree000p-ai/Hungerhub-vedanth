// js/tracking.js
// Handles the Tracking page: lookup by donation ID, live status updates, progress bar.

import {
  db,
  doc,
  getDoc,
  onSnapshot
} from "../firebase/firebase-config.js";
import { showError, hideError, statusLabel } from "./app.js";

const STAGE_ORDER = [
  "AVAILABLE_FOR_HUMANS",
  "ANIMAL_FEED_STAGE",
  "BIOGAS_STAGE",
  "COLLECTED"
];

const trackForm = document.getElementById("trackForm");
let unsubscribe = null;

if (trackForm) {
  trackForm.addEventListener("submit", e => {
    e.preventDefault();
    hideError("trackError");

    const donationId = document.getElementById("donationId").value.trim();
    if (!donationId) {
      return showError("trackError", "Enter a donation ID.");
    }

    trackDonation(donationId);
  });

  // Auto-track if a donation ID is passed via query string (?id=...)
  const params = new URLSearchParams(window.location.search);
  const prefillId = params.get("id");
  if (prefillId) {
    document.getElementById("donationId").value = prefillId;
    trackDonation(prefillId);
  }
}

function trackDonation(donationId) {
  hideError("trackError");

  // Stop any previous live listener.
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  const boxSection = document.getElementById("trackingResult");

  unsubscribe = onSnapshot(
    doc(db, "donations", donationId),
    async docSnap => {
      if (!docSnap.exists()) {
        boxSection.hidden = true;
        return showError("trackError", "No donation found with that ID.");
      }

      const data = docSnap.data();
      boxSection.hidden = false;

      document.getElementById("resDonationId").textContent = data.donationId;
      document.getElementById("resStatus").textContent = statusLabel(data.status);
      document.getElementById("resStatus").className =
        `status-badge status-${data.status.toLowerCase()}`;
      document.getElementById("resTimeRemaining").textContent = getTimeRemaining(data);

      const boxName = await resolveBoxName(data.boxId);
      document.getElementById("resBox").textContent = boxName;

      updateProgressTracker(data.status);
    },
    err => {
      console.error(err);
      showError("trackError", "Something went wrong while tracking. Please try again.");
    }
  );
}

function getTimeRemaining(data) {
  if (data.status === "COLLECTED") return "—";

  const now = new Date();
  const expiry = data.expiryTime ? new Date(data.expiryTime) : null;
  if (!expiry) return "—";

  const diffMs = expiry - now;
  if (diffMs <= 0) return "Window closed";

  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins}m remaining`;
}

async function resolveBoxName(boxId) {
  if (!boxId) return "—";
  try {
    const boxSnap = await getDoc(doc(db, "boxes", boxId));
    return boxSnap.exists() ? boxSnap.data().name : boxId;
  } catch {
    return boxId;
  }
}

function updateProgressTracker(currentStatus) {
  const currentIndex = STAGE_ORDER.indexOf(currentStatus);

  document.querySelectorAll("#progressTracker .stage").forEach(stageEl => {
    const stage = stageEl.dataset.stage;
    const stageIndex = STAGE_ORDER.indexOf(stage);

    stageEl.classList.remove("done", "current");
    if (stageIndex < currentIndex) {
      stageEl.classList.add("done");
    } else if (stageIndex === currentIndex) {
      stageEl.classList.add("current");
    }
  });
}