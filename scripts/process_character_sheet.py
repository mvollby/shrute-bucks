import os
from collections import deque
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GRID_COLS = 3
GRID_ROWS = 4

SHEETS = [
    (f"{REPO_ROOT}/incoming-assets/processed/dwight-sheet-a.jpeg", "a"),
    (f"{REPO_ROOT}/incoming-assets/processed/dwight-sheet-b.jpeg", "b"),
]

# Cells that are genuinely empty (near-solid black) -- not a real
# character, skip them outright.
EMPTY_CELLS = {("a", 3, 1), ("a", 3, 2)}

# Sheet "a" has a real ~17px solid-black export-artifact strip along its
# very bottom edge (~95% black across the full width there, vs. ~45% for
# a legitimate character's feet/shadow at the same relative spot in sheet
# b) -- trimmed only from sheet a's last row, never sheet b's (whose row-3
# characters' feet legitimately reach the sheet's last pixel row).
SHEET_A_BOTTOM_TRIM = 20

BASE_INSET = 10

OUT_DIR = f"{REPO_ROOT}/public/characters"


def is_near_white(pixel, tol=22):
    r, g, b = pixel[:3]
    return r > 255 - tol and g > 255 - tol and b > 255 - tol


def col_nonwhite(px, x, y0, y1):
    return sum(1 for y in range(y0, y1) if not is_near_white(px[x, y]))


def row_nonwhite(px, y, x0, x1):
    return sum(1 for x in range(x0, x1) if not is_near_white(px[x, y]))


# The nominal 1/3-width grid lines don't line up with real gaps between
# characters -- several of them (a beet plant's leaves, a raised
# thumbs-up hand, a bear's hindquarters) extend well past the nominal
# boundary, in one case by nearly 60px. Found by fixing two obviously
# clipped characters by hand-measuring their true edges, then finding the
# same problem elsewhere on a full visual re-check. Rather than
# hand-measure every boundary, this scans the real pixel content around
# each nominal grid line for the actual whitespace gap and crops there
# instead.
def find_gap(counts, min_gap=6):
    runs = []
    start = None
    for pos, count in counts:
        if count <= 2:
            if start is None:
                start = pos
        elif start is not None:
            runs.append((start, pos - 1))
            start = None
    if start is not None:
        runs.append((start, counts[-1][0]))
    if not runs:
        return None
    best = max(runs, key=lambda r: r[1] - r[0])
    return best if best[1] - best[0] >= min_gap else None


def column_boundaries(img, cell_w, cell_h, empty_cols_by_row):
    """For each row, the real x-gap at each of the 2 internal column
    lines (None where scanning wouldn't be meaningful, e.g. next to an
    empty cell)."""
    px = img.load()
    boundaries = {}
    for row in range(GRID_ROWS):
        y0, y1 = row * cell_h, (row + 1) * cell_h
        for boundary_col in (1, 2):
            bx = boundary_col * cell_w
            if row in empty_cols_by_row and boundary_col in empty_cols_by_row[row]:
                boundaries[(row, boundary_col)] = None
                continue
            counts = [(x, col_nonwhite(px, x, y0, y1)) for x in range(bx - 90, bx + 90)]
            boundaries[(row, boundary_col)] = find_gap(counts)
    return boundaries


def row_boundaries(img, cell_w, cell_h, skip_rows_by_col):
    """For each column, the real y-gap at each of the 3 internal row
    lines. The same bleed problem found horizontally (see find_gap's
    docstring above) turned out to affect row boundaries too -- a
    character's feet can extend past its own row line into the row
    below, which a fixed inset that's smaller than the true overlap
    doesn't clear (found from a real report: another character's feet
    showing at the top of a swapped-in image)."""
    px = img.load()
    boundaries = {}
    for col in range(GRID_COLS):
        x0, x1 = col * cell_w, (col + 1) * cell_w
        for boundary_row in (1, 2, 3):
            by = boundary_row * cell_h
            if col in skip_rows_by_col and boundary_row in skip_rows_by_col[col]:
                boundaries[(col, boundary_row)] = None
                continue
            counts = [(y, row_nonwhite(px, y, x0, x1)) for y in range(by - 90, by + 90)]
            boundaries[(col, boundary_row)] = find_gap(counts)
    return boundaries


def remove_background_and_specks(cell: Image.Image) -> Image.Image:
    px = cell.load()
    cw, ch = cell.size
    visited = [[False] * cw for _ in range(ch)]
    q = deque()

    def seed(x, y):
        if not visited[y][x] and is_near_white(px[x, y]):
            visited[y][x] = True
            q.append((x, y))

    for x in range(cw):
        seed(x, 0)
        seed(x, ch - 1)
    for y in range(ch):
        seed(0, y)
        seed(cw - 1, y)
    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < cw and 0 <= ny < ch and not visited[ny][nx] and is_near_white(px[nx, ny]):
                visited[ny][nx] = True
                q.append((nx, ny))

    # Drop any remaining disconnected speck bigger than a stray pixel but
    # too small to be real content (min_size=200: large enough to clear
    # genuine bleed fragments, well below any real character's own
    # connected pixel count).
    visited2 = [[False] * cw for _ in range(ch)]
    for sy in range(ch):
        for sx in range(cw):
            if visited2[sy][sx] or px[sx, sy][3] == 0:
                continue
            component = []
            cq = deque([(sx, sy)])
            visited2[sy][sx] = True
            while cq:
                x, y = cq.popleft()
                component.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < cw and 0 <= ny < ch and not visited2[ny][nx] and px[nx, ny][3] != 0:
                        visited2[ny][nx] = True
                        cq.append((nx, ny))
            if len(component) < 200:
                for x, y in component:
                    px[x, y] = (0, 0, 0, 0)

    bbox = cell.getbbox()
    return cell.crop(bbox) if bbox else cell


os.makedirs(OUT_DIR, exist_ok=True)

manifest = []
for path, sheet_id in SHEETS:
    sheet = Image.open(path).convert("RGB")
    w, h = sheet.size
    cell_w, cell_h = w // GRID_COLS, h // GRID_ROWS

    empty_cols_by_row: dict[int, set[int]] = {}
    empty_rows_by_col: dict[int, set[int]] = {}
    for (sid, er, ec) in EMPTY_CELLS:
        if sid == sheet_id:
            empty_cols_by_row.setdefault(er, set()).add(ec)
            empty_cols_by_row.setdefault(er, set()).add(ec + 1)
            empty_rows_by_col.setdefault(ec, set()).add(er)
            empty_rows_by_col.setdefault(ec, set()).add(er + 1)

    gaps = column_boundaries(sheet, cell_w, cell_h, empty_cols_by_row)
    row_gaps = row_boundaries(sheet, cell_w, cell_h, empty_rows_by_col)

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            if (sheet_id, row, col) in EMPTY_CELLS:
                continue

            x0 = col * cell_w + BASE_INSET
            x1 = (col + 1) * cell_w - BASE_INSET
            if col > 0:
                left_gap = gaps.get((row, col))
                if left_gap:
                    x0 = left_gap[1] - 2
            if col < GRID_COLS - 1:
                right_gap = gaps.get((row, col + 1))
                if right_gap:
                    x1 = right_gap[0] + 2

            y0 = row * cell_h + BASE_INSET
            if row > 0:
                top_gap = row_gaps.get((col, row))
                if top_gap:
                    y0 = top_gap[1] - 2

            if row == GRID_ROWS - 1:
                y1 = (row + 1) * cell_h
                if sheet_id == "a":
                    y1 -= SHEET_A_BOTTOM_TRIM
            else:
                y1 = (row + 1) * cell_h - BASE_INSET
                bottom_gap = row_gaps.get((col, row + 1))
                if bottom_gap:
                    y1 = bottom_gap[0] + 2

            cell = sheet.crop((x0, y0, x1, y1)).convert("RGBA")
            cell = remove_background_and_specks(cell)

            name = f"{sheet_id}-{row}{col}.png"
            cell.save(f"{OUT_DIR}/{name}")
            manifest.append({"name": name, "size": cell.size})

print(f"Total characters: {len(manifest)}")
for m in manifest:
    print(m)
