import * as THREE from 'three';

export class NdiStreamer {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || `ws://${window.location.hostname || 'localhost'}:9998`;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.targetFps = options.fps || 50;
    this.sourceName = options.sourceName || 'GIIR-3D-PROGRAM';
    this.enabled = true;

    this.ws = null;
    this.isConnected = false;
    this.status = {
      active: false,
      streaming: false,
      connections: 0,
      tally: { onProgram: false, onPreview: false },
      fps: 0,
      sourceName: this.sourceName
    };

    this.onStatusChange = options.onStatusChange || null;
    this.onTimingUpdate = options.onTimingUpdate || null; // YOU-27: live timing webhook passthrough

    // Buffer pixel 1080p
    this.pixelBuffer = new Uint8Array(this.width * this.height * 4);
    this.flippedBuffer = new Uint8Array(this.width * this.height * 4);
    this.u32Src = new Uint32Array(this.pixelBuffer.buffer);
    this.u32Dst = new Uint32Array(this.flippedBuffer.buffer);

    this.lastFrameTime = 0;
    this.frameInterval = 1000 / this.targetFps;

    // --- NUOVA STRATEGIA: renderer NDI dedicato, isolato dal canvas browser ---
    // Un canvas hidden 1920x1080 con il suo WebGL context, così viewport e pixelRatio
    // del browser non interferiscono mai con il Program.
    this.ndiCanvas = document.createElement('canvas');
    this.ndiCanvas.width = this.width;
    this.ndiCanvas.height = this.height;
    this.ndiCanvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1920px;height:1080px;pointer-events:none;opacity:0;';
    // Appende solo quando il body è pronto (main.js è a fine body, quindi ok)
    if (document.body) document.body.appendChild(this.ndiCanvas);
    else addEventListener('DOMContentLoaded', () => document.body.appendChild(this.ndiCanvas));

    this.ndiRenderer = new THREE.WebGLRenderer({
      canvas: this.ndiCanvas,
      antialias: true, // PERF-06: tested MSAA 2x — Three r180 only exposes antialias bool (4x vs 0x), samples:2 not exposed; bench antialias:true 4x costs ~0.8ms vs false 0x, keep true for broadcast quality (ponytail: set false if still tight)
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // required for readPixels — keep only here, browser renderer now false
      alpha: true
    });
    this.ndiRenderer.setSize(this.width, this.height, false);
    this.ndiRenderer.setPixelRatio(1);
    this.ndiRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.ndiRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.ndiRenderer.toneMappingExposure = 1.12;
    this.ndiRenderer.shadowMap.enabled = true;
    this.ndiRenderer.shadowMap.type = THREE.PCFShadowMap; // ponytail: PCFSoft→PCF on NDI, ~1.5ms win per 1080p frame, softness diff invisible at broadcast distance

    this.initWebSocket();
  }

  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendConfig();
        this.emitStatus({ ...this.status, active: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ndi_status') {
            this.status = { ...this.status, ...data };
            this.emitStatus(this.status);
          } else if (data.type === 'timing_update' && typeof this.onTimingUpdate === 'function') {
            this.onTimingUpdate(data.updates || []);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emitStatus({ ...this.status, active: false, streaming: false, connections: 0 });
        setTimeout(() => this.initWebSocket(), 2000);
      };

      this.ws.onerror = () => {
        if (this.ws) this.ws.close();
      };
    } catch (err) {
      setTimeout(() => this.initWebSocket(), 3000);
    }
  }

  sendConfig() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'config',
        fps: this.targetFps,
        sourceName: this.sourceName
      }));
    }
  }

  emitStatus(stat) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange(stat);
    }
  }

  setFps(fps) {
    this.targetFps = fps;
    this.frameInterval = 1000 / fps;
    this.sendConfig();
  }

  setSourceName(name) {
    this.sourceName = name;
    this.sendConfig();
  }

  toggle(enable) {
    this.enabled = enable !== undefined ? enable : !this.enabled;
    return this.enabled;
  }

  /**
   * Cattura e invia un frame broadcast 1080p all'uscita NDI
   * Ora usa il renderer NDI dedicato, non il renderTarget condiviso.
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} programCamera 
   */
  captureAndSend(renderer, scene, programCamera) {
    // renderer param mantenuto per compatibilità con main.js, ma ignorato
    // Usiamo this.ndiRenderer dedicato
    const targetRenderer = this.ndiRenderer;
    const targetScene = scene;
    const targetCamera = programCamera;

    // Supporta anche chiamata vecchia con 3 args (renderer, scene, camera)
    let actualScene = targetScene;
    let actualCamera = targetCamera;
    if (scene && scene.isScene === undefined && renderer && renderer.isScene) {
      // Chiamata con (scene, camera) senza renderer
      actualScene = renderer;
      actualCamera = scene;
    } else if (renderer && scene && programCamera) {
      actualScene = scene;
      actualCamera = programCamera;
    }

    if (!this.enabled || !this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = performance.now();
    if (now - this.lastFrameTime < this.frameInterval) {
      return;
    }

    if (this.ws.bufferedAmount > 8388608) {
      return;
    }

    this.lastFrameTime = now;

    // Renderizza con il renderer NDI dedicato (1920x1080, viewport piena, no interferenze)
    targetRenderer.render(actualScene, actualCamera);

    // Leggi i pixel dal framebuffer NDI
    const gl = targetRenderer.getContext();
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

    // Inversione verticale
    const w = this.width;
    const h = this.height;
    for (let y = 0; y < h; y++) {
      const srcRow = y * w;
      const dstRow = (h - 1 - y) * w;
      this.u32Dst.set(this.u32Src.subarray(srcRow, srcRow + w), dstRow);
    }

    this.ws.send(this.flippedBuffer.buffer);
  }
}
