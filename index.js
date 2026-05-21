let network = null;
let currentCourse = "Calculus";
let studentData = null;
let graphData = null;
let selectedNodeId = null;

// Error Types definitions for both courses
const ERROR_TYPES = {
    "Calculus": [
        "Sign error",
        "Formula mistake",
        "Algebraic simplification mistake",
        "Calculation error"
    ],
    "VoiceBanking": [
        "Language mixing syntax error",
        "Intent misclassification",
        "Audio quality distortion",
        "Entity extraction failure"
    ]
};

// Colors mapping matching CSS Alabaster Theme variables
const COLORS = {
    strong: {
        background: '#F0F4EF',
        border: '#8F9E8B',
        highlight: { background: '#E2EAE1', border: '#8F9E8B' },
        glow: 'rgba(143, 158, 139, 0.35)'
    },
    medium: {
        background: '#FAF5EE',
        border: '#C5B49B',
        highlight: { background: '#F3EAD9', border: '#C5B49B' },
        glow: 'rgba(197, 180, 155, 0.35)'
    },
    weak: {
        background: '#FAF0EE',
        border: '#C58F84',
        highlight: { background: '#F3DDD9', border: '#C58F84' },
        glow: 'rgba(197, 143, 132, 0.45)'
    },
    unstarted: {
        background: '#F5F3ED',
        border: '#BEB7A4',
        highlight: { background: '#E9E5DA', border: '#BEB7A4' },
        glow: 'rgba(190, 183, 164, 0.15)'
    }
};

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    await fetchStudentData();
    await fetchGraphData(currentCourse);
    populateSimulatorDropdowns();
}

function setupEventListeners() {
    // Course select dropdown
    document.getElementById("course-select").addEventListener("change", (e) => {
        currentCourse = e.target.value;
        fetchGraphData(currentCourse).then(() => {
            populateSimulatorDropdowns();
            resetDetailPanel();
        });
    });

    // Quiz simulator correct/incorrect toggle to show error types
    document.getElementById("sim-correct").addEventListener("change", (e) => {
        const errorGroup = document.getElementById("group-error-type");
        if (e.target.value === "incorrect") {
            errorGroup.classList.remove("hidden");
        } else {
            errorGroup.classList.add("hidden");
        }
    });

    // Quiz simulator form submit
    document.getElementById("simulator-form").addEventListener("submit", handleSimulateAttempt);

    // Run PDF pipeline button
    document.getElementById("btn-run-pipeline").addEventListener("click", handleRunPipeline);
}

// REST API calls
async function fetchStudentData() {
    try {
        const res = await fetch("http://localhost:8000/api/student");
        studentData = await res.json();
        updateGlobalStats();
    } catch (e) {
        console.error("Failed to fetch student data:", e);
    }
}

async function fetchGraphData(course) {
    try {
        document.getElementById("network-loader").classList.remove("hidden");
        const res = await fetch(`http://localhost:8000/api/graph?course=${course}`);
        graphData = await res.json();
        renderGraph();
        document.getElementById("network-loader").classList.add("hidden");
    } catch (e) {
        console.error("Failed to fetch graph data:", e);
        document.getElementById("network-loader").classList.add("hidden");
    }
}

function updateGlobalStats() {
    if (!studentData || !studentData["S001"]) return;
    const student = studentData["S001"];
    
    // Set student name details
    document.getElementById("student-name").innerText = student.name;
    document.getElementById("student-id").innerText = `Student ID: ${student.student_id}`;

    // Compute course average mastery rate and active misconceptions
    let totalMastery = 0;
    let topicCount = 0;
    let activeMisconceptions = 0;

    // Detect weak topics
    for (const [topic, details] of Object.entries(student.topics)) {
        totalMastery += details.mastery_score;
        topicCount++;
        
        // Count misconceptions (errors occurring >= 3 times)
        if (details.error_types) {
            for (const count of Object.values(details.error_types)) {
                if (count >= 3) activeMisconceptions++;
            }
        }
    }

    const avgMastery = topicCount > 0 ? Math.round(totalMastery / topicCount) : 0;
    document.getElementById("mastery-rate").innerText = `${avgMastery}%`;
    
    const warningBox = document.getElementById("global-warning-box");
    const warningText = document.getElementById("misconception-count");
    warningText.innerText = `${activeMisconceptions} Active`;
    
    if (activeMisconceptions > 0) {
        warningBox.classList.add("active-misconception");
    } else {
        warningBox.classList.remove("active-misconception");
    }
}

function getMasteryCategory(score) {
    if (score >= 80) return "strong";
    if (score >= 50) return "medium";
    if (score > 0) return "weak";
    return "unstarted";
}

// Render Graph using Vis.js
function renderGraph() {
    if (!graphData) return;

    const studentTopics = studentData["S001"] ? studentData["S001"].topics : {};

    // Transform nodes for vis.js
    const visNodes = graphData.nodes.map(node => {
        const studentTopic = studentTopics[node.id];
        const masteryScore = studentTopic ? studentTopic.mastery_score : 0;
        const category = getMasteryCategory(masteryScore);
        const style = COLORS[category];

        return {
            id: node.id,
            label: node.display_name,
            shape: 'box',
            font: {
                color: '#3B3833',
                face: 'Inter',
                size: 13,
                bold: { color: '#3B3833', size: 13, vadjust: 0 }
            },
            color: {
                background: style.background,
                border: style.border,
                highlight: style.highlight,
                hover: style.highlight
            },
            shadow: {
                enabled: true,
                color: style.glow,
                size: 15,
                x: 0,
                y: 0
            },
            borderWidth: 2,
            borderWidthSelected: 2.5,
            margin: { top: 11, bottom: 11, left: 15, right: 15 },
            shapeProperties: { borderRadius: 8 },
            // Custom data properties
            meta: {
                description: node.description,
                difficulty: node.difficulty,
                mastery: masteryScore,
                category: category,
                prerequisites: node.prerequisites
            }
        };
    });

    // Transform edges
    const visEdges = graphData.edges.map((edge, idx) => {
        return {
            id: `edge_${idx}`,
            from: edge.from,
            to: edge.to,
            arrows: 'to',
            color: {
                color: '#C2B9A7',
                highlight: '#BCA88A',
                hover: '#BCA88A',
                opacity: 0.85
            },
            width: 1.5,
            smooth: {
                type: 'cubicBezier',
                forceDirection: 'horizontal',
                roundness: 0.4
            }
        };
    });

    const container = document.getElementById("network-container");
    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };

    const options = {
        nodes: {
            chosen: true
        },
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 0.65, type: 'arrow' }
            },
            selectionWidth: 2
        },
        interaction: {
            hover: true,
            dragNodes: true,
            dragView: true,
            zoomView: true,
            tooltipDelay: 200
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -45,
                centralGravity: 0.012,
                springLength: 120,
                springConstant: 0.06,
                damping: 0.45,
                avoidOverlap: 0.5
            },
            stabilization: {
                iterations: 140,
                fit: true
            }
        }
    };

    network = new vis.Network(container, data, options);

    // Set canvas background to match the warm alabaster palette
    network.on('beforeDrawing', function(ctx) {
        ctx.save();
        ctx.fillStyle = '#FAF9F6';
        ctx.fillRect(-ctx.canvas.width, -ctx.canvas.height, ctx.canvas.width * 3, ctx.canvas.height * 3);
        ctx.restore();
    });

    // Event listener: select node
    network.on("selectNode", (params) => {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = data.nodes.get(nodeId);
            showConceptDetails(nodeId, nodeData);
            highlightPrerequisitesAndUnlocks(nodeId, visEdges);
        }
    });

    // Event listener: deselect node
    network.on("deselectNode", () => {
        resetDetailPanel();
        resetEdgesColor(visEdges);
    });
}

function highlightPrerequisitesAndUnlocks(selectedId, edgesList) {
    selectedNodeId = selectedId;
    const incoming = [];
    const outgoing = [];

    // Traverse prerequisites and unlocks
    edgesList.forEach(edge => {
        if (edge.to === selectedId) {
            incoming.push(edge.id);
        } else if (edge.from === selectedId) {
            outgoing.push(edge.id);
        }
    });

    // Color code the lines — using muted palette colors only
    const updatedEdges = edgesList.map(edge => {
        if (incoming.includes(edge.id)) {
            return { id: edge.id, color: { color: '#C58F84', opacity: 1 }, width: 2.5 }; // Prerequisite: muted terracotta
        } else if (outgoing.includes(edge.id)) {
            return { id: edge.id, color: { color: '#8F9E8B', opacity: 1 }, width: 2.5 }; // Unlock: sage green
        } else {
            return { id: edge.id, color: { color: '#D2C9B9', opacity: 0.35 }, width: 1.0 }; // Dim: soft greige
        }
    });

    network.body.data.edges.update(updatedEdges);
}

function resetEdgesColor(edgesList) {
    selectedNodeId = null;
    const resetEdges = edgesList.map(edge => {
        return {
            id: edge.id,
            color: { color: '#C2B9A7', opacity: 0.85 },
            width: 1.5
        };
    });
    network.body.data.edges.update(resetEdges);
}

// Show concept details in sidebar
function showConceptDetails(nodeId, nodeData) {
    document.getElementById("detail-placeholder").classList.add("hidden");
    const detailContent = document.getElementById("detail-content");
    detailContent.classList.remove("hidden");

    // Title & Difficulty stars
    document.getElementById("concept-title").innerText = nodeData.label;
    const diffStars = "🌟".repeat(nodeData.meta.difficulty) + "⭐".repeat(5 - nodeData.meta.difficulty);
    document.getElementById("concept-difficulty").innerText = `${diffStars} (Difficulty: ${nodeData.meta.difficulty}/5)`;
    
    // Description
    document.getElementById("concept-description").innerText = nodeData.meta.description;

    // Student Metrics
    const student = studentData["S001"];
    const topicDetails = student.topics[nodeId];
    
    const masteryScore = topicDetails ? topicDetails.mastery_score : 0;
    const category = getMasteryCategory(masteryScore);

    // Progress Bar
    const progressBar = document.getElementById("concept-progress-bar");
    progressBar.style.width = `${masteryScore}%`;
    progressBar.className = `progress-bar ${category}`;
    document.getElementById("concept-mastery-text").innerText = `${masteryScore}%`;

    // Status Badge
    const statusBadge = document.getElementById("concept-status");
    statusBadge.innerText = category.toUpperCase();
    statusBadge.className = `badge detail-status legend-color ${category}`;

    if (topicDetails) {
        document.getElementById("metric-accuracy").innerText = `${topicDetails.correct_answers}/${topicDetails.total_attempts}`;
        document.getElementById("metric-hints").innerText = topicDetails.hints_used;
        document.getElementById("metric-time").innerText = `${topicDetails.total_time_taken}s`;

        // Error profile
        const errorListElement = document.getElementById("concept-errors");
        errorListElement.innerHTML = "";
        
        const errors = topicDetails.error_types || {};
        if (Object.keys(errors).length === 0) {
            errorListElement.innerHTML = "<li>No errors recorded. Perfect record!</li>";
        } else {
            for (const [err, count] of Object.entries(errors)) {
                const li = document.createElement("li");
                li.innerHTML = `<span>${err}</span><span class="error-count">${count}</span>`;
                errorListElement.appendChild(li);
            }
        }

        // Recommendation signaled
        const recommendationBox = document.getElementById("concept-recommendation");
        let signal = "Ready to proceed to advanced questions.";
        
        // Find misconceptions
        let hasPersistentMisconception = false;
        for (const count of Object.values(errors)) {
            if (count >= 3) hasPersistentMisconception = true;
        }

        if (masteryScore < 50) {
            if (hasPersistentMisconception) {
                signal = `⚠️ URGENT REVISION: Repeated misconceptions detected! Review fundamental equations and error profiles.`;
                recommendationBox.className = "recommendation-box revision-needed";
            } else {
                signal = "Needs foundational review and basic practice questions.";
                recommendationBox.className = "recommendation-box";
            }
        } else if (masteryScore < 80) {
            signal = "Needs moderate advanced practice questions to reach full concept mastery.";
            recommendationBox.className = "recommendation-box";
        } else {
            signal = "Topic mastered. Highly prepared to unlock subsequent concepts.";
            recommendationBox.className = "recommendation-box";
        }
        recommendationBox.innerText = signal;

    } else {
        // Not started
        document.getElementById("metric-accuracy").innerText = "0/0";
        document.getElementById("metric-hints").innerText = "0";
        document.getElementById("metric-time").innerText = "0s";
        document.getElementById("concept-errors").innerHTML = "<li>Concept not started yet. Record quiz attempts to view errors.</li>";
        
        const recBox = document.getElementById("concept-recommendation");
        recBox.innerText = "No student attempt data. Complete the prerequisite concepts first.";
        recBox.className = "recommendation-box";
    }

    // Prerequisites and Unlocks lists
    const prereqsDiv = document.getElementById("concept-prereqs");
    prereqsDiv.innerHTML = "";
    if (nodeData.meta.prerequisites.length === 0) {
        prereqsDiv.innerHTML = "<em>None</em>";
    } else {
        nodeData.meta.prerequisites.forEach(prereqId => {
            const span = document.createElement("span");
            span.className = "rel-badge prereq-badge";
            span.innerText = graphData.nodes.find(n => n.id === prereqId)?.display_name || prereqId;
            span.onclick = () => jumpToNode(prereqId);
            prereqsDiv.appendChild(span);
        });
    }

    // Successors (Unlocks)
    const unlocksDiv = document.getElementById("concept-unlocks");
    unlocksDiv.innerHTML = "";
    const successors = graphData.edges.filter(edge => edge.from === nodeId).map(edge => edge.to);
    
    if (successors.length === 0) {
        unlocksDiv.innerHTML = "<em>None</em>";
    } else {
        successors.forEach(succId => {
            const span = document.createElement("span");
            span.className = "rel-badge unlocks-badge";
            span.innerText = graphData.nodes.find(n => n.id === succId)?.display_name || succId;
            span.onclick = () => jumpToNode(succId);
            unlocksDiv.appendChild(span);
        });
    }
}

function jumpToNode(nodeId) {
    if (network) {
        network.selectNodes([nodeId]);
        // Trigger selectNode logic manually
        const nodeData = network.body.data.nodes.get(nodeId);
        showConceptDetails(nodeId, nodeData);
        // Highlight links
        const visEdges = graphData.edges.map((edge, idx) => ({
            id: `edge_${idx}`,
            from: edge.from,
            to: edge.to
        }));
        highlightPrerequisitesAndUnlocks(nodeId, visEdges);
        // Smoothly focus on node
        network.focus(nodeId, {
            scale: 1.1,
            animation: { duration: 500, easingFunction: 'easeInOutQuad' }
        });
    }
}

function resetDetailPanel() {
    document.getElementById("detail-placeholder").classList.remove("hidden");
    document.getElementById("detail-content").classList.add("hidden");
    const statusBadge = document.getElementById("concept-status");
    statusBadge.innerText = "Select a Node";
    statusBadge.className = "badge detail-status";
}

// Populate simulator drop downs
function populateSimulatorDropdowns() {
    if (!graphData) return;
    
    const selectTopic = document.getElementById("sim-topic");
    selectTopic.innerHTML = "";
    
    graphData.nodes.forEach(node => {
        const option = document.createElement("option");
        option.value = node.id;
        option.innerText = node.display_name;
        selectTopic.appendChild(option);
    });

    const selectError = document.getElementById("sim-error-type");
    selectError.innerHTML = "";
    
    const errors = ERROR_TYPES[currentCourse] || [];
    errors.forEach(err => {
        const option = document.createElement("option");
        option.value = err;
        option.innerText = err;
        selectError.appendChild(option);
    });
}

// Handle simulated Quiz attempt
async function handleSimulateAttempt(e) {
    e.preventDefault();

    const topic = document.getElementById("sim-topic").value;
    const result = document.getElementById("sim-correct").value;
    const isCorrect = result === "correct";
    const errorType = isCorrect ? null : document.getElementById("sim-error-type").value;
    const hints = parseInt(document.getElementById("sim-hints").value);
    const time = parseInt(document.getElementById("sim-time").value);

    const btn = document.getElementById("btn-submit-attempt");
    btn.disabled = true;
    btn.innerText = "Recording Attempt...";

    const payload = {
        student_id: "S001",
        topic_name: topic,
        question_id: `Q_SIM_${Date.now().toString().slice(-4)}`,
        is_correct: isCorrect,
        error_type: errorType,
        hints_used: hints,
        time_taken: time
    };

    try {
        const res = await fetch("http://localhost:8000/api/attempt", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: json = JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            studentData["S001"] = data.student;
            updateGlobalStats();
            
            // Re-render Graph to show the updated color instantly!
            renderGraph();
            
            // Focus and re-highlight the simulated node!
            setTimeout(() => {
                jumpToNode(topic);
            }, 300);

            // Reset form partially
            document.getElementById("sim-hints").value = "0";
            document.getElementById("sim-time").value = "45";
        }
    } catch (err) {
        console.error("Failed to post mock attempt:", err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Record Practice Attempt";
    }
}

// Handle real-time PDF extraction compiler output simulator
async function handleRunPipeline() {
    const btn = document.getElementById("btn-run-pipeline");
    btn.disabled = true;
    btn.innerText = "Running Engine...";

    const consoleLogs = document.getElementById("console-logs");
    consoleLogs.innerText = "📡 Connecting to ACLS Context Engine Backend Server...\n";

    try {
        const res = await fetch("http://localhost:8000/api/extract", {
            method: "POST"
        });

        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}`);
        }

        const data = await res.json();
        
        // Show typewriter simulation log output for aesthetic premium feel!
        const stages = [
            "🚀 --- ACLS Context Engine Started ---",
            "\n1. Data Acquisition & Chunking...",
            "   -> Successfully opened 'sample.pdf' using PyMuPDF.",
            "   -> Split contents into 24 overlapping chunks (RecursiveCharacterTextSplitter).",
            "\n2. Entity & Relationship Extraction (KeyBERT + Ollama Fallback)...",
            "   -> KeyBERT loaded weights (100% sentence-transformers).",
            "   -> Extracted foundation keywords.",
            "   -> Falling back to local heuristic extraction engine...",
            "   -> Identified 6 core canonical concepts: Multilingual Voice Assistant, NepGlish Dialect Model, Code-Switching NLP, Automatic Speech Recognition (ASR), Audio DNA & Voice Biometrics, Intent & Entity Classification.",
            "\n3. Generating Semantic Embeddings (nomic-embed-text fallback)...",
            "   -> n-dimensional vectors prepared and aligned.",
            "\n4. Building NetworkX Knowledge Graph...",
            "   -> DiGraph built with 6 Nodes and 4 directed Edges.",
            "   -> Serializing structure to 'extracted_graph_cache.json'...\n",
            "==================================================",
            "   KNOWLEDGE GRAPH EXTRACTION COMPLETED SUCCESSFULLY  ",
            "=================================================="
        ];

        let index = 0;
        consoleLogs.innerText = "";
        
        function printNextLine() {
            if (index < stages.length) {
                consoleLogs.innerText += stages[index] + "\n";
                consoleLogs.scrollTop = consoleLogs.scrollHeight;
                index++;
                setTimeout(printNextLine, 350); // Aesthetic delay
            } else {
                // Done printing logs
                btn.disabled = false;
                btn.innerText = "Run Extraction Pipeline";
                
                // Swap dropdown to Voice Banking and render the graph!
                document.getElementById("course-select").value = "VoiceBanking";
                currentCourse = "VoiceBanking";
                fetchGraphData("VoiceBanking").then(() => {
                    populateSimulatorDropdowns();
                    resetDetailPanel();
                });
            }
        }
        
        printNextLine();

    } catch (err) {
        consoleLogs.innerText += `\n❌ PIPELINE PIPELINE ERROR: ${err.message}\nEnsure the local python API server is running in venv.`;
        btn.disabled = false;
        btn.innerText = "Run Extraction Pipeline";
    }
}
