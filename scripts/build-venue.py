#!/usr/bin/env python3
"""
Turn the approved SketchUp venue export into the web venue: a manifest, a set of
branding textures, and the inputs for build-venue-geometry.py.

    python3 scripts/build-venue.py "01 - ARUSHA/3D PLAN/Castle Lite - Arusha 3D - Setup.glb"
    python3 scripts/build-venue.py "<same glb>" --tables-only   # VVIP inventory only
    /Applications/Blender.app/Contents/MacOS/Blender -b \
        --python scripts/build-venue-geometry.py -- public/venue/venue.json public/venue/arusha.glb

WHY THIS EXISTS, rather than a hand-modelled scene.

The source is 188 MB: 17,594,412 triangles, 18,693 draw calls, 194 textures totalling
3.5 GB of uncompressed VRAM. None of that is salvageable by the usual means. Instancing
would cut the download but not the frame — 40 copies of a 137k-triangle fridge door
still rasterise 5.5M triangles. Automatic decimation tears it apart, because the heavy
meshes weld to only 16% unique positions and carry 10,353 non-manifold edges. And the
texture *count* defeats atlasing before the sizes do.

So nothing is reused from the source except the facts: where everything is. Every
object's world-space transform is measured here, clean geometry is generated at those
coordinates, and the branding is re-extracted at web resolution. The layout stays
survey-accurate while the geometry is authored rather than inherited.

The same pass emits the VVIP table inventory, which is the point: the 3D map and the
sellable tables are one dataset, so they cannot drift apart.

Re-run both commands after any re-export of the GLB.
"""
import collections
import io
import json
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

# One source texture is 183 megapixels. It is ours, it is not hostile, and the default
# guard would silently drop it from the venue.
Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'public', 'venue')
TEX_DIR = os.path.join(OUT_DIR, 'tex')

# Recentre so X=0 is the stage axis and Z=0 is mid-field; -Z is "toward the stage".
ORIGIN_X, ORIGIN_Z = 145.55, -62.0
# Platform zones in source coordinates, taken from the deck geometry.
ZONE_Z = (-80, -43)
ZONE_A_X, ZONE_B_X = (119, 130), (161, 172)
STARR_CASTLE_ROWS = 5          # of 10; 3 tables a row, so rows 1-5 are tables 01-15 per platform
PRICE = {'starr-castle': 5_000_000, 'cold-rush': 3_000_000}

CT = {5120: ('i1', 1), 5121: ('u1', 1), 5122: ('i2', 2),
      5123: ('u2', 2), 5125: ('u4', 4), 5126: ('f4', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

# No hand-picked list. Every material the model actually textures is extracted, because
# choosing which artwork matters is exactly the judgement that put a TICKETING banner on
# the stage. The source decides what goes where; this only decides how big it may be.
def cap_for(w, h):
    """Budget by source resolution: designed artwork is exported large, tiles small."""
    px = w * h
    if px >= 8_000_000:
        return 2048          # campaign artboards, backdrops, the LED wall
    if px >= 1_500_000:
        return 1280
    return 768               # wood, grass, fabric and other repeating tile


class Glb:
    """Minimal glTF 2.0 binary reader — enough to walk nodes and pull accessors."""

    def __init__(self, path):
        self.f = open(path, 'rb')
        magic, _, _ = struct.unpack('<III', self.f.read(12))
        if magic != 0x46546C67:
            raise SystemExit(f'not a GLB: {path}')
        self.json = None
        self.bin = None
        while True:
            head = self.f.read(8)
            if len(head) < 8:
                break
            clen, ctype = struct.unpack('<II', head)
            if ctype == 0x4E4F534A:
                self.json = json.loads(self.f.read(clen))
            elif ctype == 0x004E4942:
                self.bin = self.f.tell()
                break
            else:
                self.f.seek(clen, 1)
        if self.json is None or self.bin is None:
            raise SystemExit('GLB missing a JSON or BIN chunk')
        self._cache = {}

    def accessor(self, i, cap=None):
        a = self.json['accessors'][i]
        dt, sz = CT[a['componentType']]
        nc = NC[a['type']]
        bv = self.json['bufferViews'][a['bufferView']]
        off = self.bin + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride') or sz * nc
        n = a['count']
        step = max(1, n // cap) if cap and n > cap else 1
        idx = np.arange(0, n, step)
        out = np.empty((len(idx), nc), dtype=np.dtype(dt))
        for k, ii in enumerate(idx):
            self.f.seek(off + ii * stride)
            out[k] = np.frombuffer(self.f.read(sz * nc), dtype=dt, count=nc)
        return out.astype(np.float64)

    def local_verts(self, mesh_i, cap=120):
        if mesh_i not in self._cache:
            parts = [self.accessor(p['attributes']['POSITION'], cap=cap)
                     for p in self.json['meshes'][mesh_i].get('primitives', [])]
            self._cache[mesh_i] = np.vstack(parts) if parts else np.zeros((0, 3))
        return self._cache[mesh_i]

    def image(self, i):
        bv = self.json['bufferViews'][self.json['images'][i]['bufferView']]
        self.f.seek(self.bin + bv.get('byteOffset', 0))
        return self.f.read(bv['byteLength'])


def node_matrix(n):
    """A node's local transform, as a 4x4. glTF matrices are column-major."""
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in n:
        m = m @ np.diag(list(n['scale']) + [1.0])
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        r = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ])
        rm = np.eye(4)
        rm[:3, :3] = r
        m = rm @ m
    if 'translation' in n:
        t = np.eye(4)
        t[:3, 3] = n['translation']
        m = t @ m
    return m


def walk(glb, owner_test=None):
    """
    Every mesh instance's world AABB.

    With `owner_test`, bounds are merged per nearest ancestor node satisfying it —
    which is how a booth is measured, since the source has no single mesh for one.
    """
    nodes = glb.json['nodes']
    roots = glb.json['scenes'][glb.json.get('scene', 0)]['nodes']
    out = collections.defaultdict(lambda: [np.full(3, 1e9), np.full(3, -1e9)])
    loose = []
    stack = [(r, np.eye(4), None, []) for r in roots]
    while stack:
        ni, parent, owner, chain = stack.pop()
        n = nodes[ni]
        world = parent @ node_matrix(n)
        name = n.get('name', '') or ''
        here = ni if (owner_test and owner_test(name)) else owner
        trail = chain + [name] if name else chain
        if 'mesh' in n:
            local = glb.local_verts(n['mesh'])
            if len(local):
                pts = (world @ np.hstack([local, np.ones((len(local), 1))]).T)[:3].T
                lo, hi = pts.min(0), pts.max(0)
                if owner_test:
                    if here is not None:
                        b = out[here]
                        b[0] = np.minimum(b[0], lo)
                        b[1] = np.maximum(b[1], hi)
                else:
                    loose.append((lo, hi, '/'.join(trail[-4:])))
        for c in n.get('children', []):
            stack.append((c, world, here, trail))
    return out if owner_test else loose


def zone_of(centre):
    if not (ZONE_Z[0] <= centre[2] <= ZONE_Z[1]):
        return None
    if ZONE_A_X[0] <= centre[0] <= ZONE_A_X[1]:
        return 'A'
    if ZONE_B_X[0] <= centre[0] <= ZONE_B_X[1]:
        return 'B'
    return None


def rows_of(points, gap=0.9):
    """Split points into rows along Z (stage first), merging anything within `gap`."""
    order = np.argsort(points[:, 2])
    rows, cur = [], [order[0]]
    for i in order[1:]:
        if points[i, 2] - points[cur[-1], 2] < gap:
            cur.append(i)
        else:
            rows.append(cur)
            cur = [i]
    rows.append(cur)
    return rows


# The coffee table at the heart of every VVIP set: the only blue-topped table on the
# platforms. Matched by material, because the leaf meshes are all named "Geom3D".
COFFEE_MATERIAL = 'MediumBlue'


def coffee_tables(glb):
    """World-space centre of every blue coffee-table top on the two platforms."""
    mats = glb.json['materials']
    blue = {i for i, m in enumerate(mats) if COFFEE_MATERIAL in (m.get('name') or '')}
    nodes = glb.json['nodes']
    roots = glb.json['scenes'][glb.json.get('scene', 0)]['nodes']
    per = {'A': [], 'B': []}
    stack = [(r, np.eye(4)) for r in roots]
    while stack:
        ni, parent = stack.pop()
        n = nodes[ni]
        world = parent @ node_matrix(n)
        if 'mesh' in n:
            for prim in glb.json['meshes'][n['mesh']].get('primitives', []):
                if prim.get('material') not in blue:
                    continue
                local = glb.accessor(prim['attributes']['POSITION'], cap=200)
                pts = (world @ np.hstack([local, np.ones((len(local), 1))]).T)[:3].T
                c = (pts.min(0) + pts.max(0)) / 2
                z = zone_of(c)
                if z:
                    per[z].append(c)
        for ch in n.get('children', []):
            stack.append((ch, world))
    return per


def build_tables(glb):
    """
    The bookable VVIP tables: one per VVIP set.

    A set is an L of two sofas with two ottomans and ONE blue coffee table in the crook
    of the L; the coffee table is what is sold and what the number marks. Until Nov 2026
    this counted `ottoman2` groups, which are the sofas: two per set, so every set was
    numbered twice (120) and each number pointed at a sofa. Counting the coffee tables
    gives the true 60 (30 per platform, 10 rows of 3), and their centres are where the
    3D tags, pads and beams go. The sofas (120) and hex ottomans (120) agree: two per set.
    """
    per = coffee_tables(glb)
    tables = []
    for plat in ('A', 'B'):
        pts = np.array(per[plat])
        if len(pts) == 0:
            raise SystemExit(f'no VVIP coffee tables found on platform {plat}')
        n = 0
        for ri, row in enumerate(rows_of(pts, gap=1.5), start=1):
            # Within a row, number from the venue centre line outward, so A01 and B01
            # are the same place on opposite platforms.
            for si, i in enumerate(sorted(row, key=lambda i: abs(pts[i, 0] - ORIGIN_X)), start=1):
                n += 1
                tier = 'starr-castle' if ri <= STARR_CASTLE_ROWS else 'cold-rush'
                x, y, z = float(pts[i, 0]), float(pts[i, 1]), float(pts[i, 2])
                out = 1 if x > ORIGIN_X else -1
                tables.append({
                    'id': f'{plat}{n:02d}', 'platform': plat, 'row': ri, 'seat': si,
                    'tier': tier, 'price': PRICE[tier],
                    # Centre of the coffee-table top.
                    'pos': [round(x - ORIGIN_X, 2), round(y, 2), round(z - ORIGIN_Z, 2)],
                    # Seated view: on the sofa side of the table, head height, facing the stage.
                    'camera': {
                        'pos': [round(x - ORIGIN_X + 1.6 * out, 2), 2.9, round(z - ORIGIN_Z + 2.2, 2)],
                        'target': [round((x * 0.25 + ORIGIN_X * 0.75) - ORIGIN_X, 2),
                                   2.20, round(-90.5 - ORIGIN_Z, 2)],
                    },
                })
    return tables


def cluster(points, radius):
    pts = np.array(points)
    used = np.zeros(len(pts), bool)
    out = []
    for i in np.lexsort((pts[:, 0], pts[:, 2])):
        if used[i]:
            continue
        d = np.linalg.norm(pts[:, [0, 2]] - pts[i, [0, 2]], axis=1)
        m = (d < radius) & (~used)
        used |= m
        out.append(pts[m].mean(0))
    return np.array(out)


def build_props(loose):
    """Standing VIP (cocktail) tables and crowd barrier runs, by size and name."""
    def token(chain):
        parts = [p for p in chain.split('/')
                 if p and not p.startswith(('Geom3D', '3DGeom', 'Group'))]
        return re.sub(r'_1$', '', parts[0]) if parts else ''

    cocktail, barrier = [], []
    for lo, hi, chain in loose:
        c = (lo + hi) / 2
        s = hi - lo
        tok = token(chain)
        if tok == 'Component' and abs(s[0] - 0.61) < 0.25 and abs(s[1] - 1.11) < 0.3 and lo[1] < 0.3:
            cocktail.append(c)
        elif tok == 'IOM Crowd barrier':
            barrier.append(c)
    return cluster(cocktail, 0.8), cluster(barrier, 1.1)


def build_textures(glb):
    """Re-extract the branding at web resolution. The campaign art is non-negotiable."""
    mats = glb.json.get('materials', [])
    texs = glb.json.get('textures', [])
    # Keyed by the name each material will carry in the viewer, which is not always the
    # source's own. SketchUp reuses a name for different materials (eight different
    # snow-wall prints are all "5ba6ad1a-…", the three perimeter banner runs are all
    # "Visibility banners-1"), and Blender, which builds the runtime model, renames the
    # repeats "name.001", "name.002" … in source order. Keying on the raw name let the
    # last repeat win for all of them: the snow wall's forest print was replaced by a
    # 412x62 grey strip and every banner run wore the same crop. Name them as Blender
    # will, so each image goes back on the material it came off.
    taken = {m.get('name', '') for m in mats}
    repeats = {}
    by_name = {}
    for m in mats:
        name = m.get('name', '')
        if name in repeats:
            n = repeats[name]
            while True:
                n += 1
                cand = f'{name}.{n:03d}'
                if cand not in taken:
                    break
            repeats[name] = n
            taken.add(cand)
            name = cand
        else:
            repeats[name] = 0
        pbr = m.get('pbrMetallicRoughness', {})
        ext = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {})
        t = pbr.get('baseColorTexture', {}).get('index')
        if t is None:
            t = ext.get('diffuseTexture', {}).get('index')
        if t is not None and t < len(texs):
            src = texs[t].get('source')
            if src is not None:
                by_name[name] = src
    os.makedirs(TEX_DIR, exist_ok=True)
    kept, total = 0, 0
    # Source material name -> texture slug. The viewer uses this to put each image back
    # on the material it came off, so artwork lands where the model put it.
    mapping = {}
    seen_slug = {}
    for mat_name, img_idx in sorted(by_name.items()):
        base, dot, num = mat_name.rpartition('.')
        if not (dot and len(num) == 3 and num.isdigit()):
            base, num = mat_name, ''
        slug = re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')[:40] or f'mat{img_idx}'
        if num:
            slug = f'{slug}-{num}'
        if slug in seen_slug and seen_slug[slug] != img_idx:
            slug = f'{slug}-{img_idx}'
        seen_slug[slug] = img_idx
        try:
            img = Image.open(io.BytesIO(glb.image(img_idx)))
            img.load()
        except Exception as e:
            print(f'  [skip] {mat_name}: {e}')
            continue
        w, h = img.size
        scale = min(1.0, cap_for(w, h) / max(w, h))
        img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        path = os.path.join(TEX_DIR, slug + '.webp')
        img.save(path, 'WEBP', quality=84, method=6)
        total += os.path.getsize(path)
        kept += 1
        mapping[mat_name] = slug
    with open(os.path.join(OUT_DIR, 'textures.json'), 'w') as fh:
        json.dump(mapping, fh, separators=(',', ':'))
    print(f'  {kept} textures from {len(by_name)} textured materials, '
          f'{total / 1024 / 1024:.2f} MB')


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    if not os.path.isabs(src):
        src = os.path.join(ROOT, src)
    print(f'reading {os.path.basename(src)} ({os.path.getsize(src) / 1e6:.0f} MB)')
    glb = Glb(src)

    # --tables-only: re-derive just the VVIP inventory into the existing venue.json,
    # leaving the layout, textures and web geometry exactly as they are.
    if '--tables-only' in sys.argv:
        path = os.path.join(OUT_DIR, 'venue.json')
        with open(path) as fh:
            venue = json.load(fh)
        venue['tables'] = build_tables(glb)
        starr = sum(1 for t in venue['tables'] if t['tier'] == 'starr-castle')
        with open(path, 'w') as fh:
            json.dump(venue, fh, separators=(',', ':'))
        print(f'  {len(venue["tables"])} VVIP tables ({starr} Starr Castle) -> {path}')
        return

    print('measuring layout…')
    loose = walk(glb)
    print(f'  {len(loose)} mesh instances')
    tables = build_tables(glb)
    cocktail, barrier = build_props(loose)
    starr = sum(1 for t in tables if t['tier'] == 'starr-castle')
    print(f'  {len(tables)} VVIP tables ({starr} Starr Castle / {len(tables) - starr} Cold Rush)')
    print(f'  {len(cocktail)} standing VIP tables, {len(barrier)} barrier runs')

    def p3(x, y, z):
        return [round(x - ORIGIN_X, 2), round(y, 2), round(z - ORIGIN_Z, 2)]

    venue = {
        'meta': {
            'site': 'Castle Lite Unlocks 2026 - Arusha', 'units': 'metres', 'up': 'Y',
            'axis_x': ORIGIN_X, 'origin_shift': [ORIGIN_X, 0, ORIGIN_Z],
            'note': ('Recentred: X=0 is the stage axis, Z=0 is mid-field. Facing the '
                     'stage is -Z. Low (negative) X is audience LEFT = Platform A.'),
        },
        'ground': {'size': [85.2, 111.1], 'centre': [130.7 - ORIGIN_X, -48.1 - ORIGIN_Z]},
        'stage': {
            'deck': {'centre': p3(146.4, 0.0, -90.5), 'size': [14.43, 1.51, 10.32]},
            'catwalk': {'centre': p3(146.3, 0.0, -86.9), 'size': [14.12, 1.51, 3.01]},
            'roof': {'centre': p3(146.6, 8.64, -90.4), 'size': [15.86, 2.22, 9.53]},
            'screen': {'centre': p3(146.8, 3.38, -94.6), 'size': [8.81, 4.08, 0.55]},
            'line_array': [{'centre': p3(140.0, 4.3, -86.0), 'size': [0.55, 2.5, 0.12]},
                           {'centre': p3(153.3, 4.3, -86.0), 'size': [0.55, 2.5, 0.12]}],
        },
        'platforms': [
            {'id': 'A', 'centre': p3(124.7, 0.0, -62.8), 'size': [10.86, 1.06, 33.99],
             'backdrop': {'centre': p3(120.1, 0.06, -63.0), 'size': [0.71, 3.32, 12.27]}},
            {'id': 'B', 'centre': p3(166.4, 0.0, -60.4), 'size': [10.64, 1.06, 33.93],
             'backdrop': {'centre': p3(171.1, 0.06, -60.3), 'size': [0.59, 3.32, 12.28]}},
        ],
        'cocktail': {
            'count': len(cocktail), 'size': [0.61, 1.11, 0.61],
            'note': 'Standing VIP section. Area access, not individually bookable.',
            'positions': [p3(p[0], 0.0, p[2]) for p in cocktail],
        },
        'barriers': {'count': len(barrier),
                     'positions': [p3(p[0], 0.0, p[2]) for p in barrier]},
        'towers': [{'centre': p3(91.3, 0.0, -32.0), 'size': [1.10, 5.20, 13.33]},
                   {'centre': p3(95.8, 0.0, -31.7), 'size': [1.09, 5.20, 13.33]}],
        'excluded': {'crowd_figures': 372,
                     'note': 'Human figures present in the source; omitted by direction.'},
        'tables': tables,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, 'venue.json')
    with open(path, 'w') as fh:
        json.dump(venue, fh, separators=(',', ':'))
    print(f'  wrote {path} ({os.path.getsize(path) / 1024:.1f} KB)')

    print('extracting branding…')
    build_textures(glb)
    print('\nnow run:\n  /Applications/Blender.app/Contents/MacOS/Blender -b \\\n'
          '      --python scripts/build-venue-geometry.py -- \\\n'
          f'      "{path}" "{os.path.join(OUT_DIR, "arusha.glb")}"')


if __name__ == '__main__':
    main()
