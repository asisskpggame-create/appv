#!/usr/bin/env python3
"""Idempotent edits to the generated Capacitor Android project."""
import re
import sys
from pathlib import Path

with_core = "--stub" not in sys.argv

manifest = Path("android/app/src/main/AndroidManifest.xml")
text = manifest.read_text()

if "ACCESS_NETWORK_STATE" not in text:
    text = text.replace(
        "<application",
        '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <application',
        1,
    )

if "<queries>" not in text:
    queries = (
        "<queries>\n"
        '        <intent><action android:name="android.intent.action.MAIN" />'
        '<category android:name="android.intent.category.LAUNCHER" /></intent>\n'
        '        <intent><action android:name="android.intent.action.VIEW" />'
        '<category android:name="android.intent.category.BROWSABLE" />'
        '<data android:scheme="https" /></intent>\n'
        "    </queries>\n    "
    )
    text = text.replace("<application", queries + "<application", 1)

if "AsisVpnService" not in text:
    service = (
        '    <service\n'
        '        android:name="com.asisvpn.client.vpn.AsisVpnService"\n'
        '        android:exported="false"\n'
        '        android:permission="android.permission.BIND_VPN_SERVICE">\n'
        '        <intent-filter>\n'
        '            <action android:name="android.net.VpnService" />\n'
        '        </intent-filter>\n'
        '    </service>\n'
    )
    text = text.replace("</application>", service + "</application>", 1)
manifest.write_text(text)

gradle = Path("android/app/build.gradle")
g = gradle.read_text()
g = re.sub(r"^\s*implementation files\('libs/libbox\.aar'\)\n", "", g, flags=re.M)
if with_core:
    g = re.sub(r"^dependencies \{\n", "dependencies {\n    implementation files('libs/libbox.aar')\n", g, count=1, flags=re.M)
gradle.write_text(g)
print("patched manifest + gradle (core=%s)" % with_core)
