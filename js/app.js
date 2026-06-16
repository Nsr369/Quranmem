const SURAH_PAGES = {
    78: 582, 79: 583, 80: 585, 81: 586, 82: 587, 83: 587, 84: 589, 85: 590,
    86: 591, 87: 591, 88: 592, 89: 593, 90: 594, 91: 595, 92: 595, 93: 596,
    94: 596, 95: 597, 96: 597, 97: 598, 98: 598, 99: 599, 100: 599, 101: 600,
    102: 600, 103: 601, 104: 601, 105: 601, 106: 602, 107: 602, 108: 602,
    109: 603, 110: 603, 111: 603, 112: 604, 113: 604, 114: 604
};

function toArabicNumerals(num) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => {
        const parsed = parseInt(digit, 10);
        return isNaN(parsed) ? digit : arabicDigits[parsed];
    }).join('');
}

class QuranMemApp {
    constructor() {
        this.data = window.quranData;
        this.audioController = new AudioController();
        this.speechController = new SpeechController();

        this.currentSurah = null;
        this.currentAyahIndex = 0;
        this.testMode = 0; // 0: Normal, 1: Partial, 2: Blind, 3: Random
        this.selectedReciter = localStorage.getItem('quranmem-reciter') || '7'; // Default: Mishari (7)
        this.autoScrollEnabled = true;
        this.translationMode = false;
        this.transLang = localStorage.getItem('quranmem-translang') || 'en'; // 'en' or 'ml'

        this.initUI();
        this.renderSurahList();
    }

    initUI() {
        // Back to surahs list
        document.getElementById('back-to-surahs-btn')?.addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.showScreen('surah-list-screen');
        });
        document.getElementById('header-juz-btn')?.addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.showScreen('surah-list-screen');
        });
        document.getElementById('header-surah-btn')?.addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.showScreen('surah-list-screen');
        });

        // Back from progress to surah player (or list)
        document.getElementById('back-from-progress-btn')?.addEventListener('click', () => {
            if (this.currentSurah) {
                this.showScreen('ayah-player-screen');
            } else {
                this.showScreen('surah-list-screen');
            }
        });

        document.getElementById('prev-surah-btn')?.addEventListener('click', () => {
            if (!this.currentSurah) return;
            const currentIndex = this.data.surahs.findIndex(s => s.id === this.currentSurah.id);
            if (currentIndex > 0) {
                this.audioController.updatePlayState(false);
                this.audioController.audioElement.pause();
                this.openSurah(this.data.surahs[currentIndex - 1]);
            }
        });

        document.getElementById('next-surah-btn')?.addEventListener('click', () => {
            if (!this.currentSurah) return;
            const currentIndex = this.data.surahs.findIndex(s => s.id === this.currentSurah.id);
            if (currentIndex < this.data.surahs.length - 1) {
                this.audioController.updatePlayState(false);
                this.audioController.audioElement.pause();
                this.openSurah(this.data.surahs[currentIndex + 1]);
            }
        });

        // Surah playback completion
        window.addEventListener('surah-ended', () => {
            this.highlightWords(-1, -1);
            this.audioController.audioElement.src = '';
            this.audioController.updatePlayState(false);
        });

        // Toolbar: Bookmarks (saves current Surah + Ayah index)
        const bookmarksBtn = document.getElementById('tb-bookmarks-btn');
        bookmarksBtn?.addEventListener('click', () => {
            if (!this.currentSurah) return;
            const bookmarkKey = `bookmark-${this.currentSurah.id}`;
            const existing = JSON.parse(localStorage.getItem(bookmarkKey) || 'null');
            const bookmarkSvg = document.getElementById('tb-bookmark-svg');

            if (existing) {
                // Remove bookmark
                localStorage.removeItem(bookmarkKey);
                bookmarksBtn.classList.remove('active');
                bookmarkSvg?.setAttribute('fill', 'none');
                bookmarkSvg?.setAttribute('stroke', 'currentColor');
                // Remove visual ayah bookmark markers
                document.querySelectorAll('.ayah-bookmarked').forEach(el => el.classList.remove('ayah-bookmarked'));
            } else {
                // Save bookmark at current ayah position
                const bookmarkData = {
                    surahId: this.currentSurah.id,
                    ayahIndex: this.currentAyahIndex
                };
                localStorage.setItem(bookmarkKey, JSON.stringify(bookmarkData));
                bookmarksBtn.classList.add('active');
                bookmarkSvg?.setAttribute('fill', 'var(--accent-color)');
                bookmarkSvg?.setAttribute('stroke', 'var(--accent-color)');
                // Highlight the bookmarked ayah row/position
                this._markBookmarkedAyah(this.currentAyahIndex);
            }
        });

        // Toolbar: Auto Scroll
        const autoscrollBtn = document.getElementById('tb-autoscroll-btn');
        autoscrollBtn?.addEventListener('click', () => {
            this.autoScrollEnabled = !this.autoScrollEnabled;
            autoscrollBtn.classList.toggle('active', this.autoScrollEnabled);
        });

        // Toolbar: Progress
        document.getElementById('tb-progress-btn')?.addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.updateDashboard();
            this.showScreen('progress-dashboard');
        });

        // Toolbar: Translation - toggles between Arabic-only and side-by-side translation view
        const toggleTransBtn = document.getElementById('tb-translation-btn');
        toggleTransBtn?.addEventListener('click', () => {
            this.translationMode = !this.translationMode;
            toggleTransBtn.classList.toggle('active', this.translationMode);
            this.renderSurah();
        });

        // Toolbar: Hifz — toggle recording OR show mode picker
        const hifzBtn = document.getElementById('tb-hifz-btn');
        if (hifzBtn) {
            hifzBtn.addEventListener('click', () => {
                if (this.speechController.isRecording) {
                    // Already recording — stop
                    this.stopRecitationCommand();
                    return;
                }
                if (this.translationMode) {
                    this.translationMode = false;
                    document.getElementById('tb-translation-btn')?.classList.remove('active');
                }
                this.showHifzModal();
            });
        }

        // Language toggle (EN / ML)
        const langEnBtn = document.getElementById('lang-en-btn');
        const langMlBtn = document.getElementById('lang-ml-btn');

        // Apply saved preference immediately
        langEnBtn?.classList.toggle('active', this.transLang === 'en');
        langMlBtn?.classList.toggle('active', this.transLang === 'ml');

        const setLang = (lang) => {
            this.transLang = lang;
            localStorage.setItem('quranmem-translang', lang);
            langEnBtn?.classList.toggle('active', lang === 'en');
            langMlBtn?.classList.toggle('active', lang === 'ml');
            // Re-render if a surah is open
            if (this.currentSurah) this.renderSurah();
        };
        langEnBtn?.addEventListener('click', () => setLang('en'));
        langMlBtn?.addEventListener('click', () => setLang('ml'));

        // Settings Modal: Memorization Mode select dropdown
        const testModeSelect = document.getElementById('test-mode-select');
        if (testModeSelect) {
            testModeSelect.addEventListener('change', (e) => {
                this.testMode = parseInt(e.target.value, 10);
                this.renderSurah();
            });
        }

        // Font Size Controls
        this.fontSize = 32; // Starting font size in pixels (equivalent to 2rem)
        const surahTextEl = document.getElementById('surah-text');

        // Skip word when touching screen in Hifz mode
        surahTextEl?.addEventListener('click', (e) => {
            if (this.speechController && this.speechController.isRecording) {
                // Ignore clicks on ayah end markers or target indicators
                if (e.target.closest('.ayah-marker-group') || e.target.classList.contains('ayah-end-marker')) {
                    return;
                }
                const nextUnmatched = this.surahWordsTarget.find(w => 
                    w.text !== null && w.span && !w.span.classList.contains('correct')
                );
                if (nextUnmatched) {
                    this.speechController.skipWord(nextUnmatched.text);
                    this.processRecitation(this.speechController.persistentTranscript);
                }
            }
        });

        const updateFontSize = () => {
            if (surahTextEl) {
                surahTextEl.style.fontSize = `${this.fontSize}px`;
                const lh = Math.round(this.fontSize * 3.125);
                surahTextEl.style.setProperty('--line-height-px', `${lh}px`);
                // Clear old inline styles that are now handled via CSS variables
                surahTextEl.style.lineHeight = '';
                surahTextEl.style.backgroundSize = '';
                surahTextEl.style.backgroundImage = '';
            }
        };

        // Initialize on load to ensure alignment is correct from start
        updateFontSize();

        document.getElementById('font-dec-btn')?.addEventListener('click', () => {
            if (this.fontSize > 24) {
                this.fontSize -= 4;
                updateFontSize();
            }
        });

        document.getElementById('font-inc-btn')?.addEventListener('click', () => {
            if (this.fontSize < 44) {
                this.fontSize += 4;
                updateFontSize();
            }
        });

        // PWA Install Logic
        this.deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('install-pwa-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.classList.remove('hidden');
            }
        });

        const installBtn = document.getElementById('install-pwa-btn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.style.display = 'none';
                    }
                    this.deferredPrompt = null;
                }
            });
        }
        // Audio word highlight callback passes the specific IDs now
        this.audioController.setHighlightCallback((globalIdx, ayahIdx, wordIdx) => {
            this.highlightWords(ayahIdx, wordIdx);
        });

        // Settings Modal UI bindings
        const settingsModal = document.getElementById('settings-modal');
        const settingsBtn = document.getElementById('settings-btn');
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        const reciterSelect = document.getElementById('reciter-select');

        // Bind 'More' button to settings modal as well
        document.getElementById('tb-more-btn')?.addEventListener('click', () => {
            if (reciterSelect) reciterSelect.value = this.selectedReciter;
            if (testModeSelect) testModeSelect.value = this.testMode.toString();
            document.getElementById('lang-en-btn')?.classList.toggle('active', this.transLang === 'en');
            document.getElementById('lang-ml-btn')?.classList.toggle('active', this.transLang === 'ml');
            settingsModal?.classList.add('active');
            settingsModal?.classList.remove('hidden');
        });

        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                if (reciterSelect) reciterSelect.value = this.selectedReciter;
                if (testModeSelect) testModeSelect.value = this.testMode.toString();
                settingsModal.classList.add('active');
                settingsModal.classList.remove('hidden');
            });
        }

        if (closeSettingsBtn && settingsModal) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsModal.classList.remove('active');
                settingsModal.classList.add('hidden');
            });
        }

        if (settingsModal) {
            // Close when clicking outside of modal content
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.remove('active');
                    settingsModal.classList.add('hidden');
                }
            });
        }

        if (reciterSelect) {
            reciterSelect.addEventListener('change', (e) => {
                const newValue = e.target.value;
                this.selectedReciter = newValue;
                localStorage.setItem('quranmem-reciter', newValue);

                // If currently playing/viewing a surah, reload it with the new reciter timings
                if (this.currentSurah) {
                    this.audioController.updatePlayState(false);
                    this.audioController.audioElement.pause();
                    this.renderSurah();
                }

                // Hide modal
                if (settingsModal) {
                    settingsModal.classList.remove('active');
                    settingsModal.classList.add('hidden');
                }
            });
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId)?.classList.add('active');
    }

    async renderSurahList() {
        const grid = document.getElementById('surah-grid');
        grid.innerHTML = '';

        for (const surah of this.data.surahs) {
            const card = document.createElement('div');
            card.className = 'surah-card';

            // Fetch status
            const id = `surah_${surah.id}_full`;
            const progress = await window.qDataStorage.getProgress(id);
            const isMemorized = progress && progress.status === 'memorized';
            const trophyHtml = isMemorized ? ' <span style="font-size: 1.2em;" title="Memorized">🏆</span>' : '';

            card.innerHTML = `
                <div class="surah-details">
                    <h3 style="display: flex; align-items: center; gap: 8px;">
                        ${surah.id}. ${surah.name}${trophyHtml}
                    </h3>
                    <p>${surah.englishName} • ${surah.ayahCount} Ayahs</p>
                </div>
                <div class="surah-arabic">${surah.arabicName}</div>
            `;
            card.addEventListener('click', () => {
                this.openSurah(surah);
            });
            grid.appendChild(card);
        }
    }

    openSurah(surah) {
        this.currentSurah = surah;
        this.currentAyahIndex = 0;
        this.testMode = 0;

        const testModeSelect = document.getElementById('test-mode-select');
        if (testModeSelect) testModeSelect.value = "0";

        const labelEl = document.getElementById('tb-hifz-label');
        if (labelEl) labelEl.textContent = 'Hifz';

        const hifzBtn = document.getElementById('tb-hifz-btn');
        if (hifzBtn) hifzBtn.classList.remove('active');

        this.renderSurah();
        this.showScreen('ayah-player-screen');

        // Restore bookmark state
        const bookmarkKey = `bookmark-${surah.id}`;
        const bookmarkData = JSON.parse(localStorage.getItem(bookmarkKey) || 'null');
        const bookmarksBtn = document.getElementById('tb-bookmarks-btn');
        const bookmarkSvg = document.getElementById('tb-bookmark-svg');
        if (bookmarkData) {
            bookmarksBtn?.classList.add('active');
            bookmarkSvg?.setAttribute('fill', 'var(--accent-color)');
            bookmarkSvg?.setAttribute('stroke', 'var(--accent-color)');
            // Scroll to bookmarked ayah after a short delay to let DOM settle
            setTimeout(() => this._scrollToBookmark(bookmarkData.ayahIndex), 400);
        } else {
            bookmarksBtn?.classList.remove('active');
            bookmarkSvg?.setAttribute('fill', 'none');
            bookmarkSvg?.setAttribute('stroke', 'currentColor');
        }
    }

    _markBookmarkedAyah(ayahIndex) {
        // Remove previous marks
        document.querySelectorAll('.ayah-bookmarked').forEach(el => el.classList.remove('ayah-bookmarked'));
        // Mark the row/marker for this ayah
        const markerEl = document.querySelector(`#surah-text .word-group:has(.ayah-end-marker)`);
        // Try to mark via trans-row or the first word of the ayah
        const firstWord = document.getElementById(`word-${ayahIndex}-0`) ||
            document.getElementById(`tr-word-${ayahIndex}-0`);
        if (firstWord) {
            const rowOrGroup = firstWord.closest('.trans-row') || firstWord.closest('.word-group');
            if (rowOrGroup) rowOrGroup.classList.add('ayah-bookmarked');
        }
    }

    _scrollToBookmark(ayahIndex) {
        const firstWord = document.getElementById(`word-${ayahIndex}-0`) ||
            document.getElementById(`tr-word-${ayahIndex}-0`);
        if (firstWord) {
            firstWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Briefly highlight the bookmarked position
            firstWord.style.outline = '2px solid var(--accent-color)';
            firstWord.style.borderRadius = '4px';
            setTimeout(() => { firstWord.style.outline = ''; firstWord.style.borderRadius = ''; }, 2000);
        }
    }

    showHifzModal() {
        document.getElementById('hifz-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'hifz-modal';
        overlay.className = 'hifz-modal-overlay';
        overlay.innerHTML = `
            <div class="hifz-modal-sheet">
                <div class="hifz-modal-handle"></div>
                <h3 class="hifz-modal-title">حفظ — Hifz Mode</h3>
                <p class="hifz-modal-sub">Choose text visibility, then start reciting</p>
                <div class="hifz-modal-options">
                    <button class="hifz-opt-btn ${this.testMode === 0 ? 'hifz-opt-active' : ''}" data-mode="0">
                        <span class="hifz-opt-icon">👁</span>
                        <span class="hifz-opt-label">Normal</span>
                        <span class="hifz-opt-desc">Show all words while reciting</span>
                    </button>
                    <button class="hifz-opt-btn ${this.testMode === 1 ? 'hifz-opt-active' : ''}" data-mode="1">
                        <span class="hifz-opt-icon">🤲</span>
                        <span class="hifz-opt-label">Help</span>
                        <span class="hifz-opt-desc">Show only first word of each Ayah</span>
                    </button>
                    <button class="hifz-opt-btn ${this.testMode === 2 ? 'hifz-opt-active' : ''}" data-mode="2">
                        <span class="hifz-opt-icon">🔒</span>
                        <span class="hifz-opt-label">Blind</span>
                        <span class="hifz-opt-desc">All characters replaced — pure memory</span>
                    </button>
                </div>
                <button class="hifz-start-btn" id="hifz-start-recite-btn">🎤 Start Reciting</button>
                <button class="hifz-modal-close">Cancel</button>
            </div>
        `;

        // Mode buttons — just select mode, don't start yet
        overlay.querySelectorAll('.hifz-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                overlay.querySelectorAll('.hifz-opt-btn').forEach(b => b.classList.remove('hifz-opt-active'));
                btn.classList.add('hifz-opt-active');
                this.testMode = parseInt(btn.dataset.mode, 10);
            });
        });

        // Start Reciting button — apply mode then start microphone
        overlay.querySelector('#hifz-start-recite-btn').addEventListener('click', () => {
            overlay.remove();
            const hifzBtn = document.getElementById('tb-hifz-btn');
            this._setTestMode(this.testMode);
            // Start after render settles
            setTimeout(() => this.startRecitationCommand(hifzBtn || document.createElement('button')), 100);
        });

        overlay.querySelector('.hifz-modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }

    _setTestMode(mode) {
        this.testMode = mode;
        const modes = ['Normal', 'Help', 'Blind'];
        const badges = ['حفظ<br/>القرآن', 'مساعدة', 'غيب'];

        const badgeTextEl = document.querySelector('#tb-hifz-badge .hifz-badge-text');
        if (badgeTextEl) badgeTextEl.innerHTML = badges[mode] || badges[0];

        const labelEl = document.getElementById('tb-hifz-label');
        if (labelEl) labelEl.textContent = mode === 0 ? 'Hifz' : `Hifz: ${modes[mode]}`;

        const hifzBtn = document.getElementById('tb-hifz-btn');
        if (hifzBtn) hifzBtn.classList.toggle('active', mode > 0);

        const testModeSelect = document.getElementById('test-mode-select');
        if (testModeSelect) testModeSelect.value = mode.toString();

        // Always render Arabic view for Hifz
        if (this.translationMode) {
            this.translationMode = false;
            document.getElementById('tb-translation-btn')?.classList.remove('active');
        }
        this.renderSurah();
    }

    // Replace each Arabic character with _ (for blind mode)
    _makeBlindText(arabicText) {
        if (!arabicText) return '';
        // Replace each char (including diacritics) with _ keeping spaces
        return arabicText.replace(/[^\s]/g, '_');
    }

    // Open an inline meaning editor inside the left translation column
    _openMeaningEditor(leftCol, meaningDiv, meaningKey) {
        // Remove existing editor if open
        leftCol.querySelector('.meaning-editor')?.remove();

        const existing = localStorage.getItem(meaningKey) || '';
        const editor = document.createElement('div');
        editor.className = 'meaning-editor';
        editor.innerHTML = `
            <textarea class="meaning-textarea" placeholder="Write your own note or meaning here..." rows="2">${existing}</textarea>
            <div class="meaning-editor-actions">
                <button class="meaning-save-btn">Save</button>
                <button class="meaning-delete-btn">Delete</button>
                <button class="meaning-cancel-btn">Cancel</button>
            </div>
        `;

        const textarea = editor.querySelector('.meaning-textarea');

        editor.querySelector('.meaning-save-btn').addEventListener('click', () => {
            const val = textarea.value.trim();
            if (val) {
                localStorage.setItem(meaningKey, val);
                meaningDiv.innerHTML = `<span class="meaning-label">📝 My Note:</span> <span class="meaning-text">${val}</span>`;
                meaningDiv.classList.remove('hidden');
            } else {
                localStorage.removeItem(meaningKey);
                meaningDiv.innerHTML = '';
                meaningDiv.classList.add('hidden');
            }
            editor.remove();
        });

        editor.querySelector('.meaning-delete-btn').addEventListener('click', () => {
            localStorage.removeItem(meaningKey);
            meaningDiv.innerHTML = '';
            meaningDiv.classList.add('hidden');
            editor.remove();
        });

        editor.querySelector('.meaning-cancel-btn').addEventListener('click', () => editor.remove());

        leftCol.appendChild(editor);
        textarea.focus();
    }

    cycleTestMode() {
        // Kept for compatibility but now shows modal instead
        this.showHifzModal();
    }


    getSurahWithTimings(surah) {
        if (!surah) return null;

        // Deep clone to prevent mutating global cache
        const clonedSurah = JSON.parse(JSON.stringify(surah));

        if (this.selectedReciter === '2' && window.abdulBasitTimings && window.abdulBasitTimings[clonedSurah.id]) {
            const abTimings = window.abdulBasitTimings[clonedSurah.id];

            // Override URLs and offsets
            clonedSurah.audioUrl = abTimings.audioUrl;
            clonedSurah.bismillahOffsetMs = abTimings.bismillahOffsetMs;

            // Override Ayah and Word timestamps
            clonedSurah.ayahs.forEach(clonedAyah => {
                const abAyah = abTimings.ayahs.find(a => a.number === clonedAyah.number);
                if (abAyah) {
                    clonedAyah.timestampFrom = abAyah.timestampFrom;
                    clonedAyah.timestampTo = abAyah.timestampTo;

                    clonedAyah.words.forEach((clonedWord, wIdx) => {
                        const abWordTiming = abAyah.words[wIdx];
                        if (abWordTiming) {
                            clonedWord.startMs = abWordTiming[0];
                            clonedWord.endMs = abWordTiming[1];
                        }
                    });
                }
            });
        }

        return clonedSurah;
    }

    async renderSurah() {
        const surah = this.getSurahWithTimings(this.currentSurah);
        if (!surah) return;

        // Dynamic Header metadata updates
        const juzBtn = document.getElementById('header-juz-btn');
        if (juzBtn) juzBtn.textContent = `Juz 30`;
        const pageNum = SURAH_PAGES[surah.id] || 582;
        document.getElementById('header-page').textContent = pageNum;
        const surahBtn = document.getElementById('header-surah-btn');
        if (surahBtn) surahBtn.textContent = surah.name;

        const surahTitleEl = document.getElementById('current-surah-title');
        const calligraphyTitle = `سُورَةُ ${surah.arabicName}`;
        surahTitleEl.textContent = calligraphyTitle;

        // Check if memorized
        const id = `surah_${surah.id}_full`;
        const progress = await window.qDataStorage.getProgress(id);
        if (progress && progress.status === 'memorized') {
            surahTitleEl.innerHTML = `${calligraphyTitle} <span style="font-size: 0.8em;">🏆</span>`;
        }

        // Toggle Prev/Next visibility based on Juz 30 boundaries
        const currentIndex = this.data.surahs.findIndex(s => s.id === surah.id);
        const prevBtn = document.getElementById('prev-surah-btn');
        if (prevBtn) prevBtn.style.visibility = currentIndex > 0 ? 'visible' : 'hidden';
        const nextBtn = document.getElementById('next-surah-btn');
        if (nextBtn) nextBtn.style.visibility = currentIndex < this.data.surahs.length - 1 ? 'visible' : 'hidden';

        const textContainer = document.getElementById('surah-text');
        textContainer.innerHTML = '';
        const displayContainer = document.getElementById('surah-display-container');

        // Show/hide surah title banner based on mode
        const titleBanner = document.querySelector('.surah-title-banner');
        if (titleBanner) titleBanner.style.display = this.translationMode ? 'none' : '';

        if (this.translationMode) {
            // ---- TRANSLATION TABLE MODE ----
            displayContainer.classList.add('translation-mode');
            displayContainer.classList.remove('arabic-mode');
            textContainer.classList.remove('arabic-text');
            textContainer.className = 'translation-table';
            textContainer.removeAttribute('dir');


            this.surahWordsTarget = [];
            let flatWords = [];
            surah.ayahs.forEach((ayah, aIdx) => {
                // Build flat word list for audio controller
                ayah.words.forEach((wordObj, wIdx) => {
                    this.surahWordsTarget.push({ text: wordObj.text, span: null });
                    flatWords.push({ ayahIdx: aIdx, wordIdx: wIdx, startMs: wordObj.startMs, endMs: wordObj.endMs });
                });
                this.surahWordsTarget.push({ text: null, span: null }); // marker slot

                // Build the Ayah Arabic text HTML (all words + marker)
                const arabicWordsHtml = ayah.words.map((wordObj, wIdx) => {
                    const wordHtml = wordObj.textTajweed || wordObj.text;
                    return `<span class="ayah-word tr-ayah-word" id="tr-word-${aIdx}-${wIdx}" data-start="${wordObj.startMs}" data-end="${wordObj.endMs}">${wordHtml}</span>`;
                }).join(' ');
                const markerHtml = `<span class="ayah-end-marker">${toArabicNumerals(ayah.number)}</span>`;

                // Row
                const row = document.createElement('div');
                row.className = 'trans-row';
                row.id = `trans-row-${aIdx}`;

                const leftCol = document.createElement('div');
                leftCol.className = 'trans-left';
                leftCol.dir = 'ltr';
                // Pick text based on selected language
                const ayahTransText = this.transLang === 'ml'
                    ? (ayah.translation_ml || ayah.translation || '')
                    : (ayah.translation || ayah.translation_ml || '');

                // Ayah number
                const ayahNumSpan = document.createElement('span');
                ayahNumSpan.className = 'trans-ayah-num';
                ayahNumSpan.textContent = ayah.number + '.';
                leftCol.appendChild(ayahNumSpan);

                // Translation text
                const transTextSpan = document.createElement('span');
                transTextSpan.className = 'trans-text-body';
                transTextSpan.textContent = ' ' + ayahTransText;
                leftCol.appendChild(transTextSpan);

                // User custom meaning (if saved)
                const meaningKey = `meaning-${surah.id}-${ayah.number}`;
                const savedMeaning = localStorage.getItem(meaningKey);
                const meaningDiv = document.createElement('div');
                meaningDiv.className = 'user-meaning' + (savedMeaning ? '' : ' hidden');
                meaningDiv.dataset.ayah = ayah.number;
                if (savedMeaning) {
                    meaningDiv.innerHTML = `<span class="meaning-label">📝 My Note:</span> <span class="meaning-text">${savedMeaning}</span>`;
                }
                leftCol.appendChild(meaningDiv);

                // Action row: bookmark + edit icons
                const actionRow = document.createElement('div');
                actionRow.className = 'trans-action-row';

                // Bookmark icon for this Ayah
                const bmKey = `bookmark-${surah.id}`;
                const bmData = JSON.parse(localStorage.getItem(bmKey) || 'null');
                const isThisAyahBm = bmData && bmData.ayahIndex === aIdx;
                const bmBtn = document.createElement('button');
                bmBtn.className = 'trans-icon-btn bm-btn' + (isThisAyahBm ? ' bm-active' : '');
                bmBtn.innerHTML = isThisAyahBm ? '🔖' : '🔖';
                bmBtn.title = isThisAyahBm ? 'Remove Bookmark' : 'Bookmark this Ayah';
                bmBtn.setAttribute('aria-label', 'Bookmark Ayah ' + ayah.number);
                const capturedAIdxBm = aIdx;
                const capturedSurahId = surah.id;
                bmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentBm = JSON.parse(localStorage.getItem(`bookmark-${capturedSurahId}`) || 'null');
                    if (currentBm && currentBm.ayahIndex === capturedAIdxBm) {
                        // Remove
                        localStorage.removeItem(`bookmark-${capturedSurahId}`);
                        bmBtn.classList.remove('bm-active');
                        bmBtn.title = 'Bookmark this Ayah';
                        // Update toolbar bookmark icon
                        const toolbarBm = document.getElementById('tb-bookmarks-btn');
                        const toolbarBmSvg = document.getElementById('tb-bookmark-svg');
                        toolbarBm?.classList.remove('active');
                        toolbarBmSvg?.setAttribute('fill', 'none');
                        toolbarBmSvg?.setAttribute('stroke', 'currentColor');
                        row.classList.remove('row-bookmarked');
                    } else {
                        // Save this Ayah
                        const newBm = { surahId: capturedSurahId, ayahIndex: capturedAIdxBm };
                        localStorage.setItem(`bookmark-${capturedSurahId}`, JSON.stringify(newBm));
                        // Clear other row bookmark highlights
                        document.querySelectorAll('.trans-row.row-bookmarked').forEach(r => r.classList.remove('row-bookmarked'));
                        document.querySelectorAll('.trans-icon-btn.bm-active').forEach(b => {
                            b.classList.remove('bm-active');
                            b.title = 'Bookmark this Ayah';
                        });
                        bmBtn.classList.add('bm-active');
                        bmBtn.title = 'Remove Bookmark';
                        row.classList.add('row-bookmarked');
                        // Update toolbar
                        const toolbarBm = document.getElementById('tb-bookmarks-btn');
                        const toolbarBmSvg = document.getElementById('tb-bookmark-svg');
                        toolbarBm?.classList.add('active');
                        toolbarBmSvg?.setAttribute('fill', 'var(--accent-color)');
                        toolbarBmSvg?.setAttribute('stroke', 'var(--accent-color)');
                    }
                });
                actionRow.appendChild(bmBtn);

                // Edit / add meaning button
                const editBtn = document.createElement('button');
                editBtn.className = 'trans-icon-btn edit-btn';
                editBtn.textContent = '✏️';
                editBtn.title = 'Add your own meaning';
                const capturedMKey = meaningKey;
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openMeaningEditor(leftCol, meaningDiv, capturedMKey);
                });
                actionRow.appendChild(editBtn);
                leftCol.appendChild(actionRow);

                // Apply bookmarked style if this row is bookmarked
                if (isThisAyahBm) row.classList.add('row-bookmarked');

                const rightCol = document.createElement('div');
                rightCol.className = 'trans-right';
                rightCol.dir = 'rtl';
                rightCol.innerHTML = arabicWordsHtml + ' ' + markerHtml;

                row.appendChild(leftCol);
                row.appendChild(rightCol);

                // NO audio click on translation rows (audio is from Arabic view)
                textContainer.appendChild(row);
            });

            this.audioController.loadSurah(surah.audioUrl, flatWords);

        } else {
            // ---- ARABIC BOOK MODE ----
            displayContainer.classList.remove('translation-mode');
            displayContainer.classList.add('arabic-mode');
            textContainer.className = 'arabic-text';
            textContainer.setAttribute('dir', 'rtl');

            // Centered Bismillah
            const bismillahContainer = document.createElement('div');
            bismillahContainer.className = 'bismillah-container';
            bismillahContainer.innerHTML = '<span class="bismillah-text">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>';
            textContainer.appendChild(bismillahContainer);

            this.surahWordsTarget = [];
            let flatWords = [];

            surah.ayahs.forEach((ayah, aIdx) => {
                ayah.words.forEach((wordObj, wIdx) => {
                    const wordGroup = document.createElement('div');
                    wordGroup.className = 'word-group';

                    const span = document.createElement('span');
                    span.className = 'ayah-word';
                    span.id = `word-${aIdx}-${wIdx}`;
                    span.dataset.start = wordObj.startMs;
                    span.dataset.end = wordObj.endMs;

                    if (wordObj.textTajweed) {
                        if (this.testMode === 2) {
                            const blindText = this._makeBlindText(wordObj.text);
                            span.textContent = blindText;
                            span.classList.add('blind-mode');
                            // Store original so we can reveal on correct match
                            span.dataset.origText = wordObj.text;
                            span.dataset.origTajweed = wordObj.textTajweed || '';
                        } else {
                            span.innerHTML = wordObj.textTajweed;
                        }
                    } else {
                        if (this.testMode === 2) {
                            span.textContent = this._makeBlindText(wordObj.text);
                            span.classList.add('blind-mode');
                            span.dataset.origText = wordObj.text;
                        } else {
                            span.textContent = wordObj.text;
                        }
                    }

                    if (this.testMode === 1 && (aIdx > 0 || wIdx > 0)) {
                        span.classList.add('word-hidden');
                    }

                    wordGroup.appendChild(span);

                    const transContainer = document.createElement('div');
                    transContainer.className = 'translation-container';
                    transContainer.dir = 'ltr';

                    // Show only the selected language's translation
                    const wordTransText = this.transLang === 'ml'
                        ? (wordObj.translation_ml || wordObj.translation || '')
                        : (wordObj.translation || wordObj.translation_ml || '');
                    if (wordTransText) {
                        const transSpan = document.createElement('span');
                        transSpan.className = this.transLang === 'ml' ? 'word-translation-ml' : 'word-translation-en';
                        transSpan.textContent = wordTransText;
                        transContainer.appendChild(transSpan);
                    }

                    wordGroup.appendChild(transContainer);
                    textContainer.appendChild(wordGroup);

                    this.surahWordsTarget.push({ text: wordObj.text, span: span });
                    flatWords.push({ ayahIdx: aIdx, wordIdx: wIdx, startMs: wordObj.startMs, endMs: wordObj.endMs });
                });

                // Ayah End Marker — inline circle after last word of ayah
                const markerGroup = document.createElement('div');
                markerGroup.className = 'word-group ayah-marker-group';

                const marker = document.createElement('span');
                marker.className = 'ayah-end-marker';
                marker.textContent = toArabicNumerals(ayah.number);
                marker.title = `Play Ayah ${ayah.number}`;
                if (this.testMode === 2 || this.testMode === 3) marker.classList.add('word-hidden');

                markerGroup.appendChild(marker);
                textContainer.appendChild(markerGroup);
                this.surahWordsTarget.push({ text: null, span: marker });

                // Click marker to seek to this Ayah
                const capturedAIdx = aIdx;
                markerGroup.addEventListener('click', () => {
                    const playingAyah = this.audioController.getCurrentAyahIdx();
                    const isPlaying = !this.audioController.audioElement.paused;
                    if (isPlaying && playingAyah === capturedAIdx) {
                        this.audioController.audioElement.pause();
                    } else {
                        this.audioController.seekToAyah(capturedAIdx);
                    }
                });

                // Full Ayah Translation block (shown when show-translations mode was active — now unused in main flow)
                const ayahTransBlock = document.createElement('div');
                ayahTransBlock.className = 'ayah-translation-block';
                ayahTransBlock.dir = 'ltr';

                const fullAyahText = this.transLang === 'ml'
                    ? (ayah.translation_ml || ayah.translation || '')
                    : (ayah.translation || ayah.translation_ml || '');
                const ayahTransP = document.createElement('p');
                ayahTransP.className = this.transLang === 'ml' ? 'ayah-translation-ml' : 'ayah-translation-en';
                ayahTransP.textContent = fullAyahText;
                ayahTransBlock.appendChild(ayahTransP);

                textContainer.appendChild(ayahTransBlock);
            });

            this.audioController.loadSurah(surah.audioUrl, flatWords);
        }

        this.clearFeedback();

        if (this.speechController) {
            this.speechController.clearTranscript();
        }

        // Update bookmarks state in toolbar
        const bookmarkKey2 = `bookmark-${surah.id}`;
        const bookmarkData2 = JSON.parse(localStorage.getItem(bookmarkKey2) || 'null');
        const bookmarkSvg = document.getElementById('tb-bookmark-svg');
        const bookmarksBtn = document.getElementById('tb-bookmarks-btn');
        if (bookmarkData2) {
            bookmarksBtn?.classList.add('active');
            bookmarkSvg?.setAttribute('fill', 'var(--accent-color)');
            bookmarkSvg?.setAttribute('stroke', 'var(--accent-color)');
        } else {
            bookmarksBtn?.classList.remove('active');
            bookmarkSvg?.setAttribute('fill', 'none');
            bookmarkSvg?.setAttribute('stroke', 'currentColor');
        }
    }


    highlightWords(ayahIdx, wordIdx) {
        // Track current ayah for bookmark saving
        if (ayahIdx >= 0) this.currentAyahIndex = ayahIdx;

        // Clear all active highlights
        document.querySelectorAll('.ayah-word.highlight').forEach(w => w.classList.remove('highlight'));
        document.querySelectorAll('.trans-row.active-row').forEach(r => r.classList.remove('active-row'));
        document.querySelectorAll('.ayah-end-marker.playing').forEach(m => m.classList.remove('playing'));

        if (ayahIdx !== -1 && wordIdx !== -1) {
            if (this.translationMode) {
                // Highlight the word in the translation table
                const trWord = document.getElementById(`tr-word-${ayahIdx}-${wordIdx}`);
                if (trWord) {
                    trWord.classList.add('highlight');
                    if (this.autoScrollEnabled) {
                        trWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                // Also highlight the whole row
                const activeRow = document.getElementById(`trans-row-${ayahIdx}`);
                if (activeRow) activeRow.classList.add('active-row');
            } else {
                const activeSpan = document.getElementById(`word-${ayahIdx}-${wordIdx}`);
                if (activeSpan) {
                    activeSpan.classList.add('highlight');
                    if (this.autoScrollEnabled) {
                        activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                // Mark the ayah-end-marker for the current ayah as playing (green circle)
                // Find it: the marker comes after all words of this ayah in surahWordsTarget
                // We find it by looking at the span with class ayah-end-marker in the marker group
                const markerGroups = document.querySelectorAll('.ayah-marker-group');
                const targetMarkerGroup = markerGroups[ayahIdx];
                if (targetMarkerGroup) {
                    const markerEl = targetMarkerGroup.querySelector('.ayah-end-marker');
                    if (markerEl) markerEl.classList.add('playing');
                }
            }
        }
    }


    // --- Recitation & Testing ---

    toggleRecitation(btn) {
        if (this.speechController.isRecording) {
            this.stopRecitationCommand();
        } else {
            this.startRecitationCommand(btn);
        }
    }

    startRecitationCommand(btn) {
        // Stop audio if playing
        if (!this.audioController.audioElement.paused) {
            this.audioController.togglePlay();
        }

        this.latestAccuracy = 0;
        btn.classList.add('reciting');
        if (btn.id === 'tb-hifz-btn') {
            const label = document.getElementById('tb-hifz-label');
            if (label) label.textContent = 'Stop';
        } else {
            btn.innerHTML = '🛑 Stop';
        }

        // Apply word visibility based on testMode:
        // Mode 0 (Normal) — show all words
        // Mode 1 (Help)   — show first word of each ayah, hide rest
        // Mode 2 (Blind)  — all words already shown as underscores from render; clear correct/incorrect state only
        this.surahWordsTarget.forEach((w, i) => {
            if (!w.span) return;
            w.span.classList.remove('correct', 'missed', 'incorrect', 'highlight');
            // In blind mode the text content is already _ chars; no extra CSS hiding needed
            // In help mode, word-hidden is already set from renderSurah
            // In normal mode, nothing is hidden
        });

        // If resuming, instantly re-process to restore previous correct matches
        if (this.speechController && this.speechController.persistentTranscript) {
            this.processRecitation(this.speechController.persistentTranscript);
        }

        this.showFeedback('🎤 Listening... Start reciting!', 'recording');

        this.speechController.startRecording(
            (transcript) => this.processRecitation(transcript),
            (err) => {
                this.showFeedback(`Error: ${err}`, 'recording');
                btn.classList.remove('reciting');
                if (btn.id === 'tb-hifz-btn') {
                    const label = document.getElementById('tb-hifz-label');
                    if (label) label.textContent = 'Hifz';
                } else {
                    btn.innerHTML = '🎤 Recite';
                }
                this.latestAccuracy = undefined;
                this._setTestMode(0);
            },
            () => {
                btn.classList.remove('reciting');
                if (btn.id === 'tb-hifz-btn') {
                    const label = document.getElementById('tb-hifz-label');
                    if (label) label.textContent = 'Hifz';
                } else {
                    btn.innerHTML = '🎤 Recite';
                }
                this.finalizeRecitation();
            }
        );
    }

    stopRecitationCommand() {
        this.speechController.stopRecording();
        const btn = document.getElementById('tb-hifz-btn') || document.getElementById('recite-btn');
        if (btn) {
            btn.classList.remove('reciting');
            if (btn.id === 'tb-hifz-btn') {
                const label = document.getElementById('tb-hifz-label');
                if (label) label.textContent = 'Hifz';
            } else {
                btn.innerHTML = '🎤 Recite';
            }
        }
        this.finalizeRecitation();
    }

    processRecitation(transcript) {
        if (!transcript) return;

        const cleanSpoken = this.normalizeArabic(transcript).trim().split(/\s+/).filter(x => x.length > 0);

        // Reset all words visually since we re-calculate from the start of the transcript on every interim result
        this.surahWordsTarget.forEach((w, i) => {
            if (!w.span) return;
            w.span.classList.remove('correct', 'missed', 'incorrect', 'highlight');

            if (this.testMode === 2) {
                // Restore underscore display
                const orig = w.span.dataset.origText;
                if (orig) w.span.textContent = this._makeBlindText(orig);
                w.span.classList.add('blind-mode');
            } else if (this.testMode === 1 && i > 0) {
                w.span.classList.add('word-hidden');
            }
        });

        let correctCount = 0;
        let targetIdx = 0;
        let spokenIdx = 0;

        while (spokenIdx < cleanSpoken.length && targetIdx < this.surahWordsTarget.length) {
            // First, process any markers at targetIdx
            while (targetIdx < this.surahWordsTarget.length && this.surahWordsTarget[targetIdx].text === null) {
                this.surahWordsTarget[targetIdx].span.classList.remove('word-hidden');
                this.surahWordsTarget[targetIdx].span.style.color = '#0ea5e9'; // Distinct sky blue color for Index marker
                targetIdx++;
            }
            if (targetIdx >= this.surahWordsTarget.length) break;

            const spokenWord = cleanSpoken[spokenIdx];
            const checkTarget = this.surahWordsTarget[targetIdx];
            const targetText = this.normalizeArabic(checkTarget.text);

            if (spokenWord === targetText || this.isCloseMatch(spokenWord, targetText)) {
                // Match! Reveal the word
                checkTarget.span.classList.remove('word-hidden', 'blind-mode');
                checkTarget.span.classList.add('correct');
                // In blind mode: restore the actual Arabic text
                if (this.testMode === 2) {
                    const tajweed = checkTarget.span.dataset.origTajweed;
                    const origText = checkTarget.span.dataset.origText;
                    if (tajweed) {
                        checkTarget.span.innerHTML = tajweed;
                    } else if (origText) {
                        checkTarget.span.textContent = origText;
                    }
                }
                checkTarget.span.classList.add('correct');
                checkTarget.span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetIdx++;
                correctCount++;
            }

            // Always move to the next spoken word. Target only moves if matched.
            spokenIdx++;
        }

        const totalTargetTextWords = this.surahWordsTarget.filter(w => w.text !== null).length;
        this.latestAccuracy = Math.round((correctCount / totalTargetTextWords) * 100);
        this.showFeedback(`Reciting... matched ${correctCount}/${totalTargetTextWords}. Last: "${cleanSpoken.slice(-3).join(' ')}"`, 'recording');

        // Auto-stop and mark as memorized when all words are matched
        if (correctCount === totalTargetTextWords) {
            this.stopRecitationCommand();
        }
    }

    async finalizeRecitation() {
        if (this.latestAccuracy === undefined) return;

        const msg = this.latestAccuracy > 80 ? 'Excellent!' : (this.latestAccuracy > 50 ? 'Good try!' : 'Keep practicing.');
        this.showFeedback(`Completed! Accuracy: ${this.latestAccuracy}% - ${msg}`, this.latestAccuracy > 80 ? 'success' : 'recording');

        // Save progress using full Surah id
        let id = `surah_${this.currentSurah.id}_full`;
        await window.qDataStorage.saveProgress(id, {
            surahId: this.currentSurah.id,
            ayahIndex: "Full",
            date: new Date().toISOString(),
            status: this.latestAccuracy > 80 ? 'memorized' : 'learning',
            accuracy: this.latestAccuracy
        });
        this.latestAccuracy = undefined;
        this._setTestMode(0);
    }

    normalizeArabic(str) {
        if (!str) return '';
        let normalized = str;

        // Replace Dagger Alef with regular Alef
        normalized = normalized.replace(/\u0670/g, 'ا');

        // Remove diacritics including Tajweed marks
        normalized = normalized.replace(/[\u064B-\u065F\u06D6-\u06ED]/g, '');

        // Normalize letters
        normalized = normalized.replace(/[أإآٱ]/g, 'ا'); // Alefs
        normalized = normalized.replace(/[ى]/g, 'ي');   // Alef Maksura to Ya
        normalized = normalized.replace(/[ة]/g, 'ه');   // Ta marbuta to Ha
        normalized = normalized.replace(/[ؤ]/g, 'و');   // Waw with Hamza
        normalized = normalized.replace(/[ئ]/g, 'ي');   // Ya with Hamza

        // Remove tatweel, zero width spaces, and punctuation
        normalized = normalized.replace(/[\u0640\u200B-\u200D\uFEFF]/g, '');

        return normalized;
    }

    isCloseMatch(spoken, target) {
        // Fallback for noisy speech recognizing pieces of words
        // e.g., "wal-asr" vs "wa al asr" or "lfi" vs "lafi" 
        if (spoken.length > 2 && target.length > 2) {
            if (spoken.includes(target) || target.includes(spoken)) return true;
        }

        // Extremely loose prefix check (for "wa", "bi", "la", "fa", "al")
        if (Math.abs(spoken.length - target.length) <= 2) {
            // Check if one simply stripped a prefix but core word remains
            if (target.endsWith(spoken) || spoken.endsWith(target)) return true;
        }

        // Levenshtein-like distance check for minor typos from Apple Speech API
        let misMatches = 0;
        let p1 = 0; let p2 = 0;
        while (p1 < spoken.length && p2 < target.length) {
            if (spoken[p1] !== target[p2]) {
                misMatches++;
                if (spoken.length > target.length) p1++;
                else if (target.length > spoken.length) p2++;
                else { p1++; p2++; }
            } else {
                p1++; p2++;
            }
        }

        return misMatches <= 2 && Math.abs(spoken.length - target.length) <= 2;
    }

    showFeedback(msg, type) {
        const banner = document.getElementById('recitation-feedback');
        // remove existing classes except active and base
        banner.className = `feedback-banner active ${type}`;
        banner.textContent = msg;
    }

    clearFeedback() {
        const banner = document.getElementById('recitation-feedback');
        banner.className = 'feedback-banner hidden';
        banner.textContent = '';
    }

    async updateDashboard() {
        try {
            const allProgress = await window.qDataStorage.getAllProgress() || [];

            // Build surahId -> progress map
            const progressMap = {};
            let bestAccuracy = 0;
            allProgress.forEach(p => {
                progressMap[p.surahId] = p;
                if (p.accuracy && p.accuracy > bestAccuracy) bestAccuracy = p.accuracy;
            });

            const totalAyahs = this.data.surahs.reduce((s, sr) => s + sr.ayahCount, 0);
            const memorizedAyahs = allProgress.reduce((s, p) => {
                if (p.status !== 'memorized') return s;
                const surah = this.data.surahs.find(sr => sr.id === p.surahId);
                return s + (surah ? surah.ayahCount : 0);
            }, 0);
            const memorizedSurahs = allProgress.filter(p => p.status === 'memorized').length;
            const pct = totalAyahs > 0 ? Math.round((memorizedAyahs / totalAyahs) * 100) : 0;

            // Circular ring (circumference = 2πr = 263.9 for r=42)
            const circ = 263.9;
            const offset = circ - (pct / 100) * circ;
            const ring = document.getElementById('progress-ring-fill');
            if (ring) ring.style.strokeDashoffset = offset;
            const ringPct = document.getElementById('progress-ring-pct');
            if (ringPct) ringPct.textContent = pct + '%';

            // Stat cards
            const memEl = document.getElementById('stat-memorized');
            if (memEl) memEl.textContent = memorizedAyahs;
            const accEl = document.getElementById('stat-accuracy');
            if (accEl) accEl.textContent = bestAccuracy > 0 ? bestAccuracy + '%' : '—';
            const surahsEl = document.getElementById('stat-surahs');
            if (surahsEl) surahsEl.textContent = memorizedSurahs;

            // Per-surah list
            const listEl = document.getElementById('progress-surah-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            this.data.surahs.forEach(surah => {
                const p = progressMap[surah.id];
                const done = p && p.status === 'memorized';
                const surahPct = done ? 100 : 0;

                const row = document.createElement('div');
                row.className = 'psurah-row';
                row.innerHTML = `
                    <div class="psurah-header">
                        <span class="psurah-name">${surah.id}. ${surah.name} <span style="font-family:var(--font-arabic);font-weight:400;font-size:0.95em">${surah.arabicName || ''}</span></span>
                        <span class="psurah-pct">${done ? '✅ Done' : surah.ayahCount + ' ayahs'}</span>
                    </div>
                    <div class="psurah-bar-bg">
                        <div class="psurah-bar-fill ${done ? 'complete' : ''}" style="width:${surahPct}%"></div>
                    </div>
                `;

                // Tap row to jump to that surah
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    this.openSurah(surah);
                });

                listEl.appendChild(row);
            });

        } catch (e) {
            console.error('Dashboard DB error', e);
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuranMemApp();
});
