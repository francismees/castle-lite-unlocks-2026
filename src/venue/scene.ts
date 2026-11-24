import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PICK_COLOUR, TIER_COLOUR, type Tier, type Venue, type VenueTable } from './types'
import { scenes } from '../config/scenes'

/**
 * The Arusha venue scene.
 *
 * Night, by direction: it is a New Year's Eve event, and darkness is also what lets a
 * modest triangle count read as atmosphere rather than as a model.
 *
 * The geometry is the venue's own, welded and decimated by scripts/build-venue-geometry.py,
 * not a box approximation — silhouettes are the thing the eye actually reads at flyover
 * distance, and a box has none. Repeated objects (sofas, tables, barriers, line-array
 * cabinets) ship as one real prototype each and are placed with InstancedMesh, so several
 * hundred of them cost one draw call.
 *
 * Lighting is a stage rig rather than a uniform wash: one shadow-casting key, a cool
 * ambient fill, warm spots on the deck, and emissive surfaces for the LED wall and the
 * platform edges. Bloom is what turns those emissives into light rather than bright
 * paint, and it is the single biggest difference between this reading as an event and
 * reading as a diagram.
 */

// Night, but not a void. The venue's own albedo is mostly deep blue banner vinyl and
// dark decking, so an unlit night scene crushes to black — which is exactly what the
// first attempt did. The ambient here is set against the source render: grass must
// still read green and the marquees and furniture must still read white.
const SKY = 0x070c1a

/**
 * What the far end of the site fades into.
 *
 * Deliberately NOT the sky colour. Fog that matches the background is invisible as
 * fog — it just deletes distance. A hair of blue above it reads as the haze a lit
 * venue actually has hanging over it, and it is what the sky beams cut through.
 */
const HAZE = 0x121d3d

/**
 * The shape of the frames every angle is matched against.
 *
 * Francis's renders are 2400 x 1350 out of SketchUp, so 16:9, and SketchUp states a
 * camera's field of view vertically. Every `fov` in scenes.ts is therefore a vertical
 * angle on a 16:9 frame, and applyFov is what turns that into the right angle for
 * whatever shape the window actually is.
 */
const REF_ASPECT = 16 / 9
/** SketchUp's own default, and the lens the approach stops were shot on. */
const REF_FOV = 35

/**
 * The widest vertical lens the viewer will ever use, whatever the window shape.
 *
 * Covering a 16:9 frame on a 9:19.5 phone needs 113 degrees vertically, and 113
 * degrees is a fisheye — on the ice arch stop it bent the booth roof over the top of
 * the frame and left the arch itself unreadable. 72 degrees is where covering stops
 * and distortion starts, and it is also, not by coincidence, what matching the
 * render's DIAGONAL gives on a phone: the frame keeps its proportions, and a portrait
 * screen loses a little off the sides the way any portrait crop does.
 */
const MAX_FOV = 72

/**
 * The surfaces that are genuinely screens, named by the source's own materials, and
 * which cut of the hero loop belongs on each.
 *
 * This replaces the test /screen|led|artboard 7\b/, which also matched "Artboard 7
 * copy", "copy 2", "copy 3" and "copy 4" — the printed banner walls standing around
 * the whole site. Those were being lit from within, which is most of the reason the
 * night scene read as though everything glowed.
 *
 * `*99` is the main LED wall: 4,968 panel modules making a 9.2 x 4.3 m screen behind
 * the stage, so 2.1:1 landscape, and tunnel-wide is 2.33:1. The ChatGPT image is the
 * pair of 3.6 x 4.9 m panels on the towers either side, so portrait, and tunnel-tall
 * is the cut that fits them. Picking per surface is the whole point — one cut cannot
 * serve both without being squashed on one of them.
 */
const SCREENS: Record<string, 'wide' | 'tall'> = {
  // The two 3.6 x 4.9 m panels on the towers either side of the stage. Portrait, so
  // they take the portrait cut. This material is used by nothing else in the export,
  // so making it a pure emitter lights the panels and nothing more.
  'ChatGPT Image Jul 29, 2026, 09_22_53 AM': 'tall',
  // The main wall is NOT here. It has no material left to key on: see mainScreen().
}

/**
 * Source textures too small to carry the surface the model stretches them over.
 *
 * `*32` is 54 x 143 pixels and the model maps it across the ~29 x 10 m stage canopy.
 * That is the smeared, oddly shaded roof. No re-export fixes it because the pixels do
 * not exist, so the honest thing is to stop treating it as artwork and use its own
 * average colour flat — which is what the canopy is in the source anyway, a plain pale
 * tarpaulin.
 *
 * This is deliberately a named list and NOT a rule about small textures: the 128 px
 * corrugated metals, the diamond mesh and the 144 px glass in this export all tile
 * correctly over their surfaces and must keep their maps.
 */
const TOO_SMALL_TO_MAP = new Set(['*32'])

/**
 * How hard the tier markers are driven.
 *
 * They used to be unlit and exempt from tone mapping at 2.1x, which put 120 strips of
 * pure blue over the bloom threshold and lying across the VVIP decks. Tone-mapped and
 * driven under the threshold they read as floor fixtures, which is what a venue would
 * actually have there, rather than as interface painted on top of one.
 */
/**
 * The opening sequence's rhythm, in ms.
 *
 * Fourteen stops at GLIDE + HOLD is about forty seconds end to end, which is a long
 * time to leave a page moving — so it is only ever the *unattended* case. One touch of
 * the canvas ends it, and the rail jumps straight to any angle. The first stop holds
 * longer than the rest because it is the one the visitor is still orienting in.
 */
const TOUR_GLIDE = 1900
const TOUR_HOLD = 1150
const TOUR_OPEN_HOLD = 2200
/** A rail jump is a deliberate act, so it moves faster than the sequence drifts. */
const TOUR_JUMP = 950

const MARKER_GAIN = { rest: 1.75, active: 2.7, dimmed: 0.6 }

/** Table mode cameras. AERIAL is the establishing shot; TABLES_VIEW frames both
 *  platforms and the stage together, high enough that every table reads as a pad. */
const AERIAL = { pos: [0, 96, 74] as [number, number, number], target: [0, 0, -4] as [number, number, number] }
const TABLES_VIEW = { pos: [0, 50, 50] as [number, number, number], target: [0, 0, -1] as [number, number, number] }
/** Portrait screens: both platforms are ~52 m apart, so the phone shot goes higher and
 *  steeper to keep them inside the narrow frame, and sits back for the bottom sheet. */
const TABLES_VIEW_TALL = { pos: [0, 92, 66] as [number, number, number], target: [0, 0, 9] as [number, number, number] }
const BEACON_HEIGHT = 3.4
/** Play Green, for tables already in this basket. */
const PICK_TAKEN = 0x18c47a
const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2])

/** How one drawn beam is shaped and tinted. Defaults reproduce the VVIP wall wash. */
interface BeamLook {
  /** 0 = a parallel shaft, 1 = a cone that opens to the full card width. */
  spread?: number
  /** How fast it dies along its length. Higher is shorter. */
  falloff?: number
  /** Colour at the thin flanks of the cone, 0-255. */
  edge?: [number, number, number]
  /** Colour at the hot core, 0-255. */
  core?: [number, number, number]
}

/**
 * Where the event's light actually falls on the ground, painted rather than cast.
 *
 * This is the single biggest reason the venue stopped reading as dark. A night site
 * lit only by lamps aimed at the stage leaves 85 x 111 m of grass and tarmac with
 * nothing on it, and no amount of ambient fixes that without also flattening the
 * stage — ambient has no direction, so raising it enough to see the entrance washes
 * the contrast out of everything else.
 *
 * A real venue's answer is dozens of fixtures on stands. We cannot afford them: ten
 * SpotLights measured 31.7 ms a frame on this scene. So the light they would throw is
 * drawn instead, as one additive canvas laid over the ground — one texture, one draw
 * call, no per-pixel lighting cost at all, and it covers the whole site including the
 * approach outside the perimeter.
 *
 * Coordinates are world metres. The pools are placed against the landmarks measured
 * from the model (ticketing booth x -55..-49 z 23..37, ice arch x -45..-36 z 28..33,
 * activation container x -21..-18 z 32..36, entry gate x -18.6 z 52.6..58.8, stage
 * front z -22), so each one sits under something that would carry a fixture.
 * Uplighter pools are not listed here: UPLIGHTS generates its own.
 */
const GROUND_POOLS: Array<{
  x: number
  z: number
  rx: number
  rz: number
  c: [number, number, number]
  a: number
}> = [
  // The stage apron, and the warm spill off the deck itself. Brightest on the site.
  { x: 0, z: -20, rx: 21, rz: 12, c: [150, 190, 255], a: 0.62 },
  { x: 0, z: -26.5, rx: 14, rz: 7, c: [255, 222, 180], a: 0.36 },
  // VIP standing: the centre aisle reads as a lane, the table blocks as pools.
  { x: 0, z: -3, rx: 5.5, rz: 22, c: [130, 175, 255], a: 0.24 },
  { x: -11, z: -5, rx: 9, rz: 17, c: [95, 140, 240], a: 0.26 },
  { x: 12, z: -5, rx: 9, rz: 17, c: [95, 140, 240], a: 0.26 },
  // The open field, so the poseur tables stand on something rather than in a void.
  { x: -2, z: 24, rx: 24, rz: 20, c: [78, 118, 215], a: 0.22 },
  { x: -2, z: 47, rx: 10, rz: 8, c: [90, 130, 225], a: 0.2 },
  // Approach and ticketing. Cool white, as the treatment renders light the booth
  // (Slides 1-6); this was warm until 24 Nov 2026. Held low: an additive pool bleaches
  // turf towards grey, and the renders show the lanes as green grass under floods.
  { x: -60, z: 30, rx: 12, rz: 11, c: [185, 208, 255], a: 0.2 },
  { x: -51, z: 30, rx: 6, rz: 9, c: [210, 226, 255], a: 0.22 },
  // At the ice arch and inside the tunnel: the floor reads as turf (Slides 7, 10),
  // so these only cool it rather than wash it out.
  { x: -45, z: 30.5, rx: 7, rz: 5.5, c: [150, 190, 255], a: 0.18 },
  { x: -40.5, z: 30.5, rx: 8.5, rz: 6.5, c: [150, 185, 255], a: 0.1 },
  { x: -31, z: 32, rx: 10, rz: 6.5, c: [150, 190, 255], a: 0.32 },
  // The Extra Cold activation corridor (x -30..-18.6, z 26..63). One pool in front of
  // each activation, on the side the visitor stands, sized to the thing rather than to
  // the corridor — an activation should look like it has its own light on it, not like
  // it happens to be standing in a lit room. Measured footprints: glass container
  // x -20.2..-17.8 z 31.6..36.2 against the east wall; snow photo wall x -29.4..-26.4
  // z 42.4..47.5, photo booth x -28.7..-27.0 z 49.4..51.6 and the arcade row
  // x -29.6..-26.9 z 53.3..57.9, all against the west wall on a blue carpet strip.
  { x: -24, z: 46, rx: 5, rz: 15, c: [90, 135, 230], a: 0.14 },
  { x: -21.7, z: 33.9, rx: 2.6, rz: 3.2, c: [175, 215, 255], a: 0.5 },
  // The bar tent by the merch container, and its twin across the field.
  { x: -23.1, z: 20.0, rx: 3.0, rz: 3.0, c: [200, 225, 255], a: 0.42 },
  { x: 24.3, z: -17.3, rx: 3.0, rz: 3.0, c: [200, 225, 255], a: 0.42 },
  { x: -27.6, z: 50.7, rx: 1.7, rz: 8.6, c: [120, 165, 255], a: 0.26 },
  { x: -24.9, z: 45, rx: 2.4, rz: 3, c: [205, 228, 255], a: 0.46 },
  { x: -25.6, z: 50.5, rx: 2, rz: 1.9, c: [225, 238, 255], a: 0.55 },
  { x: -25.4, z: 55.6, rx: 2.2, rz: 3, c: [110, 160, 255], a: 0.44 },
  // The entry gate: the opening in the corridor's east wall into the field.
  { x: -21.2, z: 55.7, rx: 2.6, rz: 3.6, c: [195, 225, 255], a: 0.4 },
  { x: -15.6, z: 55.7, rx: 3.4, rz: 4.4, c: [160, 200, 255], a: 0.34 },
]

/**
 * Uplighters at the foot of the banner walls: [x, z, nx, nz].
 *
 * MEASURED DATA, not a layout. Each lamp sits 7 cm off a banner wall that a horizontal
 * ray actually hit, and (nx, nz) is that wall's own normal on the side visitors stand
 * on, so the wash lands flush on the printed face. Re-deriving them means measuring
 * again, never redrawing a line on a plan.
 *
 * Why it matters (24 Nov 2026): the previous version described each wall as an
 * axis-aligned run, and the site is not axis-aligned. The SketchUp model sits about
 * 3.1 degrees off the world grid, so every run drifted off its wall along its length —
 * by up to 3 m — and the activation corridor's run had been drawn down the middle of
 * the corridor outright. Francis saw the result as "uplight wash lights in the middle
 * of the field". The walls were re-measured by sweeping horizontal rays across the
 * whole site at 1.2 m (about 4,000 banner hits), and each lamp was snapped to the
 * hits under it and then checked: a wall within 0.45 m behind it, nothing within
 * 0.9 m in front.
 *
 * Deliberately left dark: the east wall between z -18 and z 22, where the VVIP
 * platform B backdrop stands half a metre in front of the perimeter (it has its own
 * wash, vvipLight); the corridor's west wall behind the snow wall, photo booth and
 * arcades; and the east corridor wall behind the glass container. A lamp behind an
 * activation lights the back of the activation, which is the one thing nobody sees.
 */
const UPLIGHTS: ReadonlyArray<readonly [number, number, number, number]> = [
  // East perimeter, facing the field. The VVIP B stretch is skipped, see above.
  [27.89, -30.02, -0.999, -0.053],
  [27.44, -22.02, -0.999, -0.053],
  [24.79, 25.99, -0.999, -0.053],
  [24.34, 33.99, -0.999, -0.053],
  [23.89, 41.99, -0.999, -0.053],
  [23.44, 49.98, -0.999, -0.053],
  [23.0, 57.99, -0.999, -0.053],
  // West side of the field, north of VVIP platform A. The stretch behind the platform
  // is lit from deck height instead: see VVIP_UPLIGHTS.
  [-27.81, 19.24, 0.998, 0.055],
  // The entry room either side of the ice arch: south wall, then north wall.
  [-47.3, 24.94, -0.056, 0.998],
  [-38.75, 25.15, -0.056, 0.998],
  [-31.24, 25.56, -0.056, 0.998],
  [-23.75, 25.98, -0.056, 0.998],
  [-47.3, 35.8, 0.053, -0.999],
  [-40.47, 36.49, 0.053, -0.999],
  [-34.14, 36.85, 0.053, -0.999],
  // The activation corridor: east wall clear of the glass container, and the one
  // stretch of the west wall that has no activation against it.
  [-17.78, 28.5, -0.999, -0.051],
  [-18.48, 40.99, -0.999, -0.051],
  [-18.87, 47.99, -0.999, -0.051],
  [-30.03, 60.02, 0.998, 0.059],
  // The inner north wall, facing back up the field.
  [-24.0, 63.62, 0.002, -1.0],
  [-16.0, 63.63, 0.002, -1.0],
  [-8.0, 63.64, 0.002, -1.0],
  [0.0, 63.63, 0.002, -1.0],
  [8.0, 63.64, 0.002, -1.0],
]

/** The banner run is 2.5 m to the top rail; the cards cover it with a little over. */
const UPLIGHT_WALL_H = 2.5

/**
 * Uplighters on the banners behind the two VVIP platforms, as [x, z, nx, nz], measured
 * the same way as UPLIGHTS (ray sweeps at y 2.2, 7 cm stand-off included).
 *
 * The platform decks stand 1.06 m high and run to within 1.5 m of these walls, so a lamp
 * at the foot of the wall is behind the deck edge from anywhere on the platform or the
 * field — which is exactly how the four that used to stand here went unseen. These are
 * rigged at deck height instead (VVIP_UPLIGHT_BASE), the way you would put them on
 * stands behind a raised platform. The strip behind each platform's centre backdrop
 * (A: z -8..6, B: z -6..9) is left out: a lamp there lights only the back of the
 * backdrop.
 */
const VVIP_UPLIGHTS: ReadonlyArray<readonly [number, number, number, number]> = [
  // Platform A, west wall, facing east.
  [-25.99, -14.5, 0.998, 0.055],
  [-26.21, -10.5, 0.998, 0.055],
  [-27.2, 7.5, 0.998, 0.055],
  [-27.36, 10.5, 0.998, 0.055],
  [-27.52, 13.5, 0.998, 0.055],
  [-27.69, 16.5, 0.998, 0.055],
  // Platform B, east wall, facing west.
  [27.03, -14.5, -0.998, -0.055],
  [26.81, -10.5, -0.998, -0.055],
  [26.63, -7.5, -0.998, -0.055],
  [25.64, 10.5, -0.998, -0.055],
  [25.47, 13.5, -0.998, -0.055],
  [25.31, 16.5, -0.998, -0.055],
]
const VVIP_UPLIGHT_BASE = 1.06
const VVIP_UPLIGHT_H = 1.6

/**
 * Light pools on the activation deck, the 13 cm black stage the photo booth, the snow
 * wall and the arcades stand on (x -29.6 to -26.8 along the corridor).
 *
 * GROUND_POOLS are painted at grass level, so under the deck they are simply hidden —
 * which is why the arcade end of the walk stayed dark however bright its pool was set.
 * These are painted on a separate sheet laid on the deck itself.
 */
const DECK_Y = 0.137
const DECK_POOLS: ReadonlyArray<{ x: number; z: number; rx: number; rz: number; c: [number, number, number]; a: number }> = [
  { x: -28.0, z: 52.6, rx: 1.2, rz: 1.5, c: [150, 190, 255], a: 0.55 }, // arcades
  { x: -28.0, z: 54.8, rx: 1.2, rz: 1.5, c: [150, 190, 255], a: 0.55 },
  { x: -28.0, z: 57.0, rx: 1.2, rz: 1.5, c: [150, 190, 255], a: 0.55 },
  { x: -28.0, z: 50.6, rx: 1.2, rz: 1.4, c: [215, 232, 255], a: 0.45 }, // photo booth
  { x: -28.0, z: 45.1, rx: 1.2, rz: 2.6, c: [205, 228, 255], a: 0.4 }, // snow wall
]
const DECK_AREA = { x: [-30, -26.4], z: [41.5, 60] } as const

/**
 * Washes on the activations themselves, drawn with the same card as the uplighters.
 *
 * `p` is the card centre, `n` the way it faces, both measured off the activation it
 * lights. The glass container gets a back-light, so the mannequins and the merch read
 * as a lit display case through the glass rather than as shapes in a dark box; the
 * banner behind the photo booth is washed so its can print reads through the glass.
 * The snow wall is not here: a card in front of it sat as a hotspot on the running
 * figure, so it glows from its own artwork instead (see MAP_LOOKS).
 */
const ACTIVATION_WASHES: ReadonlyArray<{
  p: readonly [number, number, number]
  n: readonly [number, number]
  w: number
  h: number
}> = [
  { p: [-18.45, 1.25, 33.9], n: [-0.999, -0.051], w: 3.6, h: 2.4 },
  // Two narrower uplights either side inside the merch store, on the same wall. With
  // only the one card the store read as a dim blue box with dark mannequins in it.
  { p: [-18.5, 1.15, 32.8], n: [-0.999, -0.051], w: 1.6, h: 2.3 },
  { p: [-18.5, 1.15, 35.1], n: [-0.999, -0.051], w: 1.6, h: 2.3 },
  // Behind the three basketball arcades, on the corridor's west banner (face at x -29.75):
  // one between each pair of cabinets and one at each end, so every cabinet stands
  // against light rather than in front of a dark wall.
  { p: [-29.68, 1.3, 51.6], n: [0.998, 0.059], w: 1.8, h: 2.6 },
  { p: [-29.68, 1.3, 53.75], n: [0.998, 0.059], w: 1.8, h: 2.6 },
  { p: [-29.68, 1.3, 55.9], n: [0.998, 0.059], w: 1.8, h: 2.6 },
  { p: [-29.68, 1.3, 58.0], n: [0.998, 0.059], w: 1.8, h: 2.6 },
  // The banner behind the photo booth: the concept's can print is this wall, seen
  // through the booth's clear glass, so lighting it is what puts the can behind the man.
  { p: [-29.36, 1.3, 50.5], n: [0.998, 0.06], w: 3.4, h: 2.6 },
]

/**
 * The material the model gives the cut-out letterforms. A SketchUp preset name, left
 * exactly as the source wrote it so a re-export still matches — it describes a colour
 * swatch, not what the geometry is.
 */
const SIGN_MATERIAL = 'B03_Apricot_Glow'

/**
 * The two cut-out lockups you walk between at the entry, in viewer world space.
 *
 * Measured off the model: the pair face the approach on the short walls flanking the
 * ice arch at x ~ -45.5, one between z 24.5 and 28.5 and one between z 32 and 36.5,
 * from y 0.7 to 2.0. The box is loose enough to survive a re-export that nudges them
 * and tight enough to leave out the SAME lettering elsewhere on that merged mesh —
 * the VVIP platform fronts at x ~ +/-24, z ~ 0, and the run by the entry gate at
 * x ~ -28, z 44..48.
 */
const ENTRY_SIGN_BOX = { x: [-48, -40], y: [0.4, 2.3], z: [20, 40] } as const

type Box = { readonly x: readonly [number, number]; readonly y: readonly [number, number]; readonly z: readonly [number, number] }

/**
 * The sign over the merch container's arch: the LITE UNLOCKS mark and the cut-out
 * EXTRA COLD REFRESHMENT lettering under it, on the container's west face at x ~ -20.85,
 * between y 2.1 and 2.5. Same cut-out material as the entry lockups, and the same
 * castle-logo prints that sit on signage all over the site, hence the box.
 */
const MERCH_SIGN_BOX: Box = { x: [-21.4, -20.4], y: [1.9, 2.9], z: [32.8, 35.2] }

/**
 * The UNLOCKS / EXTRA COLD REFRESHMENT signs on the two VVIP platform backdrops, measured
 * off the model: platform A's on the wall at x -25.5 between z -2.2 and 0.4, platform
 * B's at x +25.5 between z 0.3 and 2.9, both from y 2.0 to 3.1.
 */
const VVIP_SIGN_BOXES: readonly Box[] = [
  { x: [-26.2, -24.8], y: [1.8, 3.4], z: [-3.0, 1.0] },
  { x: [24.8, 26.2], y: [1.8, 3.4], z: [-0.3, 3.6] },
]

/**
 * The stage's walking surfaces: the deck top is `*101`, the catwalk and the hexagonal
 * thrust at its end are `*2`. NOT `[0104_MediumBlue]2`: that was in here as the thrust,
 * from a ray that happened to land on a cocktail table, and it is the printed top of the
 * 28 poseur tables in front of the stage — which is how they went white.
 */
const STAGE_TOP_MATERIALS = ['*101', '*2'] as const
const STAGE_BOX: Box = { x: [-9, 10], y: [1.05, 1.6], z: [-31, -4] }
/**
 * A guard on top of the material list: nothing smaller than a square metre a triangle is
 * a stage surface. The deck and catwalk tops are a few large triangles; furniture tops
 * near the stage (the cocktail tables are 0.16 m² a triangle) are not.
 */
const STAGE_TOP_MIN_AREA = 1.0

/** White stage vinyl grain, near 1.0 everywhere so it textures without greying. */
function stageGrain() {
  const N = 256
  const c = document.createElement('canvas')
  c.width = N
  c.height = N
  const ctx = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  if (!ctx) return tex
  const img = ctx.createImageData(N, N)
  const rnd = seeded(101)
  for (let i = 0; i < N * N; i++) {
    // Fine grain plus the odd faint fleck, the way a matte dance-floor vinyl reads.
    let v = 238 + rnd() * 17
    if (rnd() < 0.004) v -= 22
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = Math.min(255, v + 2)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** The stretch of corridor banner that is the merch store's backdrop, measured at x -18.36..-18.59. */
const MERCH_BACKDROP_BOX: Box = { x: [-18.8, -18.2], y: [0, 2.5], z: [32.3, 35.9] }

/** Inside the merch container, for surfaces whose material is shared with the ticketing booth. */
const MERCH_INSIDE_BOX: Box = { x: [-20.7, -18.2], y: [0, 2.4], z: [32.2, 36] }
/** The whole merch container, frame and arch included (its frame materials recur at the activations). */
const MERCH_BOX: Box = { x: [-21.1, -18.25], y: [-0.1, 2.45], z: [32.1, 36.1] }
/** The neon running figure on the snow wall (z 44.6..45.8, 1.7 m tall, on the wall face at x -27.55). */
const SNOW_FIGURE_BOX: Box = { x: [-27.75, -27.35], y: [0, 1.9], z: [44.4, 46.0] }
/** The EXTRA COLD lockup above the figure. */
const SNOW_SIGN_BOX: Box = { x: [-27.75, -27.35], y: [1.6, 2.15], z: [45.2, 46.4] }

/**
 * Back-of-house pieces the survey carries but the walkthrough leaves out, by direction
 * (Francis, 24 Nov 2026): the bar kiosk beside platform B's front corner, the walled
 * service yard behind stage left with its blue unit, and the white marquee behind stage
 * right. Each box was checked triangle by triangle to hold nothing else; the perimeter
 * fence (x 27.7, z -41.8) stays outside them.
 */
const CUT_AWAY: readonly Box[] = [
  { x: [22.6, 26.3], y: [-0.2, 3.6], z: [-19.1, -16.8] }, // bar kiosk
  { x: [10.5, 27.2], y: [-0.2, 3.0], z: [-40.0, -28.4] }, // service yard, walls and unit
  { x: [-24.9, -18.8], y: [-0.2, 5.6], z: [-34.2, -23.6] }, // marquee
]

/**
 * Cold white for the lit letters, not the model's warm apricot.
 *
 * It is the same family as the beams and the fixture lenses, so the signage reads as
 * part of one rig rather than as a stray warm light on a cold site.
 */
const SIGN_GLOW = 0xdce9ff

/** The looks the sky-beam show moves between. See `runBeamShow`. */
const BEAM_CUES = ['wave', 'ballyhoo', 'scissor', 'chase', 'focus', 'pulse', 'sweep', 'split', 'dive'] as const
type BeamCue = (typeof BEAM_CUES)[number]
type BeamAim = { d: THREE.Vector3; k: number; l: number }

/**
 * Where the crowd looks aim: head height over the pit in front of the stage, either
 * side of the catwalk. Aimed any further back, the heads (8 m up) are throwing almost
 * flat at anyone standing in the field, and a beam pointed at the lens foreshortens to
 * nothing; into the pit they come down as steep diagonals that read from everywhere.
 */
const CROWD_Y = 1.8
const CROWD_Z = [-18, 2] as const

/** A small seeded generator, so the show is random-looking but the same on every load. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Light a printed face from its own artwork, so it reads at night without a lamp.
 *
 * Does nothing until the artwork is there: white emission with no map to modulate it
 * would turn the face into a flat white card.
 */
/**
 * The ticketing booth's front fascia (the `Ticketing Area` print), measured from the
 * model: its face runs from (-54.194, z 23.207) to (-55.167, z 36.748), a 4 degree skew
 * off the X axis, facing the entrance. `mark` is the centre of the snowcastle printed
 * between TICKETING and BOOTH (u 0.517 of the artwork, mid-height).
 */
const BOOTH_FACE = (() => {
  const slope = (-55.167 - -54.194) / (36.748 - 23.207) // dx / dz along the face
  const normal = new THREE.Vector3(-1, 0, slope).normalize()
  const t = (0.5171 - 0.0142) / (0.9783 - 0.0142)
  const mark = new THREE.Vector3(-54.194 + t * (-55.167 - -54.194), (2.713 + 3.775) / 2, 23.207 + t * (36.748 - 23.207))
  return { slope, normal, mark }
})()

function selfLit(m: THREE.MeshStandardMaterial, amount: number) {
  if (!m.map) return
  m.emissive = new THREE.Color(0xffffff)
  m.emissiveMap = m.map
  m.emissiveIntensity = amount
}

/**
 * Brushed metal to matte white, for the laser-cut furniture the renders draw as white
 * (VVIP sofas and ottomans, the lantern tables). The map goes because it is the metal.
 */
function matteWhite(m: THREE.MeshStandardMaterial, glow: number) {
  m.map = null
  m.color.setHex(0xf3f7ff)
  m.metalness = 0
  m.roughness = 0.62
  m.emissive = new THREE.Color(0xd8e6ff)
  m.emissiveIntensity = glow
  m.needsUpdate = true
}

/**
 * A light pool on the ground, drawn per pixel rather than as a canvas gradient.
 *
 * A canvas radial gradient falls off linearly between its stops, which on turf reads
 * as a flat disc with a fuzzy rim: what the first lantern pools looked like. Light
 * thrown down from a fixture is brightest right at its foot and dies away fast, so this
 * is a Gaussian (`tight` sets how fast) trimmed to reach exactly zero at the rim, with
 * the hue cooling outward, and a touch of noise so the low end does not band.
 */
function lightPool(
  centre: [number, number, number],
  rim: [number, number, number],
  tight = 6,
  /** Leave the middle dark out to this radius (0-1): a halo round a sign, not over it. */
  hole = 0,
): THREE.DataTexture {
  const N = 256
  const data = new Uint8Array(N * N * 4)
  const rnd = seeded(7)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N - 0.5
      const dy = (y + 0.5) / N - 0.5
      const r = Math.min(1, Math.hypot(dx, dy) * 2)
      const edge = 1 - r * r
      let k = Math.exp(-r * r * tight) * edge * edge
      if (hole > 0) {
        const u = Math.min(1, Math.max(0, (r - hole + 0.06) / 0.12))
        k = Math.exp(-(Math.max(0, r - hole) ** 2) * tight * 4) * edge * edge * u * u * (3 - 2 * u)
      }
      const i = (y * N + x) * 4
      // Falloff carried in the colour itself (premultiplied), because the pool is
      // blended as a multiplier on the ground, not laid over it: see lanternTables.
      const n = (rnd() - 0.5) * 1.5
      for (let c = 0; c < 3; c++) {
        const hue = centre[c] + (rim[c] - centre[c]) * Math.min(1, r * 1.4)
        data[i + c] = Math.max(0, Math.min(255, Math.round(hue * k + n)))
      }
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/** Vertical colour ramp baked into a geometry's vertices: `lo` at the foot, `hi` at the top. */
function rampColours(geo: THREE.BufferGeometry, lo: THREE.Color, hi: THREE.Color) {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  const pos = geo.attributes.position
  const tint = new Float32Array(pos.count * 3)
  const mix = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    mix.copy(lo).lerp(hi, (pos.getY(i) - b.min.y) / (b.max.y - b.min.y || 1))
    tint.set([mix.r, mix.g, mix.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(tint, 3))
}

/**
 * Activation surfaces that are treated from their own artwork, keyed by source material.
 *
 * These have to run when the texture arrives, not when the scene is built: artwork is
 * streamed in after first paint, so at build time every one of these materials still
 * has no map. Applying them then is a silent no-op — which is exactly how the booth
 * stayed opaque and the man stayed a silhouette in the first pass at this.
 */
const MAP_LOOKS: Record<string, (m: THREE.MeshStandardMaterial) => void> = {
  // The photo booth, back to clear glass as the concept draws it. The export lost the
  // PNG alpha on the letter print and the panel, so the light letters are read back
  // out of the image itself (three takes alpha from the green channel).
  'Artboard 5': (m) => {
    m.alphaMap = m.map
    m.alphaTest = 0.5
    selfLit(m, 0.55)
  },
  photobooth: (m) => {
    m.alphaMap = m.map
    m.transparent = true
    m.depthWrite = false
    selfLit(m, 0.35)
  },
  // The man posing in it. The booth is lit for him; at night without this he is a
  // silhouette against the glass.
  '集简空间-Z-20-0613-09-84': (m) => selfLit(m, 0.32),
  // The snow wall: its white shell and the running-figure print with the bottle. The
  // concept shows it as the brightest thing in the walk, so it glows from itself
  // rather than from a lamp pointed at the print.
  '5ba6ad1a-23d7-465e-b51b-e88892c21751': (m) => selfLit(m, 0.55),
  'ChatGPT Image Jul 29, 2026, 09_35_50 PM1': (m) => selfLit(m, 0.55),
  // Printed faces of the container and arcade that a real activation would light.
  'Artboard 11': (m) => selfLit(m, 0.5),
  'Artboard 3 copy 2': (m) => selfLit(m, 0.5),
  // The two portrait artworks flanking the LED wall, lit like the lightboxes they are.
  // The right one's artwork is a frosted, darker image than the left's, so it gets more
  // to read as a pair; without it the right panel sat as a dark slab beside the screen.
  Stage: (m) => selfLit(m, 0.5),
  "Unusual Christmas Artist Installations - If It's Hip, It's Here5": (m) => selfLit(m, 0.95),
  // The castle mark on the front of each arcade cabinet. Only the arcades carry it.
  'castle logo1': (m) => selfLit(m, 0.6),
  // The merch store's stock, lit the way a shop window is: the kit on the mannequins,
  // the trainers on the wall rack, the folded tees and the pieces on the counter, and
  // the bottles in the ice buckets. Each of these materials exists only in the store.
  '188-20077': (m) => selfLit(m, 0.42),
  '188-20078': (m) => selfLit(m, 0.42),
  '188-20080': (m) => selfLit(m, 0.3),
  '188-20084': (m) => selfLit(m, 0.3),
  'Screen Shot 2015-12-04 at 2.30.46 am': (m) => selfLit(m, 0.5),
  'Clothes logo': (m) => selfLit(m, 0.45),
  '1870_1_20120924171853#20': (m) => selfLit(m, 0.45),
  'Artboard 12': (m) => selfLit(m, 0.5),
  'ChatGPT Image Aug 25, 2026, 05_21_52 PM': (m) => selfLit(m, 0.45),
  'ChatGPT Image Aug 25, 2026, 05_41_59 PM': (m) => selfLit(m, 0.45),
  'ChatGPT Image Aug 25, 2026, 06_06_22 PM': (m) => selfLit(m, 0.45),
  'ChatGPT Image Aug 25, 2026, 06_13_04 PM': (m) => selfLit(m, 0.45),
  'Screenshot 2026-08-24 175931': (m) => selfLit(m, 0.3),
  // The entrance (see entrance()): lane headers and podium marks on the booth, the
  // ice fins and the frosted facade of the arch, the tunnel's portals and shell print.
  // Every one of these materials exists only at the booth, the arch or the tunnel.
  'Ticketing Booth-3': (m) => selfLit(m, 0.5),
  'Ticketing Booth-4': (m) => selfLit(m, 0.5),
  'Ticketing Booth-5': (m) => selfLit(m, 0.5),
  'Ticketing Booth-9': (m) => selfLit(m, 0.4),
  'Artboard 14': (m) => selfLit(m, 0.45),
  'ChatGPT Image Jul 29, 2026, 11_02_42 AM': (m) => selfLit(m, 0.3),
  'Artboard 7 copy 3': (m) => selfLit(m, 0.45),
  'Artboard 7 copy 4': (m) => selfLit(m, 0.5),
  'Artboard 1': (m) => selfLit(m, 0.5),
  // The Castle Lite bottle cut-outs either side of each VVIP backdrop (two per platform,
  // the only use of this print). Backlit on site, so the print glows; above ~0.8 the white
  // label starts to bloom and the green glass flattens.
  'Bottle cutout 50.7cm x 191.64cm': (m) => selfLit(m, 0.6),
  // The bar tents: the printed counter front and the canopy's valance and roof prints.
  // Lit only a little: in Slides 11 and 20 the fridges are the light source of a bar
  // (barFridges), and the prints sit matte and darker under the floods.
  'Artboard 7': (m) => selfLit(m, 0.3),
  'Artboard 7 copy': (m) => selfLit(m, 0.3),
  'Artboard 8': (m) => selfLit(m, 0.22),
  'Artboard 2': (m) => selfLit(m, 0.22),
  // The lightbox header over each pair of bar fridges.
  'Artboard 7 copy 2': (m) => selfLit(m, 0.75),
}

/**
 * The light one par throws up a wall, as a texture.
 *
 * Drawn rather than lit, and the measurement is the reason: ten real SpotLights on
 * this scene cost 31.7 ms a frame on an M1 Pro at 3360x2000 — it went from 30 fps to
 * 14. The venue is fragment-bound (9.6 M triangles, 85 textures, a full-screen bloom
 * chain), so every extra light is paid for by every pixel. A beam card is two
 * triangles and costs nothing measurable.
 *
 * The shape is a cone opening upward: narrow and hot at the fixture, spreading and
 * fading towards the top of the wall. The core runs white and the flanks run blue, so
 * the card carries the hot centre a single tint could not.
 */
function beamTexture(opt: BeamLook = {}): THREE.Texture {
  const { spread = 0.9, falloff = 1.1, edge = [90, 150, 255], core = [255, 255, 255] } = opt
  const W = 128
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const img = ctx ? ctx.createImageData(W, H) : null
  if (!ctx || !img) return new THREE.Texture()
  for (let y = 0; y < H; y++) {
    // Row 0 of the canvas is v = 0, and on a PlaneGeometry v = 0 is the BOTTOM edge —
    // the deck, where the fixture stands. So t runs 0 at the fixture to 1 at the top
    // of the wall. Reading it the other way round built a downlight.
    const t = y / (H - 1)
    // The cone: a tenth of the card's width at the fixture, all of it at the top.
    const half = (W / 2) * (1 - spread + spread * t)
    // Hottest at the fixture, gone by the top.
    const up = Math.pow(1 - t, falloff)
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / Math.max(half, 0.5)
      // Falls to exactly zero at the edge of the cone, and flattens as it gets there.
      // A gaussian does not: it still reads about a tenth as bright where it is cut
      // off, which drew the card's own rectangle on the wall around every beam.
      const across = dx * dx >= 1 ? 0 : Math.pow(1 - dx * dx, 2.2)
      const a = up * across
      // The core colour where the beam is hottest, the edge colour where it thins out.
      const k = Math.pow(a, 1.6)
      const i = (y * W + x) * 4
      img.data[i] = edge[0] + (core[0] - edge[0]) * k
      img.data[i + 1] = edge[1] + (core[1] - edge[1]) * k
      img.data[i + 2] = edge[2] + (core[2] - edge[2]) * k
      img.data[i + 3] = Math.round(255 * Math.min(1, a))
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // Left unflipped, and the rows above are written to suit: row 0 is the fixture.
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/**
 * Where one instanced family's copies actually ended up, as world boxes.
 *
 * An InstancedMesh keeps its copies as a matrix buffer, not as objects, so once a
 * family is placed there is nothing left to measure. This reads the prototype's own
 * baked bounds through each placement transform while both are still in hand.
 */
function familyBoxes(parts: THREE.Mesh[], xf: number[][]): THREE.Box3[] {
  const local = new THREE.Box3()
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    if (part.geometry.boundingBox) local.union(part.geometry.boundingBox)
  }
  const m4 = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  return xf.map((t) => {
    pos.set(t[0], t[1], t[2])
    quat.set(t[3], t[4], t[5], t[6])
    scale.set(t[7], t[8], t[9])
    m4.compose(pos, quat, scale)
    return local.clone().applyMatrix4(m4)
  })
}

/** The instanced families that make up a VVIP booth, for marker clearance. */
const BOOTH_PARTS = new Set([
  'proto_sofa',
  'proto_cushion',
  'proto_cushion2',
  'proto_table',
  'proto_metal1',
  'proto_metal2',
  'proto_c8',
])

/** A texture's mean colour, for when the map itself is not worth sampling. */
function averageColour(t: THREE.Texture): THREE.Color {
  const out = new THREE.Color(0xc9ced6)
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx || !t.image) return out
    ctx.drawImage(t.image as CanvasImageSource, 0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    out.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace)
  } catch {
    /* tainted or not yet decodable — the fallback colour stands */
  }
  return out
}

export interface PickResult {
  table: VenueTable
  index: number
}

/**
 * Per-instance transforms from the build step: [px,py,pz, qx,qy,qz,qw, sx,sy,sz].
 * Position alone is not enough — the truss sections and much of the furniture are
 * rotated in the model, and a position-only placement snaps them all to one angle.
 */
type Xform = number[]
type Placements = Record<string, Xform[]>

const lowPower = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export class VenueScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly controls: OrbitControls
  private readonly canvas: HTMLCanvasElement
  private readonly ray = new THREE.Raycaster()
  private readonly mobile = lowPower()
  private readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly screenTex = new Map<'wide' | 'tall', THREE.Texture>()
  private readonly videos: HTMLVideoElement[] = []
  private markers: THREE.InstancedMesh | null = null
  /** World boxes of everything standing on a VVIP deck, so markers can avoid it. */
  private boothBoxes: THREE.Box3[] = []
  /**
   * Lit copies of a material, keyed by its name, waiting for its artwork. A copy made
   * by cloning before the texture has streamed in has no map of its own, so it is
   * handed the texture here when the original gets it.
   */
  private mapTwins = new Map<string, Array<(t: THREE.Texture) => void>>()
  private markerClashes = 0
  private readonly beamTexes: THREE.Texture[] = []
  private poolTex: THREE.Texture | null = null
  private beamMesh: THREE.InstancedMesh | null = null
  private dome: THREE.Mesh | null = null
  private readback: HTMLCanvasElement | null = null
  /** Origin, direction, width and length of each sky shaft, in world metres. */
  private readonly beams: Array<{
    o: THREE.Vector3
    d: THREE.Vector3
    w: number
    l: number
    /** Full throw. `l` is cut short of it when a head is aimed into the crowd. */
    l0: number
    /** The resting fan, as lean per metre of rise: across (x) and out over the crowd (z). */
    home: { px: number; pz: number }
    /** The head's own colour at full output. */
    c: THREE.Color
  }> = []
  /** Which cue the beam show is running, the one it is fading out of, and when. */
  private readonly show = { cue: 'wave' as BeamCue, prev: 'wave' as BeamCue, at: 0, until: 8, rnd: seeded(20261123) }
  private venue: Venue | null = null
  private raf = 0
  /** True while the opening sequence is still running itself. */
  private touring = true
  /** Index into `scenes`, or -1 when the camera is somewhere that is not a stop. */
  private stop = 0
  /** performance.now() at which the current stop has been held long enough. */
  private stopUntil = 0
  private onStopChange?: (i: number) => void
  /**
   * The stop's vertical field of view AS MEASURED ON A 16:9 FRAME.
   *
   * It is not handed to the camera as-is: see applyFov. Storing it against a fixed
   * aspect is what lets one number reproduce a render on any window shape.
   */
  private fov = REF_FOV
  private disposed = false
  private onPick?: (p: PickResult | null) => void
  /**
   * Table mode (the ticket journey's table picker) sets this false before load: no
   * walkthrough, the camera opens on an aerial shot instead and the host drives it.
   */
  tourOnLoad = true
  /** Table mode handles taps itself (it frames the table rather than sitting in it). */
  tapFocus = true
  private pads: THREE.InstancedMesh | null = null
  private beaconGroup: THREE.Group | null = null
  private frameCbs: Array<() => void> = []
  private drainLater?: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      // Only so shot() can read the frame back when the angles are being matched
      // against the renders. Vite folds this to false in the production bundle.
      preserveDrawingBuffer: import.meta.env.DEV,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.6 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.14
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // With post-processing the final pass is a fullscreen quad, so an auto-reset
    // leaves renderer.info reporting that quad instead of the scene. Reset once per
    // frame and the counters cover every pass.
    this.renderer.info.autoReset = false

    this.scene.background = new THREE.Color(SKY)
    // Exponential rather than linear: the far end of an 85x111 m site should fall away
    // smoothly instead of hitting a wall at a fixed distance.
    // Haze rather than night: a touch above the sky colour, so distance reads as air
    // with light in it. At exactly SKY the far end of the site dissolved into the
    // background and the venue looked like it stopped forty metres out.
    this.scene.fog = new THREE.FogExp2(HAZE, 0.0062)

    this.camera = new THREE.PerspectiveCamera(REF_FOV, 1, 0.5, 420)
    this.camera.position.set(0, 11.5, 42)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 6
    this.controls.maxDistance = 140
    // Just past level, not short of it. The old clamp held the camera at least 2
    // degrees ABOVE its target, which quietly tilted every stop downwards — and the
    // renders these stops reproduce are shot level, with the horizon on the centre
    // line and verticals parallel. It also made looking up at the stage impossible,
    // which is the one thing a visitor standing in the VIP section would do.
    this.controls.maxPolarAngle = 1.92
    this.controls.minPolarAngle = 0.12
    this.controls.enablePan = false
    this.controls.target.set(0, 3.2, -18)
    // Taking hold of the scene ends the opening for good. It does not rewind the
    // stop index: the rail should keep showing where the visitor was left standing.
    this.controls.addEventListener('start', () => {
      this.touring = false
    })

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.mobile ? 0.3 : 0.45, // strength
      0.5, // radius
      // Only light that survives tone mapping above white blooms, which now means the
      // screens and nothing else — they are the one thing rendered untone-mapped. At
      // 0.85 lit white fabric cleared the bar too, which is why the cushions on the
      // VVIP furniture were blowing out into flat white blobs.
      1.0, // threshold
    )
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.lights()

    // Dev-only handle. The scene is tuned by driving it to the same camera the build
    // script renders the source model from and comparing frames, which needs a way in
    // from the console. Vite strips this branch from the production bundle.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__venue = this
    }
  }

  private lights() {
    // Cool sky over a ground bounce, strong enough that the field reads as grass and
    // the white marquees and furniture read as white.
    //
    // The ground half is blue rather than the dark green it was. A hemisphere light's
    // ground colour is what reaches surfaces facing DOWN, so this is the one control in
    // the rig whose direction is already the one the venue is lit from: pars on the
    // deck throwing upward. Grass faces up and still takes the sky colour, so it stays
    // green; what changes is the underside of every piece of furniture, which is
    // exactly where light from a floor fixture lands.
    // Raised with the drawn rig. The pools and uplighters put light where fixtures
    // would put it, but nothing in the venue bounces, so without a lift every surface
    // facing away from the stage stayed at the old near-black.
    this.scene.add(new THREE.HemisphereLight(0x5476b8, 0x2b406e, 1.32))

    // The one shadow caster. Its frustum is pinned to the build area — a default
    // shadow camera would spread 2048 texels over kilometres and resolve nothing.
    // Raised with the ambient: a directional light costs the same whatever its
    // intensity, and it is the only thing in the rig that models the VVIP furniture.
    const key = new THREE.DirectionalLight(0x9fb6f0, 0.8)
    key.position.set(-42, 54, 26)
    key.castShadow = true
    key.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    const s = key.shadow.camera
    s.left = -60
    s.right = 60
    s.top = 60
    s.bottom = -60
    s.near = 10
    s.far = 160
    key.shadow.bias = -0.0012
    key.shadow.normalBias = 0.04
    this.scene.add(key)

    // Stage wash: warm against the cool ambient, which is what gives the frame depth.
    const washL = new THREE.SpotLight(0xffd9a8, 220, 70, Math.PI / 5, 0.55, 1.6)
    washL.position.set(-11, 13, -18)
    washL.target.position.set(-3, 1.5, -28)
    this.scene.add(washL, washL.target)

    const washR = new THREE.SpotLight(0xa8c8ff, 220, 70, Math.PI / 5, 0.55, 1.6)
    washR.position.set(11, 13, -18)
    washR.target.position.set(4, 1.5, -28)
    this.scene.add(washR, washR.target)

    // Bounce off the LED wall, so the deck in front of it is never pitch black.
    const screen = new THREE.PointLight(0x6f9dff, 300, 60, 2)
    screen.position.set(1.2, 5.5, -30)
    this.scene.add(screen)

    // The front face of the stage extension faces the audience, and every other light
    // here is above or behind it: both stage washes aim upstage and the key comes from
    // over the far shoulder. Nothing reached it, so it read as a hole cut in the deck.
    // A wide, dim fill from the audience side gives it form without lifting the night.
    const front = new THREE.SpotLight(0x9fc0ff, 110, 58, Math.PI / 3.2, 0.72, 1.4)
    front.position.set(0, 9.5, 8)
    front.target.position.set(0, 0.7, -20)
    this.scene.add(front, front.target)

    // A low cold kicker from behind the audience, to separate the platforms from the
    // ground plane when the camera is low.
    const kick = new THREE.DirectionalLight(0x44619e, 0.42)
    kick.position.set(20, 8, 60)
    this.scene.add(kick)

    // A counter to the key, from the opposite shoulder. The key comes from x -42, so
    // every east-facing surface on the site — the whole inside of the east perimeter,
    // the audience-right flank of the stage, the A-platform booths — had nothing on
    // it at all. Directional, so it costs the same as the key and reaches the
    // entrance forty metres away as readily as the stage.
    const counter = new THREE.DirectionalLight(0x6f8fd8, 0.34)
    counter.position.set(46, 30, -34)
    this.scene.add(counter)

    // And a soft lift over the approach, which no stage fixture reaches. Aimed down
    // the walk-in rather than at the stage, so the ticketing booth and the arch have
    // a direction to be modelled by instead of only ambient.
    const approach = new THREE.DirectionalLight(0xbcd2ff, 0.3)
    approach.position.set(-70, 26, 46)
    this.scene.add(approach)
  }

  /**
   * Re-project a strip screen's UVs so the loop reads across the whole array.
   *
   * Each side screen is six separate vertical strips, and the export hands every strip
   * the full 0..1 UV range — so each one showed its own squeezed copy of the loop and
   * the tower read as a vertical smear rather than a picture. Projecting U from world
   * X across the array's own width and V from world Y across its height turns the six
   * strips into windows onto one image, which is what a strip screen is.
   *
   * The two towers share one merged mesh, so they are measured separately either side
   * of the stage centre line; projecting both together would stretch one picture over
   * the 26 m between them.
   */
  private projectScreenUVs(mesh: THREE.Mesh) {
    const pos = mesh.geometry.attributes.position
    if (!pos) return
    // Geometry is already baked to world space when the GLB is read, so these are
    // world coordinates and the split at x = 0 is the stage centre line.
    const lo = [new THREE.Vector2(Infinity, Infinity), new THREE.Vector2(Infinity, Infinity)]
    const hi = [new THREE.Vector2(-Infinity, -Infinity), new THREE.Vector2(-Infinity, -Infinity)]
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const k = v.x < 0 ? 0 : 1
      lo[k].set(Math.min(lo[k].x, v.x), Math.min(lo[k].y, v.y))
      hi[k].set(Math.max(hi[k].x, v.x), Math.max(hi[k].y, v.y))
    }
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const k = v.x < 0 ? 0 : 1
      const w = Math.max(hi[k].x - lo[k].x, 1e-6)
      const h = Math.max(hi[k].y - lo[k].y, 1e-6)
      uv[i * 2] = (v.x - lo[k].x) / w
      // v = 0 at the top, as glTF has it and as flipY = false expects.
      uv[i * 2 + 1] = (hi[k].y - v.y) / h
    }
    mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }

  /**
   * What plays on a screen: the hero's own tunnel loop, in the cut that fits.
   *
   * A VideoTexture re-uploads a frame to the GPU on every render tick, and that cost
   * is per frame and per screen whichever file it is — the 230 KB between the two cuts
   * is not the expense worth managing. So the lever is pulled where it actually bites:
   * low-power devices and anyone who asked for less motion get the poster still, which
   * is the same artwork and costs one upload. Everyone else gets the loop.
   */
  private screenContent(kind: 'wide' | 'tall'): THREE.Texture {
    const hit = this.screenTex.get(kind)
    if (hit) return hit
    const stem = kind === 'wide' ? 'tunnel-wide' : 'tunnel-tall'
    let tex: THREE.Texture
    if (this.mobile || this.reducedMotion) {
      tex = new THREE.TextureLoader().load(`/hero/${stem}-poster.webp`)
    } else {
      const el = document.createElement('video')
      el.src = `/hero/${stem}.mp4`
      el.muted = true
      el.loop = true
      el.autoplay = true
      el.playsInline = true
      el.preload = 'auto'
      // A rejected play() is not worth surfacing: the texture simply shows the first
      // decoded frame, which is the poster image either way.
      void el.play().catch(() => {})
      this.videos.push(el)
      tex = new THREE.VideoTexture(el)
    }
    tex.colorSpace = THREE.SRGBColorSpace
    // Same glTF UV convention as every other hand-loaded texture here.
    tex.flipY = false
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    this.screenTex.set(kind, tex)
    return tex
  }

  /**
   * The main LED wall, drawn as the one thing it actually is: a flat lit rectangle.
   *
   * The source builds this screen out of 4,968 separate panel modules carrying
   * 1,266,840 triangles — a quarter of the entire scene's budget — to describe a flat
   * 9.2 x 4.3 m plane. Those modules stay dropped and the plane is drawn here instead,
   * at the position and size they occupy, as two triangles showing the loop. The only
   * detail the modules add is the seams between them, and the camera cannot come
   * closer than 6 m, so nothing visible is given up for a 25% saving on the frame.
   *
   * This is also why the wall is not in SCREENS: with the modules dropped, their
   * materials are not in the GLB at all, so there is no material left to key on.
   */
  private mainScreen() {
    // Measured from Component#282-288 in the source: X -3.3..5.9, Y 3.6..8.0, front
    // face at Z -32.4, facing the audience down +Z.
    const geo = new THREE.PlaneGeometry(9.2, 4.35)
    // PlaneGeometry puts v=0 at the bottom. Every texture here is loaded with
    // flipY = false to match the glTF geometry, so flip this one to agree rather than
    // keep a second UV convention alive for a single mesh.
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
    uv.needsUpdate = true
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xffffff,
        emissiveMap: this.screenContent('wide'),
        emissiveIntensity: 1.45,
        toneMapped: false,
        name: 'led-wall',
      }),
    )
    mesh.position.set(1.3, 5.78, -32.35)
    mesh.name = 'led-wall'
    this.scene.add(mesh)
  }

  async load(venue: Venue, glbUrl: string, placementsUrl: string, texMapUrl: string): Promise<void> {
    this.venue = venue

    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    // Self-hosted (copied from three's own examples/jsm/libs/draco/gltf), so the decoder
    // comes from our origin and our cache, and the background warm-up can fetch it.
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)

    const [gltf, placements, texMap] = await Promise.all([
      loader.loadAsync(glbUrl),
      fetch(placementsUrl).then((r) => (r.ok ? (r.json() as Promise<Placements>) : ({} as Placements))),
      fetch(texMapUrl).then((r) =>
        r.ok ? (r.json() as Promise<Record<string, string>>) : ({} as Record<string, string>),
      ),
    ])
    draco.dispose()

    // A prototype is a LIST of meshes, not one mesh. A glTF mesh carrying more than
    // one material is several primitives, and GLTFLoader turns that into a Group of
    // child meshes whose names it suffixes — so keying on the child's own name coined
    // prototype names that no placement list had, and the lookup below silently
    // skipped them. Seven of the fifteen families went that way and were never drawn
    // at all: the sofa cushions and the ottoman blocks on every VVIP booth, plus the
    // lamps, subs, LED strips and hoops. The name to key on is the Group's, which is
    // the node name the build wrote.
    const protos = new Map<string, THREE.Mesh[]>()
    const statics: THREE.Mesh[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.applyMatrix4(m.matrixWorld)
      const owner = m.parent?.name?.startsWith('proto_') ? m.parent.name : m.name
      const base = owner.replace(/\.\d+$/, '')
      if (base.startsWith('proto_')) protos.set(base, [...(protos.get(base) ?? []), m])
      else statics.push(m)
    })

    // The model textures 164 materials. Firing 164 requests at once on a phone just
    // queues them in a worse order, so they go through a small pool instead: the scene
    // paints immediately in each material's flat source colour and the artwork lands
    // as it arrives. Nothing here blocks the first frame.
    const tex = new THREE.TextureLoader()
    const cache = new Map<string, THREE.Texture>()
    const queue: Array<() => Promise<void>> = []
    const branded = (slug: string, onLoad: (t: THREE.Texture) => void) => {
      const hit = cache.get(slug)
      if (hit) {
        onLoad(hit)
        return
      }
      queue.push(
        () =>
          new Promise<void>((done) => {
            tex.load(
              `/venue/tex/${slug}.webp`,
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace
                // Geometry carries glTF UVs (v=0 at the top). TextureLoader defaults
                // to three's bottom-up convention, which lands every piece of artwork
                // upside down; GLTFLoader sets this for its own textures, and these
                // are loaded by hand, so they have to set it too.
                t.flipY = false
                t.anisotropy = this.mobile ? 2 : 8
                t.wrapS = t.wrapT = THREE.RepeatWrapping
                cache.set(slug, t)
                onLoad(t)
                done()
              },
              undefined,
              () => done(),
            )
          }),
      )
    }
    this.drainLater = () => {
      const lanes = this.mobile ? 4 : 8
      let i = 0
      const pump = (): Promise<void> => {
        if (this.disposed || i >= queue.length) return Promise.resolve()
        return queue[i++]().then(pump)
      }
      for (let k = 0; k < lanes; k++) void pump()
    }

    for (const m of statics) {
      m.position.set(0, 0, 0)
      m.rotation.set(0, 0, 0)
      m.scale.set(1, 1, 1)
      m.castShadow = true
      m.receiveShadow = true
      this.tune(m, texMap, branded)
      this.scene.add(m)
    }

    // Place every prototype the build emitted. The build decides what is worth
    // instancing — hand-listing them here just meant new ones silently went missing.
    //
    // tune() applies to these exactly as much as it does to the static geometry, and
    // until it did, every instanced object — the VVIP furniture, the cocktail tables,
    // the barriers — kept its raw export material, which is not usable as it stands.
    // The exporter writes KHR_materials_ior with an ior of 1000 on all 320 materials;
    // GLTFLoader honours that as a MeshPhysicalMaterial with near-total specular
    // reflectance, and with no environment map in a night scene such a surface returns
    // almost nothing but a hard highlight. That is why the cocktail tables — white
    // spandex poseur tables in the model — came out as dark columns with a bright disc
    // apparently floating above them, and why the furniture read as dark plastic while
    // the static geometry around it read correctly. tune() replaces them with plain
    // standard materials, and attaches the branding, which is keyed by material name
    // and so never reached any instanced surface either.
    for (const [name, parts] of protos) {
      const xf = placements[name]
      if (!xf?.length) continue
      // Measured before the parts are folded into InstancedMeshes, because that is the
      // last moment the furniture exists as boxes rather than as a matrix buffer.
      if (BOOTH_PARTS.has(name)) {
        const boxes = familyBoxes(parts, xf)
        this.boothBoxes.push(...boxes)
      }
      for (const part of parts) {
        this.tune(part, texMap, branded)
        this.instance(part, xf, name.replace(/^proto_/, ''))
      }
    }
    for (const parts of protos.values()) for (const p of parts) p.removeFromParent()

    this.cutAway(CUT_AWAY)
    this.mainScreen()
    this.vvipLight(venue)
    this.eventRig()
    this.tierMarkers(venue)
    if (this.tourOnLoad) this.beginTour()
    else this.setCamera(AERIAL.pos, AERIAL.target, REF_FOV)
    this.resize()
    this.start()
    // Artwork starts downloading only once there is something on screen to put it on.
    this.drainLater?.()
  }

  /**
   * Re-dress a source material for a night scene.
   *
   * The SketchUp export's materials are flat diffuse with no roughness authored, so
   * left alone every surface returns light identically and the whole venue reads as
   * one plastic. This puts the branding back where it belongs by material name, and
   * gives emitters, decks and fabric distinguishable response.
   */
  private tune(
    m: THREE.Mesh,
    texMap: Record<string, string>,
    branded: (slug: string, onLoad: (t: THREE.Texture) => void) => void,
  ) {
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    let isScreenMesh = false
    m.material = mats.map((src) => {
      const name = (src?.name ?? '').trim()
      const prev = src as THREE.MeshStandardMaterial
      // Blender appends .001, .002 … when it imports a second material under a name it
      // already holds, and the texture map is keyed by the source's own names. Eleven
      // materials fell straight through that gap — among them both halves of the
      // Visibility banner run, which is 1,047 m² of printed perimeter banner that was
      // rendering as blank white sheet. An exact hit still wins; the strip is a fallback.
      const slug = texMap[name] ?? texMap[name.replace(/\.\d{3}$/, '')]
      const lower = name.toLowerCase()
      // These tokens are the source's own vocabulary, not a guess: the export names
      // 20 materials "metal", 11 "glass", 9 "translucent", 6 "shiny". SketchUp
      // authors no roughness at all, so without this every surface returns light
      // identically and the whole venue reads as one plastic.
      const glassy = /glass|translucent|acrylic|perspex/.test(lower)
      const metallic = /metal|chrome|steel|alu|corrogated|shiny/.test(lower)
      const col = prev?.color ? prev.color.clone() : new THREE.Color(0x8a93a8)
      // A surface authored as pure black returns nothing under any light, however much
      // of it you aim at it — which is why the front of the stage extension read as a
      // hole cut in the deck rather than a dark face. Real black stage vinyl is not
      // 0,0,0, and giving it somewhere to go is what lets the new front fill land.
      if (col.r + col.g + col.b < 0.02) col.setHex(0x14181f)
      const next = new THREE.MeshStandardMaterial({
        color: col,
        roughness: glassy ? 0.12 : metallic ? 0.38 : 0.84,
        metalness: metallic ? 0.65 : 0.04,
        transparent: glassy,
        opacity: glassy ? 0.34 : 1,
        side: THREE.DoubleSide,
        name,
      })

      const screen = SCREENS[name]
      if (screen) {
        isScreenMesh = true
        // The loop is the screen's own light, not a picture hung on a lit surface: it
        // emits, and it is left out of tone mapping so it keeps its punch against an
        // ACES-rolled night instead of being pulled back to match the vinyl around it.
        // That also makes the screens the only thing above the bloom threshold, which
        // is what gives them the glow without smearing it over the whole site.
        const content = this.screenContent(screen)
        // Black base with an emissive map: a screen makes its own light rather than
        // returning the rig's, so what it shows does not shift with the stage wash.
        next.color.setHex(0x000000)
        next.emissiveMap = content
        next.emissive = new THREE.Color(0xffffff)
        next.emissiveIntensity = 1.45
        next.roughness = 1
        next.metalness = 0
        next.toneMapped = false
        prev?.dispose?.()
        return next
      }

      if (slug) {
        branded(slug, (t) => {
          if (TOO_SMALL_TO_MAP.has(name)) {
            next.color.copy(averageColour(t))
          } else {
            next.map = t
            MAP_LOOKS[name]?.(next)
            // Per-mesh looks set after build (see vvipFurniture) that must survive the
            // artwork arriving, since MAP_LOOKS is keyed by name and names are shared.
            ;(next.userData.afterMap as ((m: THREE.MeshStandardMaterial) => void) | undefined)?.(next)
            for (const give of this.mapTwins.get(name) ?? []) give(t)
          }
          next.needsUpdate = true
        })
      }
      prev?.dispose?.()
      return next
    })
    if (isScreenMesh) this.projectScreenUVs(m)
    if (!Array.isArray(m.material)) return
    if (m.material.length === 1) m.material = m.material[0]
  }

  private instance(
    proto: THREE.Mesh | undefined,
    xforms: Xform[],
    tag: string,
  ): THREE.InstancedMesh | null {
    if (!proto || xforms.length === 0) return null
    // Each part carries its own single material — the caller instances a prototype
    // part by part, so the lamp's twelve materials arrive as twelve parts rather than
    // collapsing into whichever one happened to be first.
    const mesh = new THREE.InstancedMesh(proto.geometry, proto.material, xforms.length)
    mesh.name = tag
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    const m4 = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const col = new THREE.Color()
    xforms.forEach((x, i) => {
      if (x.length >= 10) {
        pos.set(x[0], x[1], x[2])
        quat.set(x[3], x[4], x[5], x[6])
        scl.set(x[7], x[8], x[9])
        m4.compose(pos, quat, scl)
      } else {
        m4.makeTranslation(x[0], x[1], x[2])
      }
      mesh.setMatrixAt(i, m4)
      col.setHex(0xffffff)
      mesh.setColorAt(i, col)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.scene.add(mesh)
    return mesh
  }

  /**
   * Uplighters along the VVIP banner walls, and the fill they throw.
   *
   * Every other lamp in the rig points at the stage — both washes aim upstage, the key
   * comes from over the far shoulder — so the VVIP decks were lit by ambient and
   * nothing else. That is why the booths read as dull the moment they stopped being
   * blown out by bloom: there was never any light on them, only an absence of clipping.
   *
   * These are the fixtures the event would actually carry: a row of pars standing on
   * the deck at the foot of the banner wall, throwing a narrow beam straight up it.
   * They are real lights rather than a gradient painted on the wall, because the wall
   * is two quads and three.js shades it per fragment — the cones come out genuine, and
   * the same lights spill forward onto the booths, which is the half that matters.
   */
  private vvipLight(venue: Venue) {
    const perWall = 6
    const cards: Array<{ x: number; y: number; z: number; w: number; h: number }> = []

    for (const p of venue.platforms) {
      const b = p.backdrop
      const deck = p.centre[1] + p.size[1]
      const wallX = b.centre[0]
      const top = b.centre[1] + b.size[1]
      // The booths stand inboard of the wall, so that is the face worth lighting.
      const inward = wallX < 0 ? 1 : -1
      const z0 = b.centre[2] - b.size[2] / 2
      const z1 = b.centre[2] + b.size[2] / 2

      for (let i = 0; i < perWall; i++) {
        cards.push({
          x: wallX + inward * 0.06,
          y: (deck + top) / 2,
          z: z0 + ((i + 0.5) / perWall) * (z1 - z0),
          w: 1.75,
          h: top - deck,
        })
      }

      // One real lamp per platform, to put some shape back. The beams are painted, so
      // nothing in them actually falls on the furniture; without this the booths are
      // lit by ambient alone and read flat. Held wide, dim and blue so it fills rather
      // than keys — the modelling it adds is the point, not the exposure.
      const spill = new THREE.SpotLight(0x7ea6ff, 46, 46, Math.PI / 3.4, 0.95, 1.0)
      spill.position.set(wallX + inward * 2.4, deck + 4.2, b.centre[2])
      spill.target.position.set(wallX + inward * 9, deck + 0.4, p.centre[2])
      this.scene.add(spill, spill.target)
    }

    // All twelve beams in one draw call, parallel to the wall and a few centimetres
    // off it. Additive, so they lift the banner artwork underneath instead of hiding
    // it, and tone-mapped, so they stay under the bloom threshold and the LED screens
    // remain the only things in the venue that actually glow.
    const wallTex = beamTexture()
    this.beamTexes.push(wallTex)
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: wallTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      // See ground-pools: fog on an additive surface adds the sky colour instead of
      // hiding it, so a distant beam would get brighter rather than fainter.
      fog: false,
      opacity: 0.92,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, cards.length)
    mesh.name = 'vvip-uplight'
    const m4 = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    // A plane's normal is +Z; a quarter turn about Y lays it in the X plane, which is
    // the plane both banner walls stand in.
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    cards.forEach((c, i) => {
      pos.set(c.x, c.y, c.z)
      scale.set(c.w, c.h, 1)
      m4.compose(pos, quat, scale)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }

  /**
   * The event rig: everything that makes the site read as lit, drawn rather than cast.
   *
   * Three draw calls in total, and none of them touches the lighting shader.
   *
   *  1. Sky beams off the fifteen moving heads that are actually in the model, on the
   *     front truss at y 8.15, z -24.1, x -5.4..7.0. They are the one piece of the
   *     rig that reads from every angle on the site, and they are the difference
   *     between a stage and a show. Billboarded about their own axis each frame, or a
   *     flat card seen from the side would vanish.
   *  2. Uplighters up the printed perimeter at the positions measured in UPLIGHTS,
   *     plus the washes on the activations themselves (ACTIVATION_WASHES).
   *  3. The ground light-pool canvas, which is what fills the 85 x 111 m the lamps
   *     cannot reach.
   *  4. The two cut-out lockups at the entry, lit from within. One extra draw call,
   *     and the only one of the five that is geometry the model already had.
   */
  /**
   * Drops every static triangle whose centre lies in one of the boxes. The static
   * geometry is merged by material across the whole site, so there is no object to
   * hide: the index is rebuilt without those triangles and the material groups are
   * renumbered to match. Runs before any lighting pass splits a mesh by region.
   */
  private cutAway(boxes: readonly Box[]) {
    const inside = (x: number, y: number, z: number) =>
      boxes.some((b) => x >= b.x[0] && x <= b.x[1] && y >= b.y[0] && y <= b.y[1] && z >= b.z[0] && z <= b.z[1])
    const v = new THREE.Vector3()
    this.scene.updateMatrixWorld()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || !mesh.name.startsWith('static_')) return
      const g = mesh.geometry
      const pos = g.attributes.position
      const src = g.index
      const total = src ? src.count : pos.count
      const groups = g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }]
      const keep: number[] = []
      const next: { start: number; count: number; materialIndex: number }[] = []
      let dropped = 0
      for (const gr of groups) {
        const start = keep.length
        for (let i = gr.start; i < gr.start + gr.count; i += 3) {
          const a = src ? src.getX(i) : i
          const b = src ? src.getX(i + 1) : i + 1
          const c = src ? src.getX(i + 2) : i + 2
          v.set(
            (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3,
            (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3,
            (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3,
          ).applyMatrix4(mesh.matrixWorld)
          if (inside(v.x, v.y, v.z)) dropped++
          else keep.push(a, b, c)
        }
        next.push({ start, count: keep.length - start, materialIndex: gr.materialIndex ?? 0 })
      }
      if (!dropped) return
      g.setIndex(keep)
      g.clearGroups()
      if (Array.isArray(mesh.material)) for (const gr of next) g.addGroup(gr.start, gr.count, gr.materialIndex)
      g.computeBoundingBox()
      g.computeBoundingSphere()
    })
  }

  private eventRig() {
    this.skyDome()
    this.groundPools()
    this.deckGlow()
    this.perimeterUplight()
    this.skyBeams()
    this.fixtureGlow()
    this.litSigns()
    this.stageTops()
    this.activations()
    this.vvipFurniture()
    this.vvipDecks()
    this.lanternTables()
    this.entrance()
    this.barFridges()
    this.merchOutline()
    this.snowWallNeon()
  }

  /**
   * The walk in, as Slides 1-13 of the lighting treatments draw it.
   *
   *  - Ticketing booth. The snowcastle cut-out over the lanes (`I03_Bluebell_Mist`, a
   *    swatch name: one mesh, the booth only) is the brightest thing in the shot,
   *    white and haloed, so it is driven over the bloom threshold: with the LED
   *    screens it is one of the few things that blooms, by design. The fascia print
   *    (TICKETING / BOOTH, the UNLOCKS mark, the LITE tile) glows like a lit fascia,
   *    and the lane headers and podium snowcastles glow lightly (MAP_LOOKS).
   *  - Ice arch. The fin edges (`K08_Violet_Crush`, which also turns up at the
   *    activations, so boxed to the arch) are the LED outlines in the renders and
   *    bloom; the fin faces and the frosted facade carry a light self-glow (MAP_LOOKS).
   *  - Tunnel. Evenly bright fabric: the CNO / USLK walls (the skirt print, lit here in
   *    the tunnel's own box) and the two portals and the shell print (MAP_LOOKS).
   */
  /**
   * Seat the booth's 3D snowcastle on the printed snowcastle in the fascia artwork (see
   * BOOTH_FACE), and split its faces so only the front glows: the side walls and back
   * are 15 cm of extrusion, and lit as brightly as the face they doubled its outline.
   */
  private mountOnFascia(mesh: THREE.Mesh, glow: THREE.MeshStandardMaterial) {
    mesh.userData.mounted = true
    mesh.updateMatrixWorld(true)
    const world = mesh.matrixWorld.clone()
    const { normal, mark, slope } = BOOTH_FACE
    const centre = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
    // Turn about its own centre to the fascia's skew, then centre it on the mark.
    const turn = new THREE.Matrix4()
      .makeTranslation(centre.x, centre.y, centre.z)
      .multiply(new THREE.Matrix4().makeRotationY(Math.atan(slope)))
      .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z))
    const toMark = new THREE.Vector3().subVectors(mark, centre)
    toMark.addScaledVector(normal, -toMark.dot(normal)) // in the fascia plane only
    const W = new THREE.Matrix4().makeTranslation(toMark.x, toMark.y, toMark.z).multiply(turn).multiply(world)
    // Then out along the face normal until its back face is 1.5 cm proud.
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    const pos = geo.attributes.position as THREE.BufferAttribute
    const p = new THREE.Vector3()
    let back = Infinity
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(W)
      back = Math.min(back, p.sub(mark).dot(normal))
    }
    const lift = normal.clone().multiplyScalar(0.015 - back)
    W.premultiply(new THREE.Matrix4().makeTranslation(lift.x, lift.y, lift.z))
    geo.applyMatrix4(new THREE.Matrix4().copy(world).invert().multiply(W))

    // Front faces (facing out of the fascia) first, then sides and back.
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const front: number[] = []
    const rest: number[] = []
    for (let t = 0; t < pos.count; t += 3) {
      a.fromBufferAttribute(pos, t).applyMatrix4(world)
      b.fromBufferAttribute(pos, t + 1).applyMatrix4(world)
      c.fromBufferAttribute(pos, t + 2).applyMatrix4(world)
      const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize()
      ;(Math.abs(n.dot(normal)) > 0.9 && n.dot(normal) > 0 ? front : rest).push(t)
    }
    const sorted = new THREE.BufferGeometry()
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const src = attr as THREE.BufferAttribute
      const out = new (src.array.constructor as Float32ArrayConstructor)(src.array.length)
      let o = 0
      for (const t of [...front, ...rest]) {
        out.set(src.array.subarray(t * src.itemSize, (t + 3) * src.itemSize), o)
        o += 3 * src.itemSize
      }
      sorted.setAttribute(name, new THREE.BufferAttribute(out, src.itemSize, src.normalized))
    }
    sorted.addGroup(0, front.length * 3, 0)
    sorted.addGroup(front.length * 3, rest.length * 3, 1)
    mesh.geometry.dispose()
    geo.dispose()
    mesh.geometry = sorted
    const sides = new THREE.MeshStandardMaterial({
      name: 'I03_Bluebell_Mist (sides)',
      color: 0x9fb1dc,
      emissive: 0x5d73b8,
      emissiveIntensity: 0.35,
      roughness: 0.7,
      metalness: 0,
      side: glow.side,
    })
    mesh.material = [glow, sides]
  }

  private entrance() {
    const BOOTH_FASCIA: Box = { x: [-55.6, -53.9], y: [2.55, 3.95], z: [22.8, 37.6] }
    const ARCH: Box = { x: [-45.3, -44.3], y: [-0.1, 3.1], z: [28.4, 32.3] }
    const TUNNEL: Box = { x: [-44.8, -36.2], y: [-0.1, 3.5], z: [27.6, 33.5] }

    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = mat as THREE.MeshStandardMaterial
        if (m.name !== 'I03_Bluebell_Mist') continue
        // The fascia print already carries this snowcastle between TICKETING and
        // BOOTH; the model stands the cut-out a little behind it, so only its arms
        // poked out. The renders show it as a raised lit sign, so mount it ON the
        // printed mark: rotated to the fascia's 4 degree skew, centred on the print and
        // 1.5 cm proud. Anywhere else it floats off the print and reads as two logos.
        if (!mesh.userData.mounted) this.mountOnFascia(mesh, m)
        // Under the bloom threshold: bloomed, the castle inside the snowflake washed
        // out into a white blob. The halo is drawn instead (below).
        m.color.setHex(0xdfe8ff)
        m.emissive = new THREE.Color(0xe6efff)
        m.emissiveIntensity = 0.8
        m.needsUpdate = true
      }
    })
    // The halo round the snowcastle: one soft card between the raised mark and the
    // fascia, so the fascia glows around it the way it does in Slides 1-6.
    // Dark in the middle, so the castle's cut-outs keep showing the blue fascia.
    const haloTex = lightPool([225, 236, 255], [150, 185, 255], 2.6, 0.62)
    this.beamTexes.push(haloTex)
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3),
      new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      }),
    )
    halo.name = 'booth-logo-halo'
    // Between the mounted sign and the fascia, square to the fascia face.
    halo.rotation.y = -Math.PI / 2 + Math.atan(BOOTH_FACE.slope)
    halo.position.copy(BOOTH_FACE.mark).addScaledVector(BOOTH_FACE.normal, 0.008)
    this.scene.add(halo)
    this.lightWithin('Ticketing Area', [BOOTH_FASCIA], (glow) => selfLit(glow, 0.45))
    this.lightWithin(
      'K08_Violet_Crush',
      [ARCH],
      (glow) => {
        glow.color.setHex(0xe8f1ff)
        glow.emissive = new THREE.Color(0xbcd5ff)
        glow.emissiveIntensity = 3.2
      },
      { artwork: false },
    )
    this.lightWithin('Skirting banner1', [TUNNEL], (glow) => selfLit(glow, 0.5))
  }

  /**
   * Bars (Slides 11, 20): the drinks fridges are the light. Each bar has a pair, five
   * bars in all, and these materials (SketchUp's names, 冰柜 = "fridge") are on the
   * fridges and nothing else, so they are dressed whole.
   *  - 冰柜d115 is the cabinet inside: lit cool white, it is what glows through the doors.
   *  - 冰柜d117 is the door glass, exported opaque grey, which hid the inside entirely.
   *  - 冰柜d119 are the vertical LED strips at the door edges, over the bloom threshold.
   * The header lightbox and the dimmer canopy and counter prints are in MAP_LOOKS.
   */
  private barFridges() {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = mat as THREE.MeshStandardMaterial
        if (m.name === '冰柜d115') {
          m.color.setHex(0xf2f6ff)
          m.emissive = new THREE.Color(0xe8f0ff)
          m.emissiveIntensity = 0.7
        } else if (m.name === '冰柜d117') {
          m.color.setHex(0xd6e4ff)
          m.transparent = true
          m.opacity = 0.22
          m.depthWrite = false
          m.roughness = 0.1
          m.metalness = 0
          m.emissive = new THREE.Color(0xcfe0ff)
          m.emissiveIntensity = 0.25
        } else if (m.name === '冰柜d119') {
          m.color.setHex(0xffffff)
          m.emissive = new THREE.Color(0xeef4ff)
          m.emissiveIntensity = 2.2
        } else continue
        m.needsUpdate = true
      }
    })
  }

  /**
   * Merch container (Slide 14): a white LED outline on every frame edge and round the
   * arched doorway, on a dark blue frame. The outline is `K08_Violet_Crush`, the same
   * LED material as the ice arch's fin edges; the frame is `I05_Twilight_Wave`, which
   * also frames the photo booth and the arcades, where it stays brand blue. Both are
   * lit only inside the container's box. The arch (`I06_Sapphire_Night`) is the
   * container's alone, so it is set in activations().
   */
  private merchOutline() {
    this.lightWithin(
      'K08_Violet_Crush',
      [MERCH_BOX],
      (glow) => {
        glow.color.setHex(0xe8f1ff)
        glow.emissive = new THREE.Color(0xbcd5ff)
        glow.emissiveIntensity = 3.2
      },
      { artwork: false },
    )
    this.lightWithin(
      'I05_Twilight_Wave',
      [MERCH_BOX],
      (frame) => {
        frame.emissive = new THREE.Color(0x1f45ff)
        frame.emissiveIntensity = 0.28
      },
      { artwork: false },
    )
  }

  /**
   * The snow wall (Slide 16): the running figure is a blue neon tube with a halo, the
   * hero light of the corridor. In the model it is a dark outline in `K08_Violet_Crush`
   * (the LED material again), so it is lit in its own box, in Castle Lite blue rather
   * than the white of the arch and the container, with a soft blue tint on the
   * snow round it. The EXTRA COLD lockup above it is the same cut-out sign material
   * as the entry and VVIP signs, and is lit like them.
   */
  private snowWallNeon() {
    this.lightWithin(
      'K08_Violet_Crush',
      [SNOW_FIGURE_BOX],
      (glow) => {
        glow.color.setHex(0x7d9bff)
        glow.emissive = new THREE.Color(0x2a5cff)
        glow.emissiveIntensity = 3.0
      },
      { artwork: false },
    )
    this.lightWithin(SIGN_MATERIAL, [SNOW_SIGN_BOX], (glow) => {
      glow.emissive = new THREE.Color(SIGN_GLOW)
      glow.emissiveIntensity = 1.25
    })
    for (const logo of ['castle logo_1', 'castle logo_2']) {
      this.lightWithin(logo, [SNOW_SIGN_BOX], (glow) => selfLit(glow, 0.9))
    }
    // The wall is white, so an additive halo could only make it whiter. Neon on snow
    // TINTS it: the halo multiplies what is behind it by a soft blue falloff (white at
    // the rim, so it leaves the wall untouched there), which also deepens the tube.
    const S = 256
    const data = new Uint8Array(S * S * 4)
    const tint = [0.42, 0.56, 1.0]
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = ((x + 0.5) / S) * 2 - 1
        const v = ((y + 0.5) / S) * 2 - 1
        const r2 = u * u + v * v
        const k = r2 >= 1 ? 0 : Math.exp(-r2 * 2.2) * (1 - r2) ** 2
        const i = (y * S + x) * 4
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(255 * (1 - k * (1 - tint[c])))
        data[i + 3] = 255
      }
    }
    const tex = new THREE.DataTexture(data, S, S)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    this.beamTexes.push(tex)
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.DstColorFactor,
        blendDst: THREE.ZeroFactor,
      }),
    )
    halo.scale.set(1, 1.15, 1)
    halo.name = 'snow-figure-halo'
    halo.rotation.y = Math.PI / 2
    halo.position.set(-27.47, 0.95, 45.2)
    this.scene.add(halo)
  }

  /**
   * The VVIP platforms themselves, as Slides 23-24 draw them: the skirt round each deck
   * is a lit fascia with the CNO / USLK pattern glowing royal blue, the deck surface
   * catches light, and the white cut-out shapes on the two backdrops (the snowflakes
   * and the zig-zags either side of the EXTRA COLD sign) glow white.
   *
   * The skirt print and the deck carpet are shared with the stage skirt and the
   * activation deck, so both are lit only inside the platforms' own boxes. The cut-outs
   * (`L03_Flamingo_Blaze`, a SketchUp swatch name: the geometry is white in the render)
   * exist on the two backdrops and nowhere else, so that material is lit whole.
   */
  private vvipDecks() {
    const venue = this.venue
    if (!venue) return
    const around = (p: (typeof venue.platforms)[number], y: [number, number]): Box => ({
      x: [p.centre[0] - p.size[0] / 2 - 0.4, p.centre[0] + p.size[0] / 2 + 0.4],
      y,
      z: [p.centre[2] - p.size[2] / 2 - 0.4, p.centre[2] + p.size[2] / 2 + 0.4],
    })
    const skirts = venue.platforms.map((p) => around(p, [-0.1, 1.04]))
    const decks = venue.platforms.map((p) => around(p, [0.98, 1.14]))
    this.lightWithin('Skirting banner1', skirts, (glow) => selfLit(glow, 0.6))
    this.lightWithin('Screenshot 2025-07-16 180001', decks, (glow) => selfLit(glow, 0.3), { flatOnly: true })

    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = mat as THREE.MeshStandardMaterial
        if (m.name !== 'L03_Flamingo_Blaze') continue
        m.color.setHex(0xf2f6ff)
        m.emissive = new THREE.Color(0xdbe7ff)
        m.emissiveIntensity = 0.55
        m.needsUpdate = true
      }
    })
  }

  /**
   * The VIP standing lantern tables in front of the stage (Slides 23-26, 29): white
   * laser-cut columns lit from inside, blue-violet and brightest at the foot, each
   * throwing a small pool on the turf, with the printed blue top lit.
   *
   * The model draws each as four cut-out side panels (`metal7`, 376 = 94 x 4) on the
   * same brushed-metal texture as the VVIP furniture, and a top in `[0104_MediumBlue]2`.
   * A lantern is found by grouping its four panels; the core and the pool are placed
   * at the group's centre, so they follow the model rather than a grid of our own.
   *
   * The pools are kept to the foot of each column. The white cocktail-table field
   * behind (z > ~20) is to stay exactly as it is: Francis's direction, 24 Nov 2026.
   */
  private lanternTables() {
    let panels: THREE.InstancedMesh | undefined
    this.scene.traverse((o) => {
      const im = o as THREE.InstancedMesh
      if (im.isInstancedMesh && im.name === 'metal7') panels = im
    })
    if (!panels) return
    for (const mat of Array.isArray(panels.material) ? panels.material : [panels.material]) {
      const m = mat as THREE.MeshStandardMaterial
      // White cut-outs carrying the violet of the light inside them, as the renders show.
      const dress = (mm: THREE.MeshStandardMaterial) => {
        matteWhite(mm, 0.3)
        mm.color.setHex(0xe6e9fb)
        mm.emissive.setHex(0x7468ff)
      }
      dress(m)
      m.userData.afterMap = dress
    }

    // Panel centres in world space, then grouped: the four sides of one lantern sit
    // within ~0.3 m of its centre, and lanterns stand metres apart.
    panels.geometry.computeBoundingBox()
    const local = new THREE.Vector3()
    panels.geometry.boundingBox!.getCenter(local)
    const m4 = new THREE.Matrix4()
    const groups: Array<{ sum: THREE.Vector3; n: number }> = []
    for (let i = 0; i < panels.count; i++) {
      panels.getMatrixAt(i, m4)
      const p = local.clone().applyMatrix4(m4)
      const g = groups.find((k) => Math.hypot(k.sum.x / k.n - p.x, k.sum.z / k.n - p.z) < 0.5)
      if (g) {
        g.sum.add(p)
        g.n++
      } else groups.push({ sum: p, n: 1 })
    }
    const centres = groups.map((g) => g.sum.divideScalar(g.n))
    if (!centres.length) return

    // The core: a column of light inside each lantern, violet-blue at the foot.
    const coreGeo = new THREE.CylinderGeometry(0.15, 0.16, 1.0, 10, 1, true)
    // Saturated rather than bright: over ~1.0 ACES rolls violet to white and it stops
    // reading as coloured light through the white lattice.
    rampColours(coreGeo, new THREE.Color(0x5a46ff).multiplyScalar(1.5), new THREE.Color(0x5f78ff).multiplyScalar(0.55))
    const cores = new THREE.InstancedMesh(
      coreGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }),
      centres.length,
    )
    cores.name = 'lantern-cores'
    // The pool on the turf at each foot.
    //
    // Blended as LIGHT ON the turf, not paint over it: result = ground x (1 + pool).
    // An additive pool adds its own colour whatever it lands on, so a violet-white
    // pool on green grass came out as a milky grey-lilac blotch (Francis: "doesn't
    // feel natural"). Multiplying by the ground keeps the grass green and only makes
    // it brighter and slightly cooler near the foot, which is what a fixture does.
    const poolTex = lightPool([215, 225, 255], [170, 185, 255], 3.0)
    this.beamTexes.push(poolTex)
    const poolGeo = new THREE.PlaneGeometry(2.6, 2.6)
    poolGeo.rotateX(-Math.PI / 2)
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneFactor,
      depthWrite: false,
      fog: false,
    })
    // Gain at the foot: the grass there is lit to ~3.6x, falling to 1x at the rim.
    poolMat.color.setScalar(2.6)
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, centres.length)
    pools.name = 'lantern-pools'
    centres.forEach((c, i) => {
      cores.setMatrixAt(i, m4.makeTranslation(c.x, 0.54, c.z))
      pools.setMatrixAt(i, m4.makeTranslation(c.x, 0.025, c.z))
    })
    for (const mesh of [cores, pools]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false
      this.scene.add(mesh)
    }

    // The printed top, lit enough that the logo reads. Boxed to the field so the same
    // material anywhere else (none today) is left alone.
    //
    // The source maps this artwork upside down on the lantern tops (a vertical mirror:
    // the letters run left to right but REFRESHMENT sits above EXTRA, and the coffee
    // tables on the platforms, same artwork family, read correctly). Flipped in V on a
    // clone so it reads upright from the field, facing the stage.
    let flipped: THREE.Texture | null = null
    this.lightWithin(
      '[0104_MediumBlue]2',
      [{ x: [-14, 14], y: [0.9, 1.4], z: [-21, 19] }],
      (glow) => {
        const src = glow.map
        if (src && !src.userData.vFlipped) {
          if (!flipped || flipped.source !== src.source) {
            flipped = src.clone()
            flipped.repeat.set(1, -1)
            flipped.userData.vFlipped = true
            flipped.needsUpdate = true
          }
          glow.map = flipped
        }
        selfLit(glow, 0.32)
      },
      { flatOnly: true },
    )
  }

  /**
   * The VVIP lounge furniture as the renders draw it: LED furniture, lit from inside.
   *
   * Slides 23-24 of the lighting treatments show every sofa and hex ottoman on the two
   * platforms as a glowing white block, light coming out through the laser-cut sides
   * and spilling onto the deck. The model carries the furniture as the instanced
   * families below, with the cut-out sides on a brushed-metal texture (which is why
   * they read as silver office furniture) and a small `I04_Royal_Indigo` part inside
   * each piece that is the source's own LED.
   *
   * All of it is drawn, not lit (see the note on SpotLights at GROUND_POOLS):
   *  - the sides and the bodies go matte white and carry a little self-light;
   *  - the model's LED parts glow;
   *  - a core box inside every sofa and ottoman, brightest at the foot, shows through
   *    the cut-outs: one InstancedMesh, unlit material;
   *  - a soft pool on the deck around each piece: one more InstancedMesh, additive.
   * Two draw calls in all. Everything stays tone-mapped, so none of it blooms: the LED
   * screens remain the only thing over the threshold, and the table picker's tier pads
   * under the coffee tables are left alone (the pools are kept off them).
   */
  private vvipFurniture() {
    const LATTICE = new Set(['table', 'metal1', 'metal2', 'c8'])
    const SEATS = new Set(['cushion', 'cushion2'])
    const bodies: Array<{ mesh: THREE.InstancedMesh; inset: [number, number, number]; yFrom: number }> = []
    const white = matteWhite

    this.scene.traverse((o) => {
      const im = o as THREE.InstancedMesh
      if (!im.isInstancedMesh) return
      const mats = (Array.isArray(im.material) ? im.material : [im.material]) as THREE.MeshStandardMaterial[]
      const isFurniture = LATTICE.has(im.name) || SEATS.has(im.name) || im.name === 'sofa'
      if (!isFurniture) return
      for (const m of mats) {
        if (/Royal_Indigo/.test(m.name)) {
          // The source's own LED parts.
          m.color.setHex(0x9fb4ff)
          m.emissive = new THREE.Color(0x8ea6ff)
          m.emissiveIntensity = 1.75
          m.needsUpdate = true
        } else if (SEATS.has(im.name)) {
          // The seat pads keep their stitched print, lifted from grey to white.
          m.color.setHex(0xffffff)
          m.emissive = new THREE.Color(0xe4edff)
          m.emissiveIntensity = 0.15
          m.userData.afterMap = (mm: THREE.MeshStandardMaterial) => {
            mm.emissiveMap = mm.map
            mm.emissiveIntensity = 0.24
          }
          m.needsUpdate = true
        } else if (im.name === 'sofa') {
          // The sofa body is a closed box behind the cut-out front and back, so a core
          // inside it would never be seen: the body itself is what shows through the
          // holes, and it is the part that glows.
          white(m, 1.0)
          m.emissive.setHex(0xc4d6ff)
        } else {
          // Brushed metal -> matte white. The artwork streams in later and would put
          // the metal back, so the swap is repeated when it lands.
          white(m, 0.11)
          m.userData.afterMap = (mm: THREE.MeshStandardMaterial) => white(mm, 0.11)
        }
      }
      // The sofa body and the ottoman seat are the two references for the cores:
      // the sofa's own box, and the ottoman's pad with the body hanging below it.
      // The sofa gets no core (its body glows instead, above), only its pool.
      if (im.name === 'sofa') bodies.push({ mesh: im, inset: [0, 0, 0], yFrom: 0 })
      if (im.name === 'cushion' && mats.some((m) => !/Royal_Indigo/.test(m.name)))
        bodies.push({ mesh: im, inset: [0.7, 0, 0.7], yFrom: 0.42 })
    })

    // Cores and pools, measured off each family's prototype and carried to every copy
    // by that copy's own instance matrix, so they cannot drift from the furniture.
    const cores: THREE.Matrix4[] = []
    const pools: THREE.Matrix4[] = []
    const box = new THREE.Box3()
    const c = new THREE.Vector3()
    const s = new THREE.Vector3()
    const inst = new THREE.Matrix4()
    for (const { mesh, inset, yFrom } of bodies) {
      mesh.geometry.computeBoundingBox()
      box.copy(mesh.geometry.boundingBox!)
      box.getCenter(c)
      box.getSize(s)
      // Sofa: shrink the body. Ottoman: the pad sits on top, so the core hangs from
      // just under it down to the deck (yFrom is that drop in metres).
      const core = yFrom
        ? new THREE.Matrix4().compose(
            new THREE.Vector3(c.x, c.y - s.y / 2 - yFrom / 2, c.z),
            new THREE.Quaternion(),
            new THREE.Vector3(s.x * inset[0], yFrom * 0.86, s.z * inset[2]),
          )
        : new THREE.Matrix4().compose(
            c.clone(),
            new THREE.Quaternion(),
            new THREE.Vector3(s.x * inset[0], s.y * inset[1], s.z * inset[2]),
          )
      const footY = yFrom ? c.y - s.y / 2 - yFrom : c.y - s.y / 2
      const pool = new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, footY + 0.012, c.z),
        new THREE.Quaternion(),
        new THREE.Vector3(s.x * 1.5, 1, s.z * 1.6),
      )
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, inst)
        if (inset[0] > 0) cores.push(inst.clone().multiply(core))
        pools.push(inst.clone().multiply(pool))
      }
    }
    if (!cores.length) return

    // Brightest at the foot, the way an LED strip on the floor of the frame throws it.
    const coreGeo = new THREE.BoxGeometry(1, 1, 1)
    const pos = coreGeo.attributes.position
    const tint = new Float32Array(pos.count * 3)
    // Over 1.0 on purpose: the core has to out-shine the lit white lattice in front of it
    // to read through the cut-outs, and ACES rolls it back under the bloom threshold.
    const lo = new THREE.Color(0xe8f0ff).multiplyScalar(1.6)
    const hi = new THREE.Color(0x7d95e8).multiplyScalar(0.75)
    const mix = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      mix.copy(lo).lerp(hi, pos.getY(i) + 0.5)
      tint.set([mix.r, mix.g, mix.b], i * 3)
    }
    coreGeo.setAttribute('color', new THREE.BufferAttribute(tint, 3))
    const coreMesh = new THREE.InstancedMesh(
      coreGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
      cores.length,
    )
    coreMesh.name = 'vvip-furniture-cores'
    cores.forEach((m, i) => coreMesh.setMatrixAt(i, m))
    coreMesh.instanceMatrix.needsUpdate = true
    coreMesh.frustumCulled = false
    this.scene.add(coreMesh)

    // The spill on the deck: a soft rounded-rectangle glow under each piece.
    const N = 128
    const cv = document.createElement('canvas')
    cv.width = cv.height = N
    const ctx = cv.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(N / 2, N / 2, N * 0.12, N / 2, N / 2, N / 2)
      g.addColorStop(0, 'rgba(205,222,255,1)')
      g.addColorStop(0.45, 'rgba(120,150,255,0.6)')
      g.addColorStop(1, 'rgba(90,120,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, N, N)
    }
    const poolTex = new THREE.CanvasTexture(cv)
    poolTex.colorSpace = THREE.SRGBColorSpace
    this.beamTexes.push(poolTex)
    const poolGeo = new THREE.PlaneGeometry(1, 1)
    poolGeo.rotateX(-Math.PI / 2)
    const poolMesh = new THREE.InstancedMesh(
      poolGeo,
      new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0.37,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
      pools.length,
    )
    poolMesh.name = 'vvip-furniture-pools'
    pools.forEach((m, i) => poolMesh.setMatrixAt(i, m))
    poolMesh.instanceMatrix.needsUpdate = true
    poolMesh.frustumCulled = false
    this.scene.add(poolMesh)
  }

  /**
   * A graded night sky instead of a flat fill.
   *
   * `scene.background` is one colour, which gives a horizon that is exactly as dark
   * as the zenith — and nothing in nature is, least of all over a lit site. With the
   * beams now cutting upward there is something crossing that sky, and against a flat
   * fill they ended at an invisible wall. Graded, they pass through air.
   *
   * The horizon end matches the fog colour, so distant geometry dissolves into the
   * sky rather than being cut out against it. Drawn on a sphere rather than as a
   * screen-space background so it stays level while the camera tilts, and kept
   * centred on the camera so the far plane never reaches it.
   */
  private skyDome() {
    const geo = new THREE.SphereGeometry(300, 24, 16)
    const pos = geo.attributes.position
    const col = new Float32Array(pos.count * 3)
    const low = new THREE.Color(HAZE)
    const high = new THREE.Color(0x03050d)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      // Slightly below the horizon too, so the ground plane's edge has sky behind it.
      const t = THREE.MathUtils.clamp((pos.getY(i) / 300 + 0.08) / 0.72, 0, 1)
      c.copy(low).lerp(high, Math.pow(t, 0.75))
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const dome = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        vertexColors: true,
        fog: false,
        depthWrite: false,
      }),
    )
    dome.name = 'sky'
    dome.renderOrder = -1
    dome.frustumCulled = false
    this.dome = dome
    this.scene.add(dome)
  }

  /** One additive canvas over the whole site, painting where the light falls. */
  private groundPools() {
    const X0 = -84
    const X1 = 44
    const Z0 = -50
    const Z1 = 78
    const N = 1024
    const c = document.createElement('canvas')
    c.width = N
    c.height = N
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, N, N)
    ctx.globalCompositeOperation = 'lighter'

    // flipY is on for a canvas texture, so canvas row 0 ends up at v = 1, which after
    // the quarter turn that lays the plane flat is the MIN z edge. Hence z maps
    // straight down the canvas rather than up it.
    const px = (x: number) => ((x - X0) / (X1 - X0)) * N
    const py = (z: number) => ((z - Z0) / (Z1 - Z0)) * N
    const sx = N / (X1 - X0)

    const pool = (x: number, z: number, rx: number, rz: number, col: [number, number, number], a: number) => {
      const r = Math.max(rx, rz) * sx
      ctx.save()
      ctx.translate(px(x), py(z))
      ctx.scale(1, rz / rx)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * sx)
      // Five stops on a smooth curve. Three left a visible ring where the middle one
      // sat, which on the field read as a hard-edged diamond of light rather than as
      // a pool — the one thing that gives a painted light away.
      for (const [t, k] of [[0, 1], [0.3, 0.74], [0.55, 0.42], [0.8, 0.14], [1, 0]]) {
        g.addColorStop(t, `rgba(${col[0]},${col[1]},${col[2]},${a * k})`)
      }
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, rx * sx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      void r
    }

    for (const q of GROUND_POOLS) pool(q.x, q.z, q.rx, q.rz, q.c, q.a)
    // Each perimeter uplighter throws its own small pool at the foot of the wall.
    for (const [x, z, nx, nz] of UPLIGHTS) {
      pool(x + nx * 1.6, z + nz * 1.6, 3.6, 3.6, [120, 170, 250], 0.3)
    }

    // One blur over the lot. At 8 px to the metre this is about a metre of softening,
    // which is roughly the penumbra a real fixture on a stand throws and is enough to
    // stop any single pool reading as a shape.
    const soft = document.createElement('canvas')
    soft.width = N
    soft.height = N
    const sctx = soft.getContext('2d')
    if (sctx) {
      sctx.filter = 'blur(9px)'
      sctx.drawImage(c, 0, 0)
    }

    const tex = new THREE.CanvasTexture(sctx ? soft : c)
    tex.colorSpace = THREE.SRGBColorSpace
    this.poolTex = tex
    const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0)
    geo.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        // Additive and fogged is a contradiction: fog would ADD the sky colour to
        // every pixel of a 128 m plane and lift the whole ground off black.
        fog: false,
      }),
    )
    mesh.name = 'ground-pools'
    mesh.position.set((X0 + X1) / 2, 0.03, (Z0 + Z1) / 2)
    // After the opaque pass, so it lies on the grass instead of fighting it.
    mesh.renderOrder = 2
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }

  /** Beam cards up the printed perimeter, one InstancedMesh for the lot. */
  /** Paint DECK_POOLS onto one sheet laid on the activation deck. One draw call. */
  private deckGlow() {
    const W = 128
    const H = Math.round((W * (DECK_AREA.z[1] - DECK_AREA.z[0])) / (DECK_AREA.x[1] - DECK_AREA.x[0]))
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    const sx = W / (DECK_AREA.x[1] - DECK_AREA.x[0])
    for (const q of DECK_POOLS) {
      ctx.save()
      // Same orientation as groundPools: z runs down the canvas.
      ctx.translate((q.x - DECK_AREA.x[0]) * sx, (q.z - DECK_AREA.z[0]) * sx)
      ctx.scale(1, q.rz / q.rx)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, q.rx * sx)
      for (const [t, k] of [[0, 1], [0.3, 0.74], [0.55, 0.42], [0.8, 0.14], [1, 0]]) {
        g.addColorStop(t, `rgba(${q.c[0]},${q.c[1]},${q.c[2]},${q.a * k})`)
      }
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, q.rx * sx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const w = DECK_AREA.x[1] - DECK_AREA.x[0]
    const h = DECK_AREA.z[1] - DECK_AREA.z[0]
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    )
    mesh.name = 'deck-pools'
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((DECK_AREA.x[0] + DECK_AREA.x[1]) / 2, DECK_Y, (DECK_AREA.z[0] + DECK_AREA.z[1]) / 2)
    mesh.renderOrder = 2
    this.scene.add(mesh)
  }

  private perimeterUplight() {
    const cards: Array<{ p: THREE.Vector3; q: THREE.Quaternion; w: number; h: number }> = []
    const up = new THREE.Vector3(0, 0, 1)
    const facing = (nx: number, nz: number) =>
      new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(nx, 0, nz).normalize())
    // The 7 cm stand-off from the wall is already in the measured positions.
    for (const [x, z, nx, nz] of UPLIGHTS) {
      cards.push({ p: new THREE.Vector3(x, UPLIGHT_WALL_H / 2, z), q: facing(nx, nz), w: 2.0, h: UPLIGHT_WALL_H })
    }
    for (const [x, z, nx, nz] of VVIP_UPLIGHTS) {
      cards.push({
        p: new THREE.Vector3(x, VVIP_UPLIGHT_BASE + VVIP_UPLIGHT_H / 2, z),
        q: facing(nx, nz),
        w: 1.8,
        h: VVIP_UPLIGHT_H,
      })
    }
    for (const a of ACTIVATION_WASHES) {
      cards.push({ p: new THREE.Vector3(a.p[0], a.p[1], a.p[2]), q: facing(a.n[0], a.n[1]), w: a.w, h: a.h })
    }
    if (!cards.length) return

    const tex = beamTexture({ spread: 0.85, falloff: 1.0 })
    this.beamTexes.push(tex)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity: 0.8,
    })
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, cards.length)
    mesh.name = 'perimeter-uplight'
    const m4 = new THREE.Matrix4()
    const scale = new THREE.Vector3()
    cards.forEach((c, i) => {
      scale.set(c.w, c.h, 1)
      m4.compose(c.p, c.q, scale)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.renderOrder = 3
    this.scene.add(mesh)
  }

  /**
   * Shafts into the sky off the fifteen heads on the front truss.
   *
   * Their positions are the model's own, read from the lamp family's instance
   * matrices. The fan is the obvious one a lighting designer would call: the outer
   * heads thrown wide, the inner ones held near vertical, everything tilted forward
   * over the audience so the beams cross the field the camera is standing in.
   */
  private skyBeams() {
    const BASE = { y: 8.15, z: -24.1 }
    const xs = [-5.43, -4.5, -3.67, -2.71, -1.79, -1.01, -0.09, 0.78, 1.71, 2.54, 3.46, 4.35, 5.27, 6.1, 7.03]
    const centre = 0.8

    const tex = beamTexture({ spread: 0.5, falloff: 0.8, edge: [70, 120, 235], core: [245, 250, 255] })
    this.beamTexes.push(tex)
    const geo = new THREE.PlaneGeometry(1, 1)
    // Pivot at the fixture rather than at the middle of the shaft.
    geo.translate(0, 0.5, 0)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity: 0.5,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, xs.length)
    mesh.name = 'sky-beams'
    mesh.frustumCulled = false
    mesh.renderOrder = 3

    const col = new THREE.Color()
    xs.forEach((x, i) => {
      const off = x - centre
      const home = { px: off * 0.1, pz: 0.34 + Math.abs(off) * 0.02 }
      // Every third head runs ice white, the rest deep brand blue. A rig in one
      // colour reads as a filter; two reads as a rig.
      col.setHex(i % 3 === 1 ? 0xdcebff : 0x4f7fe8)
      this.beams.push({
        o: new THREE.Vector3(x, BASE.y, BASE.z),
        d: new THREE.Vector3(home.px, 1, home.pz).normalize(),
        w: 1.15,
        l: 30 - Math.abs(off) * 0.8,
        l0: 30 - Math.abs(off) * 0.8,
        home,
        c: col.clone(),
      })
      mesh.setColorAt(i, col)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.beamMesh = mesh
    this.aimBeams()
    this.scene.add(mesh)
  }

  /**
   * The party: the fifteen heads running a busked show.
   *
   * A real operator at a show like this runs a handful of looks and moves between them
   * on the music, never repeating the same one twice in a row. That is what this does:
   * BEAM_CUES are the looks, each held five to nine seconds, picked at random, and
   * crossfaded over 1.5 s so a change reads as the rig moving rather than as a cut. Each
   * look is a pure function of time, so nothing accumulates and a dropped frame costs
   * nothing.
   *
   * Six looks play to the sky and three come down into the crowd. The crowd looks move
   * slower than the sky ones — a beam whipping across an audience reads as a searchlight,
   * not a show — and the ground ends each beam aimed down where it lands.
   *
   * Brightness pulses stay at or under 2.5 a second — under the three-flashes-a-second
   * photosensitivity line — and with reduced motion asked for, the rig holds its
   * resting fan.
   */
  private runBeamShow(t: number) {
    const mesh = this.beamMesh
    if (!mesh || !this.beams.length || this.reducedMotion) return
    const sh = this.show
    if (t >= sh.until) {
      sh.prev = t - sh.at < 1.5 ? sh.prev : sh.cue
      const others = BEAM_CUES.filter((c) => c !== sh.cue)
      sh.cue = others[Math.floor(sh.rnd() * others.length)]
      sh.at = t
      sh.until = t + 5 + sh.rnd() * 4
    }
    const k = Math.min(1, (t - sh.at) / 1.5)
    const w = k * k * (3 - 2 * k)
    const a: BeamAim = { d: new THREE.Vector3(), k: 0, l: 1 }
    const b: BeamAim = { d: new THREE.Vector3(), k: 0, l: 1 }
    const col = new THREE.Color()
    this.beams.forEach((beam, i) => {
      this.cueAim(sh.prev, i, t, a)
      this.cueAim(sh.cue, i, t, b)
      beam.d.copy(a.d.normalize()).lerp(b.d.normalize(), w)
      // Never behind the truss: these heads face the audience.
      if (beam.d.z < 0.05) beam.d.z = 0.05
      beam.d.normalize()
      beam.l = beam.l0 * (a.l + (b.l - a.l) * w)
      col.copy(beam.c).multiplyScalar(a.k + (b.k - a.k) * w)
      mesh.setColorAt(i, col)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  /** One head's aim, output and length (as a share of its full throw) under one look. */
  private cueAim(cue: BeamCue, i: number, t: number, out: BeamAim) {
    const n = this.beams.length
    const beam = this.beams[i]
    const { px, pz } = beam.home
    const u = n > 1 ? i / (n - 1) : 0.5 // 0 at stage left, 1 at stage right
    out.l = 1
    // Aim at a point in the crowd. The shaft keeps its full throw and the ground cuts
    // it off where it lands: shortening it instead squeezed the beam's falloff into the
    // first few metres, and it faded out in mid-air well short of anyone.
    const intoCrowd = (x: number, z: number) => {
      out.d.set(x - beam.o.x, CROWD_Y - beam.o.y, z - beam.o.z)
    }
    switch (cue) {
      case 'wave': // the whole fan swings, the swing rolling along the truss
        out.d.set(px + 0.55 * Math.sin(t * 0.9 + u * 2.4), 1, pz + 0.18 * Math.sin(t * 0.55))
        out.k = 0.8 + 0.2 * Math.sin(t * 2 + u * 6)
        return
      case 'ballyhoo': // every head roaming on its own, the classic search-light busk
        out.d.set(0.65 * Math.sin(t * (0.6 + 0.11 * i) + i * 1.7), 1, 0.4 + 0.4 * Math.sin(t * (0.45 + 0.07 * i) + i * 2.3))
        out.k = 0.75 + 0.25 * Math.sin(t * (1.2 + 0.17 * i) + i)
        return
      case 'scissor': // alternate heads crossing through each other
        out.d.set(px * 0.3 + (i % 2 ? 1 : -1) * 0.6 * Math.sin(t * 1.15), 1, pz + 0.1 * Math.cos(t * 1.15))
        out.k = 1
        return
      case 'chase': { // a tilt wave and a brightness chase running across the row
        out.d.set(px, 1, pz + 0.45 * Math.sin(t * 2.1 - u * 5))
        const p = Math.max(0, Math.sin(t * 2.6 - u * 7))
        out.k = 0.2 + 1.05 * p * p
        return
      }
      case 'focus': { // all fifteen meeting in one point that wanders over the crowd
        const fx = 0.8 + 9 * Math.sin(t * 0.42)
        const fz = -24.1 + 18 * (0.32 + 0.22 * Math.sin(t * 0.31))
        out.d.set(fx - beam.o.x, 26 + 3 * Math.sin(t * 0.7) - beam.o.y, fz - beam.o.z)
        out.k = 1
        return
      }
      case 'pulse': // the fan breathing open, heads punching in thirds on the beat
        out.d.set(px * (1.5 + 0.6 * Math.sin(t * 1.6)), 1, pz)
        out.k = (Math.floor(t * 2.5) + i) % 3 === 0 ? 1.3 : 0.3
        return
      case 'sweep': { // the fan tipped down, combing slowly across the audience
        const x = (u - 0.5) * 30 + 9 * Math.sin(t * 0.5 + u * 1.2)
        const z = CROWD_Z[0] + (CROWD_Z[1] - CROWD_Z[0]) * (0.45 + 0.35 * Math.sin(t * 0.37 + u * 2))
        intoCrowd(x, z)
        out.k = 1.0 + 0.15 * Math.sin(t * 1.4 + u * 5)
        return
      }
      case 'split': { // half the rig holds the sky, half rakes the crowd, then they trade
        const down = (i + Math.floor(t / 3.2)) % 2 === 0
        if (down) {
          intoCrowd((u - 0.5) * 34, CROWD_Z[0] + (CROWD_Z[1] - CROWD_Z[0]) * (0.5 + 0.3 * Math.sin(t * 0.8 + i)))
          out.k = 1.05
        } else {
          out.d.set(px * 1.3, 1, pz + 0.12 * Math.sin(t * 0.9 + i))
          out.k = 0.95
        }
        return
      }
      case 'dive': { // the whole rig rolling from the sky down into the crowd and back
        const s = 0.5 + 0.5 * Math.sin(t * 0.85 - u * 3.2) // 1 up, 0 down, as a wave
        const up = new THREE.Vector3(px, 1, pz).normalize()
        intoCrowd((u - 0.5) * 26, CROWD_Z[0] + (CROWD_Z[1] - CROWD_Z[0]) * 0.55)
        out.d.normalize().lerp(up, s)
        out.k = 1.0
        return
      }
    }
  }

  /**
   * Turn each shaft to face the camera about its own axis.
   *
   * A beam is a flat card, so edge on it disappears; spinning it about the axis it
   * points along keeps its cross-section to the lens without moving the light. Cheap
   * at fifteen instances, and it is what makes them read as being in the air rather
   * than painted on it.
   */
  private aimBeams() {
    const mesh = this.beamMesh
    if (!mesh) return
    const toCam = new THREE.Vector3()
    const right = new THREE.Vector3()
    const norm = new THREE.Vector3()
    const m = new THREE.Matrix4()
    this.beams.forEach((b, i) => {
      toCam.subVectors(this.camera.position, b.o)
      right.crossVectors(b.d, toCam)
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
      right.normalize()
      norm.crossVectors(right, b.d)
      m.set(
        right.x * b.w, b.d.x * b.l, norm.x, b.o.x,
        right.y * b.w, b.d.y * b.l, norm.y, b.o.y,
        right.z * b.w, b.d.z * b.l, norm.z, b.o.z,
        0, 0, 0, 1,
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Light the lenses of the fixtures that are in the model.
   *
   * The front-truss heads carry three translucent-glass materials between them, and
   * unlit they are dark grey discs on a dark truss. Driving them emissive costs
   * nothing and is what connects each shaft to a thing that is throwing it.
   */
  private fixtureGlow() {
    this.scene.traverse((o) => {
      const im = o as THREE.InstancedMesh
      if (!im.isInstancedMesh) return
      const mats = Array.isArray(im.material) ? im.material : [im.material]

      if (im.name === 'lamp') {
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial
          if (!/Translucent_Glass/i.test(m.name || '')) continue
          m.emissive = new THREE.Color(0xbcd6ff)
          m.emissiveIntensity = 2.2
          m.needsUpdate = true
        }
        return
      }

      // The 115 poseur tables. They are white spandex over a frame, which at an event
      // is the one piece of furniture that is routinely lit from inside — and at this
      // venue they are the only thing standing on fifty metres of open field, so
      // whether the field reads as populated or as empty grass is decided by them.
      // Held low: they should look like they are catching the light, not throwing it.
      if (im.name === 'cocktail') {
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial
          m.emissive = new THREE.Color(0x8fb4ee)
          m.emissiveIntensity = 0.42
          m.needsUpdate = true
        }
      }
    })
  }

  /**
   * Light the cut-out signage: the two lockups you walk between at the entry, and the
   * LITE UNLOCKS / EXTRA COLD REFRESHMENT sign over the merch container's arch.
   *
   * They are not printed artwork. The letterforms are real geometry standing off the
   * wall — which is why no amount of work on the banner textures would ever have lit
   * them — carried on one merged mesh under the model's own SIGN_MATERIAL, whose
   * apricot reads as dirty grey at night. Lighting them is therefore a material change,
   * and it is the cheapest light on the site: no lamp, no shadow, no per-pixel cost.
   *
   * The white letters only at the entry. The green LITE tab and the red CASTLE tab
   * inside each lockup are separate materials and stay dark, which is what makes the
   * pair read as lit signage rather than as a glowing logo. Over the merch store and on
   * the two VVIP platform backdrops the LITE UNLOCKS mark above the lettering is lit
   * too: Francis asked for those.
   *
   * Scoped by position, because the same merged mesh also carries the cut-out lettering
   * on the VVIP platform fronts and by the entry gate, and the castle-logo prints are on
   * signage all over the site: setting a material emissive lights every one of them.
   */
  private litSigns() {
    this.lightWithin(SIGN_MATERIAL, [ENTRY_SIGN_BOX, MERCH_SIGN_BOX, ...VVIP_SIGN_BOXES], (glow) => {
      glow.emissive = new THREE.Color(SIGN_GLOW)
      glow.emissiveIntensity = 1.25
    })
    for (const logo of ['castle logo_1', 'castle logo_2']) {
      this.lightWithin(logo, [MERCH_SIGN_BOX, ...VVIP_SIGN_BOXES], (glow) => selfLit(glow, 0.9))
    }
    // The counter front inside the store. Its print is shared with the ticketing booth's
    // facade, which is lit by its own wash and should not also glow.
    this.lightWithin('Ticketing Area', [MERCH_INSIDE_BOX], (glow) => selfLit(glow, 0.5))
    // The store has no back wall of its own: it stands open against the corridor's
    // banner run, and the icy CASTLE LITE UNLOCKS print you see through the arch is that
    // banner. Lit only where it is the store's backdrop, like a lightbox behind the stock.
    this.lightWithin('Visibility banners-2', [MERCH_BACKDROP_BOX], (glow) => selfLit(glow, 0.45))
  }

  /**
   * The stage's walking surfaces in plain white: the main deck, the catwalk and the
   * hexagonal thrust at its end. Francis asked for this on 2026-11-23; the deck had
   * carried an icy print, and the catwalk and thrust were flat grey.
   *
   * Only large flat faces inside the stage footprint change. The deck print's material
   * is also on its skirts, so the sides keep their artwork. "Textured" is a fine matte grain, the way white
   * stage vinyl reads close up, sampled in world space at 2 m a tile: the source UVs
   * were laid out for the old artwork and would stretch any pattern across the deck.
   */
  private stageTops() {
    const grain = stageGrain()
    this.beamTexes.push(grain)
    const white = (m: THREE.MeshStandardMaterial) => {
      m.map = grain
      // Just under full white, so the deck under the stage wash holds its grain rather
      // than burning out, while its own light keeps the lower thrust reading white
      // rather than rig-blue where the wash does not reach.
      m.color.set(0xe4e8ee)
      m.roughness = 0.85
      m.metalness = 0
      m.emissive = new THREE.Color(0xffffff)
      m.emissiveMap = grain
      m.emissiveIntensity = 0.24
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vStageUv;')
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvStageUv = (modelMatrix * vec4(transformed, 1.0)).xz * 0.5;',
          )
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vStageUv;')
          .replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= texture2D(map, vStageUv);\n#endif')
      }
      m.customProgramCacheKey = () => 'stage-white'
    }
    for (const name of STAGE_TOP_MATERIALS) {
      this.lightWithin(name, [STAGE_BOX], white, { flatOnly: true, artwork: false, minArea: STAGE_TOP_MIN_AREA })
    }
  }

  /**
   * Give the triangles of one material that fall inside `boxes` a lit copy of it.
   *
   * The index is reordered so the triangles inside come first and is then split into two
   * groups against a two-material array — one extra draw call, no duplicated geometry,
   * and nothing laid over anything to z-fight. `dress` is applied to the copy; if the
   * material is textured and its artwork has not arrived yet, it is applied again when
   * it does, since a copy made now has no map to light itself from.
   */
  private lightWithin(
    name: string,
    boxes: readonly Box[],
    dress: (glow: THREE.MeshStandardMaterial) => void,
    opts: {
      /** Only faces that lie flat (decks, tops), not the skirts and sides around them. */
      flatOnly?: boolean
      /** Keep the copy in step with the source's artwork as it streams in. */
      artwork?: boolean
      /** Skip triangles smaller than this (m²), e.g. furniture sharing the material. */
      minArea?: number
    } = {},
  ) {
    const { flatOnly = false, artwork = true, minArea = 0 } = opts
    // The mesh may already have been split by an earlier call for another area (the
    // skirt print is lit on the VVIP platforms AND in the tunnel, the Ticketing Area print
    // in the merch store AND on the booth fascia), so the material can be one entry of
    // an array. Only the triangles still on the plain material are candidates.
    let found: THREE.Mesh | undefined
    let plainIdx = -1
    this.scene.traverse((o) => {
      if (found) return
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const i = mats.findIndex((m) => (m as THREE.Material | undefined)?.name === name)
      if (i >= 0) {
        found = mesh
        plainIdx = i
      }
    })
    if (!found) return

    const mesh = found
    const geo = mesh.geometry
    const index = geo.getIndex()
    const pos = geo.getAttribute('position')
    if (!index || !pos) return
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: index.count, materialIndex: 0 }]

    mesh.updateWorldMatrix(true, false)
    const c = new THREE.Vector3()
    const pa = new THREE.Vector3()
    const pb = new THREE.Vector3()
    const pd = new THREE.Vector3()
    const lit: number[] = []
    const rest: number[] = []
    const others: Array<{ tris: number[]; mat: number }> = []
    for (const g of groups) {
      const matIdx = g.materialIndex ?? 0
      if (matIdx !== plainIdx) {
        const tris: number[] = []
        for (let t = g.start; t < g.start + g.count; t++) tris.push(index.getX(t))
        others.push({ tris, mat: matIdx })
        continue
      }
      for (let t = g.start; t + 2 < g.start + g.count; t += 3) {
        const a = index.getX(t)
        const b = index.getX(t + 1)
        const d = index.getX(t + 2)
        if (flatOnly || minArea > 0) {
          pa.fromBufferAttribute(pos, a).applyMatrix4(mesh.matrixWorld)
          pb.fromBufferAttribute(pos, b).applyMatrix4(mesh.matrixWorld).sub(pa)
          pd.fromBufferAttribute(pos, d).applyMatrix4(mesh.matrixWorld).sub(pa)
          pb.cross(pd)
          const area = pb.length() / 2
          // Either winding: these meshes are double-sided and the export is not consistent.
          if (area < Math.max(minArea, 1e-6) || (flatOnly && Math.abs(pb.normalize().y) < 0.9)) {
            rest.push(a, b, d)
            continue
          }
        }
        c.set(
          (pos.getX(a) + pos.getX(b) + pos.getX(d)) / 3,
          (pos.getY(a) + pos.getY(b) + pos.getY(d)) / 3,
          (pos.getZ(a) + pos.getZ(b) + pos.getZ(d)) / 3,
        ).applyMatrix4(mesh.matrixWorld)
        const inside = boxes.some(
          (k) =>
            c.x >= k.x[0] && c.x <= k.x[1] && c.y >= k.y[0] && c.y <= k.y[1] && c.z >= k.z[0] && c.z <= k.z[1],
        )
        const into = inside ? lit : rest
        into.push(a, b, d)
      }
    }
    // Nothing in the boxes: leave the mesh exactly as it was.
    if (!lit.length) return

    const plain = mats[plainIdx]
    const glow = plain.clone()
    glow.name = `${plain.name} (lit)`
    dress(glow)
    glow.needsUpdate = true
    if (!rest.length && !others.length) {
      // Everything qualifies (the catwalk's material is only its top): no split needed.
      mesh.material = glow
    } else {
      const glowIdx = mats.length
      const order = [...others, { tris: lit, mat: glowIdx }, { tris: rest, mat: plainIdx }]
      const flat: number[] = []
      geo.clearGroups()
      for (const o of order) {
        if (!o.tris.length) continue
        geo.addGroup(flat.length, o.tris.length, o.mat)
        for (const v of o.tris) flat.push(v)
      }
      geo.setIndex(flat)
      mesh.material = [...mats, glow]
    }
    if (!artwork) return

    const give = (t: THREE.Texture) => {
      glow.map = t
      dress(glow)
      glow.needsUpdate = true
    }
    this.mapTwins.set(name, [...(this.mapTwins.get(name) ?? []), give])
  }

  /**
   * The Extra Cold activations: the photo booth put back to the concept, and each
   * activation lit as if it had its own fixtures on it.
   *
   * THE PHOTO BOOTH. Render 0007 is a clear glass cube on a thin blue frame, the
   * KUSLCNO letters floating white on the glass and the perimeter banner seen through
   * it. In the 3D it was a black box. That black is not a design choice: the panel art
   * (`Artboard 5`, and the ice-snowflake `photobooth` print on the back) was white on
   * transparency in SketchUp, and the alpha did not survive the export, so the clear
   * parts came through as solid black. The fix is to give the transparency back, using
   * each print's own luminance as its alpha — white letters opaque, black clear. The
   * letters take a hard cut (alphaTest) so they stay crisp and sort cleanly against
   * the man inside; the ice print takes a soft one, which reads as frosted vinyl. The
   * glass container's two snowflake panels carry the same print and get the same
   * correction, which turns them from black slabs back into glass.
   *
   * THE LIGHT. Drawn, like the rest of the rig, so none of it costs a lamp:
   *  - The blue frames and arcade bodies (`I05_Twilight_Wave`) glow brand blue. On this
   *    site that material is on the activations and nothing else.
   *  - The container's door arch (`I06_Sapphire_Night`) glows as a lit portal.
   *  - Printed faces that would be backlit or spot-lit at a real activation — the
   *    booth letters, the arcade panels, the snow wall's silhouette print, the man in
   *    the booth — carry a little self-light from their own texture (emissiveMap = map),
   *    which lights the print without flattening it into a colour.
   * Every material named here was checked to exist only inside the activation
   * corridor (x -30..-17.7, z 31..58) before it was touched.
   */
  private activations() {
    const byName = new Map<string, THREE.MeshStandardMaterial>()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (m && m.name && !byName.has(m.name)) byName.set(m.name, m as THREE.MeshStandardMaterial)
      }
    })
    const look = (name: string, fn: (m: THREE.MeshStandardMaterial) => void) => {
      const m = byName.get(name)
      if (!m) return
      fn(m)
      m.needsUpdate = true
    }
    // Frames, arcade bodies and the container's arch.
    look('I05_Twilight_Wave', (m) => {
      m.emissive = new THREE.Color(0x1f45ff)
      m.emissiveIntensity = 0.55
    })
    look('I06_Sapphire_Night', (m) => {
      m.emissive = new THREE.Color(0x5f86ff)
      m.emissiveIntensity = 0.9
    })

    // Everything here that needs the artwork is in MAP_LOOKS, applied as it arrives.
  }

  /**
   * A lit footprint under each VVIP table.
   *
   * Interface, but it has to survive as scenery: tier must be readable from a flyover,
   * and tinting the upholstery cannot carry it at that distance. It doubles as the pick
   * target.
   *
   * The table IS the blue coffee table in the crook of each L of sofas (venue.json has
   * been built from those since Nov 2026; before that it numbered the sofas, two per
   * set). So the marker is no longer a strip beside a sofa: it is a glowing pad laid on
   * the deck under the coffee table, a little larger than its top, so from above the
   * table sits in a ring of its tier's colour and nothing else in the set is lit.
   */
  private tierMarkers(venue: Venue) {
    // The coffee tops measure 0.93 x 0.64-0.70 m, long side along X; the pad shows
    // about 0.16 m of light all round.
    const W = 1.25
    const D = 1.0
    const LIFT = 0.014 // off the deck, enough to beat z-fighting

    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.88, depthWrite: false })
    const mesh = new THREE.InstancedMesh(geo, mat, venue.tables.length)
    mesh.name = 'tier-markers'

    const m4 = new THREE.Matrix4()
    const col = new THREE.Color()
    venue.tables.forEach((t, i) => {
      const plat = venue.platforms.find((pl) => pl.id === t.platform)
      const deck = plat ? plat.centre[1] + plat.size[1] : 1.1
      m4.makeScale(W, 1, D).setPosition(t.pos[0], deck + LIFT, t.pos[2])
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, col.setHex(TIER_COLOUR[t.tier]).multiplyScalar(MARKER_GAIN.rest))
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.markers = mesh
    this.markerClashes = 0
  }

  focusTable(t: VenueTable) {
    this.touring = false
    const [cx, cy, cz] = t.camera.pos
    const [tx, ty, tz] = t.camera.target
    this.glide(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(tx, ty, tz))
  }

  /** Back out to the whole ground. Ends the opening rather than restarting it. */
  overview() {
    this.touring = false
    cancelAnimationFrame(this.glideRaf)
    this.glide(new THREE.Vector3(0, 11.5, 42), new THREE.Vector3(0, 3.2, -18), 900, REF_FOV)
    // The wide shot is not one of the fourteen, so the rail must stop claiming it is.
    this.stop = -1
    this.onStopChange?.(-1)
  }

  // ---------------------------------------------------------------- the opening
  //
  // The scene opens by walking the fourteen approved angles in order rather than by
  // orbiting the middle of the site. An orbit shows the venue as an object; the walk
  // shows it as the evening — you arrive at ticketing, come through the ice arch and
  // the gate, cross the field and end at a VVIP table looking at the stage, which is
  // the view the ticket is actually being sold on.

  /** Snap to the first angle and let the sequence run from there. */
  private beginTour() {
    this.stop = 0
    this.applyStop(0, 0)
    this.touring = true
    this.stopUntil = performance.now() + TOUR_OPEN_HOLD
  }

  /** Called from the render loop once the current stop has been held long enough. */
  private advance() {
    const next = this.stop + 1
    if (next >= scenes.length) {
      // The last angle is the one worth being left on, so the sequence stops there
      // instead of looping back out to a wide shot.
      this.touring = false
      return
    }
    this.stop = next
    this.applyStop(next, TOUR_GLIDE)
    this.stopUntil = performance.now() + TOUR_GLIDE + TOUR_HOLD
  }

  private applyStop(i: number, ms: number) {
    const sc = scenes[i]
    const pos = new THREE.Vector3(sc.pos[0], sc.pos[1], sc.pos[2])
    const target = new THREE.Vector3(sc.target[0], sc.target[1], sc.target[2])
    if (ms <= 0) {
      cancelAnimationFrame(this.glideRaf)
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.fov = sc.fov
      this.applyFov()
      this.controls.update()
    } else {
      this.glide(pos, target, ms, sc.fov)
    }
    this.onStopChange?.(i)
  }

  /** Jump to one angle by index. Ends the sequence — the visitor is steering now. */
  goToStop(i: number) {
    if (i < 0 || i >= scenes.length) return
    this.touring = false
    this.stop = i
    this.applyStop(i, TOUR_JUMP)
  }

  // ---------------------------------------------------------------- the nav pad
  //
  // The on-screen controls for visitors who will never discover drag-to-orbit or a
  // two-finger pan. Each takes an amount already scaled by how long the button has
  // been held, so a held arrow moves at the same speed at 30 fps as at 60.

  /** Where the pivot may be moved: the site's ground, so Move cannot walk off it. */
  private static readonly ROAM = { x: [-57, 27], z: [-41, 69] } as const
  private roaming = false

  /** Let the visitor move the pivot as well as orbit it: right-drag, two fingers, Move. */
  allowRoam() {
    this.roaming = true
    this.controls.enablePan = true
    // Along the ground, not the screen: a pan that drifts up into the sky is the
    // first thing a non-gamer does by accident and cannot undo.
    this.controls.screenSpacePanning = false
  }

  private takeWheel() {
    this.touring = false
    cancelAnimationFrame(this.glideRaf)
  }

  /** Orbit the pivot. yaw in radians (+ swings the view left), tilt (+ raises the camera). */
  turn(yaw: number, tilt: number) {
    this.takeWheel()
    const off = this.camera.position.clone().sub(this.controls.target)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta -= yaw
    sph.phi = THREE.MathUtils.clamp(sph.phi - tilt, this.controls.minPolarAngle, this.controls.maxPolarAngle)
    off.setFromSpherical(sph)
    this.camera.position.copy(this.controls.target).add(off)
  }

  /** Dolly towards (f < 1) or away from (f > 1) the pivot, inside the orbit limits. */
  zoom(f: number) {
    this.takeWheel()
    const off = this.camera.position.clone().sub(this.controls.target)
    const d = THREE.MathUtils.clamp(off.length() * f, this.controls.minDistance, this.controls.maxDistance)
    off.setLength(d)
    this.camera.position.copy(this.controls.target).add(off)
  }

  /**
   * Walk the camera and its pivot together over the ground: forward is the way the
   * camera faces, flattened. Amounts are fractions of the distance to the pivot, so
   * Move feels the same from the aerial view as from a table.
   */
  move(right: number, forward: number) {
    this.takeWheel()
    const dist = this.camera.position.distanceTo(this.controls.target)
    const k = Math.max(4, dist)
    const fwd = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0)
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
    fwd.normalize()
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const step = side.multiplyScalar(right * k).addScaledVector(fwd, forward * k)
    this.camera.position.add(step)
    this.controls.target.add(step)
    this.keepOnSite()
  }

  /** Hold the pivot on the ground, carrying the camera with it so the view keeps its angle. */
  private keepOnSite() {
    if (!this.roaming) return
    const t = this.controls.target
    const { x, z } = VenueScene.ROAM
    const dx = THREE.MathUtils.clamp(t.x, x[0], x[1]) - t.x
    const dz = THREE.MathUtils.clamp(t.z, z[0], z[1]) - t.z
    if (dx || dz) {
      t.x += dx
      t.z += dz
      this.camera.position.x += dx
      this.camera.position.z += dz
    }
  }

  /** Run the opening again from the first angle. */
  playTour() {
    this.beginTour()
  }

  /** True while the sequence is still advancing itself. */
  get playing() {
    return this.touring
  }

  /**
   * Subscribe to the active angle. Fires once immediately so a freshly mounted rail
   * agrees with the camera instead of waiting for the next stop to find out.
   */
  onStop(cb: (i: number) => void) {
    this.onStopChange = cb
    cb(this.stop)
  }

  private glideRaf = 0
  /**
   * Move the camera to a new position and pivot over `ms`.
   *
   * Timed off the clock, not off frames. The old fixed step per frame meant the move
   * took twice as long on a machine running at 30 fps as on one running at 60, which
   * is survivable for a button press and not survivable for a sequence that has to
   * hold a rhythm across fourteen stops.
   */
  private glide(pos: THREE.Vector3, target: THREE.Vector3, ms = 620, fov = this.fov) {
    cancelAnimationFrame(this.glideRaf)
    const p0 = this.camera.position.clone()
    const t0 = this.controls.target.clone()
    const f0 = this.fov
    const start = performance.now()
    const step = () => {
      if (this.disposed) return
      // ms 0 is a cut; without the guard 0/0 put NaN into the camera and drew nothing.
      const k = ms > 0 ? Math.min(1, (performance.now() - start) / ms) : 1
      // Ease in as well as out. A pure ease-out leaves every stop at full speed, which
      // on a long run between landmarks reads as a cut rather than a move.
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      this.camera.position.lerpVectors(p0, pos, e)
      this.controls.target.lerpVectors(t0, target, e)
      // Zoom on the same curve as the move. Snapping the lens at either end of a
      // glide is the one thing that reads as a jump even when the path is smooth.
      this.fov = f0 + (fov - f0) * e
      this.applyFov()
      if (k < 1) this.glideRaf = requestAnimationFrame(step)
    }
    step()
  }

  pick(clientX: number, clientY: number): PickResult | null {
    if (!this.markers || !this.venue) return null
    const r = this.canvas.getBoundingClientRect()
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(v, this.camera)
    // In table mode the pads are the target: from the aerial view a marker strip is a
    // few pixels wide, a pad is the size of the booth.
    const hits = this.ray.intersectObject(this.pads ?? this.markers, false)
    const i = hits[0]?.instanceId
    if (i === undefined) return null
    return { table: this.venue.tables[i], index: i }
  }

  setPickHandler(fn: (p: PickResult | null) => void) {
    this.onPick = fn
  }

  handleTap = (e: PointerEvent) => {
    const hit = this.pick(e.clientX, e.clientY)
    this.onPick?.(hit)
    if (hit && this.tapFocus) this.focusTable(hit.table)
  }

  // ---------------------------------------------------------------- table mode
  //
  // The ticket journey's table picker. Same model, different job: instead of walking
  // the evening it shows where a package's tables are against the stage, lets the
  // buyer flip through them and tags the one they are looking at.

  /** The front lip of the catwalk: what "distance to the stage" is measured to. */
  stageFront(): THREE.Vector3 {
    const st = this.venue?.stage.catwalk
    if (!st) return new THREE.Vector3(0.75, 0, -23.4)
    return new THREE.Vector3(st.centre[0], 0, st.centre[2] + st.size[2] / 2)
  }

  /**
   * A glowing pad under every table, for picking from the air. Booth-sized, laid on
   * the deck, additive so it reads as light on the floor rather than a painted disc.
   */
  tablePads() {
    if (this.pads || !this.venue) return
    const venue = this.venue
    const geo = new THREE.CircleGeometry(1.35, 40)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, venue.tables.length)
    mesh.name = 'table-pads'
    const m4 = new THREE.Matrix4()
    venue.tables.forEach((t, i) => {
      const plat = venue.platforms.find((pl) => pl.id === t.platform)
      const deck = plat ? plat.centre[1] + plat.size[1] : t.pos[1] - 0.04
      m4.makeTranslation(t.pos[0], deck + 0.03, t.pos[2])
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, new THREE.Color(PICK_COLOUR[t.tier]))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.pads = mesh
  }

  /**
   * Colour the tables for the picker. The package being chosen is lit, the other is
   * dimmed to a trace (still there, so the buyer sees the whole layout), tables
   * already in the basket are Play Green, and the one in focus is white.
   */
  paintTables(opts: { focus: Tier | null; selected: string | null; taken: string[] }) {
    if (!this.venue) return
    const col = new THREE.Color()
    this.venue.tables.forEach((t, i) => {
      const inFocus = !opts.focus || t.tier === opts.focus
      if (t.id === opts.selected) col.setHex(0xffffff).multiplyScalar(2)
      else if (opts.taken.includes(t.id)) col.setHex(PICK_TAKEN).multiplyScalar(inFocus ? 1.6 : 0.5)
      else col.setHex(PICK_COLOUR[t.tier]).multiplyScalar(inFocus ? 1.1 : 0.14)
      this.pads?.setColorAt(i, col)
      this.markers?.setColorAt(i, col)
    })
    if (this.pads?.instanceColor) this.pads.instanceColor.needsUpdate = true
    if (this.markers?.instanceColor) this.markers.instanceColor.needsUpdate = true
  }

  /** Open on the whole site from high up, then settle on the table overview. */
  establish(instant = false) {
    this.touring = false
    const view = this.tablesView()
    if (instant) {
      this.setCamera(view.pos, view.target, REF_FOV)
      return
    }
    this.setCamera(AERIAL.pos, AERIAL.target, REF_FOV)
    this.glide(v3(view.pos), v3(view.target), 2600, REF_FOV)
  }

  /** Back to the table overview. */
  tablesOverview() {
    this.touring = false
    const view = this.tablesView()
    this.glide(v3(view.pos), v3(view.target), 900, REF_FOV)
  }

  private tablesView() {
    return this.canvas.clientWidth < this.canvas.clientHeight ? TABLES_VIEW_TALL : TABLES_VIEW
  }

  /**
   * Frame one table in context: from behind and above it, looking past it to the
   * stage, so the shot answers "where is this table" rather than "what does it see".
   * (focusTable is the seated view.)
   */
  frameTable(t: VenueTable, ms = 900) {
    this.touring = false
    const s = this.stageFront()
    const away = new THREE.Vector3(t.pos[0] - s.x, 0, t.pos[2] - s.z).normalize()
    const pos = new THREE.Vector3(t.pos[0], 0, t.pos[2]).addScaledVector(away, 13)
    pos.y = 10
    const target = new THREE.Vector3(t.pos[0], 0.8, t.pos[2]).lerp(new THREE.Vector3(s.x, 0.8, s.z), 0.32)
    this.glide(pos, target, ms, REF_FOV)
  }

  /**
   * The hologram's light: a ring on the table's deck and a column of light up to
   * where the tag floats. Null clears it.
   */
  beacon(t: VenueTable | null) {
    if (this.beaconGroup) {
      this.scene.remove(this.beaconGroup)
      this.beaconGroup.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(m.material as THREE.Material | undefined)?.dispose()
      })
      this.beaconGroup = null
    }
    if (!t || !this.venue) return
    const plat = this.venue.platforms.find((pl) => pl.id === t.platform)
    const deck = plat ? plat.centre[1] + plat.size[1] : t.pos[1] - 0.04
    const g = new THREE.Group()
    g.position.set(t.pos[0], deck + 0.04, t.pos[2])
    const glow = (o: number) =>
      new THREE.MeshBasicMaterial({
        color: 0xbfe6ff,
        transparent: true,
        opacity: o,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.62, 64).rotateX(-Math.PI / 2), glow(0.9))
    ring.name = 'beacon-ring'
    g.add(ring)
    // The column fades out as it rises: a cylinder whose vertex alpha runs 1 -> 0.
    const h = BEACON_HEIGHT
    const colGeo = new THREE.CylinderGeometry(0.05, 0.05, h, 12, 1, true).translate(0, h / 2, 0)
    const colMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: new THREE.Color(0xbfe6ff) }, uH: { value: h } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uH; varying float vY; void main(){ float a = 0.25 + 0.75 * smoothstep(uH, 0.0, vY); gl_FragColor = vec4(uCol * 1.8, a); }',
    })
    g.add(new THREE.Mesh(colGeo, colMat))
    this.scene.add(g)
    this.beaconGroup = g
  }

  private pulseBeacon(t: number) {
    const ring = this.beaconGroup?.getObjectByName('beacon-ring')
    if (!ring) return
    const k = 1 + 0.06 * Math.sin(t * 3.2)
    ring.scale.set(k, 1, k)
  }

  /** Screen position (CSS px within the canvas) of a world point, for HTML overlays. */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z > -1 && v.z < 1 }
  }

  /** Called after every rendered frame, so HTML overlays move with the camera. */
  onFrame(cb: () => void) {
    this.frameCbs.push(cb)
    return () => {
      this.frameCbs = this.frameCbs.filter((f) => f !== cb)
    }
  }

  highlight(id: string | null) {
    if (!this.venue) return
    // Tier lives on the markers only. The model's furniture is white, and tinting it
    // blue was both wrong and unnecessary once the markers carry the signal.
    const col = new THREE.Color()
    this.venue.tables.forEach((t, i) => {
      const base = TIER_COLOUR[t.tier]
      if (this.markers) {
        if (id === null) col.setHex(base).multiplyScalar(MARKER_GAIN.rest)
        else if (t.id === id) col.setHex(0xffffff).multiplyScalar(MARKER_GAIN.active)
        else col.setHex(base).multiplyScalar(MARKER_GAIN.dimmed)
        this.markers.setColorAt(i, col)
      }
    })
    if (this.markers?.instanceColor) this.markers.instanceColor.needsUpdate = true
  }

  /**
   * Put the camera at an exact position and target.
   *
   * Used to reproduce the cameras the build script renders the source model from, so
   * the web scene can be compared against the original frame for frame rather than by
   * eye. Also how a deep link into a specific view would be implemented.
   */
  setCamera(pos: [number, number, number], target: [number, number, number], fov = this.fov) {
    this.touring = false
    cancelAnimationFrame(this.glideRaf)
    this.camera.position.set(pos[0], pos[1], pos[2])
    this.controls.target.set(target[0], target[1], target[2])
    this.fov = fov
    this.applyFov()
    this.controls.update()
  }

  /**
   * Dev-only: render one frame at an exact pixel size and hand back a data URL.
   *
   * The angles are matched by putting this beside the render it reproduces, which
   * only works if the comparison frame is the render's own 2400 x 1350 shape rather
   * than whatever the browser window happens to be. Restores the live size after, so
   * taking a shot does not disturb what is on screen.
   */
  shot(w = 1280, h = 720): string {
    const lw = this.canvas.clientWidth || 1
    const lh = this.canvas.clientHeight || 1
    const dpr = this.renderer.getPixelRatio()
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w, h)
    this.camera.aspect = w / h
    const tan = Math.tan((this.fov * Math.PI) / 360)
    const fitted = w / h >= REF_ASPECT ? tan : (tan * REF_ASPECT) / (w / h)
    this.camera.fov = Math.min(MAX_FOV, (Math.atan(fitted) * 360) / Math.PI)
    this.camera.updateProjectionMatrix()
    this.aimBeams()
    this.dome?.position.copy(this.camera.position)
    this.composer.render()
    const url = this.canvas.toDataURL('image/jpeg', 0.82)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(lw, lh, false)
    this.composer.setSize(lw, lh)
    this.bloom.resolution.set(lw, lh)
    this.applyFov()
    return url
  }

  /**
   * Dev-only: put the camera somewhere, render small, and hand back the pixels.
   *
   * This is the primitive the angle matcher runs on. Matching fourteen cameras to
   * fourteen renders by eye is a thousand judgement calls; scoring a candidate
   * against the render it reproduces is one arithmetic operation, and a search can
   * then make those thousand calls itself. Small on purpose — the score is computed
   * on edges, and 192 px is already more detail than the geometry warrants.
   *
   * Synchronous end to end, so the animation loop cannot render over the frame
   * between the draw and the read.
   */
  grab(pos: [number, number, number], target: [number, number, number], fov: number, w = 192, h = 108): ImageData | null {
    this.touring = false
    cancelAnimationFrame(this.glideRaf)
    this.camera.position.set(pos[0], pos[1], pos[2])
    this.controls.target.set(target[0], target[1], target[2])
    this.fov = fov
    this.controls.update()

    const lw = this.canvas.clientWidth || 1
    const lh = this.canvas.clientHeight || 1
    const dpr = this.renderer.getPixelRatio()
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w, h)
    this.camera.aspect = w / h
    const tan = Math.tan((this.fov * Math.PI) / 360)
    const fitted = w / h >= REF_ASPECT ? tan : (tan * REF_ASPECT) / (w / h)
    this.camera.fov = Math.min(MAX_FOV, (Math.atan(fitted) * 360) / Math.PI)
    this.camera.updateProjectionMatrix()
    this.aimBeams()
    this.dome?.position.copy(this.camera.position)
    this.composer.render()

    if (!this.readback) this.readback = document.createElement('canvas')
    this.readback.width = w
    this.readback.height = h
    const ctx = this.readback.getContext('2d', { willReadFrequently: true })
    let data: ImageData | null = null
    if (ctx) {
      ctx.drawImage(this.canvas, 0, 0, w, h)
      data = ctx.getImageData(0, 0, w, h)
    }

    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(lw, lh, false)
    this.composer.setSize(lw, lh)
    this.bloom.resolution.set(lw, lh)
    this.applyFov()
    return data
  }

  /** What the GPU is actually being asked for. Used to hold the build to its budget. */
  stats() {
    const i = this.renderer.info
    return {
      drawCalls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      markerClashes: this.markerClashes,
    }
  }

  /**
   * Fit the stop's 16:9 frame inside whatever shape the window actually is.
   *
   * Each stop's `fov` is the vertical angle measured on the 16:9 render it
   * reproduces, so handing it straight to the camera only matches on a 16:9 canvas.
   * Narrower than that and the sides of the approved frame fall off the edges, which
   * on a phone cut the ice arch in half.
   *
   * So the frame is COVERED rather than matched: on a window wider than 16:9 the
   * vertical angle is the stored one and the extra shows at the sides; on a narrower
   * one the camera opens up vertically until the horizontal extent is back to what
   * the render had. Either way everything Francis framed is on screen, and nothing
   * in it is cropped.
   */
  private applyFov() {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    const aspect = w / h
    const tan = Math.tan((this.fov * Math.PI) / 360)
    const fitted = aspect >= REF_ASPECT ? tan : (tan * REF_ASPECT) / aspect
    this.camera.fov = Math.min(MAX_FOV, (Math.atan(fitted) * 360) / Math.PI)
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  resize = () => {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.applyFov()
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w, h)
  }

  private start() {
    const loop = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)
      if (this.touring && performance.now() >= this.stopUntil) this.advance()
      this.controls.update()
      this.keepOnSite()
      // The relaxed polar clamp lets the camera swing below its target, so this is
      // what stops it going through the grass. Kept at head height rather than at
      // zero: the venue is walked, not swum.
      if (this.camera.position.y < 1.5) this.camera.position.y = 1.5
      this.runBeamShow(performance.now() / 1000)
      this.aimBeams()
      this.pulseBeacon(performance.now() / 1000)
      // The dome rides with the camera, so 420 m of far plane is always enough for it.
      this.dome?.position.copy(this.camera.position)
      this.renderer.info.reset()
      this.composer.render()
      for (const cb of this.frameCbs) cb()
    }
    loop()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.glideRaf)
    this.controls.dispose()
    // Closing the overlay must stop the loops decoding. Clearing src and calling
    // load() is what actually releases the decoder — pause() alone leaves it held.
    for (const v of this.videos) {
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    this.videos.length = 0
    for (const t of this.screenTex.values()) t.dispose()
    this.screenTex.clear()
    for (const t of this.beamTexes) t.dispose()
    this.beamTexes.length = 0
    this.poolTex?.dispose()
    this.poolTex = null
    this.beamMesh = null
    this.dome = null
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.composer.dispose()
    this.renderer.dispose()
  }
}
