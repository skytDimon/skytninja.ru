import './style.css'
import * as THREE from 'three';

// === Scene Setup ===
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 30);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// === Mouse Interaction State ===
const mouse = new THREE.Vector2(0, 0);
const targetMouse = new THREE.Vector2(0, 0);

// === Uniforms for shaders ===
const uniforms = {
  uTime: { value: 0 },
  uMouse: { value: new THREE.Vector3(0, 0, 0) },
};

// ============================================
// GLSL: Classic Perlin 3D Noise (Stefan Gustavson)
// ============================================
const noiseGLSL = /* glsl */ `
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  float cnoise(vec3 P) {
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
    vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
    vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
    vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
    vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
`;

// ============================================
// Create the Ferrofluid Sphere
// ============================================
let fluidMesh;
let compiledShader = null; // Keep reference for uniform updates

function initFluid() {
  // High-detail icosahedron for smooth organic deformation
  const geometry = new THREE.IcosahedronGeometry(6, 128);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x030303,
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    reflectivity: 0.5,
    envMapIntensity: 0.6,
    side: THREE.FrontSide,
  });

  // Inject custom vertex shader for noise-based deformation
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uMouse = uniforms.uMouse;
    compiledShader = shader;

    // Prepend noise functions and uniforms
    shader.vertexShader = /* glsl */ `
      uniform float uTime;
      uniform vec3 uMouse;

      // Helper: compute total displacement for a given position
      ${noiseGLSL}

      float getDisplacement(vec3 pos, float time, vec3 mousePos) {
        float n1 = cnoise(pos * 0.3 + time * 0.3) * 0.7;
        float n2 = cnoise(pos * 0.6 + time * 0.45) * 0.35;
        float n3 = cnoise(pos * 1.2 + time * 0.7) * 0.15;
        float noise = n1 + n2 + n3;

        float dist = distance(pos, mousePos);
        float mouseEff = smoothstep(12.0, 0.0, dist) * 1.5;

        return noise + mouseEff;
      }
    ` + shader.vertexShader;

    // Hook into normal computation to recalculate after displacement
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
        #include <beginnormal_vertex>

        // Recalculate normals using finite differences of the displacement field
        vec3 mw = vec3(uMouse.x * 18.0, uMouse.y * 12.0, 5.0);
        float eps = 0.05;
        vec3 p = position;
        float d  = getDisplacement(p, uTime, mw);
        float dx = getDisplacement(p + vec3(eps, 0.0, 0.0), uTime, mw);
        float dy = getDisplacement(p + vec3(0.0, eps, 0.0), uTime, mw);
        float dz = getDisplacement(p + vec3(0.0, 0.0, eps), uTime, mw);

        vec3 grad = vec3(dx - d, dy - d, dz - d) / eps;
        objectNormal = normalize(objectNormal - grad * 0.5);
      `
    );

    // Replace the vertex transform
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>

        vec3 mouseW = vec3(uMouse.x * 18.0, uMouse.y * 12.0, 5.0);
        float totalDisplacement = getDisplacement(position, uTime, mouseW);
        transformed += normal * totalDisplacement;
      `
    );

    // --- Fragment shader: darken Fresnel-bright edges ---
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      /* glsl */ `
        #include <output_fragment>
        
        // Darken edges where Fresnel makes them too bright
        // Use view-space normal dot view direction
        vec3 viewDir = normalize(vViewPosition);
        vec3 normalView = normalize(vNormal);
        float fresnel = 1.0 - abs(dot(normalView, viewDir));
        float edgeDarken = 1.0 - pow(fresnel, 2.0) * 0.85;
        gl_FragColor.rgb *= edgeDarken;
      `
    );
  };

  fluidMesh = new THREE.Mesh(geometry, material);

  // Position camera offset for desktop (fluid on the right side)
  const isMobile = window.innerWidth <= 768;
  const xOffset = isMobile ? 0 : -5;
  const yOffset = isMobile ? -3 : 0;
  camera.position.set(xOffset, yOffset, 30);
  camera.lookAt(xOffset, yOffset, 0);

  scene.add(fluidMesh);
}

// ============================================
// Dark Environment Map (programmatic — no HDRI)
// ============================================
// Create a tiny dark CubeTexture for PBR reflections
// This gives metallic look without bright studio reflections
function createDarkEnvironment() {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  // Fill with very dark grey (not pure black — need minimal reflection)
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 3;     // R
    data[i * 4 + 1] = 3; // G
    data[i * 4 + 2] = 5; // B (tiny blue tint)
    data[i * 4 + 3] = 255;
  }
  
  const faces = [];
  for (let i = 0; i < 6; i++) {
    faces.push(new THREE.DataTexture(data.slice(), size, size, THREE.RGBAFormat));
    faces[i].needsUpdate = true;
  }
  
  // Use PMREMGenerator to create a proper environment from a simple scene
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x010103);
  
  // Add a few subtle colored lights to the env scene for interesting reflections
  const envLight1 = new THREE.PointLight(0x1a2a4a, 5, 50);
  envLight1.position.set(10, 10, 10);
  envScene.add(envLight1);
  
  const envLight2 = new THREE.PointLight(0x2a1a0a, 3, 50);
  envLight2.position.set(-10, -5, -10);
  envScene.add(envLight2);
  
  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();
  
  return envMap;
}

scene.environment = createDarkEnvironment();
initFluid();

// ============================================
// Lighting (all controlled — no HDRI)
// ============================================
const ambientLight = new THREE.AmbientLight(0x0a0a15, 0.3);
scene.add(ambientLight);

// Blue rim light for sci-fi / tech vibe
const rimLight = new THREE.DirectionalLight(0x2244aa, 1.5);
rimLight.position.set(-8, 5, -10);
scene.add(rimLight);

// Warm accent for contrast
const warmLight = new THREE.DirectionalLight(0xff6633, 0.6);
warmLight.position.set(6, -3, 8);
scene.add(warmLight);

// Top spotlight for dramatic highlights
const topLight = new THREE.DirectionalLight(0xcccccc, 0.4);
topLight.position.set(0, 15, 5);
scene.add(topLight);

// ============================================
// Mouse tracking
// ============================================
document.addEventListener('mousemove', (event) => {
  if (window.innerWidth <= 768) return;
  targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// ============================================
// Responsiveness
// ============================================
window.addEventListener('resize', () => {
  if (!container) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (fluidMesh) {
    const isMobile = window.innerWidth <= 768;
    const xOffset = isMobile ? 0 : -5;
    const yOffset = isMobile ? -3 : 0;
    camera.position.set(xOffset, yOffset, 30);
    camera.lookAt(xOffset, yOffset, 0);
  }
});

// ============================================
// Animation Loop
// ============================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  uniforms.uTime.value = elapsed;

  // Smooth mouse lerp
  mouse.x += (targetMouse.x - mouse.x) * 0.08;
  mouse.y += (targetMouse.y - mouse.y) * 0.08;
  uniforms.uMouse.value.set(mouse.x, mouse.y, 0);

  if (fluidMesh) {
    // Slow continuous rotation to show off reflections from all angles
    fluidMesh.rotation.y = elapsed * 0.08;
    fluidMesh.rotation.z = elapsed * 0.04;
  }

  renderer.render(scene, camera);
}

animate();

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
