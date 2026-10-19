#!/usr/bin/env bash
# Mainsail Pi Monitor — installer
# Copyright (C) 2026 Giovanni Grosso — GPL-3.0-or-later (see LICENSE)
#
# Usage: ./install.sh [path to the Nginx site of Mainsail]   (default: /etc/nginx/sites-available/mainsail)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="${1:-/etc/nginx/sites-available/mainsail}"
DEST=/usr/local/share/mainsail-pi-monitor
BEGIN='# --- mainsail-pi-monitor (begin) ---'

[ -f "$SITE" ] || { echo "Nginx site not found: $SITE (pass the path as the first argument)"; exit 1; }

echo "1/3 copying pi-monitor.js to $DEST"
sudo install -d -m 755 "$DEST"
sudo install -m 644 "$HERE/pi-monitor.js" "$DEST/pi-monitor.js"

if sudo grep -qF "$BEGIN" "$SITE"; then
    echo "2/3 Nginx already configured ($SITE)"
else
    BACKUP="$SITE.bak-pi-monitor.$(date +%Y%m%d-%H%M%S)"
    echo "2/3 adding the snippet to $SITE (backup: $BACKUP)"
    sudo cp -p "$SITE" "$BACKUP"
    # insert the snippet (between the markers) right after the first "server {" line
    SNIPPET="$(sed -n "/$BEGIN/,/mainsail-pi-monitor (end)/p" "$HERE/nginx/pi-monitor.conf")"
    sudo awk -v snip="$SNIPPET" '!done && /^[[:space:]]*server[[:space:]]*\{/ {print; print snip; done=1; next} {print}' \
        "$BACKUP" | sudo tee "$SITE" >/dev/null
    if ! sudo nginx -t; then
        echo "nginx -t failed: restoring the backup"
        sudo cp -p "$BACKUP" "$SITE"
        exit 1
    fi
fi

echo "3/3 reloading Nginx"
sudo nginx -t && sudo systemctl reload nginx
echo
echo "Done. Open Mainsail and press Ctrl+Shift+R (the PWA may cache the old index.html)."
echo "Widget position: Settings > Dashboard, below the panel columns of each screen type."
