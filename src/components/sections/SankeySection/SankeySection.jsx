import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";

const UNIT = "US$";
const SOURCE = "Badan Pusat Statistik";
const RAW_ROWS = [
  ["Bulgaria", "AMAMAPARE", 38884922.04],
  ["China", "AMAMAPARE", 2558244239.44],
  ["China", "AMAMAPARE IJ", 334732692.71],
  ["China", "BENETE", 144308104.37],
  ["German", "AMAMAPARE", 150455328.07],
  ["India", "AMAMAPARE", 191564311.1],
  ["India", "AMAMAPARE IJ", 140663584.06],
  ["India", "BENETE", 62484593.03],
  ["Jepang", "AMAMAPARE", 572340781.9],
  ["Jepang", "AMAMAPARE IJ", 68932055.54],
  ["Jepang", "BENETE", 114464588.06],
  ["Korea Selatan", "AMAMAPARE", 223641441.61],
  ["Korea Selatan", "AMAMAPARE IJ", 34703210.38],
  ["Korea Selatan", "BENETE", 194261452.69],
  ["Taiwan", "AMAMAPARE", 36987917.7],
];

const COUNTRY_LABEL = { China: "Tiongkok", German: "Jerman" };
const PORT_LABEL = {
  AMAMAPARE: "Amamapare",
  "AMAMAPARE IJ": "Amamapare IJ",
  BENETE: "Benete",
};

const PORT_COLORS = {
  AMAMAPARE: "#0072B2",
  "AMAMAPARE IJ": "#E69F00",
  BENETE: "#009E73",
};
const FALLBACK_COLORS = ["#CC79A7", "#56B4E9", "#D55E00", "#999999"];
const ORIGIN_COLOR = "#2b2b2b";
const COUNTRY_COLOR = "#6b6459";

const INK = "#2b2b2b";
const SWEEP_IN_MS = 1800;
const SWEEP_OUT_MS = 1000;
const CLIP_ID = "sankey-reveal-clip";

const pctFmt = (pct) => {
  if (pct < 0.1) return "<0,1%";
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
};

const moneyFmt = (v) => {
  if (v >= 1e9)
    return `${UNIT} ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} miliar`;
  return `${UNIT} ${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} juta`;
};

function buildModel(rows) {
  const valid = [];
  rows.forEach(([negara, pelabuhan, nilai]) => {
    const value = Number(nilai);
    if (negara && pelabuhan && Number.isFinite(value) && value > 0)
      valid.push({ negara, pelabuhan, value });
  });
  if (!valid.length) return null;

  const sumBy = (key) => {
    const m = new Map();
    valid.forEach((r) => m.set(r[key], (m.get(r[key]) || 0) + r.value));
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  const ports = sumBy("pelabuhan").map((p, i) => ({
    ...p,
    label: PORT_LABEL[p.name] || p.name,
    color: PORT_COLORS[p.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));
  const countries = sumBy("negara").map((c) => ({
    ...c,
    label: COUNTRY_LABEL[c.name] || c.name,
  }));
  const total = valid.reduce((s, r) => s + r.value, 0);

  const nodes = [
    { key: "origin", kind: "origin", label: "Mimika", color: ORIGIN_COLOR },
    ...ports.map((p) => ({
      key: `p:${p.name}`,
      kind: "port",
      label: p.label,
      color: p.color,
    })),
    ...countries.map((c) => ({
      key: `c:${c.name}`,
      kind: "country",
      label: c.label,
      color: COUNTRY_COLOR,
    })),
  ];
  const idx = new Map(nodes.map((n, i) => [n.key, i]));
  const portColor = new Map(ports.map((p) => [p.name, p.color]));

  const links = [
    ...ports.map((p) => ({
      source: idx.get("origin"),
      target: idx.get(`p:${p.name}`),
      value: p.value,
      port: p.name,
      color: p.color,
    })),
    ...valid.map((r) => ({
      source: idx.get(`p:${r.pelabuhan}`),
      target: idx.get(`c:${r.negara}`),
      value: r.value,
      port: r.pelabuhan,
      color: portColor.get(r.pelabuhan),
    })),
  ];

  return { nodes, links, ports, countries, total };
}

function buildCards(model) {
  const { total, ports, countries } = model;
  const topPort = ports[0];
  const topCountry = countries[0];
  const second = countries[1];
  const otherPorts = ports.slice(1);
  const pct = (v) => pctFmt((v / total) * 100);

  return [
    {
      key: "overview",
      eyebrow: "Gambaran Umum",
      title: moneyFmt(total),
      body: `Diagram Sankey mengilustrasikan jaringan distribusi komoditas konsentrat tembaga (Copper ores and concentrates / HS 26030000) yang bersumber dari Kabupaten Mimika. Alur visual ini memperlihatkan bagaimana volume ekspor besar dari wilayah tambang dialirkan melalui jalur pelabuhan muat domestik sebelum akhirnya terdistribusi secara luas ke berbagai negara tujuan mitra dagang.`,
    },
    {
      key: "port",
      eyebrow: `Pelabuhan ${topPort.label}`,
      title: `${pct(topPort.value)} dari ekspor`,
      body: `Sebagian besar aliran ekspor terkonsentrasi melalui Pelabuhan Amamapare sebagai gerbang utama pelabuhan muat lokal di wilayah pesisir Mimika. Jalur pita aliran yang paling tebal keluar langsung dari Amamapare menuju pasar internasional menunjukkan bahwa pelabuhan ini menjadi tulang punggung pengiriman logistik luar negeri bagi komoditas tambang utama kabupaten Mimika.`,
    },
    {
      key: "country",
      eyebrow: topCountry.label,
      title: `${pct(topCountry.value)} dari ekspor`,
      body: `Dari berbagai negara tujuan yang terhubung di ujung alur, Tiongkok mendominasi sebagai penerima jalur ekspor terbesar dan terlebar dari Mimika. Besarnya volume pengiriman yang mengarah langsung ke Tiongkok menegaskan bahwa negara tersebut merupakan pasar strategis paling utama dalam menyerap hasil produksi konsentrat tembaga dari Mimika.`,
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

function Chip({ active, onClick, swatch, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        active
          ? "border-[#2b2b2b] bg-[#2b2b2b] text-white"
          : "border-[#2b2b2b]/40 bg-white/70 text-[#2b2b2b] hover:bg-white"
      }`}
    >
      {swatch && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm border"
          style={{
            backgroundColor: swatch,
            borderColor: active ? "#fff" : "#2b2b2b",
          }}
        />
      )}
      {children}
    </button>
  );
}

export default function SankeySection() {
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const vizRef = useRef(null);
  const cardRefs = useRef([]);
  const sweepRef = useRef(0);
  const targetRef = useRef(0);
  const visibleRef = useRef(false);
  const completeRef = useRef(false);
  const drawnRef = useRef(false);
  const controlRef = useRef(null);
  const tipRef = useRef(null);
  const tipKickerRef = useRef(null);
  const tipTitleRef = useRef(null);
  const tipDetailRef = useRef(null);

  const [isComplete, setIsComplete] = useState(false);
  const [selPorts, setSelPorts] = useState([]);
  const [selCountries, setSelCountries] = useState([]);

  const fullModel = useMemo(() => buildModel(RAW_ROWS), []);
  const cards = useMemo(() => buildCards(fullModel), [fullModel]);

  const model = useMemo(() => {
    const rows = RAW_ROWS.filter(
      ([negara, pelabuhan]) =>
        (selCountries.length === 0 || selCountries.includes(negara)) &&
        (selPorts.length === 0 || selPorts.includes(pelabuhan)),
    );
    return buildModel(rows);
  }, [selPorts, selCountries]);

  const toggle = (setter) => (value) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  const hasFilter = selPorts.length > 0 || selCountries.length > 0;

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
    const el = vizRef.current;
    if (!el) return undefined;

    let animateTo = null;

    const sync = () => {
      const t = visibleRef.current && !completeRef.current ? 1 : 0;
      if (t === targetRef.current) return;
      targetRef.current = t;
      if (animateTo) animateTo(t);
    };
    controlRef.current = { sync };

    const draw = () => {
      el.innerHTML = "";
      animateTo = null;
      if (!model) return;
      const width = el.clientWidth || 700;
      const height = el.clientHeight || 420;
      if (width === 0 || height === 0) return;

      const narrow = width < 640;
      const fs = narrow ? 10.5 : 13;
      const mL = narrow ? 54 : 92;
      const mR = narrow ? 78 : 128;
      const mT = 24;
      const mB = 6;

      const graph = sankey()
        .nodeWidth(narrow ? 12 : 18)
        .nodePadding(narrow ? 14 : 20)
        .extent([
          [mL, mT],
          [width - mR, height - mB],
        ])({
        nodes: model.nodes.map((d) => ({ ...d })),
        links: model.links.map((d) => ({ ...d })),
      });
      const { nodes, links } = graph;

      let sweep = sweepRef.current;

      const svg = d3
        .select(el)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      if (drawnRef.current && sweep > 0.99) {
        svg.style("opacity", 0).transition().duration(350).style("opacity", 1);
      }
      drawnRef.current = true;

      const clipRect = svg
        .append("defs")
        .append("clipPath")
        .attr("id", CLIP_ID)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", height)
        .attr("width", sweep * width);

      const g = svg.append("g").attr("clip-path", `url(#${CLIP_ID})`);

      const pctOf = (v) => pctFmt((v / fullModel.total) * 100);

      let linkSel;
      let nodeSel;
      let labelSel;
      const touches = (n, set) =>
        [...n.sourceLinks, ...n.targetLinks].some((l) => set.has(l));
      const focus = (set) => {
        linkSel.attr("opacity", (d) => (set.has(d) ? 0.9 : 0.08));
        nodeSel.attr("opacity", (d) => (touches(d, set) ? 1 : 0.25));
        labelSel.attr("opacity", (d) => (touches(d, set) ? 1 : 0.3));
      };
      const clear = () => {
        linkSel.attr("opacity", 0.6);
        nodeSel.attr("opacity", 1);
        labelSel.attr("opacity", 1);
      };

      linkSel = g
        .append("g")
        .attr("fill", "none")
        .selectAll("path.link")
        .data(links)
        .join("path")
        .attr("class", "link")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", (d) => d.color)
        .attr("stroke-width", (d) => Math.max(1.5, d.width))
        .attr("opacity", 0.6)
        .style("cursor", "pointer")
        .on("pointerenter pointermove", (event, d) => {
          focus(new Set([d]));
          showTip(
            event,
            "Aliran ekspor",
            `${d.source.label} → ${d.target.label}`,
            `${moneyFmt(d.value)} · ${pctOf(d.value)} dari total ekspor`,
          );
        })
        .on("pointerleave", () => {
          clear();
          hideTip();
        });

      const kindLabel = {
        origin: "Asal",
        port: "Pelabuhan",
        country: "Negara tujuan",
      };
      nodeSel = g
        .append("g")
        .selectAll("rect.node")
        .data(nodes)
        .join("rect")
        .attr("class", "node")
        .attr("x", (d) => d.x0)
        .attr("y", (d) => d.y0)
        .attr("width", (d) => d.x1 - d.x0)
        .attr("height", (d) => Math.max(1.5, d.y1 - d.y0))
        .attr("fill", (d) => d.color)
        .attr("stroke", INK)
        .attr("stroke-width", 0.75)
        .style("cursor", "pointer")
        .on("pointerenter pointermove", (event, d) => {
          const set = new Set(
            d.kind === "origin"
              ? links
              : d.kind === "country"
                ? d.targetLinks
                : [...d.sourceLinks, ...d.targetLinks],
          );
          focus(set);
          showTip(
            event,
            kindLabel[d.kind],
            d.label,
            `${moneyFmt(d.value)} · ${pctOf(d.value)} dari total ekspor`,
          );
        })
        .on("pointerleave", () => {
          clear();
          hideTip();
        });

      labelSel = g
        .append("g")
        .attr("pointer-events", "none")
        .selectAll("text.lbl")
        .data(nodes)
        .join("text")
        .attr("class", "lbl")
        .attr("x", (d) => {
          if (d.kind === "origin") return d.x0 - 8;
          if (d.kind === "country") return d.x1 + 8;
          return (d.x0 + d.x1) / 2;
        })
        .attr("y", (d) => (d.kind === "port" ? d.y0 - 8 : (d.y0 + d.y1) / 2))
        .attr("dy", (d) => (d.kind === "port" ? 0 : "0.35em"))
        .attr("text-anchor", (d) => {
          if (d.kind === "origin") return "end";
          if (d.kind === "country") return "start";
          return "middle";
        })
        .attr("fill", INK)
        .attr("stroke", "#f4f0e7")
        .attr("stroke-width", 3)
        .attr("paint-order", "stroke")
        .style("font-size", `${fs}px`)
        .style("font-weight", 700)
        .text((d) => d.label);

      const render = () => {
        clipRect.attr("width", sweep * width);
      };
      animateTo = (to) => {
        const from = sweep;
        const forward = to > from;
        const duration =
          Math.abs(to - from) * (forward ? SWEEP_IN_MS : SWEEP_OUT_MS);
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
  }, [model, fullModel]);

  useEffect(() => {
    completeRef.current = isComplete;
    if (controlRef.current) controlRef.current.sync();
  }, [isComplete]);

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
    <section id="sankey" className="relative bg-[#f4f0e7]">
      <div
        ref={wrapperRef}
        className="relative"
        style={{ height: `${TOTAL_UNITS * 100}vh` }}
      >
        <div
          ref={stickyRef}
          className="sticky top-0 flex h-screen flex-col overflow-hidden bg-[#f4f0e7]"
        >
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
              Dari Dalam Tambang Menembus Batas Negara
            </h2>
            <p
              className="story-lede text-[#2a3f61]"
              style={{
                fontSize: "clamp(0.78rem, 1.05vw, 0.95rem)",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Mengikuti alur perjalanan komoditas tambang (Copper ores and
              concentrates / HS 26030000) dari titik Mimika, melintasi
              pelabuhan, hingga berlabuh ke berbagai negara tujuan.
            </p>
          </div>

          {}
          <div className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-6 pb-1 pt-1">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5c564c]">
                Pelabuhan
              </span>
              {fullModel.ports.map((p) => (
                <Chip
                  key={p.name}
                  swatch={p.color}
                  active={selPorts.includes(p.name)}
                  onClick={() => toggle(setSelPorts)(p.name)}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5c564c]">
                Negara
              </span>
              {fullModel.countries.map((c) => (
                <Chip
                  key={c.name}
                  active={selCountries.includes(c.name)}
                  onClick={() => toggle(setSelCountries)(c.name)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelPorts([]);
                  setSelCountries([]);
                }}
                className="text-xs text-[#5c564c] underline underline-offset-2 hover:text-[#2b2b2b]"
              >
                Setel ulang
              </button>
            )}
          </div>

          <div className="relative mx-6 min-h-0 flex-1 md:mx-12">
            <div ref={vizRef} className="absolute inset-0" />
            {!model && (
              <div className="absolute inset-0 grid place-items-center text-center text-sm text-[#5c564c]">
                Tidak ada aliran ekspor untuk kombinasi pelabuhan dan negara
                ini.
              </div>
            )}
          </div>

          {}
          <div className="pointer-events-none flex shrink-0 flex-col items-center gap-0.5 px-6 pb-3 pt-1">
            <p className="text-[11px] text-[#5c564c]">Sumber data: {SOURCE}</p>

          </div>

          {}
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 z-20 max-w-[280px] rounded-lg bg-white/95 px-3 py-2 opacity-0 shadow-lg"
            style={{ willChange: "transform" }}
          >
            <p
              ref={tipKickerRef}
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0072B2]"
            />
            <p
              ref={tipTitleRef}
              className="text-sm font-bold leading-snug text-[#2b2b2b]"
            />
            <p ref={tipDetailRef} className="mt-0.5 text-xs text-[#5c564c]" />
          </div>

          {
}
          {cards.map((card, i) => (
            <div
              key={card.key}
              ref={(node) => {
                cardRefs.current[i] = node;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[90%] max-w-[420px] rounded-xl bg-white/95 p-5 shadow-lg"
              style={{
                transform: "translate(-50%, calc(-50% + 120vh))",
                willChange: "transform",
              }}
            >
              <p className="story-lede  mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#0072B2]">
                {card.eyebrow}
              </p>
              <h3 className="story-lede mb-2 text-lg font-bold text-[#2b2b2b]">
                {card.title}
              </h3>
              <p className="story-lede text-sm leading-relaxed text-[#5c564c]">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
