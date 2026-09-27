// js/app.js
// Shared behavior used across all Hunger Hub pages.

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initImagePreview();
});

/* ---------- Mobile nav toggle ---------- */
function initNavToggle() {
  const toggle = document.getElementById("navToggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.classList.toggle("open");
  });

  // close menu on link click (mobile)
  links.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
    });
  });
}

/* ---------- Food image preview (donate page) ---------- */
function initImagePreview() {
  const input = document.getElementById("foodImage");
  const preview = document.getElementById("imagePreview");
  if (!input || !preview) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) {
      preview.hidden = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.hidden = false;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Shared helpers ---------- */

// Format a Firestore Timestamp or ISO string into readable text.
export function formatDateTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Human-readable label for a donation status.
export function statusLabel(status) {
  const map = {
    AVAILABLE_FOR_HUMANS: "Available for Humans",
    ANIMAL_FEED_STAGE: "Animal Feeding Stage",
    BIOGAS_STAGE: "Biogas Stage",
    COLLECTED: "Collected"
  };
  return map[status] || status;
}

// Show an inline error element by id.
export function showError(elId, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

// Hide an inline error element by id.
export function hideError(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.hidden = true;
}

// Basic 10-digit mobile number check.
export function isValidMobile(value) {
  return /^[0-9]{10}$/.test(value);
}