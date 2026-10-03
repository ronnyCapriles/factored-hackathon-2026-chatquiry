data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
}

locals {
  account = data.aws_caller_identity.current.account_id
  region  = data.aws_region.current.region
}

# Caddy terminates TLS on the box; there is no SSH, Session Manager is the way in.
resource "aws_security_group" "this" {
  name        = var.name
  description = "HTTP and HTTPS to Caddy"
  vpc_id      = data.aws_vpc.default.id
  tags        = var.tags
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each          = toset(["80", "443"])
  security_group_id = aws_security_group.this.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
}

# Outbound HTTPS reaches Bedrock, TypeSafe, Secrets Manager, Let's Encrypt and the image registries.
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.name}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_iam_role" "this" {
  name = var.name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "app" {
  name = "${var.name}-app"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Cross-region inference profiles route to foundation models in other regions, so those ARNs are regionless.
        Effect = "Allow"
        Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:${local.account}:inference-profile/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "bedrock:ApplyGuardrail"
        Resource = [var.guardrail_arn, "arn:aws:bedrock:*:${local.account}:guardrail-profile/*"]
      },
      {
        # Account-wide by definition; it cannot be scoped to a repository.
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
        Resource = aws_ecr_repository.api.arn
      },
      {
        # Rendered into the compose .env at deploy time; never in user data, which IMDS exposes.
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "arn:aws:secretsmanager:${local.region}:${local.account}:secret:${var.secret_prefix}/*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "this" {
  name = var.name
  role = aws_iam_role.this.name
  tags = var.tags
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.this.id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  # t4g defaults to unlimited, which silently bills for CPU bursts.
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
    # Containers sit one network hop further; with the default of 1 boto3 inside them gets no credentials.
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_size_gb
    encrypted   = true
  }

  user_data                   = file("${path.module}/user-data.sh")
  user_data_replace_on_change = false

  tags = merge(var.tags, { Name = var.name })

  lifecycle {
    # A newer AMI must not replace the box and its database volume on the next apply.
    ignore_changes = [ami]
  }
}

# A fixed address for the DNS record and for Let's Encrypt.
resource "aws_eip" "this" {
  instance = aws_instance.this.id
  domain   = "vpc"
  tags     = merge(var.tags, { Name = var.name })
}
