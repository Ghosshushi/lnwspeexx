/**
 * speexx_helper.js - Ultra-Compact Full-72-Packet & Dual-Mode Speexx Runtime
 * Served via http://localhost:8765/helper.js
 * Exports: window.SpeexxHelper (aliased as window.Speexx & window.speexxHelper)
 */
(() => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const normSpace = (s) => String(s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const cap = (s, n) => {
        const t = normSpace(s);
        return t.length > n ? t.slice(0, n) + '…' : t;
    };

    const isVisible = (el) => {
        if (!el || !(el instanceof Element)) return false;
        const rects = el.getClientRects();
        if (!rects || rects.length === 0) return false;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.02;
    };

    const getScope = () => [
        document.querySelector('.exercise-view:not([style*="display: none"])'),
        document.querySelector('.activity-container'),
        document.querySelector('.exercise-content'),
        document.querySelector('[data-testid="exercise-body"]'),
        document.querySelector('.exercise'),
        document.querySelector('main'),
        document.body
    ].find(c => c && isVisible(c)) || document.body;

    // Selectors tuned for Speexx Angular + jQuery UI + HTML5 DOM
    const DROPZONE_SEL = [
        '.drag-drop-placeholder',
        '.dropzone',
        '[data-dropzone]',
        '.drop-target',
        '.gap-target',
        '.matching-target',
        '.cloze-blank',
        '.placeholder.empty',
        '.gap.empty'
    ].join(', ');

    const DRAGGABLE_SEL = [
        '.drag-drop',
        '.ui-draggable',
        '[draggable="true"]',
        '.draggable',
        '.word-tile',
        '.chip',
        '.cloze-item',
        '[data-role="option"]'
    ].join(', ');

    const PLACED_EXTRA_SEL = '.drag-drop-placed, .item-placed, .placed-item, span[data-word]';
    const BANK_CONTAINER_SEL = '.drag-drop-pool, .word-bank, .options-container, .draggable-pool, .answers-pool, .source-container, .tiles-container, .draggable-container, .word-container, .words-container';
    const INPUT_SEL = 'input[type="text"], input[type="search"], input[type="tel"], input[type="number"], input:not([type]), textarea';
    const SPEAKER_SEL = '.play-button, [data-audio-id], .speaker, button.audio, .audio-button, .listen-button, [class*="speaker"]';
    const MIC_SEL = '.microphone-button, .record-button, .mic-button, [class*="microphone"], [class*="record-btn"], button[aria-label*="record" i], button[aria-label*="บันทึกเสียง"]';
    const SPINNER_SEL = [
        '.spinner',
        '[class*="spinner"]',
        '[class*="loader"]',
        '[class*="loading"]',
        '[class*="busy"]',
        '[class*="waiting"]',
        '[class*="processing"]',
        '.block-ui',
        '.block-ui-overlay',
        '[role="progressbar"]',
        '.fa-spin',
        '.fa-spinner',
        '.fa-circle-o-notch',
        'svg[class*="spin"]'
    ].join(', ');

    const CLOSE_UNIT_SEL = [
        'button.close-exercise',
        'a.close-exercise',
        '.exercise-close',
        '.close-button',
        '.exit-button',
        'header button.close',
        '.navbar button.close',
        '[aria-label*="close" i]',
        '[title*="Close" i]',
        '[ng-click*="close" i]',
        '[ng-click*="exit" i]'
    ].join(', ');

    const DASHBOARD_LINK_SEL = [
        'a[href*="-packet"]',
        'a[href*="/articles/"]',
        'a[href*="pronunciation"]',
        'a[href*="grammar"]',
        'a[href*="video"]',
        'a[href*="vocab"]',
        'a[href*="test"]',
        'a[href*="exam"]',
        'a[href*="checkpoint"]',
        'a[href*="assessment"]',
        'a[href*="milestone"]',
        '[routerlink*="-packet"]',
        '[routerlink*="/articles/"]',
        '[ng-href*="-packet"]',
        '[data-href*="-packet"]'
    ].join(', ');

    const DASHBOARD_CARD_FALLBACK_SEL = [
        'app-packet-card',
        'speexx-packet-card',
        '.packet-card',
        '.article-card',
        '.activity-card',
        '.learning-card',
        '[data-packet-id]',
        '[data-article-id]',
        '[data-testid*="packet"]',
        '[data-testid*="activity-card"]',
        '[ng-click*="packet"]',
        '[ng-click*="openArticle"]'
    ].join(', ');

    const TEST_KEYWORD_RE = /\b(test|exam|checkpoint|assessment|milestone|final\s+test|level\s+test|progress\s+test)\b|test-packet|exam-packet|assessment-packet|checkpoint-packet|ข้อสอบ|แบบทดสอบวัดผล/i;

    const SpeexxHelper = window.SpeexxHelper || window.Speexx || {};
    SpeexxHelper._lastPath = SpeexxHelper._lastPath || '';
    SpeexxHelper._resCursor = SpeexxHelper._resCursor || 0;
    SpeexxHelper._lastPlayedMp3 = SpeexxHelper._lastPlayedMp3 || '';

    // Hook HTMLMediaElement.play once to capture cached .mp3 URLs reliably
    if (!SpeexxHelper._mediaHooked && typeof HTMLMediaElement !== 'undefined') {
        SpeexxHelper._mediaHooked = true;
        const origPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
            try {
                const src = this.currentSrc || this.src || this.querySelector?.('source')?.src || '';
                if (src && /\.mp3(\?|$)/i.test(src)) {
                    SpeexxHelper._lastPlayedMp3 = src;
                }
            } catch (_) { }
            return origPlay.apply(this, args);
        };
    }

    const syncNavigation = () => {
        if (SpeexxHelper._lastPath !== window.location.pathname) {
            SpeexxHelper._lastPath = window.location.pathname;
            SpeexxHelper._resCursor = performance.getEntriesByType('resource').length;
            SpeexxHelper._lastPlayedMp3 = '';
        }
    };

    const normalizePacketKeyFromHref = (hrefStr) => {
        if (!hrefStr) return '';
        try {
            const u = new URL(hrefStr, window.location.origin);
            let p = u.pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
            p = p.replace(/\/exercise\/\d+$/i, '');
            const pkt = p.match(/([a-z0-9-]+-packet\/\d+)$/i)?.[1];
            if (pkt) return pkt.toLowerCase();
            p = p.replace(/^.*?\/articles\/\d+\//, '')
                .replace(/^\/?articles\//, '')
                .replace(/^\d+\//, '')
                .replace(/^\/+|\/+$/g, '');
            return p.toLowerCase();
        } catch (_) {
            return '';
        }
    };

    /**
     * Strip User ID across ALL packet types (standard-packet, pronunciation-packet, video-packet, grammar-packet, test-packet, etc.)
     */
    SpeexxHelper.getPageKey = function () {
        try {
            const rawPath = window.location.pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
            const direct = rawPath.match(/([a-z0-9-]+-packet\/.+)$/)?.[1];
            if (direct) return direct;

            let p = rawPath
                .replace(/^.*?\/articles\/\d+\//, '')
                .replace(/^\/?articles\//, '')
                .replace(/^\d+\//, '')
                .replace(/^\/+|\/+$/g, '');
            p = p.replace(/^([a-z0-9-]+-packet)-(\d+)-(exercise)-(\d+)$/, '$1/$2/$3/$4');
            return p.match(/([a-z0-9-]+-packet\/.+)$/)?.[1] || p;
        } catch (_) {
            return '';
        }
    };

    /**
     * Detect center Loading / ASR Spinner accurately (excluding <html>/<body> webfont classes)
     */
    SpeexxHelper.isSpinnerActive = function () {
        const candidates = Array.from(document.querySelectorAll(SPINNER_SEL));
        for (const el of candidates) {
            if (el === document.documentElement || el === document.body) continue;
            if (!isVisible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 6 || r.height <= 6) continue;
            const cls = String(el.className || '');
            if (/loaded|loading-done|not-loading|ng-hide/i.test(cls)) continue;
            if (r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9) {
                if (!/block-ui|overlay|backdrop/i.test(cls)) continue;
            }
            return true;
        }
        const animIcons = Array.from(getScope().querySelectorAll('i, svg, span, div')).slice(0, 150);
        for (const el of animIcons) {
            if (!isVisible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 12 || r.height < 12 || r.width > 300 || r.height > 300) continue;
            const st = window.getComputedStyle(el);
            if (st.animationName && st.animationName !== 'none' && st.animationPlayState !== 'paused' && /spin|rotate|load/i.test(st.animationName)) {
                return true;
            }
        }
        return false;
    };

    const parseRgbState = (el, includeTextColor = false) => {
        if (!el) return null;
        const st = window.getComputedStyle(el);
        const colors = [st.backgroundColor, st.borderBottomColor, st.borderTopColor];
        if (includeTextColor) colors.push(st.color, st.fill);
        for (const c of colors) {
            const m = String(c || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
            if (!m) continue;
            const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
            const a = m[4] !== undefined ? Number(m[4]) : 1;
            if (a < 0.2) continue;
            if (g > r + 20 && g > b + 15 && g > 80) return 'green';
            if (r > g + 35 && r > 150 && g < 120) return 'red';
            if (r > 180 && g > 110 && b < 100) return 'yellow';
        }
        return null;
    };

    const queryNavTabElements = () => {
        const navContainers = Array.from(document.querySelectorAll(
            '.exercises-large-navigation, .exercises-small-navigation, .exercises-navigation, ul[class*="exercises-"][class*="navigation"], .exercise-tabs'
        ));
        for (const nav of navContainers) {
            if (!isVisible(nav)) continue;
            const lis = Array.from(nav.querySelectorAll('li.exercise-icon, li[class*="exercise-icon"], li')).filter(isVisible);
            if (lis.length > 0) return lis;
        }
        return Array.from(document.querySelectorAll('li.exercise-icon')).filter(isVisible);
    };

    const inspectRawTabs = () => {
        const lis = queryNavTabElements();
        return lis.map((li, idx) => {
            const sq = li.querySelector('.exercise-square, [class*="exercise-square"], [class*="status-bar"], [class*="indicator"]') || li;
            const cls = `${li.className || ''} ${sq.className || ''}`;
            const rawTxt = normSpace(li.innerText);
            const isVideoIcon = /video|play|intro|media|fa-play|icon-play/i.test(`${cls} ${li.innerHTML}`);
            const tab = rawTxt || (isVideoIcon || idx === 0 ? '▶' : `T${idx + 1}`);

            let state = 'white';
            if (/\b(result-green(-with-merit)?|status-green|completed|passed|done)\b/i.test(cls)) {
                state = 'green';
            } else if (/\b(result-red|status-red|failed|wrong|incorrect|error)\b/i.test(cls)) {
                state = 'red';
            } else if (/\b(result-yellow|result-orange|status-yellow|partial|warning)\b/i.test(cls)) {
                state = 'yellow';
            } else if (!/\b(result-white|result-none|result-grey|result-gray|unvisited)\b/i.test(cls)) {
                const rgbState = parseRgbState(sq);
                if (rgbState) state = rgbState;
            }

            const active = li.classList.contains('active') || li.classList.contains('current') || Boolean(li.querySelector('.active'));
            return { idx, tab, state, active, el: li };
        });
    };

    /**
     * Tab Bar Status Inspector (`▶`, `1`, `2`...)
     */
    SpeexxHelper.getTabStatus = function () {
        const raw = inspectRawTabs();
        const incomplete = raw.filter(t => t.state !== 'green').map(t => ({
            idx: t.idx,
            tab: t.tab,
            state: t.state
        }));
        const activeItem = raw.find(t => t.active) || null;
        return {
            total: raw.length,
            allGreen: incomplete.length === 0,
            canExit: !SpeexxHelper.isSpinnerActive() && incomplete.length === 0,
            activeTab: activeItem ? activeItem.tab : null,
            tabs: raw.map(t => `${t.tab}:${t.state}${t.active ? '*' : ''}`),
            incomplete
        };
    };

    /**
     * Tab Bar Sweeper: Click first tab whose underline is still white, red, or yellow (including ▶ video)
     */
    SpeexxHelper.clickFirstIncompleteTab = function () {
        if (SpeexxHelper.isSpinnerActive()) {
            return { ok: false, blocked: 'SPINNER_ACTIVE', pageKey: SpeexxHelper.getPageKey() };
        }
        const raw = inspectRawTabs();
        const incomplete = raw.filter(t => t.state !== 'green');
        if (incomplete.length === 0) {
            return { ok: true, allGreen: true, clicked: false, canExit: true, tabs: raw.map(t => `${t.tab}:${t.state}`), pageKey: SpeexxHelper.getPageKey() };
        }
        const target = incomplete[0];
        if (target.active) {
            return {
                ok: true,
                allGreen: false,
                clicked: false,
                alreadyActive: true,
                idx: target.idx,
                tab: target.tab,
                state: target.state,
                remaining: incomplete.map(t => `${t.tab}:${t.state}`),
                pageKey: SpeexxHelper.getPageKey()
            };
        }
        const clickEl = target.el.querySelector('a, button, .exercise-square, .exercise-number, [role="button"]') || target.el;
        clickEl.click();
        return {
            ok: true,
            allGreen: false,
            clicked: true,
            idx: target.idx,
            tab: target.tab,
            state: target.state,
            remaining: incomplete.map(t => `${t.tab}:${t.state}`),
            pageKey: SpeexxHelper.getPageKey()
        };
    };

    SpeexxHelper.sweepTabs = SpeexxHelper.clickFirstIncompleteTab;

    /**
     * FULL DASHBOARD SCANNER (All 72 Packets across standard, pronunciation, video, grammar, vocabulary, test):
     * - Auto-scrolls BOTH window AND inner scrollable containers + horizontal carousels from top to bottom
     * - Harvests cards at EVERY scroll step (immune to Angular CDK Virtual Scroll unmounting!)
     * - Checks % scores AND green checkmark badges so nothing stops early at 61 units
     */
    const classifyPacketKind = (key, href, cls, title, cardEl) => {
        const blob = `${key} ${href} ${cls} ${title}`;
        if (TEST_KEYWORD_RE.test(blob)) return 'test';
        if (/pronunciation-packet|\b(pronunciation|pronounce|phonetics|speaking)\b|ฝึกพูด|การออกเสียง/i.test(blob) ||
            cardEl?.querySelector?.('.fa-microphone, .icon-microphone, [class*="microphone"]')) {
            return 'pronunciation';
        }
        if (/video-packet|\bvideo\b|วิดีโอ/i.test(blob)) return 'video';
        if (/grammar-packet|\bgrammar\b|ไวยากรณ์/i.test(blob)) return 'grammar';
        if (/vocab(ulary)?-packet|\bvocab(ulary)?\b|คำศัพท์/i.test(blob)) return 'vocabulary';
        return 'standard';
    };

    const resolveSingleCardRoot = (el, ownKey) => {
        let cur = el;
        for (let depth = 0; depth < 6; depth++) {
            const parent = cur.parentElement;
            if (!parent || parent === document.body || parent.tagName === 'MAIN' || parent.tagName === 'SECTION') break;
            const r = parent.getBoundingClientRect();
            if (r.height > 540 || r.width > window.innerWidth * 0.96) break;

            // Ensure parent does NOT merge two distinct packet links (e.g. Standard + Pronunciation inside same Unit row!)
            const innerLinks = Array.from(parent.querySelectorAll(DASHBOARD_LINK_SEL));
            const keys = new Set(
                innerLinks
                    .map(a => normalizePacketKeyFromHref(a.getAttribute('href') || a.href || a.getAttribute('routerlink') || a.getAttribute('ng-href') || a.getAttribute('data-href') || ''))
                    .filter(Boolean)
            );
            if (keys.size > 1 || (keys.size === 1 && ownKey && !keys.has(ownKey))) break;
            cur = parent;
            if (/\b(packet-card|article-card|activity-card|learning-card)\b/i.test(cur.className || '')) break;
        }
        return cur;
    };

    const inspectCardCompletion = (cardEl) => {
        const badgeEls = Array.from(cardEl.querySelectorAll(
            '.score, .percentage, .progress-text, .badge, [class*="percent"], [class*="score"], [class*="progress"]'
        ));
        let score = null;
        for (const b of badgeEls) {
            const m = normSpace(b.innerText || b.textContent).match(/\b(\d{1,3})\s*%/);
            if (m) {
                const v = Number(m[1]);
                if (v <= 100) { score = v; break; }
            }
        }
        if (score === null) {
            const fallbackMatch = normSpace(cardEl.innerText || cardEl.textContent).match(/\b(\d{1,3})\s*%/);
            if (fallbackMatch && Number(fallbackMatch[1]) <= 100) {
                score = Number(fallbackMatch[1]);
            }
        }
        if (score === null) {
            const bar = cardEl.querySelector('[role="progressbar"][aria-valuenow], .progress-bar[style*="width"]');
            if (bar) {
                const ariaNow = Number(bar.getAttribute('aria-valuenow'));
                const stylePct = bar.getAttribute('style')?.match(/width\s*:\s*(\d{1,3})(?:\.\d+)?%/i);
                if (!isNaN(ariaNow) && ariaNow >= 0 && ariaNow <= 100) score = ariaNow;
                else if (stylePct) score = Number(stylePct[1]);
            }
        }

        // Check for green checkmark icon / completed badge
        const checkCandidates = Array.from(cardEl.querySelectorAll(
            '.fa-check, .fa-check-circle, .icon-check, .icon-checkmark, [class*="checkmark"], [class*="check-icon"], [class*="completed-icon"], svg[class*="check"], .packet-completed, .is-completed, .status-completed, .badge-success'
        ));
        let hasGreenCheck = false;
        const cardCls = String(cardEl.className || '');
        const cardMarkedComplete = /\b(is-completed|packet-completed|status-completed|completed|done|passed)\b/i.test(cardCls) &&
            !/\b(not-completed|incomplete|uncompleted)\b/i.test(cardCls);

        if (cardMarkedComplete) {
            hasGreenCheck = true;
        } else {
            for (const chk of checkCandidates) {
                const cCls = `${chk.className || ''} ${chk.parentElement?.className || ''}`;
                if (/ng-hide|hidden|incomplete|not-completed|uncompleted|disabled/i.test(cCls)) continue;
                const st = window.getComputedStyle(chk);
                if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') < 0.1) continue;
                if (/success|green|completed|passed|done|merit/i.test(cCls) || parseRgbState(chk, true) === 'green' || parseRgbState(chk.parentElement, true) === 'green') {
                    hasGreenCheck = true;
                    break;
                }
            }
        }

        const locked = Boolean(
            /\b(locked|is-locked|disabled)\b/i.test(cardCls) ||
            cardEl.querySelector('.fa-lock, .icon-lock, [class*="lock-icon"]')
        );

        const completed = score !== null ? score >= 100 : hasGreenCheck;
        return { score, hasGreenCheck, completed, locked };
    };

    const harvestVisibleCardsInto = (packetMap) => {
        const inExerciseNav = (el) => Boolean(el.closest('.exercises-navigation, .exercises-large-navigation, .exercises-small-navigation, .exercise-tabs'));

        // 1. Harvest all link-based packet cards
        const links = Array.from(document.querySelectorAll(DASHBOARD_LINK_SEL));
        for (const a of links) {
            if (inExerciseNav(a)) continue;
            const rawHref = a.getAttribute('href') || a.href || a.getAttribute('routerlink') || a.getAttribute('ng-href') || a.getAttribute('data-href') || '';
            if (!rawHref || /^javascript:/i.test(rawHref) || rawHref === '#') continue;

            const fullHref = (() => { try { return new URL(rawHref, window.location.origin).href; } catch (_) { return rawHref; } })();
            const key = normalizePacketKeyFromHref(fullHref);
            if (!key) continue;
            // Filter out non-lesson links (profile, settings, support, logout, etc.)
            if (/^(login|logout|profile|settings|account|help|support|privacy|terms|dashboard|home)$/i.test(key)) continue;
            const looksLikeActivity = /-packet\/\d+/i.test(key) ||
                /\b(pronunciation|standard|video|grammar|vocab|test|exam|checkpoint|assessment|milestone)\b/i.test(`${key} ${a.className || ''}`) ||
                /\/articles\/\d+\/.+/i.test(fullHref);
            if (!looksLikeActivity) continue;

            const cardEl = resolveSingleCardRoot(a, key);
            const titleEl = cardEl.querySelector('.card-title, .packet-title, .article-title, .title, h2, h3, h4, h5') || a;
            const title = cap(titleEl.innerText || titleEl.textContent || a.getAttribute('aria-label') || key, 85);
            const kind = classifyPacketKind(key, fullHref, `${cardEl.className || ''} ${a.className || ''}`, title, cardEl);
            const status = inspectCardCompletion(cardEl);

            const prev = packetMap.get(key);
            const entry = {
                key,
                kind,
                title: title || prev?.title || key,
                href: fullHref,
                score: status.score ?? prev?.score ?? null,
                hasGreenCheck: status.hasGreenCheck || Boolean(prev?.hasGreenCheck),
                completed: status.score !== null ? status.score >= 100 : (status.hasGreenCheck || Boolean(prev?.completed)),
                locked: status.locked,
                el: a
            };
            packetMap.set(key, entry);
        }

        // 2. Harvest Angular/React clickable cards that have no <a href>
        const fallbackCards = Array.from(document.querySelectorAll(DASHBOARD_CARD_FALLBACK_SEL));
        for (const cardEl of fallbackCards) {
            if (inExerciseNav(cardEl)) continue;
            if (cardEl.querySelector(DASHBOARD_LINK_SEL)) continue; // Already handled above
            const pktId = cardEl.getAttribute('data-packet-id') || cardEl.getAttribute('data-article-id') || cardEl.id || '';
            const titleEl = cardEl.querySelector('.card-title, .packet-title, .title, h2, h3, h4, h5') || cardEl;
            const title = cap(titleEl.innerText || titleEl.textContent, 85);
            if (!pktId && !title) continue;

            const kind = classifyPacketKind(pktId, '', cardEl.className || '', title, cardEl);
            const key = pktId ? `${kind}-card/${pktId}` : `${kind}-card/${title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '-').slice(0, 45)}`;
            const status = inspectCardCompletion(cardEl);
            const prev = packetMap.get(key);
            packetMap.set(key, {
                key,
                kind,
                title: title || prev?.title || key,
                href: '',
                score: status.score ?? prev?.score ?? null,
                hasGreenCheck: status.hasGreenCheck || Boolean(prev?.hasGreenCheck),
                completed: status.score !== null ? status.score >= 100 : (status.hasGreenCheck || Boolean(prev?.completed)),
                locked: status.locked,
                el: cardEl
            });
        }
    };

    const getScrollableContainers = () => {
        const scrollables = [];
        const docScroll = document.scrollingElement || document.documentElement;
        if (docScroll) scrollables.push(docScroll);

        Array.from(document.querySelectorAll('main, [class*="scroll"], [class*="content"], [class*="dashboard"], [class*="container"], section, div')).forEach(el => {
            if (el === document.body || el === document.documentElement) return;
            if (el.scrollHeight > el.clientHeight + 80 && el.clientHeight > 150) {
                const st = window.getComputedStyle(el);
                if (/auto|scroll|overlay/i.test(st.overflowY)) {
                    scrollables.push(el);
                }
            }
        });
        return scrollables;
    };

    const sweepHorizontalCarousels = async (packetMap) => {
        const horiz = Array.from(document.querySelectorAll('[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="row"], [class*="packets"], div, ul'))
            .filter(el => el.scrollWidth > el.clientWidth + 80 && el.clientWidth > 180 && /auto|scroll/i.test(window.getComputedStyle(el).overflowX));
        for (const h of horiz) {
            const orig = h.scrollLeft;
            const step = Math.max(260, Math.floor(h.clientWidth * 0.75));
            for (let x = 0; x <= h.scrollWidth; x += step) {
                h.scrollLeft = x;
                await sleep(90);
                harvestVisibleCardsInto(packetMap);
            }
            h.scrollLeft = orig;
        }
    };

    SpeexxHelper.scanAllPackets = async function (opts = {}) {
        while (SpeexxHelper.isSpinnerActive()) {
            await sleep(350);
        }

        const packetMap = new Map();
        harvestVisibleCardsInto(packetMap);

        const containers = getScrollableContainers();
        for (const sc of containers) {
            const isDoc = (sc === document.scrollingElement || sc === document.documentElement);
            const setTop = (y) => {
                if (isDoc) window.scrollTo(0, y);
                else sc.scrollTop = y;
            };

            // Start from top (0) and step down to dynamic scrollHeight so virtualized lists yield 100% of cards!
            setTop(0);
            await sleep(180);
            harvestVisibleCardsInto(packetMap);
            await sweepHorizontalCarousels(packetMap);

            const step = Math.max(380, Math.floor((sc.clientHeight || window.innerHeight) * 0.68));
            let pos = 0;
            let guard = 0;
            while (guard < 80) {
                guard++;
                pos += step;
                setTop(pos);
                await sleep(180);

                // Click any "Show more" / "Load more" expander buttons if present
                const loadMoreBtn = findBtn(/^(load\s+more|show\s+more|see\s+more|แสดงเพิ่มเติม|โหลดเพิ่ม)$/i);
                if (loadMoreBtn) {
                    loadMoreBtn.click();
                    await sleep(350);
                }

                harvestVisibleCardsInto(packetMap);
                const maxScroll = Math.max(0, sc.scrollHeight - (sc.clientHeight || window.innerHeight));
                if (pos >= maxScroll) {
                    // Double-check if lazy loader grew scrollHeight at bottom
                    await sleep(260);
                    harvestVisibleCardsInto(packetMap);
                    await sweepHorizontalCarousels(packetMap);
                    if (pos >= Math.max(0, sc.scrollHeight - (sc.clientHeight || window.innerHeight))) break;
                }
            }
        }

        const all = Array.from(packetMap.values());
        const byKind = {};
        for (const p of all) {
            if (!byKind[p.kind]) byKind[p.kind] = { done: 0, total: 0 };
            byKind[p.kind].total++;
            if (p.completed) byKind[p.kind].done++;
        }

        const incompleteList = all.filter(p => !p.completed);
        const completedCount = all.length - incompleteList.length;

        let openedTarget = null;
        let blockedTestCard = null;
        if (opts.openFirst && incompleteList.length > 0) {
            const skipPron = opts.skipPronunciation !== false;
            const filteredIncomplete = skipPron
                ? incompleteList.filter(p => p.kind !== 'pronunciation' && !/pronunciation-packet/i.test(p.key))
                : incompleteList;
            const unlocked = filteredIncomplete.filter(p => !p.locked);
            const pool = unlocked.length > 0 ? unlocked : filteredIncomplete;
            const nonTestCandidate = pool.find(p => p.kind !== 'test' && !TEST_KEYWORD_RE.test(`${p.key} ${p.title}`));
            const candidate = opts.allowTest ? pool[0] : nonTestCandidate;

            if (!candidate && pool.length > 0) {
                const t = pool[0];
                blockedTestCard = { key: t.key, kind: t.kind, title: t.title, href: t.href };
            } else if (candidate) {
                openedTarget = { key: candidate.key, kind: candidate.kind, score: candidate.score, title: candidate.title, href: candidate.href };
                if (candidate.href) {
                    window.location.href = candidate.href;
                } else if (candidate.el && candidate.el.isConnected) {
                    candidate.el.scrollIntoView({ block: 'center' });
                    candidate.el.click();
                }
            }
        }

        const res = {
            total: all.length,
            completedCount,
            incompleteCount: incompleteList.length,
            all72Complete: all.length >= 72 && incompleteList.length === 0,
            opened: openedTarget
        };
        if (blockedTestCard) res.blockedTest = blockedTestCard;
        if (opts.full) {
            res.byKind = byKind;
            res.incomplete = incompleteList.map(p => ({ key: p.key, kind: p.kind, score: p.score, locked: p.locked, title: p.title }));
        }
        return res;
    };

    SpeexxHelper.openNextIncompletePacket = async function (opts = {}) {
        return await SpeexxHelper.scanAllPackets({ ...opts, openFirst: true });
    };

    const getActiveTabState = () => {
        const raw = inspectRawTabs();
        const act = raw.find(t => t.active);
        return act ? act.state : null;
    };

    SpeexxHelper.getScore = function () {
        const candidates = Array.from(document.querySelectorAll(
            '.score, .result-score, .percentage, .exercise-score, [class*="score"], [class*="percent"]'
        )).filter(isVisible);
        for (const el of candidates) {
            const m = normSpace(el.innerText).match(/(\d{1,3})\s*(?:%|\/\s*100)/);
            if (m) return Number(m[1]);
        }
        // Fallback: check active top tab underline color (green = 100, red/yellow = 0)
        const tabState = getActiveTabState();
        if (tabState === 'green') return 100;
        if (tabState === 'red' || tabState === 'yellow') return 0;
        const scope = getScope();
        if (scope.querySelector('.result-red, .result-yellow, .result-orange')) return 0;
        if (scope.querySelector('.result-green, .result-green-with-merit')) return 100;
        return null;
    };

    const getActionButtons = () => Array.from(document.querySelectorAll('button, a[role="button"], .btn')).filter(isVisible).map(el => ({
        el,
        txt: normSpace(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || ''),
        cls: String(el.className || '')
    }));

    const isBtnEnabled = (el) => Boolean(el && isVisible(el) && !el.disabled && !el.classList.contains('disabled') && el.getAttribute('aria-disabled') !== 'true');
    const findBtn = (regex) => getActionButtons().find(b => isBtnEnabled(b.el) && (regex.test(b.txt) || regex.test(b.cls)))?.el || null;

    const getDropzones = (scope = getScope()) => {
        const raw = Array.from(scope.querySelectorAll(DROPZONE_SEL)).filter(isVisible);
        return raw.filter(z => !z.closest(BANK_CONTAINER_SEL) && !z.matches(DRAGGABLE_SEL) && !raw.some(other => other !== z && z.contains(other)));
    };

    const getDraggables = (scope = getScope()) => {
        const raw = Array.from(scope.querySelectorAll(DRAGGABLE_SEL)).filter(isVisible);
        return raw.filter(d => !raw.some(other => other !== d && d.contains(other)));
    };

    const getTextInputs = (scope = getScope()) => Array.from(scope.querySelectorAll(INPUT_SEL)).filter(el => {
        if (!isVisible(el)) return false;
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        return !['hidden', 'radio', 'checkbox', 'button', 'submit', 'reset', 'file'].includes(t);
    });

    /**
     * TEST MODE vs NORMAL MODE DETECTOR (`SpeexxHelper.detectMode()`):
     * - Test Mode (Milestone / Checkpoint / Assessment / Exam):
     *   Detected by URL/Header keywords (`test`, `exam`, `checkpoint`, `assessment`, `milestone`)
     *   OR interactive question page WITHOUT a `Correction` button!
     * - Normal Mode (Standard / Video / Grammar / Pronunciation):
     *   Has `Correction` button (or is Pronunciation/Video/Dashboard), allows high-speed practice + Correction repair.
     */
    SpeexxHelper.detectMode = function () {
        const scope = getScope();
        const pageKey = SpeexxHelper.getPageKey();
        const pathname = window.location.pathname;
        const reasons = [];

        const headerEls = Array.from(document.querySelectorAll(
            '.activity-header, .exercise-header, .packet-header, .unit-title, .packet-title, .breadcrumb, header h1, header h2, .navbar-brand'
        )).filter(isVisible);
        const headerText = headerEls.map(el => normSpace(el.innerText)).join(' | ');

        const urlMatch = `${pathname} ${pageKey}`.match(TEST_KEYWORD_RE);
        if (urlMatch) reasons.push(`URL:${urlMatch[0]}`);

        const hdrMatch = headerText.match(TEST_KEYWORD_RE);
        if (hdrMatch) reasons.push(`HEADER:${hdrMatch[0]}`);

        // Check if Correction / Repeat / Solution UI button exists (even if currently disabled before answering)
        const corrEl = document.querySelector('button.action-exercise-button.correct, button.action-exercise-button.repeat, button.action-exercise-button.solution');
        const corrVisible = (corrEl && isVisible(corrEl)) || getActionButtons().some(b => /correction|ตรวจ|repeat|ทำซ้ำ|solution|เฉลย/i.test(`${b.txt} ${b.cls}`));

        const mics = Array.from(scope.querySelectorAll(MIC_SEL)).filter(isVisible);
        const isPronunciation = mics.length > 0 || pageKey.startsWith('pronunciation-packet/');
        const videos = Array.from(scope.querySelectorAll('video, .video-js, .vjs-tech, [class*="video-player"]')).filter(isVisible);
        const tabSt = SpeexxHelper.getTabStatus();
        const isVideo = !isPronunciation && (videos.length > 0 || pageKey.startsWith('video-packet/') || tabSt.activeTab === '▶');

        const hasInteractive = (
            getDropzones(scope).length > 0 ||
            getTextInputs(scope).length > 0 ||
            Array.from(scope.querySelectorAll('select')).some(isVisible) ||
            Array.from(scope.querySelectorAll('input[type="radio"], input[type="checkbox"]')).some(el => isVisible(el) || isVisible(el.parentElement))
        );

        const isDashboard = !hasInteractive && !isPronunciation && !isVideo && tabSt.total === 0 &&
            document.querySelectorAll(DASHBOARD_LINK_SEL).length > 0 && !pageKey.includes('/exercise/');

        if (!isDashboard && !isPronunciation && !isVideo && hasInteractive && !corrVisible) {
            reasons.push('NO_CORRECTION_BTN');
        }

        const isTest = !isDashboard && (Boolean(urlMatch || hdrMatch) || (hasInteractive && !isPronunciation && !corrVisible));
        const mode = isDashboard ? 'dashboard' : (isTest ? 'test' : 'normal');
        const subMode = isDashboard
            ? 'dashboard'
            : (isTest ? 'exam' : (isPronunciation ? 'pronunciation' : (isVideo ? 'video' : 'practice')));

        return {
            mode,
            isTest,
            subMode,
            hasCorrection: Boolean(corrVisible),
            reasons,
            policy: isTest ? 'STRICT_ONE_SHOT_EXAM' : (isDashboard ? 'FULL_72_SCAN' : 'FAST_NORMAL_CORRECTION')
        };
    };

    const getTileLabel = (el) => {
        if (!el) return '';
        const txt = normSpace(el.innerText || el.textContent);
        if (txt) return txt;
        const aria = normSpace(el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-value') || '');
        if (aria) return aria;
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (img) {
            const alt = normSpace(img.getAttribute('alt') || img.getAttribute('title') || '');
            if (alt) return alt;
            if (img.src) return img.src.split('/').pop().split('?')[0];
        }
        return '';
    };

    const getZoneValue = (zone) => {
        if (!zone) return '';
        const placed = zone.querySelector(DRAGGABLE_SEL + ', ' + PLACED_EXTRA_SEL);
        if (placed) {
            const lbl = getTileLabel(placed);
            if (lbl) return lbl;
        }
        const inp = zone.querySelector('input');
        if (inp && inp.value) return normSpace(inp.value);
        const img = zone.querySelector('img');
        if (img && img.src) return normSpace(img.getAttribute('alt') || img.src.split('/').pop().split('?')[0]);
        return normSpace(zone.innerText || zone.textContent);
    };

    const isZoneFilled = (zone) => {
        const v = getZoneValue(zone);
        return v.length > 0 && v !== '___' && v !== '...';
    };

    const collectAudioUrls = (scope = getScope()) => {
        syncNavigation();
        const urls = new Set();
        if (SpeexxHelper._lastPlayedMp3) urls.add(SpeexxHelper._lastPlayedMp3);
        scope.querySelectorAll('audio[src], audio source[src], [data-audio-url], [data-src*=".mp3"]').forEach(el => {
            const u = el.src || el.getAttribute('src') || el.getAttribute('data-audio-url') || el.getAttribute('data-src');
            if (u && u.includes('.mp3')) urls.add(u);
        });
        const res = performance.getEntriesByType('resource').slice(SpeexxHelper._resCursor);
        res.forEach(r => {
            if (r.name && r.name.includes('.mp3')) urls.add(r.name);
        });
        return Array.from(urls);
    };

    SpeexxHelper.collectAudio = async function () {
        syncNavigation();
        const scope = getScope();
        const speakers = Array.from(scope.querySelectorAll(SPEAKER_SEL)).filter(isVisible);
        for (const spk of speakers) {
            spk.click();
            await sleep(420);
            document.querySelectorAll('audio').forEach(a => { try { a.muted = true; a.pause(); } catch (_) { } });
        }
        await sleep(250);
        return collectAudioUrls(scope);
    };

    /**
     * Compact DOM Inspector (includes mode, isTest, top tab status, speaker count & spinner state)
     */
    SpeexxHelper.inspect = function () {
        syncNavigation();
        const scope = getScope();
        const pageKey = SpeexxHelper.getPageKey();
        const score = SpeexxHelper.getScore();
        const tabStatus = SpeexxHelper.getTabStatus();
        const modeInfo = SpeexxHelper.detectMode();

        const zones = getDropzones(scope);
        const draggables = getDraggables(scope);
        const inputs = getTextInputs(scope);
        const selects = Array.from(scope.querySelectorAll('select')).filter(isVisible);
        const radios = Array.from(scope.querySelectorAll('input[type="radio"]')).filter(el => isVisible(el) || isVisible(el.parentElement));
        const checkboxes = Array.from(scope.querySelectorAll('input[type="checkbox"]')).filter(el => isVisible(el) || isVisible(el.parentElement));
        const videos = Array.from(scope.querySelectorAll('video, .video-js, .vjs-tech, [class*="video-player"]')).filter(isVisible);
        const mics = Array.from(scope.querySelectorAll(MIC_SEL)).filter(isVisible);
        const speakers = Array.from(scope.querySelectorAll(SPEAKER_SEL)).filter(isVisible);
        const gapToggles = Array.from(scope.querySelectorAll('.gap-container button, .toggle-container button')).filter(isVisible);

        const interactiveKinds = [
            zones.length > 0 ? 'drag' : null,
            inputs.length > 0 ? 'input' : null,
            gapToggles.length > 0 ? 'toggle' : null,
            selects.length > 0 ? 'select' : null,
            radios.length > 0 ? 'radio' : null,
            checkboxes.length > 0 ? 'checkbox' : null
        ].filter(Boolean);

        let type = 'info';
        if (modeInfo.mode === 'dashboard') {
            type = 'overview';
        } else if (mics.length > 0 || pageKey.startsWith('pronunciation-packet/')) {
            type = 'speaking';
        } else if (interactiveKinds.length > 1) {
            type = 'mixed';
        } else if (interactiveKinds.length === 1) {
            type = interactiveKinds[0];
        } else if (videos.length > 0 || pageKey.startsWith('video-packet/') || tabStatus.activeTab === '▶') {
            type = 'video';
        }

        const questions = [];
        const options = [];

        const instEl = scope.querySelector('.exercise-instruction, .instruction, .task-description, .activity-header h2, .activity-header h3, .prompt');
        if (instEl && isVisible(instEl)) {
            const inst = cap(instEl.innerText, 220);
            if (inst) questions.push(`[Task] ${inst}`);
        }

        const passageEls = Array.from(scope.querySelectorAll('.reading-text p, .article-body p, .dialogue-line, .text-passage, .email-text, .story-text')).filter(isVisible);
        if (passageEls.length > 0) {
            const passage = cap(passageEls.map(p => normSpace(p.innerText)).filter(Boolean).join(' / '), 1200);
            if (passage) questions.push(`[Text] ${passage}`);
        }

        if (type === 'overview') {
            questions.push('[Dashboard] Run await SpeexxHelper.scanAllPackets() to scan all 72 packets');
        } else if (type === 'speaking') {
            const spkItems = Array.from(scope.querySelectorAll('.pronunciation-item, .speaking-item, .word-item, .sentence-item, .item')).filter(isVisible);
            if (spkItems.length > 0) {
                spkItems.forEach((it, i) => questions.push(`#${i + 1}: ${cap(it.innerText, 120)}`));
            } else {
                questions.push(`#1: ${cap(scope.innerText, 200)}`);
            }
        } else {
            const slotSelector = [DROPZONE_SEL, INPUT_SEL, 'select', '.gap-container'].join(', ');
            const rawSlots = Array.from(scope.querySelectorAll(slotSelector)).filter(el => {
                if (el.matches(DROPZONE_SEL)) return zones.includes(el);
                if (el.matches('select')) return selects.includes(el);
                if (el.matches('.gap-container')) return isVisible(el);
                return inputs.includes(el);
            });

            if (rawSlots.length > 0) {
                const blockMap = new Map();
                rawSlots.forEach((slot, idx) => {
                    const n = idx + 1;
                    const block = slot.closest('.item, li, tr, p, .sentence, .cloze-line, .question-row') || slot.parentElement || slot;
                    if (!blockMap.has(block)) blockMap.set(block, []);
                    blockMap.get(block).push({ slot, n });
                });

                blockMap.forEach((entries, block) => {
                    const img = block.querySelector('img');
                    const imgTag = img && img.src ? `[img:${img.src.split('?')[0]}] ` : '';
                    const clone = block.cloneNode(true);
                    const cloneCandidates = Array.from(clone.querySelectorAll(slotSelector));
                    let matched = 0;
                    cloneCandidates.forEach(cEl => {
                        const entry = entries[matched];
                        if (!entry) return;
                        const isTarget = cEl.matches(DROPZONE_SEL) || cEl.matches('select') || cEl.matches('.gap-container') ||
                            !['hidden', 'radio', 'checkbox', 'button', 'submit'].includes((cEl.getAttribute('type') || 'text').toLowerCase());
                        if (isTarget) {
                            cEl.replaceWith(` [#${entry.n}] `);
                            matched++;
                        }
                    });
                    const line = cap(clone.innerText, 280);
                    questions.push(`${imgTag}${line || entries.map(e => `[#${e.n}]`).join(' ')}`.trim());
                });
            }

            if (radios.length > 0) {
                const groups = new Map();
                radios.forEach((r, i) => {
                    const key = r.name || `rg_${i}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(r);
                });
                let qIdx = 1;
                groups.forEach(rList => {
                    const container = rList[0].closest('.question, .mcq, .item, li, fieldset, div') || rList[0].parentElement;
                    const opts = rList.map((r, idx) => {
                        const lbl = r.labels?.[0] || r.closest('label') || r.parentElement;
                        return `[${idx}] ${cap(lbl ? lbl.innerText : r.value, 90)}`;
                    });
                    const stemEl = container?.querySelector('.question-text, .stem, p, h4');
                    const stem = stemEl ? cap(stemEl.innerText, 160) : `Radio#${qIdx}`;
                    questions.push(`Q${qIdx++}: ${stem} -> ${opts.join(' | ')}`);
                });
            }

            if (checkboxes.length > 0) {
                checkboxes.forEach((cb, idx) => {
                    const lbl = cb.labels?.[0] || cb.closest('label') || cb.parentElement;
                    questions.push(`#${idx + 1}: ${cap(lbl ? lbl.innerText : cb.value, 160)}`);
                });
            }

            if (draggables.length > 0) {
                draggables.forEach(d => {
                    if (!zones.some(z => z.contains(d))) {
                        const t = getTileLabel(d);
                        if (t) options.push(t);
                    }
                });
                // For pre-filled Matching / Reorder exercises (no separate Word Bank): include tiles already inside dropzones!
                if (options.length === 0 && zones.length > 0) {
                    zones.forEach(z => {
                        const v = getZoneValue(z);
                        if (v) options.push(v);
                    });
                }
            } else if (selects.length > 0) {
                selects.forEach(s => {
                    options.push(Array.from(s.options).map(o => normSpace(o.text)).filter(Boolean));
                });
            }
        }

        const audioUrls = collectAudioUrls(scope);
        return {
            pageKey,
            mode: modeInfo.mode,
            isTest: modeInfo.isTest,
            modeReasons: modeInfo.reasons,
            score,
            type,
            spinning: SpeexxHelper.isSpinnerActive(),
            allTabsGreen: tabStatus.allGreen,
            tabs: tabStatus.tabs,
            speakerCount: speakers.length,
            audioUrls,
            questions,
            options
        };
    };

    /**
     * Clear placed items in dropzones back to Word Bank.
     * - preserveGreen = false (default on initial fill): clears 100% of placed items back to Word Bank!
     * - preserveGreen = true (inside Smart Correction Loop): keeps green-locked slots untouched!
     */
    SpeexxHelper.clearDropzones = function (preserveGreen = false) {
        let cleared = 0;
        const scope = getScope();
        const zones = getDropzones(scope);
        const isGreen = (el) => Boolean(el && /\bresult-green(-with-merit)?\b/i.test(`${el.className || ''} ${el.parentElement?.className || ''}`));

        zones.forEach(z => {
            if (preserveGreen && isGreen(z)) return;
            z.querySelectorAll(DRAGGABLE_SEL + ', ' + PLACED_EXTRA_SEL).forEach(it => {
                if (isVisible(it) && !(preserveGreen && isGreen(it))) {
                    it.click();
                    cleared++;
                }
            });
        });
        scope.querySelectorAll(PLACED_EXTRA_SEL).forEach(it => {
            if (isVisible(it) && !it.closest(BANK_CONTAINER_SEL) && !(preserveGreen && isGreen(it))) {
                it.click();
                cleared++;
            }
        });
        return cleared;
    };

    /**
     * Engine 1: PointerEvent at exact target coordinates -> Engine 2: DragEvent (DataTransfer) fallback
     * -> Engine 3: MouseEvent / jQuery UI -> Engine 4: Click-Pair fallback
     */
    SpeexxHelper.moveItem = function (sourceEl, targetZone) {
        if (!sourceEl || !targetZone) return false;
        try {
            sourceEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            targetZone.scrollIntoView({ block: 'nearest', inline: 'nearest' });

            const countUnfilled = () => getDropzones(getScope()).filter(z => !isZoneFilled(z)).length;
            const beforeUnfilled = countUnfilled();
            const wantedLabel = getTileLabel(sourceEl);
            const didApply = () => !targetZone.isConnected || !isVisible(targetZone) ||
                (wantedLabel && getZoneValue(targetZone) === wantedLabel) ||
                (!wantedLabel && isZoneFilled(targetZone)) ||
                countUnfilled() < beforeUnfilled;

            const sRect = sourceEl.getBoundingClientRect();
            const tRect = targetZone.getBoundingClientRect();
            const sx = sRect.left + sRect.width / 2;
            const sy = sRect.top + sRect.height / 2;
            const tx = tRect.left + tRect.width / 2;
            const ty = tRect.top + tRect.height / 2;

            // Primary Engine: PointerEvent sequence with exact target coordinates
            const ptrInit = (x, y, buttons = 1) => ({
                bubbles: true, cancelable: true, composed: true, view: window,
                pointerId: 1, pointerType: 'mouse', isPrimary: true,
                button: 0, buttons, clientX: x, clientY: y, screenX: x, screenY: y
            });
            sourceEl.dispatchEvent(new PointerEvent('pointerdown', ptrInit(sx, sy, 1)));
            sourceEl.dispatchEvent(new PointerEvent('pointermove', ptrInit(sx + 6, sy + 6, 1)));
            window.dispatchEvent(new PointerEvent('pointermove', ptrInit(tx, ty, 1)));
            targetZone.dispatchEvent(new PointerEvent('pointerenter', ptrInit(tx, ty, 1)));
            targetZone.dispatchEvent(new PointerEvent('pointerover', ptrInit(tx, ty, 1)));
            targetZone.dispatchEvent(new PointerEvent('pointermove', ptrInit(tx, ty, 1)));
            targetZone.dispatchEvent(new PointerEvent('pointerup', ptrInit(tx, ty, 0)));
            window.dispatchEvent(new PointerEvent('pointerup', ptrInit(tx, ty, 0)));
            if (didApply()) return true;

            // Secondary Fallback: HTML5 DragEvent with DataTransfer at exact coordinates
            const dt = new DataTransfer();
            try { dt.setData('text/plain', getTileLabel(sourceEl)); } catch (_) { }
            sourceEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, dataTransfer: dt }));
            targetZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, clientX: tx, clientY: ty, dataTransfer: dt }));
            targetZone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: tx, clientY: ty, dataTransfer: dt }));
            targetZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: tx, clientY: ty, dataTransfer: dt }));
            sourceEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, clientX: tx, clientY: ty, dataTransfer: dt }));
            if (didApply()) return true;

            // Tertiary Fallback: Native MouseEvent + jQuery UI Droppable
            const mouseInit = (x, y) => ({
                bubbles: true, cancelable: true, view: window,
                button: 0, buttons: 1, which: 1, clientX: x, clientY: y, screenX: x, screenY: y
            });
            sourceEl.dispatchEvent(new MouseEvent('mousedown', mouseInit(sx, sy)));
            document.dispatchEvent(new MouseEvent('mousemove', mouseInit(sx + 4, sy + 4)));
            document.dispatchEvent(new MouseEvent('mousemove', mouseInit(tx, ty)));
            targetZone.dispatchEvent(new MouseEvent('mousemove', mouseInit(tx, ty)));
            targetZone.dispatchEvent(new MouseEvent('mouseup', mouseInit(tx, ty)));
            document.dispatchEvent(new MouseEvent('mouseup', mouseInit(tx, ty)));
            if (didApply()) return true;

            if (window.jQuery) {
                const $src = window.jQuery(sourceEl);
                const $tgt = window.jQuery(targetZone);
                const dropInst = $tgt.data('ui-droppable') || $tgt.data('droppable');
                if (dropInst && typeof dropInst._trigger === 'function') {
                    const fakeEvt = window.jQuery.Event('mouseup', { target: sourceEl, pageX: tx + window.scrollX, pageY: ty + window.scrollY });
                    dropInst._trigger('drop', fakeEvt, {
                        draggable: $src,
                        helper: $src,
                        position: $tgt.position(),
                        offset: $tgt.offset()
                    });
                    if (didApply()) return true;
                }
            }

            // Final Fallback: Click-to-select tile -> Click target zone
            sourceEl.click();
            targetZone.click();
            return didApply();
        } catch (err) {
            console.error('[SpeexxHelper] moveItem error:', err);
            return false;
        }
    };

    /**
     * Clear dropzones + Move words/images via PointerEvent & DragEvent
     * Re-queries live unfilled dropzone Element after EVERY single word (zero index-shift) + strict Case-Sensitive ===
     */
    SpeexxHelper.clearAndMoveDragDrop = async function (answers, opts = {}) {
        if (!answers) return { ok: false, error: 'NO_ANSWERS' };
        const preserveGreen = Boolean(opts.preserveGreen);
        if (SpeexxHelper.clearDropzones(preserveGreen) > 0) {
            await sleep(200);
        }

        const initialZones = getDropzones(getScope());
        const totalSlots = initialZones.length;
        if (totalSlots === 0) return { ok: true, placed: 0, total: 0 };

        const lockedGreenMask = initialZones.map(z => preserveGreen && isZoneFilled(z));

        let orderedAnswers = answers;
        if (!Array.isArray(answers) && typeof answers === 'object') {
            const entries = Object.entries(answers);
            orderedAnswers = initialZones.map(z => {
                const card = z.closest('.item, li, tr, div') || z.parentElement;
                const src = card?.querySelector('img')?.src || '';
                for (const [k, v] of entries) {
                    if (src && String(v).length > 1 && src.includes(String(v))) return k;
                    if (src && String(k).length > 1 && src.includes(String(k))) return String(v);
                }
                return '';
            });
        }

        let placed = 0;
        let unfilledOffset = 0;
        const usedTiles = new Set();

        for (let i = 0; i < totalSlots; i++) {
            if (lockedGreenMask[i]) {
                placed++;
                continue;
            }

            const targetText = normSpace(orderedAnswers[i]);
            if (!targetText) {
                unfilledOffset++;
                continue;
            }

            // Re-query live DOM for current dropzones & tiles after EVERY single word!
            const liveScope = getScope();
            const liveAllZones = getDropzones(liveScope);
            const liveUnfilled = liveAllZones.filter(z => !isZoneFilled(z));
            const isSwapMode = liveUnfilled.length === 0 && liveAllZones.length === totalSlots;
            const targetZone = isSwapMode ? liveAllZones[i] : liveUnfilled[unfilledOffset];
            if (!targetZone) break;

            // In Swap/Matching mode, if targetZone already holds the exact right word, mark it done and skip!
            if (isSwapMode && getZoneValue(targetZone) === targetText) {
                const insideEl = targetZone.querySelector(DRAGGABLE_SEL + ', ' + PLACED_EXTRA_SEL);
                if (insideEl) usedTiles.add(insideEl);
                placed++;
                continue;
            }

            let bankTiles = getDraggables(liveScope).filter(el =>
                !usedTiles.has(el) && !liveAllZones.some(z => z.contains(el))
            );
            // Fallback for pre-filled Matching / Swap exercises: search draggables inside other unlocked dropzones!
            if (bankTiles.length === 0) {
                bankTiles = getDraggables(liveScope).filter(el => {
                    if (usedTiles.has(el)) return false;
                    const ownerZone = liveAllZones.find(z => z.contains(el));
                    if (!ownerZone) return true;
                    const ownerIdx = liveAllZones.indexOf(ownerZone);
                    if (ownerIdx >= 0 && lockedGreenMask[ownerIdx]) return false;
                    if (isSwapMode && ownerIdx >= 0 && ownerIdx < i && getZoneValue(ownerZone) === normSpace(orderedAnswers[ownerIdx])) return false;
                    return true;
                });
            }

            // 1st priority: Strict Case-Sensitive === match!
            let tile = bankTiles.find(el => getTileLabel(el) === targetText);
            // 2nd priority: Image filename / src substring match
            if (!tile) {
                tile = bankTiles.find(el => {
                    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
                    return Boolean(img?.src && targetText.length > 2 && img.src.includes(targetText));
                });
            }
            // 3rd priority: Case-insensitive fallback ONLY if no exact case tile exists
            if (!tile) {
                tile = bankTiles.find(el => getTileLabel(el).toLowerCase() === targetText.toLowerCase());
            }

            if (tile) {
                const moved = SpeexxHelper.moveItem(tile, targetZone);
                await sleep(95);
                if (moved) {
                    usedTiles.add(tile);
                    placed++;
                } else {
                    unfilledOffset++;
                }
            } else {
                unfilledOffset++;
            }
        }

        const emptyAfter = getDropzones(getScope()).filter(z => !isZoneFilled(z)).length;
        return { ok: emptyAfter === 0, placed, total: totalSlots, emptyAfter };
    };

    const setNativeInputValue = (el, val) => {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    /**
     * Strict 100% Slot Verifier:
     * Ensures EVERY visible input has value.trim() !== "", EVERY dropzone is filled, and all selects/radios/checkboxes are answered.
     */
    SpeexxHelper.verify = function () {
        const scope = getScope();
        const inputs = getTextInputs(scope);
        const zones = getDropzones(scope);
        const selects = Array.from(scope.querySelectorAll('select')).filter(isVisible);
        const radios = Array.from(scope.querySelectorAll('input[type="radio"]')).filter(el => isVisible(el) || isVisible(el.parentElement));
        const checkboxes = Array.from(scope.querySelectorAll('input[type="checkbox"]')).filter(el => isVisible(el) || isVisible(el.parentElement));

        const emptyInputs = inputs.filter(i => String(i.value ?? '').trim() === '' || i.value.trim() === '___').length;
        const emptyZones = zones.filter(z => !isZoneFilled(z)).length;
        const emptySelects = selects.filter(s => !s.value || String(s.value).trim() === '' || s.selectedIndex < 0).length;

        const rGroups = {};
        radios.forEach((r, i) => {
            const k = r.name || `rg_${i}`;
            (rGroups[k] = rGroups[k] || []).push(r);
        });
        const emptyRadios = Object.values(rGroups).filter(g => !g.some(r => r.checked)).length;

        // If checkboxes are the ONLY interactive widgets on a Test page, require at least 1 checked
        const onlyCheckboxes = checkboxes.length > 0 && inputs.length === 0 && zones.length === 0 && selects.length === 0 && radios.length === 0;
        const emptyCheckboxes = onlyCheckboxes && !checkboxes.some(cb => cb.checked) ? 1 : 0;

        const gapContainers = Array.from(scope.querySelectorAll('.gap-container')).filter(isVisible);
        const emptyGaps = gapContainers.filter(c => {
            const gap = c.querySelector('.gap');
            const txt = normSpace(gap ? gap.innerText : '');
            return !txt || txt === '___' || txt === '...';
        }).length;

        const emptyTotal = emptyInputs + emptyZones + emptySelects + emptyRadios + emptyCheckboxes + emptyGaps;
        return {
            ok: emptyTotal === 0,
            emptyTotal,
            emptyInputs,
            emptyZones,
            emptySelects,
            emptyRadios,
            emptyCheckboxes,
            emptyGaps
        };
    };

    /**
     * Inspect which slot numbers (1-based) were marked wrong (red/yellow) after grading in Normal mode
     */
    SpeexxHelper.getWrongSlots = function () {
        const scope = getScope();
        const zones = getDropzones(scope);
        const inputs = getTextInputs(scope);
        const selects = Array.from(scope.querySelectorAll('select')).filter(isVisible);
        const slotSelector = [DROPZONE_SEL, INPUT_SEL, 'select'].join(', ');
        const slots = Array.from(scope.querySelectorAll(slotSelector)).filter(el => {
            if (el.matches(DROPZONE_SEL)) return zones.includes(el);
            if (el.matches('select')) return selects.includes(el);
            return inputs.includes(el);
        });

        const wrong = [];
        slots.forEach((el, idx) => {
            const cls = `${el.className || ''} ${el.parentElement?.className || ''} ${el.parentElement?.parentElement?.className || ''}`;
            if (/\b(result-red|result-yellow|result-orange|wrong|incorrect|error)\b/i.test(cls)) {
                wrong.push({ slot: idx + 1, current: el.matches(DROPZONE_SEL) ? getZoneValue(el) : normSpace(el.value) });
            }
        });
        return wrong;
    };

    /**
     * Dual-Mode Fill & Submit:
     * - Normal Mode: Fast fill, unlocks via Correction/Repeat if needed, submits, returns score & wrongSlots
     * - Test Mode: Strict One-Shot Exam Safeguard — 2-pass JS check (input.value.trim() !== "" & 0 empty dropzones) BEFORE submit
     */
    SpeexxHelper.fillAndSubmit = async function (answers, opts = {}) {
        const scope = getScope();
        const pageKey = SpeexxHelper.getPageKey();
        const modeInfo = SpeexxHelper.detectMode();
        const isTest = modeInfo.isTest;

        // In Normal mode, if exercise was already graded (< 100%), click Correction or Repeat to unlock wrong slots!
        if (!isTest) {
            const alreadyGraded = SpeexxHelper.getScore() !== null ||
                getTextInputs(scope).some(i => i.disabled || i.readOnly) ||
                Boolean(scope.querySelector('.result-red, .result-yellow'));
            if (alreadyGraded) {
                const unlockBtn = document.querySelector('button.action-exercise-button.correct, button.action-exercise-button.repeat');
                const btnToClick = (isBtnEnabled(unlockBtn) ? unlockBtn : null) || findBtn(/^(correction|ตรวจ|แก้ไข|repeat|ทำซ้ำ)$/i);
                if (btnToClick) {
                    btnToClick.click();
                    await sleep(320);
                }
            }
        }

        const freshScope = getScope();
        const zones = getDropzones(freshScope);
        const inputs = getTextInputs(freshScope);
        const selects = Array.from(freshScope.querySelectorAll('select')).filter(isVisible);
        const radios = Array.from(freshScope.querySelectorAll('input[type="radio"]')).filter(el => isVisible(el) || isVisible(el.parentElement));
        const checkboxes = Array.from(freshScope.querySelectorAll('input[type="checkbox"]')).filter(el => isVisible(el) || isVisible(el.parentElement));

        // 1. Drag & Drop
        if (zones.length > 0 && answers) {
            await SpeexxHelper.clearAndMoveDragDrop(answers, { preserveGreen: Boolean(opts.preserveGreen) });
        }

        // 2. Inline Text Inputs + Selects (skips locked green slots during Correction repair!)
        const isElementGreenLocked = (el) => Boolean(
            el.disabled || el.readOnly ||
            (opts.preserveGreen && /\bresult-green(-with-merit)?\b/i.test(`${el.className || ''} ${el.parentElement?.className || ''}`))
        );
        const inlineSlots = Array.from(freshScope.querySelectorAll([INPUT_SEL, 'select'].join(', '))).filter(
            el => (el.tagName === 'SELECT' ? selects.includes(el) : inputs.includes(el))
        );
        if (inlineSlots.length > 0 && Array.isArray(answers) && zones.length === 0) {
            const editableSlots = inlineSlots.filter(s => !isElementGreenLocked(s));
            const useEditableIndex = editableSlots.length < inlineSlots.length && answers.length === editableSlots.length;
            let editCursor = 0;

            inlineSlots.forEach((slot, idx) => {
                if (isElementGreenLocked(slot)) return;
                const ansVal = useEditableIndex ? answers[editCursor++] : answers[idx];
                if (ansVal === undefined || ansVal === null) return;
                if (slot.tagName === 'SELECT') {
                    const want = normSpace(ansVal);
                    const opt = Array.from(slot.options).find(o => normSpace(o.text) === want || o.value === want)
                        || Array.from(slot.options).find(o => normSpace(o.text).toLowerCase() === want.toLowerCase());
                    if (opt) {
                        slot.value = opt.value;
                        slot.dispatchEvent(new Event('input', { bubbles: true }));
                        slot.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    setNativeInputValue(slot, String(ansVal));
                }
            });
        }

        // 2b. Gap Toggle Buttons (.gap-container)
        const gapContainers = Array.from(freshScope.querySelectorAll('.gap-container')).filter(isVisible);
        if (gapContainers.length > 0 && Array.isArray(answers)) {
            gapContainers.forEach((c, idx) => {
                const target = normSpace(answers[idx]);
                const gap = c.querySelector('.gap');
                const btn = c.querySelector('button');
                if (!target || !gap || !btn) return;
                let attempts = 0;
                while (normSpace(gap.innerText) !== target && attempts < 20) {
                    btn.click();
                    attempts++;
                }
            });
        }

        // 3. Radios
        if (radios.length > 0 && Array.isArray(answers)) {
            const groups = [];
            const seen = new Map();
            radios.forEach((r, i) => {
                const k = r.name || `rg_${i}`;
                if (!seen.has(k)) {
                    seen.set(k, []);
                    groups.push(seen.get(k));
                }
                seen.get(k).push(r);
            });
            groups.forEach((g, idx) => {
                if (g.every(r => r.disabled)) return;
                const ans = answers[idx];
                if (ans === undefined || ans === null) return;
                let pick = null;
                if (typeof ans === 'number') {
                    pick = g[ans];
                } else if (typeof ans === 'boolean') {
                    const wantBool = ans ? /^(true|yes|right|ถูก)$/i : /^(false|no|wrong|ผิด)$/i;
                    pick = g.find(r => wantBool.test(normSpace((r.labels?.[0] || r.closest('label') || r.parentElement)?.innerText)));
                } else {
                    const wantStr = normSpace(ans);
                    pick = g.find(r => normSpace((r.labels?.[0] || r.closest('label') || r.parentElement)?.innerText) === wantStr)
                        || g.find(r => normSpace((r.labels?.[0] || r.closest('label') || r.parentElement)?.innerText).toLowerCase().includes(wantStr.toLowerCase()));
                }
                if (pick && !pick.checked && !pick.disabled) {
                    (pick.labels?.[0] || pick).click();
                }
            });
        }

        // 4. Checkboxes
        if (checkboxes.length > 0 && Array.isArray(answers) && radios.length === 0 && zones.length === 0 && inputs.length === 0) {
            const isBoolMask = answers.length === checkboxes.length && answers.every(x => typeof x === 'boolean');
            const isIdxList = answers.every(x => typeof x === 'number');
            checkboxes.forEach((cb, idx) => {
                if (cb.disabled) return;
                const lblText = normSpace((cb.labels?.[0] || cb.closest('label') || cb.parentElement)?.innerText);
                let shouldCheck = false;
                if (isBoolMask) {
                    shouldCheck = Boolean(answers[idx]);
                } else if (isIdxList) {
                    shouldCheck = answers.includes(idx);
                } else {
                    shouldCheck = answers.some(a => normSpace(a) === lblText || lblText.includes(normSpace(a)));
                }
                if (cb.checked !== shouldCheck) {
                    (cb.labels?.[0] || cb).click();
                }
            });
        }

        // 5. Strict Slot Verification (2-pass safeguard in Test Mode!)
        await sleep(150);
        const pass1 = SpeexxHelper.verify();
        if (isTest) {
            await sleep(300);
            const pass2 = SpeexxHelper.verify();
            if (!pass1.ok || !pass2.ok) {
                return { ok: false, submitted: false, mode: 'test', isTest: true, blocked: 'EXAM_EMPTY_SLOTS', verify: pass2, pageKey };
            }
        } else if (!pass1.ok) {
            return { ok: false, submitted: false, mode: 'normal', isTest: false, blocked: 'EMPTY_SLOTS', verify: pass1, pageKey };
        }

        if (opts.submit === false) {
            return { ok: true, submitted: false, mode: modeInfo.mode, isTest, pageKey };
        }

        const corrSubmitBtn = document.querySelector('button.action-exercise-button.correct');
        const submitBtn = isTest
            ? ((isBtnEnabled(corrSubmitBtn) ? corrSubmitBtn : null) || findBtn(/^(correction|ตรวจ|submit|ส่ง|finish|next|ต่อไป)$/i))
            : ((isBtnEnabled(corrSubmitBtn) ? corrSubmitBtn : null) || findBtn(/^(correction|ตรวจ|submit|ส่ง)$/i));
        if (submitBtn && isBtnEnabled(submitBtn)) {
            submitBtn.click();
            await sleep(550);
            while (SpeexxHelper.isSpinnerActive()) await sleep(400);
            const finalScore = SpeexxHelper.getScore();
            const wrongSlots = (!isTest && finalScore !== null && finalScore < 100) ? SpeexxHelper.getWrongSlots() : [];
            return { ok: true, submitted: true, mode: modeInfo.mode, isTest, score: finalScore, wrongSlots, pageKey };
        }
        return { ok: true, submitted: false, mode: modeInfo.mode, isTest, score: SpeexxHelper.getScore(), pageKey };
    };

    /**
     * Targeted Normal-Mode Correction Repair:
     * Unlocks red/yellow answers via Correction and submits corrected answers for 100/100
     */
    SpeexxHelper.repairWithCorrection = async function (updatedAnswers) {
        return await SpeexxHelper.fillAndSubmit(updatedAnswers, { preserveGreen: true });
    };

    const getOrderedSlotsSnapshot = () => {
        const scope = getScope();
        const zones = getDropzones(scope);
        const inputs = getTextInputs(scope);
        const selects = Array.from(scope.querySelectorAll('select')).filter(isVisible);
        const slotSelector = [DROPZONE_SEL, INPUT_SEL, 'select'].join(', ');
        const slots = Array.from(scope.querySelectorAll(slotSelector)).filter(el => {
            if (el.matches(DROPZONE_SEL)) return zones.includes(el);
            if (el.matches('select')) return selects.includes(el);
            return inputs.includes(el);
        });
        return slots.map((el, idx) => {
            const cls = `${el.className || ''} ${el.parentElement?.className || ''} ${el.parentElement?.parentElement?.className || ''}`;
            const isGreen = /\b(result-green(-with-merit)?|correct|right|passed)\b/i.test(cls) &&
                !/\b(result-red|result-yellow|result-orange|wrong|incorrect)\b/i.test(cls);
            const isWrong = /\b(result-red|result-yellow|result-orange|wrong|incorrect|error)\b/i.test(cls);
            const kind = el.matches(DROPZONE_SEL) ? 'drag' : (el.tagName === 'SELECT' ? 'select' : 'input');
            const val = kind === 'drag'
                ? getZoneValue(el)
                : (kind === 'select' ? normSpace(el.options[el.selectedIndex]?.text || el.value) : normSpace(el.value));
            return { idx, kind, el, val, isGreen, isWrong };
        });
    };

    /**
     * ONE-COMMAND TURBO SOLVER (`window.SpeexxHelper.autoSolveFast(answers, opts)`):
     * 1. Routes Video -> speedRunVideo() (16x) | Speaking -> solvePronunciation() | Dashboard -> openNextIncompletePacket()
     * 2. Auto-fetches RAM Cache from http://localhost:8765 (<5ms) if answers omitted
     * 3. Fills Text Inputs (native setter + input/change/blur + value.trim() !== "") & Drag-Drop (fresh DOM per word + === + PointerEvent/DragEvent)
     * 4. Test Mode: 2-pass 100% slot check BEFORE Submit (hard-blocks empty blanks)
     * 5. Normal Mode Smart Correction Loop: if score < 100, clicks Correction, locks green slots, rotates untried options into red/yellow slots (never repeating wrong answers!) until 100/100, then async-saves to port 8765!
     */
    SpeexxHelper.autoSolveFast = async function (answers = null, opts = {}) {
        while (SpeexxHelper.isSpinnerActive()) await sleep(350);

        const info = SpeexxHelper.inspect();
        const pageKey = info.pageKey;

        if (info.type === 'overview') {
            return await SpeexxHelper.openNextIncompletePacket(opts);
        }
        if (info.type === 'video') {
            const vRes = await SpeexxHelper.speedRunVideo();
            if (opts.autoNext) vRes.next = await SpeexxHelper.next();
            return vRes;
        }
        if (info.type === 'speaking') {
            if (opts.skipPronunciation !== false) {
                // Skip speaking/pronunciation unit immediately by clicking X (close) to return to Dashboard!
                const closeBtn = Array.from(document.querySelectorAll(CLOSE_UNIT_SEL)).find(isBtnEnabled)
                    || findBtn(/^(close|exit|ปิด|ออก|×|✕)$/i);
                if (closeBtn) closeBtn.click();
                return { ok: true, skippedPronunciation: true, pageKey };
            }
            const pRes = await SpeexxHelper.solvePronunciation();
            if (opts.autoNext && pRes.ok) pRes.next = await SpeexxHelper.next();
            return pRes;
        }
        if (info.type === 'info') {
            const scopeNow = getScope();
            const startBtn = scopeNow.querySelector('.start-exercise, .btn-start, button[aria-label*="start" i]');
            if (startBtn && isVisible(startBtn)) {
                startBtn.click();
                await sleep(500);
                return await SpeexxHelper.autoSolveFast(answers, opts);
            }
            return opts.autoNext ? await SpeexxHelper.next() : { ok: true, type: 'info', pageKey };
        }

        // Auto RAM-Cache lookup on port 8765 if answers not supplied
        let workingAnswers = Array.isArray(answers) ? [...answers] : answers;
        if (!workingAnswers && pageKey) {
            try {
                const r = await fetch('http://localhost:8765', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_page', page_key: pageKey })
                });
                const j = await r.json();
                if (j && j.found && j.answers) {
                    workingAnswers = Array.isArray(j.answers) ? [...j.answers] : j.answers;
                }
            } catch (_) { }
        }

        if (!workingAnswers) {
            // If current page is ALREADY graded red/yellow (<100%), click Correction/Repeat first so LLM sees clean unlocked slots!
            if (!info.isTest && (info.score !== null && info.score < 100 || getActiveTabState() === 'red' || getActiveTabState() === 'yellow')) {
                const corrEl = document.querySelector('button.action-exercise-button.correct, button.action-exercise-button.repeat');
                const corrBtn = (isBtnEnabled(corrEl) ? corrEl : null) || findBtn(/^(correction|ตรวจ|แก้ไข|repeat|ทำซ้ำ)$/i);
                if (corrBtn) {
                    corrBtn.click();
                    await sleep(320);
                }
            }
            const freshInfo = SpeexxHelper.inspect();
            // Auto-transcribe audio via port 8765 if speakers exist so LLM gets transcripts in the same turn!
            if (freshInfo.speakerCount > 0 && freshInfo.audioUrls.length === 0) {
                freshInfo.audioUrls = await SpeexxHelper.collectAudio();
            }
            if (freshInfo.audioUrls && freshInfo.audioUrls.length > 0) {
                try {
                    const tr = await fetch('http://localhost:8765', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'batch_transcribe', urls: freshInfo.audioUrls })
                    });
                    const tj = await tr.json();
                    if (tj && Array.isArray(tj.results)) freshInfo.transcripts = tj.results;
                } catch (_) { }
            }
            return { ok: false, cacheMiss: true, inspect: freshInfo };
        }

        // Track tried answers per slot index so Smart Correction NEVER repeats a wrong answer!
        const triedPerSlot = new Map();
        const recordTried = (idx, val) => {
            const norm = normSpace(val);
            if (!norm) return;
            if (!triedPerSlot.has(idx)) triedPerSlot.set(idx, new Set());
            triedPerSlot.get(idx).add(norm);
        };
        if (Array.isArray(workingAnswers)) {
            workingAnswers.forEach((v, idx) => recordTried(idx, String(v)));
        }

        // First submission pass
        let subRes = await SpeexxHelper.fillAndSubmit(workingAnswers, { submit: opts.submit !== false, preserveGreen: false });
        if (!subRes.ok || opts.submit === false) return subRes;

        // Smart Correction Loop (Normal Mode ONLY — never on Test Mode!)
        if (!info.isTest && subRes.score !== null && subRes.score < 100) {
            const maxRounds = opts.maxCorrectionRounds ?? 5;
            for (let round = 1; round <= maxRounds; round++) {
                const curScore = SpeexxHelper.getScore();
                if (curScore === 100) break;

                // 1. Snapshot graded slots BEFORE clicking Correction (lock green slots, mark red/yellow slots)
                const gradedSlots = getOrderedSlotsSnapshot();
                const scopeNow = getScope();
                const radiosNow = Array.from(scopeNow.querySelectorAll('input[type="radio"]')).filter(el => isVisible(el) || isVisible(el.parentElement));

                if (!Array.isArray(workingAnswers)) {
                    workingAnswers = gradedSlots.map(s => s.val);
                }
                gradedSlots.forEach(s => {
                    if (s.val) recordTried(s.idx, s.val);
                    if (s.isGreen && s.val) workingAnswers[s.idx] = s.val;
                });

                const wrongSlots = gradedSlots.filter(s => !s.isGreen && (s.isWrong || curScore < 100));

                // 2. Click Correction to unlock ONLY wrong (red/yellow) slots while keeping green locked
                const corrEl = document.querySelector('button.action-exercise-button.correct, button.action-exercise-button.repeat');
                const corrBtn = (isBtnEnabled(corrEl) ? corrEl : null) || findBtn(/^(correction|ตรวจ|แก้ไข|repeat|ทำซ้ำ)$/i);
                if (!corrBtn) break;
                corrBtn.click();
                await sleep(320);

                // 3. Build next non-repeating candidate for each unlocked wrong slot
                let mutated = false;
                const liveScope = getScope();

                if (wrongSlots.some(s => s.kind === 'drag')) {
                    const liveZones = getDropzones(liveScope);
                    let bankPool = getDraggables(liveScope)
                        .filter(el => !liveZones.some(z => z.contains(el)))
                        .map(el => getTileLabel(el))
                        .filter(Boolean);
                    // Support pre-filled Matching / Swap exercises where tiles stay inside dropzones:
                    if (bankPool.length === 0) {
                        bankPool = wrongSlots.filter(w => w.kind === 'drag').map(w => w.val).filter(Boolean);
                    }
                    const reservedThisRound = new Set();

                    for (const ws of wrongSlots) {
                        if (ws.kind !== 'drag') continue;
                        const tried = triedPerSlot.get(ws.idx) || new Set();
                        const pickIdx = bankPool.findIndex((lbl, pIdx) => !reservedThisRound.has(pIdx) && !tried.has(lbl));
                        if (pickIdx !== -1) {
                            const nextWord = bankPool[pickIdx];
                            reservedThisRound.add(pickIdx);
                            workingAnswers[ws.idx] = nextWord;
                            recordTried(ws.idx, nextWord);
                            mutated = true;
                        }
                    }
                }

                if (wrongSlots.some(s => s.kind === 'select')) {
                    const liveSelects = Array.from(liveScope.querySelectorAll('select')).filter(isVisible);
                    for (const ws of wrongSlots) {
                        if (ws.kind !== 'select') continue;
                        const selEl = liveSelects.find((_, sIdx) => sIdx === ws.idx) || ws.el;
                        if (!selEl || !selEl.options) continue;
                        const tried = triedPerSlot.get(ws.idx) || new Set();
                        const nextOpt = Array.from(selEl.options)
                            .map(o => normSpace(o.text))
                            .find(txt => txt && !/^(--|select|choose)/i.test(txt) && !tried.has(txt));
                        if (nextOpt) {
                            workingAnswers[ws.idx] = nextOpt;
                            recordTried(ws.idx, nextOpt);
                            mutated = true;
                        }
                    }
                }

                if (wrongSlots.some(s => s.kind === 'input') && opts.altAnswers) {
                    for (const ws of wrongSlots) {
                        if (ws.kind !== 'input') continue;
                        const alts = Array.isArray(opts.altAnswers[ws.idx]) ? opts.altAnswers[ws.idx] : [];
                        const tried = triedPerSlot.get(ws.idx) || new Set();
                        const nextAlt = alts.map(normSpace).find(a => a && !tried.has(a));
                        if (nextAlt) {
                            workingAnswers[ws.idx] = nextAlt;
                            recordTried(ws.idx, nextAlt);
                            mutated = true;
                        }
                    }
                }

                if (!mutated && radiosNow.length > 0 && gradedSlots.length === 0) {
                    const groups = [];
                    const seen = new Map();
                    radiosNow.forEach((r, i) => {
                        const k = r.name || `rg_${i}`;
                        if (!seen.has(k)) { seen.set(k, []); groups.push(seen.get(k)); }
                        seen.get(k).push(r);
                    });
                    groups.forEach((g, gIdx) => {
                        const isGroupGreen = g.some(r => /\bresult-green(-with-merit)?\b/i.test(`${r.className || ''} ${r.parentElement?.className || ''}`));
                        if (isGroupGreen || g.every(r => r.disabled)) return;
                        const tried = triedPerSlot.get(gIdx) || new Set();
                        const nextRIdx = g.findIndex((_, rIdx) => !tried.has(String(rIdx)));
                        if (nextRIdx !== -1) {
                            workingAnswers[gIdx] = nextRIdx;
                            recordTried(gIdx, String(nextRIdx));
                            mutated = true;
                        }
                    });
                }

                // Gap-Toggle rotation (.gap-container)
                if (!mutated) {
                    const liveGaps = Array.from(liveScope.querySelectorAll('.gap-container')).filter(isVisible);
                    if (liveGaps.length > 0) {
                        liveGaps.forEach((c, gIdx) => {
                            const cls = `${c.className || ''} ${c.parentElement?.className || ''}`;
                            if (/\bresult-green(-with-merit)?\b/i.test(cls)) return;
                            const gap = c.querySelector('.gap');
                            const btn = c.querySelector('button');
                            if (!gap || !btn) return;
                            const tried = triedPerSlot.get(gIdx) || new Set();
                            for (let t = 0; t < 10; t++) {
                                btn.click();
                                const curTxt = normSpace(gap.innerText);
                                if (curTxt && curTxt !== '___' && curTxt !== '...' && !tried.has(curTxt)) {
                                    workingAnswers[gIdx] = curTxt;
                                    recordTried(gIdx, curTxt);
                                    mutated = true;
                                    break;
                                }
                            }
                        });
                    }
                }

                if (!mutated) {
                    // Fallback if no untried pool items remain (e.g. open text input): use official Solution if unlocked
                    const solRes = await SpeexxHelper.learnSolution();
                    if (solRes && solRes.ok && Array.isArray(solRes.answers) && solRes.answers.length > 0) {
                        workingAnswers = solRes.answers;
                        subRes = solRes;
                    }
                    break;
                }

                subRes = await SpeexxHelper.fillAndSubmit(workingAnswers, { preserveGreen: true });
                if (subRes.score === 100) break;
            }
        }

        const finalScore = SpeexxHelper.getScore();
        // Extract clean 100% answers from live DOM (including preserved green slots) and async-save to RAM Cache!
        if (finalScore === 100 && opts.autoSave !== false && pageKey) {
            const finalSnap = getOrderedSlotsSnapshot();
            const cleanFinal = finalSnap.length > 0 ? finalSnap.map(s => s.val) : workingAnswers;
            workingAnswers = cleanFinal;
            fetch('http://localhost:8765', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_page', page_key: pageKey, answers: cleanFinal })
            }).catch(() => { });
        }

        const out = {
            ok: finalScore === null ? subRes.ok : finalScore === 100,
            mode: info.mode,
            isTest: info.isTest,
            score: finalScore,
            pageKey
        };
        if (finalScore !== 100) out.answers = workingAnswers;
        if (!info.isTest && finalScore !== null && finalScore < 100) out.wrongSlots = SpeexxHelper.getWrongSlots();
        if (opts.autoNext && (finalScore === 100 || info.isTest)) {
            out.next = await SpeexxHelper.next();
        }
        return out;
    };

    /**
     * ULTRA-SMART AUTO-BATCH LOOP (`SpeexxHelper.autoLoop(initialAnswers, opts)`):
     * Continuously solves multiple exercises, videos (16x), pronunciation tabs, and unit transitions in a SINGLE tool call!
     * Stops and returns to the LLM ONLY when:
     * 1. It hits an open text-input exercise not in RAM cache (`cacheMiss: true`)
     * 2. It encounters a Level Test / Exam (`isTest: true` or `blockedTest`)
     * 3. All 72/72 packets are complete (`all72Complete: true`)
     */
    SpeexxHelper.autoLoop = async function (initialAnswers = null, opts = {}) {
        const maxSteps = opts.maxSteps ?? 25;
        const history = [];
        let pendingAnswers = initialAnswers;

        for (let step = 1; step <= maxSteps; step++) {
            while (SpeexxHelper.isSpinnerActive()) await sleep(350);

            const modeInfo = SpeexxHelper.detectMode();
            const pageKey = SpeexxHelper.getPageKey();

            // Hard stop on Level Test / Exam unless user explicitly passed answers for this exact test page
            if (modeInfo.isTest && !pendingAnswers) {
                return {
                    ok: false,
                    pausedForTest: true,
                    pageKey,
                    completedSteps: history,
                    inspect: SpeexxHelper.inspect()
                };
            }

            // Priority Red/Yellow Tab Sweeper: if any earlier tab in the unit is red/yellow, click it first to repair it!
            if (!modeInfo.isTest && !pendingAnswers) {
                const rawTabs = inspectRawTabs();
                const badTab = rawTabs.find(t => !t.active && (t.state === 'red' || t.state === 'yellow'));
                if (badTab) {
                    const clickEl = badTab.el.querySelector('a, button, .exercise-square, .exercise-number, [role="button"]') || badTab.el;
                    clickEl.click();
                    await sleep(600);
                    while (SpeexxHelper.isSpinnerActive()) await sleep(350);
                }
            }

            const res = await SpeexxHelper.autoSolveFast(pendingAnswers, { ...opts, autoNext: true });
            pendingAnswers = null;

            if (res.cacheMiss || res.blockedTest || res.all72Complete || res.pausedForTest) {
                return { ...res, completedSteps: history };
            }

            history.push(`${res.pageKey || pageKey}:${res.score ?? (res.ok ? 'OK' : 'ERR')}`);

            if (!res.ok) {
                return { ...res, completedSteps: history };
            }

            // Wait briefly for SPA route transition / DOM render before next iteration
            await sleep(650);
            while (SpeexxHelper.isSpinnerActive()) await sleep(350);
        }

        return { ok: true, maxStepsReached: true, completedSteps: history, pageKey: SpeexxHelper.getPageKey() };
    };

    const getPronunciationStatus = () => {
        const scope = getScope();
        const wordEls = Array.from(scope.querySelectorAll('.word-wrapper .word-result, .word-result, [class*="word-result"]'))
            .filter(el => isVisible(el.parentElement || el));

        const hasResultCls = (el) => Boolean(el && /\bresult-(green|green-with-merit|red|yellow|orange|grey|gray|bad|good)\b/i.test(el.className || ''));
        const isGreenCls = (el) => Boolean(el && /\bresult-green(-with-merit)?\b/i.test(el.className || ''));

        const hasAnyWordResult = wordEls.length > 0 && wordEls.some(el => hasResultCls(el) || hasResultCls(el.parentElement));
        const allWordsGreen = wordEls.length > 0 && wordEls.every(el => isGreenCls(el) || isGreenCls(el.parentElement));

        const nonGreenWords = wordEls
            .filter(el => !(isGreenCls(el) || isGreenCls(el.parentElement)))
            .map(el => normSpace((el.parentElement || el).innerText))
            .filter(Boolean);

        const tabSt = SpeexxHelper.getTabStatus();
        const rawTabs = inspectRawTabs();
        const activeTabObj = rawTabs.find(t => t.active);
        const tabGreen = activeTabObj ? activeTabObj.state === 'green' : false;

        return {
            wordCount: wordEls.length,
            hasAnyWordResult,
            allWordsGreen,
            nonGreenWords,
            tabGreen,
            passed: wordEls.length > 0 ? allWordsGreen : tabGreen,
            tabs: tabSt.tabs
        };
    };

    const ensureVirtualMic = () => {
        if (!SpeexxHelper._mic) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            const dest = ctx.createMediaStreamDestination();
            const masterGain = ctx.createGain();
            masterGain.gain.value = 1.0;
            masterGain.connect(dest);

            const osc = ctx.createOscillator();
            const silentGain = ctx.createGain();
            silentGain.gain.value = 0.00003;
            osc.connect(silentGain);
            silentGain.connect(dest);
            osc.start();

            SpeexxHelper._mic = {
                ctx,
                dest,
                masterGain,
                buffer: null,
                activeSrc: null,
                playOnce(gainVal = 1.0, rateVal = 1.0) {
                    return new Promise(async (resolve) => {
                        if (!this.buffer) return resolve(0);
                        if (this.ctx.state === 'suspended') {
                            await Promise.race([this.ctx.resume().catch(() => { }), sleep(300)]);
                        }
                        if (this.activeSrc) {
                            try { this.activeSrc.stop(); } catch (_) { }
                            this.activeSrc = null;
                        }
                        this.masterGain.gain.value = gainVal;
                        const src = this.ctx.createBufferSource();
                        src.buffer = this.buffer;
                        src.playbackRate.value = rateVal;
                        src.connect(this.masterGain);
                        this.activeSrc = src;

                        const durationMs = Math.ceil((this.buffer.duration / rateVal) * 1000);
                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            if (this.activeSrc === src) this.activeSrc = null;
                            resolve(durationMs / 1000);
                        };
                        src.onended = finish;
                        src.start(0);
                        setTimeout(finish, durationMs + 150);
                    });
                }
            };
        }

        const getVirtualStream = async () => {
            if (SpeexxHelper._mic.ctx.state === 'suspended') {
                await Promise.race([SpeexxHelper._mic.ctx.resume().catch(() => { }), sleep(250)]);
            }
            return SpeexxHelper._mic.dest.stream;
        };
        if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia = getVirtualStream;
        }
        return SpeexxHelper._mic;
    };

    const findCorrectionUnlockBtn = () => {
        const direct = document.querySelector('button.action-exercise-button.correct, button.action-exercise-button.repeat');
        if (isBtnEnabled(direct)) return direct;
        return findBtn(/^(correction|ตรวจ|repeat|ทำซ้ำ|แก้ไข)$/i);
    };

    const capturePronunciationMp3 = async () => {
        const scope = getScope();
        const playBtn = scope.querySelector('.play-button') || scope.querySelector(SPEAKER_SEL);
        const beforeIdx = performance.getEntriesByType('resource').length;
        SpeexxHelper._lastPlayedMp3 = '';

        if (playBtn && isVisible(playBtn)) {
            playBtn.click();
            for (let i = 0; i < 12; i++) {
                await sleep(220);
                const fromHook = SpeexxHelper._lastPlayedMp3;
                const fromPerf = performance.getEntriesByType('resource')
                    .slice(beforeIdx)
                    .map(r => r.name)
                    .filter(u => u && /\.mp3(\?|$)/i.test(u))
                    .pop();
                const fromDom = collectAudioUrls(scope).slice(-1)[0];
                const found = fromHook || fromPerf || fromDom;
                if (found) {
                    document.querySelectorAll('audio').forEach(a => {
                        try {
                            a.muted = true;
                            a.pause();
                            a.dispatchEvent(new Event('ended'));
                        } catch (_) { }
                    });
                    if (/playing|stop|active/i.test(playBtn.className || '')) {
                        try { playBtn.click(); } catch (_) { }
                    }
                    await sleep(250);
                    return found;
                }
            }
        }
        return collectAudioUrls(scope).slice(-1)[0] || '';
    };

    SpeexxHelper.waitForPronunciationResult = async function (maxWaitMs = 15000) {
        const start = Date.now();
        await sleep(500);
        while (Date.now() - start < maxWaitMs) {
            const spinning = SpeexxHelper.isSpinnerActive();
            const st = getPronunciationStatus();
            if (!spinning && (st.hasAnyWordResult || st.tabGreen)) {
                await sleep(500);
                if (!SpeexxHelper.isSpinnerActive()) {
                    return getPronunciationStatus();
                }
            }
            await sleep(500);
        }
        let extraSafety = 0;
        while (SpeexxHelper.isSpinnerActive() && extraSafety < 10) {
            await sleep(500);
            extraSafety++;
        }
        return getPronunciationStatus();
    };

    /**
     * Full Pronunciation Solver (ZERO Force-Pass):
     * Always waits 100% for Spinner to disappear, then retries via Correction until every word is green
     */
    SpeexxHelper.solvePronunciation = async function (maxRetries = 5) {
        syncNavigation();

        while (SpeexxHelper.isSpinnerActive()) {
            await sleep(500);
        }

        const initial = getPronunciationStatus();
        if (initial.passed && initial.tabGreen) {
            return { ok: true, skippedAlreadyGreen: true, tabs: initial.tabs, pageKey: SpeexxHelper.getPageKey() };
        }

        const initialCorr = findCorrectionUnlockBtn();
        if (initialCorr) {
            initialCorr.click();
            await sleep(450);
        }

        const mp3Url = await capturePronunciationMp3();
        if (!mp3Url) {
            return { ok: false, error: 'NO_MP3_URL', pageKey: SpeexxHelper.getPageKey() };
        }

        const mic = ensureVirtualMic();
        const resp = await fetch(mp3Url);
        const arr = await resp.arrayBuffer();
        mic.buffer = await mic.ctx.decodeAudioData(arr);

        const rateProfiles = [1.0, 1.0, 0.96, 1.03, 0.92];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            while (SpeexxHelper.isSpinnerActive()) {
                await sleep(500);
            }

            const cur = getPronunciationStatus();
            if (cur.passed) break;

            const corrBtn = findCorrectionUnlockBtn();
            if (corrBtn && (attempt > 1 || cur.hasAnyWordResult)) {
                corrBtn.click();
                for (let w = 0; w < 10; w++) {
                    await sleep(150);
                    if (!getPronunciationStatus().hasAnyWordResult) break;
                }
            }

            const micBtn = getScope().querySelector('.microphone-button') || getScope().querySelector(MIC_SEL);
            if (!micBtn || !isVisible(micBtn)) {
                return { ok: false, error: 'NO_MIC_BUTTON', pageKey: SpeexxHelper.getPageKey() };
            }

            micBtn.click();
            await sleep(600);

            const rate = rateProfiles[(attempt - 1) % rateProfiles.length];
            await mic.playOnce(1.0, rate);

            await sleep(800);
            const micStopBtn = getScope().querySelector('.microphone-button') || getScope().querySelector(MIC_SEL);
            if (micStopBtn && isVisible(micStopBtn) && !SpeexxHelper.isSpinnerActive() && !getPronunciationStatus().hasAnyWordResult) {
                micStopBtn.click();
            }

            const after = await SpeexxHelper.waitForPronunciationResult(15000);
            if (after.passed) {
                return {
                    ok: true,
                    attempt,
                    allWordsGreen: after.allWordsGreen,
                    tabGreen: after.tabGreen,
                    tabs: after.tabs,
                    pageKey: SpeexxHelper.getPageKey()
                };
            }
        }

        const finalSt = getPronunciationStatus();
        return {
            ok: finalSt.passed,
            allWordsGreen: finalSt.allWordsGreen,
            nonGreenWords: finalSt.nonGreenWords,
            tabGreen: finalSt.tabGreen,
            tabs: finalSt.tabs,
            pageKey: SpeexxHelper.getPageKey()
        };
    };

    /**
     * 16x Turbo Video Playback: plays video at 16x until ended so tab (▶) turns green in ~3-4s
     */
    SpeexxHelper.speedRunVideo = async function () {
        // 1. คลิกปุ่ม Play กลางจอ/ปุ่มเริ่มวิดีโอ
        const preVideo = document.querySelector('video');
        const playBtn = document.querySelector('.vjs-big-play-button, button[class*="play"]:not(.vjs-playing), .play-button');
        if (playBtn && (!preVideo || preVideo.paused)) {
            playBtn.click();
        }

        await new Promise(r => setTimeout(r, 400));
        const video = document.querySelector('video');
        if (!video) return { success: false, ok: false, reason: 'no_video' };

        // 2. ปิดเสียงและเร่งความเร็ว 16x
        video.muted = true;
        try { video.playbackRate = 16.0; } catch (e) { }
        try { await video.play(); } catch (e) { }
        try { video.playbackRate = 16.0; } catch (e) { }

        // 3. รอจนกว่าวิดีโอจะเล่นจบจริง (จับ event ended พร้อม Fallback)
        await new Promise((resolve) => {
            if (video.ended) return resolve();
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve();
            };
            video.addEventListener('ended', finish, { once: true });
            const timer = setTimeout(() => {
                if (video.duration && isFinite(video.duration)) {
                    video.currentTime = Math.max(0, video.duration - 0.2);
                }
                video.dispatchEvent(new Event('timeupdate', { bubbles: true }));
                video.dispatchEvent(new Event('ended', { bubbles: true }));
                finish();
            }, 4000);
        });

        await new Promise(r => setTimeout(r, 800));
        const tabSt = SpeexxHelper.getTabStatus();
        return {
            success: true,
            ok: true,
            tabs: tabSt.tabs,
            pageKey: SpeexxHelper.getPageKey()
        };
    };

    /**
     * Normal-Mode Solution Recovery: read Solution -> Repeat/Correction -> re-submit for 100/100
     */
    SpeexxHelper.learnSolution = async function () {
        const solDirect = document.querySelector('button.action-exercise-button.solution');
        const solBtn = (isBtnEnabled(solDirect) ? solDirect : null) || findBtn(/solution|เฉลย/i);
        if (!solBtn) return { ok: false, reason: 'NO_SOLUTION_BTN' };
        solBtn.click();
        await sleep(380);

        const scope = getScope();
        const zones = getDropzones(scope);
        const inputs = getTextInputs(scope);
        const selects = Array.from(scope.querySelectorAll('select')).filter(isVisible);
        const checkboxes = Array.from(scope.querySelectorAll('input[type="checkbox"]')).filter(el => isVisible(el) || isVisible(el.parentElement));
        const radios = Array.from(scope.querySelectorAll('input[type="radio"]')).filter(el => isVisible(el) || isVisible(el.parentElement));

        let extracted = [];
        if (zones.length > 0) {
            extracted = zones.map(z => getZoneValue(z));
        } else if (inputs.length + selects.length > 0) {
            const inline = Array.from(scope.querySelectorAll([INPUT_SEL, 'select'].join(', '))).filter(
                el => (el.tagName === 'SELECT' ? selects.includes(el) : inputs.includes(el))
            );
            extracted = inline.map(el => el.tagName === 'SELECT'
                ? normSpace(el.options[el.selectedIndex]?.text || el.value)
                : normSpace(el.value));
        } else if (radios.length > 0) {
            const seen = new Map();
            radios.forEach((r, i) => {
                const k = r.name || `rg_${i}`;
                if (!seen.has(k)) seen.set(k, []);
                seen.get(k).push(r);
            });
            seen.forEach(g => extracted.push(g.findIndex(r => r.checked)));
        } else if (checkboxes.length > 0) {
            extracted = checkboxes.map(cb => Boolean(cb.checked));
        }

        const unlockDirect = document.querySelector('button.action-exercise-button.repeat, button.action-exercise-button.correct');
        const repBtn = (isBtnEnabled(unlockDirect) ? unlockDirect : null) || findBtn(/^(repeat|ทำซ้ำ|correction|แก้ไข)$/i);
        if (repBtn) {
            repBtn.click();
            await sleep(350);
            const res = await SpeexxHelper.fillAndSubmit(extracted);
            return { ...res, answers: extracted };
        }
        return { ok: true, answers: extracted, score: SpeexxHelper.getScore(), pageKey: SpeexxHelper.getPageKey() };
    };

    /**
     * Safe Unit Exit (X button):
     * HARD-BLOCKS clicking X if Spinner is active OR ANY top tab (▶, 1, 2...) is white/red/yellow!
     */
    SpeexxHelper.closeUnit = function () {
        if (SpeexxHelper.isSpinnerActive()) {
            return { ok: false, closed: false, blocked: 'SPINNER_ACTIVE', pageKey: SpeexxHelper.getPageKey() };
        }
        const tabSt = SpeexxHelper.getTabStatus();
        if (tabSt.total > 0 && !tabSt.allGreen) {
            const jump = SpeexxHelper.clickFirstIncompleteTab();
            return {
                ok: false,
                closed: false,
                blocked: 'INCOMPLETE_TABS_REDIRECTED',
                redirectedTo: jump.tab,
                incomplete: tabSt.incomplete,
                tabs: tabSt.tabs
            };
        }
        const closeBtn = Array.from(document.querySelectorAll(CLOSE_UNIT_SEL)).find(isBtnEnabled)
            || findBtn(/^(close|exit|ปิด|ออก|×|✕)$/i);
        if (closeBtn) {
            closeBtn.click();
            return { ok: true, closed: true, tabs: tabSt.tabs };
        }
        return { ok: false, closed: false, error: 'NO_CLOSE_BUTTON', tabs: tabSt.tabs };
    };

    /**
     * Advance to Next exercise -> Sweep incomplete top tabs -> Close Unit (X) -> Full 72-Packet Dashboard Scan
     */
    SpeexxHelper.next = async function () {
        if (SpeexxHelper.isSpinnerActive()) {
            return { clicked: false, blocked: 'SPINNER_ACTIVE', pageKey: SpeexxHelper.getPageKey() };
        }
        if (SpeexxHelper.getPageKey().startsWith('pronunciation-packet/')) {
            const st = getPronunciationStatus();
            if (st.wordCount > 0 && !st.passed) {
                return { clicked: false, blocked: 'PRONUNCIATION_NOT_GREEN', nonGreenWords: st.nonGreenWords, tabs: st.tabs };
            }
        }

        // Strict Green Tab Guard: In Normal Mode, NEVER click Next if current active tab is still red/yellow/white!
        const modeNow = SpeexxHelper.detectMode();
        const activeTabSt = getActiveTabState();
        if (!modeNow.isTest && activeTabSt && activeTabSt !== 'green') {
            return {
                clicked: false,
                blocked: 'CURRENT_TAB_NOT_GREEN',
                activeTabState: activeTabSt,
                tabs: SpeexxHelper.getTabStatus().tabs,
                pageKey: SpeexxHelper.getPageKey()
            };
        }

        // Priority 1: If ANY earlier/other tab is red or yellow, jump back to repair it immediately!
        const rawTabs = inspectRawTabs();
        const redOrYellowTab = rawTabs.find(t => !t.active && (t.state === 'red' || t.state === 'yellow'));
        if (!modeNow.isTest && redOrYellowTab) {
            const clickEl = redOrYellowTab.el.querySelector('a, button, .exercise-square, .exercise-number, [role="button"]') || redOrYellowTab.el;
            clickEl.click();
            return {
                clicked: true,
                action: 'repair_red_tab',
                tab: redOrYellowTab.tab,
                state: redOrYellowTab.state,
                tabs: SpeexxHelper.getTabStatus().tabs
            };
        }

        const nextBtn = document.querySelector('button.action-exercise-button.next')
            || findBtn(/^(next|ต่อไป|continue|>|›)$/i)
            || document.querySelector('.next-button, .btn-next, [aria-label*="Next" i], [title*="Next" i]');
        if (nextBtn && isBtnEnabled(nextBtn)) {
            nextBtn.click();
            return { clicked: true, action: 'next', pageKey: SpeexxHelper.getPageKey() };
        }

        // Tab Bar Sweeper: ensure 100% green across all top tabs (▶, 1, 2...) before clicking X!
        const tabSt = SpeexxHelper.getTabStatus();
        if (tabSt.total > 0 && !tabSt.allGreen) {
            const jump = SpeexxHelper.clickFirstIncompleteTab();
            return {
                clicked: jump.clicked,
                action: 'sweep_incomplete_tab',
                tab: jump.tab,
                state: jump.state,
                tabs: tabSt.tabs
            };
        }

        // All tabs 100% green -> close unit (X)
        if (tabSt.total > 0 && tabSt.allGreen) {
            const closed = SpeexxHelper.closeUnit();
            if (closed.closed) {
                return { clicked: true, action: 'closed_completed_unit', tabs: tabSt.tabs };
            }
        }

        // On Dashboard: auto-scroll & scan all 72 packets, then open the next < 100% packet!
        const scan = await SpeexxHelper.scanAllPackets({ openFirst: true });
        return {
            clicked: Boolean(scan.opened),
            action: scan.opened ? 'open_incomplete_packet' : 'dashboard_scan_complete',
            opened: scan.opened,
            total: scan.total,
            completedCount: scan.completedCount,
            incompleteCount: scan.incompleteCount,
            all72Complete: scan.all72Complete
        };
    };

    SpeexxHelper.goToTab = function (tabLabel) {
        if (SpeexxHelper.isSpinnerActive()) return { ok: false, blocked: 'SPINNER_ACTIVE' };
        const raw = inspectRawTabs();
        const target = typeof tabLabel === 'number'
            ? (raw[tabLabel] || raw.find(t => t.tab === String(tabLabel)))
            : raw.find(t => t.tab === String(tabLabel));
        if (!target) return { ok: false, error: 'TAB_NOT_FOUND' };
        const clickEl = target.el.querySelector('a, button, .exercise-square, .exercise-number, [role="button"]') || target.el;
        clickEl.click();
        return { ok: true, idx: target.idx, tab: target.tab, state: target.state };
    };

    // Backward-compatible aliases
    SpeexxHelper.solveSpeaking = SpeexxHelper.solvePronunciation;
    SpeexxHelper.completeVideo = SpeexxHelper.speedRunVideo;
    SpeexxHelper.skipVideo = SpeexxHelper.speedRunVideo;
    SpeexxHelper.pronunciationStatus = getPronunciationStatus;

    window.SpeexxHelper = SpeexxHelper;
    window.Speexx = SpeexxHelper;
    window.speexxHelper = SpeexxHelper;

    /**
     * ============================================================================
     * window.CambridgeHelper — Ultra-Compact Cambridge LMS / Cambridge One Engine
     * Supports Main Document + Nested <iframe>s + Port 8765 Shared RAM Cache
     * ============================================================================
     */
    const CambridgeHelper = window.CambridgeHelper || {};

    const isVisInDoc = (el) => {
        if (!el || !el.getBoundingClientRect) return false;
        const win = el.ownerDocument?.defaultView || window;
        const rects = el.getClientRects();
        if (!rects || rects.length === 0) return false;
        const st = win.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.02;
    };

    const getAllDocs = (rootDoc = document, visited = new Set()) => {
        const docs = [];
        if (!rootDoc || visited.has(rootDoc)) return docs;
        visited.add(rootDoc);
        docs.push(rootDoc);
        const iframes = Array.from(rootDoc.querySelectorAll('iframe, frame'));
        for (const fr of iframes) {
            try {
                const subDoc = fr.contentDocument || fr.contentWindow?.document;
                if (subDoc) docs.push(...getAllDocs(subDoc, visited));
            } catch (_) { }
        }
        return docs;
    };

    const CAM_DROP_SEL = [
        '.gap', '.dropzone', '.drop-zone', '.drop-target', '.droppable', '.ui-droppable',
        '[data-dropzone]', '[data-gap]', '.blank', '.cloze-gap', '.target-slot',
        '.dnd-target', '.match-target', '[role="region"][aria-label*="drop" i]'
    ].join(', ');

    const CAM_DRAG_SEL = [
        '[draggable="true"]', '.draggable', '.ui-draggable', '.word-pool-item', '.pool-item',
        '.bank-item', '.word-tile', '.tile', '.chip', '.dnd-source', '.option-pill',
        '.word-bank button', '.word-pool button', '[data-draggable]'
    ].join(', ');

    const CAM_INPUT_SEL = 'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]';

    /**
     * 1. getActiveDoc(): Returns the Document (main or nested iframe) that contains the actual exercise DOM
     */
    CambridgeHelper.getActiveDoc = function () {
        const docs = getAllDocs(document);
        let bestDoc = document;
        let bestScore = -1;
        for (const d of docs) {
            try {
                const inputs = Array.from(d.querySelectorAll(CAM_INPUT_SEL)).filter(isVisInDoc).length;
                const selects = Array.from(d.querySelectorAll('select')).filter(isVisInDoc).length;
                const choices = Array.from(d.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [role="option"]')).filter(el => isVisInDoc(el) || isVisInDoc(el.parentElement)).length;
                const drops = Array.from(d.querySelectorAll(CAM_DROP_SEL)).filter(isVisInDoc).length;
                const drags = Array.from(d.querySelectorAll(CAM_DRAG_SEL)).filter(isVisInDoc).length;
                const containers = d.querySelectorAll('.activity, .exercise, .question, [class*="activity"], [class*="exercise"], [class*="question"]').length;
                const score = (inputs + selects + choices + drops + drags) * 10 + Math.min(containers, 5);
                if (score > bestScore) {
                    bestScore = score;
                    bestDoc = d;
                }
            } catch (_) { }
        }
        return bestDoc;
    };

    CambridgeHelper.getPageKey = function () {
        const raw = (window.location.pathname + (window.location.hash || '')).trim();
        let clean = raw.replace(/\?.*$/, '');
        clean = clean.replace(/\/(?:users?|students?|learners?|attempts?|enrollments?|sessions?|org|organizations?|classes|class|groups?|articles|tokens?|launch|lti)\/(?:[0-9]+|[0-9a-fA-F]{8,}|[0-9a-fA-F-]{12,})(?=\/|$)/gi, '');
        clean = clean.replace(/^\/+|\/+$/g, '').replace(/^\d+\//, '');
        const m = clean.match(/((?:unit|module|lesson|level|course|product|item|activity|exercise|workbook)[^?#]*)$/i);
        if (m) return m[1].replace(/^\/+|\/+$/g, '');
        return clean || 'cambridge-activity';
    };

    const getSlotStatus = (el) => {
        if (!el) return 'neutral';
        let cur = el;
        for (let i = 0; i < 4 && cur && cur !== cur.ownerDocument?.body; i++) {
            const cls = `${cur.className || ''} ${cur.getAttribute?.('data-state') || ''} ${cur.getAttribute?.('data-status') || ''} ${cur.getAttribute?.('aria-invalid') || ''}`;
            if (/\b(correct|is-correct|right|success|passed|status-correct|feedback-correct|green|valid)\b/i.test(cls)) return 'correct';
            if (/\b(incorrect|is-incorrect|wrong|error|failed|status-incorrect|feedback-incorrect|red|invalid)\b/i.test(cls) || cur.getAttribute?.('aria-invalid') === 'true') return 'wrong';
            const rgb = parseRgbState(cur, false);
            if (rgb === 'green') return 'correct';
            if (rgb === 'red') return 'wrong';
            cur = cur.parentElement;
        }
        return 'neutral';
    };

    const collectCambridgeAudio = () => {
        const urls = new Set();
        if (SpeexxHelper._lastPlayedMp3) urls.add(SpeexxHelper._lastPlayedMp3);
        for (const d of getAllDocs(document)) {
            try {
                d.querySelectorAll('audio[src], audio source[src], [data-audio], [data-audio-url], [data-src*=".mp3"], a[href*=".mp3"]').forEach(el => {
                    const u = el.src || el.href || el.getAttribute('src') || el.getAttribute('data-audio') || el.getAttribute('data-audio-url') || el.getAttribute('data-src');
                    if (u && /\.mp3(\?|$)/i.test(u)) urls.add(u);
                });
                const win = d.defaultView;
                if (win && win.performance) {
                    win.performance.getEntriesByType('resource').forEach(r => {
                        if (r.name && /\.mp3(\?|$)/i.test(r.name)) urls.add(r.name);
                    });
                }
            } catch (_) { }
        }
        return Array.from(urls);
    };

    /**
     * 2. extractActivity(): Compactly extracts pageKey, questions, inputs, selects, radio/checkbox options, drag&drop, and .mp3 URLs
     */
    CambridgeHelper.extractActivity = function () {
        const doc = CambridgeHelper.getActiveDoc();
        const pageKey = CambridgeHelper.getPageKey();

        const inputs = Array.from(doc.querySelectorAll(CAM_INPUT_SEL)).filter(el => {
            if (!isVisInDoc(el)) return false;
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            return !['hidden', 'radio', 'checkbox', 'button', 'submit', 'reset', 'file'].includes(t);
        });

        const selects = Array.from(doc.querySelectorAll('select')).filter(isVisInDoc);

        const rawDrops = Array.from(doc.querySelectorAll(CAM_DROP_SEL)).filter(isVisInDoc);
        const dropzones = rawDrops.filter(z => !rawDrops.some(o => o !== z && z.contains(o)));

        const rawDrags = Array.from(doc.querySelectorAll(CAM_DRAG_SEL)).filter(el => isVisInDoc(el) && !dropzones.some(z => z.contains(el)));
        const draggables = rawDrags.filter(d => !rawDrags.some(o => o !== d && d.contains(o)));

        const radios = Array.from(doc.querySelectorAll('input[type="radio"], [role="radio"]')).filter(el => isVisInDoc(el) || isVisInDoc(el.parentElement));
        const radioGroupsMap = new Map();
        radios.forEach((r, idx) => {
            const key = r.getAttribute('name') || r.closest('[role="radiogroup"], .question, .mcq-item, .activity-item, fieldset, li, tr')?.id || `rg_${idx}`;
            if (!radioGroupsMap.has(key)) radioGroupsMap.set(key, []);
            const lbl = normSpace(
                r.closest('label')?.innerText ||
                (r.id && doc.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText) ||
                r.parentElement?.innerText ||
                r.value || ''
            );
            radioGroupsMap.get(key).push({ idx: radioGroupsMap.get(key).length, label: cap(lbl, 90), checked: Boolean(r.checked || r.getAttribute('aria-checked') === 'true'), status: getSlotStatus(r) });
        });

        const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
            .filter(el => isVisInDoc(el) || isVisInDoc(el.parentElement))
            .map((cb, i) => ({
                i,
                label: cap(cb.closest('label')?.innerText || cb.parentElement?.innerText || cb.value || '', 90),
                checked: Boolean(cb.checked || cb.getAttribute('aria-checked') === 'true'),
                status: getSlotStatus(cb)
            }));

        const qNodes = Array.from(doc.querySelectorAll('.question, .question-item, .exercise-item, .activity-item, .prompt, .sentence, li, p'))
            .filter(el => isVisInDoc(el) && normSpace(el.innerText).length > 2)
            .slice(0, 35);
        const questions = qNodes.map(q => cap(q.innerText, 160));

        return {
            platform: 'cambridge',
            pageKey,
            inIframe: doc !== document,
            title: cap(doc.title || document.title, 80),
            questions: questions.slice(0, 20),
            inputs: inputs.map((el, i) => ({ i, val: normSpace(el.value ?? el.innerText), status: getSlotStatus(el) })),
            selects: selects.map((s, i) => ({
                i,
                val: normSpace(s.options[s.selectedIndex]?.text || s.value),
                opts: Array.from(s.options).map(o => normSpace(o.text)).filter(Boolean),
                status: getSlotStatus(s)
            })),
            radioGroups: Array.from(radioGroupsMap.entries()).map(([name, opts], i) => ({ i, name, opts })),
            checkboxes,
            dropzones: dropzones.map((z, i) => ({ i, val: cap(z.innerText, 60), status: getSlotStatus(z) })),
            options: draggables.map(d => cap(d.innerText || d.getAttribute('aria-label') || '', 60)).filter(Boolean),
            audioUrls: collectCambridgeAudio()
        };
    };

    const setCambridgeInputValue = (el, val) => {
        const win = el.ownerDocument?.defaultView || window;
        if (el.isContentEditable) {
            el.focus();
            el.innerText = String(val ?? '');
            el.dispatchEvent(new win.Event('input', { bubbles: true }));
            el.dispatchEvent(new win.Event('change', { bubbles: true }));
            el.blur();
            return;
        }
        const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement?.prototype : win.HTMLInputElement?.prototype;
        const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        el.focus();
        if (setter) setter.call(el, String(val ?? ''));
        else el.value = String(val ?? '');
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
        el.dispatchEvent(new win.KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        el.blur();
    };

    const findBtnAcrossDocs = (regex) => {
        for (const d of [CambridgeHelper.getActiveDoc(), ...getAllDocs(document)]) {
            const btns = Array.from(d.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"], [role="button"], .btn'))
                .filter(el => isVisInDoc(el) && !el.disabled && !el.classList.contains('disabled') && el.getAttribute('aria-disabled') !== 'true');
            const hit = btns.find(b => {
                const txt = normSpace(b.innerText || b.value || b.getAttribute('aria-label') || b.getAttribute('title') || '');
                return regex.test(txt) || regex.test(b.className || '');
            });
            if (hit) return hit;
        }
        return null;
    };

    const placeCambridgeDrag = async (tile, zone) => {
        if (!tile || !zone) return false;
        const win = zone.ownerDocument?.defaultView || window;
        // 1. Click-to-select tile then click-to-drop zone (Cambridge One / LMS standard)
        tile.click();
        await sleep(35);
        zone.click();
        await sleep(35);

        // 2. Also fire HTML5 DragEvents + PointerEvents if zone is still empty
        if (!normSpace(zone.innerText) || normSpace(zone.innerText) !== normSpace(tile.innerText)) {
            try {
                const dt = new win.DataTransfer();
                dt.setData('text/plain', normSpace(tile.innerText));
                tile.dispatchEvent(new win.DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
                zone.dispatchEvent(new win.DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
                zone.dispatchEvent(new win.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
                zone.dispatchEvent(new win.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
                tile.dispatchEvent(new win.DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
            } catch (_) { }
        }
        return true;
    };

    /**
     * 3. fillAndCheck(answers): Fills inputs/selects/radios/checkboxes/drag-and-drop, skips locked green slots, clicks Check/Submit, and saves 100% to port 8765
     */
    CambridgeHelper.fillAndCheck = async function (answers, opts = {}) {
        const doc = CambridgeHelper.getActiveDoc();
        const win = doc.defaultView || window;
        const list = Array.isArray(answers) ? answers : (answers?.answers || []);
        let cursor = 0;

        // A. Fill inline inputs + selects in DOM order
        const inlineControls = Array.from(doc.querySelectorAll(`${CAM_INPUT_SEL}, select`)).filter(el => {
            if (!isVisInDoc(el)) return false;
            if (el.tagName === 'SELECT') return true;
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            return !['hidden', 'radio', 'checkbox', 'button', 'submit', 'reset', 'file'].includes(t);
        });

        for (const el of inlineControls) {
            const val = list[cursor++];
            if (val === undefined || val === null) continue;
            if (getSlotStatus(el) === 'correct' || el.disabled || el.readOnly) continue;

            if (el.tagName === 'SELECT') {
                const target = normSpace(val).toLowerCase();
                const opt = Array.from(el.options).find(o => normSpace(o.text).toLowerCase() === target || normSpace(o.value).toLowerCase() === target)
                    || Array.from(el.options).find(o => normSpace(o.text).toLowerCase().includes(target));
                if (opt) {
                    el.value = opt.value;
                    opt.selected = true;
                    el.dispatchEvent(new win.Event('input', { bubbles: true }));
                    el.dispatchEvent(new win.Event('change', { bubbles: true }));
                }
            } else {
                setCambridgeInputValue(el, val);
            }
        }

        // B. Fill Drag & Drop zones
        const rawDrops = Array.from(doc.querySelectorAll(CAM_DROP_SEL)).filter(isVisInDoc);
        const dropzones = rawDrops.filter(z => !rawDrops.some(o => o !== z && z.contains(o)));
        if (dropzones.length > 0 && cursor < list.length) {
            for (const zone of dropzones) {
                const ans = list[cursor++];
                if (ans === undefined || ans === null) continue;
                if (getSlotStatus(zone) === 'correct') continue;
                const want = normSpace(ans);
                const pool = Array.from(doc.querySelectorAll(CAM_DRAG_SEL)).filter(d => isVisInDoc(d) && !dropzones.some(z => z.contains(d)));
                const tile = pool.find(d => normSpace(d.innerText) === want)
                    || pool.find(d => normSpace(d.innerText).toLowerCase() === want.toLowerCase());
                if (tile) await placeCambridgeDrag(tile, zone);
            }
        }

        // C. Fill Radio groups
        const radios = Array.from(doc.querySelectorAll('input[type="radio"], [role="radio"]')).filter(el => isVisInDoc(el) || isVisInDoc(el.parentElement));
        if (radios.length > 0 && cursor < list.length) {
            const groups = [];
            const seen = new Map();
            radios.forEach((r, idx) => {
                const k = r.getAttribute('name') || r.closest('[role="radiogroup"], .question, .mcq-item, .activity-item, fieldset, li, tr')?.id || `rg_${idx}`;
                if (!seen.has(k)) { seen.set(k, []); groups.push(seen.get(k)); }
                seen.get(k).push(r);
            });
            for (const grp of groups) {
                const ans = list[cursor++];
                if (ans === undefined || ans === null) continue;
                if (grp.some(r => getSlotStatus(r) === 'correct')) continue;
                let pick = null;
                if (typeof ans === 'number') pick = grp[ans];
                else {
                    const want = normSpace(ans).toLowerCase();
                    pick = grp.find(r => {
                        const lbl = normSpace(r.closest('label')?.innerText || r.parentElement?.innerText || r.value || '').toLowerCase();
                        return lbl === want || lbl.includes(want);
                    });
                }
                if (pick) {
                    const clickTarget = pick.closest('label') || pick;
                    clickTarget.click();
                    pick.checked = true;
                    pick.dispatchEvent(new win.Event('change', { bubbles: true }));
                }
            }
        }

        // D. Fill Checkboxes
        const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"], [role="checkbox"]')).filter(el => isVisInDoc(el) || isVisInDoc(el.parentElement));
        if (checkboxes.length > 0 && cursor < list.length) {
            for (const cb of checkboxes) {
                const want = Boolean(list[cursor++]);
                if (getSlotStatus(cb) === 'correct') continue;
                const cur = Boolean(cb.checked || cb.getAttribute('aria-checked') === 'true');
                if (cur !== want) {
                    (cb.closest('label') || cb).click();
                    cb.dispatchEvent(new win.Event('change', { bubbles: true }));
                }
            }
        }

        await sleep(120);

        // E. Click Check / Submit button
        if (opts.check !== false) {
            const checkBtn = findBtnAcrossDocs(/^(check(\s+answers?)?|submit|verify|confirm|ตรวจคำตอบ|ส่งคำตอบ)$/i);
            if (checkBtn) {
                checkBtn.click();
                await sleep(450);
            }
        }

        const after = CambridgeHelper.extractActivity();
        const allSlots = [...after.inputs, ...after.selects, ...after.dropzones];
        const wrongCount = allSlots.filter(s => s.status === 'wrong').length;
        const correctCount = allSlots.filter(s => s.status === 'correct').length;
        const allCorrect = allSlots.length > 0 ? (wrongCount === 0 && correctCount > 0) : true;

        if (allCorrect && list.length > 0) {
            try {
                fetch('http://localhost:8765', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_page', page_key: after.pageKey, answers: list })
                }).catch(() => { });
            } catch (_) { }
        }

        return {
            ok: allCorrect,
            pageKey: after.pageKey,
            correctCount,
            wrongCount,
            totalSlots: allSlots.length,
            answers: list
        };
    };

    /**
     * 4. fixWrongAnswers(candidateAnswers): Clicks "Try again", locks green (correct) answers, and repairs only red/wrong slots until 100%
     */
    CambridgeHelper.fixWrongAnswers = async function (candidateAnswers = null) {
        const snap = CambridgeHelper.extractActivity();
        const doc = CambridgeHelper.getActiveDoc();

        // Record which indices are already green/correct vs wrong before clicking Try again
        const slots = [...snap.inputs, ...snap.selects, ...snap.dropzones];
        const lockedValues = slots.map(s => s.status === 'correct' ? s.val : null);
        const wrongIndices = slots.map((s, i) => s.status !== 'correct' ? i : -1).filter(i => i >= 0);

        if (wrongIndices.length === 0 && slots.length > 0) {
            return { ok: true, pageKey: snap.pageKey, fixed: 0, answers: slots.map(s => s.val) };
        }

        // Click "Try again" / "Retry" / "Reset" if present
        const tryAgainBtn = findBtnAcrossDocs(/^(try\s+again|retry|reattempt|reset|correct|ลองอีกครั้ง|ทำใหม่)$/i);
        if (tryAgainBtn) {
            tryAgainBtn.click();
            await sleep(350);
        }

        // Build repaired answer list: keep locked green values, substitute new candidate or rotate bank options for wrong slots
        const freshSnap = CambridgeHelper.extractActivity();
        const bankPool = freshSnap.options.filter(opt => !lockedValues.includes(opt));
        let poolIdx = 0;

        const merged = lockedValues.map((lockedVal, idx) => {
            if (lockedVal !== null && lockedVal !== '') return lockedVal;
            if (Array.isArray(candidateAnswers) && candidateAnswers[idx] !== undefined) return candidateAnswers[idx];
            if (freshSnap.selects[idx]) {
                const curVal = slots[idx]?.val;
                const alt = freshSnap.selects[idx].opts.find(o => o && o !== curVal);
                if (alt) return alt;
            }
            if (bankPool.length > 0) return bankPool[poolIdx++ % bankPool.length];
            return slots[idx]?.val || '';
        });

        const res = await CambridgeHelper.fillAndCheck(merged);

        // If Show Answers / Reveal button is available after attempts, harvest 100% answers and save
        if (!res.ok) {
            const showAnsBtn = findBtnAcrossDocs(/^(show\s+answers?|reveal\s+answers?|see\s+answers?|solution|เฉลย)$/i);
            if (showAnsBtn) {
                showAnsBtn.click();
                await sleep(350);
                const revealed = CambridgeHelper.extractActivity();
                const revealedAns = [...revealed.inputs, ...revealed.selects, ...revealed.dropzones].map(s => s.val).filter(Boolean);
                if (revealedAns.length > 0) {
                    fetch('http://localhost:8765', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'save_page', page_key: revealed.pageKey, answers: revealedAns })
                    }).catch(() => { });
                }
                return { ...res, revealedAnswers: revealedAns };
            }
        }

        return res;
    };

    CambridgeHelper.next = function () {
        const nextBtn = findBtnAcrossDocs(/^(next(\s+activity|\s+exercise)?|continue|forward|>|›|ถัดไป|ต่อไป)$/i);
        if (nextBtn) {
            nextBtn.click();
            return { clicked: true, pageKey: CambridgeHelper.getPageKey() };
        }
        return { clicked: false, pageKey: CambridgeHelper.getPageKey() };
    };

    CambridgeHelper.autoSolve = async function (answers = null, opts = { autoNext: true }) {
        const pageKey = CambridgeHelper.getPageKey();
        let targetAnswers = answers;

        if (!targetAnswers) {
            try {
                const r = await fetch('http://localhost:8765', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_page', page_key: pageKey })
                });
                const j = await r.json();
                if (j && j.found && j.answers) targetAnswers = j.answers;
            } catch (_) { }
        }

        if (!targetAnswers) {
            return { ok: false, cacheMiss: true, pageKey, inspect: CambridgeHelper.extractActivity() };
        }

        let res = await CambridgeHelper.fillAndCheck(targetAnswers);
        if (!res.ok) {
            res = await CambridgeHelper.fixWrongAnswers(targetAnswers);
        }
        if (res.ok && opts?.autoNext) {
            const nav = CambridgeHelper.next();
            return { ...res, nextClicked: nav.clicked };
        }
        return res;
    };

    window.CambridgeHelper = CambridgeHelper;
    window.Cambridge = CambridgeHelper;
})();
