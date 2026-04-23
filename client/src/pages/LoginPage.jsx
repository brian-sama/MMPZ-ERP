import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const { login, authError, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (error) {
            // Error messaging is handled in auth context.
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-kicker">Mission Operations</div>
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

                <form onSubmit={handleSubmit} className="content-stack">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="email">Email Address</label>
                        <div className="selection-card auth-field">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Mail size={16} color="var(--text-muted)" />
                                <input
                                    id="email"
                                    type="email"
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
                                    type="password"
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
