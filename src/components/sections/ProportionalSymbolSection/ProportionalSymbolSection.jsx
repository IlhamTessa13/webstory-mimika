import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import pdrbData from "../../../data/pdrb_geospasial.json";

// Data sumber: data/data_geospasial.xlsx (514 kab/kota), dicocokkan ke
// koordinat dari data/all_kabkota_ind.geojson lewat nama kab/kota —
// termasuk menyamakan format penulisan ("Kab./Kota" -> "KABUPATEN/KOTA",
// singkatan seperti "Kep." -> "Kepulauan", beda ejaan seperti "Bau-bau" vs
// "Baubau", hingga nama yang berubah seperti "Kepulauan Tanimbar" (dulu
// "Maluku Tenggara Barat"). Hasil pencocokan (lat/lng + nilai) disimpan di
// src/data/pdrb_geospasial.json supaya tidak perlu memuat ulang geojson
// mentahnya (~10MB) hanya untuk titik koordinat.

// Palet sekuensial multi-hue, ramah buta warna, TANPA biru:
// kuning → oranye → jingga kemerahan → ungu tua. Tiga warna pertama berasal
// dari palet Okabe–Ito; kelas tertinggi ungu tua. Selain beda hue, tiap kelas
// juga makin gelap (kecerahan menurun monoton), jadi tetap terbedakan oleh
// penderita protanopia/deuteranopia/tritanopia maupun dalam grayscale.
const COLORS = ["#F0E442", "#E69F00", "#D55E00", "#5B2A86"];
const CLASS_NAMES = ["kuning", "oranye", "jingga kemerahan", "ungu tua"];
const CLASS_LEVELS = [
  "rendah",
  "menengah ke bawah",
  "menengah ke atas",
  "tinggi",
];

// Peta dibuka dengan seluruh Indonesia pas di dalam bingkai.
const INDONESIA_BOUNDS = [
  [-11.5, 94.5],
  [6.5, 141.5],
];

const numberFmt = (n) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const percentFmt = (n) =>
  `${(n * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

// Klasifikasi Natural Breaks (algoritma Jenks) — standar untuk
// mengelompokkan data kontinu ke k kelas yang meminimalkan variansi di
// dalam tiap kelas. Dipakai di sini untuk 4 kelas warna PDRB per kapita.
function jenksBreaks(dataIn, numClasses) {
  const data = [...dataIn].sort((a, b) => a - b);
  const n = data.length;
  const mat1 = Array.from({ length: n + 1 }, () =>
    new Array(numClasses + 1).fill(0),
  );
  const mat2 = Array.from({ length: n + 1 }, () =>
    new Array(numClasses + 1).fill(0),
  );
  for (let i = 1; i <= numClasses; i++) {
    mat1[1][i] = 1;
    mat2[1][i] = 0;
    for (let j = 2; j <= n; j++) mat2[j][i] = Infinity;
  }
  let v = 0;
  for (let l = 2; l <= n; l++) {
    let s1 = 0;
    let s2 = 0;
    let w = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = data[i3 - 1];
      s2 += val * val;
      s1 += val;
      w += 1;
      v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= numClasses; j++) {
          if (mat2[l][j] >= v + mat2[i4][j - 1]) {
            mat1[l][j] = i3;
            mat2[l][j] = v + mat2[i4][j - 1];
          }
        }
      }
    }
    mat1[l][1] = 1;
    mat2[l][1] = v;
  }
  const kClass = new Array(numClasses + 1);
  kClass[numClasses] = data[n - 1];
  kClass[0] = data[0];
  let k = n;
  for (let j = numClasses; j >= 2; j -= 1) {
    const id = mat1[k][j] - 2;
    kClass[j - 1] = data[id];
    k = mat1[k][j] - 1;
  }
  return kClass;
}

// --- Klasifikasi warna: natural breaks (Jenks), 4 kelas, dari PDRB per kapita.
// Dihitung sekali di level modul supaya peta dan teks interpretasi memakai
// kelas yang sama.
const BREAKS = jenksBreaks(
  pdrbData.map((d) => d.pdrbPerKapita),
  4,
); // [min, b1, b2, b3, max]
const classIndexFor = (value) => {
  if (value <= BREAKS[1]) return 0;
  if (value <= BREAKS[2]) return 1;
  if (value <= BREAKS[3]) return 2;
  return 3;
};

// --- Ukuran lingkaran: dari LAJU PERTUMBUHAN PDRB, searah dengan nilainya —
// makin tinggi lajunya makin besar lingkarannya; laju negatif = lingkaran
// terkecil. (Sebelumnya memakai nilai absolut sehingga laju negatif yang besar
// malah tampak sebagai lingkaran besar.)
//
// Sebaran laju sangat miring: median ≈ 5%, tetapi ada pencilan di bawah
// (Mimika ≈ −26%) dan di atas (hingga ≈ 62%). Kalau skala ditarik dari nilai
// minimum ke maksimum, hampir semua daerah akan tampak sama besar. Maka skala
// dipotong di persentil ke-5 dan ke-97: laju ≤ batas bawah (termasuk semua
// laju negatif) berlingkaran terkecil, laju ≥ batas atas berlingkaran terbesar,
// dan di antaranya jari-jari naik linear.
const R_MIN = 3; // px — untuk laju ≤ LAJU_LO
const R_MAX = 17; // px — untuk laju ≥ LAJU_HI
const quantile = (arr, q) => {
  const a = [...arr].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
};
const LAJU_VALUES = pdrbData.map((d) => d.laju);
const LAJU_LO = Math.max(0, quantile(LAJU_VALUES, 0.05));
const LAJU_HI = quantile(LAJU_VALUES, 0.97);
const radiusFor = (laju) => {
  const t = Math.min(1, Math.max(0, (laju - LAJU_LO) / (LAJU_HI - LAJU_LO)));
  return R_MIN + t * (R_MAX - R_MIN);
};

const MIMIKA = pdrbData.find((d) => d.isMimika);
const MIMIKA_CLASS = MIMIKA ? classIndexFor(MIMIKA.pdrbPerKapita) : null;

export default function ProportionalSymbolSection() {
  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const el = mapElRef.current;
    if (!el || mapInstanceRef.current) return undefined;

    const map = L.map(el, {
      scrollWheelZoom: true,
      zoomControl: true,
      minZoom: 3,
    });
    mapInstanceRef.current = map;

    // Basemap: citra satelit Esri World Imagery (gratis, tanpa API key).
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 18,
      },
    );
    satellite.addTo(map);

    // Buka dengan seluruh Indonesia pas di bingkai; ukuran peta bisa berubah
    // (layout/resize), jadi sesuaikan ulang lewat ResizeObserver.
    let fitted = false;
    const fitIfReady = () => {
      map.invalidateSize();
      if (!fitted && el.clientWidth > 0 && el.clientHeight > 0) {
        map.fitBounds(INDONESIA_BOUNDS, { padding: [6, 6] });
        fitted = true;
      }
    };
    fitIfReady();
    const ro = new ResizeObserver(fitIfReady);
    ro.observe(el);

    const symbolLayer = L.layerGroup();
    pdrbData.forEach((d) => {
      const isNegative = d.laju < 0;
      const radius = radiusFor(d.laju);

      // Mimika: cincin putih ("halo") di luar lingkarannya + garis tepi gelap,
      // supaya menonjol di atas citra satelit.
      if (d.isMimika) {
        L.circleMarker([d.lat, d.lng], {
          radius: radius + 6,
          fill: false,
          color: "#ffffff",
          weight: 3,
          opacity: 1,
          interactive: false,
        }).addTo(symbolLayer);
      }

      const marker = L.circleMarker([d.lat, d.lng], {
        radius,
        fillColor: COLORS[classIndexFor(d.pdrbPerKapita)],
        fillOpacity: 0.9,
        color: d.isMimika ? "#111111" : "#ffffff",
        weight: d.isMimika ? 2.5 : isNegative ? 1.6 : 0.8,
        opacity: d.isMimika ? 1 : 0.9,
        dashArray: isNegative ? "3,2" : null,
      });

      marker.bindTooltip(
        `<div style="font-family:system-ui,sans-serif;line-height:1.4">
          <strong>${d.kabkota}</strong><br/>
          <span style="opacity:.75">${d.provinsi}</span><br/>
          PDRB per kapita: <strong>${numberFmt(d.pdrbPerKapita)} jt Rp</strong><br/>
          Laju pertumbuhan: <strong style="color:${isNegative ? "#d55e00" : "#009e73"}">${percentFmt(d.laju)}</strong>
        </div>`,
        { sticky: true, direction: "top", opacity: 0.95 },
      );

      marker.addTo(symbolLayer);
    });
    symbolLayer.addTo(map);

    // --- Kontrol layer: nyalakan/matikan simbol
    L.control
      .layers(
        null,
        { "Simbol PDRB": symbolLayer },
        {
          collapsed: false,
          position: "topright",
        },
      )
      .addTo(map);

    // --- Legenda: warna (natural breaks) + referensi ukuran lingkaran
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.style.cssText =
        "background:rgba(22,27,34,0.92);color:#e6edf3;padding:8px 10px;border-radius:8px;" +
        "font-family:system-ui,sans-serif;font-size:10px;box-shadow:0 2px 8px rgba(0,0,0,0.4);max-width:170px";

      const rangeLabels = [
        `${numberFmt(BREAKS[0])}–${numberFmt(BREAKS[1])}`,
        `${numberFmt(BREAKS[1])}–${numberFmt(BREAKS[2])}`,
        `${numberFmt(BREAKS[2])}–${numberFmt(BREAKS[3])}`,
        `${numberFmt(BREAKS[3])}–${numberFmt(BREAKS[4])}`,
      ];

      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:5px">PDRB per Kapita (jt Rp)</div>
        ${rangeLabels
          .map(
            (label, i) => `
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
            <span style="width:10px;height:10px;border-radius:50%;background:${COLORS[i]};border:1px solid #fff;display:inline-block;flex-shrink:0"></span>
            <span>${label}</span>
          </div>`,
          )
          .join("")}
        <div style="font-weight:700;margin:6px 0 4px">Laju Pertumbuhan</div>
        <div style="display:flex;align-items:flex-end;gap:10px">
          ${[LAJU_LO, (LAJU_LO + LAJU_HI) / 2, LAJU_HI]
            .map(
              (v, i) => `
          <div style="text-align:center">
            <div style="width:${radiusFor(v) * 2}px;height:${radiusFor(v) * 2}px;border-radius:50%;background:#8b949e;border:1px solid #fff;margin:0 auto 2px"></div>
            <span style="font-size:8px">${i === 0 ? "≤ " : i === 2 ? "≥ " : ""}${percentFmt(v)}</span>
          </div>`,
            )
            .join("")}
        </div>
  
      `;
      return div;
    };
    legend.addTo(map);

    return () => {
      ro.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const mimikaNegative = MIMIKA ? MIMIKA.laju < 0 : false;

  return (
    <section
      className="relative bg-[#f4f0e7] lg:h-screen"
      id="proportional-symbol"
    >
      {/* Seluruh section dibuat setinggi layar (desktop): judul, subjudul,
          peta, dan interpretasi terlihat dalam satu frame. */}
      <div className="max-w-story mx-auto flex h-full w-full flex-col gap-2 px-6 py-4 md:py-5">
        <div className="flex shrink-0 flex-col gap-1">
          <h2
            className="story-heading text-[#d74534]"
            style={{
              fontSize: "clamp(1.2rem, 2.2vw, 1.8rem)",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Skala Ekonomi Nusantara: Siapa yang Paling Cepat Tumbuh?
          </h2>
          <p
            className="story-lede text-[#2a3f61]"
            style={{
              fontSize: "clamp(0.78rem, 1vw, 0.92rem)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            Memetakan potret PDRB per kapita dan laju pertumbuhan ekonomi
            seluruh kabupaten/kota di Indonesia pada tahun 2025 untuk melihat
            kontras pembangunan antarwilayah.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div
            ref={mapElRef}
            className="h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl border border-black/10 lg:h-auto lg:min-h-0 lg:flex-1"
          />

          <aside className="w-full shrink-0 overflow-y-auto rounded-xl border border-black/10 bg-white/90 p-4 lg:w-[300px]">
            <p className="story-lede text-xs uppercase tracking-[0.15em] text-[#0072B2] font-semibold mb-2">
              Penjelasan
            </p>
            {MIMIKA && (
              <p className=" story-lede text-[13px] text-[#5c564c] leading-relaxed mb-3">
                Visualisasi peta simbol proporsional memperlihatkan sebaran
                ekonomi nasional yang sangat terkonsentrasi secara spasial, di
                mana ukuran simbol merepresentasikan besarnya nilai PDRB per
                kapita (dalam juta rupiah) dan gradasi warnanya mencerminkan
                tingkat laju pertumbuhan ekonomi kabupaten/kota pada tahun 2025
                (dalam persen). Berdasarkan data agregat nasional terhadap 514
                kabupaten/kota, rata-rata PDRB per kapita berada di angka
                Rp77,64 juta dengan standar deviasi yang cukup lebar,
                mencerminkan kesenjangan kesejahteraan yang tajam antar wilayah.
              </p>
            )}
            <p className="story-lede text-[13px] text-[#5c564c] leading-relaxed mb-3">
              Simbol-simbol lingkaran berukuran raksasa dengan warna yang
              mencolok tampak mendominasi daerah-daerah ekonomi tertentu seperti
              DKI Jakarta, sebagian wilayah Kalimantan, serta wilayah timur
              Indonesia—khususnya Kabupaten Mimika di Provinsi Papua Tengah yang
              mencatatkan PDRB per kapita sangat tinggi mencapai Rp395,26 juta.
            </p>
            <p className="story-lede text-[13px] text-[#5c564c] leading-relaxed">
              Namun, di balik ukuran simbol ekonomi yang masif tersebut, peta
              ini juga menangkap anomali berupa variasi tingkat pertumbuhan, di
              mana beberapa wilayah dengan skala ekonomi besar justru mengalami
              tekanan pertumbuhan yang ditandai dengan laju pertumbuhan negatif,
              kontras dengan daerah berkembang lain yang mencatat pertumbuhan
              positif stabil di kisaran rata-rata nasional (4,99%).
            </p>
          </aside>
        </div>

        <p className="shrink-0 text-center text-[11px] text-[#5c564c]">
          Sumber data: Badan Pusat Statistik
        </p>
      </div>
    </section>
  );
}
