# Data

Taruh dataset riil di sini, per section, sebagai file `.json` atau `.csv`:

- `pdrb-pertumbuhan.json` → untuk DotDensitySection (pertumbuhan vs per kapita)
- `klassen.json` → untuk ChoroplethSection (kode wilayah → kuadran I/II/III/IV)
- `pdrb-sektor.json` → untuk TreemapSection & SunburstSection (struktur PDRB)
- `ekspor-pelabuhan-negara.json` → untuk SankeySection
- `ekspor-negara-matrix.json` → untuk ChordSection

File topojson batas wilayah Indonesia diletakkan di `public/geo/indonesia.json`
(bukan di sini — supaya bisa di-fetch langsung oleh browser).

Setiap komponen section saat ini memakai data placeholder inline yang
ditandai `// TODO`. Ganti dengan `fetch`/`import` ke file-file di atas
begitu data BPS final tersedia.
