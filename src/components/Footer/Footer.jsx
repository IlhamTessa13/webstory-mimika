export default function Footer() {
  return (
    <footer className="px-6 pt-12 pb-16 text-center text-muted text-sm border-t border-white/10">
      <p>
        Sumber data: BPS Kabupaten Mimika &amp; BPS Provinsi Papua Tengah
        (sesuaikan dengan sumber final).
      </p>
      <p className="mt-2 opacity-70">
        Dibuat oleh Tim Riset — {new Date().getFullYear()}
      </p>
    </footer>
  )
}
