import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import Step1 from "../components/excercisewizard/defaultInfo";
import Step2 from "../components/excercisewizard/sketchcreation";
import { createExcercise } from "../../services/excercisewizard/createExcercise";

interface FormData {
  date?: string;
  author?: string;
  title?: string;
  description?: string;
  difficulty?: number;
  tags?: string[];
  sketch?: {
    players: Record<string, any>;
    arrows: Record<string, any>;
  };
}

export default function CreateExcercise() {
  const navigate = useNavigate();
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
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
    try {
      const id = await createExcercise({
        date: formData.date ? new Date(formData.date) : new Date(),
        author: formData.author ?? "Default Author",
        title: formData.title ?? "",
        description: formData.description ?? "",
        difficulty: formData.difficulty ?? 1,
        tags: formData.tags ?? [],
        sketch: {
          players: formData.sketch?.players ?? {},
          arrows: formData.sketch?.arrows ?? {},
        },
      });

      navigate(`/exercise-detail/${id}`);
    } catch (error) {
      console.error("Error creating excercise:", error);
    }
  };

  return (
    <>
      <Navigation />
      <div className="Createexcercise">
        {currentStep === 1 && (
          <Step1
            author={formData.author ?? ""}
            title={formData.title ?? ""}
            description={formData.description ?? ""}
            difficulty={formData.difficulty ?? 1}
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
            sketch={formData.sketch}
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
