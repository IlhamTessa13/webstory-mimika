import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const pdrbData = {
  name: "PDRB Papua Tengah",
  children: [
    {
      name: "Deiyai",
      children: [
        { name: "Primer", value: 350.8 },
        { name: "Sekunder", value: 709.49 },
        { name: "Tersier", value: 782.55 },
      ],
    },
    {
      name: "Dogiyai",
      children: [
        { name: "Primer", value: 498.97 },
        { name: "Sekunder", value: 289.77 },
        { name: "Tersier", value: 938.57 },
      ],
    },
    {
      name: "Intan Jaya",
      children: [
        { name: "Primer", value: 358.6 },
        { name: "Sekunder", value: 621.86 },
        { name: "Tersier", value: 572.52 },
      ],
    },
    {
      name: "Mimika",
      children: [
        { name: "Primer", value: 116197.18 },
        { name: "Sekunder", value: 3555.99 },
        { name: "Tersier", value: 11326.4 },
      ],
    },
    {
      name: "Nabire",
      children: [
        { name: "Primer", value: 5832.78 },
        { name: "Sekunder", value: 2846.97 },
        { name: "Tersier", value: 7437.9 },
      ],
    },
    {
      name: "Paniai",
      children: [
        { name: "Primer", value: 2327.99 },
        { name: "Sekunder", value: 1833.97 },
        { name: "Tersier", value: 1471.36 },
      ],
    },
    {
      name: "Puncak",
      children: [
        { name: "Primer", value: 235.94 },
        { name: "Sekunder", value: 715.52 },
        { name: "Tersier", value: 915.23 },
      ],
    },
    {
      name: "Puncak Jaya",
      children: [
        { name: "Primer", value: 455.28 },
        { name: "Sekunder", value: 530.68 },
        { name: "Tersier", value: 799.79 },
      ],
    },
  ],
};

const REGION_COLORS = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#F0E442",
  "#999999",
];

const REGIONS_WITH_VALUES = ["Mimika", "Nabire"];

const BG_CREAM = "#f4f0e7";
const SOURCE = "Badan Pusat Statistik";

const UNIFORM_GAP = 10;
const UNIFORM_MAX_W = 680;
const UNIFORM_MAX_H = 480;

const CATEGORY_NOTES = {
  Primer:
    "Di dalam struktur internal Kabupaten Mimika, Sektor Primer (yang mencakup Pertanian, Kehutanan, Perikanan, serta Pertambangan dan Penggalian) mendominasi secara mutlak dengan nilai mencapai Rp116,19 triliun atau menyumbang sekitar 88,6% dari total PDRB Mimika. Jika dibandingkan dengan kabupaten lain di Papua Tengah yang sektor primernya relatif kecil (seperti Nabire di angka Rp5,83 triliun atau Paniai di Rp2,32 triliun), sektor primer Mimika mencatatkan skala ukuran yang jauh melampaui gabungan seluruh kabupaten lain di provinsi tersebut, menjadikannya pusat ekonomi sektor primer utama di Papua Tengah.",
  Sekunder:
    "Sektor Sekunder di Kabupaten Mimika menorehkan angka sebesar Rp3,55 triliun, menempatkannya sebagai kategori sektor dengan porsi terkecil di Mimika. Meskipun nilainya tampak kecil (hanya menyumbang sekitar 2,7% dari total PDRB Mimika), jika dikomparasikan secara regional, angka sekunder Mimika tetap berada di jajaran atas dibandingkan kabupaten lain seperti Puncak Jaya (Rp530,68 miliar) atau Dogiyai (Rp289,77 miliar), yang mengindikasikan adanya aktivitas penunjang industri dan pembangunan infrastruktur fisik skala lokal untuk melayani kawasan operasional tambang.",
  Tersier:
    "Sektor Tersier di Mimika mencatatkan angka yang cukup besar yakni sebesar Rp11,32 triliun, menjadikannya blok terbesar kedua setelah sektor primer di wilayah tersebut. Dalam konteks komparasi regional Papua Tengah, besaran sektor tersier Mimika jauh di atas Nabire (Rp7,43 triliun) dan kabupaten lainnya. Besarnya porsi tersier ini mencerminkan tingginya perputaran uang, aktivitas perdagangan, jasa perusahaan, serta perputaran logistik perkotaan yang tumbuh untuk menopang ekosistem ekonomi di sekitar pusat kegiatan industri utama.",
};

const numberFmt = (n) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

function getContrastText(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#2b2b2b" : "#ffffff";
}

function fitFontSize(
  text,
  maxWidthPx,
  { max = 13, min = 3.5, charWidthRatio = 0.68 } = {},
) {
  if (!text || maxWidthPx <= 0) return min;
  const estimate = maxWidthPx / (text.length * charWidthRatio);
  return Math.max(min, Math.min(max, estimate));
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const regionNames = pdrbData.children.map((r) => r.name);
const regionColor = (name) =>
  REGION_COLORS[regionNames.indexOf(name) % REGION_COLORS.length];
const regionTotal = (r) => r.children.reduce((s, c) => s + c.value, 0);
const grandTotal = pdrbData.children.reduce((s, r) => s + regionTotal(r), 0);
const mimikaTotal = regionTotal(
  pdrbData.children.find((r) => r.name === "Mimika"),
);
const mimikaShare = (mimikaTotal / grandTotal) * 100;
const pctFmt = (p) =>
  `${p.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

const mimikaValue = (cat) =>
  pdrbData.children
    .find((r) => r.name === "Mimika")
    .children.find((c) => c.name === cat).value;

const CARDS = [
  {
    key: "mimika",
    eyebrow: "Gambaran Umum",
    title: "Papua Tengah",
    body: `Berdasarkan visualisasi treemap PDRB ADHB tahun 2025 di Provinsi Papua Tengah (total PDRB regional mencapai Rp161,61 triliun), Kabupaten Mimika tampil sebagai daerah yang mendominasi lebih dari 80% dari total ekonomi provinsi dengan nilai PDRB mencapai Rp131,08 triliun. Blok ukuran Mimika terlihat sangat besar jika dibandingkan dengan kabupaten tetangga seperti Nabire (Rp16,12 triliun), Paniai (Rp5,63 triliun), atau Puncak (Rp1,87 triliun). Dominasi ini menunjukkan bahwa perekonomian makro Papua Tengah sangat bergantung pada kinerja ekonomi Kabupaten Mimika.`,
  },
  {
    key: "Primer",
    eyebrow: "Sektor Primer — Mimika",
    title: `${numberFmt(mimikaValue("Primer"))} miliar Rp`,
    body: CATEGORY_NOTES.Primer,
  },
  {
    key: "Sekunder",
    eyebrow: "Sektor Sekunder — Mimika",
    title: `${numberFmt(mimikaValue("Sekunder"))} miliar Rp`,
    body: CATEGORY_NOTES.Sekunder,
  },
  {
    key: "Tersier",
    eyebrow: "Sektor Tersier — Mimika",
    title: `${numberFmt(mimikaValue("Tersier"))} miliar Rp`,
    body: CATEGORY_NOTES.Tersier,
  },
];

const NEUTRAL_DURATION = 0.5;
const CARD_DURATION = 3.0;
const CARD_STAGGER = 1.1;
const TRAVEL_VH = 120;
const TOTAL_UNITS =
  NEUTRAL_DURATION + (CARDS.length - 1) * CARD_STAGGER + CARD_DURATION;

const SMOOTHING_MS = 280;

const sceneStart = (i) => NEUTRAL_DURATION + i * CARD_STAGGER;

function cardOffsetVh(raw, i) {
  const t = (raw - sceneStart(i)) / CARD_DURATION;
  const clamped = Math.min(1, Math.max(0, t));
  return TRAVEL_VH - 2 * TRAVEL_VH * clamped;
}

function buildLayout(width, height, selected) {
  const makeTreemap = (w, h) =>
    d3
      .treemap()
      .size([w, h])
      .paddingOuter(6)
      .paddingTop(24)
      .paddingInner(3)
      .round(true);

  if (selected.length !== 1) {
    const data =
      selected.length === 0
        ? pdrbData
        : {
            ...pdrbData,
            children: pdrbData.children.filter((r) =>
              selected.includes(r.name),
            ),
          };
    const root = d3
      .hierarchy(data)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);
    makeTreemap(width, height)(root);
    return {
      regions: root.children,
      leaves: root.leaves(),
      uniform: false,
      showValues: selected.length > 1,
    };
  }

  const list = pdrbData.children.filter((r) => selected.includes(r.name));
  const n = list.length;

  let best = { rows: 1, cols: n, score: Infinity };
  for (let rows = 1; rows <= n; rows += 1) {
    const cols = Math.ceil(n / rows);
    const cw = Math.min(
      (width - UNIFORM_GAP * (cols - 1)) / cols,
      UNIFORM_MAX_W,
    );
    const ch = Math.min(
      (height - UNIFORM_GAP * (rows - 1)) / rows,
      UNIFORM_MAX_H,
    );
    const score = Math.abs(Math.log(cw / ch / 1.4)) + (rows * cols - n) * 0.15;
    if (score < best.score) best = { rows, cols, score };
  }
  const { rows, cols } = best;
  const cellW = Math.max(
    40,
    Math.min((width - UNIFORM_GAP * (cols - 1)) / cols, UNIFORM_MAX_W),
  );
  const cellH = Math.max(
    40,
    Math.min((height - UNIFORM_GAP * (rows - 1)) / rows, UNIFORM_MAX_H),
  );
  const blockW = cols * cellW + UNIFORM_GAP * (cols - 1);
  const blockH = rows * cellH + UNIFORM_GAP * (rows - 1);
  const originX = (width - blockW) / 2;
  const originY = (height - blockH) / 2;

  const regions = [];
  const leaves = [];
  list.forEach((r, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
    const rowShift = ((cols - inRow) * (cellW + UNIFORM_GAP)) / 2;
    const x0 = originX + rowShift + col * (cellW + UNIFORM_GAP);
    const y0 = originY + row * (cellH + UNIFORM_GAP);

    const root = d3
      .hierarchy({
        name: r.name,
        children: r.children.map((c) => ({ ...c })),
      })
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);
    makeTreemap(cellW, cellH)(root);

    const region = {
      data: { name: r.name },
      x0,
      y0,
      x1: x0 + cellW,
      y1: y0 + cellH,
    };
    regions.push(region);
    root.leaves().forEach((l) =>
      leaves.push({
        data: l.data,
        parent: region,
        x0: x0 + l.x0,
        y0: y0 + l.y0,
        x1: x0 + l.x1,
        y1: y0 + l.y1,
      }),
    );
  });
  return { regions, leaves, uniform: true, showValues: true };
}

export default function TreemapSection() {
  const wrapperRef = useRef(null);
  const vizRef = useRef(null);
  const cardRefs = useRef([]);
  const drawnRef = useRef(false);
  const [isComplete, setIsComplete] = useState(false);
  const [selRegions, setSelRegions] = useState([]);

  const toggleRegion = (name) =>
    setSelRegions((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name],
    );

  useEffect(() => {
    const el = vizRef.current;
    if (!el) return;

    const draw = () => {
      el.innerHTML = "";
      const width = el.clientWidth || 700;
      const height = el.clientHeight || 560;
      if (width === 0 || height === 0) return;

      const layout = buildLayout(width, height, selRegions);
      const { uniform, showValues } = layout;

      const svg = d3
        .select(el)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      if (drawnRef.current) {
        svg.style("opacity", 0).transition().duration(350).style("opacity", 1);
      }
      drawnRef.current = true;
      const defs = svg.append("defs");

      const regions = svg
        .selectAll("g.region")
        .data(layout.regions)
        .join("g")
        .attr("class", "region")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

      regions
        .append("rect")
        .attr("class", "region-bg")
        .attr("width", (d) => d.x1 - d.x0)
        .attr("height", (d) => d.y1 - d.y0)
        .attr("fill", (d) => regionColor(d.data.name))
        .attr("fill-opacity", 0.1)
        .attr("stroke", (d) => regionColor(d.data.name))
        .attr("stroke-width", 1.5)
        .attr("rx", 6);

      regions.each(function regionLabel(d) {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const clipId = `clip-region-${slug(d.data.name)}`;
        defs
          .append("clipPath")
          .attr("id", clipId)
          .append("rect")
          .attr("width", Math.max(0, w))
          .attr("height", Math.max(0, h));

        const g = d3.select(this).attr("clip-path", `url(#${clipId})`);
        const fontSize = fitFontSize(d.data.name, w - 10, {
          max: uniform ? 15 : 12,
          min: 6,
        });
        g.append("text")
          .attr("class", "region-label")
          .attr("x", 6)
          .attr("y", fontSize + 6)
          .attr("fill", "#2b2b2b")
          .style("font-size", `${fontSize}px`)
          .style("font-weight", 700)
          .text(d.data.name);
      });

      const leaves = svg
        .selectAll("g.category")
        .data(layout.leaves)
        .join("g")
        .attr("class", "category")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

      leaves
        .append("rect")
        .attr("class", "category-rect")
        .attr("width", (d) => Math.max(0, d.x1 - d.x0))
        .attr("height", (d) => Math.max(0, d.y1 - d.y0))
        .attr("fill", (d) => regionColor(d.parent.data.name))
        .attr("stroke", BG_CREAM)
        .attr("stroke-width", 2)
        .attr("rx", 3)
        .append("title")
        .text((d) => {
          const region = pdrbData.children.find(
            (r) => r.name === d.parent.data.name,
          );
          return `${d.parent.data.name} — ${d.data.name}: ${numberFmt(
            d.data.value,
          )} miliar Rp (${pctFmt(
            (d.data.value / regionTotal(region)) * 100,
          )} dari PDRB ${d.parent.data.name})`;
        });

      leaves.each(function labelLeaf(d) {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 6 || h < 6) return;

        const PAD = 3;
        const name = d.data.name;

        const clipId = `clip-leaf-${slug(d.parent.data.name)}-${slug(name)}`;
        defs
          .append("clipPath")
          .attr("id", clipId)
          .append("rect")
          .attr("width", Math.max(0, w))
          .attr("height", Math.max(0, h));

        const textColor = getContrastText(regionColor(d.parent.data.name));
        const g = d3.select(this).attr("clip-path", `url(#${clipId})`);

        const horizontalSize = Math.min(
          fitFontSize(name, w - PAD * 2, {
            max: uniform ? 16 : 11,
            min: 3.5,
          }),
          (h - PAD * 2) / 1.2,
        );

        const useVertical = horizontalSize < 5.5 && h > w * 1.3;

        if (useVertical) {
          const vSize = Math.max(
            3,
            Math.min(
              fitFontSize(name, h - PAD * 2, { max: 11, min: 3.5 }),
              (w - PAD * 2) / 1.2,
            ),
          );
          g.append("text")
            .attr("class", "category-label")
            .attr(
              "transform",
              `translate(${PAD + vSize * 0.85},${PAD}) rotate(90)`,
            )
            .attr("fill", textColor)
            .style("font-size", `${vSize}px`)
            .style("font-weight", 600)
            .text(name);
          return;
        }

        const nameFontSize = Math.max(3, horizontalSize);
        g.append("text")
          .attr("class", "category-label")
          .attr("x", PAD)
          .attr("y", PAD + nameFontSize * 0.9)
          .attr("fill", textColor)
          .style("font-size", `${nameFontSize}px`)
          .style("font-weight", 600)
          .text(name);

        const showValue =
          uniform ||
          showValues ||
          REGIONS_WITH_VALUES.includes(d.parent.data.name);
        if (!showValue) return;

        const valueText = `${numberFmt(d.data.value)} M`;
        const valueFontSize = Math.max(5, nameFontSize - 1);
        const neededHeight = PAD + nameFontSize * 1.15 + valueFontSize + 2;
        if (h >= neededHeight) {
          const fittedValueSize = fitFontSize(valueText, w - PAD * 2, {
            max: valueFontSize,
            min: 5,
          });
          g.append("text")
            .attr("class", "category-value")
            .attr("x", PAD)
            .attr("y", PAD + nameFontSize * 0.9 + fittedValueSize + 3)
            .attr("fill", textColor)
            .style("font-size", `${fittedValueSize}px`)
            .text(valueText);
        }
      });
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [selRegions]);

  useEffect(() => {
    let rafId = null;
    let target = 0;
    let current = 0;
    let lastTime = 0;

    const readTarget = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return 0;
      const rect = wrapper.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      return scrollable > 0
        ? Math.min(1, Math.max(0, -rect.top / scrollable))
        : 0;
    };

    const render = () => {
      const raw = current * TOTAL_UNITS;

      CARDS.forEach((_, i) => {
        const card = cardRefs.current[i];
        if (!card) return;
        card.style.transform = `translate(-50%, calc(-50% + ${cardOffsetVh(raw, i)}vh))`;
      });

      const nextComplete = raw >= TOTAL_UNITS - 0.05;
      setIsComplete((prev) => (prev === nextComplete ? prev : nextComplete));
    };

    const tick = (time) => {
      const dt = lastTime ? Math.min(64, time - lastTime) : 16;
      lastTime = time;

      const diff = target - current;
      if (Math.abs(diff) < 0.00002) {
        current = target;
        render();
        rafId = null;
        lastTime = 0;
        return;
      }
      current += diff * (1 - Math.exp(-dt / SMOOTHING_MS));
      render();
      rafId = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = readTarget();
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };

    target = current = readTarget();
    render();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section id="treemap" className="relative bg-[#f4f0e7]">
      <div
        ref={wrapperRef}
        className="relative"
        style={{ height: `${TOTAL_UNITS * 100}vh` }}
      >
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden bg-[#f4f0e7]">
          {}
          <div className="max-w-story mx-auto flex shrink-0 flex-col gap-1 px-6 pb-1 pt-5 md:pt-7">
            <h2
              className="story-heading text-[#d74534]"
              style={{
                fontSize: "clamp(1.25rem, 2.3vw, 1.9rem)",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Anatomi Ekonomi Papua Tengah Didominasi Sektor Primer
            </h2>
            <p
              className="story-lede text-[#2a3f61]"
              style={{
                fontSize: "clamp(0.78rem, 1.05vw, 0.95rem)",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Membandingkan struktur makro (Primer, Sekunder, Tersier)
              antarkabupaten di Papua Tengah. Terlihat jelas bagaimana ukuran
              ekonomi Mimika didominasi oleh fondasi yang timpang.
            </p>
          </div>

          {}
          <div className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-6 pb-1 pt-1">
            <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5c564c]">
              Kabupaten
            </span>
            {regionNames.map((name) => {
              const active = selRegions.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleRegion(name)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    active
                      ? "border-[#2b2b2b] bg-[#2b2b2b] text-white"
                      : "border-[#2b2b2b]/40 bg-white/70 text-[#2b2b2b] hover:bg-white"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border"
                    style={{
                      backgroundColor: regionColor(name),
                      borderColor: active ? "#fff" : "#2b2b2b",
                    }}
                  />
                  {name}
                </button>
              );
            })}
            {selRegions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelRegions([])}
                className="ml-1 text-xs text-[#5c564c] underline underline-offset-2 hover:text-[#2b2b2b]"
              >
                Setel ulang
              </button>
            )}
          </div>

          <div className="relative mx-6 min-h-0 flex-1 md:mx-12">
            <div ref={vizRef} className="absolute inset-0" />
          </div>

          {}
          <div className="pointer-events-none flex shrink-0 flex-col items-center gap-0.5 px-6 pb-3 pt-1">
            <p className="text-[11px] text-[#5c564c]">Sumber data: {SOURCE}</p>
 
          </div>

          {

}
          {CARDS.map((card, i) => (
            <div
              key={card.key}
              ref={(node) => {
                cardRefs.current[i] = node;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[90%] max-w-[420px] rounded-xl bg-white/95 shadow-lg p-5"
              style={{
                transform: "translate(-50%, calc(-50% + 120vh))",
                willChange: "transform",
              }}
            >
              <p className="story-lede text-xs uppercase tracking-[0.15em] text-[#0072B2] font-semibold mb-1">
                {card.eyebrow}
              </p>
              <h3 className="story-lede text-lg font-bold text-[#2b2b2b] mb-2">
                {card.title}
              </h3>
              <p className="story-lede text-sm text-[#5c564c] leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
