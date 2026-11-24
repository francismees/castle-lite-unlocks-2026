/**
 * The Arusha walkthrough — the angles the 3D venue opens through.
 *
 * These are camera stops inside the live 3D scene, in the order Francis set
 * (23 Nov 2026), reconstructed to match the approved renders of the Arusha build.
 * The order is a journey rather than a gallery: it starts outside at the ticketing
 * booth, comes in through the ice arch and the entry gate, crosses the field, and
 * finishes on the VVIP deck looking at the stage — which is the same decision the
 * visitor is being asked to make, in the same order they would make it.
 *
 * `pos`, `target` and `fov` are viewer world space, metres and degrees, and each was
 * confirmed against the render it is named for by putting the camera there and
 * comparing the two frames side by side. They are not guesses off a plan: the source
 * model carries NO cameras at all. SketchUp Scenes do not survive a GLB export (0
 * cameras in source.blend and 0 in the 188 MB source), so every angle here was rebuilt
 * against the frame it reproduces. Re-deriving one means doing that again, not reading
 * it off the model.
 *
 * `fov` is not a constant. An automatic matcher — edge correlation between the live
 * frame and the render, searched over position, heading and lens — put most of these
 * between 35 and 50 degrees, and the wide ones are wide for a reason: the VIP and VVIP
 * stops have furniture a couple of metres from the lens AND the stage forty metres
 * away, which only a wide lens holds together. Treat the number as measured data.
 *
 * THREE STOPS CANNOT BE REPRODUCED EXACTLY, and it is the built site that stops them,
 * not the viewer. 0003 (the ice arch), 0007 (the activations) and 0009 (the entry
 * gate) are all framed in the renders from further back than the site allows: the
 * ticketing booth stands directly in the arch's sightline, and the activation walk is
 * about ten metres wide where the render is shot from thirty. Those renders were made
 * with geometry hidden. What is stored here is the same subject, the same face of it
 * and the same left-to-right order, from the nearest place a visitor could actually
 * stand. Moving them further back would put the camera inside the booth or through a
 * wall.
 *
 * A stop may sit slightly below its target (looking up at the stage). OrbitControls
 * clamps that on update, and these values were verified AFTER the clamp, so what is
 * stored reproduces what was checked.
 *
 * `target` is also the orbit pivot if the visitor takes hold of the scene, so it is
 * not an arbitrary point down the view axis: each one is where a ray down that axis
 * first meets the venue, pulled in to at most 40 m and usually kept above 1.2 m. A
 * pivot lying on the grass tips the horizon the moment anyone drags. 0005 is the one
 * exception, at 0.9 m: its render looks down the perimeter wall from a camera that
 * cannot be moved back (a banner run is right behind it), so the only way to put the
 * wall where the render puts it is to tilt down, and the tilt has to live in `target`.
 *
 * Two stops were corrected on a second pass (23 Nov 2026) after reading them against
 * the renders on a frame ruled in tenths rather than thirds — the finer rule is what
 * made the errors legible. 0001 was standing about 18% too close and 0.8 m too high,
 * which made the ticketing booth fill more of the frame than it does in the render;
 * 0003's successor 0005 was aimed about 12 degrees too far left, which pushed the
 * tower and the glass activation container off to the right of where Francis has them.
 * Measure that way, not by a colour-keyed bounding box: the event rig lays a blue light
 * pool on the ground in front of the booth, and a blue-pixel box counts the pool as
 * part of the building and reads its base far too low.
 *
 * `frame` is the frame number from the render sequence, not a position. It is kept
 * rather than renumbered 1-14 so any stop can be traced back to the render it came
 * from, and so reordering this array never renames a file. The gaps in the numbering
 * are Francis's selection from a longer sequence, not missing frames.
 *
 * The renders themselves stay in service as the picker rail: `python3
 * scripts/build-assets.py scenes` writes /public/scenes/arusha-<frame>-<width>.avif|webp.
 *
 * [CONTENT-PENDING] Captions are working copy written against the renders, not approved
 * campaign copy. The Swahili needs the same native-speaker / TBL sign-off as the rest of
 * the site before launch.
 */
import type { Str } from '../i18n/strings'

/** Must match SCENE_WIDTHS in scripts/build-assets.py. */
export const SCENE_WIDTHS = [480, 900, 1440, 1920] as const

/** Must match SCENE_THUMB in scripts/build-assets.py. The thumbnail rail only. */
export const SCENE_THUMB_WIDTH = 240

/** Every render is 2400 x 1350. Declared so the stage reserves its box before decode. */
export const SCENE_RATIO = { width: 16, height: 9 } as const

/** Metres, viewer world space. */
export type Vec3 = [number, number, number]

export interface Scene {
  /** Frame number in the render sequence; also the file stem suffix. */
  frame: string
  /** Where the camera stands for this stop. */
  pos: Vec3
  /** What it looks at — also the orbit pivot if the visitor takes over here. */
  target: Vec3
  /**
   * Vertical field of view in degrees, measured on the 16:9 render.
   *
   * SketchUp states field of view vertically and defaults to 35, which is what most
   * of these were shot at; where Francis widened or tightened the lens for a frame,
   * the number here follows it. The viewer does not hand this straight to the camera
   * — on a window that is not 16:9 it opens up until the render's horizontal extent
   * is back, so nothing he framed is ever cropped.
   */
  fov: number
  /** Short label, shown with the step counter. Rendered uppercase by CSS. */
  title: Str
  /** One line on what the visitor is looking at. */
  caption: Str
  /** Describes the frame for anyone who cannot see it — not a repeat of the caption. */
  alt: Str
}

export const scenes: Scene[] = [
  {
    frame: '0001',
    pos: [-82, 2.2, 30.2],
    target: [-54.5, 2, 30.2],
    fov: 35,
    title: { en: 'Arrival', sw: 'Kuwasili' },
    caption: {
      en: 'The ticketing booth is the first thing you reach.',
      sw: 'Banda la tiketi ndilo jambo la kwanza unalofikia.',
    },
    alt: {
      en: 'A long blue Castle Lite Unlocks ticketing booth under a white marquee roof, seen from the approach across open ground.',
      sw: 'Banda refu la tiketi la Castle Lite Unlocks chini ya paa jeupe, likionekana ukiwa unalikaribia kutoka uwanjani.',
    },
  },
  {
    frame: '0002',
    pos: [-67.14, 3.53, 24.42],
    target: [-53.43, 1.2, 30.24],
    fov: 36.8,
    title: { en: 'Choose your lane', sw: 'Chagua njia yako' },
    caption: {
      en: 'VVIP, VIP and Regular, each with its own window.',
      sw: 'VVIP, VIP na Regular, kila moja na dirisha lake.',
    },
    alt: {
      en: 'The ticketing booth head on, with separate marked lanes for VVIP, VIP and three Regular windows.',
      sw: 'Banda la tiketi mkabala, likiwa na njia tofauti za VVIP, VIP na madirisha matatu ya Regular.',
    },
  },
  {
    frame: '0003',
    pos: [-54, 2.5, 30.5],
    target: [-44.81, 2.18, 30.5],
    fov: 43,
    title: { en: 'Through the ice', sw: 'Kupitia barafu' },
    caption: {
      en: 'The snowflake arch, and the question it asks.',
      sw: 'Lango la theluji, na swali lake.',
    },
    alt: {
      en: 'A white ice-textured arch built as a giant snowflake, carrying the words Ready To Be Refreshed above the walkway through it.',
      sw: 'Lango jeupe lenye muundo wa barafu lililojengwa kama theluji kubwa, likiwa na maneno Ready To Be Refreshed juu ya njia ya kupita.',
    },
  },
  {
    frame: '0005',
    pos: [-38, 2.4, 26],
    target: [-22.87, 0.9, 37.15],
    fov: 36,
    title: { en: 'Inside the perimeter', sw: 'Ndani ya uzio' },
    caption: {
      en: 'Branded walls the length of the ground.',
      sw: 'Kuta zenye chapa kwa urefu wote wa uwanja.',
    },
    alt: {
      en: 'A long run of blue Castle Lite perimeter banners along the grass, with a glass activation container standing in front of them.',
      sw: 'Mfululizo mrefu wa mabango ya bluu ya Castle Lite kando ya nyasi, na kibanda cha kioo cha shughuli mbele yake.',
    },
  },
  {
    frame: '0007',
    pos: [-20.5, 2.4, 36],
    target: [-28.16, 2.01, 57.06],
    fov: 50,
    title: { en: 'Extra Cold activations', sw: 'Shughuli za Extra Cold' },
    caption: {
      en: 'Photo booths and the ice alcove along the walk.',
      sw: 'Vibanda vya picha na chumba cha barafu njiani.',
    },
    alt: {
      en: 'Activation stands along the perimeter, ending in a white ice alcove holding a giant Castle Lite bottle and a neon outline.',
      sw: 'Vibanda vya shughuli kando ya uzio, vikiishia kwenye chumba cheupe cha barafu chenye chupa kubwa ya Castle Lite na mchoro wa neon.',
    },
  },
  {
    frame: '0009',
    pos: [-29, 3.2, 54],
    target: [-17.04, 2.36, 54.42],
    fov: 42,
    title: { en: 'Entry', sw: 'Lango kuu' },
    caption: {
      en: 'The gate into the arena itself.',
      sw: 'Lango la kuingia uwanjani.',
    },
    alt: {
      en: 'The main entry gate, marked ENTRY, between Castle Lite Unlocks and Extra Cold Refreshment banner walls, with the ground visible through the opening.',
      sw: 'Lango kuu la kuingia lenye neno ENTRY, kati ya kuta za mabango ya Castle Lite Unlocks na Extra Cold Refreshment, uwanja ukionekana kupitia mwanya.',
    },
  },
  {
    frame: '0011',
    pos: [-13.62, 4.17, 65.43],
    target: [-0.34, 1.2, 34.77],
    fov: 43.3,
    title: { en: 'The field', sw: 'Uwanja' },
    caption: {
      en: 'Poseur tables on the grass, stage ahead.',
      sw: 'Meza za kusimamia kwenye nyasi, jukwaa mbele.',
    },
    alt: {
      en: 'White cloth-covered poseur tables spread across the grass, a steel camera tower to one side and the stage small in the distance.',
      sw: 'Meza nyeupe za kusimamia zilizotapakaa kwenye nyasi, mnara wa kamera upande mmoja na jukwaa likionekana mbali.',
    },
  },
  {
    frame: '0013',
    pos: [0, 9, 42],
    target: [0, 4.82, 2.22],
    fov: 35,
    title: { en: 'The whole ground', sw: 'Uwanja mzima' },
    caption: {
      en: 'Both VVIP platforms flanking the field.',
      sw: 'Majukwaa mawili ya VVIP pembeni mwa uwanja.',
    },
    alt: {
      en: 'A raised wide view of the entire arena: the stage at the head, poseur tables filling the field and a raised VVIP platform down each side.',
      sw: 'Mandhari mapana kutoka juu ya uwanja mzima: jukwaa mbele, meza za kusimamia zikijaza uwanja na jukwaa la VVIP kila upande.',
    },
  },
  {
    frame: '0015',
    pos: [0, 1.9, 11],
    target: [0, 1.9, -29],
    fov: 50,
    title: { en: 'VIP standing', sw: 'Eneo la VIP' },
    caption: {
      en: 'Branded tables either side of the centre aisle.',
      sw: 'Meza zenye chapa pande zote za njia ya katikati.',
    },
    alt: {
      en: 'The VIP standing section: tall white lattice tables with blue branded tops, in rows either side of a marked centre aisle running to the stage.',
      sw: 'Eneo la VIP la kusimama: meza ndefu nyeupe zenye juu ya bluu yenye chapa, zikiwa safu pande zote za njia ya katikati inayoelekea jukwaani.',
    },
  },
  {
    frame: '0016',
    pos: [3.93, 2.42, 18],
    target: [-0.06, 1.51, -20.89],
    fov: 48,
    title: { en: 'Straight at the stage', sw: 'Mkabala na jukwaa' },
    caption: {
      en: 'What the VIP section sees.',
      sw: 'Mandhari kutoka eneo la VIP.',
    },
    alt: {
      en: 'The stage seen head on from the VIP section, framed by tall ice-pattern screens either side and the lighting truss above.',
      sw: 'Jukwaa likionekana mkabala kutoka eneo la VIP, likizungukwa na skrini ndefu zenye muundo wa barafu pande zote na taa juu.',
    },
  },
  {
    frame: '0017',
    pos: [2.56, 4.38, 2.61],
    target: [-0.79, 3.76, -32.32],
    fov: 43,
    title: { en: 'The stage', sw: 'Jukwaa' },
    caption: {
      en: 'Screens, line arrays and the bar up front.',
      sw: 'Skrini, spika na baa mbele.',
    },
    alt: {
      en: 'The stage close up under its white roof, with the centre screen showing Castle Lite bottles and a branded bar counter standing in front of it.',
      sw: 'Jukwaa kwa karibu chini ya paa lake jeupe, skrini ya katikati ikionyesha chupa za Castle Lite na kaunta ya baa yenye chapa mbele yake.',
    },
  },
  {
    frame: '0018',
    pos: [14.32, 4.15, 27.82],
    target: [3.37, 1.26, -10.54],
    fov: 41.9,
    title: { en: 'Along the rail', sw: 'Kandokando ya uzio' },
    caption: {
      en: 'The VIP section from the side.',
      sw: 'Eneo la VIP kwa upande.',
    },
    alt: {
      en: 'The VIP tables seen at an angle from the barrier line, with the stage off to one side and the perimeter banners behind.',
      sw: 'Meza za VIP zikionekana kwa pembe kutoka upande wa uzio, jukwaa likiwa upande mmoja na mabango ya uzio nyuma.',
    },
  },
  {
    frame: '0019',
    pos: [-20.85, 3.2, 14],
    target: [-15.39, 1.55, -16.98],
    fov: 50,
    title: { en: 'Onto the VVIP platform', sw: 'Jukwaa la VVIP' },
    caption: {
      en: 'Sofas, ottomans and a table of your own.',
      sw: 'Makochi, viti na meza yako mwenyewe.',
    },
    alt: {
      en: 'The raised VVIP platform, laid with white lattice sofas, ottomans and blue branded tables, looking across the barrier to the field and the stage.',
      sw: "Jukwaa la juu la VVIP, lenye makochi meupe, viti na meza za bluu zenye chapa, likiangalia ng'ambo ya uzio hadi uwanjani na jukwaani.",
    },
  },
  {
    frame: '0021',
    pos: [-20.85, 3.4, 3],
    target: [4.92, 1.2, -15.05],
    fov: 46,
    title: { en: 'Your table', sw: 'Meza yako' },
    caption: {
      en: 'The view you have paid for.',
      sw: 'Mandhari uliyoilipia.',
    },
    alt: {
      en: 'The view from a VVIP table: the booth furniture in the foreground and the full stage straight ahead across the ground.',
      sw: 'Mandhari kutoka meza ya VVIP: samani za eneo mbele na jukwaa zima moja kwa moja mbele yako.',
    },
  },
]
