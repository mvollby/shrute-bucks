"""
Processes a raw AI-generated building image into a game-ready asset:
1. Removes a baked-in checkerboard "fake transparency" background (a common
   artifact from AI image tools that don't actually export an alpha
   channel), via flood fill from the image edges so only the connected
   background is affected, not similarly-colored pixels inside the subject.
2. Crops to the actual content's bounding box.
3. Resizes to a target height, preserving aspect ratio.
4. Saves as a real RGBA PNG.

Usage: python3 scripts/process_building_asset.py <input> <output> [--target-height N]
"""

import sys
from collections import deque
from pathlib import Path

from PIL import Image


def is_checker_color(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel[:3]
    # Low saturation (near-gray) and light -- matches the checkerboard's
    # two alternating shades without matching the subject's warm tans,
    # golds, or the dark, saturated rock grays.
    lo, hi = min(r, g, b), max(r, g, b)
    return lo > 150 and (hi - lo) < 20


def remove_checkerboard_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size

    visited = [[False] * w for _ in range(h)]
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        if not is_checker_color(pixels[x, y]):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def remove_stray_specks(img: Image.Image, min_size: int = 50) -> Image.Image:
    """Flood fill can leave tiny disconnected islands where anti-aliased
    edges between the subject and the checkerboard didn't quite match the
    checker-color test. Strips any opaque connected component smaller than
    `min_size` pixels, keeping the real subject (always far larger)."""
    pixels = img.load()
    w, h = img.size
    visited = [[False] * w for _ in range(h)]
    neighbor_offsets = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]

    for start_y in range(h):
        for start_x in range(w):
            if visited[start_y][start_x] or pixels[start_x, start_y][3] == 0:
                continue
            queue = deque([(start_x, start_y)])
            visited[start_y][start_x] = True
            cells = [(start_x, start_y)]
            while queue:
                cx, cy = queue.popleft()
                for dx, dy in neighbor_offsets:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and pixels[nx, ny][3] > 0:
                        visited[ny][nx] = True
                        queue.append((nx, ny))
                        cells.append((nx, ny))
            if len(cells) < min_size:
                for cx, cy in cells:
                    pixels[cx, cy] = (0, 0, 0, 0)

    return img


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def resize_to_height(img: Image.Image, target_height: int) -> Image.Image:
    w, h = img.size
    scale = target_height / h
    return img.resize((max(1, round(w * scale)), target_height), Image.NEAREST)


def main():
    if len(sys.argv) < 3:
        print("Usage: process_building_asset.py <input> <output> [--target-height N]")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    target_height = 220
    if "--target-height" in sys.argv:
        target_height = int(sys.argv[sys.argv.index("--target-height") + 1])

    img = Image.open(input_path)
    img = remove_checkerboard_background(img)
    # Speck removal runs at full resolution (to catch large-ish stray
    # blobs before they're cropped) *and* again after resize -- a speck
    # that's just under the full-res threshold can still be a big enough
    # fraction of the final, much-smaller image to be worth another pass,
    # where "small" is judged relative to the size that actually ships.
    img = remove_stray_specks(img, min_size=50)
    img = crop_to_content(img)
    img = resize_to_height(img, target_height)
    img = remove_stray_specks(img, min_size=20)
    img = crop_to_content(img)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path)
    print(f"Saved {output_path} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
