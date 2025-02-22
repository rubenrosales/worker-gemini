import requests

# --- Configuration ---
VIDEO_FILE = "test_up.mp4"  # Replace with your video file path
API_ENDPOINT = "https://video_gemini.jcole.workers.dev/"  # Replace with your API endpoint
API_KEY = None#"YOUR_API_KEY"  # Optional API Key

def send_video(video_file, api_endpoint, api_key=None):
    """Reads the entire video file and sends it to the API.

    Args:
        video_file: Path to the video file.
        api_endpoint: URL of the API endpoint.
        api_key: Optional API key.
    """
    try:
        # Read the entire video file into memory as bytes
        with open(video_file, "rb") as f:
            video_data = f.read()

        headers = {"Content-Type": "video/mp4"}  # Or the correct MIME type for your video
        if api_key:
            headers["X-API-Key"] = api_key  # Or whatever header your API expects


        response = requests.post(api_endpoint, data=video_data, headers=headers, verify=False)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)

        print(f"Video sent successfully. Status code: {response.status_code}")
        print(f"Response: {response.text}")  # Useful for debugging API responses

    except FileNotFoundError:
        print(f"Error: Video file not found: {video_file}")
    except requests.exceptions.RequestException as e:
        print(f"Error sending video: {e}")


# --- Main ---
if __name__ == "__main__":
    send_video(VIDEO_FILE, API_ENDPOINT, API_KEY)