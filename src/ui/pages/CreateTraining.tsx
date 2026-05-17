import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import Step1 from "../components/trainingwizard/defaultInfo";
import Step2 from "../components/trainingwizard/exerciseSelection";
import { createTraining } from "../../services/trainingwizard/createTraining";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";
import type { SelectedExercise } from "../components/trainingwizard/exerciseSelection";

interface FormData {
  date?: string;
  author?: string;
  title?: string;
  description?: string;
  difficulty?: number;
  duration?: number;
  tags?: string[];
  selectedExercises?: SelectedExercise[];
}

export default function CreateTraining() {
  const navigate = useNavigate();

  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
    // Author priority: what user typed in the form > profile name > email prefix
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
      });

      navigate(`/training-detail/${id}`);
    } catch (error) {
      console.error("Error creating training:", error);
    }
  };

  // Use the profile name as the author default — falls back to empty string
  // while useGetUserData is still loading (it resolves quickly after mount)
  const defaultAuthor =
    userData?.userName ?? currentUser?.email?.split("@")[0] ?? "";

  return (
    <>
      <Navigation />
      <div className="createTraining">
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
            onNext={handleNext}
            onPrev={handlePrev}
            isFirstStep={true}
          />
        )}
        {currentStep === 2 && (
          <Step2
            totalDuration={formData.duration ?? 0}
            selectedExercises={formData.selectedExercises ?? []}
            onChange={handleChange}
            onNext={handleNext}
            onPrev={handlePrev}
            isLastStep={true}
          />
        )}
      </div>
    </>
  );
}
