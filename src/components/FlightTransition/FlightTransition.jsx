import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const BG = "#f4f0e7";

const JAKARTA = [106.8456, -6.2088];
const MIMIKA = [136.8872, -4.5467];

const PLANE_ROTATION_OFFSET = 90;
const PLANE_SIZE = 56;

const FIT_RATIO = 0.8;
const MAX_START_ZOOM = 2.2;
const MIN_START_ZOOM = 1;

const fitZoom = (el) => {
  const side = el ? Math.min(el.clientWidth, el.clientHeight) : 0;
  if (!side) return 1.8;
  const z = Math.log2((FIT_RATIO * side * Math.PI) / 512);
  return Math.min(MAX_START_ZOOM, Math.max(MIN_START_ZOOM, z));
};

const END_ZOOM = 4.6;

const CURVE = 0.22;

const FLIGHT_SHARE = 0.94;

const IN_MS = 520;
const OUT_MS = 450;

function greatCircle(a, b, steps) {
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const [lng1, lat1] = [rad(a[0]), rad(a[1])];
  const [lng2, lat2] = [rad(b[0]), rad(b[1])];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
      ),
    );
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x =
      A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y =
      A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([
      deg(Math.atan2(y, x)),
      deg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    ]);
  }
  return pts;
}

function curvedRoute(a, b, steps = 240) {
  const base = greatCircle(a, b, steps);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const h = len * CURVE;
  return base.map((p, i) => {
    const s = Math.sin((Math.PI * i) / steps);
    return [p[0] + nx * h * s, p[1] + ny * h * s];
  });
}

const ROUTE = curvedRoute(JAKARTA, MIMIKA);

function pointAt(t) {
  const clamped = Math.min(1, Math.max(0, t));
  const f = clamped * (ROUTE.length - 1);
  const i = Math.min(ROUTE.length - 2, Math.floor(f));
  const k = f - i;
  const p = [
    ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k,
    ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k,
  ];
  return { point: p, index: i };
}

const OUTRO_CENTER = pointAt(0.12).point;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

function createCityMarker(label, color) {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;";

  const dot = document.createElement("div");
  dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 4px color-mix(in srgb, ${color} 35%, transparent), 0 0 18px ${color};`;

  const text = document.createElement("span");
  text.textContent = label;
  text.style.cssText =
    "color:#fff;font-size:15px;font-weight:600;text-shadow:0 1px 6px rgba(0,0,0,.8);white-space:nowrap;";

  el.append(dot, text);
  return el;
}

export default function FlightTransition() {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const hintRef = useRef(null);
  const [error, setError] = useState(!TOKEN);

  useEffect(() => {
    if (!TOKEN) return;
    mapboxgl.accessToken = TOKEN;

    let startZoom = fitZoom(containerRef.current);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      projection: "globe",
      center: JAKARTA,
      zoom: startZoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    let ready = false;
    let target = 0;
    let current = 0;
    let outro = 0;
    let outroTarget = 0;
    let raf = null;

    let aligned = false;
    let planeShown = false;
    let vanishing = false;
    let done = false;
    let locked = false;
    let lockY = 0;
    let vanishTimer = null;

    const planeEl = document.createElement("div");
    const popEl = document.createElement("div");
    popEl.style.cssText = `position:relative;width:${PLANE_SIZE}px;height:${PLANE_SIZE}px;opacity:0;transform:scale(0);`;
    const ringEl = document.createElement("div");
    ringEl.style.cssText =
      "position:absolute;inset:0;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px rgba(30,155,255,.9);opacity:0;pointer-events:none;";
    const planeImg = document.createElement("img");
    planeImg.src = "/plane.png";
    planeImg.alt = "";
    planeImg.style.cssText = `position:relative;width:100%;height:100%;display:block;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.55));will-change:transform;`;
    popEl.append(ringEl, planeImg);
    planeEl.appendChild(popEl);

    const planeMarker = new mapboxgl.Marker({
      element: planeEl,
      rotationAlignment: "viewport",
      pitchAlignment: "viewport",
    });

    let popAnim = null;
    const burst = () => {
      ringEl.animate(
        [
          { transform: "scale(0.3)", opacity: 0.95 },
          { transform: "scale(2.6)", opacity: 0 },
        ],
        { duration: 650, easing: "ease-out" },
      );
    };
    const popIn = () => {
      const next = popEl.animate(
        [
          { transform: "scale(0) rotate(-30deg)", opacity: 0 },
          { transform: "scale(1.45) rotate(8deg)", opacity: 1, offset: 0.55 },
          { transform: "scale(1) rotate(0deg)", opacity: 1 },
        ],
        { duration: IN_MS, easing: "ease-out", fill: "forwards" },
      );
      popAnim?.cancel();
      popAnim = next;
      burst();
    };
    const popOut = () => {
      const next = popEl.animate(
        [
          { transform: "scale(1) rotate(0deg)", opacity: 1 },
          { transform: "scale(1.3) rotate(-6deg)", opacity: 1, offset: 0.3 },
          { transform: "scale(0) rotate(25deg)", opacity: 0 },
        ],
        { duration: OUT_MS, easing: "ease-in", fill: "forwards" },
      );
      popAnim?.cancel();
      popAnim = next;
      burst();
    };

    const syncVisibility = () => {
      const want = aligned && !done && !vanishing;
      if (want && !planeShown) {
        planeShown = true;
        popIn();
      } else if (!want && planeShown) {
        planeShown = false;
        popOut();
      }
    };

    const startVanish = () => {
      vanishing = true;
      planeShown = false;
      popOut();
      vanishTimer = setTimeout(() => {
        vanishing = false;
        done = true;
        outroTarget = 1;
        requestTick();
      }, OUT_MS + 80);
    };

    const render = (p) => {
      const { point, index } = pointAt(p);

      const camP = pointAt(0.12 + 0.76 * p).point;
      const o = easeInOut(outro);
      const cam = [
        lerp(camP[0], OUTRO_CENTER[0], o),
        lerp(camP[1], OUTRO_CENTER[1], o),
      ];
      const zoom = lerp(lerp(startZoom, END_ZOOM, easeInOut(p)), startZoom, o);
      map.jumpTo({ center: cam, zoom });

      const traveled = [...ROUTE.slice(0, index + 1), point];
      map.getSource("route-progress")?.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: traveled },
      });

      planeMarker.setLngLat(point);
      const a = map.project(pointAt(Math.max(0, p - 0.01)).point);
      const b = map.project(pointAt(Math.min(1, p + 0.01)).point);
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      planeImg.style.transform = `rotate(${angle + PLANE_ROTATION_OFFSET}deg)`;

      if (hintRef.current) hintRef.current.style.opacity = p < 0.03 ? "1" : "0";
    };

    const tick = () => {
      raf = null;

      const diff = target - current;
      current = Math.abs(diff) < 0.0005 ? target : current + diff * 0.12;

      const od = outroTarget - outro;
      outro = Math.abs(od) < 0.002 ? outroTarget : outro + od * 0.06;

      render(current);

      if (locked && !done && !vanishing && current === 1) startVanish();

      if (locked && done && outro === 1) locked = false;

      if (current !== target || outro !== outroTarget) {
        raf = requestAnimationFrame(tick);
      }
    };
    const requestTick = () => {
      if (ready && raf === null) raf = requestAnimationFrame(tick);
    };

    const readScroll = () => {
      const wrapper = wrapperRef.current;
      const rect = wrapper.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const flightDistance = distance * FLIGHT_SHARE;
      return {
        top: rect.top,
        progress: clamp01(-rect.top / flightDistance),
        arrivalY: window.scrollY + rect.top + flightDistance,
      };
    };

    const handle = () => {
      if (!ready || !wrapperRef.current) return;

      if (locked) {
        if (Math.abs(window.scrollY - lockY) > 0.5) {
          window.scrollTo({ top: lockY, behavior: "instant" });
        }
        requestTick();
        return;
      }

      const s = readScroll();
      target = s.progress;
      aligned = s.top <= 2;

      if (done && s.progress < 0.97) {
        done = false;
        outroTarget = 0;
      }

      if (!done && planeShown && s.progress >= 1) {
        locked = true;
        lockY = s.arrivalY;
        window.scrollTo({ top: lockY, behavior: "instant" });
      }

      syncVisibility();
      requestTick();
    };

    const onResize = () => {
      startZoom = fitZoom(containerRef.current);
      if (ready) render(current);
      handle();
    };

    const block = (e) => {
      if (locked && e.cancelable) e.preventDefault();
    };
    const blockKeys = (e) => {
      if (
        locked &&
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
    };

    map.on("style.load", () => {
      map.setFog({
        color: BG,
        "high-color": BG,
        "space-color": BG,
        "horizon-blend": 0.02,
        "star-intensity": 0,
      });

      const empty = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [ROUTE[0], ROUTE[0]] },
      };
      const full = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: ROUTE },
      };

      map.addSource("route-full", { type: "geojson", data: full });
      map.addSource("route-progress", { type: "geojson", data: empty });

      map.addLayer({
        id: "route-full",
        type: "line",
        source: "route-full",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.4,
          "line-width": 2,
          "line-dasharray": [1, 2],
        },
      });
      map.addLayer({
        id: "route-progress",
        type: "line",
        source: "route-progress",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1e9bff", "line-width": 4 },
      });

      new mapboxgl.Marker({
        element: createCityMarker("Jakarta", "#1e9bff"),
        anchor: "top",
      })
        .setLngLat(JAKARTA)
        .addTo(map);
      new mapboxgl.Marker({
        element: createCityMarker("Mimika", "#ff8a3d"),
        anchor: "top",
      })
        .setLngLat(MIMIKA)
        .addTo(map);
      planeMarker.setLngLat(JAKARTA).addTo(map);

      ready = true;
      current = readScroll().progress;
      render(current);
      handle();
    });

    map.on("error", (e) => {
      if (e?.error?.status === 401) setError(true);
    });

    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("keydown", blockKeys);

    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      window.removeEventListener("keydown", blockKeys);
      if (raf !== null) cancelAnimationFrame(raf);
      if (vanishTimer) clearTimeout(vanishTimer);
      map.remove();
    };
  }, []);

  return (
    <section ref={wrapperRef} className="relative h-[300vh]">
      <div
        className="sticky top-0 h-screen overflow-hidden"
        style={{ backgroundColor: "#f4f0e7" }}
      >
        <div ref={containerRef} className="absolute inset-0" />

        {error && (
          <div
            className="absolute inset-0 grid place-items-center px-6 text-center"
            style={{ color: "#2b2a27" }}
          >
            Token Mapbox belum diatur. Tambahkan VITE_MAPBOX_TOKEN di file .env,
            lalu restart dev server.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-6">

        </div>
      </div>
    </section>
  );
}
