import os, random, sys
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
random.seed(7)

def noisy(w, h):
    # base ruidosa pequena ampliada + formas: gera foto "realista" pesada para JPEG
    small = Image.effect_noise((w // 8, h // 8), 80).convert("RGB")
    img = small.resize((w, h), Image.BICUBIC)
    d = ImageDraw.Draw(img)
    for _ in range(120):
        x, y = random.randint(0, w), random.randint(0, h)
        r = random.randint(40, 400)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)), width=random.randint(2, 12))
    return img

big = noisy(4000, 3000)
big.save(os.path.join(out, "grande-4000x3000.jpg"), "JPEG", quality=92)
big.save(os.path.join(out, "grande-4000x3000.png"), "PNG")
# retrato 3000x4000
noisy(3000, 4000).save(os.path.join(out, "retrato-3000x4000.jpg"), "JPEG", quality=92)
# pequena (nao deve ampliar)
Image.new("RGB", (300, 200), (200, 80, 80)).save(os.path.join(out, "pequena-300x200.png"), "PNG")
# PNG transparente
t = Image.new("RGBA", (800, 600), (0, 0, 0, 0))
ImageDraw.Draw(t).ellipse([100, 100, 700, 500], fill=(0, 120, 200, 255))
t.save(os.path.join(out, "transparente-800x600.png"), "PNG")
# invalido: gif e txt, e jpg falso
Image.new("RGB", (100, 100), (1, 2, 3)).save(os.path.join(out, "formato.gif"), "GIF")
open(os.path.join(out, "falso.jpg"), "w").write("isto nao e uma imagem")
# acima de 10 MB: ruido bruto PNG
raw = Image.effect_noise((3200, 3200), 128).convert("RGB")
raw.save(os.path.join(out, "enorme-acima-10MB.png"), "PNG")
for f in sorted(os.listdir(out)):
    print(f, os.path.getsize(os.path.join(out, f)))
