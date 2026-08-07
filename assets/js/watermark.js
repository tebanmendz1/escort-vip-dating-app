/**
 * Canvas Watermark Utility
 * Aplica una marca de agua transparente 'CITASRD.APP' a las imágenes antes de subirlas.
 */

export function applyWatermarkToImage(file, watermarkText = 'CITASRD.APP') {
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

        // Calculate badge dimensions in image center
        const fontSize = Math.max(18, Math.round(canvas.width * 0.05));
        const pillWidth = Math.round(canvas.width * 0.76);
        const pillHeight = Math.round(fontSize * 2.5);
        const pillX = Math.round((canvas.width - pillWidth) / 2);
        const pillY = Math.round((canvas.height - pillHeight) / 2);

        // Save state for shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;

        // Draw dark pill container
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
        } else {
          ctx.rect(pillX, pillY, pillWidth, pillHeight);
        }
        ctx.fillStyle = 'rgba(10, 11, 20, 0.94)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FF2A7A';
        ctx.stroke();
        ctx.restore();

        // Draw crisp bold text in badge center
        ctx.font = `900 ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(watermarkText, canvas.width / 2, pillY + pillHeight / 2);

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
