import './style.css'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// === Scene Setup ===
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 30);

// Renderer — full PBR pipeline
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Full native resolution for Retina/HiDPI
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// === HDRI Environment Map (Reflections & Lighting) ===
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load('/studio.hdr', (hdrTexture) => {
  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

  // Set as scene environment for PBR reflections (but don't set as background — keep transparent)
  scene.environment = envMap;

  hdrTexture.dispose();
  pmremGenerator.dispose();

  // Apply envMap to all crown materials after HDRI is ready
  if (crownModel) {
    applyPremiumMaterials(crownModel, envMap);
  }
});

// === Lighting (Subtle accents — HDRI handles main illumination) ===
// Keep lights minimal; the HDRI does the heavy lifting for reflections
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.4);
scene.add(ambientLight);

// Soft key light for gentle highlights
const keyLight = new THREE.DirectionalLight(0xffecd2, 2.5);
keyLight.position.set(8, 12, 8);
scene.add(keyLight);

// Cool fill light for contrast
const fillLight = new THREE.DirectionalLight(0xb0c4de, 0.6);
fillLight.position.set(-6, 2, -4);
scene.add(fillLight);

// Warm rim/back light
const rimLight = new THREE.DirectionalLight(0xffd700, 1.5);
rimLight.position.set(-2, 6, -10);
scene.add(rimLight);

// === Premium Gold Material Setup ===
function applyPremiumMaterials(model, envMap) {
  model.traverse((node) => {
    if (!node.isMesh) return;

    const oldMat = node.material;

    // Create a physically accurate gold material
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      // Base gold color
      color: new THREE.Color(0xd4a843),

      // PBR Core — metalness жестко 1.0, roughness 0.25 для блестящего, но не зеркального золота
      metalness: 1.0,
      roughness: 0.25,

      // Environment reflections
      envMap: envMap,
      envMapIntensity: 1.8,

      // Clearcoat — тонкий лаковый слой поверх золота для extra бликов
      clearcoat: 0.15,
      clearcoatRoughness: 0.1,

      // Subtle sheen for soft glow at grazing angles
      sheen: 0.3,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color(0xffecb3),

      // Preserve original textures if they exist
      map: oldMat.map || null,
      normalMap: oldMat.normalMap || null,
      roughnessMap: oldMat.roughnessMap || null,
      metalnessMap: oldMat.metalnessMap || null,
      aoMap: oldMat.aoMap || null,
    });

    // If the original had a normal map, boost its intensity
    if (goldMaterial.normalMap) {
      goldMaterial.normalScale.set(1.5, 1.5);
    }

    node.material = goldMaterial;
    node.material.needsUpdate = true;
  });
}

// === Model Loading ===
let crownModel;
const loader = new GLTFLoader();

loader.load(
  '/crown.glb',
  function (gltf) {
    crownModel = gltf.scene;

    // Auto center and scale the model
    const box = new THREE.Box3().setFromObject(crownModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 12;
    const scale = targetSize / maxDim;

    crownModel.scale.setScalar(scale);

    // Position exactly in the center
    crownModel.position.x = -center.x * scale;
    crownModel.position.y = -center.y * scale;
    crownModel.position.z = -center.z * scale;

    // Desktop: crown on the right, Mobile: centered
    const isMobile = window.innerWidth <= 768;
    const xOffset = isMobile ? 0 : -5;
    const yOffset = isMobile ? -3 : 0;

    camera.position.x = xOffset;
    camera.position.y = yOffset;
    camera.lookAt(xOffset, yOffset, 0);

    // Tilt and turn
    crownModel.rotation.x = 0.25;
    crownModel.rotation.y = -0.8;
    crownModel.rotation.z = 0.15;

    scene.add(crownModel);

    // Apply premium PBR materials (if HDRI already loaded, apply immediately)
    if (scene.environment) {
      applyPremiumMaterials(crownModel, scene.environment);
    }
  },
  undefined,
  function (error) {
    console.error('Error loading crown model:', error);
  }
);

// === Mouse Parallax ===
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
  mouseX = (event.clientX - windowHalfX);
  mouseY = (event.clientY - windowHalfY);
});

// === Responsiveness ===
window.addEventListener('resize', () => {
  if (!container) return;
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  if (crownModel) {
    const isMobile = window.innerWidth <= 768;
    const xOffset = isMobile ? 0 : -5;
    const yOffset = isMobile ? -3 : 0;
    camera.position.x = xOffset;
    camera.position.y = yOffset;
    camera.lookAt(xOffset, yOffset, 0);
  }
}, false);

// === Animation Loop ===
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  if (crownModel) {
    // Subtle floating
    crownModel.position.y = Math.sin(time * 1.5) * 0.2;

    // Smooth mouse parallax
    targetX = mouseX * 0.0003;
    targetY = mouseY * 0.0003;

    // Smoothly interpolate rotation to target
    crownModel.rotation.y += 0.05 * ((-0.8 + targetX) - crownModel.rotation.y);
    crownModel.rotation.x += 0.05 * ((0.25 + targetY) - crownModel.rotation.x);
  }

  renderer.render(scene, camera);
}

animate();

// === Video Hover Logic ===
document.querySelectorAll('.case-card').forEach(card => {
  const video = card.querySelector('video');
  if (video) {
    card.addEventListener('mouseenter', () => video.pause());
    card.addEventListener('mouseleave', () => video.play());
  }
});
