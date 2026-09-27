// js/maps.js
// Handles map display for donate.html and tracking.html:
// nearby boxes, live capacity, user location, route to selected box.
// Uses Google Maps JavaScript API (loaded via <script> with your API key).

import { db, collection, onSnapshot } from "../firebase/firebase-config.js";

let map = null;
let userMarker = null;
let boxMarkers = {};
let directionsService = null;
let directionsRenderer = null;

// Call this from a page once the Google Maps script has loaded
// (e.g. via the API's callback=initHungerHubMap param).
window.initHungerHubMap = function () {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    center: { lat: 12.9716, lng: 77.5946 }, // default: Bengaluru
    zoom: 13,
    disableDefaultUI: false
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map });

  locateUser();
  listenToBoxes();
};

/* ---------------- User location ---------------- */
function locateUser() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const userLoc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      map.setCenter(userLoc);

      if (userMarker) userMarker.setMap(null);
      userMarker = new google.maps.Marker({
        position: userLoc,
        map,
        title: "Your location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#2E7D32",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        }
      });
    },
    err => console.warn("Location access denied:", err.message)
  );
}

/* ---------------- Live box markers ---------------- */
function listenToBoxes() {
  onSnapshot(collection(db, "boxes"), snap => {
    snap.docChanges().forEach(change => {
      const boxId = change.doc.id;
      const box = change.doc.data();

      if (change.type === "removed") {
        if (boxMarkers[boxId]) {
          boxMarkers[boxId].setMap(null);
          delete boxMarkers[boxId];
        }
        return;
      }

      const position = { lat: box.latitude, lng: box.longitude };

      if (boxMarkers[boxId]) {
        boxMarkers[boxId].setPosition(position);
        boxMarkers[boxId].infoContent = boxInfoHtml(box);
      } else {
        const marker = new google.maps.Marker({
          position,
          map,
          title: box.name,
          icon: {
            url: box.availableSlots > 0
              ? "../images/box-marker-available.png"
              : "../images/box-marker-full.png",
            scaledSize: new google.maps.Size(36, 36)
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: boxInfoHtml(box)
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
          routeToBox(position);
        });

        boxMarkers[boxId] = marker;
      }
    });
  });
}

function boxInfoHtml(box) {
  return `
    <div class="map-info">
      <strong>${box.name}</strong><br>
      ${box.location}<br>
      ${box.availableSlots} / ${box.capacity} slots available
    </div>
  `;
}

/* ---------------- Route to selected box ---------------- */
function routeToBox(destination) {
  if (!userMarker) return;

  directionsService.route(
    {
      origin: userMarker.getPosition(),
      destination,
      travelMode: google.maps.TravelMode.DRIVING
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else {
        console.warn("Directions request failed:", status);
      }
    }
  );
}