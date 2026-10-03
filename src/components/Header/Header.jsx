const BASE = import.meta.env.BASE_URL;

export default function Header() {
  return (
    <header className="w-full">
      <img
        src={`${BASE}header.webp`}
        alt="Jejak Ekonomi Mimika — Dari Kuadran II ke Kapal Ekspor"
        className="w-full h-auto block"
      />
    </header>
  );
}
