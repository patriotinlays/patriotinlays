import cairosvg
from PIL import Image, ImageDraw, ImageFont
cairosvg.svg2png(url='favicon.svg',write_to='favicon-32.png',output_width=32,output_height=32)
cairosvg.svg2png(url='favicon.svg',write_to='favicon-16.png',output_width=16,output_height=16)
s=open('favicon.svg').read().replace(' rx="5"','')   # full-bleed square; iOS applies its own mask
cairosvg.svg2png(bytestring=s.encode(),write_to='apple-touch-icon-180.png',output_width=180,output_height=180)
cairosvg.svg2png(url='logo-horizontal.svg',write_to='build/ph.png',output_width=1100)
cairosvg.svg2png(url='logo-horizontal-white.svg',write_to='build/phw.png',output_width=1100)
cairosvg.svg2png(url='icon.svg',write_to='build/pi.png',output_width=180)
L=lambda p: Image.open(p).convert('RGBA')
W=1600; NAVY=(15,36,68)
h=L('build/ph.png'); hw=L('build/phw.png')
DV='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; F=ImageFont.truetype(DV,22)
im=Image.new('RGB',(W,1200),'white'); d=ImageDraw.Draw(im)
y=20; d.text((40,y),'logo-horizontal.svg on white',fill=(90,90,90),font=F); y+=45
im.paste(h,((W-h.width)//2,y),h); y+=h.height+40
d.rectangle((0,y,W,y+hw.height+90),fill=NAVY)
d.text((40,y+15),'logo-horizontal-white.svg on navy',fill=(200,210,225),font=F)
im.paste(hw,((W-hw.width)//2,y+55),hw); y+=hw.height+90+30
for x,t in ((40,'icon.svg @180px'),(300,'favicon 32 / 16 px (true size)'),(760,'favicon-32 x4'),(960,'favicon-16 x4'),(1160,'apple-touch-icon-180')):
    d.text((x,y),t,fill=(90,90,90),font=F)
y+=40
pi=L('build/pi.png'); im.paste(pi,(40,y),pi)
f32=L('favicon-32.png'); f16=L('favicon-16.png')
im.paste(f32,(320,y+20),f32); im.paste(f16,(380,y+28),f16)
d.rectangle((300,y+90,640,y+130),fill=(222,225,230)); im.paste(f16,(312,y+102),f16)
d.text((338,y+100),'Patriot, In Lay Terms',fill=(30,30,30),font=ImageFont.truetype(DV,16))
b=f32.resize((128,128),Image.NEAREST); im.paste(b,(760,y),b)
b=f16.resize((64,64),Image.NEAREST); im.paste(b,(960,y),b)
a=L('apple-touch-icon-180.png'); im.paste(a,(1160,y),a)
im.crop((0,0,W,y+200)).save('preview.png',optimize=True)
for f in ('build/ph.png','build/phw.png','build/pi.png'):
    import os; os.remove(f)
