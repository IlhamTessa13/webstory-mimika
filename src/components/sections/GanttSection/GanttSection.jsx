import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const UNIT = "US$";
const YEAR = 2025;
const SOURCE = "Badan Pusat Statistik";
const RAW_ROWS = [
  ["Bulgaria", "Maret", 38884922.04],
  ["China", "Maret", 414553801.19],
  ["China", "April", 531492830.4],
  ["China", "Mei", 344385700.69],
  ["China", "Juni", 436453937.44],
  ["China", "Juli", 215174700.99],
  ["China", "Agustus", 616183268.73],
  ["China", "September", 334732692.71],
  ["China", "November", 108282763.44],
  ["China", "Desember", 36025340.93],
  ["Jerman", "Maret", 38884922.04],
  ["Jerman", "April", 77126380.52],
  ["Jerman", "Juni", 345.25],
  ["Jerman", "Juli", 34443680.26],
  ["India", "Maret", 39731364.55],
  ["India", "Mei", 76045978.37],
  ["India", "Juni", 39448186.32],
  ["India", "Agustus", 36338781.86],
  ["India", "September", 140663584.06],
  ["India", "Desember", 62484593.03],
  ["Jepang", "April", 188906446.92],
  ["Jepang", "Mei", 36141998.58],
  ["Jepang", "Juni", 106799545.19],
  ["Jepang", "Juli", 64696687.79],
  ["Jepang", "Agustus", 175796103.42],
  ["Jepang", "September", 68932055.54],
  ["Jepang", "November", 60402648.34],
  ["Jepang", "Desember", 54061939.72],
  ["Korea Selatan", "Maret", 40875178.79],
  ["Korea Selatan", "Mei", 111421293],
  ["Korea Selatan", "Juni", 71344969.82],
  ["Korea Selatan", "September", 34703210.38],
  ["Korea Selatan", "Desember", 194261452.69],
  ["Taiwan", "Juli", 36987917.7],
];

const COUNTRY_LABEL = { China: "Tiongkok", German: "Jerman" };

const MONTHS = [
  ["Januari", "Jan"],
  ["Februari", "Feb"],
  ["Maret", "Mar"],
  ["April", "Apr"],
  ["Mei", "Mei"],
  ["Juni", "Jun"],
  ["Juli", "Jul"],
  ["Agustus", "Agu"],
  ["September", "Sep"],
  ["Oktober", "Okt"],
  ["November", "Nov"],
  ["Desember", "Des"],
];
const MONTH_INDEX = Object.fromEntries(MONTHS.map(([full], i) => [full, i]));

const colorRamp = (t) => d3.interpolateYlGnBu(0.18 + 0.82 * t);

const INK = "#2b2b2b";
const SWEEP_IN_MS = 1800;
const SWEEP_OUT_MS = 1000;
const CLIP_ID = "gantt-reveal-clip";

const pctFmt = (pct) => {
  if (pct < 0.1) return "<0,1%";
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
};
const moneyFmt = (v) => {
  if (v >= 1e9)
    return `${UNIT} ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} miliar`;
  if (v >= 1e6)
    return `${UNIT} ${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} juta`;
  return `${UNIT} ${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
};

function buildModel(rows) {
  const entries = [];
  rows.forEach(([negara, bulan, nilai]) => {
    const m = MONTH_INDEX[String(bulan).trim()];
    const value = Number(nilai);
    if (negara && m !== undefined && Number.isFinite(value) && value > 0)
      entries.push({ negara, m, value });
  });

  const byCountry = new Map();
  entries.forEach((e) => {
    if (!byCountry.has(e.negara)) byCountry.set(e.negara, []);
    byCountry.get(e.negara).push(e);
  });
  const countries = [...byCountry.entries()]
    .map(([name, list]) => ({
      key: name,
      label: COUNTRY_LABEL[name] || name,
      total: d3.sum(list, (e) => e.value),
      activeMonths: list.length,
      entries: list,
    }))
    .sort((a, b) => b.total - a.total);

  const total = d3.sum(entries, (e) => e.value);
  const maxValue = d3.max(entries, (e) => e.value);
  const monthTotals = MONTHS.map((_, i) =>
    d3.sum(
      entries.filter((e) => e.m === i),
      (e) => e.value,
    ),
  );
  return { entries, countries, total, maxValue, monthTotals };
}

function buildCards(model) {
  const { countries, total, monthTotals } = model;
  const pct = (v, t = total) => pctFmt((v / t) * 100);

  const activeMonthCount = monthTotals.filter((v) => v > 0).length;
  const missing = MONTHS.map(([full], i) => (monthTotals[i] > 0 ? null : full))
    .filter(Boolean)
    .join(", ");

  const byConsistency = [...countries].sort(
    (a, b) => b.activeMonths - a.activeMonths || b.total - a.total,
  );
  const most = byConsistency[0];
  const runnerUp = byConsistency[1];
  const least = [...countries].sort(
    (a, b) => a.activeMonths - b.activeMonths || a.total - b.total,
  )[0];

  const peakIdx = monthTotals.indexOf(d3.max(monthTotals));
  const peakTotal = monthTotals[peakIdx];
  const peakTop = [...countries]
    .map((c) => ({
      label: c.label,
      v: d3.sum(
        c.entries.filter((e) => e.m === peakIdx),
        (e) => e.value,
      ),
    }))
    .sort((a, b) => b.v - a.v)[0];

  return [
    {
      key: "overview",
      eyebrow: `Gambaran Umum ${YEAR}`,
      title: moneyFmt(total),
      body: `Gantt chart menyajikan jadwal dan frekuensi pengiriman bulanan komoditas konsentrat tembaga sepanjang tahun 2025 ke berbagai negara tujuan. Visualisasi ini memperlihatkan dinamika pengapalan yang berlangsung secara periodik, di mana aktivitas ekspor tidak terdistribusi merata di setiap bulan, melainkan mengikuti pola siklus logistik dan ketersediaan muatan kapal ekspor.`,
    },
    {
      key: "consistency",
      eyebrow: "Paling Konsisten",
      title: `${most.label}: ${most.activeMonths} bulan`,
      body: `Tiongkok tercatat sebagai negara tujuan yang paling konsisten menerima pengiriman hampir di sebagian besar bulan aktif sepanjang tahun 2025. Pola balok linimasa untuk Tiongkok tampak paling berulang dan stabil dari bulan ke bulan dibandingkan negara tujuan lainnya, mencerminkan keterikatan ekspor jangka panjang yang terstruktur secara rutin.
`,
    },
    {
      key: "peak",
      eyebrow: "Bulan Puncak",
      title: `${MONTHS[peakIdx][0]} ${YEAR}`,
      body: `Berdasarkan intensitas warna dan skala besaran nilai, bulan Agustus menonjol sebagai periode dengan nilai pengiriman ekspor terbesar sepanjang tahun 2025 (ditandai dengan warna balok paling pekat/gelap, mencapai US$ 616,2 juta pada salah satu puncak pengirimannya). Lonjakan di bulan Agustus ini mengindikasikan adanya akumulasi volume produksi atau jadwal pemberangkatan armada kapal pengangkut skala besar yang mendongkrak nilai ekspor secara signifikan pada pertengahan tahun.`,
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

function MonthSelect({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[#2b2b2b]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5c564c]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-[#2b2b2b]/40 bg-white/80 px-2 py-0.5 text-xs text-[#2b2b2b] focus:outline-none focus:ring-2 focus:ring-[#0072B2]"
      >
        {MONTHS.map(([full], i) => (
          <option key={full} value={i}>
            {full}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function GanttSection() {
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
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(11);

  const model = useMemo(() => buildModel(RAW_ROWS), []);
  const cards = useMemo(() => buildCards(model), [model]);

  const periodActive = from !== 0 || to !== 11;
  const inRangeCount = useMemo(
    () => model.entries.filter((e) => e.m >= from && e.m <= to).length,
    [model, from, to],
  );

  const changeFrom = (v) => {
    setFrom(v);
    if (v > to) setTo(v);
  };
  const changeTo = (v) => {
    setTo(v);
    if (v < from) setFrom(v);
  };

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
      const width = el.clientWidth || 700;
      const height = el.clientHeight || 420;
      if (width === 0 || height === 0) return;

      const narrow = width < 640;
      const fs = narrow ? 10.5 : 13;
      const mL = narrow ? 82 : 118;
      const mR = 8;
      const mT = 30;
      const mB = 6;

      const monthIdx = d3.range(from, to + 1);
      const x = d3
        .scaleBand()
        .domain(monthIdx)
        .range([mL, width - mR])
        .paddingInner(0);
      const y = d3
        .scaleBand()
        .domain(model.countries.map((c) => c.key))
        .range([mT, height - mB])
        .paddingInner(0.2)
        .paddingOuter(0.1);

      const colorOf = (v) => colorRamp(Math.sqrt(v / model.maxValue));
      const barMaxH = Math.min(y.bandwidth(), 38);
      const heightOf = (v) =>
        barMaxH * (0.4 + 0.6 * Math.sqrt(v / model.maxValue));

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

      const showFull = x.bandwidth() > 64;
      const showShort = x.bandwidth() > 24;
      const axis = g.append("g");
      monthIdx.forEach((m, i) => {
        if (i % 2 === 0) {
          axis
            .append("rect")
            .attr("x", x(m))
            .attr("y", mT)
            .attr("width", x.bandwidth())
            .attr("height", height - mT - mB)
            .attr("fill", "rgba(43,43,43,0.04)");
        }
        axis
          .append("text")
          .attr("x", x(m) + x.bandwidth() / 2)
          .attr("y", mT - 10)
          .attr("text-anchor", "middle")
          .attr("fill", "#5c564c")
          .style("font-size", `${narrow ? 10 : 11.5}px`)
          .style("font-weight", 600)
          .text(
            showFull
              ? MONTHS[m][0]
              : showShort
                ? MONTHS[m][1]
                : MONTHS[m][0][0],
          );
      });

      let trackSel;
      let barSel;
      let labelSel;
      const focus = (key) => {
        barSel.attr("opacity", (d) => (d.negara === key ? 1 : 0.18));
        labelSel.attr("opacity", (d) => (d.key === key ? 1 : 0.3));
        trackSel.attr("opacity", (d) => (d.key === key ? 1 : 0.35));
      };
      const clear = () => {
        barSel.attr("opacity", 1);
        labelSel.attr("opacity", 1);
        trackSel.attr("opacity", 1);
      };

      const yearTotalPct = (v) => pctFmt((v / model.total) * 100);

      trackSel = g
        .append("g")
        .selectAll("rect.track")
        .data(model.countries)
        .join("rect")
        .attr("class", "track")
        .attr("x", mL)
        .attr("y", (d) => y(d.key))
        .attr("width", width - mL - mR)
        .attr("height", y.bandwidth())
        .attr("rx", 5)
        .attr("fill", "rgba(43,43,43,0.06)")
        .style("cursor", "pointer")
        .on("pointerenter pointermove", (event, d) => {
          focus(d.key);
          showTip(
            event,
            `Total ${YEAR}`,
            d.label,
            `${moneyFmt(d.total)} · ${yearTotalPct(d.total)} dari total ekspor · ${d.activeMonths} bulan`,
          );
        })
        .on("pointerleave", () => {
          clear();
          hideTip();
        });

      labelSel = g
        .append("g")
        .attr("pointer-events", "none")
        .selectAll("text.country")
        .data(model.countries)
        .join("text")
        .attr("class", "country")
        .attr("x", mL - 10)
        .attr("y", (d) => y(d.key) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("fill", INK)
        .style("font-size", `${fs}px`)
        .style("font-weight", 700)
        .text((d) => d.label);

      const barData = model.entries.filter((e) => e.m >= from && e.m <= to);
      barSel = g
        .append("g")
        .selectAll("rect.bar")
        .data(barData)
        .join("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.m) + 0.5)
        .attr("width", Math.max(1, x.bandwidth() - 1))
        .attr("y", (d) => y(d.negara) + (y.bandwidth() - heightOf(d.value)) / 2)
        .attr("height", (d) => heightOf(d.value))
        .attr("rx", 2)
        .attr("fill", (d) => colorOf(d.value))
        .attr("stroke", INK)
        .attr("stroke-width", 0.75)
        .style("cursor", "pointer")
        .on("pointerenter pointermove", (event, d) => {
          focus(d.negara);
          const c = model.countries.find((k) => k.key === d.negara);
          showTip(
            event,
            `${c.label} · ${MONTHS[d.m][0]} ${YEAR}`,
            moneyFmt(d.value),
            `${yearTotalPct(d.value)} dari total ekspor ${YEAR} · ${pctFmt(
              (d.value / c.total) * 100,
            )} dari ekspor tahunan ${c.label}`,
          );
        })
        .on("pointerleave", () => {
          clear();
          hideTip();
        });

      if (barData.length === 0) {
        g.append("text")
          .attr("x", (mL + width - mR) / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#5c564c")
          .style("font-size", `${fs}px`)
          .text("Tidak ada ekspor tercatat pada periode ini.");
      }

      const render = () => {
        clipRect.attr("width", sweep * width);
      };
      animateTo = (target) => {
        const start = sweep;
        const forward = target > start;
        const duration =
          Math.abs(target - start) * (forward ? SWEEP_IN_MS : SWEEP_OUT_MS);
        g.transition("sweep")
          .duration(duration)
          .ease(forward ? d3.easeCubicInOut : d3.easeCubicIn)
          .tween("sweep", () => {
            const interp = d3.interpolateNumber(start, target);
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
  }, [model, from, to]);

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

  const gradient = useMemo(
    () =>
      `linear-gradient(to right, ${d3
        .range(0, 1.01, 0.1)
        .map((t) => colorRamp(t))
        .join(", ")})`,
    [],
  );

  return (
    <section id="gantt" className="relative bg-[#f4f0e7]">
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
              Kalender Ekspor Mimika: Kapan dan Ke Mana Hasil Tambang Mimika
              Berlayar pada tahun 2025?
            </h2>
            <p
              className="story-lede text-[#2a3f61]"
              style={{
                fontSize: "clamp(0.78rem, 1.05vw, 0.95rem)",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Membedah linimasa bulanan pengiriman Copper ores and concentrates
              / HS 26030000 sepanjang tahun 2025 ke masing-masing negara mitra
              dagang.
            </p>
          </div>

          {}
          <div className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-6 pb-1 pt-1">
            <MonthSelect label="Dari" value={from} onChange={changeFrom} />
            <MonthSelect label="Sampai" value={to} onChange={changeTo} />
            {periodActive && (
              <button
                type="button"
                onClick={() => {
                  setFrom(0);
                  setTo(11);
                }}
                className="text-xs text-[#5c564c] underline underline-offset-2 hover:text-[#2b2b2b]"
              >
                Setel ulang
              </button>
            )}
            <span className="text-[11px] text-[#8b8577]">
              {inRangeCount} catatan ekspor pada periode ini
            </span>
          </div>

          <div ref={vizRef} className="relative mx-6 min-h-0 flex-1 md:mx-12" />

          {}
          <div className="pointer-events-none flex shrink-0 flex-col items-center gap-1 px-6 pb-3 pt-2">
            <div className="flex items-center gap-2 text-[11px] text-[#5c564c]">
              <span>Nilai ekspor per bulan: rendah</span>
              <span
                className="inline-block h-2.5 w-28 rounded-sm border border-[#2b2b2b]/60"
                style={{ background: gradient }}
              />
              <span>tinggi ({moneyFmt(model.maxValue)})</span>
            </div>
            <p className="text-[11px] text-[#5c564c]">Sumber data: {SOURCE}</p>

          </div>

          {}
          <div
            ref={tipRef}
            className="pointer-events-none absolute left-0 top-0 z-20 max-w-[300px] rounded-lg bg-white/95 px-3 py-2 opacity-0 shadow-lg"
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

          {}
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
              <p className="story-lede mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#0072B2]">
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
