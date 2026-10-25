import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import useAdminAuth from "../context/useAdminAuth";
import { ApiError, loginAdmin } from "../services/api";
import "./Admin.css";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { csrfToken, setCsrfToken } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (csrfToken) navigate("/admin/dashboard", { replace: true });
  }, [csrfToken, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginAdmin({ username: username.trim(), password });
      if (!data.csrfToken) {
        throw new Error("Sign-in succeeded but the security token was missing. Try again.");
      }
      setCsrfToken(data.csrfToken);
      setPassword("");
      navigate("/admin/dashboard", { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        setError("Those administrator credentials were not accepted.");
      } else if (requestError instanceof ApiError && requestError.status === 429) {
        setError("Too many sign-in attempts. Wait a little before trying again.");
      } else if (requestError instanceof ApiError && requestError.status === 403) {
        setError("This page origin is not allowed by the backend configuration.");
      } else if (requestError instanceof ApiError && requestError.status >= 500) {
        setError("The sign-in service is unavailable. Try again shortly.");
      } else {
        setError(requestError.message || "Unable to sign in. Check the connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-auth-page">
      <div className="admin-auth-topbar">
        <Link to="/" className="admin-brand" aria-label="UrbanAI citizen home">
          <span className="admin-brand-mark">U</span>
          <span>Urban<span className="brand-accent">AI</span></span>
        </Link>
        <Link to="/" className="auth-back-link"><ArrowLeft size={15} /> Citizen portal</Link>
      </div>

      <div className="admin-login-layout">
        <section className="login-intro">
          <div className="admin-eyebrow"><Sparkles size={14} /> GOVERNMENT OPERATIONS</div>
          <h1>City issues.<br /><span>In clear view.</span></h1>
          <p>Sign in to review reported incidents and monitor service priorities across your city.</p>
          <div className="login-security-note">
            <ShieldCheck size={19} />
            <span>Restricted access for authorized administrators</span>
          </div>
          <div className="login-orbit orbit-one" />
          <div className="login-orbit orbit-two" />
          <div className="login-grid-glow" />
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-icon"><Building2 size={21} /></div>
          <span className="login-kicker">ADMINISTRATOR ACCESS</span>
          <h2 id="login-title">Welcome back</h2>
          <p className="login-description">Use your provisioned government administrator account.</p>

          {location.state?.notice && (
            <div className="login-notice" role="status">{location.state.notice}</div>
          )}

          {error && <div className="login-error" role="alert">{error}</div>}

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <label htmlFor="admin-username">Administrator username</label>
            <input
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
            />

            <div className="password-label-row">
              <label htmlFor="admin-password">Password</label>
              <span><LockKeyhole size={13} /> Secure sign-in</span>
            </div>
            <div className="password-input-wrap">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <button className="admin-submit" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in to console"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="login-card-footer">
            <LockKeyhole size={14} />
            <span>Your session is protected and automatically expires.</span>
          </div>
        </section>
      </div>
      <footer className="admin-auth-footer">© UrbanAI · City intelligence platform</footer>
    </main>
  );
}

export default AdminLogin;
