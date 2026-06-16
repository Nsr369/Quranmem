class AudioController {
    constructor() {
        this.audioElement = document.getElementById('quran-audio');
        this.playPauseBtn = document.getElementById('tb-play-btn');
        this.allWords = [];
        this.highlightCallback = null;
        this.isPlaying = false;

        // Track which Ayah we are currently in based on time
        this.ayahChangeCallback = null;
        this.animationFrameId = null;

        this.audioElement.addEventListener('ended', () => this.handleEnded());
        this.audioElement.addEventListener('pause', () => this.updatePlayState(false));
        this.audioElement.addEventListener('play', () => this.updatePlayState(true));

        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
    }

    loadSurah(audioUrl, flatWordsData) {
        this.audioElement.src = audioUrl;
        this.allWords = flatWordsData || [];
        this.audioElement.currentTime = 0;

        // Reset highlights
        if (this.highlightCallback) this.highlightCallback(-1, -1); // global/local reset
    }

    setHighlightCallback(cb) {
        this.highlightCallback = cb;
    }

    setAyahChangeCallback(cb) {
        this.ayahChangeCallback = cb;
    }

    togglePlay() {
        if (!this.audioElement.src) return;

        if (this.audioElement.paused) {
            this.audioElement.play().catch(e => console.error("Playback failed", e));
        } else {
            this.audioElement.pause();
        }
    }

    // Seek to the start of an Ayah by its index (0-based)
    seekToAyah(ayahIdx) {
        if (!this.audioElement.src || this.allWords.length === 0) return;

        // Find the first word of this ayah
        const firstWordOfAyah = this.allWords.find(w => w.ayahIdx === ayahIdx);
        if (!firstWordOfAyah) return;

        const seekToMs = firstWordOfAyah.startMs;
        this.audioElement.currentTime = seekToMs / 1000;

        // Start playing if paused
        if (this.audioElement.paused) {
            this.audioElement.play().catch(e => console.error("Playback failed", e));
        }
    }

    // Get the ayah index currently playing (based on current time)
    getCurrentAyahIdx() {
        if (this.allWords.length === 0) return -1;
        const currentTimeMs = this.audioElement.currentTime * 1000;
        let lastAyah = -1;
        for (const w of this.allWords) {
            if (currentTimeMs >= w.startMs - 200) lastAyah = w.ayahIdx;
            else break;
        }
        return lastAyah;
    }

    updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        const playLabel = document.getElementById('tb-play-label');
        const playSvg = document.getElementById('tb-play-svg');
        
        if (isPlaying) {
            if (playLabel) playLabel.textContent = 'Pause';
            if (playSvg) playSvg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Pause SVG path
            this.playPauseBtn.classList.add('playing');
            this.startTrackingTimer();
        } else {
            if (playLabel) playLabel.textContent = 'Play';
            if (playSvg) playSvg.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play SVG path
            this.playPauseBtn.classList.remove('playing');
            this.stopTrackingTimer();
        }
    }

    startTrackingTimer() {
        if (this.animationFrameId) return;
        const tick = () => {
            this.handleTimeUpdate();
            if (this.isPlaying) {
                this.animationFrameId = requestAnimationFrame(tick);
            }
        };
        this.animationFrameId = requestAnimationFrame(tick);
    }

    stopTrackingTimer() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    handleTimeUpdate() {
        if (!this.highlightCallback || this.allWords.length === 0) return;

        const currentTimeMs = this.audioElement.currentTime * 1000;

        // Find which word is currently playing based on timestamps
        let activeWordIndex = -1;
        let activeAyahIndex = 0;
        let localWordIndex = 0;

        for (let i = 0; i < this.allWords.length; i++) {
            const word = this.allWords[i];

            // Allow a tiny 50ms tolerance for smoother highlighting
            if (currentTimeMs >= (word.startMs - 50) && currentTimeMs <= word.endMs) {
                activeWordIndex = i;
                activeAyahIndex = word.ayahIdx;
                localWordIndex = word.wordIdx;
                break;
            } else if (currentTimeMs > word.endMs) {
                // Keep tracking the latest word passed so it stays highlighted during brief silences
                activeWordIndex = i;
                activeAyahIndex = word.ayahIdx;
                localWordIndex = word.wordIdx;
            }
        }

        if (activeWordIndex !== -1) {
            this.highlightCallback(activeWordIndex, activeAyahIndex, localWordIndex);
            if (this.ayahChangeCallback) {
                this.ayahChangeCallback(activeAyahIndex);
            }
        }
    }

    handleEnded() {
        this.updatePlayState(false);
        // Dispatch custom event if needed
        window.dispatchEvent(new CustomEvent('surah-ended'));
    }
}

window.AudioController = AudioController;
