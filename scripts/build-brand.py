#!/usr/bin/env python3
"""Generates the Tidemark logo set: a single-color pictorial mark + Inter wordmark ("tidemark analytics").

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python scripts/build-brand.py

Writes resources/brand/logo/*.svg, public/assets/favicon.svg, public/assets/js/logo.js and the contour motif.
The logo is single-color by design (ink or white; `currentColor` in the app). The wordmark is real vector artwork
(Inter SemiBold outlines, tight tracking), so no font is needed to display any exported logo. Proportions come from the
font's own metrics: the tallest piling matches the wordmark's ascender height and the pilings sit on its baseline.
"""
import math
import os
import random

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONT = os.path.join(ROOT, 'public/assets/fonts/inter-latin.woff2')
NAME = 'tidemark'
SECOND = 'analytics'   # product name, set after the brand name in a lighter weight

# ---- palette (keep in sync with public/assets/app.css and resources/brand/index.html) -----------------------
ABYSS, TRENCH, TIDE = '#07161B', '#0E3A47', '#0E7C86'
FOAM, INK, BUOY = '#EAF6F5', '#0B1B22', '#F5A524'

# ---- the mark: three pier pilings standing in a tide, with the tide line stained across them ----------------
# A tidemark is the line a tide leaves behind — on pilings, rocks and harbor walls — at one constant height.
# Drawn single-color: the tide line is negative space. The pilings also read as chart bars: what the product is.
BARS = [(1.75, 15), (17.75, 5), (33.75, 19)]  # x, top  (48-unit grid, bars are W wide)
W, BOTTOM, RADIUS = 12.5, 43, 5.6
LEVEL, SEG, AMP, GAP = 31, 14, 4.4, 2.0       # waterline height, half-wave length, wave amplitude, half-gap of the tide line
MARK_X0, MARK_X1, MARK_TOP = BARS[0][0], BARS[-1][0] + W, min(t for _, t in BARS)
MARK_W, MARK_H = MARK_X1 - MARK_X0, BOTTOM - MARK_TOP  # 44.5 x 38 units


def wave_y(x, dy=0.0):
    """Quadratic-bezier chain used for the tide line (same shape as 'q a b t …'), evaluated exactly."""
    k = int((x + 4) // SEG)
    t = ((x + 4) - k * SEG) / SEG
    c = -AMP if k % 2 == 0 else AMP
    return LEVEL + 2 * t * (1 - t) * c + dy


def _edge(x0, x1, dy, step=0.25):
    n = max(2, int(round((x1 - x0) / step)))
    return [(x0 + (x1 - x0) * i / n, wave_y(x0 + (x1 - x0) * i / n, dy)) for i in range(n + 1)]


def _pts(points):
    return ' '.join(f'{x:.2f} {y:.2f}' for x, y in points)


def piling_paths(x0, top):
    """-> (part above the tide line, part below it): exact outlines separated by a wavy gap."""
    x1, r = x0 + W, RADIUS
    up, dn = _edge(x0, x1, -GAP), _edge(x0, x1, GAP)
    dry = (f'M{x0:.2f} {top + r:.2f}A{r} {r} 0 0 1 {x0 + r:.2f} {top:.2f}H{x1 - r:.2f}A{r} {r} 0 0 1 {x1:.2f} {top + r:.2f}'
           f'L{_pts(reversed(up))}Z')
    wet = (f'M{_pts(dn)}L{x1:.2f} {BOTTOM - r:.2f}A{r} {r} 0 0 1 {x1 - r:.2f} {BOTTOM}H{x0 + r:.2f}A{r} {r} 0 0 1 {x0:.2f} {BOTTOM - r:.2f}Z')
    return dry, wet


def mark_glyph(color, transform=''):
    paths = ''.join(f'<path d="{d}"/><path d="{w}"/>' for d, w in (piling_paths(x, t) for x, t in BARS))
    tf = f' transform="{transform}"' if transform else ''
    return f'<g fill="{color}"{tf}>{paths}</g>'


def mark_tile(tile=TRENCH, color=FOAM, radius=11):
    """Tile version — only for favicons, app icons and avatars, where the mark needs its own background."""
    return f'<rect width="48" height="48" rx="{radius}" fill="{tile}"/>' + mark_glyph(color, 'translate(24 24) scale(.74) translate(-24 -24)')


# ---- wordmark from Inter outlines ---------------------------------------------------------------------------
font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': 620})
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
# "analytics" is set in a lighter weight of the same face, so the umbrella name "tidemark" leads
light = instancer.instantiateVariableFont(TTFont(FONT), {'wght': 420})
gs_l, cmap_l = light.getGlyphSet(), light.getBestCmap()


def _glyph_top(ch):
    bp = BoundsPen(gs)
    gs[cmap[ord(ch)]].draw(bp)
    return bp.bounds[3] / upm


ASC = _glyph_top('d')   # ascender height (em): the mark is scaled to this
XH = font['OS/2'].sxHeight / upm
DESC = 0.22   # descender depth of 'y' (em), so exported lockups are not clipped


def _run(text, size, glyphs, cm, tracking, y0=0.0):
    """One line of outlines at `size`, baseline at y0 (y down) -> (path parts, advance width, ink bounds)."""
    scale = size / upm
    x, parts = 0.0, []
    xmin, ymin, xmax, ymax = 1e9, 1e9, -1e9, -1e9
    for ch in text:
        name = cm[ord(ch)]
        sp = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(sp, (scale, 0, 0, -scale, x, y0)))
        parts.append(sp.getCommands())
        bp = BoundsPen(glyphs)
        glyphs[name].draw(TransformPen(bp, (scale, 0, 0, -scale, x, y0)))
        if bp.bounds:
            xmin, ymin = min(xmin, bp.bounds[0]), min(ymin, bp.bounds[1])
            xmax, ymax = max(xmax, bp.bounds[2]), max(ymax, bp.bounds[3])
        x += glyphs[name].width * scale + tracking * size
    return parts, x - tracking * size, (xmin, ymin, xmax, ymax)


def wordmark(size, tracking=-0.02, text=NAME, second=SECOND, gap_em=0.2):
    """Two lines, left aligned: `text` in the wordmark weight, `second` below it in a lighter weight and sized so both
    lines are exactly as wide. -> (path d, width, ink bounds (xmin, ymin, xmax, ymax), baseline of the second line)
    in px, y down, first baseline at 0."""
    parts1, w1, box1 = _run(text, size, gs, cmap, tracking)
    if not second:
        return ' '.join(parts1), w1, box1, 0.0
    size2 = size * 0.8
    w2 = _run(second, size2, gs_l, cmap_l, tracking)[1]
    size2 *= w1 / w2
    base2 = ASC * size2 + gap_em * size
    parts2, w2, box2 = _run(second, size2, gs_l, cmap_l, tracking, y0=base2)
    box = (min(box1[0], box2[0]), min(box1[1], box2[1]), max(box1[2], box2[2]), max(box1[3], box2[3]))
    return ' '.join(parts1 + parts2), max(w1, w2), box, base2


def svg(w, h, body, title='Tidemark', vb=None):
    vb = vb or f'0 0 {w:.2f} {h:.2f}'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(content)


# ---- lockups --------------------------------------------------------------------------------------------------
PAD = 0.04
LOCKUP = 0.72   # first-line size relative to the old one-line wordmark, so the two-line lockup stays compact


def horizontal_parts(size, color, gap_em=0.34):
    """Mark + two-line wordmark: the mark runs from the top of the first line to the baseline of the second. -> (body, W, H)."""
    size *= LOCKUP
    d, w, box, base2 = wordmark(size)
    asc = ASC * size
    h = asc + base2
    k = h / MARK_H
    gap = gap_em * size
    mark = mark_glyph(color, f'translate({-MARK_X0 * k:.3f} {h - BOTTOM * k:.3f}) scale({k:.4f})')
    text = f'<g transform="translate({MARK_W * k + gap:.3f} {asc:.3f})"><path d="{d}" fill="{color}"/></g>'
    return mark + text, MARK_W * k + gap + (box[2] - box[0]), h


def horizontal(color, size=40):
    body, w, h = horizontal_parts(size, color)
    pad = PAD * size   # ink overshoots the line box a little (ascenders, round letters), so keep a margin
    return svg(w + 2 * pad, h + DESC * size * LOCKUP + 2 * pad, body, 'Tidemark Analytics', vb=f'{-pad:.2f} {-pad:.2f} {w + 2 * pad:.2f} {h + DESC * size * LOCKUP + 2 * pad:.2f}')


def stacked(color, size=34):
    d, w, box, base2 = wordmark(size)
    asc = ASC * size
    mh = 2.5 * asc
    k = mh / MARK_H
    mw = MARK_W * k
    width = max(w, mw)
    gap = 0.6 * asc
    mark = mark_glyph(color, f'translate({(width - mw) / 2 - MARK_X0 * k:.3f} {mh - BOTTOM * k:.3f}) scale({k:.4f})')
    text = f'<g transform="translate({(width - w) / 2:.3f} {mh + gap + asc:.3f})"><path d="{d}" fill="{color}"/></g>'
    return svg(width, mh + gap + asc + base2 + DESC * size, mark + text, 'Tidemark Analytics')


# ---- exports ------------------------------------------------------------------------------------------------
L = 'resources/brand/logo/'
for old in os.listdir(os.path.join(ROOT, L)) if os.path.isdir(os.path.join(ROOT, L)) else []:
    os.remove(os.path.join(ROOT, L, old))
for tone, color in (('ink', INK), ('white', '#FFFFFF')):
    write(L + f'{NAME}-mark-{tone}.svg', svg(48, 48, mark_glyph(color), 'Tidemark mark'))
    write(L + f'{NAME}-horizontal-{tone}.svg', horizontal(color))
    write(L + f'{NAME}-stacked-{tone}.svg', stacked(color))
    d, w, box, _ = wordmark(40 * LOCKUP)
    write(L + f'{NAME}-wordmark-{tone}.svg', svg(box[2] - box[0] + 2, box[3] - box[1] + 2, f'<path d="{d}" fill="{color}"/>', 'Tidemark Analytics',
                                                 vb=f'{box[0] - 1:.2f} {box[1] - 1:.2f} {box[2] - box[0] + 2:.2f} {box[3] - box[1] + 2:.2f}'))
write(L + f'{NAME}-mark.svg', svg(48, 48, mark_tile(), 'Tidemark Analytics'))        # tile: favicon / app icon / avatar
write('public/assets/favicon.svg', svg(48, 48, mark_tile(), 'Tidemark Analytics'))
# full-bleed square app icon (iOS/Android round it themselves); mark scaled into the safe zone
write(L + f'{NAME}-app-icon.svg',
      svg(512, 512, f'<rect width="512" height="512" fill="{TRENCH}"/>' + mark_glyph(FOAM, 'translate(256 256) scale(7.4) translate(-24 -24)'), 'Tidemark Analytics'))

# components used by the dashboard (single color: inherit the surrounding text color)
body, lw, lh = horizontal_parts(22, 'currentColor')
lh += DESC * 22 * LOCKUP   # room for the descender of the y, so no container clips it
lpad = PAD * 22
lvb = f'{-lpad:.2f} {-lpad:.2f} {lw + 2 * lpad:.2f} {lh + 2 * lpad:.2f}'
d, ww, wbox, _ = wordmark(22 * LOCKUP)
js = f'''import {{ html }} from './lib.js';

// Generated by scripts/build-brand.py — do not edit by hand.
/** The Tidemark mark: three pier pilings with the tide line as negative space. Inherits the text color. */
export const Logo = ({{ size = 24, tile = false }}) => tile
  ? html`<svg viewBox="0 0 48 48" width=${{size}} height=${{size}} aria-hidden="true">{mark_tile()}</svg>`
  : html`<svg viewBox="0 {MARK_TOP} 48 {MARK_H}" width=${{size}} height=${{(size * {MARK_H}) / 48}} aria-hidden="true">{mark_glyph('currentColor')}</svg>`;

/** Mark + wordmark on one baseline, proportioned from the font (mark height = ascender height). `size` ≈ font-size in px. */
export const Lockup = ({{ size = 22 }}) => html`<svg viewBox="{lvb}" width=${{(size / 22) * {lw + 2 * lpad:.2f}}} height=${{(size / 22) * {lh + 2 * lpad:.2f}}} role="img" aria-label="Tidemark Analytics" style="overflow:visible">{body}</svg>`;

/** Wordmark alone. */
export const Wordmark = ({{ size = 22 }}) => html`<svg viewBox="{wbox[0]:.2f} {wbox[1]:.2f} {wbox[2] - wbox[0]:.2f} {wbox[3] - wbox[1]:.2f}" width=${{(size / 22) * {wbox[2] - wbox[0]:.2f}}} height=${{(size / 22) * {wbox[3] - wbox[1]:.2f}}} role="img" aria-label="Tidemark Analytics" style="overflow:visible"><path d="{d}" fill="currentColor"/></svg>`;
'''
write('public/assets/js/logo.js', js)
print('logo set written')


# ---- brand motif: depth contours + depth numbers, like a nautical chart ----------------------------------
def contours(width=1600, height=640, line='#0E7C86', line_opacity=0.16, num_opacity=0.34, seed=7, lines=11, numerals=True):
    rnd = random.Random(seed)
    paths, texts = [], []
    for i in range(lines):
        y0 = 40 + i * (height - 80) / (lines - 1)
        a1, a2 = 14 + i * 2.2, 7 + (i % 3) * 3
        p1, p2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
        pts = [(x, y0 + a1 * math.sin(x / 190 + p1 + i * 0.35) + a2 * math.sin(x / 71 + p2)) for x in range(-20, width + 41, 20)]
        paths.append('<path d="M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + '" stroke-linejoin="round"/>')
        if numerals:
            for _ in range(rnd.choice([1, 2, 2, 3])):
                x = rnd.uniform(60, width - 60)
                y = y0 + a1 * math.sin(x / 190 + p1 + i * 0.35) + a2 * math.sin(x / 71 + p2) + 22 * rnd.choice([-1, 1])
                texts.append(f'<text x="{x:.0f}" y="{y:.0f}">{rnd.randint(3, 48)}</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" aria-hidden="true">'
            f'<g fill="none" stroke="{line}" stroke-opacity="{line_opacity}" stroke-width="1.3">{"".join(paths)}</g>'
            f'<g fill="{line}" fill-opacity="{num_opacity}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="12" text-anchor="middle">{"".join(texts)}</g></svg>\n')


write('public/assets/contours.svg', contours())
write('resources/brand/pattern/contours-light.svg', contours())
write('resources/brand/pattern/contours-dark.svg', contours(line='#9FE3DF', line_opacity=0.12, num_opacity=0.2))
# light/dark horizontal logos next to the app for the installer page
logo_dir = os.path.join(ROOT, 'public/assets/logo')
if os.path.isdir(logo_dir):
    for f in os.listdir(logo_dir):
        os.remove(os.path.join(logo_dir, f))
for src, dst in ((f'{NAME}-horizontal-ink.svg', f'{NAME}-horizontal.svg'), (f'{NAME}-horizontal-white.svg', f'{NAME}-horizontal-dark.svg')):
    write('public/assets/logo/' + dst, open(os.path.join(ROOT, L, src)).read())
print('motif written')
