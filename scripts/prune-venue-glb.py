"""
Drop the empty node hierarchy from the venue GLB. Lossless.

The SketchUp export carries ~24,000 nodes, of which only ~330 hold a mesh: the rest
are component instances whose geometry now comes from placements.json, plus the
groups that held them. They cost 4.4 MB of the file's JSON and, worse, 24,000
Object3Ds that three.js walks every frame to update world matrices.

Every node on the path to a mesh is kept exactly as it was (name, transform,
parent), so world positions and the `proto_` parent names the viewer reads are
unchanged. Only subtrees that contain no mesh, camera or light are removed.

    python3 scripts/prune-venue-glb.py public/venue/arusha.glb
"""
import json
import struct
import sys


def read(path):
    b = open(path, 'rb').read()
    magic, ver, _ = struct.unpack('<III', b[:12])
    assert magic == 0x46546C67 and ver == 2, 'not a glTF 2 binary'
    jlen, jtype = struct.unpack('<II', b[12:20])
    j = json.loads(b[20:20 + jlen])
    rest = b[20 + jlen:]  # the BIN chunk, untouched
    return j, rest


def write(path, j, rest):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + len(rest)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, total))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A))
        fh.write(js)
        fh.write(rest)


def prune(j):
    nodes = j['nodes']
    keep = [False] * len(nodes)

    def visit(i):
        n = nodes[i]
        k = any(x in n for x in ('mesh', 'camera', 'skin')) or 'KHR_lights_punctual' in n.get('extensions', {})
        for c in n.get('children', []):
            k = visit(c) or k
        keep[i] = k
        return k

    roots = {r for s in j.get('scenes', []) for r in s.get('nodes', [])}
    for r in roots:
        visit(r)
    if 'cameras' in j:
        # The export's 'Active View' camera is not used by the viewer either.
        pass
    remap, out = {}, []
    for i, n in enumerate(nodes):
        if keep[i]:
            remap[i] = len(out)
            out.append(n)
    for n in out:
        if 'children' in n:
            ch = [remap[c] for c in n['children'] if c in remap]
            if ch:
                n['children'] = ch
            else:
                del n['children']
    for s in j.get('scenes', []):
        s['nodes'] = [remap[r] for r in s.get('nodes', []) if r in remap]
    j['nodes'] = out
    return len(nodes), len(out)


if __name__ == '__main__':
    path = sys.argv[1]
    j, rest = read(path)
    before, after = prune(j)
    write(path, j, rest)
    print(f'{path}: nodes {before:,} -> {after:,}')
