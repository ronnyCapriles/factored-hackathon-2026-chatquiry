# Passed to every root: terraform init -backend-config=../../backend.hcl
# The bucket is created by hand once; see README.md.
bucket = "ronnycapriles-chatquiry-tfstate"
region = "us-east-1"
