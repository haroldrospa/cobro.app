import os
from PIL import Image

logo_path = r"c:\Users\Harold\Documents\Proyectos\Cobro App\Cobro App\src\assets\cobro-logo-light.png"

if os.path.exists(logo_path):
    try:
        img = Image.open(logo_path)
        img = img.convert("RGBA")
        # Get the pixel at the corner (0, 0)
        pixel = img.getpixel((0, 0))
        print(f"Corner pixel color (RGBA): {pixel}")
        hex_color = "#{:02x}{:02x}{:02x}".format(pixel[0], pixel[1], pixel[2])
        print(f"Hex color: {hex_color}")
    except Exception as e:
        print(f"Error reading image: {e}")
else:
    print("Logo file not found.")
