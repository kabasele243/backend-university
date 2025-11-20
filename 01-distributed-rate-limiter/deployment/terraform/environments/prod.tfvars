# =============================================================================
# Production Environment Configuration
# =============================================================================

environment = "prod"
aws_region  = "us-east-1"

# From shared infrastructure (platform team provides these)
vpc_id                = "vpc-xxxxxxxxx"
private_subnet_ids    = ["subnet-xxxxxxxx", "subnet-yyyyyyyy"]
ecs_cluster_arn       = "arn:aws:ecs:us-east-1:ACCOUNT_ID:cluster/shared-cluster"
ecs_cluster_name      = "shared-cluster"
alb_listener_arn      = "arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:listener/app/shared-alb/xxx/yyy"
alb_security_group_id = "sg-xxxxxxxxx"
redis_endpoint        = "shared-redis.xxxxxx.use1.cache.amazonaws.com"

# Service configuration
cpu           = 512
memory        = 1024
desired_count = 3
min_capacity  = 2
max_capacity  = 20

# Routing
host_header = "api.example.com"
path_pattern = "/rate-limit/*"
priority     = 100

tags = {
  Team        = "platform"
  CostCenter  = "engineering"
}
