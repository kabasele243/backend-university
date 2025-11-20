terraform {
  required_version = ">= 1.6.0"

  cloud {
    organization = "backend-university"

    workspaces {
      name = "backend-university-prod"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "backend-university"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
