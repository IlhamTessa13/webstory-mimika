import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import "./PanoramaSection.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const BG = "#f4f0e7";

// --- Globe ------------------------------------------------------------------
const MIMIKA = [136.8872, -4.5467];
const FIT_RATIO = 0.8;
const MAX_START_ZOOM = 2.2;
const MIN_START_ZOOM = 1;
const END_ZOOM = 4.6;

const fitZoom = (el) => {
  const side = el ? Math.min(el.clientWidth, el.clientHeight) : 0;
  if (!side) return 1.8;
  const z = Math.log2((FIT_RATIO * side * Math.PI) / 512);
  return Math.min(MAX_START_ZOOM, Math.max(MIN_START_ZOOM, z));
};

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutQuad = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

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

// --- Panorama (tidak diubah) -----------------------------------------------
const DEBUG =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug");

const IMAGE_URL = `${import.meta.env.BASE_URL}panorama.jpg`;

const PIT = { yaw: 10, pitch: -9 };

const STEPS = [
  { at: 0, yaw: 75, pitch: 4, fov: 90, callout: false },
  { at: 0.22, yaw: 10, pitch: -4, fov: 85, callout: true },
  { at: 0.62, yaw: -45, pitch: 0, fov: 85, callout: false },
];

const CALLOUT = {
  title: "Pertambangan",
  text: "Hasil tambang menyumbang PDRB terbesar di Timika.",
  dx: 150,
  dy: -190,
};

const TWEEN_MS = 1100;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const shortest = (from, to) =>
  from + ((((to - from + 180) % 360) + 360) % 360) - 180;

const toDir = (yaw, pitch, out) =>
  out.set(
    -Math.cos(rad(pitch)) * Math.cos(rad(yaw)),
    Math.sin(rad(pitch)),
    -Math.cos(rad(pitch)) * Math.sin(rad(yaw)),
  );

const stepFor = (p) => STEPS.reduce((idx, s, i) => (p >= s.at ? i : idx), 0);

// --- Penjadwalan scroll -----------------------------------------------------
const GLOBE_INTRO_UNITS = 2.4;
const FADE_UNITS = 0.6;
const PANORAMA_UNITS = 2.6;
const GLOBE_OUTRO_UNITS = 2.4;

const INTRO_END = GLOBE_INTRO_UNITS;
const FADE_IN_END = INTRO_END + FADE_UNITS;
const PANORAMA_END = FADE_IN_END + PANORAMA_UNITS;
const FADE_OUT_END = PANORAMA_END + FADE_UNITS;
const TOTAL_UNITS = FADE_OUT_END + GLOBE_OUTRO_UNITS;

function phaseState(raw) {
  let globeP;
  let globeOpacity;
  let panoOpacity;

  if (raw <= INTRO_END) {
    globeP = clamp01(raw / GLOBE_INTRO_UNITS);
    globeOpacity = 1;
    panoOpacity = 0;
  } else if (raw <= FADE_IN_END) {
    globeP = 1;
    const t = clamp01((raw - INTRO_END) / FADE_UNITS);
    globeOpacity = 1 - t;
    panoOpacity = t;
  } else if (raw <= PANORAMA_END) {
    globeP = 1;
    globeOpacity = 0;
    panoOpacity = 1;
  } else if (raw <= FADE_OUT_END) {
    globeP = 1;
    const t = clamp01((raw - PANORAMA_END) / FADE_UNITS);
    globeOpacity = t;
    panoOpacity = 1 - t;
  } else {
    const t = clamp01((raw - FADE_OUT_END) / GLOBE_OUTRO_UNITS);
    globeP = 1 - t;
    globeOpacity = 1;
    panoOpacity = 0;
  }

  const panoramaLocal = clamp01(
    (raw - FADE_IN_END) / (PANORAMA_END - FADE_IN_END),
  );

  return { globeP, globeOpacity, panoOpacity, panoramaLocal };
}

// Gaya layout kritis dikunci inline supaya globe tetap punya ukuran
// walaupun file CSS salah / belum termuat.
const STAGE_STYLE = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
};

export default function PanoramaSection() {
  const wrapperRef = useRef(null);
  const globeStageRef = useRef(null);
  const panoStageRef = useRef(null);
  const hintRef = useRef(null);

  const calloutRef = useRef(null);
  const lineRef = useRef(null);
  const dotRef = useRef(null);
  const boxRef = useRef(null);
  const infoRef = useRef(null);

  const [mapboxError, setMapboxError] = useState(!TOKEN);
  const [panoLoaded, setPanoLoaded] = useState(false);
  const [panoFailed, setPanoFailed] = useState(false);
  const [step, setStep] = useState(0);
  const [clicked, setClicked] = useState("");

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const globeHost = globeStageRef.current;
    const panoHost = panoStageRef.current;
    if (!wrapper || !globeHost || !panoHost) return;

    // =========================== GLOBE ===========================
    let map = null;
    let globeReady = false;
    let globeStartZoom = fitZoom(globeHost);
    let globeCurrent = 0;
    let globeTarget = 0;
    let globeRaf = null;

    const renderGlobe = (p) => {
      if (!map) return;
      const zoom = lerp(globeStartZoom, END_ZOOM, easeInOutQuad(p));
      map.jumpTo({ center: MIMIKA, zoom });
    };

    const tickGlobe = () => {
      globeRaf = null;
      const diff = globeTarget - globeCurrent;
      globeCurrent =
        Math.abs(diff) < 0.0006 ? globeTarget : globeCurrent + diff * 0.12;
      renderGlobe(globeCurrent);
      if (globeCurrent !== globeTarget) {
        globeRaf = requestAnimationFrame(tickGlobe);
      }
    };
    const requestGlobeTick = () => {
      if (globeReady && globeRaf === null) {
        globeRaf = requestAnimationFrame(tickGlobe);
      }
    };

    let globeRO = null;

    if (TOKEN) {
      mapboxgl.accessToken = TOKEN;

      map = new mapboxgl.Map({
        container: globeHost,
        style: "mapbox://styles/mapbox/satellite-v9",
        projection: "globe",
        center: MIMIKA,
        zoom: globeStartZoom,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      map.on("style.load", () => {
        map.setFog({
          color: BG,
          "high-color": BG,
          "space-color": BG,
          "horizon-blend": 0.02,
          "star-intensity": 0,
        });

        new mapboxgl.Marker({
          element: createCityMarker("Mimika", "#ff8a3d"),
          anchor: "top",
        })
          .setLngLat(MIMIKA)
          .addTo(map);

        globeReady = true;
        map.resize();
        globeStartZoom = fitZoom(globeHost);
        globeCurrent = globeTarget;
        renderGlobe(globeCurrent);
        requestGlobeTick();
      });

      map.on("error", (e) => {
        console.error("Mapbox error:", e?.error);
        if (e?.error?.status === 401) setMapboxError(true);
      });

      // Pastikan canvas mapbox selalu mengikuti ukuran container
      globeRO = new ResizeObserver(() => {
        if (!map) return;
        map.resize();
        globeStartZoom = fitZoom(globeHost);
        if (globeReady) renderGlobe(globeCurrent);
      });
      globeRO.observe(globeHost);
    }

    // =========================== PANORAMA ===========================
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    panoHost.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(STEPS[0].fov, 1, 0.1, 1100);
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    scene.add(new THREE.Mesh(geometry, material));

    const view = {
      yaw: STEPS[0].yaw,
      pitch: STEPS[0].pitch,
      fov: STEPS[0].fov,
    };
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const pitDir = toDir(PIT.yaw, PIT.pitch, new THREE.Vector3());
    const pitPoint = new THREE.Vector3();
    let panoSize = { w: 1, h: 1 };
    let currentStep = -1;
    let panoRaf = 0;

    const drawPano = () => {
      toDir(view.yaw, view.pitch, dir);
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(dir);
      renderer.render(scene, camera);

      const { w, h } = panoSize;
      camera.getWorldDirection(fwd);
      const callout = calloutRef.current;
      if (callout) {
        if (fwd.dot(pitDir) < 0.1) {
          callout.style.display = "none";
        } else {
          callout.style.display = "";
          pitPoint.copy(pitDir).multiplyScalar(100).project(camera);
          const ax = (pitPoint.x * 0.5 + 0.5) * w;
          const ay = (-pitPoint.y * 0.5 + 0.5) * h;
          const box = boxRef.current;
          const bw = box.offsetWidth;
          const bh = box.offsetHeight;
          let bx = ax + CALLOUT.dx;
          let by = ay + CALLOUT.dy;
          if (bx + bw > w - 16) bx = ax - CALLOUT.dx - bw;
          if (by < 16) by = ay - CALLOUT.dy;
          bx = clamp(bx, 16, w - bw - 16);
          by = clamp(by, 16, h - bh - 16);
          const cx = ax < bx + bw / 2 ? bx : bx + bw;
          const cy = ay < by + bh / 2 ? by : by + bh;
          box.style.transform = `translate(${bx}px, ${by}px)`;
          lineRef.current.setAttribute("x1", ax);
          lineRef.current.setAttribute("y1", ay);
          lineRef.current.setAttribute("x2", cx);
          lineRef.current.setAttribute("y2", cy);
          dotRef.current.setAttribute("cx", ax);
          dotRef.current.setAttribute("cy", ay);
        }
      }
      if (DEBUG && infoRef.current) {
        infoRef.current.textContent = `yaw ${view.yaw.toFixed(1)} | pitch ${view.pitch.toFixed(1)} | fov ${view.fov.toFixed(0)}`;
      }
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animateTo = (t) => {
      cancelAnimationFrame(panoRaf);
      const from = { ...view };
      const to = { yaw: shortest(from.yaw, t.yaw), pitch: t.pitch, fov: t.fov };
      const dur = reduceMotion ? 0 : TWEEN_MS;
      const t0 = performance.now();
      const tick = (now) => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = easeInOutCubic(k);
        view.yaw = from.yaw + (to.yaw - from.yaw) * e;
        view.pitch = from.pitch + (to.pitch - from.pitch) * e;
        view.fov = from.fov + (to.fov - from.fov) * e;
        drawPano();
        if (k < 1) panoRaf = requestAnimationFrame(tick);
      };
      panoRaf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(([entry]) => {
      panoSize = { w: entry.contentRect.width, h: entry.contentRect.height };
      renderer.setSize(panoSize.w, panoSize.h);
      camera.aspect = panoSize.w / panoSize.h;
      drawPano();
    });
    ro.observe(panoHost);

    new THREE.TextureLoader().load(
      IMAGE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material.map = tex;
        material.needsUpdate = true;
        setPanoLoaded(true);
        drawPano();
        handleScroll();
      },
      undefined,
      () => setPanoFailed(true),
    );

    if (DEBUG) {
      renderer.domElement.addEventListener("click", (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector3(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -(((e.clientY - rect.top) / rect.height) * 2 - 1),
          0.5,
        );
        const d = ndc.unproject(camera).normalize();
        const yaw = (Math.atan2(-d.z, -d.x) * 180) / Math.PI;
        const pitch = (Math.asin(d.y) * 180) / Math.PI;
        setClicked(`yaw: ${yaw.toFixed(1)}, pitch: ${pitch.toFixed(1)}`);
      });
    }

    // ======================= SCROLL HANDLER =========================
    const computeRaw = () => {
      const rect = wrapper.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      const progress = clamp01(-rect.top / scrollable);
      return progress * TOTAL_UNITS;
    };

    function handleScroll() {
      const raw = computeRaw();
      const { globeP, globeOpacity, panoOpacity, panoramaLocal } =
        phaseState(raw);

      globeTarget = globeP;
      requestGlobeTick();

      globeHost.style.opacity = String(globeOpacity);
      globeHost.style.pointerEvents = globeOpacity > 0.5 ? "auto" : "none";
      panoHost.style.opacity = String(panoOpacity);

      if (calloutRef.current) {
        calloutRef.current.style.opacity = String(panoOpacity);
      }

      const idx = stepFor(panoramaLocal);
      if (idx !== currentStep) {
        currentStep = idx;
        setStep(idx);
        animateTo(STEPS[idx]);
      }

      if (hintRef.current) {
        hintRef.current.style.opacity = raw < 0.08 ? "1" : "0";
      }
    }

    const onResize = () => {
      globeStartZoom = fitZoom(globeHost);
      if (map) map.resize();
      if (globeReady) renderGlobe(globeCurrent);
      handleScroll();
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", onResize);
      if (globeRaf !== null) cancelAnimationFrame(globeRaf);
      cancelAnimationFrame(panoRaf);
      if (globeRO) globeRO.disconnect();
      ro.disconnect();
      material.map?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      if (map) map.remove();
    };
  }, []);

  const live = panoLoaded && STEPS[step].callout;

  return (
    <section
      className="pa-section"
      ref={wrapperRef}
      style={{ position: "relative", height: `${TOTAL_UNITS * 100}vh` }}
    >
      <div
        className="pa-sticky"
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          width: "100%",
          overflow: "hidden",
          background: BG,
        }}
      >
        <div
          className="pa-stage-globe"
          ref={globeStageRef}
          style={{ ...STAGE_STYLE, zIndex: 1 }}
        >
          {mapboxError && (
            <div className="pa-msg" style={{ color: "#2b2a27" }}>
              Token Mapbox belum diatur / tidak valid. Tambahkan
              VITE_MAPBOX_TOKEN di file .env, lalu restart dev server.
            </div>
          )}
        </div>

        <div
          className="pa-stage-pano"
          ref={panoStageRef}
          style={{
            ...STAGE_STYLE,
            zIndex: 2,
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        <div className={`pa-callout${live ? " is-live" : ""}`} ref={calloutRef}>
          <svg className="pa-svg" aria-hidden="true">
            <line ref={lineRef} />
            <circle ref={dotRef} r="6" />
          </svg>
          <div className="pa-box" ref={boxRef}>
            <strong>{CALLOUT.title}</strong>
            <span>{CALLOUT.text}</span>
          </div>
        </div>

        {!panoLoaded && !panoFailed && (
          <div className="pa-msg" style={{ opacity: 0.85 }}>
            Memuat panorama…
          </div>
        )}
        {panoFailed && (
          <div className="pa-msg">
            Gambar tidak ditemukan. Pastikan ada di public/panorama.jpg.
          </div>
        )}

        <div className="pa-hint" ref={hintRef}>
          Gulir untuk mulai ↓
        </div>

        {DEBUG && (
          <div className="pa-debug">
            klik gambar untuk membaca yaw/pitch
            <br />
            {clicked || "-"}
            <br />
            <span ref={infoRef} /> | langkah {step}
          </div>
        )}
      </div>
    </section>
  );
}
