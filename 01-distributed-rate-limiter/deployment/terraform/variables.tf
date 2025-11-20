# =============================================================================
# Service-Level Variables
# These reference shared infrastructure created by the platform team
# =============================================================================

# -----------------------------------------------------------------------------
# Required - From Platform/Shared Infrastructure
# -----------------------------------------------------------------------------

variable "vpc_id" {
  description = "VPC ID from shared infrastructure"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_cluster_arn" {
  description = "ECS cluster ARN from shared infrastructure"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "alb_listener_arn" {
  description = "ALB listener ARN to attach target group"
  type        = string
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB"
  type        = string
}

variable "redis_endpoint" {
  description = "ElastiCache Redis endpoint from shared infrastructure"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_name" {
  description = "Name of this service"
  type        = string
  default     = "rate-limiter"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# ECS Task Configuration
# -----------------------------------------------------------------------------

variable "cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for the task in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 2
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "cpu_target_value" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = 70
}

# -----------------------------------------------------------------------------
# Routing
# -----------------------------------------------------------------------------

variable "host_header" {
  description = "Host header for ALB routing (e.g., api.example.com)"
  type        = string
  default     = ""
}

variable "path_pattern" {
  description = "Path pattern for ALB routing"
  type        = string
  default     = "/*"
}

variable "priority" {
  description = "ALB listener rule priority"
  type        = number
  default     = 100
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
