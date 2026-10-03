import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./PanoramaSection.css";

/* ------------------------------------------------------------------ */
/*  KONFIGURASI                                                        */
/* ------------------------------------------------------------------ */

// Buka dengan ?debug di URL, lalu klik gambar untuk membaca yaw/pitch titik itu
const DEBUG = new URLSearchParams(window.location.search).has("debug");

const IMAGE_URL = `${import.meta.env.BASE_URL}panorama.jpg`; // file di public/

// Sudut dalam derajat. yaw: 0 = tengah gambar, positif = ke kanan.
// pitch: 0 = garis horizon, positif = ke atas.
const PIT = { yaw: 10, pitch: -9 }; // titik yang ditunjuk garis (lubang tambang)

// Tiap langkah scroll = satu "patahan" kamera. `at` = posisi scroll (0..1) pemicunya.
const STEPS = [
  { at: 0, yaw: 75, pitch: 4, fov: 90, callout: false }, // awal: menghadap kendaraan
  { at: 0.22, yaw: 10, pitch: -4, fov: 85, callout: true }, // scroll 1: menoleh ke lubang
  { at: 0.62, yaw: -45, pitch: 0, fov: 85, callout: false }, // scroll 2: geser lagi ke kiri
];

const CALLOUT = {
  title: "Pertambangan",
  text: "Hasil tambang menyumbang PDRB terbesar di Timika.", // tambahkan angka BPS-mu
  dx: 150, // posisi kotak relatif terhadap titik (piksel); negatif = kiri/atas
  dy: -190,
};

const TWEEN_MS = 1100;

/* ------------------------------------------------------------------ */

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const shortest = (from, to) =>
  from + ((((to - from + 180) % 360) + 360) % 360) - 180;

// Arah (yaw, pitch) -> vektor. Gambar tengah = arah -X, kanan = arah -Z.
const toDir = (yaw, pitch, out) =>
  out.set(
    -Math.cos(rad(pitch)) * Math.cos(rad(yaw)),
    Math.sin(rad(pitch)),
    -Math.cos(rad(pitch)) * Math.sin(rad(yaw)),
  );

const stepFor = (p) => STEPS.reduce((idx, s, i) => (p >= s.at ? i : idx), 0);

export default function PanoramaSection() {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const calloutRef = useRef(null);
  const lineRef = useRef(null);
  const dotRef = useRef(null);
  const boxRef = useRef(null);
  const infoRef = useRef(null);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [clicked, setClicked] = useState("");

  useEffect(() => {
    const host = stageRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(STEPS[0].fov, 1, 0.1, 1100);
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1); // lihat bola dari dalam
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
    let size = { w: 1, h: 1 };
    let currentStep = -1;
    let raf = 0;

    const draw = () => {
      toDir(view.yaw, view.pitch, dir);
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(dir);
      renderer.render(scene, camera);

      // Posisi titik tambang di layar -> garis + kotak
      const { w, h } = size;
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
          if (bx + bw > w - 16) bx = ax - CALLOUT.dx - bw; // balik ke kiri bila mepet kanan
          if (by < 16) by = ay - CALLOUT.dy; // balik ke bawah bila mepet atas
          bx = clamp(bx, 16, w - bw - 16);
          by = clamp(by, 16, h - bh - 16);
          const cx = ax < bx + bw / 2 ? bx : bx + bw; // sudut kotak terdekat
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

    // Satu patahan kamera: gerak cepat lalu berhenti
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animateTo = (t) => {
      cancelAnimationFrame(raf);
      const from = { ...view };
      const to = { yaw: shortest(from.yaw, t.yaw), pitch: t.pitch, fov: t.fov };
      const dur = reduce ? 0 : TWEEN_MS;
      const t0 = performance.now();
      const tick = (now) => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = easeInOut(k);
        view.yaw = from.yaw + (to.yaw - from.yaw) * e;
        view.pitch = from.pitch + (to.pitch - from.pitch) * e;
        view.fov = from.fov + (to.fov - from.fov) * e;
        draw();
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Scroll hanya memicu langkah; tidak menggeser kamera secara halus
    const onScroll = () => {
      const r = sectionRef.current.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const idx = stepFor(clamp(-r.top / total, 0, 1));
      if (idx !== currentStep) {
        currentStep = idx;
        setStep(idx);
        animateTo(STEPS[idx]);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(([e]) => {
      size = { w: e.contentRect.width, h: e.contentRect.height };
      renderer.setSize(size.w, size.h);
      camera.aspect = size.w / size.h;
      draw();
    });
    ro.observe(host);

    new THREE.TextureLoader().load(
      IMAGE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material.map = tex;
        material.needsUpdate = true;
        setLoaded(true);
        draw();
        onScroll();
      },
      undefined,
      () => setFailed(true),
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      material.map?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const live = loaded && STEPS[step].callout;

  return (
    <section className="pa-section" ref={sectionRef} aria-labelledby="pa-title">
      <div className="pa-sticky">
        <div className="pa-stage" ref={stageRef} />

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

        {!loaded && !failed && <div className="pa-msg">Memuat panorama…</div>}
        {failed && (
          <div className="pa-msg">
            Gambar tidak ditemukan. Pastikan ada di public/panorama.png.
          </div>
        )}

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
