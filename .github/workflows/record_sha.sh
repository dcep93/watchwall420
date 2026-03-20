#!/bin/bash

set -euo pipefail

cat > sha.json <<EOF
{
  "time": $(TZ='America/New_York' date | jq -Rs .),
  "git_log": $(git log -1 | jq -Rs .)
}
EOF

cp sha.json app/src/app_x/
rm sha.json
