// PERF-02: OffscreenCanvas + Worker flip for NDI — ponytail: Uint32Array fast path
self.onmessage = (e) => {
  const { buffer, width, height } = e.data;
  const src = new Uint32Array(buffer);
  const dst = new Uint32Array(width * height);
  const w = width;
  const h = height;
  for (let y = 0; y < h; y++) {
    const srcRow = y * w;
    const dstRow = (h - 1 - y) * w;
    dst.set(src.subarray(srcRow, srcRow + w), dstRow);
  }
  self.postMessage({ buffer: dst.buffer }, [dst.buffer]);
};
