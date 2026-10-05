import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import klassenData from "../../../data/klassen_kabkota.json";

const KLASSEN = {
  I: {
    color: "#0072B2",
    title: "Kuadran I",
    label: "Maju & tumbuh cepat",
    hint: "PDRB per kapita tinggi, pertumbuhan tinggi",
  },
  II: {
    color: "#D55E00",
    title: "Kuadran II",
    label: "Maju tapi tertekan",
    hint: "PDRB per kapita tinggi, pertumbuhan rendah",
  },
  III: {
    color: "#F0E442",
    title: "Kuadran III",
    label: "Berkembang cepat",
    hint: "PDRB per kapita rendah, pertumbuhan tinggi",
  },
  IV: {
    color: "#8C8C8C",
    title: "Kuadran IV",
    label: "Relatif tertinggal",
    hint: "PDRB per kapita rendah, pertumbuhan rendah",
  },
};
const QUADRANTS = Object.keys(KLASSEN);

const INDONESIA_BOUNDS = [
  [-11.5, 94.5],
  [6.5, 141.5],
];

const numberFmt = (n) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const percentFmt = (n) =>
  `${(n * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

const COUNTS = QUADRANTS.reduce((acc, q) => {
  acc[q] = klassenData.features.filter(
    (f) => f.properties.kuadran === q,
  ).length;
  return acc;
}, {});
const TOTAL = klassenData.features.length;
const MIMIKA = klassenData.features.find(
  (f) => f.properties.isMimika,
)?.properties;

export default function ChoroplethSection() {
  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const el = mapElRef.current;
    if (!el || mapInstanceRef.current) return undefined;

    const map = L.map(el, {
      scrollWheelZoom: true,
      zoomControl: true,
      minZoom: 3,
      preferCanvas: true,
    });
    mapInstanceRef.current = map;

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 18,
      },
    );
    satellite.addTo(map);

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

    const baseStyle = (feature) => {
      const p = feature.properties;
      return {
        fillColor: KLASSEN[p.kuadran].color,
        fillOpacity: 0.85,
        color: p.isMimika ? "#111111" : "#ffffff",
        weight: p.isMimika ? 2.5 : 0.5,
        opacity: 1,
      };
    };

    const tooltipHtml = (p) => {
      const k = KLASSEN[p.kuadran];
      const neg = p.laju < 0;
      return `<div style="font-family:system-ui,sans-serif;line-height:1.45;min-width:190px">
        <strong>${p.kabkota}</strong><br/>
        <span style="opacity:.75">${p.provinsi}</span>
        <div style="margin-top:4px">
          PDRB per kapita: <strong>${numberFmt(p.pdrbPerKapita)} jt Rp</strong><br/>
          Laju pertumbuhan: <strong style="color:${neg ? "#D55E00" : "#009E73"}">${percentFmt(p.laju)}</strong>
        </div>
        <div style="margin-top:5px;display:flex;align-items:center;gap:6px">
          <span style="width:11px;height:11px;border-radius:3px;background:${k.color};border:1px solid #333;display:inline-block;flex-shrink:0"></span>
          <span><strong>${k.title}</strong> — ${k.label}</span>
        </div>
      </div>`;
    };

    const geoLayer = L.geoJSON(klassenData, {
      style: baseStyle,
      smoothFactor: 0.6,
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(tooltipHtml(feature.properties), {
          sticky: true,
          direction: "top",
          opacity: 0.97,
        });
        layer.on({
          mouseover: () => {
            layer.setStyle({ weight: 2.5, color: "#111111" });
            layer.bringToFront();
          },
          mouseout: () => {
            layer.setStyle(baseStyle(feature));
            if (feature.properties.isMimika) layer.bringToFront();
          },
        });
      },
    }).addTo(map);

    geoLayer.eachLayer((layer) => {
      if (layer.feature.properties.isMimika) layer.bringToFront();
    });

    L.control
      .layers(
        null,
        { "Tipologi Klassen": geoLayer },
        {
          collapsed: false,
          position: "topright",
        },
      )
      .addTo(map);

    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.style.cssText =
        "background:rgba(255,255,255,0.94);color:#2b2b2b;padding:8px 10px;border-radius:8px;" +
        "font-family:system-ui,sans-serif;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,0.25);max-width:210px";
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:5px">Tipologi Klassen</div>
        ${QUADRANTS.map((q) => {
          const k = KLASSEN[q];
          return `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px">
            <span style="width:12px;height:12px;border-radius:3px;background:${k.color};border:1px solid #333;display:inline-block;flex-shrink:0;margin-top:1px"></span>
            <span><strong>${k.title}</strong> · ${COUNTS[q]} daerah<br/><span style="opacity:.75">${k.label}</span></span>
          </div>`;
        }).join("")}

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

  const mimikaK = MIMIKA ? KLASSEN[MIMIKA.kuadran] : null;

  return (
    <section className="relative bg-[#f4f0e7] lg:h-screen" id="choropleth">
      {
}
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
            Anomali di Kuadran II: Potret Daerah Kaya yang Melambat
          </h2>
          <p
            className="story-lede text-[#2a3f61]"
            style={{
              fontSize: "clamp(0.78rem, 1vw, 0.92rem)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            Mengelompokkan daerah menggunakan Tipologi Klassen, mencatat PDRB
            per kapita tertinggi, namun berada di zona pertumbuhan negatif.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div
            ref={mapElRef}
            className="h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl border border-black/10 lg:h-auto lg:min-h-0 lg:flex-1"
          />

          <aside className="story-lede w-full shrink-0 overflow-y-auto rounded-xl border border-black/10 bg-white/90 p-4 lg:w-[300px]">
            <p className="story-lede  text-xs uppercase tracking-[0.15em] text-[#0072B2] font-semibold mb-2">
              Interpretasi
            </p>
            {MIMIKA && mimikaK && (
              <p className="text-[13px] text-[#5c564c] leading-relaxed mb-3">
                Peta choropleth Tipologi Klassen mengklasifikasikan 514
                kabupaten/kota di Indonesia ke dalam empat kuadran pertumbuhan
                dan pendapatan untuk memetakan karakter pembangunan daerah
                secara komparatif. Dari total wilayah tersebut, mayoritas daerah
                terkonsentrasi pada Kuadran IV (204 daerah atau relatif
                tertinggal) dan Kuadran III (179 daerah atau berkembang cepat),
                sementara 71 daerah berada di Kuadran I (maju dan tumbuh cepat)
                serta 60 daerah berada di Kuadran II (daerah maju tapi
                tertekan).
              </p>
            )}
            <p className="text-[13px] text-[#5c564c] leading-relaxed mb-3">
              Kabupaten Mimika sebagai salah satu contoh anomali paling
              signifikan yang masuk ke dalam Kuadran II (Maju tapi Tertekan),
              yang ditandai pada peta dengan warna khusus di wilayah Papua
              Tengah. Masuknya Mimika ke Kuadran II mengindikasikan bahwa
              meskipun daerah ini memiliki tingkat PDRB per kapita yang jauh
              melampaui rata-rata nasional, laju pertumbuhan ekonominya
              mengalami kontraksi hingga mencapai -26,22% pada tahun 2025.
            </p>
            <p className="text-[13px] text-[#5c564c] leading-relaxed">
              Kondisi ini memperlihatkan karakteristik khas daerah dengan sumber
              daya alam yang melimpah, memiliki nilai ekonomi makro yang sangat
              tinggi secara nominal, namun rentan terhadap perlambatan dan
              pertumbuhan negatif apabila sektor dominannya mengalami penurunan.
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
