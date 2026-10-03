# Infrastructure

Terraform for the production stack on AWS. One root per stack, each with its own state, so a change to one piece never plans the others.

```
infra/
  backend.hcl            state bucket shared by every root
  modules/v1/<module>/   reusable building blocks, versioned by folder
  prod/<stack>/          what is deployed: a root per stack, values in terraform.tfvars
```

Roots read each other's outputs through `terraform_remote_state`. Secrets never go in `terraform.tfvars` or the state: Terraform creates empty Secrets Manager entries and their values are set with the CLI.

## Stacks

Apply them in this order.

| Stack | What | Used by |
|---|---|---|
| `prod/guardrail` | Bedrock guardrail (Standard tier) and its published version | the API: `CQ_GUARDRAIL_ID`, `CQ_GUARDRAIL_VERSION` |
| `prod/app` | EC2 `t4g.small` (arm64) with an Elastic IP, its security group (80 and 443 in), an instance role, the ECR repository for the API image, four empty secrets and a monthly budget alarm | `deploy/deploy.sh` on the host |

## How production runs

```
Browser ─► Amplify (Next.js, server side) ─HTTPS─► Caddy ─► API (FastAPI) ─► Postgres + pgvector
                                                      └─ one EC2 host, deploy/compose.prod.yaml
```

- The host runs `deploy/compose.prod.yaml`: Caddy gets a Let's Encrypt certificate for `API_DOMAIN`, the API runs the image from ECR, and Postgres keeps its data in a Docker volume, listening on loopback only.
- There is no SSH and no key pair. Session Manager is the way in, and also the port forward used to load the serving data.
- The instance role may invoke Bedrock models, apply the guardrail, pull from the ECR repository and read the secrets under `chatquiry/prod/`. Instance metadata requires IMDSv2 with a hop limit of 2, so boto3 inside the container gets credentials.
- Outbound HTTPS reaches Bedrock, TypeSafe (`api.typesafe.ai`), Secrets Manager, ECR and Let's Encrypt.
- The frontend is an Amplify app connected to this repository; `amplify.yml` builds `frontend/` and passes `CHATQUIRY_API_MODE`, `CHATQUIRY_API_URL` and `SESSION_SECRET` to the server runtime.

| Secret | Reaches the API as |
|---|---|
| `chatquiry/prod/postgres-password` | `POSTGRES_PASSWORD`, and inside `CQ_DATABASE_URL` |
| `chatquiry/prod/jwt-secret` | `CQ_JWT_SECRET` |
| `chatquiry/prod/seed-password` | `CQ_SEED_PASSWORD`, the password of the seeded staff |
| `chatquiry/prod/typesafe-api-key` | `CQ_TYPESAFE_API_KEY` |

## First time

The state bucket is created once by hand, with versioning and public access blocked:

```
aws s3api create-bucket --bucket ronnycapriles-chatquiry-tfstate --region us-east-1
aws s3api put-bucket-versioning --bucket ronnycapriles-chatquiry-tfstate --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket ronnycapriles-chatquiry-tfstate \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## Applying a stack

```
cd infra/prod/<stack>
terraform init -backend-config=../../backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

`prod/app` also needs the address for budget alerts: `export TF_VAR_budget_email=you@example.com` before planning.

## Deploying a release

```
# From a workstation: build the API for arm64 and push it.
aws ecr get-login-password | docker login --username AWS --password-stdin <registry>
docker buildx build --platform linux/arm64 --target prod -t <repository_url>:<tag> --push backend

# On the host (Session Manager, then sudo -i), from the repository checkout in /opt/chatquiry:
git pull
API_DOMAIN=<api host name> API_IMAGE=<repository_url>:<tag> \
GUARDRAIL_ID=<id> GUARDRAIL_VERSION=<version> ./deploy/deploy.sh
```

The API migrates and seeds on start. The serving data is loaded once from a workstation with `cq-pipeline load` through a Session Manager port forward to the host's port 5432.
