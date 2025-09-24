#!/bin/bash

# Fully remove the gadget directory /sys/kernel/config/usb_gadget/rockchip
# Order is critical: Unbind -> unlink function symlinks -> remove functions -> remove configs -> remove strings -> remove gadget dir.

set -euo pipefail

GADGET=g1
CFGFS_BASE=/sys/kernel/config/usb_gadget
GADGET_PATH=${CFGFS_BASE}/${GADGET}

log(){ echo "[clean-gadget] $*" >&2; }

if [[ ! -d ${GADGET_PATH} ]]; then
  log "Gadget ${GADGET_PATH} not present (nothing to do)."; exit 0
fi

# 1. Unbind
if [[ -f ${GADGET_PATH}/UDC ]]; then
  CUR=$(cat ${GADGET_PATH}/UDC 2>/dev/null || true)
  if [[ -n "$CUR" ]]; then
    log "Unbinding UDC: $CUR"
    echo "" > ${GADGET_PATH}/UDC || log "Failed to unbind UDC"
    sleep 0.1
  fi
fi

# 2. Unlink all function symlinks from each config
if [[ -d ${GADGET_PATH}/configs ]]; then
  while IFS= read -r -d '' link; do
    log "Unlink $(basename "$link")"
    unlink "$link" || log "Failed to unlink $link"
  done < <(find ${GADGET_PATH}/configs -type l -print0)
fi

# 3. Remove function directories (ensure no lingering open files)
if [[ -d ${GADGET_PATH}/functions ]]; then
  for f in ${GADGET_PATH}/functions/*; do
    [[ -d "$f" ]] || continue
    log "Remove function $(basename "$f")"
    # Extra safety: try clearing any file we can that might block removal
    rm -f "$f"/report_desc 2>/dev/null || true
    rmdir "$f" 2>/dev/null || {
      # Retry once after short wait (in case of pending release)
      sleep 0.1; rmdir "$f" 2>/dev/null || log "Could not remove function dir $f (still busy)";
    }
  done
fi

# 4. Remove config directories (inner first)
if [[ -d ${GADGET_PATH}/configs ]]; then
  # Remove any 'strings' inside configs
  find ${GADGET_PATH}/configs -type d -name '0x*' -exec bash -c 'for d; do rmdir "$d" 2>/dev/null || true; done' _ {} +
  # Remove config dirs
  for c in ${GADGET_PATH}/configs/*; do
    [[ -d "$c" ]] || continue
    log "Remove config $(basename "$c")"
    rmdir "$c" 2>/dev/null || log "Could not remove config $c"
  done
  rmdir ${GADGET_PATH}/configs 2>/dev/null || true
fi

# 5. Remove top-level strings dir
if [[ -d ${GADGET_PATH}/strings ]]; then
  for s in ${GADGET_PATH}/strings/*; do
    [[ -d "$s" ]] || continue
    rmdir "$s" 2>/dev/null || true
  done
  rmdir ${GADGET_PATH}/strings 2>/dev/null || true
fi

# 6. Remove os_desc if present (may not exist)
if [[ -d ${GADGET_PATH}/os_desc ]]; then
  rmdir ${GADGET_PATH}/os_desc 2>/dev/null || true
fi

# 7. Finally remove gadget dir
log "Remove gadget root ${GADGET_PATH}"
rmdir ${GADGET_PATH} 2>/dev/null || {
  log "Gadget directory not empty; listing residual:"; find ${GADGET_PATH} -maxdepth 2 -mindepth 1 || true; exit 1;
}

log "Cleanup complete."
