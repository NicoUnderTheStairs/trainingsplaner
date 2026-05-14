const ExcerciseList = () => {
  return (
    <>
      <div className="excerciselist">
        <div className="excerciselist__inner">
          <div className="excerciselist__menu">
            <h2>All Exercises</h2>

            <div className="excerciselist__menu__buttons">
              <button className="excerciselist__menu__buttons--search">
                Search...
              </button>
              <button className="excerciselist__menu__buttons--filter">
                Filter
              </button>
              <button
                onClick={() => {
                  window.location.href = "/create-exercise";
                }}
                className="excerciselist__menu__buttons--newexercise"
              >
                New Exercise
              </button>
            </div>
          </div>
          <div className="excerciselist__exercise__wrapper">
            <div className="excerciselist__exercise">
              <div className="excerciselist__exercise__variants">3</div>
              <div className="excerciselist__exercise__img">
                <img
                  src="https://www.yoursportplanner.com/en/uploads/dt_images/994898c7407ab9670b301c568bfbfcd9c3bc17d21fab6.webp"
                  alt="exercise"
                />
              </div>
              <div className="excerciselist__exercise__content">
                <h3>Exercise 1</h3>
                <p>
                  Technik für einen kontrollierten, flattrigen Aufschlag ohne
                  Spin...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExcerciseList;
