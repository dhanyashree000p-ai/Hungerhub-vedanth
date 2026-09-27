// js/dashboard.js
// Handles the Admin Dashboard: stats, tabbed management panels for
// users, boxes, donations, and collectors.

import {
  db,
  collection,
  doc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "../firebase/firebase-config.js";
import { requireAuth } from "./auth.js";
import { formatDateTime, statusLabel } from "./app.js";

if (document.getElementById("statTotalDonations")) {
  requireAuth(() => {
    // NOTE: in production, also verify role === "admin" here
    // via a Firestore read on the users collection before rendering.
    listenStats();
    initTabs();
    loadUsers();
    loadBoxes();
    loadDonations();
    loadCollectors();
    initAddBox();
  });
}

/* ---------------- Stats ---------------- */
function listenStats() {
  onSnapshot(collection(db, "donations"), snap => {
    let active = 0, human = 0, animal = 0, biogas = 0;

    snap.forEach(docSnap => {
      const status = docSnap.data().status;
      if (status !== "COLLECTED") active++;
      if (status === "AVAILABLE_FOR_HUMANS") human++;
      if (status === "ANIMAL_FEED_STAGE") animal++;
      if (status === "BIOGAS_STAGE" || status === "COLLECTED") biogas++;
    });

    document.getElementById("statTotalDonations").textContent = snap.size;
    document.getElementById("statActiveDonations").textContent = active;
    document.getElementById("statHumanCount").textContent = human;
    document.getElementById("statAnimalCount").textContent = animal;
    document.getElementById("statBiogasCount").textContent = biogas;
  });
}

/* ---------------- Tabs ---------------- */
function initTabs() {
  const buttons = document.querySelectorAll(".admin-tab-btn");
  const panels = document.querySelectorAll(".admin-tab-panel");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      panels.forEach(p => (p.hidden = true));

      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
    });
  });
}

/* ---------------- Manage Users ---------------- */
async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));

  tbody.innerHTML = "";
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No users yet.</td></tr>`;
    return;
  }

  snap.forEach(docSnap => {
    const u = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${u.mobile}</td>
      <td>${u.country || "—"}</td>
      <td>${u.role}</td>
      <td>${formatDateTime(u.createdAt)}</td>
      <td><button class="btn-sm btn-danger remove-user-btn" data-id="${docSnap.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".remove-user-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Soft-disable rather than hard delete — flag for review.
      updateDoc(doc(db, "users", btn.dataset.id), { role: "disabled" })
        .then(loadUsers)
        .catch(err => console.error("Failed to disable user:", err));
    });
  });
}

/* ---------------- Manage Boxes ---------------- */
async function loadBoxes() {
  const tbody = document.getElementById("boxesTableBody");
  const snap = await getDocs(query(collection(db, "boxes"), orderBy("name")));

  tbody.innerHTML = "";
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No boxes added yet.</td></tr>`;
    return;
  }

  snap.forEach(docSnap => {
    const b = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.name}</td>
      <td>${b.location}</td>
      <td>${b.capacity}</td>
      <td>${b.availableSlots}</td>
      <td><button class="btn-sm btn-danger remove-box-btn" data-id="${docSnap.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".remove-box-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      updateDoc(doc(db, "boxes", btn.dataset.id), { availableSlots: 0 })
        .then(loadBoxes)
        .catch(err => console.error("Failed to update box:", err));
    });
  });
}

function initAddBox() {
  const addBtn = document.getElementById("addBoxBtn");
  if (!addBtn) return;

  addBtn.addEventListener("click", async () => {
    const name = prompt("Box name:");
    if (!name) return;
    const location = prompt("Location (address):") || "";
    const capacity = Number(prompt("Capacity:")) || 0;
    const latitude = Number(prompt("Latitude:")) || 0;
    const longitude = Number(prompt("Longitude:")) || 0;

    try {
      const boxRef = doc(collection(db, "boxes"));
      await setDoc(boxRef, {
        boxId: boxRef.id,
        name,
        location,
        capacity,
        availableSlots: capacity,
        latitude,
        longitude
      });
      loadBoxes();
    } catch (err) {
      console.error("Failed to add box:", err);
      alert("Could not add box.");
    }
  });
}

/* ---------------- Manage Donations ---------------- */
async function loadDonations() {
  const tbody = document.getElementById("donationsTableBody");
  const snap = await getDocs(query(collection(db, "donations"), orderBy("createdAt", "desc")));

  tbody.innerHTML = "";
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No donations yet.</td></tr>`;
    return;
  }

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.donationId}</td>
      <td>${d.foodName}</td>
      <td>${d.foodType === "veg" ? "Veg" : "Non-Veg"}</td>
      <td>${d.category}</td>
      <td>${d.boxId}</td>
      <td>${statusLabel(d.status)}</td>
      <td>${formatDateTime(d.createdAt)}</td>
      <td><button class="btn-sm btn-danger remove-donation-btn" data-id="${docSnap.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".remove-donation-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("Remove this donation record?")) return;
      updateDoc(doc(db, "donations", btn.dataset.id), { status: "REMOVED" })
        .then(loadDonations)
        .catch(err => console.error("Failed to remove donation:", err));
    });
  });
}

/* ---------------- Manage Collectors ---------------- */
async function loadCollectors() {
  const tbody = document.getElementById("collectorsTableBody");
  const snap = await getDocs(query(collection(db, "collectors"), orderBy("points", "desc")));

  tbody.innerHTML = "";
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No collectors registered yet.</td></tr>`;
    return;
  }

  snap.forEach(docSnap => {
    const c = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.mobile}</td>
      <td>${c.points || 0}</td>
      <td>${c.collectedCount || 0}</td>
      <td><button class="btn-sm btn-danger remove-collector-btn" data-id="${docSnap.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".remove-collector-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("Remove this collector?")) return;
      updateDoc(doc(db, "collectors", btn.dataset.id), { points: 0, collectedCount: 0 })
        .then(loadCollectors)
        .catch(err => console.error("Failed to remove collector:", err));
    });
  });
}