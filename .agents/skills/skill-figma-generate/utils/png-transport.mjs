/**
 * png-transport — move a large payload into a Figma file without typing it.
 *
 * `use_figma` caps its `code` argument at 50 000 characters, and the agent has to
 * author every one of those characters by hand. That is fine for a script and
 * hopeless for a multi-megabyte generation plan: the transcription itself becomes
 * the unreliable step.
 *
 * `upload_assets` is a byte channel that bypasses it. Encode the payload as the
 * PIXEL DATA of an 8-bit grayscale PNG, POST the file with curl, and read it back
 * inside the plugin with `figma.getImageByHash(hash).getBytesAsync()`. Figma stores
 * the PNG verbatim — same byte length, same bytes — so the round trip is lossless.
 *
 * The IDAT stream uses STORED (uncompressed) deflate blocks on purpose. A real
 * inflater inside `use_figma` would be ~2 kB of hand-written Huffman decoding; a
 * stored-block reader is ~15 lines. The PNG is then roughly the size of the payload,
 * which costs nothing because curl does the upload. Cap is 10 MB per asset.
 *
 *   node png-transport.mjs plan.json plan.png [width]
 *
 * Then, in order:
 *   1. upload_assets { count: 1, currentPageId: <a scratch page> } -> submitUrl
 *   2. curl -sS -X POST "<submitUrl>" -F "file=@plan.png;type=image/png"
 *        -> { imageHash, sizeBytes }   (assert sizeBytes === the local file size)
 *   3. use_figma: inline DECODER_SOURCE, decode, assert djb2, render
 *   4. DELETE the frame the upload placed, and say so — see the caveat below.
 *
 * CAVEAT: each upload places a frame with the image as its fill on `currentPageId`,
 * or on the first page when that is omitted. It is a real canvas mutation on a page
 * you may have promised not to touch. Pass `currentPageId`, remove the node when the
 * render is done, and verify the page is back to its original children.
 */

import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

let TABLE = null;

function crcTable() {
	if (TABLE) return TABLE;
	TABLE = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		TABLE[n] = c;
	}
	return TABLE;
}

function crc32(buf) {
	const t = crcTable();
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typed));
	return Buffer.concat([len, typed, crc]);
}

/** djb2, matching the decoder's integrity check byte-for-byte. */
export function djb2(bytes) {
	let h = 5381;
	for (let i = 0; i < bytes.length; i++) h = (h * 33) ^ bytes[i];
	return (h >>> 0).toString(16);
}

/**
 * Encode arbitrary bytes as an 8-bit grayscale PNG whose pixels ARE the payload.
 * The final row is zero-padded; the decoder trims using the known payload length.
 */
export function encode(payload, width = 2048) {
	const height = Math.ceil(payload.length / width);
	const stride = 1 + width; // one filter byte per scanline
	const raw = Buffer.alloc(height * stride);
	for (let y = 0; y < height; y++) {
		raw[y * stride] = 0; // filter type 0 (None) — keeps pixels == payload
		payload.copy(
			raw,
			y * stride + 1,
			y * width,
			Math.min((y + 1) * width, payload.length),
		);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 0; // color type 0 = grayscale, 1 byte per pixel
	// [10] compression, [11] filter, [12] interlace all stay 0

	const png = Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 0 })), // level 0 => stored blocks
		chunk("IEND", Buffer.alloc(0)),
	]);

	return { png, width, height, payloadLen: payload.length, djb2: djb2(payload) };
}

/**
 * The in-plugin half. Inline this verbatim into the `use_figma` script, then:
 *
 *   const bytes = pngPayload(
 *     await figma.getImageByHash(HASH).getBytesAsync(), PAYLOAD_LEN);
 *   if (djb2(bytes) !== EXPECTED) throw new Error("payload hash mismatch");
 *   const text = toStr(bytes, false);   // true => decode as UTF-8
 *
 * Always assert the hash before you act on the payload. It is the only thing
 * standing between a silently truncated read and a half-generated page.
 */
export const DECODER_SOURCE = `
function pngPayload(b, payloadLen) {
  const u32 = (o) => ((b[o] << 24) | (b[o+1] << 16) | (b[o+2] << 8) | b[o+3]) >>> 0;
  let p = 8, width = 0, height = 0;
  const idats = [];
  while (p < b.length) {
    const len = u32(p);
    const t = String.fromCharCode(b[p+4], b[p+5], b[p+6], b[p+7]);
    if (t === "IHDR") { width = u32(p + 8); height = u32(p + 12); }
    else if (t === "IDAT") idats.push([p + 8, len]);
    p += 12 + len;
  }
  let total = 0;
  for (const [, l] of idats) total += l;
  const z = new Uint8Array(total);
  let zp = 0;
  for (const [at, l] of idats) { z.set(b.subarray(at, at + l), zp); zp += l; }
  const raw = new Uint8Array(height * (1 + width));
  let rp = 0, q = 2; // skip the 2-byte zlib header
  for (;;) {
    const hdr = z[q]; q += 1;
    if (((hdr >> 1) & 3) !== 0) throw new Error("non-stored deflate block");
    const len = z[q] | (z[q+1] << 8);
    q += 4; // LEN + NLEN
    raw.set(z.subarray(q, q + len), rp);
    rp += len; q += len;
    if (hdr & 1) break; // BFINAL
  }
  const out = new Uint8Array(payloadLen);
  let produced = 0;
  for (let y = 0; y < height && produced < payloadLen; y++) {
    const take = Math.min(width, payloadLen - produced);
    out.set(raw.subarray(y * (1 + width) + 1, y * (1 + width) + 1 + take), produced);
    produced += take;
  }
  return out;
}
function toStr(bytes, utf8) {
  const parts = [];
  let i = 0;
  while (i < bytes.length) {
    const codes = [];
    const stop = Math.min(i + 8192, bytes.length); // chunked: fromCharCode blows the stack
    while (i < stop) {
      const c = bytes[i];
      if (!utf8 || c < 0x80) { codes.push(c); i += 1; }
      else if (c < 0xe0) { codes.push(((c & 0x1f) << 6) | (bytes[i+1] & 0x3f)); i += 2; }
      else if (c < 0xf0) { codes.push(((c & 0x0f) << 12) | ((bytes[i+1] & 0x3f) << 6) | (bytes[i+2] & 0x3f)); i += 3; }
      else {
        const cp = (((c & 0x07) << 18) | ((bytes[i+1] & 0x3f) << 12) | ((bytes[i+2] & 0x3f) << 6) | (bytes[i+3] & 0x3f)) - 0x10000;
        codes.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); i += 4;
      }
    }
    parts.push(String.fromCharCode.apply(null, codes));
  }
  return parts.join("");
}
function djb2(bytes) {
  let h = 5381;
  for (let i = 0; i < bytes.length; i++) h = (h * 33) ^ bytes[i];
  return (h >>> 0).toString(16);
}
`;

if (import.meta.url === `file://${process.argv[1]}`) {
	const [, , inFile, outFile, width] = process.argv;
	if (!inFile || !outFile) {
		console.error("usage: node png-transport.mjs <in> <out.png> [width]");
		process.exit(1);
	}
	const result = encode(readFileSync(inFile), Number(width) || 2048);
	writeFileSync(outFile, result.png);
	console.log(
		JSON.stringify({
			payloadLen: result.payloadLen,
			djb2: result.djb2,
			width: result.width,
			height: result.height,
			pngBytes: result.png.length,
		}),
	);
}
