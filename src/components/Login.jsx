import { useState } from 'react';
import { logIn, signUp } from '../lib/auth';
import { SpineFace } from './Book';
import { Candles, Decor } from './Plants';
import { spineDesign } from '../lib/spine';
import { woodVars } from '../lib/themes';

const SAMPLE = ['Pride and Prejudice', 'Dune', 'The Hobbit', 'Beloved', 'Jane Eyre', 'Circe', 'Middlemarch', 'Rebecca', 'The Secret History', 'Emma', 'Persuasion', 'Kindred', 'Piranesi', 'Wolf Hall']
  .map((title, i) => ({ workKey: `OL${i + 7}W`, title, authors: [''], pages: 180 + ((i * 97) % 380) }));

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      onAuthed(mode === 'login' ? await logIn(form) : await signUp(form));
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
        <div className="seg">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>
        {mode === 'signup' && (
          <label>Name<input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your name" required /></label>
        )}
        <label>Email<input type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Step inside' : 'Create my nook'}</button>
      </form>
    </div>
  );
}
