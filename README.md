🚀 Data Alchemist: Transform Data into Optimized Resources
✨ Unleash the Power of Your Data for Smarter Allocations!
Welcome to Data Alchemist, your intelligent companion for transforming raw resource data into actionable insights and strategic allocation plans. This application empowers non-technical users to cleanse, understand, and analyze their Client, Worker, and Task data with the magic of AI, predicting allocation feasibility and pinpointing bottlenecks before they arise.

🔥 Key Features that Make it Awesome!
1. AI-Powered "Smart Insights" & Anomaly Detection:

Goes Beyond Basic Errors: Detects not just static data errors (like negative numbers or missing fields) but also subtle anomalies and outliers that a human eye might miss (e.g., unusually high task durations).

Plain-Language Explanations: Get clear, non-technical messages explaining why a data point is problematic or unusual.

Visual Clarity: Errors are highlighted in red for critical issues, while AI-detected anomalies appear in a distinct amber/orange, guiding your attention precisely where it's needed.

2. Natural Language Data Modification:

Speak Your Changes: Instead of manual edits, simply tell the AI what data changes you want to make in plain English (e.g., "Change the status of all clients in the 'VIP' group to 'Active'").

Intelligent Execution: The AI understands your intent and applies the modifications across your dataset.

3. AI-Powered "Allocation Feasibility & Bottleneck Analysis":

Strategic Overview: Upload your Client, Worker, and Task data, and the AI will analyze the overall viability of your resource allocation strategy.

Proactive Problem Spotting: Discover critical bottlenecks (e.g., skill shortages, capacity overloads) and predicted unassigned tasks before you even try to run an allocation.

Actionable Recommendations: Get high-level, practical suggestions from the AI on how to resolve identified issues and improve your allocation plan.

Zero Rules Needed: This powerful analysis works directly with your raw data – no complex rule definitions are required from you!

4. Rule UI (Beta)

Define your own business rules on data and get allocation analysis based on that rules.

(This feature is currently in beta stage)


🚀 Getting Started - Your Quick Launch Guide!
Follow these simple steps to get the Data Alchemist up and running on your local machine:

Clone the Repository:

git clone <https://github.com/Vedu-07/DataAlchemist>
cd data-alchemist

Install Dependencies:

npm install

Run the Development Server:

npm run dev

The application will now be running on http://localhost:3000.

👩‍💻 How to Use the Data Alchemist - A Non-Technical Walkthrough
The Data Alchemist is designed for simplicity! Here’s how you can leverage its power:

Launch the App: Open your browser and go to http://localhost:3000.

Upload Your Data:

You'll see a "File Upload" section.

First, select the "Data Category" (Clients Data, Workers Data, or Tasks Data) from the dropdown. This tells the AI what kind of data to expect.

Then, drag and drop your .csv or .xlsx file into the designated area, or click to browse.

Tip: Upload all three types (Clients, Workers, Tasks) for the fullest analysis!

Review "Smart Insights":

Once your data is uploaded, it will automatically appear in a table below.

Watch for Highlights:

Red highlighting indicates a critical error (e.g., a negative duration).

Read the Messages: Below each flagged value, you'll see a plain-language explanation of the issue.

Get an Overview: Click the "Run Smart Insights" button in the dedicated card to get an overall AI summary of data quality across all your loaded files.

Use Natural Language Data Modifier:

Below the "Smart Insights" section, find the "Natural Language Data Modifier" card.

Type in your data modification request in simple English (e.g., "For tasks in the 'Marketing' category, set their duration to 100").

Click "Apply Modifications" to update your data.

Run "Allocation Feasibility & Bottleneck Analysis": 

Look for the "Allocation Feasibility & Bottleneck Analysis" card.

Click the "Analyze Allocation Feasibility" button.

The AI will process your entire dataset and provide a comprehensive report covering:

Overall Plan Status: A quick verdict (Feasible, Challenged, etc.).

Key Bottlenecks: Specific problems like skill shortages or overloaded teams.

Predicted Unassigned Tasks: An estimate of how many tasks might not find a suitable resource.

Recommendations: Actionable advice to improve your plan.

This analysis works with just your uploaded data – no need to define rules manually!

Export Cleaned Data:

After making corrections and analysis, click the "Export All Cleaned Data" button at the bottom to download your refined datasets.

📂 Sample Data for Easy Testing
To help you get started quickly, we've included sample data files in the public folder of this project:

public/clients.csv

public/workers.csv

public/taskss.csv

Just upload these files using the "File Upload" section to experience the app immediately!

💻 Tech Stack Under the Hood
Framework: Next.js (React)

Styling: Tailwind CSS, shadcnUi (for sleek, responsive UI)


AI Core: Google Gemini API (powering Smart Insights, NL Modification, and Allocation Analysis)

File Processing: xlsx library

❤️ Your Feedback Matters!
This project is constantly evolving. Your feedback is invaluable in making the Data Alchemist even more amazing and user-friendly. If you encounter any issues, have suggestions feel free to contact: <vedantswami02@gmail.com>