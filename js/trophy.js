// Procedural 3D trophy: stacked rings of flat CSS faces arranged around a
// vertical axis (real rotateY/translateZ geometry, not a flat image faking
// rotation). See cup.css classes .cup-trophy-* for the accompanying styles.
const SEGMENTS = 14;
const RINGS = [
  { y: 96, r: 38, h: 14 }, // foot
  { y: 80, r: 25, h: 10 }, // foot taper
  { y: 46, r: 7, h: 30 }, // stem lower
  { y: 20, r: 15, h: 16 }, // knop
  { y: 2, r: 7, h: 12 }, // stem upper
  { y: -18, r: 18, h: 20 }, // bowl base
  { y: -42, r: 29, h: 22 }, // bowl mid
  { y: -60, r: 35, h: 12 }, // bowl rim
];
const LIGHT_ANGLE = 0.4; // radians, where the baked highlight band sits

export function buildTrophy(sceneEl) {
  sceneEl.innerHTML = '<div class="cup-trophy-rig"></div>';
  const rig = sceneEl.querySelector(".cup-trophy-rig");

  RINGS.forEach((ring) => {
    const ringEl = document.createElement("div");
    ringEl.className = "cup-trophy-ring";
    ringEl.style.transform = `translateY(${ring.y}px)`;

    const faceWidth = 2 * ring.r * Math.tan(Math.PI / SEGMENTS) + 1;
    for (let i = 0; i < SEGMENTS; i++) {
      const angleDeg = (360 / SEGMENTS) * i;
      const angleRad = angleDeg * (Math.PI / 180);
      const brightness = 0.55 + 0.55 * Math.max(0, Math.cos(angleRad - LIGHT_ANGLE));

      const face = document.createElement("div");
      face.className = "cup-trophy-face";
      face.style.width = `${faceWidth}px`;
      face.style.height = `${ring.h}px`;
      face.style.marginLeft = `${-faceWidth / 2}px`;
      face.style.marginTop = `${-ring.h / 2}px`;
      face.style.filter = `brightness(${brightness.toFixed(2)})`;
      face.style.transform = `rotateY(${angleDeg}deg) translateZ(${ring.r}px)`;
      ringEl.appendChild(face);
    }
    rig.appendChild(ringEl);
  });

  const topRing = RINGS[RINGS.length - 1];
  const cap = document.createElement("div");
  cap.className = "cup-trophy-cap";
  cap.style.width = cap.style.height = `${topRing.r * 2}px`;
  cap.style.marginLeft = `${-topRing.r}px`;
  cap.style.marginTop = `${-topRing.r}px`;
  cap.style.transform = `translateY(${topRing.y - topRing.h / 2}px) rotateX(90deg)`;
  rig.appendChild(cap);

  const shine = document.createElement("div");
  shine.className = "cup-shine-sweep";
  sceneEl.appendChild(shine);
}
