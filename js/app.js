class QuranMemApp {
    constructor() {
        this.data = window.quranData;
        this.audioController = new AudioController();
        this.speechController = new SpeechController();

        this.currentSurah = null;
        this.currentAyahIndex = 0;
        this.testMode = 0; // 0: Normal, 1: Partial, 2: Blind, 3: Random

        this.initUI();
        this.renderSurahList();
    }

    initUI() {
        // Navigation binds
        document.getElementById('nav-surahs-btn').addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.showScreen('surah-list-screen')
        });
        document.getElementById('nav-dashboard-btn').addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.updateDashboard();
            this.showScreen('progress-dashboard');
        });
        document.getElementById('back-btn').addEventListener('click', () => {
            this.audioController.updatePlayState(false);
            this.audioController.audioElement.pause();
            this.showScreen('surah-list-screen');
        });

        // Auto-play next Ayah
        window.addEventListener('ayah-ended', () => {
            // Clear current highlight
            this.highlightWords(-1);

            // Auto-advance
            if (this.currentAyahIndex < this.currentSurah.ayahs.length - 1) {
                this.currentAyahIndex++;
                this.loadCurrentAyahAudio();

                setTimeout(() => {
                    this.audioController.togglePlay();
                }, 500); // 0.5 second gap
            } else {
                // finished surah
                this.audioController.audioElement.src = '';
            }
        });

        // Recitation logic
        const reciteBtn = document.getElementById('recite-btn');
        reciteBtn.addEventListener('click', () => this.toggleRecitation(reciteBtn));

        const testModeBtn = document.getElementById('test-mode-btn');
        if (testModeBtn) {
            testModeBtn.addEventListener('click', () => this.cycleTestMode());
        }

        // Audio word highlight callback
        this.audioController.setHighlightCallback((wordIndex) => {
            this.highlightWords(wordIndex);
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const navBtn = document.getElementById(`nav-${screenId.split('-')[0]}-btn`);
        if (navBtn) navBtn.classList.add('active');
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
        document.getElementById('test-mode-btn').innerHTML = '🧪 Test Mode';
        this.renderSurah();
        this.showScreen('ayah-player-screen');
    }

    cycleTestMode() {
        this.testMode = (this.testMode + 1) % 4;
        const modes = ["🧪 Normal", "🧪 Partial Help", "🧪 Blind", "🧪 Random Ayah"];
        document.getElementById('test-mode-btn').innerHTML = modes[this.testMode];

        if (this.testMode === 3) {
            // Treat mode 3 as blind for the whole surah since we display it all now
            this.testMode = 2;
        }
        this.renderSurah();
    }

    async renderSurah() {
        const surah = this.currentSurah;

        const surahTitleEl = document.getElementById('current-surah-title');
        surahTitleEl.textContent = surah.name;
        document.getElementById('current-surah-info').textContent = `${surah.ayahCount} Ayahs ${this.testMode > 0 ? '(Test)' : ''}`;

        // Check if memorized
        const id = `surah_${surah.id}_full`;
        const progress = await window.qDataStorage.getProgress(id);
        if (progress && progress.status === 'memorized') {
            surahTitleEl.innerHTML = `${surah.name} <span style="font-size: 0.8em;">🏆</span>`;
        }

        const textContainer = document.getElementById('surah-text');
        textContainer.innerHTML = '';

        this.surahWordsTarget = [];

        surah.ayahs.forEach((ayah, aIdx) => {
            ayah.words.forEach((wordObj, wIdx) => {
                const span = document.createElement('span');
                span.className = 'ayah-word';
                span.id = `word-${aIdx}-${wIdx}`;

                if (this.testMode === 1 && (aIdx > 0 || wIdx > 0)) {
                    span.classList.add('word-hidden');
                } else if (this.testMode === 2 || this.testMode === 3) {
                    span.classList.add('word-hidden');
                }

                span.textContent = wordObj.text;
                textContainer.appendChild(span);

                this.surahWordsTarget.push({ text: wordObj.text, span: span });
            });

            // Ayah End Marker
            const marker = document.createElement('span');
            marker.className = 'ayah-end-marker';
            marker.textContent = ` ﴿${ayah.number}﴾ `;
            marker.style.color = 'var(--text-sec)';
            marker.style.margin = '0 8px';
            if (this.testMode === 2 || this.testMode === 3) marker.classList.add('word-hidden');
            textContainer.appendChild(marker);
            this.surahWordsTarget.push({ text: null, span: marker }); // push marker just to reveal it later
        });

        this.currentAyahIndex = 0;
        this.loadCurrentAyahAudio();
        this.clearFeedback();

        if (this.speechController) {
            this.speechController.clearTranscript();
        }
    }

    loadCurrentAyahAudio() {
        const ayah = this.currentSurah.ayahs[this.currentAyahIndex];
        this.audioController.loadAyah(ayah.audioUrl, ayah.words);
    }

    highlightWords(localActiveIndex) {
        // Clear all active highlights
        document.querySelectorAll('.ayah-word.highlight').forEach(w => w.classList.remove('highlight'));

        if (localActiveIndex !== -1) {
            const activeSpan = document.getElementById(`word-${this.currentAyahIndex}-${localActiveIndex}`);
            if (activeSpan) {
                activeSpan.classList.add('highlight');
                // Auto scroll smoothly to word
                activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        btn.classList.add('reciting');
        btn.innerHTML = '🛑 Stop';

        // Hide all words unconditionally so Recitation is always a memory test
        this.surahWordsTarget.forEach(w => {
            w.span.classList.add('word-hidden');
            w.span.classList.remove('correct', 'missed', 'incorrect', 'highlight');
        });

        // If resuming, instantly re-process to restore previous correct matches
        if (this.speechController && this.speechController.persistentTranscript) {
            this.processRecitation(this.speechController.persistentTranscript);
        }

        this.showFeedback('Listening... Start reciting!', 'recording');

        this.speechController.startRecording(
            (transcript) => this.processRecitation(transcript),
            (err) => {
                this.showFeedback(`Error: ${err}`, 'recording');
                btn.classList.remove('reciting');
                btn.innerHTML = '🎤 Recite';
            },
            () => {
                btn.classList.remove('reciting');
                btn.innerHTML = '🎤 Recite';
                this.finalizeRecitation();
            }
        );
    }

    stopRecitationCommand() {
        this.speechController.stopRecording();
        const btn = document.getElementById('recite-btn');
        btn.classList.remove('reciting');
        btn.innerHTML = '🎤 Recite';
        this.finalizeRecitation();
    }

    processRecitation(transcript) {
        if (!transcript) return;

        const cleanSpoken = this.normalizeArabic(transcript).trim().split(/\s+/).filter(x => x.length > 0);

        // Reset all words visually since we re-calculate from the start of the transcript on every interim result
        this.surahWordsTarget.forEach((w, i) => {
            w.span.classList.remove('correct', 'missed', 'incorrect', 'highlight');

            if (this.testMode === 2 || this.testMode === 3) {
                w.span.classList.add('word-hidden');
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
                // Match found in exact sequence!
                checkTarget.span.classList.remove('word-hidden');
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
        this.latestAccuracy = 0;
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
            document.getElementById('stat-memorized').textContent = allProgress.length;
            document.getElementById('stat-accuracy').textContent = allProgress.length > 0 ? "85%" : "0%";

            const list = document.getElementById('recent-tests-list');
            list.innerHTML = '';

            if (allProgress.length === 0) {
                list.innerHTML = '<li>No activity yet.</li>';
                return;
            }

            // Sort by latest
            allProgress.sort((a, b) => new Date(b.date) - new Date(a.date));

            allProgress.forEach(p => {
                const surah = this.data.surahs.find(s => s.id === p.surahId);
                const surahName = surah ? surah.name : `Surah ${p.surahId}`;

                const li = document.createElement('li');
                li.style.padding = '0.75rem 0';
                li.style.borderBottom = '1px solid var(--glass-border)';
                li.style.color = 'var(--text-sec)';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';

                const date = new Date(p.date).toLocaleDateString();

                const infoDiv = document.createElement('div');
                infoDiv.innerHTML = `<strong style="color:var(--text-primary)">${p.surahId}. ${surahName}</strong> <br/> <small>Status: ${p.status} on ${date}</small>`;

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '❌';
                removeBtn.style.background = 'none';
                removeBtn.style.border = 'none';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.fontSize = '1.2rem';
                removeBtn.title = 'Remove Memorization';

                removeBtn.onclick = async () => {
                    if (confirm(`Remove memory record for ${surahName}?`)) {
                        await window.qDataStorage.deleteProgress(p.id);
                        await this.updateDashboard(); // Re-render this list
                        this.renderSurahList(); // Refresh main list to remove trophy
                    }
                };

                li.appendChild(infoDiv);
                li.appendChild(removeBtn);
                list.appendChild(li);
            });

        } catch (e) {
            console.error("Dashboard DB error", e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuranMemApp();
});
