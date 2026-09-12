import { HomeSimpleStart } from "./HomeSimpleStart";
import { HomePage } from "./HomePage";
import { useWorkspaceExperienceMode } from "../ExperienceMode/useWorkspaceExperienceMode";
import "./homeSimple.css";
import "./homeExperience.css";

export function HomeExperiencePage() {
  const { isSimpleMode } = useWorkspaceExperienceMode();

  return (
    <div
      className={`qtable-home-experience${isSimpleMode ? " is-simple" : " is-advanced"}`}
      data-experience-mode={isSimpleMode ? "simple" : "advanced"}
    >
      {isSimpleMode ? (
        <div className="qtable-home-simple-start-wrap">
          <HomeSimpleStart />
        </div>
      ) : null}
      <HomePage />
    </div>
  );
}
