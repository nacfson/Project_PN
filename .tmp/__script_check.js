
    /* ============================================================
       CONFIG
       ============================================================ */
    const CONFIG = {
      theme: {
        seed: '#6750a4',
        defaultMode: 'light',
        highContrast: false,
        font: 'Roboto'
      },
      user: {
        name: 'Alex Kim',
        firstName: 'Alex',
        email: 'alex@example.com',
        avatar: 'A',
        xpGoal: 200
      },
      features: {
        onboarding: true,
        quizMode: true,
        pullToRefresh: true,
        customCursor: true,
        magneticButtons: true,
        tiltCards: true,
        confetti: true
      },
      screens: [
        { id: 'onboarding', label: 'Start', icon: 'flag', visible: false },
        { id: 'home', label: 'Learn', icon: 'home', visible: true },
        { id: 'words', label: 'Words', icon: 'book', visible: true },
        { id: 'add', label: 'Add', icon: 'add', visible: true },
        { id: 'practice', label: 'Practice', icon: 'school', visible: true },
        { id: 'settings', label: 'Settings', icon: 'settings', visible: true }
      ],
      content: {
        onboardingSlides: [
          { icon: 'menu_book', title: 'Build your vocabulary', desc: 'Add words from anywhere. We handle the spaced repetition schedule.' },
          { icon: 'school', title: 'Practice daily', desc: 'Swipe, flip, and quiz yourself with adaptive cards that match your level.' },
          { icon: 'emoji_events', title: 'Stay motivated', desc: 'Track streaks, XP, and mastery with beautiful Material You widgets.' }
        ],
        hero: {
          title: 'Ready to learn?',
          dueLabel: 'Due today',
          cta: 'Start review session'
        },
        wordOfTheDay: {
          word: 'serendipity',
          meaning: 'finding something good without looking for it'
        },
        emptyState: {
          title: 'No words found',
          subtitle: 'Try a different search or filter.'
        },
        masteryLabels: ['New', 'Learning', 'Review', 'Mastered']
      },
      sampleData: {
        words: [
          { id: 1, word: 'ephemeral', phonetic: '/əˈfem(ə)rəl/', meaning: 'lasting for a very short time', example: 'Fashions are ephemeral, changing with every season.', status: 'learning' },
          { id: 2, word: 'resilient', phonetic: '/rɪˈzɪliənt/', meaning: 'able to recover quickly', example: 'Children are often surprisingly resilient.', status: 'learning' },
          { id: 3, word: 'serendipity', phonetic: '/ˌserənˈdɪpɪti/', meaning: 'finding good things by chance', example: 'It was pure serendipity that we met.', status: 'new' },
          { id: 4, word: 'eloquent', phonetic: '/ˈeləkwənt/', meaning: 'fluent and persuasive', example: 'She made an eloquent appeal.', status: 'mastered' },
          { id: 5, word: 'pragmatic', phonetic: '/præɡˈmætɪk/', meaning: 'dealing with things sensibly', example: 'He took a pragmatic approach.', status: 'review' },
          { id: 6, word: 'ubiquitous', phonetic: '/juːˈbɪkwɪtəs/', meaning: 'present everywhere', example: 'Smartphones are ubiquitous.', status: 'learning' },
          { id: 7, word: 'mellifluous', phonetic: '/məˈlɪfluəs/', meaning: 'sweet-sounding', example: 'She had a mellifluous voice.', status: 'new' },
          { id: 8, word: 'sagacious', phonetic: '/səˈɡeɪʃəs/', meaning: 'wise and shrewd', example: 'A sagacious leader.', status: 'mastered' }
        ],
        senseDictionary: {
          ephemeral: ['lasting for a very short time', 'relating to a short-lived organism', '(computing) stored only temporarily'],
          resilient: ['able to recover quickly', 'able to spring back into shape', 'tough and adaptable'],
          serendipity: ['finding good things by chance', 'a fortunate accident', 'a pleasant surprise'],
          eloquent: ['fluent and persuasive', 'clearly expressing meaning', 'movingly expressive'],
          pragmatic: ['dealing with things sensibly', 'practical rather than idealistic', 'focused on results'],
          ubiquitous: ['present everywhere', 'found all over', 'constantly encountered'],
          mellifluous: ['sweet-sounding', 'smooth and musical', 'flowing with honeyed tones'],
          sagacious: ['wise and shrewd', 'showing keen judgment', 'discerning'],
          default: ['a common meaning', 'a specialized meaning', 'an informal usage']
        }
      }
    };

    /* ============================================================
       UTILS
       ============================================================ */
    const Utils = {
      qs: (sel, ctx = document) => ctx.querySelector(sel),
      qsa: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),
      clamp: (n, min, max) => Math.min(Math.max(n, min), max),
      generateId: () => Date.now().toString(36) + Math.random().toString(36).slice(2),
      randomizeArray: arr => [...arr].sort(() => Math.random() - 0.5),
      escapeHtml: str => String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])),
      hexToHSL(hex) {
        let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        let h, s, l = (max+min)/2;
        if (max === min) { h = s = 0; } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch(max) {
            case r: h = ((g-b)/d + (g<b?6:0))/6; break;
            case g: h = ((b-r)/d + 2)/6; break;
            case b: h = ((r-g)/d + 4)/6; break;
          }
        }
        return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
      },
      hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1-l);
        const f = n => {
          const k = (n + h/30) % 12;
          const color = l - a * Math.max(Math.min(k-3, 9-k, 1), -1);
          return Math.round(255 * color).toString(16).padStart(2,'0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
      },
      generatePalette(seedHex) {
        const hsl = this.hexToHSL(seedHex);
        return {
          primary: seedHex,
          onPrimary: '#ffffff',
          primaryContainer: this.hslToHex(hsl.h, Math.min(100, hsl.s + 20), Math.min(95, hsl.l + 45)),
          onPrimaryContainer: this.hslToHex(hsl.h, Math.min(100, hsl.s + 30), Math.max(15, hsl.l - 35)),
          secondary: this.hslToHex((hsl.h + 30) % 360, hsl.s - 20, 45),
          onSecondary: '#ffffff',
          secondaryContainer: this.hslToHex((hsl.h + 30) % 360, hsl.s - 10, 90),
          onSecondaryContainer: this.hslToHex((hsl.h + 30) % 360, hsl.s + 10, 20),
          tertiary: this.hslToHex((hsl.h + 180) % 360, hsl.s, 45),
          onTertiary: '#ffffff',
          tertiaryContainer: this.hslToHex((hsl.h + 180) % 360, hsl.s - 10, 90),
          onTertiaryContainer: this.hslToHex((hsl.h + 180) % 360, hsl.s + 10, 20)
        };
      }
    };

    /* ============================================================
       STATE
       ============================================================ */
    const State = {
      data: null,
      listeners: {},

      init() {
        const saved = localStorage.getItem('pn-prototype-v1');
        if (saved) {
          try {
            this.data = JSON.parse(saved);
          } catch (e) {
            this.data = this.defaultData();
          }
        } else {
          this.data = this.defaultData();
        }
        this.persist();
      },

      defaultData() {
        return {
          user: { ...CONFIG.user, xp: 130 },
          words: CONFIG.sampleData.words.map(w => ({ ...w })),
          ui: {
            currentScreen: CONFIG.features.onboarding ? 'onboarding' : 'home',
            themeMode: CONFIG.theme.defaultMode,
            seedColor: CONFIG.theme.seed,
            wordFilter: 'all',
            addMode: 'manual',
            practiceMode: 'flashcard',
            onboardingCompleted: false,
            onboardingStep: 0
          },
          session: {
            currentPracticeIndex: 0,
            practiceCards: [],
            selectedAddSense: null
          },
          temp: {
            currentDetailWord: null,
            lastDeleted: null,
            snackbarAction: null
          }
        };
      },

      get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.data);
      },

      set(path, value) {
        const keys = path.split('.');
        let obj = this.data;
        for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
        obj[keys[keys.length - 1]] = value;
        this.persist();
        this.emit(path, value);
      },

      persist() {
        localStorage.setItem('pn-prototype-v1', JSON.stringify(this.data));
      },

      subscribe(path, cb) {
        if (!this.listeners[path]) this.listeners[path] = [];
        this.listeners[path].push(cb);
      },

      emit(path, value) {
        (this.listeners[path] || []).forEach(cb => cb(value));
      }
    };

    /* ============================================================
       THEME
       ============================================================ */
    const Theme = {
      apply(seedHex, mode) {
        const palette = Utils.generatePalette(seedHex);
        const root = document.documentElement;
        Object.entries(palette).forEach(([key, val]) => {
          root.style.setProperty(`--md-sys-color-${this.camelToKebab(key)}`, val);
        });
        this.setMode(mode);
      },

      setMode(mode) {
        let resolved = mode;
        if (mode === 'system') {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        if (resolved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        State.set('ui.themeMode', mode);
        this.updateSwitchStates();
      },

      setSeedColor(hex) {
        State.set('ui.seedColor', hex);
        this.apply(hex, State.get('ui.themeMode'));
      },

      updateSwitchStates() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const sw = Utils.qs('#theme-switch');
        if (sw) sw.classList.toggle('on', isDark);
      },

      camelToKebab(str) {
        return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      }
    };

    /* ============================================================
       COMPONENTS
       ============================================================ */
    const Components = {
      Icon(name, size = 24, className = '') {
        return `<span class="material-symbols-rounded ${className}" style="font-size:${size}px">${name}</span>`;
      },

      Button({ variant = 'primary', icon, text, action, args, disabled = false, classes = '', fullWidth = false }) {
        const attrs = [];
        if (action) attrs.push(`data-action="${action}"`);
        if (args) attrs.push(`data-action-args='${JSON.stringify(args)}'`);
        if (disabled) attrs.push('disabled');
        const cls = `btn-${variant} ripple magnetic ${classes} ${fullWidth ? 'w-full' : ''}`.trim();
        return `<button class="${cls}" ${attrs.join(' ')}>${icon ? this.Icon(icon, 20) : ''}${text}</button>`;
      },

      Card({ children, glow = false, tilt = false, classes = '', attrs = '' }) {
        const cls = `card m3-elev-1 ${tilt ? 'tilt-card' : ''} ${classes}`.trim();
        return `<div class="${cls}" ${attrs}>${glow ? '<div class="card-glow"></div>' : ''}${children}</div>`;
      },

      Chip({ label, active = false, filter = false, action, args, classes = '' }) {
        const cls = `chip ripple ${active ? (filter ? 'filter-active' : 'active') : ''} ${classes}`.trim();
        const attrs = [];
        if (action) attrs.push(`data-action="${action}"`);
        if (args) attrs.push(`data-action-args='${JSON.stringify(args)}'`);
        return `<button class="${cls}" ${attrs.join(' ')}>${label}</button>`;
      },

      ListItem({ word, action, args }) {
        return `
          <div class="list-item ripple" data-action="${action}" data-action-args='${JSON.stringify(args)}'>
            <div class="w-10 h-10 rounded-full primary-container flex items-center justify-center text-on-primary-container font-medium">${word.word[0].toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-on-surface truncate">${Utils.escapeHtml(word.word)}</p>
              <p class="text-sm text-on-surface-variant truncate">${Utils.escapeHtml(word.meaning)}</p>
            </div>
            <span class="text-xs px-2 py-1 rounded-full ${this.statusClass(word.status)}">${word.status}</span>
          </div>
        `;
      },

      statusClass(status) {
        const map = {
          new: 'primary-container text-on-primary-container',
          learning: 'secondary-container text-on-secondary-container',
          review: 'tertiary-container text-on-tertiary-container',
          mastered: 'primary text-on-primary'
        };
        return map[status] || 'surface-container-high text-on-surface';
      },

      Input({ id, placeholder = '', value = '', type = 'text', classes = '', multiline = false }) {
        const cls = `input-field ${classes}`.trim();
        if (multiline) {
          return `<textarea id="${id}" class="${cls} min-h-[120px] resize-none" placeholder="${Utils.escapeHtml(placeholder)}">${Utils.escapeHtml(value)}</textarea>`;
        }
        return `<input id="${id}" type="${type}" class="${cls}" placeholder="${Utils.escapeHtml(placeholder)}" value="${Utils.escapeHtml(value)}">`;
      },

      Switch({ id, checked = false, action, args }) {
        const attrs = [];
        if (action) attrs.push(`data-action="${action}"`);
        if (args) attrs.push(`data-action-args='${JSON.stringify(args)}'`);
        return `<div id="${id}" class="switch ${checked ? 'on' : ''}" ${attrs.join(' ')}></div>`;
      },

      Segmented({ options, active, action }) {
        return `
          <div class="segmented">
            ${options.map(opt => `
              <button class="${opt.value === active ? 'active' : ''}" data-action="${action}" data-action-args='${JSON.stringify({ value: opt.value })}'>${opt.label}</button>
            `).join('')}
          </div>
        `;
      },

      NavItem({ screen, icon, label, active }) {
        return `
          <button class="nav-item ${active ? 'active' : ''}" data-action="navigate" data-action-args='{"screen":"${screen}"}'>
            <div class="nav-icon">${this.Icon(icon, 20)}</div>
            <span>${label}</span>
          </button>
        `;
      },

      BottomSheet({ id, title, subtitle = '', children, dragHandleId }) {
        return `
          <div class="bottom-sheet" id="${id}">
            <div class="sheet-backdrop" data-action="closeSheet" data-action-args='{"id":"${id}"}'></div>
            <div class="sheet-content">
              <div class="w-12 h-1.5 rounded-full bg-outline-variant mx-auto mb-6 cursor-pointer" id="${dragHandleId}"></div>
              ${title ? `<h3 class="text-xl font-normal text-on-surface mb-1">${Utils.escapeHtml(title)}</h3>` : ''}
              ${subtitle ? `<p class="text-sm text-on-surface-variant mb-6">${Utils.escapeHtml(subtitle)}</p>` : ''}
              ${children}
            </div>
          </div>
        `;
      }
    };

    /* ============================================================
       SCREENS
       ============================================================ */
    const Screens = {
      registry: {},

      register(screen) {
        this.registry[screen.id] = screen;
      },

      renderAll() {
        const container = Utils.qs('#screens');
        container.innerHTML = Object.values(this.registry).map(s => `<section id="screen-${s.id}" class="screen ${s.id === State.get('ui.currentScreen') ? 'active' : ''}"></section>`).join('');
        Object.values(this.registry).forEach(s => {
          const el = Utils.qs(`#screen-${s.id}`);
          if (el && s.render) el.innerHTML = s.render();
        });
        this.renderBottomNav();
      },

      renderBottomNav() {
        const current = State.get('ui.currentScreen');
        const visibleScreens = CONFIG.screens.filter(s => s.visible && s.id !== 'onboarding');
        Utils.qs('#bottom-nav').innerHTML = visibleScreens.map(s =>
          Components.NavItem({ screen: s.id, icon: s.icon, label: s.label, active: s.id === current })
        ).join('');
      },

      show(id) {
        const current = State.get('ui.currentScreen');
        if (id === current && id !== 'practice') return;
        if (id === 'practice') {
          Actions.startReview();
          return;
        }
        State.set('ui.currentScreen', id);
        Utils.qsa('.screen').forEach(s => s.classList.remove('active'));
        const el = Utils.qs(`#screen-${id}`);
        if (el) el.classList.add('active');
        this.renderBottomNav();
        Utils.qs('#fab-add').classList.toggle('hidden', id !== 'home' && id !== 'words');
        const screen = this.registry[id];
        if (screen && screen.mount) screen.mount();
        Interactions.refresh();
      },

      get(id) {
        return this.registry[id];
      }
    };

    const OnboardingScreen = {
      id: 'onboarding',
      render() {
        const step = State.get('ui.onboardingStep');
        const slide = CONFIG.content.onboardingSlides[step];
        const isLast = step >= CONFIG.content.onboardingSlides.length - 1;
        return `
          <div class="flex flex-col h-full">
            <div class="flex-1 flex items-center justify-center">
              <div class="w-full onboarding-slide">
                <div class="w-32 h-32 rounded-full primary-container flex items-center justify-center mx-auto mb-8 m3-elev-2 tilt-card">
                  ${Components.Icon(slide.icon, 64, 'text-on-primary-container')}
                </div>
                <h2 class="text-4xl font-normal text-on-surface mb-4">${Utils.escapeHtml(slide.title)}</h2>
                <p class="text-on-surface-variant text-lg">${Utils.escapeHtml(slide.desc)}</p>
              </div>
            </div>
            <div class="px-6 pb-8">
              <div class="flex justify-center gap-2 mb-8">
                ${CONFIG.content.onboardingSlides.map((_, i) => `
                  <div class="onboarding-dot ${i === step ? 'active' : ''}"></div>
                `).join('')}
              </div>
              ${Components.Button({ text: isLast ? 'Get started' : 'Next', action: 'nextOnboarding', fullWidth: true })}
            </div>
          </div>
        `;
      },
      mount() {}
    };

    const HomeScreen = {
      id: 'home',
      render() {
        const user = State.get('user');
        const words = State.get('words');
        const due = words.filter(w => ['learning', 'review'].includes(w.status)).length;
        const pct = Math.min(100, Math.round((user.xp / user.xpGoal) * 100));
        return `
          <div class="top-app-bar px-6 pt-12 pb-4">
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-on-surface-variant">Hello, ${Utils.escapeHtml(user.firstName)}</p>
                <h1 class="text-3xl font-normal text-on-surface mt-1">${Utils.escapeHtml(CONFIG.content.hero.title)}</h1>
              </div>
              ${Components.Button({ variant: 'tonal', icon: 'palette', text: '', action: 'openThemeSheet', classes: 'w-10 h-10 rounded-full !p-0' })}
            </div>
          </div>
          <div class="px-5 pb-6">
            ${this.heroCard(due)}
            ${this.goalCard(user.xp, user.xpGoal, pct)}
            <div class="stats-grid mb-5">
              ${Components.Card({ glow: true, tilt: true, children: `
                ${Components.Icon('local_fire_department', 28, 'text-error')}
                <p class="text-sm text-on-surface-variant mt-2">Streak</p>
                <p class="text-3xl font-normal text-on-surface"><span class="counter" data-target="24">0</span></p>
              ` })}
              ${Components.Card({ glow: true, tilt: true, children: `
                ${Components.Icon('menu_book', 28, 'text-primary')}
                <p class="text-sm text-on-surface-variant mt-2">Words</p>
                <p class="text-3xl font-normal text-on-surface">${words.length}</p>
              ` })}
            </div>
            ${this.calendarCard()}
            ${this.wordOfDayCard()}
            ${this.masteryCard(words)}
          </div>
        `;
      },

      heroCard(due) {
        return `
          <div class="primary-container rounded-[32px] p-6 mb-5 m3-elev-2 relative overflow-hidden hero-spotlight tilt-card">
            <div class="card-glow"></div>
            <div class="absolute top-0 right-0 w-40 h-40 rounded-full primary opacity-10 -mr-10 -mt-10"></div>
            <div class="relative">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full primary flex items-center justify-center">${Components.Icon('school', 24, 'text-on-primary')}</div>
                <div>
                  <p class="text-sm font-medium text-on-primary-container opacity-80">${CONFIG.content.hero.dueLabel}</p>
                  <p class="text-2xl font-medium text-on-primary-container">${due} words</p>
                </div>
              </div>
              <p class="text-on-primary-container text-sm mb-5 opacity-90">Reviewing now keeps your memory sharp and your streak alive.</p>
              ${Components.Button({ icon: 'play_arrow', text: CONFIG.content.hero.cta, action: 'startReview', fullWidth: true })}
            </div>
          </div>
        `;
      },

      goalCard(xp, goal, pct) {
        return Components.Card({
          glow: true,
          tilt: true,
          children: `
            <div class="flex justify-between items-end mb-3">
              <div>
                <p class="text-sm font-medium text-on-surface-variant">Daily goal</p>
                <p class="text-2xl font-medium text-on-surface mt-1">${xp} / ${goal} XP</p>
              </div>
              <span class="text-sm font-medium text-primary">${pct}%</span>
            </div>
            <div class="h-3 rounded-full overflow-hidden surface-container-high">
              <div class="h-full primary transition-all duration-1000 ease-out" style="width:${pct}%" id="goal-bar"></div>
            </div>
          `
        });
      },

      calendarCard() {
        return Components.Card({
          glow: true,
          tilt: true,
          children: `
            <div class="flex justify-between items-center mb-4">
              <p class="text-sm font-medium text-on-surface-variant">Last 28 days</p>
              <p class="text-sm text-primary font-medium">24 day streak</p>
            </div>
            <div class="calendar-grid" id="streak-calendar"></div>
          `
        });
      },

      wordOfDayCard() {
        const w = CONFIG.content.wordOfTheDay;
        return Components.Card({
          glow: true,
          tilt: true,
          children: `
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full tertiary-container flex items-center justify-center">${Components.Icon('lightbulb', 20)}</div>
              <p class="text-sm font-medium text-on-surface-variant">Word of the day</p>
            </div>
            <p class="text-3xl font-normal text-on-surface">${Utils.escapeHtml(w.word)}</p>
            <p class="text-sm text-on-surface-variant mt-1">${Utils.escapeHtml(w.meaning)}</p>
            <div class="flex gap-3 mt-5">
              ${Components.Button({ variant: 'outline', text: 'Skip', action: 'skipWordOfDay', fullWidth: true })}
              ${Components.Button({ text: 'Add', action: 'addWordOfDay', fullWidth: true })}
            </div>
          `
        });
      },

      masteryCard(words) {
        const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
        words.forEach(w => counts[w.status]++);
        const total = words.length || 1;
        return Components.Card({
          glow: true,
          tilt: true,
          children: `
            <p class="text-sm font-medium text-on-surface-variant mb-4">Mastery distribution</p>
            <div class="h-4 rounded-full overflow-hidden flex">
              <div class="mastery-segment surface-container-high" style="width:${(counts.new/total)*100}%"></div>
              <div class="mastery-segment secondary-container" style="width:${(counts.learning/total)*100}%"></div>
              <div class="mastery-segment tertiary-container" style="width:${(counts.review/total)*100}%"></div>
              <div class="mastery-segment primary-container" style="width:${(counts.mastered/total)*100}%"></div>
            </div>
            <div class="flex flex-wrap gap-3 mt-4 text-xs text-on-surface-variant">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full surface-container-high"></span>New</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full secondary-container"></span>Learning</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full tertiary-container"></span>Review</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full primary-container"></span>Mastered</span>
            </div>
          `
        });
      },

      mount() {
        this.renderCalendar();
        Interactions.animateCounters();
      },

      update() {
        const el = Utils.qs('#screen-home');
        if (el) {
          el.innerHTML = this.render();
          this.mount();
        }
      },

      renderCalendar() {
        const container = Utils.qs('#streak-calendar');
        if (!container) return;
        let html = '';
        for (let i = 0; i < 28; i++) {
          const level = Math.random() > 0.7 ? Math.floor(Math.random() * 4) + 1 : 0;
          html += `<div class="calendar-day level-${level}"></div>`;
        }
        container.innerHTML = html;
      }
    };

    const WordsScreen = {
      id: 'words',
      render() {
        return `
          <div class="ptr-indicator">${Components.Icon('refresh', 20)}</div>
          <div class="top-app-bar px-6 pt-12 pb-4">
            <h1 class="text-3xl font-normal text-on-surface">My words</h1>
          </div>
          <div class="px-5 pb-28" id="words-scroll">
            <div class="relative mb-4">
              ${Components.Icon('search', 20, 'absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant')}
              ${Components.Input({ id: 'word-search', placeholder: 'Search words...', classes: 'pl-12 rounded-[28px]' })}
            </div>
            <div class="flex gap-2 overflow-x-auto pb-4 scrollbar-hide" id="word-filters">
              ${['all', 'due', 'learning', 'mastered', 'new'].map(f =>
                Components.Chip({ label: f.charAt(0).toUpperCase() + f.slice(1), filter: true, active: State.get('ui.wordFilter') === f, action: 'setWordFilter', args: { filter: f } })
              ).join('')}
            </div>
            <div id="word-list"></div>
          </div>
        `;
      },

      mount() {
        this.renderList();
        Utils.qs('#word-search').addEventListener('input', () => this.renderList());
        if (CONFIG.features.pullToRefresh) Interactions.setupPullToRefresh();
      },

      renderList() {
        const list = Utils.qs('#word-list');
        if (!list) return;
        const term = Utils.qs('#word-search').value.toLowerCase();
        const filter = State.get('ui.wordFilter');
        const words = State.get('words').filter(w => {
          const matchesFilter = filter === 'all' || w.status === filter || (filter === 'due' && ['learning', 'review'].includes(w.status));
          const matchesTerm = w.word.toLowerCase().includes(term) || w.meaning.toLowerCase().includes(term);
          return matchesFilter && matchesTerm;
        });

        if (words.length === 0) {
          list.innerHTML = `
            <div class="empty-state">
              ${Components.Icon('search_off', 48)}
              <p class="text-lg font-medium">${CONFIG.content.emptyState.title}</p>
              <p class="text-sm mt-1">${CONFIG.content.emptyState.subtitle}</p>
            </div>
          `;
          return;
        }

        list.innerHTML = words.map(w => Components.ListItem({ word: w, action: 'openWordDetail', args: { id: w.id } })).join('');
      }
    };

    const AddScreen = {
      id: 'add',
      render() {
        const mode = State.get('ui.addMode');
        return `
          <div class="top-app-bar px-6 pt-12 pb-4">
            <h1 class="text-3xl font-normal text-on-surface">Add word</h1>
          </div>
          <div class="px-5 pb-28">
            ${Components.Segmented({ options: [{ label: 'Manual', value: 'manual' }, { label: 'Capture', value: 'capture' }], active: mode, action: 'setAddMode' })}
            <div class="mt-6 ${mode === 'manual' ? '' : 'hidden'}" id="add-manual">
              <div class="mb-5">
                <label class="text-sm font-medium text-on-surface-variant block mb-2">Word or phrase</label>
                ${Components.Input({ id: 'add-word-input', placeholder: 'e.g. ephemeral' })}
              </div>
              ${Components.Button({ icon: 'search', text: 'Look up', action: 'lookupWord', fullWidth: true })}
              <div id="add-sense-preview" class="hidden mt-6">
                <p class="text-sm font-medium text-on-surface-variant mb-3">Select sense to add</p>
                <div class="space-y-3" id="sense-options"></div>
                ${Components.Button({ text: 'Add selected sense', action: 'confirmAddWord', fullWidth: true, classes: 'mt-4', disabled: true })}
              </div>
              <div class="mt-8">
                <p class="text-sm font-medium text-on-surface-variant mb-3">Recently added</p>
                <div class="space-y-3" id="recent-list"></div>
              </div>
            </div>
            <div class="mt-6 ${mode === 'capture' ? '' : 'hidden'}" id="add-capture">
              <div class="border-2 border-dashed border-outline rounded-[28px] p-8 text-center surface-container-low ripple magnetic" data-action="simulateCapture">
                ${Components.Icon('photo_camera', 48, 'text-on-surface-variant mb-3 block mx-auto')}
                <p class="text-on-surface font-medium">Tap to capture text</p>
                <p class="text-sm text-on-surface-variant mt-1">Take a photo of any English text</p>
              </div>
              <div class="mt-6">
                <p class="text-sm font-medium text-on-surface-variant mb-3">Or paste text</p>
                ${Components.Input({ id: 'capture-text', placeholder: 'Paste a sentence or paragraph...', multiline: true, classes: 'rounded-[16px]' })}
              </div>
              ${Components.Button({ icon: 'auto_awesome', text: 'Extract words', action: 'extractWords', fullWidth: true, classes: 'mt-4' })}
            </div>
          </div>
        `;
      },

      mount() {
        Utils.qs('#add-word-input').addEventListener('keyup', e => { if (e.key === 'Enter') Actions.lookupWord(); });
        this.renderRecent();
      },

      renderRecent() {
        const recent = State.get('words').slice(0, 3);
        const container = Utils.qs('#recent-list');
        if (!container) return;
        container.innerHTML = recent.map(w => Components.ListItem({ word: w, action: 'openWordDetail', args: { id: w.id } })).join('');
      }
    };

    const PracticeScreen = {
      id: 'practice',
      render() {
        return `
          <div class="top-app-bar px-6 pt-12 pb-4 flex justify-between items-center">
            ${Components.Button({ variant: 'tonal', icon: 'close', text: '', action: 'quitPractice', classes: 'w-10 h-10 rounded-full !p-0' })}
            <div class="flex-1 mx-4">
              <div class="h-2 rounded-full overflow-hidden surface-container-high">
                <div class="h-full primary transition-all duration-300" id="practice-progress" style="width:0%"></div>
              </div>
              <p class="text-xs text-center text-on-surface-variant mt-1"><span id="practice-current">1</span> / <span id="practice-total">0</span></p>
            </div>
            ${Components.Button({ variant: 'tonal', icon: 'skip_next', text: '', action: 'skipCard', classes: 'w-10 h-10 rounded-full !p-0' })}
          </div>
          <div class="px-5 pb-32 flex flex-col items-center">
            ${CONFIG.features.quizMode ? Components.Segmented({ options: [{ label: 'Flashcard', value: 'flashcard' }, { label: 'Quiz', value: 'quiz' }], active: State.get('ui.practiceMode'), action: 'setPracticeMode' }) : ''}
            <div id="flashcard-view" class="w-full ${State.get('ui.practiceMode') === 'flashcard' ? '' : 'hidden'}">
              <div class="practice-card-wrap">
                <div class="practice-card m3-elev-3 tilt-card" id="practice-card">
                  <div class="swipe-overlay left" id="swipe-left">Again</div>
                  <div class="swipe-overlay right" id="swipe-right">Got it</div>
                  <div class="practice-card-face" id="card-front-face">
                    <p class="text-sm font-medium opacity-70 mb-4">Tap to reveal · Drag to rate</p>
                    <h2 class="text-4xl font-normal mb-4" id="card-front"></h2>
                    <p class="text-lg opacity-80" id="card-phonetic"></p>
                    ${Components.Button({ variant: 'tonal', icon: 'volume_up', text: '', action: 'playAudio', classes: 'mt-8 w-12 h-12 rounded-full !p-0' })}
                  </div>
                  <div class="practice-card-face practice-card-back">
                    <p class="text-sm font-medium opacity-70 mb-2">Meaning</p>
                    <p class="text-2xl font-normal mb-6" id="card-back"></p>
                    <div class="w-full h-px bg-on-secondary-container opacity-20 mb-6"></div>
                    <p class="text-sm font-medium opacity-70 mb-2">Example</p>
                    <p class="text-base italic opacity-90" id="card-example"></p>
                  </div>
                </div>
              </div>
              <p class="text-sm text-on-surface-variant mt-2 mb-4">How well did you know this?</p>
              <div class="grid grid-cols-4 gap-3 w-full">
                ${[{ r: 'again', i: 'replay' }, { r: 'hard', i: 'sentiment_dissatisfied' }, { r: 'good', i: 'sentiment_satisfied' }, { r: 'easy', i: 'sentiment_very_satisfied' }].map(x =>
                  Components.Button({ variant: x.r === 'easy' ? 'primary' : 'outline', icon: x.i, text: x.r.charAt(0).toUpperCase() + x.r.slice(1), action: 'rateCard', args: { rating: x.r }, fullWidth: true, classes: 'p-3 text-xs flex-col !gap-1' })
                ).join('')}
              </div>
            </div>
            <div id="quiz-view" class="w-full ${State.get('ui.practiceMode') === 'quiz' ? '' : 'hidden'}">
              ${Components.Card({ tilt: true, glow: true, classes: 'text-center py-10 mb-6 m3-elev-2', children: `
                <p class="text-sm text-on-surface-variant mb-2">Choose the meaning of</p>
                <h2 class="text-4xl font-normal text-on-surface" id="quiz-word"></h2>
              ` })}
              <div id="quiz-options"></div>
            </div>
          </div>
          ${this.completeOverlay()}
          ${this.quitOverlay()}
        `;
      },

      completeOverlay() {
        return `
          <div id="session-complete" class="hidden fixed inset-0 z-50 flex flex-col items-center justify-center p-6 surface text-center">
            <div class="w-28 h-28 rounded-full primary-container flex items-center justify-center mb-6 m3-elev-2 tilt-card">
              ${Components.Icon('emoji_events', 48, 'text-on-primary-container')}
            </div>
            <h2 class="text-4xl font-normal text-on-surface mb-2">Session complete!</h2>
            <p class="text-on-surface-variant mb-8">You reviewed <span id="complete-reviewed">0</span> words and earned <span id="complete-xp">0</span> XP.</p>
            <div class="grid grid-cols-3 gap-4 w-full mb-8">
              ${['reviewed', 'new', 'again'].map(k => Components.Card({ tilt: true, children: `
                <p class="text-2xl font-medium text-${k === 'reviewed' ? 'primary' : k === 'new' ? 'tertiary' : 'error'}" id="stat-${k}">0</p>
                <p class="text-xs text-on-surface-variant">${k.charAt(0).toUpperCase() + k.slice(1)}</p>
              ` })).join('')}
            </div>
            ${Components.Button({ text: 'Continue', action: 'endSession', fullWidth: true })}
          </div>
        `;
      },

      quitOverlay() {
        return `
          <div id="quit-confirm" class="hidden fixed inset-0 z-50 flex items-end">
            <div class="absolute inset-0 bg-black/50" data-action="hideQuitConfirm"></div>
            <div class="relative w-full max-w-[420px] mx-auto surface-container-low rounded-t-[28px] p-6">
              <h3 class="text-xl font-normal text-on-surface mb-2">End session?</h3>
              <p class="text-sm text-on-surface-variant mb-6">Your progress in this session will be saved.</p>
              ${Components.Button({ text: 'End session', action: 'confirmQuit', fullWidth: true, classes: 'mb-3' })}
              ${Components.Button({ variant: 'outline', text: 'Keep practicing', action: 'hideQuitConfirm', fullWidth: true })}
            </div>
          </div>
        `;
      },

      mount() {
        this.updateCard();
        Interactions.setupPracticeCardGestures();
      },

      updateCard() {
        const idx = State.get('session.currentPracticeIndex');
        const cards = State.get('session.practiceCards');
        if (idx >= cards.length) {
          this.showComplete();
          return;
        }
        const card = cards[idx];
        const pc = Utils.qs('#practice-card');
        Utils.qs('#card-front').textContent = card.word;
        Utils.qs('#card-phonetic').textContent = card.phonetic;
        Utils.qs('#card-back').textContent = card.meaning;
        Utils.qs('#card-example').textContent = card.example;
        Utils.qs('#practice-current').textContent = idx + 1;
        Utils.qs('#practice-total').textContent = cards.length;
        Utils.qs('#practice-progress').style.width = `${(idx / cards.length) * 100}%`;
        if (pc) { pc.classList.remove('flipped'); pc.style.transform = ''; }
        this.updateQuiz();
      },

      updateQuiz() {
        const idx = State.get('session.currentPracticeIndex');
        const cards = State.get('session.practiceCards');
        const card = cards[idx];
        const qv = Utils.qs('#quiz-view');
        if (!qv || !card) return;
        Utils.qs('#quiz-word').textContent = card.word;
        const options = [card.meaning];
        const allWords = State.get('words');
        while (options.length < 4) {
          const random = allWords[Math.floor(Math.random() * allWords.length)];
          if (!options.includes(random.meaning)) options.push(random.meaning);
        }
        options.sort(() => Math.random() - 0.5);
        Utils.qs('#quiz-options').innerHTML = options.map(opt =>
          `<button class="quiz-option ripple" data-action="answerQuiz" data-action-args='${JSON.stringify({ selected: opt })}'>${Utils.escapeHtml(opt)}</button>`
        ).join('');
      },

      showComplete() {
        const cards = State.get('session.practiceCards');
        Utils.qs('#stat-reviewed').textContent = cards.length;
        Utils.qs('#stat-new').textContent = cards.filter(w => w.status === 'new').length;
        Utils.qs('#stat-again').textContent = Math.floor(cards.length * 0.15);
        Utils.qs('#complete-reviewed').textContent = cards.length;
        Utils.qs('#complete-xp').textContent = cards.length * 6;
        Utils.qs('#session-complete').classList.remove('hidden');
        if (CONFIG.features.confetti) Interactions.confetti();
      }
    };

    const SettingsScreen = {
      id: 'settings',
      render() {
        const user = State.get('user');
        return `
          <div class="top-app-bar px-6 pt-12 pb-4">
            <h1 class="text-3xl font-normal text-on-surface">Settings</h1>
          </div>
          <div class="px-5 pb-28">
            ${Components.Card({ tilt: true, glow: true, classes: 'flex items-center gap-4 mb-4', children: `
              <div class="w-14 h-14 rounded-full primary flex items-center justify-center text-2xl font-medium text-on-primary">${user.avatar}</div>
              <div class="flex-1">
                <p class="text-lg font-medium text-on-surface">${Utils.escapeHtml(user.name)}</p>
                <p class="text-sm text-on-surface-variant">${Utils.escapeHtml(user.email)}</p>
              </div>
              ${Components.Button({ variant: 'tonal', icon: 'edit', text: '', action: 'editProfile', classes: 'w-10 h-10 rounded-full !p-0' })}
            ` })}
            <p class="text-sm font-medium text-on-surface-variant mt-6 mb-3 px-1">Appearance</p>
            ${Components.Card({ tilt: true, glow: true, classes: 'mb-4', children: `
              <div class="flex justify-between items-center py-2">
                <div class="flex items-center gap-3">
                  ${Components.Icon('dark_mode', 20, 'text-on-surface-variant')}
                  <span class="text-on-surface">Dark theme</span>
                </div>
                ${Components.Switch({ id: 'theme-switch', checked: document.documentElement.getAttribute('data-theme') === 'dark', action: 'toggleTheme' })}
              </div>
              <div class="h-px bg-outline-variant my-3"></div>
              <div class="flex justify-between items-center py-2">
                <div class="flex items-center gap-3">
                  ${Components.Icon('contrast', 20, 'text-on-surface-variant')}
                  <span class="text-on-surface">High contrast</span>
                </div>
                ${Components.Switch({ id: 'contrast-switch', checked: CONFIG.theme.highContrast })}
              </div>
            ` })}
            <p class="text-sm font-medium text-on-surface-variant mt-6 mb-3 px-1">Accent color</p>
            ${Components.Card({ tilt: true, glow: true, classes: 'mb-4', children: `
              <div class="flex justify-between gap-2" id="color-picker">
                ${['#6750a4', '#006c4c', '#0061a4', '#984061', '#7d5260', '#b3261e'].map(hex => `
                  <button class="color-dot ${State.get('ui.seedColor') === hex ? 'active' : ''}" style="background:${hex}" data-action="setSeedColor" data-action-args='{"hex":"${hex}"}'></button>
                `).join('')}
              </div>
            ` })}
            <p class="text-sm font-medium text-on-surface-variant mt-6 mb-3 px-1">Study</p>
            ${Components.Card({ tilt: true, glow: true, classes: 'mb-4', children: `
              <div class="flex justify-between items-center py-2" data-action="showSnackbar" data-action-args='{"text":"Daily goal settings coming soon"}'>
                <div>
                  <p class="text-on-surface">Daily goal</p>
                  <p class="text-sm text-on-surface-variant">${user.xpGoal} XP per day</p>
                </div>
                ${Components.Icon('chevron_right', 20, 'text-on-surface-variant')}
              </div>
              <div class="h-px bg-outline-variant my-3"></div>
              <div class="flex justify-between items-center py-2">
                <div>
                  <p class="text-on-surface">Reminder</p>
                  <p class="text-sm text-on-surface-variant">9:00 PM</p>
                </div>
                ${Components.Switch({ id: 'reminder-switch', checked: true, action: 'toggleReminder' })}
              </div>
            ` })}
            ${Components.Button({ variant: 'tonal', text: 'Clear all progress', action: 'clearProgress', fullWidth: true, classes: 'mt-4 error-container text-error' })}
          </div>
        `;
      },
      mount() {}
    };

    /* ============================================================
       ACTIONS
       ============================================================ */
    const Actions = {
      handle(action, args, event) {
        const fn = this[action];
        if (fn) fn.call(this, args, event);
      },

      navigate(args) {
        Screens.show(args.screen);
      },

      nextOnboarding() {
        const step = State.get('ui.onboardingStep') + 1;
        if (step >= CONFIG.content.onboardingSlides.length) {
          State.set('ui.onboardingCompleted', true);
          State.set('ui.currentScreen', 'home');
          Screens.show('home');
        } else {
          State.set('ui.onboardingStep', step);
          const el = Utils.qs('#screen-onboarding');
          if (el) el.innerHTML = OnboardingScreen.render();
          OnboardingScreen.mount();
        }
      },

      openThemeSheet() {
        Utils.qs('#theme-sheet').classList.add('open');
      },

      closeSheet(args) {
        Utils.qs(`#${args.id}`).classList.remove('open');
      },

      setThemeMode(args) {
        Theme.setMode(args.mode);
        this.openThemeSheet();
        const sheet = Utils.qs('#theme-sheet');
        if (sheet) {
          sheet.innerHTML = this.themeSheetContent();
          Interactions.setupSheetDrag('theme-sheet', 'theme-drag-handle');
        }
      },

      setSeedColor(args) {
        Theme.setSeedColor(args.hex);
        SettingsScreen.update?.();
      },

      toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        Theme.setMode(isDark ? 'light' : 'dark');
      },

      startReview() {
        const all = State.get('words');
        if (all.length === 0) {
          Snackbar.show('Add some words first!');
          return;
        }
        State.set('session.currentPracticeIndex', 0);
        State.set('session.practiceCards', Utils.randomizeArray(all).slice(0, Math.min(8, all.length)));
        State.set('ui.practiceMode', 'flashcard');
        Utils.qs('#session-complete')?.classList.add('hidden');
        Screens.show('practice');
      },

      flipCard() {
        const pc = Utils.qs('#practice-card');
        if (pc) pc.classList.toggle('flipped');
      },

      rateCard(args) {
        const rating = args.rating;
        const user = State.get('user');
        const add = rating === 'easy' ? 8 : rating === 'good' ? 6 : rating === 'hard' ? 4 : 2;
        State.set('user.xp', user.xp + add);
        const idx = State.get('session.currentPracticeIndex') + 1;
        State.set('session.currentPracticeIndex', idx);
        PracticeScreen.updateCard();
        const msgs = { easy: 'Easy — next review in 4 days', good: 'Good — next review in 1 day', hard: 'Hard — review again soon', again: 'Again — added to requeue' };
        Snackbar.show(msgs[rating]);
      },

      skipCard() {
        const idx = State.get('session.currentPracticeIndex') + 1;
        State.set('session.currentPracticeIndex', idx);
        PracticeScreen.updateCard();
        Snackbar.show('Skipped');
      },

      setPracticeMode(args) {
        State.set('ui.practiceMode', args.value);
        Utils.qs('#flashcard-view').classList.toggle('hidden', args.value !== 'flashcard');
        Utils.qs('#quiz-view').classList.toggle('hidden', args.value !== 'quiz');
        if (args.value === 'quiz') PracticeScreen.updateQuiz();
      },

      answerQuiz(args) {
        const idx = State.get('session.currentPracticeIndex');
        const cards = State.get('session.practiceCards');
        const card = cards[idx];
        const correct = args.selected === card.meaning;
        const buttons = Utils.qsa('.quiz-option');
        buttons.forEach(b => {
          b.disabled = true;
          if (b.textContent === card.meaning) b.classList.add('correct');
        });
        if (!correct) {
          event.target.classList.add('wrong');
          setTimeout(() => this.rateCard({ rating: 'again' }), 800);
        } else {
          Snackbar.show('Correct!');
          setTimeout(() => this.rateCard({ rating: 'good' }), 600);
        }
      },

      endSession() {
        Utils.qs('#session-complete').classList.add('hidden');
        Screens.show('home');
        HomeScreen.update();
      },

      quitPractice() {
        Utils.qs('#quit-confirm').classList.remove('hidden');
      },

      hideQuitConfirm() {
        Utils.qs('#quit-confirm').classList.add('hidden');
      },

      confirmQuit() {
        this.hideQuitConfirm();
        Screens.show('home');
      },

      playAudio() {
        const icon = Utils.qs('#audio-icon');
        if (icon) {
          icon.innerHTML = '<div class="audio-wave"><div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div></div>';
          setTimeout(() => icon.textContent = 'volume_up', 1200);
        }
      },

      setWordFilter(args) {
        State.set('ui.wordFilter', args.filter);
        WordsScreen.renderList();
        Utils.qsa('#word-filters .chip').forEach(c => c.classList.remove('filter-active'));
        const clicked = event.target.closest('.chip');
        if (clicked) clicked.classList.add('filter-active');
      },

      setAddMode(args) {
        State.set('ui.addMode', args.value);
        const el = Utils.qs('#screen-add');
        if (el) {
          el.innerHTML = AddScreen.render();
          AddScreen.mount();
        }
      },

      lookupWord() {
        const input = Utils.qs('#add-word-input');
        const term = input.value.trim();
        if (!term) return;
        const senses = CONFIG.sampleData.senseDictionary[term.toLowerCase()] || CONFIG.sampleData.senseDictionary.default;
        State.set('session.selectedAddSense', null);
        Utils.qs('#add-sense-preview').classList.remove('hidden');
        Utils.qs('#sense-options').innerHTML = senses.map((s, i) => `
          <button class="w-full text-left p-4 rounded-[20px] surface-container-high flex items-start gap-3 ripple magnetic" data-action="selectAddSense" data-action-args='{"index":${i},"sense":"${Utils.escapeHtml(s)}"}'>
            <div class="radio ${i === 0 ? 'checked' : ''}" id="add-sense-radio-${i}"></div>
            <div>
              <p class="font-medium text-on-surface">${Utils.escapeHtml(term)}</p>
              <p class="text-sm text-on-surface-variant mt-1">${Utils.escapeHtml(s)}</p>
            </div>
          </button>
        `).join('');
        this.selectAddSense({ index: 0, sense: senses[0] });
      },

      selectAddSense(args) {
        State.set('session.selectedAddSense', args);
        Utils.qsa('#sense-options .radio').forEach((r, i) => r.classList.toggle('checked', i === args.index));
        const btn = event?.target?.closest('[data-action="confirmAddWord"]') || Utils.qs('[data-action="confirmAddWord"]');
        if (btn) {
          btn.disabled = false;
          btn.textContent = `Add: ${args.sense}`;
        }
      },

      confirmAddWord() {
        const term = Utils.qs('#add-word-input').value.trim();
        const sense = State.get('session.selectedAddSense');
        if (!term || !sense) return;
        const words = State.get('words');
        words.unshift({
          id: Utils.generateId(),
          word: term,
          phonetic: `/${term.toLowerCase()}/`,
          meaning: sense.sense,
          example: `The word "${term}" is commonly used in everyday English.`,
          status: 'new'
        });
        State.set('words', words);
        Utils.qs('#add-word-input').value = '';
        State.set('session.selectedAddSense', null);
        Utils.qs('#add-sense-preview').classList.add('hidden');
        AddScreen.renderRecent();
        Snackbar.show(`Added "${term}"`);
        if (CONFIG.features.confetti) Interactions.confetti();
      },

      addWordOfDay() {
        const w = CONFIG.content.wordOfTheDay;
        if (State.get('words').find(x => x.word === w.word)) {
          Snackbar.show(`"${w.word}" is already in your list`);
          return;
        }
        const words = State.get('words');
        words.unshift({
          id: Utils.generateId(),
          word: w.word,
          phonetic: '/ˌserənˈdɪpɪti/',
          meaning: w.meaning,
          example: `It was pure ${w.word} that we found the cafe.`,
          status: 'new'
        });
        State.set('words', words);
        Snackbar.show(`"${w.word}" added to your learning queue`);
        if (CONFIG.features.confetti) Interactions.confetti();
      },

      skipWordOfDay() {
        Snackbar.show('Skipped for today');
      },

      simulateCapture() {
        Snackbar.show('Camera would open on device');
      },

      extractWords() {
        const text = Utils.qs('#capture-text').value.trim();
        if (!text) return;
        const extracted = ['ephemeral', 'resilient', 'serendipity'];
        const words = State.get('words');
        extracted.forEach(w => {
          if (!words.find(x => x.word === w)) {
            words.unshift({
              id: Utils.generateId(),
              word: w,
              phonetic: `/${w}/`,
              meaning: CONFIG.sampleData.senseDictionary[w][0],
              example: `Example sentence using ${w}.`,
              status: 'new'
            });
          }
        });
        State.set('words', words);
        AddScreen.renderRecent();
        Snackbar.show(`Extracted ${extracted.length} words`);
        Utils.qs('#capture-text').value = '';
      },

      openWordDetail(args) {
        const w = State.get('words').find(x => x.id === args.id);
        if (!w) return;
        State.set('temp.currentDetailWord', w);
        Utils.qs('#detail-word').textContent = w.word;
        Utils.qs('#detail-phonetic').textContent = w.phonetic;
        Utils.qs('#detail-meaning').textContent = w.meaning;
        Utils.qs('#detail-example').textContent = w.example;
        Utils.qs('#word-detail-sheet').classList.add('open');
      },

      closeWordDetail() {
        Utils.qs('#word-detail-sheet').classList.remove('open');
      },

      deleteWord() {
        const current = State.get('temp.currentDetailWord');
        if (!current) return;
        const words = State.get('words');
        const idx = words.findIndex(w => w.id === current.id);
        State.set('temp.lastDeleted', { word: current, index: idx });
        words.splice(idx, 1);
        State.set('words', words);
        this.closeWordDetail();
        WordsScreen.renderList();
        HomeScreen.update();
        Snackbar.show(`Deleted "${current.word}"`, 'Undo', () => this.undoDelete());
      },

      undoDelete() {
        const last = State.get('temp.lastDeleted');
        if (!last) return;
        const words = State.get('words');
        words.splice(last.index, 0, last.word);
        State.set('words', words);
        WordsScreen.renderList();
        HomeScreen.update();
      },

      editProfile() {
        const user = State.get('user');
        Utils.qs('#profile-name-input').value = user.name;
        Utils.qs('#profile-sheet').classList.add('open');
      },

      closeProfileSheet() {
        Utils.qs('#profile-sheet').classList.remove('open');
      },

      saveProfile() {
        const name = Utils.qs('#profile-name-input').value.trim();
        if (!name) return;
        State.set('user.name', name);
        State.set('user.firstName', name.split(' ')[0]);
        State.set('user.avatar', name[0].toUpperCase());
        this.closeProfileSheet();
        HomeScreen.update();
        SettingsScreen.update?.();
        Snackbar.show('Profile updated');
      },

      toggleReminder(args) {
        const sw = event.target.closest('.switch');
        const on = !sw.classList.contains('on');
        sw.classList.toggle('on', on);
        Snackbar.show(on ? 'Reminder on' : 'Reminder off');
      },

      clearProgress() {
        if (confirm('Clear all learning progress? This cannot be undone.')) {
          State.set('words', []);
          State.set('user.xp', 0);
          WordsScreen.renderList();
          HomeScreen.update();
          Snackbar.show('All progress cleared');
        }
      },

      showSnackbar(args) {
        Snackbar.show(args.text);
      },

      snackbarAction() {
        Snackbar.runAction();
      },

      themeSheetContent() {
        const mode = State.get('ui.themeMode');
        return Components.BottomSheet({
          id: 'theme-sheet',
          title: 'Customize look',
          subtitle: 'Material You adapts colors and contrast to your preference.',
          dragHandleId: 'theme-drag-handle',
          children: `
            <p class="text-sm font-medium text-on-surface-variant mb-3">Theme</p>
            ${Components.Segmented({ options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'System', value: 'system' }], active: mode, action: 'setThemeMode' })}
            <p class="text-sm font-medium text-on-surface-variant mb-3 mt-6">Accent color</p>
            <div class="flex justify-between gap-2 mb-8">
              ${['#6750a4', '#006c4c', '#0061a4', '#984061', '#7d5260', '#b3261e'].map(hex => `
                <button class="color-dot ${State.get('ui.seedColor') === hex ? 'active' : ''}" style="background:${hex}" data-action="setSeedColor" data-action-args='{"hex":"${hex}"}'></button>
              `).join('')}
            </div>
            ${Components.Button({ text: 'Done', action: 'closeSheet', args: { id: 'theme-sheet' }, fullWidth: true })}
          `
        });
      }
    };

    /* ============================================================
       INTERACTIONS
       ============================================================ */
    const Interactions = {
      init() {
        if (CONFIG.features.customCursor) this.setupCustomCursor();
        this.setupRipple();
        this.setupGlobalEvents();
        this.refresh();
      },

      refresh() {
        if (CONFIG.features.magneticButtons) this.setupMagneticButtons();
        if (CONFIG.features.tiltCards) this.setupTiltCards();
      },

      setupGlobalEvents() {
        document.addEventListener('click', e => {
          const el = e.target.closest('[data-action]');
          if (!el) return;
          const action = el.dataset.action;
          let args = {};
          if (el.dataset.actionArgs) {
            try { args = JSON.parse(el.dataset.actionArgs); } catch (err) {}
          }
          Actions.handle(action, args, e);
        });
      },

      setupCustomCursor() {
        if (window.matchMedia('(pointer: coarse)').matches) {
          Utils.qs('#cursor-dot').style.display = 'none';
          Utils.qs('#cursor-ring').style.display = 'none';
          Utils.qs('#phone').style.cursor = 'auto';
          return;
        }
        const dot = Utils.qs('#cursor-dot');
        const ring = Utils.qs('#cursor-ring');
        let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
        document.addEventListener('mousemove', e => {
          mouseX = e.clientX; mouseY = e.clientY;
          dot.style.left = mouseX + 'px'; dot.style.top = mouseY + 'px';
        });
        const animate = () => {
          ringX += (mouseX - ringX) * 0.15;
          ringY += (mouseY - ringY) * 0.15;
          ring.style.left = ringX + 'px'; ring.style.top = ringY + 'px';
          requestAnimationFrame(animate);
        };
        animate();
        document.addEventListener('mousedown', () => dot.classList.add('clicking'));
        document.addEventListener('mouseup', () => dot.classList.remove('clicking'));
        const hoverables = 'button, .card, .chip, .list-item, .color-dot, .calendar-day, .quiz-option, .switch, .nav-item, .fab, .input-field';
        document.addEventListener('mouseover', e => {
          if (e.target.matches(hoverables) || e.target.closest(hoverables)) {
            dot.classList.add('hovering'); ring.classList.add('hovering');
          }
        });
        document.addEventListener('mouseout', e => {
          if (e.target.matches(hoverables) || e.target.closest(hoverables)) {
            dot.classList.remove('hovering'); ring.classList.remove('hovering');
          }
        });
      },

      setupMagneticButtons() {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        Utils.qsa('.magnetic:not([data-magnetic])').forEach(btn => {
          btn.dataset.magnetic = '1';
          btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.05)`;
          });
          btn.addEventListener('mouseleave', () => btn.style.transform = '');
          btn.addEventListener('mousedown', () => btn.style.transform += ' scale(0.95)');
          btn.addEventListener('mouseup', () => btn.style.transform = btn.style.transform.replace(' scale(0.95)', ''));
        });
      },

      setupTiltCards() {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        Utils.qsa('.tilt-card:not([data-tilt])').forEach(card => {
          card.dataset.tilt = '1';
          card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const rotateX = (y - 0.5) * -12;
            const rotateY = (x - 0.5) * 12;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            card.style.setProperty('--cursor-x', `${x * 100}%`);
            card.style.setProperty('--cursor-y', `${y * 100}%`);
          });
          card.addEventListener('mouseleave', () => card.style.transform = '');
        });
      },

      setupRipple() {
        if (this._rippleInstalled) return;
        this._rippleInstalled = true;
        document.addEventListener('click', e => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const ripple = document.createElement('span');
          ripple.className = 'ripple-effect';
          const rect = el.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height);
          ripple.style.width = ripple.style.height = size + 'px';
          ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
          ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
          el.appendChild(ripple);
          setTimeout(() => ripple.remove(), 600);
        });
      },

      setupPracticeCardGestures() {
        const card = Utils.qs('#practice-card');
        const front = Utils.qs('#card-front-face');
        if (!card || card.dataset.gesture) return;
        card.dataset.gesture = '1';
        let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false, startTime = 0;

        const startDrag = (x, y) => {
          if (State.get('ui.practiceMode') !== 'flashcard') return;
          startX = x; startY = y; startTime = Date.now();
          isDragging = true; card.classList.add('dragging');
        };
        const moveDrag = (x, y) => {
          if (!isDragging || State.get('ui.practiceMode') !== 'flashcard') return;
          currentX = x - startX; currentY = y - startY;
          const rotate = currentX * 0.05;
          const flipped = card.classList.contains('flipped');
          const base = flipped ? 'rotateY(180deg)' : '';
          card.style.transform = `${base} translateX(${currentX}px) translateY(${currentY * 0.3}px) rotate(${rotate}deg)`;
          Utils.qs('#swipe-left').classList.toggle('show', currentX < -80);
          Utils.qs('#swipe-right').classList.toggle('show', currentX > 80);
        };
        const endDrag = () => {
          if (!isDragging || State.get('ui.practiceMode') !== 'flashcard') return;
          isDragging = false; card.classList.remove('dragging');
          const elapsed = Date.now() - startTime;
          Utils.qs('#swipe-left').classList.remove('show');
          Utils.qs('#swipe-right').classList.remove('show');

          if (Math.abs(currentX) > 100) {
            const dir = currentX > 0 ? 1 : -1;
            card.style.transition = 'transform 0.3s ease';
            card.style.transform = `translateX(${dir * 500}px) rotate(${dir * 30}deg)`;
            setTimeout(() => {
              Actions.rateCard({ rating: dir > 0 ? 'good' : 'again' });
              card.style.transition = '';
            }, 300);
          } else if (elapsed < 200 && Math.abs(currentX) < 10 && Math.abs(currentY) < 10) {
            Actions.flipCard();
            card.style.transform = '';
          } else {
            card.style.transform = '';
          }
          currentX = 0; currentY = 0;
        };

        front.addEventListener('click', () => { if (!isDragging) Actions.flipCard(); });
        card.addEventListener('touchstart', e => startDrag(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        card.addEventListener('touchmove', e => moveDrag(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        card.addEventListener('touchend', endDrag);
        card.addEventListener('mousedown', e => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
        document.addEventListener('mousemove', e => { if (isDragging) moveDrag(e.clientX, e.clientY); });
        document.addEventListener('mouseup', () => { if (isDragging) endDrag(); });
      },

      setupPullToRefresh() {
        const screen = Utils.qs('#screen-words');
        const indicator = screen.querySelector('.ptr-indicator');
        let startY = 0, pulling = false;
        screen.addEventListener('touchstart', e => { if (screen.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; } }, { passive: true });
        screen.addEventListener('touchmove', e => { if (!pulling) return; const diff = e.touches[0].clientY - startY; if (diff > 0 && diff < 120) indicator.style.top = Math.min(diff - 50, 30) + 'px'; }, { passive: true });
        screen.addEventListener('touchend', () => {
          if (!pulling) return; pulling = false;
          const top = parseInt(indicator.style.top || '-50');
          if (top > 20) {
            indicator.classList.add('loading'); indicator.style.top = '30px';
            setTimeout(() => {
              indicator.classList.remove('loading'); indicator.style.top = '-50px';
              WordsScreen.renderList();
              Snackbar.show('Words refreshed');
            }, 1500);
          } else indicator.style.top = '-50px';
        });
      },

      setupSheetDrag(id, handleId) {
        const sheet = Utils.qs(`#${id}`);
        const content = sheet.querySelector('.sheet-content');
        const handle = Utils.qs(`#${handleId}`);
        let startY = 0, currentY = 0, dragging = false;
        const start = e => { dragging = true; startY = e.touches ? e.touches[0].clientY : e.clientY; content.style.transition = 'none'; };
        const move = e => { if (!dragging) return; currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY; if (currentY > 0) content.style.transform = `translateY(${currentY}px)`; };
        const end = () => {
          if (!dragging) return; dragging = false;
          content.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
          if (currentY > 120) { sheet.classList.remove('open'); content.style.transform = ''; }
          else content.style.transform = 'translateY(0)';
          currentY = 0;
        };
        handle.addEventListener('touchstart', start, { passive: true });
        handle.addEventListener('touchmove', move, { passive: true });
        handle.addEventListener('touchend', end);
        handle.addEventListener('mousedown', start);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
      },

      animateCounters() {
        Utils.qsa('.counter').forEach(el => {
          const target = parseInt(el.dataset.target);
          let current = 0;
          const step = Math.ceil(target / 30);
          const timer = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = current;
          }, 30);
        });
      },

      confetti() {
        const container = Utils.qs('#confetti');
        container.innerHTML = '';
        const colors = ['var(--md-sys-color-primary)', 'var(--md-sys-color-secondary)', 'var(--md-sys-color-tertiary)', 'var(--md-sys-color-primary-container)'];
        for (let i = 0; i < 50; i++) {
          const el = document.createElement('div');
          el.className = 'confetti-piece';
          el.style.left = Math.random() * 100 + '%';
          el.style.background = colors[Math.floor(Math.random() * colors.length)];
          el.style.animationDelay = Math.random() * 0.8 + 's';
          container.appendChild(el);
        }
        setTimeout(() => container.innerHTML = '', 3000);
      }
    };

    /* ============================================================
       SNACKBAR
       ============================================================ */
    const Snackbar = {
      timeout: null,
      action: null,
      show(text, actionText = null, action = null) {
        const sb = Utils.qs('#snackbar');
        const actionBtn = Utils.qs('#snackbar-action');
        Utils.qs('#snackbar-text').textContent = text;
        this.action = action;
        if (actionText && action) { actionBtn.textContent = actionText; actionBtn.style.display = 'block'; }
        else actionBtn.style.display = 'none';
        sb.classList.add('show');
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.hide(), 4000);
      },
      hide() { Utils.qs('#snackbar').classList.remove('show'); },
      runAction() { if (this.action) this.action(); this.hide(); }
    };

    /* ============================================================
       INIT
       ============================================================ */
    const Init = {
      start() {
        document.documentElement.style.setProperty('--app-font', CONFIG.theme.font);
        State.init();
        Theme.apply(State.get('ui.seedColor'), State.get('ui.themeMode'));
        this.registerScreens();
        Screens.renderAll();
        this.renderSheets();
        Interactions.init();
        const current = State.get('ui.currentScreen');
        Screens.show(current);
        Interactions.setupSheetDrag('theme-sheet', 'theme-drag-handle');
        Interactions.setupSheetDrag('word-detail-sheet', 'detail-drag-handle');
        Interactions.setupSheetDrag('profile-sheet', 'profile-drag-handle');
      },

      registerScreens() {
        Screens.register(OnboardingScreen);
        Screens.register(HomeScreen);
        Screens.register(WordsScreen);
        Screens.register(AddScreen);
        Screens.register(PracticeScreen);
        Screens.register(SettingsScreen);
      },

      renderSheets() {
        Utils.qs('#sheets').innerHTML = `
          ${Actions.themeSheetContent()}
          ${Components.BottomSheet({
            id: 'word-detail-sheet',
            title: '',
            dragHandleId: 'detail-drag-handle',
            children: `
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-3xl font-normal text-on-surface" id="detail-word"></h3>
                  <p class="text-lg text-on-surface-variant" id="detail-phonetic"></p>
                </div>
                ${Components.Button({ variant: 'tonal', icon: 'volume_up', text: '', action: 'playAudio', classes: 'w-10 h-10 rounded-full !p-0' })}
              </div>
              <div class="card surface-container-high mb-4">
                <p class="text-sm font-medium text-on-surface-variant mb-1">Meaning</p>
                <p class="text-lg text-on-surface" id="detail-meaning"></p>
              </div>
              <div class="card surface-container-high mb-6">
                <p class="text-sm font-medium text-on-surface-variant mb-1">Example</p>
                <p class="text-base text-on-surface italic" id="detail-example"></p>
              </div>
              <div class="flex gap-3">
                ${Components.Button({ variant: 'outline', icon: 'delete', text: 'Delete', action: 'deleteWord', fullWidth: true })}
                ${Components.Button({ text: 'Done', action: 'closeWordDetail', fullWidth: true })}
              </div>
            `
          })}
          ${Components.BottomSheet({
            id: 'profile-sheet',
            title: 'Edit profile',
            dragHandleId: 'profile-drag-handle',
            children: `
              <div class="mb-4">
                <label class="text-sm font-medium text-on-surface-variant block mb-2">Name</label>
                ${Components.Input({ id: 'profile-name-input', value: State.get('user.name') })}
              </div>
              ${Components.Button({ text: 'Save', action: 'saveProfile', fullWidth: true })}
            `
          })}
        `;
      }
    };

    document.addEventListener('DOMContentLoaded', () => Init.start());
  