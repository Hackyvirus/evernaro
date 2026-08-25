import { describe, expect, it, vi, beforeEach } from "vitest";

// checkRateLimit runs INCR and EXPIRE as one multi() transaction (see
// src/lib/rate-limit.ts) so a key can never end up incremented without a
// TTL. The mock chains like ioredis's multi() and resolves exec() to an
// array of [err, result] tuples, one per queued command.
const { incrMock, expireMock, execMock, multiMock } = vi.hoisted(() => {
  const incrMock = vi.fn();
  const expireMock = vi.fn();
  const execMock = vi.fn();
  // incr/expire must return the chain object itself, like ioredis's multi().
  const chain = { incr: incrMock, expire: expireMock, exec: execMock };
  const multiMock = vi.fn(() => chain);
  return { incrMock, expireMock, execMock, multiMock };
});

vi.mock("@/lib/redis", () => ({
  redisConnection: {
    multi: multiMock,
  },
}));

import { clientIp } from "./rate-limit";

function mockPipelineResult(count: number) {
  execMock.mockResolvedValue([
    [null, count],
    [null, 1],
  ]);
}

function mockPipelineError(err: Error) {
  execMock.mockRejectedValue(err);
}

beforeEach(() => {
  incrMock.mockReset();
  expireMock.mockReset();
  execMock.mockReset();
  multiMock.mockClear();
  const chain = { incr: incrMock, expire: expireMock, exec: execMock };
  incrMock.mockReturnValue(chain);
  expireMock.mockReturnValue(chain);
  delete process.env.RATE_LIMIT_FAIL_CLOSED;
  vi.resetModules();
});

async function importCheckRateLimit() {
  const mod = await import("./rate-limit");
  return mod.checkRateLimit;
}

describe("checkRateLimit", () => {
  it("allows requests while under the limit", async () => {
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineResult(1);

    await expect(checkRateLimit("key", 5, 60)).resolves.toBe(true);
    expect(multiMock).toHaveBeenCalled();
    expect(incrMock).toHaveBeenCalledWith("ratelimit:key");
    expect(expireMock).toHaveBeenCalledWith("ratelimit:key", 60);
  });

  it("blocks requests at the limit", async () => {
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineResult(6);

    await expect(checkRateLimit("key", 5, 60)).resolves.toBe(false);
  });

  it("fails closed by default when Redis errors", async () => {
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineError(new Error("Redis down"));

    await expect(checkRateLimit("key", 5, 60)).resolves.toBe(false);
  });

  it("fails closed when RATE_LIMIT_FAIL_CLOSED is true and Redis errors", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineError(new Error("Redis down"));

    await expect(checkRateLimit("key", 5, 60)).resolves.toBe(false);
  });

  it("fails open when RATE_LIMIT_FAIL_CLOSED is false and Redis errors", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "false";
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineError(new Error("Redis down"));

    await expect(checkRateLimit("key", 5, 60)).resolves.toBe(true);
  });

  it("fails open when explicitly overridden even if env var is set", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineError(new Error("Redis down"));

    await expect(checkRateLimit("key", 5, 60, { failClosed: false })).resolves.toBe(true);
  });

  it("fails closed when explicitly requested", async () => {
    const checkRateLimit = await importCheckRateLimit();
    mockPipelineError(new Error("Redis down"));

    await expect(checkRateLimit("key", 5, 60, { failClosed: true })).resolves.toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for address", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.10.11.12" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "9.10.11.12" },
    });
    expect(clientIp(req)).toBe("9.10.11.12");
  });

  it("returns unknown when no proxy headers are present", () => {
    const req = new Request("https://example.com");
    expect(clientIp(req)).toBe("unknown");
  });
});
