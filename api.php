<?php

// Database connection (replace with your actual credentials)
$servername = "localhost";
$username = "username";
$password = "password";
$dbname = "dbname";

$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

function getUserIdFromDatabase($conn, $userID)
{
    // Prepare and execute the query to retrieve the user_id
    $select_user_id_query = "SELECT id FROM users WHERE userid = ?";
    $stmt_select_user_id = $conn->prepare($select_user_id_query);
    $stmt_select_user_id->bind_param("s", $userID);
    $stmt_select_user_id->execute();
    $stmt_select_user_id->bind_result($user_id);
    $stmt_select_user_id->fetch();

    // Close the prepared statement 
    $stmt_select_user_id->close();

    // Handle the case where no matching user is found
    if (!$user_id) {
        ob_end_clean(); // Clear any output buffer
        header('Content-Type: application/json');
        echo json_encode(['error' => 'User not found!']);
        exit; // Stop further execution
    }

    // Return the retrieved user_id
    return $user_id;
}


if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_GET['action'] === 'setuser') {
    $name = $_POST['name'];
    $userID = $_POST['userID'];

    // Check if the user already exists
    $check_query = "SELECT id FROM users WHERE userid = ?";
    $stmt_check = $conn->prepare($check_query);
    $stmt_check->bind_param("s", $userID);
    $stmt_check->execute();
    $stmt_check->store_result();

    if ($stmt_check->num_rows > 0) {
        // User already exists, handle accordingly (e.g., update their name)
        $update_query = "UPDATE users SET name = ? WHERE userid = ?";
        $stmt_update = $conn->prepare($update_query);
        $stmt_update->bind_param("ss", $name, $userID);
        $stmt_update->execute();

        echo "User data updated successfully!";
    } else {
        // New user, insert their data
        $insert_query = "INSERT INTO users (name, userid) VALUES (?, ?)";
        $stmt_insert = $conn->prepare($insert_query);
        $stmt_insert->bind_param("ss", $name, $userID);
        $stmt_insert->execute();

        echo "New user data saved successfully!";
    }

    $stmt_check->close();
    $conn->close();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $_GET['action'] === 'addtranscript') {
    $transcript = $_POST['transcript'];


    // Get user ID using the function
    $user_id = getUserIdFromDatabase($conn, $_POST['userID']);

    // Insert the transcript and user_id into the database
    $insert_query = "INSERT INTO transcriptions (user_id, original_language, original_text, audio) VALUES (?, ?, ?, ?)";
    $stmt_insert = $conn->prepare($insert_query);
    $original_language = "en-US";
    $stmt_insert->bind_param("isss", $user_id, $original_language, $transcript, $uploadPath);
    $stmt_insert->execute();

    echo "Transcript and audio data saved successfully!";

    $conn->close();
}


if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_GET['action'] === 'gettranscripts') {

    // Get user ID using the function
    $user_id = getUserIdFromDatabase($conn, $_GET['userID']);

    // Fetch transcripts for the user
    $select_transcripts_query = "SELECT original_text FROM transcriptions WHERE user_id = ?";
    $stmt_select_transcripts = $conn->prepare($select_transcripts_query);
    $stmt_select_transcripts->bind_param("i", $user_id);
    $stmt_select_transcripts->execute();

    // Get the result set
    $result = $stmt_select_transcripts->get_result();

    // Fetch all rows as an associative array
    $transcripts_array = $result->fetch_all(MYSQLI_ASSOC);

    // Convert the array of arrays to an array of objects
    $transcripts = array_map(function ($row) {
        return (object) $row;
    }, $transcripts_array);

    // Close the statement and result set
    $stmt_select_transcripts->close();
    $result->close();

    // Clear the output buffer (discard any potential errors or unexpected output)
    ob_end_clean();

    // Return the transcripts as JSON
    header('Content-Type: application/json');
    echo json_encode($transcripts);

    $conn->close();
}


if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_GET['action'] === 'getwordfrequency') {

    // Get user ID using the function
    $user_id = getUserIdFromDatabase($conn, $_GET['userID']);

    // Fetch all transcripts for the current user
    $select_user_transcripts_query = "SELECT original_text FROM transcriptions WHERE user_id = ?";
    $stmt_select_user_transcripts = $conn->prepare($select_user_transcripts_query);
    $stmt_select_user_transcripts->bind_param("i", $user_id);
    $stmt_select_user_transcripts->execute();
    $result_user = $stmt_select_user_transcripts->get_result();
    $user_transcripts = $result_user->fetch_all(MYSQLI_ASSOC);

    // Fetch all transcripts for all users
    $select_all_transcripts_query = "SELECT original_text FROM transcriptions";
    $result_all = $conn->query($select_all_transcripts_query);
    $all_transcripts = $result_all->fetch_all(MYSQLI_ASSOC);

    // Calculate word frequencies 
    $user_word_frequency = calculateWordFrequency($user_transcripts);
    $all_users_word_frequency = calculateWordFrequency($all_transcripts);

    // Calculate top 3 unique phrases for the current user
    $top_phrases = calculateTopPhrases($user_transcripts, 3);

    // Prepare the data for the frontend
    $frequencyData = [
        'user' => $user_word_frequency,
        'all_users' => $all_users_word_frequency,
        'top_phrases' => $top_phrases
    ];

    // Close statements and result sets
    $stmt_select_user_transcripts->close();
    $result_user->close();
    $result_all->close();
    $conn->close();

    // Return the word frequency data as JSON
    header('Content-Type: application/json');
    echo json_encode($frequencyData);
}

// Function to calculate word frequency 
function calculateWordFrequency($transcripts, $topCount = 5)
{
    $wordCounts = [];
    foreach ($transcripts as $transcript) {
        $words = preg_split('/\s+/', $transcript['original_text']);
        foreach ($words as $word) {
            $word = strtolower($word);
            if (preg_match('/^[a-zA-Z]+$/', $word)) {
                $wordCounts[$word] = isset($wordCounts[$word]) ? $wordCounts[$word] + 1 : 1;
            }
        }
    }
    arsort($wordCounts);
    return array_slice($wordCounts, 0, $topCount); // Get the top N phrases
}

// Function to calculate top phrases
function calculateTopPhrases($transcripts, $topCount = 3)
{
    $phraseCounts = [];
    foreach ($transcripts as $transcript) {
        $phrases = preg_split('/[.?!]/', $transcript['original_text']); // Split into phrases
        foreach ($phrases as $phrase) {
            $phrase = trim($phrase); // Remove leading/trailing whitespace
            if (!empty($phrase)) {
                $phraseCounts[$phrase] = isset($phraseCounts[$phrase]) ? $phraseCounts[$phrase] + 1 : 1;
            }
        }
    }
    // Sort by frequency in ASCENDING order (lowest frequency first)
    asort($phraseCounts);

    // Filter out phrases with frequency 1 (likely unique)
    $uniquePhrases = array_filter($phraseCounts, function ($count) {
        return $count == 1;
    });

    // If there are less than $topCount unique phrases, return all of them
    if (count($uniquePhrases) <= $topCount) {
        return $uniquePhrases;
    } else {
        // Otherwise, return the first $topCount unique phrases
        return array_slice($uniquePhrases, 0, $topCount);
    }
}


if ($_SERVER['REQUEST_METHOD'] === 'GET' && $_GET['action'] === 'getsimilarusers') {

    // Get user ID using the function
    $user_id = getUserIdFromDatabase($conn, $_GET['userID']);

    // Fetch all transcripts for the current user
    $select_user_transcripts_query = "SELECT original_text FROM transcriptions WHERE user_id = ?";
    $stmt_select_user_transcripts = $conn->prepare($select_user_transcripts_query);
    $stmt_select_user_transcripts->bind_param("i", $user_id);
    $stmt_select_user_transcripts->execute();
    $result_user = $stmt_select_user_transcripts->get_result();
    $user_transcripts = $result_user->fetch_all(MYSQLI_ASSOC);

    // Fetch all transcripts for all other users along with their names
    $select_other_transcripts_query = "SELECT u.name, t.original_text 
                                       FROM transcriptions t
                                       JOIN users u ON t.user_id = u.id
                                       WHERE t.user_id != ?";
    $stmt_select_other_transcripts = $conn->prepare($select_other_transcripts_query);
    $stmt_select_other_transcripts->bind_param("i", $user_id);
    $stmt_select_other_transcripts->execute();
    $result_other = $stmt_select_other_transcripts->get_result();
    $other_user_transcripts = $result_other->fetch_all(MYSQLI_ASSOC);

    // Calculate similarity scores 
    $similarityScores = calculateSimilarity($user_transcripts, $other_user_transcripts);

    // Get the top N most similar users (adjust N as needed)
    $topSimilarUsers = getTopSimilarUsers($similarityScores, 3);

    // Close statements and result sets
    $stmt_select_user_transcripts->close();
    $result_user->close();
    $stmt_select_other_transcripts->close();
    $result_other->close();
    $conn->close();

    // Return the similar users data as JSON
    header('Content-Type: application/json');
    echo json_encode($topSimilarUsers);
}


// Function to calculate similarity scores (using Jaccard Similarity)
function calculateSimilarity($userTranscripts, $otherUserTranscripts)
{
    $similarityScores = [];

    // Combine all of the current user's transcripts into a single string
    $userText = implode(' ', array_column($userTranscripts, 'original_text'));
    $userWords = array_unique(str_word_count($userText, 1));

    foreach ($otherUserTranscripts as $otherTranscript) {
        $otherUserName = $otherTranscript['name'];
        $otherText = $otherTranscript['original_text'];
        $otherWords = array_unique(str_word_count($otherText, 1));

        // Calculate Jaccard similarity
        $intersection = count(array_intersect($userWords, $otherWords));
        $union = count($userWords) + count($otherWords) - $intersection;
        $similarity = $union > 0 ? $intersection / $union : 0;

        $similarityScores[$otherUserName] = $similarity;
    }

    return $similarityScores;
}

// Function to get the top N most similar users
function getTopSimilarUsers($similarityScores, $topCount = 7)
{
    arsort($similarityScores);
    return array_slice($similarityScores, 0, $topCount);
}


?>