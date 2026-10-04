# GitHub Actions on main of this repository deploy without stored keys: they push the API image,
# run deploy.sh on the host through Session Manager and start an Amplify build.
data "aws_caller_identity" "current" {}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_deploy" {
  name = "${local.name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # These actions cannot be scoped to a resource.
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken", "ec2:DescribeInstances", "ssm:GetCommandInvocation", "amplify:ListApps"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = module.app_host.repository_arn
      },
      {
        Effect   = "Allow"
        Action   = "ssm:SendCommand"
        Resource = [module.app_host.instance_arn, "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
      },
      {
        Effect   = "Allow"
        Action   = ["amplify:StartJob", "amplify:GetJob"]
        Resource = "arn:aws:amplify:${var.region}:${data.aws_caller_identity.current.account_id}:apps/*/branches/main/jobs/*"
      },
    ]
  })
}
