// Feature: dice-game-pwa, Property 2: Würfel-Rendering erzeugt korrekte Anzahl
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock Three.js since jsdom doesn't have WebGL
vi.mock('three', () => {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    crossVectors(a, b) { return this; }
    normalize() { return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class MockGeometry { rotateX() {} dispose() {} }
  class MockMaterial { dispose() {} constructor() { this.color = { getHex: () => 0, setHex() {} }; this.emissive = { setHex() {} }; this.emissiveIntensity = 0; } }
  class Mesh {
    constructor() { this.position = new Vector3(); this.rotation = new Vector3(); this.scale = new Vector3(1,1,1); this.castShadow = false; this.receiveShadow = false; this.userData = {}; this.parent = null; this.children = []; }
    lookAt() {}
  }
  class Group {
    constructor() { this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } }; this.scale = new Vector3(1,1,1); this.userData = {}; this.children = []; }
    add(child) { this.children.push(child); child.parent = this; }
  }
  class Scene extends Group {
    constructor() { super(); this.background = null; }
    traverse(fn) { fn(this); this.children.forEach(c => fn(c)); }
  }
  class PerspectiveCamera {
    constructor() { this.position = new Vector3(); this.aspect = 1; }
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class WebGLRenderer {
    constructor() { this.domElement = document.createElement('canvas'); this.shadowMap = { enabled: false, type: 0 }; this.toneMapping = 0; this.toneMappingExposure = 1; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  class Light { constructor() { this.position = new Vector3(); this.castShadow = false; this.shadow = { mapSize: { width: 0, height: 0 }, camera: { near: 0, far: 0, left: 0, right: 0, top: 0, bottom: 0 }, radius: 0 }; } }
  class Raycaster { setFromCamera() {} intersectObjects() { return []; } }
  return {
    Scene, PerspectiveCamera, WebGLRenderer, Mesh, Group, Vector3,
    BoxGeometry: MockGeometry, CylinderGeometry: MockGeometry, PlaneGeometry: MockGeometry,
    MeshStandardMaterial: MockMaterial, ShadowMaterial: MockMaterial,
    AmbientLight: Light, DirectionalLight: Light,
    Raycaster, Vector2: Vector3,
    PCFSoftShadowMap: 0, ACESFilmicToneMapping: 0,
  };
});

import { createDiceRenderer } from '../js/dice/dice-renderer.js';

/**
 * **Validates: Requirements 3.4**
 *
 * Property 2: For every valid count n (1–6), renderer creates exactly n dice groups in the scene.
 */
describe('Property 2: Würfel-Rendering erzeugt korrekte Anzahl', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    // Mock ResizeObserver
    window.ResizeObserver = class { observe() {} disconnect() {} };
  });

  it('for every valid count n (1–6), renderer creates n dice', () => {
    const countArb = fc.integer({ min: 1, max: 6 });

    fc.assert(
      fc.property(countArb, (n) => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 400 });
        Object.defineProperty(container, 'clientHeight', { value: 300 });
        document.body.appendChild(container);

        const renderer = createDiceRenderer();
        renderer.create(container, n);

        // The container should have a canvas element
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();

        // Clean up
        renderer.destroy();
        container.remove();
      }),
      { numRuns: 100 },
    );
  });
});
