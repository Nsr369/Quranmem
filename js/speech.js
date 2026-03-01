class SpeechController {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.init();
    }

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRec();
        this.recognition.lang = 'ar-SA';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
    }

    startRecording(onResult, onError, onEnd) {
        if (!this.recognition) {
            if (onError) onError("Speech recognition not supported");
            return;
        }

        if (this.persistentTranscript === undefined) {
            this.persistentTranscript = '';
        }
        let currentSessionTranscript = '';

        try {
            this.recognition.onresult = (event) => {
                let sessionStr = '';
                for (let i = 0; i < event.results.length; ++i) {
                    sessionStr += event.results[i][0].transcript + ' ';
                }
                currentSessionTranscript = sessionStr;

                // Pass the combined latest transcript strings
                if (onResult) onResult((this.persistentTranscript + ' ' + currentSessionTranscript).trim());
            };

            this.recognition.onerror = (event) => {
                console.error("Speech Recognition Error", event.error);
                if (onError) onError(event.error);
            };

            this.recognition.onend = () => {
                // Save finalized session data before a potential restart
                this.persistentTranscript += ' ' + currentSessionTranscript;
                currentSessionTranscript = '';

                // If it was still supposed to be recording but stopped (e.g. silence timeout), restart
                if (this.isRecording) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        this.isRecording = false;
                        if (onEnd) onEnd();
                    }
                } else {
                    this.isRecording = false;
                    if (onEnd) onEnd();
                }
            };

            this.recognition.start();
            this.isRecording = true;
        } catch (e) {
            console.error(e);
            this.isRecording = false;
            if (onError) onError(e.message);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.isRecording = false;
            this.recognition.stop();
        }
    }

    clearTranscript() {
        this.persistentTranscript = '';
    }
}

window.SpeechController = SpeechController;
