class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (ch && ch.length > 0) {
      const out = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i += 1) {
        const raw = ch.at(i);
        const sample = Math.max(-1, Math.min(1, Number(raw)));
        const q = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        out.set([q], i);
      }
      this.port.postMessage({ type: 'pcm', data: out.buffer }, [out.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PcmProcessor);
