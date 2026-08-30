import * as THREE from 'three';

export class TerrainManager {
  constructor(options = {}) {
    this.scene = options.scene;
    this.scale = 0.1; // 1 unit = 10 meters
    this.verticalExaggeration = options.verticalExaggeration || 1.25;
    this.baseElevation = 600; // Elevation zero offset in meters
    this.style = options.style || 'satellite'; // 'satellite', 'stylized', 'dark'
    
    this.terrainMesh = null;
    this.terrainData = null;
    this.satelliteTexture = null;
    this.centerLat = 46.055;
    this.centerLon = 9.4525;
    this.metersPerDegreeLat = 111150;
    this.metersPerDegreeLon = 77211;

    // Pre-carica la texture satellitare — MAP-02: 4096 NDI / 2048 browser, ponytail deferred until PERF-01 headroom proven
    const textureLoader = new THREE.TextureLoader();
    this.satelliteTexture = textureLoader.load('/textures/premana-satellite.jpg', (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      if (this.style === 'satellite' && this.terrainMesh) {
        this.applyStyle('satellite');
      }
    });
    // MAP-02: HD texture for NDI (4096) — try load, fallback to standard if missing; deferred if VRAM tight per WAYFINDER_PROTOCOL
    this.satelliteTextureHD = null;
    textureLoader.load('/textures/premana-satellite-4096.jpg',
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        this.satelliteTextureHD = tex;
        // ponytail: keep 2048 for browser, use HD only for NDI — material switch handled in getMaterialForStyle(true)
        console.log('[TerrainManager] HD satellite texture 4096 loaded for NDI');
      },
      undefined,
      () => { console.log('[TerrainManager] HD 4096 not found, using 2048 for both — ponytail deferred'); }
    );
  }

  async loadTerrain(url = '/data/terrain-premana.json') {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      this.terrainData = await res.json();
      this.centerLat = (this.terrainData.bbox.minLat + this.terrainData.bbox.maxLat) / 2;
      this.centerLon = (this.terrainData.bbox.minLon + this.terrainData.bbox.maxLon) / 2;
      this.buildTerrainMesh();
      return true;
    } catch (err) {
      console.error('[TerrainManager] Errore caricamento DEM:', err);
      return false;
    }
  }

  coordToWorld(lat, lon, ele = null) {
    const x = (lon - this.centerLon) * this.metersPerDegreeLon * this.scale;
    const z = -(lat - this.centerLat) * this.metersPerDegreeLat * this.scale;
    
    let y = 0;
    if (ele !== null && Number.isFinite(ele)) {
      y = (ele - this.baseElevation) * this.scale * this.verticalExaggeration;
    } else {
      y = this.getElevationAtWorld(x, z);
    }
    return new THREE.Vector3(x, y, z);
  }

  getElevationAtWorld(x, z) {
    if (!this.terrainData) return 0;
    const lon = (x / (this.metersPerDegreeLon * this.scale)) + this.centerLon;
    const lat = this.centerLat - (z / (this.metersPerDegreeLat * this.scale));
    
    const bbox = this.terrainData.bbox;
    const normX = (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon);
    const normZ = (bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat);
    
    if (normX < 0 || normX > 1 || normZ < 0 || normZ > 1) return 0;
    
    const col = Math.floor(normX * (this.terrainData.width - 1));
    const row = Math.floor(normZ * (this.terrainData.height - 1));
    const idx = row * this.terrainData.width + col;
    const ele = this.terrainData.elevations[idx] || this.baseElevation;
    return (ele - this.baseElevation) * this.scale * this.verticalExaggeration;
  }

  buildTerrainMesh() {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      if (this.terrainMesh.geometry) this.terrainMesh.geometry.dispose();
      if (this.terrainMesh.material) this.terrainMesh.material.dispose();
    }

    const { width, height, bbox, elevations, minElevation, maxElevation } = this.terrainData;
    const worldWidth = (bbox.maxLon - bbox.minLon) * this.metersPerDegreeLon * this.scale;
    const worldHeight = (bbox.maxLat - bbox.minLat) * this.metersPerDegreeLat * this.scale;

    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight, width - 1, height - 1);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = [];

    // Colori per fasce altimetriche realistiche (fondovalle bosco -> prati alpini -> roccia -> vette)
    const colValley = new THREE.Color('#223d2e'); // Valle boschiva
    const colMid = new THREE.Color('#557548');    // Pascoli alpini
    const colHigh = new THREE.Color('#8b836a');   // Roccia dolomitica
    const colPeak = new THREE.Color('#d2d4cf');   // Vette alte

    for (let i = 0; i < positions.count; i++) {
      const ele = elevations[i] !== undefined ? elevations[i] : minElevation;
      const y = (ele - this.baseElevation) * this.scale * this.verticalExaggeration;
      positions.setY(i, y);

      const t = THREE.MathUtils.clamp((ele - minElevation) / (maxElevation - minElevation), 0, 1);
      let c = new THREE.Color();
      if (t < 0.35) {
        c.copy(colValley).lerp(colMid, t / 0.35);
      } else if (t < 0.75) {
        c.copy(colMid).lerp(colHigh, (t - 0.35) / 0.4);
      } else {
        c.copy(colHigh).lerp(colPeak, (t - 0.75) / 0.25);
      }
      colors.push(c.r, c.g, c.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    this.terrainMesh = new THREE.Mesh(geometry, this.getMaterialForStyle(this.style));
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = false;
    this.scene.add(this.terrainMesh);
  }

  getMaterialForStyle(styleName, isHD = false) {
    if (styleName === 'satellite' && this.satelliteTexture) {
      const tex = (isHD && this.satelliteTextureHD) ? this.satelliteTextureHD : this.satelliteTexture;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.82,
        metalness: 0.02,
        flatShading: false
      });
    } else if (styleName === 'dark') {
      return new THREE.MeshStandardMaterial({
        color: '#131b1f',
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
      });
    } else {
      // Stilizzato / videogame
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.02,
        flatShading: true
      });
    }
  }

  applyStyle(styleName) {
    this.style = styleName;
    if (this.terrainMesh) {
      this.terrainMesh.material.dispose();
      this.terrainMesh.material = this.getMaterialForStyle(styleName);
      this.terrainMesh.material.needsUpdate = true;
    }
  }

  setVerticalExaggeration(exaggeration) {
    this.verticalExaggeration = exaggeration;
    if (this.terrainData) {
      this.buildTerrainMesh();
    }
  }
}
