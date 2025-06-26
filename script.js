(() => {
    const imgInput = document.getElementById('imgInput');
    const results = document.getElementById('results');
    const summary = document.getElementById('summary');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    imgInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) processImage(f);
    });

    document.addEventListener('paste', e => {
        const file = [...e.clipboardData?.items || []].find(i => i.type.startsWith('image/'))?.getAsFile();
        if (file) processImage(file);
    });

    async function processImage(file) {
        const img = await loadBitmap(file);
        const { w, h } = fitToCanvas(img);
        ctx.drawImage(img, 0, 0, w, h);
        const buckets = analyse();
        render(buckets);
    }

    function loadBitmap(blob) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error('Cannot decode image'));
            img.src = URL.createObjectURL(blob);
        });
    }

    function fitToCanvas(img, maxDim = 800) {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        return { w, h };
    }

    function analyse() {
        const w = canvas.width;
        const h = canvas.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        const buckets = new Map();
        const step = 4;

        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const i = (y * w + x) * 4;
                if (data[i + 3] < 128) continue;
                const rgb = [data[i], data[i + 1], data[i + 2]].map(v => v / 255);
                const lab = rgbToLabExtras(...rgb);
                const warmth = classify(lab.bStar, lab.s);
                const hex = rgbToHex(...rgb);
                const entry = buckets.get(hex) || { count: 0, warmth, hsl: { h: lab.h, s: lab.s, l: lab.l } };
                entry.count += 1;
                buckets.set(hex, entry);
            }
        }
        return [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
    }

    function rgbToLabExtras(r, g, b) {
        [r, g, b] = [r, g, b].map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
        const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
        const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
        const xn = 0.95047, yn = 1, zn = 1.08883;
        const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
        const fx = f(X / xn), fy = f(Y / yn), fz = f(Z / zn);
        const bStar = 200 * (fy - fz);
        const hsl = rgbToHsl(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
        return { bStar, ...hsl };
    }

    function classify(bStar, sat, satTh = 15, gap = 5) {
        if (sat < satTh || Math.abs(bStar) < gap) return 'neutral';
        return bStar > 0 ? 'warm' : 'cool';
    }

    function render(buckets) {
        results.innerHTML = '';
        let warm = 0, cool = 0, neutral = 0;
        for (const [hex, { warmth, hsl }] of buckets) {
            if (warmth === 'warm') warm++;
            else if (warmth === 'cool') cool++;
            else neutral++;
            const li = document.createElement('li');
            li.innerHTML = `<span class="swatch" style="background:${hex}"></span><code>${hex}</code>&nbsp;<small>h:${hsl.h}° s:${hsl.s}% l:${hsl.l}% – ${warmth}</small>`;
            results.appendChild(li);
        }
        summary.textContent = `warm: ${warm} · cool: ${cool} · neutral: ${neutral} (top ${buckets.length} colours)`;
    }

    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        } else {
            h = s = 0;
        }
        return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }
})();
