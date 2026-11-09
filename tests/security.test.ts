import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/lib/rate-limit";
import { maskPhone, redact } from "../src/lib/log";

test("rate limiter allows up to the limit, then asks to wait until the window ends", () => {
  const r = new RateLimiter(3, 60_000);
  assert.equal(r.hit("a", 0), 0);
  assert.equal(r.hit("a", 1000), 0);
  assert.equal(r.hit("a", 2000), 0);
  assert.equal(r.hit("a", 3000), 57);
  assert.equal(r.hit("b", 3000), 0, "other addresses are counted separately");
  assert.equal(r.hit("a", 60_000), 0, "a new window starts fresh");
});

test("rate limiter does not grow without limit under a flood of addresses", () => {
  const r = new RateLimiter(1, 60_000, 100);
  for (let i = 0; i < 1000; i++) r.hit(`ip${i}`, 0);
  assert.ok((r as unknown as { hits: Map<string, unknown> }).hits.size <= 100);
});

test("logs hide secrets and mask phone numbers", () => {
  const out = redact({ data: { name: "Asha", phone: "9876543210", passwordHash: "$2b$xyz", nested: { sessionToken: "t" } } });
  assert.deepEqual(out, { data: { name: "Asha", phone: "******3210", passwordHash: "[hidden]", nested: { sessionToken: "[hidden]" } } });
  assert.equal(maskPhone("9000000001"), "******0001");
});
