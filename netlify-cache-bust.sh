#!/usr/bin/env sh
# ★ Felipe 23/04: cache-bust automático a cada deploy.
# Atualiza TODOS os <script src="js/XX.js..."> para ter ?v=<hash-atual>
# Isso força o browser a baixar o JS novo sempre que tem commit.
#
# Roda no Netlify via netlify.toml build.command = "sh netlify-cache-bust.sh"

set -e

HASH="${COMMIT_REF:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"
HASH_SHORT=$(echo "$HASH" | cut -c1-7)

echo "📦 Cache-busting index.html com hash: $HASH_SHORT"

# Remove qualquer ?v=xxx existente e adiciona ?v=<hash> em TODOS os scripts js/
# Usa perl pra regex mais robusta que sed
perl -i -pe 's|<script src="js/([^"?]+)(\?v=[^"]*)?"|<script src="js/\1?v='"$HASH_SHORT"'"|g' index.html

COUNT=$(grep -c '?v=' index.html || echo 0)
echo "✅ $COUNT scripts com cache-busting aplicado"
