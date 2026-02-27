#!/usr/bin/env bash

set -euo pipefail

workspace_dir="${CORTEX_WORKSPACE_DIR:-${WORKSPACE_FOLDER:-${PWD}}}"

cat > /usr/local/bin/cortex <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${workspace_dir}"
exec bun run packages/cli/src/run.ts "\$@"
EOF

cat > /usr/local/bin/cortex-mcp <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${workspace_dir}"
exec bun run packages/server/src/index.ts "\$@"
EOF

chmod +x /usr/local/bin/cortex /usr/local/bin/cortex-mcp