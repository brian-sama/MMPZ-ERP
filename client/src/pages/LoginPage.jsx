import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const { login, authError, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState(() => {
        try {
            return localStorage.getItem('mmpz_erp_saved_email') || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(() => {
        try {
            return localStorage.getItem('mmpz_erp_remember_me') !== 'false';
        } catch {
            return true;
        }
    });

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const user = await login(email, password);

            try {
                if (rememberMe) {
                    localStorage.setItem('mmpz_erp_saved_email', email.trim());
                    localStorage.setItem('mmpz_erp_remember_me', 'true');
                } else {
                    localStorage.removeItem('mmpz_erp_saved_email');
                    localStorage.setItem('mmpz_erp_remember_me', 'false');
                }
            } catch {
                // Ignore storage errors
            }

            // Web Credential Management API (Google Password Manager, Authenticator autofill, Chrome/Edge/Safari/Firefox credential store)
            if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials) {
                try {
                    const cred = new window.PasswordCredential({
                        id: email.trim(),
                        password: password.trim(),
                        name: (user && user.name) || email.trim(),
                    });
                    await navigator.credentials.store(cred);
                } catch {
                    // Silently ignore browser credential store exceptions
                }
            }

            navigate('/dashboard');
        } catch (error) {
            // Error messaging is handled in auth context.
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <img src="/mmpz-logo.png" alt="MMPZ" />
                </div>

                <div className="auth-heading">
                    <h1>MMPZ ERP</h1>
                    <p>Secure access for staff, facilitators, and program operations.</p>
                </div>

                {authError && (
                    <div className="auth-error">
                        {authError}
                    </div>
                )}

                <form
                    method="post"
                    action="#"
                    autoComplete="on"
                    onSubmit={handleSubmit}
                    className="content-stack"
                >
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="username">Email Address</label>
                        <div className="selection-card auth-field">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Mail size={16} color="var(--text-muted)" />
                                <input
                                    id="username"
                                    name="username"
                                    type="email"
                                    autoComplete="username email"
                                    className="form-input"
                                    style={{ border: 'none', boxShadow: 'none', background: 'transparent', paddingLeft: 0, paddingRight: 0 }}
                                    placeholder="name@mmpz.org"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="password">Password</label>
                        <div className="selection-card auth-field">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <LockKeyhole size={16} color="var(--text-muted)" />
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    className="form-input"
                                    style={{ border: 'none', boxShadow: 'none', background: 'transparent', paddingLeft: 0, paddingRight: 0 }}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                style={{ accentColor: 'var(--color-primary)' }}
                            />
                            <span>Save login details on this device</span>
                        </label>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    <strong>MMPZ Internal Platform</strong>
                    <p>Coordinating programs, finance, governance, and field reporting in one workspace.</p>
                    <p className="form-hint" style={{ marginTop: '10px' }}>
                        © {new Date().getFullYear()} Million Memory Project Zimbabwe
                    </p>
                </div>
            </div>
        </div>
    );
}
