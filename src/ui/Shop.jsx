import { useMemo, useState } from 'react';
import { Check, Coins, Lock, ShoppingBag, X, Trophy, Sparkles, Crown, Footprints, Eye } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { HATS, RARITY, SKINS, TRAIL_EFFECTS, getSkinById } from '../engine/skins.js';
import { useT } from '../i18n.js';

const ACH = [
  ['first-capture', '🎨', 'Первый захват', 'First capture', 'Замкни первый след', 'Close your first trail'],
  ['territory-10', '🗺️', 'Своя область', 'Territory builder', 'Займи 10% арены', 'Claim 10% of the arena'],
  ['territory-25', '👑', 'Владыка арены', 'Arena ruler', 'Займи 25% арены', 'Claim 25% of the arena'],
  ['first-round', '🏁', 'Первый раунд', 'First round', 'Заверши первый раунд', 'Finish your first round'],
  ['rounds-10', '🔥', 'Десять попыток', 'Ten rounds', 'Сыграй 10 раундов', 'Play 10 rounds'],
  ['daily-first', '🎁', 'Подарок судьбы', 'Daily bonus', 'Получи ежедневную награду', 'Claim a daily reward'],
  ['daily-7', '📅', 'Неделя в игре', 'A full week', 'Собери серию из 7 дней', 'Reach a 7-day streak']
];

function readProgress() {
  try {
    return {
      level: Math.max(1, Number(localStorage.getItem('paper-io-player-level')) || 1),
      captured: Math.max(0, Number(localStorage.getItem('paper-io-total-captured')) || 0)
    };
  } catch {
    return { level: 1, captured: 0 };
  }
}

export default function Shop({ onClose }) {
  const t = useT();
  const language = useGameStore(state => state.language === 'en' ? 'en' : 'ru');
  const coins = useGameStore(state => state.coins);
  const owned = useGameStore(state => state.ownedSkins);
  const equipped = useGameStore(state => state.equippedSkin);
  const ownedHats = useGameStore(state => state.ownedHats);
  const equippedHat = useGameStore(state => state.equippedHat);
  const ownedTrails = useGameStore(state => state.ownedTrails);
  const equippedTrail = useGameStore(state => state.equippedTrail);
  const achievements = useGameStore(state => state.achievements);
  const buy = useGameStore(state => state.buySkin);
  const claimSkinReward = useGameStore(state => state.claimSkinReward);
  const equip = useGameStore(state => state.equipSkin);
  const buyCosmetic = useGameStore(state => state.buyCosmetic);
  const equipCosmetic = useGameStore(state => state.equipCosmetic);
  const [tab, setTab] = useState('skins');
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState(equipped);
  const [previewHatId, setPreviewHatId] = useState(equippedHat);
  const [previewTrailId, setPreviewTrailId] = useState(equippedTrail);
  const progress = useMemo(readProgress, []);
  const previewSkin = getSkinById(previewId);
  const rarityName = rarity => RARITY[rarity]?.[language] || RARITY.common[language];
  const report = result => {
    if (result.ok) setNotice(language === 'ru' ? 'Получено! Предмет экипирован.' : 'Unlocked! Item equipped.');
    else if (result.reason === 'coins') setNotice(language === 'ru' ? 'Не хватает монет.' : 'Not enough coins.');
    else if (result.reason === 'unlock') setNotice(language === 'ru' ? 'Этот скин открывается за задание.' : 'This skin is earned through a quest.');
    else setNotice(language === 'ru' ? 'Пока недоступно.' : 'Not available yet.');
  };
  const ownedForTab = tab === 'hats' ? ownedHats : ownedTrails;
  const catalog = tab === 'hats' ? HATS : TRAIL_EFFECTS;
  const equippedForTab = tab === 'hats' ? equippedHat : equippedTrail;
  const cosmeticType = tab === 'hats' ? 'hat' : 'trail';

  const renderCosmeticCard = item => {
    const has = ownedForTab.includes(item.id);
    const active = equippedForTab === item.id;
    return (
      <article className="skin-card cosmetic-card" key={item.id} style={{ '--rarity-color': RARITY[item.rarity]?.color || RARITY.common.color }}>
        <button type="button" className="skin-preview cosmetic-preview" style={{ '--skin-color': item.color || previewSkin.color }} onClick={() => tab === 'hats' ? setPreviewHatId(item.id) : setPreviewTrailId(item.id)} aria-label={(language === 'ru' ? 'Предпросмотр ' : 'Preview ') + item.name[language]}>
          <span className={tab === 'hats' ? 'cosmetic-symbol' : 'trail-preview shape-circle'}>{tab === 'hats' ? item.icon : (item.id === 'comet' ? '✦' : item.id === 'spark' ? '✧' : item.id === 'glow' ? '●' : '·')}</span>
        </button>
        <strong>{item.name[language] || item.name.ru}</strong>
        <span className="skin-rarity">{rarityName(item.rarity)}</span>
        <span className="skin-price">{has ? <><Check size={13} />{active ? (language === 'ru' ? 'Выбрано' : 'Equipped') : (language === 'ru' ? 'Получено' : 'Owned')}</> : <><Coins size={13} />{item.price}</>}</span>
        <button className="skin-action" disabled={active} onClick={() => report(has ? (equipCosmetic(cosmeticType, item.id), { ok: true }) : buyCosmetic(cosmeticType, item.id))}>
          {active ? (language === 'ru' ? 'Выбрано' : 'Equipped') : has ? (language === 'ru' ? 'Выбрать' : 'Equip') : (language === 'ru' ? 'Купить' : 'Buy')}
        </button>
      </article>
    );
  };

  return (
    <div className="screen-overlay shop-overlay">
      <section className="dialog-card shop-card">
        <button className="close-button" onClick={onClose} aria-label={t('close')}><X size={19} /></button>
        <span className="eyebrow">CUSTOMIZE YOUR ARENA</span>
        <h1>{language === 'ru' ? 'Мастерская скинов' : 'Skin workshop'}</h1>
        <div className="shop-wallet"><Coins size={18} /><strong>{coins}</strong> {language === 'ru' ? 'монет' : 'coins'}</div>
        <div className="shop-preview-stage">
          <div className={'shop-mini-arena pattern-' + previewSkin.pattern} style={{ '--skin-color': previewSkin.color }}>
            <i className="mini-territory" />
            <i className={'mini-trail ' + (previewTrailId === 'glow' ? 'mini-trail-glow' : previewTrailId === 'comet' ? 'mini-trail-comet' : '')} style={{ '--skin-color': previewTrailId === 'none' ? previewSkin.color : TRAIL_EFFECTS.find(effect => effect.id === previewTrailId)?.color || previewSkin.color }} />
            <i className="mini-player" style={{ '--skin-color': previewSkin.color }} />
            {previewHatId !== 'none' && <span className="mini-hat">{HATS.find(hat => hat.id === previewHatId)?.icon}</span>}
          </div>
          <div className="shop-preview-copy">
            <span className="eyebrow"><Eye size={12} /> {language === 'ru' ? 'ПРЕДПРОСМОТР НА АРЕНЕ' : 'ARENA PREVIEW'}</span>
            <strong>{previewSkin.name[language] || previewSkin.name.ru}</strong>
            <small>{language === 'ru' ? 'Узор приглушён, границы и след остаются читаемыми.' : 'Subtle pattern keeps territory borders and trails readable.'}</small>
            <span className="skin-rarity" style={{ color: RARITY[previewSkin.rarity]?.color }}>{rarityName(previewSkin.rarity)}</span>
          </div>
        </div>
        <div className="shop-progress">
          <span>{language === 'ru' ? 'Уровень' : 'Level'} <strong>{progress.level}</strong></span>
          <span>{language === 'ru' ? 'Захвачено клеток' : 'Cells captured'} <strong>{progress.captured}</strong></span>
        </div>
        <div className="shop-tabs">
          <button className={tab === 'skins' ? 'selected' : ''} onClick={() => setTab('skins')}><ShoppingBag size={15} />{language === 'ru' ? 'Скины' : 'Skins'}</button>
          <button className={tab === 'hats' ? 'selected' : ''} onClick={() => setTab('hats')}><Crown size={15} />{language === 'ru' ? 'Шапки' : 'Hats'}</button>
          <button className={tab === 'trails' ? 'selected' : ''} onClick={() => setTab('trails')}><Footprints size={15} />{language === 'ru' ? 'Следы' : 'Trails'}</button>
          <button className={tab === 'ach' ? 'selected' : ''} onClick={() => setTab('ach')}><Trophy size={15} />{language === 'ru' ? 'Задания' : 'Quests'}</button>
        </div>
        {tab === 'skins' && <div className="skin-grid">{SKINS.map(skin => {
          const has = owned.includes(skin.id);
          const active = equipped === skin.id;
          const unlockable = skin.unlock && skin.unlock.type !== 'free';
          const canClaim = unlockable && (
            (skin.unlock.type === 'achievement' && achievements.includes(skin.unlock.id)) ||
            (skin.unlock.type === 'level' && progress.level >= skin.unlock.level) ||
            (skin.unlock.type === 'quest' && progress.captured >= skin.unlock.captured)
          );
          return (
            <article className={'skin-card rarity-' + skin.rarity + (previewId === skin.id ? ' skin-preview-selected' : '')} key={skin.id} style={{ '--rarity-color': RARITY[skin.rarity]?.color || RARITY.common.color }}>
              <button className={'skin-preview pattern-' + skin.pattern} style={{ '--skin-color': skin.color }} onClick={() => setPreviewId(skin.id)} aria-label={(language === 'ru' ? 'Предпросмотр ' : 'Preview ') + skin.name[language]}><span className={'trail-preview shape-' + skin.trailShape} /></button>
              <strong>{skin.name[language] || skin.name.ru}</strong>
              <span className="skin-rarity">{rarityName(skin.rarity)}</span>
              <span className="skin-price">{has ? <><Check size={13} />{active ? (language === 'ru' ? 'Выбран' : 'Equipped') : (language === 'ru' ? 'Куплен' : 'Owned')}</> : unlockable ? <><Sparkles size={13} />{language === 'ru' ? 'За прогресс' : 'Earn free'}</> : <><Coins size={13} />{skin.price}</>}</span>
              <button className="skin-action" disabled={active} onClick={() => {
                if (has) { equip(skin.id); setNotice(language === 'ru' ? 'Скин выбран.' : 'Skin equipped.'); setPreviewId(skin.id); }
                else if (canClaim) { report(claimSkinReward(skin.id)); setPreviewId(skin.id); }
                else if (unlockable) setNotice(language === 'ru' ? 'Выполни условие, чтобы получить бесплатно.' : 'Complete the requirement to claim it for free.');
                else { report(buy(skin.id)); setPreviewId(skin.id); }
              }}>{active ? (language === 'ru' ? 'Выбран' : 'Equipped') : has ? (language === 'ru' ? 'Выбрать' : 'Equip') : canClaim ? (language === 'ru' ? 'Забрать' : 'Claim') : unlockable ? <><Lock size={12} />{language === 'ru' ? 'Условие' : 'Locked'}</> : (language === 'ru' ? 'Купить' : 'Buy')}</button>
            </article>
          );
        })}</div>}
        {tab === 'hats' && <div className="skin-grid">{HATS.map(renderCosmeticCard)}</div>}
        {tab === 'trails' && <div className="skin-grid">{TRAIL_EFFECTS.map(renderCosmeticCard)}</div>}
        {tab === 'ach' && <div className="achievement-list">{ACH.map(item => {
          const unlocked = achievements.includes(item[0]);
          return <div className={'achievement-row ' + (unlocked ? 'unlocked' : '')} key={item[0]}><span className="achievement-icon">{unlocked ? item[1] : '🔒'}</span><div><strong>{item[language === 'ru' ? 2 : 3]}</strong><small>{item[language === 'ru' ? 4 : 5]}</small></div>{unlocked ? <Check size={16} /> : <Lock size={15} />}</div>;
        })}</div>}
        {notice && <p className="shop-notice" role="status">{notice}</p>}
        <button className="secondary-button shop-close" onClick={onClose}>{t('close')}</button>
      </section>
    </div>
  );
}
