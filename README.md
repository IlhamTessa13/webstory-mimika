
# Anomali Kuadran II: Investigasi Ekonomi Mimika

Webstory interaktif yang menelusuri posisi Kabupaten Mimika (Papua Tengah) pada Kuadran II Tipologi Klassen, yaitu daerah dengan PDRB per kapita tinggi tetapi laju pertumbuhan ekonomi yang rendah. Narasi disusun dalam bentuk scrollytelling: pembaca menggulir halaman untuk berpindah dari gambaran nasional, ke struktur ekonomi Mimika, hingga ke aktivitas ekspornya.



## Teknologi

- React 18 dan Vite 5
- Tailwind CSS 3
- D3 7 dan d3-sankey (treemap, sunburst, sankey, gantt)
- Leaflet (peta simbol proporsional dan choropleth)
- Mapbox GL JS (globe pada Flight Transition)
- Three.js (panorama)



## Menjalankan Proyek

1. Pasang dependensi.

   ```bash
   npm install
   ```

2. Buat berkas `.env` di direktori utama proyek, lalu isi dengan token Mapbox.

   ```
   VITE_MAPBOX_TOKEN=isi_token_anda
   ```


3. Jalankan server pengembangan.

   ```bash
   npm run dev
   ```

Perintah lain yang tersedia:

| Perintah | Fungsi |
|----------|--------|
| `npm run build` | Membuat berkas produksi pada folder `dist`. |
| `npm run preview` | Menjalankan hasil build secara lokal untuk pemeriksaan. |

## Struktur Direktori

```
webstory-mimika/
├── public/                  
│   ├── components/
│   │   ├── Header/
│   │   ├── FlightTransition/
│   │   ├── sections/      
│   │   └── Footer/
│   ├── data/               
│   ├── App.jsx             
│   ├── main.jsx
│   └── index.css
├── index.html
├── tailwind.config.js
└── vite.config.js
```

## Data

Seluruh dataset berada di `src/data`. Data dari Badan Pusat Statistik (BPS) digunakan sebagai sumber utama.

| Berkas | Dipakai oleh | Keterangan |
|--------|--------------|------------|
| `pdrb_data.xlsx` | Treemap | PDRB per kabupaten dan kategori sektor (miliar rupiah). |
| `Data_Mimika.xlsx` | Sunburst | PDRB Mimika per kategori dan lapangan usaha (miliar rupiah). |
| `data_geospasial.xlsx` | Peta simbol proporsional | PDRB per kapita dan laju pertumbuhan untuk 514 kabupaten/kota. |
| `tipologi_klassen.xlsx` | Choropleth |  kuadran untuk 514 kabupaten/kota. |
| `all_kabkota_ind.geojson` | Peta simbol proporsional dan choropleth | Batas wilayah kabupaten/kota  |
| `data_ekspor.xlsx` | Sankey | Nilai ekspor menurut negara tujuan dan pelabuhan. |
| `Data_ganttchart.xlsx` | Gantt | Nilai ekspor bulanan tahun 2025 menurut negara tujuan. |
| `pdrb_geospasial.json` | Peta simbol proporsional | Hasil pra-pemrosesan dari `data_geospasial.xlsx`: koordinat dan nilai per kabupaten/kota. |
| `klassen_kabkota.json` | Choropleth | Hasil pra-pemrosesan: geometri yang telah disederhanakan beserta atribut Tipologi Klassen. |



### Catatan satuan

- Nilai PDRB pada Treemap dan Sunburst dinyatakan dalam miliar rupiah.
- PDRB per kapita pada kedua peta dinyatakan dalam juta rupiah.
- Laju pertumbuhan disimpan sebagai pecahan (misalnya `0.0536` berarti 5,36%).
- Nilai ekspor pada Sankey dan Gantt dinyatakan dalam dolar AS.

## Metodologi Visualisasi

- **Kelas warna PDRB per kapita** pada peta simbol proporsional ditentukan dengan metode *natural breaks* (Jenks) menjadi empat kelas.
- **Ukuran lingkaran** pada peta simbol proporsional mditentukan dengan metode *natural breaks* (Jenks).
- **Kuadran Tipologi Klassen** pada peta choropleth: Kuadran I (maju dan tumbuh cepat), II (maju tetapi tertekan), III (berkembang cepat), dan IV (relatif tertinggal).
- **Palet warna** dipilih agar dapat dibedakan oleh pembaca dengan buta warna, mengacu pada palet Okabe–Ito dan skala ColorBrewer. 
- **Peta dasar** pada Leaflet memakai citra satelit Esri World Imagery.


## Sumber Data dan Atribusi

- Data ekonomi: Badan Pusat Statistik (BPS).
- Citra satelit peta: Esri, Maxar, Earthstar Geographics, dan komunitas pengguna GIS.
- Globe: Mapbox.