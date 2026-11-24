"""
Redraw the venue from its own geometry, as economically as the shapes allow.

    # once, to cache the slow import (~7 min):
    blender -b --python scripts/build-venue-geometry.py -- <source.glb> --cache <cache.blend>
    # thereafter, seconds:
    blender -b --python scripts/build-venue-geometry.py -- <cache.blend> <out.glb> [placements.json]

THERE IS NO TRIANGLE TARGET, deliberately. Two earlier attempts aimed at a number and
both produced something that did not look like the venue. Fidelity is the constraint and
the triangle count is whatever honest simplification leaves behind. A per-class cost
table is printed so the expensive classes can be cut by eye afterwards — faithful first,
cheaper second.

Three passes, in increasing order of what they can cost you:

  1. DROP      Classes that cannot be seen from a flyover, or are excluded by direction.
               This is where the saving is: most of the source's 17.6M triangles is beer
               bottles, M8 bolts, chain links and rigging hardware.
  2. WELD      Merge coincident vertices. Lossless in shape. The exporter wrote these
               meshes with ~16% unique positions, so this is enormous on its own, and it
               is what makes pass 3 possible at all.
  3. DISSOLVE  Merge coplanar faces (limited dissolve, 2 degrees). Also effectively
               lossless: a flat stage panel modelled as 500 triangles becomes 2 with no
               visible change. SketchUp exports are full of over-tessellated flat
               surfaces; genuinely curved geometry exceeds the angle and survives.

No collapse decimation anywhere — that is the operation that rounds corners and punches
holes, and nothing here needs it.

CLASSIFYING OBJECTS. Every leaf mesh is named "Geom3D"; the meaning is on its ancestors,
at depths that vary from 1 to 6, under a single scene root called "Node_0". An earlier
version took the top-most ancestor, got "Node_0" for all 18,693 meshes, and silently did
nothing. So matching is by ANCESTOR SET: a mesh is dropped if any ancestor is in DROP,
and instanced by the nearest ancestor found in INSTANCE.

Materials are kept exactly as the source assigned them; the viewer re-attaches each
extracted texture by material name, so artwork lands on the surface it came off.
"""
import bpy
import bmesh
import json
import math
import os
import re
import sys
import time

import mathutils

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(ARGS) < 2:
    raise SystemExit(__doc__)
SRC = ARGS[0]
CACHE_MODE = ARGS[1] == '--cache'
OUT = ARGS[2] if CACHE_MODE else ARGS[1]
POS_OUT = (ARGS[2] if len(ARGS) > 2 and not CACHE_MODE
           else os.path.join(os.path.dirname(os.path.abspath(OUT)), 'placements.json'))

ORIGIN_X, ORIGIN_Z = 145.55, -62.0
WELD_DIST = 0.003
DISSOLVE_ANGLE = math.radians(2.0)
GENERIC = ('Node_', 'Geom3D', '3DGeom', 'Group')

# Removed entirely: invisible from a low flyover, or excluded by direction.
DROP = {
    # NOT Component#13. It was in here as "beer bottles, 1,198 copies", and it is the
    # whole bar tent beside the merch container — canopy, printed counter, poles and two
    # stocked fridges — and, because clean() folds the _1 suffix, its twin across the
    # field as well. The bottles are real (72 per fridge), but they live inside the bar;
    # dropping the bar to lose them is what left an empty patch of grass where the
    # concept has a Castle Lite bar. Francis flagged it on 2026-11-23.
    # What is actually unaffordable in it is the inside of the fridges, so that is what
    # goes: kept, the two bars cost 7M triangles after simplification and took the venue
    # from 1.9M to 8.9M. The cabinets, glass, canopy, counter and poles all stay.
    'Component#37_冰柜d861',          # fridge wire shelving, 137k tris a rack, 40 racks
    'Component#35',                   # the bottles stocked on those shelves, 720 of them
    'Component(8)#1',                 # M8 bolts in the screen truss
    'Component#289',                  # more truss bolt detail
    'Component#4',                    # human figures - crowd excluded by direction
    'pigum 1m', 'pigum 0',            # rigging shackles
    'Grillete500', 'Grillete G410', 'Pasador500',
    'llave', 'heads', 'dw',
    'High End Flying Pig Full B',
    'Behringer Xenyx 1204 usb mixer',
    'Pioneer DJ', 'djm 800', 'Pioneer CDM 100',
    'Componente(2)#27',
    'Component#301', 'Component#300',
    # NOT Component#311. It was in here as clutter and it is the side LED screen
    # assembly: two 3.6 x 4.9 m portrait panels at X -10.3 and +12.4, carrying the
    # screen artwork. Dropping it left the bare support towers standing either side of
    # the stage with nothing on them, which is exactly what Francis circled. 62k tris.
    'いすゞ　ギガ　キャブ＆シャシ原図', 'タイヤ　前輪',
    'Full Boar 4', 'IEC plug',
    'Grouper#17', 'Grouper#15', 'Grouper#6',
    'link', 'link#1',                 # hoist chain links hanging at 7 m — 723k tris
    'High End Flying Pig Full Boar 4',   # moving-head internals (full name)
    "CFD 9437'S Lightbar (NOT DONE)#2",  # lighting bars, unfinished in the source
}

# Exported once, placed many times. Exact, so it costs nothing in fidelity.
INSTANCE = {
    'ottoman2': 'proto_sofa',
    'metal 4': 'proto_table',
    'IOM Crowd barrier': 'proto_barrier',
    'Crowd Barrier': 'proto_barrier',
    'sub 800w': 'proto_sub',
    # NOT the hung line arrays. They are not copies of each other: the hangs differ by
    # up to 3.3 m in length because they carry different numbers of cabinets, so one
    # prototype placed 20 times put 18 of them up to 2 m wrong however the transform
    # was computed. 20 copies stay static and exact rather than instanced and wrong.

    'cushion': 'proto_cushion',
    'Cushio2': 'proto_cushion2',
    # The cost table showed these sitting static in their hundreds: 720 copies of
    # metal1 alone is 607,680 triangles and 720 draw calls' worth of mesh. Repeats
    # belong in an InstancedMesh whatever they are.
    'Coctails': 'proto_cocktail',
    'metal1': 'proto_metal1',
    'metal2': 'proto_metal2',
    'metal7': 'proto_metal7',
    'Component#8': 'proto_c8',
    'Component#171': 'proto_c171',
    'patt 123 lamp 1#1': 'proto_lamp',
    'LED': 'proto_led',
    'basket+ball+2': 'proto_hoop',
}


def log(*a):
    print('[geo]', *a, flush=True)


def clean(name):
    """Blender's copy suffix and the model's mirrored-side suffix are not meaning."""
    n = (name or '').split('.')[0]
    return n[:-2] if n.endswith('_1') else n


def ancestry(obj):
    """Cleaned ancestor names, leaf first."""
    out = []
    o = obj
    while o is not None:
        out.append(clean(o.name))
        o = o.parent
    return out


def class_of(chain):
    """The nearest meaningful ancestor — specific enough to cut by."""
    for n in chain:
        if n and not n.startswith(GENERIC):
            return n
    return '(generic)'


def tris_of(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def simplify(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD_DIST)
    if bm.edges:
        bmesh.ops.dissolve_limit(
            bm, angle_limit=DISSOLVE_ANGLE, verts=list(bm.verts), edges=list(bm.edges),
            delimit={'NORMAL', 'MATERIAL'})
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.update()


def corners(objs):
    cs = []
    for o in objs:
        cs += [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return cs


def rot_only(m):
    """The rotation of a transform, with translation and scale stripped out."""
    _, q, _ = m.decompose()
    return q.to_matrix().to_4x4()


def obb_centre(names, R):
    """Centre of a group's bounding box, measured in the group's OWN frame.

    A world-axis-aligned centre is not a landmark — rotate the object and it moves —
    so it cannot be used to line two copies up. Measuring the box in the frame the
    copy is rotated into makes the centre travel with the geometry instead.
    """
    Ri = R.inverted()
    pts = []
    for n in names:
        o = bpy.data.objects.get(n)
        if o is not None:
            pts += [Ri @ (o.matrix_world @ mathutils.Vector(c)) for c in o.bound_box]
    if not pts:
        return None
    lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return R @ ((lo + hi) / 2)


def table(rows, header, limit=30):
    log('')
    log(f'{header:<34}{"copies":>8}{"source":>12}{"after":>11}{"kept":>7}')
    for after, before, name, n in rows[:limit]:
        log(f'{name[:34]:<34}{n:>8}{before:>12,}{after:>11,}{after/max(before,1)*100:>6.0f}%')
    sb, sa = sum(r[1] for r in rows), sum(r[0] for r in rows)
    log(f'{"TOTAL":<34}{"":>8}{sb:>12,}{sa:>11,}{sa/max(sb,1)*100:>6.0f}%')
    return sb, sa


def main():
    t0 = time.time()
    if SRC.lower().endswith('.blend'):
        log(f'loading cached {os.path.basename(SRC)}…')
        bpy.ops.wm.open_mainfile(filepath=SRC)
    else:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        log(f'importing {os.path.basename(SRC)} ({os.path.getsize(SRC)/1e6:.0f} MB) — slow…')
        bpy.ops.import_scene.gltf(filepath=SRC)

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    total = sum(tris_of(o) for o in meshes)
    log(f'{len(meshes):,} meshes / {total:,} triangles ({time.time()-t0:.0f}s)')

    if CACHE_MODE:
        bpy.ops.wm.save_as_mainfile(filepath=OUT)
        log(f'cached {OUT} ({os.path.getsize(OUT)/1e6:.0f} MB) — reuse with the second form')
        return

    chains = {o.name: ancestry(o) for o in meshes}

    # ── pass 1: drop ────────────────────────────────────────────────────────
    doomed, dropped = [], 0
    for o in meshes:
        if DROP & set(chains[o.name]):
            doomed.append(o)
            dropped += tris_of(o)
    for o in doomed:
        bpy.data.objects.remove(o, do_unlink=True)
    log(f'dropped {len(doomed):,} meshes / {dropped:,} tris '
        f'({dropped/max(total,1)*100:.1f}%) — clutter, rigging, crowd')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']

    # ── pass 2: pull out repeated objects ───────────────────────────────────
    # Everything here is tracked BY NAME. joining and deleting invalidates held Python
    # references, and an earlier version crashed on exactly that ("StructRNA ... has
    # been removed") after the first prototype was built.
    assign = {}
    for o in meshes:
        node = o
        while node is not None:
            n = clean(node.name)
            if n in INSTANCE:
                assign[o.name] = (INSTANCE[n], node.name)
                break
            node = node.parent
    want = {}
    for mesh_name, (proto, gkey) in assign.items():
        want.setdefault(proto, {}).setdefault(gkey, []).append(mesh_name)

    # glTF is Y-up and Blender is Z-up; the exporter maps (x,y,z) -> (x,z,-y). The same
    # basis change has to be applied to an instance transform, or every rotated copy
    # lands on its side.
    B2G = mathutils.Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    SHIFT = mathutils.Matrix.Translation((-ORIGIN_X, 0.0, -ORIGIN_Z))

    placements, proto_names = {}, []
    for proto_name, groups in want.items():
        def weight(names):
            return sum(tris_of(bpy.data.objects[n]) for n in names if n in bpy.data.objects)

        groups = {k: v for k, v in groups.items() if any(n in bpy.data.objects for n in v)}
        if not groups:
            continue
        best_key = max(groups, key=lambda k: weight(groups[k]))
        best = [n for n in groups[best_key] if n in bpy.data.objects]

        # Every instance is the prototype under its own transform. Baking the chosen
        # one to world and expressing the others relative to it keeps rotation exact,
        # which a bounding-box centre cannot: a bounds centre is position only, so the
        # rotated truss sections and angled furniture would all snap to one orientation.
        ref = bpy.data.objects.get(best_key)
        m_best = (ref.matrix_world.copy() if ref is not None
                  else bpy.data.objects[best[0]].matrix_world.copy())
        m_best_inv = m_best.inverted_safe()
        R_best = rot_only(m_best)
        c_best = obb_centre(best, R_best)
        c_best_g = B2G @ c_best if c_best is not None else None

        # Rotation and scale come from the node transforms. The TRANSLATION does not,
        # and that was a real bug: this export does not keep a copy's position in its
        # node. SketchUp baked each cocktail table's offset into its own mesh data, so
        # all 115 Coctails nodes sit on top of each other and the node transform says
        # nothing about where the table is. Taking the position from the node put 69 of
        # them up to 15.6 m out, and 602 of the 1,200 lattice panels on the VVIP
        # furniture up to 44 m out — which is the geometry that looked "missing".
        #
        # So the copies are lined up by the one landmark that travels with the
        # geometry wherever the offset was baked: the centre of each group's bounding
        # box measured in its own rotated frame. Worst corner error over all 3,131
        # instances drops from 44.2 m to 0.16 m.
        xforms = []
        for gkey, names in groups.items():
            node = bpy.data.objects.get(gkey)
            if node is None or c_best_g is None:
                continue
            live = [n for n in names if n in bpy.data.objects]
            c = obb_centre(live, rot_only(node.matrix_world))
            if c is None:
                continue
            rel = SHIFT @ B2G @ (node.matrix_world @ m_best_inv) @ B2G.inverted()
            _, q, sc = rel.decompose()
            # Land the prototype's own centre exactly on this copy's centre.
            t = (SHIFT @ (B2G @ c)) - (q.to_matrix() @ mathutils.Vector(
                (c_best_g.x * sc.x, c_best_g.y * sc.y, c_best_g.z * sc.z)))
            xforms.append([round(t.x, 3), round(t.y, 3), round(t.z, 3),
                           round(q.x, 5), round(q.y, 5), round(q.z, 5), round(q.w, 5),
                           round(sc.x, 4), round(sc.y, 4), round(sc.z, 4)])
        if not xforms:
            continue
        pts = xforms

        bpy.ops.object.select_all(action='DESELECT')
        for n in best:
            bpy.data.objects[n].select_set(True)
        bpy.context.view_layer.objects.active = bpy.data.objects[best[0]]
        if len(best) > 1:
            bpy.ops.object.join()
        p = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        before = tris_of(p)
        simplify(p)
        # No re-origin: the prototype stays where the model put it and each instance
        # transform is expressed relative to that, so copy zero sits exactly on the
        # original and the rest follow from their own matrices.
        p.name = proto_name
        kept_name = p.name
        proto_names.append(kept_name)
        placements[proto_name] = pts
        log(f'  {proto_name:<16}{len(pts):>5} placements   proto {before:>7,} -> {tris_of(p):>6,} tris')

        for names in groups.values():
            for n in names:
                if n == kept_name:
                    continue
                o = bpy.data.objects.get(n)
                if o is not None:
                    bpy.data.objects.remove(o, do_unlink=True)

    # ── pass 3: weld + dissolve the rest ────────────────────────────────────
    log('weld + coplanar dissolve on what stays put…')
    protos = {n for n in proto_names}
    buckets = {}
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name not in protos:
            buckets.setdefault(class_of(chains.get(o.name, [o.name])), []).append(o.name)
    rows = []
    for cls, names in buckets.items():
        live = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
        if not live:
            continue
        before = sum(tris_of(o) for o in live)
        for o in live:
            try:
                simplify(o)
            except Exception as e:
                log(f'  ! {cls}: {e}')
        rows.append((sum(tris_of(o) for o in live), before, cls, len(live)))
    rows.sort(reverse=True)
    _, static_after = table(rows, 'STATIC CLASS (cut candidates)')

    # ── join statics by material ────────────────────────────────────────────
    by_mat = {}
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name not in protos:
            by_mat.setdefault(
                o.data.materials[0].name if o.data.materials else 'none', []).append(o.name)
    joined = []
    for names in by_mat.values():
        names = [n for n in names if n in bpy.data.objects]
        if not names:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for n in names:
            bpy.data.objects[n].select_set(True)
        bpy.context.view_layer.objects.active = bpy.data.objects[names[0]]
        if len(names) > 1:
            bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = f'static_{len(joined):03d}'
        joined.append(j)

    # Recentre the static geometry onto the same origin the manifest and the
    # placements already use (X=0 on the stage axis, Z=0 mid-field). The placements
    # are computed recentred, so without this the instanced furniture and the
    # structure it stands on end up ~145 m apart.
    #
    # Blender is Z-up and the exporter maps (x, y, z) -> glTF (x, z, -y), so a glTF
    # shift of (-ORIGIN_X, 0, -ORIGIN_Z) is a Blender shift of (-ORIGIN_X, ORIGIN_Z, 0).
    # Shift the OBJECT in world space, not the mesh data. Joined objects inherit a
    # rotation from whichever object led the join, so a mesh-local translate comes out
    # rotated — which is how an earlier run left the whole site unmoved and off camera.
    shift = mathutils.Matrix.Translation((-ORIGIN_X, ORIGIN_Z, 0.0))
    moved = 0
    for o in bpy.data.objects:
        # Prototypes are excluded: the recentre is already folded into every instance
        # transform, and moving the mesh as well would apply it twice.
        if o.type == 'MESH' and o.name not in protos:
            o.matrix_world = shift @ o.matrix_world
            moved += 1
    log(f'recentred {moved} static meshes onto the stage axis')

    # ── validate against the manifest before writing anything ───────────────
    # The instance transforms are relative to each prototype's own world position, so
    # a sign error anywhere produces plausible-looking numbers in a wildly wrong place.
    # Checking the sofas against the 120 surveyed table positions catches that cheaply.
    try:
        man = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'venue.json')
        if 'proto_sofa' in placements and os.path.exists(man):
            with open(man) as fh:
                tables = json.load(fh)['tables']
            sofa = bpy.data.objects.get('proto_sofa')
            cs = corners([sofa])
            base = mathutils.Vector((sum(c.x for c in cs) / 8, sum(c.y for c in cs) / 8,
                                     min(c.z for c in cs)))
            # The instance transform rotates about the origin, so the centre moves to
            # R @ centre + t. Adding t to the centre is only right for unrotated
            # copies, and reported a 328 m error on a scene that was in fact exact.
            proto_g = mathutils.Vector((base.x, base.z, -base.y))
            worst = 0.0
            for x in placements['proto_sofa']:
                q = mathutils.Quaternion((x[6], x[3], x[4], x[5]))
                c = q.to_matrix() @ proto_g + mathutils.Vector((x[0], x[1], x[2]))
                worst = max(worst, min(math.hypot(c.x - t['pos'][0], c.z - t['pos'][2])
                                       for t in tables))
            log(f'CHECK sofa placements vs manifest: worst nearest-table error {worst:.2f} m'
                f'  ({"OK" if worst < 2.0 else "FAIL — placements are in the wrong space"})')
    except Exception as e:
        log(f'CHECK skipped: {e}')

    inst = sum(tris_of(bpy.data.objects[n]) * len(placements[n])
               for n in proto_names if n in bpy.data.objects)
    log('')
    log(f'PER FRAME  static {static_after:,} + instanced {inst:,} = {static_after + inst:,} triangles')
    log(f'           {len(joined) + len(proto_names)} draw calls ({len(joined)} static, {len(proto_names)} instanced)')

    with open(POS_OUT, 'w') as fh:
        json.dump(placements, fh, separators=(',', ':'))
    log(f'wrote {POS_OUT}')

    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_materials='EXPORT', export_image_format='NONE',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_normals=True, export_texcoords=True, export_tangents=False,
        export_cameras=False, export_lights=False, export_extras=False)
    # Strip the ~23,000 empty instance/group nodes the export leaves behind. Lossless
    # (see the script); takes the file from 14.8 MB to 10.8 MB and spares the viewer
    # walking 24,000 empty objects every frame.
    import runpy
    sys.argv = ['prune', OUT]
    runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prune-venue-glb.py'),
                   run_name='__main__')
    log(f'wrote {OUT} ({os.path.getsize(OUT)/1024:.0f} KB) in {time.time()-t0:.0f}s')


def parents(o):
    o = o.parent
    while o is not None:
        yield o
        o = o.parent


main()
