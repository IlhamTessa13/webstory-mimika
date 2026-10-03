# Anomali Kuadran II: Investigasi Ekonomi Mimika

Webstory React (Vite) berisi 6 visualisasi data mengenai posisi ekonomi
Kabupaten Mimika pada Kuadran II Tipologi Klassen.

## Struktur

```
webstory-mimika/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── geo/               # taruh topojson peta Indonesia di sini
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css           # @tailwind directives + design tokens (CSS vars dipakai D3)
    ├── components/
    │   ├── Header/
    │   ├── Footer/
    │   └── sections/
    │       ├── DotDensitySection/    # pertumbuhan PDRB vs PDRB per kapita
    │       ├── ChoroplethSection/    # tipologi klassen Indonesia
    │       ├── TreemapSection/       # struktur PDRB per lapangan usaha
    │       ├── SunburstSection/      # struktur PDRB primer/sekunder/tersier
    │       ├── SankeySection/        # ekspor: sektor → pelabuhan → negara
    │       └── ChordSection/         # ekspor: sektor → negara (jejaring)
    ├── data/               # dataset riil (json/csv) — lihat data/README.md
    ├── hooks/              # custom hooks bersama (fetch data, resize, dll)
    └── utils/              # helper (formatting angka, skala warna, dll)
```

Styling memakai **Tailwind CSS** sepenuhnya — tidak ada file `.css` per
komponen. Kelas utilitas ditulis langsung di `className`, dan tiga kelas
reusable (`story-section`, `story-heading`, `story-lede`, `viz-container`)
didefinisikan lewat `@layer components` di `src/index.css` supaya tidak
diulang-ulang di 6 section. Warna tema (`bg`, `panel`, `ink`, `muted`,
`accent`, `accent2`) didaftarkan di `tailwind.config.js`; CSS custom
properties (`--color-accent`, dst.) tetap dipertahankan di `:root` karena
dipakai langsung oleh D3 saat men-set `fill`/`stroke` via JavaScript.

Semua chart di-render dengan D3 langsung ke SVG lewat `useRef` + `useEffect`,
mengikuti pola yang sama di setiap file supaya mudah diseragamkan.

## Menjalankan

```bash
npm install
npm run dev
```

## Langkah selanjutnya

1. Ganti data placeholder (ditandai `// TODO`) di tiap komponen section
   dengan data BPS final.
2. Tambahkan topojson batas wilayah Indonesia ke `public/geo/indonesia.json`
   untuk ChoroplethSection.
3. Sesuaikan palet warna & tipografi di `src/index.css` bila perlu identitas
   visual khusus.
4. Tambahkan scroll-based interactions (mis. Intersection Observer) di
   `src/hooks/` bila ingin efek scrollytelling antar section.
