// Placeholder environment variables. Replace these with your actual bindings.

// Import necessary modules (Cloudflare Workers don't support traditional Node.js modules)
// No need to import 'os', 'time', 'json', 're', 'logging' modules.

// Configure logging (Cloudflare Workers have built-in console.log)
// console.log functions are used instead of the logging module

// API Key (Assumed to be set via environment variable)
// genai.configure(api_key=API_KEY); // Removed because Google AI package is unavailable

// Cloudflare Workers environment does not directly support google-ai-generative-models.
// Thus, all calls that utilize this package will result in errors. The code is included here to provide
// a translation, but it will need to be modified to be executed correctly or alternatively replaced.
// For example, you may need to implement a proxy server to make the Google AI requests, or rely on openAI or other packages
import { GoogleGenerativeAI } from "@google/generative-ai";

// Get already uploaded files from Gemini.
async function get_uploaded_files(genai) {
    console.log("This part of the code will throw an error, since the package is not supported");
    try {
        const files = await genai.list_files();
        const fileMap = {};
        for (const file of files) {
            fileMap[file.display_name] = file;
        }
        return fileMap;
    } catch (e) {
        console.error(`Error retrieving uploaded files: ${e}`);
        return {};
    }
}


// Upload new videos and wait for activation
async function upload_video(file_path, genai, api_key) {
    console.log("This part of the code will throw an error, since the package is not supported");
    console.info(`Uploading ${file_path}...`);
    try {
		
        const fileManager = new GoogleAIFileManager(api_key);

        const uploadResult = await fileManager.uploadFile(
            file_path,
          {
            mimeType: "video/mp4",
            displayName: file_path,
          },
        );
      
      
        // const video_file = await genai.upload_file({ path: file_path });
        console.info(`Uploaded: ${video_file.uri}, waiting for activation...`);
        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === FileState.PROCESSING) {
          process.stdout.write(".");
          // Sleep for 10 seconds
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          // Fetch the file from the API again
          file = await fileManager.getFile(uploadResult.file.name);
        }
      
        if (file.state === FileState.FAILED) {
          throw new Error("Video processing failed.");
        }
      
        // View the response.
        console.log(
          `Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`,
        );

        return uploadResult.file
      
        // // Wait for file to be in ACTIVE state
        // const max_wait_time = 120; // 2 minutes
        // const wait_interval = 5;
        // let elapsed_time = 0;

        // while (elapsed_time < max_wait_time) {
        //     const video_status = await genai.get_file(video_file.name); // Check file status
        //     if (video_status.state === "ACTIVE") {
        //         console.info(`File ${file_path} is now ACTIVE.`);
        //         return video_file;
        //     }
        //     await new Promise(resolve => setTimeout(resolve, wait_interval * 1000)); // Use Promise for delay
        //     elapsed_time += wait_interval;
        //     console.info(`Waiting... ${elapsed_time}s elapsed`);
        // }

        // console.error(`File ${file_path} did not become ACTIVE within ${max_wait_time}s.`);
        return null;
    } catch (error) {
        console.error(`Error during video upload and activation: ${error}`);
        return null;
    }
}


// Generate LLM request
async function analyze_video(video_file, prompt, genai) {
    console.log("This part of the code will throw an error, since the package is not supported");
    console.info(`Sending ${video_file.display_name} for analysis...`);
    try {
        const model = genai.GenerativeModel(model_name = "gemini-1.5-flash");
        const response = await model.generate_content([prompt, video_file], { request_options: { timeout: 600 } });
        return response.text;
    } catch (error) {
        console.error(`Error analyzing video: ${error}`);
        return null;
    }
}


// Extract JSON from response
function extract_json(response) {
    const match = response.match(/\{.*\}/s); // 's' flag for dotAll behavior
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (error) {
            throw new Error(`Invalid JSON format: ${error.message}`); // More specific error message
        }
    }
    throw new Error("No valid JSON found in response.");
}

function format_analysis(json_data) {
    /**
     * Formats the JSON data into a human-readable string.
     *
     * @param {object} json_data - The JSON data representing the game analysis.
     * @returns {string} - A formatted string for user readability.
     */

    let output = `Game: ${json_data.game}\n\n`;
    output += "Key Focus Areas:\n";
    for (const area of json_data.key_focus_areas) {
        output += `- ${area}\n`;
    }

    output += "\nMistakes:\n";
    for (const mistake of json_data.mistakes) {
        output += `  Timestamp: ${mistake.timestamp}\n`;
        output += `  Description: ${mistake.description}\n`;
        output += `  Why Incorrect: ${mistake.why_incorrect}\n`;
        output += `  Better Alternative: ${mistake.better_alternative}\n`;
        output += `  Expected Benefit: ${mistake.expected_benefit}\n`;
        output += "\n";
    }

    output += "Repeated Errors:\n";
    for (const error of json_data.repeated_errors) {
        output += `  Pattern: ${error.pattern}\n`;
        output += `  Occurrences: ${error.occurrences.join(', ')}\n`;
        output += `  Fix: ${error.fix}\n`;
        output += "\n";
    }

    output += "Missed Opportunities:\n";
    for (const opportunity of json_data.missed_opportunities) {
        output += `  Timestamp: ${opportunity.timestamp}\n`;
        output += `  Missed Action: ${opportunity.missed_action}\n`;
        output += `  Expected Outcome: ${opportunity.expected_outcome}\n`;
        output += "\n";
    }

    return output;
}
// Dynamic prompt
function dynamic_game_prompt_template(game_name, focus_on = null) {
    /**
     * Generates a dynamic game-specific prompt where the LLM determines key mistakes and better alternatives,
     * with an optional focus area for more specific feedback.
     *
     * @param {string} game_name - The name of the game.
     * @param {string|null} focus_on - Optional focus area for the analysis.
     * @returns {string} - The generated prompt.
     */

    const focus_text = focus_on ? (
        `\n### **Special Focus: ${focus_on.charAt(0).toUpperCase() + focus_on.slice(1)}**\n` +
        `- Pay particular attention to **${focus_on}** when analyzing the gameplay.\n` +
        `- Identify **mistakes, missed opportunities, and better alternatives** specifically related to ${focus_on}.\n` +
        `- Ensure the breakdown prioritizes improvements in ${focus_on} over other areas.\n`
    ) : "";

    return (
        `You are an expert video game coach specializing in analyzing gameplay for ${game_name}.\n` +
        `Your task is to analyze a gameplay video and provide **a comprehensive, mistake-focused breakdown** based on the game's mechanics, strategies, and execution.\n\n` +

        `### **Step 1: Identify Key Focus Areas for Analysis**\n` +
        `- Before analyzing the video, list at least **6-8 key factors** that influence success in ${game_name}.\n` +
        `- These could include mechanics, strategy, decision-making, positioning, adaptability, execution, etc.\n` +
        `- Weigh their importance before selecting the **4-5 most critical areas** for identifying mistakes.\n\n` +

        `### **Step 2: Extract and List All Mistakes & Better Alternatives**\n` +
        `Provide an exhaustive breakdown of **all major mistakes** made by the player, along with better choices they could have made.\n` +
        `- Each mistake must be accompanied by a **timestamp** and a specific explanation of why it was incorrect.\n` +
        `- Provide **a clearly superior alternative action** with a rationale for why it would have been better.\n\n` +

        focus_text +

        `### **Output Format:**\n` +
        `Return the analysis strictly in the following JSON format:\n` +
        "```json\n" +
        "{\n" +
        `  "game": "${game_name}",\n` +
        "  \"key_focus_areas\": [\n" +
        "    \"Factor 1\",\n" +
        "    \"Factor 2\",\n" +
        "    \"Factor 3\",\n" +
        "    \"Factor 4\"\n" +
        "  ],\n" +
        "  \"mistakes\": [\n" +
        "    {\n" +
        "      \"timestamp\": \"00:00:00\",\n" +
        "      \"description\": \"Brief mistake description.\",\n" +
        "      \"why_incorrect\": \"Explanation of why this mistake is bad.\",\n" +
        "      \"better_alternative\": \"What should have been done instead.\",\n" +
        "      \"expected_benefit\": \"Why the alternative is superior.\"\n" +
        "    }\n" +
        "  ],\n" +
        "  \"repeated_errors\": [\n" +
        "    {\n" +
        "      \"pattern\": \"Description of recurring mistake.\",\n" +
        "      \"occurrences\": [\"00:01:30\", \"00:04:15\"],\n" +
        "      \"fix\": \"Advice on how to correct this mistake.\"\n" +
        "    }\n" +
        "  ],\n" +
        "  \"missed_opportunities\": [\n" +
        "    {\n" +
        "      \"timestamp\": \"00:02:45\",\n" +
        "      \"missed_action\": \"What could have been done instead.\",\n" +
        "      \"expected_outcome\": \"Benefit of the missed opportunity.\"\n" +
        "    }\n" +
        "  ]\n" +
        "}\n" +
        "```\n\n" +

        `### **Important Instructions:**\n` +
        "- **Only return JSON output**—do not include any additional text.\n" +
        "- Focus exclusively on **mistakes, missed opportunities, and better alternatives.**\n" +
        "- Do **not** include strengths or positive feedback.\n" +
        "- Always include timestamps when referring to gameplay moments.\n" +
        "- Ensure all explanations are specific, structured, and **actionable**.\n" +
        "- Provide alternatives in a way that makes it clear **how the player should adjust their playstyle.**\n" +
        "- Do not include unnecessary conversational elements—only return the structured JSON output."
    );
}

async function store_analysis(video_file_name, analysis_result, PROCESSED_VIDEOS_KV) {
    /**
     * Stores the video analysis result in the KV store.
     *
     * @param {string} video_file_name - The name of the video file.
     * @param {object} analysis_result - The analysis result in JSON format.
     * @returns {boolean} - True if the analysis was stored successfully, false otherwise.
     */
    try {
        await PROCESSED_VIDEOS_KV.put(video_file_name, JSON.stringify(analysis_result));
        console.info(`Analysis stored for video: ${video_file_name}`);
        return true;
    } catch (e) {
        console.error(`Error storing analysis: ${e}`);
        return false;
    }
}

async function retrieve_analysis(video_file_name, PROCESSED_VIDEOS_KV) {
    /**
     * Retrieves the video analysis result from the KV store.
     *
     * @param {string} video_file_name - The name of the video file.
     * @returns {object|null} - The analysis result in JSON format, or null if not found.
     */
    try {
        const analysis_json = await PROCESSED_VIDEOS_KV.get(video_file_name);
        if (analysis_json) {
            return JSON.parse(analysis_json);
        } else {
            return null;
        }
    } catch (e) {
        console.error(`Error retrieving analysis: ${e}`);
        return null;
    }
}

async function process_new_video(video_path, genai, api_key) {
    /**
     * Processes a new video by uploading it, analyzing it, and formatting the analysis.
     *
     * @param {string} video_path - The path to the video file.
     * @returns {object} - An object containing the JSON data and formatted analysis, or null and an error message if processing fails.
     */

    const video_file = await upload_video(video_path, genai, api_key);
    if (video_file === null) {
        return [null, "Video upload failed."];
    }

    const response_text = await analyze_video(video_file, dynamic_game_prompt_template("EA FC 24"), genai);

    if(response_text === null) {
      return [null, "Video analysis failed."]
    }

    try {
        const json_data = extract_json(response_text);
        const formatted_analysis = format_analysis(json_data);
        return [json_data, formatted_analysis]; // Returns json data
    } catch (e) {
        console.error(`Error extracting JSON: ${e}`);
        return [null, "Analysis failed: Could not extract JSON."];
    }
}

async function upload_video_to_r2(request, video_file_name, bucket) {
    /**
     * Uploads the video file from the request to Cloudflare R2.
     *
     * @param {Request} request - The incoming request object.
     * @param {string} video_file_name - The name of the video file.
     * @returns {string|null} - The name of the file if the upload succeeds, null otherwise.
     */
    try {
        // Read the video file from the request body
        const video_data = await request.arrayBuffer();

        console.log(video_data)
        // Upload the video to R2
        console.log(bucket)
        await bucket.put(video_file_name, video_data);
        return video_file_name; // Return the file name
    } catch (e) {
        console.error(`Error uploading video to R2: ${e}`);
        return null; // Return None if the upload fails
    }
}

function generate_html(analyses) {
    /**
     * Generates an HTML page displaying the video analyses.
     *
     * @param {object} analyses - An object containing the video analyses.
     * @returns {string} - The HTML content.
     */
    let html_content = `
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
    `;

    for (const video_name in analyses) {
        if (analyses.hasOwnProperty(video_name)) {
            const analysis = analyses[video_name];
            html_content += `
            <div class="analysis">
                <h2>Video: ${video_name}</h2>
                <pre>${analysis}</pre>
            </div>
            `;
        }
    }

    html_content += `
    </body>
    </html>
    `;
    return html_content;
}

export default{
async fetch(request, env, ctx) {
    /**
     * Handles incoming requests to the Cloudflare Worker.
     *
     * @param {Request} request - The incoming request object.
     * @returns {Response} - The response object.
     */
	let API_KEY = env.API_KEY; // Access environment variables correctly
	let MODEL = env.MODEL; // Access environment variables correctly
	let PROCESSED_VIDEOS_KV = env.video_storage_kv //env.PROCESSED_VIDEOS_KV; // Access environment variables correctly
	let BUCKET = env.MY_BUCKET; // Access environment variables correctly

    try {
        if (request.method === "POST") {

            // 1. Parse the video file from the request
            const contentType = request.headers.get("Content-Type");
            if (!contentType || !contentType.startsWith("video/")) {
                return new Response(JSON.stringify({ error: "Invalid Content-Type. Expected video/*" }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Generate a unique file name (e.g., using timestamp)
            const video_file_name = `video_${Date.now()}.mp4`;

            // 2. Store the video file
            let uploaded_video_file_name;
            if (BUCKET) {
                uploaded_video_file_name = await upload_video_to_r2(request, video_file_name, BUCKET); // Store in r2 bucket
                if (uploaded_video_file_name === null) {
                    return new Response(JSON.stringify({ error: "Video upload failed to R2." }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } else {
                // Read the video data from the request
                const video_data = await request.arrayBuffer();

                // Cloudflare Workers don't have a file system, saving the video locally is not possible
                // This is a placeholder for local testing, but won't work in production
                uploaded_video_file_name = "local_file_placeholder.mp4";
            }

			const genAI = new GoogleGenerativeAI(API_KEY);

            // 3. Process the video with Gemini
            const [analysis_json, formatted_analysis] = await process_new_video(uploaded_video_file_name, genAI, API_KEY);

            if (analysis_json === null) {
                return new Response(JSON.stringify({ error: formatted_analysis }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }); // Use the message returned from process_new_video
            }

            // 4. Store the analysis
            if (PROCESSED_VIDEOS_KV) { // Check if ANALYSES_KV is set
                if (!await store_analysis(video_file_name, analysis_json, PROCESSED_VIDEOS_KV)) {
                    return new Response(JSON.stringify({ error: "Failed to store analysis." }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }); // Alert if could not store video
                }
            }

            // 5. Return the analysis result (or redirect to the HTML page)
            return new Response(JSON.stringify({ message: "Video uploaded and analysis stored", video_name: video_file_name }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }); // Returning message to frontend to know the videoname

        } else if (request.method === "GET") {
            // Serve the HTML page with video analyses
            const all_analyses = {};
            if (PROCESSED_VIDEOS_KV) { // If analises kv is set get all data

                // Iterate over all keys in the KV store.  This will be slow if you have many videos.
                // A better approach would be to have a separate "index" key that lists all video names.
                // Unfortunately, Cloudflare Workers KV does not have list() functionality.  You need to simulate
                // list() via something like a counter that you increment when you store a video.

                // This is a VERY inefficient way to list all keys, but it's the only way possible without
                // simulating the listing.
                let keys = [];
                let cursor = null;
                while (true) {
                    const list_result = await PROCESSED_VIDEOS_KV.list({ cursor: cursor });
                    keys = keys.concat(list_result.keys);
                    if (list_result.cursor) {
                        cursor = list_result.cursor;
                    } else {
                        break; // End iteration
                    }
                }

                for (const key of keys) { // For each key saved in the analyises
                    const analysis = await retrieve_analysis(key.name, PROCESSED_VIDEOS_KV); // Get analysis in json format

                    if (analysis) { // Check if not null
                        const formatted_analysis = format_analysis(analysis); // Format in text
                        all_analyses[key.name] = formatted_analysis; // Add to the analyses to serve
                    }
                }
            }

            const html_content = generate_html(all_analyses);
            return new Response(html_content, { headers: { "Content-Type": "text/html;charset=UTF-8" } });

        } else {
            return new Response(JSON.stringify({ message: "Send a POST request with a video file to analyze, or a GET request to view the analysis results." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (e) {
        console.error(`Error processing request: ${e}`);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
}