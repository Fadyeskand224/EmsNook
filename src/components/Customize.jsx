import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, LIGHTS, DECORS, FILLS, ROOM_OPTIONS } from '../../shared/options.js';
import { DECOR_LABELS, FILL_LABELS, LIGHT, WALLPAPERS, WOODS, wallpaperLabel, wallpaperStyle, woodLabel, woodSwatch } from '../lib/themes';
import { LABELS, SWATCH, TABS, TITLES } from '../room/looks';

function Swatches({ ids, value, onPick, art, label }) {
  return (
    <div className="swatches" role="radiogroup">
      {ids.map((id) => (
        <button key={id} role="radio" aria-checked={value === id} className={`sw ${value === id ? 'on' : ''}`} onClick={() => onPick(id)}>
          <span className="sw-art" style={art(id)} />
          <small>{label(id)}</small>
        </button>
      ))}
    </div>
  );
}

/** One restyling choice: coloured dots when it is a colour, otherwise wrapping chips. */
function Choice({ k, settings, onChange }) {
  const ids = k === 'light' ? LIGHTS : k === 'fill' ? FILLS : ROOM_OPTIONS[k];
  const label = (id) => (k === 'light' ? LIGHT[id].label : k === 'fill' ? FILL_LABELS[id] : LABELS[k][id]);
  const dots = SWATCH[k];
  return (
    <section>
      <h3>{TITLES[k]}</h3>
      {dots ? (
        <div className="dots" role="radiogroup" aria-label={TITLES[k]}>
          {ids.map((id) => (
            <button key={id} role="radio" aria-checked={settings[k] === id} className={`dot ${settings[k] === id ? 'on' : ''} ${dots[id] === 'transparent' ? 'none' : ''}`} onClick={() => onChange({ [k]: id })}>
              <i style={{ background: dots[id] }} /><small>{label(id)}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="chips-row" role="radiogroup" aria-label={TITLES[k]}>
          {ids.map((id) => <button key={id} role="radio" aria-checked={settings[k] === id} className={settings[k] === id ? 'on' : ''} onClick={() => onChange({ [k]: id })}>{label(id)}</button>)}
        </div>
      )}
    </section>
  );
}

export default function Customize({ settings, onChange, onClose, room }) {
  const [tab, setTab] = useState('look');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const look = (
    <>
      <section>
        <h3>Wallpaper</h3>
        <Swatches ids={WALLPAPERS} value={settings.wallpaper} onPick={(wallpaper) => onChange({ wallpaper })} art={wallpaperStyle} label={wallpaperLabel} />
      </section>
      <section>
        <h3>Wood finish</h3>
        <Swatches ids={WOODS} value={settings.wood} onPick={(wood) => onChange({ wood })} art={woodSwatch} label={woodLabel} />
      </section>
    </>
  );

  return (
    <aside className={`custom ${room ? 'room-custom' : ''}`} role="dialog" aria-label="Customize your library">
      <div className="grab" aria-hidden="true" />
      <header>
        <h2>Make it yours</h2>
        <button className="viewer-close static" onClick={onClose} aria-label="Close">×</button>
      </header>
      {room && (
        <nav className="custom-tabs" role="tablist" aria-label="What to change">
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.title}</button>)}
        </nav>
      )}
      <div className="custom-body">
        {room ? (
          <>
            {tab === 'look' && look}
            {TABS.filter((t) => t.id === tab && t.keys).map((t) => t.keys.map((k) => <Choice key={k} k={k} settings={settings} onChange={onChange} />))}
            {tab === 'shelves' && <p className="custom-note">Shelves start empty. Hold a book and drop it wherever you like to build your own library.</p>}
          </>
        ) : (
          <>
            {look}
            <section>
              <h3>Lighting</h3>
              <div className="seg wide" role="radiogroup">
                {LIGHTS.map((id) => <button key={id} role="radio" aria-checked={settings.light === id} className={settings.light === id ? 'on' : ''} onClick={() => onChange({ light: id })}>{LIGHT[id].label}</button>)}
              </div>
            </section>
            <section>
              <h3>Shelves</h3>
              <div className="seg wide" role="radiogroup">
                {FILLS.map((id) => <button key={id} role="radio" aria-checked={settings.fill === id} className={settings.fill === id ? 'on' : ''} onClick={() => onChange({ fill: id })}>{FILL_LABELS[id]}</button>)}
              </div>
            </section>
            <section>
              <h3>The room</h3>
              <div className="seg wide" role="radiogroup">
                {DECORS.map((id) => <button key={id} role="radio" aria-checked={settings.decor === id} className={settings.decor === id ? 'on' : ''} onClick={() => onChange({ decor: id })}>{DECOR_LABELS[id]}</button>)}
              </div>
            </section>
          </>
        )}
        <button className="link-btn" onClick={() => onChange(DEFAULT_SETTINGS)}>Reset to the original look</button>
      </div>
      <footer><button className="btn btn-primary btn-block" onClick={onClose}>Done</button></footer>
    </aside>
  );
}
