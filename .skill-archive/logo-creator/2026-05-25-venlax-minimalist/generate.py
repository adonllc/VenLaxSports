#!/usr/bin/env python3
"""Generate minimalist flat VENLAX Sports logo variations via Imagen 4."""

import base64
import json
import os
import time
import urllib.request
import urllib.error

API_KEY = "AIzaSyAaHKFeXn1BiWF04vwOsBn53MwfG2EUWzU"
MODEL = "gemini-2.5-flash-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

PROMPTS = [
    # 1 — abstract sport-arc wordmark
    "Minimalist flat logo for VENLAX SPORTS. Clean sans-serif wordmark 'VENLAX' in bold black, 'SPORTS' smaller below in teal (#10B981). Small abstract arc above the X in teal suggesting a tennis ball trajectory. White background. Flat 2D design, no shadows, no gradients.",

    # 2 — geometric icon + wordmark
    "Flat vector logo: bold black wordmark 'VENLAX SPORTS'. Left of text: a simple geometric hexagon icon split into three segments colored teal (#10B981), orange (#F97316), and black, representing three sports. Clean minimalist style, white background, no effects.",

    # 3 — sport-dot accent
    "Minimalist sports brand logo. 'VENLAX' in strong black uppercase sans-serif. Orange circle accent dot replacing the letter A, suggesting a ball. 'SPORTS' in small teal caps beneath. White background. Pure flat design.",

    # 4 — slash/strike wordmark
    "Clean flat logo design: 'VENLAX SPORTS' wordmark in black. A single diagonal teal (#10B981) strike-line across the X creating a dynamic feel. 'SPORTS' in light gray small caps below. Minimal, modern, white background.",

    # 5 — stacked monogram
    "Flat minimalist logo: large 'VL' monogram in black, bold geometric font. Small orange (#F97316) dot in corner. 'VENLAX SPORTS' in small black text below monogram. White background, no gradients, no shadows.",

    # 6 — tennis-arc icon
    "Vector flat icon logo. Simple tennis racket silhouette in black, perfectly minimal, 3 lines suggesting strings. 'VENLAX' text right of icon in bold black. 'SPORTS' below in teal (#10B981). White background. Ultra-clean modern sport brand.",

    # 7 — underline accent
    "Minimalist wordmark logo: 'VENLAX' in heavy black uppercase. Thick teal (#10B981) underline bar beneath, extending slightly past the X. 'SPORTS' in small orange (#F97316) uppercase tracking-wide below. White background, flat design.",

    # 8 — layered V icon
    "Flat geometric logo: stylized V shape made of two overlapping triangles — teal (#10B981) and orange (#F97316). 'VENLAX SPORTS' in bold black sans-serif to the right. White background, no drop shadows, vector-clean.",

    # 9 — sport-color bar
    "Clean sport logo: 'VENLAX SPORTS' in bold black. Three thin horizontal color bars underneath (teal, orange, black) representing Tennis, Pickleball, Cricket sports. Minimal and modern. White background, flat 2D.",

    # 10 — negative-space paddle
    "Minimalist flat logo: black rectangle with white negative-space pickleball paddle + tennis ball silhouettes cut out. 'VENLAX SPORTS' in white text below on black bar. Clean, bold, modern sport brand.",
]

def generate(prompt: str, idx: int) -> str:
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
    }).encode()

    req = urllib.request.Request(URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:300]}")
        return None

    candidates = body.get("candidates", [])
    if not candidates:
        print(f"  No candidates returned")
        return None

    for part in candidates[0].get("content", {}).get("parts", []):
        inline = part.get("inlineData", {})
        if inline.get("mimeType", "").startswith("image/"):
            out_path = os.path.join(OUT_DIR, f"logo-{idx:02d}.png")
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(inline["data"]))
            return out_path

    print(f"  No image part found in response")
    return None


if __name__ == "__main__":
    print(f"Generating {len(PROMPTS)} logo variations...\n")
    for i, prompt in enumerate(PROMPTS, 1):
        print(f"[{i:02d}/{len(PROMPTS)}] Generating...", end=" ", flush=True)
        path = generate(prompt, i)
        if path:
            print(f"Saved: {os.path.basename(path)}")
        else:
            print("FAILED")
        if i < len(PROMPTS):
            time.sleep(2)  # avoid rate limits
    print("\nDone.")
