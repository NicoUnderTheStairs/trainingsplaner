import React, { useEffect } from "react";
import withTrainingNavigation from "../../../hoc/withTrainingNavigation";
import { useNavigate } from "react-router-dom";

type Props = {
  title: string;
  tags?: string[];
  difficulty?: number;
  duration?: number;
  description?: string;
  author?: string;
  date?: string;
  onChange: (data: unknown) => void;
};

const AVAILABLE_TAGS = ["Defense", "Attack", "Block", "Reception", "Service"];

const DEFAULT_AUTHOR = "Default Author";

const DefaultInfo: React.FC<Props> = ({
  title,
  description,
  difficulty,
  duration,
  date,
  tags = [],
  onChange,
}) => {
  // Push date and author into wizard state on mount so they
  // are available in subsequent steps and can be uploaded to Firestore.
  useEffect(() => {
    onChange({
      date: new Date().toISOString().slice(0, 10),
      author: DEFAULT_AUTHOR,
    });
  }, []);

  const handleTagToggle = (tag: string) => {
    const updatedTags = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    onChange({ tags: updatedTags });
  };

  const navigate = useNavigate();

  return (
    <>
      <div className="trainingwizard">
        <div className="btn__back">
          <button className="btn__wired" onClick={() => navigate(-1)}>
            <svg
              width="23"
              height="12"
              viewBox="0 0 23 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                fill="black"
              />
            </svg>
            Back
          </button>
        </div>

        <h2>General Training Information</h2>

        <div className="trainingwizard__input__field">
          <input
            id="Date"
            className="trainingwizard__input"
            type="date"
            placeholder=" "
            value={date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
          <label className="trainingwizard__label" htmlFor="Date">
            Date of training
          </label>
        </div>

        <div className="trainingwizard__input__field">
          <input
            id="Title"
            className="trainingwizard__input"
            type="text"
            placeholder=" "
            value={title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <label className="trainingwizard__label" htmlFor="Title">
            Title
          </label>
        </div>

        <div className="trainingwizard__input__field trainingwizard__input__field--description">
          <textarea
            id="Description"
            className="trainingwizard__input"
            placeholder=" "
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <label className="trainingwizard__label" htmlFor="Description">
            Description (optional)
          </label>
        </div>

        <div className="trainingwizard__input__field">
          <input
            id="Duration"
            className="trainingwizard__input"
            type="number"
            placeholder=" "
            value={duration}
            onChange={(e) => onChange({ duration: e.target.value })}
          />
          <label className="trainingwizard__label" htmlFor="Duration">
            Duration of training (in minutes)
          </label>
        </div>

        <div className="trainingwizard__select__field">
          <label className="trainingwizard__select__label" htmlFor="Difficulty">
            Difficulty
          </label>
          <select
            value={difficulty || ""}
            className="trainingwizard__select__input"
            name="Difficulty"
            id="Difficulty"
            onChange={(e) => onChange({ difficulty: parseInt(e.target.value) })}
          >
            <option value="">Select difficulty</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>

        <div className="trainingwizard__select__field">
          <label className="trainingwizard__select__label">Select tags</label>
          <div className="trainingwizard__tags">
            {AVAILABLE_TAGS.map((tag) => (
              <label
                key={tag}
                className={[
                  "trainingwizard__tags__option",
                  `trainingwizard__tags--${tag.toLowerCase()}`,
                  tags.includes(tag)
                    ? `trainingwizard__tags--${tag.toLowerCase()}--active`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="checkbox"
                  className="trainingwizard__tags__checkbox"
                  checked={tags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                />
                <span className="trainingwizard__tags__label">{tag}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default withTrainingNavigation(DefaultInfo);
