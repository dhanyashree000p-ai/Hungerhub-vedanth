// js/donate.js
// Handles the Donate page: box list population, image upload, disclaimer, submission.

import {
  auth,
  db,
  storage,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "../firebase/firebase-config.js";
import { requireAuth } from "./auth.js";
import { showError, hideError } from "./app.js";

const donateForm = document.getElementById("donateForm");
if (donateForm) {
  let currentUser = null;

  requireAuth(user => {
    currentUser = user;
    loadBoxes();
  });

  donateForm.addEventListener("submit", async e => {
    e.preventDefault();
    hideError("formError");

    if (!currentUser) {
      return showError("formError", "Please log in to donate.");
    }

    const foodName = document.getElementById("foodName").value.trim();
    const foodCategory = document.getElementById("foodCategory").value;
    const foodType = donateForm.querySelector('input[name="foodType"]:checked')?.value;
    const quantity = document.getElementById("quantity").value.trim();
    const prepTime = document.getElementById("prepTime").value;
    const expiryTime = document.getElementById("expiryTime").value;
    const imageFile = document.getElementById("foodImage").files[0];
    const boxId = document.getElementById("boxLocation").value;
    const disclaimerAccepted = document.getElementById("disclaimer").checked;

    if (!foodName || !foodCategory || !foodType || !quantity || !prepTime || !expiryTime) {
      return showError("formError", "Please fill in all required fields.");
    }
    if (!imageFile) {
      return showError("formError", "Please upload a food image.");
    }
    if (!boxId) {
      return showError("formError", "Please select a box location.");
    }
    if (!disclaimerAccepted) {
      return showError("formError", "You must accept the food safety disclaimer.");
    }
    if (new Date(expiryTime) <= new Date(prepTime)) {
      return showError("formError", "Expiry time must be after preparation time.");
    }

    const submitBtn = donateForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const donationRef = doc(collection(db, "donations"));
      const donationId = donationRef.id;

      // Upload image to Storage first.
      const imageRef = ref(storage, `donations/${donationId}/${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const imageUrl = await getDownloadURL(imageRef);

      await setDoc(donationRef, {
        donationId,
        userId: currentUser.uid,
        foodName,
        foodType,
        category: foodCategory,
        quantity,
        imageUrl,
        boxId,
        prepTime,
        expiryTime,
        status: "AVAILABLE_FOR_HUMANS",
        createdAt: serverTimestamp()
      });

      // Log first entry in foodHistory.
      await setDoc(doc(collection(db, "foodHistory")), {
        donationId,
        status: "AVAILABLE_FOR_HUMANS",
        updatedAt: serverTimestamp()
      });

      window.location.href = `tracking.html?id=${donationId}`;

    } catch (err) {
      console.error(err);
      showError("formError", "Something went wrong while submitting. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Donation";
    }
  });
}

async function loadBoxes() {
  const select = document.getElementById("boxLocation");
  if (!select) return;

  try {
    const snap = await getDocs(query(collection(db, "boxes"), orderBy("name")));
    snap.forEach(docSnap => {
      const box = docSnap.data();
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = `${box.name} — ${box.availableSlots} slots available`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load boxes:", err);
  }
}