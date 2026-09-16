// Minimal WebSocket server (RFC 6455), so the game needs no npm packages.
// Text frames, ping/pong and close are all a browser game uses.

const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 64 * 1024;

class Socket extends EventEmitter {
  constructor(sock) {
    super();
    this.sock = sock;
    this.open = true;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.lastSeen = Date.now();
    sock.setNoDelay(true);
    sock.on('data', (d) => this._data(d));
    sock.on('close', () => this._closed());
    sock.on('error', () => this._closed());
  }

  send(text) {
    if (!this.open) return;
    const payload = Buffer.from(text);
    const n = payload.length;
    let head;
    if (n < 126) { head = Buffer.alloc(2); head[1] = n; }
    else if (n < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(n, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    head[0] = 0x81; // FIN + text
    try { this.sock.write(Buffer.concat([head, payload])); } catch (e) { this._closed(); }
  }

  // how much is still waiting to go out; a slow client shouldn't pile up snapshots
  get backlog() { return this.sock.writableLength || 0; }

  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(4); b[0] = 0x88; b[1] = 2; b.writeUInt16BE(code, 2);
    try { this.sock.write(b); this.sock.end(); } catch (e) { /* gone */ }
    this._closed();
  }

  _closed() {
    if (!this.open) return;
    this.open = false;
    try { this.sock.destroy(); } catch (e) { /* gone */ }
    this.emit('close');
  }

  _data(chunk) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MESSAGE) { this.close(1009); return; }
      if (!masked) { this.close(1002); return; } // clients must mask
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);

      if (op === 0x8) { this.close(); return; }
      if (op === 0x9) { // ping -> pong
        const h = Buffer.from([0x8a, data.length]);
        try { this.sock.write(Buffer.concat([h, data])); } catch (e) { /* gone */ }
        continue;
      }
      if (op === 0xa) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.parts.push(data);
        const total = this.parts.reduce((a, p) => a + p.length, 0);
        if (total > MAX_MESSAGE) { this.close(1009); return; }
        if (!fin) continue;
        const text = Buffer.concat(this.parts).toString('utf8');
        this.parts = [];
        let msg;
        try { msg = JSON.parse(text); } catch (e) { continue; }
        if (msg && typeof msg === 'object' && !Array.isArray(msg)) this.emit('message', msg);
      }
    }
  }
}

// Hook onto an http server; onConnect(socket, request) for every upgrade to `pathname`.
function attach(server, pathname, onConnect) {
  server.on('upgrade', (req, sock) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { sock.destroy(); return; }
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== pathname || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
      sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    onConnect(new Socket(sock), req, url);
  });
}

module.exports = { attach };
