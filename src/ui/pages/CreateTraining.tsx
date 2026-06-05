import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import Step1 from "../components/trainingwizard/defaultInfo";
import Step2 from "../components/trainingwizard/exerciseSelection";
import Step3 from "../components/trainingwizard/playerSelection";
import { createTraining } from "../../services/trainingwizard/createTraining";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";
import type { SelectedExercise } from "../components/trainingwizard/exerciseSelection";
import type { Players } from "../components/trainingwizard/playerSelection";
import { EMPTY_PLAYERS } from "../components/trainingwizard/playerSelection";

// ── Nav arrow SVGs ─────────────────────────────────────────────────────────────

const ArrowLeft = () => (
  <svg
    style={{ marginRight: "10px" }}
    width="23"
    height="12"
    viewBox="0 0 23 12"
    fill="none"
  >
    <path
      d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
      fill="black"
    />
  </svg>
);

const ArrowRight = () => (
  <svg
    style={{ marginLeft: "10px" }}
    width="23"
    height="12"
    viewBox="0 0 23 12"
    fill="none"
  >
    <path
      d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z"
      fill="black"
    />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────

interface FormData {
  date?: string;
  author?: string;
  title?: string;
  description?: string;
  difficulty?: number;
  duration?: number;
  tags?: string[];
  selectedExercises?: SelectedExercise[];
  players?: Players;
}

export default function CreateTraining() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  const prefillDate = (location.state as { date?: string } | null)?.date;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({ date: prefillDate });
  const [isSaving, setIsSaving] = useState(false);

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleStep1Next = () => setCurrentStep(2);
  const handleStep2Next = () => setCurrentStep(3);

  const handleSubmit = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const resolvedAuthor =
      formData.author?.trim() ||
      userData?.userName?.trim() ||
      currentUser?.email?.split("@")[0] ||
      "Unknown";

    try {
      const id = await createTraining({
        date: formData.date ? new Date(formData.date) : new Date(),
        author: resolvedAuthor,
        title: formData.title ?? "",
        description: formData.description ?? "",
        difficulty: formData.difficulty ?? 1,
        duration: formData.duration ?? 120,
        tags: formData.tags ?? [],
        selectedExercises: formData.selectedExercises ?? [],
        players: formData.players ?? EMPTY_PLAYERS,
      });
      navigate(`/training-detail/${currentUser?.uid}/${id}`);
    } catch (error) {
      console.error("Error creating training:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAuthor =
    userData?.userName ?? currentUser?.email?.split("@")[0] ?? "";

  return (
    <>
      <Navigation />
      <div className="createTraining">
        {/* Step 1 — info (withTrainingNavigation renders its own buttons) */}
        {currentStep === 1 && (
          <Step1
            author={formData.author ?? defaultAuthor}
            title={formData.title ?? ""}
            description={formData.description ?? ""}
            difficulty={formData.difficulty ?? 1}
            duration={formData.duration}
            date={formData.date ?? ""}
            tags={formData.tags ?? []}
            // @ts-ignore
            onChange={handleChange}
            onNext={handleStep1Next}
            onPrev={handlePrev}
            isFirstStep={true}
          />
        )}

        {/* Step 2 — exercises (withTrainingNavigation renders its own buttons) */}
        {currentStep === 2 && (
          <Step2
            totalDuration={formData.duration ?? 0}
            selectedExercises={formData.selectedExercises ?? []}
            onChange={handleChange}
            onNext={handleStep2Next}
            onPrev={handlePrev}
            isLastStep={false}
          />
        )}

        {/* Step 3 — players (no HOC, nav rendered here) */}
        {currentStep === 3 && (
          <>
            <Step3
              players={formData.players ?? EMPTY_PLAYERS}
              onChange={handleChange}
            />
            <div className="excercisewizard__btn__wrapper">
              <button className="excercisewizard__btn" onClick={handlePrev}>
                <ArrowLeft />
                Previous
              </button>
              <button
                className="excercisewizard__btn"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? "Creating..." : "Create Training"}
                {!isSaving && <ArrowRight />}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
