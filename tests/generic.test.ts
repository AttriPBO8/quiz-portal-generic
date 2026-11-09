// Sign-in names, media checks, user rows and time zones. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskEmail, parseLoginId } from "../src/lib/contact";
import { cleanMediaName, detectMedia } from "../src/lib/media-storage";
import { fromLocalInput, toLocalInput, zoneOffsetMinutes } from "../src/lib/constants";
import { redact } from "../src/lib/log";
import { readFileSync } from "node:fs";

test("sign-in box accepts an email or a phone number and nothing else", () => {
  assert.deepEqual(parseLoginId("  Asha.K@Example.COM "), { email: "asha.k@example.com" });
  assert.deepEqual(parseLoginId("+1 (416) 555-0101"), { phone: "14165550101" });
  assert.deepEqual(parseLoginId("4165550101"), { phone: "4165550101" });
  assert.equal(parseLoginId("asha@"), null);
  assert.equal(parseLoginId("abc123"), null, "letters without @ are not a phone number");
  assert.equal(parseLoginId("12345"), null, "too short for a phone number");
  assert.equal(parseLoginId(""), null);
});

test("logs mask emails as well as phone numbers", () => {
  assert.equal(maskEmail("asha.k@example.com"), "as***@example.com");
  assert.deepEqual(redact({ email: "asha.k@example.com", phone: "4165550101" }), { email: "as***@example.com", phone: "******0101" });
});

test("media files are recognised by their content, not their name", () => {
  const expect = { "bar-chart.png": "image/png", "three-beeps.mp3": "audio/mpeg", "moving-square.mp4": "video/mp4" } as const;
  for (const [file, mime] of Object.entries(expect)) {
    assert.equal(detectMedia(new Uint8Array(readFileSync(`data/sample-media/${file}`)))?.mimeType, mime, file);
  }
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(detectMedia(svg), null, "SVG and HTML are refused");
  assert.equal(detectMedia(new TextEncoder().encode("<html><body>hello</body></html>")), null);
});

test("uploaded file names are made safe", () => {
  assert.equal(cleanMediaName("../../My Chart (final).PNG", "png"), "my-chart-final.png");
  assert.equal(cleanMediaName("evil.html", "jpg"), "evil.jpg", "the real type decides the extension");
});

test("dates entered in Toronto time are stored correctly, summer and winter", () => {
  const tz = "America/Toronto";
  assert.equal(zoneOffsetMinutes(new Date("2026-07-01T12:00:00Z"), tz), -240);
  assert.equal(zoneOffsetMinutes(new Date("2026-12-01T12:00:00Z"), tz), -300);
  assert.equal(fromLocalInput("2026-07-01T09:00", tz)?.toISOString(), "2026-07-01T13:00:00.000Z");
  assert.equal(fromLocalInput("2026-12-01T09:00", tz)?.toISOString(), "2026-12-01T14:00:00.000Z");
  assert.equal(toLocalInput(new Date("2026-12-01T14:00:00Z"), tz), "2026-12-01T09:00");
  assert.equal(fromLocalInput("2026-11-15T10:30", "Asia/Kolkata")?.toISOString(), "2026-11-15T05:00:00.000Z");
  assert.equal(fromLocalInput("not a date", tz), null);
});

test("a phone number works with or without the usual country code", async () => {
  const { phoneCandidates } = await import("../src/lib/contact");
  assert.deepEqual(phoneCandidates("14165550101", "1"), ["14165550101", "4165550101"]);
  assert.deepEqual(phoneCandidates("4165550101", "1"), ["4165550101", "14165550101"]);
  assert.deepEqual(phoneCandidates("919876543210", "91"), ["919876543210", "9876543210"]);
  assert.deepEqual(phoneCandidates("4165550101", ""), ["4165550101"]);
});
