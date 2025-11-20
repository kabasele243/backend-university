# =============================================================================
# Staging Environment Configuration
# =============================================================================

environment = "staging"
aws_region  = "us-east-1"

# From shared infrastructure (platform team provides these)
vpc_id                = "vpc-xxxxxxxxx"
private_subnet_ids    = ["subnet-xxxxxxxx", "subnet-yyyyyyyy"]
ecs_cluster_arn       = "arn:aws:ecs:us-east-1:ACCOUNT_ID:cluster/staging-cluster"
ecs_cluster_name      = "staging-cluster"
alb_listener_arn      = "arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:listener/app/staging-alb/xxx/yyy"
alb_security_group_id = "sg-xxxxxxxxx"
redis_endpoint        = "staging-redis.xxxxxx.use1.cache.amazonaws.com"

# Service configuration (smaller for staging)
cpu           = 256
memory        = 512
desired_count = 1
min_capacity  = 1
max_capacity  = 3

# Routing
host_header  = "api.staging.example.com"
path_pattern = "/rate-limit/*"
priority     = 100

tags = {
  Team        = "platform"
  CostCenter  = "engineering"
}
