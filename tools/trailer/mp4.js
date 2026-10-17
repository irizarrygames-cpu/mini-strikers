// A small MP4 writer, for H.264 out of WebCodecs.
//
// The browser will encode H.264 for us a frame at a time, which is what we want — every frame
// lands, nothing is dropped because a timer ran late. What it will not do is put those frames in
// a file. MediaRecorder would, but only in real time, and a trailer recorded in real time is at
// the mercy of whatever else the machine is doing.
//
// So this takes the encoded chunks and writes a plain, unfragmented MP4 around them: ftyp, one
// big mdat, and a moov describing where every sample is. No dependency to download, and the
// result opens anywhere.
const MP4 = {
  // ---- the little endian-safe writers everything else is built from
  u8(n) { return new Uint8Array([n & 0xff]); },
  u16(n) { return new Uint8Array([(n >> 8) & 0xff, n & 0xff]); },
  u32(n) { return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]); },
  str(s) { return new Uint8Array([...s].map((c) => c.charCodeAt(0))); },

  // a box is its own length, its name, and whatever it holds
  box(name, ...parts) {
    const body = this.cat(parts);
    return this.cat([this.u32(body.length + 8), this.str(name), body]);
  },
  // a full box carries a version and flags before its contents
  fullBox(name, version, flags, ...parts) {
    return this.box(name, this.u8(version), new Uint8Array([(flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff]), ...parts);
  },

  cat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  },

  // ---- the file
  // samples: [{ data: Uint8Array, duration, isKey }]  (duration in `timescale` units)
  // avcC: the decoder description WebCodecs hands back on the first chunk
  build({ samples, width, height, timescale, avcC }) {
    const total = samples.reduce((n, s) => n + s.data.length, 0);
    const duration = samples.reduce((n, s) => n + s.duration, 0);

    const ftyp = this.box('ftyp', this.str('isom'), this.u32(0x200), this.str('isom'), this.str('iso2'), this.str('avc1'), this.str('mp41'));

    // mdat holds every frame back to back. Its header is 8 bytes, so the first sample starts
    // 8 bytes after the box begins — which is what the chunk offsets below have to point at.
    const mdat = this.cat([this.u32(total + 8), this.str('mdat'), ...samples.map((s) => s.data)]);
    const mdatStart = ftyp.length;
    const firstSampleAt = mdatStart + 8;

    // stts: how long each sample lasts, run-length encoded
    const runs = [];
    for (const s of samples) {
      const last = runs[runs.length - 1];
      if (last && last.d === s.duration) last.n++;
      else runs.push({ n: 1, d: s.duration });
    }
    const stts = this.fullBox('stts', 0, 0, this.u32(runs.length), ...runs.flatMap((r) => [this.u32(r.n), this.u32(r.d)]));

    // stss: which samples a player may jump straight to
    const keys = [];
    samples.forEach((s, i) => { if (s.isKey) keys.push(i + 1); });
    const stss = this.fullBox('stss', 0, 0, this.u32(keys.length), ...keys.map((k) => this.u32(k)));

    // stsz: the size of every sample
    const stsz = this.fullBox('stsz', 0, 0, this.u32(0), this.u32(samples.length), ...samples.map((s) => this.u32(s.data.length)));

    // Every sample is its own chunk. That makes stco long but keeps stsc trivial, and a trailer
    // is a couple of thousand frames, not a feature film.
    const offsets = [];
    let at = firstSampleAt;
    for (const s of samples) { offsets.push(at); at += s.data.length; }
    const stsc = this.fullBox('stsc', 0, 0, this.u32(1), this.u32(1), this.u32(1), this.u32(1));
    const stco = this.fullBox('stco', 0, 0, this.u32(offsets.length), ...offsets.map((o) => this.u32(o)));

    const avc1 = this.box('avc1',
      new Uint8Array(6), this.u16(1),                 // reserved, data reference index
      this.u16(0), this.u16(0), new Uint8Array(12),   // version, revision, vendor/quality
      this.u16(width), this.u16(height),
      this.u32(0x00480000), this.u32(0x00480000),     // 72 dpi each way
      this.u32(0), this.u16(1),                       // reserved, frame count
      new Uint8Array(32),                             // compressor name, blank
      this.u16(0x18), this.u16(0xffff),               // depth, colour table id
      this.box('avcC', avcC));
    const stsd = this.fullBox('stsd', 0, 0, this.u32(1), avc1);

    const stbl = this.box('stbl', stsd, stts, stss, stsc, stsz, stco);
    const dinf = this.box('dinf', this.fullBox('dref', 0, 0, this.u32(1), this.fullBox('url ', 0, 1)));
    const minf = this.box('minf', this.box('vmhd', this.u8(0), new Uint8Array([0, 0, 1]), new Uint8Array(8)), dinf, stbl);
    const mdhd = this.fullBox('mdhd', 0, 0, this.u32(0), this.u32(0), this.u32(timescale), this.u32(duration), this.u16(0x55c4), this.u16(0));
    const hdlr = this.fullBox('hdlr', 0, 0, this.u32(0), this.str('vide'), new Uint8Array(12), this.str('VideoHandler\0'));
    const mdia = this.box('mdia', mdhd, hdlr, minf);

    const unity = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000]; // the identity matrix
    const tkhd = this.fullBox('tkhd', 0, 3, this.u32(0), this.u32(0), this.u32(1), this.u32(0), this.u32(duration),
      new Uint8Array(8), this.u16(0), this.u16(0), this.u16(0), this.u16(0),
      ...unity.map((v) => this.u32(v)),
      this.u32(width << 16), this.u32(height << 16));
    const trak = this.box('trak', tkhd, mdia);

    const mvhd = this.fullBox('mvhd', 0, 0, this.u32(0), this.u32(0), this.u32(timescale), this.u32(duration),
      this.u32(0x00010000), this.u16(0x0100), this.u16(0), this.u32(0), this.u32(0),
      ...unity.map((v) => this.u32(v)), new Uint8Array(24), this.u32(2));
    const moov = this.box('moov', mvhd, trak);

    return new Blob([ftyp, mdat, moov], { type: 'video/mp4' });
  },
};
