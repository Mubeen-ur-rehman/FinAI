
export const FAQ_CATEGORIES = [
  "Getting Started",
  "Dataset Management",
  "Fraud Detection",
  "Risk Analysis",
  "Dashboard",
  "Alerts",
  "Reports",
  "Account & Security",
  "Troubleshooting",
];

export const FAQS = [
  // GETTING STARTED
  {
    id: "intro-1",
    category: "Getting Started",
    question: "What is FinGuard AI?",
    answer:
      "FinGuard AI is a transaction analysis and fraud detection project. It processes transaction datasets, evaluates transaction risk, identifies suspicious activity, and presents results through a dashboard.",
    keywords: ["about", "introduction", "purpose", "project", "system"],
  },
  {
    id: "intro-2",
    category: "Getting Started",
    question: "What are the main features of FinGuard AI?",
    answer:
      "The main features include CSV dataset processing, transaction risk scoring, suspicious transaction alerts, batch history, dashboard analytics, and PDF preprocessing reports.",
    keywords: ["features", "functions", "capabilities", "services"],
  },
  {
    id: "intro-3",
    category: "Getting Started",
    question: "Who can use FinGuard AI?",
    answer:
      "FinGuard AI is designed as a transaction analysis and fraud detection demonstration system. It can help students, researchers, and users explore suspicious transaction patterns in supported datasets.",
    keywords: ["users", "audience", "students", "researchers"],
  },
  {
    id: "intro-4",
    category: "Getting Started",
    question: "Does FinGuard AI guarantee fraud detection?",
    answer:
      "No. FinGuard AI provides risk scores and suspicious transaction indicators based on its configured processing and scoring logic. Results should be reviewed and must not be treated as a guarantee that a transaction is fraudulent or legitimate.",
    keywords: ["accuracy", "guarantee", "reliable", "limitations"],
  },

  // DATASET MANAGEMENT
  {
    id: "data-1",
    category: "Dataset Management",
    question: "How do I upload a transaction dataset?",
    answer:
      "Open the Upload section, choose your CSV transaction file, and start processing. FinGuard AI will read the file, preprocess supported data, score transactions, and save the processing results.",
    keywords: ["upload", "import", "csv", "file", "dataset"],
  },
  {
    id: "data-2",
    category: "Dataset Management",
    question: "Which file format is supported?",
    answer:
      "The current upload workflow is designed for CSV files. Make sure your file is a valid CSV containing transaction records and the columns required by the selected preprocessing and scoring pipeline.",
    keywords: ["format", "extension", "csv", "excel", "xlsx"],
  },
  {
    id: "data-3",
    category: "Dataset Management",
    question: "Can I upload a large dataset?",
    answer:
      "FinGuard AI supports transaction processing in chunks, but the practical dataset size depends on available memory, browser performance, processing time, and Firestore storage limits. Very large datasets may need additional optimization.",
    keywords: ["large", "millions", "big", "size", "memory"],
  },
  {
    id: "data-4",
    category: "Dataset Management",
    question: "What happens after uploading a dataset?",
    answer:
      "The system reads the CSV, applies preprocessing, evaluates supported transaction records, calculates risk scores, identifies records for alerts, and saves a processing batch with its summary.",
    keywords: ["after upload", "processing", "pipeline", "workflow"],
  },
  {
    id: "data-5",
    category: "Dataset Management",
    question: "What is a batch?",
    answer:
      "A batch represents one dataset processing run. It stores information such as the uploaded filename, number of scanned transactions, alert count, scoring time, and processing summary.",
    keywords: ["batch", "upload history", "processing run"],
  },
  {
    id: "data-6",
    category: "Dataset Management",
    question: "How can I view an uploaded dataset?",
    answer:
      "Open the uploaded batches or upload history section and select the batch you want to inspect. The website should display analytics and alerts belonging to that selected batch.",
    keywords: ["open file", "view file", "open dataset", "history"],
  },
  {
    id: "data-7",
    category: "Dataset Management",
    question: "Can I delete an uploaded batch?",
    answer:
      "Use the Delete action next to the selected batch, then confirm the operation. The application should remove the batch and its associated alerts. Only delete a batch when you are sure you no longer need its results.",
    keywords: ["delete", "remove", "erase", "batch deletion"],
  },
  {
    id: "data-8",
    category: "Dataset Management",
    question: "Does deleting a batch delete its alerts?",
    answer:
      "The intended batch deletion workflow removes the alerts associated with that batch before deleting the batch record. If deletion fails, check the application error message and your Firestore permissions.",
    keywords: ["delete alerts", "associated alerts", "batch records"],
  },

  // FRAUD DETECTION
  {
    id: "fraud-1",
    category: "Fraud Detection",
    question: "How does fraud detection work?",
    answer:
      "FinGuard AI preprocesses transaction data and passes supported records through its scoring pipeline. The scoring logic evaluates transaction information and produces risk scores used to identify suspicious activity.",
    keywords: ["algorithm", "detection", "working", "model", "scoring"],
  },
  {
    id: "fraud-2",
    category: "Fraud Detection",
    question: "What is a suspicious transaction?",
    answer:
      "A suspicious transaction is a transaction that receives a concerning risk score or matches indicators defined by the configured scoring system. It should be investigated rather than automatically assumed to be fraud.",
    keywords: ["suspicious", "unusual", "transaction", "fraudulent"],
  },
  {
    id: "fraud-3",
    category: "Fraud Detection",
    question: "What is a transaction risk score?",
    answer:
      "A risk score is a numerical result produced by the FinGuard AI scoring pipeline. It represents the level of risk assigned to a transaction according to the system's configured scoring rules.",
    keywords: ["score", "risk score", "numerical", "rating"],
  },
  {
    id: "fraud-4",
    category: "Fraud Detection",
    question: "Does every suspicious transaction mean fraud?",
    answer:
      "No. A suspicious transaction is a signal that requires further investigation. Legitimate transactions can sometimes appear unusual, so users should review the available transaction details before making a decision.",
    keywords: ["false positive", "real fraud", "confirmed fraud", "legitimate"],
  },
  {
    id: "fraud-5",
    category: "Fraud Detection",
    question: "What is the difference between fraud detection and fraud prevention?",
    answer:
      "Fraud detection identifies transactions that may be suspicious. Fraud prevention refers to actions taken to stop or reduce fraudulent activity. FinGuard AI focuses on transaction analysis and detection; it should not be assumed to block bank transactions.",
    keywords: ["prevention", "difference", "blocking", "detect"],
  },

  // RISK ANALYSIS
  {
    id: "risk-1",
    category: "Risk Analysis",
    question: "What do risk levels mean?",
    answer:
      "Risk levels group transactions according to their assigned risk. FinGuard AI can display categories such as Low, Medium, High, and Critical where configured. The exact score boundaries depend on the scoring implementation.",
    keywords: ["low", "medium", "high", "critical", "risk levels"],
  },
  {
    id: "risk-2",
    category: "Risk Analysis",
    question: "What does a critical alert mean?",
    answer:
      "A critical alert identifies a transaction that the configured scoring system places in its most serious risk category. Review its transaction details and investigate it carefully.",
    keywords: ["critical", "highest risk", "urgent", "serious"],
  },
  {
    id: "risk-3",
    category: "Risk Analysis",
    question: "What is amount at risk?",
    answer:
      "Amount at risk is a financial summary calculated from transactions identified by the processing pipeline. It is an estimated exposure indicator, not proof of an actual financial loss.",
    keywords: ["money", "financial exposure", "amount", "loss", "exposure"],
  },

  // DASHBOARD
  {
    id: "dash-1",
    category: "Dashboard",
    question: "What does the dashboard show?",
    answer:
      "The dashboard summarizes processed transactions, generated alerts, critical alerts, and estimated amount at risk. Its values should correspond to the currently selected processing batch or the selected aggregation view.",
    keywords: ["dashboard", "overview", "statistics", "metrics"],
  },
  {
    id: "dash-2",
    category: "Dashboard",
    question: "Why are my dashboard statistics not updating?",
    answer:
      "First, check that the latest batch was successfully processed and selected. Refresh the page, check for Firestore or browser console errors, and verify that dashboard calculations use the selected batch rather than stale or previously aggregated data.",
    keywords: ["not updating", "old data", "previous data", "stale", "wrong statistics"],
  },
  {
    id: "dash-3",
    category: "Dashboard",
    question: "Why does the dashboard show old dataset results?",
    answer:
      "This can happen if the dashboard is still displaying a previously selected batch or using aggregated historical data. Select the latest batch and check that all dashboard metrics and alert queries are filtered by its batch ID.",
    keywords: ["old dataset", "previous upload", "latest batch", "wrong batch"],
  },
  {
    id: "dash-4",
    category: "Dashboard",
    question: "Can I compare different uploaded datasets?",
    answer:
      "The batch history can be used to inspect separate processing runs. Dataset comparison requires the dashboard to load each batch's saved summary and calculate the comparison using matching metrics.",
    keywords: ["compare", "comparison", "multiple datasets", "batch history"],
  },

  // ALERTS
  {
    id: "alert-1",
    category: "Alerts",
    question: "What are fraud alerts?",
    answer:
      "Fraud alerts are transaction records selected by the processing pipeline because their risk scores meet the configured alert criteria. They help users identify transactions that may need review.",
    keywords: ["alerts", "flagged", "notifications", "fraud records"],
  },
  {
    id: "alert-2",
    category: "Alerts",
    question: "Why are only some transactions shown in alerts?",
    answer:
      "The pipeline does not necessarily store every scanned transaction as an alert. It selects records according to its configured alert threshold and storage limit. Check the scoring and pipeline settings for the exact rules.",
    keywords: ["missing alerts", "not all transactions", "alert limit", "threshold"],
  },
  {
    id: "alert-3",
    category: "Alerts",
    question: "How can I investigate an alert?",
    answer:
      "Open the alert and review the available transaction information, risk score, risk category, and related batch. Treat the alert as an investigation lead, not a confirmed fraud finding.",
    keywords: ["investigate", "review", "alert details", "inspect"],
  },

  // REPORTS
  {
    id: "report-1",
    category: "Reports",
    question: "Can I download a PDF report?",
    answer:
      "The upload workflow can generate a PDF preprocessing report containing information about the processed file and its preprocessing summary, when that feature is enabled in the application.",
    keywords: ["pdf", "download report", "preprocessing report", "export"],
  },
  {
    id: "report-2",
    category: "Reports",
    question: "What information is included in the preprocessing report?",
    answer:
      "The report can include the uploaded filename, batch ID, preprocessing summary, rejected records, and other processing details made available by the pipeline.",
    keywords: ["report details", "rejected rows", "cleaning report", "summary"],
  },

  // ACCOUNT & SECURITY
  {
    id: "account-1",
    category: "Account & Security",
    question: "How do I sign in to FinGuard AI?",
    answer:
      "Use the sign-in interface provided by the application and enter the credentials associated with your account. Authentication is handled through the configured Firebase Authentication service.",
    keywords: ["login", "sign in", "authentication", "account"],
  },
  {
    id: "account-2",
    category: "Account & Security",
    question: "How is user data stored?",
    answer:
      "The current application uses Firebase services, including Firestore for saved application records. Access depends on the configured authentication and Firestore security rules.",
    keywords: ["firebase", "firestore", "database", "storage"],
  },
  {
    id: "account-3",
    category: "Account & Security",
    question: "Is my dataset visible to other users?",
    answer:
      "Dataset visibility depends on the application's Firestore security rules and query filtering. The application should restrict users to records they are authorized to access. Do not upload sensitive financial or personal information unless the deployment has been properly secured.",
    keywords: ["privacy", "other users", "security", "data access"],
  },

  // TROUBLESHOOTING
  {
    id: "trouble-1",
    category: "Troubleshooting",
    question: "Why is my CSV file not uploading?",
    answer:
      "Check that the file is a valid CSV, is not empty, and contains the required transaction columns. Also check the browser console and terminal for parsing, processing, or Firebase errors.",
    keywords: ["upload failed", "csv error", "file error", "not uploading"],
  },
  {
    id: "trouble-2",
    category: "Troubleshooting",
    question: "What does a missing jspdf module error mean?",
    answer:
      "It means the jsPDF package is not installed or cannot be resolved. Open the terminal in the project folder containing package.json and run: npm install jspdf. Then restart the Next.js development server.",
    keywords: ["jspdf", "module not found", "npm error", "pdf error"],
  },
  {
    id: "trouble-3",
    category: "Troubleshooting",
    question: "What does the ENOENT package.json error mean?",
    answer:
      "This usually means the terminal is running npm commands from a folder that does not contain package.json. Navigate to the actual Next.js project directory, check that package.json exists, and run npm commands there.",
    keywords: ["enoent", "package json", "npm run dev", "wrong folder"],
  },
  {
    id: "trouble-4",
    category: "Troubleshooting",
    question: "Why are my Firebase operations failing?",
    answer:
      "Check your Firebase environment variables, project configuration, authentication state, Firestore security rules, and browser console errors. Never expose private credentials in client-side code.",
    keywords: ["firebase error", "firestore error", "permission denied", "api key"],
  },
  {
    id: "trouble-5",
    category: "Troubleshooting",
    question: "Why is my website not showing recent code changes?",
    answer:
      "Save your files, confirm you are editing the correct project folder, check the terminal for compilation errors, and refresh the browser. For a deployed website, make sure the latest code has been pushed to the connected GitHub repository and deployed successfully.",
    keywords: ["changes not showing", "old website", "deployment", "refresh", "vercel"],
  },
  {
    id: "trouble-6",
    category: "Troubleshooting",
    question: "What should I do if dataset processing fails?",
    answer:
      "Check the CSV structure, required columns, browser console, and terminal logs. Also verify that Firebase is configured correctly and that the user has permission to create batch and alert records.",
    keywords: ["processing failed", "pipeline error", "scoring error", "dataset error"],
  },
];

export const FAQ_FALLBACK =
  "Sorry, I couldn't find a saved answer for that question. I can currently help with FinGuard AI features, dataset uploads, fraud detection, dashboard analytics, alerts, reports, accounts, and troubleshooting. Please choose one of the suggested questions or try different wording.";
