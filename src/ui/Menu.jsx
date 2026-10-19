import { Coins, Gift, Settings2, ShoppingBag, Zap } from 'lucide-react';
import { MAPS, getMapPreview } from '../engine/maps.js';
import { useGameStore } from '../store/gameStore.js';
import { useT } from '../i18n.js';

export default function Menu({
  onPlay,
  onShop,
  onDaily,
  coins = 0,
  dailyClaimed = false,
  rewardNotice = ''
}) {
  const t = useT();
  const toggle = useGameStore(state => state.toggleSettings);
  const language = useGameStore(state => state.language);
  const selectedMap = useGameStore(state => state.selectedMap);
  const setSelectedMap = useGameStore(state => state.setSelectedMap);

  return (
    <main className="screen-shell menu-screen">
      <div className="menu-grid" />
      <div className="menu-content">
        <div className="menu-brand">
          <span className="brand-mark"><Zap size={22} fill="currentColor" /></span>
          <span>PAPER<span className="brand-dot">.IO</span></span>
        </div>
        <span className="eyebrow">CLAIM YOUR SPACE</span>
        <h1>{t('title')}</h1>
        <p>{t('subtitle')}</p>
        <div className="meta-wallet"><Coins size={17} /><strong>{coins}</strong><span>{language === 'ru' ? 'монет' : 'coins'}</span></div>
        <button className="primary-button menu-play" onClick={onPlay}><Zap size={18} />{t('play')}</button>
        <button className="secondary-button" onClick={onDaily} disabled={dailyClaimed}><Gift size={17} />{dailyClaimed ? t('dailyClaimed') : t('dailyReward')}</button>
        {rewardNotice && <p className="reward-notice" role="status">{rewardNotice}</p>}
        <button className="secondary-button" onClick={onShop}><ShoppingBag size={17} />{t('shop')}</button>
        <button className="secondary-button" onClick={toggle}><Settings2 size={17} />{t('settings')}</button>

        <section className="map-picker" aria-label={language === 'ru' ? 'Выбор карты' : 'Choose a map'} style={{ width: '100%', maxWidth: 380, margin: '10px auto', textAlign: 'left' }}>
          <span className="eyebrow">{language === 'ru' ? 'ФОРМА АРЕНЫ' : 'ARENA SHAPE'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
            {MAPS.map(map => (
              <button
                key={map.id}
                type="button"
                aria-pressed={selectedMap === map.id}
                onClick={() => setSelectedMap(map.id)}
                title={map.name[language] || map.name.en}
                style={{
                  minWidth: 0,
                  padding: '7px 2px',
                  borderRadius: 9,
                  border: selectedMap === map.id ? '1px solid #9b7bff' : '1px solid #34394a',
                  background: selectedMap === map.id ? '#25243b' : '#151823',
                  color: '#f5f5fb',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 4px)', gridTemplateRows: 'repeat(9, 4px)', gap: 1 }}>
                  {getMapPreview(map.id, 9).map((cell, index) => (
                    <i key={index} style={{ width: 4, height: 4, background: cell ? (selectedMap === map.id ? '#c1b0ff' : '#777f9d') : 'transparent', borderRadius: 1 }} />
                  ))}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{map.name[language] || map.name.en}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="menu-meta">10 RIVALS <span>•</span> ONE ARENA</div>
      </div>
    </main>
  );
}
