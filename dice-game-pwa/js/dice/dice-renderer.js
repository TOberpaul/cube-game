// Dice Renderer — Three.js 3D dice with soft rounded edges and indented pips
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 10.1

import * as THREE from 'three';

// --- Rotation targets: desired value faces +Y (up toward camera) ---
// Face layout: 1=+Z, 6=-Z, 2=+Y, 5=-Y, 3=-X, 4=+X
const VALUE_ROTATIONS = {
  1: { x: -Math.PI / 2, y: 0, z: 0 },
  2: { x: 0, y: 0, z: 0 },
  3: { x: 0, y: 0, z: -Math.PI / 2 },
  4: { x: 0, y: 0, z: Math.PI / 2 },
  5: { x: Math.PI, y: 0, z: 0 },
  6: { x: Math.PI / 2, y: 0, z: 0 },
};

const SIZE = 1;
const RADIUS = 0.22; // large radius for very rounded edges (like the reference image)
const SEGMENTS = 5;
const PIP_RADIUS = 0.075;
const PIP_DEPTH = 0.06; // deeper indentation
const PIP_SEGMENTS = 20;

// --- Rounded Box Geometry (SDF-style vertex displacement) ---
function createRoundedBoxGeometry(w, h, d, r, seg) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const hw = w / 2, hh = h / 2, hd = d / 2;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Clamp to inner box, then push outward
    const ix = Math.max(-hw + r, Math.min(hw - r, v.x));
    const iy = Math.max(-hh + r, Math.min(hh - r, v.y));
    const iz = Math.max(-hd + r, Math.min(hd - r, v.z));
    const dx = v.x - ix, dy = v.y - iy, dz = v.z - iz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0.0001) {
      v.x = ix + (dx / len) * r;
      v.y = iy + (dy / len) * r;
      v.z = iz + (dz / len) * r;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- Pip layouts (face-local coordinates, fraction of SIZE) ---
const PIP_LAYOUTS = {
  1: [[0, 0]],
  2: [[-0.24, 0.24], [0.24, -0.24]],
  3: [[-0.24, 0.24], [0, 0], [0.24, -0.24]],
  4: [[-0.24, 0.24], [0.24, 0.24], [-0.24, -0.24], [0.24, -0.24]],
  5: [[-0.24, 0.24], [0.24, 0.24], [0, 0], [-0.24, -0.24], [0.24, -0.24]],
  6: [[-0.24, 0.24], [0.24, 0.24], [-0.24, 0], [0.24, 0], [-0.24, -0.24], [0.24, -0.24]],
};

// --- Create a single pip as a cylinder disc embedded in the face ---
function createPipMesh(pipMat) {
  // Thin cylinder oriented along +Y by default
  const geo = new THREE.CylinderGeometry(PIP_RADIUS, PIP_RADIUS, PIP_DEPTH, PIP_SEGMENTS);
  const mesh = new THREE.Mesh(geo, pipMat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

// --- Position and orient a pip on a face ---
function placePip(pip, normal, right, up, px, py) {
  // Place the pip so it's half-embedded in the face surface
  // The cylinder's axis is along local Y, we need to rotate it to align with the face normal
  const halfSurface = SIZE / 2;
  // Position: on the face surface, sunk in by half the pip depth
  const offset = halfSurface - PIP_DEPTH * 0.4;

  pip.position.set(0, 0, 0);
  pip.position.addScaledVector(normal, offset);
  pip.position.addScaledVector(right, px * SIZE);
  pip.position.addScaledVector(up, py * SIZE);

  // Orient: cylinder Y-axis should align with face normal
  // Default cylinder axis is Y, so we need to rotate from Y to the face normal
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, normal);
  pip.quaternion.copy(quat);
}

// --- Create all pips for one face ---
function createFacePips(value, normal, up, pipMat) {
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const positions = PIP_LAYOUTS[value];
  return positions.map(([px, py]) => {
    const pip = createPipMesh(pipMat);
    placePip(pip, normal, right, up, px, py);
    return pip;
  });
}

// --- Create a single die mesh group ---
function createDieMesh(isDark) {
  const group = new THREE.Group();

  // Body: rounded box with soft material
  const bodyGeo = createRoundedBoxGeometry(SIZE, SIZE, SIZE, RADIUS, SEGMENTS);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: isDark ? 0x4a4a4e : 0xf0ece8,
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    sheen: 0.15,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(isDark ? 0x666670 : 0xfff5ee),
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Pip material: dark circles sunk into the surface
  const pipMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xc0c0c4 : 0x1a1a1e,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Face definitions: value → normal, up
  const faces = [
    { value: 1, normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
    { value: 6, normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
    { value: 2, normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
    { value: 5, normal: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
    { value: 3, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { value: 4, normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  ];

  for (const face of faces) {
    const pips = createFacePips(face.value, face.normal, face.up, pipMat);
    pips.forEach((p) => group.add(p));
  }

  group.userData.bodyMat = bodyMat;
  group.userData.originalColor = bodyMat.color.getHex();
  return group;
}

// --- Easing ---
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// --- Main renderer factory ---
export function createDiceRenderer() {
  let scene = null, camera = null, renderer = null, containerEl = null;
  let dieMeshes = [], currentValues = [], animationId = null, animations = [];
  let resizeObserver = null;
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function setupScene(container) {
    containerEl = container;
    scene = new THREE.Scene();
    scene.background = null;

    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
    camera.position.set(0, 5.5, 5.5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // Soft ambient
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Key light — warm, soft
    const key = new THREE.DirectionalLight(0xfff5ee, 1.4);
    key.position.set(4, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Fill light — cool
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.4);
    fill.position.set(-3, 4, -4);
    scene.add(fill);

    // Rim light from behind
    const rim = new THREE.DirectionalLight(0xffffff, 0.2);
    rim.position.set(0, 2, -6);
    scene.add(rim);

    // Ground for shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.55;
    ground.receiveShadow = true;
    scene.add(ground);

    resizeObserver = new ResizeObserver(() => {
      if (!containerEl || !renderer || !camera) return;
      const w = containerEl.clientWidth, h = containerEl.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);
  }

  function layoutDice(count) {
    const spacing = 1.5;
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / cols);
    const ox = ((cols - 1) * spacing) / 2;
    const oz = ((rows - 1) * spacing) / 2;
    for (let i = 0; i < dieMeshes.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      dieMeshes[i].position.set(col * spacing - ox, 0, row * spacing - oz);
    }
  }

  function renderLoop() {
    if (!renderer || !scene || !camera) return;
    const now = performance.now();
    animations = animations.filter((a) => {
      const t = Math.min((now - a.startTime) / a.duration, 1);
      if (a.type === 'roll') {
        const eased = easeOutBack(t);
        const spinE = easeOutQuart(t);
        const d = a.mesh;
        d.rotation.x = a.spin.x * (1 - spinE) + a.target.x * eased;
        d.rotation.y = a.spin.y * (1 - spinE) + a.target.y * eased;
        d.rotation.z = a.spin.z * (1 - spinE) + a.target.z * eased;
        // Bounce arc
        const bt = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        d.position.y = a.baseY + Math.sin(bt * Math.PI) * 1.8 * (1 - t * 0.4);
      }
      return t < 1;
    });
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(renderLoop);
  }

  return {
    create(container, count) {
      this.destroy();
      setupScene(container);
      dieMeshes = [];
      currentValues = new Array(count).fill(1);
      for (let i = 0; i < count; i++) {
        const die = createDieMesh(isDark);
        die.userData.index = i;
        die.userData.held = false;
        dieMeshes.push(die);
        scene.add(die);
      }
      layoutDice(count);
      for (const d of dieMeshes) {
        const r = VALUE_ROTATIONS[1];
        d.rotation.set(r.x, r.y, r.z);
      }
      renderLoop();

      // Click → raycasting
      renderer.domElement.addEventListener('click', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const rc = new THREE.Raycaster();
        rc.setFromCamera(mouse, camera);
        const hits = rc.intersectObjects(dieMeshes.flatMap(g => g.children), false);
        if (hits.length > 0) {
          const g = hits[0].object.parent;
          if (g?.userData.index !== undefined) {
            containerEl.dispatchEvent(new CustomEvent('die-click', { detail: { index: g.userData.index }, bubbles: true }));
          }
        }
      });

      renderer.domElement.setAttribute('role', 'group');
      renderer.domElement.setAttribute('aria-label', 'Würfelbereich');
      renderer.domElement.setAttribute('tabindex', '0');
    },

    async update(result, animateRoll) {
      const { values, rolledIndices } = result;
      const rolled = new Set(rolledIndices);
      const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dur = (noMotion || !animateRoll) ? 0 : 1200;

      for (let i = 0; i < dieMeshes.length && i < values.length; i++) {
        currentValues[i] = values[i];
        const t = VALUE_ROTATIONS[values[i]];
        if (rolled.has(i) && dur > 0) {
          const sx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * Math.PI * 2;
          const sy = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2)) * Math.PI * 2;
          animations.push({
            type: 'roll', mesh: dieMeshes[i],
            startTime: performance.now() + i * 100,
            duration: dur + Math.random() * 400,
            target: { x: t.x, y: t.y, z: t.z },
            spin: { x: t.x + sx, y: t.y + sy, z: (Math.random() - 0.5) * Math.PI * 2 },
            baseY: 0,
          });
        } else {
          dieMeshes[i].rotation.set(t.x, t.y, t.z);
          dieMeshes[i].position.y = 0;
        }
      }
      if (dur > 0) await new Promise(r => setTimeout(r, dur + 500));
    },

    setHeld(index, held) {
      const die = dieMeshes[index];
      if (!die) return;
      die.userData.held = held;
      const mat = die.userData.bodyMat;
      if (held) {
        mat.emissive.setHex(isDark ? 0x1a3a6a : 0x1558c6);
        mat.emissiveIntensity = 0.25;
        die.scale.set(0.9, 0.9, 0.9);
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        die.scale.set(1, 1, 1);
      }
    },

    destroy() {
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      if (renderer && containerEl) { containerEl.removeChild(renderer.domElement); renderer.dispose(); }
      if (scene) {
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        });
      }
      scene = camera = renderer = containerEl = null;
      dieMeshes = []; currentValues = []; animations = [];
    },
  };
}
