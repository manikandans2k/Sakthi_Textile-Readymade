import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, CheckCircle2, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect straight to landing page
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/pos');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please supply both your username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const loggedUser = await login(username, password);
      // Admin and Manager land on Dashboard; Cashier goes straight to POS terminal
      if (loggedUser.role === 'Super Admin') {
        navigate('/saas');
      } else if (loggedUser.role === 'Shop Owner' || loggedUser.role === 'Admin' || loggedUser.role === 'Manager') {
        navigate('/dashboard');
      } else if (loggedUser.role === 'Cashier') {
        navigate('/pos');
      } else if (loggedUser.role === 'Stock Manager') {
        navigate('/inventory');
      } else {
        navigate('/pos');
      }
    } catch (err) {
      setErrorMsg(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="boutique-login-wrapper">
      <style>{`
        /* Premium Boutique Glassmorphic Login Styles */
        .boutique-login-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100vw;
          overflow-x: hidden;
          overflow-y: auto;
          background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(15, 23, 42, 0.45) 100%), 
                            url('/luxury_boutique_bg.png');
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          padding: 24px;
          z-index: 0;
        }


        .boutique-card {
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 28px;
          box-shadow: 0 32px 80px -16px rgba(15, 23, 42, 0.18), 
                      inset 0 2px 4px 0 rgba(255, 255, 255, 0.5);
          z-index: 10;
          width: 100%;
          max-width: 440px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .boutique-input-group {
          background: rgba(244, 243, 238, 0.7);
          border: 1px solid rgba(212, 163, 115, 0.15);
          border-radius: 9999px;
          padding: 2px 16px;
          display: flex;
          align-items: center;
          transition: all 0.25s ease;
        }

        .boutique-input-group:focus-within {
          background: rgba(255, 255, 255, 0.95);
          border-color: #314E40;
          box-shadow: 0 0 0 3px rgba(49, 78, 64, 0.15);
        }

        .boutique-input-icon {
          color: #475569;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .boutique-input-field {
          background: transparent !important;
          border: none !important;
          color: #0F172A !important;
          font-size: 0.95rem;
          padding: 12px 0;
          width: 100%;
          outline: none !important;
          box-shadow: none !important;
        }

        .boutique-input-field::placeholder {
          color: #94A3B8;
        }

        .boutique-btn-primary {
          background-color: #2E4635 !important;
          border: none !important;
          color: #FFFFFF !important;
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 1rem;
          border-radius: 9999px;
          padding: 12px 28px;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 14px rgba(46, 70, 53, 0.25);
          transition: all 0.25s ease;
        }

        .boutique-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(46, 70, 53, 0.35);
          background-color: #354E3C !important;
        }

        .boutique-btn-primary:active {
          transform: translateY(1px);
        }

        .boutique-btn-primary:disabled {
          background: #A3B1A9 !important;
          box-shadow: none;
          transform: none;
        }

        .boutique-forgot-link {
          color: #475569;
          font-size: 0.8rem;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .boutique-forgot-link:hover {
          color: #0F172A;
          text-decoration: underline;
        }

        .boutique-logo-title {
          font-family: 'Poppins', sans-serif;
          color: #0F172A;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .boutique-logo-subtitle {
          font-family: 'Inter', sans-serif;
          color: #475569;
          font-size: 0.88rem;
          font-weight: 500;
          letter-spacing: 0.2px;
        }
      `}</style>


      <div className="container d-flex flex-column align-items-center" style={{ zIndex: 5 }}>
        {/* Brand header */}
        <div className="text-center mb-4">
          <svg className="d-block mx-auto mb-2" width="76" height="76" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Minimalist Outlined Clotheshanger Logo from mockup */}
            <path d="M32 17C32 17 34 10 28 10C22 10 25.5 16 30.5 18" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M32 18.5L8 36C8 36 7 37 9 37H55C57 37 56 36 56 36L32 18.5Z" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 33.5V42C24 43.5 25.2 44.5 26.5 44.5H37.5C38.8 44.5 40 43.5 40 42V33.5" stroke="#0F172A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 30L32 32.5L36 30" stroke="#0F172A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="boutique-logo-title m-0 fs-3">
            TexTile ERP
          </h2>
          <p className="boutique-logo-subtitle m-0 mt-1">
            Advanced Retail and Inventory Management
          </p>
        </div>

        {/* Glassmorphic Card Container */}
        <div className="boutique-card p-4 p-md-5">
          <h4 className="text-dark font-heading mb-4 text-center fw-bold" style={{ letterSpacing: '0.2px', fontSize: '1.25rem' }}>
            Sign In to Your Boutique
          </h4>

          {errorMsg && (
            <div className="custom-alert-warning d-flex align-items-center gap-2 p-3 mb-4 rounded-3 text-warning border-0" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
              <ShieldAlert size={18} className="flex-shrink-0" style={{ color: '#D97706' }} />
              <span style={{ fontSize: '0.85rem', color: '#D97706', fontWeight: '600' }}>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {/* Username Field */}
            <div>
              <label className="form-label text-dark font-heading fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                Email or Username
              </label>
              <div className="boutique-input-group">
                <span className="boutique-input-icon">
                  <User size={16} />
                </span>
                <input 
                  type="text" 
                  className="boutique-input-field" 
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="form-label text-dark font-heading fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                Password
              </label>
              <div className="boutique-input-group">
                <span className="boutique-input-icon">
                  <KeyRound size={16} />
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="boutique-input-field" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="btn border-0 p-0 ms-2 text-muted"
                  style={{ outline: 'none', boxShadow: 'none' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="d-flex justify-content-end mb-2">
              <a href="#forgot" className="boutique-forgot-link" onClick={(e) => { e.preventDefault(); alert("Please contact your Super Admin to reset credentials."); }}>
                Forgot Password?
              </a>
            </div>

            {/* Submit CTA Button */}
            <button 
              type="submit" 
              className="btn boutique-btn-primary w-100 d-flex align-items-center justify-content-center mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  <span>Entering Boutique...</span>
                </>
              ) : (
                <span>Access System</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
