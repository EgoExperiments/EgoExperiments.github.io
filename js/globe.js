import * as THREE from 'three';

// --- Configuration ---
const GLOBE_RADIUS = 1;
const POINT_COUNT = 10000;
const ARC_COUNT = 7;
const ROTATION_SPEED = 0.0008;
const ATMOSPHERE_SCALE = 1.025;

// PlayStation blues + NVIDIA green accent
const BLUE_LIGHT = new THREE.Color(0x0070cc);
const BLUE_DARK = new THREE.Color(0x00439C);
const BLUE_GLOW = new THREE.Color(0x0090ff);
const NVIDIA_GREEN = new THREE.Color(0x76b900);

// Operational node positions [lat, lng] — approximate
const NODES = [
  { lat: 48.45, lng: -123.37, label: 'Victoria' },      // HQ
  { lat: 38.95, lng: -77.15, label: 'Langley' },         // CIA
  { lat: 37.39, lng: -122.08, label: 'Silicon Valley' }, // NIM/NVIDIA
  { lat: 47.61, lng: -122.33, label: 'Seattle' },        // AWS
  { lat: 51.51, lng: -0.13, label: 'London' },           // UK OSINT
  { lat: 40.71, lng: -74.01, label: 'New York' },        // Palantir
  { lat: -62.21, lng: -58.96, label: 'Antarctic' },      // Alliance
  { lat: 38.88, lng: -77.02, label: 'DC' },              // INSA/GSA
];

// Arc connections (index pairs into NODES)
const ARCS = [
  [0, 1], [0, 2], [0, 3], [1, 7], [5, 4], [0, 6], [2, 5],
];

let scene, camera, renderer, globe, atmosphere, pointCloud, arcs;
let animationId;
let mouseX = 0, mouseY = 0;

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createGlobe() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: BLUE_DARK,
    wireframe: true,
    transparent: true,
    opacity: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.material = material;
  return mesh;
}

function createAtmosphere() {
  // Inner atmosphere
  const geo1 = new THREE.SphereGeometry(GLOBE_RADIUS * ATMOSPHERE_SCALE, 64, 64);
  const mat1 = new THREE.MeshBasicMaterial({
    color: BLUE_LIGHT,
    wireframe: true,
    transparent: true,
    opacity: 0.03,
  });
  const inner = new THREE.Mesh(geo1, mat1);

  // Outer glow shell
  const geo2 = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 32, 32);
  const mat2 = new THREE.MeshBasicMaterial({
    color: BLUE_DARK,
    wireframe: true,
    transparent: true,
    opacity: 0.015,
  });
  const outer = new THREE.Mesh(geo2, mat2);

  const group = new THREE.Group();
  group.add(inner, outer);
  group.userData.innerMat = mat1;
  group.userData.outerMat = mat2;
  return group;
}

function createPointCloud() {
  // Generate points on sphere surface with land-mass weighting
  // Using a simple latitude-band approach to approximate continents
  const positions = new Float32Array(POINT_COUNT * 3);
  const colors = new Float32Array(POINT_COUNT * 3);
  const sizes = new Float32Array(POINT_COUNT);

  // Continental bounding boxes [latMin, latMax, lngMin, lngMax, density]
  const continents = [
    // North America
    { latMin: 15, latMax: 72, lngMin: -170, lngMax: -50, density: 0.18 },
    // South America
    { latMin: -56, latMax: 13, lngMin: -82, lngMax: -34, density: 0.12 },
    // Europe
    { latMin: 35, latMax: 71, lngMin: -10, lngMax: 40, density: 0.16 },
    // Africa
    { latMin: -35, latMax: 37, lngMin: -18, lngMax: 52, density: 0.14 },
    // Asia
    { latMin: 0, latMax: 75, lngMin: 40, lngMax: 150, density: 0.22 },
    // Australia
    { latMin: -47, latMax: -10, lngMin: 112, lngMax: 155, density: 0.08 },
    // Antarctica
    { latMin: -90, latMax: -60, lngMin: -180, lngMax: 180, density: 0.05 },
  ];

  const totalDensity = continents.reduce((s, c) => s + c.density, 0);

  let idx = 0;
  for (const cont of continents) {
    const count = Math.floor((cont.density / totalDensity) * POINT_COUNT);
    for (let i = 0; i < count && idx < POINT_COUNT; i++) {
      const lat = cont.latMin + Math.random() * (cont.latMax - cont.latMin);
      const lng = cont.lngMin + Math.random() * (cont.lngMax - cont.lngMin);
      // Add slight randomness to radius for depth
      const r = GLOBE_RADIUS * (1.001 + Math.random() * 0.003);
      const pos = latLngToVec3(lat, lng, r);

      positions[idx * 3] = pos.x;
      positions[idx * 3 + 1] = pos.y;
      positions[idx * 3 + 2] = pos.z;

      // Gradient: dark blue at poles → light blue at equator, with NVIDIA green accents
      const brightness = 0.5 + Math.random() * 0.5;
      if (Math.random() < 0.08) {
        // ~8% of points get NVIDIA green
        colors[idx * 3] = 0.46 * brightness;
        colors[idx * 3 + 1] = 0.72 * brightness;
        colors[idx * 3 + 2] = 0.0 * brightness;
      } else {
        const latNorm = Math.abs(lat) / 90;
        const mix = 1 - latNorm;
        const cr = mix * 0.0 + (1 - mix) * 0.0;
        const cg = mix * 0.44 + (1 - mix) * 0.26;
        const cb = mix * 0.8 + (1 - mix) * 0.61;
        colors[idx * 3] = cr * brightness;
        colors[idx * 3 + 1] = cg * brightness;
        colors[idx * 3 + 2] = cb * brightness;
      }

      sizes[idx] = 1.5 + Math.random() * 1.5;
      idx++;
    }
  }

  // Fill remaining with scattered ocean points (sparse)
  while (idx < POINT_COUNT) {
    const lat = -90 + Math.random() * 180;
    const lng = -180 + Math.random() * 360;
    const r = GLOBE_RADIUS * 1.001;
    const pos = latLngToVec3(lat, lng, r);

    positions[idx * 3] = pos.x;
    positions[idx * 3 + 1] = pos.y;
    positions[idx * 3 + 2] = pos.z;

    colors[idx * 3] = 0.0;
    colors[idx * 3 + 1] = 0.15;
    colors[idx * 3 + 2] = 0.35;

    sizes[idx] = 0.8;
    idx++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createArcs() {
  const group = new THREE.Group();

  ARCS.forEach(([fromIdx, toIdx], i) => {
    const from = NODES[fromIdx];
    const to = NODES[toIdx];
    const startVec = latLngToVec3(from.lat, from.lng, GLOBE_RADIUS);
    const endVec = latLngToVec3(to.lat, to.lng, GLOBE_RADIUS);

    // Control point — midpoint elevated above surface
    const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const dist = startVec.distanceTo(endVec);
    mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.4);

    const curve = new THREE.QuadraticBezierCurve3(startVec, mid, endVec);
    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const arcColor = i % 2 === 0 ? BLUE_LIGHT : BLUE_DARK;
    const material = new THREE.LineDashedMaterial({
      color: arcColor,
      transparent: true,
      opacity: 0.6,
      dashSize: 0.03,
      gapSize: 0.02,
      linewidth: 1,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    // Store animation data
    line.userData = {
      dashOffset: Math.random() * 2,
      speed: 0.002 + Math.random() * 0.003,
    };

    group.add(line);
  });

  // Add node markers
  NODES.forEach((node) => {
    const pos = latLngToVec3(node.lat, node.lng, GLOBE_RADIUS * 1.005);
    const dotGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x0070cc,
      transparent: true,
      opacity: 0.9,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);
    group.add(dot);

    // Pulse ring
    const ringGeo = new THREE.RingGeometry(0.012, 0.016, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0070cc,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(new THREE.Vector3(0, 0, 0));
    ring.userData.pulse = Math.random() * Math.PI * 2;
    group.add(ring);
  });

  return group;
}

function createNodeGlow() {
  // Subtle glow sprites at each node
  const group = new THREE.Group();
  NODES.forEach((node) => {
    const pos = latLngToVec3(node.lat, node.lng, GLOBE_RADIUS * 1.01);
    const spriteMat = new THREE.SpriteMaterial({
      color: 0x0070cc,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.scale.set(0.06, 0.06, 1);
    group.add(sprite);
  });
  return group;
}

export function initGlobe(container) {
  // WebGL check
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('No WebGL');
  } catch (e) {
    container.style.display = 'none';
    const fallback = document.getElementById('globe-fallback');
    if (fallback) fallback.style.display = 'block';
    return null;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 2.8;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x0a0a14);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x0070cc, 1.0, 10);
  pointLight.position.copy(camera.position);
  scene.add(pointLight);

  const rimLight = new THREE.PointLight(0x00439C, 0.6, 8);
  rimLight.position.set(-3, 1, -2);
  scene.add(rimLight);

  const greenRim = new THREE.PointLight(0x76b900, 0.2, 6);
  greenRim.position.set(2, -1.5, 1);
  scene.add(greenRim);

  // Objects
  globe = createGlobe();
  scene.add(globe);

  atmosphere = createAtmosphere();
  scene.add(atmosphere);

  pointCloud = createPointCloud();
  scene.add(pointCloud);

  arcs = createArcs();
  scene.add(arcs);

  const glows = createNodeGlow();
  scene.add(glows);

  // Tilt globe slightly
  const globeGroup = new THREE.Group();
  scene.remove(globe, atmosphere, pointCloud, arcs, glows);
  globeGroup.add(globe, atmosphere, pointCloud, arcs, glows);
  globeGroup.rotation.x = 0.15;
  globeGroup.rotation.z = -0.05;
  scene.add(globeGroup);

  // Mouse parallax (subtle — max ±0.1 offset)
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 0.15;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.15;
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animate
  function animate() {
    animationId = requestAnimationFrame(animate);

    // Rotate
    globeGroup.rotation.y += ROTATION_SPEED;

    // Mouse parallax (subtle)
    camera.position.x += (mouseX - camera.position.x) * 0.02;
    camera.position.y += (-mouseY - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // Breathe — wireframe pulses between dark and light blue
    const breathe = Math.sin(Date.now() * 0.0008) * 0.5 + 0.5; // 0-1 oscillation
    if (globe.userData.material) {
      globe.userData.material.color.lerpColors(BLUE_DARK, BLUE_LIGHT, breathe);
      globe.userData.material.opacity = 0.07 + breathe * 0.06;
    }

    // Atmosphere breathe
    if (atmosphere.userData && atmosphere.userData.innerMat) {
      atmosphere.userData.innerMat.opacity = 0.02 + breathe * 0.03;
      atmosphere.userData.outerMat.opacity = 0.01 + (1 - breathe) * 0.02;
    }

    // Point cloud shimmer — subtle size oscillation
    if (pointCloud.material) {
      pointCloud.material.opacity = 0.6 + breathe * 0.2;
    }

    // Animate arc dash offsets
    arcs.children.forEach((child) => {
      if (child.userData.dashOffset !== undefined) {
        child.userData.dashOffset += child.userData.speed;
        child.material.dashOffset = -child.userData.dashOffset;
      }
      // Pulse rings
      if (child.userData.pulse !== undefined) {
        child.userData.pulse += 0.02;
        const scale = 1 + Math.sin(child.userData.pulse) * 0.3;
        child.scale.set(scale, scale, scale);
        child.material.opacity = 0.3 + Math.sin(child.userData.pulse) * 0.15;
      }
    });

    // Point light follows camera
    scene.children.forEach((child) => {
      if (child.isPointLight) {
        child.position.copy(camera.position);
      }
    });

    renderer.render(scene, camera);
  }

  animate();

  return { scene, camera, renderer };
}

export function destroyGlobe() {
  if (animationId) cancelAnimationFrame(animationId);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
}
