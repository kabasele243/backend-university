--[[
  Token Bucket Rate Limiter - Atomic Lua Script

  This script runs atomically on Redis, preventing race conditions
  when multiple servers try to consume tokens simultaneously.

  Algorithm:
  1. Get current bucket state (tokens, last refill time)
  2. Calculate tokens to add based on time elapsed
  3. Try to consume requested tokens
  4. Return result with remaining tokens and reset time

  KEYS[1] = bucket key
  ARGV[1] = tokens requested (cost)
  ARGV[2] = bucket capacity (max tokens)
  ARGV[3] = refill rate (tokens per second)
  ARGV[4] = current timestamp (milliseconds)
  ARGV[5] = TTL for the key (seconds)

  Returns: [allowed (0/1), remaining tokens, reset timestamp (ms)]
]]

local key = KEYS[1]
local cost = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

-- Get current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- Initialize if bucket doesn't exist
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- Calculate tokens to add based on elapsed time
local elapsed_ms = now - last_refill
local elapsed_seconds = elapsed_ms / 1000
local tokens_to_add = elapsed_seconds * refill_rate

-- Add tokens but don't exceed capacity
tokens = math.min(capacity, tokens + tokens_to_add)

-- Calculate reset time (when bucket will be full again)
local tokens_needed = capacity - tokens
local ms_to_full = 0
if tokens_needed > 0 and refill_rate > 0 then
  ms_to_full = (tokens_needed / refill_rate) * 1000
end
local reset_at = now + ms_to_full

-- Try to consume tokens
local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

-- Save state
redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

-- Return: [allowed, remaining, reset_at]
return {allowed, math.floor(tokens), math.floor(reset_at)}
