#!/usr/bin/env bash
# Mainsail Pi Monitor — uninstaller
# Copyright (C) 2026 Giovanni Grosso — GPL-3.0-or-later (see LICENSE)
#
# Usage: ./uninstall.sh [path to the Nginx site of Mainsail]   (default: /etc/nginx/sites-available/mainsail)
set -euo pipefail

SITE="${1:-/etc/nginx/sites-available/mainsail}"
DEST=/usr/local/share/mainsail-pi-monitor

if [ -f "$SITE" ] && sudo grep -qF '# --- mainsail-pi-monitor (begin) ---' "$SITE"; then
    BACKUP="$SITE.bak-pi-monitor.$(date +%Y%m%d-%H%M%S)"
    sudo cp -p "$SITE" "$BACKUP"
    sudo sed -i '/# --- mainsail-pi-monitor (begin) ---/,/# --- mainsail-pi-monitor (end) ---/d' "$SITE"
    if ! sudo nginx -t; then
        echo "nginx -t failed: restoring $BACKUP"
        sudo cp -p "$BACKUP" "$SITE"
        exit 1
    fi
    sudo systemctl reload nginx
    echo "Snippet removed from $SITE (backup: $BACKUP)"
fi
sudo rm -rf "$DEST"
echo "Done. The saved widget position (Moonraker database, namespace 'mainsail', key 'pi_monitor_widget')"
echo "is harmless; delete it with:"
echo "  curl -X DELETE 'http://localhost:7125/server/database/item?namespace=mainsail&key=pi_monitor_widget'"
