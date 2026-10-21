<!--
  sunmeat.io
  Bilingual project README: English / Русский
-->

<div align="center">

# sunmeat.io

### Claim the ground. Protect your trail. Expand your world.

**A mobile-first territory-capture arcade game built with React, Vite, and HTML Canvas.**

[English](#english) · [Русский](#русский)

<br />

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=111111)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Canvas](https://img.shields.io/badge/Rendering-Canvas-3DDC84?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![License](https://img.shields.io/badge/License-Not_specified-lightgrey?style=flat-square)](#license)

</div>

---

<a id="english"></a>

## 🇬🇧 English

**sunmeat.io** is an arcade game about territory, timing, and calculated risks. Leave the safety of your land, draw a closed loop, and turn the enclosed space into your own territory. The bigger the move, the more you have to lose while your trail is exposed.

The project is designed for quick sessions on both mobile and desktop, with a responsive interface and a Canvas-based arena.

### 🎮 How to play

1. **Move out** from your territory into unclaimed space.
2. **Draw a loop** and reconnect with your territory.
3. **Capture the enclosed area** when the loop closes.
4. **Watch your trail**: while you're outside your territory, it is vulnerable.
5. **Keep expanding** while avoiding roaming opponents.

### ✨ Features

- 📱 **Mobile-first controls** with touch gestures and an on-screen directional pad.
- ⌨️ **Desktop controls** with arrow keys or WASD.
- 🗺️ **Canvas arena** with a grid-based territory system.
- 🧠 **Roaming opponents** that make the arena less predictable.
- 🏆 **Local high score** to keep track of personal progress.
- ⚡ **React + Vite** development workflow.
- 🧪 **Automated tests and simulation tools** for development and balancing.

### 🕹️ Controls

| Platform | Controls |
| --- | --- |
| Mobile | Swipe across the arena or use the on-screen directional pad |
| Desktop | Arrow keys or **W A S D** |

### 🚀 Run locally

**Requirements:** Node.js and npm.

```bash
git clone https://github.com/sunmeat/sunmeat.io.git
cd sunmeat.io
npm install
npm run dev
```

Vite will print the local development URL in the terminal.

### 🏗️ Build and quality checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest test suite |
| `npm run lint` | Run ESLint |
| `npm run sim` | Run the game simulation script |
| `npm run benchmark` | Run the benchmark script |
| `npm run build:analyze` | Build with bundle analysis enabled |

### 🧰 Tech stack

- **React 19** and **React DOM** for the interface
- **Vite 8** for development and production builds
- **HTML Canvas** for arena rendering
- **Zustand** for state management
- **Lucide React** for interface icons
- **Vitest** and **ESLint** for testing and code quality
- **Vercel Analytics** for site analytics

### 🧭 Project status

sunmeat.io is an actively developed game prototype. Gameplay, balancing, and presentation may evolve as the project grows.

### 🤝 Contributing

Ideas, bug reports, and focused improvements are welcome. Please describe the issue clearly and include reproduction steps for gameplay bugs. For code changes, run the relevant tests and production build before submitting.

### 📄 License

No license is currently specified in this repository. Unless a license is added, the default copyright rules apply and reuse, redistribution, or modification is not automatically permitted.

---

<a id="русский"></a>

## 🇷🇺 Русский

**sunmeat.io** это аркадная игра о территориях, точном расчёте и риске. Покидай безопасную зону, замыкай контур и присоединяй захваченное пространство к своей территории. Чем масштабнее захват, тем больше ты рискуешь, пока твой след открыт для противников.

Проект создаётся с прицелом на быстрые игровые сессии на телефонах и компьютерах. Интерфейс адаптивный, а игровая арена отрисовывается с помощью Canvas.

### 🎮 Как играть

1. **Выйди за границы** своей территории в свободное пространство.
2. **Нарисуй замкнутый контур** и вернись на свою территорию.
3. **Захвати область внутри контура**, когда он замкнётся.
4. **Береги след**: за пределами своей территории он уязвим.
5. **Расширяй владения**, стараясь избегать перемещающихся противников.

### ✨ Возможности

- 📱 **Управление для мобильных устройств**: свайпы и экранная крестовина.
- ⌨️ **Управление на компьютере**: стрелки или клавиши WASD.
- 🗺️ **Игровая арена на Canvas** с сеточной системой территорий.
- 🧠 **Перемещающиеся противники**, которые делают игру менее предсказуемой.
- 🏆 **Локальный рекорд**, позволяющий отслеживать личный результат.
- ⚡ **React + Vite** для быстрой разработки.
- 🧪 **Автоматические тесты и инструменты симуляции** для проверки и настройки игры.

### 🕹️ Управление

| Платформа | Управление |
| --- | --- |
| Телефон или планшет | Свайп по арене или экранная крестовина |
| Компьютер | Стрелки или **W A S D** |

### 🚀 Запуск проекта

**Требования:** Node.js и npm.

```bash
git clone https://github.com/sunmeat/sunmeat.io.git
cd sunmeat.io
npm install
npm run dev
```

После запуска Vite выведет локальный адрес приложения в терминале.

### 🏗️ Сборка и проверка качества

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Запуск сервера разработки |
| `npm run build` | Создание production-сборки |
| `npm run preview` | Локальный просмотр production-сборки |
| `npm test` | Запуск тестов Vitest |
| `npm run lint` | Проверка кода с ESLint |
| `npm run sim` | Запуск сценария игровой симуляции |
| `npm run benchmark` | Запуск бенчмарка |
| `npm run build:analyze` | Сборка с анализом размера бандла |

### 🧰 Технологии

- **React 19** и **React DOM** для интерфейса
- **Vite 8** для разработки и production-сборки
- **HTML Canvas** для отрисовки арены
- **Zustand** для управления состоянием
- **Lucide React** для иконок интерфейса
- **Vitest** и **ESLint** для тестирования и контроля качества
- **Vercel Analytics** для аналитики сайта

### 🧭 Статус проекта

sunmeat.io находится в активной разработке и представляет собой игровой прототип. Механики, баланс и визуальное оформление могут меняться по мере развития проекта.

### 🤝 Участие в разработке

Приветствуются идеи, сообщения об ошибках и небольшие целевые улучшения. Описывая ошибку, укажи шаги для её воспроизведения. Перед отправкой изменений проверь соответствующие тесты и production-сборку.

### 📄 Лицензия

В репозитории пока не указана лицензия. Пока она не добавлена, действуют стандартные правила авторского права: использование, распространение и изменение кода не разрешены автоматически.

---

<div align="center">

**Built with focus, pixels, and a little territorial ambition.**

[Repository](https://github.com/sunmeat/sunmeat.io) · [Report a bug](https://github.com/sunmeat/sunmeat.io/issues)

</div>
