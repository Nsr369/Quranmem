# Quran Mem - Juz 30

Quran Mem is a Progressive Web Application (PWA) designed to help users memorize and test their knowledge of Juz 30 of the Quran. It provides an interactive interface for reading, listening, and reciting ayahs with real-time feedback.

## Features

### 1. Surah Navigation
- **Juz 30 Grid**: The home screen displays a grid of all Surahs in Juz 30.
- **Easy Selection**: Users can click on a Surah to start learning or practicing.

### 2. Interactive Audio Player
- **Ayah-by-Ayah Playback**: Users can listen to specific ayahs or the entire Surah.
- **Word Highlight**: (If implemented in app.js) Highlights words as they are spoken.

### 3. Recitation & Test Modes
- **Recite Mode**: Uses the Web Speech API to listen to the user's recitation and provide feedback.
- **Test Mode**: Challenges the user to recite from memory and scores their accuracy.

### 4. Translation & Display
- **Translation Toggle**: Users can view translations of the text.
- **Font Controls**: Increase or decrease font size for better readability.

### 5. Progress Tracking
- **Dashboard**: Tracks the number of ayahs memorized and average accuracy.
- **Recent Tests**: Displays a history of recent test scores.

### 6. PWA Support
- **Offline Ready**: Works offline via Service Worker.
- **Installable**: Can be installed on the home screen of mobile or desktop devices.

## File Structure

- `index.html`: Main structure of the app, containing the UI containers for screens.
- `css/styles.css`: Custom styling for the application (not viewed in detail).
- `js/`:
  - `app.js`: Main application controller managing screen states, UI updates, and interactions.
  - `audio.js`: Handles audio elements and playback controls.
  - `speech.js`: Manages speech recognition for testing and practice.
  - `storage.js`: Handles local storage for saving progress and user settings.
  - `data/juz30.js`: Data source for Juz 30 content.
- `sw.js`: Service worker for offline capability and caching.
- `manifest.json`: Configuration for PWA installation.

## Tech Stack

- **HTML5** & **CSS3**
- **JavaScript** (Vanilla)
- **Web Speech API** (SpeechRecognition)
- **Web Audio API**
