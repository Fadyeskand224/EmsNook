import { useEffect, useState } from 'react';
import { SHOP } from '../../shared/items';
import { shopThumbs } from '../room/thumbs';

const SIZE_LABEL = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' };
const TABS = [['plants', 'Plants'], ['decor', 'Decor'], ['mine', 'In my library']];

/** The nook shop: coins come from finishing books, and everything bought can be placed anywhere in the 3D library. */
export default function Shop({ economy, finished, onBuy, onPlace, onClose }) {
  const [tab, setTab] = useState('plants');
  const [thumbs, setThumbs] = useState({});
  const [busy, setBusy] = useState('');
  const [bought, setBought] = useState(null); // the item just bought, offered for placing straight away
  useEffect(() => { let on = true; shopThumbs(SHOP.map((i) => i.kind)).then((t) => on && setThumbs(t)); return () => { on = false; }; }, []);
  const byKind = Object.fromEntries(SHOP.map((i) => [i.kind, i]));
  const mine = economy.items;

  const buy = async (def) => {
    setBusy(def.kind);
    try { setBought(await onBuy(def.kind)); } finally { setBusy(''); }
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Nook shop">
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet shop-sheet">
        <header>
          <h2>Nook shop</h2>
          <div className="shop-coins" aria-label={`${economy.coins} coins`}><span className="coin" aria-hidden="true" />{economy.coins}</div>
          <button className="viewer-close static" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p className="shop-lead">Every book you finish earns 5 to 10 coins, once per book. These are rewards to work towards: save up, then place your plants and treasures <b>anywhere</b> in the library.{finished === 0 && ' Mark a book as finished to earn your first coins.'}</p>
        <div className="seg shop-tabs">
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}{k === 'mine' && mine.length ? ` (${mine.length})` : ''}</button>)}
        </div>

        {bought && (
          <div className="shop-bought" role="status">
            <span>Bought <b>{byKind[bought.kind]?.name}</b>!</span>
            <button className="btn btn-primary btn-small" onClick={() => onPlace(bought.id)}>Place it now</button>
            <button className="link-btn" onClick={() => setBought(null)}>Later</button>
          </div>
        )}

        {tab !== 'mine' ? (
          <div className="shop-grid">
            {SHOP.filter((i) => i.group === tab).map((def) => {
              const can = economy.coins >= def.price;
              return (
                <div key={def.kind} className={`shop-card ${can ? '' : 'locked'}`}>
                  <div className="shop-pic">{thumbs[def.kind] ? <img src={thumbs[def.kind]} alt="" /> : <span className="spinner" />}</div>
                  <h3>{def.name}</h3>
                  <small>{SIZE_LABEL[def.size]} · {def.blurb}</small>
                  <button className="btn btn-small shop-buy" disabled={!can || busy === def.kind} onClick={() => buy(def)}>
                    <span className="coin" aria-hidden="true" />{def.price}{!can && <i> · {def.price - economy.coins} more</i>}
                  </button>
                </div>
              );
            })}
          </div>
        ) : mine.length === 0 ? (
          <p className="shop-empty">Nothing yet. Buy a plant in the shop and it will wait here until you place it.</p>
        ) : (
          <div className="shop-grid">
            {mine.map((it) => (
              <div key={it.id} className="shop-card">
                <div className="shop-pic">{thumbs[it.kind] ? <img src={thumbs[it.kind]} alt="" /> : <span className="spinner" />}</div>
                <h3>{byKind[it.kind]?.name}</h3>
                <small>{it.placed ? 'Standing in your library' : 'Waiting in the box'}</small>
                <button className="btn btn-small btn-primary" onClick={() => onPlace(it.id)}>{it.placed ? 'Move or put away' : 'Place it'}</button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
