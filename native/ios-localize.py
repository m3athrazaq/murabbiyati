#!/usr/bin/env python3
"""Give the built iPhone app its languages (run after xcodebuild, before packaging).

- CFBundleLocalizations = every language of the web app (read from index.html), so iOS shows the
  share sheet, the file picker and other system texts in the phone's language, and offers the app
  under Settings > App > Language.
- <lang>.lproj/InfoPlist.strings: the name under the icon — مربّيتي in Arabic, Murabbiyati elsewhere.

usage: ios-localize.py path/to/App.app path/to/index.html
"""
import json
import pathlib
import plistlib
import re
import sys

app = pathlib.Path(sys.argv[1])
html = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
langs = json.loads(re.search(r"window\.__LANGS=(\[[^\]]*\])", html).group(1))
assert "ar" in langs and "en" in langs, langs

info_path = app / "Info.plist"
info = plistlib.loads(info_path.read_bytes())
info["CFBundleLocalizations"] = langs
info["CFBundleDevelopmentRegion"] = "en"
info_path.write_bytes(plistlib.dumps(info, fmt=plistlib.FMT_BINARY))

for code in langs:
    name = "مربّيتي" if code == "ar" else "Murabbiyati"
    folder = app / f"{code}.lproj"
    folder.mkdir(exist_ok=True)
    (folder / "InfoPlist.strings").write_bytes(
        plistlib.dumps({"CFBundleDisplayName": name, "CFBundleName": name}, fmt=plistlib.FMT_BINARY))

print(f"{app.name}: {len(langs)} languages")
