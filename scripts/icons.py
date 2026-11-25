"""
Ikony Pulsecal: kartka kalendarza z niebieskim nagłówkiem i czterema „blobami” w kolorach jak w Google
(niebieski, czerwony, żółty, zielony), na białym kafelku — żeby ikona od razu kojarzyła się z kalendarzem.

Generuje public/favicon.svg, icon-192.png, icon-512.png (zaokrąglony kafelek, przezroczyste rogi),
icon-maskable-512.png i apple-touch-icon.png (cały kwadrat białe tło; rogi przycina system).
Treść mieści się w „bezpiecznym kole” ikon maskable (promień 40%).

Uruchomienie (wymaga Pillow):  python scripts/icons.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
S = 512  # układ współrzędnych projektu

WHITE = "#ffffff"
BLUE = "#2f6fe4"  # nagłówek i ramka kartki
RING = "#1d4fb8"  # kółka u góry
BLOBS = [  # (kolor, środek x, środek y, faza kształtu)
    ("#ea4335", 191, 252, 0.4),  # czerwony
    ("#fbbc04", 321, 252, 2.1),  # żółty
    ("#34a853", 191, 340, 3.7),  # zielony
    ("#4285f4", 321, 340, 5.2),  # niebieski
]
BLOB_R = 37
TILE_RX = 116
# powiększenie rysunku: zwykłe ikony i iOS większe, maskable 1.0 (musi zmieścić się w kole 40%)
ZOOM = 1.12

# kartka
X0, Y0, X1, Y1, SHEET_RX = 104, 120, 408, 404, 48
HEAD = 200  # dolna krawędź nagłówka
FRAME = 20  # grubość ramki po bokach i na dole
RINGS = (190, 322)


def blob(cx: float, cy: float, r: float, phase: float, n: int = 120) -> list[tuple[float, float]]:
    """Organiczny kształt (lekko „bąblowy”): koło z dwiema delikatnymi falami promienia."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        k = 1 + 0.07 * math.sin(3 * t + phase) + 0.045 * math.cos(2 * t + phase * 1.7)
        pts.append((cx + r * k * math.cos(t), cy + r * k * math.sin(t)))
    return pts


def draw(size: int, tile: str, zoom: float = ZOOM) -> Image.Image:
    """tile: "round" (zaokrąglony kafelek, przezroczyste rogi) albo "full" (cały kwadrat)."""
    ss = 4  # nadpróbkowanie = gładkie krawędzie
    k = size * ss / S
    img = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def z(v):  # współrzędna po powiększeniu względem środka
        return S / 2 + (v - S / 2) * zoom

    def box(x0, y0, x1, y1):
        return [z(x0) * k, z(y0) * k, z(x1) * k - 1, z(y1) * k - 1]

    def rad(r):
        return r * zoom * k

    if tile == "round":
        d.rounded_rectangle([0, 0, S * k - 1, S * k - 1], radius=TILE_RX * k, fill=WHITE)
    else:
        d.rectangle([0, 0, S * k - 1, S * k - 1], fill=WHITE)

    # kartka: niebieska całość, białe wnętrze pod nagłówkiem
    d.rounded_rectangle(box(X0, Y0, X1, Y1), radius=rad(SHEET_RX), fill=BLUE)
    inner_rx = SHEET_RX - FRAME
    d.rounded_rectangle(box(X0 + FRAME, HEAD, X1 - FRAME, Y1 - FRAME), radius=rad(inner_rx), fill=WHITE)
    d.rectangle(box(X0 + FRAME, HEAD, X1 - FRAME, HEAD + inner_rx), fill=WHITE)

    # kółka: biała obwódka + ciemniejszy niebieski
    for cx in RINGS:
        d.rounded_rectangle(box(cx - 22, 80, cx + 22, 164), radius=rad(22), fill=WHITE)
        d.rounded_rectangle(box(cx - 13, 89, cx + 13, 155), radius=rad(13), fill=RING)

    for color, cx, cy, ph in BLOBS:
        d.polygon([(z(x) * k, z(y) * k) for x, y in blob(cx, cy, BLOB_R, ph)], fill=color)

    return img.resize((size, size), Image.LANCZOS)


def svg() -> str:
    inner_rx = SHEET_RX - FRAME
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">',
        f'  <rect width="{S}" height="{S}" rx="{TILE_RX}" fill="{WHITE}"/>',
        f'  <g transform="translate({S / 2} {S / 2}) scale({ZOOM}) translate({-S / 2} {-S / 2})">',
        f'  <rect x="{X0}" y="{Y0}" width="{X1 - X0}" height="{Y1 - Y0}" rx="{SHEET_RX}" fill="{BLUE}"/>',
        f'  <rect x="{X0 + FRAME}" y="{HEAD}" width="{X1 - X0 - 2 * FRAME}" height="{Y1 - FRAME - HEAD}" '
        f'rx="{inner_rx}" fill="{WHITE}"/>',
        f'  <rect x="{X0 + FRAME}" y="{HEAD}" width="{X1 - X0 - 2 * FRAME}" height="{inner_rx}" fill="{WHITE}"/>',
    ]
    for cx in RINGS:
        parts.append(f'  <rect x="{cx - 22}" y="80" width="44" height="84" rx="22" fill="{WHITE}"/>')
        parts.append(f'  <rect x="{cx - 13}" y="89" width="26" height="66" rx="13" fill="{RING}"/>')
    for color, cx, cy, ph in BLOBS:
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in blob(cx, cy, BLOB_R, ph, 72))
        parts.append(f'  <polygon fill="{color}" points="{pts}"/>')
    parts.append("  </g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    draw(512, "round").save(OUT / "icon-512.png", optimize=True)
    draw(192, "round").save(OUT / "icon-192.png", optimize=True)
    draw(512, "full", zoom=1.0).save(OUT / "icon-maskable-512.png", optimize=True)
    draw(180, "full").convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    (OUT / "favicon.svg").write_bytes(svg().encode("utf-8"))
    print("ikony zapisane w", OUT)
