import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const { login, authError, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [focused, setFocused] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            // Error handled by context
        }
    };

    const inputStyle = (field) => ({
        width: '100%',
        padding: '13px 16px',
        background: 'rgba(255,255,255,0.07)',
        border: `1.5px solid ${focused === field ? '#7B2CBF' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '12px',
        color: '#E5E7EB',
        fontSize: '14px',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: focused === field ? '0 0 0 3px rgba(123,44,191,0.2)' : 'none',
    });

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 50%, #0B1220 100%)',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'DM Sans', sans-serif",
        }}>
            {/* Background glow blobs */}
            <div style={{
                position: 'absolute', top: '15%', left: '10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(123,44,191,0.1) 0%, transparent 70%)',
                filter: 'blur(60px)', pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', bottom: '10%', right: '10%',
                width: '400px', height: '400px',
                background: 'radial-gradient(circle, rgba(43,182,115,0.07) 0%, transparent 70%)',
                filter: 'blur(60px)', pointerEvents: 'none',
            }} />

            {/* Card */}
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'rgba(17, 24, 39, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(123,44,191,0.2)',
                borderRadius: '24px',
                padding: '44px 40px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                position: 'relative',
            }}>
                {/* Purple top accent */}
                <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #7B2CBF, #2BB673, transparent)',
                    borderRadius: '0 0 4px 4px',
                }} />

                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{
                        width: '80px', height: '80px',
                        background: 'white',
                        borderRadius: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(123,44,191,0.3)',
                    }}>
                        <img
                            src="/mmpz-logo.png"
                            alt="MMPZ"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                </div>

                {/* Heading */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{
                        fontSize: '22px', fontWeight: 800, color: '#E5E7EB',
                        fontFamily: "'Syne', sans-serif",
                        letterSpacing: '0.02em', margin: '0 0 6px',
                    }}>
                        MMPZ ERP
                    </h1>
                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                        Million Memory Project Zimbabwe
                    </p>

                </div>

                {/* Error */}
                {authError && (
                    <div style={{
                        padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', fontSize: '13px',
                    }}>
                        {authError}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={{
                            display: 'block', marginBottom: '7px',
                            fontSize: '12px', fontWeight: 600,
                            color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="admin@mmpz.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setFocused('email')}
                            onBlur={() => setFocused('')}
                            required
                            style={inputStyle('email')}
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block', marginBottom: '7px',
                            fontSize: '12px', fontWeight: 600,
                            color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setFocused('password')}
                            onBlur={() => setFocused('')}
                            required
                            style={inputStyle('password')}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '4px',
                            width: '100%',
                            padding: '14px',
                            background: loading ? '#4B5563' : 'linear-gradient(135deg, #7B2CBF, #5A189A)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: loading ? 'none' : '0 4px 20px rgba(123,44,191,0.4)',
                            letterSpacing: '0.02em',
                        }}
                        onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Footer */}
                <p style={{
                    textAlign: 'center', marginTop: '28px',
                    fontSize: '11px', color: '#374151',
                }}>
                    © {new Date().getFullYear()} Million Memory Project Zimbabwe
                </p>
            </div>
        </div>
    );
}
