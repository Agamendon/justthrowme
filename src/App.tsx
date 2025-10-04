import { Routes, Route, useNavigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Instructions } from "./pages/Instructions";
import { Disclaimer } from "./pages/Disclaimer";
import { Start } from "./pages/Start";
import { Main } from "./pages/Main";

function App() {
  const navigate = useNavigate();
  const handleNextFromInstructions = () => {
    navigate("/onboarding/disclaimer");
  };

  const handleNextFromDisclaimer = () => {
    navigate("/onboarding/start");
  };

  const handleSkip = () => {
    navigate("/onboarding/start");
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/onboarding/instructions"
        element={
          <Instructions
            onNext={handleNextFromInstructions}
            onSkip={handleSkip}
          />
        }
      />
      <Route
        path="/onboarding/disclaimer"
        element={
          <Disclaimer onNext={handleNextFromDisclaimer} onSkip={handleSkip} />
        }
      />
      <Route path="/onboarding/start" element={<Start />} />
      <Route path="/go" element={<Main />} />
    </Routes>
  );
}

export default App;
