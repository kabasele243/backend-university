# Distributed Rate Limiter - Implementation Plan

## Overview
Build a production-grade distributed rate limiter that works across multiple API server instances using Redis for shared state.

---

## Week 1: Core Implementation

### Day 1-2: Project Setup & Token Bucket Algorithm
**Goals:**
- Set up Node.js + TypeScript project structure
- Implement basic token bucket algorithm (in-memory first)
- Write unit tests for token bucket logic

**Tasks:**
- [ ] Initialize npm project with TypeScript
- [ ] Set up ESLint, Prettier, Jest
- [ ] Create basic Express server
- [ ] Implement Token Bucket class
  - `addTokens()` - refill tokens over time
  - `consumeTokens(n)` - attempt to consume tokens
  - `getAvailableTokens()` - check current tokens
- [ ] Write comprehensive unit tests
- [ ] Document token bucket algorithm in code comments

**Learning Focus:**
- Token bucket algorithm mechanics
- Refill rate vs burst capacity
- Time-based token generation

**Deliverable:** Working in-memory token bucket with tests

---

### Day 3-4: Redis Integration
**Goals:**
- Move token bucket state to Redis
- Handle race conditions with Redis atomic operations
- Implement Redis connection pooling

**Tasks:**
- [ ] Set up Redis with Docker Compose
- [ ] Install ioredis client
- [ ] Implement Redis-backed token bucket
  - Use Redis Hash to store: `tokens`, `lastRefill`, `capacity`, `refillRate`
  - Use Lua scripts for atomic operations
- [ ] Write Lua script for token consumption (atomic check + decrement)
- [ ] Handle Redis connection failures gracefully
- [ ] Add retry logic for Redis operations
- [ ] Write integration tests with Redis

**Learning Focus:**
- Redis data structures (Hash, String)
- Lua scripting for atomicity
- Race conditions in distributed systems
- Connection pooling best practices

**Deliverable:** Distributed token bucket using Redis

**Key Lua Script Pattern:**
```lua
-- token-bucket-consume.lua
local key = KEYS[1]
local tokens_requested = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Get current state or initialize
local current = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(current[1]) or capacity
local last_refill = tonumber(current[2]) or now

-- Calculate refill
local time_passed = now - last_refill
local tokens_to_add = time_passed * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

-- Try to consume
if tokens >= tokens_requested then
    tokens = tokens - tokens_requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600) -- 1 hour TTL
    return 1 -- success
else
    return 0 -- rate limited
end
```

---

### Day 5-6: Sliding Window Algorithm
**Goals:**
- Implement sliding window rate limiter
- Compare with token bucket
- Add configuration for both algorithms

**Tasks:**
- [ ] Implement sliding window counter using Redis Sorted Sets
  - Use timestamp as score
  - Use ZREMRANGEBYSCORE to remove old entries
  - Use ZCARD to count requests in window
- [ ] Write Lua script for atomic sliding window check
- [ ] Add algorithm selection (token bucket vs sliding window)
- [ ] Benchmark both algorithms
- [ ] Document trade-offs in README

**Learning Focus:**
- Sliding window vs token bucket trade-offs
- Redis Sorted Sets (ZADD, ZREMRANGEBYSCORE, ZCARD)
- Memory efficiency considerations

**Deliverable:** Two rate limiting algorithms to choose from

**Sliding Window Lua Script:**
```lua
-- sliding-window-check.lua
local key = KEYS[1]
local window_size = tonumber(ARGV[1]) -- in seconds
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]

local window_start = now - window_size

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

-- Count requests in current window
local current_count = redis.call('ZCARD', key)

if current_count < max_requests then
    redis.call('ZADD', key, now, request_id)
    redis.call('EXPIRE', key, window_size + 10)
    return 1 -- allowed
else
    return 0 -- rate limited
end
```

---

### Day 7: Express Middleware & API
**Goals:**
- Create Express middleware for rate limiting
- Build demo API endpoints
- Add rate limit headers

**Tasks:**
- [ ] Create `rateLimiter` middleware
  - Extract identifier (IP, user ID, API key)
  - Apply rate limit
  - Return 429 Too Many Requests when limited
- [ ] Add rate limit headers to responses:
  - `X-RateLimit-Limit`: max requests
  - `X-RateLimit-Remaining`: remaining requests
  - `X-RateLimit-Reset`: timestamp when limit resets
- [ ] Create demo endpoints
  - `GET /api/public` - low rate limit (10/min)
  - `GET /api/premium` - high rate limit (100/min)
  - `POST /api/data` - different limit for writes
- [ ] Add configuration options:
  - Rate limit by IP
  - Rate limit by user ID
  - Rate limit by API key
  - Custom limits per endpoint

**Learning Focus:**
- Express middleware patterns
- HTTP 429 status code
- Rate limit response headers (IETF draft standard)

**Deliverable:** Working rate-limited API

---

## Week 2: Production Features & Testing

### Day 8-9: Multi-Instance Testing
**Goals:**
- Test rate limiter across multiple server instances
- Verify distributed state consistency
- Load test the system

**Tasks:**
- [ ] Create Docker Compose with 3+ Express instances
- [ ] Set up nginx load balancer
- [ ] Write load tests with k6 or Artillery
  - Test: Single user hitting multiple instances
  - Test: 1000 concurrent users
  - Test: Burst traffic patterns
- [ ] Verify rate limits work across all instances
- [ ] Measure latency overhead of rate limiting
- [ ] Document performance benchmarks

**Learning Focus:**
- Load balancing with nginx
- Testing distributed systems
- Performance measurement

**Target Metrics:**
- Rate limiter overhead: <5ms p95
- Support 10K req/s across 3 instances
- 100% accuracy in rate limit enforcement

**k6 Load Test Example:**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  let res = http.get('http://localhost/api/public');

  check(res, {
    'status is 200 or 429': (r) => [200, 429].includes(r.status),
    'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  sleep(0.1);
}
```

---

### Day 10: Advanced Features
**Goals:**
- Add advanced rate limiting strategies
- Implement tiered rate limits
- Add allowlist/blocklist

**Tasks:**
- [ ] Implement tiered rate limits (free, pro, enterprise)
- [ ] Add allowlist for IPs (bypass rate limiting)
- [ ] Add blocklist for IPs (always reject)
- [ ] Implement dynamic rate limit adjustment
- [ ] Add burst handling (allow brief spikes)
- [ ] Create admin API to manage limits
  - `POST /admin/limits` - set custom limit
  - `POST /admin/allowlist` - add to allowlist
  - `POST /admin/blocklist` - add to blocklist
  - `GET /admin/stats` - get rate limit stats

**Learning Focus:**
- Flexible rate limit strategies
- Admin APIs & security
- Configuration management

---

### Day 11: Observability & Monitoring
**Goals:**
- Add metrics collection
- Create dashboards
- Set up alerting

**Tasks:**
- [ ] Integrate Prometheus client
- [ ] Track metrics:
  - `rate_limit_requests_total` (counter, by endpoint)
  - `rate_limit_exceeded_total` (counter, by endpoint)
  - `rate_limit_latency_seconds` (histogram)
  - `redis_operations_total` (counter, by operation)
  - `redis_errors_total` (counter)
- [ ] Create Grafana dashboard
  - Request rate by endpoint
  - Rate limit hit rate
  - p50, p95, p99 latencies
  - Redis connection health
- [ ] Add structured logging (Winston or Pino)
- [ ] Log rate limit events

**Learning Focus:**
- Prometheus metrics patterns
- Grafana dashboards
- Structured logging

---

### Day 12: Error Handling & Resilience
**Goals:**
- Handle Redis failures gracefully
- Add fallback strategies
- Implement circuit breaker

**Tasks:**
- [ ] Implement fallback when Redis is down:
  - Option 1: Fail open (allow all requests)
  - Option 2: Fail closed (reject all requests)
  - Option 3: Use in-memory fallback (per instance)
- [ ] Add circuit breaker for Redis connections
- [ ] Implement health check endpoint (`GET /health`)
- [ ] Add graceful shutdown
- [ ] Test failure scenarios:
  - Redis connection timeout
  - Redis out of memory
  - Network partition
- [ ] Document failure modes and behaviors

**Learning Focus:**
- Failure modes in distributed systems
- Circuit breaker pattern
- Graceful degradation

---

### Day 13: Documentation & Code Quality
**Goals:**
- Write comprehensive documentation
- Refactor and clean code
- Add architectural diagrams

**Tasks:**
- [ ] Write detailed README with:
  - Architecture diagram
  - Algorithm explanations
  - Configuration guide
  - Deployment guide
  - Performance benchmarks
- [ ] Create ARCHITECTURE.md explaining:
  - System design decisions
  - Trade-offs between algorithms
  - Scalability considerations
  - CAP theorem implications
- [ ] Create DECISIONS.md documenting:
  - Why Redis over alternatives
  - Why Lua scripts for atomicity
  - Failure mode choices
- [ ] Refactor code for clarity
- [ ] Add JSDoc comments
- [ ] Achieve 90%+ test coverage

**Deliverable:** Production-ready documentation

---

### Day 14: Final Testing & Deployment
**Goals:**
- End-to-end testing
- Performance optimization
- Deploy to AWS

**Tasks:**
- [ ] Run full test suite
- [ ] Performance profiling with clinic.js
- [ ] Optimize hot paths
- [ ] Create deployment scripts
- [ ] Deploy to AWS:
  - ECS Fargate for Express instances (3+)
  - ElastiCache for Redis
  - ALB for load balancing
  - CloudWatch for monitoring
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Write deployment runbook
- [ ] Conduct load test on production setup

**Learning Focus:**
- AWS deployment patterns
- Production optimization
- CI/CD for Node.js

**Target Deployment:**
```
┌─────────────┐
│   Route53   │
└──────┬──────┘
       │
┌──────▼──────┐
│     ALB     │
└──────┬──────┘
       │
   ┌───┴────┬──────────┬──────────┐
   │        │          │          │
┌──▼──┐ ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
│ ECS │ │ ECS │   │ ECS │   │ ECS │
└──┬──┘ └──┬──┘   └──┬──┘   └──┬──┘
   │       │          │          │
   └───────┴──────────┴──────────┘
                  │
           ┌──────▼──────┐
           │ ElastiCache │
           │   (Redis)   │
           └─────────────┘
```

---

## Project Structure

```
01-distributed-rate-limiter/
├── src/
│   ├── algorithms/
│   │   ├── token-bucket.ts
│   │   └── sliding-window.ts
│   ├── middleware/
│   │   └── rate-limiter.ts
│   ├── redis/
│   │   ├── client.ts
│   │   └── lua-scripts/
│   │       ├── token-bucket-consume.lua
│   │       └── sliding-window-check.lua
│   ├── config/
│   │   └── rate-limits.ts
│   ├── metrics/
│   │   └── prometheus.ts
│   ├── admin/
│   │   └── routes.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── load/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── PERFORMANCE.md
├── deployment/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── nginx.conf
│   └── terraform/ (AWS infrastructure)
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Key Concepts to Master

### 1. Rate Limiting Algorithms

**Token Bucket:**
- Allows burst traffic up to bucket capacity
- Smooths out traffic over time
- Good for APIs with variable load

**Sliding Window:**
- More precise rate limiting
- No burst allowance
- Better for strict rate enforcement

### 2. Redis Atomicity

**Why Lua Scripts?**
- Execute atomically on Redis server
- No race conditions between read and write
- Better than Redis transactions for this use case

**Alternative Approaches:**
- Redis transactions (MULTI/EXEC) - harder to use correctly
- Optimistic locking (WATCH) - performance overhead with retries

### 3. CAP Theorem Implications

**Our Choice: AP (Availability + Partition Tolerance)**
- System stays available during network partitions
- May have temporary inconsistencies (over-limiting)
- Trade-off: Slightly inaccurate rate limiting beats downtime

**CP Alternative:**
- Would reject requests if can't guarantee consistency
- Not suitable for rate limiting (defeats the purpose)

### 4. Distributed Consensus

**Problem:** Multiple servers need to agree on rate limit state

**Our Solution:**
- Single source of truth (Redis)
- Atomic operations (Lua scripts)
- No consensus algorithm needed (Redis handles it)

---

## Interview Talking Points

### System Design
- "I chose Redis because it provides atomic operations via Lua scripts and sub-millisecond latency"
- "I implemented both token bucket and sliding window to understand the trade-offs firsthand"
- "The system scales horizontally - adding more app servers doesn't impact rate limiting accuracy"

### Performance
- "Rate limiting adds <5ms overhead at p95"
- "System handles 50K req/s across 10 instances"
- "Used Lua scripts to reduce Redis round trips from 3-4 to just 1"

### Reliability
- "Implemented graceful degradation - if Redis fails, system falls back to in-memory limiting per instance"
- "Added circuit breaker to prevent Redis connection storms"
- "Used Docker Compose for local testing and ECS for production"

### Trade-offs
- "Token bucket allows bursts which can be good or bad depending on use case"
- "Sliding window is more memory intensive but provides stricter guarantees"
- "Chose AP over CP in CAP theorem - availability is more important than perfect accuracy for rate limiting"

---

## Success Criteria

✅ **Functional:**
- Rate limiting works across multiple instances
- Both algorithms implemented and tested
- Graceful failure handling

✅ **Performance:**
- <5ms p95 latency overhead
- Handles 50K+ req/s
- Zero data loss during rate limit checks

✅ **Production-Ready:**
- Comprehensive tests (unit, integration, load)
- Metrics and monitoring
- Documentation and runbooks
- Deployed to AWS

✅ **Learning:**
- Can explain both algorithms in detail
- Can discuss CAP theorem trade-offs
- Can explain Redis atomicity approaches
- Ready to defend design decisions in interviews

---

## Common Pitfalls to Avoid

❌ **Race Conditions:**
- Don't separate read and write operations
- Always use Lua scripts for atomic operations

❌ **Memory Leaks:**
- Always set TTL on Redis keys
- Clean up old sliding window entries

❌ **Thundering Herd:**
- Don't let all instances reconnect to Redis simultaneously
- Implement exponential backoff with jitter

❌ **Clock Skew:**
- Use Redis server time, not application server time
- Use `TIME` command in Lua scripts

❌ **Testing Gaps:**
- Test multi-instance scenarios
- Test failure modes (Redis down, network partition)
- Test under load, not just functionally

---

## Resources

### Algorithms
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Leaky Bucket vs Token Bucket](https://www.youtube.com/watch?v=FU4WlIqRQr8)

### Redis
- [Redis Lua Scripting](https://redis.io/docs/manual/programmability/eval-intro/)
- [ioredis Documentation](https://github.com/redis/ioredis)

### Rate Limiting Patterns
- [Stripe Rate Limiting](https://stripe.com/blog/rate-limiters)
- [CloudFlare Rate Limiting](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)

### System Design
- [Designing a Rate Limiter](https://systemdesign.one/rate-limiting/)
- CAP Theorem explained

---

**Good luck! Update PROGRESS.md as you complete each day's tasks.**
