#!/usr/bin/env python3
"""
Regenerate public/fonts and public/brand from the raw brand pack in "00 - Assets".

The raw pack is 69 MB of PNG and 604 KB of TTF — far past the <1.5 MB initial-load
budget the spec sets for low/mid-range Android on mobile data (§3.5). This script is
the one place that turns it into web-scale assets, so the conversion is reproducible
rather than a thing someone did by hand once.

    python3 scripts/build-assets.py            # everything
    python3 scripts/build-assets.py artists    # photography, map, prizes, derived SVGs only

Requires: pillow, fonttools, brotli   (pip install pillow fonttools brotli)
"""
import pathlib
import re
import shutil
import sys

from PIL import Image
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "00 - Assets"
FONTS_OUT = ROOT / "public" / "fonts"
BRAND_OUT = ROOT / "public" / "brand"
ARTISTS_OUT = ROOT / "public" / "artists"

# Artist photography for the carousel. Sources are 2048px squares at 2–6 MB of PNG.
# The widths must match ARTIST_WIDTHS in src/config/artists.ts — that file builds the
# srcset from them. The slot never renders wider than ~560 CSS px, so 1440 already
# covers a 3x phone and a 2x desktop; a 1920 rung would never be selected.
ARTIST_WIDTHS = [480, 768, 1024, 1440]
ARTISTS = [
    ("harmonize.png", "harmonize"),
    ("Scotts.png", "scotts-maphuma"),
    ("darassa.png", "darassa"),
]

EVENTS_OUT = ROOT / "public" / "events"
PRIZES_OUT = ROOT / "public" / "prizes"

# Tanzania map artwork (3840 × 1648, mostly transparent canvas). Cropped to the glow's
# extent (alpha > 10 bounds, plus a little air). MAP_CROP must match MAP_ART in
# src/components/EventsMap.tsx — the city pins are positioned against this crop.
MAP_CROP = (1090, 30, 2830, 1600)
MAP_WIDTHS = [560, 760, 1100]

# Extra Cold prize cut-outs. The neck fan is supplied as two views and composited into
# one image, as on the prize sheet; the others ship as supplied, trimmed to their
# alpha bounds.
PRIZE_WIDTHS = [320, 640]
PRIZES = [
    ("neck-fan", None),
    ("speaker-coolbox", "Cool Box Speaker.png"),
    ("silver-jacket", "Extra Cold Jacket.png"),
    ("rapid-chiller", "Rapid Chiller.png"),
]

Image.MAX_IMAGE_PIXELS = None  # the source plates are deliberately huge

# Swahili and English are both Latin. Keep Basic Latin + Latin-1 Supplement (accents
# appear in loan words and in the English legal copy) plus the punctuation the copy
# uses: en/em dashes, curly quotes, ellipsis, bullet, arrow, multiplication sign.
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2010-2015,U+2018-201A,"
    "U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,U+2044,U+20AC,"
    "U+2192,U+00D7,U+2122,U+00A9,U+00AE"
)

FACES = [
    ("Ciutadella Regular.ttf", "ciutadella-400.woff2"),
    ("Ciutadella Medium.ttf", "ciutadella-500.woff2"),
    ("Ciutadella SemiBold.ttf", "ciutadella-600.woff2"),
    ("Ciutadella Bold.ttf", "ciutadella-700.woff2"),
]

VECTORS = [
    ("UNLOCKS_WHITE.svg", "unlocks-white.svg"),
    ("UNLOCKS_BLUE.svg", "unlocks-blue.svg"),
    ("WHITE_snowcastle.svg", "snowcastle-white.svg"),
    ("BLUE_snowcastle.svg", "snowcastle-blue.svg"),
    ("BANNER FC on BLUE.svg", "castle-lite-lockup.svg"),
    ("BANNER FC on WHITE.svg", "castle-lite-lockup-on-white.svg"),
]


def kb(path: pathlib.Path) -> float:
    return path.stat().st_size / 1024


def build_fonts() -> None:
    print("Fonts — TTF -> subset WOFF2")
    src_dir = ASSETS / "Ciutadella Font"
    for src, dst in FACES:
        subset.main([
            str(src_dir / src),
            f"--unicodes={UNICODES}",
            "--layout-features=kern,liga,calt,tnum,onum",
            "--flavor=woff2",
            f"--output-file={FONTS_OUT / dst}",
            "--no-hinting",
            "--desubroutinize",
        ])
        print(f"  {dst:24s} {kb(src_dir / src):7.1f} KB -> {kb(FONTS_OUT / dst):6.1f} KB")


def webp(src: pathlib.Path, dst: str, width: int, quality: int, crop=None) -> None:
    im = Image.open(src).convert("RGB")
    if crop:
        im = im.crop(crop)
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(BRAND_OUT / dst, "WEBP", quality=quality, method=6)
    print(f"  {dst:28s} {im.width}x{im.height:<5d} {kb(BRAND_OUT / dst):6.1f} KB")


def build_images() -> None:
    png = ASSETS / "PNG"

    print("\nAge-gate / ambient plate (BlueJolt)")
    webp(png / "BlueJoltBG Topaz Gigapixel 2x scale.png", "hero-bg-800.webp", 800, 68)

    print("\nLight ice plates (What You Can Unlock / Find Us On the Ground)")
    ice = png / "White ICE BG Topaz Gigapixel 2x scale.png"
    webp(ice, "ice-bg-800.webp", 800, 68)
    webp(ice, "ice-bg-1600.webp", 1600, 70)
    # These sections run very tall on a phone; a landscape plate crops to flat sky.
    im = Image.open(ice)
    W, H = im.size
    crop_w = round(H * 760 / 1400)
    cx = W // 2
    webp(ice, "ice-bg-mobile.webp", 760, 70,
         crop=(cx - crop_w // 2, 0, cx + crop_w // 2, H))

    print("\nHero plate (photographic ice castle)")
    castle = png / "Castle Lite Snowcaste_Photographic_Small.png"
    webp(castle, "hero-castle-1000.webp", 1000, 70)
    webp(castle, "hero-castle-1600.webp", 1600, 72)

    # Phones get a portrait crop around the crystal: `cover` on the 2.07:1 landscape
    # plate would reduce it to a narrow centre strip.
    im = Image.open(castle)
    W, H = im.size
    crop_w = round(H * 760 / 1000)
    cx = W // 2
    webp(castle, "hero-castle-mobile.webp", 760, 70,
         crop=(cx - crop_w // 2, 0, cx + crop_w // 2, H))


def build_artists() -> None:
    """AVIF + WebP ladders for the artist carousel.

    Pillow writes neither EXIF nor XMP unless asked, and the sources carry no ICC
    profile (they are untagged sRGB), so nothing needs stripping or converting.
    AVIF quality is held higher than the plates' WebP: Scotts and Darassa are shot
    on smooth studio gradients, and those band first when AVIF is pushed hard.
    """
    print("\nArtist photography (carousel) — AVIF + WebP")
    ARTISTS_OUT.mkdir(parents=True, exist_ok=True)
    for src, slug in ARTISTS:
        im = Image.open(ASSETS / src).convert("RGB")
        for w in ARTIST_WIDTHS:
            frame = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            avif = ARTISTS_OUT / f"{slug}-{w}.avif"
            webp_path = ARTISTS_OUT / f"{slug}-{w}.webp"
            frame.save(avif, "AVIF", quality=64, speed=4)
            frame.save(webp_path, "WEBP", quality=80, method=6)
            print(f"  {slug}-{w:<5d} avif {kb(avif):6.1f} KB   webp {kb(webp_path):6.1f} KB")


def save_ladder(im: Image.Image, out_dir: pathlib.Path, stem: str, widths, q_avif: int, q_webp: int) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for w in widths:
        frame = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        avif = out_dir / f"{stem}-{w}.avif"
        webp_path = out_dir / f"{stem}-{w}.webp"
        frame.save(avif, "AVIF", quality=q_avif, speed=4)
        frame.save(webp_path, "WEBP", quality=q_webp, method=6)
        print(f"  {stem}-{w:<5d} {frame.width}x{frame.height:<5d} avif {kb(avif):6.1f} KB   webp {kb(webp_path):6.1f} KB")


def build_events() -> None:
    """Mega Events: the Tanzania map."""
    print("\nTanzania map (transparent) — AVIF + WebP")
    im = Image.open(ASSETS / "PNG" / "TZ MAP.png").convert("RGBA").crop(MAP_CROP)
    # Higher quality than the photos: the glow is soft gradient on transparency,
    # which is where both codecs show blocking first.
    save_ladder(im, EVENTS_OUT, "tz-map", MAP_WIDTHS, 60, 78)


def build_ambassadors() -> None:
    """Brand ambassadors cut-out for Find Us On the Ground, trimmed to its alpha bounds so
    the centre ambassador's head is the top edge of the image (the CSS overlaps it into
    the section above by a fixed amount)."""
    print("\nAmbassadors (transparent) — AVIF + WebP")
    im = Image.open(ASSETS / "Hostesses 2.png").convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    save_ladder(im, BRAND_OUT, "ambassadors", [640, 1000, 1400], 66, 82)


def build_snow() -> None:
    """White snow plate behind the code-entry section."""
    print("\nSnow plate (code entry)")
    im = Image.open(ASSETS / "PNG" / "White snow BG 2.png").convert("RGB")
    for w, q in ((900, 70), (1600, 72)):
        frame = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out = BRAND_OUT / f"snow-bg-{w}.webp"
        frame.save(out, "WEBP", quality=q, method=6)
        print(f"  snow-bg-{w:<5d} {kb(out):6.1f} KB")


def build_prizes() -> None:
    print("\nExtra Cold prizes (transparent) — AVIF + WebP")
    src = ASSETS / "PNG" / "extra cold prizes"

    def trimmed(name: str) -> Image.Image:
        im = Image.open(src / name).convert("RGBA")
        return im.crop(im.getchannel("A").getbbox())

    # The Blue Jolt plate behind the prizes band — the ground of the prize sheet.
    jolt = Image.open(ASSETS / "PNG" / "BlueJoltBG Topaz Gigapixel 2x scale.png").convert("RGB")
    # A dense starfield compresses badly; it sits behind frosted cards and under a
    # mask, so it takes a lower quality than the photography without visible loss.
    for w, q in ((900, 62), (1800, 58)):
        frame = jolt.resize((w, round(jolt.height * w / jolt.width)), Image.LANCZOS)
        out = PRIZES_OUT / f"jolt-bg-{w}.webp"
        PRIZES_OUT.mkdir(parents=True, exist_ok=True)
        frame.save(out, "WEBP", quality=q, method=6)
        print(f"  jolt-bg-{w:<5d} {kb(out):6.1f} KB")

    for stem, name in PRIZES:
        if name is None:
            # Back view behind and left, front view (with the UNLOCKS band) in front.
            back, front = trimmed("Neck Fan - Back.png"), trimmed("Neck Fan - Front.png")
            back = back.resize((round(back.width * 0.9), round(back.height * 0.9)), Image.LANCZOS)
            canvas = Image.new("RGBA", (round(front.width * 1.55), round(front.height * 1.05)))
            canvas.alpha_composite(back, (0, canvas.height - back.height))
            canvas.alpha_composite(front, (canvas.width - front.width, 0))
            im = canvas.crop(canvas.getchannel("A").getbbox())
        else:
            im = trimmed(name)
        save_ladder(im, PRIZES_OUT, stem, PRIZE_WIDTHS, 70, 84)


def build_banner() -> None:
    """Banner-only Castle Lite mark for the artist artwork's top-left corner.

    The reference plate shows the green LITE banner on its own, flush to the left
    edge. The supplied lockup draws the snowcastle overlapping that banner, so cropping
    the lockup would leave snowcastle spikes in frame. This keeps the supplied vector
    paths untouched and simply drops the snowcastle group and the preview background,
    then tightens the viewBox to the banner's measured bounds (getBBox in a browser).
    """
    svg = (ASSETS / "SVG" / "BANNER FC on WHITE.svg").read_text()
    svg = re.sub(r'<g id="BG_PREVIEW".*?</g>\s*', "", svg, flags=re.S)
    svg = re.sub(r'<g>\s*(<path class="cls-4"[^>]*/>\s*)+</g>\s*', "", svg)
    svg = re.sub(r"\s*\.cls-4 \{[^}]*\}", "", svg)
    svg = svg.replace('viewBox="0 0 600 478.49"', 'viewBox="298.24 118.15 241.54 168.2"')
    if "cls-4" in svg or "BG_PREVIEW" in svg:
        raise SystemExit("banner extraction failed — the source SVG structure changed")
    out = BRAND_OUT / "castle-lite-banner.svg"
    out.write_text(svg)
    print(f"  castle-lite-banner.svg             {kb(out):6.1f} KB  (derived)")


def build_header_lockup() -> None:
    """Castle Lite lockup cropped to its artwork, for the sticky brand bar.

    The supplied 600 × 478 artboard pads the mark on every side — at a 44px image
    height the visible logo was only ~28px tall. Same paths, viewBox tightened to the
    measured bounds of snowcastle + banner (getBBox), with 2 units of clear space.
    """
    svg = (ASSETS / "SVG" / "BANNER FC on BLUE.svg").read_text()
    if 'viewBox="0 0 600 478.49"' not in svg:
        raise SystemExit("header lockup crop failed — the source SVG artboard changed")
    svg = svg.replace('viewBox="0 0 600 478.49"', 'viewBox="58.23 83.2 483.55 312.09"')
    out = BRAND_OUT / "castle-lite-lockup-tight.svg"
    out.write_text(svg)
    print(f"  castle-lite-lockup-tight.svg       {kb(out):6.1f} KB  (derived)")


def build_vectors() -> None:
    print("\nVector marks (copied verbatim — already small)")
    for src, dst in VECTORS:
        shutil.copy(ASSETS / "SVG" / src, BRAND_OUT / dst)
        print(f"  {dst:34s} {kb(BRAND_OUT / dst):6.1f} KB")
    build_banner()
    build_header_lockup()


def main() -> int:
    if not ASSETS.is_dir():
        print(f"Brand pack not found at {ASSETS}", file=sys.stderr)
        return 1

    FONTS_OUT.mkdir(parents=True, exist_ok=True)
    BRAND_OUT.mkdir(parents=True, exist_ok=True)

    # `build-assets.py artists` rebuilds only the carousel photography and banner,
    # leaving the existing fonts and plates byte-for-byte as they are.
    if sys.argv[1:] != ["artists"]:
        build_fonts()
        build_images()
        build_vectors()
    else:
        build_banner()
        build_header_lockup()
    build_artists()
    build_events()
    build_prizes()
    build_snow()
    build_ambassadors()

    shipped = (*FONTS_OUT.iterdir(), *BRAND_OUT.iterdir(), *ARTISTS_OUT.iterdir(),
               *EVENTS_OUT.iterdir(), *PRIZES_OUT.iterdir())
    total = sum(f.stat().st_size for f in shipped)
    print(f"\nTotal shipped assets: {total / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
