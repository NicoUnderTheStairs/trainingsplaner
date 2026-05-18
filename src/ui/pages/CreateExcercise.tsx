import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import Navigation from "../components/navigation/Navigation";
import Step1 from "../components/excercisewizard/defaultInfo";
import Step2 from "../components/excercisewizard/sketchcreation";
import Step3 from "../components/excercisewizard/variantSelection";
import { createExcercise } from "../../services/excercisewizard/createExcercise";
import { linkVariants } from "../../services/excercisewizard/exerciseVariants";
import { notifyExerciseCreated } from "../../services/notifications/notifications";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";
import db from "../../firebase";

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
  variantOfId?: string;
}

export default function CreateExcercise() {
  const navigate = useNavigate();

  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [createdId, setCreatedId] = useState<string | null>(null);

  const totalSteps = 3;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // ── Step 2 → 3: save exercise then notify all other users ─────────────────
  const handleStep2Next = async () => {
    const resolvedAuthor =
      formData.author?.trim() ||
      userData?.userName?.trim() ||
      currentUser?.email?.split("@")[0] ||
      "Unknown";

    try {
      // 1. Save the exercise to Firestore
      const id = await createExcercise({
        date:        formData.date ? new Date(formData.date) : new Date(),
        author:      resolvedAuthor,
        title:       formData.title ?? "",
        description: formData.description ?? "",
        difficulty:  formData.difficulty ?? 1,
        tags:        formData.tags ?? [],
        sketch: {
          players: formData.sketch?.players ?? {},
          arrows:  formData.sketch?.arrows  ?? {},
        },
      });

      setCreatedId(id);

      // 2. Notify all other users (non-blocking — don't let it stop the wizard)
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const recipientIds = usersSnap.docs
          .map((d) => d.id)
          .filter((uid) => uid !== currentUser?.uid);

        if (recipientIds.length > 0) {
          await notifyExerciseCreated(
            recipientIds,
            id,
            formData.title ?? "New exercise",
            resolvedAuthor,
            currentUser?.uid ?? "",
          );
        }
      } catch (notifError) {
        // Notification failure is non-critical — log and continue
        console.warn("Could not send exercise notifications:", notifError);
      }

      // 3. Proceed to variant step
      setCurrentStep(3);
    } catch (error) {
      console.error("Error creating exercise:", error);
    }
  };

  // ── Step 3 → done: optionally link variants then navigate ────────────────
  const handleFinish = async () => {
    const id = createdId;
    if (!id) return;

    if (formData.variantOfId) {
      try {
        await linkVariants(id, formData.variantOfId);
      } catch (error) {
        console.error("Error linking variants:", error);
      }
    }

    navigate(`/exercise-detail/${id}`);
  };

  const defaultAuthor =
    userData?.userName ?? currentUser?.email?.split("@")[0] ?? "";

  return (
    <>
      <Navigation />
      <div className="Createexcercise">
        {currentStep === 1 && (
          <Step1
            author={formData.author ?? defaultAuthor}
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
            onNext={handleStep2Next}
            onPrev={handlePrev}
            isLastStep={false}
          />
        )}

        {currentStep === 3 && (
          <Step3
            newExerciseId={createdId ?? ""}
            variantOfId={formData.variantOfId}
            onChange={handleChange}
            onNext={handleFinish}
            onPrev={() => {
              // Exercise already saved — go straight to detail page
              if (createdId) navigate(`/exercise-detail/${createdId}`);
            }}
            isLastStep={true}
          />
        )}
      </div>
    </>
  );
}