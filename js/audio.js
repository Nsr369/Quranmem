class AudioController {
    constructor() {
        this.audioElement = document.getElementById('quran-audio');
        this.playPauseBtn = document.getElementById('play-pause-btn');
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

    updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        if (isPlaying) {
            this.playPauseBtn.innerHTML = '⏸';
            this.playPauseBtn.classList.add('playing');
            this.startTrackingTimer();
        } else {
            this.playPauseBtn.innerHTML = '▶';
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
