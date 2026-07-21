/**
 * Utility to remove background from product images using non-blocking HTML5 Canvas API.
 * Detects background color from image corners, removes background pixels seamlessly,
 * and feathers edges for a clean PNG output without freezing the main browser thread.
 */

export const removeImageBackgroundCanvas = (imageSource: string | File | Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    const loadSource = async () => {
      try {
        if (imageSource instanceof Blob || imageSource instanceof File) {
          img.src = URL.createObjectURL(imageSource);
        } else if (typeof imageSource === 'string') {
          if (imageSource.startsWith('data:') || imageSource.startsWith('blob:')) {
            img.src = imageSource;
          } else {
            // Fetch blob to handle CORS gracefully
            const res = await fetch(imageSource);
            if (!res.ok) throw new Error('No se pudo descargar la imagen para procesar.');
            const blob = await res.blob();
            img.src = URL.createObjectURL(blob);
          }
        }
      } catch (err) {
        reject(err);
      }
    };

    img.onload = () => {
      // Allow UI thread to breathe before processing
      setTimeout(() => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) {
            reject(new Error('No se pudo inicializar el contexto Canvas 2D.'));
            return;
          }

          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Sample corner pixels to find dominant background color
          const corners = [
            getPixel(data, width, 0, 0),
            getPixel(data, width, width - 1, 0),
            getPixel(data, width, 0, height - 1),
            getPixel(data, width, width - 1, height - 1),
            getPixel(data, width, Math.floor(width / 2), 0),
            getPixel(data, width, Math.floor(width / 2), height - 1)
          ];

          // Average background color from top corners
          let bgR = 0, bgG = 0, bgB = 0;
          corners.forEach(c => {
            bgR += c.r;
            bgG += c.g;
            bgB += c.b;
          });
          bgR = Math.round(bgR / corners.length);
          bgG = Math.round(bgG / corners.length);
          bgB = Math.round(bgB / corners.length);

          const tolerance = 45; // Color distance threshold
          const feather = 20;

          // Flood fill queue from outer border inward
          const visited = new Uint8Array(width * height);
          const queue: number[] = [];

          // Add border pixels to initial queue
          for (let x = 0; x < width; x++) {
            queue.push(x, 0);
            queue.push(x, height - 1);
          }
          for (let y = 1; y < height - 1; y++) {
            queue.push(0, y);
            queue.push(width - 1, y);
          }

          let head = 0;
          while (head < queue.length) {
            const x = queue[head++];
            const y = queue[head++];

            const idx = (y * width + x);
            if (visited[idx]) continue;
            visited[idx] = 1;

            const pIdx = idx * 4;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];

            const dist = Math.sqrt(
              (r - bgR) * (r - bgR) +
              (g - bgG) * (g - bgG) +
              (b - bgB) * (b - bgB)
            );

            if (dist < tolerance + feather) {
              // Calculate alpha transparency based on distance to background color
              if (dist <= tolerance) {
                data[pIdx + 3] = 0; // Fully transparent
              } else {
                const alphaFactor = (dist - tolerance) / feather;
                data[pIdx + 3] = Math.round(data[pIdx + 3] * alphaFactor);
              }

              // Add 4-directional neighbors
              if (x > 0 && !visited[idx - 1]) queue.push(x - 1, y);
              if (x < width - 1 && !visited[idx + 1]) queue.push(x + 1, y);
              if (y > 0 && !visited[idx - width]) queue.push(x, y - 1);
              if (y < height - 1 && !visited[idx + width]) queue.push(x, y + 1);
            }
          }

          ctx.putImageData(imgData, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Falló la conversión de canvas a imagen PNG.'));
            }
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      }, 30);
    };

    img.onerror = (err) => {
      reject(new Error('No se pudo cargar la imagen para remover el fondo.'));
    };

    loadSource();
  });
};

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}
