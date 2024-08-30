**Project Title: Voice Analyzer**

**Project Overview:**

The Voice Analyzer application is a web-based tool designed to capture, process, and provide valuable insights into user speech patterns. It leverages the Web Speech API to enable real-time speech input and transcription directly within the browser for interactive user experience. 

**Key Features & Implementation:**

1. **Real-time Speech Recognition:**
   * Utilizes the Web Speech API (`webkitSpeechRecognition` or `SpeechRecognition`) to capture user speech input via the browser's microphone. 
   * Sets recognition language to 'en-US'..
   * Provides visual feedback to the user during recognition (active microphone icon, "Listening..." indicator).

2. **Transcription & Translation:**
   * Converts recognized speech into text (transcription) using the API's built-in capabilities.

3. **Transcription History & Storage:**
   * Stores all transcriptions securely in a MySQL database for future reference and analysis.
   * Presents users with a history of their transcriptions within the application.

4. **Word Frequency Analysis:**
   * Processes transcriptions to calculate the frequency of individual words used by each user.
   * Displays a table of the most frequently used words for the current user.
   * Compares the user's word frequency against the aggregate frequency across all users, highlighting individual speech patterns and trends.

5. **Unique Phrase Identification:**
   * Showcases the top 3 unique phrases spoken by each user, providing insights into their individual linguistic style.

6. **Speech Similarity Detection (Future Implementation):**
   * Envisions displaying a list of the most similar users via similarity score.

**Technology Stack:**

* **Frontend:** HTML, CSS, JavaScript (including the Web Speech API for core speech recognition functionality)
* **Backend:** PHP (to handle API requests, data processing, and database interactions)
* **Database:** MySQL (for secure and efficient storage of user data and transcriptions)

