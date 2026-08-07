/**
 * Canvas Watermark Utility
 * Aplica una marca de agua transparente 'ESCORT VIP' a las imágenes antes de subirlas.
 */

export function applyWatermarkToImage(file, watermarkText = 'ESCORT VIP') {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // If it's a video, pass it as-is
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Watermark styling
        const fontSize = Math.max(24, Math.round(canvas.width / 16));
        ctx.font = `800 ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 42, 122, 0.45)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        // Draw bottom-right watermark
        const padding = Math.round(fontSize * 0.8);
        ctx.fillText(`👑 ${watermarkText}`, canvas.width - padding, canvas.height - padding);

        // Diagonal light pattern text
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.font = `700 ${Math.round(fontSize * 1.2)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.textAlign = 'center';
        ctx.fillText(watermarkText, 0, 0);
        ctx.restore();

        // Convert canvas back to Blob/File
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const watermarkedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(watermarkedFile);
        }, file.type, 0.92);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

window.applyWatermarkToImage = applyWatermarkToImage;
