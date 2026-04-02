// Dice Renderer — Three.js 3D dice with physics-like animation
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 10.1

import * as THREE from 'three';

/**
 * Rotation targets to show each die value (1–6) facing UP toward the camera.
 * Face layout: 1=+Z, 2=+Y, 3=-X, 4=+X, 5=-Y, 6=-Z
 * Camera looks from above-front, so the top face (+Y) is most visible.
 * We rotate so the desired value faces +Y (up).
 */
const VALUE_ROTATIONS = {
  1: { x: -Math.PI / 2, y: 0, z: 0 },   // rotate 1 (front +Z) up to +Y
  2: { x: 0, y: 0, z: 0 },               // 2 is already on +Y (top)
  3: { x: 0, y: 0, z: -Math.PI / 2 },    // rotate 3 (-X) up to +Y
  4: { x: 0, y: 0, z: Math.PI / 2 },     // rotate 4 (+X) up to +Y
  5: { x: Math.PI, y: 0, z: 0 },          // rotate 5 (-Y) up to +Y (flip)
  6: { x: Math.PI / 2, y: 0, z: 0 },     // rotate 6 (-Z) up to +Y
};

const DIE_SIZE = 1;
const DIE_RADIUS = 0.12;
const PIP_RADIUS = 0.065;
const PIP_DEPTH = 0.01;
const PIP_SEGMENTS = 16;

/**
 * Creates a rounded box geometry (beveled cube).
 */
function createRoundedBoxGeometry(width, height, depth, radius, segments) {
  // Use a simple box and rely on material for soft look
  // For true rounded edges we'd need a custom geometry, but smooth shading + bloom gives a premium feel
  const geo = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  return geo;
}

/**
 * Pip positions for each face value (in local face coordinates, centered at 0,0).
 * Coordinates are fractions of the face size.
 */
const PIP_LAYOUTS = {
  1: [[0, 0]],
  2: [[-0.25, 0.25], [0.25, -0.25]],
  3: [[-0.25, 0.25], [0, 0], [0.25, -0.25]],
  4: [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]],
  5: [[-0.25, 0.25], [0.25, 0.25], [0, 0], [-0.25, -0.25], [0.25, -0.25]],
  6: [[-0.25, 0.25], [0.25, 0.25], [-0.25, 0], [0.25, 0], [-0.25, -0.25], [0.25, -0.25]],
};

/**
 * Creates pip (dot) meshes for a die face.
 * @param {number} value - Face value 1-6
 * @param {THREE.Vector3} normal - Face normal direction
 * @param {THREE.Vector3} up - Up direction on the face
 * @param {THREE.Material} material - Pip material
 * @returns {THREE.Mesh[]}
 */
function createPips(value, normal, up, material) {
  const pips = [];
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const positions = PIP_LAYOUTS[value];
  const offset = DIE_SIZE / 2 + PIP_DEPTH * 0.5;

  for (const [px, py] of positions) {
    const geo = new THREE.CylinderGeometry(PIP_RADIUS, PIP_RADIUS, PIP_DEPTH, PIP_SEGMENTS);
    // Rotate cylinder to face outward along normal
    geo.rotateX(Math.PI / 2);

    const pip = new THREE.Mesh(geo, material);
    pip.position.copy(normal.clone().multiplyScalar(offset));
    pip.position.add(right.clone().multiplyScalar(px * DIE_SIZE));
    pip.position.add(up.clone().multiplyScalar(py * DIE_SIZE));
    pip.lookAt(pip.position.clone().add(normal));
    pips.push(pip);
  }
  return pips;
}

/**
 * Creates a single 3D die mesh group.
 * @param {boolean} isDark - Dark mode
 * @returns {THREE.Group}
 */
function createDieMesh(isDark) {
  const group = new THREE.Group();

  // Die body
  const bodyGeo = createRoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, DIE_RADIUS, 2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x3a3a3c : 0xf5f5f7,
    roughness: 0.35,
    metalness: 0.05,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Pip material
  const pipMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xf5f5f7 : 0x1d1d1f,
    roughness: 0.6,
    metalness: 0.0,
  });

  // Face definitions: value, normal, up
  const faces = [
    { value: 1, normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
    { value: 6, normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
    { value: 2, normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
    { value: 5, normal: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
    { value: 3, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { value: 4, normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  ];

  for (const face of faces) {
    const pips = createPips(face.value, face.normal, face.up, pipMat);
    pips.forEach((p) => group.add(p));
  }

  // Store materials for held state
  group.userData.bodyMat = bodyMat;
  group.userData.originalColor = bodyMat.color.getHex();

  return group;
}

/**
 * Easing function for smooth animation.
 */
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * DiceRenderer — Three.js 3D dice rendering with physics-like roll animation.
 */
export function createDiceRenderer() {
  let scene = null;
  let camera = null;
  let renderer = null;
  let containerEl = null;
  let dieMeshes = [];
  let currentValues = [];
  let animationId = null;
  let animations = [];
  let resizeObserver = null;

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function setupScene(container, count) {
    containerEl = container;

    // Scene
    scene = new THREE.Scene();
    scene.background = null; // transparent

    // Camera
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    camera.position.set(0, 4, 6);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.radius = 4;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-2, 3, -3);
    scene.add(fill);

    // Ground plane for shadows
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.55;
    ground.receiveShadow = true;
    scene.add(ground);

    // Responsive
    resizeObserver = new ResizeObserver(() => {
      if (!containerEl || !renderer || !camera) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);
  }

  function layoutDice(count) {
    // Arrange dice in a nice pattern
    const spacing = 1.4;
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / cols);
    const offsetX = ((cols - 1) * spacing) / 2;
    const offsetZ = ((rows - 1) * spacing) / 2;

    for (let i = 0; i < dieMeshes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      dieMeshes[i].position.set(
        col * spacing - offsetX,
        0,
        row * spacing - offsetZ
      );
    }
  }

  function renderLoop() {
    if (!renderer || !scene || !camera) return;

    // Process animations
    const now = performance.now();
    animations = animations.filter((anim) => {
      const elapsed = now - anim.startTime;
      const t = Math.min(elapsed / anim.duration, 1);

      if (anim.type === 'roll') {
        const eased = easeOutBack(t);
        const spinEased = easeOutQuart(t);

        // Spin: multiple rotations that ease into final position
        const die = anim.mesh;
        const target = anim.targetRotation;
        const spin = anim.spinRotation;

        die.rotation.x = spin.x * (1 - spinEased) + target.x * eased;
        die.rotation.y = spin.y * (1 - spinEased) + target.y * eased;
        die.rotation.z = spin.z * (1 - spinEased) + target.z * eased;

        // Bounce: die lifts up and comes back down
        const bounceT = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
        die.position.y = anim.baseY + Math.sin(bounceT * Math.PI) * 1.5 * (1 - t * 0.5);
      }

      return t < 1;
    });

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(renderLoop);
  }

  return {
    create(container, count) {
      this.destroy();
      setupScene(container, count);

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

      // Set initial rotations
      for (let i = 0; i < count; i++) {
        const rot = VALUE_ROTATIONS[1];
        dieMeshes[i].rotation.set(rot.x, rot.y, rot.z);
      }

      // Start render loop
      renderLoop();

      // Click handling for hold/release
      renderer.domElement.addEventListener('click', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(
          dieMeshes.flatMap((g) => g.children),
          false
        );
        if (intersects.length > 0) {
          const dieGroup = intersects[0].object.parent;
          if (dieGroup && dieGroup.userData.index !== undefined) {
            // Dispatch custom event for hold toggle
            const event = new CustomEvent('die-click', {
              detail: { index: dieGroup.userData.index },
              bubbles: true,
            });
            containerEl.dispatchEvent(event);
          }
        }
      });

      // ARIA: add role and labels to canvas
      renderer.domElement.setAttribute('role', 'group');
      renderer.domElement.setAttribute('aria-label', 'Würfelbereich');
      renderer.domElement.setAttribute('tabindex', '0');
    },

    async update(result, animateRoll) {
      const { values, rolledIndices } = result;
      const rolledSet = new Set(rolledIndices);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const duration = (reducedMotion || !animateRoll) ? 0 : 1200;

      for (let i = 0; i < dieMeshes.length; i++) {
        if (i >= values.length) break;
        const value = values[i];
        currentValues[i] = value;
        const target = VALUE_ROTATIONS[value];

        if (rolledSet.has(i) && duration > 0) {
          // Animated roll with random extra spins
          const extraSpinsX = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * Math.PI * 2;
          const extraSpinsY = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2)) * Math.PI * 2;

          animations.push({
            type: 'roll',
            mesh: dieMeshes[i],
            startTime: performance.now() + i * 80, // stagger
            duration: duration + Math.random() * 300,
            targetRotation: { x: target.x, y: target.y, z: target.z },
            spinRotation: {
              x: target.x + extraSpinsX,
              y: target.y + extraSpinsY,
              z: (Math.random() - 0.5) * Math.PI * 2,
            },
            baseY: dieMeshes[i].position.y,
          });
        } else {
          // Instant
          dieMeshes[i].rotation.set(target.x, target.y, target.z);
        }
      }

      // Wait for animations to finish
      if (duration > 0) {
        await new Promise((resolve) => setTimeout(resolve, duration + 400));
      }
    },

    setHeld(index, held) {
      const die = dieMeshes[index];
      if (!die) return;
      die.userData.held = held;

      const bodyMat = die.userData.bodyMat;
      if (held) {
        bodyMat.emissive.setHex(isDark ? 0x1a3a6a : 0x1558c6);
        bodyMat.emissiveIntensity = 0.3;
        die.scale.set(0.92, 0.92, 0.92);
      } else {
        bodyMat.emissive.setHex(0x000000);
        bodyMat.emissiveIntensity = 0;
        die.scale.set(1, 1, 1);
      }
    },

    destroy() {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (renderer && containerEl) {
        containerEl.removeChild(renderer.domElement);
        renderer.dispose();
      }
      if (scene) {
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
      scene = null;
      camera = null;
      renderer = null;
      containerEl = null;
      dieMeshes = [];
      currentValues = [];
      animations = [];
    },
  };
}
