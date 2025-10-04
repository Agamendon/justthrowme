import { Routes, Route, useNavigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Instructions } from "./pages/Instructions";
import { Disclaimer } from "./pages/Disclaimer";
import { Start } from "./pages/Start";
import { Main } from "./pages/Main";
import { ThrowPage } from "./pages/ThrowPage";
import { useState } from "react";

function App() {
  const navigate = useNavigate();
  const [permissionsEnabled, setPermissionsEnabled] = useState(false);
  
  const handleNextFromInstructions = () => {
    navigate("/onboarding/disclaimer");
  };

  const handleNextFromDisclaimer = () => {
    navigate("/onboarding/start");
  };

  const handleSkip = () => {
    navigate("/onboarding/start");
  };
  
  const handlePermissionsEnabled = () => {
    setPermissionsEnabled(true);
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
          <Disclaimer 
            onNext={handleNextFromDisclaimer} 
            onSkip={handleSkip}
            onPermissionsEnabled={handlePermissionsEnabled}
          />
        }
      />
      <Route path="/onboarding/start" element={<Start />} />
      <Route path="/go" element={<Main />} />
      <Route path="/throw" element={<ThrowPage permissionsEnabled={permissionsEnabled} />} />
    </Routes>
  );
}

export default App;
