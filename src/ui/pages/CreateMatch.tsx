import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import Step1 from "../components/matchwizard/defaultInfo";
import Step2 from "../components/matchwizard/playerLineup";
import { createMatch } from "../../services/matchwizard/createMatch";
import { useTeamId } from "../../hooks/useTeamId";
import type { LineupPlayer } from "../../services/matchwizard/createMatch";

const ArrowLeft = () => (
  <svg style={{ marginRight: "10px" }} width="23" height="12" viewBox="0 0 23 12" fill="none">
    <path d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z" fill="black" />
  </svg>
);

const ArrowRight = () => (
  <svg style={{ marginLeft: "10px" }} width="23" height="12" viewBox="0 0 23 12" fill="none">
    <path d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z" fill="black" />
  </svg>
);

interface FormData {
  opponent: string;
  date: string;
  noteOnOpponent: string;
  strategy: string;
  isHomeGame: boolean;
  isRueckrunde: boolean;
  lineup: LineupPlayer[];
}

export default function CreateMatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const teamId = useTeamId();

  const prefillDate = (location.state as { date?: string } | null)?.date;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    opponent: "",
    date: prefillDate ?? "",
    noteOnOpponent: "",
    strategy: "",
    isHomeGame: true,
    isRueckrunde: false,
    lineup: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
    if (isSaving || !teamId) return;
    setIsSaving(true);
    try {
      const id = await createMatch({
        teamId,
        opponent: formData.opponent,
        date: formData.date ? new Date(formData.date) : new Date(),
        noteOnOpponent: formData.noteOnOpponent,
        strategy: formData.strategy,
        isHomeGame: formData.isHomeGame,
        isRueckrunde: formData.isRueckrunde,
        lineup: formData.lineup,
      });
      navigate(`/match-detail/${teamId}/${id}`);
    } catch (error) {
      console.error("Error creating match:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (teamId === null) {
    return (
      <>
        <Navigation />
        <div className="createTraining">
          <div className="trainingwizard">
            <p>You are not assigned to a team yet. Ask your admin to add you to a team before creating matches.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="createTraining">
        {currentStep === 1 && (
          <Step1
            opponent={formData.opponent}
            date={formData.date}
            noteOnOpponent={formData.noteOnOpponent}
            strategy={formData.strategy}
            isHomeGame={formData.isHomeGame}
            isRueckrunde={formData.isRueckrunde}
            onChange={handleChange}
            onNext={() => setCurrentStep(2)}
            onBack={() => navigate(-1)}
          />
        )}

        {currentStep === 2 && (
          <>
            <Step2
              teamId={teamId}
              lineup={formData.lineup}
              onChange={handleChange}
              autoSelectAll
            />
            <div className="excercisewizard__btn__wrapper">
              <button className="excercisewizard__btn" onClick={() => setCurrentStep(1)}>
                <ArrowLeft />
                Previous
              </button>
              <button
                className="excercisewizard__btn"
                onClick={handleSubmit}
                disabled={isSaving || !teamId}
              >
                {isSaving ? "Creating..." : "Create Match"}
                {!isSaving && <ArrowRight />}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
