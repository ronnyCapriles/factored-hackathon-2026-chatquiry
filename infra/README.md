# Infrastructure

Terraform for the production stack on AWS. One root per stack, each with its own state, so a change to one piece never plans the others.

```
infra/
  backend.hcl            state bucket shared by every root
  modules/v1/<module>/   reusable building blocks, versioned by folder
  prod/<stack>/          what is deployed: a root per stack, values in terraform.tfvars
```

Roots read each other's outputs through `terraform_remote_state` when they need them. Secrets never go in `terraform.tfvars`; they live in SSM Parameter Store.

## Stacks

| Stack | What | Outputs used by |
|---|---|---|
| `prod/guardrail` | Bedrock guardrail (Standard tier) and its published version | the API: `CQ_GUARDRAIL_ID`, `CQ_GUARDRAIL_VERSION` |

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
cd infra/prod/guardrail
terraform init -backend-config=../../backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

Then copy the outputs into the root `.env` for the local stack (`GUARDRAIL_ID`, `GUARDRAIL_VERSION`).
