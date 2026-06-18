import { useState } from "react";
import { Link } from "react-router-dom";
import { sendResetPasswordEmail } from "../../../../auth/auth";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    try {
      await sendResetPasswordEmail(email);
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes("auth/user-not-found") || msg.includes("auth/invalid-email")) {
          setErrorMessage("No account found for this email address.");
        } else if (msg.includes("auth/too-many-requests")) {
          setErrorMessage("Too many attempts. Please wait a moment and try again.");
        } else {
          setErrorMessage("Something went wrong. Please try again.");
        }
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <main className="login section">
      <div>
        <div className="login__title">
          <h3>Reset password</h3>
        </div>

        {status === "sent" ? (
          <div className="login__reset-success">
            <p>
              A password reset link has been sent to <strong>{email}</strong>.
              Check your inbox and follow the link to set a new password.
            </p>
            <Link to="/login" className="login__btn" style={{ display: "block", textAlign: "center", marginTop: "1.6rem" }}>
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <p className="login__reset-hint">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {status === "error" && errorMessage && (
              <div className="login__error">{errorMessage}</div>
            )}

            <form onSubmit={onSubmit}>
              <div className="login__input__wrapper">
                <div className="login__input__field">
                  <input
                    id="email"
                    type="email"
                    className="login__input"
                    autoComplete="email"
                    required
                    value={email}
                    placeholder=" "
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <label className="login__label text-select-none" htmlFor="email">
                    Your email address
                  </label>
                </div>
              </div>

              <button
                className="login__btn"
                type="submit"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="login__reset-back">
              <Link to="/login">Back to login</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ResetPassword;
