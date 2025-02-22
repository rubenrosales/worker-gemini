// Cloudflare Worker code

// Import necessary modules (if any) - check the documentation for your LLM SDK and Cloudflare's Fetch API

// Define your Gemini API key and other configurations
const GEMINI_API_KEY = "<YOUR_GEMINI_API_KEY>"; // Replace with your actual API key
const MODEL_NAME = "models/gemini-2.0-flash"; // Or your desired model
const MAX_WAIT_TIME = 120; // seconds (2 minutes) for video activation
const WAIT_INTERVAL = 5;  // seconds between checks
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/files"; // Adjust if necessary

// Dynamic prompt function (same as in Python)
function dynamic_game_prompt_template(game_name, focus_on = null) {
  const focus_text = focus_on
    ? `
### **Special Focus: ${focus_on.capitalize()}**
- Pay particular attention to **${focus_on}** when analyzing the gameplay.
- Identify **mistakes, missed opportunities, and better alternatives** specifically related to ${focus_on}.
- Ensure the breakdown prioritizes improvements in ${focus_on} over other areas.
`
    : "";

  return `
You are an expert video game coach specializing in analyzing gameplay for ${game_name}.
Your task is to analyze a gameplay video and provide **a comprehensive, mistake-focused breakdown** based on the game's mechanics, strategies, and execution.\n\n

### **Step 1: Identify Key Focus Areas for Analysis**
- Before analyzing the video, list at least **6-8 key factors** that influence success in ${game_name}.
- These could include mechanics, strategy, decision-making, positioning, adaptability, execution, etc.
- Weigh their importance before selecting the **4-5 most critical areas** for identifying mistakes.\n\n

### **Step 2: Extract and List All Mistakes & Better Alternatives**
Provide an exhaustive breakdown of **all major mistakes** made by the player, along with better choices they could have made.
- Each mistake must be accompanied by a **timestamp** and a specific explanation of why it was incorrect.
- Provide **a clearly superior alternative action** with a rationale for why it would have been better.\n\n

${focus_text}

### **Output Format:**
Return the analysis strictly in the following JSON format:
\`\`\`json
{
  "game": "${game_name}",
  "key_focus_areas": [
    "Factor 1",
    "Factor 2",
    "Factor 3",
    "Factor 4"
  ],
  "mistakes": [
    {
      "timestamp": "00:00:00",
      "description": "Brief mistake description.",
      "why_incorrect": "Explanation of why this mistake is bad.",
      "better_alternative": "What should have been done instead.",
      "expected_benefit": "Why the alternative is superior."
    }
  ],
  "repeated_errors": [
    {
      "pattern": "Description of recurring mistake.",
      "occurrences": ["00:01:30", "00:04:15"],
      "fix": "Advice on how to correct this mistake."
    }
  ],
  "missed_opportunities": [
    {
      "timestamp": "00:02:45",
      "missed_action": "What could have been done instead.",
      "expected_outcome": "Benefit of the missed opportunity."
    }
  ]
}
\`\`\`\n\n

### **Important Instructions:**
- **Only return JSON output**—do not include any additional text.
- Focus exclusively on **mistakes, missed opportunities, and better alternatives.**
- Do **not** include strengths or positive feedback.
- Always include timestamps when referring to gameplay moments.
- Ensure all explanations are specific, structured, and **actionable**.
- Provide alternatives in a way that makes it clear **how the player should adjust their playstyle.**
- Do not include unnecessary conversational elements—only return the structured JSON output.
`;
}

// Function to extract JSON from the response
function extractJson(response) {
  const match = response.match(/\{[\s\S]*?\}/); // Matches JSON including whitespace and newlines
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      throw new Error("Invalid JSON in the response");
    }
  } else {
    throw new Error("No valid JSON found");
  }
}


// Function to format the analysis into human-readable text (same as your Python version).
function formatAnalysis(jsonData) {
    let output = `Game: ${jsonData.game}\n\n`;
    output += "Key Focus Areas:\n";
    for (const area of jsonData.key_focus_areas) {
        output += `- ${area}\n`;
    }

    output += "\nMistakes:\n";
    for (const mistake of jsonData.mistakes) {
        output += `  Timestamp: ${mistake.timestamp}\n`;
        output += `  Description: ${mistake.description}\n`;
        output += `  Why Incorrect: ${mistake.why_incorrect}\n`;
        output += `  Better Alternative: ${mistake.better_alternative}\n`;
        output += `  Expected Benefit: ${mistake.expected_benefit}\n`;
        output += "\n";
    }

    output += "Repeated Errors:\n";
    for (const error of jsonData.repeated_errors) {
        output += `  Pattern: ${error.pattern}\n`;
        output += `  Occurrences: ${error.occurrences.join(', ')}\n`;
        output += `  Fix: ${error.fix}\n`;
        output += "\n";
    }

    output += "Missed Opportunities:\n";
    for (const opportunity of jsonData.missed_opportunities) {
        output += `  Timestamp: ${opportunity.timestamp}\n`;
        output += `  Missed Action: ${opportunity.missed_action}\n`;
        output += `  Expected Outcome: ${opportunity.expected_outcome}\n`;
        output += "\n";
    }

    return output;
}


// Cloudflare Worker's main event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get('video');
    const gameName = formData.get('gameName'); // Get game name from form data
    const focusOn = formData.get('focusOn') || null; // Get optional focus area

    if (!videoFile) {
      return new Response('No video file provided', { status: 400 });
    }

    if (!gameName) {
      return new Response('No game name provided', { status: 400 });
    }

    // Upload the video to Gemini
    const videoFileResponse = await uploadVideo(videoFile);
    if (!videoFileResponse.ok) {
      console.error("Video upload failed:", videoFileResponse.status, await videoFileResponse.text());
      return new Response('Video upload failed', { status: 500 });
    }

    const videoUploadResult = await videoFileResponse.json();
    const videoFileName = videoUploadResult.name;

    // Wait for the video to become active.
    const videoFileUri = await waitForFileActivation(videoFileName);
    if (!videoFileUri) {
      return new Response('Video activation timed out', { status: 500 });
    }

    // Generate the dynamic prompt
    const prompt = dynamic_game_prompt_template(gameName, focusOn);

    // Analyze the video using Gemini
    const analysisResult = await analyzeVideo(videoFileUri, prompt);

    // Extract JSON from the analysis result
    const jsonData = extractJson(analysisResult);

    // Format the analysis for human readability
    const formattedAnalysis = formatAnalysis(jsonData);

    // Return the formatted analysis
    return new Response(formattedAnalysis, {
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}

// --- Gemini Interaction Functions ---

async function uploadVideo(videoFile) {
  const formData = new FormData();
  formData.append('file', videoFile);

  return fetch(`${API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    body: formData,
  });
}

async function waitForFileActivation(fileName) {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_TIME * 1000) { // Convert to milliseconds
        const fileStatus = await getFileStatus(fileName);
        if (fileStatus.state === "ACTIVE") {
            console.log(`File ${fileName} is now ACTIVE.`);
            return fileStatus.uri;
        }

        await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL * 1000)); // Convert to milliseconds
        console.log(`Waiting... ${Math.round((Date.now() - startTime) / 1000)}s elapsed`);
    }

    console.error(`File ${fileName} did not become ACTIVE within ${MAX_WAIT_TIME}s.`);
    return null;
}

async function getFileStatus(fileName) {
  const response = await fetch(`${API_ENDPOINT}/${fileName}?key=${GEMINI_API_KEY}`);
    if (!response.ok) {
        console.error(`Error getting file status for ${fileName}:`, response.status, await response.text());
        throw new Error(`Failed to get file status: ${response.status}`);
    }

    return await response.json();
}



async function analyzeVideo(videoFileUri, prompt) {
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            file_data: {
              file_uri: videoFileUri,
              mime_type: "video/*" // Adjust if you know the specific MIME type
            }
          }
        ]
      }
    ],
    generation_config: { // added timeout
      timeout: "600s"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });


  if (!response.ok) {
    console.error("Gemini API Error:", response.status, await response.text());
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
  } else {
      console.error("Unexpected Gemini API response:", data);
      throw new Error("Unexpected Gemini API response format");
  }
}