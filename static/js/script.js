// Function to display the Bootstrap modal for username input
function showNameModal() {
    $('#nameModal').modal('show');
}

// Check if userName and userID are stored in local storage
let userName = localStorage.getItem('userName');
let userID = localStorage.getItem('userID');

// If not stored, show the modal to get the user's name
if (!userName || !userID) {
    showNameModal();
}

// Handle submission of the name form in the modal
$('#nameForm').submit(function (event) {
    event.preventDefault(); // Prevent default form submission

    // Get userName from input and generate a unique userID
    userName = $('#nameInput').val();
    userID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Store userName and userID in local storage
    localStorage.setItem('userName', userName); // Updated key
    localStorage.setItem('userID', userID);

    // Send the data to the server using AJAX
    $.ajax({
        type: 'POST',
        url: '/setuser',
        data: { userName, userID }, // Updated data
        success: function (data) {
            console.log(data); // Log the server response (optional)
            $('#nameModal').modal('hide'); // Close the modal
        },
        error: function (error) {
            console.error('Error:', error); // Log any errors
        }
    });
});

// Speech recognition setup
const recognition = new webkitSpeechRecognition();
recognition.continuous = false; // Recognize single utterances
// Automatic language detection
recognition.lang = navigator.language || navigator.userLanguage;

function updateRecognitionLang(selectedLang) {
    if (recognition) {
        recognition.lang = selectedLang;
    }
}



// Get references to HTML elements
const searchBar = document.querySelector('.search-bar');
const microphoneIcon = document.getElementById('microphone-icon');
const listeningIndicator = document.querySelector('.listening-indicator');

// Function to start speech recognition
function startSpeechRecognition() {
    recognition.start();
    microphoneIcon.src = '/static/img/mic-active.png'; // Change icon to active state
    listeningIndicator.textContent = 'Listening...'; // Show listening indicator
}

async function translateText(textToTranslate) {
    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: textToTranslate
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return (data.translated_text);
    } catch (error) {
        console.error("Error during translation:", error);
    }
}

// Handle speech recognition results
recognition.onresult = async function (event) {
    const transcript = event.results[0][0].transcript;
    searchBar.value = transcript;

    const userID = localStorage.getItem('userID');

    const formData = new FormData();
    formData.append('transcript', transcript);
    formData.append('userID', userID);
    formData.append('ln', recognition.lang);

    if (!recognition.lang.startsWith('en')) {
        // Wait for the translation to complete before proceeding
        let translation = await translateText(transcript);
        formData.append('translatedText', translation); // Append the translated text
        console.log(translation);
    }

    $.ajax({
        type: 'POST',
        url: '/addtranscript',
        data: formData,
        processData: false,
        contentType: false,
        success: function (data) {
            console.log(data);
        },
        error: function (error) {
            console.error('Error:', error);
        }
    });

    resetMicrophone();
};

// Handle speech recognition errors and end
recognition.onerror = function (event) {
    console.error('Speech recognition error:', event.error);
    resetMicrophone();
};

recognition.onend = resetMicrophone;

// Function to reset microphone icon and indicator
function resetMicrophone() {
    microphoneIcon.src = '/static/img/mic.png';
    listeningIndicator.textContent = '';
}

// Add event listener to start speech recognition on microphone icon click
microphoneIcon.addEventListener('click', startSpeechRecognition);

// Add event listener to the "View Transcripts" button
$('#viewTranscriptsButton').click(function () {
    const userID = localStorage.getItem('userID');

    // Fetch transcripts from the server using AJAX
    $.ajax({
        type: 'GET',
        url: '/gettranscripts?userID=' + userID,
        success: displayTranscripts, // Call function to display transcripts
        error: function (error) {
            console.error('Error fetching transcripts:', error);
        }
    });
});

// Function to display the transcripts 
function displayTranscripts(transcripts) {

    $('#transcriptsContainer').empty();

    for (const transcript of transcripts) {
        const transcriptElement = $('<div>').text(transcript.transcript);

        if (transcript.original !== transcript.transcript) {
            // Create the image element
            const infoIcon = $('<img>').attr({
                src: '/static/img/info.png',
                alt: 'Original Text Available' // For accessibility
            });
            // console.log(transcripts)
            // Append the image to the transcript element
            transcriptElement.append(infoIcon);

            // Set the original text as the tooltip for the image
            infoIcon.attr('title', transcript.original);
        }

        $('#transcriptsContainer').append(transcriptElement);
    }
}

// Add event listener to the "View Word Frequency" button
$('#viewWordFrequencyButton').click(function () {
    const userID = localStorage.getItem('userID');

    $.ajax({
        type: 'GET',
        url: '/getwordfrequency?userID=' + userID,
        dataType: 'json',
        success: function (data) {
            displayWordFrequency(data);
        },
        error: function (error) {
            console.error('Error fetching word frequency data:', error);
            // Handle the error gracefully (e.g., display an error message to the user)
        }
    });
});

// Function to display the word frequency data
function displayWordFrequency(frequencyData) {
    const userTableBody = $('#userFrequencyTable tbody');
    const allUsersTableBody = $('#allUsersFrequencyTable tbody');

    // Clear previous data
    userTableBody.empty();
    allUsersTableBody.empty();

    // Display top phrases
    const topPhrasesList = $('#topPhrasesList');
    topPhrasesList.empty();

    for (const phrase in frequencyData.top_phrases) {
        const listItem = $('<li>').text(phrase + ' (Frequency: ' + frequencyData.top_phrases[phrase] + ')');
        topPhrasesList.append(listItem);
    }


    // Parse both user and all_users data, which are stringified JSON arrays
    const userFrequencyData = JSON.parse(frequencyData.user);
    const allUsersFrequencyData = JSON.parse(frequencyData.all_users);

    // Display user's word frequency, now iterating over the array
    for (const entry of userFrequencyData) {
        const row = $('<tr>');
        row.append($('<td>').text(entry.word));
        row.append($('<td>').text(entry.frequency));
        userTableBody.append(row);
    }

    // Display all users' word frequency (remains the same)
    for (const entry of allUsersFrequencyData) {
        const row = $('<tr>');
        row.append($('<td>').text(entry.word));
        row.append($('<td>').text(entry.total_frequency));
        allUsersTableBody.append(row);
    }

    // Show the modal or container where the tables are displayed
    $('#wordFrequencyModal').modal('show');
}

// Add event listener to the "View Similar Users" button 
$('#viewSimilarUsersButton').click(function () {
    const userID = localStorage.getItem('userID');

    $.ajax({
        type: 'GET',
        url: '/getsimilarusers?userID=' + userID,
        dataType: 'json',
        success: function (data) {
            displaySimilarUsers(data);
        },
        error: function (error) {
            console.error('Error fetching similar users data:', error);
            // Handle the error gracefully 
        }
    });
});

// Function to display the similar users data 
function displaySimilarUsers(similarUsersData) {
    const similarUsersList = $('#similarUsersList');
    similarUsersList.empty();

    for (const userName in similarUsersData) {
        const similarityScore = similarUsersData[userName];
        const listItem = $('<li>').text(`${userName}: Similarity Score - ${similarityScore}`);
        similarUsersList.append(listItem);
    }

    $('#similarUsersModal').modal('show');
}