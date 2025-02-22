
# Placeholder environment variables.  Replace these with your actual bindings.
API_KEY = os.env.get("API_KEY")
MODEL = os.env.get("MODEL")

PROCESSED_VIDEOS_KV = None  # Replace with your KV namespace object
BUCKET = None  # Replace with your R2 bucket object if using

import os
import time
import json
import re
import logging
import google.generativeai as genai
# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# API Key
# API_KEY = userdata.get('GOOGLE_API_KEY')
genai.configure(api_key=API_KEY)


# Get already uploaded files from Gemini
def get_uploaded_files():
    try:
        return {file.display_name: file for file in genai.list_files()}
    except Exception as e:
        logging.error(f"Error retrieving uploaded files: {e}")
        return {}

# Upload new videos and wait for activation
def upload_video(file_path):
    logging.info(f"Uploading {file_path}...")
    video_file = genai.upload_file(path=file_path)
    logging.info(f"Uploaded: {video_file.uri}, waiting for activation...")

    # Wait for file to be in ACTIVE state
    max_wait_time = 120  # 2 minutes
    wait_interval = 5
    elapsed_time = 0

    while elapsed_time < max_wait_time:
        video_status = genai.get_file(video_file.name)  # Check file status
        if video_status.state == "ACTIVE":
            logging.info(f"File {file_path} is now ACTIVE.")
            return video_file
        time.sleep(wait_interval)
        elapsed_time += wait_interval
        logging.info(f"Waiting... {elapsed_time}s elapsed")

    logging.error(f"File {file_path} did not become ACTIVE within {max_wait_time}s.")
    return None

# Generate LLM request
def analyze_video(video_file, prompt):
    logging.info(f"Sending {video_file.display_name} for analysis...")
    model = genai.GenerativeModel(model_name=MODEL)
    response = model.generate_content([prompt, video_file], request_options={"timeout": 600})
    return response.text

# Extract JSON from response
def extract_json(response):
    match = re.search(r'\{.*\}', response, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No valid JSON found")

def format_analysis(json_data):
    """Formats the JSON data into a human-readable string.

    Args:
        json_data (dict): The JSON data representing the game analysis.

    Returns:
        str: A formatted string for user readability.
    """

    output = f"Game: {json_data['game']}\n\n"
    output += "Key Focus Areas:\n"
    for area in json_data['key_focus_areas']:
        output += f"- {area}\n"

    output += "\nMistakes:\n"
    for mistake in json_data['mistakes']:
        output += f"  Timestamp: {mistake['timestamp']}\n"
        output += f"  Description: {mistake['description']}\n"
        output += f"  Why Incorrect: {mistake['why_incorrect']}\n"
        output += f"  Better Alternative: {mistake['better_alternative']}\n"
        output += f"  Expected Benefit: {mistake['expected_benefit']}\n"
        output += "\n"

    output += "Repeated Errors:\n"
    for error in json_data['repeated_errors']:
        output += f"  Pattern: {error['pattern']}\n"
        output += f"  Occurrences: {', '.join(error['occurrences'])}\n"
        output += f"  Fix: {error['fix']}\n"
        output += "\n"

    output += "Missed Opportunities:\n"
    for opportunity in json_data['missed_opportunities']:
        output += f"  Timestamp: {opportunity['timestamp']}\n"
        output += f"  Missed Action: {opportunity['missed_action']}\n"
        output += f"  Expected Outcome: {opportunity['expected_outcome']}\n"
        output += "\n"

    return output
# Dynamic prompt
def dynamic_game_prompt_template(game_name: str, focus_on: str = None) -> str:
    """Generates a dynamic game-specific prompt where the LLM determines key mistakes and better alternatives,
       with an optional focus area for more specific feedback."""

    focus_text = (
        f"\n### **Special Focus: {focus_on.capitalize()}**\n"
        f"- Pay particular attention to **{focus_on}** when analyzing the gameplay.\n"
        f"- Identify **mistakes, missed opportunities, and better alternatives** specifically related to {focus_on}.\n"
        f"- Ensure the breakdown prioritizes improvements in {focus_on} over other areas.\n"
        if focus_on else ""
    )

    return (
        f"You are an expert video game coach specializing in analyzing gameplay for {game_name}.\n"
        f"Your task is to analyze a gameplay video and provide **a comprehensive, mistake-focused breakdown** based on the game's mechanics, strategies, and execution.\n\n"

        f"### **Step 1: Identify Key Focus Areas for Analysis**\n"
        f"- Before analyzing the video, list at least **6-8 key factors** that influence success in {game_name}.\n"
        f"- These could include mechanics, strategy, decision-making, positioning, adaptability, execution, etc.\n"
        f"- Weigh their importance before selecting the **4-5 most critical areas** for identifying mistakes.\n\n"

        f"### **Step 2: Extract and List All Mistakes & Better Alternatives**\n"
        f"Provide an exhaustive breakdown of **all major mistakes** made by the player, along with better choices they could have made.\n"
        f"- Each mistake must be accompanied by a **timestamp** and a specific explanation of why it was incorrect.\n"
        f"- Provide **a clearly superior alternative action** with a rationale for why it would have been better.\n\n"
        
        + focus_text +

        f"### **Output Format:**\n"
        f"Return the analysis strictly in the following JSON format:\n"
        f"```json\n"
        f"{{\n"
        f"  \"game\": \"{game_name}\",\n"
        f"  \"key_focus_areas\": [\n"
        f"    \"Factor 1\",\n"
        f"    \"Factor 2\",\n"
        f"    \"Factor 3\",\n"
        f"    \"Factor 4\"\n"
        f"  ],\n"
        f"  \"mistakes\": [\n"
        f"    {{\n"
        f"      \"timestamp\": \"00:00:00\",\n"
        f"      \"description\": \"Brief mistake description.\",\n"
        f"      \"why_incorrect\": \"Explanation of why this mistake is bad.\",\n"
        f"      \"better_alternative\": \"What should have been done instead.\",\n"
        f"      \"expected_benefit\": \"Why the alternative is superior.\"\n"
        f"    }}\n"
        f"  ],\n"
        f"  \"repeated_errors\": [\n"
        f"    {{\n"
        f"      \"pattern\": \"Description of recurring mistake.\",\n"
        f"      \"occurrences\": [\"00:01:30\", \"00:04:15\"],\n"
        f"      \"fix\": \"Advice on how to correct this mistake.\"\n"
        f"    }}\n"
        f"  ],\n"
        f"  \"missed_opportunities\": [\n"
        f"    {{\n"
        f"      \"timestamp\": \"00:02:45\",\n"
        f"      \"missed_action\": \"What could have been done instead.\",\n"
        f"      \"expected_outcome\": \"Benefit of the missed opportunity.\"\n"
        f"    }}\n"
        f"  ]\n"
        f"}}\n"
        f"```\n\n"

        f"### **Important Instructions:**\n"
        f"- **Only return JSON output**—do not include any additional text.\n"
        f"- Focus exclusively on **mistakes, missed opportunities, and better alternatives.**\n"
        f"- Do **not** include strengths or positive feedback.\n"
        f"- Always include timestamps when referring to gameplay moments.\n"
        f"- Ensure all explanations are specific, structured, and **actionable**.\n"
        f"- Provide alternatives in a way that makes it clear **how the player should adjust their playstyle.**\n"
        f"- Do not include unnecessary conversational elements—only return the structured JSON output."
    )


async def store_analysis(video_file_name, analysis_result):
    """Stores the video analysis result in the KV store."""
    try:
        await ANALYSES_KV.put(video_file_name, json.dumps(analysis_result))
        logging.info(f"Analysis stored for video: {video_file_name}")
        return True
    except Exception as e:
        logging.error(f"Error storing analysis: {e}")
        return False

async def retrieve_analysis(video_file_name):
    """Retrieves the video analysis result from the KV store."""
    try:
        analysis_json = await ANALYSES_KV.get(video_file_name)
        if analysis_json:
            return json.loads(analysis_json)
        else:
            return None
    except Exception as e:
        logging.error(f"Error retrieving analysis: {e}")
        return None

def process_new_video(video_path):
    video_file = upload_video(video_path)
    if video_file is None:
        return None, "Video upload failed."

    response_text = analyze_video(video_file, dynamic_game_prompt_template("EA FC 24"))
    try:
        json_data = extract_json(response_text)
        formatted_analysis = format_analysis(json_data)  #Formatted analysis not saved
        return json_data, formatted_analysis #Returns json data
    except Exception as e:
        logging.error(f"Error extracting JSON: {e}")
        return None, "Analysis failed: Could not extract JSON."

async def upload_video_to_r2(request, video_file_name):
    """Uploads the video file from the request to Cloudflare R2."""
    try:
        # Read the video file from the request body
        video_data = await request.arrayBuffer()
        # Upload the video to R2
        await BUCKET.put(video_file_name, video_data)
        return video_file_name # Return the file name
    except Exception as e:
        logging.error(f"Error uploading video to R2: {e}")
        return None # Return None if the upload fails
def generate_html(analyses):
    """Generates an HTML page displaying the video analyses."""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Video Analyses</title>
        <style>
            body { font-family: sans-serif; }
            .analysis { border: 1px solid #ccc; margin-bottom: 10px; padding: 10px; }
        </style>
    </head>
    <body>
        <h1>Video Analyses</h1>
    """

    for video_name, analysis in analyses.items():
        html_content += f"""
        <div class="analysis">
            <h2>Video: {video_name}</h2>
            <pre>{analysis}</pre>
        </div>
        """

    html_content += """
    </body>
    </html>
    """
    return html_content

async def on_fetch(request):
    """Handles incoming requests to the Cloudflare Worker."""
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    try:
        if request.method == "POST":
            # 1. Parse the video file from the request
            content_type = request.headers.get("Content-Type")
            if not content_type or not content_type.startswith("video/"):
                return Response.json({"error": "Invalid Content-Type. Expected video/*"}, status=400)

            # Generate a unique file name (e.g., using timestamp)
            video_file_name = f"video_{int(time.time())}.mp4"

            # 2. Store the video file
            if BUCKET:
                uploaded_video_file_name = await upload_video_to_r2(request, video_file_name) # Store in r2 bucket
                if uploaded_video_file_name is None:
                    return Response.json({"error": "Video upload failed to R2."}, status=500)
            else:
                # Read the video data from the request
                video_data = await request.arrayBuffer()
                # Save the video to a local file (not recommended for production, but works for testing)
                file_path = f"/tmp/{video_file_name}"
                with open(file_path, 'wb') as f:
                    f.write(bytes(video_data))  # Write as bytes
                uploaded_video_file_name = file_path

            # 3. Process the video with Gemini
            analysis_json, formatted_analysis = process_new_video(uploaded_video_file_name)

            if analysis_json is None:
                return Response.json({"error": formatted_analysis}, status=500) #Use the message returned from process_new_video

            # 4. Store the analysis
            if ANALYSES_KV: #Check if analyses kv is set
                if not await store_analysis(video_file_name, analysis_json):
                    return Response.json({"error": "Failed to store analysis."}, status=500) #Alert if could not store video

            # 5. Return the analysis result (or redirect to the HTML page)
             return Response.json({"message": "Video uploaded and analysis stored", "video_name": video_file_name}) #Returning message to frontend to know the videoname

        elif request.method == "GET":
            # Serve the HTML page with video analyses
            all_analyses = {}
            if ANALYSES_KV: #If analises kv is set get all data

                # Iterate over all keys in the KV store.  This will be slow if you have many videos.
                # A better approach would be to have a separate "index" key that lists all video names.
                # Unfortunately, Cloudflare Workers KV does not have list() functionality.  You need to simulate
                # list() via something like a counter that you increment when you store a video.

                # This is a VERY inefficient way to list all keys, but it's the only way possible without
                # simulating the listing.
                keys = []
                cursor = None
                while True:
                    list_result = await ANALYSES_KV.list(cursor=cursor)
                    keys.extend(list_result.keys)
                    if list_result.cursor:
                        cursor = list_result.cursor
                    else:
                        break #End itteration

                for key in keys: #For each key saved in the analyises
                    analysis = await retrieve_analysis(key) #Get analysis in json format
                    if analysis: #Check if not null
                        formatted_analysis = format_analysis(analysis) #Format in text
                        all_analyses[key] = formatted_analysis #Add to the analyses to serve


            html_content = generate_html(all_analyses)
            return Response(html_content, headers={"Content-Type": "text/html;charset=UTF-8"})

        else:
            return Response.json({"message": "Send a POST request with a video file to analyze, or a GET request to view the analysis results."}, status=400)

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return Response.json({"error": str(e)}, status=500)


# Add the event listener
def add_event_listener(event, callback):
    import js
    js.addEventListener(event, callback)


add_event_listener('fetch', on_fetch)