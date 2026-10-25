import streamlit as st
import pandas as pd
import joblib
import sqlite3
import os
from datetime import datetime
import uuid


# ============================================================
# CONFIGURATION
# ============================================================

st.set_page_config(
    page_title="UrbanAI",
    page_icon="🏙️",
    layout="wide",
    initial_sidebar_state="expanded"
)


# ============================================================
# PATHS
# ============================================================

DB_PATH = "app/urbanai.db"
UPLOAD_FOLDER = "app/uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ============================================================
# LOAD AI MODELS
# ============================================================

category_model = joblib.load(
    "models/complaint_classifier.pkl"
)

severity_model = joblib.load(
    "models/severity_model.pkl"
)

priority_model = joblib.load(
    "models/priority_model.pkl"
)
DEPARTMENT_MAP = {
    "pothole": "Road Department",
    "road_damage": "Road Department",
    "garbage": "Waste Management Department",
    "streetlight": "Electrical Department",
    "water_leakage": "Water Supply Department",
    "drainage": "Drainage Department"
}


# ============================================================
# DATABASE
# ============================================================

def init_database():
    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            complaint TEXT,
            category TEXT,
            severity TEXT,
            priority TEXT,
            department TEXT,
            location TEXT,
            status TEXT,
            image_path TEXT,
            created_at TEXT
        )
    """)

    cursor.execute("PRAGMA table_info(complaints)")
    columns = [column[1] for column in cursor.fetchall()]

    if "department" not in columns:
        cursor.execute(
            "ALTER TABLE complaints ADD COLUMN department TEXT"
        )

    connection.commit()
    connection.close()


init_database()
# ============================================================
# DATABASE FUNCTIONS
# ============================================================

def save_complaint(
    complaint,
    category,
    severity,
    priority,
    department,
    location,
    image_path
):
    complaint_id = "UA-" + str(uuid.uuid4())[:8].upper()

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO complaints
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            complaint_id,
            complaint,
            category,
            severity,
            priority,
            department,
            location,
            "Submitted",
            image_path,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
    )

    connection.commit()
    connection.close()

    return complaint_id

def get_complaints():

    connection = sqlite3.connect(DB_PATH)

    dataframe = pd.read_sql_query(
        "SELECT * FROM complaints ORDER BY created_at DESC",
        connection
    )

    connection.close()

    return dataframe

def update_complaint_status(complaint_id, new_status):

    connection = sqlite3.connect(DB_PATH)

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE complaints
        SET status = ?
        WHERE id = ?
        """,
        (new_status, complaint_id)
    )

    connection.commit()
    connection.close()


# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown("""
<style>

.main {
    background-color: #f7f9fc;
}

.block-container {
    padding-top: 2rem;
    padding-bottom: 3rem;
    max-width: 1200px;
}


/* Main title */

.hero-title {
    font-size: 48px;
    font-weight: 800;
    margin-bottom: 10px;
    color: #17324d;
}

.hero-subtitle {
    font-size: 20px;
    color: #5d6b7a;
    margin-bottom: 30px;
}


/* Cards */

.metric-card {
    background: white;
    padding: 24px;
    border-radius: 16px;
    border: 1px solid #e5eaf0;
    box-shadow: 0 4px 15px rgba(0,0,0,0.04);
}

.metric-number {
    font-size: 32px;
    font-weight: 700;
    color: #17324d;
}

.metric-label {
    font-size: 14px;
    color: #6b7785;
}


/* Section headings */

.section-title {
    font-size: 28px;
    font-weight: 700;
    color: #17324d;
    margin-top: 30px;
    margin-bottom: 15px;
}


/* AI result cards */

.result-card {
    background: white;
    padding: 22px;
    border-radius: 16px;
    border: 1px solid #e4e9ef;
    text-align: center;
    min-height: 130px;
}

.result-label {
    font-size: 14px;
    color: #6b7785;
}

.result-value {
    font-size: 27px;
    font-weight: 700;
    margin-top: 8px;
    color: #17324d;
}


/* Info */

.info-box {
    background: #eef5ff;
    border-left: 5px solid #2f80ed;
    padding: 18px;
    border-radius: 10px;
    margin: 15px 0;
}


/* Footer */

.footer {
    text-align: center;
    color: #7a8794;
    padding: 30px;
    margin-top: 50px;
    border-top: 1px solid #e5eaf0;
}

</style>
""", unsafe_allow_html=True)


# ============================================================
# SIDEBAR
# ============================================================

with st.sidebar:

    st.markdown(
        "# 🏙️ UrbanAI"
    )

    st.caption(
        "AI-Powered Urban Problem Detection"
    )

    st.divider()

    page = st.radio(
    "Navigation",
    [
        "🏠 Home",
        "📝 Report Problem",
        "🔎 Track Complaint",
        "📋 Complaints",
        "📊 Dashboard",
        "🤖 AI Analysis"
    ]
)

    st.divider()

    st.info(
        "UrbanAI uses machine learning to "
        "classify and prioritize urban complaints."
    )


# ============================================================
# HOME
# ============================================================

if page == "🏠 Home":

    st.markdown(
        '<div class="hero-title">Smart Cities Start With Smart Reporting.</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="hero-subtitle">'
        'Report urban problems and let AI analyze their category, '
        'severity and priority.'
        '</div>',
        unsafe_allow_html=True
    )

    col1, col2 = st.columns([2, 1])

    with col1:

        st.markdown(
            "### 🏙️ Making Urban Problem Management Smarter"
        )

        st.write(
            "UrbanAI is an AI-powered platform designed to help "
            "citizens report urban problems and help authorities "
            "identify which problems require attention first."
        )

        st.markdown(
            '<div class="info-box">'
            '<b>AI Pipeline:</b><br>'
            'Complaint → Category → Severity → Priority'
            '</div>',
            unsafe_allow_html=True
        )

        if st.button(
            "📝 Report a Problem",
            use_container_width=True
        ):
            st.session_state["page"] = "📝 Report Problem"
            st.rerun()

    with col2:

        st.markdown("### 🤖 AI Engine")

        st.write("✔ Complaint Classification")
        st.write("✔ Severity Prediction")
        st.write("✔ Priority Prediction")
        st.write("✔ Complaint Database")

    st.markdown(
        '<div class="section-title">How UrbanAI Works</div>',
        unsafe_allow_html=True
    )

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.markdown("### 📝")
        st.markdown("**1. Report**")
        st.caption("Citizen submits an urban complaint.")

    with col2:
        st.markdown("### 🤖")
        st.markdown("**2. Analyze**")
        st.caption("AI analyzes the complaint.")

    with col3:
        st.markdown("### 🚨")
        st.markdown("**3. Prioritize**")
        st.caption("System determines urgency.")

    with col4:
        st.markdown("### 🏛️")
        st.markdown("**4. Act**")
        st.caption("Authorities can manage the issue.")

    st.markdown(
        '<div class="footer">'
        'UrbanAI • AI-Powered Urban Problem Management System'
        '</div>',
        unsafe_allow_html=True
    )


# ============================================================
# REPORT PROBLEM
# ============================================================
# ============================================================
# REPORT PROBLEM
# ============================================================

elif page == "📝 Report Problem":

    st.markdown(
        '<div class="hero-title">Report an Urban Problem</div>',
        unsafe_allow_html=True
    )

    st.write(
        "Provide details about the problem. "
        "Our AI will analyze your complaint."
    )

    complaint = st.text_area(
        "Describe the problem",
        placeholder=(
            "Example: Huge pothole causing accidents "
            "near the school..."
        ),
        height=150
    )

    location = st.text_input(
        "📍 Location",
        placeholder="Example: College Road, Nashik"
    )

    uploaded_image = st.file_uploader(
        "📷 Upload an image (optional)",
        type=["jpg", "jpeg", "png"]
    )

    st.divider()

    if st.button(
        "🚀 Analyze & Submit",
        use_container_width=True
    ):

        if complaint.strip() == "":
            st.warning("Please enter a complaint description.")

        else:

            # AI predictions
            category = category_model.predict([complaint])[0]

            severity = severity_model.predict([complaint])[0]

            priority = priority_model.predict([complaint])[0]

            # Department assignment
            department = DEPARTMENT_MAP.get(
                category,
                "Municipal Administration"
            )

            # Save uploaded image
            image_path = ""

            if uploaded_image is not None:

                file_name = (
                    str(uuid.uuid4())
                    + "_"
                    + uploaded_image.name
                )

                image_path = os.path.join(
                    UPLOAD_FOLDER,
                    file_name
                )

                with open(image_path, "wb") as file:
                    file.write(
                        uploaded_image.getbuffer()
                    )

            # Save complaint
            complaint_id = save_complaint(
                complaint,
                category,
                severity,
                priority,
                department,
                location,
                image_path
            )

            # Success message
            st.success(
                "Complaint submitted successfully!"
            )

            st.markdown(
                f"### Complaint ID: `{complaint_id}`"
            )

            st.info(
                "Please save this Complaint ID to track "
                "your complaint."
            )

            # AI results
            st.markdown(
                "### 🤖 AI Analysis"
            )

            col1, col2, col3, col4 = st.columns(4)

            with col1:
                st.metric(
                    "Category",
                    category
                )

            with col2:
                st.metric(
                    "Severity",
                    severity.upper()
                )

            with col3:
                st.metric(
                    "Priority",
                    priority.upper()
                )

            with col4:
                st.metric(
                    "Department",
                    department
                )

            # Show uploaded evidence
            if image_path:

                st.markdown(
                    "### 📷 Uploaded Evidence"
                )

                if os.path.exists(image_path):

                    st.image(
                        image_path,
                        width=500
                    )
# ============================================================
# TRACK COMPLAINT
# ============================================================

# ============================================================
# TRACK COMPLAINT
# ============================================================

elif page == "🔎 Track Complaint":

    st.markdown(
        '<div class="hero-title">Track Your Complaint</div>',
        unsafe_allow_html=True
    )

    st.write(
        "Enter your complaint ID to check the current "
        "status of your reported problem."
    )

    complaint_id = st.text_input(
        "Complaint ID",
        placeholder="Example: UA-1234ABCD"
    )

    if st.button(
        "🔎 Track Complaint",
        use_container_width=True
    ):

        if complaint_id.strip() == "":

            st.warning(
                "Please enter your Complaint ID."
            )

        else:

            connection = sqlite3.connect(DB_PATH)

            dataframe = pd.read_sql_query(
                """
                SELECT *
                FROM complaints
                WHERE id = ?
                """,
                connection,
                params=(
                    complaint_id.strip().upper(),
                )
            )

            connection.close()

            if dataframe.empty:

                st.error(
                    "Complaint not found. "
                    "Please check your Complaint ID."
                )

            else:

                complaint_data = dataframe.iloc[0]

                st.success(
                    "Complaint found successfully!"
                )

                st.markdown(
                    f"### Complaint ID: "
                    f"`{complaint_data['id']}`"
                )

                st.divider()

                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    st.metric(
                        "Category",
                        complaint_data["category"]
                    )

                with col2:
                    st.metric(
                        "Severity",
                        complaint_data["severity"].upper()
                    )

                with col3:
                    st.metric(
                        "Priority",
                        complaint_data["priority"].upper()
                    )

                with col4:

                    department = complaint_data["department"]

                    if pd.isna(department):
                        department = "Not Assigned"

                    st.metric(
                        "Department",
                        department
                    )

                st.markdown(
                    "### 📋 Complaint Details"
                )

                st.write(
                    complaint_data["complaint"]
                )

                st.write(
                    f"📍 **Location:** "
                    f"{complaint_data['location']}"
                )

                st.write(
                    f"📅 **Submitted:** "
                    f"{complaint_data['created_at']}"
                )

                st.markdown(
                    "### 📍 Complaint Status"
                )

                status = complaint_data["status"]

                status_steps = [
                    "Submitted",
                    "Under Review",
                    "Assigned",
                    "In Progress",
                    "Resolved"
                ]

                current_index = (
                    status_steps.index(status)
                    if status in status_steps
                    else 0
                )

                for index, step in enumerate(status_steps):

                    if index <= current_index:

                        st.success(
                            f"✓ {step}"
                        )

                    else:

                        st.write(
                            f"○ {step}"
                        )

                if complaint_data["image_path"]:

                    st.markdown(
                        "### 📷 Uploaded Evidence"
                    )

                    if os.path.exists(
                        complaint_data["image_path"]
                    ):

                        st.image(
                            complaint_data["image_path"],
                            width=500
                        )
# ============================================================
# COMPLAINTS
# ============================================================

# ============================================================
# ADMIN COMPLAINT MANAGEMENT
# ============================================================

elif page == "📋 Complaints":

    st.markdown(
        '<div class="hero-title">Complaint Management</div>',
        unsafe_allow_html=True
    )

    st.write(
        "Review complaints and update their current status."
    )

    dataframe = get_complaints()

    if dataframe.empty:

        st.info(
            "No complaints have been submitted yet."
        )

    else:

        # ----------------------------------------------------
        # Summary
        # ----------------------------------------------------

        total = len(dataframe)

        urgent = len(
            dataframe[
                dataframe["priority"] == "urgent"
            ]
        )

        pending = len(
            dataframe[
                dataframe["status"] != "Resolved"
            ]
        )

        resolved = len(
            dataframe[
                dataframe["status"] == "Resolved"
            ]
        )

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric(
                "Total",
                total
            )

        with col2:
            st.metric(
                "Urgent",
                urgent
            )

        with col3:
            st.metric(
                "Pending",
                pending
            )

        with col4:
            st.metric(
                "Resolved",
                resolved
            )

        st.divider()

        # ----------------------------------------------------
        # Complaint selection
        # ----------------------------------------------------

        complaint_ids = dataframe["id"].tolist()

        selected_id = st.selectbox(
            "Select Complaint",
            complaint_ids
        )

        selected = dataframe[
            dataframe["id"] == selected_id
        ].iloc[0]

        # ----------------------------------------------------
        # Complaint Details
        # ----------------------------------------------------

        st.markdown("### Complaint Details")

        col1, col2 = st.columns(2)

        with col1:

            st.write(
                f"**Complaint ID:** {selected['id']}"
            )

            st.write(
                f"**Category:** {selected['category']}"
            )

            st.write(
                f"**Severity:** {selected['severity'].upper()}"
            )

            st.write(
                f"**Priority:** {selected['priority'].upper()}"
            )

        with col2:

            st.write(
                f"**Location:** {selected['location']}"
            )

            st.write(
                f"**Status:** {selected['status']}"
            )

            st.write(
                f"**Submitted:** {selected['created_at']}"
            )

        st.markdown("### 📝 Complaint")

        st.info(
            selected["complaint"]
        )

        # ----------------------------------------------------
        # Image
        # ----------------------------------------------------

        if selected["image_path"]:

            if os.path.exists(
                selected["image_path"]
            ):

                st.markdown(
                    "### 📷 Evidence"
                )

                st.image(
                    selected["image_path"],
                    width=500
                )

        st.divider()

        # ----------------------------------------------------
        # Status Update
        # ----------------------------------------------------

        st.markdown(
            "### 🔄 Update Complaint Status"
        )

        statuses = [
            "Submitted",
            "Under Review",
            "Assigned",
            "In Progress",
            "Resolved"
        ]

        current_status = selected["status"]

        current_index = (
            statuses.index(current_status)
            if current_status in statuses
            else 0
        )

        new_status = st.selectbox(
            "New Status",
            statuses,
            index=current_index
        )

        if st.button(
            "💾 Update Status",
            use_container_width=True
        ):

            update_complaint_status(
                selected_id,
                new_status
            )

            st.success(
                f"Complaint {selected_id} "
                f"updated to '{new_status}'."
            )

            st.rerun()

# ============================================================
# DASHBOARD
# ============================================================

elif page == "📊 Dashboard":

    st.markdown(
        '<div class="hero-title">UrbanAI Dashboard</div>',
        unsafe_allow_html=True
    )

    dataframe = get_complaints()

    total = len(dataframe)

    urgent = len(
        dataframe[
            dataframe["priority"] == "urgent"
        ]
    ) if total > 0 else 0

    pending = len(
        dataframe[
            dataframe["status"] == "Submitted"
        ]
    ) if total > 0 else 0

    resolved = len(
        dataframe[
            dataframe["status"] == "Resolved"
        ]
    ) if total > 0 else 0


    col1, col2, col3, col4 = st.columns(4)

    with col1:

        st.metric(
            "Total Complaints",
            total
        )

    with col2:

        st.metric(
            "Urgent Problems",
            urgent
        )

    with col3:

        st.metric(
            "Pending",
            pending
        )

    with col4:

        st.metric(
            "Resolved",
            resolved
        )


    if total > 0:

        st.markdown(
            '<div class="section-title">'
            'Problem Categories'
            '</div>',
            unsafe_allow_html=True
        )

        category_counts = (
            dataframe["category"]
            .value_counts()
        )

        st.bar_chart(
            category_counts
        )

        st.markdown(
            '<div class="section-title">'
            'Priority Distribution'
            '</div>',
            unsafe_allow_html=True
        )

        priority_counts = (
            dataframe["priority"]
            .value_counts()
        )

        st.bar_chart(
            priority_counts
        )


# ============================================================
# AI ANALYSIS
# ============================================================

elif page == "🤖 AI Analysis":

    st.markdown(
        '<div class="hero-title">AI Complaint Analyzer</div>',
        unsafe_allow_html=True
    )

    st.write(
        "Test UrbanAI's machine learning models directly."
    )

    complaint = st.text_area(
        "Enter a complaint",
        placeholder=(
            "Example: Water pipeline has burst "
            "near the main road..."
        ),
        height=150
    )

    if st.button(
        "🔍 Analyze Complaint",
        use_container_width=True
    ):

        if complaint.strip() == "":

            st.warning(
                "Please enter a complaint."
            )

        else:

            category = category_model.predict(
                [complaint]
            )[0]

            severity = severity_model.predict(
                [complaint]
            )[0]

            priority = priority_model.predict(
                [complaint]
            )[0]

            department = DEPARTMENT_MAP.get(
                category,
                "Municipal Administration"
            )

            # Confidence

            category_probability = max(
                category_model.predict_proba(
                    [complaint]
                )[0]
            )

            severity_probability = max(
                severity_model.predict_proba(
                    [complaint]
                )[0]
            )

            priority_probability = max(
                priority_model.predict_proba(
                    [complaint]
                )[0]
            )


            st.success(
                "AI analysis completed."
            )

            col1, col2, col3 = st.columns(3)

            with col1:

                st.metric(
                    "Category",
                    category
                )

                st.progress(
                    float(category_probability)
                )

                st.caption(
                    f"Confidence: "
                    f"{category_probability * 100:.1f}%"
                )

            with col2:

                st.metric(
                    "Severity",
                    severity.upper()
                )

                st.progress(
                    float(severity_probability)
                )

                st.caption(
                    f"Confidence: "
                    f"{severity_probability * 100:.1f}%"
                )

            with col3:

                st.metric(
                    "Priority",
                    priority.upper()
                )

                st.progress(
                    float(priority_probability)
                )

                st.caption(
                    f"Confidence: "
                    f"{priority_probability * 100:.1f}%"
                )