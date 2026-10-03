import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  KONFIGURASI                                                        */
/* ------------------------------------------------------------------ */

const BG = "#f4f0e7";
const INK = "#2b2a27";

const BASE = import.meta.env.BASE_URL; // aset ada di public/
const IMG = {
  water: `${BASE}water.webp`,
  stone: `${BASE}stone.webp`,
  start: `${BASE}start.webp`,
  finish: `${BASE}finish.webp`,
  ship: `${BASE}ship.webp`,
};

// S = start, F = finish, # = batu, . = air.
// Peta 7x7; sudah dicek ada jalur dari S ke F.
const MAP = [
  "...#..F",
  ".#...#.",
  "...#...",
  "#...##.",
  "..#....",
  ".#...#.",
  "S...#..",
];

const SIZE = MAP.length;
const CELL_PCT = 100 / SIZE;

const find = (ch) => {
  for (let r = 0; r < SIZE; r++) {
    const c = MAP[r].indexOf(ch);
    if (c !== -1) return { r, c };
  }
  return { r: 0, c: 0 };
};
const START = find("S");
const FINISH = find("F");

const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

const KEYMAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const pixel = { imageRendering: "pixelated" };

/* ------------------------------------------------------------------ */

export default function ShipGameSection({ onComplete }) {
  const sectionRef = useRef(null);
  const shipRef = useRef(null);
  const activeRef = useRef(false);
  const [pos, setPos] = useState(START);
  const [facing, setFacing] = useState(1); // 1 = kanan, -1 = kiri
  const [won, setWon] = useState(false);

  const bump = () => {
    shipRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  };

  const move = useCallback(
    (dir) => {
      if (won) return;
      const { dr, dc } = DIRS[dir];
      if (dc !== 0) setFacing(dc);
      const r = pos.r + dr;
      const c = pos.c + dc;
      const outside = r < 0 || c < 0 || r >= SIZE || c >= SIZE;
      if (outside || MAP[r][c] === "#") {
        bump();
        return;
      }
      setPos({ r, c });
      if (r === FINISH.r && c === FINISH.c) {
        setWon(true);
        setTimeout(() => onComplete?.(), 1300);
      }
    },
    [pos, won, onComplete],
  );

  const reset = () => {
    setPos(START);
    setFacing(1);
  };

  // Keyboard hanya aktif saat section game terlihat, supaya scroll
  // dengan panah di bagian lain halaman tidak terganggu.
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        activeRef.current = e.isIntersecting;
      },
      { threshold: 0.5 },
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const dir = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
      if (!dir || !activeRef.current) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  return (
    <section
      id="game"
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16"
      style={{ backgroundColor: BG, color: INK }}
    >
      <div className="max-w-xl text-center">
        <h2 className="story-heading m-0 text-[clamp(1.4rem,3.5vw,2rem)] font-bold">
          Bantu Kapal Lawd Berlayar
        </h2>
        <p className="story-lede mt-2 text-sm leading-relaxed opacity-80">
          Untuk membuka section berikutnya, bantu kapal Lawd mengangkut hasil
          komoditas ekspor ke pelabuhan tujuan. Hindari batu-batu di perairan
          agar barang-barang ekspor tetap aman.
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-5">
        {/* Arena */}
        <div
          className="relative aspect-square w-[min(90vw,560px)] overflow-hidden border-4"
          style={{ borderColor: INK, backgroundColor: "#1f4e79" }}
        >
          {MAP.map((row, r) =>
            [...row].map((ch, c) => {
              const img =
                ch === "#"
                  ? IMG.stone
                  : ch === "S"
                    ? IMG.start
                    : ch === "F"
                      ? IMG.finish
                      : IMG.water;
              return (
                <div
                  key={`${r}-${c}`}
                  className="absolute"
                  style={{
                    left: `${c * CELL_PCT}%`,
                    top: `${r * CELL_PCT}%`,
                    width: `${CELL_PCT}%`,
                    height: `${CELL_PCT}%`,
                    backgroundImage: `url(${img})`,
                    backgroundSize: "100% 100%",
                    ...pixel,
                  }}
                />
              );
            }),
          )}

          {/* Label start & finish */}
          {[
            { p: START, t: "START" },
            { p: FINISH, t: "FINISH" },
          ].map(({ p, t }) => (
            <span
              key={t}
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded px-1 text-[10px] font-bold tracking-widest"
              style={{
                left: `${(p.c + 0.5) * CELL_PCT}%`,
                top: `${p.r * CELL_PCT}%`,
                backgroundColor: BG,
                color: INK,
              }}
            >
              {t}
            </span>
          ))}

          {/* Kapal */}
          <div
            className="absolute z-20"
            style={{
              left: `${pos.c * CELL_PCT}%`,
              top: `${pos.r * CELL_PCT}%`,
              width: `${CELL_PCT}%`,
              height: `${CELL_PCT}%`,
              transition: "left 170ms ease-out, top 170ms ease-out",
            }}
          >
            <div ref={shipRef} className="h-full w-full">
              <img
                src={IMG.ship}
                alt="Kapal Lawd"
                draggable={false}
                className="h-full w-full object-contain"
                style={{
                  ...pixel,
                  transform: `scaleX(${facing})`,
                  filter: "drop-shadow(0 3px 3px rgba(0,0,0,.45))",
                }}
              />
            </div>
          </div>

          {won && (
            <div
              className="absolute inset-0 z-30 grid place-items-center text-center"
              style={{ backgroundColor: "rgba(244,240,231,0.88)" }}
            >
              <div>
                <p className="m-0 text-2xl font-bold">Kapal sampai!</p>
                <p className="mt-1 text-sm opacity-80">
                  Membuka section berikutnya…
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tombol arah (bisa diklik/disentuh; keyboard juga tetap aktif) */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex justify-center gap-2">
            {[
              { k: "↑", dir: "up", label: "Atas" },
              { k: "↓", dir: "down", label: "Bawah" },
              { k: "←", dir: "left", label: "Kiri" },
              { k: "→", dir: "right", label: "Kanan" },
            ].map(({ k, dir, label }) => (
              <button
                key={dir}
                type="button"
                aria-label={label}
                onClick={() => move(dir)}
                className="grid h-12 w-12 select-none place-items-center rounded-md border-2 text-lg font-bold transition-transform active:scale-90"
                style={{
                  borderColor: INK,
                  backgroundColor: "#fffaf0",
                  touchAction: "manipulation",
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={won}
            className="rounded-full border-2 px-4 py-1 text-xs tracking-widest disabled:opacity-40"
            style={{ borderColor: INK }}
          >
            ULANGI
          </button>
        </div>
      </div>
    </section>
  );
}
