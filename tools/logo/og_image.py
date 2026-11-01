# Social share image (1200x630): the dark logo centered on white. Run from tools/logo/ after build.py.
import cairosvg
from PIL import Image
cairosvg.svg2png(url="logo-horizontal.svg", write_to="og-logo.png", output_width=960)
logo = Image.open("og-logo.png").convert("RGBA")
im = Image.new("RGB", (1200, 630), "white")
im.paste(logo, ((1200 - logo.width) // 2, (630 - logo.height) // 2), logo)
bar = Image.new("RGB", (1200, 12), (178, 34, 52)); im.paste(bar, (0, 618))
im.save("og-image.png", optimize=True)
import os; os.remove("og-logo.png")
print("og-image.png", im.size)
