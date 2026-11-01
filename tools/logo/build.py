import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

import os
G="/usr/share/fonts/truetype/sand-box/google/"
from fontTools.varLib.instancer import instantiateVariableFont
os.makedirs("build",exist_ok=True)
if not os.path.exists("build/Merriweather-800.ttf"):
    f=TTFont(G+"Merriweather/Merriweather-VariableFont_opsz,wdth,wght.ttf")
    instantiateVariableFont(f,{"wght":800,"wdth":100,"opsz":36},inplace=True); f.save("build/Merriweather-800.ttf")
if not os.path.exists("build/Montserrat-500.ttf"):
    f=TTFont(G+"Montserrat/Montserrat-VariableFont_wght.ttf")
    instantiateVariableFont(f,{"wght":500},inplace=True); f.save("build/Montserrat-500.ttf")

def fmt(v):
    s=f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in("-0","") else s

class P(SVGPathPen):
    def __init__(s,gs): super().__init__(gs,ntos=fmt)

def outline(fontpath, text, x, baseline, cap=None, xh=None, width=None, track=0.0):
    tt=TTFont(fontpath); gs=tt.getGlyphSet(); upem=tt['head'].unitsPerEm
    os2=tt['OS/2']
    ref = cap/os2.sCapHeight if cap else xh/os2.sxHeight
    data=open(fontpath,'rb').read()
    face=hb.Face(data); font=hb.Font(face)
    buf=hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font,buf,{"kern":True,"liga":False})
    names=[tt.getGlyphName(i.codepoint) for i in buf.glyph_infos]
    adv=[p.x_advance for p in buf.glyph_positions]
    # left side bearing of first glyph so ink starts at x
    bp=BoundsPen(gs); gs[names[0]].draw(bp); lsb=bp.bounds[0]
    def ink_width(tr):
        bpl=BoundsPen(gs); bpr=BoundsPen(gs); gs[names[-1]].draw(bpr)
        return (sum(adv[:-1])+tr*(len(names)-1)+bpr.bounds[2]-lsb)
    if width is not None:
        tr=(width/ref-ink_width(0))/(len(names)-1)
    else: tr=track*upem
    pen=P(gs); cx=-lsb; bb=BoundsPen(gs)
    for n,a in zip(names,adv):
        for pp in (pen,bb):
            gs[n].draw(TransformPen(pp,(ref,0,0,-ref,x+cx*ref,baseline)))
        cx+=a+tr
    print(text, [round(v,1) for v in bb.bounds], round(tr/upem,3))
    return pen.getCommands(), tr/upem

BOOK = """<g fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
<path d="M0 40C-20 16-62 4-110 3V146C-62 147-20 156 0 176C20 156 62 147 110 146V3C62 4 20 16 0 40V176"/>
<path d="M-110 18H-122V164C-72 163-28 168-16 184M110 18H122V164C72 163 28 168 16 184"/>
<path d="M-122 35H-135V185H-24M122 35H135V185H24"/>
</g><path d="M-26 184C-12 174 12 174 26 184C14 197-14 197-26 184Z"/>"""

def horizontal(color):
    m="build/Merriweather-800.ttf"; s="build/Montserrat-500.ttf"
    # coordinates in reference-image px, book spine at x=262,y=137
    p1,_=outline(m,"PATRIOT,",438,221,cap=74)
    p2,_=outline(s,"IN LAY TERMS",441,290,cap=40,width=432)
    p3,_=outline(s,"patriotinlays.com",441,337,xh=19,width=304)
    vb="120 132 786 215"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" fill="{color}" stroke="{color}" role="img" aria-labelledby="t">'
            f'<title id="t">Patriot, In Lay Terms</title>'
            f'<g transform="translate(262 137)">{BOOK}</g>'
            f'<path stroke="none" d="{p1}{p2}{p3}"/></svg>\n')

open("logo-horizontal.svg","w").write(horizontal("#0f2444"))
open("logo-horizontal-white.svg","w").write(horizontal("#ffffff"))
