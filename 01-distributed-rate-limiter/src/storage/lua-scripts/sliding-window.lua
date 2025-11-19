--[[
  Sliding Window Rate Limiter - Atomic Lua Script

  Uses Redis Sorted Sets to track requests within a time window.
  Each request is stored with timestamp as score.

  Algorithm:
  1. Remove expired entries (older than window)
  2. Count current requests in window
  3. If under limit, add new request
  4. Return result

  KEYS[1] = window key
  ARGV[1] = window size (seconds)
  ARGV[2] = max requests allowed
  ARGV[3] = current timestamp (milliseconds)
  ARGV[4] = unique request ID
  ARGV[5] = TTL for the key (seconds)

  Returns: [allowed (0/1), current count, oldest entry timestamp (ms)]
]]

local key = KEYS[1]
local window_size_ms = tonumber(ARGV[1]) * 1000
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]
local ttl = tonumber(ARGV[5])

-- Calculate window boundaries
local window_start = now - window_size_ms

-- Remove entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

-- Count current requests in window
local current_count = redis.call('ZCARD', key)

-- Get the oldest entry for reset time calculation
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_timestamp = now
if oldest[2] then
  oldest_timestamp = tonumber(oldest[2])
end

-- Calculate when the oldest entry will expire (reset time)
local reset_at = oldest_timestamp + window_size_ms

-- Check if we can add a new request
local allowed = 0
if current_count < max_requests then
  -- Add the new request with current timestamp as score
  redis.call('ZADD', key, now, request_id)
  current_count = current_count + 1
  allowed = 1
end

-- Set TTL on the key
redis.call('EXPIRE', key, ttl)

-- Return: [allowed, remaining, reset_at]
local remaining = max_requests - current_count
return {allowed, remaining, math.floor(reset_at)}
