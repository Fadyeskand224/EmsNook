import { useEffect, useState } from 'react';
import { forgotPassword, logIn, resetPassword, signUp } from '../lib/auth';
import { SpineFace } from './Book';
import { Candles, Decor } from './Plants';
import { spineDesign } from '../lib/spine';
import { woodVars } from '../lib/themes';

const SAMPLE = ['Pride and Prejudice', 'Dune', 'The Hobbit', 'Beloved', 'Jane Eyre', 'Circe', 'Middlemarch', 'Rebecca', 'The Secret History', 'Emma', 'Persuasion', 'Kindred', 'Piranesi', 'Wolf Hall']
  .map((title, i) => ({ workKey: `OL${i + 7}W`, title, authors: [''], pages: 180 + ((i * 97) % 380) }));

// A password box with an eye that shows what has been typed.
function PasswordField({ label, value, onChange, autoComplete, placeholder }) {
  const [shown, setShown] = useState(false);
  return (
    <label>{label}
      <span className="pw-wrap">
        <input type={shown ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="button" className="pw-eye" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M4 20 20 4" />}
          </svg>
        </button>
      </span>
    </label>
  );
}

// The reset link arrives as /#reset=TOKEN. It is read once and removed from the address bar straight away.
const takeResetToken = () => {
  const m = /^#reset=([\w-]{20,100})$/.exec(window.location.hash);
  if (m) history.replaceState(null, '', window.location.pathname + window.location.search);
  return m ? m[1] : '';
};

export default function Login({ onAuthed }) {
  const [resetToken, setResetToken] = useState(takeResetToken);
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login'); // login | signup | forgot | reset
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [notice, setNotice] = useState('');
  // opening a reset link while this page is already open
  useEffect(() => {
    const on = () => { const t = takeResetToken(); if (t) { setResetToken(t); setMode('reset'); setError(''); setNotice(''); setForm((f) => ({ ...f, password: '', confirm: '' })); } };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if ((mode === 'signup' || mode === 'reset') && form.password !== form.confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') setNotice(await forgotPassword(form.email));
      else onAuthed(mode === 'login' ? await logIn(form) : mode === 'reset' ? await resetPassword({ token: resetToken, ...form }) : await signUp(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-hero" aria-hidden="true" style={woodVars('walnut')}>
        <div className="login-hang"><Decor kind="hang-philo" /></div>
        <div className="login-shelf">
          <div className="login-row">
            {SAMPLE.map((b) => {
              const d = spineDesign(b);
              return <div key={b.workKey} className="login-spine" style={{ width: d.width * 1.5, height: d.height * 1.5 }}><div style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}><SpineFace book={b} design={d} /></div></div>;
            })}
            <div className="login-decor photo"><Decor kind="monstera" /></div>
            <div className="login-decor"><Candles /></div>
          </div>
          <div className="plank" style={{ height: 20 }} />
        </div>
        <div className="login-glow" />
      </div>

      <form className="login-card" onSubmit={submit}>
        <h1>EmsNook</h1>
        <p className="tagline">A cozy corner for every book you’ve loved, and the ones you’re about to.</p>
        {(mode === 'login' || mode === 'signup') && (
          <div className="seg">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Log in</button>
            <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Sign up</button>
          </div>
        )}
        {mode === 'forgot' && <p className="login-note"><b>Forgot your password?</b> Enter your email and we’ll send you a link to choose a new one.</p>}
        {mode === 'reset' && <p className="login-note"><b>Choose a new password.</b> You’ll be signed in once it’s saved.</p>}
        {mode === 'signup' && (
          <label>Name<input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your name" required /></label>
        )}
        {mode !== 'reset' && (
          <label>Email<input type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required /></label>
        )}
        {mode !== 'forgot' && (
          <PasswordField label={mode === 'reset' ? 'New password' : 'Password'} value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} />
        )}
        {(mode === 'signup' || mode === 'reset') && (
          <PasswordField label="Confirm password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" placeholder="Type it again" />
        )}
        {mode === 'login' && <button type="button" className="link-btn forgot-link" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Forgot password?</button>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="form-notice" role="status">{notice}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'One moment…' : { login: 'Step inside', signup: 'Create my nook', forgot: 'Send me a reset link', reset: 'Save new password' }[mode]}
        </button>
        {(mode === 'forgot' || mode === 'reset') && <button type="button" className="link-btn forgot-link" onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Back to log in</button>}
      </form>
    </div>
  );
}
