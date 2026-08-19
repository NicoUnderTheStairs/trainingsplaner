import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

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
    objects?: Record<string, any>; // allow undefined sketch objects from SketchData
  };
  variantIds?: string[];
}

// ── Shared nav arrow SVGs ─────────────────────────────────────────────────────

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

export default function CreateExcercise() {
  const navigate = useNavigate();
  const location = useLocation();

  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  // Arrived via "Add Variant" on an exercise's detail page — the variant link
  // is already decided, so the variant-selection step is skipped entirely.
  const variantOfId = (location.state as { variantOfId?: string } | null)
    ?.variantOfId;
  const [variantOfTitle, setVariantOfTitle] = useState<string | null>(null);

  // Prefill the wizard with the original exercise's info + sketch, so the user
  // only has to change what's different about this variant.
  useEffect(() => {
    if (!variantOfId) return;
    getDoc(doc(db, "Excercises", variantOfId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setVariantOfTitle(data.title ?? "Untitled");
      setFormData((prev) => ({
        ...prev,
        title: data.title ?? prev.title,
        description: data.description ?? prev.description,
        difficulty: data.difficulty ?? prev.difficulty,
        tags: data.tags ?? prev.tags,
        sketch: data.sketch ?? prev.sketch,
      }));
    });
  }, [variantOfId]);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    variantIds: variantOfId ? [variantOfId] : undefined,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleStep1Next = () => setCurrentStep(2);
  // When the variant link is already known, skip step 3 (variant selection) and finish directly.
  const handleStep2Next = () => {
    if (variantOfId) {
      handleFinish();
    } else {
      setCurrentStep(3);
    }
  };

  // ── Final submit: create exercise + link variants + notify ────────────────

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const resolvedAuthor =
      formData.author?.trim() ||
      userData?.userName?.trim() ||
      currentUser?.email?.split("@")[0] ||
      "Unknown";

    try {
      // 1. Save exercise to Firestore
      const id = await createExcercise({
        date: formData.date ? new Date(formData.date) : new Date(),
        author: resolvedAuthor,
        title: formData.title ?? "",
        description: formData.description ?? "",
        difficulty: formData.difficulty ?? 1,
        tags: formData.tags ?? [],
        team: userData?.team ?? "",
        sketch: {
          players: formData.sketch?.players ?? {},
          arrows: formData.sketch?.arrows ?? {},
          objects: formData.sketch?.objects ?? {},
        },
      });

      // 2. Link any selected variants
      if (formData.variantIds?.length) {
        await Promise.all(
          formData.variantIds.map((variantId) => linkVariants(id, variantId)),
        );
      }

      // 3. Notify other users (non-blocking)
      try {
        const creatorTeam = userData?.team ?? "";
        const usersSnap = await getDocs(collection(db, "users"));
        const recipientIds = usersSnap.docs
          .filter((d) => d.id !== currentUser?.uid)
          .filter((d) => {
            const scope = (d.data().notificationScope as string | undefined) ?? "all";
            if (scope === "all") return true;
            // "team": only notify if recipient is in the same team as the creator
            return creatorTeam !== "" && d.data().team === creatorTeam;
          })
          .map((d) => d.id);

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
        console.warn("Could not send exercise notifications:", notifError);
      }

      navigate(`/exercise-detail/${id}`);
    } catch (error) {
      console.error("Error creating exercise:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAuthor =
    userData?.userName ?? currentUser?.email?.split("@")[0] ?? "";

  return (
    <>
      <Navigation />

      <div className="Createexcercise">
        {variantOfId && currentStep !== 3 && (
          <div className="excercisewizard">
            <div className="excercisewizard__variant-banner">
              Adding a variant of <strong>{variantOfTitle ?? "…"}</strong> —
              its info and sketch were copied over, just change what's
              different.
            </div>
          </div>
        )}

        {/* ── Step 1: info — withNavigation HOC renders its own nav buttons ── */}
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
            onNext={handleStep1Next}
            onPrev={handlePrev}
            isFirstStep={true}
          />
        )}

        {/* ── Step 2: sketch — SketchCreation has no HOC, nav rendered here ── */}
        {currentStep === 2 && (
          <>
            <Step2 sketch={formData.sketch} onChange={handleChange} />
            <div className="excercisewizard__btn__wrapper">
              <button className="excercisewizard__btn" onClick={handlePrev}>
                <ArrowLeft />
                Previous
              </button>
              <button
                className="excercisewizard__btn"
                onClick={handleStep2Next}
              >
                Continue
                <ArrowRight />
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: variants — VariantSelection has no HOC, nav rendered here ── */}
        {currentStep === 3 && (
          <>
            <Step3
              variantIds={formData.variantIds ?? []}
              onChange={handleChange}
            />
            <div className="excercisewizard__btn__wrapper">
              <button className="excercisewizard__btn" onClick={handlePrev}>
                <ArrowLeft />
                Previous
              </button>
              <button
                className="excercisewizard__btn"
                onClick={handleFinish}
                disabled={isSaving}
              >
                {isSaving ? "Creating..." : "Create Exercise"}
                {!isSaving && <ArrowRight />}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
