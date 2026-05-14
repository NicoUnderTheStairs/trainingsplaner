import Navigation from "../components/navigation/Navigation";

import { useState } from "react";
import Step1 from "../components/excercisewizard/defaultInfo";
import Step2 from "../components/excercisewizard/imageSelection";
import { createExcercise } from "../../services/excercisewizard/createExcercise";

export default function CreateExcercise() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({}); // create type

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await createExcercise(
        formData.date ? new Date(formData.date) : new Date(),
        formData.author,
        formData.title,
        formData.description,
        formData.difficulty,
        formData.tags,
        formData.images,
      );
    } catch (error) {
      console.error("Error creating excercise:", error);
    }
  };

  const handleChange = (data: any) => {
    setFormData({ ...formData, ...data });
  };

  return (
    <>
      <Navigation />
      <div className="Createexcercise">
        {currentStep === 1 && (
          <Step1
            author={formData.author || ""}
            title={formData.title || ""}
            description={formData.description || ""}
            difficulty={formData.difficulty || 1}
            date={formData.date || ""}
            tags={formData.tags || ""}
            onChange={handleChange}
            onNext={handleNext}
            onPrev={handlePrev}
            isFirstStep={true}
          />
        )}
        {currentStep === 2 && (
          <Step2
            onNext={handleNext}
            onPrev={handlePrev}
            isLastStep={true}
            images={formData.images || ""}
          />
        )}
      </div>
    </>
  );
}
