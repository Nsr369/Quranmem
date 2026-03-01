class AudioController {
    constructor() {
        this.audioElement = document.getElementById('quran-audio');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.currentWords = [];
        this.highlightCallback = null;
        this.isPlaying = false;

        this.audioElement.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.audioElement.addEventListener('ended', () => this.handleEnded());
        this.audioElement.addEventListener('pause', () => this.updatePlayState(false));
        this.audioElement.addEventListener('play', () => this.updatePlayState(true));

        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
    }

    loadAyah(audioUrl, wordsData) {
        this.audioElement.src = audioUrl;
        this.currentWords = wordsData || [];
        // Reset highlights
        if (this.highlightCallback) this.highlightCallback(-1);
    }

    setHighlightCallback(cb) {
        this.highlightCallback = cb;
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
        } else {
            this.playPauseBtn.innerHTML = '▶';
            this.playPauseBtn.classList.remove('playing');
        }
    }

    handleTimeUpdate() {
        if (!this.highlightCallback || this.currentWords.length === 0) return;

        const currentTimeMs = this.audioElement.currentTime * 1000;

        // Find which word is currently playing based on timestamps
        let activeWordIndex = -1;
        for (let i = 0; i < this.currentWords.length; i++) {
            const word = this.currentWords[i];
            if (currentTimeMs >= word.startMs && currentTimeMs <= word.endMs) {
                activeWordIndex = i;
                break;
            } else if (currentTimeMs > word.endMs) {
                // Track the latest word passed
                activeWordIndex = i;
            }
        }

        this.highlightCallback(activeWordIndex);
    }

    handleEnded() {
        this.updatePlayState(false);
        // Highlight everything slightly or dim if we reached the end
        if (this.highlightCallback) this.highlightCallback(this.currentWords.length);

        // Dispatch custom event to auto-play next Ayah in app.js
        window.dispatchEvent(new CustomEvent('ayah-ended'));
    }
}

window.AudioController = AudioController;
