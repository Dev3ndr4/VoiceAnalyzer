from flask import Flask, json, request, jsonify, render_template 
import mysql.connector
import re
from transformers import pipeline

app = Flask(__name__)

# Database configuration (replace with your actual credentials)
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'W8T2nYRF4CFFEK8z',
    'database': 'va'
}

# Helper function to get user ID from database
def get_user_id_from_database(conn, user_id):
    cursor = conn.cursor(dictionary=True)  
    query = "SELECT id FROM users WHERE userid = %s"
    cursor.execute(query, (user_id,))
    result = cursor.fetchone()
    cursor.close()
    
    if result:
        return result['id']  
    else:
        return jsonify({'error': 'User not found!'}), 404
    
@app.route('/')
def index():
    return render_template('index.html')

# Set user route
@app.route('/setuser', methods=['POST'])
def set_user():
    name = request.form['userName']
    user_id = request.form['userID']

    cnx = mysql.connector.connect(**db_config)
    cursor = cnx.cursor()

    # Check if user exists
    check_query = "SELECT id FROM users WHERE userid = %s"
    cursor.execute(check_query, (user_id,))

    if cursor.fetchone():
        # User exists, update
        update_query = "UPDATE users SET name = %s WHERE userid = %s"
        cursor.execute(update_query, (name, user_id))
        message = "User data updated successfully!"
    else:
        # New user, insert
        insert_query = "INSERT INTO users (name, userid) VALUES (%s, %s)"
        cursor.execute(insert_query, (name, user_id))
        message = "New user data saved successfully!"

    cnx.commit()
    cursor.close()
    cnx.close()

    return message

# Add transcript route
@app.route('/addtranscript', methods=['POST'])
def add_transcript():
    transcript = request.form['transcript']
    user_id = get_user_id_from_database(mysql.connector.connect(**db_config), request.form['userID'])
    ln = request.form['ln']
        

    if isinstance(user_id, tuple): 
        return user_id

    cnx = mysql.connector.connect(**db_config)
    cursor = cnx.cursor()

    # Check if the language is English
    if ln.startswith('en'):
        # Insert the transcript directly for English
        insert_query = "INSERT INTO transcriptions (user_id, original_language, original_text) VALUES (%s, %s, %s)" 
        cursor.execute(insert_query, (user_id, ln, transcript)) 

        # Calculate word frequencies for the English transcript
        word_counts = calculate_word_frequency([{'original_text': transcript}])

    else:
        translatedText = request.form['translatedText']
        print(translatedText)
        # Insert both original and translated transcripts
        insert_query = "INSERT INTO transcriptions (user_id, original_language, original_text, translated_text) VALUES (%s, %s, %s, %s)" 
        cursor.execute(insert_query, (user_id, ln, transcript, translatedText)) # Use translatedText here

        # Calculate word frequencies for the translated text
        word_counts = calculate_word_frequency([{'original_text': translatedText}]) # Use translatedText here



    # Update word_frequencies table
    for word, frequency in word_counts.items():
        # Check if the word already exists for the user
        check_query = "SELECT frequency FROM word_frequencies WHERE user_id = %s AND word = %s"
        cursor.execute(check_query, (user_id, word))
        existing_frequency = cursor.fetchone()

        if existing_frequency:
            # Update existing frequency
            update_query = "UPDATE word_frequencies SET frequency = %s WHERE user_id = %s AND word = %s"
            cursor.execute(update_query, (existing_frequency[0] + frequency, user_id, word))
        else:
            # Insert new word frequency
            insert_query = "INSERT INTO word_frequencies (user_id, word, frequency) VALUES (%s, %s, %s)"
            cursor.execute(insert_query, (user_id, word, frequency))

    cnx.commit()
    cursor.close()
    cnx.close()

    return "Transcript data saved successfully!"

# Get transcripts route
@app.route('/gettranscripts', methods=['GET'])
def get_transcripts():
    user_id = get_user_id_from_database(mysql.connector.connect(**db_config), request.args.get('userID'))

    if isinstance(user_id, tuple): 
        return user_id

    cnx = mysql.connector.connect(**db_config)
    cursor = cnx.cursor(dictionary=True)

    # Use a CASE statement to conditionally select the appropriate text as the transcript
    select_query = """
    SELECT 
        original_text AS original,
        CASE 
            WHEN original_language LIKE 'en%' 
            THEN original_text 
            ELSE translated_text 
        END AS transcript
    FROM transcriptions 
    WHERE user_id = %s
    """

    cursor.execute(select_query, (user_id,))
    transcripts = cursor.fetchall()

    cursor.close()
    cnx.close()

    return jsonify(transcripts)

# Get word frequency route
@app.route('/getwordfrequency', methods=['GET'])
def get_word_frequency():
    user_id = get_user_id_from_database(mysql.connector.connect(**db_config), request.args.get('userID'))

    if isinstance(user_id, tuple): 
        return user_id

    cnx = mysql.connector.connect(**db_config)
    cursor = cnx.cursor(dictionary=True)

    # Fetch transcripts for the current user
    select_user_transcripts_query = "SELECT COALESCE(translated_text, original_text) AS original_text FROM transcriptions WHERE user_id = %s"
    cursor.execute(select_user_transcripts_query, (user_id,))
    user_transcripts = cursor.fetchall()


    # Calculate word frequencies 
    # Retrieve top 5 word frequencies for the specific user
    query = """
    SELECT word, frequency 
    FROM word_frequencies 
    WHERE user_id = %s 
    ORDER BY frequency DESC
    LIMIT 5;
    """
    cursor.execute(query, (user_id,))
    user_word_frequency = json.dumps(cursor.fetchall())

    # Retrieve top 5 word frequencies across all users
    query = """
    SELECT word, SUM(frequency) as total_frequency 
    FROM word_frequencies 
    GROUP BY word 
    ORDER BY total_frequency DESC
    LIMIT 5;
    """
    cursor.execute(query)
    all_users_word_frequency = json.dumps(cursor.fetchall())

    # Calculate top 3 unique phrases for the current user
    top_phrases = calculate_top_phrases(user_transcripts, 3)

    cursor.close()
    cnx.close()

    # Prepare the data for the frontend
    frequency_data = {
        'user': user_word_frequency,
        'all_users': all_users_word_frequency,
        'top_phrases': top_phrases
    }

    return jsonify(frequency_data)

# Function to calculate word frequency 
def calculate_word_frequency(transcripts):
    word_counts = {}
    for transcript in transcripts:
        words = re.findall(r'\b[a-zA-Z]+\b', transcript['original_text'].lower()) 
        for word in words:
            word_counts[word] = word_counts.get(word, 0) + 1
    sorted_word_counts = dict(sorted(word_counts.items(), key=lambda item: item[1], reverse=True))
    return dict(list(sorted_word_counts.items()))

# Function to calculate top phrases
def calculate_top_phrases(transcripts, top_count=3):
    phrase_counts = {}
    for transcript in transcripts:
        phrases = re.split(r'[.?!]', transcript['original_text']) 
        for phrase in phrases:
            phrase = phrase.strip()
            if phrase:
                phrase_counts[phrase] = phrase_counts.get(phrase, 0) + 1

    # Sort by frequency in ASCENDING order (lowest frequency first)
    sorted_phrase_counts = dict(sorted(phrase_counts.items(), key=lambda item: item[1]))

    # Filter out phrases with frequency 1 (likely unique)
    unique_phrases = {phrase: count for phrase, count in sorted_phrase_counts.items() if count == 1}

    # If there are less than top_count unique phrases, return all of them
    if len(unique_phrases) <= top_count:
        return unique_phrases
    else:
        # Otherwise, return the first top_count unique phrases
        return dict(list(unique_phrases.items())[:top_count])


# Get similar users route
@app.route('/getsimilarusers', methods=['GET'])
def get_similar_users():
    user_id = get_user_id_from_database(mysql.connector.connect(**db_config), request.args.get('userID'))

    if isinstance(user_id, tuple):
        return user_id

    cnx = mysql.connector.connect(**db_config)
    cursor = cnx.cursor(dictionary=True)

    # Fetch all transcripts for the current user
    select_user_transcripts_query = "SELECT COALESCE(translated_text, original_text) AS original_text FROM transcriptions WHERE user_id = %s"
    cursor.execute(select_user_transcripts_query, (user_id,))
    user_transcripts = cursor.fetchall()

    # Fetch all transcripts for all other users along with their names
    select_other_transcripts_query = """
        SELECT u.name, t.original_text 
        FROM transcriptions t
        JOIN users u ON t.user_id = u.id
        WHERE t.user_id != %s
    """
    cursor.execute(select_other_transcripts_query, (user_id,))
    other_user_transcripts = cursor.fetchall()

    # Calculate similarity scores 
    similarity_scores = calculate_similarity(user_transcripts, other_user_transcripts)

    # Get the top N most similar users 
    top_similar_users = get_top_similar_users(similarity_scores, 3)

    cursor.close()
    cnx.close()

    return jsonify(top_similar_users)

# Translation route
@app.route('/translate', methods=['POST'])
def translate_text():
    translator = pipeline("translation", model="Helsinki-NLP/opus-mt-mul-en")
    try:
        data = request.get_json()
        text_to_translate = data['text']

        # Perform translation
        translated_output = translator(text_to_translate, src_lang="auto", tgt_lang='en')

        # Extract the translated text from the output (Hugging Face format)
        translated_text = translated_output[0]['translation_text']

        return jsonify({'translated_text': translated_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function to calculate similarity scores (using Jaccard Similarity)
def calculate_similarity(user_transcripts, other_user_transcripts):
    similarity_scores = {}

    user_text = ' '.join([transcript['original_text'] for transcript in user_transcripts])
    user_words = set(re.findall(r'\b[a-zA-Z]+\b', user_text.lower()))

    for other_transcript in other_user_transcripts:
        other_user_name = other_transcript['name']
        other_text = other_transcript['original_text']
        other_words = set(re.findall(r'\b[a-zA-Z]+\b', other_text.lower()))

        intersection = len(user_words.intersection(other_words))
        union = len(user_words) + len(other_words) - intersection
        similarity = intersection / union if union > 0 else 0

        similarity_scores[other_user_name] = similarity

    return similarity_scores

# Function to get the top N most similar users
def get_top_similar_users(similarity_scores, top_count=3):
    sorted_scores = dict(sorted(similarity_scores.items(), key=lambda item: item[1], reverse=True))
    return dict(list(sorted_scores.items())[:top_count])

if __name__ == '__main__':
    app.run(debug=True)