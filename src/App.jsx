import { useEffect, useState } from "react";
import Header from "./components/Header/Header.jsx";
import FlightTransition from "./components/FlightTransition/FlightTransition.jsx";
import Footer from "./components/Footer/Footer.jsx";
import ProportionalSymbolSection from "./components/sections/ProportionalSymbolSection/ProportionalSymbolSection.jsx";
import ChoroplethSection from "./components/sections/ChoroplethSection/ChoroplethSection.jsx";
import TreemapSection from "./components/sections/TreemapSection/TreemapSection.jsx";
import SunburstSection from "./components/sections/SunburstSection/SunburstSection.jsx";
import PanoramaSection from "./components/sections/PanoramaSection/PanoramaSection.jsx";
import ShipGameSection from "./components/sections/ShipGameSection/ShipGameSection.jsx";
import SankeySection from "./components/sections/SankeySection/SankeySection.jsx";
import GanttSection from "./components/sections/GanttSection/GanttSection.jsx";

export default function App() {

  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!unlocked) return;

    const id = requestAnimationFrame(() => {
      document.getElementById("sankey")?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [unlocked]);

  return (
    <>
      <Header />
      <FlightTransition />
      <main>
        <ProportionalSymbolSection />
        <ChoroplethSection />
        <TreemapSection />
        <SunburstSection />
        <PanoramaSection />
        <ShipGameSection onComplete={() => setUnlocked(true)} />
        {unlocked && (
          <>
            <SankeySection />
            <GanttSection />
          </>
        )}
      </main>
      {unlocked && <Footer />}
    </>
  );
}
