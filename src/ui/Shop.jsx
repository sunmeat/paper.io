import { useMemo, useState } from 'react';
import { Check, Coins, Lock, ShoppingBag, X, Trophy, Sparkles, Crown, Footprints, Eye, Gift } from 'lucide-react';
import { getDailyQuests, useGameStore } from '../store/gameStore.js';
import { HATS, isUnlocked, RARITY, SKINS, TRAIL_EFFECTS, getSkinById } from '../engine/skins.js';
import { ACHIEVEMENTS } from '../engine/achievements.js';
import { useT } from '../i18n.js';

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
  const profile = useGameStore(state => state);
  const claimCosmeticReward = useGameStore(state => state.claimCosmeticReward);
  const dailyStreak = useGameStore(state => state.dailyStreak);
  const lastDailyClaimDate = useGameStore(state => state.lastDailyClaimDate);
  const dailyQuestProgress = useGameStore(state => state.dailyQuestProgress);
  const dailyQuestClaims = useGameStore(state => state.dailyQuestClaims);
  const claimDailyQuest = useGameStore(state => state.claimDailyQuest);
  const claimDailyReward = useGameStore(state => state.claimDailyReward);
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
  const progress = useMemo(() => ({ level: profile.level || 1, captured: profile.totalTerritory || 0 }), [profile.level, profile.totalTerritory]);
  const now = new Date();
  const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const todaysQuests = getDailyQuests();
  const questProgress = dailyQuestProgress?.[todayKey] || {};
  const claimedQuests = dailyQuestClaims?.[todayKey] || [];
  const calendarClaimed = lastDailyClaimDate === todayKey;
  const previewSkin = getSkinById(previewId);
  const rarityName = rarity => RARITY[rarity]?.[language] || RARITY.common[language];
  const unlockLabel = item => {
    const unlock = item.unlock || {};
    const labels = {
      'round-territory': language === 'ru' ? `Территория за раунд: ${unlock.target}%` : `Round territory: ${unlock.target}%`,
      'round-kills': language === 'ru' ? `Убийств за раунд: ${unlock.target}` : `Round kills: ${unlock.target}`,
      'win-streak': language === 'ru' ? `Серия побед: ${unlock.target}` : `Win streak: ${unlock.target}`,
      'total-kills': language === 'ru' ? `Всего убийств: ${unlock.target}` : `Total kills: ${unlock.target}`,
      country: language === 'ru' ? `Страна: ${unlock.country}` : `Country: ${unlock.country}`,
      sprint: language === 'ru' ? `Победы в спринте: ${unlock.wins}` : `Sprint wins: ${unlock.wins}`,
      level: language === 'ru' ? `Уровень ${unlock.level}` : `Level ${unlock.level}`,
      quest: language === 'ru' ? `${unlock.captured} клеток захвата` : `${unlock.captured} cells captured`,
      achievement: language === 'ru' ? 'Достижение' : 'Achievement'
    };
    return labels[unlock.type] || (language === 'ru' ? 'Бесплатно' : 'Free');
  };
  const unlockProgress = item => {
    const unlock = item.unlock || {};
    const current = unlock.type === 'round-territory' ? (profile.lastRoundTerritory || 0)
      : unlock.type === 'round-kills' ? (profile.lastRoundKills || 0)
      : unlock.type === 'win-streak' ? (profile.winStreak || 0)
      : unlock.type === 'total-kills' ? (profile.totalKills || 0)
      : unlock.type === 'country' ? ((profile.completedCountries || []).includes(unlock.country) ? 1 : 0)
      : unlock.type === 'sprint' ? (profile.sprintWins || 0)
      : unlock.type === 'level' ? (profile.level || 1)
      : unlock.type === 'quest' ? (profile.totalTerritory || 0) : 0;
    const target = unlock.type === 'round-territory' ? unlock.target
      : unlock.type === 'round-kills' || unlock.type === 'total-kills' || unlock.type === 'win-streak' ? unlock.target
      : unlock.type === 'country' ? 1
      : unlock.type === 'sprint' ? unlock.wins
      : unlock.type === 'level' ? unlock.level
      : unlock.type === 'quest' ? unlock.captured : 1;
    const suffix = unlock.type === 'round-territory' ? '%' : '';
    return `${Math.min(Number(target) || 0, Number(current) || 0)} / ${target}${suffix}`;
  };
  const report = result => {
    if (result.ok) setNotice(language === 'ru' ? 'Получено! Предмет экипирован.' : 'Unlocked! Item equipped.');
    else if (result.reason === 'coins') setNotice(language === 'ru' ? 'Не хватает монет.' : 'Not enough coins.');
    else if (result.reason === 'unlock') setNotice(language === 'ru' ? 'Этот скин открывается за задание.' : 'This skin is earned through a quest.');
    else setNotice(language === 'ru' ? 'Пока недоступно.' : 'Not available yet.');
  };
  const ownedForTab = tab === 'hats' ? ownedHats : ownedTrails;
  const equippedForTab = tab === 'hats' ? equippedHat : equippedTrail;
  const cosmeticType = tab === 'hats' ? 'hat' : 'trail';

  const renderCosmeticCard = item => {
    const has = ownedForTab.includes(item.id);
    const active = equippedForTab === item.id;
    const unlockable = item.unlock && item.unlock.type !== 'free';
    const canClaim = unlockable && isUnlocked(item, profile);
    return (
      <article className="skin-card cosmetic-card" key={item.id} style={{ '--rarity-color': RARITY[item.rarity]?.color || RARITY.common.color }}>
        <button type="button" className="skin-preview cosmetic-preview" style={{ '--skin-color': item.color || previewSkin.color }} onClick={() => tab === 'hats' ? setPreviewHatId(item.id) : setPreviewTrailId(item.id)} aria-label={(language === 'ru' ? 'Предпросмотр ' : 'Preview ') + item.name[language]}>
          <span className={tab === 'hats' ? 'cosmetic-symbol' : 'trail-preview shape-circle'}>{tab === 'hats' ? item.icon : (item.id === 'comet' ? '✦' : item.id === 'spark' ? '✧' : item.id === 'glow' ? '●' : '·')}</span>
        </button>
        <strong>{item.name[language] || item.name.ru}</strong>
        <span className="skin-rarity">{rarityName(item.rarity)}</span>
        <span className="skin-price">{has ? <><Check size={13} />{active ? (language === 'ru' ? 'Выбрано' : 'Equipped') : (language === 'ru' ? 'Получено' : 'Owned')}</> : unlockable ? <><Sparkles size={13} />{unlockLabel(item)}</> : <><Coins size={13} />{item.price}</>}</span>
        {!has && unlockable && <small className="unlock-progress">{unlockProgress(item)}</small>}
        <button className="skin-action" disabled={active} onClick={() => report(has ? (equipCosmetic(cosmeticType, item.id), { ok: true }) : canClaim ? claimCosmeticReward(cosmeticType, item.id) : unlockable ? { ok: false, reason: 'unlock' } : buyCosmetic(cosmeticType, item.id))}>
          {active ? (language === 'ru' ? 'Выбрано' : 'Equipped') : has ? (language === 'ru' ? 'Выбрать' : 'Equip') : canClaim ? (language === 'ru' ? 'Забрать' : 'Claim') : unlockable ? <><Lock size={12}/>{language === 'ru' ? 'Условие' : 'Locked'}</> : (language === 'ru' ? 'Купить' : 'Buy')}
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
        <div className="collection-count">{language === 'ru' ? 'Коллекция' : 'Collection'} <strong>{owned.length}/{SKINS.length}</strong></div>
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
          const canClaim = unlockable && isUnlocked(skin, profile);
          return (
            <article className={'skin-card rarity-' + skin.rarity + (previewId === skin.id ? ' skin-preview-selected' : '')} key={skin.id} style={{ '--rarity-color': RARITY[skin.rarity]?.color || RARITY.common.color }}>
              <button className={'skin-preview pattern-' + skin.pattern} style={{ '--skin-color': skin.color }} onClick={() => setPreviewId(skin.id)} aria-label={(language === 'ru' ? 'Предпросмотр ' : 'Preview ') + skin.name[language]}><span className={'trail-preview shape-' + skin.trailShape} /></button>
              <strong>{skin.name[language] || skin.name.ru}</strong>
              <span className="skin-rarity">{rarityName(skin.rarity)}</span>
              <span className="skin-price">{has ? <><Check size={13} />{active ? (language === 'ru' ? 'Выбран' : 'Equipped') : (language === 'ru' ? 'Куплен' : 'Owned')}</> : unlockable ? <><Sparkles size={13} />{unlockLabel(skin)}</> : <><Coins size={13} />{skin.price}</>}</span>
              {!has && unlockable && <small className="unlock-progress">{unlockProgress(skin)}</small>}
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
        {tab === 'ach' && <div className="quest-workspace">
          <section className="daily-calendar">
            <div className="quest-section-heading"><div><span className="eyebrow">{t('dailyCalendar')}</span><strong>{t('streak')}: {Math.min(7, dailyStreak)}/7</strong></div><Gift size={20} /></div>
            <div className="calendar-days">{Array.from({ length: 7 }, (_, index) => {
              const dayNumber = index + 1;
              const complete = dayNumber <= Math.min(7, dailyStreak);
              return <div className={'calendar-day' + (complete ? ' calendar-day-complete' : '')} key={dayNumber}><small>{t('day')} {dayNumber}</small><strong>{[100,125,150,175,200,225,250][index]}</strong><span>{complete ? <Check size={13}/> : <Coins size={12}/>}</span></div>;
            })}</div>
            <button className="primary-button calendar-claim" disabled={calendarClaimed} onClick={() => { const result = claimDailyReward(); setNotice(result.ok ? (language === 'ru' ? 'Получено +' : 'Claimed +') + result.reward + ' 🪙' : t(result.reason === 'wait' ? 'dailyWait' : 'dailyClaimed')); }}>{calendarClaimed ? t('claimed') : t('claim') + ' · ' + (100 + Math.min(6, dailyStreak) * 25) + ' 🪙'}</button>
          </section>
          <section className="daily-quests">
            <span className="eyebrow">{t('dailyQuests')}</span>
            {todaysQuests.map(quest => {
              const amount = Math.min(quest.target, Number(questProgress[quest.id]) || 0);
              const claimed = claimedQuests.includes(quest.id);
              const title = quest.type === 'kills' ? t('questKill') : quest.type === 'territory' ? t('questTerritory') : t('questPlay');
              const current = quest.type === 'territory' ? amount.toFixed(3) + '%' : amount;
              return <article className={'daily-quest-card' + (claimed ? ' quest-claimed' : '')} key={quest.id}>
                <div className="daily-quest-copy"><strong>{title}</strong><small>{t('questProgress')}: {current} / {quest.target}{quest.type === 'territory' ? '%' : ''}</small></div>
                <span className="quest-reward"><Coins size={13}/>{quest.reward}</span>
                <div className="quest-progress-track"><i style={{ width: Math.min(100, amount / quest.target * 100) + '%' }}/></div>
                <button className="skin-action" disabled={claimed || amount < quest.target} onClick={() => { const result = claimDailyQuest(quest.id); setNotice(result.ok ? (language === 'ru' ? 'Задание выполнено: +' : 'Quest claimed: +') + result.reward + ' 🪙' : t('questIncomplete')); }}>{claimed ? t('claimed') : amount >= quest.target ? t('claim') : t('questIncomplete')}</button>
              </article>;
            })}
          </section>
          <section className="achievement-list"><span className="eyebrow">{language === 'ru' ? 'ДОСТИЖЕНИЯ' : 'ACHIEVEMENTS'}</span>{ACHIEVEMENTS.map(item => {
            const unlocked = achievements.includes(item.id);
            return <div className={'achievement-row ' + (unlocked ? 'unlocked' : '')} key={item.id}><span className="achievement-icon">{unlocked ? item.icon : '🔒'}</span><div><strong>{item.title[language] || item.title.en}</strong><small>{item.description[language] || item.description.en}</small></div>{unlocked ? <Check size={16} /> : <Lock size={15} />}</div>;
          })}</section>
        </div>}
        {notice && <p className="shop-notice" role="status">{notice}</p>}
        <button className="secondary-button shop-close" onClick={onClose}>{t('close')}</button>
      </section>
    </div>
  );
}
