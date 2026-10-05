#!/usr/bin/env bash
# Runs inside the Android emulator job: installs the debug APK (with selftest.js), answers the
# self-test's "WAIT …" steps with real intents and Back presses, and collects screenshots + results.
set -u
PKG=com.m3athrazaq.murabbiyati
APK=native/android/app/build/outputs/apk/debug/app-debug.apk
OUT=smoke
mkdir -p "$OUT"

res() { adb shell run-as "$PKG" cat files/selftest-result.txt 2>/dev/null | tr -d '\r'; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
waitfor() {  # marker, seconds
  for _ in $(seq 1 "$2"); do
    if res | grep -qE "^($1|DONE|ERROR)"; then res | grep -qE "^$1" && return 0; echo "stopped before $1"; return 1; fi
    sleep 1
  done
  echo "timed out waiting for $1"; return 1
}

adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb install -r "$APK"
# reminders: let the app post notifications without the Android 13+ prompt (a real phone asks once)
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true
adb shell getprop ro.build.version.release | sed 's/^/Android /' | tee "$OUT/device.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName | sed 's/^ */WebView /' | tee -a "$OUT/device.txt"
adb shell am start -W -n "$PKG/.MainActivity"
sleep 6; shot 00-launch

waitfor "STEP confirm" 120 && shot 01-confirm
if waitfor "WAIT view-intent" 60; then
  shot 02-home
  # "Open with" a CSV from another app (content:// URI)
  adb shell am start -a android.intent.action.VIEW -t text/csv \
    -d "content://$PKG.fileprovider/my_cache_images/incoming/nursery.csv" -n "$PKG/.MainActivity"
fi
waitfor "STEP summary" 90 && shot 03-import-summary
if waitfor "WAIT send-intent" 60; then
  # "Share" a CSV to the app (ACTION_SEND with EXTRA_STREAM)
  adb shell am start -a android.intent.action.SEND -t text/csv \
    --eu android.intent.extra.STREAM "content://$PKG.fileprovider/my_cache_images/incoming/shared.csv" -n "$PKG/.MainActivity"
fi
waitfor "STEP summary2" 90 && shot 04-shared-summary
waitfor "STEP feed" 90 && shot 10-feed-type
waitfor "STEP sleep" 60 && shot 11-sleep-wake
waitfor "STEP children" 90 && shot 12-children
waitfor "STEP design-modern" 60 && shot 13-design-modern
waitfor "STEP design-calm" 30 && shot 14-design-calm
waitfor "STEP design-contrast" 30 && shot 15-design-contrast
waitfor "STEP health" 60 && shot 16-health
if waitfor "STEP share-sheet" 300; then   # after the card reader (up to a few minutes on the emulator)
  sleep 3; shot 05-share-sheet
  adb shell input keyevent KEYCODE_BACK
fi
if waitfor "WAIT back1" 60; then sleep 1; shot 06-settings; adb shell input keyevent KEYCODE_BACK; fi
if waitfor "WAIT back2" 60; then sleep 1; shot 07-log; adb shell input keyevent KEYCODE_BACK; fi
if waitfor "WAIT back3" 60; then
  sleep 1; shot 08-home
  adb shell input keyevent KEYCODE_BACK
  # leaving the app can take a few seconds on a busy emulator: wait until another app is in front
  for _ in $(seq 1 20); do
    sleep 1
    adb shell dumpsys activity activities | grep -E "topResumedActivity" | grep -q "$PKG" || break
  done
  shot 09-after-back
  adb shell dumpsys activity activities | grep -E "ResumedActivity" | head -3 | tee "$OUT/after-back.txt"
  sleep 2
  adb shell am start -n "$PKG/.MainActivity"
fi
waitfor "STEP language" 90 && sleep 1 && shot 17-other-language
adb shell dumpsys alarm | grep -c "$PKG" | sed 's/^/alarms set by the app: /' | tee "$OUT/alarms.txt"
waitfor "DONE" 90
sleep 2
res | tee "$OUT/selftest-result.txt"
adb exec-out run-as "$PKG" cat files/murabbiyati-state.json > "$OUT/state.json" 2>/dev/null

# data must survive a full restart of the app
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/.MainActivity"
sleep 15; shot 18-relaunch
adb exec-out run-as "$PKG" cat files/murabbiyati-state.json > "$OUT/state-after.json" 2>/dev/null
adb shell run-as "$PKG" cat files/selftest-relaunch.txt 2>/dev/null | tr -d '\r' | tee "$OUT/relaunch-1.txt"

# a CSV opened while the app is closed (cold start from WhatsApp / Files)
adb shell am force-stop "$PKG"
adb shell run-as "$PKG" rm -f files/selftest-relaunch.txt
adb shell am start -W -a android.intent.action.VIEW -t text/csv \
  -d "content://$PKG.fileprovider/my_cache_images/incoming/cold.csv" -n "$PKG/.MainActivity"
sleep 15; shot 19-cold-open
adb shell run-as "$PKG" cat files/selftest-relaunch.txt 2>/dev/null | tr -d '\r' | tee "$OUT/relaunch-2.txt"

python3 - <<'PY' 2>&1 | tee -a "$OUT/selftest-result.txt"
import json, re
try:
    a = json.load(open("smoke/state.json"))
    b = json.load(open("smoke/state-after.json"))
    n = len(a["records"])
    print(("PASS" if len(b["records"]) == n > 0 else "FAIL") + f" records after a full restart: {len(b['records'])} (before {n})")
    r2 = open("smoke/relaunch-2.txt").read()
    m = re.search(r"records (\d+)", r2)
    ok = bool(m) and int(m.group(1)) == n + 1 and "summary yes" in r2
    print(("PASS" if ok else "FAIL") + " CSV opened while the app was closed is imported: " + r2.replace(chr(10), "; "))
except Exception as e:
    print("FAIL restart checks:", repr(e))
PY
adb logcat -d -s Capacitor:* Capacitor/Console:* chromium:* AndroidRuntime:E '*:F' > "$OUT/logcat.txt" 2>/dev/null || true
grep -c "^PASS" "$OUT/selftest-result.txt" | sed 's/^/passed: /'
if grep -qE "^(FAIL|ERROR)" "$OUT/selftest-result.txt" || ! grep -q "^DONE" "$OUT/selftest-result.txt"; then
  echo "SMOKE TEST FAILED"; exit 1
fi
echo "SMOKE TEST OK"
