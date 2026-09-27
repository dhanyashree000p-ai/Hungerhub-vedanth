// js/collectors.js
// Handles the Collectors page: registration state vs. dashboard state,
// assigned pickups, collection history, points.

import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  serverTimestamp
} from "../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { formatDateTime, statusLabel } from "./app.js";

const registerSection = document.getElementById("collectorRegisterSection");
const dashboardSection = document.getElementById("collectorDashboard");

if (registerSection && dashboardSection) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      // Not logged in — show registration/login prompt state.
      registerSection.hidden = false;
      dashboardSection.hidden = true;
      return;
    }

    const collectorSnap = await getDoc(doc(db, "collectors", user.uid));
    if (!collectorSnap.exists()) {
      // Logged in but not a registered collector.
      registerSection.hidden = false;
      dashboardSection.hidden = true;
      return;
    }

    // Registered collector — show dashboard.
    registerSection.hidden = true;
    dashboardSection.hidden = false;
    initDashboard(user.uid, collectorSnap.data());
  });
}

function initDashboard(collectorId, collectorData) {
  document.getElementById("collectorNameDisplay").textContent = collectorData.name;
  document.getElementById("collectorPoints").textContent = collectorData.points || 0;
  document.getElementById("totalPoints").textContent = collectorData.points || 0;
  document.getElementById("collectedCount").textContent = collectorData.collectedCount || 0;

  listenAssignedCollections(collectorId);
  loadCollectionHistory(collectorId);
}

/* ---------------- Assigned (BIOGAS_STAGE) donations ---------------- */
function listenAssignedCollections(collectorId) {
  const tbody = document.getElementById("assignedTableBody");
  const assignedCountEl = document.getElementById("assignedCount");

  const q = query(
    collection(db, "donations"),
    where("status", "==", "BIOGAS_STAGE")
  );

  onSnapshot(q, snap => {
    tbody.innerHTML = "";
    assignedCountEl.textContent = snap.size;

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No pickups assigned right now.</td></tr>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.donationId}</td>
        <td>${d.boxId}</td>
        <td>${d.foodType === "veg" ? "Veg" : "Non-Veg"}</td>
        <td>${statusLabel(d.status)}</td>
        <td><button class="btn-sm btn-primary collect-btn" data-id="${docSnap.id}">Mark Collected</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".collect-btn").forEach(btn => {
      btn.addEventListener("click", () => markCollected(btn.dataset.id, collectorId));
    });
  });
}

async function markCollected(donationId, collectorId) {
  const POINTS_PER_COLLECTION = 10;

  try {
    await updateDoc(doc(db, "donations", donationId), {
      status: "COLLECTED"
    });

    await updateDoc(doc(db, "collectors", collectorId), {
      points: increment(POINTS_PER_COLLECTION),
      collectedCount: increment(1)
    });

    // foodHistory doc id is auto-generated elsewhere; log a new entry.
    await updateDoc(doc(collection(db, "foodHistory")), {
      donationId,
      status: "COLLECTED",
      updatedAt: serverTimestamp()
    }).catch(() => {
      // if doc doesn't exist yet, ignore — history logging is best-effort here
    });

  } catch (err) {
    console.error("Failed to mark as collected:", err);
    alert("Could not update this collection. Please try again.");
  }
}

/* ---------------- Collection history ---------------- */
async function loadCollectionHistory(collectorId) {
  const tbody = document.getElementById("historyTableBody");

  try {
    const q = query(
      collection(db, "donations"),
      where("status", "==", "COLLECTED"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">No collections yet.</td></tr>`;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.donationId}</td>
        <td>${d.boxId}</td>
        <td>${formatDateTime(d.createdAt)}</td>
        <td>+10</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}