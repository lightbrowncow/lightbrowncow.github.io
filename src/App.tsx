import {
  SpectrumVisualizer,
  type SpectrumSettings,
} from "./components/SpectrumVisualizer";

function App() {
  const settings: SpectrumSettings = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
  };

  return (
    <>
      <SpectrumVisualizer settings={settings} />
    </>
  );
}

export default App;
