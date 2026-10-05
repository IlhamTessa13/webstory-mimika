import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const RAW_ROWS = [
  ["Primer", "A Pertanian, Kehutanan, dan Perikanan", 1710.33],
  ["Primer", "B Pertambangan dan Penggalian", 114486.85],
  ["Sekunder", "C Industri Pengolahan", 154.59],
  ["Sekunder", "D Pengadaan Listrik dan Gas", 18.59],
  [
    "Sekunder",
    "E Pengadaan Air; Pengelolaan Sampah, Limbah, dan Daur Ulang",
    7.76,
  ],
  ["Sekunder", "F Konstruksi/Construction", 3375.05],
  [
    "Tersier",
    "G Perdagangan Besar dan Eceran; Reparasi Mobil dan Sepeda Motor",
    3243.51,
  ],
  ["Tersier", "H Transportasi dan Pergudangan", 1735.44],
  ["Tersier", "I Penyediaan Akomodasi dan Makan Minum", 281.86],
  ["Tersier", "J Informasi dan Komunikasi", 1943.44],
  ["Tersier", "K Jasa Keuangan dan Asuransi", 547.39],
  ["Tersier", "L Real Estat", 854.88],
  ["Tersier", "M,N Jasa Perusahaan", 459.81],
  [
    "Tersier",
    "O Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib",
    1542.43,
  ],
  ["Tersier", "P Jasa Pendidikan", 179.73],
  ["Tersier", "Q Jasa Kesehatan dan Kegiatan Sosial", 222.17],
  ["Tersier", "R,S,T,U Jasa Lainnya", 315.74],
];

const CATEGORY_COLORS = {
  Primer: "#E69F00",
  Sekunder: "#009E73",
  Tersier: "#0072B2",
};
const FALLBACK_COLORS = ["#CC79A7", "#56B4E9", "#D55E00", "#999999"];
const TINTS = [0.5, 0.18, 0.42, 0.3, 0.52, 0.22, 0.46, 0.34, 0.56, 0.26, 0.4];

const SOURCE = "Badan Pusat Statistik";
const STROKE = "#2b2b2b";
const SWEEP_IN_MS = 1800;
const SWEEP_OUT_MS = 1100;
const FULL = 2 * Math.PI;

const labelOpacity = (sweep) =>
  Math.min(1, Math.max(0, (sweep / FULL - 0.85) / 0.15));

const numberFmt = (n) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

const pctFmt = (pct) => {
  if (pct < 0.01) return "<0,01%";
  const digits = pct < 1 ? 2 : 1;
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: digits })}%`;
};

function getContrastText(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#2b2b2b" : "#ffffff";
}

function buildModel(rows) {
  const cats = [];
  const byName = new Map();
  rows.forEach(([kategori, sub, pdrb]) => {
    const value = Number(pdrb);
    if (!kategori || !sub || !Number.isFinite(value)) return;

    const raw = String(sub).replace(/\s+/g, " ").trim();
    const m = raw.match(/^([A-Z](?:,[A-Z])*)\s+(.+)$/);
    const leaf = { code: m ? m[1] : "", name: m ? m[2] : raw, value };

    const catName = String(kategori).trim();
    if (!byName.has(catName)) {
      const cat = { name: catName, children: [] };
      byName.set(catName, cat);
      cats.push(cat);
    }
    byName.get(catName).children.push(leaf);
  });

  if (!cats.length) {
    throw new Error("Data kosong.");
  }

  const sum = (arr) => arr.reduce((s, d) => s + d.value, 0);
  const catTotals = {};
  cats.forEach((c) => {
    catTotals[c.name] = sum(c.children);
  });
  const total = sum(Object.values(catTotals).map((value) => ({ value })));

  const allLeaves = cats.flatMap((c) => c.children);
  const primerLeaves = (byName.get("Primer") || cats[0]).children;
  const tambang =
    allLeaves.find((d) => /^pertambangan/i.test(d.name)) ||
    [...primerLeaves].sort((a, b) => b.value - a.value)[0];
  tambang.isTambang = true;

  return {
    root: { name: "PDRB Mimika", children: cats },
    total,
    catTotals,
    leafCount: allLeaves.length,
    tambang,
    primerLeaves,
  };
}

function buildCards(model) {
  const { total, catTotals, leafCount, tambang } = model;
  const pctOfTotal = (v) => pctFmt((v / total) * 100);
  const primer = catTotals.Primer || 0;
  const others = Object.keys(catTotals).filter((n) => n !== "Primer");
  const pertanian = model.primerLeaves.find((d) => d !== tambang);

  return [
    {
      key: "overview",
      eyebrow: "Gambaran Umum",
      title: `${numberFmt(total)} miliar Rp`,
      body: `Diagram sunburst menyajikan struktur hierarki PDRB Kabupaten Mimika secara proporsional dengan menempatkan 3 kelompok sektor utama (Primer, Sekunder, Tersier) di lingkaran dalam dan menjabarkannya ke dalam 17 lapangan usaha di lingkaran luar. Visualisasi ini memperlihatkan bentuk ekonomi yang sangat terpusat, di mana lingkaran sektor Primer menguasai hampir seluruh ruang secara mutlak, sedangkan sektor Sekunder dan Tersier hanya mendominasi porsi yang sangat kecil di sudut lingkaran, mencerminkan ciri khas daerah kaya sumber daya alam.`,
    },
    {
      key: "primer",
      eyebrow: "Sektor Primer",
      title: `${pctOfTotal(primer)} dari PDRB`,
      body: `Di dalam kelompok Sektor Primer secara keseluruhan, kontributor utamanya mencatatkan angka besar yang menggerakkan hampir seluruh roda perekonomian makro kabupaten. Besarnya porsi sektor primer ini menegaskan bahwa fondasi utama pdrb di Mimika sangat bertumpu pada kekayaan alam bumi, yang sekaligus menjadikan struktur ekonomi regionalnya sangat rentan terhadap guncangan eksternal apabila sektor ini mengalami perlambatan pertumbuhan.`,
    },
    {
      key: "pertambangan",
      eyebrow: tambang.name,
      title: `${numberFmt(tambang.value)} miliar Rp`,
      body: `Jika dikerucutkan ke dalam sub-kategori spesifik, sektor primer di Mimika sepenuhnya disokong oleh sub-kategori B (Pertambangan dan Penggalian) yang bernilai sangat tinggi, sementara sub-kategori pertanian dan perikanan berada pada skala yang jauh di bawahnya. Hal ini membuktikan bahwa aktivitas penambangan skala besar menjadi satu-satunya mesin penggerak utama yang mendefinisikan angka PDRB per kapita tinggi sekaligus memicu anomali pertumbuhan negatif di wilayah tersebut.`,
    },
  ];
}

const CARD_COUNT = 3;
const NEUTRAL_DURATION = 0.5;
const CARD_DURATION = 3.0;
const CARD_STAGGER = 1.1;
const TRAVEL_VH = 120;
const TOTAL_UNITS =
  NEUTRAL_DURATION + (CARD_COUNT - 1) * CARD_STAGGER + CARD_DURATION;
const LEAVE_MARGIN = 0.3;

const SMOOTHING_MS = 280;

const sceneStart = (i) => NEUTRAL_DURATION + i * CARD_STAGGER;

function cardOffsetVh(raw, i) {
  const t = (raw - sceneStart(i)) / CARD_DURATION;
  const clamped = Math.min(1, Math.max(0, t));
  return TRAVEL_VH - 2 * TRAVEL_VH * clamped;
}

export default function SunburstSection() {
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const vizRef = useRef(null);
  const svgSelectionRef = useRef(null);
  const cardRefs = useRef([]);
  const filterRef = useRef([]);
  const sweepRef = useRef(0);
  const targetRef = useRef(0);
  const visibleRef = useRef(false);
  const completeRef = useRef(false);
  const controlRef = useRef(null);
  const tipRef = useRef(null);
  const tipKickerRef = useRef(null);
  const tipTitleRef = useRef(null);
  const tipDetailRef = useRef(null);

  const [isComplete, setIsComplete] = useState(false);
  const [selCats, setSelCats] = useState([]);

  const model = useMemo(() => buildModel(RAW_ROWS), []);
  const cards = useMemo(() => buildCards(model), [model]);

  const showTip = (event, kicker, title, detail) => {
    const tip = tipRef.current;
    const box = stickyRef.current;
    if (!tip || !box) return;
    tipKickerRef.current.textContent = kicker;
    tipTitleRef.current.textContent = title;
    tipDetailRef.current.textContent = detail;
    tip.style.opacity = "1";

    const r = box.getBoundingClientRect();
    const px = event.clientX - r.left;
    const py = event.clientY - r.top;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = px + 14;
    let y = py + 14;
    if (x + w > r.width - 8) x = px - w - 14;
    if (y + h > r.height - 8) y = py - h - 14;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  };
  const hideTip = () => {
    if (tipRef.current) tipRef.current.style.opacity = "0";
  };

  useEffect(() => {
    if (!model) return undefined;
    const el = vizRef.current;
    if (!el) return undefined;

    let animateTo = null;

    const sync = () => {
      const t = visibleRef.current && !completeRef.current ? FULL : 0;
      if (t === targetRef.current) return;
      targetRef.current = t;
      if (animateTo) animateTo(t);
    };
    controlRef.current = { sync };

    const draw = () => {
      el.innerHTML = "";
      animateTo = null;
      const width = el.clientWidth || 700;
      const height = el.clientHeight || 560;
      if (width === 0 || height === 0) return;

      const isNarrow = width < 640;
      const R = Math.max(80, Math.min(width, height) / 2 - 8);
      const rHoleIn = R * 0.26;
      const rInnerOut = R * 0.58;
      const rOuterIn = R * 0.62;
      const rOuterOut = R;

      const root = d3.hierarchy(model.root).sum((d) => d.value);
      d3.partition().size([2 * Math.PI, 1])(root);
      const leaves = root.leaves();

      const baseColor = (cat, idx) =>
        CATEGORY_COLORS[cat] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      const innerColor = (d) =>
        d3
          .color(baseColor(d.data.name, root.children.indexOf(d)))
          .darker(0.35)
          .formatHex();
      const outerColor = (d) => {
        const cat = d.parent;
        const idx = cat.children.indexOf(d);
        return d3.interpolateRgb(
          baseColor(cat.data.name, root.children.indexOf(cat)),
          "#ffffff",
        )(TINTS[idx % TINTS.length]);
      };

      let sweep = sweepRef.current;
      const arc = d3
        .arc()
        .startAngle((d) => d.x0)
        .endAngle((d) => Math.max(d.x0, Math.min(d.x1, sweep)))
        .innerRadius((d) => (d.depth === 1 ? rHoleIn : rOuterIn))
        .outerRadius((d) => (d.depth === 1 ? rInnerOut : rOuterOut));

      const arcPath = (d) => (sweep > d.x0 ? arc(d) : null);

      const svg = d3
        .select(el)
        .append("svg")
        .attr("width", width)
        .attr("height", height);
      svgSelectionRef.current = svg;
      const g = svg
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

      const totalValue = root.value;
      const detailFor = (v) =>
        `${numberFmt(v)} miliar Rp · ${pctFmt((v / totalValue) * 100)} dari PDRB`;

      g.selectAll("path.inner")
        .data(root.children)
        .join("path")
        .attr("class", "inner")
        .attr("opacity", 1)
        .attr("d", arcPath)
        .attr("fill", innerColor)
        .attr("stroke", STROKE)
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("pointerenter pointermove", (event, d) =>
          showTip(event, "Kategori", d.data.name, detailFor(d.value)),
        )
        .on("pointerleave", hideTip);

      g.selectAll("path.outer")
        .data(leaves)
        .join("path")
        .attr("class", "outer")
        .attr("opacity", 1)
        .attr("d", arcPath)
        .attr("fill", outerColor)
        .attr("stroke", STROKE)
        .attr("stroke-width", 0.75)
        .style("cursor", "pointer")
        .on("pointerenter", function enter(event, d) {
          d3.select(this).raise().attr("stroke-width", 2.25);
          const name = d.data.code
            ? `${d.data.code} — ${d.data.name}`
            : d.data.name;
          showTip(event, d.parent.data.name, name, detailFor(d.value));
        })
        .on("pointermove", (event, d) => {
          const name = d.data.code
            ? `${d.data.code} — ${d.data.name}`
            : d.data.name;
          showTip(event, d.parent.data.name, name, detailFor(d.value));
        })
        .on("pointerleave", function leave() {
          d3.select(this).attr("stroke-width", 0.75);
          hideTip();
        });

      const allPaths = g.selectAll("path.inner, path.outer");

      const labelsG = g
        .append("g")
        .attr("class", "labels")
        .attr("pointer-events", "none")
        .attr("opacity", labelOpacity(sweep));

      const innerMidR = (rHoleIn + rInnerOut) / 2;
      const fs = isNarrow ? 10 : 13;
      labelsG
        .selectAll("g.inner-label")
        .data(root.children)
        .join("g")
        .attr("class", "inner-label")
        .attr("opacity", 1)
        .each(function innerLabel(d) {
          const sel = d3.select(this);
          const theta = (d.x0 + d.x1) / 2;
          const deg = (theta * 180) / Math.PI;
          const arcWidth = (d.x1 - d.x0) * innerMidR;
          const textColor = getContrastText(innerColor(d));
          const name = d.data.name;

          if (arcWidth >= name.length * 0.62 * fs + 10) {
            sel
              .append("text")
              .attr("x", innerMidR * Math.sin(theta))
              .attr("y", -innerMidR * Math.cos(theta))
              .attr("dy", "0.35em")
              .attr("text-anchor", "middle")
              .attr("fill", textColor)
              .style("font-size", `${fs}px`)
              .style("font-weight", 700)
              .text(name);
            return;
          }

          const fsR = Math.max(6.5, Math.min(fs, arcWidth - 2));
          sel
            .append("text")
            .attr(
              "transform",
              `rotate(${deg - 90}) translate(${innerMidR},0) rotate(${deg < 180 ? 0 : 180})`,
            )
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", textColor)
            .style("font-size", `${fsR}px`)
            .style("font-weight", 700)
            .text(name);
        });

      const render = () => {
        allPaths.attr("d", arcPath);
        labelsG.attr("opacity", labelOpacity(sweep));
      };
      animateTo = (to) => {
        const from = sweep;
        const forward = to > from;
        const duration =
          (Math.abs(to - from) / FULL) * (forward ? SWEEP_IN_MS : SWEEP_OUT_MS);
        g.transition("sweep")
          .duration(duration)
          .ease(forward ? d3.easeCubicInOut : d3.easeCubicIn)
          .tween("sweep", () => {
            const interp = d3.interpolateNumber(from, to);
            return (t) => {
              sweep = interp(t);
              sweepRef.current = sweep;
              render();
            };
          });
      };

      applyFilter(filterRef.current, 0);
      if (Math.abs(sweep - targetRef.current) > 1e-6)
        animateTo(targetRef.current);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    draw();
    window.addEventListener("resize", draw);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", draw);
      controlRef.current = null;
      el.innerHTML = "";
    };
  }, [model]);

  function applyFilter(sel, duration = 400) {
    const svg = svgSelectionRef.current;
    if (!svg) return;
    const visible = (name) => sel.length === 0 || sel.includes(name);
    const fade = (selection, nameOf) => {
      selection.style("pointer-events", (d) =>
        visible(nameOf(d)) ? null : "none",
      );
      const target = duration
        ? selection.transition().duration(duration)
        : selection;
      target.attr("opacity", (d) => (visible(nameOf(d)) ? 1 : 0));
    };
    fade(svg.selectAll("path.inner"), (d) => d.data.name);
    fade(svg.selectAll("g.inner-label"), (d) => d.data.name);
    fade(svg.selectAll("path.outer"), (d) => d.parent.data.name);
  }

  useEffect(() => {
    completeRef.current = isComplete;
    if (controlRef.current) controlRef.current.sync();
  }, [isComplete]);

  useEffect(() => {
    filterRef.current = selCats;
    applyFilter(selCats);
  }, [selCats]);

  const toggleCat = (name) =>
    setSelCats((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name],
    );

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

      for (let i = 0; i < CARD_COUNT; i += 1) {
        const card = cardRefs.current[i];
        if (card) {
          card.style.transform = `translate(-50%, calc(-50% + ${cardOffsetVh(raw, i)}vh))`;
        }
      }

      const nextComplete = raw >= TOTAL_UNITS - LEAVE_MARGIN;
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
    <section id="sunburst" className="relative bg-[#f4f0e7]">
      <div
        ref={wrapperRef}
        className="relative"
        style={{ height: `${TOTAL_UNITS * 100}vh` }}
      >
        <div
          ref={stickyRef}
          className="sticky top-0 flex h-screen flex-col overflow-hidden bg-[#f4f0e7]"
        >
          {
}
          <div className="max-w-story mx-auto flex shrink-0 flex-col gap-1 px-6 pb-1 pt-5 md:pt-7">
            <h2
              className="story-heading text-[#d74534]"
              style={{
                fontSize: "clamp(1.25rem, 2.3vw, 1.9rem)",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Membedah Struktur Ekonomi Mimika
            </h2>
            <p
              className="story-lede text-[#2a3f61]"
              style={{
                fontSize: "clamp(0.78rem, 1.05vw, 0.95rem)",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Menelusuri lebih dalam 17 lapangan usaha di Mimika. Perjalanan
              hierarkis dari kelompok primer, sekunder, hingga tersier untuk
              menemukan sektor tunggal yang menjadi penopang utama daerah.
            </p>
          </div>

          {}
          <div className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-6 pb-1 pt-1">
            <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5c564c]">
              Sektor
            </span>
            {Object.keys(model.catTotals).map((name, i) => (
              <button
                key={name}
                type="button"
                aria-pressed={selCats.includes(name)}
                onClick={() => toggleCat(name)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  selCats.includes(name)
                    ? "border-[#2b2b2b] bg-[#2b2b2b] text-white"
                    : "border-[#2b2b2b]/40 bg-white/70 text-[#2b2b2b] hover:bg-white"
                }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm border"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[name] ||
                      FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                    borderColor: selCats.includes(name) ? "#fff" : "#2b2b2b",
                  }}
                />
                {name}
              </button>
            ))}
            {selCats.length > 0 && (
              <button
                type="button"
                onClick={() => setSelCats([])}
                className="ml-1 text-xs text-[#5c564c] underline underline-offset-2 hover:text-[#2b2b2b]"
              >
                Setel ulang
              </button>
            )}
          </div>

          <div ref={vizRef} className="relative mx-6 min-h-0 flex-1 md:mx-12" />

          {}
          <div className="pointer-events-none flex shrink-0 flex-col items-center gap-0.5 px-6 pb-3 pt-1">
            <p className="text-[11px] text-[#5c564c]">Sumber data: {SOURCE}</p>
           
          </div>

          {}
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 z-20 max-w-[280px] rounded-lg bg-white/95 px-3 py-2 shadow-lg opacity-0"
            style={{ willChange: "transform" }}
          >
            <p
              ref={tipKickerRef}
              className="text-[10px] uppercase tracking-[0.15em] text-[#0072B2] font-semibold"
            />
            <p
              ref={tipTitleRef}
              className="text-sm font-bold text-[#2b2b2b] leading-snug"
            />
            <p ref={tipDetailRef} className="text-xs text-[#5c564c] mt-0.5" />
          </div>

          {

}
          {cards.map((card, i) => (
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
              <p className="story-lede  text-xs uppercase tracking-[0.15em] text-[#0072B2] font-semibold mb-1">
                {card.eyebrow}
              </p>
              <h3 className="story-lede  text-lg font-bold text-[#2b2b2b] mb-2">
                {card.title}
              </h3>
              <p className="story-lede  text-sm text-[#5c564c] leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
