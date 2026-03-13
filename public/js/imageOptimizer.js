// PropertyPulse — imageOptimizer.js
// Comprime imágenes en el browser antes de subir al servidor
// Sin dependencias externas — usa Canvas API nativo

const ImageOptimizer = {
    MAX_WIDTH:   1200,   // px máximo
    MAX_HEIGHT:  1200,   // px máximo
    QUALITY:     0.75,   // 75% calidad JPEG
    MAX_SIZE_MB: 1,      // máximo 1MB después de comprimir

    // Comprimir un File/Blob → devuelve Blob comprimido
    async compress(file) {
        // Si no es imagen, devolver tal cual
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                // Calcular nuevo tamaño manteniendo aspect ratio
                let { width, height } = img;
                if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
                    const ratio = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height);
                    width  = Math.round(width  * ratio);
                    height = Math.round(height * ratio);
                }

                // Dibujar en canvas
                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a Blob JPEG
                canvas.toBlob(blob => {
                    if (!blob) return reject(new Error('Error comprimiendo imagen'));
                    resolve(blob);
                }, 'image/jpeg', this.QUALITY);
            };

            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    },

    // Mostrar preview de imagen seleccionada
    preview(file, imgElement) {
        if (!file || !imgElement) return;
        const url = URL.createObjectURL(file);
        imgElement.src = url;
        imgElement.style.display = 'block';
        imgElement.onload = () => URL.revokeObjectURL(url);
    },

    // Formatear tamaño en KB/MB
    formatSize(bytes) {
        if (bytes < 1024)       return `${bytes} B`;
        if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
        return `${(bytes/(1024*1024)).toFixed(1)} MB`;
    }
};

window.ImageOptimizer = ImageOptimizer;