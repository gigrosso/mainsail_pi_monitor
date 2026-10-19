# Mainsail Pi Monitor

*[Leia em português](LEIAME.md)*

Shows the health of the Raspberry Pi that runs Klipper/Moonraker directly in **Mainsail**:

- **Top bar** (next to the printer name): CPU usage, CPU temperature, RAM and storage usage.
  A status dot turns orange when the CPU is hot (≥ 70 °C) or the Pi reports throttling/under-voltage.
  Hover it for details (model, RAM/storage in GB, uptime, throttling flags).
- **Dashboard widget "Raspberry Pi"**: model and uptime, bars for CPU (plus one mini bar per core),
  CPU temperature, RAM and storage, a throttling/under-voltage warning, and 10-minute charts of
  CPU usage and temperature. Collapsible, follows Mainsail's light/dark theme.
- **Widget position in Settings > Dashboard**: for each screen type (mobile, tablet, desktop,
  widescreen) choose whether to show it, the column and after which panel it goes. The choice is
  saved in the Moonraker database, so it applies to every browser.
- Interface in **English or Portuguese**, following Mainsail's language.

It is a single JavaScript file injected into Mainsail by Nginx. **No extra service, no Python, no
Moonraker component**: the data comes from Mainsail's own Moonraker connection, so it uses the
same login and permissions as Mainsail.

## Requirements

- Raspberry Pi (any model; also works on other Linux hosts — Moonraker reports the same data)
- Mainsail **v2.x** (tested with **v2.17.0**) served by **Nginx** (MainsailOS, KIAUH…)
- Moonraker with the default components (`machine`, `file_manager`, `database`)

## Installation

```bash
cd ~
unzip mainsail-pi-monitor.zip      # or git clone <repository>
cd mainsail-pi-monitor
./install.sh                       # asks for sudo
```

Then open Mainsail and press **Ctrl+Shift+R** (Mainsail is a PWA and may keep the old page cached).

`install.sh`:

1. copies `pi-monitor.js` to `/usr/local/share/mainsail-pi-monitor/` (outside Mainsail's folder,
   so Mainsail updates do not remove it);
2. backs up the Nginx site (`/etc/nginx/sites-available/mainsail.bak-pi-monitor.<date>`) and
   inserts the snippet from `nginx/pi-monitor.conf` right after `server {`;
3. runs `nginx -t` (restoring the backup if it fails) and reloads Nginx.

If your Nginx site has another name, pass it: `./install.sh /etc/nginx/sites-available/<name>`.

### Manual installation

1. `sudo install -D -m 644 pi-monitor.js /usr/local/share/mainsail-pi-monitor/pi-monitor.js`
2. Paste the lines between the markers of `nginx/pi-monitor.conf` inside the `server { … }` block of
   Mainsail's site (at server level, **not** inside `location /`).
3. `sudo nginx -t && sudo systemctl reload nginx`

## Usage

- **Moving / hiding the widget:** Mainsail ▸ ⚙ Settings ▸ **Dashboard** ▸ pick the screen-type tab.
  Below the panel columns there is a dashed box **Widget "Raspberry Pi"** with *show*, *column*,
  *position* and *default*. Without a saved choice, the widget sits right below the Status panel.
  If the panel it follows is hidden, it moves up to the nearest visible panel above.
- **Collapsing:** click the widget header (remembered per browser).

### Settings inside `pi-monitor.js`

| Constant | Default | Meaning |
|---|---|---|
| `POLL_MS` | `5000` | refresh interval of CPU/temperature/RAM (ms) |
| `DISK_MS` | `60000` | refresh interval of storage (ms) |
| `HISTORY_MIN` | `10` | length of the charts (minutes, kept only in the browser) |
| `TEMP_WARN` / `TEMP_HOT` | `70` / `80` | CPU temperature for orange / red (°C) |
| `TOPBAR_FULL_MIN_PX` | `1400` | narrower than this, the top bar shows only CPU and temperature |
| `TOPBAR_MIN_PX` | `900` | narrower than this, the top bar item is hidden |

After editing, run `./install.sh` again (it only copies the file if Nginx is already configured).

## Where the data comes from

| Shown | Moonraker method |
|---|---|
| CPU % (total and per core), CPU temperature, RAM, uptime, throttling | `machine.proc_stats` |
| Model, cores, architecture | `machine.system_info` |
| Storage | `server.files.get_directory` (`gcodes` root → `disk_usage`) |
| Widget position | `server.database.get_item` / `post_item` (namespace `mainsail`, key `pi_monitor_widget`) |

*Storage* is the partition that holds the `gcodes` folder (on a Pi, normally the SD card or SSD).
The Pi has a single temperature sensor, on the SoC: that is the "CPU temperature".

If you restrict Moonraker access with a proxy/gateway, users need read access to the first three
methods. Saving the position needs `server.database.post_item` in the `mainsail` namespace, which
any user who can change Mainsail's own settings already has.

## Limitations

- It relies on Mainsail internals (Vue 2 root instance, `$socket`, `gui/getPanels`, CSS classes of
  v2.17). A future Mainsail release (e.g. a move to Vue 3) may need an update of this script.
- Mainsail's own layout list (the draggable one) only accepts built-in panels, which is why the
  widget has its own position box.
- The charts start empty on each page load (history lives only in the browser).

## Uninstall

```bash
./uninstall.sh            # or ./uninstall.sh /etc/nginx/sites-available/<name>
```

It removes the snippet (with a backup and `nginx -t`), deletes `/usr/local/share/mainsail-pi-monitor`
and shows how to delete the saved position from the Moonraker database.

## License

Copyright (C) 2026 Giovanni Grosso

This program is free software: you can redistribute it and/or modify it under the terms of the
**GNU General Public License version 3** as published by the Free Software Foundation, or (at your
option) any later version. It is distributed WITHOUT ANY WARRANTY. See [LICENSE](LICENSE).
