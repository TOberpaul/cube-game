// Dice Renderer — Three.js with GLB model
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 10.1

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Rotation targets: desired value faces +Y (up toward camera)
// Must match the face layout of the GLB model.
// Standard die: 1 opposite 6, 2 opposite 5, 3 opposite 4
// We need to figure out which face points where in the model.
// Default assumption: model has 1 on +Z, 2 on +Y, 3 on -X, 4 on +X, 5 on -Y, 6 on -Z
// These rotations bring the desired value to face +Y (top).
const VALUE_ROTATIONS = {
  1: { x: -Math.PI / 2, y: 0, z: 0 },
  2: { x: 0, y: 0, z: 0 },
  3: { x: 0, y: 0, z: -Math.PI / 2 },
  4: { x: 0, y: 0, z: Math.PI / 2 },
  5: { x: Math.PI, y: 0, z: 0 },
  6: { x: Math.PI / 2, y: 0, z: 0 },
};

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

let cachedGLTF = null;

async function loadDieModel() {
  if (cachedGLTF) return cachedGLTF.scene.clone(true);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      'assets/dice.glb',
      (gltf) => {
        cachedGLTF = gltf;
        // Normalize the model size
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1 / maxDim; // normalize to unit size
        gltf.scene.scale.setScalar(scale);
        // Center it
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center.multiplyScalar(scale));
        resolve(gltf.scene.clone(true));
      },
      undefined,
      reject
    );
  });
}

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
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // Soft ambient
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // Key light — warm, soft
    const key = new THREE.DirectionalLight(0xfff8f0, 1.5);
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

    // Fill light
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.5);
    fill.position.set(-3, 4, -4);
    scene.add(fill);

    // Rim light
    const rim = new THREE.DirectionalLight(0xffffff, 0.25);
    rim.position.set(0, 2, -6);
    scene.add(rim);

    // Ground for shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
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
    const ox = ((cols - 1) * spacing) / 2;
    const oz = ((Math.ceil(count / cols) - 1) * spacing) / 2;
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
        const bt = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        d.position.y = a.baseY + Math.sin(bt * Math.PI) * 1.8 * (1 - t * 0.4);
      }
      return t < 1;
    });
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(renderLoop);
  }

  return {
    async create(container, count) {
      this.destroy();
      setupScene(container);
      dieMeshes = [];
      currentValues = new Array(count).fill(1);

      // Load GLB model for each die
      for (let i = 0; i < count; i++) {
        const model = await loadDieModel();
        // Enable shadows on all meshes in the model
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        model.userData.index = i;
        model.userData.held = false;
        dieMeshes.push(model);
        scene.add(model);
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
        const allMeshes = [];
        dieMeshes.forEach(g => g.traverse(c => { if (c.isMesh) allMeshes.push(c); }));
        const hits = rc.intersectObjects(allMeshes, false);
        if (hits.length > 0) {
          // Walk up to find the die group
          let obj = hits[0].object;
          while (obj && obj.userData.index === undefined) obj = obj.parent;
          if (obj?.userData.index !== undefined) {
            containerEl.dispatchEvent(new CustomEvent('die-click', {
              detail: { index: obj.userData.index }, bubbles: true
            }));
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
      // Visual feedback: scale down and add emissive glow
      if (held) {
        die.scale.setScalar(0.9 / (cachedGLTF ? 1 : 1));
        die.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.emissive = new THREE.Color(isDark ? 0x1a3a6a : 0x1558c6);
            child.material.emissiveIntensity = 0.25;
          }
        });
      } else {
        die.scale.setScalar(1);
        die.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        });
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
