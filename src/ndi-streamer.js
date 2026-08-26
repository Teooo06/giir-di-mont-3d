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

    // Buffer pixel 1080p
    this.pixelBuffer = new Uint8Array(this.width * this.height * 4);
    this.flippedBuffer = new Uint8Array(this.width * this.height * 4);
    this.u32Src = new Uint32Array(this.pixelBuffer.buffer);
    this.u32Dst = new Uint32Array(this.flippedBuffer.buffer);

    this.lastFrameTime = 0;
    this.frameInterval = 1000 / this.targetFps;

    // Render target dedicato 1080p
    this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false
    });

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
   * @param {THREE.WebGLRenderer} renderer 
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} camera 
   */
  captureAndSend(renderer, scene, camera) {
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

    // Renderizza su render target dedicato 1080p
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, camera);

    // Leggi i pixel dal framebuffer
    const gl = renderer.getContext();
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

    // Ripristina SUBITO a null per non interferire con il canvas a schermo
    renderer.setRenderTarget(null);

    // Inversione verticale veloce delle righe (1.3ms)
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
