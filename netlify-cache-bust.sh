#!/usr/bin/env sh
# ★ Felipe 23/04: cache-bust automático a cada deploy.
# Atualiza TODOS os <script src="js/XX.js..."> para ter ?v=<hash-atual>
# e window.__PROJETTA_BUILD__ em js/01-shared.js para matching.
# Isso força o browser a baixar o JS novo sempre que tem commit.
#
# Roda no Netlify via netlify.toml build.command = "sh netlify-cache-bust.sh"

set -e

HASH="${COMMIT_REF:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"
HASH_SHORT=$(echo "$HASH" | cut -c1-7)
TS=$(date +%s)
VER="${HASH_SHORT}-${TS}"

echo "📦 Cache-busting com version: $VER"

# 1. Atualizar ?v= em todos os <script src="js/..."> do index.html
perl -i -pe 's|<script src="js/([^"?]+)(\?v=[^"]*)?"|<script src="js/\1?v='"$VER"'"|g' index.html

# 2. Atualizar window.__PROJETTA_BUILD__ em js/01-shared.js
perl -i -pe "s|window\.__PROJETTA_BUILD__\s*=\s*'[^']*';|window.__PROJETTA_BUILD__ = '$VER';|g" js/01-shared.js

COUNT=$(grep -c '?v=' index.html || echo 0)
echo "✅ $COUNT scripts com cache-busting, build=$VER"
