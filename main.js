import './style.css'
import * as THREE from 'three';

// ============================================
// Preloader — show loading screen while assets load
// ============================================
const preloader = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloader-bar');
const preloaderPercent = document.getElementById('preloader-percent');
let loadProgress = 0;
let totalAssets = 0;
let loadedAssets = 0;

function updateProgress(progress) {
  loadProgress = Math.max(loadProgress, progress);
  if (preloaderBar) preloaderBar.style.width = loadProgress + '%';
  if (preloaderPercent) preloaderPercent.textContent = Math.round(loadProgress) + '%';
}

function hidePreloader() {
  updateProgress(100);
  setTimeout(() => {
    if (preloader) {
      preloader.classList.add('preloader-hidden');
      // Remove from DOM after transition
      setTimeout(() => preloader.remove(), 800);
    }
  }, 400);
}

// ============================================
// Detect device capabilities
// ============================================
const isMobile = window.innerWidth <= 768;
const isLowEnd = isMobile && (navigator.hardwareConcurrency || 4) <= 4;

// ============================================
// Scene Setup
// ============================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 30);

const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile, // Disable AA on mobile for performance
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ============================================
// Mouse / Touch Interaction
// ============================================
const mouse = new THREE.Vector2(0, 0);
const targetMouse = new THREE.Vector2(0, 0);

// ============================================
// Studio Environment Map
// ============================================
function createStudioEnvironment() {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x444444);

  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const softGrayMat = new THREE.MeshBasicMaterial({ color: 0xbbbbbb, side: THREE.DoubleSide });

  const topPanel = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), whiteMat);
  topPanel.position.set(0, 30, 0);
  topPanel.rotation.x = Math.PI / 2;
  envScene.add(topPanel);

  const keyPanel = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), whiteMat);
  keyPanel.position.set(25, 10, 25);
  keyPanel.lookAt(0, 0, 0);
  envScene.add(keyPanel);

  const fillPanel = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), softGrayMat);
  fillPanel.position.set(-25, 5, 20);
  fillPanel.lookAt(0, 0, 0);
  envScene.add(fillPanel);

  const bottomPanel = new THREE.Mesh(new THREE.PlaneGeometry(50, 30), softGrayMat);
  bottomPanel.position.set(0, -25, 0);
  bottomPanel.rotation.x = -Math.PI / 2;
  envScene.add(bottomPanel);

  const rearPanel = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), whiteMat);
  rearPanel.position.set(5, 10, -30);
  rearPanel.lookAt(0, 0, 0);
  envScene.add(rearPanel);

  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();

  // Dispose env scene geometries/materials
  envScene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });

  return envMap;
}

updateProgress(10);

// ============================================
// Create the Silver Planet
// ============================================
let planetMesh;

function initPlanet() {
  // Lower segments on mobile for performance
  const segments = isMobile ? 128 : 256;
  const geometry = new THREE.SphereGeometry(6, segments, segments);

  const manager = new THREE.LoadingManager();
  totalAssets = 2;

  manager.onProgress = (url, loaded, total) => {
    loadedAssets = loaded;
    updateProgress(10 + (loaded / total) * 70);
  };

  manager.onLoad = () => {
    updateProgress(90);
    // Start rendering and hide preloader
    scene.environment = createStudioEnvironment();
    updateProgress(95);
    animate();
    hidePreloader();
  };

  const textureLoader = new THREE.TextureLoader(manager);
  const normalMap = textureLoader.load('/earth_normal.jpg');
  const displacementMap = textureLoader.load('/earth_displacement.jpg');

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xc0c0c0,
    metalness: 1.0,
    roughness: 0.22,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    displacementMap: displacementMap,
    displacementScale: 0.45,
    clearcoat: isMobile ? 0 : 0.3, // Skip clearcoat on mobile (expensive)
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.0,
    side: THREE.FrontSide,
  });

  planetMesh = new THREE.Mesh(geometry, material);

  const xOffset = isMobile ? 0 : -5;
  const yOffset = isMobile ? -3 : 0;
  camera.position.set(xOffset, yOffset, 30);
  camera.lookAt(xOffset, yOffset, 0);

  scene.add(planetMesh);
}

initPlanet();

// ============================================
// Lighting
// ============================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(8, 6, 10);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xe8e8ff, 0.5);
fillLight.position.set(-8, 3, 6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(-3, 5, -10);
scene.add(rimLight);

const bottomLight = new THREE.DirectionalLight(0xcccccc, 0.3);
bottomLight.position.set(0, -10, 5);
scene.add(bottomLight);

// ============================================
// Mouse tracking (desktop) + Touch (mobile)
// ============================================
document.addEventListener('mousemove', (event) => {
  if (isMobile) return;
  targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Touch support for mobile — drag to rotate
let touchStartX = 0;
let touchBaseRotation = 0;

document.addEventListener('touchstart', (e) => {
  if (!isMobile) return;
  touchStartX = e.touches[0].clientX;
  touchBaseRotation = planetMesh ? planetMesh.rotation.y : 0;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!isMobile || !planetMesh) return;
  const dx = e.touches[0].clientX - touchStartX;
  targetMouse.x = dx / window.innerWidth * 2;
}, { passive: true });

document.addEventListener('touchend', () => {
  targetMouse.x = 0;
  targetMouse.y = 0;
}, { passive: true });

// ============================================
// Responsiveness
// ============================================
window.addEventListener('resize', () => {
  if (!container) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));

  if (planetMesh) {
    const mobile = window.innerWidth <= 768;
    const xOffset = mobile ? 0 : -5;
    const yOffset = mobile ? -3 : 0;
    camera.position.set(xOffset, yOffset, 30);
    camera.lookAt(xOffset, yOffset, 0);
  }
});

// ============================================
// Animation Loop (started after textures load)
// ============================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  mouse.x += (targetMouse.x - mouse.x) * 0.05;
  mouse.y += (targetMouse.y - mouse.y) * 0.05;

  if (planetMesh) {
    planetMesh.rotation.y = elapsed * 0.08 + mouse.x * 0.4;
    planetMesh.rotation.x = 0.15 + mouse.y * 0.3;
  }

  renderer.render(scene, camera);
}

// ============================================
// Lazy load videos — only when visible
// ============================================
function initLazyVideos() {
  const videos = document.querySelectorAll('video[data-src]');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const video = entry.target;
        video.src = video.dataset.src;
        video.load();
        observer.unobserve(video);
      }
    });
  }, { rootMargin: '200px' });

  videos.forEach(v => observer.observe(v));
}

initLazyVideos();

// ============================================
// Video Hover Logic (cases section)
// ============================================
document.querySelectorAll('.case-card').forEach(card => {
  const video = card.querySelector('video');
  if (video) {
    card.addEventListener('mouseenter', () => video.pause());
    card.addEventListener('mouseleave', () => video.play());
  }
});
