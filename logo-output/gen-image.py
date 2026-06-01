#!/usr/bin/env python3
"""Generate image via Gemini API. Usage: gen-image.py --prompt "..." --output out.png [--aspect-ratio 3:2] [--input-image src.png]"""
import argparse, base64, os, sys
import requests

parser = argparse.ArgumentParser()
parser.add_argument("--prompt", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--aspect-ratio", default="1:1")
parser.add_argument("--input-image", default="")
args = parser.parse_args()

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    sys.exit("GEMINI_API_KEY not set")

MODEL = "gemini-3.1-flash-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

parts = [{"text": args.prompt}]
if args.input_image:
    with open(args.input_image, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    ext = args.input_image.lower().split(".")[-1]
    mime = "image/jpeg" if ext in ("jpg","jpeg") else "image/png"
    parts.append({"inlineData": {"mimeType": mime, "data": img_b64}})

payload = {
    "contents": [{"parts": parts}],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"],
        "imageConfig": {"aspectRatio": args.aspect_ratio}
    }
}

resp = requests.post(URL, json=payload, timeout=120)
if resp.status_code != 200:
    sys.exit(f"API error {resp.status_code}: {resp.text[:500]}")

data = resp.json()
for part in data["candidates"][0]["content"]["parts"]:
    if "inlineData" in part:
        img_data = base64.b64decode(part["inlineData"]["data"])
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "wb") as f:
            f.write(img_data)
        print(f"Saved: {args.output} ({len(img_data)//1024}KB)")
        sys.exit(0)

sys.exit("No image in response")
