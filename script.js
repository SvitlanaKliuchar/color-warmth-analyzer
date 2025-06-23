const imgInput = document.getElementById('imgInput');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

imgInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await processImage(file);
});

document.addEventListener('paste', async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
                await processImage(blob);
                break;
            }
        }
    }
});

async function processImage(fileBlob) {
    const img = new Image();
    img.src = URL.createObjectURL(fileBlob);
    await img.decode();
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    analyzeCanvas();
}

function analyzeCanvas() {
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const freq = {};
    const skip = 1;

    for (let y = 0; y < height; y += skip) {
        for (let x = 0; x < width; x += skip) {
            const i = (y * width + x) * 4;
            const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
            if (a < 128) continue;
            const hex = rgbToHex(r, g, b);
            freq[hex] = (freq[hex] || 0) + 1;
        }
    }

    const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .map(([hex, count]) => {
            const { h, s, l } = hexToHSL(hex);
            return { hex, count, h, s, l, warmth: getWarmOrCool(h) };
        });

    renderResults(sorted);
}

function renderResults(colors) {
    results.innerHTML = '';
    summary.innerHTML = '';

    let warm = 0, cool = 0, neutral = 0;

    colors.forEach(c => {
        if (c.warmth === 'warm') warm++;
        else if (c.warmth === 'cool') cool++;
        else neutral++;

        const li = document.createElement('li');
        li.innerHTML = `
          <div class="swatch" style="background:${c.hex}"></div>
          <strong>${c.hex}</strong> — hue:${c.h}° (${c.warmth})
        `;
        results.appendChild(li);
    });

    summary.innerText = `Found: ${warm} warm, ${cool} cool, ${neutral} neutral tones.`;
}

function rgbToHex(r, g, b) {
    const t = v => v.toString(16).padStart(2, '0');
    return `#${t(r)}${t(g)}${t(b)}`;
}

function hexToHSL(hex) {
    let r = parseInt(hex.substr(1, 2), 16) / 255;
    let g = parseInt(hex.substr(3, 2), 16) / 255;
    let b = parseInt(hex.substr(5, 2), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getWarmOrCool(hue) {
    if (hue >= 0 && hue <= 90) return 'warm';
    if (hue >= 180 && hue <= 300) return 'cool';
    return 'neutral';
}