import os
import tkinter as tk
from collections import Counter

logo_path = r"c:\Users\Harold\Documents\Proyectos\Cobro App\Cobro App\src\assets\cobro-logo-light.png"

if os.path.exists(logo_path):
    try:
        root = tk.Tk()
        root.withdraw()
        img = tk.PhotoImage(file=logo_path)
        w = img.width()
        h = img.height()
        print(f"Dimensions: {w}x{h}")
        
        # Scan pixels
        colors = []
        for x in range(0, w, 2):  # step by 2 for speed
            for y in range(0, h, 2):
                pixel = img.get(x, y)
                if isinstance(pixel, tuple):
                    r, g, b = pixel[:3]
                else:
                    parts = [int(p) for p in pixel.split()]
                    r, g, b = parts[:3]
                # Ignore pure black (0,0,0) as it might represent transparent background
                if (r, g, b) != (0, 0, 0):
                    colors.append((r, g, b))
        
        # Count the most common colors
        counter = Counter(colors)
        print("Most common colors (RGB):")
        for color, count in counter.most_common(10):
            hex_color = "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])
            print(f"  {hex_color} ({color}): {count} times")
            
    except Exception as e:
        print(f"Error scanning: {e}")
else:
    print("Logo not found.")
