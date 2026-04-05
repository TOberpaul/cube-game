// Dice Renderer — Three.js with GLB model
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 10.1

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Rotation targets: desired value faces +Y (up toward camera)
// Calibrated against the actual GLB model face layout.
const VALUE_ROTATIONS = {
  1: { x: 0, y: 0, z: Math.PI / 2 },          // swapped with 5
  2: { x: -Math.PI / 2, y: 0, z: 0 },         // correct
  3: { x: 0, y: 0, z: 0 },                    // correct
  4: { x: Math.PI, y: 0, z: 0 },              // correct
  5: { x: Math.PI / 2, y: 0, z: 0 },          // swapped with 1
  6: { x: 0, y: 0, z: -Math.PI / 2 },         // correct
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
  if (cachedGLTF) return cachedGLTF.clone(true);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      'assets/dice.glb',
      (gltf) => {
        const model = gltf.scene;

        // Normalize size to unit cube
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.4 / maxDim;
        model.scale.setScalar(scale);

        // Center it
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(center);

        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        cachedGLTF = model;
        resolve(model.clone(true));
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

  function setupScene(container) {
    containerEl = container;
    scene = new THREE.Scene();
    scene.background = null;

    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    // Closer camera, slight angle — like looking at dice on a table
    camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
    camera.position.set(0, 25, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);

    // Soft ambient — neutral white
    scene.add(new THREE.AmbientLight(0xffffff, 2.0));

    // Key light — neutral white, high up for soft shadows
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(2, 12, 3);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 50;
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    key.shadow.radius = 20;
    key.shadow.blurSamples = 25;
    key.shadow.bias = -0.0002;
    scene.add(key);

    // Fill light — cool, from left-back, softer
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-4, 5, -2);
    scene.add(fill);

    // Rim/back light — subtle highlight on edges
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 2, -5);
    scene.add(rim);

    // Ground plane for ultra-soft contact shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
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
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);
  }

  function layoutDice(count) {
    // Circular layout — radius scales with die count so they never overlap
    const radius = count <= 1 ? 0 : count <= 2 ? 1.8 : 0.75 + count * 0.3;
    for (let i = 0; i < dieMeshes.length; i++) {
      if (count === 1) {
        dieMeshes[i].position.set(0, 0, 0);
      } else {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        dieMeshes[i].position.set(x, 0, z);
      }
      dieMeshes[i].userData.baseYRotation = (Math.random() - 0.5) * 0.3;
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
      currentValues = Array.from({ length: count }, (_, i) => (i % 6) + 1);

      // Load GLB model for each die
      for (let i = 0; i < count; i++) {
        const model = await loadDieModel();
        // Clone materials so each die has independent opacity/color
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = child.material.clone();
          }
        });
        model.userData.index = i;
        model.userData.held = false;
        dieMeshes.push(model);
        scene.add(model);
      }

      layoutDice(count);
      for (let i = 0; i < dieMeshes.length; i++) {
        const r = VALUE_ROTATIONS[currentValues[i]];
        const yJitter = dieMeshes[i].userData.baseYRotation || 0;
        dieMeshes[i].rotation.set(r.x, r.y + yJitter, r.z);
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
        const yJitter = dieMeshes[i].userData.baseYRotation || 0;
        if (rolled.has(i) && dur > 0) {
          const sx = 3 * Math.PI * 2;
          const sy = 2 * Math.PI * 2;
          animations.push({
            type: 'roll', mesh: dieMeshes[i],
            startTime: performance.now(),
            duration: dur,
            target: { x: t.x, y: t.y + yJitter, z: t.z },
            spin: { x: t.x + sx, y: t.y + yJitter + sy, z: 0 },
            baseY: 0,
          });
        } else {
          dieMeshes[i].rotation.set(t.x, t.y + yJitter, t.z);
          dieMeshes[i].position.y = 0;
        }
      }
      if (dur > 0) await new Promise(r => setTimeout(r, dur + 500));
    },

    setHeld(index, held) {
      const die = dieMeshes[index];
      if (!die) return;
      die.userData.held = held;
      die.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = held ? 0.35 : 1.0;
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0;
        }
      });
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
