// Function to show the Bootstrap modal for username input
function showNameModal() {
    $('#nameModal').modal('show');
}

// Check if name and userID are stored in local storage
let name = localStorage.getItem('name');
let userID = localStorage.getItem('userID');

// If not stored, show the modal to get user's name
if (!name || !userID) showNameModal();

// Handle submission of the name form in the modal
$('#nameForm').submit(function (event) {
    event.preventDefault(); // Prevent default form submission

    // Get name from input and generate a unique userID
    name = $('#nameInput').val();
    userID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Store name and userID in local storage
    localStorage.setItem('name', name);
    localStorage.setItem('userID', userID);

    // Send the data to the server using AJAX
    $.ajax({
        type: 'POST',
        url: 'api.php?action=setuser',
        data: { name, userID },
        success: function (data) {
            $('#nameModal').modal('hide'); // Close the modal
        },
        error: function (error) {
            console.error('Error:', error); // Log any errors
        }
    });
});

// Speech recognition setup
const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.continuous = false; // Recognize single utterances
recognition.lang = 'en-US'; // Set recognition language

// Get references to HTML elements
const searchBar = document.querySelector('.search-bar');
const microphoneIcon = document.getElementById('microphone-icon');
const listeningIndicator = document.querySelector('.listening-indicator');

// Function to start speech recognition
function startSpeechRecognition() {
    recognition.start();
    microphoneIcon.src = 'img/mic-active.png'; // Change icon to active state
    listeningIndicator.textContent = 'Listening...'; // Show listening indicator
}

// Handle speech recognition results
recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript; // Get transcribed text
    searchBar.value = transcript; // Set the text in the search bar

    const userID = localStorage.getItem('userID');
    const audioBlob = event.results[0][0].audio; // Get audio blob (if available)

    // Prepare data to send to the server
    const formData = new FormData();
    formData.append('transcript', transcript);
    formData.append('userID', userID);
    if (audioBlob) formData.append('audio', audioBlob, 'recording.wav');

    // Send the data to the server using AJAX
    $.ajax({
        type: 'POST',
        url: 'api.php?action=addtranscript',
        data: formData,
        processData: false, // Important for FormData
        contentType: false, // Important for FormData
        success: function (data) {
            console.log(data);
        },
        error: function (error) {
            console.error('Error:', error); // Log any errors
        }
    });

    resetMicrophone(); // Reset microphone icon and indicator
};

// Handle speech recognition errors and end
recognition.onerror = function (event) {
    console.error('Speech recognition error:', event.error);
    resetMicrophone();
};

recognition.onend = resetMicrophone;

// Function to reset microphone icon and indicator
function resetMicrophone() {
    microphoneIcon.src = 'img/mic.png';
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
        url: 'api.php?action=gettranscripts&userID=' + userID,
        success: displayTranscripts, // Call function to display transcripts
        error: function (error) {
            console.error('Error fetching transcripts:', error);
        }
    });
});

// Function to display the transcripts 
function displayTranscripts(transcripts) {
    $('#transcriptsContainer').empty(); // Clear previous transcripts

    // Add each transcript to the container
    for (const transcript of transcripts) {
        const transcriptElement = $('<div>').text(transcript.original_text);
        $('#transcriptsContainer').append(transcriptElement);
    }
}


// Add event listener to the "View Word Frequency" button
$('#viewWordFrequencyButton').click(function () {
    const userID = localStorage.getItem('userID');

    $.ajax({
        type: 'GET',
        url: 'api.php?action=getwordfrequency&userID=' + userID,
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

    // Display user's word frequency
    for (const word in frequencyData.user) {
        const row = $('<tr>');
        row.append($('<td>').text(word));
        row.append($('<td>').text(frequencyData.user[word]));
        userTableBody.append(row);
    }

    // Display all users' word frequency
    for (const word in frequencyData.all_users) {
        const row = $('<tr>');
        row.append($('<td>').text(word));
        row.append($('<td>').text(frequencyData.all_users[word]));
        allUsersTableBody.append(row);
    }

    // Show the modal or container where the tables are displayed
    $('#wordFrequencyModal').modal('show'); // Or use your preferred method to display the data
}


// Add event listener to the "View Similar Users" button 
$('#viewSimilarUsersButton').click(function () {
    const userID = localStorage.getItem('userID');

    $.ajax({
        type: 'GET',
        url: 'api.php?action=getsimilarusers&userID=' + userID,
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