import * as THREE from 'three';

// Arco gonfiabile rosso — P8 — da Arco Gonfiabile.png (U rovesciata, 8 lati)
// Creato come TubeGeometry lungo curva ad U, orientabile perpendicolare al tracciato
export function createArch(options = {}) {
  const height = options.height || 10; // altezza mondo (scale 0.1 → ~100m reali, simile a checkpoint)
  const width = options.width || 12; // larghezza apertura (passaggio atleta)
  const tubeRadius = options.tubeRadius || 1.1;
  const color = options.color || '#ff1a1a';
  const segments = 32;

  // Curva ad U: 2 gambe verticali + semicerchio superiore
  const curvePoints = [];
  const halfW = width / 2;
  // gamba sinistra su
  curvePoints.push(new THREE.Vector3(-halfW, 0, 0));
  curvePoints.push(new THREE.Vector3(-halfW, height * 0.55, 0));
  // arco superiore (semicerchio)
  for (let i = 0; i <= 12; i++) {
    const t = i / 12; // 0→1
    const angle = Math.PI * (1 - t); // da PI a 0 (sinistra→destra)
    const x = Math.cos(angle) * halfW;
    const y = height * 0.55 + Math.sin(angle) * (height * 0.45);
    curvePoints.push(new THREE.Vector3(x, y, 0));
  }
  // gamba destra giù
  curvePoints.push(new THREE.Vector3(halfW, height * 0.55, 0));
  curvePoints.push(new THREE.Vector3(halfW, 0, 0));

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const geo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.05,
    emissive: color,
    emissiveIntensity: 0.08
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Gruppo con base per inclinazione terreno
  const group = new THREE.Group();
  group.add(mesh);
  // piedi a terra (piccoli cilindri per appoggio visivo)
  const footGeo = new THREE.CylinderGeometry(tubeRadius * 1.3, tubeRadius * 1.3, 0.6, 8);
  const footMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.9 });
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(-halfW, 0.1, 0);
  const footR = new THREE.Mesh(footGeo, footMat);
  footR.position.set(halfW, 0.1, 0);
  group.add(footL);
  group.add(footR);

  return group;
}

// Posiziona e orienta l'arco sul tracciato — perpendicolare alla tangente, inclinato con terreno
export function placeArchAtRoute(archGroup, routeCurve, ratio, terrainManager) {
  const pt = routeCurve.getPointAt(ratio);
  const tangent = routeCurve.getTangentAt(ratio).normalize();
  // normal perpendicolare sul piano XZ (rotazione 90° attorno a Y)
  const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  // posizione base
  archGroup.position.copy(pt);
  // orientamento: asse X dell'arco allineato a perp (apertura lungo tracciato, atleta passa sotto)
  // L'arco è costruito sul piano XY (larghezza X, altezza Y), quindi ruotiamo attorno a Y per allinearlo a perp
  const angleY = Math.atan2(perp.x, perp.z);
  archGroup.rotation.y = angleY;
  // inclinazione con terreno: campiona elevazione ai due piedi per differenza
  if (terrainManager) {
    const halfW = 6;
    const leftPos = pt.clone().add(perp.clone().multiplyScalar(-halfW));
    const rightPos = pt.clone().add(perp.clone().multiplyScalar(halfW));
    const leftY = terrainManager.getElevationAtWorld(leftPos.x, leftPos.z);
    const rightY = terrainManager.getElevationAtWorld(rightPos.x, rightPos.z);
    const slope = Math.atan2(rightY - leftY, halfW * 2);
    archGroup.rotation.z = slope * 0.5; // inclina leggermente
    // rialza base per evitare interpenetrazione
    const baseY = Math.max(leftY, rightY);
    archGroup.position.y = baseY + 0.5;
  } else {
    archGroup.position.y += 0.5;
  }
  return archGroup;
}
